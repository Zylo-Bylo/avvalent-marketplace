import { NextResponse } from 'next/server';
import { ensureCategoryAtelierSchema } from '@/lib/category-atelier-schema';
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
    const requestStartedAt = performance.now();
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');

    const subcategories = await prisma.subcategory.findMany({
      where: categoryId ? { categoryId } : undefined,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        categoryId: true,
        status: true,
        sortOrder: true,
        productTypes: {
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          select: {
            id: true,
            name: true,
            slug: true,
            subcategoryId: true,
            status: true,
            sortOrder: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    const queryFinishedAt = performance.now();
    const body = JSON.stringify({ subcategories });
    const serializationFinishedAt = performance.now();

    return new NextResponse(body, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=30, s-maxage=120, stale-while-revalidate=60',
        'Server-Timing': [
          `db;dur=${(queryFinishedAt - requestStartedAt).toFixed(1)}`,
          `serialize;dur=${(serializationFinishedAt - queryFinishedAt).toFixed(1)}`,
        ].join(', '),
        'X-Catalogue-Payload-Bytes': String(Buffer.byteLength(body)),
      },
    });
  } catch (error) {
    console.error('Subcategory fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch subcategories' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureCategoryAtelierSchema();

    const { name, categoryId, status, sortOrder } = await request.json();

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
        status: status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
        sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
      },
      include: {
        productTypes: true,
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
