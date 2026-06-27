import Razorpay from 'razorpay';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type CreateOrderBody = {
  amount?: number;
  currency?: string;
  receipt?: string;
};

function getRazorpayClient() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return null;
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as CreateOrderBody;
  const amount = Number(body.amount || 0);
  const currency = body.currency || 'INR';
  const receipt = body.receipt || `receipt_${Date.now()}`;

  if (!Number.isFinite(amount) || amount < 100) {
    return NextResponse.json(
      { error: 'Amount must be at least 100 paise.' },
      { status: 400 }
    );
  }

  const razorpay = getRazorpayClient();
  if (!razorpay) {
    return NextResponse.json(
      { error: 'Razorpay credentials are not configured.' },
      { status: 500 }
    );
  }

  try {
    const order = await razorpay.orders.create({
      amount: Math.round(amount),
      currency,
      receipt,
      payment_capture: true,
    });

    return NextResponse.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error: any) {
    console.error('Razorpay standard order creation failed:', error);
    const statusCode = error?.statusCode === 401 ? 401 : 500;
    return NextResponse.json(
      {
        error:
          statusCode === 401
            ? 'Razorpay authentication failed.'
            : 'Failed to create Razorpay order.',
      },
      { status: statusCode }
    );
  }
}
