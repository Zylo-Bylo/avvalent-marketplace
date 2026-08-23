import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  getVariantsForProducts,
  reduceVariantStockForOrder,
  restoreVariantStockForOrder,
} from '@/lib/variants';

export const RESERVATION_MINUTES = 10;

export const STOCK_STATUSES = [
  'IN_STOCK',
  'LOW_STOCK',
  'CRITICAL_STOCK',
  'OUT_OF_STOCK',
  'PRE_ORDER',
  'BACKORDER',
] as const;

export type StockStatusValue = (typeof STOCK_STATUSES)[number];

export const STOCK_REASON_CODES = [
  'OPENING_STOCK',
  'PURCHASE_RECEIPT',
  'STOCK_IN',
  'STOCK_OUT',
  'DAMAGED_STOCK',
  'MANUAL_ADJUSTMENT',
  'WAREHOUSE_ASSIGNMENT',
  'ORDER_RESERVATION',
  'ORDER_CONVERSION',
  'ORDER_RELEASE',
  'ORDER_RETURN',
  'ADMIN_ADJUSTMENT',
  'VENDOR_ADJUSTMENT',
  'LEGACY_SYNC',
] as const;

export type StockReasonCode = (typeof STOCK_REASON_CODES)[number];

export type CartStockItem = {
  id: string;
  name?: string;
  quantity: number;
};

type InventoryRow = {
  id: string;
  productId: string;
  vendorId: string;
  warehouseId: string | null;
  variantId: string | null;
  sku: string | null;
  mpn: string | null;
  openingStock: number;
  receivedStock: number;
  damagedStock: number;
  currentStock: number;
  reservedStock: number;
  availableStock: number;
  lowStockThreshold: number;
  criticalStockThreshold: number;
  minimumOrderQuantity: number;
  maximumOrderQuantity: number | null;
  restockDate: Date | string | null;
  stockStatus: StockStatusValue;
  allowBackorder: boolean;
  isPreOrder: boolean;
  bulkPricingTiers: unknown;
  lastLowStockAlertAt: Date | string | null;
  lastCriticalStockAlertAt: Date | string | null;
  lastStockUpdatedAt: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
};

function toInt(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : fallback;
}

function addMinutes(minutes: number) {
  const date = new Date();
  date.setMinutes(date.getMinutes() + minutes);
  return date;
}

function normalizeNullableId(value: unknown) {
  const normalized = String(value ?? '').trim();
  return normalized && normalized !== 'ALL' && normalized !== 'UNASSIGNED' ? normalized : null;
}

function normalizeReasonCode(value: unknown, fallback: StockReasonCode): StockReasonCode {
  const normalized = String(value ?? '').trim().toUpperCase();
  return STOCK_REASON_CODES.includes(normalized as StockReasonCode)
    ? (normalized as StockReasonCode)
    : fallback;
}

export function getStockStatus(input: {
  currentStock: number;
  reservedStock?: number;
  damagedStock?: number;
  lowStockThreshold?: number;
  criticalStockThreshold?: number;
  allowBackorder?: boolean;
  isPreOrder?: boolean;
}): StockStatusValue {
  if (input.isPreOrder) {
    return 'PRE_ORDER';
  }

  const availableStock = Math.max(
    0,
    toInt(input.currentStock) - toInt(input.reservedStock) - toInt(input.damagedStock),
  );

  if (availableStock <= 0) {
    return input.allowBackorder ? 'BACKORDER' : 'OUT_OF_STOCK';
  }

  if (availableStock <= toInt(input.criticalStockThreshold, 3)) {
    return 'CRITICAL_STOCK';
  }

  if (availableStock <= toInt(input.lowStockThreshold, 10)) {
    return 'LOW_STOCK';
  }

  return 'IN_STOCK';
}

export function getStockSignal(inventory?: Partial<InventoryRow> | null) {
  const availableStock = toInt(
    inventory?.availableStock ??
      (toInt(inventory?.currentStock) - toInt(inventory?.reservedStock) - toInt((inventory as any)?.damagedStock)),
  );
  const lowStockThreshold = toInt(inventory?.lowStockThreshold, 10);
  const criticalStockThreshold = toInt(inventory?.criticalStockThreshold, 3);
  const status =
    inventory?.stockStatus ||
    getStockStatus({
      currentStock: toInt(inventory?.currentStock),
      reservedStock: toInt(inventory?.reservedStock),
      damagedStock: toInt((inventory as any)?.damagedStock),
      lowStockThreshold,
      criticalStockThreshold,
      allowBackorder: Boolean(inventory?.allowBackorder),
      isPreOrder: Boolean(inventory?.isPreOrder),
    });

  if (status === 'PRE_ORDER') {
    return { status, label: 'Pre Order Available', tone: 'blue', canBuy: true };
  }

  if (status === 'BACKORDER') {
    return { status, label: 'Backorder Available', tone: 'blue', canBuy: true };
  }

  if (availableStock <= 0) {
    return { status: 'OUT_OF_STOCK' as const, label: 'Out of Stock', tone: 'gray', canBuy: false };
  }

  if (availableStock <= criticalStockThreshold) {
    return {
      status: 'CRITICAL_STOCK' as const,
      label: `Only ${availableStock} left - Order Soon`,
      tone: 'red',
      canBuy: true,
    };
  }

  if (availableStock <= lowStockThreshold) {
    return {
      status: 'LOW_STOCK' as const,
      label: `Only ${availableStock} left`,
      tone: 'orange',
      canBuy: true,
    };
  }

  return { status: 'IN_STOCK' as const, label: 'In Stock', tone: 'green', canBuy: true };
}

