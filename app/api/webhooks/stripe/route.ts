import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { notifyOrderPlaced } from '@/lib/order-notifications';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeWebhookSecret) {
    return NextResponse.json({ error: 'Stripe webhook secret not configured' }, { status: 500 });
  }

  const payload = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing Stripe signature header' }, { status: 400 });
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return NextResponse.json({ error: 'Stripe secret key not configured' }, { status: 500 });
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2022-11-15' });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, stripeWebhookSecret);
  } catch (error) {
    console.error('Stripe webhook signature verification failed:', error);
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId;
    const orderIds = String(session.metadata?.orderIds || orderId || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    const paymentStatus = session.payment_status;
    const paymentIntent = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;

    if (!orderIds.length) {
      return NextResponse.json({ error: 'Order metadata missing' }, { status: 400 });
    }

    if (paymentStatus !== 'paid') {
      return NextResponse.json({ status: 'ignored', message: 'Checkout session not paid' }, { status: 200 });
    }

    const updatedOrder = await prisma.order.updateMany({
      where: {
        id: { in: orderIds },
        status: 'PENDING',
      },
      data: {
        status: 'PAID',
        paymentId: paymentIntent ?? undefined,
        statusNote: 'Payment received. Vendor can now prepare shipment.',
      },
    });

    if (updatedOrder.count > 0) {
      await notifyOrderPlaced(orderIds, 'Stripe webhook order');
    }

    return NextResponse.json({ status: 'success', updated: updatedOrder.count }, { status: 200 });
  }

  return NextResponse.json({ status: 'ignored', event: event.type }, { status: 200 });
}
