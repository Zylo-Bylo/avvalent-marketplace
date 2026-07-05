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

export type CartStockItem = {
  id: string;
  name?: string;
  quantity: number;
};

type InventoryRow = {
  id: string;
  productId: string;
  vendorId: string;
  sku: string | null;
  mpn: string | null;
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

export function getStockStatus(input: {
  currentStock: number;
  reservedStock?: number;
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
    toInt(input.currentStock) - toInt(input.reservedStock),
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
  const availableStock = toInt(inventory?.availableStock ?? inventory?.currentStock);
  const lowStockThreshold = toInt(inventory?.lowStockThreshold, 10);
  const criticalStockThreshold = toInt(inventory?.criticalStockThreshold, 3);
  const status =
    inventory?.stockStatus ||
    getStockStatus({
      currentStock: toInt(inventory?.currentStock),
      reservedStock: toInt(inventory?.reservedStock),
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
      "sku" TEXT,
      "mpn" TEXT,
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
      "type" TEXT NOT NULL,
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
      "orderId" TEXT,
      "quantity" INTEGER NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'RESERVED',
      "expiresAt" TIMESTAMP NOT NULL,
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Inventory_vendorId_idx" ON "Inventory" ("vendorId")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Inventory_stockStatus_idx" ON "Inventory" ("stockStatus")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "StockMovement_productId_idx" ON "StockMovement" ("productId")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "StockMovement_vendorId_idx" ON "StockMovement" ("vendorId")`);
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
  type: string;
  quantity: number;
  oldStock: number;
  newStock: number;
  reason?: string;
  orderId?: string | null;
  adjustedByUserId?: string | null;
}) {
  await prisma.$executeRaw`
    INSERT INTO "StockMovement" (
      "id", "productId", "vendorId", "type", "quantity", "oldStock", "newStock",
      "reason", "orderId", "adjustedByUserId", "createdAt"
    ) VALUES (
      ${randomUUID()}, ${input.productId}, ${input.vendorId}, ${input.type},
      ${toInt(input.quantity)}, ${toInt(input.oldStock)}, ${toInt(input.newStock)},
      ${input.reason || null}, ${input.orderId || null}, ${input.adjustedByUserId || null},
      CURRENT_TIMESTAMP
    )
  `;
}

async function writeInventoryStatus(inventory: InventoryRow) {
  const availableStock = Math.max(0, toInt(inventory.currentStock) - toInt(inventory.reservedStock));
  const stockStatus = getStockStatus({
    ...inventory,
  });

  await prisma.$executeRaw`
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

  await prisma.product.update({
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
      "id", "productId", "vendorId", "sku", "currentStock", "reservedStock",
      "availableStock", "stockStatus", "createdAt", "updatedAt", "lastStockUpdatedAt"
    ) VALUES (
      ${id}, ${product.id}, ${product.vendorId}, ${product.sku || null},
      ${toInt(product.inventory)}, 0, ${toInt(product.inventory)}, ${status},
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
      type: 'RESERVATION_RELEASED',
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
        "id", "productId", "orderId", "quantity", "status", "expiresAt", "createdAt", "updatedAt"
      ) VALUES (
        ${randomUUID()}, ${item.productId}, ${orderId}, ${quantity}, 'RESERVED',
        ${expiresAt}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `;
    await writeInventoryStatus({ ...inventory, reservedStock: nextReserved });
    await createMovement({
      productId: item.productId,
      vendorId: inventory.vendorId,
      type: 'RESERVED',
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
        type: 'ORDER_PLACED',
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
      type: 'ORDER_PLACED',
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
      type: order.status === 'RETURNED' ? 'ORDER_RETURNED' : 'ORDER_CANCELLED',
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
      type: 'RESERVATION_RELEASED',
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
  mode: 'ADD' | 'REMOVE' | 'SET';
  reason?: string;
  adjustedByUserId?: string | null;
}) {
  await ensureInventoryTables();
  const inventory = await ensureProductInventory(input.productId);
  const oldStock = toInt(inventory.currentStock);
  const quantity = toInt(input.quantity);
  const nextStock =
    input.mode === 'SET'
      ? quantity
      : input.mode === 'ADD'
        ? oldStock + quantity
        : Math.max(0, oldStock - quantity);

  await prisma.$executeRaw`
    UPDATE "Inventory"
    SET "currentStock" = ${nextStock}, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${inventory.id}
  `;
  await writeInventoryStatus({ ...inventory, currentStock: nextStock });
  await createMovement({
    productId: input.productId,
    vendorId: inventory.vendorId,
    type: input.mode === 'ADD' ? 'STOCK_ADDED' : input.mode === 'REMOVE' ? 'STOCK_REMOVED' : 'MANUAL_ADJUSTMENT',
    quantity,
    oldStock,
    newStock: nextStock,
    reason: input.reason || 'Manual stock adjustment.',
    adjustedByUserId: input.adjustedByUserId,
  });
}

export async function updateInventorySettings(input: {
  productId: string;
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
  await prisma.$executeRaw`
    UPDATE "Inventory"
    SET
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
  const updated = await ensureProductInventory(input.productId);
  return writeInventoryStatus(updated);
}

export async function getVendorInventoryData(vendorId: string) {
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
  return buildInventoryPayload(products, inventories, movements, variants);
}

export async function getAdminInventoryData(filters: { q?: string; status?: string; vendorId?: string }) {
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
  const payload = buildInventoryPayload(products, inventories, movements, variants);
  const q = String(filters.q || '').trim().toLowerCase();
  const status = String(filters.status || 'ALL');
  const vendorId = String(filters.vendorId || '');
  payload.rows = payload.rows.filter((row: any) => {
    const matchesSearch =
      !q ||
      [row.product.name, row.product.sku, row.inventory?.mpn, row.vendor?.storeName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    const matchesStatus = status === 'ALL' || row.inventory?.stockStatus === status;
    const matchesVendor = !vendorId || row.product.vendorId === vendorId;
    return matchesSearch && matchesStatus && matchesVendor;
  });
  return payload;
}

function buildInventoryPayload(
  products: any[],
  inventories: InventoryRow[],
  movements: any[],
  variants: any[] = [],
) {
  const rows = products.map((product) => {
    const inventory = inventories.find((item) => item.productId === product.id) || null;
    const productVariants = variants.filter((variant) => variant.productId === product.id);
    return {
      product,
      vendor: product.vendor || null,
      inventory,
      variants: productVariants,
      signal: getStockSignal(inventory),
    };
  });
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

  return { rows, movements, summary };
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
