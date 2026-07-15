# Supabase RLS Pre-Deployment Review

Date: 2026-07-15
Scope:

- `lib/trust.ts`
- `supabase/migrations/20260715000100_policy_first_rls.sql`
- `supabase/rollback/20260715000100_policy_first_rls_rollback.sql`
- `SUPABASE_RLS_POLICY_AUDIT.md`
- `tests/lib/supabase-rls-policy-sql.test.ts`
- `tests/lib/supabase-service-role-usage.test.ts`

Production migration execution: not performed.
Deployment: not performed.
Production data changes: not performed.

## Executive Verdict

**SAFE TO TEST**

This means safe for a Supabase branch/staging project only. It is not approval to run the migration on production.

The previous blocking findings have been addressed in the current patch:

- `public.public_product_variants` uses `security_invoker = true`.
- RLS helper functions were moved to the private schema.
- `SECURITY DEFINER` helpers use `set search_path = ''`.
- Helper `EXECUTE` privileges are revoked from `public`, `anon`, and `authenticated`, then only the minimum needed functions are granted.
- Admin database policy authority no longer trusts `user_metadata` or a top-level caller role.
- Direct customer/vendor ownership write policies were removed from protected business tables.
- `VendorPayoutSettlement` is included as a required audited table and is covered by admin-only policies.
- Required missing tables/columns fail the migration explicitly.
- Delivery OTP runtime now stores hashes, omits OTP hashes from trust snapshots, enforces expiry and attempts, and invalidates successful verification.
- Vendor mobile OTP now enforces resend cooldown.

## Remaining Staging Preconditions

These are not production blockers for a staging test, but they must be verified before production:

1. The live project must contain all required audited tables, including `public."VendorPayoutSettlement"`. If any are missing, the migration intentionally fails.
2. Direct Supabase admin policies use protected Supabase `app_metadata.role = 'ADMIN'`. Confirm this claim is set only by trusted server/admin tooling.
3. The application currently uses custom app auth for server routes. No customer/vendor ownership policies depend on `auth.uid()` until a Supabase-auth-to-app-user mapping is proven.
4. Trusted server routes must use a privileged server database role or service route that is not exposed to frontend code.

## Policy Order

PASS. Public/client-accessed tables create policies before `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`.

Server-only protected tables are handled inside one dynamic admin-only block that creates select/insert/update/delete admin policies before enabling RLS. OTP tables intentionally have no direct anon/authenticated policies; table grants are revoked before RLS is enabled.

## Live Schema Compatibility

PASS for locally audited schema. The migration now fails explicitly if required tables or columns are absent:

- Required table check raises `Policy-first RLS migration aborted. Required audited tables are missing`.
- Required column check raises `Policy-first RLS migration aborted. Required policy columns are missing`.

No customer/vendor ownership policies are created because the app user ID to Supabase `auth.uid()` relationship is not proven.

## Table Name and Case Check

PASS. Mixed-case tables are quoted in required-table checks and policy blocks, including:

- `"VendorWallet"`
- `"VendorBankAccount"`
- `"VendorPayout"`
- `"VendorPayoutSettlement"`
- `"VendorLedger"`
- `"CommissionRule"`
- `"SettlementReport"`
- `"RefundAdjustment"`
- `"Inventory"`
- `"StockMovement"`
- `"StockReservation"`
- `"ProductVariant"`
- `"ProductType"`
- `"HomepageContent"`
- `"AdminBusinessProfile"`
- `"ReturnRefundRequest"`
- `"CategoryAuditLog"`
- `"CategoryUploadTemplate"`

## View Security

PASS. `public.public_product_variants`:

- Uses `with (security_invoker = true)`.
- Does not use `SELECT *`.
- Exposes only `id`, `productId`, size/color/SKU, public price/MRP, image, and status.
- Does not expose `vendorPrice`, stock quantity, low-stock threshold, reserved stock, supplier data, payout data, or fraud fields.
- Filters variants to `status = 'IN_STOCK'` and products passing `private.zylo_approved_catalog_product`.
- Grants only `select` to `anon` and `authenticated`.

## Security-Definer Functions

PASS.

| Function | Schema | Args | Return | Search path | Direct private data returned |
| --- | --- | --- | --- | --- | --- |
| `zylo_is_admin` | `private` | none | `boolean` | `''` | No |
| `zylo_active_category` | `private` | `text` | `boolean` | `''` | No |
| `zylo_active_subcategory` | `private` | `text` | `boolean` | `''` | No |
| `zylo_approved_catalog_product` | `private` | `text` | `boolean` | `''` | No |

All table/function references are schema-qualified. No helper accepts a vendor/customer ID that grants access to private rows.

## Function Execute Privileges

PASS.

| Function | public | anon | authenticated | service role |
| --- | --- | --- | --- | --- |
| `private.zylo_is_admin()` | revoked | revoked | granted for admin policy evaluation | owner/service can execute |
| `private.zylo_active_category(text)` | revoked | granted for catalog RLS | granted for catalog RLS | owner/service can execute |
| `private.zylo_active_subcategory(text)` | revoked | granted for catalog RLS | granted for catalog RLS | owner/service can execute |
| `private.zylo_approved_catalog_product(text)` | revoked | granted for public view/RLS | granted for public view/RLS | owner/service can execute |

