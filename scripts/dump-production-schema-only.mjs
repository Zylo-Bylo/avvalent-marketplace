import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import pg from "pg";

const ROOT = process.cwd();
const ENV_PATH = path.join(ROOT, ".env.production.schema.local");
const OUT_PATH = path.join(ROOT, "supabase", "baseline", "production_schema_only.sql");
const EXPECTED_PRODUCTION_REF = "uvembydjrayvnrooyywl";

function readProductionUrl() {
  const text = fs.readFileSync(ENV_PATH, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*PRODUCTION_DATABASE_URL=(.*)$/);
    if (match) {
      return match[1].trim();
    }
  }
  return "";
}

function redactErrorMessage(message, connectionString) {
  let redacted = String(message || "unknown error");
  if (connectionString) {
    redacted = redacted.replaceAll(connectionString, "<REDACTED_DATABASE_URL>");
    try {
      const url = new URL(connectionString);
      if (url.password) {
        redacted = redacted.replaceAll(url.password, "<REDACTED_PASSWORD>");
      }
      if (url.username) {
        redacted = redacted.replaceAll(url.username, "<REDACTED_USER>");
      }
      redacted = redacted.replaceAll(url.href, "<REDACTED_DATABASE_URL>");
    } catch {
      redacted = redacted.replace(/postgres(?:ql)?:\/\/\S+/gi, "<REDACTED_DATABASE_URL>");
    }
  }
  return redacted.replace(/postgres(?:ql)?:\/\/\S+/gi, "<REDACTED_DATABASE_URL>");
}

