import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiUser } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { safeKycDocument, toNullableString } from '@/lib/vendor-profile-phase1';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> },
) {
  const auth = await requireAdminApiUser();
  if (auth.response) return auth.response;

  const { id, documentId } = await params;
  const body = await request.json().catch(() => ({}));
  const reason = toNullableString(body.reason) || 'KYC document verified by admin.';

  const document = await prisma.vendorKycDocument.findFirst({
    where: { id: documentId, vendorId: id },
    include: { vendor: { select: { id: true, kycStatus: true, userId: true } } },
  });

  if (!document) {
    return NextResponse.json({ error: 'KYC document not found.' }, { status: 404 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updatedDocument = await tx.vendorKycDocument.update({
      where: { id: document.id },
      data: {
        status: 'VERIFIED',
        rejectionReason: null,
        verifiedById: auth.user.id,
        verifiedAt: new Date(),
      },
    });

    await tx.vendor.update({
      where: { id },
      data: { kycStatus: 'APPROVED' },
    });

    await tx.vendorVerificationEvent.create({
      data: {
        vendorId: id,
        actorUserId: auth.user.id,
        previousStatus: document.status,
        newStatus: 'KYC_DOCUMENT_VERIFIED',
        reason,
        metadata: { documentId: document.id, documentType: document.type },
      },
    });

    await tx.notification.create({
      data: {
        userId: document.vendor.userId,
        title: 'KYC document verified',
        message: 'Your vendor KYC document has been verified.',
      },
    });

    return updatedDocument;
  });

  return NextResponse.json({ document: safeKycDocument(updated) });
}
