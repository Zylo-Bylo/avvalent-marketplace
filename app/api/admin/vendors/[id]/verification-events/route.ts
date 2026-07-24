import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiUser } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApiUser();
  if (auth.response) return auth.response;

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '100', 10) || 100, 1), 200);

  const vendor = await prisma.vendor.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!vendor) {
    return NextResponse.json({ error: 'Vendor not found.' }, { status: 404 });
  }

  const [verificationEvents, suspensionEvents] = await Promise.all([
    prisma.vendorVerificationEvent.findMany({
      where: { vendorId: id },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.vendorSuspensionEvent.findMany({
      where: { vendorId: id },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
  ]);

  return NextResponse.json({ verificationEvents, suspensionEvents });
}
