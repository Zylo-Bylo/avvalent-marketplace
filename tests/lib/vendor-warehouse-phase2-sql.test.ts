import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const schema = readFileSync(join(root, "prisma/schema.prisma"), "utf8");
const migration = readFileSync(
  join(root, "supabase/proposed/20260725000100_vendor_warehouse_phase2.sql"),
  "utf8",
);
const rollback = readFileSync(
  join(root, "supabase/proposed/20260725000100_vendor_warehouse_phase2_rollback.sql"),
  "utf8",
);

describe("Phase-2 vendor warehouse SQL and schema", () => {
  it("adds the warehouse model and nullable inventory links without changing inventory uniqueness", () => {
    expect(schema).toContain("model VendorWarehouse");
    expect(schema).toContain("warehouses       VendorWarehouse[]");
    expect(schema).toContain("warehouseId              String?");
    expect(schema).toContain("warehouseId      String?");
    expect(schema).toContain("@@unique([productId])");
    expect(schema).not.toContain("@@unique([productId, warehouseId])");
  });

  it("creates only the approved Phase-2 table and nullable warehouse columns", () => {
    expect(migration).toContain('create table if not exists public."VendorWarehouse"');
    expect(migration).toContain('alter table public."Inventory"');
    expect(migration).toContain('add column if not exists "warehouseId"');
    expect(migration).toContain('alter table public."StockMovement"');
    expect(migration).not.toContain('public."StockTransfer"');
    expect(migration).not.toContain('drop table');
    expect(migration).not.toContain('delete from');
  });

  it("uses trusted admin/vendor ownership helpers and avoids broad write policies", () => {
    expect(migration).toContain("private.zylo_is_admin()");
    expect(migration).toContain("private.zylo_auth_owns_vendor");
    expect(migration).toContain('alter table public."VendorWarehouse" enable row level security');
    expect(migration).not.toContain("user_metadata");
    expect(migration).not.toMatch(/using\s*\(\s*true\s*\)/i);
    expect(migration).not.toMatch(/with\s+check\s*\(\s*true\s*\)/i);
  });

  it("does not grant vendors direct warehouse approval privileges", () => {
    const updateGrant = migration.match(/grant update \(([\s\S]*?)\) on table public\."VendorWarehouse" to authenticated;/i)?.[1] || "";
    const insertGrant = migration.match(/grant insert \(([\s\S]*?)\) on table public\."VendorWarehouse" to authenticated;/i)?.[1] || "";

    expect(updateGrant).toContain('"status"');
    expect(insertGrant).toContain('"status"');
    expect(migration).toMatch(
      /create policy "vendor_warehouse_insert_own"[\s\S]*?for insert[\s\S]*?with check\s*\([\s\S]*?"status"\s*=\s*'PENDING'[\s\S]*?private\.zylo_auth_owns_vendor\("vendorId"\)[\s\S]*?\);/i,
    );
    expect(migration).toMatch(
      /create policy "vendor_warehouse_update_own"[\s\S]*?for update[\s\S]*?using\s*\([\s\S]*?"status"\s*=\s*'PENDING'[\s\S]*?private\.zylo_auth_owns_vendor\("vendorId"\)[\s\S]*?\)[\s\S]*?with check\s*\([\s\S]*?"status"\s*=\s*'PENDING'[\s\S]*?private\.zylo_auth_owns_vendor\("vendorId"\)[\s\S]*?\);/i,
    );
    expect(migration).toMatch(
      /create policy "vendor_warehouse_delete_own"[\s\S]*?for delete[\s\S]*?using\s*\([\s\S]*?"status"\s*=\s*'PENDING'[\s\S]*?private\.zylo_auth_owns_vendor\("vendorId"\)[\s\S]*?\);/i,
    );
  });

  it("rollback removes only Phase-2 objects and does not expose existing data", () => {
    expect(rollback).toContain('drop table if exists public."VendorWarehouse"');
    expect(rollback).toContain('drop column if exists "warehouseId"');
    expect(rollback).not.toMatch(/drop\s+table\s+if\s+exists\s+public\."Vendor"/i);
    expect(rollback).not.toMatch(/drop\s+table\s+if\s+exists\s+public\."Inventory"/i);
    expect(rollback).not.toMatch(/disable\s+row\s+level\s+security/i);
  });
});