let ensureInventorySchemaPromise: Promise<void> | null = null;

async function ensureInventorySchemaUncached() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Inventory" (
      "id" TEXT PRIMARY KEY,
      "productId" TEXT NOT NULL UNIQUE,
      "vendorId" TEXT NOT NULL,
      "warehouseId" TEXT,
      "variantId" TEXT,
      "sku" TEXT,
      "mpn" TEXT,
      "openingStock" INTEGER NOT NULL DEFAULT 0,
      "receivedStock" INTEGER NOT NULL DEFAULT 0,
      "damagedStock" INTEGER NOT NULL DEFAULT 0,
      "currentStock" INTEGER NOT NULL DEFAULT 0,
      "reservedStock" INTEGER NOT NULL DEFAULT 0,
      "availableStock" INTEGER NOT NULL DEFAULT 0,
      "lowStockThreshold" INTEGER NOT NULL DEFAULT 10,
      "criticalStockThreshold" INTEGER NOT NULL DEFAULT 3,
      "minimumOrderQuantity" INTEGER NOT NULL DEFAULT 1,
      "maximumOrderQuantity" INTEGER,
      "restockDate" TIMESTAMP,
      "stockStatus" TEXT NOT NULL DEFAULT 'IN_STOCK',
      "allowBackorder" BOOLEAN NOT NULL DEFAULT false,
      "isPreOrder" BOOLEAN NOT NULL DEFAULT false,
      "bulkPricingTiers" JSONB,
      "lastLowStockAlertAt" TIMESTAMP,
      "lastCriticalStockAlertAt" TIMESTAMP,
      "lastStockUpdatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "StockMovement" (
      "id" TEXT PRIMARY KEY,
      "productId" TEXT NOT NULL,
      "vendorId" TEXT NOT NULL,
      "warehouseId" TEXT,
      "variantId" TEXT,
      "type" TEXT NOT NULL,
      "reasonCode" TEXT,
      "quantity" INTEGER NOT NULL,
      "oldStock" INTEGER NOT NULL,
      "newStock" INTEGER NOT NULL,
      "reason" TEXT,
      "orderId" TEXT,
      "adjustedByUserId" TEXT,
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "StockReservation" (
      "id" TEXT PRIMARY KEY,
      "productId" TEXT NOT NULL,
      "warehouseId" TEXT,
      "variantId" TEXT,
      "orderId" TEXT,
      "quantity" INTEGER NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'RESERVED',
      "expiresAt" TIMESTAMP NOT NULL,
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const additiveColumns = [
    `ALTER TABLE "Inventory" ADD COLUMN "warehouseId" TEXT`,
    `ALTER TABLE "Inventory" ADD COLUMN "variantId" TEXT`,
    `ALTER TABLE "Inventory" ADD COLUMN "openingStock" INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE "Inventory" ADD COLUMN "receivedStock" INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE "Inventory" ADD COLUMN "damagedStock" INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE "StockMovement" ADD COLUMN "warehouseId" TEXT`,
    `ALTER TABLE "StockMovement" ADD COLUMN "variantId" TEXT`,
    `ALTER TABLE "StockMovement" ADD COLUMN "reasonCode" TEXT`,
    `ALTER TABLE "StockReservation" ADD COLUMN "warehouseId" TEXT`,
    `ALTER TABLE "StockReservation" ADD COLUMN "variantId" TEXT`,
  ];

  for (const statement of additiveColumns) {
    await prisma.$executeRawUnsafe(statement).catch((error) => {
      const message = String(error?.message || error);
      if (!/duplicate column|already exists/i.test(message)) {
        throw error;
      }
    });
  }

  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Inventory_vendorId_idx" ON "Inventory" ("vendorId")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Inventory_warehouseId_idx" ON "Inventory" ("warehouseId")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Inventory_variantId_idx" ON "Inventory" ("variantId")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Inventory_stockStatus_idx" ON "Inventory" ("stockStatus")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "StockMovement_productId_idx" ON "StockMovement" ("productId")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "StockMovement_vendorId_idx" ON "StockMovement" ("vendorId")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "StockMovement_warehouseId_idx" ON "StockMovement" ("warehouseId")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "StockMovement_variantId_idx" ON "StockMovement" ("variantId")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "StockMovement_reasonCode_idx" ON "StockMovement" ("reasonCode")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "StockReservation_warehouseId_idx" ON "StockReservation" ("warehouseId")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "StockReservation_variantId_idx" ON "StockReservation" ("variantId")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "StockReservation_orderId_idx" ON "StockReservation" ("orderId")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "StockReservation_status_idx" ON "StockReservation" ("status")`);
}

export function ensureInventorySchema() {
  if (!ensureInventorySchemaPromise) {
    ensureInventorySchemaPromise = ensureInventorySchemaUncached().catch((error) => {
      ensureInventorySchemaPromise = null;
      throw error;
    });
  }

  return ensureInventorySchemaPromise;
}

export async function ensureInventoryTables() {
  await ensureInventorySchema();

  const products = await prisma.product.findMany({
    select: {
      id: true,
      vendorId: true,
      sku: true,
      inventory: true,
    },
  });

  for (const product of products) {
    await ensureProductInventory(product.id, product);
  }
}

async function notifyUser(userId: string | null | undefined, title: string, message: string) {
  if (!userId) {
    return;
  }

  try {
    await prisma.notification.create({ data: { userId, title, message } });
  } catch (error) {
    console.warn('Inventory notification skipped:', error);
  }
}

async function notifyAdmins(title: string, message: string) {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true },
  });

  await Promise.all(admins.map((admin) => notifyUser(admin.id, title, message)));
}

async function createMovement(input: {
  productId: string;
  vendorId: string;
  warehouseId?: string | null;
  variantId?: string | null;
  type: string;
  reasonCode?: StockReasonCode | null;
  quantity: number;
  oldStock: number;
  newStock: number;
  reason?: string;
  orderId?: string | null;
  adjustedByUserId?: string | null;
  tx?: any;
}) {
  const client = input.tx || prisma;
  await client.$executeRaw`
    INSERT INTO "StockMovement" (
      "id", "productId", "vendorId", "warehouseId", "variantId", "type", "reasonCode", "quantity", "oldStock", "newStock",
      "reason", "orderId", "adjustedByUserId", "createdAt"
    ) VALUES (
      ${randomUUID()}, ${input.productId}, ${input.vendorId}, ${input.warehouseId || null},
      ${input.variantId || null}, ${input.type}, ${input.reasonCode || null},
      ${toInt(input.quantity)}, ${toInt(input.oldStock)}, ${toInt(input.newStock)},
      ${input.reason || null}, ${input.orderId || null}, ${input.adjustedByUserId || null},
      CURRENT_TIMESTAMP
    )
  `;
}

async function assertActiveVendorWarehouse(
  vendorId: string,
  warehouseId?: string | null,
  client: any = prisma,
) {
  const normalizedWarehouseId = normalizeNullableId(warehouseId);
  if (!normalizedWarehouseId) {
    return null;
  }

  const warehouse = await client.vendorWarehouse.findFirst({
    where: {
      id: normalizedWarehouseId,
      vendorId,
      isActive: true,
      status: { not: 'DEACTIVATED' },
    },
    select: { id: true, name: true, code: true },
  });

  if (!warehouse) {
    throw new Error('Warehouse not found, inactive, or unauthorized.');
  }

  return warehouse;
}

async function writeInventoryStatus(inventory: InventoryRow, tx?: any) {
  const client = tx || prisma;
  const availableStock = Math.max(
    0,
    toInt(inventory.currentStock) - toInt(inventory.reservedStock) - toInt(inventory.damagedStock),
  );
  const stockStatus = getStockStatus({
    ...inventory,
  });

  await client.$executeRaw`
    UPDATE "Inventory"
    SET
      "availableStock" = ${availableStock},
      "stockStatus" = ${stockStatus},
      "lastLowStockAlertAt" = ${
        availableStock > toInt(inventory.lowStockThreshold, 10)
          ? null
          : inventory.lastLowStockAlertAt
      },
      "lastCriticalStockAlertAt" = ${
        availableStock > toInt(inventory.criticalStockThreshold, 3)
          ? null
          : inventory.lastCriticalStockAlertAt
      },
      "lastStockUpdatedAt" = CURRENT_TIMESTAMP,
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${inventory.id}
  `;

  await client.product.update({
    where: { id: inventory.productId },
    data: { inventory: toInt(inventory.currentStock) },
  });

  return { ...inventory, availableStock, stockStatus };
}

export async function ensureProductInventory(
  productId: string,
  productInput?: { id: string; vendorId: string; sku?: string | null; inventory: number } | null,
) {
  await ensureInventorySchema();

  const current = await prisma.$queryRaw<InventoryRow[]>`
    SELECT * FROM "Inventory" WHERE "productId" = ${productId} LIMIT 1
  `;

  if (current[0]) {
    return current[0];
  }

  const product =
    productInput ||
    (await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, vendorId: true, sku: true, inventory: true },
    }));

  if (!product) {
    throw new Error('Product not found.');
  }

  const status = getStockStatus({ currentStock: product.inventory });
  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO "Inventory" (
      "id", "productId", "vendorId", "sku", "openingStock", "currentStock", "reservedStock",
      "availableStock", "stockStatus", "createdAt", "updatedAt", "lastStockUpdatedAt"
    ) VALUES (
      ${id}, ${product.id}, ${product.vendorId}, ${product.sku || null},
      ${toInt(product.inventory)}, ${toInt(product.inventory)}, 0, ${toInt(product.inventory)}, ${status},
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `;

  const created = await prisma.$queryRaw<InventoryRow[]>`
    SELECT * FROM "Inventory" WHERE "id" = ${id} LIMIT 1
  `;
  return created[0];
}

