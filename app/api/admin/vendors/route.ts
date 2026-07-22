import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiUser } from '@/lib/admin-auth';
import {
  listLocalVendorsForAdmin,
  shouldUseLocalSqliteAuth,
} from '@/lib/local-sqlite-auth';

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiUser();
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const requestedLimit = parseInt(searchParams.get('limit') || '100', 10);
  const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 100, 1), 150);
  const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0);

  if (shouldUseLocalSqliteAuth()) {
    const vendors = listLocalVendorsForAdmin();
    return NextResponse.json({
      vendors: vendors.slice(offset, offset + limit),
      total: vendors.length,
      hasMore: offset + limit < vendors.length,
    });
  }

  const { prisma } = await import('@/lib/prisma');
  const vendors = await prisma.vendor.findMany({
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          emailVerified: true,
          createdAt: true,
        },
      },
      _count: {
        select: {
          products: true,
          orders: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
  });

  const total = await prisma.vendor.count();

  return NextResponse.json({
    vendors,
    total,
    hasMore: offset + limit < total,
  });
}
