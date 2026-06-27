import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';

export const MINIMUM_PAYOUT_AMOUNT = 500;
export const RETURN_WINDOW_DAYS = 7;

export const PAYOUT_STATUSES = [
  'PENDING',
  'ON_HOLD',
  'APPROVED',
  'PROCESSING',
  'PAID',
  'FAILED',
  'REJECTED',
] as const;

export type PayoutStatusValue = (typeof PAYOUT_STATUSES)[number];

type LedgerRow = {
  id: string;
  vendorId: string;
  orderId: string | null;
  type: string;
  creditAmount: number;
  debitAmount: number;
  balanceAfter: number;
  note: string | null;
  createdAt: Date | string;
};

type PayoutRow = {
  id: string;
  vendorId: string;
  payoutAmount: number;
  payoutStatus: PayoutStatusValue;
  payoutMethod: string;
  bankAccountId: string | null;
  transactionId: string | null;
  failureReason: string | null;
  approvedByAdminId: string | null;
  approvedAt: Date | string | null;
  paidAt: Date | string | null;
  requestedAt: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
};

function numberValue(value: unknown) {
  return Number(value || 0);
}

function sevenDayCutoff() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETURN_WINDOW_DAYS);
  return cutoff;
}

async function notifyUser(userId: string | null | undefined, title: string, message: string) {
  if (!userId) {
    return;
  }

  try {
    await prisma.notification.create({
      data: {
        userId,
        title,
        message,
      },
    });
  } catch (error) {
    console.warn('Payout notification skipped:', error);
  }
}

async function notifyVendor(vendorId: string, title: string, message: string) {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { userId: true },
  });
  await notifyUser(vendor?.userId, title, message);
}

async function notifyAdmins(title: string, message: string) {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true },
  });

  await Promise.all(admins.map((admin) => notifyUser(admin.id, title, message)));
}

