import { NextResponse } from 'next/server';
import { requireAdminApiUser } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { ensureTrustTables } from '@/lib/trust';

export const runtime = 'nodejs';

export async function GET() {
  const auth = await requireAdminApiUser();
  if (auth.response) return auth.response;

  await ensureTrustTables();

  const [
    verifiedRows,
    openBoxRows,
    highRiskRows,
    returnRows,
    dispatchRows,
    logRows,
    recentReturns,
  ] = await Promise.all([
    prisma.$queryRaw<Array<{ count: bigint | number }>>`
      SELECT COUNT(*) as count FROM "order_verification"
      WHERE "verifiedDelivered" = true
    `,
    prisma.$queryRaw<Array<{ count: bigint | number }>>`
      SELECT COUNT(*) as count FROM "open_box_verification"
      WHERE "verified" = true
    `,
    prisma.$queryRaw<Array<{ count: bigint | number }>>`
      SELECT COUNT(*) as count FROM "risk_assessment"
      WHERE "riskLevel" = 'HIGH'
    `,
    prisma.$queryRaw<Array<{ count: bigint | number }>>`
      SELECT COUNT(*) as count FROM "return_requests"
    `,
    prisma.$queryRaw<Array<{ count: bigint | number }>>`
      SELECT COUNT(DISTINCT "orderId") as count FROM "dispatch_images"
    `,
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT * FROM "vendor_protection_logs"
      ORDER BY "createdAt" DESC
      LIMIT 20
    `,
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT rr.*, ra."signals"
      FROM "return_requests" rr
      LEFT JOIN "risk_assessment" ra ON ra."returnRequestId" = rr."id"
      ORDER BY rr."createdAt" DESC
      LIMIT 20
    `,
  ]);

  const count = (rows: Array<{ count: bigint | number }>) =>
    Number(rows[0]?.count || 0);

  return NextResponse.json({
    summary: {
      verifiedOrders: count(verifiedRows),
      openBoxOrders: count(openBoxRows),
      highRiskReturns: count(highRiskRows),
      totalReturns: count(returnRows),
      dispatchProofOrders: count(dispatchRows),
      vendorDisputes: count(highRiskRows),
    },
    recentProtectionLogs: logRows,
    recentReturns,
  });
}
