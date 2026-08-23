export const DEFAULT_DB_POOL_MAX = 2;
export const MAX_DB_POOL_MAX = 10;
export const DB_POOL_IDLE_TIMEOUT_MS = 5_000;
export const DB_POOL_CONNECTION_TIMEOUT_MS = 5_000;

export function parseDatabasePoolMax(value: string | undefined): number {
  const normalized = value?.trim();

  if (!normalized || !/^\d+$/.test(normalized)) {
    return DEFAULT_DB_POOL_MAX;
  }

  const parsed = Number(normalized);

  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > MAX_DB_POOL_MAX) {
    return DEFAULT_DB_POOL_MAX;
  }

  return parsed;
}

export function getPostgresPoolConfig(
  environment: { DB_POOL_MAX?: string } = {
    DB_POOL_MAX: process.env.DB_POOL_MAX,
  },
) {
  return {
    max: parseDatabasePoolMax(environment.DB_POOL_MAX),
    min: 0,
    idleTimeoutMillis: DB_POOL_IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: DB_POOL_CONNECTION_TIMEOUT_MS,
  } as const;
}
