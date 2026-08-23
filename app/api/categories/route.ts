import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getFallbackCategories,
  shouldUseFallbackCatalog,
} from '@/lib/fallback-catalog';
import { ensureCategoryAtelierSchema } from '@/lib/category-atelier-schema';

const PUBLIC_CATEGORY_CACHE_CONTROL =
  'public, max-age=30, s-maxage=120, stale-while-revalidate=60';

function publicImageUrl(value: string | null | undefined) {
  const normalized = value?.trim() || '';
  return /^(blob|data):/i.test(normalized) ? '' : normalized;
}

type CategoryReadRow = Awaited<ReturnType<typeof readPublicCategories>>[number];

async function readPublicCategories() {
  return prisma.category.findMany({
    where: {
      status: 'ACTIVE',
      archivedAt: null,
    },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      sortOrder: true,
      homepageIcon: true,
      categoryImage: true,
      desktopBanner: true,
      mobileBanner: true,
      altText: true,
      subcategories: {
        where: {
          status: 'ACTIVE',
          archivedAt: null,
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          sortOrder: true,
          homepageIcon: true,
          categoryImage: true,
          desktopBanner: true,
          mobileBanner: true,
          altText: true,
          categoryId: true,
          productTypes: {
            where: {
              status: 'ACTIVE',
              archivedAt: null,
            },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
            select: {
              id: true,
              name: true,
              slug: true,
              status: true,
              sortOrder: true,
              homepageIcon: true,
              categoryImage: true,
              desktopBanner: true,
              mobileBanner: true,
              altText: true,
              subcategoryId: true,
            },
          },
        },
      },
    },
  });
}

function compactPublicCategories(categories: CategoryReadRow[]) {
  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    entityType: 'category' as const,
    parentId: null,
    status: category.status,
    sortOrder: category.sortOrder,
    homepageVisible: true,
    homepageIconUrl: publicImageUrl(category.homepageIcon),
    categoryImageUrl: publicImageUrl(category.categoryImage),
    desktopBannerUrl: publicImageUrl(category.desktopBanner),
    mobileBannerUrl: publicImageUrl(category.mobileBanner),
    altText: category.altText || category.name,
    subcategories: category.subcategories.map((subcategory) => ({
      id: subcategory.id,
      name: subcategory.name,
      slug: subcategory.slug,
      entityType: 'subcategory' as const,
      parentId: subcategory.categoryId,
      categoryId: subcategory.categoryId,
      status: subcategory.status,
      sortOrder: subcategory.sortOrder,
      homepageVisible: true,
      homepageIconUrl: publicImageUrl(subcategory.homepageIcon),
      categoryImageUrl: publicImageUrl(subcategory.categoryImage),
      desktopBannerUrl: publicImageUrl(subcategory.desktopBanner),
      mobileBannerUrl: publicImageUrl(subcategory.mobileBanner),
      altText: subcategory.altText || subcategory.name,
      productTypes: subcategory.productTypes.map((productType) => ({
        id: productType.id,
        name: productType.name,
        slug: productType.slug,
        entityType: 'productType' as const,
        parentId: productType.subcategoryId,
        subcategoryId: productType.subcategoryId,
        status: productType.status,
        sortOrder: productType.sortOrder,
        homepageVisible: true,
        homepageIconUrl: publicImageUrl(productType.homepageIcon),
        categoryImageUrl: publicImageUrl(productType.categoryImage),
        desktopBannerUrl: publicImageUrl(productType.desktopBanner),
        mobileBannerUrl: publicImageUrl(productType.mobileBanner),
        altText: productType.altText || productType.name,
      })),
    })),
  }));
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function GET(request: Request) {
  try {
    const requestStartedAt = performance.now();
    const categories = await readPublicCategories();
    const queryFinishedAt = performance.now();
    const publicCategories = compactPublicCategories(categories);
    const transformFinishedAt = performance.now();
    const body = JSON.stringify({ categories: publicCategories });
    const serializationFinishedAt = performance.now();
    const forceFresh = new URL(request.url).searchParams.get('fresh') === '1';

    return new NextResponse(body, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': forceFresh
          ? 'private, no-store'
          : PUBLIC_CATEGORY_CACHE_CONTROL,
        'Server-Timing': [
          `db;dur=${(queryFinishedAt - requestStartedAt).toFixed(1)}`,
          `transform;dur=${(transformFinishedAt - queryFinishedAt).toFixed(1)}`,
          `serialize;dur=${(serializationFinishedAt - transformFinishedAt).toFixed(1)}`,
        ].join(', '),
        'X-Catalogue-Payload-Bytes': String(Buffer.byteLength(body)),
      },
    });
  } catch (error) {
    console.error('Categories fetch error:', error);
    if (shouldUseFallbackCatalog(error)) {
      return NextResponse.json({ categories: getFallbackCategories() });
    }

    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureCategoryAtelierSchema();

    const { name, status, sortOrder } = await request.json();

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
    }

    const baseSlug = slugify(name);
    const slug = baseSlug || `category-${Date.now()}`;
    const trimmedName = name.trim();

    const existingCategory = await prisma.category.findFirst({
      where: {
        OR: [{ name: trimmedName }, { slug }],
      },
      select: { id: true },
    });

    if (existingCategory) {
      return NextResponse.json({ error: 'Category already exists' }, { status: 409 });
    }

    const category = await prisma.category.create({
      data: {
        name: trimmedName,
        slug,
        status: status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
        sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
      },
      include: {
        subcategories: {
          orderBy: { name: 'asc' },
        },
      },
    });

    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    console.error('Category creation error:', error);
    return NextResponse.json({ error: 'Category could not be created' }, { status: 500 });
  }
}
