import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  requireVendorProfile,
  toNullableString,
  toRequiredString,
} from '@/lib/vendor-profile-phase1';

export const runtime = 'nodejs';

async function getAuth() {
  const auth = await requireVendorProfile();
  if ('response' in auth) return auth;
  return auth;
}

export async function GET() {
  const auth = await getAuth();
  if ('response' in auth) return auth.response;

  const contacts = await prisma.vendorContactPerson.findMany({
    where: { vendorId: auth.vendor.id },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
  });

  return NextResponse.json({ contacts });
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuth();
    if ('response' in auth) return auth.response;

    const body = await request.json().catch(() => ({}));
    const isPrimary = Boolean(body.isPrimary);

    const contact = await prisma.$transaction(async (tx) => {
      if (isPrimary) {
        await tx.vendorContactPerson.updateMany({
          where: { vendorId: auth.vendor.id, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      return tx.vendorContactPerson.create({
        data: {
          vendorId: auth.vendor.id,
          name: toRequiredString(body.name, 'Contact name'),
          designation: toNullableString(body.designation),
          phone: toNullableString(body.phone),
          email: toNullableString(body.email),
          isPrimary,
          isActive: body.isActive === undefined ? true : Boolean(body.isActive),
        },
      });
    });

    return NextResponse.json({ contact }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Contact create failed.' },
      { status: 400 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await getAuth();
    if ('response' in auth) return auth.response;

    const body = await request.json().catch(() => ({}));
    const id = toRequiredString(body.id, 'Contact ID');
    const existing = await prisma.vendorContactPerson.findFirst({
      where: { id, vendorId: auth.vendor.id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Contact not found.' }, { status: 404 });
    }

    const isPrimary = body.isPrimary === undefined ? undefined : Boolean(body.isPrimary);
    const contact = await prisma.$transaction(async (tx) => {
      if (isPrimary) {
        await tx.vendorContactPerson.updateMany({
          where: { vendorId: auth.vendor.id, isPrimary: true, NOT: { id } },
          data: { isPrimary: false },
        });
      }

      return tx.vendorContactPerson.update({
        where: { id },
        data: {
          ...(body.name !== undefined ? { name: toRequiredString(body.name, 'Contact name') } : {}),
          ...(body.designation !== undefined ? { designation: toNullableString(body.designation) } : {}),
          ...(body.phone !== undefined ? { phone: toNullableString(body.phone) } : {}),
          ...(body.email !== undefined ? { email: toNullableString(body.email) } : {}),
          ...(isPrimary !== undefined ? { isPrimary } : {}),
          ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
        },
      });
    });

    return NextResponse.json({ contact });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Contact update failed.' },
      { status: 400 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await getAuth();
  if ('response' in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id') || '';
  if (!id) {
    return NextResponse.json({ error: 'Contact ID is required.' }, { status: 400 });
  }

  const existing = await prisma.vendorContactPerson.findFirst({
    where: { id, vendorId: auth.vendor.id },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Contact not found.' }, { status: 404 });
  }

  await prisma.vendorContactPerson.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
