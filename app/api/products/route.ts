import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getFallbackProducts,
  shouldUseFallbackCatalog,
} from '@/lib/fallback-catalog';
import { ensureInventorySchema } from '@/lib/inventory';

let inventorySetupPromise: Promise<void> | null = null;

function ensureInventoryReady() {
  if (!inventorySetupPromise) {
    inventorySetupPromise = ensureInventorySchema().catch((error) => {
      inventorySetupPromise = null;
      throw error;
    });
  }

  return inventorySetupPromise;
}

const categoryAliases: Record<string, string[]> = {
  fashion: ['fashion', 'kurti-saree-lehenga', 'women-western', 'men', 'bags-footwear'],
  beauty: ['beauty', 'beauty-health', 'beauty-personal-care'],
  electronics: ['electronics'],
  'home-kitchen': ['home-kitchen', 'home-and-kitchen'],
  'ac-parts': ['ac-parts', 'air-conditioner-parts'],
  'tv-parts': ['tv-parts'],
  'washing-machine-parts': ['washing-machine-parts'],
  'mobile-accessories': ['mobile-accessories', 'mobiles-accessories'],
};

const brandAliases: Record<string, string[]> = {
  samsung: ['samsung'],
  lg: ['lg'],
  whirlpool: ['whirlpool'],
  ifb: ['ifb'],
  haier: ['haier'],
  bajaj: ['bajaj'],
  boat: ['boat'],
  noise: ['noise'],
};

const supportsInsensitiveMode =
  process.env.DATABASE_URL?.startsWith('postgresql://') ||
  process.env.DATABASE_URL?.startsWith('postgres://');

function textEquals(value: string) {
  return supportsInsensitiveMode
    ? { equals: value, mode: 'insensitive' as const }
    : { equals: value };
}

function textContains(value: string) {
  return supportsInsensitiveMode
    ? { contains: value, mode: 'insensitive' as const }
    : { contains: value };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const categoryId = searchParams.get('categoryId');
    const subcategoryId = searchParams.get('subcategoryId');
    const productTypeId = searchParams.get('productTypeId');
    const vendorId = searchParams.get('vendorId');
    const search = searchParams.get('search');
    const brand = searchParams.get('brand');
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    const offerOnly = searchParams.get('offer') === 'true';
    const bulkOnly = searchParams.get('bulk') === 'true';
    const featuredOnly = searchParams.get('featured') === 'true';
    const includeOutOfStock = searchParams.get('includeOutOfStock') === 'true';
    const includeInventoryDetails = searchParams.get('includeInventoryDetails') === 'true';
    const sort = searchParams.get('sort') || 'newest';
    const requestedLimit = parseInt(searchParams.get('limit') || '24', 10);
    const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 24, 1), 48);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0);

    await ensureInventoryReady();

    const where: Record<string, unknown> = {
      vendor: {
        is: {
          status: 'APPROVED',
        },
      },
    };
    const andFilters: Record<string, unknown>[] = [];

    if (bulkOnly) {
      where.inventory = {
        gte: 10,
      };
    } else if (!includeOutOfStock) {
      where.inventory = {
        gt: 0,
      };
    }

    if (category) {
      const categoryKey = category.toLowerCase();
      const categoryMatches = categoryAliases[categoryKey] || [category];
      where.category = {
        OR: categoryMatches.flatMap((categoryMatch) => [
          { name: textEquals(categoryMatch) },
          { slug: textEquals(categoryMatch) },
        ]),
      };
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (subcategoryId) {
      where.subcategoryId = subcategoryId;
    }

    if (productTypeId) {
      where.productTypeId = productTypeId;
    }

    if (vendorId) {
      where.vendorId = vendorId;
    }

    if (search) {
      andFilters.push({
        OR: [
          {
            name: {
              ...textContains(search),
            },
          },
          {
            description: {
              ...textContains(search),
            },
          },
          {
            sku: {
              ...textContains(search),
            },
          },
          {
            category: {
              is: {
                name: textContains(search),
              },
            },
          },
          {
            category: {
              is: {
                slug: textContains(search),
              },
            },
          },
          {
            subcategory: {
              is: {
                name: textContains(search),
              },
            },
          },
          {
            vendor: {
              is: {
                storeName: textContains(search),
              },
            },
          },
        ],
      });
    }

    if (brand) {
      const brandKey = brand.toLowerCase();
      const brandMatches = brandAliases[brandKey] || [brand];
      andFilters.push({
        OR: brandMatches.flatMap((brandMatch) => [
          {
            name: {
              ...textContains(brandMatch),
            },
          },
          {
            description: {
              ...textContains(brandMatch),
            },
          },
          {
            vendor: {
              is: {
                storeName: textContains(brandMatch),
              },
            },
          },
        ]),
      });
    }

    const knownParams = new Set([
      'category',
      'categoryId',
      'subcategoryId',
      'productTypeId',
      'vendorId',
      'search',
      'brand',
      'minPrice',
      'maxPrice',
      'offer',
      'bulk',
      'featured',
      'includeOutOfStock',
      'includeInventoryDetails',
      'sort',
      'limit',
      'offset',
      'price',
      'discount',
      'allDiscount',
    ]);
    for (const [key, value] of searchParams.entries()) {
      const trimmedValue = value.trim();
      if (!trimmedValue || knownParams.has(key)) continue;

      andFilters.push({
        OR: [
          { name: { ...textContains(trimmedValue) } },
          { description: { ...textContains(trimmedValue) } },
          { sku: { ...textContains(trimmedValue) } },
        ],
      });
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

    if (offerOnly) {
      where.discountPercent = {
        gt: 0,
      };
    }

    if (andFilters.length > 0) {
      where.AND = andFilters;
    }

    const orderBy =
      sort === 'new'
        ? { createdAt: 'desc' as const }
        : sort === 'popular' || sort === 'trending' || featuredOnly
          ? { inventory: 'desc' as const }
          : sort === 'price-asc'
            ? { price: 'asc' as const }
            : sort === 'price-desc'
              ? { price: 'desc' as const }
              : sort === 'stock-low'
                ? { inventory: 'asc' as const }
                : { createdAt: 'desc' as const };

    const productSelect = {
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
      ...(includeInventoryDetails
        ? {
            inventories: {
              select: {
                availableStock: true,
                lowStockThreshold: true,
                criticalStockThreshold: true,
                stockStatus: true,
                allowBackorder: true,
                isPreOrder: true,
              },
            },
          }
        : {}),
      vendor: {
        select: {
          id: true,
          storeName: true,
        },
      },
    };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        select: productSelect,
        orderBy,
        take: limit,
        skip: offset,
      }),
      prisma.product.count({ where }),
    ]);

    return NextResponse.json({
      products,
      total,
      hasMore: offset + limit < total,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
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
