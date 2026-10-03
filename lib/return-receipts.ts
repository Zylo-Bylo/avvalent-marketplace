export type QcDispositionInput = {
  disposition: 'RESELLABLE' | 'DAMAGED' | 'REJECTED';
  quantity: number;
};

export type QcItemInput = {
  receiptItemId: string;
  receivedQuantity: number;
  dispositions: QcDispositionInput[];
};

const DISPOSITIONS = new Set(['RESELLABLE', 'DAMAGED', 'REJECTED']);
const FORBIDDEN_ITEM_KEYS = new Set([
  'orderItemId',
  'productId',
  'variantId',
  'warehouseId',
  'restorationWarehouseId',
  'orderedQuantity',
]);

export function parseQcItems(value: unknown): QcItemInput[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('QC items are required.');
  }

  const seenItems = new Set<string>();
  return value.map((raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error('Invalid QC item.');
    }
    const item = raw as Record<string, unknown>;
    for (const key of FORBIDDEN_ITEM_KEYS) {
      if (key in item) throw new Error(`QC input cannot override ${key}.`);
    }
    const receiptItemId = typeof item.receiptItemId === 'string' ? item.receiptItemId.trim() : '';
    if (!receiptItemId || seenItems.has(receiptItemId)) {
      throw new Error('Each receipt item must appear exactly once.');
    }
    seenItems.add(receiptItemId);

    const receivedQuantity = Number(item.receivedQuantity);
    if (!Number.isInteger(receivedQuantity) || receivedQuantity < 0) {
      throw new Error('Received quantity must be a nonnegative integer.');
    }
    if (!Array.isArray(item.dispositions)) throw new Error('Disposition allocations are required.');

    const seenTypes = new Set<string>();
    const dispositions = item.dispositions.map((rawDisposition) => {
      if (!rawDisposition || typeof rawDisposition !== 'object' || Array.isArray(rawDisposition)) {
        throw new Error('Invalid disposition allocation.');
      }
      const allocation = rawDisposition as Record<string, unknown>;
      const disposition = String(allocation.disposition ?? '').trim().toUpperCase();
      const quantity = Number(allocation.quantity);
      if (!DISPOSITIONS.has(disposition)) throw new Error('Invalid disposition type.');
      if (seenTypes.has(disposition)) throw new Error('Duplicate disposition type for receipt item.');
      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new Error('Disposition quantity must be a positive integer.');
      }
      seenTypes.add(disposition);
      return { disposition: disposition as QcDispositionInput['disposition'], quantity };
    });

    const allocated = dispositions.reduce((sum, allocation) => sum + allocation.quantity, 0);
    if (allocated !== receivedQuantity) {
      throw new Error('Disposition total must equal received quantity.');
    }
    return { receiptItemId, receivedQuantity, dispositions };
  });
}
