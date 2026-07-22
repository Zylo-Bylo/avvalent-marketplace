import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiUser } from '@/lib/admin-auth';
import { sendVendorStatusEmail } from '@/lib/email';
import {
  shouldUseLocalSqliteAuth,
  updateLocalVendorStatus,
} from '@/lib/local-sqlite-auth';

function isPrismaNotFoundError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2025'
  );
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiUser();
  if (auth.response) return auth.response;

  const { id } = await params;
  const { status, kycStatus, rejectionReason } = await request.json();

  if (!['PENDING', 'APPROVED', 'REJECTED', 'INACTIVE'].includes(status)) {
    return NextResponse.json({ error: 'Invalid vendor status' }, { status: 400 });
  }

  const nextKycStatus =
    kycStatus && ['NOT_SUBMITTED', 'SUBMITTED', 'APPROVED', 'REJECTED'].includes(kycStatus)
      ? kycStatus
      : status === 'APPROVED'
        ? 'APPROVED'
        : status === 'REJECTED'
          ? 'REJECTED'
          : undefined;

  let vendor;

  if (shouldUseLocalSqliteAuth()) {
    vendor = updateLocalVendorStatus({
      vendorId: id,
      status,
      kycStatus: nextKycStatus,
      rejectionReason,
    });
  } else {
    try {
      const { prisma } = await import('@/lib/prisma');
      vendor = await prisma.vendor.update({
        where: { id },
        data: {
          status,
          ...(nextKycStatus && { kycStatus: nextKycStatus }),
          rejectionReason: status === 'REJECTED' ? rejectionReason || 'Rejected by admin' : null,
          approvedAt: status === 'APPROVED' ? new Date() : null,
        },
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
      });
    } catch (error) {
      if (isPrismaNotFoundError(error)) {
        return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
      }

      throw error;
    }
  }

  if (!vendor) {
    return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
  }

  if (!shouldUseLocalSqliteAuth() && ['APPROVED', 'REJECTED', 'INACTIVE'].includes(status)) {
    const notifiedVendor = vendor as {
      user: { email: string };
      storeName: string;
      rejectionReason?: string | null;
    };

    await sendVendorStatusEmail({
      to: notifiedVendor.user.email,
      storeName: notifiedVendor.storeName,
      status: status as 'APPROVED' | 'REJECTED' | 'INACTIVE',
      rejectionReason: notifiedVendor.rejectionReason,
    }).catch((error) => {
      console.error('Vendor status email failed:', error);
    });
  }

  return NextResponse.json({ vendor });
}
