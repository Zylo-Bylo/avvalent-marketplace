import { prisma } from '@/lib/prisma';
import type { CategorySizeGuide } from '@/lib/category-size-guide';
import type { Prisma } from '@prisma/client';
import {
  SpecificationInheritanceError,
  prepareSpecificationSave,
  publishedParentSpecifications,
  resolveCategorySpecifications,
  validateSpecificationScope,
  type SpecificationHierarchy,
  type SpecificationInheritance,
  type PublishedSpecifications,
  type SpecificationScope,
} from '@/lib/category-specification-inheritance';

export type { VendorSpecField as CategorySpecField } from "@/lib/vendor-specifications";
import type { VendorSpecField as CategorySpecField } from "@/lib/vendor-specifications";

export type CategorySpecTemplate = {
  title: string;
  helpText: string;
  fields: CategorySpecField[];
  filterConfig?: string[];
  sizeGuide?: CategorySizeGuide | unknown[];
  businessRules?: Record<string, unknown>;
  templateMeta?: Record<string, unknown>;
  inheritance?: SpecificationInheritance;
  publishedSpecifications?: PublishedSpecifications;
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
} & Record<string, unknown>;

export type CategoryUploadTemplatePayload = {
  id?: string;
  categoryId: string;
  subcategoryId?: string | null;
  productTypeId?: string | null;
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
  productTypeId: string | null;
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
    productTypeId: row.productTypeId,
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
      "productTypeId" TEXT,
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
    ALTER TABLE "CategoryUploadTemplate" ADD COLUMN IF NOT EXISTS "productTypeId" TEXT
  `).catch(async () => {
    const columns = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
      'PRAGMA table_info("CategoryUploadTemplate")',
    );
    if (!columns.some((column) => column.name === 'productTypeId')) {
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "CategoryUploadTemplate" ADD COLUMN "productTypeId" TEXT',
      );
    }
  });

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "CategoryUploadTemplate_categoryId_idx"
    ON "CategoryUploadTemplate" ("categoryId")
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "CategoryUploadTemplate_subcategoryId_idx"
    ON "CategoryUploadTemplate" ("subcategoryId")
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "CategoryUploadTemplate_productTypeId_idx"
    ON "CategoryUploadTemplate" ("productTypeId")
  `);
}

