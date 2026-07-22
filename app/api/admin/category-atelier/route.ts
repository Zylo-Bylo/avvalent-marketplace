import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { requireAdminApiUser } from '@/lib/admin-auth';
import {
  ensureCategoryUploadTemplateSchema,
  getCategoryUploadTemplate,
  saveCategoryUploadTemplate,
} from '@/lib/category-upload-templates';
import { ensureCategoryAtelierSchema } from '@/lib/category-atelier-schema';
import {
  categoryMetadataImageFields,
  sanitizeMetadataImageUpdates,
} from '@/lib/category-metadata-images';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

const entityFields = [
  'name',
  'slug',
  'status',
  'sortOrder',
  'homepageIcon',
  'categoryImage',
  'desktopBanner',
  'mobileBanner',
  'altText',
] as const;

type EntityType = 'category' | 'subcategory' | 'productType';

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

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function toAuditJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value == null) return Prisma.JsonNull;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function normalizeUpdate(input: Record<string, unknown>) {
  const data: Record<string, string | number | null> = {};
  const sanitizedInput = sanitizeMetadataImageUpdates(input);

  for (const field of entityFields) {
    if (!(field in sanitizedInput)) continue;
    const value = sanitizedInput[field];

    if (field === 'sortOrder') {
      data.sortOrder = Number.isFinite(Number(value)) ? Number(value) : 0;
      continue;
    }

    if (field === 'status') {
      data.status = value === 'INACTIVE' || value === 'ARCHIVED' ? value : 'ACTIVE';
      data.archivedAt = value === 'ARCHIVED' ? new Date().toISOString() : null;
      continue;
    }

    if (field === 'name' && typeof value === 'string') {
      data.name = value.trim();
      if (!('slug' in sanitizedInput)) {
        data.slug = slugify(value) || `category-${Date.now()}`;
      }
      continue;
    }

    data[field] = typeof value === 'string' ? value.trim() || null : null;
  }

  if (typeof sanitizedInput.slug === 'string') {
    data.slug = slugify(sanitizedInput.slug) || `category-${Date.now()}`;
  }

  return data;
}

async function audit(
  adminUser: string,
  action: string,
  entityType: string,
  entityId: string | null,
  oldValue: unknown,
  newValue: unknown,
) {
  await prisma.categoryAuditLog.create({
    data: {
      adminUser,
      action,
      entityType,
      entityId,
      oldValue: toAuditJson(oldValue),
      newValue: toAuditJson(newValue),
    },
  });
}

function isInvalidStoredImageUrl(value: string | null | undefined) {
  return typeof value === 'string' && /^(blob|data):/i.test(value.trim());
}

async function clearInvalidMetadataImages() {
  const cleanup: Array<{ entityType: string; entityId: string; field: string }> = [];
  const select = {
    id: true,
    homepageIcon: true,
    categoryImage: true,
    desktopBanner: true,
    mobileBanner: true,
  } as const;
  type ImageRow = {
    id: string;
    homepageIcon: string | null;
    categoryImage: string | null;
    desktopBanner: string | null;
    mobileBanner: string | null;
  };

  const [categories, subcategories, productTypes] = await Promise.all([
    prisma.category.findMany({ select }),
    prisma.subcategory.findMany({ select }),
    prisma.productType.findMany({ select }),
  ]);

  async function cleanRows(
    entityType: EntityType,
    rows: ImageRow[],
  ) {
    for (const row of rows) {
      const updates: Record<string, null> = {};
      for (const field of categoryMetadataImageFields) {
        if (isInvalidStoredImageUrl(row[field])) {
          updates[field] = null;
          cleanup.push({ entityType, entityId: String(row.id), field });
        }
      }
      if (!Object.keys(updates).length) continue;

      if (entityType === 'category') {
        await prisma.category.update({ where: { id: String(row.id) }, data: updates });
      } else if (entityType === 'subcategory') {
        await prisma.subcategory.update({ where: { id: String(row.id) }, data: updates });
      } else {
        await prisma.productType.update({ where: { id: String(row.id) }, data: updates });
      }
    }
  }

  await cleanRows('category', categories);
  await cleanRows('subcategory', subcategories);
  await cleanRows('productType', productTypes);

  return cleanup;
}

async function getEntity(entityType: EntityType, id: string) {
  if (entityType === 'category') {
    return prisma.category.findUnique({ where: { id } });
  }
  if (entityType === 'subcategory') {
    return prisma.subcategory.findUnique({ where: { id } });
  }
  return prisma.productType.findUnique({ where: { id } });
}

