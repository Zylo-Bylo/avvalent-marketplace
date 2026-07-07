# Environment Variables

Secret values are hidden. Status is based on local files only, not Vercel dashboard values.

| Variable Name | Purpose | Required | Environment | Current Status | Secret Value |
| --- | --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser Supabase project URL | Yes for Supabase client | Development/Production | Configured locally | [HIDDEN] |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser Supabase anonymous key | Yes for Supabase client | Development/Production | Configured locally | [HIDDEN] |
| `SUPABASE_URL` | Server Supabase project URL for storage uploads | Yes for uploads | Production | Missing locally, example only | [HIDDEN] |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase storage/database privileged access | Yes for uploads | Production | Missing locally, example only | [HIDDEN] |
| `SUPABASE_STORAGE_BUCKET` | Supabase storage bucket name | Yes for uploads | Production | Missing locally, default `zylo-buylo-uploads` used by code | Not secret |
| `DATABASE_URL` | Prisma database connection string | Yes for production | Development/Production | Missing locally, SQLite fallback used | [HIDDEN] |
| `JWT_SECRET` | Signs login/session/order access tokens | Yes for production | Development/Production | Missing locally, insecure development fallback exists | [HIDDEN] |
| `NEXTAUTH_SECRET` | Legacy/NextAuth secret listed in examples | No current code usage found | Production | Missing locally, example only | [HIDDEN] |
| `NEXT_PUBLIC_APP_URL` | Canonical site URL for metadata, sitemap, robots, emails, payment redirects | Yes for production | Production | Missing locally, example only | Not secret |
| `NEXT_PUBLIC_SITE_URL` | Alternate canonical site URL | Yes for production | Production | Missing locally, example only | Not secret |
| `NODE_ENV` | Runtime environment mode | Yes | Development/Production | Set by runtime, example only | Not secret |
| `RAZORPAY_KEY_ID` | Razorpay checkout key ID | Required if Razorpay enabled | Production | Missing locally, example only | [HIDDEN] |
| `RAZORPAY_KEY_SECRET` | Razorpay server secret for order creation/verification | Required if Razorpay enabled | Production | Missing locally, example only | [HIDDEN] |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay webhook signature secret | Required if Razorpay webhooks enabled | Production | Missing locally, example only | [HIDDEN] |
| `STRIPE_SECRET_KEY` | Stripe Checkout server secret key | Required if Stripe enabled | Production | Missing locally, example only | [HIDDEN] |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | Required if Stripe webhooks enabled | Production | Missing locally, example only | [HIDDEN] |
| `MERCHANT_UPI_ID` | Marketplace UPI ID shown to customers | Required if UPI enabled | Production | Missing locally, example only | [HIDDEN] |
| `MAX_COD_AMOUNT` | Maximum allowed COD amount | No | Development/Production | Missing locally, code defaults to `10000` | Not secret |
| `RESEND_API_KEY` | Resend email API key | Yes for production email/OTP/password reset | Production | Missing locally, example only | [HIDDEN] |
| `AUTH_EMAIL_FROM` | Sender email address for transactional email | Yes for production email | Production | Missing locally, example only | Not secret |
| `PASSWORD_RESET_LINK_RESPONSE` | Allows password reset link in API response for manual recovery | No, should not be true in production | Development/Temporary admin recovery | Missing locally | Not secret |
| `WHATSAPP_ACCESS_TOKEN` | Meta WhatsApp Cloud API access token | Required if WhatsApp notifications enabled | Production | Missing locally, example only | [HIDDEN] |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta WhatsApp phone number ID | Required if WhatsApp notifications enabled | Production | Missing locally, example only | [HIDDEN] |
| `WHATSAPP_ORDER_TEMPLATE` | Customer order confirmation template name | Required if customer WhatsApp enabled | Production | Missing locally, example only | Not secret |
| `WHATSAPP_VENDOR_ORDER_TEMPLATE` | Vendor order notification template name | Required if vendor WhatsApp enabled | Production | Missing locally | Not secret |
| `WHATSAPP_TEMPLATE_LANGUAGE` | WhatsApp template language code | No | Production | Missing locally, code defaults to `en_US` | Not secret |
| `SMS_PROVIDER` | SMS provider selector: `fast2sms`, `twilio`, or `generic` | Required if SMS OTP enabled | Production | Missing locally | Not secret |
| `FAST2SMS_API_KEY` | Fast2SMS API key | Required if Fast2SMS selected | Production | Missing locally | [HIDDEN] |
| `FAST2SMS_ROUTE` | Fast2SMS route, default `otp` | No | Production | Missing locally | Not secret |
| `TWILIO_ACCOUNT_SID` | Twilio account SID | Required if Twilio selected | Production | Missing locally | [HIDDEN] |
| `TWILIO_AUTH_TOKEN` | Twilio auth token | Required if Twilio selected | Production | Missing locally | [HIDDEN] |
| `TWILIO_FROM_NUMBER` | Twilio sender phone number | Required if Twilio selected | Production | Missing locally | Not secret |
| `SMS_WEBHOOK_URL` | Generic SMS webhook URL | Required if generic SMS selected | Production | Missing locally | [HIDDEN] |
| `SMS_WEBHOOK_SECRET` | Optional bearer secret for generic SMS webhook | No | Production | Missing locally | [HIDDEN] |

