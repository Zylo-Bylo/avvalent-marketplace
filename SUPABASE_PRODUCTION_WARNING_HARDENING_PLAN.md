# Supabase Production Warning Hardening Plan

Production project: `uvembydjrayvnrooyywl`

Current closure state:

- Security Advisor Errors: 0
- Security Advisor Warnings: 18
- Security Advisor Info: 20
- Production RLS hardening: complete
- Legacy lowercase category/subcategory RLS fix: complete
- Production smoke tests: passed
- Admin smoke tests: passed
- Rollback required: no

This document is a planning backlog only. Do not apply any item directly to production.
Each warning must be fixed on staging first, reviewed, backed by rollback SQL, and separately approved for production.

## Priority 1

### `public.update_wallet_balance`

- Warning: Function Search Path Mutable
- Classification: RECOMMENDED
- Current object: `public.update_wallet_balance`
- Risk: Wallet balance updates are financially sensitive. A mutable `search_path` can allow unexpected object resolution inside the function.
- Proposed fix: Review the function body, fully qualify every schema/table/function reference, then set a fixed search path such as `SET search_path = ''`. Restrict EXECUTE grants to only required trusted roles.
- Staging test requirement: Apply on staging, run wallet balance update scenarios, vendor wallet views, payout requests, and protected-flow isolation tests.
- Rollback requirement: Restore the prior function definition and grants only.
- Production approval requirement: Separate production database-write approval after staging verification.

### `public.create_admin_user`

- Warning: Function Search Path Mutable
- Classification: RECOMMENDED
- Current object: `public.create_admin_user`
- Risk: Admin account creation is privileged. Search-path ambiguity can become privilege escalation if the function is callable or SECURITY DEFINER.
- Proposed fix: Fully qualify all references, set `search_path = ''`, review SECURITY DEFINER need, and revoke EXECUTE from public-facing roles unless explicitly required.
- Staging test requirement: Verify admin creation/update flow, admin page access, non-admin denial, and AuthIdentityMapping compatibility.
- Rollback requirement: Restore prior function and grants only.
- Production approval requirement: Separate approval, with no Auth metadata changes unless explicitly included.

### `public.calculate_vendor_commission`

- Warning: Function Search Path Mutable
- Classification: RECOMMENDED
- Current object: `public.calculate_vendor_commission`
- Risk: Commission calculations affect settlement and payout amounts. Mutable search path can resolve wrong helper/table references.
- Proposed fix: Fully qualify references and set a fixed search path. Add tests for commission rule lookup and product/vendor commission calculation.
- Staging test requirement: Run vendor product pricing, order settlement, payout calculation, and regression tests.
- Rollback requirement: Restore prior function definition only.
- Production approval requirement: Separate production database-write approval.

### `public.calculate_reseller_margin`

- Warning: Function Search Path Mutable
- Classification: RECOMMENDED
- Current object: `public.calculate_reseller_margin`
- Risk: Margin calculations affect pricing and settlement expectations.
- Proposed fix: Fully qualify references and set `search_path = ''` or a minimal explicit schema path after review.
- Staging test requirement: Run pricing, product listing, checkout price, and margin calculation tests.
- Rollback requirement: Restore prior function definition only.
- Production approval requirement: Separate production approval.

### `public.detect_fraud_patterns`

- Warning: Function Search Path Mutable
- Classification: RECOMMENDED
- Current object: `public.detect_fraud_patterns`
- Risk: Fraud/risk decisions may affect orders, vendors, or returns. Mutable search path can cause incorrect detection behavior.
- Proposed fix: Fully qualify references, set fixed search path, and review execution grants.
- Staging test requirement: Run risk-assessment, order, return, and evidence-flow tests.
- Rollback requirement: Restore prior function definition and grants only.
- Production approval requirement: Separate production approval.

### `public.orders`

- Warning: RLS Policy Always True
- Classification: RECOMMENDED
- Current object: `public.orders`
- Risk: Broad RLS expressions can permit more insert/read/write behavior than intended if exposed to anon/authenticated roles.
- Proposed fix: Replace broad `true` policies with ownership policies or server-route-only writes. Confirm order creation happens through secured server routes.
- Staging test requirement: Customer order creation, order details, order isolation, admin orders, vendor order visibility, and checkout confirmation.
- Rollback requirement: Restore prior policies and grants only.
- Production approval requirement: Separate production approval after order-flow smoke tests.

### `public.order_items`

- Warning: RLS Policy Always True
- Classification: RECOMMENDED
- Current object: `public.order_items`
- Risk: Broad item policies can expose or permit tampering with order contents.
- Proposed fix: Tie access to parent `orders` ownership/admin/vendor rules, or remove direct client writes and require server route access.
- Staging test requirement: Order create/read, vendor order item visibility, admin order management, and customer isolation.
- Rollback requirement: Restore prior policies and grants only.
- Production approval requirement: Separate production approval.

### `public.products`

- Warning: RLS Policy Always True
- Classification: RECOMMENDED
- Current object: `public.products`
- Risk: Broad product write policies can allow unauthorized product creation or edits.
- Proposed fix: Preserve public read for approved/active products, restrict writes to vendor-owned products through secured server routes or admin-only paths.
- Staging test requirement: Product listing, product detail, vendor product creation/editing, admin product management, category filters, and variant display.
- Rollback requirement: Restore prior product policies only.
- Production approval requirement: Separate production approval after catalogue and vendor smoke tests.

