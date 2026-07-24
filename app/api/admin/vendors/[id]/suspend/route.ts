import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiUser } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { toNullableString, toRequiredString } from '@/lib/vendor-profile-phase1';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApiUser();
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const reason = toRequiredString(body.reason, 'Suspension reason');
  const startsAt = toNullableString(body.startsAt);
  const endsAt = toNullableString(body.endsAt);

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
        status: 'INACTIVE',
        rejectionReason: reason,
      },
    });

    await tx.vendorSuspensionEvent.create({
      data: {
        vendorId: id,
        actorUserId: auth.user.id,
        action: 'SUSPENDED',
        reason,
        startsAt: startsAt ? new Date(startsAt) : new Date(),
        endsAt: endsAt ? new Date(endsAt) : null,
      },
    });

    await tx.vendorVerificationEvent.create({
      data: {
        vendorId: id,
        actorUserId: auth.user.id,
        previousStatus: vendor.status,
        newStatus: 'INACTIVE',
        reason,
        metadata: { action: 'SUSPENDED' },
      },
    });

    await tx.notification.create({
      data: {
        userId: vendor.userId,
        title: 'Vendor account suspended',
        message: reason,
      },
    });

    return updatedVendor;
  });

  return NextResponse.json({ vendor: updated });
}
