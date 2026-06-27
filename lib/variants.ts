import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type ProductVariantInput = {
  id?: string;
  sizeLabel?: string | null;
  numericSize?: string | null;
  color?: string | null;
  sku?: string | null;
  stockQuantity?: number | string | null;
  price?: number | string | null;
  vendorPrice?: number | string | null;
  mrp?: number | string | null;
  imageUrl?: string | null;
  lowStockThreshold?: number | string | null;
};

export type CartVariantItem = {
  id: string;
  productId?: string;
  variantId?: string | null;
  name?: string;
  quantity: number;
};

export type ProductVariantRow = {
  id: string;
  productId: string;
  sizeLabel: string | null;
  numericSize: string | null;
  color: string | null;
  sku: string | null;
  stockQuantity: number;
  price: number | null;
  vendorPrice: number | null;
  mrp: number | null;
  imageUrl: string | null;
  status: string;
  lowStockThreshold: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

function toInt(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : fallback;
}

function toFloat(value: unknown, fallback: number | null = null) {
  if (value === '' || value === null || value === undefined) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeSkuPart(value: unknown) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toUpperCase();
}

function getUniqueVariantSku(
  rawSku: string,
  fallbackSku: string,
  variant: {
    sizeLabel: string;
    numericSize: string;
    color: string;
  },
  index: number,
  usedSkus: Set<string>,
) {
  const base =
    normalizeSkuPart(rawSku) ||
    [
      normalizeSkuPart(fallbackSku),
      normalizeSkuPart(variant.sizeLabel),
      normalizeSkuPart(variant.numericSize),
      normalizeSkuPart(variant.color),
    ]
      .filter(Boolean)
      .join('-') ||
    `VARIANT-${index + 1}`;
  const suffix =
    [
      normalizeSkuPart(variant.sizeLabel),
      normalizeSkuPart(variant.numericSize),
      normalizeSkuPart(variant.color),
      index + 1,
    ]
      .filter(Boolean)
      .join('-') || String(index + 1);

  let candidate = base;
  let counter = 1;
  while (usedSkus.has(candidate.toLowerCase())) {
    candidate = `${base}-${suffix}${counter > 1 ? `-${counter}` : ''}`;
    counter += 1;
  }

  usedSkus.add(candidate.toLowerCase());
  return candidate;
}

export function getVariantStockStatus(stock: unknown, lowThreshold = 3) {
  const qty = toInt(stock);
  if (qty <= 0) return 'OUT_OF_STOCK';
  if (qty <= lowThreshold) return 'LOW_STOCK';
  return 'IN_STOCK';
}

async function addOrderItemColumn(name: string, definition: string) {
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "OrderItem" ADD COLUMN "${name}" ${definition}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (
      !message.includes('duplicate column') &&
      !message.includes('already exists')
    ) {
      throw error;
    }
  }
}

export async function ensureVariantSchema() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ProductVariant" (
      "id" TEXT PRIMARY KEY,
      "productId" TEXT NOT NULL,
      "sizeLabel" TEXT,
      "numericSize" TEXT,
      "color" TEXT,
      "sku" TEXT UNIQUE,
      "stockQuantity" INTEGER NOT NULL DEFAULT 0,
      "price" DOUBLE PRECISION,
      "vendorPrice" DOUBLE PRECISION,
      "mrp" DOUBLE PRECISION,
      "imageUrl" TEXT,
      "status" TEXT NOT NULL DEFAULT 'IN_STOCK',
      "lowStockThreshold" INTEGER NOT NULL DEFAULT 3,
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "ProductVariant_productId_idx" ON "ProductVariant" ("productId")',
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "ProductVariant_status_idx" ON "ProductVariant" ("status")',
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "ProductVariant_stockQuantity_idx" ON "ProductVariant" ("stockQuantity")',
  );

  try {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "ProductVariant" ADD COLUMN "vendorPrice" DOUBLE PRECISION',
    );
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (!message.includes('duplicate column') && !message.includes('already exists')) {
      throw error;
    }
  }

  try {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "ProductVariant" ADD COLUMN "imageUrl" TEXT',
    );
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (!message.includes('duplicate column') && !message.includes('already exists')) {
      throw error;
    }
  }

  await addOrderItemColumn('variantId', 'TEXT');
  await addOrderItemColumn('sizeLabel', 'TEXT');
  await addOrderItemColumn('numericSize', 'TEXT');
  await addOrderItemColumn('variantColor', 'TEXT');
  await addOrderItemColumn('variantSku', 'TEXT');
}

