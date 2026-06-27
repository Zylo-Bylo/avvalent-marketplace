# Zylo Buylo Testing Roadmap

## Current Baseline

Zylo Buylo is a Next.js ecommerce marketplace with customer, vendor, and admin flows. The project currently has `build`, `lint`, and `seed` scripts, but no configured unit, integration, API, or end-to-end test runner.

Primary risk areas:

- Authentication, email verification, password reset, login lockout, and JWT cookies.
- Role-based access for customer, vendor, and admin routes.
- Vendor registration, profile/KYC updates, KYC status, approval, rejection, and product management gating.
- Product search, category filters, stock visibility, approved-vendor visibility, sorting, and pagination.
- Cart, wishlist, checkout, order creation, inventory decrementing, and multi-vendor orders.
- Razorpay and Stripe confirmation/webhook behavior.
- Admin vendor approval/rejection and vendor/product/category dashboards.
- Vendor orders, settlement, wallet, and payments views.
- Local SQLite development behavior versus production database behavior.

## Testing Goals

- Catch checkout, payment, auth, and inventory regressions before release.
- Prove role permissions across customer, vendor, and admin surfaces.
- Make local testing reliable with seeded, disposable data.
- Keep fast tests close to code and reserve browser tests for critical journeys.
- Add CI gates that block deploys when core marketplace behavior breaks.

## Recommended Test Stack

- Unit and component tests: Vitest, React Testing Library, `@testing-library/user-event`, `jsdom`.
- API and integration tests: Vitest with isolated SQLite test database and Prisma test setup.
- End-to-end tests: Playwright.
- Mocking: MSW for browser/API mocks where useful; direct Prisma seed data for integration/E2E.
- Coverage: Vitest coverage for business logic, stores, and API handlers.

Suggested scripts:

```json
{
  "test": "vitest",
  "test:watch": "vitest --watch",
  "test:coverage": "vitest run --coverage",
  "test:e2e": "playwright test",
  "test:all": "npm run lint && npm run test:coverage && npm run test:e2e && npm run build"
}
```

## Requested Feature Test Tracks

These six areas should become named test tracks because they are core marketplace workflows, not edge cases.

### 1. Vendor Profile / KYC Page

- Vendor can load existing profile and KYC details.
- Vendor can update store name, description, logo, mobile, business category, business address, working hours, and delivery area.
- Vendor can update GST, PAN, Aadhaar, bank details, UPI ID, KYC notes, PAN card URL, Aadhaar URL, GST certificate URL, and bank proof URL.
- Adding at least one KYC document moves `kycStatus` to `SUBMITTED`.
- Empty optional fields are stored as `null` instead of whitespace.
- Unauthenticated users receive `401`; customer/admin users receive `403` where vendor-only access is expected.
- Rejected vendors can see rejection reason and resubmit updated KYC details.

### 2. Product Edit/Delete For Vendor

- Approved vendor can list only their own products.
- Approved vendor can edit name, description, price, category, subcategory, SKU, inventory, and images.
- Approved vendor can delete only their own products.
- Vendor cannot edit/delete another vendor's product.
- Pending, rejected, and inactive vendors cannot create, edit, or delete products.
- Customer cannot create, edit, or delete products.
- Admin can edit/delete products when intended by the admin product management flow.
- Edit/delete actions update the UI without stale rows or stale product details.

### 3. Admin Approve/Reject Page

- Admin can view pending, approved, rejected, and inactive vendors with user, contact, KYC, product count, and order count data.
- Admin can approve a vendor and set `status=APPROVED`, `kycStatus=APPROVED`, and `approvedAt`.
- Admin can reject a vendor with a reason and set `status=REJECTED`, `kycStatus=REJECTED`, and `rejectionReason`.
- Admin can mark a vendor inactive without losing profile/KYC data.
- Invalid status values return `400`; missing vendor id returns `404`.
- Non-admin and unauthenticated users cannot access approval actions.
- The page renders empty, loading, error, and action-success states.

### 4. Approved-Only Customer Product Listing

