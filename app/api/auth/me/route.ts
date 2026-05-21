import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;

  if (!token) {
    return NextResponse.json({ user: null });
  }

  const data = verifyToken(token);
  if (!data || typeof data !== 'object' || !data.userId) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: String(data.userId) },
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
          bankDetails: true,
          upiId: true,
          documentsKyc: true,
          workingHours: true,
          deliveryArea: true,
        },
      },
    },
  });

  return NextResponse.json({ user });
}
