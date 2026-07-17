-- Zylo-Buylo sanitized production schema-only baseline for staging.
-- Source project: uvembydjrayvnrooyywl (schema metadata only; no table rows).
-- Safe write target for application: tltcnxuhrqweyxpxjdtd.
-- Do not use this file to copy production data, auth users, storage objects, OTPs,
-- customer records, order rows, bank details, wallet rows, payouts, returns or evidence.

begin;

set local search_path = public, extensions;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- Zylo-Buylo production public schema-only baseline.
-- Generated from pg_catalog/information_schema metadata only.
-- Contains no table data, auth users, OTPs, customer/order/bank/wallet/payout/return/evidence rows.

CREATE SCHEMA IF NOT EXISTS public;

DO $$ BEGIN
  CREATE TYPE "KycStatus" AS ENUM ('NOT_SUBMITTED', 'SUBMITTED', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentMethod" AS ENUM ('COD', 'UPI', 'RAZORPAY', 'STRIPE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'VENDOR', 'ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "VendorStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'INACTIVE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public."AdminBusinessProfile" (
"id" TEXT NOT NULL,
"businessName" TEXT,
"legalName" TEXT,
"brandName" TEXT,
"registeredAddress" TEXT,
"supportEmail" TEXT,
"supportPhone" TEXT,
"gstNumber" TEXT,
"panNumber" TEXT,
"cinNumber" TEXT,
"shopActNumber" TEXT,
"gstCertificateUrl" TEXT,
"panCardUrl" TEXT,
"incorporationCertificateUrl" TEXT,
"cancelledChequeUrl" TEXT,
"addressProofUrl" TEXT,
"trademarkCertificateUrl" TEXT,
"bankAccountName" TEXT,
"bankAccountNumber" TEXT,
"ifscCode" TEXT,
"bankName" TEXT,
"bankBranch" TEXT,
"settlementUpiId" TEXT,
"payoutCycle" TEXT,
"paymentNotes" TEXT,
"createdAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
"updatedAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "AdminBusinessProfile_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."Category" (
"id" TEXT NOT NULL,
"name" TEXT NOT NULL,
"slug" TEXT NOT NULL,
"status" TEXT DEFAULT 'ACTIVE'::text NOT NULL,
"sortOrder" INTEGER DEFAULT 0 NOT NULL,
"homepageIcon" TEXT,
"categoryImage" TEXT,
"desktopBanner" TEXT,
"mobileBanner" TEXT,
"altText" TEXT,
"archivedAt" TIMESTAMP(6),
CONSTRAINT "Category_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."CategoryAuditLog" (
"id" TEXT NOT NULL,
"adminUser" TEXT NOT NULL,
"action" TEXT NOT NULL,
"entityType" TEXT NOT NULL,
"entityId" TEXT,
"oldValue" JSONB,
"newValue" JSONB,
"createdAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
CONSTRAINT "CategoryAuditLog_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."CategoryUploadTemplate" (
"id" TEXT NOT NULL,
"categoryId" TEXT NOT NULL,
"subcategoryId" TEXT,
"productTypes" TEXT NOT NULL,
"specTemplate" TEXT NOT NULL,
"variantConfig" TEXT NOT NULL,
"sizeChart" TEXT,
"requiredFields" TEXT,
"createdAt" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
"updatedAt" TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
"productTypeId" TEXT,
CONSTRAINT "CategoryUploadTemplate_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."CommissionRule" (
"id" TEXT NOT NULL,
"type" TEXT NOT NULL,
"categoryId" TEXT,
"vendorId" TEXT,
"commissionPercent" DOUBLE PRECISION DEFAULT 10 NOT NULL,
"isActive" BOOLEAN DEFAULT true NOT NULL,
"createdAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
"updatedAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "CommissionRule_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."HomepageContent" (
"id" TEXT NOT NULL,
"content" TEXT NOT NULL,
"createdAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
"updatedAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "HomepageContent_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."Inventory" (
"id" TEXT NOT NULL,
"productId" TEXT NOT NULL,
"vendorId" TEXT NOT NULL,
"sku" TEXT,
"mpn" TEXT,
"currentStock" INTEGER DEFAULT 0 NOT NULL,
"reservedStock" INTEGER DEFAULT 0 NOT NULL,
"availableStock" INTEGER DEFAULT 0 NOT NULL,
"lowStockThreshold" INTEGER DEFAULT 10 NOT NULL,
"criticalStockThreshold" INTEGER DEFAULT 3 NOT NULL,
"minimumOrderQuantity" INTEGER DEFAULT 1 NOT NULL,
"maximumOrderQuantity" INTEGER,
"restockDate" TIMESTAMP(6),
"stockStatus" TEXT DEFAULT 'IN_STOCK'::text NOT NULL,
"allowBackorder" BOOLEAN DEFAULT false NOT NULL,
"isPreOrder" BOOLEAN DEFAULT false NOT NULL,
"bulkPricingTiers" JSONB,
"lastLowStockAlertAt" TIMESTAMP(6),
"lastCriticalStockAlertAt" TIMESTAMP(6),
"lastStockUpdatedAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
"createdAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
"updatedAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "Inventory_pkey" PRIMARY KEY (id),
CONSTRAINT "Inventory_productId_key" UNIQUE ("productId")
);

CREATE TABLE IF NOT EXISTS public."Notification" (
"id" TEXT NOT NULL,
"userId" TEXT NOT NULL,
"title" TEXT NOT NULL,
"message" TEXT NOT NULL,
"read" BOOLEAN DEFAULT false NOT NULL,
"createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
CONSTRAINT "Notification_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."Order" (
"id" TEXT NOT NULL,
"userId" TEXT NOT NULL,
"vendorId" TEXT,
"totalAmount" DOUBLE PRECISION NOT NULL,
"status" "OrderStatus" DEFAULT 'PENDING'::"OrderStatus" NOT NULL,
"paymentMethod" "PaymentMethod" NOT NULL,
"paymentId" TEXT,
"createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
"updatedAt" TIMESTAMP(3) NOT NULL,
"shippingName" TEXT,
"shippingPhone" TEXT,
"shippingAddress" TEXT,
"shippingCity" TEXT,
"shippingState" TEXT,
"shippingZipCode" TEXT,
"trackingNumber" TEXT,
"carrier" TEXT,
"statusNote" TEXT,
"shippedAt" TIMESTAMP(3),
"deliveredAt" TIMESTAMP(3),
"cancelledAt" TIMESTAMP(3),
CONSTRAINT "Order_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."OrderItem" (
"id" TEXT NOT NULL,
"orderId" TEXT NOT NULL,
"productId" TEXT NOT NULL,
"quantity" INTEGER NOT NULL,
"price" DOUBLE PRECISION NOT NULL,
"mrp" DOUBLE PRECISION,
"vendorPrice" DOUBLE PRECISION,
"platformCommissionAmount" DOUBLE PRECISION,
"vendorPayout" DOUBLE PRECISION,
"packagingCharge" DOUBLE PRECISION,
"shippingCharge" DOUBLE PRECISION,
"variantId" TEXT,
"sizeLabel" TEXT,
"numericSize" TEXT,
"variantColor" TEXT,
"variantSku" TEXT,
CONSTRAINT "OrderItem_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."PasswordResetToken" (
"id" TEXT NOT NULL,
"tokenHash" TEXT NOT NULL,
"userId" TEXT NOT NULL,
"expiresAt" TIMESTAMP(3) NOT NULL,
"usedAt" TIMESTAMP(3),
"createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."Product" (
"id" TEXT NOT NULL,
"name" TEXT NOT NULL,
"slug" TEXT NOT NULL,
"description" TEXT NOT NULL,
"price" DOUBLE PRECISION NOT NULL,
"sku" TEXT,
"images" JSONB NOT NULL,
"inventory" INTEGER DEFAULT 0 NOT NULL,
"vendorId" TEXT NOT NULL,
"categoryId" TEXT,
"subcategoryId" TEXT,
"createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
"updatedAt" TIMESTAMP(3) NOT NULL,
"mrp" DOUBLE PRECISION,
"vendorPrice" DOUBLE PRECISION,
"sellingPrice" DOUBLE PRECISION,
"discountPercent" DOUBLE PRECISION DEFAULT 0 NOT NULL,
"discountAmount" DOUBLE PRECISION DEFAULT 0 NOT NULL,
"platformCommissionPercent" DOUBLE PRECISION DEFAULT 10 NOT NULL,
"platformCommissionAmount" DOUBLE PRECISION DEFAULT 0 NOT NULL,
"shippingCharge" DOUBLE PRECISION DEFAULT 0 NOT NULL,
"codCharge" DOUBLE PRECISION DEFAULT 0 NOT NULL,
"finalCustomerPrice" DOUBLE PRECISION,
"vendorPayout" DOUBLE PRECISION,
"priceApproved" BOOLEAN DEFAULT false NOT NULL,
"offerStartDate" TIMESTAMP(3),
"offerEndDate" TIMESTAMP(3),
"packagingCharge" DOUBLE PRECISION DEFAULT 0 NOT NULL,
"weightGrams" DOUBLE PRECISION,
"packageSize" TEXT,
"fragile" BOOLEAN DEFAULT false NOT NULL,
"productTypeId" TEXT,
CONSTRAINT "Product_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."ProductType" (
"id" TEXT NOT NULL,
"name" TEXT NOT NULL,
"slug" TEXT NOT NULL,
"status" TEXT DEFAULT 'ACTIVE'::text NOT NULL,
"sortOrder" INTEGER DEFAULT 0 NOT NULL,
"homepageIcon" TEXT,
"categoryImage" TEXT,
"desktopBanner" TEXT,
"mobileBanner" TEXT,
"altText" TEXT,
"archivedAt" TIMESTAMP(6),
"subcategoryId" TEXT NOT NULL,
"createdAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
"updatedAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
CONSTRAINT "ProductType_pkey" PRIMARY KEY (id),
CONSTRAINT "ProductType_slug_key" UNIQUE (slug)
);

CREATE TABLE IF NOT EXISTS public."ProductVariant" (
"id" TEXT NOT NULL,
"productId" TEXT NOT NULL,
"sizeLabel" TEXT,
"numericSize" TEXT,
"color" TEXT,
"sku" TEXT,
"stockQuantity" INTEGER DEFAULT 0 NOT NULL,
"price" DOUBLE PRECISION,
"mrp" DOUBLE PRECISION,
"status" TEXT DEFAULT 'IN_STOCK'::text NOT NULL,
"lowStockThreshold" INTEGER DEFAULT 3 NOT NULL,
"createdAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
"updatedAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
"vendorPrice" DOUBLE PRECISION,
"imageUrl" TEXT,
CONSTRAINT "ProductVariant_pkey" PRIMARY KEY (id),
CONSTRAINT "ProductVariant_sku_key" UNIQUE (sku)
);

CREATE TABLE IF NOT EXISTS public."RefundAdjustment" (
"id" TEXT NOT NULL,
"vendorId" TEXT NOT NULL,
"orderId" TEXT,
"refundAmount" DOUBLE PRECISION DEFAULT 0 NOT NULL,
"reason" TEXT,
"adjustedFromPayout" BOOLEAN DEFAULT false NOT NULL,
"createdAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
"updatedAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "RefundAdjustment_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."ReturnRefundRequest" (
"id" TEXT NOT NULL,
"orderId" TEXT NOT NULL,
"userId" TEXT NOT NULL,
"reason" TEXT NOT NULL,
"status" TEXT DEFAULT 'PENDING'::text NOT NULL,
"adminNote" TEXT,
"refundReference" TEXT,
"createdAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
"updatedAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "ReturnRefundRequest_pkey" PRIMARY KEY (id),
CONSTRAINT "ReturnRefundRequest_orderId_key" UNIQUE ("orderId")
);

CREATE TABLE IF NOT EXISTS public."Review" (
"id" TEXT NOT NULL,
"userId" TEXT NOT NULL,
"productId" TEXT NOT NULL,
"rating" INTEGER NOT NULL,
"comment" TEXT,
"createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
CONSTRAINT "Review_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."SettlementReport" (
"id" TEXT NOT NULL,
"vendorId" TEXT NOT NULL,
"reportPeriod" TEXT NOT NULL,
"totalOrders" INTEGER DEFAULT 0 NOT NULL,
"grossAmount" DOUBLE PRECISION DEFAULT 0 NOT NULL,
"commissionAmount" DOUBLE PRECISION DEFAULT 0 NOT NULL,
"refundAmount" DOUBLE PRECISION DEFAULT 0 NOT NULL,
"netPayable" DOUBLE PRECISION DEFAULT 0 NOT NULL,
"status" TEXT DEFAULT 'DRAFT'::text NOT NULL,
"createdAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
"updatedAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "SettlementReport_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."StockMovement" (
"id" TEXT NOT NULL,
"productId" TEXT NOT NULL,
"vendorId" TEXT NOT NULL,
"type" TEXT NOT NULL,
"quantity" INTEGER NOT NULL,
"oldStock" INTEGER NOT NULL,
"newStock" INTEGER NOT NULL,
"reason" TEXT,
"orderId" TEXT,
"adjustedByUserId" TEXT,
"createdAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "StockMovement_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."StockReservation" (
"id" TEXT NOT NULL,
"productId" TEXT NOT NULL,
"orderId" TEXT,
"quantity" INTEGER NOT NULL,
"status" TEXT DEFAULT 'RESERVED'::text NOT NULL,
"expiresAt" TIMESTAMP(6) NOT NULL,
"createdAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
"updatedAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "StockReservation_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."Subcategory" (
"id" TEXT NOT NULL,
"name" TEXT NOT NULL,
"slug" TEXT NOT NULL,
"categoryId" TEXT NOT NULL,
"createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
"updatedAt" TIMESTAMP(3) NOT NULL,
"status" TEXT DEFAULT 'ACTIVE'::text NOT NULL,
"sortOrder" INTEGER DEFAULT 0 NOT NULL,
"homepageIcon" TEXT,
"categoryImage" TEXT,
"desktopBanner" TEXT,
"mobileBanner" TEXT,
"altText" TEXT,
"archivedAt" TIMESTAMP(6),
CONSTRAINT "Subcategory_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."User" (
"id" TEXT NOT NULL,
"email" TEXT NOT NULL,
"name" TEXT NOT NULL,
"password" TEXT NOT NULL,
"role" "UserRole" DEFAULT 'CUSTOMER'::"UserRole" NOT NULL,
"avatarUrl" TEXT,
"emailVerified" BOOLEAN DEFAULT false NOT NULL,
"emailOtpHash" TEXT,
"emailOtpExpiresAt" TIMESTAMP(3),
"failedLoginAttempts" INTEGER DEFAULT 0 NOT NULL,
"lockedUntil" TIMESTAMP(3),
"createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
"updatedAt" TIMESTAMP(3) NOT NULL,
CONSTRAINT "User_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."Vendor" (
"id" TEXT NOT NULL,
"userId" TEXT NOT NULL,
"storeName" TEXT NOT NULL,
"description" TEXT,
"logoUrl" TEXT,
"mobile" TEXT,
"businessCategory" TEXT,
"businessAddress" TEXT,
"gstNumber" TEXT,
"panNumber" TEXT,
"aadhaarNumber" TEXT,
"bankDetails" TEXT,
"upiId" TEXT,
"documentsKyc" TEXT,
"metadata" JSONB,
"panCardUrl" TEXT,
"aadhaarUrl" TEXT,
"gstCertificateUrl" TEXT,
"bankProofUrl" TEXT,
"status" "VendorStatus" DEFAULT 'PENDING'::"VendorStatus" NOT NULL,
"kycStatus" "KycStatus" DEFAULT 'NOT_SUBMITTED'::"KycStatus" NOT NULL,
"rejectionReason" TEXT,
"approvedAt" TIMESTAMP(3),
"workingHours" TEXT,
"deliveryArea" TEXT,
"createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
"updatedAt" TIMESTAMP(3) NOT NULL,
CONSTRAINT "Vendor_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."VendorBankAccount" (
"id" TEXT NOT NULL,
"vendorId" TEXT NOT NULL,
"accountHolderName" TEXT NOT NULL,
"bankName" TEXT NOT NULL,
"accountNumber" TEXT NOT NULL,
"ifscCode" TEXT NOT NULL,
"upiId" TEXT,
"panNumber" TEXT NOT NULL,
"gstNumber" TEXT,
"verificationStatus" TEXT DEFAULT 'PENDING'::text NOT NULL,
"rejectionReason" TEXT,
"verifiedAt" TIMESTAMP(6),
"createdAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
"updatedAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "VendorBankAccount_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."VendorLedger" (
"id" TEXT NOT NULL,
"vendorId" TEXT NOT NULL,
"orderId" TEXT,
"type" TEXT NOT NULL,
"creditAmount" DOUBLE PRECISION DEFAULT 0 NOT NULL,
"debitAmount" DOUBLE PRECISION DEFAULT 0 NOT NULL,
"balanceAfter" DOUBLE PRECISION DEFAULT 0 NOT NULL,
"note" TEXT,
"createdAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "VendorLedger_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."VendorPayout" (
"id" TEXT NOT NULL,
"vendorId" TEXT NOT NULL,
"payoutAmount" DOUBLE PRECISION DEFAULT 0 NOT NULL,
"payoutStatus" TEXT DEFAULT 'PENDING'::text NOT NULL,
"payoutMethod" TEXT DEFAULT 'BANK_TRANSFER'::text NOT NULL,
"bankAccountId" TEXT,
"transactionId" TEXT,
"failureReason" TEXT,
"approvedByAdminId" TEXT,
"approvedAt" TIMESTAMP(6),
"paidAt" TIMESTAMP(6),
"requestedAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
"createdAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
"updatedAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "VendorPayout_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."VendorPayoutSettlement" (
"id" TEXT NOT NULL,
"vendorId" TEXT NOT NULL,
"amount" DOUBLE PRECISION DEFAULT 0 NOT NULL,
"reference" TEXT,
"notes" TEXT,
"status" TEXT DEFAULT 'PAID'::text NOT NULL,
"paidAt" TIMESTAMP(6),
"createdAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
"updatedAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "VendorPayoutSettlement_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."VendorWallet" (
"id" TEXT NOT NULL,
"vendorId" TEXT NOT NULL,
"grossSales" DOUBLE PRECISION DEFAULT 0 NOT NULL,
"commissionDeducted" DOUBLE PRECISION DEFAULT 0 NOT NULL,
"refundDeducted" DOUBLE PRECISION DEFAULT 0 NOT NULL,
"penaltyDeducted" DOUBLE PRECISION DEFAULT 0 NOT NULL,
"availableBalance" DOUBLE PRECISION DEFAULT 0 NOT NULL,
"pendingBalance" DOUBLE PRECISION DEFAULT 0 NOT NULL,
"paidBalance" DOUBLE PRECISION DEFAULT 0 NOT NULL,
"createdAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
"updatedAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "VendorWallet_pkey" PRIMARY KEY (id),
CONSTRAINT "VendorWallet_vendorId_key" UNIQUE ("vendorId")
);

CREATE TABLE IF NOT EXISTS public."Wishlist" (
"id" TEXT NOT NULL,
"userId" TEXT NOT NULL,
"productId" TEXT NOT NULL,
"createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
CONSTRAINT "Wishlist_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."addresses" (
"id" UUID DEFAULT gen_random_uuid() NOT NULL,
"user_id" UUID NOT NULL,
"full_name" TEXT NOT NULL,
"phone" TEXT NOT NULL,
"address_line1" TEXT NOT NULL,
"address_line2" TEXT,
"city" TEXT NOT NULL,
"state" TEXT NOT NULL,
"postal_code" TEXT NOT NULL,
"country" TEXT DEFAULT 'India'::text,
"address_type" TEXT DEFAULT 'home'::text,
"is_default" BOOLEAN DEFAULT false,
"created_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT now(),
"updated_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT now(),
CONSTRAINT "addresses_address_type_check" CHECK ((address_type = ANY (ARRAY['home'::text, 'work'::text, 'other'::text]))),
CONSTRAINT "addresses_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."admin_users" (
"id" UUID DEFAULT gen_random_uuid() NOT NULL,
"user_id" UUID NOT NULL,
"role" TEXT DEFAULT 'admin'::text,
"permissions" "text"[],
"is_active" BOOLEAN DEFAULT true,
"created_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT now(),
"updated_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT now(),
CONSTRAINT "admin_users_role_check" CHECK ((role = ANY (ARRAY['super_admin'::text, 'admin'::text, 'moderator'::text]))),
CONSTRAINT "admin_users_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."categories" (
"id" UUID DEFAULT gen_random_uuid() NOT NULL,
"name" TEXT NOT NULL,
"slug" TEXT NOT NULL,
"description" TEXT,
"image_url" TEXT,
"is_active" BOOLEAN DEFAULT true,
"display_order" INTEGER DEFAULT 0,
"created_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT now(),
"updated_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT now(),
CONSTRAINT "categories_pkey" PRIMARY KEY (id),
CONSTRAINT "categories_slug_key" UNIQUE (slug)
);

CREATE TABLE IF NOT EXISTS public."category_requests" (
"id" UUID DEFAULT gen_random_uuid() NOT NULL,
"vendor_id" UUID,
"requested_category" TEXT NOT NULL,
"requested_subcategory" TEXT,
"message" TEXT,
"status" TEXT DEFAULT 'pending'::text,
"created_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT now(),
CONSTRAINT "category_requests_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."delivery_otp" (
"id" TEXT NOT NULL,
"orderId" TEXT NOT NULL,
"otp" TEXT NOT NULL,
"verified" BOOLEAN DEFAULT false NOT NULL,
"verifiedAt" TIMESTAMP(6),
"createdAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
"expiresAt" TIMESTAMP(6),
CONSTRAINT "delivery_otp_pkey" PRIMARY KEY (id),
CONSTRAINT "delivery_otp_orderId_key" UNIQUE ("orderId")
);

CREATE TABLE IF NOT EXISTS public."dispatch_images" (
"id" TEXT NOT NULL,
"orderId" TEXT NOT NULL,
"vendorId" TEXT,
"imageType" TEXT NOT NULL,
"url" TEXT NOT NULL,
"createdAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "dispatch_images_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."fraud_alerts" (
"alert_id" UUID DEFAULT uuid_generate_v4() NOT NULL,
"alert_type" TEXT NOT NULL,
"user_id" UUID,
"order_id" UUID,
"description" TEXT,
"severity" TEXT DEFAULT 'medium'::text,
"status" TEXT DEFAULT 'open'::text,
"created_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
"resolved_at" TIMESTAMP(6) WITH TIME ZONE,
CONSTRAINT "fraud_alerts_alert_type_check" CHECK ((alert_type = ANY (ARRAY['fake_order'::text, 'cod_abuse'::text, 'return_abuse'::text, 'suspicious_vendor'::text]))),
CONSTRAINT "fraud_alerts_severity_check" CHECK ((severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text]))),
CONSTRAINT "fraud_alerts_status_check" CHECK ((status = ANY (ARRAY['open'::text, 'investigating'::text, 'resolved'::text]))),
CONSTRAINT "fraud_alerts_pkey" PRIMARY KEY (alert_id)
);

CREATE TABLE IF NOT EXISTS public."import_logs" (
"log_id" UUID DEFAULT uuid_generate_v4() NOT NULL,
"import_type" TEXT NOT NULL,
"file_name" TEXT NOT NULL,
"total_records" INTEGER DEFAULT 0,
"successful_records" INTEGER DEFAULT 0,
"failed_records" INTEGER DEFAULT 0,
"error_details" JSONB,
"status" TEXT DEFAULT 'pending'::text,
"created_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
"completed_at" TIMESTAMP(6) WITH TIME ZONE,
CONSTRAINT "import_logs_import_type_check" CHECK ((import_type = ANY (ARRAY['products'::text, 'vendors'::text, 'inventory'::text, 'pricing'::text]))),
CONSTRAINT "import_logs_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'completed'::text, 'failed'::text]))),
CONSTRAINT "import_logs_pkey" PRIMARY KEY (log_id)
);

CREATE TABLE IF NOT EXISTS public."logistics" (
"shipment_id" UUID DEFAULT uuid_generate_v4() NOT NULL,
"order_id" UUID,
"shipping_partner" TEXT,
"tracking_number" TEXT,
"delivery_status" TEXT DEFAULT 'pending'::text,
"estimated_delivery" TIMESTAMP(6) WITH TIME ZONE,
"actual_delivery" TIMESTAMP(6) WITH TIME ZONE,
"created_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
"updated_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "logistics_delivery_status_check" CHECK ((delivery_status = ANY (ARRAY['pending'::text, 'in-transit'::text, 'delivered'::text, 'failed'::text]))),
CONSTRAINT "logistics_pkey" PRIMARY KEY (shipment_id),
CONSTRAINT "logistics_tracking_number_key" UNIQUE (tracking_number)
);

CREATE TABLE IF NOT EXISTS public."notifications" (
"id" UUID DEFAULT gen_random_uuid() NOT NULL,
"user_id" UUID NOT NULL,
"title" TEXT NOT NULL,
"message" TEXT NOT NULL,
"type" TEXT,
"related_id" UUID,
"is_read" BOOLEAN DEFAULT false,
"created_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT now(),
CONSTRAINT "notifications_type_check" CHECK ((type = ANY (ARRAY['order'::text, 'product'::text, 'account'::text, 'promo'::text, 'system'::text]))),
CONSTRAINT "notifications_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."open_box_verification" (
"id" TEXT NOT NULL,
"orderId" TEXT NOT NULL,
"verified" BOOLEAN DEFAULT false NOT NULL,
"productName" TEXT,
"brand" TEXT,
"size" TEXT,
"color" TEXT,
"quantity" TEXT,
"gpsLocation" TEXT,
"verifiedAt" TIMESTAMP(6),
"createdAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "open_box_verification_pkey" PRIMARY KEY (id),
CONSTRAINT "open_box_verification_orderId_key" UNIQUE ("orderId")
);

CREATE TABLE IF NOT EXISTS public."order_items" (
"id" UUID DEFAULT gen_random_uuid() NOT NULL,
"order_id" UUID NOT NULL,
"product_id" UUID NOT NULL,
"variant_id" UUID,
"product_title" TEXT NOT NULL,
"variant_details" TEXT,
"quantity" INTEGER NOT NULL,
"price" NUMERIC(10,2) NOT NULL,
"total" NUMERIC(10,2) NOT NULL,
"created_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT now(),
CONSTRAINT "order_items_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."order_verification" (
"id" TEXT NOT NULL,
"orderId" TEXT NOT NULL,
"verificationId" TEXT NOT NULL,
"openBoxEligible" BOOLEAN DEFAULT false NOT NULL,
"customerProductConfirmed" BOOLEAN DEFAULT false NOT NULL,
"correctProduct" BOOLEAN DEFAULT false NOT NULL,
"correctBrand" BOOLEAN DEFAULT false NOT NULL,
"correctSize" BOOLEAN DEFAULT false NOT NULL,
"correctColor" BOOLEAN DEFAULT false NOT NULL,
"correctQuantity" BOOLEAN DEFAULT false NOT NULL,
"verifiedDelivered" BOOLEAN DEFAULT false NOT NULL,
"verifiedAt" TIMESTAMP(6),
"createdAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
"updatedAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "order_verification_pkey" PRIMARY KEY (id),
CONSTRAINT "order_verification_orderId_key" UNIQUE ("orderId"),
CONSTRAINT "order_verification_verificationId_key" UNIQUE ("verificationId")
);

CREATE TABLE IF NOT EXISTS public."orders" (
"id" UUID DEFAULT gen_random_uuid() NOT NULL,
"order_number" TEXT NOT NULL,
"user_id" UUID NOT NULL,
"vendor_id" UUID NOT NULL,
"status" TEXT DEFAULT 'pending'::text,
"payment_status" TEXT DEFAULT 'pending'::text,
"payment_method" TEXT,
"subtotal" NUMERIC(10,2) NOT NULL,
"shipping_fee" NUMERIC(10,2) DEFAULT 0,
"tax_amount" NUMERIC(10,2) DEFAULT 0,
"discount_amount" NUMERIC(10,2) DEFAULT 0,
"total_amount" NUMERIC(10,2) NOT NULL,
"shipping_address_id" UUID,
"notes" TEXT,
"estimated_delivery" DATE,
"delivered_at" TIMESTAMP(6) WITH TIME ZONE,
"cancelled_at" TIMESTAMP(6) WITH TIME ZONE,
"cancellation_reason" TEXT,
"created_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT now(),
"updated_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT now(),
CONSTRAINT "orders_payment_method_check" CHECK ((payment_method = ANY (ARRAY['cod'::text, 'online'::text, 'wallet'::text]))),
CONSTRAINT "orders_payment_status_check" CHECK ((payment_status = ANY (ARRAY['pending'::text, 'paid'::text, 'failed'::text, 'refunded'::text]))),
CONSTRAINT "orders_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'packed'::text, 'shipped'::text, 'delivered'::text, 'cancelled'::text, 'refunded'::text]))),
CONSTRAINT "orders_pkey" PRIMARY KEY (id),
CONSTRAINT "orders_order_number_key" UNIQUE (order_number)
);

CREATE TABLE IF NOT EXISTS public."payments" (
"id" UUID DEFAULT gen_random_uuid() NOT NULL,
"order_id" UUID NOT NULL,
"payment_method" TEXT NOT NULL,
"transaction_id" TEXT,
"amount" NUMERIC(10,2) NOT NULL,
"status" TEXT DEFAULT 'pending'::text,
"gateway_response" JSONB,
"created_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT now(),
"updated_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT now(),
CONSTRAINT "payments_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'success'::text, 'failed'::text, 'refunded'::text]))),
CONSTRAINT "payments_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."product_images" (
"id" UUID DEFAULT gen_random_uuid() NOT NULL,
"product_id" UUID NOT NULL,
"image_url" TEXT NOT NULL,
"storage_path" TEXT NOT NULL,
"is_primary" BOOLEAN DEFAULT false,
"display_order" INTEGER DEFAULT 0,
"created_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT now(),
CONSTRAINT "product_images_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."product_media" (
"media_id" UUID DEFAULT uuid_generate_v4() NOT NULL,
"product_id" UUID,
"image_url" TEXT,
"video_url" TEXT,
"media_type" TEXT DEFAULT 'image'::text,
"storage_path" TEXT,
"created_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "product_media_media_type_check" CHECK ((media_type = ANY (ARRAY['image'::text, 'video'::text]))),
CONSTRAINT "product_media_pkey" PRIMARY KEY (media_id)
);

CREATE TABLE IF NOT EXISTS public."product_variants" (
"id" UUID DEFAULT gen_random_uuid() NOT NULL,
"product_id" UUID NOT NULL,
"variant_name" TEXT NOT NULL,
"variant_value" TEXT NOT NULL,
"price_adjustment" NUMERIC(10,2) DEFAULT 0,
"stock_quantity" INTEGER DEFAULT 0,
"sku" TEXT,
"is_active" BOOLEAN DEFAULT true,
"created_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT now(),
"updated_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT now(),
CONSTRAINT "product_variants_pkey" PRIMARY KEY (id),
CONSTRAINT "product_variants_sku_key" UNIQUE (sku)
);

CREATE TABLE IF NOT EXISTS public."products" (
"id" UUID DEFAULT gen_random_uuid() NOT NULL,
"vendor_id" UUID,
"category_id" UUID,
"subcategory_id" UUID,
"title" TEXT NOT NULL,
"description" TEXT,
"sku" TEXT,
"price" NUMERIC(10,2) NOT NULL,
"compare_at_price" NUMERIC(10,2),
"cost_price" NUMERIC(10,2),
"stock_quantity" INTEGER DEFAULT 0,
"low_stock_threshold" INTEGER DEFAULT 10,
"is_featured" BOOLEAN DEFAULT false,
"is_active" BOOLEAN DEFAULT true,
"approval_status" TEXT DEFAULT 'pending'::text,
"rejection_reason" TEXT,
"tags" "text"[],
"meta_title" TEXT,
"meta_description" TEXT,
"total_sales" INTEGER DEFAULT 0,
"view_count" INTEGER DEFAULT 0,
"created_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT now(),
"updated_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT now(),
"image_url" TEXT,
CONSTRAINT "products_approval_status_check" CHECK ((approval_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))),
CONSTRAINT "products_pkey" PRIMARY KEY (id),
CONSTRAINT "products_sku_key" UNIQUE (sku)
);

CREATE TABLE IF NOT EXISTS public."reseller_earnings" (
"earning_id" UUID DEFAULT uuid_generate_v4() NOT NULL,
"reseller_id" UUID,
"order_id" UUID,
"margin_amount" NUMERIC(10,2) NOT NULL,
"earning_status" TEXT DEFAULT 'pending'::text,
"created_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "reseller_earnings_earning_status_check" CHECK ((earning_status = ANY (ARRAY['pending'::text, 'completed'::text]))),
CONSTRAINT "reseller_earnings_pkey" PRIMARY KEY (earning_id)
);

CREATE TABLE IF NOT EXISTS public."reseller_profile" (
"reseller_id" UUID DEFAULT uuid_generate_v4() NOT NULL,
"linked_user_id" UUID,
"referral_code" TEXT,
"total_earnings" NUMERIC(10,2) DEFAULT 0.00,
"pending_payout" NUMERIC(10,2) DEFAULT 0.00,
"wallet_balance" NUMERIC(10,2) DEFAULT 0.00,
"status" TEXT DEFAULT 'active'::text,
"created_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
"updated_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "reseller_profile_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'suspended'::text]))),
CONSTRAINT "reseller_profile_pkey" PRIMARY KEY (reseller_id),
CONSTRAINT "reseller_profile_referral_code_key" UNIQUE (referral_code)
);

CREATE TABLE IF NOT EXISTS public."reseller_shared_products" (
"shared_id" UUID DEFAULT uuid_generate_v4() NOT NULL,
"reseller_id" UUID,
"product_id" UUID,
"reseller_margin" NUMERIC(10,2) NOT NULL,
"shared_price" NUMERIC(10,2) NOT NULL,
"share_count" INTEGER DEFAULT 0,
"created_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "reseller_shared_products_pkey" PRIMARY KEY (shared_id)
);

CREATE TABLE IF NOT EXISTS public."return_evidence" (
"id" TEXT NOT NULL,
"returnRequestId" TEXT NOT NULL,
"orderId" TEXT NOT NULL,
"evidenceType" TEXT NOT NULL,
"url" TEXT NOT NULL,
"createdAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "return_evidence_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."return_requests" (
"id" TEXT NOT NULL,
"orderId" TEXT NOT NULL,
"userId" TEXT NOT NULL,
"reason" TEXT NOT NULL,
"details" TEXT NOT NULL,
"status" TEXT DEFAULT 'PENDING'::text NOT NULL,
"riskLevel" TEXT DEFAULT 'MEDIUM'::text NOT NULL,
"riskScore" INTEGER DEFAULT 50 NOT NULL,
"createdAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
"updatedAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "return_requests_pkey" PRIMARY KEY (id),
CONSTRAINT "return_requests_orderId_key" UNIQUE ("orderId")
);

CREATE TABLE IF NOT EXISTS public."returns_refunds" (
"return_id" UUID DEFAULT uuid_generate_v4() NOT NULL,
"order_id" UUID,
"customer_id" UUID,
"reason" TEXT,
"refund_status" TEXT DEFAULT 'initiated'::text,
"investigation_status" TEXT DEFAULT 'pending'::text,
"refund_amount" NUMERIC(10,2),
"created_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
"resolved_date" TIMESTAMP(6) WITH TIME ZONE,
CONSTRAINT "returns_refunds_investigation_status_check" CHECK ((investigation_status = ANY (ARRAY['pending'::text, 'completed'::text]))),
CONSTRAINT "returns_refunds_refund_status_check" CHECK ((refund_status = ANY (ARRAY['initiated'::text, 'approved'::text, 'rejected'::text, 'completed'::text]))),
CONSTRAINT "returns_refunds_pkey" PRIMARY KEY (return_id)
);

CREATE TABLE IF NOT EXISTS public."reviews" (
"id" UUID DEFAULT gen_random_uuid() NOT NULL,
"product_id" UUID NOT NULL,
"user_id" UUID NOT NULL,
"order_id" UUID,
"rating" INTEGER NOT NULL,
"title" TEXT,
"comment" TEXT,
"images" "text"[],
"is_verified_purchase" BOOLEAN DEFAULT false,
"helpful_count" INTEGER DEFAULT 0,
"created_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT now(),
"updated_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT now(),
CONSTRAINT "reviews_rating_check" CHECK (((rating >= 1) AND (rating <= 5))),
CONSTRAINT "reviews_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."risk_assessment" (
"id" TEXT NOT NULL,
"returnRequestId" TEXT NOT NULL,
"orderId" TEXT NOT NULL,
"riskScore" INTEGER NOT NULL,
"riskLevel" TEXT NOT NULL,
"signals" TEXT NOT NULL,
"createdAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "risk_assessment_pkey" PRIMARY KEY (id),
CONSTRAINT "risk_assessment_returnRequestId_key" UNIQUE ("returnRequestId")
);

CREATE TABLE IF NOT EXISTS public."size_chart_items" (
"id" TEXT NOT NULL,
"sizeChartId" TEXT NOT NULL,
"indiaSize" TEXT,
"ukSize" TEXT,
"usSize" TEXT,
"euSize" TEXT,
"chest" TEXT,
"waist" TEXT,
"hip" TEXT,
"length" TEXT,
"footLength" TEXT,
"sortOrder" INTEGER DEFAULT 0 NOT NULL,
"createdAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "size_chart_items_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."size_charts" (
"id" TEXT NOT NULL,
"name" TEXT NOT NULL,
"category" TEXT NOT NULL,
"subcategory" TEXT,
"brand" TEXT,
"gender" TEXT,
"isActive" BOOLEAN DEFAULT true NOT NULL,
"createdAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
"updatedAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "size_charts_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."subcategories" (
"id" UUID DEFAULT gen_random_uuid() NOT NULL,
"category_id" UUID NOT NULL,
"name" TEXT NOT NULL,
"slug" TEXT NOT NULL,
"description" TEXT,
"image_url" TEXT,
"is_active" BOOLEAN DEFAULT true,
"display_order" INTEGER DEFAULT 0,
"created_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT now(),
"updated_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT now(),
CONSTRAINT "subcategories_pkey" PRIMARY KEY (id),
CONSTRAINT "subcategories_category_id_slug_key" UNIQUE (category_id, slug)
);

CREATE TABLE IF NOT EXISTS public."users" (
"id" UUID DEFAULT gen_random_uuid() NOT NULL,
"email" TEXT NOT NULL,
"full_name" TEXT NOT NULL,
"phone" TEXT,
"user_type" TEXT DEFAULT 'customer'::text NOT NULL,
"is_active" BOOLEAN DEFAULT true,
"email_verified" BOOLEAN DEFAULT false,
"created_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT now(),
"updated_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT now(),
"address" TEXT,
CONSTRAINT "users_user_type_check" CHECK ((user_type = ANY (ARRAY['customer'::text, 'seller'::text, 'admin'::text]))),
CONSTRAINT "users_pkey" PRIMARY KEY (id),
CONSTRAINT "users_email_key" UNIQUE (email),
CONSTRAINT "users_email_unique" UNIQUE (email)
);

CREATE TABLE IF NOT EXISTS public."vendor_approvals" (
"id" UUID DEFAULT gen_random_uuid() NOT NULL,
"vendor_id" UUID NOT NULL,
"reviewed_by" UUID,
"status" TEXT NOT NULL,
"comments" TEXT,
"reviewed_at" TIMESTAMP(6) WITH TIME ZONE,
"created_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT now(),
CONSTRAINT "vendor_approvals_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))),
CONSTRAINT "vendor_approvals_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."vendor_documents" (
"document_id" UUID DEFAULT uuid_generate_v4() NOT NULL,
"vendor_id" UUID,
"document_type" TEXT NOT NULL,
"document_url" TEXT NOT NULL,
"storage_path" TEXT,
"verification_status" TEXT DEFAULT 'pending'::text,
"created_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "vendor_documents_document_type_check" CHECK ((document_type = ANY (ARRAY['pan'::text, 'aadhaar'::text, 'gst'::text, 'bank'::text]))),
CONSTRAINT "vendor_documents_verification_status_check" CHECK ((verification_status = ANY (ARRAY['pending'::text, 'verified'::text, 'rejected'::text]))),
CONSTRAINT "vendor_documents_pkey" PRIMARY KEY (document_id)
);

CREATE TABLE IF NOT EXISTS public."vendor_mobile_otp" (
"id" TEXT NOT NULL,
"mobile" TEXT NOT NULL,
"otpHash" TEXT NOT NULL,
"purpose" TEXT DEFAULT 'vendor_registration'::text NOT NULL,
"attempts" INTEGER DEFAULT 0 NOT NULL,
"expiresAt" TIMESTAMP(6) NOT NULL,
"verifiedAt" TIMESTAMP(6),
"createdAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
"updatedAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "vendor_mobile_otp_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."vendor_payouts" (
"payout_id" UUID DEFAULT uuid_generate_v4() NOT NULL,
"vendor_id" UUID,
"order_id" UUID,
"payout_amount" NUMERIC(10,2) NOT NULL,
"payout_status" TEXT DEFAULT 'pending'::text,
"payout_date" TIMESTAMP(6) WITH TIME ZONE,
"created_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "vendor_payouts_payout_status_check" CHECK ((payout_status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text]))),
CONSTRAINT "vendor_payouts_pkey" PRIMARY KEY (payout_id)
);

CREATE TABLE IF NOT EXISTS public."vendor_protection_logs" (
"id" TEXT NOT NULL,
"orderId" TEXT NOT NULL,
"vendorId" TEXT,
"eventType" TEXT NOT NULL,
"message" TEXT NOT NULL,
"metadata" TEXT,
"createdAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "vendor_protection_logs_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."vendors" (
"id" UUID DEFAULT gen_random_uuid() NOT NULL,
"user_id" UUID NOT NULL,
"store_name" TEXT NOT NULL,
"store_description" TEXT,
"store_logo" TEXT,
"gst_number" TEXT,
"gst_certificate_url" TEXT,
"pan_number" TEXT,
"pan_card_url" TEXT,
"aadhar_number" TEXT,
"aadhar_card_url" TEXT,
"bank_account_number" TEXT,
"bank_ifsc_code" TEXT,
"bank_name" TEXT,
"bank_branch" TEXT,
"account_holder_name" TEXT,
"verification_status" TEXT DEFAULT 'pending'::text,
"rejection_reason" TEXT,
"is_featured" BOOLEAN DEFAULT false,
"rating" NUMERIC(3,2) DEFAULT 0.0,
"total_sales" INTEGER DEFAULT 0,
"created_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT now(),
"updated_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT now(),
"commission_rate" NUMERIC DEFAULT 15.00,
CONSTRAINT "vendors_verification_status_check" CHECK ((verification_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'blocked'::text]))),
CONSTRAINT "vendors_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."wallet_transactions" (
"transaction_id" UUID DEFAULT uuid_generate_v4() NOT NULL,
"wallet_id" UUID,
"transaction_type" TEXT NOT NULL,
"amount" NUMERIC(10,2) NOT NULL,
"description" TEXT,
"reference_id" TEXT,
"created_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "wallet_transactions_transaction_type_check" CHECK ((transaction_type = ANY (ARRAY['credit'::text, 'debit'::text]))),
CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY (transaction_id)
);

CREATE TABLE IF NOT EXISTS public."wallets" (
"wallet_id" UUID DEFAULT uuid_generate_v4() NOT NULL,
"user_id" UUID,
"wallet_type" TEXT DEFAULT 'customer'::text,
"balance" NUMERIC(10,2) DEFAULT 0.00,
"total_earned" NUMERIC(10,2) DEFAULT 0.00,
"total_spent" NUMERIC(10,2) DEFAULT 0.00,
"created_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
"updated_at" TIMESTAMP(6) WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "wallets_wallet_type_check" CHECK ((wallet_type = ANY (ARRAY['customer'::text, 'vendor'::text, 'reseller'::text]))),
CONSTRAINT "wallets_pkey" PRIMARY KEY (wallet_id)
);

ALTER TABLE public."Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE public."Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE public."Order" ADD CONSTRAINT "Order_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES public."Vendor"(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE public."OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public."Order"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE public."OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE public."PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE public."Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES public."Category"(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE public."Product" ADD CONSTRAINT "Product_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES public."Subcategory"(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE public."Product" ADD CONSTRAINT "Product_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES public."Vendor"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE public."Review" ADD CONSTRAINT "Review_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE public."Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE public."Subcategory" ADD CONSTRAINT "Subcategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES public."Category"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE public."Vendor" ADD CONSTRAINT "Vendor_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE public."Wishlist" ADD CONSTRAINT "Wishlist_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE public."Wishlist" ADD CONSTRAINT "Wishlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE public."addresses" ADD CONSTRAINT "addresses_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public."admin_users" ADD CONSTRAINT "admin_users_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public."order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
ALTER TABLE public."order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY (product_id) REFERENCES public.products(id);
ALTER TABLE public."order_items" ADD CONSTRAINT "order_items_variant_id_fkey" FOREIGN KEY (variant_id) REFERENCES public.product_variants(id);
ALTER TABLE public."orders" ADD CONSTRAINT "orders_shipping_address_id_fkey" FOREIGN KEY (shipping_address_id) REFERENCES public.addresses(id);
ALTER TABLE public."orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.users(id);
ALTER TABLE public."orders" ADD CONSTRAINT "orders_vendor_id_fkey" FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);
ALTER TABLE public."payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
ALTER TABLE public."product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
ALTER TABLE public."product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
ALTER TABLE public."products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY (category_id) REFERENCES public.categories(id);
ALTER TABLE public."products" ADD CONSTRAINT "products_subcategory_id_fkey" FOREIGN KEY (subcategory_id) REFERENCES public.subcategories(id);
ALTER TABLE public."products" ADD CONSTRAINT "products_vendor_id_fkey" FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE CASCADE;
ALTER TABLE public."reseller_earnings" ADD CONSTRAINT "reseller_earnings_reseller_id_fkey" FOREIGN KEY (reseller_id) REFERENCES public.reseller_profile(reseller_id) ON DELETE CASCADE;
ALTER TABLE public."reseller_shared_products" ADD CONSTRAINT "reseller_shared_products_reseller_id_fkey" FOREIGN KEY (reseller_id) REFERENCES public.reseller_profile(reseller_id) ON DELETE CASCADE;
ALTER TABLE public."reviews" ADD CONSTRAINT "reviews_order_id_fkey" FOREIGN KEY (order_id) REFERENCES public.orders(id);
ALTER TABLE public."reviews" ADD CONSTRAINT "reviews_product_id_fkey" FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
ALTER TABLE public."reviews" ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public."subcategories" ADD CONSTRAINT "subcategories_category_id_fkey" FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;
ALTER TABLE public."vendor_approvals" ADD CONSTRAINT "vendor_approvals_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES public.admin_users(id);
ALTER TABLE public."vendor_approvals" ADD CONSTRAINT "vendor_approvals_vendor_id_fkey" FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE CASCADE;
ALTER TABLE public."wallet_transactions" ADD CONSTRAINT "wallet_transactions_wallet_id_fkey" FOREIGN KEY (wallet_id) REFERENCES public.wallets(wallet_id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "Category_name_key" ON public."Category" USING btree (name);
CREATE UNIQUE INDEX IF NOT EXISTS "Category_slug_key" ON public."Category" USING btree (slug);
CREATE INDEX IF NOT EXISTS "Category_sortOrder_idx" ON public."Category" USING btree ("sortOrder");
CREATE INDEX IF NOT EXISTS "Category_status_idx" ON public."Category" USING btree (status);
CREATE INDEX IF NOT EXISTS "CategoryAuditLog_createdAt_idx" ON public."CategoryAuditLog" USING btree ("createdAt");
CREATE INDEX IF NOT EXISTS "CategoryAuditLog_entityId_idx" ON public."CategoryAuditLog" USING btree ("entityId");
CREATE INDEX IF NOT EXISTS "CategoryAuditLog_entityType_idx" ON public."CategoryAuditLog" USING btree ("entityType");
CREATE INDEX IF NOT EXISTS "CategoryUploadTemplate_categoryId_idx" ON public."CategoryUploadTemplate" USING btree ("categoryId");
CREATE INDEX IF NOT EXISTS "CategoryUploadTemplate_productTypeId_idx" ON public."CategoryUploadTemplate" USING btree ("productTypeId");
CREATE INDEX IF NOT EXISTS "CategoryUploadTemplate_subcategoryId_idx" ON public."CategoryUploadTemplate" USING btree ("subcategoryId");
CREATE UNIQUE INDEX IF NOT EXISTS "Inventory_productId_key" ON public."Inventory" USING btree ("productId");
CREATE INDEX IF NOT EXISTS "Inventory_stockStatus_idx" ON public."Inventory" USING btree ("stockStatus");
CREATE INDEX IF NOT EXISTS "Inventory_vendorId_idx" ON public."Inventory" USING btree ("vendorId");
CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_tokenHash_key" ON public."PasswordResetToken" USING btree ("tokenHash");
CREATE INDEX IF NOT EXISTS "Product_productTypeId_idx" ON public."Product" USING btree ("productTypeId");
CREATE UNIQUE INDEX IF NOT EXISTS "Product_sku_key" ON public."Product" USING btree (sku);
CREATE UNIQUE INDEX IF NOT EXISTS "Product_slug_key" ON public."Product" USING btree (slug);
CREATE UNIQUE INDEX IF NOT EXISTS "ProductType_slug_key" ON public."ProductType" USING btree (slug);
CREATE INDEX IF NOT EXISTS "ProductType_sortOrder_idx" ON public."ProductType" USING btree ("sortOrder");
CREATE INDEX IF NOT EXISTS "ProductType_status_idx" ON public."ProductType" USING btree (status);
CREATE INDEX IF NOT EXISTS "ProductType_subcategoryId_idx" ON public."ProductType" USING btree ("subcategoryId");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductType_subcategoryId_name_key" ON public."ProductType" USING btree ("subcategoryId", name);
CREATE INDEX IF NOT EXISTS "ProductVariant_productId_idx" ON public."ProductVariant" USING btree ("productId");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductVariant_sku_key" ON public."ProductVariant" USING btree (sku);
CREATE INDEX IF NOT EXISTS "ProductVariant_status_idx" ON public."ProductVariant" USING btree (status);
CREATE INDEX IF NOT EXISTS "ProductVariant_stockQuantity_idx" ON public."ProductVariant" USING btree ("stockQuantity");
CREATE UNIQUE INDEX IF NOT EXISTS "ReturnRefundRequest_orderId_key" ON public."ReturnRefundRequest" USING btree ("orderId");
CREATE INDEX IF NOT EXISTS "StockMovement_productId_idx" ON public."StockMovement" USING btree ("productId");
CREATE INDEX IF NOT EXISTS "StockMovement_vendorId_idx" ON public."StockMovement" USING btree ("vendorId");
CREATE INDEX IF NOT EXISTS "StockReservation_orderId_idx" ON public."StockReservation" USING btree ("orderId");
CREATE INDEX IF NOT EXISTS "StockReservation_status_idx" ON public."StockReservation" USING btree (status);
CREATE UNIQUE INDEX IF NOT EXISTS "Subcategory_categoryId_name_key" ON public."Subcategory" USING btree ("categoryId", name);
CREATE UNIQUE INDEX IF NOT EXISTS "Subcategory_slug_key" ON public."Subcategory" USING btree (slug);
CREATE INDEX IF NOT EXISTS "Subcategory_sortOrder_idx" ON public."Subcategory" USING btree ("sortOrder");
CREATE INDEX IF NOT EXISTS "Subcategory_status_idx" ON public."Subcategory" USING btree (status);
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON public."User" USING btree (email);
CREATE UNIQUE INDEX IF NOT EXISTS "Vendor_userId_key" ON public."Vendor" USING btree ("userId");
CREATE INDEX IF NOT EXISTS "VendorBankAccount_vendor_idx" ON public."VendorBankAccount" USING btree ("vendorId");
CREATE UNIQUE INDEX IF NOT EXISTS "VendorLedger_order_type_unique" ON public."VendorLedger" USING btree ("orderId", type) WHERE ("orderId" IS NOT NULL);
CREATE INDEX IF NOT EXISTS "VendorPayout_vendor_status_idx" ON public."VendorPayout" USING btree ("vendorId", "payoutStatus");
CREATE UNIQUE INDEX IF NOT EXISTS "VendorWallet_vendorId_key" ON public."VendorWallet" USING btree ("vendorId");
CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON public.addresses USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON public.admin_users USING btree (role);
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON public.admin_users USING btree (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS categories_slug_key ON public.categories USING btree (slug);
CREATE INDEX IF NOT EXISTS idx_categories_is_active ON public.categories USING btree (is_active);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON public.categories USING btree (slug);
CREATE UNIQUE INDEX IF NOT EXISTS "delivery_otp_orderId_key" ON public.delivery_otp USING btree ("orderId");
CREATE INDEX IF NOT EXISTS "dispatch_images_orderId_idx" ON public.dispatch_images USING btree ("orderId");
CREATE UNIQUE INDEX IF NOT EXISTS logistics_tracking_number_key ON public.logistics USING btree (tracking_number);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications USING btree (is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications USING btree (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS "open_box_verification_orderId_key" ON public.open_box_verification USING btree ("orderId");
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items USING btree (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items USING btree (product_id);
CREATE UNIQUE INDEX IF NOT EXISTS "order_verification_orderId_key" ON public.order_verification USING btree ("orderId");
CREATE UNIQUE INDEX IF NOT EXISTS "order_verification_verificationId_key" ON public.order_verification USING btree ("verificationId");
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders USING btree (order_number);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders USING btree (payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders USING btree (status);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_orders_vendor_id ON public.orders USING btree (vendor_id);
CREATE UNIQUE INDEX IF NOT EXISTS orders_order_number_key ON public.orders USING btree (order_number);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments USING btree (order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments USING btree (status);
CREATE INDEX IF NOT EXISTS idx_payments_transaction_id ON public.payments USING btree (transaction_id);
CREATE INDEX IF NOT EXISTS idx_product_images_is_primary ON public.product_images USING btree (is_primary);
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON public.product_images USING btree (product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON public.product_variants USING btree (product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_sku ON public.product_variants USING btree (sku);
CREATE UNIQUE INDEX IF NOT EXISTS product_variants_sku_key ON public.product_variants USING btree (sku);
CREATE INDEX IF NOT EXISTS idx_products_approval_status ON public.products USING btree (approval_status);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products USING btree (category_id);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products USING btree (is_active);
CREATE INDEX IF NOT EXISTS idx_products_is_featured ON public.products USING btree (is_featured);
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products USING btree (sku);
CREATE INDEX IF NOT EXISTS idx_products_subcategory_id ON public.products USING btree (subcategory_id);
CREATE INDEX IF NOT EXISTS idx_products_vendor_id ON public.products USING btree (vendor_id);
CREATE UNIQUE INDEX IF NOT EXISTS products_sku_key ON public.products USING btree (sku);
CREATE INDEX IF NOT EXISTS idx_reseller_earnings_reseller_id ON public.reseller_earnings USING btree (reseller_id);
CREATE UNIQUE INDEX IF NOT EXISTS reseller_profile_referral_code_key ON public.reseller_profile USING btree (referral_code);
CREATE UNIQUE INDEX IF NOT EXISTS "return_requests_orderId_key" ON public.return_requests USING btree ("orderId");
CREATE INDEX IF NOT EXISTS return_requests_status_idx ON public.return_requests USING btree (status);
CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON public.reviews USING btree (product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON public.reviews USING btree (rating);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON public.reviews USING btree (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS "risk_assessment_returnRequestId_key" ON public.risk_assessment USING btree ("returnRequestId");
CREATE INDEX IF NOT EXISTS "risk_assessment_riskLevel_idx" ON public.risk_assessment USING btree ("riskLevel");
CREATE INDEX IF NOT EXISTS idx_subcategories_category_id ON public.subcategories USING btree (category_id);
CREATE INDEX IF NOT EXISTS idx_subcategories_is_active ON public.subcategories USING btree (is_active);
CREATE INDEX IF NOT EXISTS idx_subcategories_slug ON public.subcategories USING btree (slug);
CREATE UNIQUE INDEX IF NOT EXISTS subcategories_category_id_slug_key ON public.subcategories USING btree (category_id, slug);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users USING btree (email);
CREATE INDEX IF NOT EXISTS idx_users_user_type ON public.users USING btree (user_type);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON public.users USING btree (email);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON public.users USING btree (email);
CREATE INDEX IF NOT EXISTS idx_vendor_approvals_status ON public.vendor_approvals USING btree (status);
CREATE INDEX IF NOT EXISTS idx_vendor_approvals_vendor_id ON public.vendor_approvals USING btree (vendor_id);
CREATE INDEX IF NOT EXISTS "vendor_mobile_otp_expiresAt_idx" ON public.vendor_mobile_otp USING btree ("expiresAt");
CREATE INDEX IF NOT EXISTS vendor_mobile_otp_mobile_purpose_idx ON public.vendor_mobile_otp USING btree (mobile, purpose);
CREATE INDEX IF NOT EXISTS idx_vendors_is_featured ON public.vendors USING btree (is_featured);
CREATE INDEX IF NOT EXISTS idx_vendors_user_id ON public.vendors USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_vendors_verification_status ON public.vendors USING btree (verification_status);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON public.wallet_transactions USING btree (wallet_id);

do $$
declare
  missing_tables text[];
begin
  select array_agg(table_name order by table_name)
  into missing_tables
  from unnest(array[
    '"Category"',
    '"Subcategory"',
    '"ProductType"',
    '"HomepageContent"',
    '"CategoryUploadTemplate"',
    '"CategoryAuditLog"',
    '"ProductVariant"',
    '"VendorWallet"',
    '"VendorBankAccount"',
    '"VendorPayout"',
    '"VendorPayoutSettlement"',
    '"VendorLedger"',
    '"CommissionRule"',
    '"SettlementReport"',
    '"RefundAdjustment"',
    '"Inventory"',
    '"StockMovement"',
    '"StockReservation"',
    '"AdminBusinessProfile"',
    '"ReturnRefundRequest"',
    'size_charts',
    'size_chart_items',
    'order_verification',
    'dispatch_images',
    'delivery_otp',
    'open_box_verification',
    'return_requests',
    'return_evidence',
    'risk_assessment',
    'vendor_protection_logs',
    'vendor_mobile_otp'
  ]) as required(table_name)
  where to_regclass('public.' || table_name) is null;

  if missing_tables is not null then
    raise exception 'Sanitized production schema baseline failed. Required public tables are missing: %', missing_tables;
  end if;
end $$;

commit;
