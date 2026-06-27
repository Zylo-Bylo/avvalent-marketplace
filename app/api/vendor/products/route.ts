import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import {
  getLocalVendorUser,
  shouldUseLocalSqliteAuth,
} from '@/lib/local-sqlite-auth';
import { ensureVariantSchema } from '@/lib/variants';

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

    const localUser = shouldUseLocalSqliteAuth()
      ? getLocalVendorUser(String(data.userId))
      : null;
    const vendor = localUser?.vendorProfile
      ? {
          id: localUser.vendorProfile.id,
          status: localUser.vendorProfile.status,
        }
      : await (async () => {
          const { prisma } = await import('@/lib/prisma');
          return prisma.vendor.findUnique({
            where: { userId: String(data.userId) },
          });
        })();

    if (!vendor) {
      return NextResponse.json({ error: 'Not a vendor' }, { status: 403 });
    }

    if (vendor.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Vendor account is pending admin approval.' },
        { status: 403 }
      );
    }

    const { prisma } = await import('@/lib/prisma');
    await ensureVariantSchema();
    // Get vendor's products
    const products = await prisma.product.findMany({
      where: { vendorId: vendor.id },
      include: {
        category: true,
        subcategory: true,
        variants: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await prisma.product.count({ where: { vendorId: vendor.id } });

    return NextResponse.json({
      products,
      total,
      hasMore: offset + limit < total,
    });
  } catch (error) {
    console.error('Product listing error:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}
