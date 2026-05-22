import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = verifyToken(token);
    if (!data || typeof data !== 'object' || !data.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: String(data.userId) },
    });

    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized - admin only' }, { status: 403 });
    }

    // Fetch stats
    const [
      totalUsers,
      totalVendors,
      pendingVendors,
      approvedVendors,
      rejectedVendors,
      inactiveVendors,
      pendingKyc,
      totalProducts,
      totalOrders,
      orderData,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.vendor.count(),
      prisma.vendor.count({ where: { status: 'PENDING' } }),
      prisma.vendor.count({ where: { status: 'APPROVED' } }),
      prisma.vendor.count({ where: { status: 'REJECTED' } }),
      prisma.vendor.count({ where: { status: 'INACTIVE' } }),
      prisma.vendor.count({ where: { kycStatus: { in: ['NOT_SUBMITTED', 'SUBMITTED'] } } }),
      prisma.product.count(),
      prisma.order.count(),
      prisma.order.aggregate({
        _sum: { totalAmount: true },
      }),
    ]);

    const stats = {
      totalUsers,
      totalVendors,
      pendingVendors,
      approvedVendors,
      rejectedVendors,
      inactiveVendors,
      pendingKyc,
      totalProducts,
      totalOrders,
      totalRevenue: orderData._sum.totalAmount || 0,
    };

    return NextResponse.json({ stats });
  } catch (error) {
    console.error('Stats fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
