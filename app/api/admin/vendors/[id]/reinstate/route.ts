import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiUser } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { toNullableString } from '@/lib/vendor-profile-phase1';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApiUser();
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const reason = toNullableString(body.reason) || 'Vendor account reinstated.';

  const vendor = await prisma.vendor.findUnique({
    where: { id },
    select: { id: true, status: true, userId: true },
  });

  if (!vendor) {
    return NextResponse.json({ error: 'Vendor not found.' }, { status: 404 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updatedVendor = await tx.vendor.update({
      where: { id },
      data: {
        status: 'APPROVED',
        rejectionReason: null,
        approvedAt: new Date(),
      },
    });

    await tx.vendorSuspensionEvent.create({
      data: {
        vendorId: id,
        actorUserId: auth.user.id,
        action: 'REINSTATED',
        reason,
        startsAt: null,
        endsAt: new Date(),
      },
    });

    await tx.vendorVerificationEvent.create({
      data: {
        vendorId: id,
        actorUserId: auth.user.id,
        previousStatus: vendor.status,
        newStatus: 'APPROVED',
        reason,
        metadata: { action: 'REINSTATED' },
      },
    });

    await tx.notification.create({
      data: {
        userId: vendor.userId,
        title: 'Vendor account reinstated',
        message: reason,
      },
    });

    return updatedVendor;
  });

  return NextResponse.json({ vendor: updated });
}
