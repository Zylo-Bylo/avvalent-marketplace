import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getFallbackProducts,
  shouldUseFallbackCatalog,
} from '@/lib/fallback-catalog';
import { ensureInventoryTables } from '@/lib/inventory';

let inventorySetupPromise: Promise<void> | null = null;

function ensureInventoryReady() {
  if (!inventorySetupPromise) {
    inventorySetupPromise = ensureInventoryTables().catch((error) => {
      inventorySetupPromise = null;
      throw error;
    });
  }

  return inventorySetupPromise;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const categoryId = searchParams.get('categoryId');
    const subcategoryId = searchParams.get('subcategoryId');
    const vendorId = searchParams.get('vendorId');
    const search = searchParams.get('search');
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    const includeOutOfStock = searchParams.get('includeOutOfStock') === 'true';
    const sort = searchParams.get('sort') || 'newest';
    const requestedLimit = parseInt(searchParams.get('limit') || '40', 10);
    const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 40, 1), 60);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0);

    await ensureInventoryReady();

    const where: Record<string, unknown> = {};

    if (!includeOutOfStock) {
      where.inventory = {
        gt: 0,
      };
    }

    if (category) {
      where.category = {
        name: {
          equals: category,
          mode: 'insensitive',
        },
      };
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (subcategoryId) {
      where.subcategoryId = subcategoryId;
    }

    if (vendorId) {
      where.vendorId = vendorId;
    }

    if (search) {
      where.OR = [
        {
          name: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          description: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }

    if (minPrice || maxPrice) {
      const priceFilter: { gte?: number; lte?: number } = {};

      if (minPrice) {
        priceFilter.gte = Number(minPrice);
      }

      if (maxPrice) {
        priceFilter.lte = Number(maxPrice);
      }

      where.price = priceFilter;
    }

    const orderBy =
      sort === 'price-asc'
        ? { price: 'asc' as const }
        : sort === 'price-desc'
          ? { price: 'desc' as const }
          : sort === 'stock-low'
            ? { inventory: 'asc' as const }
            : { createdAt: 'desc' as const };

    const products = await prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        mrp: true,
        discountPercent: true,
        inventory: true,
        images: true,
        categoryId: true,
        subcategoryId: true,
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
        inventories: true,
        vendor: {
          select: {
            id: true,
            storeName: true,
          },
        },
      },
      orderBy,
      take: limit,
      skip: offset,
    });

    const total = await prisma.product.count({ where });

    return NextResponse.json({
      products,
      total,
      hasMore: offset + limit < total,
    });
  } catch (error) {
    console.error('Products fetch error:', error);
    if (shouldUseFallbackCatalog(error)) {
      const { searchParams } = new URL(request.url);
      return NextResponse.json(getFallbackProducts(searchParams));
    }

    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}
