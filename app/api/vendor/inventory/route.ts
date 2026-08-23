import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/session-cookies';
import {
  adjustProductStock,
  getVendorInventoryData,
  updateInventorySettings,
} from '@/lib/inventory';
import { adjustVariantStock, ensureVariantSchema, ProductVariantRow } from '@/lib/variants';

async function getVendor() {
  const session = await getAuthSession();
  if (!session?.userId) {
    return { error: 'Unauthorized', status: 401 as const };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { vendorProfile: true },
  });

  if (!user || user.role !== 'VENDOR' || !user.vendorProfile) {
    return { error: 'Vendor access required', status: 403 as const };
  }

  return { vendor: user.vendorProfile, userId: user.id };
}

async function assertOwnProduct(vendorId: string, productId: string) {
  const product = await prisma.product.findFirst({
    where: { id: productId, vendorId },
    select: { id: true },
  });

  if (!product) {
    throw new Error('Product not found or unauthorized.');
  }
}

async function getVendorVariant(vendorId: string, variantId: string) {
  await ensureVariantSchema();
  const rows = await prisma.$queryRaw<ProductVariantRow[]>`
    SELECT pv.*
    FROM "ProductVariant" pv
    INNER JOIN "Product" p ON p."id" = pv."productId"
    WHERE pv."id" = ${variantId} AND p."vendorId" = ${vendorId}
    LIMIT 1
  `;

  if (!rows[0]) {
    throw new Error('Variant not found or unauthorized.');
  }

  return rows[0];
}

export async function GET(request: NextRequest) {
  const auth = await getVendor();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const data = await getVendorInventoryData(auth.vendor.id, {
    warehouseId: searchParams.get('warehouseId') || 'ALL',
  });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  try {
    const auth = await getVendor();
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json().catch(() => ({}));
    const variantId = String(body.variantId || '');
    if (variantId) {
      await getVendorVariant(auth.vendor.id, variantId);
      await adjustVariantStock({
        variantId,
        quantity: Number(body.quantity || 0),
        mode: body.mode === 'REMOVE' ? 'REMOVE' : body.mode === 'SET' ? 'SET' : 'ADD',
      });

      const data = await getVendorInventoryData(auth.vendor.id);
      return NextResponse.json({ message: 'Variant stock updated.', ...data });
    }

    const productId = String(body.productId || '');
    await assertOwnProduct(auth.vendor.id, productId);
    await adjustProductStock({
      productId,
      quantity: Number(body.quantity || 0),
      mode:
        body.mode === 'REMOVE'
          ? 'REMOVE'
          : body.mode === 'SET'
            ? 'SET'
            : body.mode === 'DAMAGE'
              ? 'DAMAGE'
              : 'ADD',
      warehouseId: body.warehouseId || null,
      reasonCode: body.reasonCode || null,
      reason: String(body.reason || 'Vendor stock update.'),
      adjustedByUserId: auth.userId,
    });

    const data = await getVendorInventoryData(auth.vendor.id, {
      warehouseId: body.warehouseId || 'ALL',
    });
    return NextResponse.json({ message: 'Stock updated.', ...data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Stock update failed.' },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await getVendor();
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json().catch(() => ({}));
    const productId = String(body.productId || '');
    await assertOwnProduct(auth.vendor.id, productId);
    await updateInventorySettings({
      productId,
      lowStockThreshold: Number(body.lowStockThreshold || 0),
      criticalStockThreshold: Number(body.criticalStockThreshold || 0),
      minimumOrderQuantity: Number(body.minimumOrderQuantity || 1),
      maximumOrderQuantity:
        body.maximumOrderQuantity === '' || body.maximumOrderQuantity === null
          ? null
          : Number(body.maximumOrderQuantity || 0),
      restockDate: body.restockDate || null,
      mpn: body.mpn || null,
      allowBackorder: Boolean(body.allowBackorder),
      isPreOrder: Boolean(body.isPreOrder),
      bulkPricingTiers: body.bulkPricingTiers || null,
      warehouseId: body.warehouseId,
    });

    const data = await getVendorInventoryData(auth.vendor.id, {
      warehouseId: body.warehouseId || 'ALL',
    });
    return NextResponse.json({ message: 'Inventory settings saved.', ...data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Inventory settings update failed.' },
      { status: 400 },
    );
  }
}
