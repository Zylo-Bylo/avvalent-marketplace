import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type ReturnInventoryDbClient = Pick<
  Prisma.TransactionClient,
  '$queryRaw' | '$executeRaw'
>;

type DispositionKind = 'RESELLABLE' | 'DAMAGED' | 'REJECTED';

type AuthoritativeDispositionRow = {
  dispositionId: string;
  disposition: DispositionKind;
  quantity: number;
  processedAt: Date | string | null;
  processedByUserId: string | null;
  stockMovementId: string | null;
  receiptItemId: string;
  orderedQuantity: number;
  receivedQuantity: number;
  productId: string;
  variantId: string | null;
  restorationWarehouseId: string;
  receiptStatus: string;
  returnRequestId: string;
  orderId: string;
  orderStatus: string;
  orderItemOrderId: string;
  orderItemProductId: string;
  orderItemVariantId: string | null;
  productVendorId: string;
  variantProductId: string | null;
  warehouseVendorId: string;
  warehouseIsActive: boolean | number;
  warehouseStatus: string;
  refundStatus: string | null;
  inventoryId: string;
  inventoryVendorId: string;
  inventoryWarehouseId: string | null;
  currentStock: number;
  reservedStock: number;
  damagedStock: number;
  availableStock: number;
  lowStockThreshold: number;
  criticalStockThreshold: number;
  allowBackorder: boolean | number;
  isPreOrder: boolean | number;
};

type DispositionQuantityRow = {
  quantity: number;
};

type ProcessedDispositionRow = {
  disposition: DispositionKind;
  processedAt: Date | string | null;
  stockMovementId: string | null;
};

export type ProcessReturnStockDispositionResult = {
  dispositionId: string;
  status: 'PROCESSED' | 'ALREADY_PROCESSED';
  disposition: DispositionKind;
  stockMovementId: string | null;
  currentStock?: number;
  damagedStock?: number;
  availableStock?: number;
};

export type ProcessReturnStockDispositionInput = {
  dispositionId: string;
  actorUserId: string;
  db?: ReturnInventoryDbClient;
};

function asInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : 0;
}

function isPostgresRuntime() {
  const url = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL || '';
  return url.startsWith('postgresql://') || url.startsWith('postgres://');
}

function getStockStatus(row: AuthoritativeDispositionRow, availableStock: number) {
  if (Boolean(row.isPreOrder)) return 'PRE_ORDER';
  if (availableStock <= 0) return Boolean(row.allowBackorder) ? 'BACKORDER' : 'OUT_OF_STOCK';
  if (availableStock <= asInteger(row.criticalStockThreshold)) return 'CRITICAL_STOCK';
  if (availableStock <= asInteger(row.lowStockThreshold)) return 'LOW_STOCK';
  return 'IN_STOCK';
}

async function loadDisposition(
  db: ReturnInventoryDbClient,
  dispositionId: string,
  lock: boolean,
) {
  const lockClause = lock && isPostgresRuntime() ? Prisma.sql`FOR UPDATE OF disposition` : Prisma.empty;
  const rows = await db.$queryRaw<AuthoritativeDispositionRow[]>(Prisma.sql`
    SELECT
      disposition."id" AS "dispositionId",
      disposition."disposition",
      disposition."quantity",
      disposition."processedAt",
      disposition."processedByUserId",
      disposition."stockMovementId",
      item."id" AS "receiptItemId",
      item."orderedQuantity",
      item."receivedQuantity",
      item."productId",
      item."variantId",
      item."restorationWarehouseId",
      receipt."status" AS "receiptStatus",
      receipt."returnRequestId",
      receipt."orderId",
      orders."status" AS "orderStatus",
      order_item."orderId" AS "orderItemOrderId",
      order_item."productId" AS "orderItemProductId",
      order_item."variantId" AS "orderItemVariantId",
      product."vendorId" AS "productVendorId",
      variant."productId" AS "variantProductId",
      warehouse."vendorId" AS "warehouseVendorId",
      warehouse."isActive" AS "warehouseIsActive",
      warehouse."status" AS "warehouseStatus",
      refund."status" AS "refundStatus",
      inventory."id" AS "inventoryId",
      inventory."vendorId" AS "inventoryVendorId",
      inventory."warehouseId" AS "inventoryWarehouseId",
      inventory."currentStock",
      inventory."reservedStock",
      inventory."damagedStock",
      inventory."availableStock",
      inventory."lowStockThreshold",
      inventory."criticalStockThreshold",
      inventory."allowBackorder",
      inventory."isPreOrder"
    FROM "ReturnStockDisposition" disposition
    JOIN "ReturnReceiptItem" item ON item."id" = disposition."receiptItemId"
    JOIN "ReturnReceipt" receipt ON receipt."id" = item."receiptId"
    JOIN "Order" orders ON orders."id" = receipt."orderId"
    JOIN "OrderItem" order_item ON order_item."id" = item."orderItemId"
    JOIN "Product" product ON product."id" = item."productId"
    LEFT JOIN "ProductVariant" variant ON variant."id" = item."variantId"
    JOIN "VendorWarehouse" warehouse ON warehouse."id" = item."restorationWarehouseId"
    JOIN "Inventory" inventory ON inventory."productId" = item."productId"
    LEFT JOIN "ReturnRefundRequest" refund ON refund."id" = receipt."returnRequestId"
    WHERE disposition."id" = ${dispositionId}
    ${lockClause}
  `);
  return rows[0] ?? null;
}

