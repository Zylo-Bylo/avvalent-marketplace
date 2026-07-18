import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migrationPath = join(
  root,
  "supabase",
  "migrations",
  "20260715000100_policy_first_rls.sql",
);
const rollbackPath = join(
  root,
  "supabase",
  "rollback",
  "20260715000100_policy_first_rls_rollback.sql",
);
const migration = readFileSync(migrationPath, "utf8");
const rollback = readFileSync(rollbackPath, "utf8");
const rlsAutoEnableRevokeMigration = readFileSync(
  join(
    root,
    "supabase",
    "migrations",
    "20260718000100_restrict_rls_auto_enable_execute.sql",
  ),
  "utf8",
);

function read(path: string) {
  return readFileSync(join(root, path), "utf8");
}

describe("Supabase RLS policy-first migration", () => {
  it("does not use broad or permissive write policies", () => {
    expect(migration).not.toMatch(/\bfor\s+all\b/i);
    expect(migration).not.toMatch(/using\s*\(\s*true\s*\)/i);
    expect(migration).not.toMatch(/with\s+check\s*\(\s*true\s*\)/i);
  });

  it("uses private SECURITY DEFINER helpers with locked search paths and revoked execution", () => {
    expect(migration).toContain("create schema if not exists private");
    expect(migration).not.toMatch(/function\s+public\.zylo_/i);
    expect(migration).not.toMatch(/set\s+search_path\s*=\s*public/i);
    expect(migration.match(/security definer/gi)?.length).toBe(4);
    expect(migration.match(/set search_path = ''/g)?.length).toBe(4);
    expect(migration).toContain(
      "revoke all on function private.zylo_is_admin() from public, anon, authenticated",
    );
    expect(migration).not.toContain("user_metadata");
    expect(migration).not.toMatch(/auth\.jwt\(\)\s*->>\s*'role'/);
  });

  it("fails explicitly when required audited tables or columns are missing", () => {
    expect(migration).toContain("raise exception 'Policy-first RLS migration aborted. Required audited tables are missing");
    expect(migration).toContain("raise exception 'Policy-first RLS migration aborted. Required policy columns are missing");
    expect(migration).toContain('"VendorPayoutSettlement"');
  });

  it("creates policies before enabling RLS for public catalog tables", () => {
    const requiredTables = [
      '"Category"',
      '"Subcategory"',
      '"ProductType"',
      '"HomepageContent"',
      '"CategoryUploadTemplate"',
      '"CategoryAuditLog"',
      '"ProductVariant"',
      "size_charts",
      "size_chart_items",
    ];

    for (const table of requiredTables) {
      const firstPolicy = migration.indexOf(`on public.${table}`);
      const enable = migration.indexOf(`alter table public.${table} enable row level security`);

      expect(firstPolicy, `${table} has a policy`).toBeGreaterThan(-1);
      expect(enable, `${table} enables RLS`).toBeGreaterThan(-1);
      expect(firstPolicy, `${table} policy comes before enable`).toBeLessThan(enable);
    }
  });

  it("keeps OTP tables without direct anon/authenticated policies or grants", () => {
    expect(migration).toContain("revoke all on table public.delivery_otp from public, anon, authenticated");
    expect(migration).toContain("revoke all on table public.vendor_mobile_otp from public, anon, authenticated");
    expect(migration).not.toMatch(/create\s+policy\s+"?delivery_otp/i);
    expect(migration).not.toMatch(/create\s+policy\s+"?vendor_mobile_otp/i);
  });

  it("creates a security-invoker sanitized public variant view", () => {
    expect(migration).toContain("with (security_invoker = true) as");
    expect(migration).not.toMatch(/public_product_variants[\s\S]*select\s+\*/i);
    expect(migration).not.toMatch(/public_product_variants[\s\S]*"vendorPrice"/);
    expect(migration).not.toMatch(/public_product_variants[\s\S]*"stockQuantity"/);
    expect(migration).not.toMatch(/public_product_variants[\s\S]*"lowStockThreshold"/);
    expect(migration).toContain("grant select on public.public_product_variants to anon, authenticated");
  });

  it("does not grant direct customer/vendor writes on protected business tables", () => {
    const protectedTables = [
      "VendorBankAccount",
      "VendorPayout",
      "VendorPayoutSettlement",
      "Inventory",
      "ProductVariant",
      "dispatch_images",
      "return_evidence",
    ];

    for (const table of protectedTables) {
      expect(migration, table).not.toMatch(
        new RegExp(`${table}[\\s\\S]{0,240}(owner|vendor|customer).*for\\s+(insert|update|delete)`, "i"),
      );
    }
  });

  it("has rollback for private helpers and the public variant view without disabling RLS", () => {
    expect(rollback).toContain("drop view if exists public.public_product_variants");
    expect(rollback).toContain("drop function if exists private.zylo_is_admin()");
    expect(rollback).toContain("drop schema if exists private");
    expect(rollback).not.toMatch(/disable\s+row\s+level\s+security/i);
  });
});

describe("delivery OTP runtime guardrails", () => {
  it("does not read or compare plaintext delivery OTP in order routes", () => {
    const sources = [
      read("app/api/orders/[id]/trust/route.ts"),
      read("app/api/vendor/orders/[id]/route.ts"),
      read("app/api/admin/orders/[id]/route.ts"),
    ].join("\n");

    expect(sources).not.toMatch(/SELECT\s+"otp"/i);
    expect(sources).not.toMatch(/record\.otp|otpRecord\.otp/);
    expect(sources).toContain("verifyDeliveryOtpForOrder");
  });

  it("stores delivery OTP hashes and omits them from trust snapshots", () => {
    const trust = read("lib/trust.ts");

    expect(trust).toContain('"otpHash" TEXT');
    expect(trust).toContain("createDeliveryOtpHash");
    expect(trust).toContain("DELIVERY_OTP_MAX_ATTEMPTS");
    expect(trust).toContain("DELIVERY_OTP_RESEND_COOLDOWN_MINUTES");
    expect(trust).not.toMatch(/SELECT\s+\*\s+FROM\s+"delivery_otp"/i);
    expect(trust).not.toMatch(/SELECT[\s\S]{0,120}"otpHash"[\s\S]{0,120}deliveryOtpRows/);
  });
});

describe("automatic RLS event-trigger helper hardening", () => {
  it("revokes direct execution of public.rls_auto_enable without dropping the trigger function", () => {
    expect(rlsAutoEnableRevokeMigration).toContain(
      "IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN",
    );
    expect(rlsAutoEnableRevokeMigration).toContain(
      "REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC",
    );
    expect(rlsAutoEnableRevokeMigration).toContain(
      "REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon",
    );
    expect(rlsAutoEnableRevokeMigration).toContain(
      "REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM authenticated",
    );
    expect(rlsAutoEnableRevokeMigration).not.toMatch(/drop\s+function/i);
    expect(rlsAutoEnableRevokeMigration).not.toMatch(/drop\s+event\s+trigger/i);
    expect(rlsAutoEnableRevokeMigration).not.toMatch(/disable\s+trigger/i);
    expect(rlsAutoEnableRevokeMigration).not.toMatch(/grant\s+execute/i);
  });
});
