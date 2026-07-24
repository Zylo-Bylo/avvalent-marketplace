import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migration = readFileSync(
  join(root, "supabase/proposed/20260724000100_vendor_profile_kyc_phase1.sql"),
  "utf8",
);
const rollback = readFileSync(
  join(root, "supabase/proposed/20260724000100_vendor_profile_kyc_phase1_rollback.sql"),
  "utf8",
);

describe("Phase-1 vendor profile RLS SQL", () => {
  it("creates only the approved vendor profile extension tables", () => {
    for (const table of [
      "VendorContactPerson",
      "VendorAddress",
      "VendorKycDocument",
      "VendorVerificationEvent",
      "VendorSuspensionEvent",
    ]) {
      expect(migration).toContain(`public."${table}"`);
      expect(migration).toContain(`alter table public."${table}" enable row level security`);
    }

    expect(migration).not.toContain("VendorWarehouse");
    expect(migration).not.toContain("StockTransfer");
    expect(migration).not.toContain("VendorSettlementCycle");
  });

  it("uses trusted mapping/admin helper and avoids broad write policies", () => {
    expect(migration).toContain('public."AuthIdentityMapping"');
    expect(migration).toContain("private.zylo_is_admin()");
    expect(migration).toContain("private.zylo_auth_owns_vendor");
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = ''");
    expect(migration).not.toContain("user_metadata");
    expect(migration).not.toMatch(/using\s*\(\s*true\s*\)/i);
    expect(migration).not.toMatch(/with\s+check\s*\(\s*true\s*\)/i);
  });

  it("does not give vendors a direct KYC update policy", () => {
    expect(migration).toContain('grant delete on table public."VendorKycDocument" to authenticated');
    expect(migration).toContain('grant select (');
    expect(migration).toContain('grant insert (');
    expect(migration).not.toMatch(/vendor_kyc_document_update/i);
    expect(migration).toContain('"status" = \'PENDING\'');
    expect(migration).toContain('"verifiedById" is null');
  });

  it("does not expose private KYC storage paths through authenticated column grants", () => {
    const selectGrant = migration.match(/grant select \(([\s\S]*?)\) on table public\."VendorKycDocument" to authenticated;/i)?.[1] || "";
    const insertGrant = migration.match(/grant insert \(([\s\S]*?)\) on table public\."VendorKycDocument" to authenticated;/i)?.[1] || "";

    expect(selectGrant).toContain('"documentNumberMasked"');
    expect(selectGrant).not.toContain('"storagePath"');
    expect(insertGrant).not.toContain('"storagePath"');
  });

  it("rollback removes only phase-1 extension tables", () => {
    expect(rollback).toContain('drop table if exists public."VendorSuspensionEvent"');
    expect(rollback).toContain('drop table if exists public."VendorContactPerson"');
    expect(rollback).toContain("drop function if exists private.zylo_auth_owns_vendor(text)");
    expect(rollback).not.toMatch(/drop\s+table\s+if\s+exists\s+public\."Vendor"/i);
    expect(rollback).not.toMatch(/disable\s+row\s+level\s+security/i);
  });
});
