import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/admin-auth';
import {
  ensureReturnRefundTable,
  isReturnStatus,
} from '@/lib/returns';
import { applyRefundAdjustment } from '@/lib/payouts';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdminUser())) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  await ensureReturnRefundTable();

  const { id } = await params;
  const body = await request.json();
  const status = body.status;
  const adminNote = typeof body.adminNote === 'string' ? body.adminNote.trim() : '';
  const refundReference =
    typeof body.refundReference === 'string' ? body.refundReference.trim() : '';

  if (!isReturnStatus(status)) {
    return NextResponse.json({ error: 'Invalid refund status' }, { status: 400 });
  }

  const rows = await prisma.$queryRaw<
    Array<{ id: string; orderId: string; status: string; reason: string | null }>
  >`
    SELECT "id", "orderId", "status", "reason" FROM "ReturnRefundRequest"
    WHERE "id" = ${id}
    LIMIT 1
  `;
  const refundRequest = rows[0];

  if (!refundRequest) {
    return NextResponse.json({ error: 'Return request not found' }, { status: 404 });
  }

  await prisma.$executeRaw`
    UPDATE "ReturnRefundRequest"
    SET
      "status" = ${status},
      "adminNote" = ${adminNote || null},
      "refundReference" = ${refundReference || null},
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${id}
  `;

  if (status === 'REFUND_PENDING' || status === 'REFUNDED') {
    const updatedOrder = await prisma.order.update({
      where: { id: refundRequest.orderId },
      data: {
        status: 'RETURNED',
        statusNote:
          status === 'REFUNDED'
            ? `Refund processed${refundReference ? `: ${refundReference}` : ''}.`
            : 'Return approved. Refund is pending.',
      },
      include: {
        items: true,
      },
    });

    if (
      status === 'REFUNDED' &&
      refundRequest.status !== 'REFUNDED' &&
      updatedOrder.vendorId
    ) {
      const refundAmount = updatedOrder.items.reduce((sum, item) => {
        return (
          sum +
          Number(item.vendorPayout || item.vendorPrice || item.price || 0) *
            Number(item.quantity || 0)
        );
      }, 0);

      await applyRefundAdjustment({
        vendorId: updatedOrder.vendorId,
        orderId: updatedOrder.id,
        refundAmount,
        reason:
          adminNote ||
          refundRequest.reason ||
          `Refund processed${refundReference ? `: ${refundReference}` : ''}.`,
      });
    }
  }

  if (status === 'REJECTED') {
    await prisma.order.update({
      where: { id: refundRequest.orderId },
      data: {
        statusNote: adminNote || 'Return request rejected by admin.',
      },
    });
  }

  return NextResponse.json({ message: `Return request updated to ${status}.` });
}
