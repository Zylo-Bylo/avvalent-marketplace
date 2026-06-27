import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { requireAdminUser } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/session-cookies';
import {
  adjustProductStock,
  getAdminInventoryData,
  updateInventorySettings,
} from '@/lib/inventory';
import { adjustVariantStock } from '@/lib/variants';

export const runtime = 'nodejs';

async function requireAdmin() {
  if (!(await requireAdminUser())) {
    return null;
  }
  const session = await getAuthSession();
  return session?.userId || null;
}

function inventoryRowsToCsv(rows: any[]) {
  const header = [
    'Product Name',
    'Vendor Name',
    'SKU',
    'MPN',
    'Current Stock',
    'Reserved Stock',
    'Available Stock',
    'Stock Status',
    'Last Updated',
  ];
  const lines = rows.map((row) =>
    [
      row.product?.name,
      row.vendor?.storeName,
      row.product?.sku || row.inventory?.sku,
      row.inventory?.mpn,
      row.inventory?.currentStock,
      row.inventory?.reservedStock,
      row.inventory?.availableStock,
      row.inventory?.stockStatus,
      row.inventory?.lastStockUpdatedAt,
    ]
      .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
      .join(','),
  );
  return [header.join(','), ...lines].join('\n');
}

async function ensureNotificationTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Notification" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "message" TEXT NOT NULL,
      "read" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export async function GET(request: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const data = await getAdminInventoryData({
    q: searchParams.get('q') || '',
    status: searchParams.get('status') || 'ALL',
    vendorId: searchParams.get('vendorId') || '',
  });
  const format = searchParams.get('format') || '';

  if (format === 'csv' || format === 'excel') {
    const csv = inventoryRowsToCsv(data.rows);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': format === 'excel' ? 'application/vnd.ms-excel' : 'text/csv',
        'Content-Disposition': `attachment; filename="zylo-buylo-inventory-report.${format === 'excel' ? 'xls' : 'csv'}"`,
      },
    });
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const adminId = await requireAdmin();
  if (!adminId) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || 'adjust');
    const productId = String(body.productId || '');
    const variantId = String(body.variantId || '');

    if (!productId && !variantId) {
      return NextResponse.json({ error: 'Product is required.' }, { status: 400 });
    }

    if (action === 'settings') {
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
      });
    } else if (action === 'reminder') {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          name: true,
          vendor: {
            select: {
              id: true,
              storeName: true,
              userId: true,
              user: {
                select: {
                  email: true,
                },
              },
            },
          },
        },
      });

      if (!product?.vendor?.userId) {
        return NextResponse.json(
          { error: 'Vendor account not found for this product.' },
          { status: 404 },
        );
      }

      await ensureNotificationTable();

      await prisma.$executeRaw`
        INSERT INTO "Notification" ("id", "userId", "title", "message", "read", "createdAt")
        VALUES (
          ${randomUUID()},
          ${product.vendor.userId},
          ${'Restock reminder'},
          ${`${product.name} needs stock review. Please update inventory or restock date.`},
          false,
          CURRENT_TIMESTAMP
        )
      `;

      const data = await getAdminInventoryData({});
      return NextResponse.json({
        message: `Reminder sent to ${product.vendor.storeName || product.vendor.user.email}.`,
        ...data,
      });
    } else if (variantId) {
      await adjustVariantStock({
        variantId,
        quantity: Number(body.quantity || 0),
        mode: body.mode === 'REMOVE' ? 'REMOVE' : body.mode === 'SET' ? 'SET' : 'ADD',
      });
    } else {
      await adjustProductStock({
        productId,
        quantity: Number(body.quantity || 0),
        mode: body.mode === 'REMOVE' ? 'REMOVE' : body.mode === 'SET' ? 'SET' : 'ADD',
        reason: String(body.reason || 'Admin stock update.'),
        adjustedByUserId: adminId,
      });
    }

    const data = await getAdminInventoryData({});
    return NextResponse.json({ message: 'Inventory action completed.', ...data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Inventory action failed.' },
      { status: 400 },
    );
  }
}
