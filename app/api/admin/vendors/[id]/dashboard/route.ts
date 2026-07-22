import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiUser } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { getOrderTrustSnapshot, ensureTrustTables } from '@/lib/trust';
import { ensureVariantSchema } from '@/lib/variants';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAdminApiUser();
    if (auth.response) return auth.response;

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const requestedLimit = parseInt(searchParams.get('limit') || '80', 10);
    const limit = Math.min(
      Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 80, 1),
      100,
    );

    await ensureVariantSchema();
    await ensureTrustTables();

    const vendor = await prisma.vendor.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          },
        },
      },
    });

    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    const [products, orders, categories, notifications] = await Promise.all([
      prisma.product.findMany({
        where: { vendorId: vendor.id },
        include: {
          category: true,
          subcategory: true,
          variants: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.order.findMany({
        where: { vendorId: vendor.id },
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
      }),
      prisma.category.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      }),
      prisma.notification.findMany({
        where: { userId: vendor.userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    const ordersWithTrust = await Promise.all(
      orders.map(async (order) => ({
        ...order,
        trust: await getOrderTrustSnapshot(order.id),
      })),
    );

    return NextResponse.json({
      preview: true,
      user: {
        id: vendor.user.id,
        email: vendor.user.email,
        name: vendor.user.name,
        role: 'VENDOR',
        vendorProfile: {
          id: vendor.id,
          storeName: vendor.storeName,
          description: vendor.description,
          logoUrl: vendor.logoUrl,
          mobile: vendor.mobile,
          businessCategory: vendor.businessCategory,
          businessAddress: vendor.businessAddress,
          gstNumber: vendor.gstNumber,
          panNumber: vendor.panNumber,
          aadhaarNumber: vendor.aadhaarNumber,
          bankDetails: vendor.bankDetails,
          upiId: vendor.upiId,
          documentsKyc: vendor.documentsKyc,
          panCardUrl: vendor.panCardUrl,
          aadhaarUrl: vendor.aadhaarUrl,
          gstCertificateUrl: vendor.gstCertificateUrl,
          bankProofUrl: vendor.bankProofUrl,
          status: vendor.status,
          kycStatus: vendor.kycStatus,
          rejectionReason: vendor.rejectionReason,
          workingHours: vendor.workingHours,
          deliveryArea: vendor.deliveryArea,
        },
      },
      products,
      orders: ordersWithTrust,
      categories,
      notifications,
      unreadCount: notifications.filter((notification) => !notification.read).length,
    });
  } catch (error) {
    console.error('Admin vendor dashboard preview error:', error);
    return NextResponse.json(
      { error: 'Failed to load vendor dashboard preview' },
      { status: 500 },
    );
  }
}
