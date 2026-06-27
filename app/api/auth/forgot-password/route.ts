import { NextRequest, NextResponse } from 'next/server';
import {
  createLocalPasswordResetToken,
  findLocalUserByEmail,
  shouldUseLocalSqliteAuth,
} from '@/lib/local-sqlite-auth';
import { sendPasswordResetEmail } from '@/lib/email';
import { createSecureToken, hashToken, minutesFromNow, normalizeEmail } from '@/lib/security';

function buildResetUrl(request: NextRequest, token: string) {
  const appUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    request.nextUrl.origin;
  const resetUrl = new URL('/reset-password', appUrl);
  resetUrl.searchParams.set('token', token);
  return resetUrl.toString();
}

function canReturnResetUrl(request: NextRequest) {
  const isLocalRequest = ['localhost', '127.0.0.1', '::1'].includes(
    request.nextUrl.hostname
  );

  return (
    process.env.NODE_ENV !== 'production' ||
    isLocalRequest ||
    process.env.PASSWORD_RESET_LINK_RESPONSE === 'true'
  );
}

export async function POST(request: NextRequest) {
  const { email } = await request.json();

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
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

  try {
    const normalizedEmail = normalizeEmail(email);
    const localSqlite = shouldUseLocalSqliteAuth();
    const prismaModule = localSqlite ? null : await import('@/lib/prisma');
    const user = localSqlite
      ? findLocalUserByEmail(normalizedEmail)
      : await prismaModule!.prisma.user.findUnique({
          where: { email: normalizedEmail },
        });

    if (!user) {
      return NextResponse.json({
        message: localSqlite
          ? 'No account found with this email. Please enter the exact registered login email.'
          : 'If this email exists, a reset link will be sent.',
        accountFound: false,
      });
    }

    const token = createSecureToken();
    const tokenHash = hashToken(token);
    const expiresAt = minutesFromNow(30);

    if (localSqlite) {
      createLocalPasswordResetToken({
        tokenHash,
        userId: user.id,
        expiresAt,
      });
    } else {
      await prismaModule!.prisma.passwordResetToken.create({
        data: {
          tokenHash,
          userId: user.id,
          expiresAt,
        },
      });
    }

    const resetUrl = buildResetUrl(request, token);
    const emailSent = await sendPasswordResetEmail({
      to: normalizedEmail,
      resetUrl,
    });
    const exposeResetUrl = canReturnResetUrl(request);

    return NextResponse.json({
      message: emailSent
        ? 'Password reset link sent. Check your email.'
        : exposeResetUrl
          ? 'Password reset link generated. Open it below to continue.'
          : 'Password reset token generated, but email delivery is not configured. Add RESEND_API_KEY and AUTH_EMAIL_FROM in Vercel, or temporarily set PASSWORD_RESET_LINK_RESPONSE=true for manual recovery.',
      accountFound: true,
      emailSent,
      ...(exposeResetUrl ? { resetUrl } : {}),
    });
  } catch (error) {
    console.error('Password reset request failed:', error);

    return NextResponse.json(
      {
        error:
          'Password reset service is not configured correctly. Check DATABASE_URL and email settings.',
      },
      { status: 500 }
    );
  }
}
