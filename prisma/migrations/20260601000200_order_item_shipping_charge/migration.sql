ALTER TABLE "OrderItem" ADD COLUMN "shippingCharge" REAL;

UPDATE "OrderItem"
SET "shippingCharge" = COALESCE("shippingCharge", 0);
