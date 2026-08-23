import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DB_POOL_CONNECTION_TIMEOUT_MS,
  DB_POOL_IDLE_TIMEOUT_MS,
  DEFAULT_DB_POOL_MAX,
  getPostgresPoolConfig,
  parseDatabasePoolMax,
} from '@/lib/database-pool-config';

const constructors = vi.hoisted(() => {
  const pool = { kind: 'bounded-pg-pool' };
  const adapter = { kind: 'prisma-pg-adapter' };
  const client = { kind: 'shared-prisma-client' };

  return {
    pool,
    adapter,
    client,
    Pool: vi.fn(function Pool() {
      return pool;
    }),
    PrismaPg: vi.fn(function PrismaPg() {
      return adapter;
    }),
    PrismaClient: vi.fn(function PrismaClient() {
      return client;
    }),
    PrismaBetterSqlite3: vi.fn(),
    dotenvConfig: vi.fn(),
  };
});

vi.mock('pg', () => ({ Pool: constructors.Pool }));
vi.mock('@prisma/adapter-pg', () => ({ PrismaPg: constructors.PrismaPg }));
vi.mock('@prisma/client', () => ({ PrismaClient: constructors.PrismaClient }));
vi.mock('@prisma/adapter-better-sqlite3', () => ({
  PrismaBetterSqlite3: constructors.PrismaBetterSqlite3,
}));
vi.mock('dotenv', () => ({ default: { config: constructors.dotenvConfig } }));

function clearDatabaseGlobals() {
  delete globalThis.prisma;
  delete globalThis.prismaPgPool;
}

function collectRouteFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return collectRouteFiles(entryPath);
    }

    return entry.name === 'route.ts' ? [entryPath] : [];
  });
}

describe('database pool configuration', () => {
  it('uses a conservative bounded default and fixed timeouts', () => {
    expect(getPostgresPoolConfig({ DB_POOL_MAX: undefined })).toEqual({
      max: DEFAULT_DB_POOL_MAX,
      min: 0,
      idleTimeoutMillis: DB_POOL_IDLE_TIMEOUT_MS,
      connectionTimeoutMillis: DB_POOL_CONNECTION_TIMEOUT_MS,
    });
    expect(DEFAULT_DB_POOL_MAX).toBe(2);
    expect(DB_POOL_IDLE_TIMEOUT_MS).toBe(5_000);
    expect(DB_POOL_CONNECTION_TIMEOUT_MS).toBe(5_000);
  });

  it('accepts a safe whole-number environment override', () => {
    expect(getPostgresPoolConfig({ DB_POOL_MAX: '4' }).max).toBe(4);
  });

  it.each([undefined, '', '0', '-1', '1.5', 'eleven', '11']) (
    'falls back safely for invalid DB_POOL_MAX=%s',
    (value) => {
      expect(parseDatabasePoolMax(value)).toBe(2);
    },
  );
});

describe('canonical Prisma client construction', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    clearDatabaseGlobals();
    process.env.DATABASE_URL = 'postgresql://user:password@pooler.example:6543/postgres';
    delete process.env.DB_POOL_MAX;
  });

  afterEach(() => {
    clearDatabaseGlobals();
    delete process.env.DATABASE_URL;
    delete process.env.DB_POOL_MAX;
  });

  it('constructs one bounded pg Pool and passes it to PrismaPg', async () => {
    const { prisma } = await import('@/lib/prisma');

    expect(prisma).toBe(constructors.client);
    expect(constructors.Pool).toHaveBeenCalledOnce();
    expect(constructors.Pool).toHaveBeenCalledWith({
      connectionString: process.env.DATABASE_URL,
      max: 2,
      min: 0,
      idleTimeoutMillis: 5_000,
      connectionTimeoutMillis: 5_000,
    });
    expect(constructors.PrismaPg).toHaveBeenCalledWith(constructors.pool);
    expect(constructors.PrismaClient).toHaveBeenCalledWith({
      adapter: constructors.adapter,
    });
  });

  it('uses the validated pool-size override in the canonical module', async () => {
    process.env.DB_POOL_MAX = '3';

    await import('@/lib/prisma');

    expect(constructors.Pool).toHaveBeenCalledWith(
      expect.objectContaining({ max: 3 }),
    );
  });

  it('reuses one pool and client across concurrent and repeated module imports', async () => {
    const modules = await Promise.all([
      import('@/lib/prisma'),
      import('@/lib/prisma'),
      import('@/lib/prisma'),
    ]);
    const repeated = await import('@/lib/prisma');

    expect(new Set([...modules, repeated].map((module) => module.prisma)).size).toBe(1);
    expect(constructors.Pool).toHaveBeenCalledOnce();
    expect(constructors.PrismaClient).toHaveBeenCalledOnce();
  });

  it('reuses global pool and client after a module re-evaluation', async () => {
    const first = await import('@/lib/prisma');
    vi.resetModules();
    const second = await import('@/lib/prisma');

    expect(second.prisma).toBe(first.prisma);
    expect(constructors.Pool).toHaveBeenCalledOnce();
    expect(constructors.PrismaClient).toHaveBeenCalledOnce();
  });
});

describe('route database constructor guard', () => {
  it('keeps Prisma and pg constructors out of every HTTP route', () => {
    const routeFiles = collectRouteFiles(path.join(process.cwd(), 'app', 'api'));
    const directConstructor = /new\s+(?:PrismaClient|Pool)\s*\(|new\s+PrismaPg\s*\(/;

    expect(routeFiles.length).toBeGreaterThan(0);

    for (const routeFile of routeFiles) {
      expect(readFileSync(routeFile, 'utf8'), routeFile).not.toMatch(directConstructor);
    }
  });

  it('keeps catalogue and inventory modules on the canonical Prisma import', () => {
    const databaseConsumers = [
      'app/api/categories/route.ts',
      'app/api/subcategories/route.ts',
      'app/api/products/route.ts',
      'app/api/vendor/inventory/route.ts',
      'app/api/admin/inventory/route.ts',
      'lib/category-upload-templates.ts',
      'lib/inventory.ts',
    ];

    for (const relativePath of databaseConsumers) {
      const source = readFileSync(path.join(process.cwd(), relativePath), 'utf8');
      expect(source, relativePath).toContain("@/lib/prisma");
    }
  });
});
