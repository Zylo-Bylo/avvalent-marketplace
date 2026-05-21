import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');

    const subcategories = await prisma.subcategory.findMany({
      where: categoryId ? { categoryId } : undefined,
      orderBy: { name: 'asc' },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({ subcategories });
  } catch (error) {
    console.error('Subcategory fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch subcategories' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name, categoryId } = await request.json();

    if (!name || typeof name !== 'string' || !categoryId) {
      return NextResponse.json({ error: 'Subcategory name and category are required' }, { status: 400 });
    }

    const baseSlug = slugify(name);
    const trimmedName = name.trim();
    const existingSubcategory = await prisma.subcategory.findFirst({
      where: {
        categoryId,
        name: trimmedName,
      },
      select: { id: true },
    });

    if (existingSubcategory) {
      return NextResponse.json({ error: 'Subcategory already exists in this category' }, { status: 409 });
    }

    const subcategory = await prisma.subcategory.create({
      data: {
        name: trimmedName,
        slug: `${baseSlug || 'subcategory'}-${Date.now()}`,
        categoryId,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({ subcategory }, { status: 201 });
  } catch (error) {
    console.error('Subcategory creation error:', error);
    return NextResponse.json({ error: 'Subcategory could not be created' }, { status: 500 });
  }
}
