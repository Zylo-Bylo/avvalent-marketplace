import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword, signToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  LOCK_MINUTES,
  MAX_LOGIN_ATTEMPTS,
  minutesFromNow,
  normalizeEmail,
} from '@/lib/security';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json({ error: 'Missing email or password' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizeEmail(email) },
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

  const isValid = await verifyPassword(password, user.password);

  if (!isValid) {
    const failedLoginAttempts = user.failedLoginAttempts + 1;
    const shouldLock = failedLoginAttempts >= MAX_LOGIN_ATTEMPTS;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts,
        lockedUntil: shouldLock ? minutesFromNow(LOCK_MINUTES) : null,
      },
    });

    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  if (!user.emailVerified) {
    return NextResponse.json(
      {
        error: 'Email verification required before login.',
        requiresVerification: true,
      },
      { status: 403 }
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });

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
  response.cookies.set({
    name: 'auth_token',
    value: token,
    httpOnly: true,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}
