import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getOrderStatusUpdateData } from '@/lib/order-status';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/session-cookies';
import { syncDeliveredOrderForPayout } from '@/lib/payouts';
import {
  ensureTrustTables,
  getOrderTrustSnapshot,
  logVendorProtection,
  verifyDeliveryOtpForOrder,
} from '@/lib/trust';

export const runtime = 'nodejs';

async function getAccessibleOrder(orderId: string) {
  const session = await getAuthSession();
  if (!session) {
    return { error: 'Unauthorized', status: 401 as const };
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      userId: true,
      vendorId: true,
      status: true,
    },
  });

  if (!order) {
    return { error: 'Order not found', status: 404 as const };
  }

  if (session.role === 'ADMIN' || order.userId === session.userId) {
    return { order, session };
  }

  if (session.role === 'VENDOR') {
    const vendor = await prisma.vendor.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });

    if (vendor?.id === order.vendorId) {
      return { order, session };
    }
  }

  return { error: 'Order not found', status: 404 as const };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const access = await getAccessibleOrder(id);

  if ('error' in access) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  return NextResponse.json({ trust: await getOrderTrustSnapshot(id) });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const access = await getAccessibleOrder(id);

  if ('error' in access) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  if (access.order.userId !== access.session.userId) {
    return NextResponse.json(
      { error: 'Only the customer can verify delivery details.' },
      { status: 403 },
    );
  }

  const body = await request.json();
  const action = typeof body.action === 'string' ? body.action : '';

  await ensureTrustTables();

  if (action === 'verify-delivery-otp') {
    const otp = typeof body.otp === 'string' ? body.otp.trim() : '';
    const verification = await verifyDeliveryOtpForOrder(id, otp);

    if (!verification.ok) {
      return NextResponse.json(
        { error: verification.error },
        { status: 400 },
      );
    }

    if (access.order.status === 'SHIPPED') {
      await prisma.order.update({
        where: { id },
        data: getOrderStatusUpdateData('DELIVERED', {
          statusNote: 'Delivery OTP verified by customer.',
        }),
      });
      await syncDeliveredOrderForPayout(id);
    }

    await logVendorProtection(
      id,
      access.order.vendorId,
      'DELIVERY_OTP_VERIFIED',
      'Customer verified delivery OTP.',
    );

    return NextResponse.json({
      trust: await getOrderTrustSnapshot(id),
      message: 'Delivery OTP verified.',
    });
  }

  if (action === 'confirm-product-match') {
    const correctProduct = Boolean(body.correctProduct);
    const correctBrand = Boolean(body.correctBrand);
    const correctSize = Boolean(body.correctSize);
    const correctColor = Boolean(body.correctColor);
    const correctQuantity = Boolean(body.correctQuantity);
    const allVerified =
      correctProduct &&
      correctBrand &&
      correctSize &&
      correctColor &&
      correctQuantity;

    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "order_verification"
      WHERE "orderId" = ${id}
      LIMIT 1
    `;

    if (rows[0]) {
      await prisma.$executeRaw`
        UPDATE "order_verification"
        SET "customerProductConfirmed" = true,
            "correctProduct" = ${correctProduct},
            "correctBrand" = ${correctBrand},
            "correctSize" = ${correctSize},
            "correctColor" = ${correctColor},
            "correctQuantity" = ${correctQuantity},
            "verifiedDelivered" = ${allVerified},
            "verifiedAt" = CURRENT_TIMESTAMP,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "orderId" = ${id}
      `;
    } else {
      await prisma.$executeRaw`
        INSERT INTO "order_verification" (
          "id",
          "orderId",
          "verificationId",
          "customerProductConfirmed",
          "correctProduct",
          "correctBrand",
          "correctSize",
          "correctColor",
          "correctQuantity",
          "verifiedDelivered",
          "verifiedAt"
        ) VALUES (
          ${randomUUID()},
          ${id},
          ${`ZB-ORD-${id.slice(-6).toUpperCase()}`},
          true,
          ${correctProduct},
          ${correctBrand},
          ${correctSize},
          ${correctColor},
          ${correctQuantity},
          ${allVerified},
          CURRENT_TIMESTAMP
        )
      `;
    }

    await prisma.$executeRaw`
      INSERT INTO "open_box_verification" (
        "id",
        "orderId",
        "verified",
        "productName",
        "brand",
        "size",
        "color",
        "quantity",
        "gpsLocation",
        "verifiedAt"
      ) VALUES (
        ${randomUUID()},
        ${id},
        ${allVerified},
        ${typeof body.productName === 'string' ? body.productName : null},
        ${typeof body.brand === 'string' ? body.brand : null},
        ${typeof body.size === 'string' ? body.size : null},
        ${typeof body.color === 'string' ? body.color : null},
        ${typeof body.quantity === 'string' ? body.quantity : null},
        ${typeof body.gpsLocation === 'string' ? body.gpsLocation : null},
        CURRENT_TIMESTAMP
      )
      ON CONFLICT ("orderId") DO UPDATE SET
        "verified" = ${allVerified},
        "productName" = ${typeof body.productName === 'string' ? body.productName : null},
        "brand" = ${typeof body.brand === 'string' ? body.brand : null},
        "size" = ${typeof body.size === 'string' ? body.size : null},
        "color" = ${typeof body.color === 'string' ? body.color : null},
        "quantity" = ${typeof body.quantity === 'string' ? body.quantity : null},
        "gpsLocation" = ${typeof body.gpsLocation === 'string' ? body.gpsLocation : null},
        "verifiedAt" = CURRENT_TIMESTAMP
    `;

    await logVendorProtection(
      id,
      access.order.vendorId,
      'CUSTOMER_PRODUCT_MATCH_CONFIRMED',
      'Customer submitted delivery product-match checklist.',
      {
        correctProduct,
        correctBrand,
        correctSize,
        correctColor,
        correctQuantity,
      },
    );

    return NextResponse.json({
      trust: await getOrderTrustSnapshot(id),
      message: allVerified
        ? 'Product match confirmed. Order is verified delivered.'
        : 'Verification saved for admin review.',
    });
  }

  return NextResponse.json({ error: 'Unsupported trust action.' }, { status: 400 });
}
