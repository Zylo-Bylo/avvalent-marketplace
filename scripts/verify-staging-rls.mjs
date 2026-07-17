import fs from "node:fs";
import pg from "pg";

const ENV_PATH = ".env.staging.local";
const EXPECTED_STAGING_REF = "tltcnxuhrqweyxpxjdtd";
const FORBIDDEN_PRODUCTION_REF = "uvembydjrayvnrooyywl";

const requiredRlsTables = [
  "Category",
  "Subcategory",
  "ProductType",
  "HomepageContent",
  "CategoryUploadTemplate",
  "CategoryAuditLog",
  "ProductVariant",
  "VendorWallet",
  "VendorBankAccount",
  "VendorPayout",
  "VendorPayoutSettlement",
  "VendorLedger",
  "CommissionRule",
  "SettlementReport",
  "RefundAdjustment",
  "Inventory",
  "StockMovement",
  "StockReservation",
  "AdminBusinessProfile",
  "ReturnRefundRequest",
  "size_charts",
  "size_chart_items",
  "order_verification",
  "dispatch_images",
  "delivery_otp",
  "open_box_verification",
  "return_requests",
  "return_evidence",
  "risk_assessment",
  "vendor_protection_logs",
  "vendor_mobile_otp",
];

const financialTables = [
  "VendorBankAccount",
  "VendorPayout",
  "VendorPayoutSettlement",
  "VendorWallet",
  "VendorLedger",
  "CommissionRule",
  "SettlementReport",
  "RefundAdjustment",
];

function readEnv() {
  const result = {};
  for (const line of fs.readFileSync(ENV_PATH, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=]+)=(.*)$/);
    if (match) {
      result[match[1].trim()] = match[2].trim();
    }
  }
  return result;
}

function redactErrorMessage(message, connectionString) {
  let redacted = String(message || "unknown error").replace(/postgres(?:ql)?:\/\/\S+/gi, "<REDACTED_DATABASE_URL>");
  if (connectionString) {
    redacted = redacted.replaceAll(connectionString, "<REDACTED_DATABASE_URL>");
    try {
      const url = new URL(connectionString);
      if (url.password) redacted = redacted.replaceAll(url.password, "<REDACTED_PASSWORD>");
      if (url.username) redacted = redacted.replaceAll(url.username, "<REDACTED_USER>");
    } catch {}
  }
  return redacted;
}

