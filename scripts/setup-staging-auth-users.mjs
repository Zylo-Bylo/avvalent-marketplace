import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const STAGING_REF = "tltcnxuhrqweyxpxjdtd";
const PRODUCTION_REF = "uvembydjrayvnrooyywl";

function readEnvFile(path) {
  const values = {};
  for (const line of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=]+)=(.*)$/);
    if (match) {
      values[match[1].trim()] = match[2].trim();
    }
  }
  return values;
}

function requireValue(values, key) {
  const value = values[key];
  if (!value) {
    throw new Error(`${key} is missing`);
  }
  return value;
}

function assertStaging(url, ref) {
  if (ref !== STAGING_REF || url.includes(PRODUCTION_REF) || !url.includes(STAGING_REF)) {
    throw new Error("Refusing to use non-staging Supabase target");
  }
}

async function findUserByEmail(admin, email) {
  let page = 1;
  const perPage = 100;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const found = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < perPage) return null;
    page += 1;
  }
}

async function upsertAuthUser(admin, account) {
  const existing = await findUserByEmail(admin, account.email);
  if (!existing) {
    const { data, error } = await admin.auth.admin.createUser({
      email: account.email,
      password: account.password,
      email_confirm: true,
      app_metadata: account.appMetadata,
    });
    if (error) throw error;
    return { status: "created", user: data.user };
  }

  const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
    password: account.password,
    email_confirm: true,
    app_metadata: account.appMetadata,
  });
  if (error) throw error;
  return { status: "updated", user: data.user };
}

async function main() {
  const staging = readEnvFile(".env.staging.local");
  const test = readEnvFile(".env.staging.test.local");
  const ref = requireValue(staging, "STAGING_SUPABASE_PROJECT_REF");
  const url = requireValue(staging, "STAGING_SUPABASE_URL");
  const serviceKey = requireValue(staging, "STAGING_SUPABASE_SECRET_KEY");
  const anonKey = requireValue(staging, "STAGING_SUPABASE_PUBLISHABLE_KEY");
  assertStaging(url, ref);

  const labels = [
    ["admin", "STAGING_ADMIN_EMAIL", "STAGING_ADMIN_PASSWORD", "ADMIN"],
    ["customerA", "STAGING_CUSTOMER_A_EMAIL", "STAGING_CUSTOMER_A_PASSWORD", "CUSTOMER"],
    ["customerB", "STAGING_CUSTOMER_B_EMAIL", "STAGING_CUSTOMER_B_PASSWORD", "CUSTOMER"],
    ["vendorA", "STAGING_VENDOR_A_EMAIL", "STAGING_VENDOR_A_PASSWORD", "VENDOR"],
    ["vendorB", "STAGING_VENDOR_B_EMAIL", "STAGING_VENDOR_B_PASSWORD", "VENDOR"],
  ];

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const results = {};
  for (const [label, emailKey, passwordKey, role] of labels) {
    const email = requireValue(test, emailKey);
    const password = requireValue(test, passwordKey);
    const current = await findUserByEmail(admin, email);
    const existingMetadata = current?.app_metadata && typeof current.app_metadata === "object"
      ? current.app_metadata
      : {};
    const appMetadata = role === "ADMIN"
      ? { ...existingMetadata, role: "ADMIN" }
      : Object.fromEntries(
          Object.entries({ ...existingMetadata, role }).filter(
            ([key, value]) => !(key === "role" && value === "ADMIN"),
          ),
        );
    const result = await upsertAuthUser(admin, { email, password, appMetadata });
    results[label] = {
      authUserId: result.user.id,
      status: result.status,
      appMetadataRole: result.user.app_metadata?.role ?? null,
    };
  }

  const anon = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const customerEmail = requireValue(test, "STAGING_CUSTOMER_A_EMAIL");
  const customerPassword = requireValue(test, "STAGING_CUSTOMER_A_PASSWORD");
  const { data: signInData, error: signInError } = await anon.auth.signInWithPassword({
    email: customerEmail,
    password: customerPassword,
  });
  if (signInError) throw signInError;

  const { error: updateError } = await anon.auth.updateUser({
    data: { role: "ADMIN" },
  });

  const { data: refreshedCustomer, error: refreshedError } =
    await admin.auth.admin.getUserById(results.customerA.authUserId);
  if (refreshedError) throw refreshedError;

  await anon.auth.signOut();

  console.log(JSON.stringify({
    targetRef: ref,
    users: results,
    normalUserAppMetadataTamper: {
      attempted: true,
      clientUpdateReturnedError: Boolean(updateError),
      appMetadataRoleAfterAttempt: refreshedCustomer.user.app_metadata?.role ?? null,
      userMetadataRoleMayBeCallerControlled: signInData.user?.user_metadata?.role === "ADMIN",
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(`STAGING_AUTH_SETUP_FAILED=${error?.message || "unknown error"}`);
  process.exitCode = 1;
});