export async function ensurePayoutTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "VendorBankAccount" (
      "id" TEXT PRIMARY KEY,
      "vendorId" TEXT NOT NULL,
      "accountHolderName" TEXT NOT NULL,
      "bankName" TEXT NOT NULL,
      "accountNumber" TEXT NOT NULL,
      "ifscCode" TEXT NOT NULL,
      "upiId" TEXT,
      "panNumber" TEXT NOT NULL,
      "gstNumber" TEXT,
      "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING',
      "rejectionReason" TEXT,
      "verifiedAt" TIMESTAMP,
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "VendorWallet" (
      "id" TEXT PRIMARY KEY,
      "vendorId" TEXT NOT NULL UNIQUE,
      "grossSales" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "commissionDeducted" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "refundDeducted" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "penaltyDeducted" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "availableBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "pendingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "paidBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "VendorPayout" (
      "id" TEXT PRIMARY KEY,
      "vendorId" TEXT NOT NULL,
      "payoutAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "payoutStatus" TEXT NOT NULL DEFAULT 'PENDING',
      "payoutMethod" TEXT NOT NULL DEFAULT 'BANK_TRANSFER',
      "bankAccountId" TEXT,
      "transactionId" TEXT,
      "failureReason" TEXT,
      "approvedByAdminId" TEXT,
      "approvedAt" TIMESTAMP,
      "paidAt" TIMESTAMP,
      "requestedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "VendorLedger" (
      "id" TEXT PRIMARY KEY,
      "vendorId" TEXT NOT NULL,
      "orderId" TEXT,
      "type" TEXT NOT NULL,
      "creditAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "debitAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "balanceAfter" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "note" TEXT,
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CommissionRule" (
      "id" TEXT PRIMARY KEY,
      "type" TEXT NOT NULL,
      "categoryId" TEXT,
      "vendorId" TEXT,
      "commissionPercent" DOUBLE PRECISION NOT NULL DEFAULT 10,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "SettlementReport" (
      "id" TEXT PRIMARY KEY,
      "vendorId" TEXT NOT NULL,
      "reportPeriod" TEXT NOT NULL,
      "totalOrders" INTEGER NOT NULL DEFAULT 0,
      "grossAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "commissionAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "refundAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "netPayable" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "status" TEXT NOT NULL DEFAULT 'DRAFT',
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "RefundAdjustment" (
      "id" TEXT PRIMARY KEY,
      "vendorId" TEXT NOT NULL,
      "orderId" TEXT,
      "refundAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "reason" TEXT,
      "adjustedFromPayout" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "VendorLedger_order_type_unique"
    ON "VendorLedger" ("orderId", "type")
    WHERE "orderId" IS NOT NULL
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "VendorPayout_vendor_status_idx" ON "VendorPayout" ("vendorId", "payoutStatus")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "VendorBankAccount_vendor_idx" ON "VendorBankAccount" ("vendorId")`);
}

export async function ensureVendorWallet(vendorId: string) {
  await ensurePayoutTables();
  const existing = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "VendorWallet" WHERE "vendorId" = ${vendorId} LIMIT 1
  `;

  if (existing.length > 0) {
    return existing[0].id;
  }

  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO "VendorWallet" ("id", "vendorId", "createdAt", "updatedAt")
    VALUES (${id}, ${vendorId}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `;

  return id;
}

export async function getCommissionPercent(input: {
  vendorId: string;
  categoryId?: string | null;
}) {
  await ensurePayoutTables();
  const vendorRules = await prisma.$queryRaw<{ commissionPercent: number }[]>`
    SELECT "commissionPercent" FROM "CommissionRule"
    WHERE "isActive" = true AND "type" = 'VENDOR' AND "vendorId" = ${input.vendorId}
    ORDER BY "createdAt" DESC
    LIMIT 1
  `;
  if (vendorRules[0]) {
    return numberValue(vendorRules[0].commissionPercent);
  }

  if (input.categoryId) {
    const categoryRules = await prisma.$queryRaw<{ commissionPercent: number }[]>`
      SELECT "commissionPercent" FROM "CommissionRule"
      WHERE "isActive" = true AND "type" = 'CATEGORY' AND "categoryId" = ${input.categoryId}
      ORDER BY "createdAt" DESC
      LIMIT 1
    `;
    if (categoryRules[0]) {
      return numberValue(categoryRules[0].commissionPercent);
    }
  }

  const globalRules = await prisma.$queryRaw<{ commissionPercent: number }[]>`
    SELECT "commissionPercent" FROM "CommissionRule"
    WHERE "isActive" = true AND "type" = 'GLOBAL'
    ORDER BY "createdAt" DESC
    LIMIT 1
  `;

  return numberValue(globalRules[0]?.commissionPercent || 10);
}

async function getLedgerBalance(vendorId: string) {
  const rows = await prisma.$queryRaw<{ balanceAfter: number }[]>`
    SELECT "balanceAfter" FROM "VendorLedger"
    WHERE "vendorId" = ${vendorId}
    ORDER BY "createdAt" DESC
    LIMIT 1
  `;
  return numberValue(rows[0]?.balanceAfter);
}

export async function createLedgerEntry(input: {
  vendorId: string;
  orderId?: string | null;
  type: string;
  creditAmount?: number;
  debitAmount?: number;
  note?: string;
}) {
  await ensureVendorWallet(input.vendorId);
  const existing =
    input.orderId &&
    (await prisma.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "VendorLedger"
      WHERE "orderId" = ${input.orderId} AND "type" = ${input.type}
      LIMIT 1
    `);

  if (existing && existing.length > 0) {
    return existing[0].id;
  }

  const creditAmount = numberValue(input.creditAmount);
  const debitAmount = numberValue(input.debitAmount);
  const balanceAfter = Math.max(
    0,
    (await getLedgerBalance(input.vendorId)) + creditAmount - debitAmount,
  );
  const id = randomUUID();

  await prisma.$executeRaw`
    INSERT INTO "VendorLedger" (
      "id", "vendorId", "orderId", "type", "creditAmount", "debitAmount",
      "balanceAfter", "note", "createdAt"
    ) VALUES (
      ${id}, ${input.vendorId}, ${input.orderId || null}, ${input.type},
      ${creditAmount}, ${debitAmount}, ${balanceAfter}, ${input.note || null},
      CURRENT_TIMESTAMP
    )
  `;

  return id;
}

export async function rebuildVendorWallet(vendorId: string) {
  await ensureVendorWallet(vendorId);

  const orderRows = await prisma.order.findMany({
    where: {
      vendorId,
      status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] },
    },
    include: { items: true },
  });

  const ledger = await prisma.$queryRaw<LedgerRow[]>`
    SELECT * FROM "VendorLedger" WHERE "vendorId" = ${vendorId}
  `;
  const payouts = await prisma.$queryRaw<PayoutRow[]>`
    SELECT * FROM "VendorPayout" WHERE "vendorId" = ${vendorId}
  `;
  const refunds = await prisma.$queryRaw<{ refundAmount: number }[]>`
    SELECT "refundAmount" FROM "RefundAdjustment" WHERE "vendorId" = ${vendorId}
  `;

  const orderTotals = orderRows.reduce(
    (result, order) => {
      const itemTotals = order.items.reduce(
        (itemResult, item) => {
          const quantity = numberValue(item.quantity);
          return {
            grossSales: itemResult.grossSales + numberValue(item.price) * quantity,
            commission:
              itemResult.commission +
              numberValue(item.platformCommissionAmount) * quantity,
            payout:
              itemResult.payout +
              numberValue(item.vendorPayout || item.vendorPrice || item.price) * quantity,
          };
        },
        { grossSales: 0, commission: 0, payout: 0 },
      );

      return {
        grossSales: result.grossSales + itemTotals.grossSales,
        commission: result.commission + itemTotals.commission,
      };
    },
    { grossSales: 0, commission: 0 },
  );

  const releasedOrderIds = new Set(
    ledger
      .filter((entry) => entry.type === 'ORDER_AVAILABLE' && entry.orderId)
      .map((entry) => entry.orderId),
  );
  const pendingBalance = ledger
    .filter(
      (entry) =>
        entry.type === 'ORDER_PENDING' &&
        (!entry.orderId || !releasedOrderIds.has(entry.orderId)),
    )
    .reduce((sum, entry) => sum + numberValue(entry.creditAmount), 0);
  const availableCredits = ledger
    .filter((entry) => ['ORDER_AVAILABLE', 'ADJUSTMENT_CREDIT'].includes(entry.type))
    .reduce((sum, entry) => sum + numberValue(entry.creditAmount), 0);
  const debits = ledger
    .filter((entry) => entry.type !== 'ORDER_PENDING')
    .reduce((sum, entry) => sum + numberValue(entry.debitAmount), 0);
  const paidBalance = payouts
    .filter((payout) => payout.payoutStatus === 'PAID')
    .reduce((sum, payout) => sum + numberValue(payout.payoutAmount), 0);
  const heldBalance = payouts
    .filter((payout) => ['PENDING', 'APPROVED', 'PROCESSING', 'ON_HOLD'].includes(payout.payoutStatus))
    .reduce((sum, payout) => sum + numberValue(payout.payoutAmount), 0);
  const refundDeducted = refunds.reduce(
    (sum, refund) => sum + numberValue(refund.refundAmount),
    0,
  );
  const availableBalance = Math.max(0, availableCredits - debits - heldBalance);

  await prisma.$executeRaw`
    UPDATE "VendorWallet"
    SET
      "grossSales" = ${orderTotals.grossSales},
      "commissionDeducted" = ${orderTotals.commission},
      "refundDeducted" = ${refundDeducted},
      "availableBalance" = ${availableBalance},
      "pendingBalance" = ${pendingBalance},
      "paidBalance" = ${paidBalance},
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "vendorId" = ${vendorId}
  `;

  return getVendorWallet(vendorId);
}

export async function syncDeliveredOrderForPayout(orderId: string) {
  await ensurePayoutTables();
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
    },
  });

  if (!order || !order.vendorId || order.status !== 'DELIVERED') {
    return null;
  }

  const amount = order.items.reduce((sum, item) => {
    return (
      sum +
      numberValue(item.vendorPayout || item.vendorPrice || item.price) *
        numberValue(item.quantity)
    );
  }, 0);

  await createLedgerEntry({
    vendorId: order.vendorId,
    orderId: order.id,
    type: 'ORDER_PENDING',
    creditAmount: amount,
    note: `Delivered order payout on hold for ${RETURN_WINDOW_DAYS} days.`,
  });
  await rebuildVendorWallet(order.vendorId);

  return amount;
}

