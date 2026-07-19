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
    const { name, categoryId } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Subcategory name is required' }, { status: 400 });
    }

    const subcategory = await prisma.subcategory.update({
      where: { id },
      data: {
        name: name.trim(),
        slug: body.slug ? slugify(body.slug) : `${slugify(name) || 'subcategory'}-${Date.now()}`,
        ...(categoryId ? { categoryId } : {}),
        ...(body.status ? { status: body.status } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: Number(body.sortOrder) || 0 } : {}),
        ...(body.homepageIcon !== undefined ? { homepageIcon: body.homepageIcon || null } : {}),
        ...(body.categoryImage !== undefined ? { categoryImage: body.categoryImage || null } : {}),
        ...(body.desktopBanner !== undefined ? { desktopBanner: body.desktopBanner || null } : {}),
        ...(body.mobileBanner !== undefined ? { mobileBanner: body.mobileBanner || null } : {}),
        ...(body.altText !== undefined ? { altText: body.altText || null } : {}),
      },
      include: {
        productTypes: {
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({ subcategory });
  } catch (error) {
    console.error('Subcategory update error:', error);
    return NextResponse.json({ error: 'Subcategory could not be updated' }, { status: 500 });
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
        where: { subcategoryId: id },
        data: { subcategoryId: null },
      }),
      prisma.subcategory.delete({
        where: { id },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Subcategory deletion error:', error);
    return NextResponse.json({ error: 'Subcategory could not be deleted' }, { status: 500 });
  }
}
