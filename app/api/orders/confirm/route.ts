import Razorpay from 'razorpay';
import Stripe from 'stripe';
import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { sendOrderConfirmationEmail } from '@/lib/email';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/session-cookies';
import { sendOrderWhatsAppNotification } from '@/lib/whatsapp';
import { convertReservedStockToSold } from '@/lib/inventory';

interface ConfirmPayload {
  orderId: string;
  orderIds?: string[];
  paymentMethod: 'RAZORPAY' | 'STRIPE';
  sessionId?: string;
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  razorpaySignature?: string;
}

function getBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://zylo-buylo.com'
  ).replace(/\/$/, '');
}

async function notifyPaidOrders(orderIds: string[]) {
  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds } },
    include: {
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
              name: true,
            },
          },
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
        console.error('Paid order confirmation email failed:', error);
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
          console.error('Paid order WhatsApp notification failed:', error);
        }
      }
    }),
  );
}

async function getAuthenticatedUserId() {
  const session = await getAuthSession();
  return session?.userId || null;
}

function getTargetOrderIds(orderId: string, orderIds?: string[]) {
  return Array.from(new Set(orderIds?.length ? orderIds : [orderId]));
}

function verifyRazorpaySignature(input: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  secret: string;
}) {
  const expected = crypto
    .createHmac('sha256', input.secret)
    .update(`${input.razorpayOrderId}|${input.razorpayPaymentId}`)
    .digest('hex');

  return expected === input.razorpaySignature;
}

async function fetchRazorpayOrderIds(razorpayOrderId: string) {
  const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
  const razorpaySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!razorpayKeyId || !razorpaySecret) {
    throw new Error('Razorpay credentials are not configured');
  }

  const razorpay = new Razorpay({
    key_id: razorpayKeyId,
    key_secret: razorpaySecret,
  });
  const razorpayOrder = (await razorpay.orders.fetch(razorpayOrderId)) as any;
  const ids = String(
    razorpayOrder.notes?.orderIds ||
      razorpayOrder.notes?.orderId ||
      razorpayOrder.receipt ||
      '',
  )
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  return ids;
}

async function loadOrders(orderIds: string[]) {
  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds } },
    include: { items: true },
  });

  if (orders.length !== orderIds.length) {
    return null;
  }

  return orders;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ConfirmPayload;
    const { orderId, orderIds, paymentMethod, sessionId, razorpayPaymentId, razorpayOrderId, razorpaySignature } = body;

    if (!orderId || !paymentMethod) {
      return NextResponse.json({ error: 'Missing confirmation details' }, { status: 400 });
    }

    const userId = await getAuthenticatedUserId();
    const targetOrderIds = getTargetOrderIds(orderId, orderIds);

    if (paymentMethod === 'RAZORPAY') {
      if (!razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
        return NextResponse.json({ error: 'Missing Razorpay payment details' }, { status: 400 });
      }

      const razorpaySecret = process.env.RAZORPAY_KEY_SECRET;
      if (!razorpaySecret) {
        return NextResponse.json({ error: 'Razorpay credentials are not configured' }, { status: 500 });
      }

      if (
        !verifyRazorpaySignature({
          razorpayOrderId,
          razorpayPaymentId,
          razorpaySignature,
          secret: razorpaySecret,
        })
      ) {
        return NextResponse.json({ error: 'Invalid Razorpay signature' }, { status: 400 });
      }

      const razorpayMetadataOrderIds = await fetchRazorpayOrderIds(razorpayOrderId);
      if (
        razorpayMetadataOrderIds.length === 0 ||
        targetOrderIds.some((id) => !razorpayMetadataOrderIds.includes(id))
      ) {
        return NextResponse.json(
          { error: 'Razorpay order does not match this website order.' },
          { status: 400 },
        );
      }

      const orders = await loadOrders(targetOrderIds);
      if (!orders) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }

      if (userId && orders.some((order) => order.userId !== userId)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }

      const order = orders.find((item) => item.id === orderId) || orders[0];
      if (orders.every((item) => item.status === 'PAID')) {
        return NextResponse.json({ order, orders, message: 'Order already paid' }, { status: 200 });
      }

      const updated = await prisma.order.updateMany({
        where: { id: { in: targetOrderIds } },
        data: {
          status: 'PAID',
          paymentId: razorpayPaymentId,
          statusNote: 'Payment received. Vendor can now prepare shipment.',
        },
      });
      if (updated.count > 0) {
        await convertReservedStockToSold(targetOrderIds);
        await notifyPaidOrders(targetOrderIds);
      }
      const updatedOrder = await prisma.order.findUnique({
        where: { id: order.id },
        include: { items: true },
      });

      return NextResponse.json({ order: updatedOrder, message: 'Razorpay payment confirmed' }, { status: 200 });
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orders = await loadOrders(targetOrderIds);
    if (!orders) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (orders.some((order) => order.userId !== userId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const order = orders.find((item) => item.id === orderId) || orders[0];
    if (orders.every((item) => item.status === 'PAID')) {
      return NextResponse.json({ order, orders, message: 'Order already paid' }, { status: 200 });
    }

    if (paymentMethod === 'STRIPE') {
      if (!sessionId) {
        return NextResponse.json({ error: 'Missing Stripe session ID' }, { status: 400 });
      }

      const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeSecretKey) {
        return NextResponse.json({ error: 'Stripe credentials are not configured' }, { status: 500 });
      }

      const stripe = new Stripe(stripeSecretKey, { apiVersion: '2022-11-15' });
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['payment_intent'],
      });

      if (session.payment_status !== 'paid') {
        return NextResponse.json({ error: 'Stripe payment is not complete' }, { status: 400 });
      }

      const sessionOrderIds = String(session.metadata?.orderIds || session.metadata?.orderId || '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);

      if (!sessionOrderIds.includes(order.id)) {
        return NextResponse.json({ error: 'Stripe session does not match this order' }, { status: 400 });
      }

      const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;

      const updated = await prisma.order.updateMany({
        where: { id: { in: targetOrderIds } },
        data: {
          status: 'PAID',
          paymentId: paymentIntentId,
          statusNote: 'Payment received. Vendor can now prepare shipment.',
        },
      });
      if (updated.count > 0) {
        await convertReservedStockToSold(targetOrderIds);
        await notifyPaidOrders(targetOrderIds);
      }
      const updatedOrder = await prisma.order.findUnique({
        where: { id: order.id },
        include: { items: true },
      });

      return NextResponse.json({ order: updatedOrder, message: 'Stripe payment confirmed' }, { status: 200 });
    }

    return NextResponse.json({ error: 'Unsupported payment method' }, { status: 400 });
  } catch (error) {
    console.error('Payment confirmation error:', error);
    return NextResponse.json({ error: 'Failed to confirm payment' }, { status: 500 });
  }
}
