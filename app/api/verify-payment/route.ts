import crypto from 'crypto';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type VerifyPaymentBody = {
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as VerifyPaymentBody;
  const {
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
    razorpay_signature: signature,
  } = body;

  if (!orderId || !paymentId || !signature) {
    return NextResponse.json(
      { error: 'Missing Razorpay payment verification fields.' },
      { status: 400 }
    );
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    return NextResponse.json(
      { error: 'Razorpay secret is not configured.' },
      { status: 500 }
    );
  }

  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  if (expectedSignature !== signature) {
    return NextResponse.json(
      { error: 'Invalid Razorpay signature.' },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    order_id: orderId,
    payment_id: paymentId,
  });
}
