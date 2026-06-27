import { NextRequest, NextResponse } from 'next/server';
import { hashPassword } from '@/lib/auth';
import { sendOtpEmail } from '@/lib/email';
import {
  createLocalCustomer,
  findLocalUserByEmail,
  shouldUseLocalSqliteAuth,
} from '@/lib/local-sqlite-auth';
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
  const localSqlite = shouldUseLocalSqliteAuth();
  const prismaModule = localSqlite ? null : await import('@/lib/prisma');
  const existingUser = localSqlite
    ? findLocalUserByEmail(normalizedEmail)
    : await prismaModule!.prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (existingUser) {
    return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
  }

  const emailOtp = otp || createOtp();
  const hashedPassword = await hashPassword(password);
  const user = localSqlite
    ? createLocalCustomer({
        email: normalizedEmail,
        name,
        passwordHash: hashedPassword,
        emailOtpHash: hashToken(emailOtp),
        emailOtpExpiresAt: minutesFromNow(15),
      })
    : await prismaModule!.prisma.user.create({
        data: {
          email: normalizedEmail,
          name,
          password: hashedPassword,
          emailVerified: false,
          emailOtpHash: hashToken(emailOtp),
          emailOtpExpiresAt: minutesFromNow(15),
        },
      });

  const emailSent = await sendOtpEmail({
    to: normalizedEmail,
    otp: emailOtp,
    purpose: 'verify your customer account',
  });

  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    requiresVerification: true,
    message: emailSent
      ? 'Account created. Check your email for the OTP.'
      : 'Account created. Email delivery is not configured yet; ask admin for OTP or configure RESEND_API_KEY.',
    ...(process.env.NODE_ENV !== 'production' ? { devOtp: emailOtp } : {}),
  }, { status: 201 });
}