async function loadProcessedState(db: ReturnInventoryDbClient, dispositionId: string) {
  const rows = await db.$queryRaw<ProcessedDispositionRow[]>(Prisma.sql`
    SELECT "disposition", "processedAt", "stockMovementId"
    FROM "ReturnStockDisposition"
    WHERE "id" = ${dispositionId}
  `);
  return rows[0] ?? null;
}

function assertEligible(row: AuthoritativeDispositionRow) {
  const quantity = asInteger(row.quantity);
  const receivedQuantity = asInteger(row.receivedQuantity);
  const orderedQuantity = asInteger(row.orderedQuantity);

  if (row.receiptStatus !== 'QC_COMPLETED') throw new Error('Return receipt QC is not completed.');
  if (row.orderStatus !== 'RETURNED') throw new Error('Order is not in RETURNED status.');
  if (row.refundStatus !== 'REFUNDED') throw new Error('Return refund is not completed.');
  if (quantity <= 0) throw new Error('Disposition quantity must be greater than zero.');
  if (receivedQuantity > orderedQuantity) throw new Error('Received quantity exceeds ordered quantity.');
  if (row.orderItemOrderId !== row.orderId) throw new Error('Receipt item does not belong to the receipt order.');
  if (row.orderItemProductId !== row.productId) throw new Error('Receipt product does not match the order item.');
  if ((row.orderItemVariantId ?? null) !== (row.variantId ?? null)) {
    throw new Error('Receipt variant does not match the order item.');
  }
  if (row.variantId && row.variantProductId !== row.productId) {
    throw new Error('Variant is missing or does not belong to the product.');
  }
  if (!Boolean(row.warehouseIsActive) || row.warehouseStatus === 'DEACTIVATED') {
    throw new Error('Restoration warehouse is inactive.');
  }
  if (row.productVendorId !== row.warehouseVendorId || row.inventoryVendorId !== row.productVendorId) {
    throw new Error('Product, inventory, and restoration warehouse vendors do not match.');
  }
  if (row.inventoryWarehouseId && row.inventoryWarehouseId !== row.restorationWarehouseId) {
    throw new Error('Inventory belongs to a different warehouse.');
  }
}

function isReturnDispositionUniqueViolation(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: string; message?: string; meta?: unknown };
  const details = `${candidate.message ?? ''} ${JSON.stringify(candidate.meta ?? '')}`;
  return (candidate.code === 'P2002' || details.includes('23505')) &&
    /returnDispositionId|StockMovement_returnDispositionId_key/i.test(details);
}