- Public/customer product listing shows products only from approved vendors.
- Products from pending, rejected, and inactive vendors are hidden even when in stock.
- Product search, category, subcategory, price filter, sorting, limit, and offset all preserve approved-vendor filtering.
- Out-of-stock filtering and approved-vendor filtering work together.
- Product detail access policy is explicit: either hide non-approved vendor products with `404`, or allow direct product detail only if business rules require it.
- Add a fail-first integration test for `app/api/products/route.ts` because current listing logic does not visibly enforce vendor approval status.

### 5. Vendor Orders Page

- Approved vendor can view only orders containing their products.
- Vendor order list includes order id, customer summary, items, quantities, item prices, order total, payment method, payment status, and order status.
- Pending vendors cannot access operational order data until approved.
- Vendor cannot see another vendor's orders in a multi-vendor checkout.
- Order status transitions are constrained to allowed states.
- Empty, loading, and API error states render clearly.
- Customer PII is limited to the fields required for fulfillment.

### 6. Vendor Payments Page

- Approved vendor can view payment summary: pending amount, paid amount, total sales, refunds/returns, platform fees if applicable, and settlement status.
- Vendor can view payment rows tied to their own orders only.
- COD, UPI, Razorpay, and Stripe orders display consistent payment status.
- Webhook-confirmed payments appear as paid in vendor payments.
- Failed, pending, refunded, and duplicate payment events do not inflate totals.
- Vendor bank/UPI details used for settlement come from the profile/KYC page.
- Pending, rejected, and inactive vendors cannot access payment settlement data.

## Phase 1: Foundation

Target: 1-2 days

- Add Vitest, React Testing Library, Playwright, and test scripts.
- Create `.env.test` with a disposable SQLite database, stable `JWT_SECRET`, fake payment keys, and test app URL.
- Add test database helpers for migrate/reset/seed.
- Add factories for users, vendors, products, categories, orders, and auth cookies.
- Add CI workflow that runs lint, unit tests, and build on every PR.
- Keep Playwright optional in CI until the critical journeys are stable.

Exit criteria:

- `npm run test` runs locally.
- Test database resets without touching development data.
- CI catches TypeScript, lint, unit, and build failures.

## Phase 2: Fast Unit Coverage

Target: 2-3 days

Focus on pure logic and state stores first.

- `lib/security.ts`
  - Email normalization.
  - Strong password validation for missing uppercase, lowercase, number, special character, and short passwords.
  - OTP format and secure token hashing.
  - Expiry date generation.
- `lib/auth.ts`
  - Password hashing and verification.
  - JWT sign/verify success and invalid token failure.
  - Token payload contains expected user id and role.
- `store/cart-store.ts`
  - Add new item.
  - Increment existing item.
  - Update quantity with minimum of 1.
  - Remove item, clear cart, calculate totals.
- `store/wishlist-store.ts`
  - Add item once.
  - Prevent duplicates.
  - Remove item and check membership.
- Slug/category helpers, if extracted later.

Exit criteria:

- Core utility and store behavior has deterministic coverage.
- Store tests do not leak persisted state between cases.

## Phase 3: API Integration Tests

Target: 4-6 days

Use real route handlers with a disposable SQLite database. Mock only external payment SDK calls.

### Auth

- Signup rejects missing fields, weak passwords, and duplicate emails.
- Signup normalizes email and stores hashed password.
- Email verification accepts valid OTP, rejects expired/invalid OTP, and marks user verified.
- Login rejects missing credentials, unknown users, invalid passwords, unverified users, and locked users.
- Login sets an `auth_token` cookie after successful verified login.
- Logout clears the auth cookie.
- Forgot/reset password rejects invalid tokens, expired tokens, reused tokens, and weak replacement passwords.

### Vendor

- Vendor registration requires required fields and strong password.
- Vendor registration stores profile, KYC fields, and `PENDING` status.
- Vendor profile/KYC read and update routes reject unauthenticated users and non-vendors.
- Vendor profile/KYC updates normalize empty fields, preserve profile data, and move KYC to `SUBMITTED` when documents are provided.
- Vendor product creation rejects unauthenticated users, non-vendors, and unapproved vendors.
- Approved vendors can create products with category/subcategory, SKU, inventory, and images.
- Approved vendors can update and delete their own products.
- Vendors cannot update or delete products owned by another vendor.
- Vendor profile read/update is restricted to the logged-in vendor.
- Vendor orders and payments APIs return only records for the logged-in vendor.

