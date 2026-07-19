import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import crypto from "node:crypto";

const ROOT = process.cwd();
const EXPECTED_PRODUCTION_REF = "uvembydjrayvnrooyywl";
const FORBIDDEN_STAGING_REF = "tltcnxuhrqweyxpxjdtd";
const ENV_PATH = "D:\\PROJECTS\\zylo-buylo\\.env.production.schema.local";

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.match(/^\s*([^#][^=]+)=(.*)$/))
      .filter(Boolean)
      .map((match) => [match[1].trim(), match[2].trim().replace(/^"|"$/g, "")]),
  );
}

function requireFromWorkspace(name) {
  for (const candidate of [path.join(ROOT, "package.json"), "D:\\PROJECTS\\zylo-buylo\\package.json"]) {
    try {
      return createRequire(candidate)(name);
    } catch {
      // Try the next dependency root.
    }
  }
  throw new Error(`${name} dependency is unavailable.`);
}

function assertProductionTarget(values) {
  const joined = Object.values(values).join(" ");
  if (!joined.includes(EXPECTED_PRODUCTION_REF)) {
    throw new Error("Production ref was not proven; refusing to continue.");
  }
  if (joined.includes(FORBIDDEN_STAGING_REF)) {
    throw new Error("Forbidden staging ref detected; refusing to continue.");
  }
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function redact(message) {
  return String(message || "unknown error").replace(/postgres(?:ql)?:\/\/\S+/gi, "<REDACTED_DATABASE_URL>");
}

const apply = process.argv.includes("--apply");
const env = { ...process.env, ...readEnvFile(ENV_PATH) };
const databaseUrl = env.PRODUCTION_DATABASE_URL || env.DATABASE_URL || "";
const supabaseUrl = env.SUPABASE_URL || `https://${EXPECTED_PRODUCTION_REF}.supabase.co`;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || env.PRODUCTION_SUPABASE_SERVICE_ROLE_KEY || "";
const targetAuthUserId = env.PRODUCTION_ADMIN_AUTH_USER_ID || "";

assertProductionTarget({ databaseUrl, supabaseUrl });

if (apply && !serviceRoleKey) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for --apply.");
}
if (apply && !isUuid(targetAuthUserId)) {
  throw new Error("PRODUCTION_ADMIN_AUTH_USER_ID must be set to the intended Auth UUID for --apply.");
}

const pg = requireFromWorkspace("pg");
const { createClient } = requireFromWorkspace("@supabase/supabase-js");
const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30000,
});

try {
  await client.connect();
  await client.query(apply ? "begin" : "begin read only");
  await client.query("set local statement_timeout = '30s'");

  const appAdmin = await client.query(`
    select id::text as id
    from public."User"
    where role::text = 'ADMIN'
  `);

  const exactlyOneAppAdmin = appAdmin.rowCount === 1;
  const mappingTableExists = await client.query(`
    select to_regclass('public."AuthIdentityMapping"')::text as relation
  `);
  const hasMappingTable = Boolean(mappingTableExists.rows[0]?.relation);
  const existingMappings = hasMappingTable
    ? await client.query(`
        select count(*)::int as count
        from public."AuthIdentityMapping"
      `)
    : { rows: [{ count: 0 }] };

  if (!apply) {
    await client.query("commit");
    console.log(JSON.stringify({
      mode: "preview",
      targetProjectRef: EXPECTED_PRODUCTION_REF,
      appAdminCount: appAdmin.rowCount,
      authIdentityMappingTableExists: hasMappingTable,
      existingMappingCount: existingMappings.rows[0]?.count ?? 0,
      requiresSeparateAuthUuid: true,
      canApplyAfterApproval: exactlyOneAppAdmin && isUuid(targetAuthUserId),
      emailPrinted: false,
      uuidPrinted: false,
      metadataPrinted: false,
    }, null, 2));
    process.exit(0);
  }

  if (!exactlyOneAppAdmin) {
    throw new Error("Expected exactly one application ADMIN user.");
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authBefore, error: authReadError } = await admin.auth.admin.getUserById(targetAuthUserId);
  if (authReadError) throw authReadError;
  if (!authBefore.user) throw new Error("Target Auth user was not found.");

  const currentMetadata = authBefore.user.app_metadata || {};
  await client.query(`
    insert into public."AuthIdentityMapping" ("id", "userId", "authUserId", "provider", "createdAt", "updatedAt")
    values ($1, $2, $3, 'supabase', current_timestamp, current_timestamp)
    on conflict ("userId")
    do update set
      "authUserId" = excluded."authUserId",
      "provider" = 'supabase',
      "updatedAt" = current_timestamp
  `, [crypto.randomUUID(), appAdmin.rows[0].id, targetAuthUserId]);

  const { error: updateError } = await admin.auth.admin.updateUserById(targetAuthUserId, {
    app_metadata: { ...currentMetadata, role: "ADMIN" },
  });
  if (updateError) throw updateError;

  const verify = await client.query(`
    select count(*)::int as count
    from public."AuthIdentityMapping" mapping
    inner join public."User" app_user on app_user.id = mapping."userId"
    where app_user.role::text = 'ADMIN'
      and mapping."authUserId" = $1
      and mapping.provider = 'supabase'
  `, [targetAuthUserId]);
  const { data: authAfter, error: verifyError } = await admin.auth.admin.getUserById(targetAuthUserId);
  if (verifyError) throw verifyError;
  if (verify.rows[0]?.count !== 1 || authAfter.user?.app_metadata?.role !== "ADMIN") {
    throw new Error("Admin identity mapping verification failed.");
  }

  await client.query("commit");
  console.log(JSON.stringify({
    mode: "apply",
    targetProjectRef: EXPECTED_PRODUCTION_REF,
    updatedOneMapping: true,
    updatedProtectedAppMetadata: true,
    verified: true,
    emailPrinted: false,
    uuidPrinted: false,
    metadataPrinted: false,
  }, null, 2));
} catch (error) {
  try {
    await client.query("rollback");
  } catch {
    // no-op
  }
  console.error(JSON.stringify({
    mode: apply ? "apply" : "preview",
    targetProjectRef: EXPECTED_PRODUCTION_REF,
    error: redact(error?.message ?? error),
    emailPrinted: false,
    uuidPrinted: false,
    metadataPrinted: false,
  }, null, 2));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
