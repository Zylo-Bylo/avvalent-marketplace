import { NextResponse } from 'next/server';
import { signCheckoutAuthToken } from '@/lib/checkout-auth-token';
import { clearAuthCookies, getAuthSession } from '@/lib/session-cookies';
import {
  getLocalVendorUser,
  shouldUseLocalSqliteAuth,
} from '@/lib/local-sqlite-auth';

export async function GET(request: Request) {
  const session = await getAuthSession();
  const hostname = new URL(request.url).hostname;
  const checkoutAuthToken = session
    ? signCheckoutAuthToken({
        type: 'checkout_auth',
        userId: session.userId,
        role: session.role,
      })
    : null;

  if (!session) {
    return NextResponse.json({ user: null });
  }

  if (shouldUseLocalSqliteAuth()) {
    const user = getLocalVendorUser(session.userId);
    return NextResponse.json({ user, checkoutAuthToken });
  }

  const { prisma } = await import('@/lib/prisma');
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      vendorProfile: {
        select: {
          id: true,
          storeName: true,
          description: true,
          logoUrl: true,
          mobile: true,
          businessCategory: true,
          businessAddress: true,
          gstNumber: true,
          panNumber: true,
          aadhaarNumber: true,
          bankDetails: true,
          upiId: true,
          documentsKyc: true,
          metadata: true,
          panCardUrl: true,
          aadhaarUrl: true,
          gstCertificateUrl: true,
          bankProofUrl: true,
          status: true,
          kycStatus: true,
          rejectionReason: true,
          approvedAt: true,
          workingHours: true,
          deliveryArea: true,
        },
      },
    },
  });

  const response = NextResponse.json({ user, checkoutAuthToken });
  if (!user) {
    clearAuthCookies(response, hostname);
  }

  return response;
}
