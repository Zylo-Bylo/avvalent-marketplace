# Zylo-Buylo Supabase RLS Policy Audit

Date: 2026-07-15
Project: `uvembydjrayvnrooyywl`

Production migration execution: not performed.
Deployment: not performed.

## Current Package Status

The current package is policy-first and staging-ready:

- Migration: `supabase/migrations/20260715000100_policy_first_rls.sql`
- Rollback: `supabase/rollback/20260715000100_policy_first_rls_rollback.sql`
- Review: `SUPABASE_RLS_PREDEPLOY_REVIEW.md`

The migration intentionally fails if required audited tables or policy columns are missing. It does not silently skip required Security Advisor tables.

## Live Catalog Verification

Run this read-only SQL in Supabase before staging or production execution:

```sql
select schemaname, tablename, rowsecurity, forcerowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

select table_schema, table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('PUBLIC', 'public', 'anon', 'authenticated', 'service_role')
order by table_name, grantee, privilege_type;
```

## Admin Authority

Database RLS admin policies use only protected Supabase app metadata:

```sql
auth.jwt() -> 'app_metadata' ->> 'role' = 'ADMIN'
```

The migration no longer trusts `user_metadata` or a top-level caller-controlled JWT role. Existing application admin routes continue to use `requireAdminUser()` server-side, which verifies the app cookie and checks `User.role` from the database.

## User Identity Mapping

The app currently uses custom app JWT cookies. The mapping from Supabase `auth.uid()` to application `"User"."id"` is not proven in this repository. Therefore, the migration does not create customer/vendor ownership policies based on `auth.uid()`. Customer/vendor writes remain behind trusted server routes.

## Policy Matrix

| Table/group | Anonymous SELECT | Customer/vendor direct write | Admin/server access | Notes |
| --- | --- | --- | --- | --- |
| `"Category"` | Active, not archived | No | Admin policies | Public catalogue |
| `"Subcategory"` | Active with active parent | No | Admin policies | Public catalogue |
| `"ProductType"` | Active with active parent | No | Admin policies | Public catalogue |
| `"HomepageContent"` | `id = main` | No | Admin policies | Public homepage content |
| `"ProductVariant"` | Safe columns for in-stock approved products | No | Admin policies | Raw protected columns revoked from anon/auth |
| `public_product_variants` | Safe view only | No | N/A | `security_invoker = true` |
| `size_charts`, `size_chart_items` | Active public guides | No | Admin policies | Public size guide |
| `"CategoryUploadTemplate"`, `"CategoryAuditLog"` | No | No | Admin policies | Admin-only |
| Financial tables | No | No | Admin policies/server role | Wallet, bank, payouts, settlements, ledger, commission, refunds |
| Inventory/stock tables | No | No | Admin policies/server route | Vendor actions stay server-side |
| Dispatch/verification/returns/evidence | No direct public table access | No direct table writes | Admin policies/server route | Customer/vendor flows use APIs |
| OTP tables | No | No | Trusted server route only | No direct policies |

## OTP Runtime

Delivery OTP:

- Generated only in `saveDispatchProof()`.
- Stored in `delivery_otp.otpHash`.
- Trust snapshots return safe metadata only.
- Verification uses `verifyDeliveryOtpForOrder()`.
- Expiry, failed attempt limit, resend cooldown, and successful invalidation are implemented.
- No route reads `SELECT "otp"` from `delivery_otp`.

Vendor mobile OTP:

- Stored as `otpHash`.
- Enforces expiry and attempt limit.
- Enforces resend cooldown.
- Successful verification updates `verifiedAt`.

## Rollback Safety

Rollback drops only policies, private helper functions, and the public variant view created by this migration. It does not disable RLS and does not restore broad grants on OTP or financial tables.

## Staging Checklist

1. Confirm required live tables exist, including `"VendorPayoutSettlement"`.
2. Confirm protected Supabase `app_metadata.role = ADMIN` is assigned only by trusted admin/server tooling.
3. Apply migration to a Supabase branch or staging database only.
4. Run the live catalog verification SQL.
5. Exercise public catalogue/product flows.
6. Exercise vendor/admin/customer server-route flows.
7. Confirm no browser code can directly mutate protected tables.

