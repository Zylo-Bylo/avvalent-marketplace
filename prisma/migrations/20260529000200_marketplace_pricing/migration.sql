ALTER TABLE "Product" ADD COLUMN "mrp" REAL;
ALTER TABLE "Product" ADD COLUMN "vendorPrice" REAL;
ALTER TABLE "Product" ADD COLUMN "sellingPrice" REAL;
ALTER TABLE "Product" ADD COLUMN "discountPercent" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Product" ADD COLUMN "discountAmount" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Product" ADD COLUMN "platformCommissionPercent" REAL NOT NULL DEFAULT 10;
ALTER TABLE "Product" ADD COLUMN "platformCommissionAmount" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Product" ADD COLUMN "shippingCharge" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Product" ADD COLUMN "codCharge" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Product" ADD COLUMN "finalCustomerPrice" REAL;
ALTER TABLE "Product" ADD COLUMN "vendorPayout" REAL;
ALTER TABLE "Product" ADD COLUMN "priceApproved" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN "offerStartDate" TIMESTAMP(3);
ALTER TABLE "Product" ADD COLUMN "offerEndDate" TIMESTAMP(3);

UPDATE "Product"
SET
  "mrp" = CASE WHEN "price" > 0 THEN ROUND("price" * 1.35, 2) ELSE "price" END,
  "vendorPrice" = "price",
  "sellingPrice" = "price",
  "finalCustomerPrice" = "price",
  "vendorPayout" = "price",
  "discountAmount" = CASE WHEN "price" > 0 THEN ROUND(("price" * 1.35) - "price", 2) ELSE 0 END,
  "discountPercent" = CASE WHEN "price" > 0 THEN 25.9 ELSE 0 END;

ALTER TABLE "OrderItem" ADD COLUMN "mrp" REAL;
ALTER TABLE "OrderItem" ADD COLUMN "vendorPrice" REAL;
ALTER TABLE "OrderItem" ADD COLUMN "platformCommissionAmount" REAL;
ALTER TABLE "OrderItem" ADD COLUMN "vendorPayout" REAL;

UPDATE "OrderItem"
SET
  "mrp" = "price",
  "vendorPrice" = "price",
  "vendorPayout" = "price",
  "platformCommissionAmount" = 0;
