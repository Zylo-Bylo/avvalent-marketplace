import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/session-cookies';

async function getVendorUserId() {
  const session = await getAuthSession();
  if (!session?.userId) {
    return { error: 'Unauthorized', status: 401 as const };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      role: true,
      vendorProfile: { select: { id: true } },
    },
  });

  if (!user || user.role !== 'VENDOR' || !user.vendorProfile) {
    return { error: 'Vendor access required', status: 403 as const };
  }

  return { userId: user.id };
}

export async function GET() {
  const auth = await getVendorUserId();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const notifications = await prisma.notification.findMany({
    where: { userId: auth.userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return NextResponse.json({
    notifications,
    unreadCount: notifications.filter((notification) => !notification.read).length,
  });
}

export async function POST(request: Request) {
  const auth = await getVendorUserId();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => ({}));
  const notificationId = String(body.notificationId || '');

  if (notificationId) {
    await prisma.notification.updateMany({
      where: { id: notificationId, userId: auth.userId },
      data: { read: true },
    });
  } else {
    await prisma.notification.updateMany({
      where: { userId: auth.userId, read: false },
      data: { read: true },
    });
  }

  const notifications = await prisma.notification.findMany({
    where: { userId: auth.userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return NextResponse.json({
    message: 'Notifications updated.',
    notifications,
    unreadCount: notifications.filter((notification) => !notification.read).length,
  });
}
