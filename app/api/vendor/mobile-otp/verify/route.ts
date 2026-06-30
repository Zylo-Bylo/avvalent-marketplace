import { NextResponse } from 'next/server';
import { verifyVendorMobileOtp } from '@/lib/mobile-otp';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    mobile?: string;
    otp?: string;
  };
  const result = await verifyVendorMobileOtp(
    String(body.mobile || ''),
    String(body.otp || ''),
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    message: 'Mobile number verified.',
    mobile: result.mobile,
    mobileOtpToken: result.token,
  });
}