async function processWithClient(
  db: ReturnInventoryDbClient,
  input: Omit<ProcessReturnStockDispositionInput, 'db'>,
): Promise<ProcessReturnStockDispositionResult> {
  const row = await loadDisposition(db, input.dispositionId, true);
  if (!row) throw new Error('Return stock disposition not found.');

  if (row.processedAt || row.stockMovementId) {
    return {
      dispositionId: row.dispositionId,
      disposition: row.disposition,
      stockMovementId: row.stockMovementId,
      status: 'ALREADY_PROCESSED',
    };
  }

  assertEligible(row);

  const dispositionRows = await db.$queryRaw<DispositionQuantityRow[]>(Prisma.sql`
    SELECT "quantity"
    FROM "ReturnStockDisposition"
    WHERE "receiptItemId" = ${row.receiptItemId}
  `);
  const quantities = dispositionRows.map((item) => asInteger(item.quantity));
  if (quantities.some((quantity) => quantity <= 0)) {
    throw new Error('Every return disposition quantity must be greater than zero.');
  }
  if (quantities.reduce((sum, quantity) => sum + quantity, 0) !== asInteger(row.receivedQuantity)) {
    throw new Error('Disposition quantities do not equal the received quantity.');
  }

  const processedAt = new Date();
  if (row.disposition === 'REJECTED') {
    await db.$executeRaw(Prisma.sql`
      UPDATE "ReturnStockDisposition"
      SET "processedAt" = ${processedAt}, "processedByUserId" = ${input.actorUserId}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${row.dispositionId} AND "processedAt" IS NULL AND "stockMovementId" IS NULL
    `);
    return {
      dispositionId: row.dispositionId,
      disposition: row.disposition,
      stockMovementId: null,
      status: 'PROCESSED',
    };
  }

  const quantity = asInteger(row.quantity);
  const oldStock = asInteger(row.currentStock);
  const oldDamagedStock = asInteger(row.damagedStock);
  const nextStock = oldStock + quantity;
  const nextDamagedStock = row.disposition === 'DAMAGED' ? oldDamagedStock + quantity : oldDamagedStock;
  const nextAvailableStock = Math.max(
    0,
    nextStock - asInteger(row.reservedStock) - nextDamagedStock,
  );
  const stockStatus = getStockStatus(row, nextAvailableStock);
  const movementId = randomUUID();
  const movementType = row.disposition === 'RESELLABLE' ? 'ORDER_RETURNED' : 'DAMAGED_STOCK';
  const reasonCode = row.disposition === 'RESELLABLE' ? 'ORDER_RETURN' : 'DAMAGED_STOCK';

  // Creating the uniquely keyed movement before stock writes makes a duplicate
  // disposition fail before any stock effect; the surrounding transaction is
  // still authoritative for atomicity.
  await db.$executeRaw(Prisma.sql`
    INSERT INTO "StockMovement" (
      "id", "productId", "vendorId", "warehouseId", "variantId", "type", "reasonCode",
      "quantity", "oldStock", "newStock", "reason", "orderId", "adjustedByUserId",
      "returnDispositionId", "createdAt"
    ) VALUES (
      ${movementId}, ${row.productId}, ${row.productVendorId}, ${row.restorationWarehouseId},
      ${row.variantId}, ${movementType}, ${reasonCode}, ${quantity}, ${oldStock}, ${nextStock},
      ${row.disposition === 'RESELLABLE' ? 'Resellable return restored after QC.' : 'Damaged return received after QC.'},
      ${row.orderId}, ${input.actorUserId}, ${row.dispositionId}, CURRENT_TIMESTAMP
    )
  `);

  await db.$executeRaw(Prisma.sql`
    UPDATE "Inventory"
    SET
      "warehouseId" = ${row.restorationWarehouseId},
      "currentStock" = ${nextStock},
      "damagedStock" = ${nextDamagedStock},
      "availableStock" = ${nextAvailableStock},
      "stockStatus" = ${stockStatus},
      "lastStockUpdatedAt" = CURRENT_TIMESTAMP,
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${row.inventoryId}
  `);

  if (row.disposition === 'RESELLABLE' && row.variantId) {
    await db.$executeRaw(Prisma.sql`
      UPDATE "ProductVariant"
      SET "stockQuantity" = "stockQuantity" + ${quantity}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${row.variantId} AND "productId" = ${row.productId}
    `);
  }

  await db.$executeRaw(Prisma.sql`
    UPDATE "ReturnStockDisposition"
    SET
      "processedAt" = ${processedAt},
      "processedByUserId" = ${input.actorUserId},
      "stockMovementId" = ${movementId},
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${row.dispositionId} AND "processedAt" IS NULL AND "stockMovementId" IS NULL
  `);

  return {
    dispositionId: row.dispositionId,
    disposition: row.disposition,
    stockMovementId: movementId,
    status: 'PROCESSED',
    currentStock: nextStock,
    damagedStock: nextDamagedStock,
    availableStock: nextAvailableStock,
  };
}

export async function processReturnStockDisposition(
  input: ProcessReturnStockDispositionInput,
): Promise<ProcessReturnStockDispositionResult> {
  const { db, dispositionId, actorUserId } = input;
  if (!dispositionId.trim()) throw new Error('Disposition ID is required.');
  if (!actorUserId.trim()) throw new Error('Actor user ID is required.');

  try {
    if (db) return await processWithClient(db, { dispositionId, actorUserId });
    return await prisma.$transaction((tx) =>
      processWithClient(tx, { dispositionId, actorUserId }),
    );
  } catch (error) {
    if (!isReturnDispositionUniqueViolation(error)) throw error;
    const client = db ?? prisma;
    const state = await loadProcessedState(client, dispositionId);
    if (!state || (!state.processedAt && !state.stockMovementId)) throw error;
    return {
      dispositionId,
      disposition: state.disposition,
      stockMovementId: state.stockMovementId,
      status: 'ALREADY_PROCESSED',
    };
  }
}
