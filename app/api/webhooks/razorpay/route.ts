import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { sendOrderConfirmationEmail } from '@/lib/email';
import { prisma } from '@/lib/prisma';
import { sendOrderWhatsAppNotification } from '@/lib/whatsapp';

export const runtime = 'nodejs';

function getBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://zylo-buylo.com'
  ).replace(/\/$/, '');
}

async function notifyOrders(orderIds: string[]) {
  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds } },
    include: {
      user: { select: { name: true, email: true } },
      items: {
        include: {
          product: { select: { name: true } },
        },
      },
    },
  });

  await Promise.all(
    orders.map(async (order) => {
      const items = order.items.map((item) => ({
        name: item.product?.name || item.productId,
        quantity: item.quantity,
        price: item.price,
      }));

      try {
        await sendOrderConfirmationEmail({
          to: order.user.email,
          customerName: order.user.name,
          orderId: order.id,
          totalAmount: order.totalAmount,
          paymentMethod: order.paymentMethod,
          status: order.status,
          orderUrl: `${getBaseUrl()}/order/${order.id}`,
          items,
        });
      } catch (error) {
        console.error('Razorpay webhook order email failed:', error);
      }

      if (order.shippingPhone) {
        try {
          await sendOrderWhatsAppNotification({
            to: order.shippingPhone,
            customerName: order.user.name,
            orderId: order.id,
            totalAmount: order.totalAmount,
          });
        } catch (error) {
          console.error('Razorpay webhook WhatsApp failed:', error);
        }
      }
    }),
  );
}

export async function POST(request: Request) {
  const razorpayWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!razorpayWebhookSecret) {
    return NextResponse.json({ error: 'Razorpay webhook secret not configured' }, { status: 500 });
  }

  const payload = await request.text();
  const signature = request.headers.get('x-razorpay-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing Razorpay signature header' }, { status: 400 });
  }

  const expectedSignature = crypto
    .createHmac('sha256', razorpayWebhookSecret)
    .update(payload)
    .digest('hex');

  if (expectedSignature !== signature) {
    console.error('Razorpay webhook signature mismatch');
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
  }

  const body = JSON.parse(payload);
  const eventType = body.event;

  if (eventType === 'payment.captured' || eventType === 'order.paid') {
    const paymentEntity = body.payload?.payment?.entity;
    const orderEntity = body.payload?.order?.entity;
    const orderId =
      paymentEntity?.notes?.orderId ||
      orderEntity?.notes?.orderId ||
      orderEntity?.receipt;
    const orderIds = String(
      paymentEntity?.notes?.orderIds || orderEntity?.notes?.orderIds || orderId || '',
    )
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    const paymentId = paymentEntity?.id;

    if (!orderIds.length) {
      return NextResponse.json({ error: 'Order metadata missing' }, { status: 400 });
    }

    const updated = await prisma.order.updateMany({
      where: {
        id: { in: orderIds },
        status: 'PENDING',
      },
      data: {
        status: 'PAID',
        paymentId: paymentId || undefined,
        statusNote: 'Payment received. Vendor can now prepare shipment.',
      },
    });

    if (updated.count > 0) {
      await notifyOrders(orderIds);
    }

    return NextResponse.json({ status: 'success' }, { status: 200 });
  }

  return NextResponse.json({ status: 'ignored', event: eventType }, { status: 200 });
}
