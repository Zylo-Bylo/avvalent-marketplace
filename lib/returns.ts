import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';

export const RETURN_STATUSES = [
  'PENDING',
  'REFUND_PENDING',
  'REJECTED',
  'REFUNDED',
] as const;

export type ReturnStatusValue = (typeof RETURN_STATUSES)[number];

export function isReturnStatus(value: unknown): value is ReturnStatusValue {
  return typeof value === 'string' && RETURN_STATUSES.includes(value as ReturnStatusValue);
}

export async function ensureReturnRefundTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ReturnRefundRequest" (
      "id" TEXT PRIMARY KEY,
      "orderId" TEXT NOT NULL UNIQUE,
      "userId" TEXT NOT NULL,
      "reason" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "adminNote" TEXT,
      "refundReference" TEXT,
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export function createReturnId() {
  return randomUUID();
}
