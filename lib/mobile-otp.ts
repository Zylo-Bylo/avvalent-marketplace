import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { signToken, verifyToken } from '@/lib/auth';
import { createOtp, hashToken, minutesFromNow } from '@/lib/security';
import { sendSms } from '@/lib/sms';

const OTP_PURPOSE = 'vendor_registration';
const OTP_EXPIRY_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;

type MobileOtpRow = {
  id: string;
  mobile: string;
  otpHash: string;
  purpose: string;
  attempts: number;
  expiresAt: Date | string;
  verifiedAt: Date | string | null;
};

function cleanMobile(value: string) {
  return String(value || '').replace(/\D/g, '').slice(-10);
}

function getOtpHash(mobile: string, otp: string, purpose: string) {
  return hashToken(`${mobile}:${otp}:${purpose}`);
}

export function normalizeMobileNumber(value: string) {
  return cleanMobile(value);
}

export function isValidMobileNumber(value: string) {
  return normalizeMobileNumber(value).length === 10;
}

export async function ensureMobileOtpSchema() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "vendor_mobile_otp" (
      "id" TEXT PRIMARY KEY,
      "mobile" TEXT NOT NULL,
      "otpHash" TEXT NOT NULL,
      "purpose" TEXT NOT NULL DEFAULT '${OTP_PURPOSE}',
      "attempts" INTEGER NOT NULL DEFAULT 0,
      "expiresAt" TIMESTAMP NOT NULL,
      "verifiedAt" TIMESTAMP,
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "vendor_mobile_otp_mobile_purpose_idx" ON "vendor_mobile_otp" ("mobile", "purpose")',
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "vendor_mobile_otp_expiresAt_idx" ON "vendor_mobile_otp" ("expiresAt")',
  );
}

export async function createAndSendVendorMobileOtp(rawMobile: string) {
  await ensureMobileOtpSchema();
  const mobile = normalizeMobileNumber(rawMobile);
  if (!isValidMobileNumber(mobile)) {
    return { ok: false as const, error: 'Please enter a valid 10 digit mobile number.' };
  }

  const otp = createOtp();
  const otpHash = getOtpHash(mobile, otp, OTP_PURPOSE);
  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO "vendor_mobile_otp" (
      "id", "mobile", "otpHash", "purpose", "expiresAt", "createdAt", "updatedAt"
    ) VALUES (
      ${id}, ${mobile}, ${otpHash}, ${OTP_PURPOSE}, ${minutesFromNow(OTP_EXPIRY_MINUTES)},
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `;

  const sms = await sendSms({
    to: mobile,
    otp,
    purpose: OTP_PURPOSE,
    message: `Your Zylo-Buylo vendor registration OTP is ${otp}. It expires in ${OTP_EXPIRY_MINUTES} minutes. Do not share it.`,
  });

  return {
    ok: true as const,
    mobile,
    smsSent: sms.sent,
    provider: sms.provider,
    smsError: sms.error,
    devOtp: process.env.NODE_ENV !== 'production' ? otp : undefined,
  };
}

export async function verifyVendorMobileOtp(rawMobile: string, rawOtp: string) {
  await ensureMobileOtpSchema();
  const mobile = normalizeMobileNumber(rawMobile);
  const otp = String(rawOtp || '').trim();

  if (!isValidMobileNumber(mobile) || !otp) {
    return { ok: false as const, error: 'Mobile number and OTP are required.' };
  }

  const rows = await prisma.$queryRaw<MobileOtpRow[]>`
    SELECT * FROM "vendor_mobile_otp"
    WHERE "mobile" = ${mobile}
      AND "purpose" = ${OTP_PURPOSE}
      AND "verifiedAt" IS NULL
      AND "expiresAt" > CURRENT_TIMESTAMP
    ORDER BY "createdAt" DESC
    LIMIT 1
  `;
  const record = rows[0];

  if (!record) {
    return { ok: false as const, error: 'OTP expired or not found. Please send OTP again.' };
  }

  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    return { ok: false as const, error: 'Too many wrong OTP attempts. Please send a new OTP.' };
  }

  if (record.otpHash !== getOtpHash(mobile, otp, OTP_PURPOSE)) {
    await prisma.$executeRaw`
      UPDATE "vendor_mobile_otp"
      SET "attempts" = "attempts" + 1, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${record.id}
    `;
    return { ok: false as const, error: 'Invalid mobile OTP.' };
  }

  await prisma.$executeRaw`
    UPDATE "vendor_mobile_otp"
    SET "verifiedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${record.id}
  `;

  const token = signToken({
    type: 'vendor_mobile_otp',
    mobile,
    purpose: OTP_PURPOSE,
    verifiedAt: new Date().toISOString(),
  });

  return { ok: true as const, mobile, token };
}

export function verifyVendorMobileOtpToken(token: string | undefined, rawMobile: string) {
  if (!token) {
    return false;
  }

  const data = verifyToken(token);
  const mobile = normalizeMobileNumber(rawMobile);
  if (
    !data ||
    data.type !== 'vendor_mobile_otp' ||
    data.purpose !== OTP_PURPOSE ||
    data.mobile !== mobile
  ) {
    return false;
  }

  const verifiedAt = new Date(String(data.verifiedAt || ''));
  if (Number.isNaN(verifiedAt.getTime())) {
    return false;
  }

  return Date.now() - verifiedAt.getTime() <= 30 * 60 * 1000;
}