## Admin Authorization

PASS for staging. Database admin policies use protected Supabase JWT app metadata:

```sql
auth.jwt() -> 'app_metadata' ->> 'role' = 'ADMIN'
```

The migration no longer trusts:

- `user_metadata`
- top-level `auth.jwt() ->> 'role'`
- query parameters
- form fields
- browser-submitted request-body roles

The existing app server admin source remains `requireAdminUser()` in `lib/admin-auth.ts`, which verifies the signed app cookie, loads the user server-side, and checks `User.role`.

## OTP Protection

PASS.

Delivery OTP:

- Generated only in `saveDispatchProof()` on the server.
- Stored as `otpHash`, not plaintext.
- Trust snapshots select only safe OTP metadata and never return `otpHash`.
- Verification uses `verifyDeliveryOtpForOrder()`.
- Expiry is enforced.
- Attempt count is enforced.
- Resend cooldown is enforced.
- Successful verification marks the OTP verified and overwrites `otpHash`.
- No direct anon/authenticated table policies exist.
- No console logging of OTP values was found.

Vendor mobile OTP:

- Stores `otpHash`.
- Enforces expiry.
- Enforces attempt limit.
- Enforces resend cooldown using the latest unverified row.
- Successful verification updates `verifiedAt`.
- No direct table policy exposes rows.

## Financial Tables

PASS for staging. Protected financial/business tables have admin-only policies and no direct customer/vendor write policies:

- `"VendorWallet"`
- `"VendorBankAccount"`
- `"VendorPayout"`
- `"VendorPayoutSettlement"`
- `"VendorLedger"`
- `"CommissionRule"`
- `"SettlementReport"`
- `"RefundAdjustment"`
- `"AdminBusinessProfile"`
- `risk_assessment`
- `vendor_protection_logs`

State changes remain behind trusted server routes and helpers.

## Customer and Vendor Isolation

PASS by denial of direct table ownership policies. Because `auth.uid()` mapping is not proven, customer/vendor direct table policies were not created for:

- `"Inventory"`
- `"StockMovement"`
- `"StockReservation"`
- `"ProductVariant"` writes
- `dispatch_images`
- `"ReturnRefundRequest"`
- `return_requests`
- `return_evidence`
- `order_verification`
- `open_box_verification`

Application access is through server routes that verify the app session and vendor/customer relationship before writing.

## Application Compatibility

| Flow | Server-side path | Direct browser table write |
| --- | --- | --- |
| Vendor product management | `/api/products/create`, `/api/products/[id]`, `lib/variants.ts` | No |
| Inventory updates | `/api/vendor/inventory`, `/api/admin/inventory`, `lib/inventory.ts` | No |
| Stock transfer/reservation | order/inventory server helpers | No |
| Dispatch flow | `/api/vendor/orders/[id]`, `saveDispatchProof()` | No |
| Delivery OTP | `/api/orders/[id]/trust`, `/api/vendor/orders/[id]`, `/api/admin/orders/[id]`, `verifyDeliveryOtpForOrder()` | No |
| Customer returns | `/api/orders/[id]/return-request` | No |
| Evidence upload | `/api/orders/[id]/return-request` server inserts | No |
| Vendor bank account | `/api/vendor/payouts/bank` | No |
| Vendor wallet | `/api/vendor/payouts`, `lib/payouts.ts` | No |
| Payout and settlement | `/api/vendor/payouts`, `/api/admin/payouts`, `lib/payouts.ts` | No |
| Admin category management | `/api/admin/category-atelier`, category APIs | No |

## Read-Only Live Verification SQL

```sql
select schemaname, tablename, rowsecurity, forcerowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

select n.nspname as schema_name,
       p.proname as function_name,
       pg_get_function_arguments(p.oid) as arguments,
       pg_get_function_result(p.oid) as return_type,
       p.prosecdef as security_definer,
       p.proconfig as function_config,
       pg_get_userbyid(p.proowner) as owner
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where p.proname like 'zylo_%'
order by n.nspname, p.proname;

select routine_schema, routine_name, grantee, privilege_type
from information_schema.routine_privileges
where routine_name like 'zylo_%'
order by routine_schema, routine_name, grantee;

select schemaname, viewname, definition
from pg_views
where schemaname = 'public'
  and viewname = 'public_product_variants';
```

## Staging Test Procedure

1. Apply the migration only to a Supabase branch/staging database.
2. Run the read-only verification SQL.
3. Confirm `private` helper functions are not exposed as frontend RPCs.
4. Confirm missing-table failure does not trigger in staging.
5. Test anonymous homepage/category/product pages.
6. Test vendor product, inventory, dispatch, and payout flows through server routes.
7. Test customer return/evidence and delivery OTP flows through server routes.
8. Test admin category, inventory, payout, refund, profile, and security pages.

## Production Rollback Triggers

Rollback immediately if staging or production shows:

- Any OTP row is readable by anon/authenticated direct table access.
- Any public view exposes `otpHash`, `vendorPrice`, stock, payout, or fraud data.
- Any customer/vendor can write protected financial/inventory/evidence tables directly.
- Admin policies work from user-editable metadata or top-level caller role claims.
- Required audited tables are skipped instead of failing migration.
- Public browsing breaks for active categories/product types/product variants.

