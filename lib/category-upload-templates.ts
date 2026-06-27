import { prisma } from '@/lib/prisma';

export type CategorySpecField = {
  name: string;
  label: string;
  placeholder: string;
  multiline?: boolean;
  options?: string[];
  required?: boolean;
};

export type CategorySpecTemplate = {
  title: string;
  helpText: string;
  fields: CategorySpecField[];
};

export type CategoryVariantExample = {
  sizeLabel: string;
  numericSize: string;
  color: string;
  sku: string;
  stockQuantity: string;
  price: string;
  mrp: string;
};

export type CategoryVariantConfig = {
  title: string;
  note: string;
  selectedStyle: string;
  sizeLabelHeading: string;
  sizeLabelPlaceholder: string;
  numericSizeHeading: string;
  numericSizePlaceholder: string;
  colorHeading: string;
  colorPlaceholder: string;
  skuHeading: string;
  skuPlaceholder: string;
  defaultSizePlaceholder: string;
  availableSizesPlaceholder: string;
  brandMappingPlaceholder: string;
  examples: CategoryVariantExample[];
};

export type CategoryUploadTemplatePayload = {
  id?: string;
  categoryId: string;
  subcategoryId?: string | null;
  productTypes: string[];
  specTemplate: CategorySpecTemplate;
  variantConfig: CategoryVariantConfig;
  sizeChart?: string;
  requiredFields?: string[];
  createdAt?: string;
  updatedAt?: string;
};

type TemplateRow = {
  id: string;
  categoryId: string;
  subcategoryId: string | null;
  productTypes: string;
  specTemplate: string;
  variantConfig: string;
  sizeChart: string | null;
  requiredFields: string | null;
  createdAt: string;
  updatedAt: string;
};

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function toTemplate(row: TemplateRow): CategoryUploadTemplatePayload {
  return {
    id: row.id,
    categoryId: row.categoryId,
    subcategoryId: row.subcategoryId,
    productTypes: parseJson<string[]>(row.productTypes, []),
    specTemplate: parseJson<CategorySpecTemplate>(row.specTemplate, {
      title: 'Category Specifications',
      helpText: 'Add category-specific product details.',
      fields: [],
    }),
    variantConfig: parseJson<CategoryVariantConfig>(row.variantConfig, {
      title: 'Variant, Option & Stock Rows',
      note: 'Add rows for selectable options and stock differences.',
      selectedStyle: 'Managed category template',
      sizeLabelHeading: 'Option Label',
      sizeLabelPlaceholder: 'Standard / Pack of 2',
      numericSizeHeading: 'Option Detail',
      numericSizePlaceholder: '1 piece / 500 g',
      colorHeading: 'Color / Type',
      colorPlaceholder: 'Default',
      skuHeading: 'Variant SKU',
      skuPlaceholder: 'STD-1',
      defaultSizePlaceholder: 'Default size / capacity / option',
      availableSizesPlaceholder: 'Available options, e.g. Standard, Pack of 2',
      brandMappingPlaceholder: 'Brand option mapping if applicable',
      examples: [],
    }),
    sizeChart: row.sizeChart || '',
    requiredFields: parseJson<string[]>(row.requiredFields, []),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function ensureCategoryUploadTemplateSchema() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CategoryUploadTemplate" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "categoryId" TEXT NOT NULL,
      "subcategoryId" TEXT,
      "productTypes" TEXT NOT NULL,
      "specTemplate" TEXT NOT NULL,
      "variantConfig" TEXT NOT NULL,
      "sizeChart" TEXT,
      "requiredFields" TEXT,
      "createdAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "CategoryUploadTemplate_categoryId_idx"
    ON "CategoryUploadTemplate" ("categoryId")
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "CategoryUploadTemplate_subcategoryId_idx"
    ON "CategoryUploadTemplate" ("subcategoryId")
  `);
}

export async function getCategoryUploadTemplate(
  categoryId: string,
  subcategoryId?: string | null,
) {
  await ensureCategoryUploadTemplateSchema();

  if (subcategoryId) {
    const rows = await prisma.$queryRaw<TemplateRow[]>`
      SELECT * FROM "CategoryUploadTemplate"
      WHERE "categoryId" = ${categoryId} AND "subcategoryId" = ${subcategoryId}
      ORDER BY "updatedAt" DESC
      LIMIT 1
    `;

    if (rows[0]) {
      return toTemplate(rows[0]);
    }
  }

  const rows = await prisma.$queryRaw<TemplateRow[]>`
    SELECT * FROM "CategoryUploadTemplate"
    WHERE "categoryId" = ${categoryId}
      AND ("subcategoryId" IS NULL OR "subcategoryId" = '')
    ORDER BY "updatedAt" DESC
    LIMIT 1
  `;

  return rows[0] ? toTemplate(rows[0]) : null;
}

export async function saveCategoryUploadTemplate(
  template: CategoryUploadTemplatePayload,
) {
  await ensureCategoryUploadTemplateSchema();

  const id = template.id || crypto.randomUUID();
  const subcategoryId = template.subcategoryId || null;

  await prisma.$executeRaw`
    DELETE FROM "CategoryUploadTemplate"
    WHERE "categoryId" = ${template.categoryId}
      AND COALESCE("subcategoryId", '') = ${subcategoryId || ''}
  `;

  await prisma.$executeRaw`
    INSERT INTO "CategoryUploadTemplate" (
      "id",
      "categoryId",
      "subcategoryId",
      "productTypes",
      "specTemplate",
      "variantConfig",
      "sizeChart",
      "requiredFields",
      "createdAt",
      "updatedAt"
    ) VALUES (
      ${id},
      ${template.categoryId},
      ${subcategoryId},
      ${JSON.stringify(template.productTypes || [])},
      ${JSON.stringify(template.specTemplate || {})},
      ${JSON.stringify(template.variantConfig || {})},
      ${template.sizeChart || ''},
      ${JSON.stringify(template.requiredFields || [])},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  `;

  return getCategoryUploadTemplate(template.categoryId, subcategoryId);
}
