import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword, signToken } from '@/lib/auth';
import { sendOtpEmail } from '@/lib/email';
import { setAuthCookies } from '@/lib/session-cookies';
import {
  findLocalLoginUserByEmail,
  getLocalPasswordHash,
  shouldUseLocalSqliteAuth,
} from '@/lib/local-sqlite-auth';
import {
  LOCK_MINUTES,
  MAX_LOGIN_ATTEMPTS,
  createOtp,
  hashToken,
  minutesFromNow,
  normalizeEmail,
} from '@/lib/security';

const DATABASE_URL = process.env.DATABASE_URL || '';
const shouldPersistLoginSecurity =
  DATABASE_URL.length > 0 && !DATABASE_URL.startsWith('file:');

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, password, expectedRole } = body;

  if (!email || !password) {
    return NextResponse.json({ error: 'Missing email or password' }, { status: 400 });
  }

  if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL) {
    return NextResponse.json(
      {
        error:
          'Login is not available until DATABASE_URL is configured in Vercel.',
      },
      { status: 503 }
    );
  }

  if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    return NextResponse.json(
      {
        error:
          'Login is not available until JWT_SECRET is configured in Vercel.',
      },
      { status: 503 }
    );
  }

  const localSqlite = shouldUseLocalSqliteAuth();
  const prismaModule = localSqlite ? null : await import('@/lib/prisma');
  const normalizedEmail = normalizeEmail(email);
  const user = localSqlite
    ? findLocalLoginUserByEmail(normalizedEmail)
    : await prismaModule!.prisma.user.findUnique({
        where: { email: normalizedEmail },
        include: {
          vendorProfile: {
            select: {
              status: true,
              kycStatus: true,
            },
          },
        },
      });

  if (!user) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return NextResponse.json(
      { error: `Account locked. Try again after ${user.lockedUntil.toLocaleString()}.` },
      { status: 423 }
    );
  }

  const passwordHash = localSqlite
    ? getLocalPasswordHash(user.id) || user.password
    : user.password;
  const isValid = await verifyPassword(password, passwordHash);

  if (!isValid) {
    const failedLoginAttempts = user.failedLoginAttempts + 1;
    const shouldLock = failedLoginAttempts >= MAX_LOGIN_ATTEMPTS;

    if (shouldPersistLoginSecurity) {
      await prismaModule!.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts,
          lockedUntil: shouldLock ? minutesFromNow(LOCK_MINUTES) : null,
        },
      });
    }

    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  if (!localSqlite && !user.emailVerified) {
    const otp = createOtp();
    await prismaModule!.prisma.user.update({
      where: { id: user.id },
      data: {
        emailOtpHash: hashToken(otp),
        emailOtpExpiresAt: minutesFromNow(15),
      },
    });
    const emailSent = await sendOtpEmail({
      to: user.email,
      otp,
      purpose: 'verify your Zylo-Buylo account',
    });

    return NextResponse.json(
      {
        error: emailSent
          ? 'Email verification required before login. We sent a new OTP to your email.'
          : 'Email verification required before login. Email delivery is not available right now.',
        requiresVerification: true,
        emailSent,
        verifyEmailUrl: `/verify-email?email=${encodeURIComponent(user.email)}`,
      },
      { status: 403 }
    );
  }

  if (
    expectedRole &&
    ['CUSTOMER', 'VENDOR', 'ADMIN'].includes(expectedRole) &&
    user.role !== expectedRole
  ) {
    return NextResponse.json(
      {
        error:
          expectedRole === 'ADMIN'
            ? 'Admin login is required to access dashboard.'
            : expectedRole === 'VENDOR'
              ? 'Vendor login is required to access vendor dashboard.'
              : 'Customer login is required.',
      },
      { status: 403 }
    );
  }

  if (shouldPersistLoginSecurity) {
    await prismaModule!.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
  }

  const token = signToken({ userId: user.id, role: user.role });

  const response = NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      vendorProfile: user.vendorProfile,
    },
  });
  setAuthCookies(response, token, request.nextUrl.hostname);

  return response;
}
