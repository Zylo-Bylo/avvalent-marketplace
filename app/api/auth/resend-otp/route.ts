import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createOtp, hashToken, minutesFromNow, normalizeEmail } from '@/lib/security';

export async function POST(request: NextRequest) {
  const { email } = await request.json();

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizeEmail(email) },
  });

  if (!user) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  if (user.emailVerified) {
    return NextResponse.json({ message: 'Email already verified' });
  }

  const otp = createOtp();
  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailOtpHash: hashToken(otp),
      emailOtpExpiresAt: minutesFromNow(15),
    },
  });

  return NextResponse.json({
    message: 'OTP generated. Connect an email provider before production to send this automatically.',
    ...(process.env.NODE_ENV !== 'production' ? { devOtp: otp } : {}),
  });
}
