import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import {
  getLocalUserRole,
  listLocalVendorsForAdmin,
  shouldUseLocalSqliteAuth,
} from '@/lib/local-sqlite-auth';

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;

  if (!token) {
    return false;
  }

  const data = verifyToken(token);
  if (!data || typeof data !== 'object' || !data.userId) {
    return false;
  }

  if (shouldUseLocalSqliteAuth()) {
    return getLocalUserRole(String(data.userId)) === 'ADMIN';
  }

  const { prisma } = await import('@/lib/prisma');
  const user = await prisma.user.findUnique({
    where: { id: String(data.userId) },
    select: { role: true },
  });

  return user?.role === 'ADMIN';
}

export async function GET(request: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
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
