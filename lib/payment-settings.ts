import { prisma } from '@/lib/prisma';

export async function getMarketplaceUpiId() {
  const envUpiId = process.env.MERCHANT_UPI_ID?.trim();

  if (envUpiId) {
    return envUpiId;
  }

  try {
    const rows = await prisma.$queryRaw<Array<{ settlementUpiId: string | null }>>`
      SELECT "settlementUpiId"
      FROM "AdminBusinessProfile"
      WHERE "id" = 'main'
      LIMIT 1
    `;

    return rows[0]?.settlementUpiId?.trim() || '';
  } catch {
    return '';
  }
}
