import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const sort = searchParams.get('sort') || 'newest';
    const categoryId = searchParams.get('categoryId') || '';
    const minPrice = searchParams.get('minPrice') || '';
    const maxPrice = searchParams.get('maxPrice') || '';

    const vendor = await prisma.vendor.findUnique({
      where: { id },
      select: {
        id: true,
        storeName: true,
        description: true,
        logoUrl: true,
        businessCategory: true,
        deliveryArea: true,
        status: true,
        _count: {
          select: {
            products: true,
            orders: true,
          },
        },
      },
    });

    if (!vendor || vendor.status !== 'APPROVED') {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
    }

    const where: any = {
      vendorId: id,
      inventory: { gt: 0 },
    };

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) {
        where.price.gte = Number(minPrice);
      }
      if (maxPrice) {
        where.price.lte = Number(maxPrice);
      }
    }

    const orderBy =
      sort === 'price-asc'
        ? { price: 'asc' as const }
        : sort === 'price-desc'
          ? { price: 'desc' as const }
          : { createdAt: 'desc' as const };

    const products = await prisma.product.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        subcategory: { select: { id: true, name: true } },
        vendor: { select: { id: true, storeName: true } },
        _count: { select: { reviews: true } },
      },
      orderBy,
      take: 120,
    });

    const categories = await prisma.category.findMany({
      where: {
        products: {
          some: {
            vendorId: id,
            inventory: { gt: 0 },
          },
        },
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      vendor,
      products,
      categories,
    });
  } catch (error) {
    console.error('Public vendor shop fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch shop' }, { status: 500 });
  }
}
