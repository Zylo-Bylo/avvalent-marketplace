import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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

  const user = await prisma.user.findUnique({
    where: { id: String(data.userId) },
    select: { role: true },
  });

  return user?.role === 'ADMIN';
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

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

  const vendor = await prisma.vendor.update({
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

  return NextResponse.json({ vendor });
}
