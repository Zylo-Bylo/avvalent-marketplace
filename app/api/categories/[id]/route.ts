import { NextResponse } from 'next/server';
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
    const { id } = await params;
    const { name } = await request.json();

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
    }

    const category = await prisma.category.update({
      where: { id },
      data: {
        name: name.trim(),
        slug: slugify(name) || `category-${Date.now()}`,
      },
      include: {
        subcategories: {
          orderBy: { name: 'asc' },
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
    const { id } = await params;

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
