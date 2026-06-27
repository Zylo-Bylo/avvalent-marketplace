import { NextResponse } from 'next/server';
import { verifyOrderAccessToken } from '@/lib/order-access-token';
import { getAuthSession } from '@/lib/session-cookies';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getAuthSession();
    const orderAccess = verifyOrderAccessToken(
      request.headers.get('x-order-access-token'),
    );

    if (!session && !orderAccess?.orderIds.includes(id)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        vendor: {
          select: {
            storeName: true,
          },
        },
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                images: true,
                sku: true,
                category: {
                  select: {
                    name: true,
                  },
                },
                subcategory: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Check if user is the order owner or the vendor
    if (orderAccess?.orderIds.includes(order.id)) {
      return NextResponse.json({ order });
    }

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (order.userId !== session.userId && order.vendorId) {
      const vendor = await prisma.vendor.findUnique({
        where: { id: order.vendorId },
      });

      if (vendor?.userId !== session.userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
    }

    return NextResponse.json({ order });
  } catch (error) {
    console.error('Order fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 });
  }
}