### Admin

- Admin vendor list rejects unauthenticated and non-admin users.
- Admin can list vendors with product/order counts.
- Admin can approve, reject, inactivate, and update KYC status.
- Invalid vendor status returns `400`; missing vendor returns `404`.
- Admin stats endpoints return expected totals after seeded data.

### Catalog

- Product listing filters out out-of-stock items by default.
- Product listing returns only products from approved vendors for customer/public catalog views.
- Product listing supports category, category id, subcategory id, search, min/max price, sorting, limit, and offset.
- Product listing preserves approved-vendor filtering when combined with search, category, subcategory, price, stock, sort, and pagination options.
- Product detail by id and slug returns correct product, category, subcategory, and vendor data.
- Category and subcategory routes return stable tree data.

### Orders And Payments

- Order creation requires authentication, shipping info, and non-empty cart.
- Order creation rejects missing products and insufficient inventory.
- Multi-vendor carts create one order per vendor.
- Inventory decrements after order creation.
- COD and UPI return expected order details.
- Razorpay order creation handles missing credentials and mocked successful SDK response.
- Stripe session creation handles missing credentials and mocked successful SDK response.
- Payment confirmation rejects unauthorized users, missing details, missing credentials, invalid Razorpay signatures, unpaid Stripe sessions, and other users' orders.
- Successful Razorpay and Stripe confirmations update order status to `PAID`.
- Razorpay webhook verifies signature, rejects bad signatures, updates pending orders, and ignores unrelated events.
- Stripe webhook verifies signature, rejects bad signatures, updates paid checkout sessions, and ignores unpaid/unrelated events.

Exit criteria:

- Every API route that changes auth, product, vendor, order, or payment state has success and failure tests.
- External payment services are mocked; no test calls real Stripe or Razorpay.

## Phase 4: Component And Page Tests

Target: 3-5 days

Cover rendering and interaction that can be tested faster than a browser E2E.

- Navbar renders correct links for logged-out, customer, vendor, and admin states.
- Product cards show price, image, stock state, wishlist action, and add-to-cart behavior.
- Product grid handles loading, empty state, search/filter changes, and pagination.
- Cart page updates quantities, removes items, shows totals, and navigates to checkout.
- Checkout validates required shipping fields and payment method selection.
- Login/signup/forgot/reset pages show validation and API errors.
- Vendor dashboard shows pending, rejected, inactive, and approved states.
- Vendor Profile / KYC page shows saved data, validation errors, KYC status, rejection reason, and save success state.
- Vendor product management page supports edit/delete affordances, confirmation, success, and error states.
- Vendor orders page handles empty, loading, populated, and restricted states.
- Vendor payments page handles empty, loading, populated, settlement, and restricted states.
- Admin vendor page can trigger approve/reject flows with mocked API responses.
- Admin approve/reject page shows KYC details, rejection reason prompt/state, and refreshed vendor status after action.

Exit criteria:

- Main UI states are tested without starting a browser.
- Form validation and error rendering are covered.

## Phase 5: Critical End-To-End Tests

Target: 4-7 days

Run these in Playwright against a seeded local app.

Priority smoke journeys:

1. Guest browses home, searches products, filters by category, opens product detail, adds to cart.
2. Customer signs up, verifies OTP in test mode, logs in, adds product to cart, places COD order, sees order detail.
3. Customer login lockout after repeated invalid attempts, then successful login after unlocked test setup.
4. Vendor registers, verifies email, waits in pending state, cannot upload product before approval.
5. Vendor updates Profile / KYC details, submits documents, and sees submitted status.
6. Admin logs in, reviews KYC, approves vendor, vendor logs in and creates a product.
7. Vendor edits and deletes one of their own products, and cannot edit another vendor's product.
8. Customer product listing shows only approved vendor products.
9. Customer buys vendor product and inventory decreases.
10. Vendor orders page shows the new order only for the selling vendor.
11. Vendor payments page reflects COD/UPI/card payment status and settlement summary.
12. Admin dashboard reflects vendor/product/order counts.
13. Payment happy paths using mocked Stripe/Razorpay endpoints or test-mode SDK mocks.

Cross-browser/device coverage:

