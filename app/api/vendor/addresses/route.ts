import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  isVendorAddressType,
  requireVendorProfile,
  toNullableString,
  toRequiredString,
} from '@/lib/vendor-profile-phase1';

export const runtime = 'nodejs';

export async function GET() {
  const auth = await requireVendorProfile();
  if ('response' in auth) return auth.response;

  const addresses = await prisma.vendorAddress.findMany({
    where: { vendorId: auth.vendor.id },
    orderBy: [{ type: 'asc' }, { isDefault: 'desc' }, { createdAt: 'desc' }],
  });

  return NextResponse.json({ addresses });
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireVendorProfile();
    if ('response' in auth) return auth.response;

    const body = await request.json().catch(() => ({}));
    if (!isVendorAddressType(body.type)) {
      return NextResponse.json({ error: 'Valid address type is required.' }, { status: 400 });
    }

    const isDefault = Boolean(body.isDefault);
    const address = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.vendorAddress.updateMany({
          where: { vendorId: auth.vendor.id, type: body.type, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.vendorAddress.create({
        data: {
          vendorId: auth.vendor.id,
          type: body.type,
          addressLine1: toRequiredString(body.addressLine1, 'Address line 1'),
          addressLine2: toNullableString(body.addressLine2),
          landmark: toNullableString(body.landmark),
          city: toRequiredString(body.city, 'City'),
          state: toRequiredString(body.state, 'State'),
          postalCode: toRequiredString(body.postalCode, 'Postal code'),
          country: toNullableString(body.country) || 'India',
          contactName: toNullableString(body.contactName),
          contactPhone: toNullableString(body.contactPhone),
          isDefault,
          isActive: body.isActive === undefined ? true : Boolean(body.isActive),
        },
      });
    });

    return NextResponse.json({ address }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Address create failed.' },
      { status: 400 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireVendorProfile();
    if ('response' in auth) return auth.response;

    const body = await request.json().catch(() => ({}));
    const id = toRequiredString(body.id, 'Address ID');
    const existing = await prisma.vendorAddress.findFirst({
      where: { id, vendorId: auth.vendor.id },
      select: { id: true, type: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Address not found.' }, { status: 404 });
    }

    const nextType = body.type === undefined ? existing.type : body.type;
    if (!isVendorAddressType(nextType)) {
      return NextResponse.json({ error: 'Valid address type is required.' }, { status: 400 });
    }

    const isDefault = body.isDefault === undefined ? undefined : Boolean(body.isDefault);
    const address = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.vendorAddress.updateMany({
          where: { vendorId: auth.vendor.id, type: nextType, isDefault: true, NOT: { id } },
          data: { isDefault: false },
        });
      }

      return tx.vendorAddress.update({
        where: { id },
        data: {
          ...(body.type !== undefined ? { type: nextType } : {}),
          ...(body.addressLine1 !== undefined
            ? { addressLine1: toRequiredString(body.addressLine1, 'Address line 1') }
            : {}),
          ...(body.addressLine2 !== undefined ? { addressLine2: toNullableString(body.addressLine2) } : {}),
          ...(body.landmark !== undefined ? { landmark: toNullableString(body.landmark) } : {}),
          ...(body.city !== undefined ? { city: toRequiredString(body.city, 'City') } : {}),
          ...(body.state !== undefined ? { state: toRequiredString(body.state, 'State') } : {}),
          ...(body.postalCode !== undefined
            ? { postalCode: toRequiredString(body.postalCode, 'Postal code') }
            : {}),
          ...(body.country !== undefined ? { country: toNullableString(body.country) || 'India' } : {}),
          ...(body.contactName !== undefined ? { contactName: toNullableString(body.contactName) } : {}),
          ...(body.contactPhone !== undefined ? { contactPhone: toNullableString(body.contactPhone) } : {}),
          ...(isDefault !== undefined ? { isDefault } : {}),
          ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
        },
      });
    });

    return NextResponse.json({ address });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Address update failed.' },
      { status: 400 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireVendorProfile();
  if ('response' in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id') || '';
  if (!id) {
    return NextResponse.json({ error: 'Address ID is required.' }, { status: 400 });
  }

  const existing = await prisma.vendorAddress.findFirst({
    where: { id, vendorId: auth.vendor.id },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Address not found.' }, { status: 404 });
  }

  await prisma.vendorAddress.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
