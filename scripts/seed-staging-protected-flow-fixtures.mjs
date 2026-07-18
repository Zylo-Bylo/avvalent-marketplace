import fs from "node:fs";
import crypto from "node:crypto";
import pg from "pg";

const STAGING_REF = "tltcnxuhrqweyxpxjdtd";
const PRODUCTION_REF = "uvembydjrayvnrooyywl";
const PREFIX = "stg_flow_";
const APPLY = process.argv.includes("--apply");
const CLEANUP = process.argv.includes("--cleanup");

const ids = {
  orderA: `${PREFIX}order_customer_a_vendor_a`,
  orderB: `${PREFIX}order_customer_b_vendor_b`,
  expiredOtpOrder: `${PREFIX}order_expired_otp`,
  attemptLimitOrder: `${PREFIX}order_attempt_limit`,
  itemA: `${PREFIX}item_customer_a_vendor_a`,
  itemB: `${PREFIX}item_customer_b_vendor_b`,
  itemExpiredOtp: `${PREFIX}item_expired_otp`,
  itemAttemptLimit: `${PREFIX}item_attempt_limit`,
  verificationA: `${PREFIX}verification_a`,
  verificationB: `${PREFIX}verification_b`,
  expiredOtp: `${PREFIX}delivery_otp_expired`,
  usedOtp: `${PREFIX}delivery_otp_used`,
  attemptLimitOtp: `${PREFIX}delivery_otp_attempt_limit`,
  dispatchAProduct: `${PREFIX}dispatch_a_product`,
  dispatchAPacked: `${PREFIX}dispatch_a_packed`,
  dispatchALabel: `${PREFIX}dispatch_a_label`,
  returnA: `${PREFIX}return_a`,
  returnEvidenceA: `${PREFIX}return_evidence_a`,
  walletA: `${PREFIX}wallet_a`,
  bankA: `${PREFIX}bank_a`,
  payoutA: `${PREFIX}payout_a`,
  settlementA: `${PREFIX}settlement_a`,
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

function assertSafe(parts, staging) {
  if (Object.values({ ...parts, ...staging }).some((value) => String(value).includes(PRODUCTION_REF))) {
    throw new Error("Refusing production ref");
  }
  if (staging.STAGING_SUPABASE_PROJECT_REF !== STAGING_REF) {
    throw new Error("Refusing non-staging project ref");
  }
  if (parts.STAGING_DB_HOST !== "aws-1-ap-south-1.pooler.supabase.com") {
    throw new Error("Unexpected staging DB host marker");
  }
  if (parts.STAGING_DB_USER !== `postgres.${STAGING_REF}`) {
    throw new Error("Unexpected staging DB user marker");
  }
}

if (process.argv.includes("--self-test-production-ref")) {
  let rejected = false;
  try {
    assertSafe(
      {
        STAGING_DB_HOST: "aws-1-ap-south-1.pooler.supabase.com",
        STAGING_DB_USER: `postgres.${STAGING_REF}`,
        STAGING_DB_PASSWORD: "placeholder",
      },
      {
        STAGING_SUPABASE_PROJECT_REF: STAGING_REF,
        STAGING_SUPABASE_URL: `https://${PRODUCTION_REF}.supabase.co`,
      },
    );
  } catch {
    rejected = true;
  }
  console.log(JSON.stringify({ targetRef: STAGING_REF, productionRefRejected: rejected }, null, 2));
  process.exit(rejected ? 0 : 1);
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

function fakeOtpHash(label) {
  return crypto.createHash("sha256").update(`staging-fixture:${label}`).digest("hex");
}

async function loadPrerequisites(client) {
  const result = await client.query(`
    select
      (select id from public."User" where id = (select "userId" from public."Vendor" where id = 'stg_demo_vendor_a') limit 1) as vendor_a_user_id,
      (select id from public."User" where id = (select "userId" from public."Vendor" where id = 'stg_demo_vendor_b') limit 1) as vendor_b_user_id,
      (select id from public."User" where role = 'CUSTOMER' order by id limit 1 offset 0) as customer_a_id,
      (select id from public."User" where role = 'CUSTOMER' order by id limit 1 offset 1) as customer_b_id,
      (select id from public."Product" where "vendorId" = 'stg_demo_vendor_a' order by id limit 1) as product_a_id,
      (select id from public."Product" where "vendorId" = 'stg_demo_vendor_b' order by id limit 1) as product_b_id,
      (select id from public."ProductVariant" where "productId" = (select id from public."Product" where "vendorId" = 'stg_demo_vendor_a' order by id limit 1) order by id limit 1) as variant_a_id,
      (select id from public."ProductVariant" where "productId" = (select id from public."Product" where "vendorId" = 'stg_demo_vendor_b' order by id limit 1) order by id limit 1) as variant_b_id
  `);
  const row = result.rows[0];
  for (const [key, value] of Object.entries(row)) {
    if (!value) throw new Error(`Missing prerequisite ${key}. Run catalogue seed first.`);
  }
  return row;
}

async function cleanup(client) {
  await client.query("begin");
  try {
    await client.query(`delete from public.risk_assessment where "returnRequestId" = $1`, [ids.returnA]);
    await client.query(`delete from public.return_evidence where id = $1`, [ids.returnEvidenceA]);
    await client.query(`delete from public.return_requests where id = $1`, [ids.returnA]);
    await client.query(`delete from public."ReturnRefundRequest" where id = $1`, [ids.returnA]);
    await client.query(`delete from public.delivery_otp where id = any($1::text[])`, [[ids.expiredOtp, ids.usedOtp, ids.attemptLimitOtp]]);
    await client.query(`delete from public.dispatch_images where id = any($1::text[])`, [[ids.dispatchAProduct, ids.dispatchAPacked, ids.dispatchALabel]]);
    await client.query(`delete from public.open_box_verification where "orderId" = any($1::text[])`, [[ids.orderA, ids.orderB]]);
    await client.query(`delete from public.order_verification where id = any($1::text[])`, [[ids.verificationA, ids.verificationB]]);
    await client.query(`delete from public."VendorPayoutSettlement" where id = $1`, [ids.settlementA]);
    await client.query(`delete from public."VendorPayout" where id = $1`, [ids.payoutA]);
    await client.query(`delete from public."VendorBankAccount" where id = $1`, [ids.bankA]);
    await client.query(`delete from public."VendorWallet" where id = $1`, [ids.walletA]);
    await client.query(`delete from public."OrderItem" where id = any($1::text[])`, [[ids.itemA, ids.itemB, ids.itemExpiredOtp, ids.itemAttemptLimit]]);
    await client.query(`delete from public."Order" where id = any($1::text[])`, [[ids.orderA, ids.orderB, ids.expiredOtpOrder, ids.attemptLimitOrder]]);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function applyFixtures(client, prereq) {
  await client.query("begin");
  try {
    await client.query(
      `insert into public."Order" (
        id, "userId", "vendorId", "totalAmount", status, "paymentMethod",
        "shippingName", "shippingPhone", "shippingAddress", "shippingCity", "shippingState", "shippingZipCode",
        "trackingNumber", carrier, "statusNote", "shippedAt", "deliveredAt", "createdAt", "updatedAt"
      ) values
        ($1, $2, 'stg_demo_vendor_a', 1200, 'DELIVERED', 'COD', 'Fake Staging Customer A', null, null, null, null, null, 'FAKE-AWB-A', 'FAKE_COURIER', 'Fake delivered staging fixture', current_timestamp, current_timestamp, current_timestamp, current_timestamp),
        ($3, $4, 'stg_demo_vendor_b', 800, 'SHIPPED', 'COD', 'Fake Staging Customer B', null, null, null, null, null, 'FAKE-AWB-B', 'FAKE_COURIER', 'Fake shipped staging fixture', current_timestamp, null, current_timestamp, current_timestamp),
        ($5, $2, 'stg_demo_vendor_a', 500, 'SHIPPED', 'COD', 'Fake Staging Customer A', null, null, null, null, null, 'FAKE-AWB-C', 'FAKE_COURIER', 'Fake expired OTP fixture', current_timestamp, null, current_timestamp, current_timestamp),
        ($6, $2, 'stg_demo_vendor_a', 500, 'SHIPPED', 'COD', 'Fake Staging Customer A', null, null, null, null, null, 'FAKE-AWB-D', 'FAKE_COURIER', 'Fake attempt-limit OTP fixture', current_timestamp, null, current_timestamp, current_timestamp)
      on conflict (id) do update set
        status = excluded.status,
        "trackingNumber" = excluded."trackingNumber",
        carrier = excluded.carrier,
        "statusNote" = excluded."statusNote",
        "updatedAt" = current_timestamp`,
      [ids.orderA, prereq.customer_a_id, ids.orderB, prereq.customer_b_id, ids.expiredOtpOrder, ids.attemptLimitOrder],
    );

    await client.query(
      `insert into public."OrderItem" (
        id, "orderId", "productId", "variantId", quantity, price, mrp,
        "vendorPrice", "platformCommissionAmount", "vendorPayout", "variantSku"
      ) values
        ($1, $2, $3, $4, 1, 1200, 1400, 900, 120, 780, 'STG-FLOW-A'),
        ($5, $6, $7, $8, 1, 800, 950, 600, 80, 520, 'STG-FLOW-B'),
        ($9, $10, $3, $4, 1, 500, 650, 400, 50, 350, 'STG-FLOW-C'),
        ($11, $12, $3, $4, 1, 500, 650, 400, 50, 350, 'STG-FLOW-D')
      on conflict (id) do update set quantity = excluded.quantity, price = excluded.price`,
      [
        ids.itemA,
        ids.orderA,
        prereq.product_a_id,
        prereq.variant_a_id,
        ids.itemB,
        ids.orderB,
        prereq.product_b_id,
        prereq.variant_b_id,
        ids.itemExpiredOtp,
        ids.expiredOtpOrder,
        ids.itemAttemptLimit,
        ids.attemptLimitOrder,
      ],
    );

    await client.query(
      `insert into public.order_verification (
        id, "orderId", "verificationId", "openBoxEligible", "customerProductConfirmed",
        "correctProduct", "correctBrand", "correctSize", "correctColor", "correctQuantity",
        "verifiedDelivered", "verifiedAt", "createdAt", "updatedAt"
      ) values
        ($1, $2, 'ZB-STG-FLOW-A', true, true, true, true, true, true, true, true, current_timestamp, current_timestamp, current_timestamp),
        ($3, $4, 'ZB-STG-FLOW-B', true, false, false, false, false, false, false, false, null, current_timestamp, current_timestamp)
      on conflict ("orderId") do update set
        "verifiedDelivered" = excluded."verifiedDelivered",
        "verifiedAt" = excluded."verifiedAt",
        "updatedAt" = current_timestamp`,
      [ids.verificationA, ids.orderA, ids.verificationB, ids.orderB],
    );

    await client.query(
      `insert into public.dispatch_images (id, "orderId", "vendorId", "imageType", url)
       values
        ($1, $4, 'stg_demo_vendor_a', 'PRODUCT', 'https://example.invalid/staging/dispatch-product.jpg'),
        ($2, $4, 'stg_demo_vendor_a', 'PACKED_PRODUCT', 'https://example.invalid/staging/dispatch-packed.jpg'),
        ($3, $4, 'stg_demo_vendor_a', 'SHIPPING_LABEL', 'https://example.invalid/staging/dispatch-label.jpg')
       on conflict (id) do update set url = excluded.url`,
      [ids.dispatchAProduct, ids.dispatchAPacked, ids.dispatchALabel, ids.orderA],
    );

    await client.query(
      `insert into public.delivery_otp (
        id, "orderId", otp, "otpHash", verified, attempts, "verifiedAt", "expiresAt", "resendAvailableAt", "createdAt"
      ) values
        ($1, $4, 'NOT_A_REAL_OTP', $7, true, 0, current_timestamp, current_timestamp + interval '15 minutes', current_timestamp + interval '2 hours', current_timestamp),
        ($2, $5, 'NOT_A_REAL_OTP', $8, false, 0, null, current_timestamp - interval '1 minute', current_timestamp + interval '2 hours', current_timestamp),
        ($3, $6, 'NOT_A_REAL_OTP', $9, false, 5, null, current_timestamp + interval '15 minutes', current_timestamp + interval '2 hours', current_timestamp)
      on conflict ("orderId") do update set
        otp = excluded.otp,
        "otpHash" = excluded."otpHash",
        verified = excluded.verified,
        attempts = excluded.attempts,
        "verifiedAt" = excluded."verifiedAt",
        "expiresAt" = excluded."expiresAt",
        "resendAvailableAt" = excluded."resendAvailableAt"`,
      [
        ids.usedOtp,
        ids.expiredOtp,
        ids.attemptLimitOtp,
        ids.orderA,
        ids.expiredOtpOrder,
        ids.attemptLimitOrder,
        fakeOtpHash("used"),
        fakeOtpHash("expired"),
        fakeOtpHash("attempt-limit"),
      ],
    );

    await client.query(
      `insert into public."ReturnRefundRequest" (id, "orderId", "userId", reason, status, "adminNote", "refundReference", "createdAt", "updatedAt")
       values ($1, $2, $3, 'Manufacturing Defect: fake staging protected-flow fixture', 'PENDING', null, null, current_timestamp, current_timestamp)
       on conflict ("orderId") do update set status = excluded.status, "updatedAt" = current_timestamp`,
      [ids.returnA, ids.orderA, prereq.customer_a_id],
    );
    await client.query(
      `insert into public.return_requests (
        id, "orderId", "userId", reason, details, status, "riskLevel", "riskScore", "createdAt", "updatedAt"
      ) values ($1, $2, $3, 'Manufacturing Defect', 'Fake staging protected-flow return fixture', 'PENDING', 'MEDIUM', 50, current_timestamp, current_timestamp)
      on conflict (id) do update set status = excluded.status, "updatedAt" = current_timestamp`,
      [ids.returnA, ids.orderA, prereq.customer_a_id],
    );
    await client.query(
      `insert into public.return_evidence (id, "returnRequestId", "orderId", "evidenceType", url)
       values ($1, $2, $3, 'PRODUCT_IMAGE', 'https://example.invalid/staging/return-evidence.jpg')
       on conflict (id) do update set url = excluded.url`,
      [ids.returnEvidenceA, ids.returnA, ids.orderA],
    );

    await client.query(
      `insert into public."VendorWallet" (
        id, "vendorId", "grossSales", "commissionDeducted", "refundDeducted", "penaltyDeducted",
        "availableBalance", "pendingBalance", "paidBalance", "createdAt", "updatedAt"
      ) values ($1, 'stg_demo_vendor_a', 0, 0, 0, 0, 0, 0, 0, current_timestamp, current_timestamp)
      on conflict ("vendorId") do nothing`,
      [ids.walletA],
    );
    await client.query(
      `insert into public."VendorBankAccount" (
        id, "vendorId", "accountHolderName", "bankName", "accountNumber", "ifscCode", "upiId",
        "panNumber", "gstNumber", "verificationStatus", "createdAt", "updatedAt"
      ) values ($1, 'stg_demo_vendor_a', 'Fake Staging Vendor A', 'Fake Bank', 'MASKED-STAGING-0000', 'FAKE0000000', null, 'FAKEP0000A', null, 'PENDING', current_timestamp, current_timestamp)
      on conflict (id) do update set "verificationStatus" = excluded."verificationStatus", "updatedAt" = current_timestamp`,
      [ids.bankA],
    );
    await client.query(
      `insert into public."VendorPayout" (
        id, "vendorId", "payoutAmount", "payoutStatus", "payoutMethod", "bankAccountId", "createdAt", "updatedAt"
      ) values ($1, 'stg_demo_vendor_a', 0, 'PENDING', 'MANUAL', $2, current_timestamp, current_timestamp)
      on conflict (id) do update set "payoutStatus" = excluded."payoutStatus", "updatedAt" = current_timestamp`,
      [ids.payoutA, ids.bankA],
    );
    await client.query(
      `insert into public."VendorPayoutSettlement" (
        id, "vendorId", amount, reference, notes, status, "paidAt", "createdAt", "updatedAt"
      ) values ($1, 'stg_demo_vendor_a', 0, 'MASKED-STAGING-SETTLEMENT', 'Fake zero-value staging fixture', 'PAID', null, current_timestamp, current_timestamp)
      on conflict (id) do update set status = excluded.status, "updatedAt" = current_timestamp`,
      [ids.settlementA],
    );

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

const proposedRows = {
  Order: 4,
  OrderItem: 4,
  order_verification: 2,
  dispatch_images: 3,
  delivery_otp: 3,
  ReturnRefundRequest: 1,
  return_requests: 1,
  return_evidence: 1,
  VendorWallet: 1,
  VendorBankAccount: 1,
  VendorPayout: 1,
  VendorPayoutSettlement: 1,
};

const parts = readEnvFile(".env.staging.db.parts.local");
const staging = readEnvFile(".env.staging.local");
assertSafe(parts, staging);

const client = new pg.Client(directDbConfig(parts));
await client.connect();
try {
  const prereq = await loadPrerequisites(client);
  if (CLEANUP) {
    await cleanup(client);
  } else if (APPLY) {
    await applyFixtures(client, prereq);
  }

  console.log(JSON.stringify({
    targetRef: STAGING_REF,
    mode: CLEANUP ? "cleanup" : APPLY ? "apply" : "preview",
    proposedRows,
    fakeOnly: true,
    noRawOtpInserted: true,
    sampleFixtures: {
      customerOrder: ids.orderA,
      vendorA: "stg_demo_vendor_a",
      vendorB: "stg_demo_vendor_b",
      evidenceUrl: "https://example.invalid/staging/return-evidence.jpg",
      bankReference: "MASKED-STAGING-0000",
    },
    prereqSummary: {
      customerAIdPrefix: `${prereq.customer_a_id.slice(0, 8)}...`,
      customerBIdPrefix: `${prereq.customer_b_id.slice(0, 8)}...`,
      productAId: prereq.product_a_id,
      productBId: prereq.product_b_id,
    },
    transactionPlan: "single transaction with rollback on any error",
    cleanupPlan: "deletes only stable stg_flow_* fixture IDs and does not delete catalogue seed rows",
  }, null, 2));
} finally {
  await client.end();
}
