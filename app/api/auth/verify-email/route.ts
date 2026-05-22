import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashToken, normalizeEmail } from '@/lib/security';

export async function POST(request: NextRequest) {
  const { email, otp } = await request.json();

  if (!email || !otp) {
    return NextResponse.json({ error: 'Email and OTP are required' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizeEmail(email) },
  });

  if (!user) {
    return NextResponse.json({ error: 'Invalid verification request' }, { status: 400 });
  }

  if (user.emailVerified) {
    return NextResponse.json({ message: 'Email already verified' });
  }

  if (!user.emailOtpHash || !user.emailOtpExpiresAt || user.emailOtpExpiresAt < new Date()) {
    return NextResponse.json({ error: 'OTP expired. Request a new OTP.' }, { status: 400 });
  }

  if (hashToken(String(otp)) !== user.emailOtpHash) {
    return NextResponse.json({ error: 'Invalid OTP' }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailOtpHash: null,
      emailOtpExpiresAt: null,
    },
  });

  return NextResponse.json({ message: 'Email verified. You can login now.' });
}
