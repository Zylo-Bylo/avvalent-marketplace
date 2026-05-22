import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSecureToken, hashToken, minutesFromNow, normalizeEmail } from '@/lib/security';

export async function POST(request: NextRequest) {
  const { email } = await request.json();

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizeEmail(email) },
  });

  if (!user) {
    return NextResponse.json({
      message: 'If this email exists, a reset link will be generated.',
    });
  }

  const token = createSecureToken();
  await prisma.passwordResetToken.create({
    data: {
      tokenHash: hashToken(token),
      userId: user.id,
      expiresAt: minutesFromNow(30),
    },
  });

  return NextResponse.json({
    message: 'Password reset token generated. Connect an email provider before production to send this link automatically.',
    ...(process.env.NODE_ENV !== 'production'
      ? { resetUrl: `/reset-password?token=${token}` }
      : {}),
  });
}
