import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getFallbackCategories,
  shouldUseFallbackCatalog,
} from '@/lib/fallback-catalog';
import { ensureCategoryAtelierSchema } from '@/lib/category-atelier-schema';

type CachedCategory = {
  id: string;
  name: string;
  slug: string;
  entityType?: string;
  parentId?: string | null;
  status?: string;
  sortOrder?: number;
  homepageVisible?: boolean;
  homepageIcon?: string | null;
  categoryImage?: string | null;
  desktopBanner?: string | null;
  mobileBanner?: string | null;
  homepageIconUrl?: string | null;
  categoryImageUrl?: string | null;
  desktopBannerUrl?: string | null;
  mobileBannerUrl?: string | null;
  altText?: string | null;
  children?: CachedCategory['subcategories'];
  subcategories: Array<{
    id: string;
    name: string;
    slug: string;
    entityType?: string;
    parentId?: string | null;
    status?: string;
    sortOrder?: number;
    homepageVisible?: boolean;
    homepageIcon?: string | null;
    categoryImage?: string | null;
    desktopBanner?: string | null;
    mobileBanner?: string | null;
    homepageIconUrl?: string | null;
    categoryImageUrl?: string | null;
    desktopBannerUrl?: string | null;
    mobileBannerUrl?: string | null;
    altText?: string | null;
    productTypes?: Array<{
      id: string;
      name: string;
      slug: string;
      entityType?: string;
      parentId?: string | null;
      status?: string;
      sortOrder?: number;
      homepageVisible?: boolean;
      homepageIcon?: string | null;
      categoryImage?: string | null;
      desktopBanner?: string | null;
      mobileBanner?: string | null;
      homepageIconUrl?: string | null;
      categoryImageUrl?: string | null;
      desktopBannerUrl?: string | null;
      mobileBannerUrl?: string | null;
      altText?: string | null;
    }>;
  }>;
};

let cachedCategories: { expiresAt: number; payload: { categories: CachedCategory[] } } | null = null;
const CATEGORY_CACHE_TTL_MS = 30 * 1000;

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function GET() {
  try {
    await ensureCategoryAtelierSchema();

    const categories = await prisma.category.findMany({
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
        archivedAt: true,
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
            archivedAt: true,
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
                archivedAt: true,
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

    const publicCategories = categories.map((category) => ({
      ...category,
      entityType: 'category',
      parentId: null,
      homepageVisible: true,
      homepageIconUrl: category.homepageIcon,
      categoryImageUrl: category.categoryImage,
      desktopBannerUrl: category.desktopBanner,
      mobileBannerUrl: category.mobileBanner,
      children: category.subcategories.map((subcategory) => ({
        ...subcategory,
        entityType: 'subcategory',
        parentId: subcategory.categoryId,
        homepageVisible: true,
        homepageIconUrl: subcategory.homepageIcon,
        categoryImageUrl: subcategory.categoryImage,
        desktopBannerUrl: subcategory.desktopBanner,
        mobileBannerUrl: subcategory.mobileBanner,
        productTypes: subcategory.productTypes?.map((productType) => ({
          ...productType,
          entityType: 'productType',
          parentId: productType.subcategoryId,
          homepageVisible: true,
          homepageIconUrl: productType.homepageIcon,
          categoryImageUrl: productType.categoryImage,
          desktopBannerUrl: productType.desktopBanner,
          mobileBannerUrl: productType.mobileBanner,
        })) || [],
      })),
      subcategories: category.subcategories.map((subcategory) => ({
        ...subcategory,
        entityType: 'subcategory',
        parentId: subcategory.categoryId,
        homepageVisible: true,
        homepageIconUrl: subcategory.homepageIcon,
        categoryImageUrl: subcategory.categoryImage,
        desktopBannerUrl: subcategory.desktopBanner,
        mobileBannerUrl: subcategory.mobileBanner,
        productTypes: subcategory.productTypes?.map((productType) => ({
          ...productType,
          entityType: 'productType',
          parentId: productType.subcategoryId,
          homepageVisible: true,
          homepageIconUrl: productType.homepageIcon,
          categoryImageUrl: productType.categoryImage,
          desktopBannerUrl: productType.desktopBanner,
          mobileBannerUrl: productType.mobileBanner,
        })) || [],
      })),
    }));

    cachedCategories = {
      expiresAt: Date.now() + CATEGORY_CACHE_TTL_MS,
      payload: { categories: publicCategories },
    };

    return NextResponse.json(cachedCategories.payload, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
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

    cachedCategories = null;

    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    console.error('Category creation error:', error);
    return NextResponse.json({ error: 'Category could not be created' }, { status: 500 });
  }
}
