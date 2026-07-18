import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";

const BASE_URL = process.env.STAGING_APP_URL || "http://127.0.0.1:3100";
const STAGING_REF = "tltcnxuhrqweyxpxjdtd";
const PRODUCTION_REF = "uvembydjrayvnrooyywl";

const ids = {
  orderA: "stg_flow_order_customer_a_vendor_a",
  orderB: "stg_flow_order_customer_b_vendor_b",
  expiredOtpOrder: "stg_flow_order_expired_otp",
  attemptLimitOrder: "stg_flow_order_attempt_limit",
  returnA: "stg_flow_return_a",
  payoutA: "stg_flow_payout_a",
  settlementA: "stg_flow_settlement_a",
  bankA: "stg_flow_bank_a",
};

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
  const allValues = Object.values({ ...staging, ...parts });
  if (allValues.some((value) => String(value).includes(PRODUCTION_REF))) {
    throw new Error("Refusing production ref");
  }
  if (!String(staging.STAGING_SUPABASE_URL || "").includes(STAGING_REF)) {
    throw new Error("Refusing non-staging Supabase URL");
  }
  if (parts.STAGING_DB_USER && parts.STAGING_DB_USER !== `postgres.${STAGING_REF}`) {
    throw new Error("Unexpected staging DB user marker");
  }
}

function makeCookieJar() {
  const cookies = new Map();
  return {
    header() {
      return Array.from(cookies.entries()).map(([key, value]) => `${key}=${value}`).join("; ");
    },
    store(response) {
      const setCookie = response.headers.getSetCookie?.() || [];
      for (const raw of setCookie) {
        const [pair] = raw.split(";");
        const index = pair.indexOf("=");
        if (index > 0) cookies.set(pair.slice(0, index), pair.slice(index + 1));
      }
    },
  };
}

async function request(path, options = {}, jar) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (jar?.header()) headers.set("cookie", jar.header());
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
    redirect: options.redirect || "manual",
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(120000),
  });
  jar?.store(response);
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { textLength: text.length };
  }
  return { status: response.status, ok: response.ok, body };
}

async function login(test, label, emailKey, passwordKey, expectedRole) {
  const jar = makeCookieJar();
  const response = await request(
    "/api/auth/login",
    {
      method: "POST",
      body: {
        email: requireValue(test, emailKey),
        password: requireValue(test, passwordKey),
        expectedRole,
      },
    },
    jar,
  );
  return {
    label,
    jar,
    status: response.status,
    role: response.body?.user?.role || null,
    vendorId: response.body?.user?.vendorProfile?.id || null,
  };
}

function containsUnsafeOtp(value) {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(containsUnsafeOtp);
  for (const [key, child] of Object.entries(value)) {
    if (["otp", "otpHash"].includes(key)) return true;
    if (typeof child === "string" && child === "NOT_A_REAL_OTP") return true;
    if (containsUnsafeOtp(child)) return true;
  }
  return false;
}

function vendorIdsFromOrders(body) {
  const orders = Array.isArray(body?.orders) ? body.orders : [];
  return Array.from(new Set(orders.map((order) => order.vendorId).filter(Boolean)));
}

async function directDbSummary(parts) {
  const client = new pg.Client({
    host: `db.${STAGING_REF}.supabase.co`,
    port: 5432,
    database: "postgres",
    user: "postgres",
    password: requireValue(parts, "STAGING_DB_PASSWORD"),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
    query_timeout: 30000,
  });
  await client.connect();
  try {
    const result = await client.query(
      `select
        (select count(*)::int from public.delivery_otp where id like 'stg_flow_%') as fixture_otp_rows,
        (select count(*)::int from public.delivery_otp where id like 'stg_flow_%' and "resendAvailableAt" > current_timestamp) as resend_cooldown_rows,
        (select count(*)::int from public."Order" where id like 'stg_flow_%') as fixture_order_rows,
        (select count(*)::int from public.return_evidence where id like 'stg_flow_%' and url like 'https://example.invalid/%') as fake_evidence_rows`,
    );
    return result.rows[0];
  } finally {
    await client.end();
  }
}

const staging = readEnvFile(".env.staging.local");
const parts = readEnvFile(".env.staging.db.parts.local");
const test = readEnvFile(".env.staging.test.local");
assertStaging(staging, parts);

const admin = await login(test, "admin", "STAGING_ADMIN_EMAIL", "STAGING_ADMIN_PASSWORD", "ADMIN");
const customerA = await login(test, "customerA", "STAGING_CUSTOMER_A_EMAIL", "STAGING_CUSTOMER_A_PASSWORD", "CUSTOMER");
const customerB = await login(test, "customerB", "STAGING_CUSTOMER_B_EMAIL", "STAGING_CUSTOMER_B_PASSWORD", "CUSTOMER");
const vendorA = await login(test, "vendorA", "STAGING_VENDOR_A_EMAIL", "STAGING_VENDOR_A_PASSWORD", "VENDOR");
const vendorB = await login(test, "vendorB", "STAGING_VENDOR_B_EMAIL", "STAGING_VENDOR_B_PASSWORD", "VENDOR");

