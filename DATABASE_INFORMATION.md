# Database Information

Secret database credentials are not shown.

## Provider

- ORM: Prisma `7.8.0`
- Local database provider: SQLite
- Local database file: `dev.db` ignored by Git
- Production recommended provider: Supabase Postgres
- Production schema switching: `scripts/prisma-schema.mjs` generates SQLite schema locally and PostgreSQL schema when `DATABASE_URL` starts with `postgresql://` or `postgres://`

## Project ID

- Supabase project ID: Not safely available from source files
- Supabase URL: Configured locally but value hidden
- Vercel project ID: Present locally but masked as `prj_KYyr****************QRfxY`
- Vercel org/team ID: Present locally but masked as `team_u65****************MTlnm`

## Database Name

- Local SQLite database: `dev.db`
- Production example database name: `postgres` or hosted Supabase Postgres database from `DATABASE_URL`

## Prisma Tables / Models

- `User`
- `Vendor`
- `Category`
- `Subcategory`
- `Product`
- `ProductVariant`
- `Inventory`
- `StockMovement`
- `Order`
- `StockReservation`
- `VendorBankAccount`
- `VendorWallet`
- `VendorPayout`
- `VendorLedger`
- `CommissionRule`
- `SettlementReport`
- `RefundAdjustment`
- `OrderItem`
- `Wishlist`
- `Review`
- `Notification`
- `PasswordResetToken`

## Prisma Enums

- `UserRole`
- `OrderStatus`
- `PaymentMethod`
- `VendorStatus`
- `KycStatus`
- `BankVerificationStatus`
- `PayoutStatus`
- `PayoutMethod`
- `LedgerEntryType`
- `CommissionRuleType`
- `SettlementReportStatus`
- `StockStatus`
- `StockMovementType`
- `StockReservationStatus`

## Storage Buckets

- Upload storage provider: Supabase Storage
- Bucket env variable: `SUPABASE_STORAGE_BUCKET`
- Default bucket name in code: `zylo-buylo-uploads`
- Allowed upload MIME types: JPEG, PNG, WebP, GIF, MP4, WebM, QuickTime video, PDF

## Authentication Providers

- Custom email/password authentication implemented in app routes
- Session tokens: JWT signed with `JWT_SECRET`
- Password hashing: bcrypt
- Email OTP: app-generated OTP, delivered by Resend when configured
- Password reset: app-generated secure token, stored as hash
- Mobile OTP: app-generated OTP, SMS provider optional
- Supabase Auth: Supabase client exists, but no Supabase Auth flow was found in app routes
- NextAuth: `NEXTAUTH_SECRET` appears in env examples, but no active NextAuth implementation was found

