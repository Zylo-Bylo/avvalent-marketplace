import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/admin-auth';

export const runtime = 'nodejs';

function hasEnv(name: string) {
  return Boolean(process.env[name]);
}

function getBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://zylo-buylo.com'
  ).replace(/\/$/, '');
}

export async function GET() {
  if (!(await requireAdminUser())) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const baseUrl = getBaseUrl();
  const razorpayReady =
    hasEnv('RAZORPAY_KEY_ID') && hasEnv('RAZORPAY_KEY_SECRET');
  const stripeReady = hasEnv('STRIPE_SECRET_KEY');
  const upiReady = hasEnv('MERCHANT_UPI_ID');

  return NextResponse.json({
    siteUrl: baseUrl,
    gateways: {
      razorpay: {
        enabled: razorpayReady,
        webhookReady: hasEnv('RAZORPAY_WEBHOOK_SECRET'),
        webhookUrl: `${baseUrl}/api/webhooks/razorpay`,
        requiredEnv: [
          {
            name: 'RAZORPAY_KEY_ID',
            configured: hasEnv('RAZORPAY_KEY_ID'),
            purpose: 'Public Razorpay key used by checkout.',
          },
          {
            name: 'RAZORPAY_KEY_SECRET',
            configured: hasEnv('RAZORPAY_KEY_SECRET'),
            purpose: 'Server secret used to create/verify Razorpay orders.',
          },
          {
            name: 'RAZORPAY_WEBHOOK_SECRET',
            configured: hasEnv('RAZORPAY_WEBHOOK_SECRET'),
            purpose: 'Webhook signature secret for payment.captured/order.paid.',
          },
        ],
        dashboardUrl: 'https://dashboard.razorpay.com/app/keys',
        webhookEvents: ['payment.captured', 'order.paid'],
      },
      stripe: {
        enabled: stripeReady,
        webhookReady: hasEnv('STRIPE_WEBHOOK_SECRET'),
        webhookUrl: `${baseUrl}/api/webhooks/stripe`,
        requiredEnv: [
          {
            name: 'STRIPE_SECRET_KEY',
            configured: hasEnv('STRIPE_SECRET_KEY'),
            purpose: 'Server secret used to create Stripe Checkout sessions.',
          },
          {
            name: 'STRIPE_WEBHOOK_SECRET',
            configured: hasEnv('STRIPE_WEBHOOK_SECRET'),
            purpose: 'Webhook signing secret for checkout.session.completed.',
          },
        ],
        dashboardUrl: 'https://dashboard.stripe.com/developers',
        webhookEvents: ['checkout.session.completed'],
      },
      upi: {
        enabled: upiReady,
        merchantUpiId: process.env.MERCHANT_UPI_ID || null,
        requiredEnv: [
          {
            name: 'MERCHANT_UPI_ID',
            configured: upiReady,
            purpose: 'UPI ID shown to customers after placing UPI orders.',
          },
        ],
      },
      cod: {
        enabled: true,
      },
    },
  });
}
