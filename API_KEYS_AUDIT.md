# API Keys Audit

Actual key values are not shown.

| File | Variable Name | Purpose | Status |
| --- | --- | --- | --- |
| `.env.local` | `NEXT_PUBLIC_SUPABASE_URL` | Public Supabase client URL | Configured locally, value hidden |
| `.env.local` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public Supabase anonymous key | Configured locally, value hidden |
| `.env.example` | `DATABASE_URL` | Database connection string placeholder | Example only |
| `.env.example` | `NEXTAUTH_SECRET` | Legacy/unused auth secret placeholder | Example only |
| `.env.example` | `STRIPE_SECRET_KEY` | Stripe server secret placeholder | Example only |
| `.env.example` | `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret placeholder | Example only |
| `.env.example` | `RAZORPAY_KEY_ID` | Razorpay key ID placeholder | Example only |
| `.env.example` | `RAZORPAY_KEY_SECRET` | Razorpay server secret placeholder | Example only |
| `.env.example` | `RAZORPAY_WEBHOOK_SECRET` | Razorpay webhook secret placeholder | Example only |
| `.env.example` | `JWT_SECRET` | JWT signing secret placeholder | Example only |
| `.env.example` | `RESEND_API_KEY` | Resend email API key placeholder | Example only |
| `.env.example` | `WHATSAPP_ACCESS_TOKEN` | Meta WhatsApp access token placeholder | Example only |
| `.env.example` | `WHATSAPP_PHONE_NUMBER_ID` | Meta WhatsApp phone number ID placeholder | Example only |
| `.env.example` | `SUPABASE_URL` | Server Supabase URL placeholder | Example only |
| `.env.example` | `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key placeholder | Example only |
| `.env.production.example` | `DATABASE_URL` | Production database connection string placeholder | Example only |
| `.env.production.example` | `JWT_SECRET` | Production JWT signing secret placeholder | Example only |
| `.env.production.example` | `STRIPE_SECRET_KEY` | Stripe live secret placeholder | Example only |
| `.env.production.example` | `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret placeholder | Example only |
| `.env.production.example` | `RAZORPAY_KEY_ID` | Razorpay live key ID placeholder | Example only |
| `.env.production.example` | `RAZORPAY_KEY_SECRET` | Razorpay live secret placeholder | Example only |
| `.env.production.example` | `RAZORPAY_WEBHOOK_SECRET` | Razorpay webhook secret placeholder | Example only |
| `.env.production.example` | `RESEND_API_KEY` | Resend live API key placeholder | Example only |
| `.env.production.example` | `WHATSAPP_ACCESS_TOKEN` | WhatsApp access token placeholder | Example only |
| `.env.production.example` | `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp phone number ID placeholder | Example only |
| `.env.production.example` | `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key placeholder | Example only |
| `lib/supabase.ts` | `NEXT_PUBLIC_SUPABASE_URL` | Initializes browser Supabase client | Configured locally |
| `lib/supabase.ts` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Initializes browser Supabase client | Configured locally |
| `lib/uploads.ts` | `SUPABASE_URL` | Initializes server Supabase upload client | Missing locally |
| `lib/uploads.ts` | `SUPABASE_SERVICE_ROLE_KEY` | Server Supabase upload access | Missing locally |
| `lib/email.ts` | `RESEND_API_KEY` | Resend API bearer token | Missing locally |
| `lib/whatsapp.ts` | `WHATSAPP_ACCESS_TOKEN` | WhatsApp Cloud API bearer token | Missing locally |
| `lib/whatsapp.ts` | `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp Graph API endpoint ID | Missing locally |
| `lib/sms.ts` | `FAST2SMS_API_KEY` | Fast2SMS authorization key | Missing locally |
| `lib/sms.ts` | `TWILIO_ACCOUNT_SID` | Twilio account ID | Missing locally |
| `lib/sms.ts` | `TWILIO_AUTH_TOKEN` | Twilio auth token | Missing locally |
| `lib/sms.ts` | `SMS_WEBHOOK_SECRET` | Generic SMS webhook bearer secret | Missing locally |
| `lib/auth.ts` | `JWT_SECRET` | JWT signing secret | Missing locally, insecure fallback exists |
| `app/api/orders/create/route.ts` | `RAZORPAY_KEY_ID` | Razorpay order creation | Missing locally |
| `app/api/orders/create/route.ts` | `RAZORPAY_KEY_SECRET` | Razorpay order creation secret | Missing locally |
| `app/api/orders/create/route.ts` | `STRIPE_SECRET_KEY` | Stripe Checkout session creation | Missing locally |
| `app/api/orders/confirm/route.ts` | `RAZORPAY_KEY_SECRET` | Razorpay payment signature verification | Missing locally |
| `app/api/orders/confirm/route.ts` | `STRIPE_SECRET_KEY` | Stripe session verification | Missing locally |
| `app/api/webhooks/razorpay/route.ts` | `RAZORPAY_WEBHOOK_SECRET` | Razorpay webhook signature validation | Missing locally |
| `app/api/webhooks/stripe/route.ts` | `STRIPE_WEBHOOK_SECRET` | Stripe webhook signature validation | Missing locally |
| `app/api/webhooks/stripe/route.ts` | `STRIPE_SECRET_KEY` | Stripe API access | Missing locally |
| `app/api/verify-payment/route.ts` | `RAZORPAY_KEY_SECRET` | Razorpay signature verification | Missing locally |
| `app/api/create-order/route.ts` | `RAZORPAY_KEY_ID` | Legacy Razorpay order route | Missing locally |
| `app/api/create-order/route.ts` | `RAZORPAY_KEY_SECRET` | Legacy Razorpay order route secret | Missing locally |

