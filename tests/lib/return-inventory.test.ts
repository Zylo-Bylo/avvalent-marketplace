import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  globalQuery: vi.fn(),
  globalExecute: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: mocks.transaction,
    $queryRaw: mocks.globalQuery,
    $executeRaw: mocks.globalExecute,
  },
}));

import {
  processReturnStockDisposition,
  type ReturnInventoryDbClient,
} from '@/lib/return-inventory';

type SqlCall = { sql: string; values: unknown[] };

function sql(call: unknown[]): SqlCall {
  return call[0] as SqlCall;
}

function baseRow(overrides: Record<string, unknown> = {}) {
  return {
    dispositionId: 'disposition-1',
    disposition: 'RESELLABLE',
    quantity: 2,
    processedAt: null,
    processedByUserId: null,
    stockMovementId: null,
    receiptItemId: 'receipt-item-1',
    orderedQuantity: 2,
    receivedQuantity: 2,
    productId: 'product-1',
    variantId: 'variant-1',
    restorationWarehouseId: 'warehouse-1',
    receiptStatus: 'QC_COMPLETED',
    returnRequestId: 'return-1',
    orderId: 'order-1',
    orderStatus: 'RETURNED',
    orderItemOrderId: 'order-1',
    orderItemProductId: 'product-1',
    orderItemVariantId: 'variant-1',
    productVendorId: 'vendor-1',
    variantProductId: 'product-1',
    warehouseVendorId: 'vendor-1',
    warehouseIsActive: true,
    warehouseStatus: 'APPROVED',
    refundStatus: 'REFUNDED',
    inventoryId: 'inventory-1',
    inventoryVendorId: 'vendor-1',
    inventoryWarehouseId: 'warehouse-1',
    currentStock: 10,
    reservedStock: 2,
    damagedStock: 1,
    availableStock: 7,
    lowStockThreshold: 3,
    criticalStockThreshold: 1,
    allowBackorder: false,
    isPreOrder: false,
    ...overrides,
  };
}

function createClient(
  row = baseRow(),
  quantities: number[] = [2],
  processedState = { disposition: 'RESELLABLE', processedAt: new Date(), stockMovementId: 'movement-race' },
) {
  const client = {
    $queryRaw: vi.fn().mockImplementation(async (query: SqlCall) => {
      if (query.sql.includes('FROM "ReturnStockDisposition" disposition')) return [row];
      if (query.sql.includes('SELECT "quantity"')) return quantities.map((quantity) => ({ quantity }));
      if (query.sql.includes('SELECT "disposition", "processedAt"')) return [processedState];
      return [];
    }),
    $executeRaw: vi.fn().mockResolvedValue(1),
  };
  return client;
}

async function run(client: ReturnInventoryDbClient) {
  return processReturnStockDisposition({
    dispositionId: 'disposition-1',
    actorUserId: 'admin-1',
    db: client,
  });
}

function executedSql(client: ReturnType<typeof createClient>) {
  return client.$executeRaw.mock.calls.map(sql);
}

