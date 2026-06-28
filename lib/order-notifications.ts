import { sendOrderConfirmationEmail } from '@/lib/email';
import { prisma } from '@/lib/prisma';
import {
  sendOrderWhatsAppNotification,
  sendVendorOrderWhatsAppNotification,
} from '@/lib/whatsapp';

function getBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://zylo-buylo.com'
  ).replace(/\/$/, '');
}

function summarizeItems(
  items: Array<{
    quantity: number;
    product?: { name?: string | null } | null;
    productId: string;
    sizeLabel?: string | null;
    numericSize?: string | null;
    variantColor?: string | null;
  }>,
) {
  const summary = items
    .slice(0, 3)
    .map((item) => {
      const option = [item.variantColor, item.sizeLabel || item.numericSize]
        .filter(Boolean)
        .join(' / ');
      return `${item.quantity} x ${item.product?.name || item.productId}${
        option ? ` (${option})` : ''
      }`;
    })
    .join(', ');

  if (items.length <= 3) {
    return summary;
  }

  return `${summary} +${items.length - 3} more`;
}

export async function notifyOrderPlaced(orderIds: string[], source = 'order') {
  const uniqueOrderIds = Array.from(new Set(orderIds.filter(Boolean)));

  if (uniqueOrderIds.length === 0) {
    return;
  }

  const orders = await prisma.order.findMany({
    where: { id: { in: uniqueOrderIds } },
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
              name: true,
            },
          },
        },
      },
    },
  });

  await Promise.all(
    orders.map(async (order) => {
      const orderUrl = `${getBaseUrl()}/order/${order.id}`;
      const items = order.items.map((item) => ({
        name: item.product?.name || item.productId,
        quantity: item.quantity,
        price: item.price,
      }));

      if (order.user.email) {
        try {
          await sendOrderConfirmationEmail({
            to: order.user.email,
            customerName: order.user.name,
            orderId: order.id,
            totalAmount: order.totalAmount,
            paymentMethod: order.paymentMethod,
            status: order.status,
            orderUrl,
            items,
          });
        } catch (error) {
          console.error(`${source} customer email failed:`, error);
        }
      }

      if (order.shippingPhone) {
        try {
          await sendOrderWhatsAppNotification({
            to: order.shippingPhone,
            customerName: order.user.name,
            orderId: order.id,
            totalAmount: order.totalAmount,
          });
        } catch (error) {
          console.error(`${source} customer WhatsApp failed:`, error);
        }
      }

      if (order.vendor?.mobile) {
        try {
          await sendVendorOrderWhatsAppNotification({
            to: order.vendor.mobile,
            vendorName: order.vendor.storeName,
            orderId: order.id,
            totalAmount: order.totalAmount,
            itemSummary: summarizeItems(order.items),
            orderUrl,
          });
        } catch (error) {
          console.error(`${source} vendor WhatsApp failed:`, error);
        }
      }
    }),
  );
}
