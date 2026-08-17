CREATE TABLE "VendorWarehouse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vendorId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "addressId" TEXT,
    "capacity" INTEGER,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VendorWarehouse_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VendorWarehouse_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "VendorAddress" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

ALTER TABLE "Inventory" ADD COLUMN "warehouseId" TEXT REFERENCES "VendorWarehouse" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD COLUMN "warehouseId" TEXT REFERENCES "VendorWarehouse" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "VendorWarehouse_vendorId_code_key" ON "VendorWarehouse"("vendorId", "code");
CREATE UNIQUE INDEX "VendorWarehouse_one_default_active_idx" ON "VendorWarehouse"("vendorId") WHERE "isDefault" = true AND "isActive" = true;
CREATE INDEX "VendorWarehouse_vendorId_idx" ON "VendorWarehouse"("vendorId");
CREATE INDEX "VendorWarehouse_vendorId_isDefault_idx" ON "VendorWarehouse"("vendorId", "isDefault");
CREATE INDEX "VendorWarehouse_vendorId_isActive_idx" ON "VendorWarehouse"("vendorId", "isActive");
CREATE INDEX "VendorWarehouse_status_idx" ON "VendorWarehouse"("status");
CREATE INDEX "VendorWarehouse_addressId_idx" ON "VendorWarehouse"("addressId");
CREATE INDEX "VendorWarehouse_createdAt_idx" ON "VendorWarehouse"("createdAt");
CREATE INDEX "Inventory_warehouseId_idx" ON "Inventory"("warehouseId");
CREATE INDEX "StockMovement_warehouseId_idx" ON "StockMovement"("warehouseId");
