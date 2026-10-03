import { NextResponse } from 'next/server';
import { requireAdminApiUser } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { processReturnStockDisposition } from '@/lib/return-inventory';

export const runtime = 'nodejs';

type ReceiptRow = { id: string; status: string };
type DispositionRow = { id: string; disposition: string };

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApiUser();
  if (auth.response) return auth.response;
  const { id: returnRequestId } = await params;

  const receipts = await prisma.$queryRaw<ReceiptRow[]>`
    SELECT "id", "status" FROM "ReturnReceipt"
    WHERE "returnRequestId" = ${returnRequestId} LIMIT 1
  `;
  const receipt = receipts[0];
  if (!receipt) return NextResponse.json({ error: 'Return receipt not found.' }, { status: 404 });
  if (receipt.status !== 'QC_COMPLETED') {
    return NextResponse.json({ error: 'Receipt QC must be completed before stock processing.' }, { status: 400 });
  }

  const dispositions = await prisma.$queryRaw<DispositionRow[]>`
    SELECT disposition."id", disposition."disposition"
    FROM "ReturnStockDisposition" disposition
    JOIN "ReturnReceiptItem" item ON item."id" = disposition."receiptItemId"
    WHERE item."receiptId" = ${receipt.id}
    ORDER BY disposition."id"
  `;

  const results: Array<Record<string, unknown>> = [];
  const failures: Array<{ dispositionId: string; error: string }> = [];
  for (const disposition of dispositions) {
    try {
      results.push(await processReturnStockDisposition({
        dispositionId: disposition.id,
        actorUserId: auth.user.id,
      }));
    } catch (error) {
      failures.push({
        dispositionId: disposition.id,
        error: error instanceof Error ? error.message : 'Stock processing failed.',
      });
    }
  }

  return NextResponse.json(
    { receiptId: receipt.id, results, failures },
    { status: failures.length ? 409 : 200 },
  );
}
