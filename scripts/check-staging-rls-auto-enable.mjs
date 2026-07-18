import fs from "node:fs";
import pg from "pg";

const STAGING_REF = "tltcnxuhrqweyxpxjdtd";
const PRODUCTION_REF = "uvembydjrayvnrooyywl";
const MIGRATION = "supabase/migrations/20260718000100_restrict_rls_auto_enable_execute.sql";

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

function assertStaging(staging, parts) {
  if (staging.STAGING_SUPABASE_PROJECT_REF !== STAGING_REF) {
    throw new Error("Refusing non-staging project ref");
  }
  if (Object.values({ ...staging, ...parts }).some((value) => String(value).includes(PRODUCTION_REF))) {
    throw new Error("Refusing production ref");
  }
  if (parts.STAGING_DB_USER !== `postgres.${STAGING_REF}`) {
    throw new Error("Unexpected staging DB user marker");
  }
}

function directDbConfig(parts) {
  return {
    host: `db.${STAGING_REF}.supabase.co`,
    port: 5432,
    database: "postgres",
    user: "postgres",
    password: requireValue(parts, "STAGING_DB_PASSWORD"),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
    query_timeout: 30000,
  };
}

async function inspect(client) {
  const functionResult = await client.query(`
    select
      p.oid::regprocedure::text as signature,
      pg_get_userbyid(p.proowner) as owner,
      p.prorettype::regtype::text as return_type,
      p.prosecdef as security_definer,
      coalesce(p.proconfig::text, '{}') as config,
      coalesce(p.proacl::text, '<default>') as acl,
      has_function_privilege('public', p.oid, 'execute') as public_can_execute,
      has_function_privilege('anon', p.oid, 'execute') as anon_can_execute,
      has_function_privilege('authenticated', p.oid, 'execute') as authenticated_can_execute
    from pg_proc p
    where p.oid = to_regprocedure('public.rls_auto_enable()')
  `);
  const triggerResult = await client.query(`
    select
      evtname as name,
      evtevent as event,
      evtenabled as enabled,
      evtfoid::regprocedure::text as function_signature
    from pg_event_trigger
    where evtfoid = to_regprocedure('public.rls_auto_enable()')
    order by evtname
  `);
  return {
    function: functionResult.rows[0] || null,
    eventTriggers: triggerResult.rows,
  };
}

async function applyMigration(client) {
  const sql = fs.readFileSync(MIGRATION, "utf8");
  if (!sql.includes("REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC")) {
    throw new Error("Migration does not contain expected PUBLIC revoke");
  }
  await client.query("begin");
  try {
    await client.query(sql);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function triggerRollbackTest(client) {
  const tableName = `rls_auto_enable_check_${Date.now()}`;
  await client.query("begin");
  try {
    await client.query(`create table public.${tableName} (id integer primary key)`);
    const result = await client.query(
      `
        select
          c.relrowsecurity as rls_enabled,
          c.relforcerowsecurity as force_rls
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname = $1
      `,
      [tableName],
    );
    await client.query("rollback");
    return {
      testTable: tableName,
      rolledBack: true,
      rlsEnabled: Boolean(result.rows[0]?.rls_enabled),
      forceRls: Boolean(result.rows[0]?.force_rls),
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  }
}

const mode = process.argv.includes("--apply")
  ? "apply"
  : process.argv.includes("--trigger-test")
    ? "trigger-test"
    : "inspect";

const staging = readEnvFile(".env.staging.local");
const parts = readEnvFile(".env.staging.db.parts.local");
assertStaging(staging, parts);

const client = new pg.Client(directDbConfig(parts));
await client.connect();
try {
  const before = await inspect(client);
  let migrationApplied = false;
  let triggerTest = null;

  if (mode === "apply") {
    await applyMigration(client);
    migrationApplied = true;
  }

  if (mode === "trigger-test") {
    triggerTest = await triggerRollbackTest(client);
  }

  const after = await inspect(client);
  console.log(JSON.stringify({
    targetRef: STAGING_REF,
    mode,
    migrationFile: MIGRATION,
    migrationApplied,
    before,
    after,
    triggerTest,
    appCodeCallsFunction: false,
  }, null, 2));
} finally {
  await client.end();
}
