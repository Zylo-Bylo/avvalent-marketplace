import crypto from "node:crypto";
import fs from "node:fs";
import pg from "pg";

const STAGING_REF = "tltcnxuhrqweyxpxjdtd";
const PRODUCTION_REF = "uvembydjrayvnrooyywl";
const ROOT_FALLBACK = "D:\\PROJECTS\\zylo-buylo";

const authAccounts = [
  ["admin", "STAGING_ADMIN_EMAIL", "ADMIN"],
  ["customerA", "STAGING_CUSTOMER_A_EMAIL", "CUSTOMER"],
  ["customerB", "STAGING_CUSTOMER_B_EMAIL", "CUSTOMER"],
  ["vendorA", "STAGING_VENDOR_A_EMAIL", "VENDOR"],
  ["vendorB", "STAGING_VENDOR_B_EMAIL", "VENDOR"],
];

function readEnvFile(file) {
  const values = {};
  if (!fs.existsSync(file)) return values;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=]+)=(.*)$/);
    if (match) {
      values[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, "");
    }
  }
  return values;
}

function readEnv(name) {
  const local = readEnvFile(name);
  if (Object.keys(local).length > 0) return local;
  return readEnvFile(`${ROOT_FALLBACK}\\${name}`);
}

function requireValue(values, key) {
  const value = values[key];
  if (!value) throw new Error(`${key} missing`);
  return value;
}

function assertStaging(staging, parts, test) {
  if (staging.STAGING_SUPABASE_PROJECT_REF !== STAGING_REF) {
    throw new Error("Refusing non-staging project ref.");
  }
  if (parts.STAGING_DB_USER !== `postgres.${STAGING_REF}`) {
    throw new Error("Unexpected staging DB user marker.");
  }
  if (parts.STAGING_DB_HOST !== "aws-1-ap-south-1.pooler.supabase.com") {
    throw new Error("Unexpected staging DB host marker.");
  }
  const activeValues = Object.values({ ...staging, ...parts, ...test }).join(" ");
  if (!activeValues.includes(STAGING_REF)) {
    throw new Error("Staging ref was not proven.");
  }
  if (activeValues.includes(PRODUCTION_REF)) {
    throw new Error("Refusing production ref in active target.");
  }
}

function dbConfig(parts) {
  return {
    host: `db.${STAGING_REF}.supabase.co`,
    port: 5432,
    database: "postgres",
    user: "postgres",
    password: requireValue(parts, "STAGING_DB_PASSWORD"),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  };
}

function redact(message) {
  return String(message || "unknown")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "<REDACTED_EMAIL>")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, "<REDACTED_UUID>")
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "<REDACTED_DATABASE_URL>");
}

const apply = process.argv.includes("--apply");
const staging = readEnv(".env.staging.local");
const parts = readEnv(".env.staging.db.parts.local");
const test = readEnv(".env.staging.test.local");
assertStaging(staging, parts, test);

if (!apply) {
  console.log(JSON.stringify({
    targetRef: STAGING_REF,
    mode: "preview",
    proposedMappings: authAccounts.length,
    writes: false,
  }, null, 2));
  process.exit(0);
}

const client = new pg.Client(dbConfig(parts));

try {
  await client.connect();

  const sqlPath = "supabase/proposed/20260719000100_auth_identity_mapping.sql";
  const mappingSql = fs.readFileSync(sqlPath, "utf8");
  await client.query(mappingSql);

  await client.query("begin");
  await client.query("set local statement_timeout = '30s'");

  const emails = authAccounts.map(([, emailKey]) => requireValue(test, emailKey).toLowerCase());
  const authResult = await client.query(
    `select id::text, email, raw_app_meta_data
       from auth.users
      where lower(email) = any($1::text[])`,
    [emails],
  );
  const appResult = await client.query(
    `select id::text, email, role::text
       from public."User"
      where lower(email) = any($1::text[])`,
    [emails],
  );

  const mapped = [];
  for (const [label, emailKey, expectedRole] of authAccounts) {
    const email = requireValue(test, emailKey).toLowerCase();
    const authUser = authResult.rows.find((row) => row.email?.toLowerCase() === email);
    const appUser = appResult.rows.find((row) => row.email?.toLowerCase() === email);
    if (!authUser) throw new Error(`Missing staging Auth user for ${label}.`);
    if (!appUser) throw new Error(`Missing staging app User for ${label}.`);
    if (authUser.id !== appUser.id) {
      throw new Error(`Staging Auth/app User ID mismatch for ${label}.`);
    }
    const protectedRole = authUser.raw_app_meta_data?.role || null;
    if (expectedRole === "ADMIN" && protectedRole !== "ADMIN") {
      throw new Error("Staging admin Auth user lacks protected ADMIN role.");
    }
    if (expectedRole !== "ADMIN" && protectedRole === "ADMIN") {
      throw new Error(`${label} unexpectedly has protected ADMIN role.`);
    }
    if (appUser.role !== expectedRole) {
      throw new Error(`Unexpected app role for ${label}.`);
    }

    await client.query(
      `insert into public."AuthIdentityMapping" ("id", "userId", "authUserId", "provider", "createdAt", "updatedAt")
       values ($1, $2, $3::uuid, 'supabase', now(), now())
       on conflict ("userId")
       do update set
         "authUserId" = excluded."authUserId",
         provider = 'supabase',
         "updatedAt" = now()`,
      [`stg_auth_identity_mapping_${label}`, appUser.id, authUser.id],
    );
    mapped.push({ label, expectedRole, mapped: true });
  }

  const verify = await client.query(`
    select count(*)::int as count
    from public."AuthIdentityMapping"
    where provider = 'supabase'
  `);
  await client.query("commit");

  console.log(JSON.stringify({
    targetRef: STAGING_REF,
    mode: "apply",
    tableApplied: true,
    mappingCount: mapped.length,
    totalMappingRows: verify.rows[0]?.count ?? null,
    mapped,
    emailPrinted: false,
    uuidPrinted: false,
  }, null, 2));
} catch (error) {
  try {
    await client.query("rollback");
  } catch {
    // no-op
  }
  console.error(JSON.stringify({
    targetRef: STAGING_REF,
    error: redact(error?.message || error),
    emailPrinted: false,
    uuidPrinted: false,
  }, null, 2));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
