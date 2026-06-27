-- CreateEnum
CREATE TYPE "StockStatus" AS ENUM ('IN_STOCK', 'LOW_STOCK', 'CRITICAL_STOCK', 'OUT_OF_STOCK', 'PRE_ORDER', 'BACKORDER');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM (
  'STOCK_ADDED',
  'STOCK_REMOVED',
  'ORDER_PLACED',
  'ORDER_CANCELLED',
  'ORDER_RETURNED',
  'MANUAL_ADJUSTMENT',
  'RESERVED',
  'RESERVATION_RELEASED'
);

-- CreateEnum
CREATE TYPE "StockReservationStatus" AS ENUM ('RESERVED', 'CONVERTED', 'RELEASED', 'EXPIRED');

-- CreateTable
CREATE TABLE "Inventory" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "sku" TEXT,
  "mpn" TEXT,
  "currentStock" INTEGER NOT NULL DEFAULT 0,
  "reservedStock" INTEGER NOT NULL DEFAULT 0,
  "availableStock" INTEGER NOT NULL DEFAULT 0,
  "lowStockThreshold" INTEGER NOT NULL DEFAULT 10,
  "criticalStockThreshold" INTEGER NOT NULL DEFAULT 3,
  "minimumOrderQuantity" INTEGER NOT NULL DEFAULT 1,
  "maximumOrderQuantity" INTEGER,
  "restockDate" TIMESTAMP(3),
  "stockStatus" "StockStatus" NOT NULL DEFAULT 'IN_STOCK',
  "allowBackorder" BOOLEAN NOT NULL DEFAULT false,
  "isPreOrder" BOOLEAN NOT NULL DEFAULT false,
  "bulkPricingTiers" JSONB,
  "lastLowStockAlertAt" TIMESTAMP(3),
  "lastCriticalStockAlertAt" TIMESTAMP(3),
  "lastStockUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "type" "StockMovementType" NOT NULL,
  "quantity" INTEGER NOT NULL,
  "oldStock" INTEGER NOT NULL,
  "newStock" INTEGER NOT NULL,
  "reason" TEXT,
  "orderId" TEXT,
  "adjustedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockReservation" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "orderId" TEXT,
  "quantity" INTEGER NOT NULL,
  "status" "StockReservationStatus" NOT NULL DEFAULT 'RESERVED',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StockReservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_productId_key" ON "Inventory"("productId");

-- CreateIndex
CREATE INDEX "Inventory_vendorId_idx" ON "Inventory"("vendorId");

-- CreateIndex
CREATE INDEX "Inventory_sku_idx" ON "Inventory"("sku");

-- CreateIndex
CREATE INDEX "Inventory_mpn_idx" ON "Inventory"("mpn");

-- CreateIndex
CREATE INDEX "Inventory_stockStatus_idx" ON "Inventory"("stockStatus");

-- CreateIndex
CREATE INDEX "StockMovement_productId_idx" ON "StockMovement"("productId");

-- CreateIndex
CREATE INDEX "StockMovement_vendorId_idx" ON "StockMovement"("vendorId");

-- CreateIndex
CREATE INDEX "StockMovement_orderId_idx" ON "StockMovement"("orderId");

-- CreateIndex
CREATE INDEX "StockMovement_type_idx" ON "StockMovement"("type");

-- CreateIndex
CREATE INDEX "StockMovement_createdAt_idx" ON "StockMovement"("createdAt");

-- CreateIndex
CREATE INDEX "StockReservation_productId_idx" ON "StockReservation"("productId");

-- CreateIndex
CREATE INDEX "StockReservation_orderId_idx" ON "StockReservation"("orderId");

-- CreateIndex
CREATE INDEX "StockReservation_status_idx" ON "StockReservation"("status");

-- CreateIndex
CREATE INDEX "StockReservation_expiresAt_idx" ON "StockReservation"("expiresAt");

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_adjustedByUserId_fkey" FOREIGN KEY ("adjustedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill from existing product inventory.
INSERT INTO "Inventory" (
  "id",
  "productId",
  "vendorId",
  "sku",
  "currentStock",
  "reservedStock",
  "availableStock",
  "stockStatus",
  "lastStockUpdatedAt",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  "id",
  "vendorId",
  "sku",
  "inventory",
  0,
  "inventory",
  CASE
    WHEN "inventory" <= 0 THEN 'OUT_OF_STOCK'::"StockStatus"
    WHEN "inventory" <= 3 THEN 'CRITICAL_STOCK'::"StockStatus"
    WHEN "inventory" <= 10 THEN 'LOW_STOCK'::"StockStatus"
    ELSE 'IN_STOCK'::"StockStatus"
  END,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Product"
ON CONFLICT ("productId") DO NOTHING;
