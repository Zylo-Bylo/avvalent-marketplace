import { NextResponse } from 'next/server';
import {
  createReturnId,
  ensureReturnRefundTable,
} from '@/lib/returns';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/session-cookies';
import {
  ALLOWED_RETURN_REASONS,
  calculateReturnRisk,
  ensureTrustTables,
  getOrderTrustSnapshot,
  isAllowedReturnReason,
  createTrustId,
} from '@/lib/trust';

export const runtime = 'nodejs';

type ReturnRequestRow = {
  id: string;
  orderId: string;
  userId: string;
  reason: string;
  status: string;
  adminNote: string | null;
  refundReference: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

async function getUserId() {
  const session = await getAuthSession();
  return session?.userId || null;
}

async function getExistingRequest(orderId: string) {
  await ensureReturnRefundTable();
  await ensureTrustTables();

  const rows = await prisma.$queryRaw<ReturnRequestRow[]>`
    SELECT * FROM "ReturnRefundRequest"
    WHERE "orderId" = ${orderId}
    LIMIT 1
  `;

  return rows[0] || null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });

  if (!order || order.userId !== userId) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  return NextResponse.json({ request: await getExistingRequest(id) });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  const details = typeof body.details === 'string' ? body.details.trim() : '';
  const productImages = Array.isArray(body.productImages)
    ? body.productImages.filter((url: unknown) => typeof url === 'string' && url.trim())
    : [];
  const defectImages = Array.isArray(body.defectImages)
    ? body.defectImages.filter((url: unknown) => typeof url === 'string' && url.trim())
    : [];
  const videos = Array.isArray(body.videos)
    ? body.videos.filter((url: unknown) => typeof url === 'string' && url.trim())
    : [];

  if (!isAllowedReturnReason(reason)) {
    return NextResponse.json(
      {
        error: 'Please select a genuine return reason.',
        allowedReasons: ALLOWED_RETURN_REASONS,
      },
      { status: 400 },
    );
  }

  if (details.length < 10) {
    return NextResponse.json(
      { error: 'Please explain the issue with at least 10 characters.' },
      { status: 400 },
    );
  }

  if (productImages.length === 0 || defectImages.length === 0 || videos.length === 0) {
    return NextResponse.json(
      {
        error:
          'Product image, defect image and short video evidence are mandatory for return requests.',
      },
      { status: 400 },
    );
  }

  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      status: true,
    },
  });

  if (!order || order.userId !== userId) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  if (order.status !== 'DELIVERED') {
    return NextResponse.json(
      { error: 'Return can be requested only after order is delivered.' },
      { status: 400 },
    );
  }

  const trust = await getOrderTrustSnapshot(id);
  const verification = trust.verification as
    | {
        verifiedDelivered?: boolean;
        customerProductConfirmed?: boolean;
      }
    | null;
  const deliveryVerified = Boolean(verification?.verifiedDelivered);

  if (deliveryVerified && reason === 'Wrong Product Received') {
    return NextResponse.json(
      {
        error:
          'Wrong product reason is not available because product match was already verified at delivery.',
      },
      { status: 400 },
    );
  }

  const existing = await getExistingRequest(id);
  if (existing) {
    return NextResponse.json({ request: existing }, { status: 200 });
  }

  const returnId = createReturnId();
  const risk = calculateReturnRisk({
    hasDispatchProof: trust.dispatchImages.length > 0,
    otpVerified: Boolean((trust.deliveryOtp as { verified?: boolean } | null)?.verified),
    openBoxVerified: Boolean((trust.openBox as { verified?: boolean } | null)?.verified),
    customerVerified: deliveryVerified,
    evidenceCount: productImages.length + defectImages.length + videos.length,
    reason,
  });

  await prisma.$executeRaw`
    INSERT INTO "ReturnRefundRequest" (
      "id",
      "orderId",
      "userId",
      "reason",
      "status",
      "createdAt",
      "updatedAt"
    ) VALUES (
      ${returnId},
      ${id},
      ${userId},
      ${`${reason}: ${details}`.slice(0, 2000)},
      ${'PENDING'},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  `;

  await prisma.$executeRaw`
    INSERT INTO "return_requests" (
      "id",
      "orderId",
      "userId",
      "reason",
      "details",
      "status",
      "riskLevel",
      "riskScore",
      "createdAt",
      "updatedAt"
    ) VALUES (
      ${returnId},
      ${id},
      ${userId},
      ${reason},
      ${details.slice(0, 3000)},
      ${risk.riskLevel === 'LOW' ? 'AUTO_APPROVED' : 'PENDING'},
      ${risk.riskLevel},
      ${risk.riskScore},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  `;

  for (const url of productImages) {
    await prisma.$executeRaw`
      INSERT INTO "return_evidence"
        ("id", "returnRequestId", "orderId", "evidenceType", "url")
      VALUES (${createTrustId()}, ${returnId}, ${id}, ${'PRODUCT_IMAGE'}, ${url})
    `;
  }

  for (const url of defectImages) {
    await prisma.$executeRaw`
      INSERT INTO "return_evidence"
        ("id", "returnRequestId", "orderId", "evidenceType", "url")
      VALUES (${createTrustId()}, ${returnId}, ${id}, ${'DEFECT_IMAGE'}, ${url})
    `;
  }

  for (const url of videos) {
    await prisma.$executeRaw`
      INSERT INTO "return_evidence"
        ("id", "returnRequestId", "orderId", "evidenceType", "url")
      VALUES (${createTrustId()}, ${returnId}, ${id}, ${'VIDEO'}, ${url})
    `;
  }

  await prisma.$executeRaw`
    INSERT INTO "risk_assessment" (
      "id",
      "returnRequestId",
      "orderId",
      "riskScore",
      "riskLevel",
      "signals"
    ) VALUES (
      ${createTrustId()},
      ${returnId},
      ${id},
      ${risk.riskScore},
      ${risk.riskLevel},
      ${JSON.stringify(risk.signals)}
    )
  `;

  const created = await getExistingRequest(id);

  return NextResponse.json({
    request: created,
    trust: await getOrderTrustSnapshot(id),
    message:
      risk.riskLevel === 'LOW'
        ? 'Return request submitted with low risk and marked for fast approval.'
        : 'Return request submitted. Admin/vendor will review the evidence.',
  });
}
