import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relativePath: string) =>
  readFileSync(path.join(root, relativePath), "utf8");

const schema = read("prisma/schema.prisma");
const sqliteMigration = read(
  "prisma/migrations/20261001000100_return_receipt_qc/migration.sql",
);
const postgresForward = read(
  "supabase/proposed/20261001000100_return_receipt_qc.sql",
);
const postgresRollback = read(
  "supabase/proposed/20261001000100_return_receipt_qc_rollback.sql",
);

const dataMutationStatement = /^\s*(?:update\s+\S+|delete\s+from\s+\S+|insert\s+into\s+\S+)/im;
const destructiveSchemaStatement =
  /^\s*(?:drop\s+(?:table|column)\b|truncate\b|alter\s+table\b[^;]*\bdrop\s+column\b)/im;

describe("return receipt and QC schema", () => {
  it("defines the locked enums, models, and nullable existing-model links", () => {
    expect(schema).toContain("enum ReturnReceiptStatus");
    expect(schema).toContain("enum ReturnStockDispositionType");
    expect(schema).toContain("model ReturnReceipt {");
    expect(schema).toContain("model ReturnReceiptItem {");
    expect(schema).toContain("model ReturnStockDisposition {");
    expect(schema).toMatch(/fulfillmentWarehouseId\s+String\?/);
    expect(schema).toMatch(/returnDispositionId\s+String\?\s+@unique/);
  });

  it("defines the required uniqueness and lookup indexes", () => {
    expect(schema).toMatch(/returnRequestId\s+String\s+@unique/);
    expect(schema).toContain("@@unique([receiptId, orderItemId])");
    expect(schema).toContain("@@unique([receiptItemId, disposition])");
    expect(schema).toContain("@@index([restorationWarehouseId])");
    expect(schema).toContain("@@index([processedAt])");
  });

  it("keeps damaged stock out of ProductVariant", () => {
    const variantModel = schema.match(/model ProductVariant \{[\s\S]*?\n\}/)?.[0];
    expect(variantModel).toBeDefined();
    expect(variantModel).not.toMatch(/damagedStock/);
  });

  it("keeps the SQLite migration additive and SQLite-specific", () => {
    expect(sqliteMigration).toContain("SQLite-only additive migration");
    expect(sqliteMigration).toContain('CREATE TABLE "ReturnReceipt"');
    expect(sqliteMigration).toContain('CREATE TABLE "ReturnReceiptItem"');
    expect(sqliteMigration).toContain('CREATE TABLE "ReturnStockDisposition"');
    expect(sqliteMigration).toContain(
      'CREATE UNIQUE INDEX "ReturnReceipt_returnRequestId_key"',
    );
    expect(sqliteMigration).not.toMatch(destructiveSchemaStatement);
    expect(sqliteMigration).not.toMatch(dataMutationStatement);
  });

  it("provides an additive PostgreSQL forward artifact with constraints", () => {
    expect(postgresForward).toMatch(/^\s*begin;/im);
    expect(postgresForward).toMatch(/^\s*commit;/im);
    expect(postgresForward).toMatch(
      /create\s+table\s+if\s+not\s+exists\s+(?:public\.)?"ReturnReceipt"/i,
    );
    expect(postgresForward).toMatch(
      /create\s+table\s+if\s+not\s+exists\s+(?:public\.)?"ReturnReceiptItem"/i,
    );
    expect(postgresForward).toMatch(
      /create\s+table\s+if\s+not\s+exists\s+(?:public\.)?"ReturnStockDisposition"/i,
    );
    expect(postgresForward).toMatch(/"orderedQuantity"\s*>\s*0/i);
    expect(postgresForward).toMatch(/"receivedQuantity"\s*>=\s*0/i);
    expect(postgresForward).toMatch(/check\s*\(\s*"quantity"\s*>\s*0\s*\)/i);
    expect(postgresForward).not.toMatch(destructiveSchemaStatement);
    expect(postgresForward).not.toMatch(dataMutationStatement);
    expect(postgresForward).not.toMatch(/\b(?:ENABLE ROW LEVEL SECURITY|GRANT)\b/i);
  });

  it("provides a rollback limited to objects introduced by this feature", () => {
    expect(postgresRollback).toMatch(/^\s*begin;/im);
    expect(postgresRollback).toMatch(/^\s*commit;/im);
    expect(postgresRollback).toMatch(
      /drop\s+table\s+if\s+exists\s+(?:public\.)?"ReturnStockDisposition"/i,
    );
    expect(postgresRollback).toMatch(
      /drop\s+table\s+if\s+exists\s+(?:public\.)?"ReturnReceiptItem"/i,
    );
    expect(postgresRollback).toMatch(
      /drop\s+table\s+if\s+exists\s+(?:public\.)?"ReturnReceipt"/i,
    );
    expect(postgresRollback).toMatch(
      /alter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?"StockMovement"\s+drop\s+column\s+if\s+exists\s+"returnDispositionId"/i,
    );
    expect(postgresRollback).toMatch(
      /alter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?"OrderItem"\s+drop\s+column\s+if\s+exists\s+"fulfillmentWarehouseId"/i,
    );
    expect(postgresRollback).not.toMatch(
      /drop\s+table\s+if\s+exists\s+(?:public\.)?"(?:Order|OrderItem|Product|ProductVariant|StockMovement|VendorWarehouse|User)"/i,
    );
    expect(postgresRollback).not.toMatch(dataMutationStatement);
    expect(postgresRollback).not.toMatch(/\b(?:ENABLE ROW LEVEL SECURITY|GRANT)\b/i);
  });
});
