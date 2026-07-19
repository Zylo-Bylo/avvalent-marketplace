ALTER TABLE "Category" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Category" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Category" ADD COLUMN "homepageIcon" TEXT;
ALTER TABLE "Category" ADD COLUMN "categoryImage" TEXT;
ALTER TABLE "Category" ADD COLUMN "desktopBanner" TEXT;
ALTER TABLE "Category" ADD COLUMN "mobileBanner" TEXT;
ALTER TABLE "Category" ADD COLUMN "altText" TEXT;
ALTER TABLE "Category" ADD COLUMN "archivedAt" DATETIME;

ALTER TABLE "Subcategory" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Subcategory" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Subcategory" ADD COLUMN "homepageIcon" TEXT;
ALTER TABLE "Subcategory" ADD COLUMN "categoryImage" TEXT;
ALTER TABLE "Subcategory" ADD COLUMN "desktopBanner" TEXT;
ALTER TABLE "Subcategory" ADD COLUMN "mobileBanner" TEXT;
ALTER TABLE "Subcategory" ADD COLUMN "altText" TEXT;
ALTER TABLE "Subcategory" ADD COLUMN "archivedAt" DATETIME;

CREATE TABLE "ProductType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "homepageIcon" TEXT,
    "categoryImage" TEXT,
    "desktopBanner" TEXT,
    "mobileBanner" TEXT,
    "altText" TEXT,
    "archivedAt" DATETIME,
    "subcategoryId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductType_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "Subcategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE "Product" ADD COLUMN "productTypeId" TEXT;

CREATE TABLE "CategoryAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "adminUser" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "ProductType_slug_key" ON "ProductType"("slug");
CREATE UNIQUE INDEX "ProductType_subcategoryId_name_key" ON "ProductType"("subcategoryId", "name");
CREATE INDEX "ProductType_subcategoryId_idx" ON "ProductType"("subcategoryId");
CREATE INDEX "ProductType_status_idx" ON "ProductType"("status");
CREATE INDEX "ProductType_sortOrder_idx" ON "ProductType"("sortOrder");
CREATE INDEX "Category_status_idx" ON "Category"("status");
CREATE INDEX "Category_sortOrder_idx" ON "Category"("sortOrder");
CREATE INDEX "Subcategory_status_idx" ON "Subcategory"("status");
CREATE INDEX "Subcategory_sortOrder_idx" ON "Subcategory"("sortOrder");
CREATE INDEX "Product_productTypeId_idx" ON "Product"("productTypeId");
CREATE INDEX "CategoryAuditLog_entityType_idx" ON "CategoryAuditLog"("entityType");
CREATE INDEX "CategoryAuditLog_entityId_idx" ON "CategoryAuditLog"("entityId");
CREATE INDEX "CategoryAuditLog_createdAt_idx" ON "CategoryAuditLog"("createdAt");