export async function releaseExpiredReservations() {
  await ensureInventorySchema();
  const reservations = await prisma.$queryRaw<
    Array<{ id: string; productId: string; quantity: number }>
  >`
    SELECT "id", "productId", "quantity" FROM "StockReservation"
    WHERE "status" = 'RESERVED' AND "expiresAt" < CURRENT_TIMESTAMP
  `;

  for (const reservation of reservations) {
    const inventory = await ensureProductInventory(reservation.productId);
    const oldReserved = toInt(inventory.reservedStock);
    const nextReserved = Math.max(0, oldReserved - toInt(reservation.quantity));
    await prisma.$executeRaw`
      UPDATE "Inventory"
      SET "reservedStock" = ${nextReserved}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${inventory.id}
    `;
    await prisma.$executeRaw`
      UPDATE "StockReservation"
      SET "status" = 'EXPIRED', "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${reservation.id}
    `;
    const updated = { ...inventory, reservedStock: nextReserved };
    await writeInventoryStatus(updated);
    await createMovement({
      productId: inventory.productId,
      vendorId: inventory.vendorId,
      warehouseId: inventory.warehouseId,
      variantId: inventory.variantId,
      type: 'RESERVATION_RELEASED',
      reasonCode: 'ORDER_RELEASE',
      quantity: reservation.quantity,
      oldStock: oldReserved,
      newStock: nextReserved,
      reason: 'Checkout reservation expired.',
    });
  }
}

