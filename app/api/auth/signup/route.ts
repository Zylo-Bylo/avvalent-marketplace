import { NextRequest, NextResponse } from 'next/server';
import { hashPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  createOtp,
  hashToken,
  minutesFromNow,
  normalizeEmail,
  validateStrongPassword,
} from '@/lib/security';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, name, password, otp } = body;

  if (!email || !name || !password) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const passwordCheck = validateStrongPassword(password);
  if (!passwordCheck.valid) {
    return NextResponse.json({ error: passwordCheck.message }, { status: 400 });
  }

  const normalizedEmail = normalizeEmail(email);
  const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (existingUser) {
    return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
  }

  const emailOtp = otp || createOtp();
  const hashedPassword = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      name,
      password: hashedPassword,
      emailVerified: false,
      emailOtpHash: hashToken(emailOtp),
      emailOtpExpiresAt: minutesFromNow(15),
    },
  });

  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    requiresVerification: true,
    message: 'Account created. Verify your email OTP before login.',
    ...(process.env.NODE_ENV !== 'production' ? { devOtp: emailOtp } : {}),
  }, { status: 201 });
}