async function updateEntity(entityType: EntityType, id: string, data: Record<string, unknown>) {
  const updateData = normalizeUpdate(data);
  if (!Object.keys(updateData).length) return getEntity(entityType, id);

  if (entityType === 'category') {
    return prisma.category.update({ where: { id }, data: updateData });
  }
  if (entityType === 'subcategory') {
    return prisma.subcategory.update({ where: { id }, data: updateData });
  }
  return prisma.productType.update({ where: { id }, data: updateData });
}

async function getTemplates() {
  await ensureCategoryUploadTemplateSchema();
  const rows = await prisma.$queryRaw<TemplateRow[]>`
    SELECT * FROM "CategoryUploadTemplate"
    ORDER BY "updatedAt" DESC
  `;

  return rows.map((row) => ({
    id: row.id,
    categoryId: row.categoryId,
    subcategoryId: row.subcategoryId,
    productTypeId: row.productTypeId,
    productTypes: parseJson<string[]>(row.productTypes, []),
    specTemplate: parseJson<Record<string, unknown>>(row.specTemplate, {}),
    variantConfig: parseJson<Record<string, unknown>>(row.variantConfig, {}),
    sizeChart: row.sizeChart || '',
    requiredFields: parseJson<string[]>(row.requiredFields, []),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

async function duplicateTemplates(categoryId: string, newCategoryId: string) {
  await ensureCategoryUploadTemplateSchema();
  const rows = await prisma.$queryRaw<TemplateRow[]>`
    SELECT * FROM "CategoryUploadTemplate"
    WHERE "categoryId" = ${categoryId}
  `;

  for (const row of rows) {
    if (row.subcategoryId) continue;
    await saveCategoryUploadTemplate({
      categoryId: newCategoryId,
      subcategoryId: null,
      productTypeId: null,
      productTypes: parseJson<string[]>(row.productTypes, []),
      specTemplate: parseJson(row.specTemplate, {
        title: 'Category Specifications',
        helpText: '',
        fields: [],
      }),
      variantConfig: parseJson(row.variantConfig, {
        title: 'Variant, Option & Stock Rows',
        note: '',
        selectedStyle: 'Managed category template',
        sizeLabelHeading: 'Option Label',
        sizeLabelPlaceholder: '',
        numericSizeHeading: 'Option Detail',
        numericSizePlaceholder: '',
        colorHeading: 'Color / Type',
        colorPlaceholder: '',
        skuHeading: 'Variant SKU',
        skuPlaceholder: '',
        defaultSizePlaceholder: '',
        availableSizesPlaceholder: '',
        brandMappingPlaceholder: '',
        examples: [],
      }),
      sizeChart: row.sizeChart || '',
      requiredFields: parseJson<string[]>(row.requiredFields, []),
    });
  }
}

export async function GET() {
  try {
    const auth = await requireAdminApiUser();
    if (auth.response) return auth.response;

    await ensureCategoryAtelierSchema();
    const invalidImageCleanup = await clearInvalidMetadataImages();

    const [categories, templates, auditLogs] = await Promise.all([
      prisma.category.findMany({
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: {
          subcategories: {
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
            include: {
              productTypes: {
                orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
              },
            },
          },
        },
      }),
      getTemplates(),
      prisma.categoryAuditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 80,
      }),
    ]);

    return NextResponse.json({ categories, templates, auditLogs, invalidImageCleanup });
  } catch (error) {
    console.error('Category atelier fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to load category atelier data' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdminApiUser();
    if (auth.response) return auth.response;

    await ensureCategoryAtelierSchema();

    const body = await request.json();
    const action = String(body.action || '');
    const adminUser = auth.user.id;

    if (action === 'createCategory') {
      const name = String(body.name || '').trim();
      if (!name) return NextResponse.json({ error: 'Category name is required' }, { status: 400 });

      const category = await prisma.category.create({
        data: {
          name,
          slug: slugify(body.slug || name) || `category-${Date.now()}`,
          status: body.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
          sortOrder: Number(body.sortOrder || 0),
        },
      });
      await audit(adminUser, 'create', 'category', category.id, null, category);
      return NextResponse.json({ category });
    }

    if (action === 'createSubcategory') {
      const name = String(body.name || '').trim();
      const categoryId = String(body.categoryId || '');
      if (!name || !categoryId) {
        return NextResponse.json({ error: 'Subcategory name and category are required' }, { status: 400 });
      }

      const subcategory = await prisma.subcategory.create({
        data: {
          name,
          categoryId,
          slug: slugify(body.slug || `${name}-${Date.now()}`) || `subcategory-${Date.now()}`,
          sortOrder: Number(body.sortOrder || 0),
        },
      });
      await audit(adminUser, 'create', 'subcategory', subcategory.id, null, subcategory);
      return NextResponse.json({ subcategory });
    }

    if (action === 'createProductType') {
      const name = String(body.name || '').trim();
      const subcategoryId = String(body.subcategoryId || '');
      if (!name || !subcategoryId) {
        return NextResponse.json({ error: 'Product type name and subcategory are required' }, { status: 400 });
      }

      const productType = await prisma.productType.create({
        data: {
          name,
          subcategoryId,
          slug: slugify(body.slug || `${name}-${Date.now()}`) || `product-type-${Date.now()}`,
          sortOrder: Number(body.sortOrder || 0),
        },
      });
      await audit(adminUser, 'create', 'productType', productType.id, null, productType);
      return NextResponse.json({ productType });
    }

    if (action === 'updateEntity') {
      const entityType = body.entityType as EntityType;
      const id = String(body.id || '');
      if (!['category', 'subcategory', 'productType'].includes(entityType) || !id) {
        return NextResponse.json({ error: 'Valid entity type and id are required' }, { status: 400 });
      }

      const before = await getEntity(entityType, id);
      const after = await updateEntity(entityType, id, body.updates || {});
      await audit(adminUser, 'update', entityType, id, before, after);
      return NextResponse.json({ entity: after });
    }

    if (action === 'move') {
      const entityType = body.entityType as EntityType;
      const id = String(body.id || '');
      const parentId = String(body.parentId || '');
      const before = await getEntity(entityType, id);
      let after = null;

      if (entityType === 'subcategory') {
        after = await prisma.subcategory.update({ where: { id }, data: { categoryId: parentId } });
      } else if (entityType === 'productType') {
        after = await prisma.productType.update({ where: { id }, data: { subcategoryId: parentId } });
      } else {
        return NextResponse.json({ error: 'Only subcategories and product types can be moved' }, { status: 400 });
      }

      await audit(adminUser, 'move', entityType, id, before, after);
      return NextResponse.json({ entity: after });
    }

    if (action === 'reorder') {
      const items = Array.isArray(body.items) ? body.items : [];
      for (const item of items) {
        const entityType = item.entityType as EntityType;
        const id = String(item.id || '');
        const sortOrder = Number(item.sortOrder || 0);
        if (entityType === 'category') await prisma.category.update({ where: { id }, data: { sortOrder } });
        if (entityType === 'subcategory') await prisma.subcategory.update({ where: { id }, data: { sortOrder } });
        if (entityType === 'productType') await prisma.productType.update({ where: { id }, data: { sortOrder } });
      }
      await audit(adminUser, 'reorder', 'categoryTree', null, null, items);
      return NextResponse.json({ success: true });
    }

    if (action === 'duplicateCategory') {
      const id = String(body.id || '');
      const source = await prisma.category.findUnique({
        where: { id },
        include: { subcategories: { include: { productTypes: true } } },
      });
      if (!source) return NextResponse.json({ error: 'Category not found' }, { status: 404 });

      const suffix = `Copy ${Date.now()}`;
      const category = await prisma.category.create({
        data: {
          name: `${source.name} ${suffix}`,
          slug: `${source.slug}-copy-${Date.now()}`,
          status: 'INACTIVE',
          sortOrder: source.sortOrder + 1,
          homepageIcon: source.homepageIcon,
          categoryImage: source.categoryImage,
          desktopBanner: source.desktopBanner,
          mobileBanner: source.mobileBanner,
          altText: source.altText,
        },
      });

      for (const subcategory of source.subcategories) {
        const newSubcategory = await prisma.subcategory.create({
          data: {
            name: subcategory.name,
            slug: `${subcategory.slug}-copy-${Date.now()}`,
            categoryId: category.id,
            status: subcategory.status,
            sortOrder: subcategory.sortOrder,
            homepageIcon: subcategory.homepageIcon,
            categoryImage: subcategory.categoryImage,
            desktopBanner: subcategory.desktopBanner,
            mobileBanner: subcategory.mobileBanner,
            altText: subcategory.altText,
          },
        });

        for (const productType of subcategory.productTypes) {
          await prisma.productType.create({
            data: {
              name: productType.name,
              slug: `${productType.slug}-copy-${Date.now()}`,
              subcategoryId: newSubcategory.id,
              status: productType.status,
              sortOrder: productType.sortOrder,
              homepageIcon: productType.homepageIcon,
              categoryImage: productType.categoryImage,
              desktopBanner: productType.desktopBanner,
              mobileBanner: productType.mobileBanner,
              altText: productType.altText,
            },
          });
        }
      }

      await duplicateTemplates(source.id, category.id);
      await audit(adminUser, 'duplicate', 'category', source.id, source, category);
      return NextResponse.json({ category });
    }

    if (action === 'mergeCategory') {
      const sourceId = String(body.sourceId || '');
      const targetId = String(body.targetId || '');
      if (!sourceId || !targetId || sourceId === targetId) {
        return NextResponse.json({ error: 'Source and target categories are required' }, { status: 400 });
      }

      const source = await prisma.category.findUnique({ where: { id: sourceId } });
      const target = await prisma.category.findUnique({ where: { id: targetId } });
      if (!source || !target) return NextResponse.json({ error: 'Category not found' }, { status: 404 });

      await prisma.$transaction([
        prisma.product.updateMany({ where: { categoryId: sourceId }, data: { categoryId: targetId } }),
        prisma.category.update({
          where: { id: sourceId },
          data: { status: 'ARCHIVED', archivedAt: new Date() },
        }),
      ]);

      await audit(adminUser, 'merge', 'category', sourceId, source, { targetId });
      return NextResponse.json({ success: true });
    }

    if (action === 'deleteEntity') {
      const entityType = body.entityType as EntityType;
      const id = String(body.id || '');
      if (!body.confirmed) {
        return NextResponse.json({ error: 'Delete confirmation is required' }, { status: 400 });
      }
      const before = await getEntity(entityType, id);

      if (entityType === 'category') {
        const [childCount, productCount] = await Promise.all([
          prisma.subcategory.count({ where: { categoryId: id } }),
          prisma.product.count({ where: { categoryId: id } }),
        ]);
        if (childCount > 0 || productCount > 0) {
          return NextResponse.json(
            {
              error:
                'Permanent delete is blocked because this category has linked records. Archive, merge, or reassign children first.',
            },
            { status: 409 },
          );
        }
        await prisma.$transaction([
          prisma.product.updateMany({
            where: { categoryId: id },
            data: { categoryId: null, subcategoryId: null, productTypeId: null },
          }),
          prisma.category.delete({ where: { id } }),
        ]);
      } else if (entityType === 'subcategory') {
        const [leafCount, productCount] = await Promise.all([
          prisma.productType.count({ where: { subcategoryId: id } }),
          prisma.product.count({ where: { subcategoryId: id } }),
        ]);
        if (leafCount > 0 || productCount > 0) {
          return NextResponse.json(
            {
              error:
                'Permanent delete is blocked because this subcategory has linked records. Archive, merge, or reassign children first.',
            },
            { status: 409 },
          );
        }
        await prisma.$transaction([
          prisma.product.updateMany({
            where: { subcategoryId: id },
            data: { subcategoryId: null, productTypeId: null },
          }),
          prisma.subcategory.delete({ where: { id } }),
        ]);
      } else if (entityType === 'productType') {
        const productCount = await prisma.product.count({ where: { productTypeId: id } });
        if (productCount > 0) {
          return NextResponse.json(
            {
              error:
                'Permanent delete is blocked because this product type has linked products. Archive or reassign products first.',
            },
            { status: 409 },
          );
        }
        await prisma.$transaction([
          prisma.product.updateMany({ where: { productTypeId: id }, data: { productTypeId: null } }),
          prisma.productType.delete({ where: { id } }),
        ]);
      } else {
        return NextResponse.json({ error: 'Valid entity type is required' }, { status: 400 });
      }

      await audit(adminUser, 'delete', entityType, id, before, { confirmed: true });
      return NextResponse.json({ success: true });
    }

    if (action === 'recordAudit') {
      const entityType = String(body.entityType || 'category');
      const entityId = body.entityId ? String(body.entityId) : null;
      const auditAction = String(body.auditAction || 'update');
      await audit(adminUser, auditAction, entityType, entityId, body.oldValue || null, body.newValue || null);
      return NextResponse.json({ success: true });
    }

    if (action === 'restoreTemplate') {
      const categoryId = String(body.categoryId || '');
      const subcategoryId = body.subcategoryId ? String(body.subcategoryId) : null;
      const productTypeId = body.productTypeId ? String(body.productTypeId) : null;
      const template = await getCategoryUploadTemplate(categoryId, subcategoryId, productTypeId);
      await audit(adminUser, 'restore-template', 'template', productTypeId || subcategoryId || categoryId, null, template);
      return NextResponse.json({ template });
    }

    return NextResponse.json({ error: 'Unknown category atelier action' }, { status: 400 });
  } catch (error) {
    console.error('Category atelier action error:', error);
    return NextResponse.json(
      { error: 'Category atelier action failed' },
      { status: 500 },
    );
  }
}
