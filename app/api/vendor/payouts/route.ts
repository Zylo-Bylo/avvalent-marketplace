import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/session-cookies';
import {
  MINIMUM_PAYOUT_AMOUNT,
  getVendorPayoutData,
  requestVendorPayout,
} from '@/lib/payouts';

async function getVendor() {
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

  if (user.vendorProfile.status !== 'APPROVED') {
    return { error: 'Vendor account is pending admin approval.', status: 403 as const };
  }

  return { vendor: user.vendorProfile };
}

export async function GET() {
  const result = await getVendor();
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const data = await getVendorPayoutData(result.vendor.id);
  return NextResponse.json({
    ...data,
    minimumPayoutAmount: MINIMUM_PAYOUT_AMOUNT,
  });
}

export async function POST(request: Request) {
  try {
    const result = await getVendor();
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const body = await request.json().catch(() => ({}));
    const amount = Number(body.amount || 0);
    await requestVendorPayout(result.vendor.id, amount);

    const data = await getVendorPayoutData(result.vendor.id);
    return NextResponse.json({
      message: 'Payout request created.',
      ...data,
      minimumPayoutAmount: MINIMUM_PAYOUT_AMOUNT,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Payout request failed.' },
      { status: 400 },
    );
  }
}
