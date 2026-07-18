import { randomInt, randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { hashToken, minutesFromNow } from '@/lib/security';

const DELIVERY_OTP_PURPOSE = 'delivery_verification';
const DELIVERY_OTP_EXPIRY_MINUTES = 15;
const DELIVERY_OTP_MAX_ATTEMPTS = 5;
const DELIVERY_OTP_RESEND_COOLDOWN_MINUTES = 2;

export const SIZE_REQUIRED_KEYWORDS = [
  'men',
  'women',
  'kids',
  'ethnic',
  'jeans',
  'trouser',
  'shirt',
  't-shirt',
  'jacket',
  'blazer',
  'suit',
  'shoe',
  'sandal',
  'slipper',
  'sports shoe',
  'safety shoe',
  'glove',
  'helmet',
  'protective',
];

export const ALLOWED_RETURN_REASONS = [
  'Manufacturing Defect',
  'Product Damaged After Opening',
  'Product Not Working',
  'Missing Parts',
  'Wrong Product Received',
  'Fake Product Suspected',
  'Warranty Issue',
  'Transit Damage Hidden Inside Package',
  'Quality Not Matching Vendor Description',
] as const;

export type AllowedReturnReason = (typeof ALLOWED_RETURN_REASONS)[number];

export function isAllowedReturnReason(
  value: unknown,
): value is AllowedReturnReason {
  return (
    typeof value === 'string' &&
    ALLOWED_RETURN_REASONS.includes(value as AllowedReturnReason)
  );
}

export function needsSizeGuide(input: {
  category?: string | null;
  subcategory?: string | null;
  productType?: string | null;
  name?: string | null;
}) {
  const text = [
    input.category,
    input.subcategory,
    input.productType,
    input.name,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return SIZE_REQUIRED_KEYWORDS.some((keyword) => text.includes(keyword));
}

export function createDispatchVerificationId(orderId: string) {
  const suffix = orderId.replace(/[^a-z0-9]/gi, '').slice(-6).toUpperCase();
  return `ZB-ORD-${suffix || randomInt(100000, 999999)}`;
}

export function createDeliveryOtp() {
  return String(randomInt(100000, 999999));
}

function createDeliveryOtpHash(orderId: string, otp: string) {
  return hashToken(`${orderId}:${otp}:${DELIVERY_OTP_PURPOSE}`);
}

function isPast(value: Date | string | null | undefined) {
  if (!value) return false;
  const date = value instanceof Date ? value : new Date(value);
  return !Number.isNaN(date.getTime()) && date.getTime() <= Date.now();
}

export function createTrustId() {
  return randomUUID();
}

export async function ensureTrustTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "size_charts" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT NOT NULL,
      "category" TEXT NOT NULL,
      "subcategory" TEXT,
      "brand" TEXT,
      "gender" TEXT,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "size_chart_items" (
      "id" TEXT PRIMARY KEY,
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
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "order_verification" (
      "id" TEXT PRIMARY KEY,
      "orderId" TEXT NOT NULL UNIQUE,
      "verificationId" TEXT NOT NULL UNIQUE,
      "openBoxEligible" BOOLEAN NOT NULL DEFAULT false,
      "customerProductConfirmed" BOOLEAN NOT NULL DEFAULT false,
      "correctProduct" BOOLEAN NOT NULL DEFAULT false,
      "correctBrand" BOOLEAN NOT NULL DEFAULT false,
      "correctSize" BOOLEAN NOT NULL DEFAULT false,
      "correctColor" BOOLEAN NOT NULL DEFAULT false,
      "correctQuantity" BOOLEAN NOT NULL DEFAULT false,
      "verifiedDelivered" BOOLEAN NOT NULL DEFAULT false,
      "verifiedAt" TIMESTAMP,
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "dispatch_images" (
      "id" TEXT PRIMARY KEY,
      "orderId" TEXT NOT NULL,
      "vendorId" TEXT,
      "imageType" TEXT NOT NULL,
      "url" TEXT NOT NULL,
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "delivery_otp" (
      "id" TEXT PRIMARY KEY,
      "orderId" TEXT NOT NULL UNIQUE,
      "otpHash" TEXT,
      "verified" BOOLEAN NOT NULL DEFAULT false,
      "attempts" INTEGER NOT NULL DEFAULT 0,
      "verifiedAt" TIMESTAMP,
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      "expiresAt" TIMESTAMP,
      "resendAvailableAt" TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(
    'ALTER TABLE "delivery_otp" ADD COLUMN IF NOT EXISTS "otpHash" TEXT',
  ).catch(() => undefined);
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "delivery_otp" ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 0',
  ).catch(() => undefined);
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "delivery_otp" ADD COLUMN IF NOT EXISTS "resendAvailableAt" TIMESTAMP',
  ).catch(() => undefined);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "open_box_verification" (
      "id" TEXT PRIMARY KEY,
      "orderId" TEXT NOT NULL UNIQUE,
      "verified" BOOLEAN NOT NULL DEFAULT false,
      "productName" TEXT,
      "brand" TEXT,
      "size" TEXT,
      "color" TEXT,
      "quantity" TEXT,
      "gpsLocation" TEXT,
      "verifiedAt" TIMESTAMP,
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "return_requests" (
      "id" TEXT PRIMARY KEY,
      "orderId" TEXT NOT NULL UNIQUE,
      "userId" TEXT NOT NULL,
      "reason" TEXT NOT NULL,
      "details" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "riskLevel" TEXT NOT NULL DEFAULT 'MEDIUM',
      "riskScore" INTEGER NOT NULL DEFAULT 50,
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "return_evidence" (
      "id" TEXT PRIMARY KEY,
      "returnRequestId" TEXT NOT NULL,
      "orderId" TEXT NOT NULL,
      "evidenceType" TEXT NOT NULL,
      "url" TEXT NOT NULL,
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "risk_assessment" (
      "id" TEXT PRIMARY KEY,
      "returnRequestId" TEXT NOT NULL UNIQUE,
      "orderId" TEXT NOT NULL,
      "riskScore" INTEGER NOT NULL,
      "riskLevel" TEXT NOT NULL,
      "signals" TEXT NOT NULL,
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "vendor_protection_logs" (
      "id" TEXT PRIMARY KEY,
      "orderId" TEXT NOT NULL,
      "vendorId" TEXT,
      "eventType" TEXT NOT NULL,
      "message" TEXT NOT NULL,
      "metadata" TEXT,
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "dispatch_images_orderId_idx" ON "dispatch_images" ("orderId")',
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "return_requests_status_idx" ON "return_requests" ("status")',
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "risk_assessment_riskLevel_idx" ON "risk_assessment" ("riskLevel")',
  );
}

export type TrustSnapshot = {
  verification: Record<string, unknown> | null;
  dispatchImages: Array<Record<string, unknown>>;
  deliveryOtp: Record<string, unknown> | null;
  openBox: Record<string, unknown> | null;
  returnRequest: Record<string, unknown> | null;
  returnEvidence: Array<Record<string, unknown>>;
  riskAssessment: Record<string, unknown> | null;
};

export async function getOrderTrustSnapshot(orderId: string): Promise<TrustSnapshot> {
  await ensureTrustTables();

  const [verificationRows, dispatchImages, deliveryOtpRows, openBoxRows, returnRows] =
    await Promise.all([
      prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT * FROM "order_verification" WHERE "orderId" = ${orderId} LIMIT 1
      `,
      prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT * FROM "dispatch_images"
        WHERE "orderId" = ${orderId}
        ORDER BY "createdAt" DESC
      `,
      prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT
          "id",
          "orderId",
          "verified",
          "attempts",
          "verifiedAt",
          "createdAt",
          "expiresAt",
          "resendAvailableAt"
        FROM "delivery_otp"
        WHERE "orderId" = ${orderId}
        LIMIT 1
      `,
      prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT * FROM "open_box_verification" WHERE "orderId" = ${orderId} LIMIT 1
      `,
      prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT * FROM "return_requests" WHERE "orderId" = ${orderId} LIMIT 1
      `,
    ]);

  const returnRequest = returnRows[0] || null;
  const returnRequestId =
    typeof returnRequest?.id === 'string' ? returnRequest.id : '';

  const [returnEvidence, riskRows] = returnRequestId
    ? await Promise.all([
        prisma.$queryRaw<Array<Record<string, unknown>>>`
          SELECT * FROM "return_evidence"
          WHERE "returnRequestId" = ${returnRequestId}
          ORDER BY "createdAt" DESC
        `,
        prisma.$queryRaw<Array<Record<string, unknown>>>`
          SELECT * FROM "risk_assessment"
          WHERE "returnRequestId" = ${returnRequestId}
          LIMIT 1
        `,
      ])
    : [[], []];

  return {
    verification: verificationRows[0] || null,
    dispatchImages,
    deliveryOtp: deliveryOtpRows[0] || null,
    openBox: openBoxRows[0] || null,
    returnRequest,
    returnEvidence,
    riskAssessment: riskRows[0] || null,
  };
}

export async function logVendorProtection(
  orderId: string,
  vendorId: string | null | undefined,
  eventType: string,
  message: string,
  metadata?: unknown,
) {
  await ensureTrustTables();
  await prisma.$executeRaw`
    INSERT INTO "vendor_protection_logs"
      ("id", "orderId", "vendorId", "eventType", "message", "metadata")
    VALUES (
      ${createTrustId()},
      ${orderId},
      ${vendorId || null},
      ${eventType},
      ${message},
      ${metadata ? JSON.stringify(metadata) : null}
    )
  `;
}

export async function saveDispatchProof(input: {
  orderId: string;
  vendorId?: string | null;
  productImages?: string[];
  packedImages?: string[];
  shippingLabelImage?: string | null;
  openBoxEligible?: boolean;
}) {
  await ensureTrustTables();

  const verificationRows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "order_verification"
    WHERE "orderId" = ${input.orderId}
    LIMIT 1
  `;
  const verificationId = createDispatchVerificationId(input.orderId);

  if (verificationRows[0]) {
    await prisma.$executeRaw`
      UPDATE "order_verification"
      SET "openBoxEligible" = ${Boolean(input.openBoxEligible)},
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "orderId" = ${input.orderId}
    `;
  } else {
    await prisma.$executeRaw`
      INSERT INTO "order_verification"
        ("id", "orderId", "verificationId", "openBoxEligible")
      VALUES (
        ${createTrustId()},
        ${input.orderId},
        ${verificationId},
        ${Boolean(input.openBoxEligible)}
      )
    `;
  }

  const images = [
    ...(input.productImages || []).map((url) => ({
      type: 'PRODUCT',
      url,
    })),
    ...(input.packedImages || []).map((url) => ({
      type: 'PACKED_PRODUCT',
      url,
    })),
    ...(input.shippingLabelImage
      ? [{ type: 'SHIPPING_LABEL', url: input.shippingLabelImage }]
      : []),
  ].filter((item) => item.url);

  for (const image of images) {
    await prisma.$executeRaw`
      INSERT INTO "dispatch_images"
        ("id", "orderId", "vendorId", "imageType", "url")
      VALUES (
        ${createTrustId()},
        ${input.orderId},
        ${input.vendorId || null},
        ${image.type},
        ${image.url}
      )
    `;
  }

  const otpRows = await prisma.$queryRaw<Array<{
    id: string;
    otpHash: string | null;
    verified: boolean;
    expiresAt: Date | string | null;
    resendAvailableAt: Date | string | null;
  }>>`
    SELECT "id", "otpHash", "verified", "expiresAt", "resendAvailableAt" FROM "delivery_otp"
    WHERE "orderId" = ${input.orderId}
    LIMIT 1
  `;

  const otpRecord = otpRows[0];
  const needsOtpRefresh =
    !otpRecord || otpRecord.verified || !otpRecord.otpHash || isPast(otpRecord.expiresAt);
  const resendAllowed = !otpRecord?.resendAvailableAt || isPast(otpRecord.resendAvailableAt);

  if (needsOtpRefresh && resendAllowed) {
    const otp = createDeliveryOtp();
    const otpHash = createDeliveryOtpHash(input.orderId, otp);
    const expiresAt = minutesFromNow(DELIVERY_OTP_EXPIRY_MINUTES);
    const resendAvailableAt = minutesFromNow(DELIVERY_OTP_RESEND_COOLDOWN_MINUTES);

    await prisma.$executeRaw`
      INSERT INTO "delivery_otp" (
        "id",
        "orderId",
        "otp",
        "otpHash",
        "verified",
        "attempts",
        "verifiedAt",
        "expiresAt",
        "resendAvailableAt",
        "createdAt"
      )
      VALUES (
        ${otpRecord?.id || createTrustId()},
        ${input.orderId},
        ${'HASH_ONLY_NO_RAW_OTP'},
        ${otpHash},
        false,
        0,
        null,
        ${expiresAt},
        ${resendAvailableAt},
        CURRENT_TIMESTAMP
      )
      ON CONFLICT ("orderId") DO UPDATE SET
        "otp" = EXCLUDED."otp",
        "otpHash" = EXCLUDED."otpHash",
        "verified" = false,
        "attempts" = 0,
        "verifiedAt" = null,
        "expiresAt" = EXCLUDED."expiresAt",
        "resendAvailableAt" = EXCLUDED."resendAvailableAt",
        "createdAt" = CURRENT_TIMESTAMP
    `;
  }

  await logVendorProtection(
    input.orderId,
    input.vendorId,
    'DISPATCH_PROOF_UPLOADED',
    'Vendor uploaded product packing proof and shipment verification details.',
    {
      imageCount: images.length,
      openBoxEligible: Boolean(input.openBoxEligible),
    },
  );
}

export async function verifyDeliveryOtpForOrder(orderId: string, rawOtp: string) {
  await ensureTrustTables();

  const otp = String(rawOtp || '').trim();
  const rows = await prisma.$queryRaw<Array<{
    id: string;
    otpHash: string | null;
    verified: boolean;
    attempts: number;
    expiresAt: Date | string | null;
  }>>`
    SELECT "id", "otpHash", "verified", "attempts", "expiresAt"
    FROM "delivery_otp"
    WHERE "orderId" = ${orderId}
    LIMIT 1
  `;
  const record = rows[0];

  if (!record) {
    return { ok: false as const, error: 'Delivery OTP is not generated for this order.' };
  }

  if (record.verified) {
    return { ok: false as const, error: 'Delivery OTP was already used.' };
  }

  if (!otp) {
    return { ok: false as const, error: 'Enter the customer delivery OTP before delivery completion.' };
  }

  if (isPast(record.expiresAt)) {
    return { ok: false as const, error: 'Delivery OTP expired. Regenerate dispatch verification.' };
  }

  if (Number(record.attempts || 0) >= DELIVERY_OTP_MAX_ATTEMPTS) {
    return { ok: false as const, error: 'Too many incorrect delivery OTP attempts.' };
  }

  if (!record.otpHash || record.otpHash !== createDeliveryOtpHash(orderId, otp)) {
    await prisma.$executeRaw`
      UPDATE "delivery_otp"
      SET "attempts" = "attempts" + 1
      WHERE "orderId" = ${orderId}
    `;
    return { ok: false as const, error: 'Correct customer delivery OTP is required before delivery completion.' };
  }

  await prisma.$executeRaw`
    UPDATE "delivery_otp"
    SET "verified" = true,
        "verifiedAt" = CURRENT_TIMESTAMP,
        "otpHash" = ${hashToken(randomUUID())}
    WHERE "orderId" = ${orderId}
  `;

  return { ok: true as const, alreadyVerified: false };
}

export function calculateReturnRisk(input: {
  hasDispatchProof: boolean;
  otpVerified: boolean;
  openBoxVerified: boolean;
  customerVerified: boolean;
  evidenceCount: number;
  reason: string;
}) {
  let score = 50;
  const signals: string[] = [];

  if (input.hasDispatchProof) {
    score += 15;
    signals.push('Dispatch proof exists');
  }
  if (input.otpVerified) {
    score += 15;
    signals.push('Delivery OTP verified');
  }
  if (input.openBoxVerified) {
    score += 15;
    signals.push('Open box delivery verified');
  }
  if (input.customerVerified) {
    score += 20;
    signals.push('Customer confirmed product match');
  }
  if (input.evidenceCount >= 3) {
    score -= 20;
    signals.push('Customer uploaded image/video evidence');
  } else {
    score += 10;
    signals.push('Evidence is incomplete');
  }
  if (
    ['Manufacturing Defect', 'Product Not Working', 'Warranty Issue'].includes(
      input.reason,
    )
  ) {
    score -= 10;
    signals.push('Reason can be genuine after delivery verification');
  }

  const boundedScore = Math.max(0, Math.min(100, score));
  return {
    riskScore: boundedScore,
    riskLevel:
      boundedScore >= 70 ? 'HIGH' : boundedScore >= 40 ? 'MEDIUM' : 'LOW',
    signals,
  };
}
