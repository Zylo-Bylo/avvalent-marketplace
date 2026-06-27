import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { requireAdminUser } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/session-cookies';
import {
  PAYOUT_STATUSES,
  getAdminPayoutData,
  payoutRowsToCsv,
  rebuildVendorWallet,
  updatePayoutStatus,
  ensurePayoutTables,
} from '@/lib/payouts';

export const runtime = 'nodejs';

async function requireAdmin() {
  if (!(await requireAdminUser())) {
    return null;
  }
  const session = await getAuthSession();
  return session?.userId || null;
}

export async function GET(request: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || '';
  const data = await getAdminPayoutData({
    q: searchParams.get('q') || '',
    status: searchParams.get('status') || 'ALL',
    minAmount: searchParams.get('minAmount') || '',
  });

  if (format === 'csv' || format === 'excel') {
    const rows = data.rows.flatMap((row: any) =>
      row.payouts.length
        ? row.payouts.map((payout: any) => ({
            'Vendor Name': row.vendor.storeName,
            'Order ID': '',
            'Product Name': '',
            'Gross Amount': row.wallet?.grossSales || 0,
            'Commission %': '',
            'Commission Amount': row.wallet?.commissionDeducted || 0,
            'Refund Amount': row.wallet?.refundDeducted || 0,
            'Net Payable': payout.payoutAmount,
            'Payout Status': payout.payoutStatus,
            'Transaction ID': payout.transactionId || '',
            Date: payout.createdAt,
          }))
        : [
            {
              'Vendor Name': row.vendor.storeName,
              'Order ID': '',
              'Product Name': '',
              'Gross Amount': row.wallet?.grossSales || 0,
              'Commission %': '',
              'Commission Amount': row.wallet?.commissionDeducted || 0,
              'Refund Amount': row.wallet?.refundDeducted || 0,
              'Net Payable': row.wallet?.availableBalance || 0,
              'Payout Status': 'NO_REQUEST',
              'Transaction ID': '',
              Date: new Date().toISOString(),
            },
          ],
    );
    const csv = payoutRowsToCsv(rows);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': format === 'excel' ? 'application/vnd.ms-excel' : 'text/csv',
        'Content-Disposition': `attachment; filename="zylo-buylo-payout-report.${format === 'excel' ? 'xls' : 'csv'}"`,
      },
    });
  }

  if (format === 'pdf') {
    const html = `
      <html>
        <body>
          <h1>Zylo-Buylo Payout Report</h1>
          <table border="1" cellspacing="0" cellpadding="6">
            <tr><th>Vendor</th><th>Gross</th><th>Commission</th><th>Available</th><th>Paid</th></tr>
            ${data.rows
              .map(
                (row: any) =>
                  `<tr><td>${row.vendor.storeName}</td><td>${row.wallet?.grossSales || 0}</td><td>${row.wallet?.commissionDeducted || 0}</td><td>${row.wallet?.availableBalance || 0}</td><td>${row.wallet?.paidBalance || 0}</td></tr>`,
              )
              .join('')}
          </table>
        </body>
      </html>
    `;
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': 'attachment; filename="zylo-buylo-payout-report.html"',
      },
    });
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const adminId = await requireAdmin();
  if (!adminId) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  await ensurePayoutTables();
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || '');

  try {
    if (action === 'update-payout') {
      const payoutId = String(body.payoutId || '');
      const status = String(body.status || '');

      if (!payoutId || !PAYOUT_STATUSES.includes(status as any)) {
        return NextResponse.json({ error: 'Valid payout and status are required.' }, { status: 400 });
      }

      await updatePayoutStatus({
        payoutId,
        status: status as any,
        adminId,
        transactionId: String(body.transactionId || '').trim(),
        failureReason: String(body.failureReason || '').trim(),
      });
      const data = await getAdminPayoutData({});
      return NextResponse.json({ message: 'Payout updated.', ...data });
    }

    if (action === 'verify-bank') {
      const bankAccountId = String(body.bankAccountId || '');
      const status = String(body.status || '');
      const reason = String(body.reason || '').trim();

      if (!bankAccountId || !['VERIFIED', 'REJECTED', 'PENDING'].includes(status)) {
        return NextResponse.json({ error: 'Valid bank account and status are required.' }, { status: 400 });
      }

      await prisma.$executeRaw`
        UPDATE "VendorBankAccount"
        SET
          "verificationStatus" = ${status},
          "rejectionReason" = ${status === 'REJECTED' ? reason || 'Rejected by admin.' : null},
          "verifiedAt" = ${status === 'VERIFIED' ? new Date() : null},
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${bankAccountId}
      `;
      const bankRows = await prisma.$queryRaw<Array<{ vendorId: string }>>`
        SELECT "vendorId" FROM "VendorBankAccount" WHERE "id" = ${bankAccountId} LIMIT 1
      `;
      const vendor = bankRows[0]?.vendorId
        ? await prisma.vendor.findUnique({
            where: { id: bankRows[0].vendorId },
            select: { userId: true },
          })
        : null;
      if (vendor?.userId) {
        await prisma.notification.create({
          data: {
            userId: vendor.userId,
            title: status === 'VERIFIED' ? 'Bank details verified' : 'Bank details rejected',
            message:
              status === 'VERIFIED'
                ? 'Your payout bank details are verified. You can request eligible payouts.'
                : reason || 'Your payout bank details were rejected. Please update them.',
          },
        });
      }
      const data = await getAdminPayoutData({});
      return NextResponse.json({ message: 'Bank verification updated.', ...data });
    }

    if (action === 'create-payout') {
      const vendorId = String(body.vendorId || '');
      const amount = Number(body.amount || 0);

      if (!vendorId || !Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json({ error: 'Vendor and amount are required.' }, { status: 400 });
      }

      const bankRows = await prisma.$queryRaw<any[]>`
        SELECT * FROM "VendorBankAccount"
        WHERE "vendorId" = ${vendorId} AND "verificationStatus" = 'VERIFIED'
        ORDER BY "createdAt" DESC
        LIMIT 1
      `;
      if (!bankRows[0]) {
        return NextResponse.json({ error: 'Vendor bank account must be verified first.' }, { status: 400 });
      }

      await rebuildVendorWallet(vendorId);
      const id = randomUUID();
      await prisma.$executeRaw`
        INSERT INTO "VendorPayout" (
          "id", "vendorId", "payoutAmount", "payoutStatus", "payoutMethod",
          "bankAccountId", "approvedByAdminId", "approvedAt", "createdAt", "updatedAt"
        ) VALUES (
          ${id}, ${vendorId}, ${amount}, 'APPROVED', 'BANK_TRANSFER',
          ${bankRows[0].id}, ${adminId}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `;
      await rebuildVendorWallet(vendorId);
      const data = await getAdminPayoutData({});
      return NextResponse.json({ message: 'Admin payout created.', ...data });
    }

    return NextResponse.json({ error: 'Unsupported payout action.' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Payout action failed.' },
      { status: 400 },
    );
  }
}
