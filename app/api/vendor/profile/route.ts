import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import {
  getLocalVendorUser,
  shouldUseLocalSqliteAuth,
  updateLocalVendorProfile,
} from '@/lib/local-sqlite-auth';

const vendorSelect = {
  id: true,
  storeName: true,
  description: true,
  logoUrl: true,
  mobile: true,
  businessCategory: true,
  businessAddress: true,
  gstNumber: true,
  panNumber: true,
  aadhaarNumber: true,
  bankDetails: true,
  upiId: true,
  documentsKyc: true,
  metadata: true,
  panCardUrl: true,
  aadhaarUrl: true,
  gstCertificateUrl: true,
  bankProofUrl: true,
  status: true,
  kycStatus: true,
  rejectionReason: true,
  approvedAt: true,
  workingHours: true,
  deliveryArea: true,
};

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

export async function GET() {
  const userId = await getUserIdFromCookie();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (shouldUseLocalSqliteAuth()) {
    const user = getLocalVendorUser(userId);

    if (!user || user.role !== 'VENDOR' || !user.vendorProfile) {
      return NextResponse.json({ error: 'Not a vendor' }, { status: 403 });
    }

    return NextResponse.json({ user });
  }

  const { prisma } = await import('@/lib/prisma');
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      vendorProfile: {
        select: vendorSelect,
      },
    },
  });

  if (!user || user.role !== 'VENDOR' || !user.vendorProfile) {
    return NextResponse.json({ error: 'Not a vendor' }, { status: 403 });
  }

  return NextResponse.json({ user });
}

export async function PUT(request: NextRequest) {
  const userId = await getUserIdFromCookie();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (shouldUseLocalSqliteAuth()) {
    const body = await request.json();
    const user = updateLocalVendorProfile(userId, body);

    if (!user || user.role !== 'VENDOR' || !user.vendorProfile) {
      return NextResponse.json({ error: 'Not a vendor' }, { status: 403 });
    }

    return NextResponse.json({ user });
  }

  const { prisma } = await import('@/lib/prisma');
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      vendorProfile: {
        select: { id: true, metadata: true },
      },
    },
  });

  if (!user || user.role !== 'VENDOR' || !user.vendorProfile) {
    return NextResponse.json({ error: 'Not a vendor' }, { status: 403 });
  }

  const body = await request.json();
  const toNullableString = (value: unknown) => {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  };

  const name = toNullableString(body.name);
  const storeName = toNullableString(body.storeName) || 'Vendor Store';
  const description = toNullableString(body.description);
  const logoUrl = toNullableString(body.logoUrl);
  const mobile = toNullableString(body.mobile);
  const businessCategory = toNullableString(body.businessCategory);
  const businessAddress = toNullableString(body.businessAddress);
  const gstNumber = toNullableString(body.gstNumber);
  const panNumber = toNullableString(body.panNumber);
  const aadhaarNumber = toNullableString(body.aadhaarNumber);
  const bankDetails = toNullableString(body.bankDetails);
  const upiId = toNullableString(body.upiId);
  const documentsKyc = toNullableString(body.documentsKyc);
  const panCardUrl = toNullableString(body.panCardUrl);
  const aadhaarUrl = toNullableString(body.aadhaarUrl);
  const gstCertificateUrl = toNullableString(body.gstCertificateUrl);
  const bankProofUrl = toNullableString(body.bankProofUrl);
  const workingHours = toNullableString(body.workingHours);
  const deliveryArea = toNullableString(body.deliveryArea);
  const hasKycDocument = Boolean(
    panCardUrl || aadhaarUrl || gstCertificateUrl || bankProofUrl || documentsKyc,
  );

  const [updatedUser, updatedVendor] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: name ? { name } : {},
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    }),
    prisma.vendor.update({
      where: { id: user.vendorProfile.id },
      data: {
        storeName,
        description,
        logoUrl,
        mobile,
        businessCategory,
        businessAddress,
        gstNumber,
        panNumber,
        aadhaarNumber,
        bankDetails,
        upiId,
        documentsKyc,
        metadata: {
          ...(
            user.vendorProfile.metadata &&
            typeof user.vendorProfile.metadata === 'object' &&
            !Array.isArray(user.vendorProfile.metadata)
              ? (user.vendorProfile.metadata as Record<string, unknown>)
              : {}
          ),
          business_category: businessCategory,
        },
        panCardUrl,
        aadhaarUrl,
        gstCertificateUrl,
        bankProofUrl,
        kycStatus: hasKycDocument ? 'SUBMITTED' : undefined,
        workingHours,
        deliveryArea,
      },
      select: vendorSelect,
    }),
  ]);

  return NextResponse.json({
    user: {
      ...updatedUser,
      vendorProfile: updatedVendor,
    },
  });
}
