# Zylo-Buylo Performance Report

## Audit Summary

Checked the public marketplace flow and production build path for:

- Homepage (`/`)
- Products listing (`/products`)
- Product detail (`/products/[id]`)
- Vendor dashboard upload flow
- Admin/category management lint health

Primary issues found:

- Homepage requested 48 products with `cache: "no-store"`, causing repeat database/API work on every visit.
- Product listing and product detail pages also used `cache: "no-store"`, so they could not benefit from Vercel/Next cache.
- Product list API always returned inventory detail rows, even when cards only needed compact product data.
- Product list default limit was high for mobile and slow networks.
- Product cards had loading text instead of visual skeletons.
- Product detail API lacked safe short-lived caching.
- Category API used private caching headers even though category data is mostly shared/static.
- Deal pages filter by `discountPercent`, but the Prisma schema did not define an index for it.
- Lint had React Compiler blocking errors in the vendor upload page.

## Files Changed

- `app/api/products/route.ts`
- `app/api/products/[id]/route.ts`
- `app/api/categories/route.ts`
- `app/page.tsx`
- `app/products/page.tsx`
- `app/products/[id]/page.tsx`
- `app/vendor/dashboard/upload/page.tsx`
- `next.config.ts`
- `prisma/schema.prisma`
- `PERFORMANCE_REPORT.md`

## Optimizations Made

### Product API

- Reduced default product API page size from 40 to 24.
- Reduced max product API page size from 60 to 48.
- Added optional `includeInventoryDetails=true` so inventory detail rows are loaded only when needed.
- Kept compact product card responses to required fields only.
- Added parallel product count and product list fetch.
- Added cache headers:
  - Normal product lists: `public, s-maxage=120, stale-while-revalidate=300`
  - Search/offers/bulk/out-of-stock lists: `public, s-maxage=30, stale-while-revalidate=120`

### Category API

- Added shared cache headers for cached and fresh category responses:
  - `public, s-maxage=300, stale-while-revalidate=600`

### Homepage

- Reduced homepage product request from 48 products to 24.
- Removed `no-store` from the homepage product request so product sections can cache.
- Kept live auth fetch uncached because login state must remain current.

### Products Page

- Removed unnecessary `no-store` product fetches.
- Kept pagination at 24 products per batch.
- Added product card skeleton loaders.
- Added priority image loading for the first visible product cards only.
- Load more now reuses cache-friendly product API calls.

### Product Detail

- Removed unnecessary `no-store` from product detail fetch.
- Added short product detail API cache:
  - `public, s-maxage=60, stale-while-revalidate=300`

### Images

- Confirmed Next.js image optimization is active with AVIF/WebP.
- Added a 7-day minimum image cache TTL in `next.config.ts`.
- Product list and detail image rendering continue to use `next/image` with explicit sizing patterns.

### Database / Prisma

- Confirmed existing indexes for:
  - Product `vendorId`
  - Product `categoryId`
  - Product `subcategoryId`
  - Product `inventory`
  - Product `price`
  - Product `createdAt`
  - ProductVariant `status`
  - ProductVariant `stockQuantity`
  - Inventory `stockStatus`
  - Order `status`
  - Order `createdAt`
- Added product `discountPercent` index for deal/offer pages.

Manual database step required for production:

```bash
npx prisma db push
```

Run that only after confirming the production database connection is correct.

### JavaScript / Lint Cleanup

- Removed vendor upload page memoization blocks that React Compiler could not preserve.
- Escaped one JSX apostrophe in the upload page.
- `npm run lint` now completes with warnings only.

## Build And Test Results

### Lint

Command:

```bash
npm run lint
```

Result:

- Passed with 0 errors.
- Remaining warnings:
  - Unused helper functions in `app/admin/categories/page.tsx`
  - Unused/unstable memo warnings in `app/products/[id]/page.tsx`

### Analyze

Command:

```bash
npm run analyze
```

Result:

- Not available. The project does not currently define an `analyze` script.

### Production Build

Command:

```bash
npm run build
```

Result:

- Passed successfully.
- Next.js compiled 78 app routes.
- Build warning only: custom cache headers exist for `/_next/static/:path*`.

## Expected Improvements

- Faster homepage repeat loads because homepage product/category data can now cache.
- Faster `/products` initial and paginated loads due to smaller default payloads.
- Less database pressure from product listing pages because inventory details are no longer loaded by default.
- Lower CLS risk because product cards use stable image boxes and skeleton placeholders.
- Faster product detail repeat loads because detail pages now use short stale-while-revalidate caching.
- Better offer/deal page query performance after applying the new `discountPercent` index to the database.

## Pending Improvements

- Add a real bundle analyzer setup, for example `@next/bundle-analyzer`, and create `npm run analyze`.
- Compress large local hero PNG assets into smaller WebP/AVIF source files, even though Next.js optimizes delivery.
- Move more homepage sections to server components over time; homepage still has client-side state for auth, cart, wishlist, search, and category interactions.
- Resolve remaining lint warnings in admin categories and product detail pages.
- Add measured Lighthouse results after deploying to production and testing on mobile network throttling.

## Follow-up: Single Product Page Speed

After homepage/product listing optimization, product detail opens were still slower than expected. The product detail API was doing schema/table maintenance checks on every GET request before returning the product.

Changes made:

- Removed inventory schema setup from the product detail GET path.
- Removed variant schema setup from the product detail GET path.
- Replaced helper-based variant loading with a direct indexed `ProductVariant` query.
- Reduced product detail inventory loading to the one inventory row and selected only fields required by the customer page.

Expected result:

- Faster first product detail response.
- Lower database overhead for every product click.
- Buyer-facing product page still receives variants, inventory, vendor summary, category, pricing, images, and review count.
