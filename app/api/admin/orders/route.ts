import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/admin-auth';
import { ORDER_STATUSES } from '@/lib/order-status';
import { prisma } from '@/lib/prisma';
import { ensureTrustTables, getOrderTrustSnapshot } from '@/lib/trust';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  if (!(await requireAdminUser())) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || '';
  const query = (searchParams.get('q') || '').trim();
  const paymentMethod = searchParams.get('paymentMethod') || '';
  const requestedLimit = parseInt(searchParams.get('limit') || '100', 10);
  const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 100, 1), 150);
  const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0);

  const statusFilter = ORDER_STATUSES.includes(status as (typeof ORDER_STATUSES)[number])
    ? (status as (typeof ORDER_STATUSES)[number])
    : '';

  const where: Record<string, unknown> = {
    ...(statusFilter && { status: statusFilter }),
    ...(paymentMethod && { paymentMethod }),
    ...(query && {
      OR: [
        { id: { contains: query, mode: 'insensitive' } },
        { paymentId: { contains: query, mode: 'insensitive' } },
        { shippingName: { contains: query, mode: 'insensitive' } },
        { shippingPhone: { contains: query, mode: 'insensitive' } },
        { user: { email: { contains: query, mode: 'insensitive' } } },
        { user: { name: { contains: query, mode: 'insensitive' } } },
        { vendor: { storeName: { contains: query, mode: 'insensitive' } } },
      ],
    }),
  };

  await ensureTrustTables();

  const [orders, total, summary] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        vendor: {
          select: {
            storeName: true,
            mobile: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                images: true,
                sku: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.order.count({ where }),
    prisma.order.groupBy({
      by: ['status'],
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),
  ]);

  const ordersWithTrust = await Promise.all(
    orders.map(async (order) => ({
      ...order,
      trust: await getOrderTrustSnapshot(order.id),
    })),
  );

  return NextResponse.json({
    orders: ordersWithTrust,
    total,
    hasMore: offset + limit < total,
    summary: summary.map((item) => ({
      status: item.status,
      count: item._count._all,
      totalAmount: item._sum.totalAmount || 0,
    })),
  });
}
