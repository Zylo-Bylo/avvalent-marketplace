import Razorpay from 'razorpay';
import Stripe from 'stripe';
import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface ConfirmPayload {
  orderId: string;
  paymentMethod: 'RAZORPAY' | 'STRIPE';
  sessionId?: string;
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  razorpaySignature?: string;
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = verifyToken(token);
    if (!data || typeof data !== 'object' || !data.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = (await request.json()) as ConfirmPayload;
    const { orderId, paymentMethod, sessionId, razorpayPaymentId, razorpayOrderId, razorpaySignature } = body;

    if (!orderId || !paymentMethod) {
      return NextResponse.json({ error: 'Missing confirmation details' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.userId !== String(data.userId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (order.status === 'PAID') {
      return NextResponse.json({ order, message: 'Order already paid' }, { status: 200 });
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

      const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;

      const updatedOrder = await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'PAID',
          paymentId: paymentIntentId,
        },
      });

      return NextResponse.json({ order: updatedOrder, message: 'Stripe payment confirmed' }, { status: 200 });
    }

    if (paymentMethod === 'RAZORPAY') {
      if (!razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
        return NextResponse.json({ error: 'Missing Razorpay payment details' }, { status: 400 });
      }

      const razorpaySecret = process.env.RAZORPAY_KEY_SECRET;
      if (!razorpaySecret) {
        return NextResponse.json({ error: 'Razorpay credentials are not configured' }, { status: 500 });
      }

      const expected = crypto
        .createHmac('sha256', razorpaySecret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');

      if (expected !== razorpaySignature) {
        return NextResponse.json({ error: 'Invalid Razorpay signature' }, { status: 400 });
      }

      const updatedOrder = await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'PAID',
          paymentId: razorpayPaymentId,
        },
      });

      return NextResponse.json({ order: updatedOrder, message: 'Razorpay payment confirmed' }, { status: 200 });
    }

    return NextResponse.json({ error: 'Unsupported payment method' }, { status: 400 });
  } catch (error) {
    console.error('Payment confirmation error:', error);
    return NextResponse.json({ error: 'Failed to confirm payment' }, { status: 500 });
  }
}
