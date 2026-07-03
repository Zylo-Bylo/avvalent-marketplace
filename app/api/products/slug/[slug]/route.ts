import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getFallbackProductBySlug,
  shouldUseFallbackCatalog,
} from '@/lib/fallback-catalog';

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;

    const product = await prisma.product.findUnique({
      where: { slug },
      include: {
        vendor: {
          select: {
            storeName: true,
            description: true,
            status: true,
          },
        },
        category: {
          select: {
            name: true,
          },
        },
        reviews: {
          include: {
            user: {
              select: {
                name: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!product || product.vendor?.status !== 'APPROVED') {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({ product });
  } catch (error) {
    console.error('Product fetch error:', error);
    if (shouldUseFallbackCatalog(error)) {
      const { slug } = await params;
      const product = getFallbackProductBySlug(slug);

      if (!product) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      }

      return NextResponse.json({ product });
    }

    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 });
  }
}