export async function getInventoryByProducts(productIds: string[]) {
  await ensureInventoryTables();
  if (productIds.length === 0) {
    return [];
  }
  await Promise.all(productIds.map((id) => ensureProductInventory(id)));
  return prisma.$queryRaw<InventoryRow[]>`
    SELECT * FROM "Inventory" WHERE "productId" IN (${Prisma.join(productIds)})
  `;
}

export async function validateCartStock(items: CartStockItem[]) {
  await releaseExpiredReservations();
  const productIds = Array.from(new Set(items.map((item) => item.id)));
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, vendorId: true, sku: true, inventory: true },
  });

  if (products.length !== productIds.length) {
    return { ok: false, error: 'Some products are not available now.' };
  }

  for (const item of items) {
    const product = products.find((entry) => entry.id === item.id);
    if (!product) {
      return { ok: false, error: `${item.name || 'Product'} is not available now.` };
    }

    const inventory = await ensureProductInventory(product.id, product);
    const quantity = toInt(item.quantity, 1);
    const availableStock = toInt(inventory.availableStock);

    if (quantity < toInt(inventory.minimumOrderQuantity, 1)) {
      return {
        ok: false,
        error: `Minimum order quantity for ${product.name} is ${inventory.minimumOrderQuantity}.`,
      };
    }

    if (inventory.maximumOrderQuantity && quantity > inventory.maximumOrderQuantity) {
      return {
        ok: false,
        error: `Maximum order quantity for ${product.name} is ${inventory.maximumOrderQuantity}.`,
      };
    }

    if (!inventory.allowBackorder && !inventory.isPreOrder && quantity > availableStock) {
      return {
        ok: false,
        error: `Only ${availableStock} units available now for ${product.name}.`,
      };
    }
  }

  return { ok: true as const };
}

export async function reserveStockForOrder(orderId: string) {
  await releaseExpiredReservations();
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: true } } },
  });

  if (!order) {
    throw new Error('Order not found.');
  }

  const expiresAt = addMinutes(RESERVATION_MINUTES);
  for (const item of order.items) {
    const inventory = await ensureProductInventory(item.productId);
    const quantity = toInt(item.quantity, 1);
    const availableStock = toInt(inventory.availableStock);

    if (!inventory.allowBackorder && !inventory.isPreOrder && quantity > availableStock) {
      throw new Error(`Only ${availableStock} units available now for ${item.product?.name || item.productId}.`);
    }

    const nextReserved = toInt(inventory.reservedStock) + quantity;
    await prisma.$executeRaw`
      UPDATE "Inventory"
      SET "reservedStock" = ${nextReserved}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${inventory.id}
    `;
    await prisma.$executeRaw`
      INSERT INTO "StockReservation" (
        "id", "productId", "warehouseId", "variantId", "orderId", "quantity", "status", "expiresAt", "createdAt", "updatedAt"
      ) VALUES (
        ${randomUUID()}, ${item.productId}, ${inventory.warehouseId}, ${inventory.variantId}, ${orderId}, ${quantity}, 'RESERVED',
        ${expiresAt}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `;
    await writeInventoryStatus({ ...inventory, reservedStock: nextReserved });
    await createMovement({
      productId: item.productId,
      vendorId: inventory.vendorId,
      warehouseId: inventory.warehouseId,
      variantId: inventory.variantId,
      type: 'RESERVED',
      reasonCode: 'ORDER_RESERVATION',
      quantity,
      oldStock: toInt(inventory.reservedStock),
      newStock: nextReserved,
      reason: `Reserved for checkout for ${RESERVATION_MINUTES} minutes.`,
      orderId,
    });
  }
}

