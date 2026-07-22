import { NextResponse } from 'next/server';
import { requireAdminApiUser } from '@/lib/admin-auth';
import {
  listLocalVendorsForAdmin,
  shouldUseLocalSqliteAuth,
} from '@/lib/local-sqlite-auth';

export async function GET() {
  try {
    const auth = await requireAdminApiUser();
    if (auth.response) return auth.response;

    if (shouldUseLocalSqliteAuth()) {
      const vendors = listLocalVendorsForAdmin();
      const totalProducts = vendors.reduce(
        (sum, vendor) => sum + Number(vendor._count?.products || 0),
        0
      );
      const totalOrders = vendors.reduce(
        (sum, vendor) => sum + Number(vendor._count?.orders || 0),
        0
      );

      return NextResponse.json({
        stats: {
          totalUsers: vendors.length + 1,
          totalVendors: vendors.length,
          pendingVendors: vendors.filter((vendor) => vendor.status === 'PENDING').length,
          approvedVendors: vendors.filter((vendor) => vendor.status === 'APPROVED').length,
          rejectedVendors: vendors.filter((vendor) => vendor.status === 'REJECTED').length,
          inactiveVendors: vendors.filter((vendor) => vendor.status === 'INACTIVE').length,
          pendingKyc: vendors.filter((vendor) =>
            ['NOT_SUBMITTED', 'SUBMITTED'].includes(String(vendor.kycStatus))
          ).length,
          totalProducts,
          totalOrders,
          totalRevenue: 0,
        },
      });
    }

    const { prisma } = await import('@/lib/prisma');
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