export function normalizeVariants(
  variants: ProductVariantInput[] | unknown,
  fallback: {
    sku?: string | null;
    color?: string | null;
    price: number;
    mrp?: number | null;
    inventory: number;
  },
) {
  const input = Array.isArray(variants) ? variants : [];
  const usedSkus = new Set<string>();
  const cleaned = input
    .map((variant, index) => {
      const stockQuantity = toInt(variant.stockQuantity);
      const lowStockThreshold = toInt(variant.lowStockThreshold, 3);
      const normalizedVariant = {
        sizeLabel: String(variant.sizeLabel || '').trim(),
        numericSize: String(variant.numericSize || '').trim(),
        color: String(variant.color || fallback.color || '').trim(),
      };
      return {
        ...normalizedVariant,
        sku: getUniqueVariantSku(
          String(variant.sku || '').trim(),
          String(fallback.sku || '').trim(),
          normalizedVariant,
          index,
          usedSkus,
        ),
        stockQuantity,
        price: toFloat(variant.price, fallback.price),
        vendorPrice: toFloat(variant.vendorPrice, null),
        mrp: toFloat(variant.mrp, fallback.mrp || null),
        imageUrl: String(variant.imageUrl || '').trim(),
        status: getVariantStockStatus(stockQuantity, lowStockThreshold),
        lowStockThreshold,
      };
    })
    .filter(
      (variant) =>
        variant.sizeLabel ||
        variant.numericSize ||
        variant.color ||
        variant.sku ||
        variant.stockQuantity > 0,
    );

  if (cleaned.length > 0) {
    return cleaned;
  }

  return [
    {
      sizeLabel: '',
      numericSize: '',
      color: fallback.color || '',
      sku: fallback.sku || '',
      stockQuantity: toInt(fallback.inventory),
      price: fallback.price,
      vendorPrice: null,
      mrp: fallback.mrp || null,
      imageUrl: '',
      status: getVariantStockStatus(fallback.inventory),
      lowStockThreshold: 3,
    },
  ];
}