export async function convertReservedStockToSold(orderIds: string[]) {
  await releaseExpiredReservations();
  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds } },
    include: { items: { include: { product: true } } },
  });

  for (const order of orders) {
    for (const item of order.items) {
      const inventory = await ensureProductInventory(item.productId);
      const reservations = await prisma.$queryRaw<Array<{ id: string; quantity: number }>>`
        SELECT "id", "quantity" FROM "StockReservation"
        WHERE "orderId" = ${order.id} AND "productId" = ${item.productId} AND "status" = 'RESERVED'
      `;
      const reservedQuantity = reservations.reduce((sum, row) => sum + toInt(row.quantity), 0);
      const quantity = reservedQuantity || toInt(item.quantity, 1);
      const oldStock = toInt(inventory.currentStock);
      const nextStock = Math.max(0, oldStock - quantity);
      const nextReserved = Math.max(0, toInt(inventory.reservedStock) - reservedQuantity);

      await prisma.$executeRaw`
        UPDATE "Inventory"
        SET "currentStock" = ${nextStock}, "reservedStock" = ${nextReserved}, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${inventory.id}
      `;
      await prisma.$executeRaw`
        UPDATE "StockReservation"
        SET "status" = 'CONVERTED', "updatedAt" = CURRENT_TIMESTAMP
        WHERE "orderId" = ${order.id} AND "productId" = ${item.productId} AND "status" = 'RESERVED'
      `;
      const updated = await writeInventoryStatus({
        ...inventory,
        currentStock: nextStock,
        reservedStock: nextReserved,
      });
      await createMovement({
        productId: item.productId,
        vendorId: inventory.vendorId,
        warehouseId: inventory.warehouseId,
        variantId: inventory.variantId,
        type: 'ORDER_PLACED',
        reasonCode: 'ORDER_CONVERSION',
        quantity,
        oldStock,
        newStock: nextStock,
        reason: 'Order payment confirmed.',
        orderId: order.id,
      });
      maybeSendStockAlertsInBackground(updated, item.product?.name || item.productId);
    }
    await reduceVariantStockForOrder(order.id);
  }
}

export async function reduceStockForOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: true } } },
  });

  if (!order) {
    throw new Error('Order not found.');
  }

  const validation = await validateCartStock(
    order.items.map((item) => ({
      id: item.productId,
      name: item.product?.name || item.productId,
      quantity: item.quantity,
    })),
  );
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  for (const item of order.items) {
    const inventory = await ensureProductInventory(item.productId);
    const oldStock = toInt(inventory.currentStock);
    const quantity = toInt(item.quantity, 1);
    const nextStock = Math.max(0, oldStock - quantity);
    await prisma.$executeRaw`
      UPDATE "Inventory"
      SET "currentStock" = ${nextStock}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${inventory.id}
    `;
    const updated = await writeInventoryStatus({ ...inventory, currentStock: nextStock });
    await createMovement({
      productId: item.productId,
      vendorId: inventory.vendorId,
      warehouseId: inventory.warehouseId,
      variantId: inventory.variantId,
      type: 'ORDER_PLACED',
      reasonCode: 'ORDER_CONVERSION',
      quantity,
      oldStock,
      newStock: nextStock,
      reason: 'Order confirmed.',
      orderId,
    });
    maybeSendStockAlertsInBackground(updated, item.product?.name || item.productId);
  }
  await reduceVariantStockForOrder(orderId);
}

export async function restoreStockForOrder(orderId: string, input?: { resellable?: boolean; reason?: string }) {
  if (input?.resellable === false) {
    return;
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: true } } },
  });

  if (!order) {
    return;
  }

  for (const item of order.items) {
    const inventory = await ensureProductInventory(item.productId);
    const oldStock = toInt(inventory.currentStock);
    const quantity = toInt(item.quantity, 1);
    const nextStock = oldStock + quantity;
    await prisma.$executeRaw`
      UPDATE "Inventory"
      SET "currentStock" = ${nextStock}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${inventory.id}
    `;
    await writeInventoryStatus({ ...inventory, currentStock: nextStock });
    await createMovement({
      productId: item.productId,
      vendorId: inventory.vendorId,
      warehouseId: inventory.warehouseId,
      variantId: inventory.variantId,
      type: order.status === 'RETURNED' ? 'ORDER_RETURNED' : 'ORDER_CANCELLED',
      reasonCode: 'ORDER_RETURN',
      quantity,
      oldStock,
      newStock: nextStock,
      reason: input?.reason || 'Stock restored.',
      orderId,
    });
  }
  await restoreVariantStockForOrder(orderId);
}

