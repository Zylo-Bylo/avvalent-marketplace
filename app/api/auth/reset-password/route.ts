import { NextRequest, NextResponse } from 'next/server';
import { hashPassword } from '@/lib/auth';
import {
  findLocalPasswordResetToken,
  resetLocalPassword,
  shouldUseLocalSqliteAuth,
} from '@/lib/local-sqlite-auth';
import { hashToken, validateStrongPassword } from '@/lib/security';

export async function POST(request: NextRequest) {
  const { token, password } = await request.json();

  if (!token || !password) {
    return NextResponse.json({ error: 'Token and password are required' }, { status: 400 });
  }

  if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL) {
    return NextResponse.json(
      {
        error:
          'Password reset is not available until DATABASE_URL is configured in Vercel.',
      },
      { status: 503 }
    );
  }

  const passwordCheck = validateStrongPassword(password);
  if (!passwordCheck.valid) {
    return NextResponse.json({ error: passwordCheck.message }, { status: 400 });
  }

  const tokenHash = hashToken(token);
  const localSqlite = shouldUseLocalSqliteAuth();
  const prismaModule = localSqlite ? null : await import('@/lib/prisma');
  const resetToken = localSqlite
    ? findLocalPasswordResetToken(tokenHash)
    : await prismaModule!.prisma.passwordResetToken.findUnique({
        where: { tokenHash },
      });

  if (!resetToken || resetToken.usedAt || new Date(resetToken.expiresAt) < new Date()) {
    return NextResponse.json({ error: 'Reset link is invalid or expired' }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);

  if (localSqlite) {
    resetLocalPassword({
      userId: resetToken.userId,
      tokenId: resetToken.id,
      passwordHash,
    });
  } else {
    await prismaModule!.prisma.$transaction([
      prismaModule!.prisma.user.update({
        where: { id: resetToken.userId },
        data: {
          password: passwordHash,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      }),
      prismaModule!.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
    ]);
  }

  return NextResponse.json({ message: 'Password reset successfully. You can login now.' });
}
