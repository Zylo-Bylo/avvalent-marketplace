import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendOtpEmail } from '@/lib/email';
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

  const emailSent = await sendOtpEmail({
    to: normalizeEmail(email),
    otp,
  });

  return NextResponse.json({
    message: emailSent
      ? 'OTP sent. Check your email.'
      : 'OTP generated. Connect an email provider before production to send this automatically.',
    emailSent,
  });
}
