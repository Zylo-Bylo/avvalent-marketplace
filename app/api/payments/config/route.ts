import { NextResponse } from 'next/server';
import { getMarketplaceUpiId } from '@/lib/payment-settings';

export async function GET() {
  const upiId = await getMarketplaceUpiId();
  const razorpayReady = Boolean(
    process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET,
  );
  const stripeReady = Boolean(process.env.STRIPE_SECRET_KEY);

  return NextResponse.json({
    currency: 'INR',
    methods: {
      COD: {
        enabled: true,
        label: 'Cash on Delivery',
        description: 'Pay when the order reaches you.',
      },
      UPI: {
        enabled: Boolean(upiId),
        label: 'UPI Transfer',
        description: upiId
          ? `Pay to ${upiId} after placing the order.`
          : 'Add MERCHANT_UPI_ID in Vercel to enable UPI transfer.',
        upiId: upiId || null,
      },
      RAZORPAY: {
        enabled: razorpayReady,
        label: 'Razorpay',
        description: razorpayReady
          ? 'Pay securely by UPI, card, wallet or net banking.'
          : 'Add Razorpay key ID and secret in Vercel to enable this.',
      },
      STRIPE: {
        enabled: stripeReady,
        label: 'Stripe',
        description: stripeReady
          ? 'Pay securely by card through Stripe Checkout.'
          : 'Add Stripe secret key in Vercel to enable this.',
      },
    },
    webhooks: {
      razorpay: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET),
      stripe: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    },
  });
}
