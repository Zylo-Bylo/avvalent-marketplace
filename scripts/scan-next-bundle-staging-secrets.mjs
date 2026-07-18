import fs from "node:fs";
import path from "node:path";

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

const env = readEnvFile(".env.staging.local");
const secret = env.STAGING_SUPABASE_SECRET_KEY || "__missing__";
let productionRefHits = 0;
let serviceRoleWordHits = 0;
let secretValueHits = 0;
const root = ".next";
const stack = fs.existsSync(root) ? [root] : [];
while (stack.length) {
  const current = stack.pop();
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const full = path.join(current, entry.name);
    if (entry.isDirectory()) {
      stack.push(full);
    } else if (/\.(js|json|html|txt|map)$/.test(entry.name)) {
      const text = fs.readFileSync(full, "utf8");
      if (text.includes(PRODUCTION_REF)) productionRefHits += 1;
      if (text.includes("service_role")) serviceRoleWordHits += 1;
      if (secret !== "__missing__" && text.includes(secret)) secretValueHits += 1;
    }
  }
}

console.log(JSON.stringify({
  targetRef: STAGING_REF,
  nextBundleScanned: fs.existsSync(root),
  productionRefHits,
  serviceRoleWordHits,
  secretValueHits,
}, null, 2));
