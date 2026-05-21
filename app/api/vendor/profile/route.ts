import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const vendorSelect = {
  id: true,
  storeName: true,
  description: true,
  logoUrl: true,
  mobile: true,
  businessCategory: true,
  businessAddress: true,
  gstNumber: true,
  bankDetails: true,
  upiId: true,
  documentsKyc: true,
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

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      vendorProfile: {
        select: { id: true },
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
        storeName: toNullableString(body.storeName) || 'Vendor Store',
        description: toNullableString(body.description),
        logoUrl: toNullableString(body.logoUrl),
        mobile: toNullableString(body.mobile),
        businessCategory: toNullableString(body.businessCategory),
        businessAddress: toNullableString(body.businessAddress),
        gstNumber: toNullableString(body.gstNumber),
        bankDetails: toNullableString(body.bankDetails),
        upiId: toNullableString(body.upiId),
        documentsKyc: toNullableString(body.documentsKyc),
        workingHours: toNullableString(body.workingHours),
        deliveryArea: toNullableString(body.deliveryArea),
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
