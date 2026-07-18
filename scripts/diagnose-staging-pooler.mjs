import fs from "node:fs";
import pg from "pg";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const STAGING_REF = "tltcnxuhrqweyxpxjdtd";
const PRODUCTION_REF = "uvembydjrayvnrooyywl";

function readEnvFile(file) {
  const values = {};
  if (!fs.existsSync(file)) return values;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=]+)=(.*)$/);
    if (match) values[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
  return values;
}

function requireValue(values, key) {
  const value = values[key];
  if (!value) throw new Error(`${key} missing`);
  return value;
}

function assertSafe(parts, staging) {
  if (Object.values({ ...parts, ...staging }).some((value) => String(value).includes(PRODUCTION_REF))) {
    throw new Error("Refusing production ref");
  }
  if (staging.STAGING_SUPABASE_PROJECT_REF !== STAGING_REF) {
    throw new Error("Refusing non-staging project ref");
  }
  if (parts.STAGING_DB_HOST !== "aws-1-ap-south-1.pooler.supabase.com") {
    throw new Error("Unexpected pooler host");
  }
  if (Number(parts.STAGING_DB_PORT) !== 5432) {
    throw new Error("Unexpected session pooler port");
  }
  if (parts.STAGING_DB_NAME !== "postgres") {
    throw new Error("Unexpected database name");
  }
  if (parts.STAGING_DB_USER !== `postgres.${STAGING_REF}`) {
    throw new Error("Unexpected pooler username");
  }
  requireValue(parts, "STAGING_DB_PASSWORD");
}

if (process.argv.includes("--self-test-production-ref")) {
  let rejected = false;
  try {
    assertSafe(
      {
        STAGING_DB_HOST: "aws-1-ap-south-1.pooler.supabase.com",
        STAGING_DB_PORT: "5432",
        STAGING_DB_NAME: "postgres",
        STAGING_DB_USER: `postgres.${STAGING_REF}`,
        STAGING_DB_PASSWORD: "placeholder",
      },
      {
        STAGING_SUPABASE_PROJECT_REF: STAGING_REF,
        STAGING_SUPABASE_URL: `https://${PRODUCTION_REF}.supabase.co`,
      },
    );
  } catch {
    rejected = true;
  }
  console.log(JSON.stringify({ targetRef: STAGING_REF, productionRefRejected: rejected }, null, 2));
  process.exit(rejected ? 0 : 1);
}

function classify(error) {
  const message = String(error?.meta?.message || error?.message || "").toLowerCase();
  if (error?.code === "28P01") return "PASSWORD_MISMATCH";
  if (error?.code === "ENOTFOUND" || error?.code === "EAI_AGAIN") return "DNS";
  if (error?.code === "ETIMEDOUT" || error?.code === "ESOCKETTIMEDOUT") return "TCP_TIMEOUT";
  if (message.includes("timeout")) return "TIMEOUT";
  if (message.includes("ssl")) return "SSL";
  if (message.includes("pgbouncer")) return "PGBOUNCER";
  if (message.includes("prepared statement")) return "PREPARED_STATEMENT";
  if (message.includes("unsupported startup parameter")) return "UNSUPPORTED_STARTUP_PARAMETER";
  return "OTHER";
}

async function pgProbe(name, config) {
  const client = new pg.Client({
    ...config,
    connectionTimeoutMillis: 30000,
    query_timeout: 30000,
  });
  const startedAt = Date.now();
  let phase = "connect";
  try {
    await client.connect();
    phase = "query";
    const result = await client.query("SELECT 1 AS ok");
    await client.end();
    return { name, ok: result.rows[0]?.ok === 1, phase: "done", ms: Date.now() - startedAt };
  } catch (error) {
    try {
      await client.end();
    } catch {}
    return {
      name,
      ok: false,
      phase,
      code: error?.code || "unknown",
      category: classify(error),
      ms: Date.now() - startedAt,
    };
  }
}

