-- Performance indexes for storefront, dashboards, stock, and order workflows.
-- These are additive and do not change business data or behavior.

CREATE INDEX IF NOT EXISTS "Vendor_status_idx" ON "Vendor" ("status");
CREATE INDEX IF NOT EXISTS "Vendor_kycStatus_idx" ON "Vendor" ("kycStatus");
CREATE INDEX IF NOT EXISTS "Vendor_createdAt_idx" ON "Vendor" ("createdAt");

CREATE INDEX IF NOT EXISTS "Subcategory_categoryId_idx" ON "Subcategory" ("categoryId");

CREATE INDEX IF NOT EXISTS "Product_vendorId_idx" ON "Product" ("vendorId");
CREATE INDEX IF NOT EXISTS "Product_categoryId_idx" ON "Product" ("categoryId");
CREATE INDEX IF NOT EXISTS "Product_subcategoryId_idx" ON "Product" ("subcategoryId");
CREATE INDEX IF NOT EXISTS "Product_inventory_idx" ON "Product" ("inventory");
CREATE INDEX IF NOT EXISTS "Product_price_idx" ON "Product" ("price");
CREATE INDEX IF NOT EXISTS "Product_createdAt_idx" ON "Product" ("createdAt");
CREATE INDEX IF NOT EXISTS "Product_updatedAt_idx" ON "Product" ("updatedAt");

CREATE INDEX IF NOT EXISTS "Order_userId_idx" ON "Order" ("userId");
CREATE INDEX IF NOT EXISTS "Order_vendorId_idx" ON "Order" ("vendorId");
CREATE INDEX IF NOT EXISTS "Order_status_idx" ON "Order" ("status");
CREATE INDEX IF NOT EXISTS "Order_paymentMethod_idx" ON "Order" ("paymentMethod");
CREATE INDEX IF NOT EXISTS "Order_paymentId_idx" ON "Order" ("paymentId");
CREATE INDEX IF NOT EXISTS "Order_createdAt_idx" ON "Order" ("createdAt");
CREATE INDEX IF NOT EXISTS "Order_updatedAt_idx" ON "Order" ("updatedAt");

CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx" ON "OrderItem" ("orderId");
CREATE INDEX IF NOT EXISTS "OrderItem_productId_idx" ON "OrderItem" ("productId");

CREATE INDEX IF NOT EXISTS "Wishlist_userId_idx" ON "Wishlist" ("userId");
CREATE INDEX IF NOT EXISTS "Wishlist_productId_idx" ON "Wishlist" ("productId");

CREATE INDEX IF NOT EXISTS "Review_userId_idx" ON "Review" ("userId");
CREATE INDEX IF NOT EXISTS "Review_productId_idx" ON "Review" ("productId");
CREATE INDEX IF NOT EXISTS "Review_createdAt_idx" ON "Review" ("createdAt");

CREATE INDEX IF NOT EXISTS "Notification_userId_idx" ON "Notification" ("userId");
CREATE INDEX IF NOT EXISTS "Notification_read_idx" ON "Notification" ("read");
CREATE INDEX IF NOT EXISTS "Notification_createdAt_idx" ON "Notification" ("createdAt");

