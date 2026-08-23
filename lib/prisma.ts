import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { getPostgresPoolConfig } from '@/lib/database-pool-config';

dotenv.config({ path: '.env.local' });

const DEFAULT_SQLITE_URL = 'file:./dev.db';

const databaseUrl = process.env.DATABASE_URL ?? DEFAULT_SQLITE_URL;

declare global {
  var prisma: PrismaClient | undefined;
  var prismaPgPool: Pool | undefined;
}

const isPostgres =
  databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://');

function getOrCreatePostgresClient() {
  if (global.prisma && global.prismaPgPool) {
    return global.prisma;
  }

  const pool =
    global.prismaPgPool ??
    new Pool({
      connectionString: databaseUrl,
      ...getPostgresPoolConfig(),
    });
  const client = new PrismaClient({
    adapter: new PrismaPg(pool),
  });

  global.prismaPgPool = pool;
  global.prisma = client;

  return client;
}

function getOrCreateSqliteClient() {
  if (global.prisma) {
    return global.prisma;
  }

  const client = new PrismaClient({
    adapter: new PrismaBetterSqlite3({
      url: databaseUrl,
    }),
  });

  global.prisma = client;

  return client;
}

export const prisma = isPostgres
  ? getOrCreatePostgresClient()
  : getOrCreateSqliteClient();