describe('return inventory service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ['non-QC receipt', { receiptStatus: 'RECEIVED' }, 'QC is not completed'],
    ['non-returned order', { orderStatus: 'DELIVERED' }, 'not in RETURNED'],
    ['non-refunded request', { refundStatus: 'REFUND_PENDING' }, 'refund is not completed'],
    ['nonpositive quantity', { quantity: 0 }, 'greater than zero'],
    ['received above ordered', { receivedQuantity: 3 }, 'exceeds ordered'],
    ['inactive warehouse', { warehouseIsActive: false }, 'warehouse is inactive'],
    ['foreign warehouse', { warehouseVendorId: 'vendor-2' }, 'vendors do not match'],
    ['mismatched variant', { variantProductId: 'product-2' }, 'does not belong'],
  ])('rejects %s before writes', async (_label, overrides, message) => {
    const client = createClient(baseRow(overrides));
    await expect(run(client)).rejects.toThrow(message);
    expect(client.$executeRaw).not.toHaveBeenCalled();
  });

  it('rejects an incomplete or invalid full disposition allocation', async () => {
    const incomplete = createClient(baseRow(), [1]);
    await expect(run(incomplete)).rejects.toThrow('do not equal the received quantity');
    expect(incomplete.$executeRaw).not.toHaveBeenCalled();

    const invalid = createClient(baseRow(), [2, 0]);
    await expect(run(invalid)).rejects.toThrow('must be greater than zero');
    expect(invalid.$executeRaw).not.toHaveBeenCalled();
  });

  it('restores resellable physical and variant stock with an ORDER_RETURNED movement', async () => {
    const client = createClient();
    const result = await run(client);
    const statements = executedSql(client);

    expect(result).toMatchObject({
      status: 'PROCESSED',
      disposition: 'RESELLABLE',
      currentStock: 12,
      damagedStock: 1,
      availableStock: 9,
    });
    const movement = statements.find((call) => call.sql.includes('INSERT INTO "StockMovement"'));
    const inventory = statements.find((call) => call.sql.includes('UPDATE "Inventory"'));
    const variant = statements.find((call) => call.sql.includes('UPDATE "ProductVariant"'));
    expect(movement?.values).toEqual(expect.arrayContaining([
      'product-1', 'vendor-1', 'warehouse-1', 'variant-1', 'ORDER_RETURNED', 'ORDER_RETURN', 2,
    ]));
    expect(inventory?.values).toEqual(expect.arrayContaining(['warehouse-1', 12, 1, 9]));
    expect(variant?.values).toEqual(expect.arrayContaining([2, 'variant-1', 'product-1']));
  });

  it('records damaged physical stock without increasing variant sellable stock', async () => {
    const client = createClient(baseRow({ disposition: 'DAMAGED' }));
    const result = await run(client);
    const statements = executedSql(client);

    expect(result).toMatchObject({
      status: 'PROCESSED',
      disposition: 'DAMAGED',
      currentStock: 12,
      damagedStock: 3,
      availableStock: 7,
    });
    expect(statements.some((call) => call.sql.includes('UPDATE "ProductVariant"'))).toBe(false);
    expect(
      statements.find((call) => call.sql.includes('INSERT INTO "StockMovement"'))?.values,
    ).toEqual(expect.arrayContaining(['DAMAGED_STOCK', 'warehouse-1', 'variant-1']));
  });

  it('marks rejected stock processed without stock or movement mutations', async () => {
    const client = createClient(baseRow({ disposition: 'REJECTED' }));
    const result = await run(client);
    const statements = executedSql(client);

    expect(result).toEqual({
      dispositionId: 'disposition-1',
      disposition: 'REJECTED',
      stockMovementId: null,
      status: 'PROCESSED',
    });
    expect(statements).toHaveLength(1);
    expect(statements[0].sql).toContain('UPDATE "ReturnStockDisposition"');
  });

  it('uses only the supplied transaction client and the persisted warehouse', async () => {
    const client = createClient();
    await processReturnStockDisposition({
      dispositionId: 'disposition-1',
      actorUserId: 'admin-1',
      db: client,
      quantity: 999,
      productId: 'foreign-product',
      variantId: 'foreign-variant',
      warehouseId: 'foreign-warehouse',
    } as Parameters<typeof processReturnStockDisposition>[0] & Record<string, unknown>);

    const calls = executedSql(client);
    expect(calls.find((call) => call.sql.includes('INSERT INTO "StockMovement"'))?.values)
      .toEqual(expect.arrayContaining(['product-1', 'variant-1', 'warehouse-1', 2]));
    expect(calls.flatMap((call) => call.values)).not.toEqual(
      expect.arrayContaining(['foreign-product', 'foreign-variant', 'foreign-warehouse', 999]),
    );
    expect(mocks.globalExecute).not.toHaveBeenCalled();
    expect(mocks.globalQuery).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('returns idempotently before writes when already processed', async () => {
    const client = createClient(baseRow({ processedAt: new Date(), stockMovementId: 'movement-1' }));
    await expect(run(client)).resolves.toMatchObject({
      status: 'ALREADY_PROCESSED',
      stockMovementId: 'movement-1',
    });
    expect(client.$executeRaw).not.toHaveBeenCalled();
  });

  it('treats the unique movement race as idempotent without a second stock effect', async () => {
    const client = createClient();
    client.$executeRaw.mockRejectedValueOnce({
      code: 'P2002',
      message: 'Unique constraint failed: StockMovement_returnDispositionId_key',
      meta: { target: ['returnDispositionId'] },
    });

    await expect(run(client)).resolves.toMatchObject({
      status: 'ALREADY_PROCESSED',
      stockMovementId: 'movement-race',
    });
    expect(client.$executeRaw).toHaveBeenCalledTimes(1);
    expect(executedSql(client)[0].sql).toContain('INSERT INTO "StockMovement"');
  });

  it('opens one transaction when no client is supplied', async () => {
    const client = createClient();
    mocks.transaction.mockImplementationOnce(
      async (callback: (tx: ReturnInventoryDbClient) => Promise<unknown>) => callback(client),
    );
    await processReturnStockDisposition({ dispositionId: 'disposition-1', actorUserId: 'admin-1' });
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(client.$executeRaw).toHaveBeenCalled();
  });
});