export async function releaseReservedStockForOrder(orderId: string, input?: { reason?: string }) {
  await ensureInventorySchema();

  const reservations = await prisma.$queryRaw<
    Array<{ id: string; productId: string; quantity: number }>
  >`
    SELECT "id", "productId", "quantity" FROM "StockReservation"
    WHERE "orderId" = ${orderId} AND "status" = 'RESERVED'
  `;

  for (const reservation of reservations) {
    const inventory = await ensureProductInventory(reservation.productId);
    const oldReserved = toInt(inventory.reservedStock);
    const nextReserved = Math.max(0, oldReserved - toInt(reservation.quantity));

    await prisma.$executeRaw`
      UPDATE "Inventory"
      SET "reservedStock" = ${nextReserved}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${inventory.id}
    `;
    await prisma.$executeRaw`
      UPDATE "StockReservation"
      SET "status" = 'RELEASED', "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${reservation.id}
    `;

    await writeInventoryStatus({ ...inventory, reservedStock: nextReserved });
    await createMovement({
      productId: inventory.productId,
      vendorId: inventory.vendorId,
      warehouseId: inventory.warehouseId,
      variantId: inventory.variantId,
      type: 'RESERVATION_RELEASED',
      reasonCode: 'ORDER_RELEASE',
      quantity: reservation.quantity,
      oldStock: oldReserved,
      newStock: nextReserved,
      reason: input?.reason || 'Checkout reservation released before payment.',
      orderId,
    });
  }
}

export async function adjustProductStock(input: {
  productId: string;
  quantity: number;
  mode: 'ADD' | 'REMOVE' | 'SET' | 'DAMAGE';
  warehouseId?: string | null;
  variantId?: string | null;
  reasonCode?: StockReasonCode | null;
  reason?: string;
  adjustedByUserId?: string | null;
}) {
  await ensureInventoryTables();
  const inventory = await ensureProductInventory(input.productId);
  const warehouseId = normalizeNullableId(input.warehouseId);
  await assertActiveVendorWarehouse(inventory.vendorId, warehouseId);
  const oldStock = toInt(inventory.currentStock);
  const oldDamagedStock = toInt(inventory.damagedStock);
  const oldAvailableStock = Math.max(
    0,
    oldStock - toInt(inventory.reservedStock) - oldDamagedStock,
  );
  const quantity = toInt(input.quantity);
  if (quantity <= 0 && input.mode !== 'SET') {
    throw new Error('Quantity must be greater than zero.');
  }

  const nextStock =
    input.mode === 'SET' ? quantity : input.mode === 'ADD' ? oldStock + quantity : input.mode === 'DAMAGE' ? oldStock : oldStock - quantity;
  const nextDamagedStock =
    input.mode === 'DAMAGE' ? oldDamagedStock + quantity : oldDamagedStock;
  const nextAvailableStockRaw = nextStock - toInt(inventory.reservedStock) - nextDamagedStock;
  const nextAvailableStock = Math.max(0, nextAvailableStockRaw);

  if (input.mode === 'REMOVE' && quantity > oldAvailableStock) {
    throw new Error(`Only ${oldAvailableStock} available stock can be removed.`);
  }

  if (input.mode === 'DAMAGE' && quantity > oldAvailableStock) {
    throw new Error(`Only ${oldAvailableStock} available stock can be marked damaged.`);
  }

  if (input.mode === 'SET' && nextAvailableStockRaw < 0) {
    throw new Error('Stock cannot be lower than reserved and damaged stock.');
  }

  const reasonCode =
    input.mode === 'ADD'
      ? normalizeReasonCode(input.reasonCode, 'STOCK_IN')
      : input.mode === 'REMOVE'
        ? normalizeReasonCode(input.reasonCode, 'STOCK_OUT')
        : input.mode === 'DAMAGE'
          ? 'DAMAGED_STOCK'
          : normalizeReasonCode(input.reasonCode, 'MANUAL_ADJUSTMENT');
  const movementType =
    input.mode === 'ADD'
      ? 'STOCK_ADDED'
      : input.mode === 'REMOVE'
        ? 'STOCK_REMOVED'
        : input.mode === 'DAMAGE'
          ? 'DAMAGED_STOCK'
          : 'MANUAL_ADJUSTMENT';

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "Inventory"
      SET
        "warehouseId" = ${warehouseId ?? inventory.warehouseId},
        "variantId" = ${normalizeNullableId(input.variantId) ?? inventory.variantId},
        "currentStock" = ${nextStock},
        "receivedStock" = ${input.mode === 'ADD' ? toInt(inventory.receivedStock) + quantity : toInt(inventory.receivedStock)},
        "damagedStock" = ${nextDamagedStock},
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${inventory.id}
    `;
    await writeInventoryStatus({
      ...inventory,
      warehouseId: warehouseId ?? inventory.warehouseId,
      variantId: normalizeNullableId(input.variantId) ?? inventory.variantId,
      currentStock: nextStock,
      receivedStock: input.mode === 'ADD' ? toInt(inventory.receivedStock) + quantity : toInt(inventory.receivedStock),
      damagedStock: nextDamagedStock,
      availableStock: nextAvailableStock,
    }, tx);
    await createMovement({
      productId: input.productId,
      vendorId: inventory.vendorId,
      warehouseId: warehouseId ?? inventory.warehouseId,
      variantId: normalizeNullableId(input.variantId) ?? inventory.variantId,
      type: movementType,
      reasonCode,
      quantity,
      oldStock: input.mode === 'DAMAGE' ? oldDamagedStock : oldStock,
      newStock: input.mode === 'DAMAGE' ? nextDamagedStock : nextStock,
      reason: input.reason || 'Manual stock adjustment.',
      adjustedByUserId: input.adjustedByUserId,
      tx,
    });
  });
}

export async function updateInventorySettings(input: {
  productId: string;
  warehouseId?: string | null;
  lowStockThreshold?: number;
  criticalStockThreshold?: number;
  minimumOrderQuantity?: number;
  maximumOrderQuantity?: number | null;
  restockDate?: string | null;
  mpn?: string | null;
  allowBackorder?: boolean;
  isPreOrder?: boolean;
  bulkPricingTiers?: unknown;
}) {
  await ensureInventoryTables();
  const inventory = await ensureProductInventory(input.productId);
  const nextWarehouseId =
    input.warehouseId === undefined ? inventory.warehouseId : normalizeNullableId(input.warehouseId);
  await assertActiveVendorWarehouse(inventory.vendorId, nextWarehouseId);
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "Inventory"
      SET
        "warehouseId" = ${nextWarehouseId},
        "lowStockThreshold" = ${toInt(input.lowStockThreshold, inventory.lowStockThreshold)},
        "criticalStockThreshold" = ${toInt(input.criticalStockThreshold, inventory.criticalStockThreshold)},
        "minimumOrderQuantity" = ${toInt(input.minimumOrderQuantity, inventory.minimumOrderQuantity)},
        "maximumOrderQuantity" = ${input.maximumOrderQuantity ?? inventory.maximumOrderQuantity ?? null},
        "restockDate" = ${input.restockDate ? new Date(input.restockDate) : inventory.restockDate || null},
        "mpn" = ${input.mpn ?? inventory.mpn ?? null},
        "allowBackorder" = ${input.allowBackorder ?? inventory.allowBackorder},
        "isPreOrder" = ${input.isPreOrder ?? inventory.isPreOrder},
        "bulkPricingTiers" = ${input.bulkPricingTiers ? JSON.stringify(input.bulkPricingTiers) : inventory.bulkPricingTiers ? JSON.stringify(inventory.bulkPricingTiers) : null}::jsonb,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${inventory.id}
    `;

    if (nextWarehouseId !== inventory.warehouseId) {
      await createMovement({
        productId: input.productId,
        vendorId: inventory.vendorId,
        warehouseId: nextWarehouseId,
        variantId: inventory.variantId,
        type: 'MANUAL_ADJUSTMENT',
        reasonCode: 'WAREHOUSE_ASSIGNMENT',
        quantity: 0,
        oldStock: toInt(inventory.currentStock),
        newStock: toInt(inventory.currentStock),
        reason: 'Inventory warehouse assignment updated.',
        tx,
      });
    }
  });
  const updated = await ensureProductInventory(input.productId);
  return writeInventoryStatus(updated);
}