### `public.users`

- Warning: RLS Policy Always True
- Classification: RECOMMENDED
- Current object: `public.users`
- Risk: Broad user policies can expose or permit modification of account records.
- Proposed fix: Restrict read/write to self, admin-only, or secured onboarding routes. Verify AuthIdentityMapping remains the protected source for admin authority.
- Staging test requirement: Signup/login, profile, admin users, customer/vendor denial, and isolation tests.
- Rollback requirement: Restore prior policies only.
- Production approval requirement: Separate production approval.

### `public.vendors`

- Warning: RLS Policy Always True
- Classification: RECOMMENDED
- Current object: `public.vendors`
- Risk: Broad vendor policies can permit unauthorized vendor registration or profile mutation.
- Proposed fix: Restrict vendor writes to secured registration/profile routes and admin review actions. Preserve required public shop read if needed.
- Staging test requirement: Vendor registration/profile, vendor dashboard, admin vendor approval, vendor public shop, and non-owner isolation.
- Rollback requirement: Restore prior policies only.
- Production approval requirement: Separate production approval.

## Priority 2

### `public.addresses`

- Warning: RLS Policy Always True
- Classification: RECOMMENDED
- Current object: `public.addresses`
- Risk: Address records may contain sensitive customer delivery information.
- Proposed fix: Restrict access to owning customer and admin/server routes. Avoid public reads.
- Staging test requirement: Checkout address, profile address, order address, and customer isolation.
- Rollback requirement: Restore prior policies only.
- Production approval requirement: Separate production approval.

### `public.reviews`

- Warning: RLS Policy Always True
- Classification: RECOMMENDED
- Current object: `public.reviews`
- Risk: Broad review policies can allow spam or non-owner edits.
- Proposed fix: Allow public read for approved reviews if required, restrict insert/update to authenticated purchasers or secured server route.
- Staging test requirement: Product page review display, review creation, moderation, and non-owner update denial.
- Rollback requirement: Restore prior policies only.
- Production approval requirement: Separate production approval.

### `public.update_updated_at_column`

- Warning: Function Search Path Mutable
- Classification: RECOMMENDED
- Current object: `public.update_updated_at_column`
- Risk: Generic timestamp trigger helper can resolve unexpected objects if search path is mutable.
- Proposed fix: Set a fixed search path and verify trigger behavior on tables using it.
- Staging test requirement: Update rows on representative tables and confirm `updated_at` changes correctly.
- Rollback requirement: Restore prior function definition.
- Production approval requirement: Separate production approval.

### `public.generate_referral_code`

- Warning: Function Search Path Mutable
- Classification: RECOMMENDED
- Current object: `public.generate_referral_code`
- Risk: Referral-code generation can behave unpredictably if helper/table names resolve incorrectly.
- Proposed fix: Fully qualify references and set fixed search path.
- Staging test requirement: Signup/referral-code generation and uniqueness checks.
- Rollback requirement: Restore prior function definition.
- Production approval requirement: Separate production approval.

### `public.generate_order_number`

- Warning: Function Search Path Mutable
- Classification: RECOMMENDED
- Current object: `public.generate_order_number`
- Risk: Order numbering can collide or fail if sequence/table references resolve incorrectly.
- Proposed fix: Fully qualify sequence/table references and set fixed search path.
- Staging test requirement: Create multiple orders and verify unique order numbers.
- Rollback requirement: Restore prior function definition.
- Production approval requirement: Separate production approval.

## Priority 3 / Informational

### `storage.product-images`

- Warning: Public Bucket Allows Listing
- Classification: INFORMATIONAL
- Current object: `storage.product-images`
- Risk: Public listing can expose object names and browsing of product assets.
- Proposed fix: If product images must be public, consider preserving public object read but narrowing bucket/list policies. If listing is required by the app, document it as accepted risk.
- Staging test requirement: Product listing/detail image load, upload signing, and storage URL rendering.
- Rollback requirement: Restore prior storage policies only.
- Production approval requirement: Separate production approval if changing storage policies.

### `storage.vendor-logos`

- Warning: Public Bucket Allows Listing
- Classification: INFORMATIONAL
- Current object: `storage.vendor-logos`
- Risk: Public listing can expose vendor logo object names.
- Proposed fix: Preserve public read where needed, restrict broad list if not required, and verify vendor/logo display.
- Staging test requirement: Vendor shop/logo rendering and vendor upload workflow.
- Rollback requirement: Restore prior storage policies only.
- Production approval requirement: Separate production approval if changing storage policies.

### Auth leaked password protection

- Warning: Leaked Password Protection Disabled
- Classification: INFORMATIONAL / PLAN LIMITATION
- Current object: Supabase Auth
- Risk: Supabase will not block or warn on passwords found in breach datasets.
- Proposed fix: Enable leaked password protection when the Supabase plan supports it.
- Staging test requirement: Confirm setting availability and login behavior on a non-production project or documented dashboard configuration.
- Rollback requirement: Disable the setting if it causes unacceptable login friction.
- Production approval requirement: Dashboard-level production approval. No SQL migration expected.
