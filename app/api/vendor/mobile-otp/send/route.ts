import { NextResponse } from 'next/server';
import { createAndSendVendorMobileOtp } from '@/lib/mobile-otp';
import { hasSmsProvider } from '@/lib/sms';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { mobile?: string };
  const result = await createAndSendVendorMobileOtp(String(body.mobile || ''));

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  if (!result.smsSent && process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      {
        error: result.smsError || 'SMS gateway could not send OTP.',
        providerConfigured: hasSmsProvider(),
        provider: result.provider,
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    message: result.smsSent
      ? `OTP sent to ${result.mobile}.`
      : 'OTP generated in setup mode. Configure SMS gateway for real delivery.',
    mobile: result.mobile,
    smsSent: result.smsSent,
    provider: result.provider,
    ...(result.smsError ? { smsError: result.smsError } : {}),
    ...(result.devOtp ? { devOtp: result.devOtp } : {}),
  });
}
