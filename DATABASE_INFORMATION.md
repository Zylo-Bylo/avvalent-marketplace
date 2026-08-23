# Database Information

Secret database credentials are not shown.

## Provider

- ORM: Prisma `7.8.0`
- Local database provider: SQLite
- Local database file: `dev.db` ignored by Git
- Production recommended provider: Supabase Postgres
- Production application runtime: Supabase Transaction Pooler on port `6543` through `DATABASE_URL`
- Runtime pool: one shared `pg.Pool` per warm application instance, default `DB_POOL_MAX=2`
- Pool timeouts: 5 seconds for idle connections and 5 seconds while acquiring a connection
- `DB_POOL_MAX` accepts whole numbers from 1 through 10; missing or invalid values safely fall back to 2
- Migration/admin tooling: optional `DIRECT_DATABASE_URL` uses an approved direct or session connection, independently from the application runtime URL
- Production schema switching: `scripts/prisma-schema.mjs` generates SQLite locally and PostgreSQL when `DIRECT_DATABASE_URL` or `DATABASE_URL` starts with `postgresql://` or `postgres://`

## Connection URL Contract

- `DATABASE_URL` is the application-runtime connection only. For Vercel, its expected non-secret characteristics are a Supabase pooler host, port `6543`, transaction pooling, TLS, and `pgbouncer=true`.
- `DB_POOL_MAX` bounds each warm application instance's client-side `pg.Pool`; the conservative default is `2`.
- `DIRECT_DATABASE_URL` is optional and is read by Prisma CLI/schema tooling before `DATABASE_URL`. It must not be imported by application query code.
- Prisma migrations and administrative schema work must use `DIRECT_DATABASE_URL` when transaction-pooler compatibility is unsuitable. Runtime queries and ordinary Prisma transactions continue through `DATABASE_URL`.
- Real URLs, project references, usernames, passwords, and tokens must remain only in approved secret stores or untracked environment files.

## Transaction Pooler Compatibility

- Prisma 7 and `@prisma/adapter-pg` receive the explicit shared `pg.Pool`; no request handler constructs its own client or pool.
- Use `pgbouncer=true` on the approved transaction-pooler runtime URL so Prisma uses pooler-compatible behavior. Prepared-statement behavior must be verified against the approved Preview pooler before production promotion.
- Ordinary application queries and Prisma interactive/batch transactions are expected runtime operations. Session-scoped features such as temporary tables, session `SET` state, advisory locks tied to one session, and `LISTEN`/`NOTIFY` must not be introduced on the transaction-pooled path.
- Prisma schema migrations, migration history work, and other administrative schema operations use `DIRECT_DATABASE_URL`, not the transaction-pooled runtime URL.
- The existing repository query audit found no application-runtime `PrismaClient`, `PrismaPg`, or `pg.Pool` constructors outside `lib/prisma.ts`. `scripts/diagnose-staging-pooler.mjs` remains an isolated, explicitly invoked diagnostic client and is not bundled into Vercel request handling.

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

