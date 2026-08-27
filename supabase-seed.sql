-- Seed admin, vendor, categories, and sample products.
-- Default seeded password for admin/vendor is: password123

INSERT INTO "User" ("id", "email", "name", "password", "role", "emailVerified", "createdAt", "updatedAt") VALUES
  ('admin_zylo', 'admin@zylo-buylo.com', 'Zylo Admin', '$2b$12$6Hmw14A9D2oQblC/1Q9rFu4bZN9QVesvD8lYPS7uh0IKn7yl5lvdi', 'ADMIN', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('vendor_sample', 'vendor@zylo-buylo.com', 'Sample Vendor', '$2b$12$6Hmw14A9D2oQblC/1Q9rFu4bZN9QVesvD8lYPS7uh0IKn7yl5lvdi', 'VENDOR', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("email") DO UPDATE SET
  "name" = EXCLUDED."name",
  "password" = EXCLUDED."password",
  "role" = EXCLUDED."role",
  "emailVerified" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "Vendor" ("id", "userId", "storeName", "description", "status", "kycStatus", "approvedAt", "createdAt", "updatedAt") VALUES
  ('vendor_profile_sample', 'vendor_sample', 'Sample Store', 'A sample vendor store for testing', 'APPROVED', 'APPROVED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("userId") DO UPDATE SET
  "storeName" = EXCLUDED."storeName",
  "description" = EXCLUDED."description",
  "status" = 'APPROVED',
  "kycStatus" = 'APPROVED',
  "approvedAt" = CURRENT_TIMESTAMP,
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "Category" ("id", "name", "slug") VALUES
  ('cat_fashion', 'Fashion', 'fashion'),
  ('cat_electronics', 'Electronics', 'electronics'),
  ('cat_ac_parts', 'AC Parts', 'ac-parts'),
  ('cat_washing_parts', 'Washing Machine Parts', 'washing-machine-parts')
ON CONFLICT ("slug") DO UPDATE SET "name" = EXCLUDED."name";

INSERT INTO "Subcategory" ("id", "name", "slug", "categoryId", "createdAt", "updatedAt") VALUES
  ('sub_fashion_tshirts', 'T-Shirts', 't-shirts', 'cat_fashion', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('sub_fashion_jeans', 'Jeans', 'jeans', 'cat_fashion', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('sub_fashion_sarees', 'Sarees', 'sarees', 'cat_fashion', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('sub_fashion_kurtis', 'Kurtis', 'kurtis', 'cat_fashion', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('sub_electronics_watches', 'Watches', 'watches', 'cat_electronics', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('sub_electronics_earbuds', 'Earbuds', 'earbuds', 'cat_electronics', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('sub_electronics_mobiles', 'Mobiles', 'mobiles', 'cat_electronics', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('sub_electronics_accessories', 'Accessories', 'accessories', 'cat_electronics', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('sub_ac_compressors', 'Compressors', 'compressors', 'cat_ac_parts', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('sub_ac_cooling_coils', 'Cooling Coils', 'cooling-coils', 'cat_ac_parts', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('sub_ac_capacitors', 'Capacitors', 'capacitors', 'cat_ac_parts', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('sub_ac_remote_controls', 'Remote Controls', 'remote-controls', 'cat_ac_parts', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('sub_washing_motors', 'Motors', 'motors', 'cat_washing_parts', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('sub_washing_belts', 'Belts', 'belts', 'cat_washing_parts', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('sub_washing_drain_pumps', 'Drain Pumps', 'drain-pumps', 'cat_washing_parts', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('sub_washing_inlet_valves', 'Inlet Valves', 'inlet-valves', 'cat_washing_parts', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "categoryId" = EXCLUDED."categoryId",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "Product" ("id", "name", "slug", "description", "price", "sku", "images", "inventory", "vendorId", "categoryId", "createdAt", "updatedAt") VALUES
  ('prod_stylish_tshirt', 'Stylish T-Shirt', 'stylish-t-shirt', 'A comfortable and stylish t-shirt perfect for everyday wear.', 499, 'SEED-TSHIRT', '["/product-placeholder.svg"]'::jsonb, 50, 'vendor_profile_sample', 'cat_fashion', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('prod_blue_jeans', 'Blue Jeans', 'blue-jeans', 'Classic blue jeans with a perfect fit for all occasions.', 1299, 'SEED-JEANS', '["/product-placeholder.svg"]'::jsonb, 30, 'vendor_profile_sample', 'cat_fashion', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('prod_smart_watch', 'Smart Watch', 'smart-watch', 'Feature-packed smart watch with health tracking and notifications.', 1499, 'SEED-WATCH', '["/product-placeholder.svg"]'::jsonb, 20, 'vendor_profile_sample', 'cat_electronics', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('prod_bluetooth_earbuds', 'Bluetooth Earbuds', 'bluetooth-earbuds', 'Wireless earbuds with excellent sound quality and noise cancellation.', 1299, 'SEED-EARBUDS', '["/product-placeholder.svg"]'::jsonb, 25, 'vendor_profile_sample', 'cat_electronics', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "price" = EXCLUDED."price",
  "images" = EXCLUDED."images",
  "inventory" = EXCLUDED."inventory",
  "updatedAt" = CURRENT_TIMESTAMP;
