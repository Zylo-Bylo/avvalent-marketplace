ALTER TABLE "Product" ADD COLUMN "packagingCharge" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Product" ADD COLUMN "weightGrams" REAL;
ALTER TABLE "Product" ADD COLUMN "packageSize" TEXT;
ALTER TABLE "Product" ADD COLUMN "fragile" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Product"
SET
  "weightGrams" = COALESCE("weightGrams", 500),
  "packageSize" = COALESCE("packageSize", 'SMALL'),
  "packagingCharge" = CASE
    WHEN "packagingCharge" > 0 THEN "packagingCharge"
    ELSE 12
  END;

ALTER TABLE "OrderItem" ADD COLUMN "packagingCharge" REAL;

UPDATE "OrderItem"
SET "packagingCharge" = COALESCE("packagingCharge", 0);
