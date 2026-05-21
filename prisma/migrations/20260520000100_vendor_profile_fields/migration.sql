-- Add vendor profile completion fields used by the vendor dashboard pending tasks.
ALTER TABLE "Vendor" ADD COLUMN "mobile" TEXT;
ALTER TABLE "Vendor" ADD COLUMN "businessCategory" TEXT;
ALTER TABLE "Vendor" ADD COLUMN "businessAddress" TEXT;
ALTER TABLE "Vendor" ADD COLUMN "gstNumber" TEXT;
ALTER TABLE "Vendor" ADD COLUMN "bankDetails" TEXT;
ALTER TABLE "Vendor" ADD COLUMN "upiId" TEXT;
ALTER TABLE "Vendor" ADD COLUMN "documentsKyc" TEXT;
ALTER TABLE "Vendor" ADD COLUMN "workingHours" TEXT;
ALTER TABLE "Vendor" ADD COLUMN "deliveryArea" TEXT;
