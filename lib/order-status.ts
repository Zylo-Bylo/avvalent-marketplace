export const ORDER_STATUSES = [
  'PENDING',
  'PAID',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'RETURNED',
] as const;

export type OrderStatusValue = (typeof ORDER_STATUSES)[number];

export function isOrderStatus(value: unknown): value is OrderStatusValue {
  return typeof value === 'string' && ORDER_STATUSES.includes(value as OrderStatusValue);
}

export function getOrderStatusUpdateData(
  status: OrderStatusValue,
  body: Record<string, unknown>,
) {
  const note = typeof body.statusNote === 'string' ? body.statusNote.trim() : '';
  const trackingNumber =
    typeof body.trackingNumber === 'string' ? body.trackingNumber.trim() : '';
  const carrier = typeof body.carrier === 'string' ? body.carrier.trim() : '';

  return {
    status,
    ...(status === 'SHIPPED' && {
      shippedAt: new Date(),
      trackingNumber: trackingNumber || null,
      carrier: carrier || null,
      statusNote: note || 'Order shipped.',
    }),
    ...(status === 'DELIVERED' && {
      deliveredAt: new Date(),
      statusNote: note || 'Order delivered successfully.',
    }),
    ...(status === 'CANCELLED' && {
      cancelledAt: new Date(),
      statusNote: note || 'Order cancelled.',
    }),
    ...(status === 'PAID' && {
      statusNote: note || 'Payment confirmed. Order is ready to ship.',
    }),
    ...(status === 'PENDING' && {
      statusNote: note || 'Order is pending payment or confirmation.',
    }),
    ...(status === 'RETURNED' && {
      statusNote: note || 'Order marked as returned.',
    }),
  };
}
