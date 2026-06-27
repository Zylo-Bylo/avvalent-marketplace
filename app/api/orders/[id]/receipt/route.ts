import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/session-cookies';

export const runtime = 'nodejs';

type BusinessProfileRow = {
  businessName?: string | null;
  legalName?: string | null;
  brandName?: string | null;
  registeredAddress?: string | null;
  supportEmail?: string | null;
  supportPhone?: string | null;
  gstNumber?: string | null;
  panNumber?: string | null;
  bankAccountName?: string | null;
  bankAccountNumber?: string | null;
  ifscCode?: string | null;
  bankName?: string | null;
  bankBranch?: string | null;
  settlementUpiId?: string | null;
};

function maskAccountNumber(value?: string | null) {
  if (!value) {
    return null;
  }

  const visible = value.slice(-4);
  return `${'*'.repeat(Math.max(0, value.length - 4))}${visible}`;
}

async function getBusinessProfile() {
  try {
    const rows = await prisma.$queryRaw<BusinessProfileRow[]>`
      SELECT
        "businessName",
        "legalName",
        "brandName",
        "registeredAddress",
        "supportEmail",
        "supportPhone",
        "gstNumber",
        "panNumber",
        "bankAccountName",
        "bankAccountNumber",
        "ifscCode",
        "bankName",
        "bankBranch",
        "settlementUpiId"
      FROM "AdminBusinessProfile"
      WHERE "id" = 'main'
      LIMIT 1
    `;

    const profile = rows[0] || {};
    return {
      businessName: profile.businessName || 'Zylo-Buylo',
      legalName: profile.legalName || profile.businessName || 'Zylo-Buylo',
      brandName: profile.brandName || 'Zylo-Buylo.com',
      registeredAddress: profile.registeredAddress || '',
      supportEmail: profile.supportEmail || '',
      supportPhone: profile.supportPhone || '',
      gstNumber: profile.gstNumber || '',
      panNumber: profile.panNumber || '',
      bankAccountName: profile.bankAccountName || '',
      bankAccountNumberMasked: maskAccountNumber(profile.bankAccountNumber),
      ifscCode: profile.ifscCode || '',
      bankName: profile.bankName || '',
      bankBranch: profile.bankBranch || '',
      settlementUpiId: profile.settlementUpiId || '',
    };
  } catch {
    return {
      businessName: 'Zylo-Buylo',
      legalName: 'Zylo-Buylo',
      brandName: 'Zylo-Buylo.com',
      registeredAddress: '',
      supportEmail: '',
      supportPhone: '',
      gstNumber: '',
      panNumber: '',
      bankAccountName: '',
      bankAccountNumberMasked: null,
      ifscCode: '',
      bankName: '',
      bankBranch: '',
      settlementUpiId: '',
    };
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await getAuthSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        vendor: {
          select: {
            id: true,
            userId: true,
            storeName: true,
            mobile: true,
            gstNumber: true,
            panNumber: true,
            businessAddress: true,
          },
        },
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                description: true,
                weightGrams: true,
                packageSize: true,
                category: {
                  select: {
                    name: true,
                  },
                },
                subcategory: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const userId = session.userId;
    const isOwner = order.userId === userId;
    const isVendor = order.vendor?.userId === userId;
    const isAdmin = Boolean(await requireAdminUser());

    if (!isOwner && !isVendor && !isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    return NextResponse.json({
      receipt: {
        order,
        business: await getBusinessProfile(),
        issuedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Receipt fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch receipt' }, { status: 500 });
  }
}