async function main() {
  const env = readEnv();
  const ref = env.STAGING_SUPABASE_PROJECT_REF;
  const connectionString = env.STAGING_DATABASE_URL;

  if (ref !== EXPECTED_STAGING_REF) {
    throw new Error(`Unexpected staging ref: ${ref || "<missing>"}`);
  }
  if (ref === FORBIDDEN_PRODUCTION_REF || connectionString?.includes(FORBIDDEN_PRODUCTION_REF)) {
    throw new Error("Refusing to connect to forbidden production project.");
  }
  if (!connectionString || !connectionString.includes(EXPECTED_STAGING_REF)) {
    throw new Error("STAGING_DATABASE_URL is missing or does not reference the expected staging ref.");
  }

  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query("begin read only");
    await client.query("set local statement_timeout = '30s'");

    const migrations = await client.query(`
      select version
      from supabase_migrations.schema_migrations
      where version in ('20260714000000', '20260715000100')
      order by version
    `);

    const tableSecurity = await client.query(`
      select tablename, rowsecurity, forcerowsecurity
      from pg_tables
      where schemaname = 'public'
        and tablename = any($1::text[])
      order by tablename
    `, [requiredRlsTables]);

    const policies = await client.query(`
      select schemaname, tablename, policyname, roles, cmd, qual, with_check
      from pg_policies
      where schemaname = 'public'
      order by tablename, policyname
    `);

    const functions = await client.query(`
      select n.nspname as schema_name,
             p.proname as function_name,
             pg_get_function_arguments(p.oid) as arguments,
             pg_get_function_result(p.oid) as return_type,
             p.prosecdef as security_definer,
             p.proconfig as function_config,
             pg_get_userbyid(p.proowner) as owner
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where p.proname like 'zylo_%'
      order by n.nspname, p.proname
    `);

    const routinePrivileges = await client.query(`
      select routine_schema, routine_name, grantee, privilege_type
      from information_schema.routine_privileges
      where routine_name like 'zylo_%'
      order by routine_schema, routine_name, grantee
    `);

    const view = await client.query(`
      select v.schemaname, v.viewname, v.definition, c.reloptions
      from pg_views v
      join pg_class c on c.relname = v.viewname
      join pg_namespace n on n.oid = c.relnamespace and n.nspname = v.schemaname
      where v.schemaname = 'public'
        and v.viewname = 'public_product_variants'
    `);

    const grants = await client.query(`
      select table_schema, table_name, grantee, privilege_type
      from information_schema.role_table_grants
      where table_schema = 'public'
        and table_name in ('delivery_otp', 'vendor_mobile_otp')
        and grantee in ('anon', 'authenticated')
      order by table_name, grantee, privilege_type
    `);

    await client.query("commit");

    const rlsMissing = requiredRlsTables.filter(
      (table) => !tableSecurity.rows.some((row) => row.tablename === table),
    );
    const rlsDisabled = tableSecurity.rows
      .filter((row) => !row.rowsecurity)
      .map((row) => row.tablename);

    const otpPolicies = policies.rows.filter((row) =>
      ["delivery_otp", "vendor_mobile_otp"].includes(row.tablename),
    );
    const financialWrites = policies.rows.filter((row) =>
      financialTables.includes(row.tablename) && ["INSERT", "UPDATE", "DELETE"].includes(row.cmd),
    );
    const financialUnsafeWrites = financialWrites.filter((row) => {
      const text = `${row.qual || ""} ${row.with_check || ""}`;
      return !text.includes("private.zylo_is_admin()");
    });
    const unsafeWritePolicies = policies.rows.filter((row) => {
      const text = `${row.qual || ""} ${row.with_check || ""}`;
      return ["INSERT", "UPDATE", "DELETE", "ALL"].includes(row.cmd) && /\btrue\b/i.test(text);
    });

    const functionIssues = functions.rows.filter((row) => {
      const config = row.function_config || [];
      return row.schema_name !== "private" ||
        !row.security_definer ||
        !config.some((item) => item === "search_path=");
    });

    const viewRow = view.rows[0];
    const viewDefinition = viewRow?.definition || "";
    const viewReloptions = viewRow?.reloptions || [];
    const viewUnsafeColumns = ["vendorPrice", "stockQuantity", "barcode", "weight", "otpHash"].filter((column) =>
      viewDefinition.includes(column),
    );

    const summary = {
      targetRef: ref,
      migrationsApplied: migrations.rows.map((row) => row.version),
      rls: {
        requiredTableCount: requiredRlsTables.length,
        checkedTableCount: tableSecurity.rows.length,
        missingTables: rlsMissing,
        disabledTables: rlsDisabled,
      },
      otpProtection: {
        directAnonAuthenticatedGrants: grants.rows,
        directPolicies: otpPolicies.map((row) => ({
          table: row.tablename,
          policy: row.policyname,
          cmd: row.cmd,
          roles: row.roles,
        })),
      },
      financialProtection: {
        adminWritePolicyCount: financialWrites.length,
        unsafeWritePolicies: financialUnsafeWrites.map((row) => ({
          table: row.tablename,
          policy: row.policyname,
          cmd: row.cmd,
          qual: row.qual,
          with_check: row.with_check,
        })),
      },
      viewFunctionSecurity: {
        publicProductVariantsPresent: Boolean(viewRow),
        publicProductVariantsSecurityInvoker: viewReloptions.includes("security_invoker=true"),
        publicProductVariantsUnsafeColumns: viewUnsafeColumns,
        zyloFunctions: functions.rows.map((row) => ({
          schema: row.schema_name,
          name: row.function_name,
          securityDefiner: row.security_definer,
          config: row.function_config,
        })),
        zyloFunctionIssues: functionIssues,
        routinePrivilegeCount: routinePrivileges.rows.length,
      },
      policySafety: {
        unsafeTrueWritePolicies: unsafeWritePolicies.map((row) => ({
          table: row.tablename,
          policy: row.policyname,
          cmd: row.cmd,
        })),
      },
    };

    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {}
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  let connectionString = "";
  try {
    connectionString = readEnv().STAGING_DATABASE_URL || "";
  } catch {}
  const detail = [
    error?.code && `code=${error.code}`,
    `message=${redactErrorMessage(error?.message || String(error), connectionString)}`,
  ].filter(Boolean).join(" ");
  console.error(`STAGING_RLS_VERIFY_FAILED=${detail}`);
  process.exitCode = 1;
});
