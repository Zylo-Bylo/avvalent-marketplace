import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireAdminApiUser } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { parseQcItems } from '@/lib/return-receipts';

export const runtime = 'nodejs';

type RefundRow = { id: string; orderId: string; status: string; orderStatus: string | null };
type OrderItemRow = {
  id: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  fulfillmentWarehouseId: string | null;
};
type ReceiptRow = { id: string; status: string };
type ReceiptItemRow = { id: string; orderedQuantity: number; receivedQuantity: number };
type AllocationRow = { receiptItemId: string; quantity: number };

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApiUser();
  if (auth.response) return auth.response;
  const { id: returnRequestId } = await params;
  const receipts = await prisma.$queryRaw<Array<ReceiptRow & {
    receivedAt: Date | string | null;
    qcCompletedAt: Date | string | null;
    qcNote: string | null;
  }>>`
    SELECT "id", "status", "receivedAt", "qcCompletedAt", "qcNote"
    FROM "ReturnReceipt" WHERE "returnRequestId" = ${returnRequestId} LIMIT 1
  `;
  const receipt = receipts[0];
  if (!receipt) return NextResponse.json({ receipt: null });

  const items = await prisma.$queryRaw<Array<{
    id: string;
    productId: string;
    productName: string | null;
    variantId: string | null;
    sizeLabel: string | null;
    variantColor: string | null;
    orderedQuantity: number;
    receivedQuantity: number;
  }>>`
    SELECT item."id", item."productId", product."name" AS "productName", item."variantId",
      variant."sizeLabel", variant."color" AS "variantColor", item."orderedQuantity", item."receivedQuantity"
    FROM "ReturnReceiptItem" item
    JOIN "Product" product ON product."id" = item."productId"
    LEFT JOIN "ProductVariant" variant ON variant."id" = item."variantId"
    WHERE item."receiptId" = ${receipt.id} ORDER BY item."id"
  `;
  const dispositions = await prisma.$queryRaw<Array<{
    id: string;
    receiptItemId: string;
    disposition: string;
    quantity: number;
    processedAt: Date | string | null;
    stockMovementId: string | null;
  }>>`
    SELECT disposition."id", disposition."receiptItemId", disposition."disposition",
      disposition."quantity", disposition."processedAt", disposition."stockMovementId"
    FROM "ReturnStockDisposition" disposition
    JOIN "ReturnReceiptItem" item ON item."id" = disposition."receiptItemId"
    WHERE item."receiptId" = ${receipt.id} ORDER BY disposition."id"
  `;
  return NextResponse.json({
    receipt: {
      ...receipt,
      items: items.map((item) => ({
        ...item,
        dispositions: dispositions.filter((entry) => entry.receiptItemId === item.id),
      })),
    },
  });
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : 'Return receipt operation failed.';
  const status = /not found/i.test(message) ? 404 : /already exists|already QC completed/i.test(message) ? 409 : 400;
  return NextResponse.json({ error: message }, { status });
}

