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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const categoryId = searchParams.get('categoryId');
    const subcategoryId = searchParams.get('subcategoryId');
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

    const where: Record<string, unknown> = {};
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
          { name: { equals: categoryMatch, mode: 'insensitive' } },
          { slug: { equals: categoryMatch, mode: 'insensitive' } },
        ]),
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
      andFilters.push({
        OR: [
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
          {
            sku: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            category: {
              is: {
                name: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            },
          },
          {
            category: {
              is: {
                slug: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            },
          },
          {
            subcategory: {
              is: {
                name: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            },
          },
          {
            vendor: {
              is: {
                storeName: {
                  contains: search,
                  mode: 'insensitive',
                },
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
              contains: brandMatch,
              mode: 'insensitive',
            },
          },
          {
            description: {
              contains: brandMatch,
              mode: 'insensitive',
            },
          },
          {
            vendor: {
              is: {
                storeName: {
                  contains: brandMatch,
                  mode: 'insensitive',
                },
              },
            },
          },
        ]),
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
        'Cache-Control': search || includeOutOfStock || offerOnly || bulkOnly
          ? 'public, s-maxage=30, stale-while-revalidate=120'
          : 'public, s-maxage=120, stale-while-revalidate=300',
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
