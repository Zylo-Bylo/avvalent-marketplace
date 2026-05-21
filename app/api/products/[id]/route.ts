import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

async function getProductManager() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;

  if (!token) {
    return { error: 'Unauthorized', status: 401 as const };
  }

  const data = verifyToken(token);
  if (!data || typeof data !== 'object' || !data.userId) {
    return { error: 'Invalid token', status: 401 as const };
  }

  const user = await prisma.user.findUnique({
    where: { id: String(data.userId) },
    include: { vendorProfile: true },
  });

  if (!user) {
    return { error: 'User not found', status: 404 as const };
  }

  if (user.role !== 'ADMIN' && !user.vendorProfile) {
    return { error: 'Not a vendor or admin', status: 403 as const };
  }

  return { user };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        subcategory: {
          select: {
            id: true,
            name: true,
          },
        },
        vendor: {
          select: {
            id: true,
            storeName: true,
            description: true,
          },
        },
      },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({ product });
  } catch (error) {
    console.error('Product fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const manager = await getProductManager();

    if ('error' in manager) {
      return NextResponse.json(
        { error: manager.error },
        { status: manager.status }
      );
    }

    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    if (
      manager.user.role !== 'ADMIN' &&
      product.vendorId !== manager.user.vendorProfile?.id
    ) {
      return NextResponse.json(
        { error: 'Product not found or unauthorized' },
        { status: 404 }
      );
    }

    const {
      name,
      description,
      price,
      categoryId,
      subcategoryId,
      sku,
      inventory,
      images,
    } = await request.json();

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price: parseFloat(price) }),
        ...(categoryId !== undefined && { categoryId: categoryId || null }),
        ...(subcategoryId !== undefined && {
          subcategoryId: subcategoryId || null,
        }),
        ...(sku !== undefined && { sku: sku || null }),
        ...(inventory !== undefined && { inventory: parseInt(inventory) }),
        ...(images !== undefined && {
          images: Array.isArray(images) ? images : [],
        }),
      },
      include: {
        category: true,
        subcategory: true,
        vendor: {
          select: {
            id: true,
            storeName: true,
          },
        },
      },
    });

    return NextResponse.json(updatedProduct);
  } catch (error) {
    console.error('Product update error:', error);
    return NextResponse.json(
      { error: 'Failed to update product' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const manager = await getProductManager();

    if ('error' in manager) {
      return NextResponse.json(
        { error: manager.error },
        { status: manager.status }
      );
    }

    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    if (
      manager.user.role !== 'ADMIN' &&
      product.vendorId !== manager.user.vendorProfile?.id
    ) {
      return NextResponse.json(
        { error: 'Product not found or unauthorized' },
        { status: 404 }
      );
    }

    await prisma.product.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Product deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to delete product' },
      { status: 500 }
    );
  }
}
