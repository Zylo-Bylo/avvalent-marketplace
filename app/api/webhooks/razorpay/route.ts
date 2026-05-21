import crypto from 'crypto';
import { NextResponse } from 'next/server';
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

  if (eventType === 'payment.captured') {
    const paymentEntity = body.payload?.payment?.entity;
    const orderId = paymentEntity?.notes?.orderId;
    const paymentId = paymentEntity?.id;

    if (!orderId) {
      return NextResponse.json({ error: 'Order metadata missing' }, { status: 400 });
    }

    await prisma.order.updateMany({
      where: {
        id: orderId,
        status: 'PENDING',
      },
      data: {
        status: 'PAID',
        paymentId,
      },
    });

    return NextResponse.json({ status: 'success' }, { status: 200 });
  }

  return NextResponse.json({ status: 'ignored', event: eventType }, { status: 200 });
}