export async function getCategoryUploadTemplate(
  categoryId: string,
  subcategoryId?: string | null,
  productTypeId?: string | null,
) {
  if (productTypeId) {
    const rows = await prisma.$queryRaw<TemplateRow[]>`
      SELECT * FROM "CategoryUploadTemplate"
      WHERE "categoryId" = ${categoryId}
        AND "subcategoryId" = ${subcategoryId || null}
        AND "productTypeId" = ${productTypeId}
      ORDER BY "updatedAt" DESC
      LIMIT 1
    `;

    if (rows[0]) {
      return toTemplate(rows[0]);
    }
  }

  if (subcategoryId) {
    const rows = await prisma.$queryRaw<TemplateRow[]>`
      SELECT * FROM "CategoryUploadTemplate"
      WHERE "categoryId" = ${categoryId} AND "subcategoryId" = ${subcategoryId}
        AND ("productTypeId" IS NULL OR "productTypeId" = '')
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

export async function getExactCategoryUploadTemplate(
  scope: SpecificationScope,
  database: Pick<Prisma.TransactionClient, '$queryRaw'> = prisma,
) {
  const rows = await database.$queryRaw<TemplateRow[]>`
    SELECT * FROM "CategoryUploadTemplate"
    WHERE "categoryId" = ${scope.categoryId}
      AND COALESCE("subcategoryId", '') = ${scope.subcategoryId || ''}
      AND COALESCE("productTypeId", '') = ${scope.productTypeId || ''}
    ORDER BY "updatedAt" DESC
    LIMIT 1
  `;
  return rows[0] ? toTemplate(rows[0]) : null;
}

async function readSpecificationHierarchy(scope: SpecificationScope, database: Pick<Prisma.TransactionClient, 'category' | 'subcategory' | 'productType'> = prisma): Promise<SpecificationHierarchy> {
  if (!scope.categoryId || !scope.subcategoryId) throw new SpecificationInheritanceError('Category and Subcategory IDs are required.');
  const [category, subcategory, productType] = await Promise.all([
    database.category.findUnique({ where: { id: scope.categoryId }, select: { id: true } }),
    database.subcategory.findUnique({ where: { id: scope.subcategoryId }, select: { id: true, categoryId: true } }),
    scope.productTypeId ? database.productType.findUnique({ where: { id: scope.productTypeId }, select: { id: true, subcategoryId: true } }) : null,
  ]);
  if (!category || !subcategory || (scope.productTypeId && !productType)) throw new SpecificationInheritanceError('Specification scope does not exist.');
  const hierarchy = { category, subcategory, productType: productType || undefined };
  validateSpecificationScope(scope, hierarchy);
  return hierarchy;
}

export async function getResolvedCategorySpecifications(scope: SpecificationScope) {
  if (!scope.productTypeId) throw new SpecificationInheritanceError('Resolved specifications require a ProductType ID.');
  const hierarchy = await readSpecificationHierarchy(scope);
  const child = await getExactCategoryUploadTemplate(scope);
  if (!child || !child.specTemplate.inheritance?.enabled) {
    // No metadata, disabled metadata, and missing child records retain the old
    // whole-template lookup. Reading never creates or opts in a child template.
    if (child?.specTemplate.inheritance) resolveCategorySpecifications({ scope, child: child.specTemplate });
    return { template: child || await getCategoryUploadTemplate(scope.categoryId, scope.subcategoryId, scope.productTypeId), resolution: { inheritanceApplied: false, parentVersion: null, provenance: [] } };
  }
  const parentScope = { categoryId: scope.categoryId, subcategoryId: scope.subcategoryId, productTypeId: null };
  const parent = await getExactCategoryUploadTemplate(parentScope);
  if (!parent) throw new SpecificationInheritanceError('The immediate Subcategory has no specification template.');
  const result = resolveCategorySpecifications({ scope, hierarchy, child: child.specTemplate, parent: { scope: parentScope, specTemplate: publishedParentSpecifications(parent.specTemplate) } });
  return {
    // A separate projection: the persisted child and its local fields are untouched.
    template: { ...child, specificationView: 'resolved-specifications', specTemplate: { ...child.specTemplate, fields: result.fields } },
    resolution: { inheritanceApplied: true, parentVersion: parent.specTemplate.publishedSpecifications!.publishedAt, provenance: result.provenance },
  };
}

export async function saveCategoryUploadTemplate(
  template: CategoryUploadTemplatePayload,
) {
  await ensureCategoryUploadTemplateSchema();

  const id = template.id || crypto.randomUUID();
  const subcategoryId = template.subcategoryId || null;
  const productTypeId = template.productTypeId || null;
  const scope = { categoryId: template.categoryId, subcategoryId, productTypeId };
  // Keep the retained published snapshot and replacement row in one transaction.
  await prisma.$transaction(async (database) => {
    const existing = await getExactCategoryUploadTemplate(scope, database);
    const specTemplate = prepareSpecificationSave({ incoming: template.specTemplate, existing: existing?.specTemplate, scope, now: new Date().toISOString() });
    if (specTemplate.inheritance) {
      const hierarchy = await readSpecificationHierarchy(scope, database);
      if (specTemplate.inheritance.enabled) {
        const parentScope = { categoryId: scope.categoryId, subcategoryId, productTypeId: null };
        const parent = await getExactCategoryUploadTemplate(parentScope, database);
        // Draft configuration may be prepared before parent publication. Validate
        // ownership and local differences against its working definition here.
        resolveCategorySpecifications({ scope, hierarchy, child: specTemplate, parent: parent ? { scope: parentScope, specTemplate: parent.specTemplate } : null });
      }
    }
    await database.$executeRaw`
    DELETE FROM "CategoryUploadTemplate"
    WHERE "categoryId" = ${template.categoryId}
      AND COALESCE("subcategoryId", '') = ${subcategoryId || ''}
      AND COALESCE("productTypeId", '') = ${productTypeId || ''}
  `;

    await database.$executeRaw`
    INSERT INTO "CategoryUploadTemplate" (
      "id",
      "categoryId",
      "subcategoryId",
      "productTypeId",
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
      ${productTypeId},
      ${JSON.stringify(template.productTypes || [])},
      ${JSON.stringify(specTemplate || {})},
      ${JSON.stringify(template.variantConfig || {})},
      ${template.sizeChart || ''},
      ${JSON.stringify(template.requiredFields || [])},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  `;
  }, { isolationLevel: 'Serializable' });

  return getCategoryUploadTemplate(template.categoryId, subcategoryId, productTypeId);
}
