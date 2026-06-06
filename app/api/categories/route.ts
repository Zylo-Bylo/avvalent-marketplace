import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getFallbackCategories,
  shouldUseFallbackCatalog,
} from '@/lib/fallback-catalog';

type CachedCategory = {
  id: string;
  name: string;
  slug: string;
  subcategories: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
};

let cachedCategories: { expiresAt: number; payload: { categories: CachedCategory[] } } | null = null;
const CATEGORY_CACHE_TTL_MS = 5 * 60 * 1000;

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function GET() {
  try {
    if (cachedCategories && cachedCategories.expiresAt > Date.now()) {
      return NextResponse.json(cachedCategories.payload);
    }

    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        subcategories: {
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            slug: true,
            categoryId: true,
          },
        },
      },
    });

    cachedCategories = {
      expiresAt: Date.now() + CATEGORY_CACHE_TTL_MS,
      payload: { categories },
    };

    return NextResponse.json(cachedCategories.payload, {
      headers: {
        'Cache-Control': 'private, max-age=60',
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
    const { name } = await request.json();

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
