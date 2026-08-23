import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const schema = readFileSync(join(root, "prisma/schema.prisma"), "utf8");
const migration = readFileSync(
  join(root, "supabase/proposed/20260817000100_multi_warehouse_inventory_phase3.sql"),
  "utf8",
);
const rollback = readFileSync(
  join(root, "supabase/proposed/20260817000100_multi_warehouse_inventory_phase3_rollback.sql"),
  "utf8",
);

describe("Phase-3 multi-warehouse inventory SQL and schema", () => {
  it("extends inventory without changing product-level uniqueness", () => {
    expect(schema).toContain("model Inventory");
    expect(schema).toContain("warehouseId      String?");
    expect(schema).toContain("variantId        String?");
    expect(schema).toMatch(/openingStock\s+Int\s+@default\(0\)/);
    expect(schema).toMatch(/receivedStock\s+Int\s+@default\(0\)/);
    expect(schema).toMatch(/damagedStock\s+Int\s+@default\(0\)/);
    expect(schema).toContain("@@unique([productId])");
    expect(schema).not.toContain("@@unique([productId, warehouseId])");
  });

  it("adds only nullable warehouse/variant context and stock buckets", () => {
    expect(migration).toContain('alter table public."Inventory"');
    expect(migration).toContain('add column if not exists "variantId"');
    expect(migration).toContain('add column if not exists "openingStock" integer not null default 0');
    expect(migration).toContain('add column if not exists "receivedStock" integer not null default 0');
    expect(migration).toContain('add column if not exists "damagedStock" integer not null default 0');
    expect(migration).toContain('alter table public."StockReservation"');
    expect(migration).toContain('add column if not exists "warehouseId"');
    expect(migration).not.toMatch(/drop\s+table/i);
    expect(migration).not.toMatch(/delete\s+from/i);
    expect(migration).not.toMatch(/truncate\s+table/i);
  });

  it("keeps RLS and grants unchanged while guarding required schema", () => {
    expect(migration).toContain('private.zylo_is_admin()');
    expect(migration).toContain('private.zylo_auth_owns_vendor(text)');
    expect(migration).toContain("Existing Inventory product uniqueness is missing");
    expect(migration).not.toMatch(/using\s*\(\s*true\s*\)/i);
    expect(migration).not.toMatch(/with\s+check\s*\(\s*true\s*\)/i);
    expect(migration).not.toMatch(/grant\s+(insert|update|delete|all)/i);
    expect(migration).not.toMatch(/disable\s+row\s+level\s+security/i);
  });

  it("uses constrained movement reason codes", () => {
    for (const reason of [
      "OPENING_STOCK",
      "PURCHASE_RECEIPT",
      "STOCK_IN",
      "STOCK_OUT",
      "DAMAGED_STOCK",
      "WAREHOUSE_ASSIGNMENT",
      "ORDER_RESERVATION",
      "ORDER_CONVERSION",
      "ORDER_RELEASE",
      "ORDER_RETURN",
    ]) {
      expect(migration).toContain(`'${reason}'`);
    }
  });

  it("rollback removes only Phase-3 columns, indexes and constraints", () => {
    expect(rollback).toContain('drop column if exists "warehouseId"');
    expect(rollback).toContain('drop column if exists "variantId"');
    expect(rollback).toContain('drop constraint if exists "Inventory_damagedStock_nonnegative"');
    expect(rollback).not.toMatch(/drop\s+table/i);
    expect(rollback).not.toMatch(/delete\s+from/i);
    expect(rollback).not.toMatch(/disable\s+row\s+level\s+security/i);
    expect(rollback).not.toMatch(/public\."VendorWarehouse"\s+disable/i);
  });
});
