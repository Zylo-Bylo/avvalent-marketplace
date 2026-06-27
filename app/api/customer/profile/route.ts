import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/session-cookies';

async function getCurrentUserId() {
  const session = await getAuthSession();
  return session?.userId || null;
}

export async function GET() {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        emailVerified: true,
        createdAt: true,
        _count: {
          select: {
            orders: true,
            wishlist: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Customer profile fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const avatarUrl = typeof body.avatarUrl === 'string' ? body.avatarUrl.trim() : '';

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        name,
        avatarUrl: avatarUrl || null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        emailVerified: true,
        createdAt: true,
        _count: {
          select: {
            orders: true,
            wishlist: true,
          },
        },
      },
    });

    return NextResponse.json({ user, message: 'Profile updated.' });
  } catch (error) {
    console.error('Customer profile update error:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
