import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
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

    // Check if user is a vendor
    const vendor = await prisma.vendor.findUnique({
      where: { userId: String(data.userId) },
    });

    if (!vendor) {
      return NextResponse.json({ error: 'Not a vendor' }, { status: 403 });
    }

    const { name, description, price, categoryId, subcategoryId, sku, inventory, images } = await request.json();

    if (!name || !description || price === undefined || price === null || inventory === undefined || inventory === null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const slug = `${name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now()}`;

    const product = await prisma.product.create({
      data: {
        name,
        slug,
        description,
        price: parseFloat(price),
        categoryId: categoryId || undefined,
        subcategoryId: subcategoryId || undefined,
        sku: sku || undefined,
        inventory: parseInt(inventory),
        images: Array.isArray(images) ? images : [],
        vendorId: vendor.id,
      },
      include: {
        category: true,
        subcategory: true,
      },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error('Product creation error:', error);
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}
