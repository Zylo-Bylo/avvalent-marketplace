CREATE TABLE "VendorContactPerson" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "designation" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VendorContactPerson_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "VendorAddress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vendorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "landmark" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'India',
    "contactName" TEXT,
    "contactPhone" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VendorAddress_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "VendorKycDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vendorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "documentNumberMasked" TEXT,
    "storagePath" TEXT,
    "mimeType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "verifiedById" TEXT,
    "verifiedAt" DATETIME,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VendorKycDocument_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VendorKycDocument_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "VendorVerificationEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vendorId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "previousStatus" TEXT,
    "newStatus" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VendorVerificationEvent_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VendorVerificationEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "VendorSuspensionEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vendorId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "startsAt" DATETIME,
    "endsAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VendorSuspensionEvent_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VendorSuspensionEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "VendorContactPerson_vendorId_idx" ON "VendorContactPerson"("vendorId");
CREATE INDEX "VendorContactPerson_vendorId_isPrimary_idx" ON "VendorContactPerson"("vendorId", "isPrimary");
CREATE INDEX "VendorContactPerson_vendorId_isActive_idx" ON "VendorContactPerson"("vendorId", "isActive");
CREATE INDEX "VendorContactPerson_createdAt_idx" ON "VendorContactPerson"("createdAt");

CREATE INDEX "VendorAddress_vendorId_idx" ON "VendorAddress"("vendorId");
CREATE INDEX "VendorAddress_vendorId_type_idx" ON "VendorAddress"("vendorId", "type");
CREATE INDEX "VendorAddress_vendorId_type_isDefault_idx" ON "VendorAddress"("vendorId", "type", "isDefault");
CREATE INDEX "VendorAddress_vendorId_isActive_idx" ON "VendorAddress"("vendorId", "isActive");
CREATE INDEX "VendorAddress_createdAt_idx" ON "VendorAddress"("createdAt");

CREATE INDEX "VendorKycDocument_vendorId_idx" ON "VendorKycDocument"("vendorId");
CREATE INDEX "VendorKycDocument_vendorId_type_idx" ON "VendorKycDocument"("vendorId", "type");
CREATE INDEX "VendorKycDocument_status_idx" ON "VendorKycDocument"("status");
CREATE INDEX "VendorKycDocument_createdAt_idx" ON "VendorKycDocument"("createdAt");

CREATE INDEX "VendorVerificationEvent_vendorId_idx" ON "VendorVerificationEvent"("vendorId");
CREATE INDEX "VendorVerificationEvent_actorUserId_idx" ON "VendorVerificationEvent"("actorUserId");
CREATE INDEX "VendorVerificationEvent_newStatus_idx" ON "VendorVerificationEvent"("newStatus");
CREATE INDEX "VendorVerificationEvent_createdAt_idx" ON "VendorVerificationEvent"("createdAt");

CREATE INDEX "VendorSuspensionEvent_vendorId_idx" ON "VendorSuspensionEvent"("vendorId");
CREATE INDEX "VendorSuspensionEvent_actorUserId_idx" ON "VendorSuspensionEvent"("actorUserId");
CREATE INDEX "VendorSuspensionEvent_action_idx" ON "VendorSuspensionEvent"("action");
CREATE INDEX "VendorSuspensionEvent_createdAt_idx" ON "VendorSuspensionEvent"("createdAt");
