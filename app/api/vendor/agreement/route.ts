import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import {
  shouldUseLocalSqliteAuth,
  updateLocalVendorAgreement,
} from '@/lib/local-sqlite-auth';
import { getVendorAgreementMetadata } from '@/lib/legal-policy';

async function getUserIdFromCookie() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;

  if (!token) {
    return null;
  }

  const data = verifyToken(token);
  if (!data || typeof data !== 'object' || !data.userId) {
    return null;
  }

  return String(data.userId);
}

function requestAgreementMetadata(request: NextRequest) {
  return getVendorAgreementMetadata({
    acceptedAt: new Date().toISOString(),
    ipAddress:
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      null,
    userAgent: request.headers.get('user-agent') || null,
  });
}

export async function POST(request: NextRequest) {
  const userId = await getUserIdFromCookie();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));

  if (!body.accepted) {
    return NextResponse.json({ error: 'Agreement acceptance is required.' }, { status: 400 });
  }

  const agreementMetadata = requestAgreementMetadata(request);

  if (shouldUseLocalSqliteAuth()) {
    const user = updateLocalVendorAgreement(userId, agreementMetadata);

    if (!user || user.role !== 'VENDOR' || !user.vendorProfile) {
      return NextResponse.json({ error: 'Vendor access required' }, { status: 403 });
    }

    return NextResponse.json({ user, agreement: agreementMetadata });
  }

  const { prisma } = await import('@/lib/prisma');
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      vendorProfile: {
        select: {
          id: true,
          metadata: true,
        },
      },
    },
  });

  if (!user || user.role !== 'VENDOR' || !user.vendorProfile) {
    return NextResponse.json({ error: 'Vendor access required' }, { status: 403 });
  }

  const existingMetadata =
    user.vendorProfile.metadata &&
    typeof user.vendorProfile.metadata === 'object' &&
    !Array.isArray(user.vendorProfile.metadata)
      ? (user.vendorProfile.metadata as Record<string, unknown>)
      : {};

  const updatedVendor = await prisma.vendor.update({
    where: { id: user.vendorProfile.id },
    data: {
      metadata: {
        ...existingMetadata,
        ...agreementMetadata,
      },
    },
    select: {
      id: true,
      metadata: true,
    },
  });

  return NextResponse.json({ vendor: updatedVendor, agreement: agreementMetadata });
}
