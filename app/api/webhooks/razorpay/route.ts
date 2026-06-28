import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { notifyOrderPlaced } from '@/lib/order-notifications';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

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
      await notifyOrderPlaced(orderIds, 'Razorpay webhook order');
    }

    return NextResponse.json({ status: 'success' }, { status: 200 });
  }

  return NextResponse.json({ status: 'ignored', event: eventType }, { status: 200 });
}
