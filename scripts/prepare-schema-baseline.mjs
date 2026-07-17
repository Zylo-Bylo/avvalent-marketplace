import fs from "node:fs";

const rawPath = "supabase/baseline/production_schema_only.sql";
const outPath = "supabase/migrations/20260714000000_production_schema_baseline.sql";

const requiredTables = [
  '"Category"',
  '"Subcategory"',
  '"ProductType"',
  '"HomepageContent"',
  '"CategoryUploadTemplate"',
  '"CategoryAuditLog"',
  '"ProductVariant"',
  '"VendorWallet"',
  '"VendorBankAccount"',
  '"VendorPayout"',
  '"VendorPayoutSettlement"',
  '"VendorLedger"',
  '"CommissionRule"',
  '"SettlementReport"',
  '"RefundAdjustment"',
  '"Inventory"',
  '"StockMovement"',
  '"StockReservation"',
  '"AdminBusinessProfile"',
  '"ReturnRefundRequest"',
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

function splitDefinitions(body) {
  const definitions = [];
  let start = 0;
  let depth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    const next = body[index + 1];

    if (inSingleQuote) {
      if (char === "'" && next === "'") {
        index += 1;
      } else if (char === "'") {
        inSingleQuote = false;
      }
      continue;
    }

    if (inDoubleQuote) {
      if (char === '"' && next === '"') {
        index += 1;
      } else if (char === '"') {
        inDoubleQuote = false;
      }
      continue;
    }

    if (char === "'") {
      inSingleQuote = true;
    } else if (char === '"') {
      inDoubleQuote = true;
    } else if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth -= 1;
    } else if (char === "," && depth === 0) {
      definitions.push(body.slice(start, index).trim());
      start = index + 1;
    }
  }

  const finalDefinition = body.slice(start).trim();
  if (finalDefinition) {
    definitions.push(finalDefinition);
  }
  return definitions;
}

function qualifyReferences(definition) {
  return definition.replace(
    /\bREFERENCES\s+(?!public\.)(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*))\s*\(/g,
    (_match, quoted, bare) => `REFERENCES public.${quoted ? `"${quoted}"` : bare}(`,
  );
}

function rewriteForeignKeys(sql) {
  const foreignKeys = [];
  const createTablePattern =
    /CREATE TABLE IF NOT EXISTS public\."([^"]+)" \(\n([\s\S]*?)\n\);/g;

  return sql.replace(createTablePattern, (_match, tableName, body) => {
    const keptDefinitions = [];
    for (const definition of splitDefinitions(body)) {
      if (/\bFOREIGN KEY\b/i.test(definition)) {
        foreignKeys.push(`ALTER TABLE public."${tableName}" ADD ${qualifyReferences(definition)};`);
      } else {
        keptDefinitions.push(definition);
      }
    }
    return `CREATE TABLE IF NOT EXISTS public."${tableName}" (\n${keptDefinitions.join(",\n")}\n);`;
  }).replace(
    /((?:CREATE (?:UNIQUE )?INDEX[\s\S]*?;\n?)+)$/m,
    `${foreignKeys.join("\n")}\n\n$1`,
  );
}

const raw = fs.readFileSync(rawPath, "utf8").trimStart();
const sanitizedSchema = rewriteForeignKeys(raw)
  .replace(/^CREATE UNIQUE INDEX\s+/gim, "CREATE UNIQUE INDEX IF NOT EXISTS ")
  .trimEnd();
const requiredSql = requiredTables.map((table) => `    '${table}'`).join(",\n");

const output = `-- Zylo-Buylo sanitized production schema-only baseline for staging.
-- Source project: uvembydjrayvnrooyywl (schema metadata only; no table rows).
-- Safe write target for application: tltcnxuhrqweyxpxjdtd.
-- Do not use this file to copy production data, auth users, storage objects, OTPs,
-- customer records, order rows, bank details, wallet rows, payouts, returns or evidence.

begin;

set local search_path = public, extensions;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

${sanitizedSchema}

do $$
declare
  missing_tables text[];
begin
  select array_agg(table_name order by table_name)
  into missing_tables
  from unnest(array[
${requiredSql}
  ]) as required(table_name)
  where to_regclass('public.' || table_name) is null;

  if missing_tables is not null then
    raise exception 'Sanitized production schema baseline failed. Required public tables are missing: %', missing_tables;
  end if;
end $$;

commit;
`;

fs.writeFileSync(outPath, output, { encoding: "utf8" });
console.log(`BASELINE_PREPARED=${outPath}`);
