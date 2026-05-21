import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function GET() {
  try {
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

    return NextResponse.json({ categories });
  } catch (error) {
    console.error('Categories fetch error:', error);
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

    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    console.error('Category creation error:', error);
    return NextResponse.json({ error: 'Category could not be created' }, { status: 500 });
  }
}
