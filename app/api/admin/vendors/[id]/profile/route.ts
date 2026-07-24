import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiUser } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { createKycSignedUrl, safeKycDocument } from '@/lib/vendor-profile-phase1';

export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApiUser();
  if (auth.response) return auth.response;

  const { id } = await params;
  const vendor = await prisma.vendor.findUnique({
    where: { id },
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
      contactPersons: {
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
      },
      addresses: {
        orderBy: [{ type: 'asc' }, { isDefault: 'desc' }, { createdAt: 'desc' }],
      },
      kycDocuments: {
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      },
      verificationEvents: {
        orderBy: { createdAt: 'desc' },
        take: 100,
      },
      suspensionEvents: {
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
      _count: {
        select: {
          products: true,
          orders: true,
        },
      },
    },
  });

  if (!vendor) {
    return NextResponse.json({ error: 'Vendor not found.' }, { status: 404 });
  }

  const kycDocuments = await Promise.all(
    vendor.kycDocuments.map(async (document) =>
      safeKycDocument(document, await createKycSignedUrl(document.storagePath)),
    ),
  );

  return NextResponse.json({
    vendor: {
      ...vendor,
      kycDocuments,
    },
  });
}