export async function replaceProductVariants(
  productId: string,
  variants: ReturnType<typeof normalizeVariants>,
) {
  await ensureVariantSchema();
  await prisma.$executeRaw`
    DELETE FROM "ProductVariant" WHERE "productId" = ${productId}
  `;

  async function getAvailableSku(rawSku: string | null | undefined, index: number) {
    const base = normalizeSkuPart(rawSku);

    if (!base) {
      return null;
    }

    let candidate = base;
    let counter = 1;

    while (true) {
      const existing = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "ProductVariant"
        WHERE "sku" = ${candidate} AND "productId" <> ${productId}
        LIMIT 1
      `;

      if (existing.length === 0) {
        return candidate;
      }

      candidate = `${base}-${normalizeSkuPart(productId).slice(-8)}-${index + 1}-${counter}`;
      counter += 1;
    }
  }

  for (const [index, variant] of variants.entries()) {
    const availableSku = await getAvailableSku(variant.sku, index);

    await prisma.$executeRaw`
      INSERT INTO "ProductVariant" (
        "id",
        "productId",
        "sizeLabel",
        "numericSize",
        "color",
        "sku",
        "stockQuantity",
        "price",
        "vendorPrice",
        "mrp",
        "imageUrl",
        "status",
        "lowStockThreshold",
        "createdAt",
        "updatedAt"
      ) VALUES (
        ${randomUUID()},
        ${productId},
        ${variant.sizeLabel || null},
        ${variant.numericSize || null},
        ${variant.color || null},
        ${availableSku},
        ${variant.stockQuantity},
        ${variant.price},
        ${variant.vendorPrice},
        ${variant.mrp},
        ${variant.imageUrl || null},
        ${variant.status},
        ${variant.lowStockThreshold},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `;
  }
}

export async function getVariantsForProducts(productIds: string[]) {
  await ensureVariantSchema();
  if (productIds.length === 0) {
    return [];
  }

  return prisma.$queryRaw<ProductVariantRow[]>`
    SELECT * FROM "ProductVariant"
    WHERE "productId" IN (${Prisma.join(productIds)})
    ORDER BY "numericSize", "sizeLabel", "color"
  `;
}

export async function getProductVariants(productId: string) {
  const variants = await getVariantsForProducts([productId]);
  return variants.filter((variant) => variant.productId === productId);
}

export async function adjustVariantStock(input: {
  variantId: string;
  quantity: number;
  mode: 'ADD' | 'REMOVE' | 'SET';
}) {
  await ensureVariantSchema();
  const rows = await prisma.$queryRaw<ProductVariantRow[]>`
    SELECT * FROM "ProductVariant" WHERE "id" = ${input.variantId} LIMIT 1
  `;
  const variant = rows[0];

  if (!variant) {
    throw new Error('Variant not found.');
  }

  const quantity = toInt(input.quantity);
  if (input.mode !== 'SET' && quantity <= 0) {
    throw new Error('Quantity must be greater than 0.');
  }

  const currentStock = toInt(variant.stockQuantity);
  const nextStock =
    input.mode === 'SET'
      ? quantity
      : input.mode === 'REMOVE'
        ? Math.max(0, currentStock - quantity)
        : currentStock + quantity;
  const status = getVariantStockStatus(nextStock, variant.lowStockThreshold);

  await prisma.$executeRaw`
    UPDATE "ProductVariant"
    SET "stockQuantity" = ${nextStock},
        "status" = ${status},
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${variant.id}
  `;

  const totals = await prisma.$queryRaw<Array<{ total: number | bigint | null }>>`
    SELECT SUM("stockQuantity") as total
    FROM "ProductVariant"
    WHERE "productId" = ${variant.productId}
  `;
  const productInventory = Number(totals[0]?.total || 0);
  await prisma.product.update({
    where: { id: variant.productId },
    data: { inventory: productInventory },
  });

  return { ...variant, stockQuantity: nextStock, status };
}

export async function validateVariantCartStock(items: CartVariantItem[]) {
  await ensureVariantSchema();
  const variantItems = items.filter((item) => item.variantId);
  if (variantItems.length === 0) {
    return { ok: true as const };
  }

  const variantIds = Array.from(
    new Set(variantItems.map((item) => String(item.variantId))),
  );
  const variants = await prisma.$queryRaw<ProductVariantRow[]>`
    SELECT * FROM "ProductVariant"
    WHERE "id" IN (${Prisma.join(variantIds)})
  `;

  for (const item of variantItems) {
    const variant = variants.find((entry) => entry.id === item.variantId);
    if (!variant) {
      return { ok: false as const, error: `${item.name || 'Product'} size is not available.` };
    }

    if (variant.productId !== (item.productId || item.id)) {
      return { ok: false as const, error: `${item.name || 'Product'} variant does not match product.` };
    }

    if (toInt(item.quantity, 1) > toInt(variant.stockQuantity)) {
      const size = [variant.sizeLabel, variant.numericSize].filter(Boolean).join(' / ');
      return {
        ok: false as const,
        error: `Only ${variant.stockQuantity} units available for ${item.name || 'Product'} ${size}.`,
      };
    }
  }

  return { ok: true as const };
}

export async function reduceVariantStockForOrder(orderId: string) {
  await ensureVariantSchema();
  const items = await prisma.orderItem.findMany({
    where: { orderId },
    select: { variantId: true, quantity: true },
  });

  for (const item of items) {
    if (!item.variantId) continue;
    const rows = await prisma.$queryRaw<ProductVariantRow[]>`
      SELECT * FROM "ProductVariant" WHERE "id" = ${item.variantId} LIMIT 1
    `;
    const variant = rows[0];
    if (!variant) continue;
    const nextStock = Math.max(0, toInt(variant.stockQuantity) - toInt(item.quantity, 1));
    const status = getVariantStockStatus(nextStock, variant.lowStockThreshold);
    await prisma.$executeRaw`
      UPDATE "ProductVariant"
      SET "stockQuantity" = ${nextStock},
          "status" = ${status},
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${variant.id}
    `;
  }
}

export async function restoreVariantStockForOrder(orderId: string) {
  await ensureVariantSchema();
  const items = await prisma.orderItem.findMany({
    where: { orderId },
    select: { variantId: true, quantity: true },
  });

  for (const item of items) {
    if (!item.variantId) continue;
    const rows = await prisma.$queryRaw<ProductVariantRow[]>`
      SELECT * FROM "ProductVariant" WHERE "id" = ${item.variantId} LIMIT 1
    `;
    const variant = rows[0];
    if (!variant) continue;
    const nextStock = toInt(variant.stockQuantity) + toInt(item.quantity, 1);
    const status = getVariantStockStatus(nextStock, variant.lowStockThreshold);
    await prisma.$executeRaw`
      UPDATE "ProductVariant"
      SET "stockQuantity" = ${nextStock},
          "status" = ${status},
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${variant.id}
    `;
  }
}
