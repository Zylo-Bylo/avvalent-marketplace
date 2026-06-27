-- Store customer delivery details and fulfillment progress on each vendor order.
ALTER TABLE "Order" ADD COLUMN "shippingName" TEXT;
ALTER TABLE "Order" ADD COLUMN "shippingPhone" TEXT;
ALTER TABLE "Order" ADD COLUMN "shippingAddress" TEXT;
ALTER TABLE "Order" ADD COLUMN "shippingCity" TEXT;
ALTER TABLE "Order" ADD COLUMN "shippingState" TEXT;
ALTER TABLE "Order" ADD COLUMN "shippingZipCode" TEXT;
ALTER TABLE "Order" ADD COLUMN "trackingNumber" TEXT;
ALTER TABLE "Order" ADD COLUMN "carrier" TEXT;
ALTER TABLE "Order" ADD COLUMN "statusNote" TEXT;
ALTER TABLE "Order" ADD COLUMN "shippedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "deliveredAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "cancelledAt" TIMESTAMP(3);
