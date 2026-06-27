import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/session-cookies';
import { getVendorBankAccount, upsertVendorBankAccount } from '@/lib/payouts';

async function getVendorId() {
  const session = await getAuthSession();
  if (!session?.userId) {
    return { error: 'Unauthorized', status: 401 as const };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { vendorProfile: true },
  });

  if (!user || user.role !== 'VENDOR' || !user.vendorProfile) {
    return { error: 'Vendor access required', status: 403 as const };
  }

  return { vendorId: user.vendorProfile.id };
}

export async function GET() {
  const result = await getVendorId();
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const bank = await getVendorBankAccount(result.vendorId);
  return NextResponse.json({ bank });
}

export async function POST(request: Request) {
  try {
    const result = await getVendorId();
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const body = await request.json().catch(() => ({}));
    const bank = await upsertVendorBankAccount(result.vendorId, body);
    return NextResponse.json({ bank, message: 'Bank details saved for admin verification.' });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Bank details could not be saved.' },
      { status: 400 },
    );
  }
}
