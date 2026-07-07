# Deployment Information

## Hosting

- Hosting provider: Vercel
- Framework: Next.js
- Vercel project name: `zylo-buylo`
- Vercel project ID: masked, starts with `prj_`
- Vercel org/team ID: masked, starts with `team_`

## URLs

- Production URL: `https://zylo-buylo.com` expected from project/domain context
- Production URL env variable: `NEXT_PUBLIC_APP_URL` or `NEXT_PUBLIC_SITE_URL`
- Preview URL: Vercel preview deployments, exact URL not stored in source
- Local URL: `http://localhost:3000`

## Build Settings

- Install command: `npm ci`
- Build command: `npm run vercel-build`
- Output directory: Vercel default for Next.js, generated `.next`
- Runtime: Vercel Node.js default LTS
- Framework preset: Next.js

## Required Production Environment

Minimum launch variables:

- `DATABASE_URL`
- `JWT_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SITE_URL`

Feature variables:

- Uploads: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`
- Email: `RESEND_API_KEY`, `AUTH_EMAIL_FROM`
- Razorpay: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- UPI: `MERCHANT_UPI_ID`
- WhatsApp: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, template variables
- SMS: `SMS_PROVIDER` and provider-specific variables

## Domain

- Domain: `zylo-buylo.com`
- Domain provider: Hostinger per project context
- DNS target: Use Vercel domain settings for exact `A`/`CNAME` records
- SSL: Vercel managed after domain verification

## Webhook URLs

- Razorpay webhook: `https://zylo-buylo.com/api/webhooks/razorpay`
- Stripe webhook: `https://zylo-buylo.com/api/webhooks/stripe`

## DNS Requirements

- Add the domain in Vercel Project Settings > Domains
- Follow Vercel-provided DNS records in Hostinger DNS
- Keep email DNS records from Hostinger intact if using Hostinger email
- Add sender authentication DNS records if Resend requires domain verification

