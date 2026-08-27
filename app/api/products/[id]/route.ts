import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  getFallbackProductById,
  shouldUseFallbackCatalog,
} from '@/lib/fallback-catalog';
import { normalizeProductImageFallback } from '@/lib/product-image-fallback';
import { adjustProductStock, ensureProductInventory } from '@/lib/inventory';
import { calculateMarketplacePricing } from '@/lib/pricing';
import type { ProductVariantRow } from '@/lib/variants';

async function getProductManager() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;

  if (!token) {
    return { error: 'Unauthorized', status: 401 as const };
  }

  const data = verifyToken(token);
  if (!data || typeof data !== 'object' || !data.userId) {
    return { error: 'Invalid token', status: 401 as const };
  }

  const user = await prisma.user.findUnique({
    where: { id: String(data.userId) },
    include: { vendorProfile: true },
  });

  if (!user) {
    return { error: 'User not found', status: 404 as const };
  }

  if (user.role !== 'ADMIN' && !user.vendorProfile) {
    return { error: 'Not a vendor or admin', status: 403 as const };
  }

  if (user.role !== 'ADMIN' && user.vendorProfile?.status !== 'APPROVED') {
    return {
      error: 'Vendor account must be approved before managing products.',
      status: 403 as const,
    };
  }

  return { user };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [product, variants] = await Promise.all([
      prisma.product.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          mrp: true,
          discountPercent: true,
          discountAmount: true,
          shippingCharge: true,
          sku: true,
          inventory: true,
          images: true,
          category: {
            select: {
              id: true,
              name: true,
            },
          },
          subcategory: {
            select: {
              id: true,
              name: true,
            },
          },
          vendor: {
            select: {
              id: true,
              storeName: true,
              description: true,
              logoUrl: true,
              businessCategory: true,
              status: true,
              _count: {
                select: {
                  products: true,
                  orders: true,
                },
              },
            },
          },
          _count: {
            select: {
              reviews: true,
            },
          },
          inventories: {
            take: 1,
            select: {
              currentStock: true,
              reservedStock: true,
              availableStock: true,
              lowStockThreshold: true,
              criticalStockThreshold: true,
              minimumOrderQuantity: true,
              maximumOrderQuantity: true,
              restockDate: true,
              stockStatus: true,
              allowBackorder: true,
              isPreOrder: true,
              bulkPricingTiers: true,
            },
          },
        },
      }),
      prisma.productVariant.findMany({
        where: { productId: id },
        orderBy: [{ numericSize: 'asc' }, { sizeLabel: 'asc' }, { color: 'asc' }],
        select: {
          id: true,
          productId: true,
          sizeLabel: true,
          numericSize: true,
          color: true,
          sku: true,
          stockQuantity: true,
          price: true,
          vendorPrice: true,
          mrp: true,
          imageUrl: true,
          status: true,
          lowStockThreshold: true,
        },
      }) as Promise<ProductVariantRow[]>,
    ]);

    if (!product || product.vendor?.status !== 'APPROVED') {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json(
      {
        product: {
          ...normalizeProductImageFallback(product),
          variants,
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      },
    );
  } catch (error) {
    console.error('Product fetch error:', error);
    if (shouldUseFallbackCatalog(error)) {
      const { id } = await params;
      const product = getFallbackProductById(id);

      if (!product) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      }

      return NextResponse.json({ product });
    }

    return NextResponse.json(
      { error: 'Failed to fetch product' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const manager = await getProductManager();

    if ('error' in manager) {
      return NextResponse.json(
        { error: manager.error },
        { status: manager.status }
      );
    }

    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    if (
      manager.user.role !== 'ADMIN' &&
      product.vendorId !== manager.user.vendorProfile?.id
    ) {
      return NextResponse.json(
        { error: 'Product not found or unauthorized' },
        { status: 404 }
      );
    }

    const {
      name,
      description,
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
      sku,
      inventory,
      images,
    } = await request.json();
    const nextCategoryId =
      categoryId !== undefined ? categoryId || null : product.categoryId;
    const nextSubcategoryId =
      subcategoryId !== undefined ? subcategoryId || null : product.subcategoryId;

    if (nextCategoryId) {
      const category = await prisma.category.findUnique({
        where: { id: nextCategoryId },
        select: { id: true },
      });

      if (!category) {
        return NextResponse.json(
          { error: 'Selected category was not found.' },
          { status: 400 }
        );
      }
    }

    if (nextSubcategoryId) {
      const subcategory = await prisma.subcategory.findFirst({
        where: {
          id: nextSubcategoryId,
          ...(nextCategoryId ? { categoryId: nextCategoryId } : {}),
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

    const pricing =
      price !== undefined ||
      mrp !== undefined ||
      vendorPrice !== undefined ||
      sellingPrice !== undefined ||
      discountPercent !== undefined ||
      platformCommissionPercent !== undefined ||
      packagingCharge !== undefined ||
      weightGrams !== undefined ||
      packageSize !== undefined ||
      fragile !== undefined ||
      shippingCharge !== undefined ||
      codCharge !== undefined
        ? calculateMarketplacePricing({
            price: price !== undefined ? price : product.price,
            mrp: mrp !== undefined ? mrp : product.mrp,
            vendorPrice:
              vendorPrice !== undefined ? vendorPrice : product.vendorPrice,
            sellingPrice:
              sellingPrice !== undefined ? sellingPrice : product.sellingPrice,
            discountPercent:
              discountPercent !== undefined
                ? discountPercent
                : product.discountPercent,
            platformCommissionPercent:
              platformCommissionPercent !== undefined
                ? platformCommissionPercent
                : product.platformCommissionPercent,
            packagingCharge:
              packagingCharge !== undefined
                ? packagingCharge
                : product.packagingCharge,
            weightGrams:
              weightGrams !== undefined ? weightGrams : product.weightGrams,
            packageSize:
              packageSize !== undefined ? packageSize : product.packageSize,
            fragile: fragile !== undefined ? fragile : product.fragile,
            shippingCharge:
              shippingCharge !== undefined ? shippingCharge : product.shippingCharge,
            codCharge: codCharge !== undefined ? codCharge : product.codCharge,
          })
        : null;

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(pricing && {
          price: pricing.finalCustomerPrice,
          mrp: pricing.mrp,
          vendorPrice: pricing.vendorPrice,
          sellingPrice: pricing.sellingPrice,
          discountPercent: pricing.discountPercent,
          discountAmount: pricing.discountAmount,
          platformCommissionPercent: pricing.platformCommissionPercent,
          platformCommissionAmount: pricing.platformCommissionAmount,
          packagingCharge: pricing.packagingCharge,
          weightGrams: pricing.weightGrams || null,
          packageSize: pricing.packageSize,
          fragile: pricing.fragile,
          shippingCharge: pricing.shippingCharge,
          codCharge: pricing.codCharge,
          finalCustomerPrice: pricing.finalCustomerPrice,
          vendorPayout: pricing.vendorPayout,
          priceApproved: manager.user.role === 'ADMIN' || product.priceApproved,
        }),
        ...(categoryId !== undefined && { categoryId: categoryId || null }),
        ...(subcategoryId !== undefined
          ? { subcategoryId: subcategoryId || null }
          : categoryId !== undefined
            ? { subcategoryId: null }
            : {}),
        ...(sku !== undefined && { sku: sku || null }),
        ...(inventory !== undefined && { inventory: parseInt(inventory) }),
        ...(images !== undefined && {
          images: Array.isArray(images) ? images : [],
        }),
      },
      include: {
        category: true,
        subcategory: true,
        vendor: {
          select: {
            id: true,
            storeName: true,
          },
        },
      },
    });

    await ensureProductInventory(updatedProduct.id, {
      id: updatedProduct.id,
      vendorId: updatedProduct.vendorId,
      sku: updatedProduct.sku,
      inventory: updatedProduct.inventory,
    });
    if (inventory !== undefined) {
      await adjustProductStock({
        productId: updatedProduct.id,
        quantity: Number(inventory || 0),
        mode: 'SET',
        reason: 'Product stock updated from product editor.',
        adjustedByUserId: manager.user.id,
      });
    }

    return NextResponse.json(updatedProduct);
  } catch (error) {
    console.error('Product update error:', error);
    return NextResponse.json(
      { error: 'Failed to update product' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const manager = await getProductManager();

    if ('error' in manager) {
      return NextResponse.json(
        { error: manager.error },
        { status: manager.status }
      );
    }

    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    if (
      manager.user.role !== 'ADMIN' &&
      product.vendorId !== manager.user.vendorProfile?.id
    ) {
      return NextResponse.json(
        { error: 'Product not found or unauthorized' },
        { status: 404 }
      );
    }

    await prisma.product.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Product deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to delete product' },
      { status: 500 }
    );
  }
}