export async function releaseEligiblePayouts(vendorId?: string) {
  await ensurePayoutTables();
  const where: any = {
    status: 'DELIVERED',
    deliveredAt: { lte: sevenDayCutoff() },
  };

  if (vendorId) {
    where.vendorId = vendorId;
  }

  const orders = await prisma.order.findMany({
    where,
    include: { items: true },
  });

  for (const order of orders) {
    if (!order.vendorId) {
      continue;
    }

    const pendingEntry = await prisma.$queryRaw<{ id: string; creditAmount: number }[]>`
      SELECT "id", "creditAmount" FROM "VendorLedger"
      WHERE "orderId" = ${order.id} AND "type" = 'ORDER_PENDING'
      LIMIT 1
    `;
    const availableEntry = await prisma.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "VendorLedger"
      WHERE "orderId" = ${order.id} AND "type" = 'ORDER_AVAILABLE'
      LIMIT 1
    `;

    if (pendingEntry.length === 0 || availableEntry.length > 0) {
      continue;
    }

    await createLedgerEntry({
      vendorId: order.vendorId,
      orderId: order.id,
      type: 'ORDER_AVAILABLE',
      creditAmount: numberValue(pendingEntry[0].creditAmount),
      note: 'Return window completed. Payout is available.',
    });
  }

  const vendorIds = Array.from(
    new Set(orders.map((order) => order.vendorId).filter(Boolean) as string[]),
  );

  for (const id of vendorId ? [vendorId] : vendorIds) {
    await rebuildVendorWallet(id);
  }
}

export async function applyRefundAdjustment(input: {
  vendorId: string;
  orderId?: string | null;
  refundAmount: number;
  reason?: string;
}) {
  await ensurePayoutTables();
  const id = randomUUID();
  const refundAmount = numberValue(input.refundAmount);

  await prisma.$executeRaw`
    INSERT INTO "RefundAdjustment" (
      "id", "vendorId", "orderId", "refundAmount", "reason",
      "adjustedFromPayout", "createdAt", "updatedAt"
    ) VALUES (
      ${id}, ${input.vendorId}, ${input.orderId || null}, ${refundAmount},
      ${input.reason || null}, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `;
  await createLedgerEntry({
    vendorId: input.vendorId,
    orderId: input.orderId || null,
    type: 'REFUND_DEBIT',
    debitAmount: refundAmount,
    note: input.reason || 'Refund adjusted from payout.',
  });
  await rebuildVendorWallet(input.vendorId);
}

export async function getVendorWallet(vendorId: string) {
  await ensureVendorWallet(vendorId);
  const rows = await prisma.$queryRaw<any[]>`
    SELECT * FROM "VendorWallet" WHERE "vendorId" = ${vendorId} LIMIT 1
  `;
  return rows[0] || null;
}

export async function getVendorBankAccount(vendorId: string) {
  await ensurePayoutTables();
  const rows = await prisma.$queryRaw<any[]>`
    SELECT * FROM "VendorBankAccount"
    WHERE "vendorId" = ${vendorId}
    ORDER BY "createdAt" DESC
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function upsertVendorBankAccount(
  vendorId: string,
  body: Record<string, unknown>,
) {
  await ensurePayoutTables();
  const accountHolderName = String(body.accountHolderName || '').trim();
  const bankName = String(body.bankName || '').trim();
  const accountNumber = String(body.accountNumber || '').trim();
  const ifscCode = String(body.ifscCode || '').trim().toUpperCase();
  const upiId = String(body.upiId || '').trim();
  const panNumber = String(body.panNumber || '').trim().toUpperCase();
  const gstNumber = String(body.gstNumber || '').trim().toUpperCase();

  if (!accountHolderName || !bankName || !accountNumber || !ifscCode || !panNumber) {
    throw new Error('Account holder, bank, account number, IFSC and PAN are required.');
  }

  const current = await getVendorBankAccount(vendorId);
  const id = current?.id || randomUUID();

  if (current) {
    await prisma.$executeRaw`
      UPDATE "VendorBankAccount"
      SET
        "accountHolderName" = ${accountHolderName},
        "bankName" = ${bankName},
        "accountNumber" = ${accountNumber},
        "ifscCode" = ${ifscCode},
        "upiId" = ${upiId || null},
        "panNumber" = ${panNumber},
        "gstNumber" = ${gstNumber || null},
        "verificationStatus" = 'PENDING',
        "rejectionReason" = NULL,
        "verifiedAt" = NULL,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${id}
    `;
  } else {
    await prisma.$executeRaw`
      INSERT INTO "VendorBankAccount" (
        "id", "vendorId", "accountHolderName", "bankName", "accountNumber",
        "ifscCode", "upiId", "panNumber", "gstNumber", "verificationStatus",
        "createdAt", "updatedAt"
      ) VALUES (
        ${id}, ${vendorId}, ${accountHolderName}, ${bankName}, ${accountNumber},
        ${ifscCode}, ${upiId || null}, ${panNumber}, ${gstNumber || null},
        'PENDING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `;
  }

  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { storeName: true },
  });
  await notifyAdmins(
    'Bank verification pending',
    `${vendor?.storeName || 'A vendor'} updated payout bank details and needs verification.`,
  );

  return getVendorBankAccount(vendorId);
}

export async function requestVendorPayout(vendorId: string, amount: number) {
  await releaseEligiblePayouts(vendorId);
  const wallet = await rebuildVendorWallet(vendorId);
  const bank = await getVendorBankAccount(vendorId);
  const payoutAmount = numberValue(amount || wallet?.availableBalance);

  if (!bank || bank.verificationStatus !== 'VERIFIED') {
    throw new Error('Bank details must be verified before requesting payout.');
  }

  if (payoutAmount < MINIMUM_PAYOUT_AMOUNT) {
    throw new Error(`Minimum payout amount is Rs. ${MINIMUM_PAYOUT_AMOUNT}.`);
  }

  if (payoutAmount > numberValue(wallet?.availableBalance)) {
    throw new Error('Payout amount is greater than available balance.');
  }

  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO "VendorPayout" (
      "id", "vendorId", "payoutAmount", "payoutStatus", "payoutMethod",
      "bankAccountId", "requestedAt", "createdAt", "updatedAt"
    ) VALUES (
      ${id}, ${vendorId}, ${payoutAmount}, 'PENDING', 'BANK_TRANSFER',
      ${bank.id}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `;
  await rebuildVendorWallet(vendorId);
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { storeName: true },
  });
  await notifyAdmins(
    'Vendor requested payout',
    `${vendor?.storeName || 'A vendor'} requested payout of Rs. ${payoutAmount}.`,
  );

  return id;
}

export async function updatePayoutStatus(input: {
  payoutId: string;
  status: PayoutStatusValue;
  adminId?: string;
  transactionId?: string;
  failureReason?: string;
}) {
  await ensurePayoutTables();
  const payout = await prisma.$queryRaw<PayoutRow[]>`
    SELECT * FROM "VendorPayout" WHERE "id" = ${input.payoutId} LIMIT 1
  `;
  if (!payout[0]) {
    throw new Error('Payout not found.');
  }

  await prisma.$executeRaw`
    UPDATE "VendorPayout"
    SET
      "payoutStatus" = ${input.status},
      "transactionId" = ${input.transactionId || payout[0].transactionId || null},
      "failureReason" = ${input.failureReason || null},
      "approvedByAdminId" = ${
        input.status === 'APPROVED' ? input.adminId || null : payout[0].approvedByAdminId
      },
      "approvedAt" = ${
        input.status === 'APPROVED' ? new Date() : payout[0].approvedAt
      },
      "paidAt" = ${input.status === 'PAID' ? new Date() : payout[0].paidAt},
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${input.payoutId}
  `;

  if (input.status === 'PAID') {
    await createLedgerEntry({
      vendorId: payout[0].vendorId,
      type: 'PAYOUT_DEBIT',
      debitAmount: payout[0].payoutAmount,
      note: `Payout paid. Transaction: ${input.transactionId || 'N/A'}`,
    });
  }

  const notificationMap: Partial<Record<PayoutStatusValue, [string, string]>> = {
    APPROVED: [
      'Payout approved',
      `Your payout of Rs. ${numberValue(payout[0].payoutAmount)} has been approved.`,
    ],
    PROCESSING: [
      'Payout processing',
      `Your payout of Rs. ${numberValue(payout[0].payoutAmount)} is being processed.`,
    ],
    PAID: [
      'Payout released',
      `Your payout of Rs. ${numberValue(payout[0].payoutAmount)} has been paid.`,
    ],
    FAILED: [
      'Payout failed',
      input.failureReason || 'Your payout failed. Please check bank details or contact support.',
    ],
    REJECTED: [
      'Payout rejected',
      input.failureReason || 'Your payout request was rejected by admin.',
    ],
    ON_HOLD: [
      'Payout on hold',
      input.failureReason || 'Your payout is on hold for admin review.',
    ],
  };
  const notification = notificationMap[input.status];
  if (notification) {
    await notifyVendor(payout[0].vendorId, notification[0], notification[1]);
  }

  await rebuildVendorWallet(payout[0].vendorId);
}

export async function getVendorPayoutData(vendorId: string) {
  await releaseEligiblePayouts(vendorId);
  const [wallet, bank, payouts, ledger, reports, refunds] = await Promise.all([
    rebuildVendorWallet(vendorId),
    getVendorBankAccount(vendorId),
    prisma.$queryRaw<PayoutRow[]>`
      SELECT * FROM "VendorPayout" WHERE "vendorId" = ${vendorId}
      ORDER BY "createdAt" DESC
    `,
    prisma.$queryRaw<LedgerRow[]>`
      SELECT * FROM "VendorLedger" WHERE "vendorId" = ${vendorId}
      ORDER BY "createdAt" DESC
      LIMIT 200
    `,
    prisma.$queryRaw<any[]>`
      SELECT * FROM "SettlementReport" WHERE "vendorId" = ${vendorId}
      ORDER BY "createdAt" DESC
    `,
    prisma.$queryRaw<any[]>`
      SELECT * FROM "RefundAdjustment" WHERE "vendorId" = ${vendorId}
      ORDER BY "createdAt" DESC
    `,
  ]);

  const orders = await prisma.order.findMany({
    where: {
      vendorId,
      status: { in: ['PAID', 'SHIPPED', 'DELIVERED', 'RETURNED'] },
    },
    include: {
      items: {
        include: {
          product: { select: { name: true, categoryId: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return { wallet, bank, payouts, ledger, reports, refunds, orders };
}

export async function getAdminPayoutData(filters: {
  q?: string;
  status?: string;
  minAmount?: string;
}) {
  await releaseEligiblePayouts();
  await ensurePayoutTables();
  const vendors = await prisma.vendor.findMany({
    include: {
      user: { select: { id: true, name: true, email: true } },
      orders: {
        where: { status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] } },
        include: { items: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  const payouts = await prisma.$queryRaw<PayoutRow[]>`
    SELECT * FROM "VendorPayout" ORDER BY "createdAt" DESC
  `;
  const wallets = await prisma.$queryRaw<any[]>`SELECT * FROM "VendorWallet"`;
  const banks = await prisma.$queryRaw<any[]>`
    SELECT * FROM "VendorBankAccount" ORDER BY "createdAt" DESC
  `;

  const search = String(filters.q || '').trim().toLowerCase();
  const minAmount = Number(filters.minAmount || 0);

  const rows = vendors
    .map((vendor) => {
      const wallet =
        wallets.find((item) => item.vendorId === vendor.id) || {
          availableBalance: 0,
          pendingBalance: 0,
          paidBalance: 0,
          grossSales: 0,
          commissionDeducted: 0,
          refundDeducted: 0,
        };
      const bank = banks.find((item) => item.vendorId === vendor.id) || null;
      const vendorPayouts = payouts.filter((payout) => payout.vendorId === vendor.id);

      return {
        vendor: {
          id: vendor.id,
          storeName: vendor.storeName,
          status: vendor.status,
          kycStatus: vendor.kycStatus,
          mobile: vendor.mobile,
          upiId: vendor.upiId,
          bankDetails: vendor.bankDetails,
          user: vendor.user,
        },
        wallet,
        bank,
        payouts: vendorPayouts,
        pendingPayoutAmount: vendorPayouts
          .filter((payout) => payout.payoutStatus === 'PENDING')
          .reduce((sum, payout) => sum + numberValue(payout.payoutAmount), 0),
      };
    })
    .filter((row) => {
      const matchesSearch =
        !search ||
        [
          row.vendor.storeName,
          row.vendor.mobile,
          row.vendor.upiId,
          row.vendor.user?.email,
          row.vendor.user?.name,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search));
      const matchesMin =
        !minAmount || numberValue(row.wallet?.availableBalance) >= minAmount;
      return matchesSearch && matchesMin;
    });

  const filteredPayouts = payouts.filter((payout) => {
    if (filters.status && filters.status !== 'ALL') {
      return payout.payoutStatus === filters.status;
    }
    return true;
  });

  const summary = rows.reduce(
    (result, row) => ({
      grossSales: result.grossSales + numberValue(row.wallet?.grossSales),
      availableBalance:
        result.availableBalance + numberValue(row.wallet?.availableBalance),
      pendingBalance: result.pendingBalance + numberValue(row.wallet?.pendingBalance),
      paidBalance: result.paidBalance + numberValue(row.wallet?.paidBalance),
      commissionDeducted:
        result.commissionDeducted + numberValue(row.wallet?.commissionDeducted),
      refundDeducted:
        result.refundDeducted + numberValue(row.wallet?.refundDeducted),
      pendingPayouts:
        result.pendingPayouts +
        row.payouts.filter((payout) => payout.payoutStatus === 'PENDING').length,
      bankPending:
        result.bankPending +
        (row.bank?.verificationStatus === 'PENDING' ? 1 : 0),
      vendors: result.vendors + 1,
    }),
    {
      grossSales: 0,
      availableBalance: 0,
      pendingBalance: 0,
      paidBalance: 0,
      commissionDeducted: 0,
      refundDeducted: 0,
      pendingPayouts: 0,
      bankPending: 0,
      vendors: 0,
    },
  );

  return { rows, payouts: filteredPayouts, summary };
}

export function payoutRowsToCsv(rows: any[]) {
  const header = [
    'Vendor Name',
    'Order ID',
    'Product Name',
    'Gross Amount',
    'Commission %',
    'Commission Amount',
    'Refund Amount',
    'Net Payable',
    'Payout Status',
    'Transaction ID',
    'Date',
  ];
  const lines = rows.map((row) =>
    header
      .map((key) => {
        const value = row[key] ?? '';
        return `"${String(value).replace(/"/g, '""')}"`;
      })
      .join(','),
  );
  return [header.join(','), ...lines].join('\n');
}
