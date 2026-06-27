import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaPg } from '@prisma/adapter-pg';

dotenv.config({ path: '.env.local' });

const DEFAULT_SQLITE_URL = 'file:./dev.db';

const databaseUrl = process.env.DATABASE_URL ?? DEFAULT_SQLITE_URL;

declare global {
  var prisma: PrismaClient | undefined;
}

function createPrismaClient() {
  if (databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://')) {
    return new PrismaClient({
      adapter: new PrismaPg({ connectionString: databaseUrl }),
    });
  }

  return new PrismaClient({
    adapter: new PrismaBetterSqlite3({
      url: databaseUrl,
    }),
  });
}

export const prisma = global.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}
