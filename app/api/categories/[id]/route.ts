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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureCategoryAtelierSchema();

    const { id } = await params;
    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
    }

    const category = await prisma.category.update({
      where: { id },
      data: {
        name: name.trim(),
        slug: body.slug ? slugify(body.slug) : slugify(name) || `category-${Date.now()}`,
        ...(body.status ? { status: body.status } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: Number(body.sortOrder) || 0 } : {}),
        ...(body.homepageIcon !== undefined ? { homepageIcon: body.homepageIcon || null } : {}),
        ...(body.categoryImage !== undefined ? { categoryImage: body.categoryImage || null } : {}),
        ...(body.desktopBanner !== undefined ? { desktopBanner: body.desktopBanner || null } : {}),
        ...(body.mobileBanner !== undefined ? { mobileBanner: body.mobileBanner || null } : {}),
        ...(body.altText !== undefined ? { altText: body.altText || null } : {}),
      },
      include: {
        subcategories: {
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          include: {
            productTypes: {
              orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
            },
          },
        },
      },
    });

    return NextResponse.json({ category });
  } catch (error) {
    console.error('Category update error:', error);
    return NextResponse.json({ error: 'Category could not be updated' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureCategoryAtelierSchema();

    const { id } = await params;
    const { searchParams } = new URL(request.url);

    if (searchParams.get('confirmed') !== 'true') {
      return NextResponse.json(
        { error: 'Delete confirmation is required' },
        { status: 400 },
      );
    }

    await prisma.$transaction([
      prisma.product.updateMany({
        where: { categoryId: id },
        data: {
          categoryId: null,
          subcategoryId: null,
        },
      }),
      prisma.subcategory.deleteMany({
        where: { categoryId: id },
      }),
      prisma.category.delete({
        where: { id },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Category deletion error:', error);
    return NextResponse.json({ error: 'Category could not be deleted' }, { status: 500 });
  }
}
