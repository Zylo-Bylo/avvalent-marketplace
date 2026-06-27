CREATE TYPE "BankVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'ON_HOLD', 'APPROVED', 'PROCESSING', 'PAID', 'FAILED', 'REJECTED');
CREATE TYPE "PayoutMethod" AS ENUM ('BANK_TRANSFER', 'UPI', 'RAZORPAYX', 'MANUAL');
CREATE TYPE "LedgerEntryType" AS ENUM ('ORDER_PENDING', 'ORDER_AVAILABLE', 'COMMISSION_DEBIT', 'REFUND_DEBIT', 'PENALTY_DEBIT', 'PAYOUT_DEBIT', 'ADJUSTMENT_CREDIT', 'ADJUSTMENT_DEBIT');
CREATE TYPE "CommissionRuleType" AS ENUM ('GLOBAL', 'CATEGORY', 'VENDOR');
CREATE TYPE "SettlementReportStatus" AS ENUM ('DRAFT', 'GENERATED', 'PAID', 'CANCELLED');

CREATE TABLE "VendorBankAccount" (
  "id" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "accountHolderName" TEXT NOT NULL,
  "bankName" TEXT NOT NULL,
  "accountNumber" TEXT NOT NULL,
  "ifscCode" TEXT NOT NULL,
  "upiId" TEXT,
  "panNumber" TEXT NOT NULL,
  "gstNumber" TEXT,
  "verificationStatus" "BankVerificationStatus" NOT NULL DEFAULT 'PENDING',
  "rejectionReason" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VendorBankAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VendorWallet" (
  "id" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "grossSales" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "commissionDeducted" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "refundDeducted" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "penaltyDeducted" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "availableBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "pendingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "paidBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VendorWallet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VendorPayout" (
  "id" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "payoutAmount" DOUBLE PRECISION NOT NULL,
  "payoutStatus" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
  "payoutMethod" "PayoutMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
  "bankAccountId" TEXT,
  "transactionId" TEXT,
  "failureReason" TEXT,
  "approvedByAdminId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VendorPayout_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VendorLedger" (
  "id" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "orderId" TEXT,
  "type" "LedgerEntryType" NOT NULL,
  "creditAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "debitAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "balanceAfter" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VendorLedger_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommissionRule" (
  "id" TEXT NOT NULL,
  "type" "CommissionRuleType" NOT NULL,
  "categoryId" TEXT,
  "vendorId" TEXT,
  "commissionPercent" DOUBLE PRECISION NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommissionRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SettlementReport" (
  "id" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "reportPeriod" TEXT NOT NULL,
  "totalOrders" INTEGER NOT NULL DEFAULT 0,
  "grossAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "commissionAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "refundAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "netPayable" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" "SettlementReportStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SettlementReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RefundAdjustment" (
  "id" TEXT NOT NULL,
  "vendorId" TEXT NOT NULL,
  "orderId" TEXT,
  "refundAmount" DOUBLE PRECISION NOT NULL,
  "reason" TEXT,
  "adjustedFromPayout" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RefundAdjustment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VendorWallet_vendorId_key" ON "VendorWallet"("vendorId");
CREATE INDEX "VendorBankAccount_vendorId_idx" ON "VendorBankAccount"("vendorId");
CREATE INDEX "VendorPayout_vendorId_idx" ON "VendorPayout"("vendorId");
CREATE INDEX "VendorPayout_payoutStatus_idx" ON "VendorPayout"("payoutStatus");
CREATE INDEX "VendorLedger_vendorId_idx" ON "VendorLedger"("vendorId");
CREATE INDEX "VendorLedger_orderId_idx" ON "VendorLedger"("orderId");
CREATE INDEX "CommissionRule_type_idx" ON "CommissionRule"("type");
CREATE INDEX "CommissionRule_categoryId_idx" ON "CommissionRule"("categoryId");
CREATE INDEX "CommissionRule_vendorId_idx" ON "CommissionRule"("vendorId");
CREATE INDEX "SettlementReport_vendorId_idx" ON "SettlementReport"("vendorId");
CREATE INDEX "SettlementReport_reportPeriod_idx" ON "SettlementReport"("reportPeriod");
CREATE INDEX "RefundAdjustment_vendorId_idx" ON "RefundAdjustment"("vendorId");
CREATE INDEX "RefundAdjustment_orderId_idx" ON "RefundAdjustment"("orderId");

ALTER TABLE "VendorBankAccount" ADD CONSTRAINT "VendorBankAccount_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VendorPayout" ADD CONSTRAINT "VendorPayout_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VendorPayout" ADD CONSTRAINT "VendorPayout_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "VendorBankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VendorWallet" ADD CONSTRAINT "VendorWallet_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VendorLedger" ADD CONSTRAINT "VendorLedger_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VendorLedger" ADD CONSTRAINT "VendorLedger_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SettlementReport" ADD CONSTRAINT "SettlementReport_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RefundAdjustment" ADD CONSTRAINT "RefundAdjustment_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RefundAdjustment" ADD CONSTRAINT "RefundAdjustment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
