# Zylo-Buylo.com Vercel Deployment

## Production Requirements

- GitHub repository connected to Vercel.
- Hosted production database. Recommended: Supabase Postgres.
- Vercel environment variables copied from `.env.production.example`.
- Custom domain added in Vercel Project Settings > Domains.

## Vercel Settings

- Framework: Next.js
- Install command: `npm ci`
- Build command: `npm run vercel-build`
- Output directory: leave default
- Node.js: Vercel default LTS

## Required Environment Variables

Copy `.env.production.example` into Vercel Project Settings > Environment Variables and replace every placeholder.

Important:

- `NEXT_PUBLIC_APP_URL` must be the final HTTPS site URL.
- `DATABASE_URL` must be a hosted database URL. Do not use `file:./dev.db` on Vercel.
- `JWT_SECRET` must be a long random value.
- Payment webhook secrets must match the live Stripe/Razorpay dashboard settings.

## Database Setup

This project currently uses Prisma models for the ecommerce and vendor system. For production on Vercel, use a hosted database instead of the local `dev.db` file.

Recommended Supabase flow:

1. Create a Supabase project.
2. Copy the pooled Postgres connection string.
3. Add it as `DATABASE_URL` in Vercel.
4. Run the Prisma schema deployment against the production database before first launch:

```bash
npm run prisma:db:push
npm run seed
```

Run the commands locally only after setting `DATABASE_URL` to the production database, or from a secure CI environment.

This project uses SQLite locally and Postgres in production. The helper script at
`scripts/prisma-schema.mjs` automatically generates the correct Prisma schema:

- no `DATABASE_URL` or `file:./dev.db` -> SQLite
- `postgresql://...` or `postgres://...` -> Postgres

## GitHub and Vercel Flow

```bash
git init
git add .
git commit -m "Prepare Zylo Buylo for Vercel production"
git branch -M main
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main
```

Then in Vercel:

1. New Project.
2. Import the GitHub repository.
3. Add environment variables.
4. Deploy.
5. Add the custom domain.
6. Follow the DNS records shown by Vercel.

Vercel automatically provisions HTTPS/SSL after the domain is verified.

## Health Check Routes

- `/`
- `/products`
- `/vendor/dashboard`
- `/vendor/dashboard/upload`
- `/admin/dashboard`
- `/admin/products`
- `/admin/categories`
- `/api/products?limit=5`
- `/sitemap.xml`
- `/robots.txt`

## Production Notes

- Product and category pages have CDN cache headers.
- Global security headers are configured.
- Next.js image formats are configured for AVIF/WebP.
- `sitemap.ts`, `robots.ts`, `not-found.tsx`, and `error.tsx` are included.
- Automatic deployment starts after every push to the connected GitHub branch.
