import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = verifyToken(token);
    if (!data || typeof data !== 'object' || !data.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get vendor by user ID
    const vendor = await prisma.vendor.findUnique({
      where: { userId: String(data.userId) },
    });

    if (!vendor) {
      return NextResponse.json({ error: 'Not a vendor' }, { status: 403 });
    }

    if (vendor.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Vendor account is pending admin approval.' },
        { status: 403 }
      );
    }

    // Get vendor's products
    const products = await prisma.product.findMany({
      where: { vendorId: vendor.id },
      include: {
        category: true,
        subcategory: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ products });
  } catch (error) {
    console.error('Product listing error:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}