const customerOwnOrder = await request(`/api/orders/${ids.orderA}`, {}, customerA.jar);
const customerOtherOrder = await request(`/api/orders/${ids.orderB}`, {}, customerA.jar);
const customerReturn = await request(
  `/api/orders/${ids.orderA}/return-request`,
  {
    method: "POST",
    body: {
      reason: "Manufacturing Defect",
      details: "Fake staging return request evidence through secure route.",
      productImages: ["https://example.invalid/staging/customer-product.jpg"],
      defectImages: ["https://example.invalid/staging/customer-defect.jpg"],
      videos: ["https://example.invalid/staging/customer-video.mp4"],
    },
  },
  customerA.jar,
);
const customerRefundApproval = await request(
  `/api/admin/refunds/${ids.returnA}`,
  { method: "PATCH", body: { status: "REFUNDED", adminNote: "customer attempt" } },
  customerA.jar,
);
const customerTrust = await request(`/api/orders/${ids.orderA}/trust`, {}, customerA.jar);
const customerOtherTrust = await request(`/api/orders/${ids.orderB}/trust`, {}, customerA.jar);

const vendorAOrders = await request("/api/vendor/orders", {}, vendorA.jar);
const vendorBOrders = await request("/api/vendor/orders", {}, vendorB.jar);
const vendorAOtherOrderPatch = await request(
  `/api/vendor/orders/${ids.orderB}`,
  { method: "PATCH", body: { action: "SAVE_COURIER_DETAILS", carrier: "Fake", trackingNumber: "Fake" } },
  vendorA.jar,
);
const vendorDispatchEvidence = await request(
  `/api/vendor/orders/${ids.orderB}`,
  {
    method: "PATCH",
    body: {
      status: "SHIPPED",
      dispatchProductImages: ["https://example.invalid/staging/vendor-product.jpg"],
      dispatchPackedImages: ["https://example.invalid/staging/vendor-packed.jpg"],
      shippingLabelImage: "https://example.invalid/staging/vendor-label.jpg",
    },
  },
  vendorB.jar,
);
const vendorCustomerEvidenceChange = await request(
  `/api/orders/${ids.orderA}/return-request`,
  {
    method: "POST",
    body: {
      reason: "Manufacturing Defect",
      details: "Vendor should not be able to alter customer evidence.",
      productImages: ["https://example.invalid/staging/vendor-attempt.jpg"],
      defectImages: ["https://example.invalid/staging/vendor-attempt-defect.jpg"],
      videos: ["https://example.invalid/staging/vendor-attempt.mp4"],
    },
  },
  vendorA.jar,
);

const adminOrders = await request("/api/admin/orders?q=stg_flow", {}, admin.jar);
const adminRefunds = await request("/api/admin/refunds", {}, admin.jar);
const adminPayouts = await request("/api/admin/payouts", {}, admin.jar);
const adminPayoutUpdate = await request(
  "/api/admin/payouts",
  {
    method: "POST",
    body: {
      action: "update-payout",
      payoutId: ids.payoutA,
      status: "ON_HOLD",
      failureReason: "Fake staging hold.",
    },
  },
  admin.jar,
);

const usedOtp = await request(
  `/api/orders/${ids.orderA}/trust`,
  { method: "PATCH", body: { action: "verify-delivery-otp", otp: "000000" } },
  customerA.jar,
);
const expiredOtp = await request(
  `/api/orders/${ids.expiredOtpOrder}/trust`,
  { method: "PATCH", body: { action: "verify-delivery-otp", otp: "000000" } },
  customerA.jar,
);
const attemptLimitOtp = await request(
  `/api/orders/${ids.attemptLimitOrder}/trust`,
  { method: "PATCH", body: { action: "verify-delivery-otp", otp: "000000" } },
  customerA.jar,
);

const supabaseUrl = requireValue(staging, "STAGING_SUPABASE_URL");
const anonKey = requireValue(staging, "STAGING_SUPABASE_PUBLISHABLE_KEY");
const anon = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const customerClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const signIn = await customerClient.auth.signInWithPassword({
  email: requireValue(test, "STAGING_CUSTOMER_A_EMAIL"),
  password: requireValue(test, "STAGING_CUSTOMER_A_PASSWORD"),
});
if (signIn.error) throw signIn.error;

const anonOtpRead = await anon.from("delivery_otp").select("id").limit(1);
const authOtpRead = await customerClient.from("delivery_otp").select("id").limit(1);
const walletWrite = await customerClient.from("VendorWallet").update({ availableBalance: 999999 }).eq("id", "stg_flow_wallet_a");
const payoutWrite = await customerClient.from("VendorPayout").update({ payoutStatus: "PAID" }).eq("id", ids.payoutA);
const settlementWrite = await customerClient.from("VendorPayoutSettlement").update({ status: "PAID" }).eq("id", ids.settlementA);
const evidenceWrite = await customerClient.from("return_evidence").update({ url: "https://example.invalid/staging/changed.jpg" }).eq("id", "stg_flow_return_evidence_a");
await customerClient.auth.updateUser({ data: { role: "ADMIN" } });
const refreshed = await customerClient.auth.getUser();