async function loadReceipt(tx: { $queryRaw: typeof prisma.$queryRaw }, returnRequestId: string) {
  const rows = await tx.$queryRaw<ReceiptRow[]>`
    SELECT "id", "status" FROM "ReturnReceipt"
    WHERE "returnRequestId" = ${returnRequestId} LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApiUser();
  if (auth.response) return auth.response;
  const { id: returnRequestId } = await params;

  try {
    const receiptId = await prisma.$transaction(async (tx) => {
      const refunds = await tx.$queryRaw<RefundRow[]>`
        SELECT request."id", request."orderId", request."status", orders."status" AS "orderStatus"
        FROM "ReturnRefundRequest" request
        LEFT JOIN "Order" orders ON orders."id" = request."orderId"
        WHERE request."id" = ${returnRequestId} LIMIT 1
      `;
      const refund = refunds[0];
      if (!refund) throw new Error('Return request not found.');
      if (refund.status !== 'REFUNDED') throw new Error('Return request must be REFUNDED.');
      if (refund.orderStatus !== 'RETURNED') throw new Error('Order must be RETURNED.');
      if (await loadReceipt(tx, returnRequestId)) throw new Error('Return receipt already exists.');

      const items = await tx.$queryRaw<OrderItemRow[]>`
        SELECT "id", "productId", "variantId", "quantity", "fulfillmentWarehouseId"
        FROM "OrderItem" WHERE "orderId" = ${refund.orderId} ORDER BY "id"
      `;
      if (items.length === 0) throw new Error('Associated order has no items.');
      if (items.some((item) => !item.fulfillmentWarehouseId)) {
        throw new Error('Original fulfilment warehouse is unavailable; stock receipt cannot be opened safely.');
      }

      const newReceiptId = randomUUID();
      await tx.$executeRaw`
        INSERT INTO "ReturnReceipt" (
          "id", "returnRequestId", "orderId", "status", "createdAt", "updatedAt"
        ) VALUES (${newReceiptId}, ${returnRequestId}, ${refund.orderId}, 'PENDING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `;
      for (const item of items) {
        await tx.$executeRaw`
          INSERT INTO "ReturnReceiptItem" (
            "id", "receiptId", "orderItemId", "productId", "variantId", "orderedQuantity",
            "receivedQuantity", "restorationWarehouseId", "createdAt", "updatedAt"
          ) VALUES (
            ${randomUUID()}, ${newReceiptId}, ${item.id}, ${item.productId}, ${item.variantId},
            ${item.quantity}, 0, ${item.fulfillmentWarehouseId}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
        `;
      }
      return newReceiptId;
    });
    return NextResponse.json({ receiptId, status: 'PENDING' }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApiUser();
  if (auth.response) return auth.response;
  const { id: returnRequestId } = await params;
  const body = await request.json();
  const action = typeof body.action === 'string' ? body.action.trim().toUpperCase() : '';

  try {
    const result = await prisma.$transaction(async (tx) => {
      const receipt = await loadReceipt(tx, returnRequestId);
      if (!receipt) throw new Error('Return receipt not found.');

      if (action === 'RECEIVE') {
        if (receipt.status !== 'PENDING') throw new Error(`Receipt cannot move from ${receipt.status} to RECEIVED.`);
        await tx.$executeRaw`
          UPDATE "ReturnReceipt" SET "status" = 'RECEIVED', "receivedAt" = CURRENT_TIMESTAMP,
            "receivedByUserId" = ${auth.user.id}, "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = ${receipt.id} AND "status" = 'PENDING'
        `;
        return { receiptId: receipt.id, status: 'RECEIVED' };
      }

      if (receipt.status === 'QC_COMPLETED') throw new Error('Return receipt is already QC completed.');
      if (receipt.status !== 'RECEIVED') throw new Error('Receipt must be RECEIVED before QC.');

      if (action === 'SAVE_QC') {
        const inputs = parseQcItems(body.items);
        const storedItems = await tx.$queryRaw<ReceiptItemRow[]>`
          SELECT "id", "orderedQuantity", "receivedQuantity"
          FROM "ReturnReceiptItem" WHERE "receiptId" = ${receipt.id}
        `;
        if (inputs.length !== storedItems.length) throw new Error('QC must include every receipt item.');
        const storedById = new Map(storedItems.map((item) => [item.id, item]));
        for (const input of inputs) {
          const stored = storedById.get(input.receiptItemId);
          if (!stored) throw new Error('QC item does not belong to this receipt.');
          if (input.receivedQuantity > Number(stored.orderedQuantity)) {
            throw new Error('Received quantity cannot exceed ordered quantity.');
          }
        }
        for (const input of inputs) {
          await tx.$executeRaw`DELETE FROM "ReturnStockDisposition" WHERE "receiptItemId" = ${input.receiptItemId}`;
          await tx.$executeRaw`
            UPDATE "ReturnReceiptItem" SET "receivedQuantity" = ${input.receivedQuantity},
              "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${input.receiptItemId}
          `;
          for (const allocation of input.dispositions) {
            await tx.$executeRaw`
              INSERT INTO "ReturnStockDisposition" (
                "id", "receiptItemId", "disposition", "quantity", "createdAt", "updatedAt"
              ) VALUES (
                ${randomUUID()}, ${input.receiptItemId}, ${allocation.disposition}, ${allocation.quantity},
                CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
              )
            `;
          }
        }
        return { receiptId: receipt.id, status: 'RECEIVED', qcSaved: true };
      }

      if (action === 'FINALIZE_QC') {
        const items = await tx.$queryRaw<ReceiptItemRow[]>`
          SELECT "id", "orderedQuantity", "receivedQuantity"
          FROM "ReturnReceiptItem" WHERE "receiptId" = ${receipt.id}
        `;
        const allocations = await tx.$queryRaw<AllocationRow[]>`
          SELECT disposition."receiptItemId", disposition."quantity"
          FROM "ReturnStockDisposition" disposition
          JOIN "ReturnReceiptItem" item ON item."id" = disposition."receiptItemId"
          WHERE item."receiptId" = ${receipt.id}
        `;
        for (const item of items) {
          const quantities = allocations
            .filter((allocation) => allocation.receiptItemId === item.id)
            .map((allocation) => Number(allocation.quantity));
          if (Number(item.receivedQuantity) > Number(item.orderedQuantity)) {
            throw new Error('Received quantity cannot exceed ordered quantity.');
          }
          if (quantities.some((quantity) => !Number.isInteger(quantity) || quantity <= 0)) {
            throw new Error('Every disposition quantity must be positive.');
          }
          if (quantities.reduce((sum, quantity) => sum + quantity, 0) !== Number(item.receivedQuantity)) {
            throw new Error('Every receipt item must have a complete QC allocation.');
          }
        }
        const qcNote = typeof body.qcNote === 'string' ? body.qcNote.trim() : '';
        await tx.$executeRaw`
          UPDATE "ReturnReceipt" SET "status" = 'QC_COMPLETED', "qcCompletedAt" = CURRENT_TIMESTAMP,
            "qcCompletedByUserId" = ${auth.user.id}, "qcNote" = ${qcNote || null},
            "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${receipt.id} AND "status" = 'RECEIVED'
        `;
        return { receiptId: receipt.id, status: 'QC_COMPLETED' };
      }

      throw new Error('Invalid receipt action.');
    });
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
