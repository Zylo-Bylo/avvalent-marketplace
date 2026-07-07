# Services Used

This file lists connected or referenced external services. Secret values are intentionally not shown.

| Service | Usage | Evidence | Status |
| --- | --- | --- | --- |
| Vercel | Hosting, builds, preview/production deployment, custom domain connection | `vercel.json`, `.vercel/project.json`, `DEPLOYMENT.md` | Configured in repo; account details masked |
| Supabase Postgres | Recommended production database provider | `.env.production.example`, `DEPLOYMENT.md`, Prisma production flow | Required for production database, missing locally |
| Supabase Storage | Vendor/product upload storage | `lib/uploads.ts`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` | Code ready, server credentials missing locally |
| Supabase client | Browser Supabase client | `lib/supabase.ts`, `.env.local` | Public client env configured locally |
| Hostinger | Domain/email provider per project context | User/project context | Domain/email provider, not directly configured in repo |
| GitHub | Source repository connected to Vercel | `DEPLOYMENT.md` | Expected, repository remote not audited here |
| Razorpay | INR online payment gateway and webhook | `razorpay` dependency, order APIs, webhook route | Code ready, credentials missing locally |
| Stripe | Card checkout and webhook | `stripe` dependency, order APIs, webhook route | Code ready, credentials missing locally |
| UPI | Manual UPI transfer payment option | `MERCHANT_UPI_ID`, payment settings API | Optional, missing locally |
| Resend | Transactional email for OTP, password reset, vendor status, order confirmation | `lib/email.ts`, `RESEND_API_KEY`, `AUTH_EMAIL_FROM` | Code ready, credentials missing locally |
| Gmail/SMTP | Email provider requested in audit checklist | No SMTP/Gmail code found | Not configured in repo |
| WhatsApp Cloud API | Customer/vendor order notification templates | `lib/whatsapp.ts`, Graph API v20.0 | Code ready, credentials missing locally |
| Fast2SMS | Optional SMS OTP provider | `lib/sms.ts`, `FAST2SMS_API_KEY` | Supported, missing locally |
| Twilio | Optional SMS OTP provider | `lib/sms.ts`, Twilio API endpoint | Supported, missing locally |
| Generic SMS webhook | Optional custom SMS provider | `lib/sms.ts`, `SMS_WEBHOOK_URL` | Supported, missing locally |
| Cloudinary | Image storage service requested in checklist | No Cloudinary references found | Not used |
| Analytics | Analytics requested in checklist | No analytics provider references found | Not configured |
| Unsplash | Allowed remote product/marketing image source | `next.config.ts` | Allowed image host only |
| Placeholder image hosts | Placeholder/fallback images | `next.config.ts`, seed route | Allowed image hosts only |

