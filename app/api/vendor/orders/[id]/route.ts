import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = verifyToken(token);
    if (!data || typeof data !== 'object' || !data.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const vendor = await prisma.vendor.findUnique({
      where: { userId: String(data.userId) },
      select: { id: true, status: true },
    });

    if (!vendor || vendor.status !== 'APPROVED') {
      return NextResponse.json({ error: 'Approved vendor access required' }, { status: 403 });
    }

    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        vendorId: true,
        status: true,
        paymentMethod: true,
      },
    });

    if (!order || order.vendorId !== vendor.id) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const body = await request.json();
    const action = typeof body.action === 'string' ? body.action : '';
    const trackingNumber =
      typeof body.trackingNumber === 'string' ? body.trackingNumber.trim() : '';
    const carrier = typeof body.carrier === 'string' ? body.carrier.trim() : '';

    if (action === 'SAVE_COURIER_DETAILS') {
      if (!carrier || !trackingNumber) {
        return NextResponse.json(
          { error: 'Courier company and tracking/AWB number are required.' },
          { status: 400 },
        );
      }

      if (['DELIVERED', 'CANCELLED', 'RETURNED'].includes(order.status)) {
        return NextResponse.json(
          { error: `Courier details cannot be changed after order is ${order.status}.` },
          { status: 400 },
        );
      }

      const updatedOrder = await prisma.order.update({
        where: { id },
        data: {
          carrier,
          trackingNumber,
          statusNote: 'Courier details saved. Print label, upload packing proof, then mark shipped.',
        },
        include: {
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
                  images: true,
                  sku: true,
                },
              },
            },
          },
        },
      });

      await ensureTrustTables();

      return NextResponse.json({
        message: 'Courier details saved. You can now print the shipping label.',
        order: {
          ...updatedOrder,
          trust: await getOrderTrustSnapshot(updatedOrder.id),
        },
      });
    }

    if (!isOrderStatus(body.status)) {
      return NextResponse.json({ error: 'Invalid order status' }, { status: 400 });
    }

    if (body.status === 'PAID' && !['COD', 'UPI'].includes(order.paymentMethod)) {
      return NextResponse.json(
        { error: 'Online payments are confirmed by payment gateway/webhook.' },
        { status: 400 },
      );
    }

    await ensureTrustTables();

    const dispatchProductImages = Array.isArray(body.dispatchProductImages)
      ? body.dispatchProductImages.filter((url: unknown) => typeof url === 'string' && url.trim())
      : [];
    const dispatchPackedImages = Array.isArray(body.dispatchPackedImages)
      ? body.dispatchPackedImages.filter((url: unknown) => typeof url === 'string' && url.trim())
      : [];
    const shippingLabelImage =
      typeof body.shippingLabelImage === 'string' ? body.shippingLabelImage.trim() : '';
    const currentTrust = await getOrderTrustSnapshot(order.id);
    const hasExistingDispatchProof = currentTrust.dispatchImages.length > 0;

    if (
      body.status === 'SHIPPED' &&
      !hasExistingDispatchProof &&
      (dispatchProductImages.length === 0 ||
        dispatchPackedImages.length === 0 ||
        !shippingLabelImage)
    ) {
      return NextResponse.json(
        {
          error:
            'Upload product image, packed product image and shipping label proof before marking shipped.',
        },
        { status: 400 },
      );
    }

    if (body.status === 'DELIVERED') {
      const deliveryOtp = typeof body.deliveryOtp === 'string' ? body.deliveryOtp.trim() : '';
      const verification = await verifyDeliveryOtpForOrder(order.id, deliveryOtp);

      if (!verification.ok) {
        return NextResponse.json(
          { error: verification.error },
          { status: 400 },
        );
      }
    }

    if (body.status === 'DELIVERED' && order.status !== 'SHIPPED') {
      return NextResponse.json(
        { error: 'Mark the order as shipped before delivery.' },
        { status: 400 },
      );
    }

    if (['CANCELLED', 'RETURNED'].includes(order.status)) {
      return NextResponse.json(
        { error: `Order is already ${order.status}.` },
        { status: 400 },
      );
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: getOrderStatusUpdateData(body.status, body),
      include: {
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
                images: true,
                sku: true,
              },
            },
          },
        },
      },
    });

    if (body.status === 'SHIPPED') {
      await saveDispatchProof({
        orderId: updatedOrder.id,
        vendorId: vendor.id,
        productImages: dispatchProductImages,
        packedImages: dispatchPackedImages,
        shippingLabelImage,
        openBoxEligible: Boolean(body.openBoxEligible),
      });
    }

    if (body.status === 'DELIVERED') {
      await syncDeliveredOrderForPayout(updatedOrder.id);
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
  } catch (error) {
    console.error('Vendor order update error:', error);
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
}
