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
    const { name, categoryId } = await request.json();

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Subcategory name is required' }, { status: 400 });
    }

    const subcategory = await prisma.subcategory.update({
      where: { id },
      data: {
        name: name.trim(),
        slug: `${slugify(name) || 'subcategory'}-${Date.now()}`,
        ...(categoryId ? { categoryId } : {}),
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
    const { id } = await params;

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
