CREATE TABLE IF NOT EXISTS "CategoryUploadTemplate" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "categoryId" TEXT NOT NULL,
  "subcategoryId" TEXT,
  "productTypeId" TEXT,
  "productTypes" TEXT NOT NULL,
  "specTemplate" TEXT NOT NULL,
  "variantConfig" TEXT NOT NULL,
  "sizeChart" TEXT,
  "requiredFields" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "CategoryUploadTemplate" ADD COLUMN IF NOT EXISTS "productTypeId" TEXT;

CREATE INDEX IF NOT EXISTS "CategoryUploadTemplate_productTypeId_idx"
ON "CategoryUploadTemplate"("productTypeId");

CREATE INDEX IF NOT EXISTS "CategoryUploadTemplate_template_scope_idx"
ON "CategoryUploadTemplate"("categoryId", "subcategoryId", "productTypeId");
