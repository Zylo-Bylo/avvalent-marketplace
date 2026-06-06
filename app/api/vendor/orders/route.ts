import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

async function getApprovedVendor(userId: string) {
  const vendor = await prisma.vendor.findUnique({
    where: { userId },
    select: {
      id: true,
      storeName: true,
      status: true,
    },
  });

  if (!vendor) {
    return { error: 'Not a vendor', status: 403 as const };
  }

  if (vendor.status !== 'APPROVED') {
    return { error: 'Vendor account is pending admin approval.', status: 403 as const };
  }

  return { vendor };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedLimit = parseInt(searchParams.get('limit') || '80', 10);
    const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 80, 1), 100);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0);
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = verifyToken(token);
    if (!data || typeof data !== 'object' || !data.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const result = await getApprovedVendor(String(data.userId));
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const orders = await prisma.order.findMany({
      where: { vendorId: result.vendor.id },
      include: {
        user: {
          select: {
            name: true,
            email: true,
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
    });

    const total = await prisma.order.count({ where: { vendorId: result.vendor.id } });

    return NextResponse.json({
      orders,
      total,
      hasMore: offset + limit < total,
    });
  } catch (error) {
    console.error('Vendor orders fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch vendor orders' }, { status: 500 });
  }
}