- Chromium desktop on every PR once stable.
- Mobile Chromium viewport for browse, cart, checkout, login, vendor dashboard, and admin vendor approval.
- Firefox/WebKit nightly or before release.

Exit criteria:

- One command runs the full smoke suite from clean database to verified flows.
- A failed E2E test includes trace, screenshot, and video artifacts.

## Phase 6: Non-Functional Testing

Target: ongoing after core coverage exists

- Accessibility
  - Add automated `axe` checks to Playwright for home, products, cart, checkout, login, vendor dashboard, and admin pages.
  - Manually verify keyboard navigation for menus, forms, modals, quantity controls, and payment actions.
- Performance
  - Track Lighthouse scores for home, product listing, product detail, checkout, and admin dashboard.
  - Add performance budgets for JS bundle size, image payload, and largest contentful paint.
- Security
  - Verify HTTP-only auth cookie, `sameSite`, secure production behavior, and logout clearing.
  - Test role bypass attempts against admin/vendor/customer APIs.
  - Test webhook signature verification with malformed payloads.
  - Test password reset token reuse and expiry.
  - Scan dependencies with `npm audit` in scheduled CI.
- Reliability
  - Test database transaction behavior around inventory decrements.
  - Add regression tests for duplicate order/payment events.
  - Verify local SQLite fallback does not diverge from Prisma-backed behavior for auth/vendor flows.

## Release Gates

Before merging a normal feature:

- Lint passes.
- Unit and affected integration tests pass.
- New or changed behavior has at least one regression test.
- Build passes.

Before deploying checkout, auth, payment, admin, or vendor changes:

- Full integration suite passes.
- Playwright smoke suite passes.
- Payment webhook tests pass.
- Database migration has rollback notes or forward-fix notes.
- Manual exploratory pass covers the changed role and one adjacent role.

Before a production release:

- `npm run test:all` passes.
- Seeded E2E smoke suite passes from a clean database.
- Accessibility smoke checks pass.
- Payment provider test-mode checkout and webhook flows are verified.
- Admin can recover from pending/rejected vendor states.

## Test Data Plan

Maintain deterministic seed data for:

- Admin: `admin@zylo-buylo.com`.
- Approved vendor with products.
- Pending vendor without product permission.
- Rejected vendor with rejection reason.
- Inactive vendor.
- Verified customer.
- Unverified customer.
- Locked customer.
- Product in stock, product low stock, product out of stock.
- Product owned by approved vendor.
- Product owned by pending vendor.
- Product owned by rejected vendor.
- Product owned by inactive vendor.
- Product with category and subcategory.
- Pending COD order.
- Multi-vendor order split into vendor-specific order records.
- Pending Razorpay/Stripe order.
- Paid order.
- Vendor payment rows for pending, paid, failed, refunded, and duplicate-event scenarios.

Use factories for test-specific variations rather than expanding the global seed endlessly.

## Coverage Targets

Early targets:

- `lib/` and `store/`: 80%+ statement coverage.
- Auth, vendor, admin, catalog, order, and webhook API routes: success path plus major failure branches.
- E2E: at least one smoke path per role.

Mature targets:

- 90%+ branch coverage for security/payment/order logic.
- All production bug fixes include a failing regression test first.
- Every route that mutates database state has authorization, validation, and success tests.

## Suggested Implementation Order

1. Install Vitest/Testing Library and add unit tests for `lib/security.ts`, `lib/auth.ts`, cart store, and wishlist store.
2. Add test database reset/seed helpers.
3. Add API tests for signup, verification, login, and auth cookie behavior.
4. Add API tests for Vendor Profile / KYC read/update.
5. Add API tests for admin approve/reject and vendor approval state transitions.
6. Add API tests for vendor product create/edit/delete authorization.
7. Add fail-first API tests for approved-only customer product listing.
8. Add API tests for product listing filters and order creation/inventory decrement.
9. Add vendor orders and vendor payments API tests once those endpoints are implemented.
10. Add payment confirmation and webhook tests with mocked Stripe/Razorpay behavior.
11. Install Playwright and build the critical smoke journeys.
12. Add CI gates and artifacts.
13. Add component/page tests around the highest-change UI surfaces.
14. Add accessibility, performance, and security scheduled checks.
