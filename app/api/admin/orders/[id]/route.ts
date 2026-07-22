import { NextResponse } from 'next/server';
import { requireAdminApiUser } from '@/lib/admin-auth';
import {
  getOrderStatusUpdateData,
  isOrderStatus,
} from '@/lib/order-status';
import { restoreStockForOrder } from '@/lib/inventory';
import { syncDeliveredOrderForPayout } from '@/lib/payouts';
import { prisma } from '@/lib/prisma';
import {
  ensureTrustTables,
  getOrderTrustSnapshot,
  saveDispatchProof,
  verifyDeliveryOtpForOrder,
} from '@/lib/trust';

export const runtime = 'nodejs';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApiUser();
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = await request.json();

  if (!isOrderStatus(body.status)) {
    return NextResponse.json({ error: 'Invalid order status' }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      paymentMethod: true,
    },
  });

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  await ensureTrustTables();

  if (['CANCELLED', 'RETURNED'].includes(order.status)) {
    return NextResponse.json(
      { error: `Order is already ${order.status}.` },
      { status: 400 },
    );
  }

  if (
    body.status === 'PAID' &&
    !['COD', 'UPI'].includes(order.paymentMethod) &&
    !body.allowGatewayOverride
  ) {
    return NextResponse.json(
      {
        error:
          'Online payments should be marked paid by Razorpay/Stripe webhook. Use override only after manual verification.',
      },
      { status: 400 },
    );
  }

  if (body.status === 'DELIVERED' && order.status !== 'SHIPPED') {
    return NextResponse.json(
      { error: 'Mark the order as shipped before delivery.' },
      { status: 400 },
    );
  }

  if (body.status === 'DELIVERED' && !body.allowDeliveryOtpOverride) {
    const deliveryOtp = typeof body.deliveryOtp === 'string' ? body.deliveryOtp.trim() : '';
    const verification = await verifyDeliveryOtpForOrder(order.id, deliveryOtp);

    if (!verification.ok) {
      return NextResponse.json(
        {
          error: verification.error,
        },
        { status: 400 },
      );
    }
  }

  const updatedOrder = await prisma.order.update({
    where: { id },
    data: {
      ...getOrderStatusUpdateData(body.status, body),
      ...(typeof body.paymentId === 'string' &&
        body.paymentId.trim() && {
          paymentId: body.paymentId.trim(),
        }),
    },
    include: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
      vendor: {
        select: {
          storeName: true,
          mobile: true,
        },
      },
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              images: true,
              sku: true,
            },
          },
        },
      },
    },
  });

  if (body.status === 'DELIVERED') {
    await syncDeliveredOrderForPayout(updatedOrder.id);
  }

  if (body.status === 'SHIPPED') {
    await saveDispatchProof({
      orderId: updatedOrder.id,
      vendorId: updatedOrder.vendorId,
      productImages: Array.isArray(body.dispatchProductImages)
        ? body.dispatchProductImages.filter((url: unknown) => typeof url === 'string' && url.trim())
        : [],
      packedImages: Array.isArray(body.dispatchPackedImages)
        ? body.dispatchPackedImages.filter((url: unknown) => typeof url === 'string' && url.trim())
        : [],
      shippingLabelImage:
        typeof body.shippingLabelImage === 'string' ? body.shippingLabelImage.trim() : '',
      openBoxEligible: Boolean(body.openBoxEligible),
    });
  }

  if (
    body.status === 'CANCELLED' ||
    (body.status === 'RETURNED' && body.resellable !== false)
  ) {
    await restoreStockForOrder(updatedOrder.id, {
      resellable: body.status === 'CANCELLED' || body.resellable !== false,
      reason: body.status === 'CANCELLED' ? 'Order cancelled before shipping.' : 'Returned item marked resellable.',
    });
  }

  return NextResponse.json({
    order: {
      ...updatedOrder,
      trust: await getOrderTrustSnapshot(updatedOrder.id),
    },
  });
}