export async function getVendorInventoryData(vendorId: string, filters: { warehouseId?: string } = {}) {
  await ensureInventoryTables();
  const products = await prisma.product.findMany({
    where: { vendorId },
    include: { category: true, subcategory: true },
    orderBy: { updatedAt: 'desc' },
  });
  await Promise.all(products.map((product) => ensureProductInventory(product.id)));
  const inventories = await prisma.$queryRaw<InventoryRow[]>`
    SELECT * FROM "Inventory" WHERE "vendorId" = ${vendorId} ORDER BY "updatedAt" DESC
  `;
  const movements = await prisma.$queryRaw<any[]>`
    SELECT * FROM "StockMovement" WHERE "vendorId" = ${vendorId} ORDER BY "createdAt" DESC LIMIT 200
  `;
  const variants = await getVariantsForProducts(products.map((product) => product.id));
  const warehouses = await prisma.vendorWarehouse.findMany({
    where: { vendorId },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  });
  return buildInventoryPayload(products, inventories, movements, variants, warehouses, filters);
}

export async function getAdminInventoryData(filters: { q?: string; status?: string; vendorId?: string; warehouseId?: string }) {
  await ensureInventoryTables();
  const products = await prisma.product.findMany({
    include: {
      vendor: { include: { user: { select: { name: true, email: true } } } },
      category: true,
    },
    orderBy: { updatedAt: 'desc' },
  });
  await Promise.all(products.map((product) => ensureProductInventory(product.id)));
  const inventories = await prisma.$queryRaw<InventoryRow[]>`
    SELECT * FROM "Inventory" ORDER BY "updatedAt" DESC
  `;
  const movements = await prisma.$queryRaw<any[]>`
    SELECT * FROM "StockMovement" ORDER BY "createdAt" DESC LIMIT 300
  `;
  const variants = await getVariantsForProducts(products.map((product) => product.id));
  const warehouses = await prisma.vendorWarehouse.findMany({
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  });
  const payload = buildInventoryPayload(products, inventories, movements, variants, warehouses, filters);
  const q = String(filters.q || '').trim().toLowerCase();
  const status = String(filters.status || 'ALL');
  const vendorId = String(filters.vendorId || '');
  const warehouseId = String(filters.warehouseId || 'ALL');
  payload.rows = payload.rows.filter((row: any) => {
    const matchesSearch =
      !q ||
      [row.product.name, row.product.sku, row.inventory?.mpn, row.vendor?.storeName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    const matchesStatus = status === 'ALL' || row.inventory?.stockStatus === status;
    const matchesVendor = !vendorId || row.product.vendorId === vendorId;
    const matchesWarehouse =
      warehouseId === 'ALL' ||
      (warehouseId === 'UNASSIGNED' && !row.inventory?.warehouseId) ||
      row.inventory?.warehouseId === warehouseId;
    return matchesSearch && matchesStatus && matchesVendor && matchesWarehouse;
  });
  return payload;
}

function buildInventoryPayload(
  products: any[],
  inventories: InventoryRow[],
  movements: any[],
  variants: any[] = [],
  warehouses: any[] = [],
  filters: { warehouseId?: string } = {},
) {
  const warehouseById = new Map(warehouses.map((warehouse) => [warehouse.id, warehouse]));
  const warehouseFilter = String(filters.warehouseId || 'ALL');
  const rows = products.map((product) => {
    const inventory = inventories.find((item) => item.productId === product.id) || null;
    const productVariants = variants.filter((variant) => variant.productId === product.id);
    return {
      product,
      vendor: product.vendor || null,
      inventory,
      warehouse: inventory?.warehouseId ? warehouseById.get(inventory.warehouseId) || null : null,
      variants: productVariants,
      signal: getStockSignal(inventory),
    };
  }).filter((row) => {
    if (warehouseFilter === 'ALL') return true;
    if (warehouseFilter === 'UNASSIGNED') return !row.inventory?.warehouseId;
    return row.inventory?.warehouseId === warehouseFilter;
  });
  const movementRows = movements.map((movement) => ({
    ...movement,
    warehouse: movement.warehouseId ? warehouseById.get(movement.warehouseId) || null : null,
  }));
  const summary = rows.reduce(
    (result, row) => {
      result.totalProducts += 1;
      const status = row.inventory?.stockStatus || 'OUT_OF_STOCK';
      if (status === 'IN_STOCK') result.inStock += 1;
      if (status === 'LOW_STOCK') result.lowStock += 1;
      if (status === 'CRITICAL_STOCK') result.criticalStock += 1;
      if (status === 'OUT_OF_STOCK') result.outOfStock += 1;
      if (['LOW_STOCK', 'CRITICAL_STOCK', 'OUT_OF_STOCK'].includes(status)) {
        result.alerts += 1;
      }
      return result;
    },
    { totalProducts: 0, inStock: 0, lowStock: 0, criticalStock: 0, outOfStock: 0, alerts: 0 },
  );

  return { rows, movements: movementRows, warehouses, summary };
}

async function maybeSendStockAlerts(inventory: InventoryRow, productName: string) {
  const vendor = await prisma.vendor.findUnique({
    where: { id: inventory.vendorId },
    include: { user: { select: { id: true } } },
  });
  const availableStock = toInt(inventory.availableStock);

  if (
    inventory.stockStatus === 'CRITICAL_STOCK' &&
    !inventory.lastCriticalStockAlertAt
  ) {
    await notifyUser(
      vendor?.user.id,
      'Critical stock alert',
      `${productName} has only ${availableStock} units left.`,
    );
    await notifyAdmins(
      'Critical vendor stock',
      `${vendor?.storeName || 'Vendor'} product ${productName} has only ${availableStock} units left.`,
    );
    await prisma.$executeRaw`
      UPDATE "Inventory" SET "lastCriticalStockAlertAt" = CURRENT_TIMESTAMP WHERE "id" = ${inventory.id}
    `;
  } else if (
    inventory.stockStatus === 'LOW_STOCK' &&
    !inventory.lastLowStockAlertAt
  ) {
    await notifyUser(
      vendor?.user.id,
      'Low stock alert',
      `${productName} has only ${availableStock} units left.`,
    );
    await notifyAdmins(
      'Low vendor stock',
      `${vendor?.storeName || 'Vendor'} product ${productName} is running low.`,
    );
    await prisma.$executeRaw`
      UPDATE "Inventory" SET "lastLowStockAlertAt" = CURRENT_TIMESTAMP WHERE "id" = ${inventory.id}
    `;
  }
}

function maybeSendStockAlertsInBackground(inventory: InventoryRow, productName: string) {
  void maybeSendStockAlerts(inventory, productName).catch((error) => {
    console.warn('Inventory stock alert skipped:', error);
  });
}
