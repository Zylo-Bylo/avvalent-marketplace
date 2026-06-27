import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/admin-auth';
import { ensureReturnRefundTable } from '@/lib/returns';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  if (!(await requireAdminUser())) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  await ensureReturnRefundTable();

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || '';

  const refundRows = await prisma.$queryRaw<
    Array<{
      id: string;
      orderId: string;
      userId: string;
      reason: string;
      status: string;
      adminNote: string | null;
      refundReference: string | null;
      createdAt: string | Date;
      updatedAt: string | Date;
    }>
  >`
    SELECT * FROM "ReturnRefundRequest"
    ORDER BY "createdAt" DESC
  `;

  const filteredRows = status
    ? refundRows.filter((row) => row.status === status)
    : refundRows;

  const orders = await prisma.order.findMany({
    where: { id: { in: filteredRows.map((row) => row.orderId) } },
    include: {
      user: { select: { name: true, email: true } },
      vendor: { select: { storeName: true, mobile: true } },
      items: {
        include: {
          product: { select: { id: true, name: true, sku: true, images: true } },
        },
      },
    },
  });

  const requests = filteredRows.map((row) => ({
    ...row,
    order: orders.find((order) => order.id === row.orderId) || null,
  }));

  const summary = refundRows.reduce<Record<string, number>>((result, row) => {
    result[row.status] = (result[row.status] || 0) + 1;
    return result;
  }, {});

  return NextResponse.json({ requests, summary });
}
