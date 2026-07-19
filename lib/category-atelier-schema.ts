import { prisma } from '@/lib/prisma';

const categoryColumns = [
  ['status', "TEXT NOT NULL DEFAULT 'ACTIVE'"],
  ['sortOrder', 'INTEGER NOT NULL DEFAULT 0'],
  ['homepageIcon', 'TEXT'],
  ['categoryImage', 'TEXT'],
  ['desktopBanner', 'TEXT'],
  ['mobileBanner', 'TEXT'],
  ['altText', 'TEXT'],
  ['archivedAt', 'TIMESTAMP'],
] as const;

const subcategoryColumns = categoryColumns;
const productColumns = [['productTypeId', 'TEXT']] as const;

let ensured = false;

function isPostgres() {
  const url = process.env.DATABASE_URL || '';
  return url.startsWith('postgresql://') || url.startsWith('postgres://');
}

async function sqliteColumnExists(table: string, column: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    `PRAGMA table_info("${table}")`,
  );
  return rows.some((row) => row.name === column);
}

async function addColumnsIfMissing(
  table: string,
  columns: readonly (readonly [string, string])[],
) {
  if (isPostgres()) {
    for (const [name, definition] of columns) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${name}" ${definition}`,
      );
    }
    return;
  }

  for (const [name, definition] of columns) {
    if (!(await sqliteColumnExists(table, name))) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "${table}" ADD COLUMN "${name}" ${definition}`,
      );
    }
  }
}

export async function ensureCategoryAtelierSchema() {
  if (ensured) return;

  await addColumnsIfMissing('Category', categoryColumns);
  await addColumnsIfMissing('Subcategory', subcategoryColumns);
  await addColumnsIfMissing('Product', productColumns);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ProductType" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "slug" TEXT NOT NULL UNIQUE,
      "status" TEXT NOT NULL DEFAULT 'ACTIVE',
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "homepageIcon" TEXT,
      "categoryImage" TEXT,
      "desktopBanner" TEXT,
      "mobileBanner" TEXT,
      "altText" TEXT,
      "archivedAt" TIMESTAMP,
      "subcategoryId" TEXT NOT NULL,
      "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CategoryAuditLog" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "adminUser" TEXT NOT NULL,
      "action" TEXT NOT NULL,
      "entityType" TEXT NOT NULL,
      "entityId" TEXT,
      "oldValue" ${isPostgres() ? 'JSONB' : 'JSON'},
      "newValue" ${isPostgres() ? 'JSONB' : 'JSON'},
      "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(
    'CREATE UNIQUE INDEX IF NOT EXISTS "ProductType_subcategoryId_name_key" ON "ProductType" ("subcategoryId", "name")',
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "ProductType_subcategoryId_idx" ON "ProductType" ("subcategoryId")',
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "ProductType_status_idx" ON "ProductType" ("status")',
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "ProductType_sortOrder_idx" ON "ProductType" ("sortOrder")',
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "Category_status_idx" ON "Category" ("status")',
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "Category_sortOrder_idx" ON "Category" ("sortOrder")',
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "Subcategory_status_idx" ON "Subcategory" ("status")',
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "Subcategory_sortOrder_idx" ON "Subcategory" ("sortOrder")',
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "Product_productTypeId_idx" ON "Product" ("productTypeId")',
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "CategoryAuditLog_entityType_idx" ON "CategoryAuditLog" ("entityType")',
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "CategoryAuditLog_entityId_idx" ON "CategoryAuditLog" ("entityId")',
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "CategoryAuditLog_createdAt_idx" ON "CategoryAuditLog" ("createdAt")',
  );

  ensured = true;
}