function quoteIdent(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function quoteLiteral(value) {
  if (value === null || value === undefined) {
    return "NULL";
  }
  return `'${String(value).replaceAll("'", "''")}'`;
}

function formatType(column) {
  if (column.udt_schema === "public" && column.data_type === "USER-DEFINED") {
    return quoteIdent(column.udt_name);
  }
  if (column.data_type === "ARRAY" && column.udt_name?.startsWith("_")) {
    return `${quoteIdent(column.udt_name.slice(1))}[]`;
  }
  if (column.data_type === "timestamp without time zone") {
    const precision = column.datetime_precision === null ? "" : `(${column.datetime_precision})`;
    return `TIMESTAMP${precision}`;
  }
  if (column.data_type === "timestamp with time zone") {
    const precision = column.datetime_precision === null ? "" : `(${column.datetime_precision})`;
    return `TIMESTAMP${precision} WITH TIME ZONE`;
  }
  if (column.data_type === "character varying" && column.character_maximum_length) {
    return `VARCHAR(${column.character_maximum_length})`;
  }
  if (column.data_type === "character" && column.character_maximum_length) {
    return `CHAR(${column.character_maximum_length})`;
  }
  if (column.data_type === "numeric" && column.numeric_precision && column.numeric_scale !== null) {
    return `NUMERIC(${column.numeric_precision},${column.numeric_scale})`;
  }
  if (column.data_type === "USER-DEFINED") {
    return quoteIdent(column.udt_name);
  }
  return column.data_type.toUpperCase();
}

function columnDefinition(column) {
  const parts = [quoteIdent(column.column_name), formatType(column)];
  if (column.column_default) {
    parts.push("DEFAULT", column.column_default);
  }
  if (column.is_nullable === "NO") {
    parts.push("NOT NULL");
  }
  return `  ${parts.join(" ")}`;
}

async function main() {
  const connectionString = readProductionUrl();
  if (!connectionString) {
    throw new Error("PRODUCTION_DATABASE_URL is missing.");
  }
  if (!connectionString.includes(EXPECTED_PRODUCTION_REF)) {
    throw new Error("PRODUCTION_DATABASE_URL does not reference the expected production project ref.");
  }

  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    await client.query("begin read only");
    await client.query("set local statement_timeout = '30s'");

    const enums = await client.query(`
      select n.nspname as schema_name, t.typname as type_name, e.enumlabel
      from pg_type t
      join pg_enum e on e.enumtypid = t.oid
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public'
      order by t.typname, e.enumsortorder
    `);

    const tables = await client.query(`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_type = 'BASE TABLE'
      order by table_name
    `);

    const columns = await client.query(`
      select table_name, column_name, ordinal_position, column_default, is_nullable,
             data_type, udt_schema, udt_name, character_maximum_length,
             numeric_precision, numeric_scale, datetime_precision
      from information_schema.columns
      where table_schema = 'public'
      order by table_name, ordinal_position
    `);

    const constraints = await client.query(`
      select conname, contype, conrelid::regclass::text as table_name, pg_get_constraintdef(oid) as definition
      from pg_constraint
      where connamespace = 'public'::regnamespace
      order by conrelid::regclass::text, contype, conname
    `);

    const indexes = await client.query(`
      select tablename, indexname, indexdef
      from pg_indexes
      where schemaname = 'public'
      order by tablename, indexname
    `);

    await client.query("commit");

    const columnsByTable = new Map();
    for (const column of columns.rows) {
      if (!columnsByTable.has(column.table_name)) {
        columnsByTable.set(column.table_name, []);
      }
      columnsByTable.get(column.table_name).push(column);
    }

    const constraintsByTable = new Map();
    for (const constraint of constraints.rows) {
      const tableName = constraint.table_name.replace(/^public\./, "").replace(/^"|"$/g, "");
      if (!constraintsByTable.has(tableName)) {
        constraintsByTable.set(tableName, []);
      }
      constraintsByTable.get(tableName).push(constraint);
    }

    const lines = [
      "-- Zylo-Buylo production public schema-only baseline.",
      "-- Generated from pg_catalog/information_schema metadata only.",
      "-- Contains no table data, auth users, OTPs, customer/order/bank/wallet/payout/return/evidence rows.",
      "",
      "CREATE SCHEMA IF NOT EXISTS public;",
      "",
    ];

    const enumGroups = new Map();
    for (const row of enums.rows) {
      if (!enumGroups.has(row.type_name)) {
        enumGroups.set(row.type_name, []);
      }
      enumGroups.get(row.type_name).push(row.enumlabel);
    }
    for (const [typeName, labels] of enumGroups) {
      lines.push(`DO $$ BEGIN`);
      lines.push(`  CREATE TYPE ${quoteIdent(typeName)} AS ENUM (${labels.map(quoteLiteral).join(", ")});`);
      lines.push(`EXCEPTION WHEN duplicate_object THEN NULL;`);
      lines.push(`END $$;`);
      lines.push("");
    }

    for (const table of tables.rows) {
      const tableName = table.table_name;
      const tableColumns = columnsByTable.get(tableName) ?? [];
      const tableConstraints = constraintsByTable.get(tableName) ?? [];
      const definitions = [
        ...tableColumns.map(columnDefinition),
        ...tableConstraints.map((constraint) => `  CONSTRAINT ${quoteIdent(constraint.conname)} ${constraint.definition}`),
      ];
      lines.push(`CREATE TABLE IF NOT EXISTS public.${quoteIdent(tableName)} (`);
      lines.push(definitions.join(",\n"));
      lines.push(");");
      lines.push("");
    }

    for (const index of indexes.rows) {
      if (index.indexname.endsWith("_pkey")) {
        continue;
      }
      lines.push(`${index.indexdef.replace(/^CREATE INDEX /i, "CREATE INDEX IF NOT EXISTS ")};`);
    }
    lines.push("");

    fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
    fs.writeFileSync(OUT_PATH, `${lines.join("\n")}\n`);

    console.log(`SCHEMA_ONLY_BASELINE_WRITTEN=${path.relative(ROOT, OUT_PATH)}`);
    console.log(`PUBLIC_TABLE_COUNT=${tables.rows.length}`);
    console.log(`PUBLIC_ENUM_COUNT=${enumGroups.size}`);
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
    connectionString = readProductionUrl();
  } catch {}
  console.error(`SCHEMA_ONLY_DUMP_FAILED=${redactErrorMessage(error.message, connectionString)}`);
  process.exitCode = 1;
});