const dbSummary = await directDbSummary(parts);
const vendorAOrderVendorIds = vendorIdsFromOrders(vendorAOrders.body);
const vendorBOrderVendorIds = vendorIdsFromOrders(vendorBOrders.body);

const result = {
  targetRef: STAGING_REF,
  logins: {
    admin: { status: admin.status, role: admin.role },
    customerA: { status: customerA.status, role: customerA.role },
    customerB: { status: customerB.status, role: customerB.role },
    vendorA: { status: vendorA.status, role: vendorA.role, vendorId: vendorA.vendorId },
    vendorB: { status: vendorB.status, role: vendorB.role, vendorId: vendorB.vendorId },
  },
  customer: {
    ownOrderStatus: customerOwnOrder.status,
    otherCustomerOrderStatus: customerOtherOrder.status,
    returnRouteStatus: customerReturn.status,
    refundApprovalAttemptStatus: customerRefundApproval.status,
    ownTrustStatus: customerTrust.status,
    otherTrustStatus: customerOtherTrust.status,
    rawOtpInTrustResponse: containsUnsafeOtp(customerTrust.body),
  },
  vendor: {
    vendorAOrdersStatus: vendorAOrders.status,
    vendorBOrdersStatus: vendorBOrders.status,
    vendorAOrderVendorIds,
    vendorBOrderVendorIds,
    vendorAOtherOrderPatchStatus: vendorAOtherOrderPatch.status,
    dispatchEvidenceStatus: vendorDispatchEvidence.status,
    customerEvidenceAlterAttemptStatus: vendorCustomerEvidenceChange.status,
  },
  admin: {
    ordersStatus: adminOrders.status,
    refundsStatus: adminRefunds.status,
    payoutsStatus: adminPayouts.status,
    payoutUpdateStatus: adminPayoutUpdate.status,
  },
  otp: {
    usedOtpStatus: usedOtp.status,
    expiredOtpStatus: expiredOtp.status,
    attemptLimitStatus: attemptLimitOtp.status,
    resendCooldownFixtureRows: Number(dbSummary.resend_cooldown_rows || 0),
  },
  directRls: {
    anonOtpReadDenied: Boolean(anonOtpRead.error),
    authenticatedOtpReadDenied: Boolean(authOtpRead.error),
    walletWriteDenied: Boolean(walletWrite.error),
    payoutWriteDenied: Boolean(payoutWrite.error),
    settlementWriteDenied: Boolean(settlementWrite.error),
    customerEvidenceWriteDenied: Boolean(evidenceWrite.error),
    normalUserAppMetadataRole: refreshed.data.user?.app_metadata?.role || null,
  },
  fixtureRows: dbSummary,
};

const pass = {
  customerOwnOrder: customerOwnOrder.status === 200,
  customerIsolation: [403, 404].includes(customerOtherOrder.status),
  customerReturnRoute: [200, 201].includes(customerReturn.status),
  customerCannotApproveRefund: customerRefundApproval.status === 403,
  noRawOtpInTrust: customerTrust.status === 200 && !containsUnsafeOtp(customerTrust.body),
  customerCannotReadOtherTrust: [403, 404].includes(customerOtherTrust.status),
  vendorOrderIsolation:
    vendorAOrders.status === 200 &&
    vendorBOrders.status === 200 &&
    vendorAOrderVendorIds.every((id) => id === "stg_demo_vendor_a") &&
    vendorBOrderVendorIds.every((id) => id === "stg_demo_vendor_b"),
  vendorCannotAccessVendorB: [403, 404].includes(vendorAOtherOrderPatch.status),
  vendorCanSubmitDispatchEvidence: [200, 400].includes(vendorDispatchEvidence.status),
  vendorCannotAlterCustomerEvidence: [403, 404].includes(vendorCustomerEvidenceChange.status),
  adminRoutes: adminOrders.status === 200 && adminRefunds.status === 200 && adminPayouts.status === 200,
  adminCanUpdatePayout: adminPayoutUpdate.status === 200,
  usedOtpDenied: usedOtp.status === 400,
  expiredOtpDenied: expiredOtp.status === 400,
  attemptLimitEnforced: attemptLimitOtp.status === 400,
  resendCooldownPresent: Number(dbSummary.resend_cooldown_rows || 0) > 0,
  directOtpProtected: Boolean(anonOtpRead.error) && Boolean(authOtpRead.error),
  protectedWritesDenied:
    Boolean(walletWrite.error) &&
    Boolean(payoutWrite.error) &&
    Boolean(settlementWrite.error) &&
    Boolean(evidenceWrite.error),
  normalUserCannotSetAdmin: refreshed.data.user?.app_metadata?.role !== "ADMIN",
};

console.log(JSON.stringify({ ...result, pass }, null, 2));

if (!Object.values(pass).every(Boolean)) {
  process.exit(1);
}
