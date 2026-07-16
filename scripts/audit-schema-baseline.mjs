import fs from "node:fs";

const baselinePath = "supabase/baseline/production_schema_only.sql";
const rlsPath = "supabase/migrations/20260715000100_policy_first_rls.sql";

const baseline = fs.readFileSync(baselinePath, "utf8");
const rls = fs.readFileSync(rlsPath, "utf8");

const matches = (source, pattern) => Array.from(source.matchAll(pattern));
const count = (source, pattern) => matches(source, pattern).length;
const stripQuotes = (value) => value.replace(/^"/, "").replace(/"$/, "");

const requiredBlock = rls.match(/from\s+unnest\(array\[(?<body>.*?)\]\)\s+as\s+required\(table_name\)/s);
const requiredTables = requiredBlock
  ? matches(requiredBlock.groups.body, /'([^']+)'/g).map((match) => match[1])
  : [];

const tableNames = new Set(
  matches(baseline, /CREATE TABLE(?: IF NOT EXISTS)?\s+public\."([^"]+)"/gi).map((match) => match[1]),
);

const rawAudit = {
  schemas: matches(baseline, /CREATE SCHEMA(?: IF NOT EXISTS)?\s+([^;]+)/gi).map((match) => match[1].trim()),
  publicTables: count(baseline, /CREATE TABLE(?: IF NOT EXISTS)?\s+public\./gi),
  enums: count(baseline, /CREATE TYPE\s+"[^"]+"\s+AS ENUM/gi),
  functions: count(baseline, /CREATE(?: OR REPLACE)? FUNCTION/gi),
  triggers: count(baseline, /CREATE TRIGGER/gi),
  views: count(baseline, /CREATE(?: OR REPLACE)? VIEW/gi),
  sequences: count(baseline, /CREATE SEQUENCE/gi),
  indexes: count(baseline, /CREATE INDEX(?: IF NOT EXISTS)?/gi),
  constraints: count(baseline, /\bCONSTRAINT\s+"/gi),
  extensions: matches(baseline, /CREATE EXTENSION(?: IF NOT EXISTS)?\s+([^;]+)/gi).map((match) => match[1].trim()),
  rlsStatements: count(baseline, /ENABLE ROW LEVEL SECURITY|CREATE POLICY|ALTER POLICY/gi),
  grantsAndDefaultPrivileges: count(baseline, /\bGRANT\b|\bREVOKE\b|DEFAULT PRIVILEGES/gi),
  ownerAndRoleStatements: count(baseline, /OWNER TO|CREATE ROLE|ALTER ROLE|SET ROLE|RESET ROLE/gi),
  managedSchemaReferences: count(baseline, /\bauth\.|\bstorage\.|\brealtime\.|\bvault\./gi),
  unsupportedProductionSpecificObjects: count(
    baseline,
    /SUBSCRIPTION|PUBLICATION|SERVER\s+|FOREIGN DATA WRAPPER|EVENT TRIGGER/gi,
  ),
};

const secretDataScan = {
  insertStatements: count(baseline, /^\s*INSERT\b/gim),
  copyStatements: count(baseline, /^\s*COPY\b/gim),
  passwordMentions: count(baseline, /password|passwd|pwd/gi),
  tokenMentions: count(baseline, /token|api[_-]?key|secret[_-]?key|connection string|postgres:\/\/|postgresql:\/\//gi),
  otpLiteralMentions: count(baseline, /otp\s*['=]|['"][0-9]{4,8}['"]/gi),
};

const requiredTableResults = requiredTables.map((rawName) => ({
  table: rawName,
  present: tableNames.has(stripQuotes(rawName)),
}));

const requiredMissing = requiredTableResults.filter((row) => !row.present);

console.log(JSON.stringify({ rawAudit, secretDataScan, requiredTableResults, requiredMissing }, null, 2));
