import { NextResponse } from 'next/server';
import {
  getLocalVendorUser,
  shouldUseLocalSqliteAuth,
} from '@/lib/local-sqlite-auth';
import { calculateMarketplacePricing } from '@/lib/pricing';
import { getCommissionPercent } from '@/lib/payouts';
import { ensureProductInventory } from '@/lib/inventory';
import { getAuthSession } from '@/lib/session-cookies';
import { normalizeVariants, replaceProductVariants } from '@/lib/variants';

type ProductSkuClient = {
  product: {
    findUnique(args: {
      where: { sku: string };
      select: { id: true };
    }): Promise<{ id: string } | null>;
  };
};

function normalizeSkuPart(value: unknown) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toUpperCase();
}

async function getUniqueProductSku(
  prisma: ProductSkuClient,
  rawSku: unknown,
  vendorId: string,
) {
  const base = normalizeSkuPart(rawSku);

  if (!base) {
    return undefined;
  }

  const vendorSuffix = normalizeSkuPart(vendorId).slice(-8) || 'VENDOR';
  let candidate = base;
  let counter = 1;

  while (
    await prisma.product.findUnique({
      where: { sku: candidate },
      select: { id: true },
    })
  ) {
    candidate = `${base}-${vendorSuffix}-${counter}`;
    counter += 1;
  }

  return candidate;
}

