import fs from "node:fs";
import { spawn, spawnSync } from "node:child_process";

const STAGING_REF = "tltcnxuhrqweyxpxjdtd";
const PRODUCTION_REF = "uvembydjrayvnrooyywl";
const PORT = process.env.STAGING_APP_PORT || "3100";

function readEnvFile(path) {
  const values = {};
  if (!fs.existsSync(path)) return values;
  for (const line of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=]+)=(.*)$/);
    if (match) values[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
  return values;
}

const staging = readEnvFile(".env.staging.local");
if (staging.STAGING_SUPABASE_PROJECT_REF !== STAGING_REF) {
  throw new Error("Refusing to start app without staging project ref");
}
for (const value of [staging.STAGING_SUPABASE_URL, staging.STAGING_DATABASE_URL]) {
  if (!value?.includes(STAGING_REF) || value.includes(PRODUCTION_REF)) {
    throw new Error("Refusing to start app with non-staging target");
  }
}

function getRuntimeDatabaseUrl() {
  const parts = readEnvFile(".env.staging.db.parts.local");
  if (parts.STAGING_DB_PASSWORD) {
    const expectedParts = {
      host: "aws-1-ap-south-1.pooler.supabase.com",
      port: "5432",
      database: "postgres",
      user: `postgres.${STAGING_REF}`,
    };
    const partsAreStaging =
      parts.STAGING_DB_HOST === expectedParts.host &&
      parts.STAGING_DB_PORT === expectedParts.port &&
      parts.STAGING_DB_NAME === expectedParts.database &&
      parts.STAGING_DB_USER === expectedParts.user &&
      !Object.values(parts).some((value) => String(value).includes(PRODUCTION_REF));
    if (partsAreStaging) {
      return {
        source: "staging-db-parts-direct",
        value: `postgresql://postgres:${encodeURIComponent(parts.STAGING_DB_PASSWORD)}@db.${STAGING_REF}.supabase.co:5432/postgres`,
      };
    }
  }
  const poolerPath = "supabase/.temp/pooler-url";
  if (!fs.existsSync(poolerPath)) {
    return { source: "staging-env", value: staging.STAGING_DATABASE_URL };
  }
  let poolerUrl = fs.readFileSync(poolerPath, "utf8").trim();
  if (!poolerUrl.includes(STAGING_REF) || poolerUrl.includes(PRODUCTION_REF)) {
    return { source: "staging-env", value: staging.STAGING_DATABASE_URL };
  }
  const directUrl = new URL(staging.STAGING_DATABASE_URL);
  const parsedPoolerUrl = new URL(poolerUrl);
  if (poolerUrl.includes("[YOUR-PASSWORD]")) {
    poolerUrl = poolerUrl.replace("[YOUR-PASSWORD]", encodeURIComponent(directUrl.password));
  } else if (!parsedPoolerUrl.password && directUrl.password) {
    parsedPoolerUrl.password = directUrl.password;
    poolerUrl = parsedPoolerUrl.toString();
  }
  const finalPoolerUrl = new URL(poolerUrl);
  if (!finalPoolerUrl.searchParams.has("sslmode")) {
    finalPoolerUrl.searchParams.set("sslmode", "require");
  }
  return { source: "linked-pooler-template", value: finalPoolerUrl.toString() };
}

const runtimeDatabaseUrl = getRuntimeDatabaseUrl();
if (!runtimeDatabaseUrl.value.includes(STAGING_REF) || runtimeDatabaseUrl.value.includes(PRODUCTION_REF)) {
  throw new Error("Refusing to start app with non-staging runtime database URL");
}

const env = {
  ...process.env,
  DATABASE_URL: runtimeDatabaseUrl.value,
  NEXT_PUBLIC_SUPABASE_URL: staging.STAGING_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: staging.STAGING_SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL: staging.STAGING_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: staging.STAGING_SUPABASE_SECRET_KEY,
  PORT,
};

if (process.argv.includes("--dry-run")) {
  console.log(JSON.stringify({
    targetRef: STAGING_REF,
    port: PORT,
    prismaVariable: "DATABASE_URL",
    databaseUrlSource: runtimeDatabaseUrl.source,
    databaseUrlHasStagingRef: runtimeDatabaseUrl.value.includes(STAGING_REF),
    databaseUrlHasProductionRef: runtimeDatabaseUrl.value.includes(PRODUCTION_REF),
    databaseUrlHasPassword: /postgres(?:ql)?:\/\/[^:]+:[^@]+@/i.test(runtimeDatabaseUrl.value),
  }, null, 2));
  process.exit(0);
}

const command = process.platform === "win32" ? "cmd.exe" : "npm";
const args = process.platform === "win32"
  ? ["/d", "/s", "/c", `npm run dev -- --hostname 127.0.0.1 --port ${PORT}`]
  : ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", PORT];

const generate = spawnSync(process.execPath, ["scripts/prisma-schema.mjs", "generate"], {
  cwd: process.cwd(),
  env,
  encoding: "utf8",
});
if (generate.status !== 0) {
  console.error("STAGING_PRISMA_GENERATE_FAILED");
  process.exit(generate.status ?? 1);
}

if (process.argv.includes("--foreground")) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env,
    stdio: "inherit",
    windowsHide: true,
  });
  child.on("exit", (code, signal) => {
    process.exitCode = code ?? (signal ? 1 : 0);
  });
} else {
  const out = fs.openSync("staging-server.out.log", "a");
  const err = fs.openSync("staging-server.err.log", "a");
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env,
    detached: true,
    stdio: ["ignore", out, err],
    windowsHide: true,
  });
  child.unref();
  fs.writeFileSync("staging-server.pid", String(child.pid));
  console.log(JSON.stringify({ targetRef: STAGING_REF, port: PORT, pid: child.pid }, null, 2));
}
