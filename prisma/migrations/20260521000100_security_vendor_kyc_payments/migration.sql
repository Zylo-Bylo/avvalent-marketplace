-- Add COD/UPI payment options and vendor/security fields.
-- SQLite stores Prisma enum values as TEXT, so no enum table change is needed.

ALTER TABLE "User" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "emailOtpHash" TEXT;
ALTER TABLE "User" ADD COLUMN "emailOtpExpiresAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "lockedUntil" DATETIME;

ALTER TABLE "Vendor" ADD COLUMN "panNumber" TEXT;
ALTER TABLE "Vendor" ADD COLUMN "aadhaarNumber" TEXT;
ALTER TABLE "Vendor" ADD COLUMN "panCardUrl" TEXT;
ALTER TABLE "Vendor" ADD COLUMN "aadhaarUrl" TEXT;
ALTER TABLE "Vendor" ADD COLUMN "gstCertificateUrl" TEXT;
ALTER TABLE "Vendor" ADD COLUMN "bankProofUrl" TEXT;
ALTER TABLE "Vendor" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Vendor" ADD COLUMN "kycStatus" TEXT NOT NULL DEFAULT 'NOT_SUBMITTED';
ALTER TABLE "Vendor" ADD COLUMN "rejectionReason" TEXT;
ALTER TABLE "Vendor" ADD COLUMN "approvedAt" DATETIME;

CREATE TABLE "PasswordResetToken" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tokenHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expiresAt" DATETIME NOT NULL,
  "usedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