export async function POST(request: Request) {
  try {
    const session = await getAuthSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const localUser = shouldUseLocalSqliteAuth()
      ? getLocalVendorUser(session.userId)
      : null;

    const {
      name,
      description,
      brand,
      modelNumber,
      partNumber,
      productType,
      productTypeId,
      condition,
      warranty,
      color,
      size,
      availableSizes,
      brandSizeMapping,
      material,
      fitment,
      returnPolicy,
      searchKeywords,
      price,
      mrp,
      vendorPrice,
      sellingPrice,
      discountPercent,
      platformCommissionPercent,
      packagingCharge,
      weightGrams,
      packageSize,
      fragile,
      shippingCharge,
      codCharge,
      categoryId,
      subcategoryId,
      vendorId,
      sku,
      inventory,
      images,
      variants,
    } = await request.json();

    const { prisma } = await import('@/lib/prisma');
    const currentUser = shouldUseLocalSqliteAuth()
      ? null
      : await prisma.user.findUnique({
          where: { id: session.userId },
          include: { vendorProfile: true },
        });
    const isAdmin = currentUser?.role === 'ADMIN' || session.role === 'ADMIN';
    const vendor = localUser?.vendorProfile
      ? {
          id: localUser.vendorProfile.id,
          status: localUser.vendorProfile.status,
        }
      : isAdmin
        ? await prisma.vendor.findUnique({
            where: { id: String(vendorId || '') },
          })
        : currentUser?.vendorProfile;

    if (!vendor) {
      return NextResponse.json(
        { error: isAdmin ? 'Please select a vendor for this product.' : 'Not a vendor' },
        { status: 403 },
      );
    }

    if (!isAdmin && vendor.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Vendor account must be approved before adding products.' },
        { status: 403 }
      );
    }

    const effectivePlatformCommissionPercent =
      platformCommissionPercent === undefined ||
      platformCommissionPercent === null ||
      String(platformCommissionPercent).trim() === ''
        ? await getCommissionPercent({
            vendorId: vendor.id,
            categoryId: categoryId ? String(categoryId) : undefined,
          })
        : platformCommissionPercent;

    const pricing = calculateMarketplacePricing({
      price,
      mrp,
      vendorPrice,
      sellingPrice,
      discountPercent,
      platformCommissionPercent: effectivePlatformCommissionPercent,
      packagingCharge,
      weightGrams,
      packageSize,
      fragile,
      shippingCharge,
      codCharge,
    });

    if (
      !name ||
      !description ||
      pricing.finalCustomerPrice <= 0 ||
      inventory === undefined ||
      inventory === null ||
      !categoryId
    ) {
      return NextResponse.json(
        { error: 'Product name, description, price, stock and category are required.' },
        { status: 400 },
      );
    }

    const slug = `${name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now()}`;

    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      select: {
        id: true,
        subcategories: {
          select: { id: true },
        },
      },
    });

    if (!category) {
      return NextResponse.json({ error: 'Selected category was not found.' }, { status: 400 });
    }

    if (category.subcategories.length > 0 && !subcategoryId) {
      return NextResponse.json(
        { error: 'Please select a subcategory for this category.' },
        { status: 400 },
      );
    }

    if (subcategoryId) {
      const subcategory = await prisma.subcategory.findFirst({
        where: {
          id: subcategoryId,
          categoryId,
        },
        select: { id: true },
      });

      if (!subcategory) {
        return NextResponse.json(
          { error: 'Selected subcategory does not belong to this category.' },
          { status: 400 }
        );
      }
    }

    if (productTypeId !== undefined && productTypeId !== null && typeof productTypeId !== 'string') {
      return NextResponse.json({ error: 'ProductType ID must be a string.' }, { status: 400 });
    }

    if (productTypeId) {
      if (!subcategoryId) {
        return NextResponse.json(
          { error: 'Please select a subcategory for this ProductType.' },
          { status: 400 },
        );
      }

      const productType = await prisma.productType.findFirst({
        where: { id: productTypeId, subcategoryId },
        select: { id: true },
      });

      if (!productType) {
        return NextResponse.json(
          { error: 'Selected ProductType was not found in this subcategory.' },
          { status: 400 },
        );
      }
    }

    const specs = [
      ['Brand', brand],
      ['Model number', modelNumber],
      ['Part number', partNumber],
      ['Product type', productType],
      ['Condition', condition],
      ['Warranty', warranty],
      ['Color', color],
      ['Size', size],
      ['Available sizes', availableSizes],
      ['Brand size mapping', brandSizeMapping],
      ['Material', material],
      ['Compatibility / fitment', fitment],
      ['Return policy', returnPolicy],
      ['Search keywords', searchKeywords],
    ]
      .filter(([, value]) => typeof value === 'string' && value.trim())
      .map(([label, value]) => `${label}: ${String(value).trim()}`);
    const fullDescription = specs.length
      ? `${description.trim()}\n\nProduct details:\n${specs.join('\n')}`
      : description.trim();

    if (!Array.isArray(variants) || variants.length === 0) {
      return NextResponse.json(
        { error: 'Add at least one size/color/stock variant before publishing.' },
        { status: 400 },
      );
    }

    const fallbackVariantSize =
      String(size || '').trim() ||
      String(availableSizes || '')
        .split(/[,/|]/)
        .map((item) => item.trim())
        .filter(Boolean)[0] ||
      '';
    const variantsWithSizeFallback = variants.map((variant: Record<string, unknown>) => ({
      ...variant,
      sizeLabel: String(variant.sizeLabel || '').trim() || fallbackVariantSize,
    }));
    const productSku = await getUniqueProductSku(prisma, sku, vendor.id);

    const normalizedVariants = normalizeVariants(variantsWithSizeFallback, {
      sku: productSku || sku,
      color,
      price: pricing.finalCustomerPrice,
      mrp: pricing.mrp,
      inventory: parseInt(inventory),
    });

    const product = await prisma.product.create({
      data: {
        name: String(name).trim(),
        slug,
        description: fullDescription,
        price: pricing.finalCustomerPrice,
        mrp: pricing.mrp,
        vendorPrice: pricing.vendorPrice,
        sellingPrice: pricing.sellingPrice,
        discountPercent: pricing.discountPercent,
        discountAmount: pricing.discountAmount,
        platformCommissionPercent: pricing.platformCommissionPercent,
        platformCommissionAmount: pricing.platformCommissionAmount,
        packagingCharge: pricing.packagingCharge,
        weightGrams: pricing.weightGrams || undefined,
        packageSize: pricing.packageSize,
        fragile: pricing.fragile,
        shippingCharge: pricing.shippingCharge,
        codCharge: pricing.codCharge,
        finalCustomerPrice: pricing.finalCustomerPrice,
        vendorPayout: pricing.vendorPayout,
        categoryId,
        subcategoryId: subcategoryId || undefined,
        productTypeId: productTypeId || undefined,
        sku: productSku,
        inventory: parseInt(inventory),
        images: Array.isArray(images) ? images : [],
        vendorId: vendor.id,
      },
      include: {
        category: true,
        subcategory: true,
      },
    });

    await ensureProductInventory(product.id, {
      id: product.id,
      vendorId: product.vendorId,
      sku: product.sku,
      inventory: product.inventory,
    });
    await replaceProductVariants(product.id, normalizedVariants);

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error('Product creation error:', error);
    const message = error instanceof Error ? error.message : 'Unknown product creation error';
    const lowerMessage = message.toLowerCase();
    const errorCode =
      typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code?: unknown }).code || '')
        : '';

    if (errorCode === 'P2002' || lowerMessage.includes('unique constraint failed')) {
      const target =
        typeof error === 'object' && error !== null && 'meta' in error
          ? (error as { meta?: { target?: unknown } }).meta?.target
          : undefined;
      const targetText = Array.isArray(target) ? target.join(', ') : String(target || '');

      if (targetText.toLowerCase().includes('sku') || lowerMessage.includes('sku')) {
        return NextResponse.json(
          {
            error:
              'SKU already exists. The system can auto-generate variant SKUs, but please change the main SKU or click Auto-fix SKUs and submit again.',
          },
          { status: 400 },
        );
      }

      return NextResponse.json(
        { error: 'Duplicate product data found. Please change the repeated unique value and submit again.' },
        { status: 400 },
      );
    }

    if (
      lowerMessage.includes('unique') &&
      lowerMessage.includes('productvariant') &&
      lowerMessage.includes('sku')
    ) {
      return NextResponse.json(
        {
          error:
            'Variant SKU already exists. Please change duplicate variant SKU values or use unique size/color rows.',
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: message || 'Failed to create product' },
      { status: 500 },
    );
  }
}