function poolerUrl(port, password, params = {}) {
  const url = new URL(
    `postgresql://postgres.${STAGING_REF}:${encodeURIComponent(password)}@aws-1-ap-south-1.pooler.supabase.com:${port}/postgres`,
  );
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

async function prismaProbe(name, connectionString) {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
  const startedAt = Date.now();
  try {
    const result = await prisma.$queryRaw`SELECT 1 AS ok`;
    await prisma.$disconnect();
    return { name, ok: Array.isArray(result) && result[0]?.ok === 1, ms: Date.now() - startedAt };
  } catch (error) {
    await prisma.$disconnect().catch(() => undefined);
    return {
      name,
      ok: false,
      code: error?.code || "unknown",
      category: classify(error),
      metaCode: error?.meta?.code || null,
      ms: Date.now() - startedAt,
    };
  }
}

const parts = readEnvFile(".env.staging.db.parts.local");
const staging = readEnvFile(".env.staging.local");
assertSafe(parts, staging);

const password = parts.STAGING_DB_PASSWORD;
const base = {
  host: "aws-1-ap-south-1.pooler.supabase.com",
  database: "postgres",
  user: `postgres.${STAGING_REF}`,
  password,
};

const sessionNoSsl = await pgProbe("session-pooler-5432-no-ssl", { ...base, port: 5432, ssl: false });
const sessionSsl = await pgProbe("session-pooler-5432-ssl", { ...base, port: 5432, ssl: { rejectUnauthorized: false } });
const transactionNoSsl = await pgProbe("transaction-pooler-6543-no-ssl", { ...base, port: 6543, ssl: false });
const transactionSsl = await pgProbe("transaction-pooler-6543-ssl", { ...base, port: 6543, ssl: { rejectUnauthorized: false } });

const prismaResults = [];
if (sessionSsl.ok || sessionNoSsl.ok) {
  prismaResults.push(await prismaProbe("prisma-session-pooler", poolerUrl(5432, password, { sslmode: "require" })));
  prismaResults.push(await prismaProbe("prisma-session-pooler-libpq-ssl", poolerUrl(5432, password, {
    sslmode: "require",
    uselibpqcompat: "true",
  })));
}
if (transactionSsl.ok || transactionNoSsl.ok) {
  prismaResults.push(await prismaProbe("prisma-transaction-pooler", poolerUrl(6543, password, {
    sslmode: "require",
  })));
  prismaResults.push(await prismaProbe("prisma-transaction-pooler-pgbouncer", poolerUrl(6543, password, {
    sslmode: "require",
    pgbouncer: "true",
    connection_limit: "1",
  })));
  prismaResults.push(await prismaProbe("prisma-transaction-pooler-libpq-ssl", poolerUrl(6543, password, {
    sslmode: "require",
    uselibpqcompat: "true",
  })));
}

const pgResults = [sessionNoSsl, sessionSsl, transactionNoSsl, transactionSsl];
let result = "DIRECT CONNECTION REQUIRED FOR STAGING TESTS";
if (prismaResults.some((probe) => probe.ok)) {
  result = "POOLER FIXED";
} else if (
  pgResults.every((probe) => probe.category === "PASSWORD_MISMATCH") ||
  pgResults.every((probe) => ["PASSWORD_MISMATCH", "TCP_TIMEOUT", "TIMEOUT"].includes(probe.category || ""))
) {
  result = "SUPABASE SUPPORT REQUIRED";
}

console.log(JSON.stringify({
  targetRef: STAGING_REF,
  inspected: {
    sessionPooler: { host: "aws-1-ap-south-1.pooler.supabase.com", port: 5432, user: `postgres.${STAGING_REF}` },
    transactionPoolerAssumption: { host: "aws-1-ap-south-1.pooler.supabase.com", port: 6543, user: `postgres.${STAGING_REF}` },
    prismaCompatibleParamsTested: true,
  },
  pgResults,
  prismaResults,
  result,
}, null, 2));
