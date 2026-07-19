CREATE TABLE "AuthIdentityMapping" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "authUserId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'supabase',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AuthIdentityMapping_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AuthIdentityMapping_userId_key" ON "AuthIdentityMapping"("userId");
CREATE UNIQUE INDEX "AuthIdentityMapping_authUserId_key" ON "AuthIdentityMapping"("authUserId");
CREATE INDEX "AuthIdentityMapping_provider_idx" ON "AuthIdentityMapping"("provider");
