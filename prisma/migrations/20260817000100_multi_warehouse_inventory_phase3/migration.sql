-- Phase 3 Vendor Operations: multi-warehouse inventory metadata.
-- Additive only: preserves existing product-level Inventory uniqueness.

ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'STOCK_RECEIVED';
ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'DAMAGED_STOCK';

ALTER TABLE "Inventory" ADD COLUMN "variantId" TEXT REFERENCES "ProductVariant" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Inventory" ADD COLUMN "openingStock" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Inventory" ADD COLUMN "receivedStock" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Inventory" ADD COLUMN "damagedStock" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "StockMovement" ADD COLUMN "variantId" TEXT REFERENCES "ProductVariant" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD COLUMN "reasonCode" TEXT;

ALTER TABLE "StockReservation" ADD COLUMN "warehouseId" TEXT REFERENCES "VendorWarehouse" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockReservation" ADD COLUMN "variantId" TEXT REFERENCES "ProductVariant" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Inventory_variantId_idx" ON "Inventory"("variantId");
CREATE INDEX "StockMovement_variantId_idx" ON "StockMovement"("variantId");
CREATE INDEX "StockMovement_reasonCode_idx" ON "StockMovement"("reasonCode");
CREATE INDEX "StockReservation_warehouseId_idx" ON "StockReservation"("warehouseId");
CREATE INDEX "StockReservation_variantId_idx" ON "StockReservation"("variantId");
