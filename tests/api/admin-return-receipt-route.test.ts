import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const tx = { $queryRaw: vi.fn(), $executeRaw: vi.fn() };
  return {
    tx,
    prisma: {
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
      $queryRaw: vi.fn(),
    },
    requireAdminApiUser: vi.fn(),
    processDisposition: vi.fn(),
  };
});

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }));
vi.mock('@/lib/admin-auth', () => ({ requireAdminApiUser: mocks.requireAdminApiUser }));
vi.mock('@/lib/return-inventory', () => ({
  processReturnStockDisposition: mocks.processDisposition,
}));

import { PATCH, POST } from '@/app/api/admin/refunds/[id]/receipt/route';
import { POST as PROCESS } from '@/app/api/admin/refunds/[id]/receipt/process/route';

function statement(call: unknown[]) {
  return Array.from(call[0] as readonly string[]).join(' ').replace(/\s+/g, ' ');
}

function jsonRequest(method: string, body: unknown = {}) {
  return new Request('http://local/api/admin/refunds/return-1/receipt', {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const context = { params: Promise.resolve({ id: 'return-1' }) };
type TestOrderItem = {
  id: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  fulfillmentWarehouseId: string | null;
};

const orderItems: TestOrderItem[] = [
  {
    id: 'order-item-1',
    productId: 'product-1',
    variantId: 'variant-1',
    quantity: 3,
    fulfillmentWarehouseId: 'warehouse-1',
  },
];

function setupOpen(overrides: Record<string, unknown> = {}, items = orderItems, existing = false) {
  mocks.tx.$queryRaw.mockImplementation((strings: TemplateStringsArray) => {
    const sql = Array.from(strings).join(' ');
    if (sql.includes('FROM "ReturnRefundRequest"')) {
      return Promise.resolve([{
        id: 'return-1', orderId: 'order-1', status: 'REFUNDED', orderStatus: 'RETURNED', ...overrides,
      }]);
    }
    if (sql.includes('FROM "ReturnReceipt"')) return Promise.resolve(existing ? [{ id: 'receipt-1', status: 'PENDING' }] : []);
    if (sql.includes('FROM "OrderItem"')) return Promise.resolve(items);
    return Promise.resolve([]);
  });
}

function setupPatch(
  status: string,
  storedItems = [{ id: 'receipt-item-1', orderedQuantity: 3, receivedQuantity: 3 }],
  allocations = [{ receiptItemId: 'receipt-item-1', quantity: 2 }, { receiptItemId: 'receipt-item-1', quantity: 1 }],
) {
  mocks.tx.$queryRaw.mockImplementation((strings: TemplateStringsArray) => {
    const sql = Array.from(strings).join(' ');
    if (sql.includes('FROM "ReturnReceipt"')) return Promise.resolve([{ id: 'receipt-1', status }]);
    if (sql.includes('FROM "ReturnReceiptItem"')) return Promise.resolve(storedItems);
    if (sql.includes('FROM "ReturnStockDisposition"')) return Promise.resolve(allocations);
    return Promise.resolve([]);
  });
}

describe('admin return receipt and QC routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminApiUser.mockResolvedValue({ response: null, user: { id: 'admin-1', role: 'ADMIN' } });
    mocks.tx.$executeRaw.mockResolvedValue(1);
    mocks.processDisposition.mockResolvedValue({ status: 'PROCESSED' });
  });

  it('blocks non-admin access before database work', async () => {
    mocks.requireAdminApiUser.mockResolvedValueOnce({
      response: Response.json({ error: 'Unauthorized' }, { status: 401 }),
    });
    const response = await POST(jsonRequest('POST'), context);
    expect(response.status).toBe(401);
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each([
    ['non-refunded request', { status: 'REFUND_PENDING' }, 'must be REFUNDED'],
    ['non-returned order', { orderStatus: 'DELIVERED' }, 'must be RETURNED'],
  ])('blocks opening for %s', async (_label, overrides, error) => {
    setupOpen(overrides);
    const response = await POST(jsonRequest('POST'), context);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: expect.stringContaining(error) });
    expect(mocks.tx.$executeRaw).not.toHaveBeenCalled();
  });

  it('blocks duplicate receipts', async () => {
    setupOpen({}, orderItems, true);
    const response = await POST(jsonRequest('POST'), context);
    expect(response.status).toBe(409);
    expect(mocks.tx.$executeRaw).not.toHaveBeenCalled();
  });

  it('blocks legacy orders without fulfilment warehouse history', async () => {
    setupOpen({}, [{ ...orderItems[0], fulfillmentWarehouseId: null }]);
    const response = await POST(jsonRequest('POST'), context);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Original fulfilment warehouse is unavailable; stock receipt cannot be opened safely.',
    });
    expect(mocks.tx.$executeRaw).not.toHaveBeenCalled();
  });

  it('creates receipt items from authoritative order-item data', async () => {
    setupOpen();
    const response = await POST(jsonRequest('POST', {
      productId: 'foreign-product', variantId: 'foreign-variant', warehouseId: 'foreign-warehouse', quantity: 99,
    }), context);
    expect(response.status).toBe(201);
    const itemInsert = mocks.tx.$executeRaw.mock.calls.find((call) =>
      statement(call).includes('INSERT INTO "ReturnReceiptItem"'),
    );
    expect(itemInsert).toEqual(expect.arrayContaining([
      'order-item-1', 'product-1', 'variant-1', 3, 'warehouse-1',
    ]));
    expect(statement(itemInsert!)).toMatch(/\bVALUES\b[\s\S]*,\s*0\s*,/i);
    expect(itemInsert).not.toEqual(expect.arrayContaining(['foreign-product', 'foreign-variant', 'foreign-warehouse', 99]));
  });

  it('moves PENDING to RECEIVED using the authenticated admin actor', async () => {
    setupPatch('PENDING');
    const response = await PATCH(jsonRequest('PATCH', { action: 'RECEIVE', actorUserId: 'attacker' }), context);
    expect(response.status).toBe(200);
    const update = mocks.tx.$executeRaw.mock.calls[0];
    expect(statement(update)).toContain('"receivedByUserId"');
    expect(update).toContain('admin-1');
    expect(update).not.toContain('attacker');
  });

  it('blocks PENDING finalization and QC edits after completion', async () => {
    setupPatch('PENDING');
    const pending = await PATCH(jsonRequest('PATCH', { action: 'FINALIZE_QC' }), context);
    expect(pending.status).toBe(400);

    vi.clearAllMocks();
    mocks.requireAdminApiUser.mockResolvedValue({ response: null, user: { id: 'admin-1', role: 'ADMIN' } });
    setupPatch('QC_COMPLETED');
    const completed = await PATCH(jsonRequest('PATCH', { action: 'SAVE_QC', items: [] }), context);
    expect(completed.status).toBe(409);
    expect(mocks.tx.$executeRaw).not.toHaveBeenCalled();
  });

  it.each([
    ['negative received quantity', -1, [{ disposition: 'RESELLABLE', quantity: 1 }]],
    ['above ordered quantity', 4, [{ disposition: 'RESELLABLE', quantity: 4 }]],
    ['allocation mismatch', 3, [{ disposition: 'RESELLABLE', quantity: 2 }]],
    ['duplicate disposition', 3, [{ disposition: 'RESELLABLE', quantity: 2 }, { disposition: 'RESELLABLE', quantity: 1 }]],
  ])('blocks invalid QC: %s', async (_label, receivedQuantity, dispositions) => {
    setupPatch('RECEIVED');
    const response = await PATCH(jsonRequest('PATCH', {
      action: 'SAVE_QC',
      items: [{ receiptItemId: 'receipt-item-1', receivedQuantity, dispositions }],
    }), context);
    expect(response.status).toBe(400);
  });

  it('stores a valid split without accepting identity overrides', async () => {
    setupPatch('RECEIVED');
    const response = await PATCH(jsonRequest('PATCH', {
      action: 'SAVE_QC',
      items: [{
        receiptItemId: 'receipt-item-1', receivedQuantity: 3,
        dispositions: [{ disposition: 'RESELLABLE', quantity: 2 }, { disposition: 'DAMAGED', quantity: 1 }],
      }],
    }), context);
    expect(response.status).toBe(200);
    const inserts = mocks.tx.$executeRaw.mock.calls.filter((call) =>
      statement(call).includes('INSERT INTO "ReturnStockDisposition"'),
    );
    expect(inserts).toHaveLength(2);

    vi.clearAllMocks();
    mocks.requireAdminApiUser.mockResolvedValue({ response: null, user: { id: 'admin-1', role: 'ADMIN' } });
    setupPatch('RECEIVED');
    const override = await PATCH(jsonRequest('PATCH', {
      action: 'SAVE_QC',
      items: [{
        receiptItemId: 'receipt-item-1', receivedQuantity: 3, productId: 'foreign',
        dispositions: [{ disposition: 'RESELLABLE', quantity: 3 }],
      }],
    }), context);
    expect(override.status).toBe(400);
  });

  it('finalizes complete QC with authenticated actor and timestamp fields', async () => {
    setupPatch('RECEIVED');
    const response = await PATCH(jsonRequest('PATCH', { action: 'FINALIZE_QC', qcNote: 'Inspected' }), context);
    expect(response.status).toBe(200);
    const update = mocks.tx.$executeRaw.mock.calls.find((call) =>
      statement(call).includes("'QC_COMPLETED'"),
    );
    expect(statement(update!)).toContain('"qcCompletedAt" = CURRENT_TIMESTAMP');
    expect(update).toContain('admin-1');
    expect(update).toContain('Inspected');
  });

  it('requires QC completion before processing stock', async () => {
    mocks.prisma.$queryRaw.mockResolvedValueOnce([{ id: 'receipt-1', status: 'RECEIVED' }]);
    const response = await PROCESS(jsonRequest('POST'), context);
    expect(response.status).toBe(400);
    expect(mocks.processDisposition).not.toHaveBeenCalled();
  });

  it('processes every disposition using only its ID and authenticated actor', async () => {
    mocks.prisma.$queryRaw
      .mockResolvedValueOnce([{ id: 'receipt-1', status: 'QC_COMPLETED' }])
      .mockResolvedValueOnce([
        { id: 'disposition-1', disposition: 'RESELLABLE' },
        { id: 'disposition-2', disposition: 'REJECTED' },
      ]);
    mocks.processDisposition
      .mockResolvedValueOnce({ status: 'PROCESSED', stockMovementId: 'movement-1' })
      .mockResolvedValueOnce({ status: 'ALREADY_PROCESSED', stockMovementId: null });

    const response = await PROCESS(jsonRequest('POST', { productId: 'foreign', quantity: 99 }), context);
    expect(response.status).toBe(200);
    expect(mocks.processDisposition).toHaveBeenNthCalledWith(1, {
      dispositionId: 'disposition-1', actorUserId: 'admin-1',
    });
    expect(mocks.processDisposition).toHaveBeenNthCalledWith(2, {
      dispositionId: 'disposition-2', actorUserId: 'admin-1',
    });
  });

  it('reports partial processing failures without retrying successful dispositions', async () => {
    mocks.prisma.$queryRaw
      .mockResolvedValueOnce([{ id: 'receipt-1', status: 'QC_COMPLETED' }])
      .mockResolvedValueOnce([{ id: 'disposition-1', disposition: 'DAMAGED' }, { id: 'disposition-2', disposition: 'REJECTED' }]);
    mocks.processDisposition
      .mockResolvedValueOnce({ status: 'PROCESSED' })
      .mockRejectedValueOnce(new Error('warehouse invalid'));
    const response = await PROCESS(jsonRequest('POST'), context);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual(expect.objectContaining({
      results: [{ status: 'PROCESSED' }],
      failures: [{ dispositionId: 'disposition-2', error: 'warehouse invalid' }],
    }));
  });
});
