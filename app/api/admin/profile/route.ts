import { NextResponse } from 'next/server';
import { requireAdminApiUser } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

type AdminProfilePayload = Record<string, string | null | undefined>;

const PROFILE_ID = 'main';

const profileFields = [
  'businessName',
  'legalName',
  'brandName',
  'registeredAddress',
  'supportEmail',
  'supportPhone',
  'gstNumber',
  'panNumber',
  'cinNumber',
  'shopActNumber',
  'gstCertificateUrl',
  'panCardUrl',
  'incorporationCertificateUrl',
  'cancelledChequeUrl',
  'addressProofUrl',
  'trademarkCertificateUrl',
  'bankAccountName',
  'bankAccountNumber',
  'ifscCode',
  'bankName',
  'bankBranch',
  'settlementUpiId',
  'payoutCycle',
  'paymentNotes',
] as const;

async function ensureProfileTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AdminBusinessProfile" (
      "id" TEXT PRIMARY KEY,
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
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

function cleanPayload(body: AdminProfilePayload) {
  return Object.fromEntries(
    profileFields.map((field) => {
      const value = body[field];
      if (typeof value !== 'string') {
        return [field, null];
      }

      const trimmed = value.trim();
      return [field, trimmed ? trimmed.slice(0, 2000) : null];
    }),
  ) as Record<(typeof profileFields)[number], string | null>;
}

export async function GET() {
  const auth = await requireAdminApiUser();
  if (auth.response) return auth.response;

  await ensureProfileTable();

  const rows = await prisma.$queryRaw<Record<string, string | null>[]>`
    SELECT * FROM "AdminBusinessProfile" WHERE "id" = ${PROFILE_ID} LIMIT 1
  `;

  return NextResponse.json({
    profile: rows[0] || { id: PROFILE_ID },
  });
}

export async function POST(request: Request) {
  const auth = await requireAdminApiUser();
  if (auth.response) return auth.response;

  await ensureProfileTable();

  const body = (await request.json()) as AdminProfilePayload;
  const payload = cleanPayload(body);

  await prisma.$executeRaw`
    INSERT INTO "AdminBusinessProfile" (
      "id",
      "businessName",
      "legalName",
      "brandName",
      "registeredAddress",
      "supportEmail",
      "supportPhone",
      "gstNumber",
      "panNumber",
      "cinNumber",
      "shopActNumber",
      "gstCertificateUrl",
      "panCardUrl",
      "incorporationCertificateUrl",
      "cancelledChequeUrl",
      "addressProofUrl",
      "trademarkCertificateUrl",
      "bankAccountName",
      "bankAccountNumber",
      "ifscCode",
      "bankName",
      "bankBranch",
      "settlementUpiId",
      "payoutCycle",
      "paymentNotes",
      "updatedAt"
    ) VALUES (
      ${PROFILE_ID},
      ${payload.businessName},
      ${payload.legalName},
      ${payload.brandName},
      ${payload.registeredAddress},
      ${payload.supportEmail},
      ${payload.supportPhone},
      ${payload.gstNumber},
      ${payload.panNumber},
      ${payload.cinNumber},
      ${payload.shopActNumber},
      ${payload.gstCertificateUrl},
      ${payload.panCardUrl},
      ${payload.incorporationCertificateUrl},
      ${payload.cancelledChequeUrl},
      ${payload.addressProofUrl},
      ${payload.trademarkCertificateUrl},
      ${payload.bankAccountName},
      ${payload.bankAccountNumber},
      ${payload.ifscCode},
      ${payload.bankName},
      ${payload.bankBranch},
      ${payload.settlementUpiId},
      ${payload.payoutCycle},
      ${payload.paymentNotes},
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("id") DO UPDATE SET
      "businessName" = EXCLUDED."businessName",
      "legalName" = EXCLUDED."legalName",
      "brandName" = EXCLUDED."brandName",
      "registeredAddress" = EXCLUDED."registeredAddress",
      "supportEmail" = EXCLUDED."supportEmail",
      "supportPhone" = EXCLUDED."supportPhone",
      "gstNumber" = EXCLUDED."gstNumber",
      "panNumber" = EXCLUDED."panNumber",
      "cinNumber" = EXCLUDED."cinNumber",
      "shopActNumber" = EXCLUDED."shopActNumber",
      "gstCertificateUrl" = EXCLUDED."gstCertificateUrl",
      "panCardUrl" = EXCLUDED."panCardUrl",
      "incorporationCertificateUrl" = EXCLUDED."incorporationCertificateUrl",
      "cancelledChequeUrl" = EXCLUDED."cancelledChequeUrl",
      "addressProofUrl" = EXCLUDED."addressProofUrl",
      "trademarkCertificateUrl" = EXCLUDED."trademarkCertificateUrl",
      "bankAccountName" = EXCLUDED."bankAccountName",
      "bankAccountNumber" = EXCLUDED."bankAccountNumber",
      "ifscCode" = EXCLUDED."ifscCode",
      "bankName" = EXCLUDED."bankName",
      "bankBranch" = EXCLUDED."bankBranch",
      "settlementUpiId" = EXCLUDED."settlementUpiId",
      "payoutCycle" = EXCLUDED."payoutCycle",
      "paymentNotes" = EXCLUDED."paymentNotes",
      "updatedAt" = CURRENT_TIMESTAMP
  `;

  return NextResponse.json({
    profile: {
      id: PROFILE_ID,
      ...payload,
    },
    message: 'Admin business profile saved.',
  });
}
