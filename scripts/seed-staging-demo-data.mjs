import fs from "node:fs";
import bcrypt from "bcryptjs";
import pg from "pg";

const STAGING_REF = "tltcnxuhrqweyxpxjdtd";
const PRODUCTION_REF = "uvembydjrayvnrooyywl";
const APPLY = process.argv.includes("--apply");
const CLEANUP = process.argv.includes("--cleanup");
const DEMO_PREFIX = "stg_demo_";

const categorySpecs = [
  {
    id: `${DEMO_PREFIX}cat_fashion`,
    name: "Staging Fashion",
    slug: "staging-fashion",
    subcategories: [
      ["staging-fashion-kurtis", "Staging Kurtis"],
      ["staging-fashion-sarees", "Staging Sarees"],
    ],
  },
  {
    id: `${DEMO_PREFIX}cat_electronics`,
    name: "Staging Electronics",
    slug: "staging-electronics",
    subcategories: [
      ["staging-electronics-audio", "Staging Audio"],
      ["staging-electronics-mobile-accessories", "Staging Mobile Accessories"],
    ],
  },
  {
    id: `${DEMO_PREFIX}cat_home`,
    name: "Staging Home",
    slug: "staging-home",
    subcategories: [
      ["staging-home-kitchen", "Staging Kitchen"],
      ["staging-home-decor", "Staging Decor"],
    ],
  },
  {
    id: `${DEMO_PREFIX}cat_beauty`,
    name: "Staging Beauty",
    slug: "staging-beauty",
    subcategories: [
      ["staging-beauty-skincare", "Staging Skincare"],
      ["staging-beauty-haircare", "Staging Haircare"],
    ],
  },
  {
    id: `${DEMO_PREFIX}cat_kids`,
    name: "Staging Kids",
    slug: "staging-kids",
    subcategories: [
      ["staging-kids-clothing", "Staging Kids Clothing"],
      ["staging-kids-footwear", "Staging Kids Footwear"],
    ],
  },
];

const productNames = [
  "Fake Staging Pink Kurti",
  "Fake Staging Cotton Saree",
  "Fake Staging Wireless Earbuds",
  "Fake Staging Phone Case",
  "Fake Staging Steel Bottle",
  "Fake Staging Cushion Cover",
  "Fake Staging Face Wash",
  "Fake Staging Hair Oil",
  "Fake Staging Kids T-Shirt",
  "Fake Staging School Shoes",
];

const authAccounts = [
  ["admin", "STAGING_ADMIN_EMAIL", "STAGING_ADMIN_PASSWORD", "ADMIN", "Fake Staging Admin"],
  ["customerA", "STAGING_CUSTOMER_A_EMAIL", "STAGING_CUSTOMER_A_PASSWORD", "CUSTOMER", "Fake Staging Customer A"],
  ["customerB", "STAGING_CUSTOMER_B_EMAIL", "STAGING_CUSTOMER_B_PASSWORD", "CUSTOMER", "Fake Staging Customer B"],
  ["vendorA", "STAGING_VENDOR_A_EMAIL", "STAGING_VENDOR_A_PASSWORD", "VENDOR", "Fake Staging Vendor A"],
  ["vendorB", "STAGING_VENDOR_B_EMAIL", "STAGING_VENDOR_B_PASSWORD", "VENDOR", "Fake Staging Vendor B"],
];

function readEnvFile(path) {
  const values = {};
  if (!fs.existsSync(path)) return values;
  for (const line of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
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

function assertNoProduction(values) {
  if (Object.values(values).some((value) => String(value).includes(PRODUCTION_REF))) {
    throw new Error("Refusing production ref");
  }
}

function assertSafe(parts, staging) {
  assertNoProduction(parts);
  assertNoProduction(staging);
  if (parts.STAGING_DB_HOST !== "aws-1-ap-south-1.pooler.supabase.com") {
    throw new Error("Unexpected staging DB host marker");
  }
  if (parts.STAGING_DB_USER !== `postgres.${STAGING_REF}`) {
    throw new Error("Unexpected staging DB user marker");
  }
  if (staging.STAGING_SUPABASE_PROJECT_REF !== STAGING_REF) {
    throw new Error("Unexpected staging project ref");
  }
  const supabaseUrl = requireValue(staging, "STAGING_SUPABASE_URL");
  if (!supabaseUrl.includes(STAGING_REF) || supabaseUrl.includes(PRODUCTION_REF)) {
    throw new Error("Unexpected staging Supabase URL");
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

async function resolveAuthMappings(parts, test) {
  const client = new pg.Client(directDbConfig(parts));
  await client.connect();
  let users;
  try {
    const result = await client.query(
      `select id::text, email, raw_app_meta_data
         from auth.users
        where lower(email) = any($1::text[])`,
      [authAccounts.map(([, emailKey]) => requireValue(test, emailKey).toLowerCase())],
    );
    users = result.rows;
  } finally {
    await client.end();
  }
  const mappings = {};
  for (const [label, emailKey, passwordKey, expectedRole, name] of authAccounts) {
    const email = requireValue(test, emailKey).toLowerCase();
    const authUser = users.find((candidate) => candidate.email?.toLowerCase() === email);
    if (!authUser) throw new Error(`Missing staging Auth user for ${label}`);
    const appMetadataRole = authUser.raw_app_meta_data?.role || null;
    if (expectedRole === "ADMIN" && appMetadataRole !== "ADMIN") {
      throw new Error("Admin Auth user is missing protected ADMIN app_metadata role");
    }
    if (expectedRole !== "ADMIN" && appMetadataRole === "ADMIN") {
      throw new Error(`${label} Auth user unexpectedly has ADMIN app_metadata role`);
    }
    mappings[label] = {
      id: authUser.id,
      email,
      password: requireValue(test, passwordKey),
      role: expectedRole,
      name,
      appMetadataRole,
    };
  }
  return mappings;
}

function makeRecords(mappings) {
  const vendors = [
    {
      id: `${DEMO_PREFIX}vendor_a`,
      userId: mappings.vendorA.id,
      storeName: "Fake Staging Vendor A",
      mobile: "9000000101",
      panNumber: "AAAAA0000A",
    },
    {
      id: `${DEMO_PREFIX}vendor_b`,
      userId: mappings.vendorB.id,
      storeName: "Fake Staging Vendor B",
      mobile: "9000000102",
      panNumber: "BBBBB0000B",
    },
  ];

  const subcategories = [];
  const productTypes = [];
  categorySpecs.forEach((category, categoryIndex) => {
    category.subcategories.forEach(([slug, name], subIndex) => {
      const subcategoryId = `${DEMO_PREFIX}sub_${slug.replace(/^staging-/, "").replaceAll("-", "_")}`;
      subcategories.push({
        id: subcategoryId,
        categoryId: category.id,
        slug,
        name,
        sortOrder: subIndex + 1,
      });
      productTypes.push({
        id: `${DEMO_PREFIX}type_${slug.replace(/^staging-/, "").replaceAll("-", "_")}`,
        subcategoryId,
        slug: `${slug}-type`,
        name: `${name} Type`,
        sortOrder: categoryIndex * 2 + subIndex + 1,
      });
    });
  });

  const products = productNames.map((name, index) => {
    const category = categorySpecs[index % categorySpecs.length];
    const subcategory = subcategories[index];
    const productType = productTypes[index];
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return {
      id: `${DEMO_PREFIX}product_${String(index + 1).padStart(2, "0")}`,
      name,
      slug,
      description: "Fake staging product for catalogue, RLS, and route testing only.",
      price: 299 + index * 75,
      mrp: 399 + index * 90,
      vendorPrice: 220 + index * 55,
      sku: `STG-DEMO-${String(index + 1).padStart(2, "0")}`,
      inventory: 10 + index,
      vendorId: vendors[index % vendors.length].id,
      categoryId: category.id,
      subcategoryId: subcategory.id,
      productTypeId: productType.id,
    };
  });

  const variants = products.flatMap((product) => [
    {
      id: `${product.id}_variant_a`,
      productId: product.id,
      sizeLabel: "S",
      numericSize: "36",
      color: "Demo Blue",
      sku: `${product.sku}-S`,
      stockQuantity: 5,
      price: product.price,
      vendorPrice: product.vendorPrice,
      mrp: product.mrp,
    },
    {
      id: `${product.id}_variant_b`,
      productId: product.id,
      sizeLabel: "M",
      numericSize: "38",
      color: "Demo Green",
      sku: `${product.sku}-M`,
      stockQuantity: 6,
      price: product.price,
      vendorPrice: product.vendorPrice,
      mrp: product.mrp,
    },
  ]);

  const inventories = products.map((product) => ({
    id: `${product.id}_inventory`,
    productId: product.id,
    vendorId: product.vendorId,
    sku: product.sku,
    currentStock: product.inventory,
    reservedStock: 0,
    availableStock: product.inventory,
  }));

  return { vendors, subcategories, productTypes, products, variants, inventories };
}

async function cleanup(client, mappings) {
  const { subcategories, productTypes, products, variants, inventories } = makeRecords(mappings);
  await client.query("delete from public.\"Inventory\" where id = any($1::text[])", [inventories.map((row) => row.id)]);
  await client.query("delete from public.\"ProductVariant\" where id = any($1::text[]) or sku = any($2::text[])", [
    variants.map((row) => row.id),
    variants.map((row) => row.sku),
  ]);
  await client.query("delete from public.\"Product\" where id = any($1::text[]) or slug = any($2::text[])", [
    products.map((row) => row.id),
    products.map((row) => row.slug),
  ]);
  await client.query("delete from public.\"ProductType\" where id = any($1::text[]) or slug = any($2::text[])", [
    productTypes.map((row) => row.id),
    productTypes.map((row) => row.slug),
  ]);
  await client.query("delete from public.\"Subcategory\" where id = any($1::text[]) or slug = any($2::text[])", [
    subcategories.map((row) => row.id),
    subcategories.map((row) => row.slug),
  ]);
  await client.query("delete from public.\"Category\" where id = any($1::text[]) or slug = any($2::text[])", [
    categorySpecs.map((row) => row.id),
    categorySpecs.map((row) => row.slug),
  ]);
  await client.query("delete from public.\"HomepageContent\" where id = $1", [`${DEMO_PREFIX}homepage`]);
  await client.query("delete from public.\"Vendor\" where id in ($1, $2)", [`${DEMO_PREFIX}vendor_a`, `${DEMO_PREFIX}vendor_b`]);
  await client.query("delete from public.\"User\" where id = any($1::text[])", [
    Object.values(mappings).map((mapping) => mapping.id),
  ]);
}

async function upsertUser(client, mapping) {
  const hash = await bcrypt.hash(mapping.password, 10);
  await client.query(
    `insert into public."User" (id, email, name, password, role, "emailVerified", "createdAt", "updatedAt")
     values ($1, $2, $3, $4, $5::"UserRole", true, now(), now())
     on conflict (email) do update
       set name = excluded.name,
           id = excluded.id,
           password = excluded.password,
           role = excluded.role,
           "emailVerified" = true,
           "updatedAt" = now()`,
    [mapping.id, mapping.email, mapping.name, hash, mapping.role],
  );
}

async function seed(client, mappings) {
  const { vendors, subcategories, productTypes, products, variants, inventories } = makeRecords(mappings);

  for (const mapping of Object.values(mappings)) {
    await upsertUser(client, mapping);
  }

  for (const vendor of vendors) {
    await client.query(
      `insert into public."Vendor" (id, "userId", "storeName", description, mobile, "businessCategory", "businessAddress", "panNumber", status, "kycStatus", "approvedAt", "createdAt", "updatedAt")
       values ($1, $2, $3, 'Fake staging vendor application record only', $4, 'Staging Demo', 'Fake staging vendor address', $5, 'APPROVED'::"VendorStatus", 'APPROVED'::"KycStatus", now(), now(), now())
       on conflict (id) do update
         set "storeName" = excluded."storeName",
             status = excluded.status,
             "kycStatus" = excluded."kycStatus",
             "updatedAt" = now()`,
      [vendor.id, vendor.userId, vendor.storeName, vendor.mobile, vendor.panNumber],
    );
  }

  for (const [index, category] of categorySpecs.entries()) {
    await client.query(
      `insert into public."Category" (id, name, slug, status, "sortOrder", "homepageIcon", "categoryImage", "desktopBanner", "mobileBanner", "altText")
       values ($1, $2, $3, 'ACTIVE', $4, $5, $6, $7, $8, $9)
       on conflict (slug) do update
         set name = excluded.name,
             status = excluded.status,
             "sortOrder" = excluded."sortOrder"`,
      [
        category.id,
        category.name,
        category.slug,
        index + 1,
        `https://example.invalid/staging/${category.slug}-icon.png`,
        `https://example.invalid/staging/${category.slug}-category.png`,
        `https://example.invalid/staging/${category.slug}-desktop.png`,
        `https://example.invalid/staging/${category.slug}-mobile.png`,
        `Fake ${category.name} category`,
      ],
    );
  }

  for (const subcategory of subcategories) {
    await client.query(
      `insert into public."Subcategory" (id, name, slug, "categoryId", status, "sortOrder", "homepageIcon", "categoryImage", "desktopBanner", "mobileBanner", "altText", "createdAt", "updatedAt")
       values ($1, $2, $3, $4, 'ACTIVE', $5, $6, $7, $8, $9, $10, now(), now())
       on conflict (slug) do update
         set name = excluded.name,
             "categoryId" = excluded."categoryId",
             status = excluded.status,
             "sortOrder" = excluded."sortOrder",
             "updatedAt" = now()`,
      [
        subcategory.id,
        subcategory.name,
        subcategory.slug,
        subcategory.categoryId,
        subcategory.sortOrder,
        `https://example.invalid/staging/${subcategory.slug}-icon.png`,
        `https://example.invalid/staging/${subcategory.slug}-category.png`,
        `https://example.invalid/staging/${subcategory.slug}-desktop.png`,
        `https://example.invalid/staging/${subcategory.slug}-mobile.png`,
        `Fake ${subcategory.name} subcategory`,
      ],
    );
  }

  for (const productType of productTypes) {
    await client.query(
      `insert into public."ProductType" (id, name, slug, "subcategoryId", status, "sortOrder", "homepageIcon", "categoryImage", "desktopBanner", "mobileBanner", "altText", "createdAt", "updatedAt")
       values ($1, $2, $3, $4, 'ACTIVE', $5, $6, $7, $8, $9, $10, now(), now())
       on conflict (slug) do update
         set name = excluded.name,
             "subcategoryId" = excluded."subcategoryId",
             status = excluded.status,
             "sortOrder" = excluded."sortOrder",
             "updatedAt" = now()`,
      [
        productType.id,
        productType.name,
        productType.slug,
        productType.subcategoryId,
        productType.sortOrder,
        `https://example.invalid/staging/${productType.slug}-icon.png`,
        `https://example.invalid/staging/${productType.slug}-category.png`,
        `https://example.invalid/staging/${productType.slug}-desktop.png`,
        `https://example.invalid/staging/${productType.slug}-mobile.png`,
        `Fake ${productType.name}`,
      ],
    );
  }

  await client.query(
    `insert into public."HomepageContent" (id, content, "createdAt", "updatedAt")
     values ($1, $2, now(), now())
     on conflict (id) do update
       set content = excluded.content,
           "updatedAt" = now()`,
    [`${DEMO_PREFIX}homepage`, JSON.stringify({ source: "staging-demo", status: "published", categoryCount: 5, productCount: 10 })],
  );

  for (const product of products) {
    await client.query(
      `insert into public."Product" (id, name, slug, description, price, mrp, "vendorPrice", "sellingPrice", "discountPercent", "discountAmount", "platformCommissionPercent", "platformCommissionAmount", "packagingCharge", "shippingCharge", "codCharge", "finalCustomerPrice", "vendorPayout", "priceApproved", sku, images, inventory, "vendorId", "categoryId", "subcategoryId", "productTypeId", "createdAt", "updatedAt")
       values ($1, $2, $3, $4, $5, $6, $7, $5, 10, 25, 10, 25, 5, 0, 0, $5, $7, true, $8, $9::jsonb, $10, $11, $12, $13, $14, now(), now())
       on conflict (slug) do update
         set price = excluded.price,
             inventory = excluded.inventory,
             "vendorId" = excluded."vendorId",
             "categoryId" = excluded."categoryId",
             "subcategoryId" = excluded."subcategoryId",
             "productTypeId" = excluded."productTypeId",
             "priceApproved" = true,
             "updatedAt" = now()`,
      [
        product.id,
        product.name,
        product.slug,
        product.description,
        product.price,
        product.mrp,
        product.vendorPrice,
        product.sku,
        JSON.stringify([`https://example.invalid/staging/${product.slug}.png`]),
        product.inventory,
        product.vendorId,
        product.categoryId,
        product.subcategoryId,
        product.productTypeId,
      ],
    );
  }

  for (const variant of variants) {
    await client.query(
      `insert into public."ProductVariant" (id, "productId", "sizeLabel", "numericSize", color, sku, "stockQuantity", price, "vendorPrice", mrp, "imageUrl", status, "lowStockThreshold", "createdAt", "updatedAt")
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'IN_STOCK', 2, now(), now())
       on conflict (sku) do update
         set "stockQuantity" = excluded."stockQuantity",
             price = excluded.price,
             "vendorPrice" = excluded."vendorPrice",
             "updatedAt" = now()`,
      [
        variant.id,
        variant.productId,
        variant.sizeLabel,
        variant.numericSize,
        variant.color,
        variant.sku,
        variant.stockQuantity,
        variant.price,
        variant.vendorPrice,
        variant.mrp,
        `https://example.invalid/staging/${variant.sku.toLowerCase()}.png`,
      ],
    );
  }

  for (const inventory of inventories) {
    await client.query(
      `insert into public."Inventory" (id, "productId", "vendorId", sku, "currentStock", "reservedStock", "availableStock", "stockStatus", "lastStockUpdatedAt", "createdAt", "updatedAt")
       values ($1, $2, $3, $4, $5, $6, $7, 'IN_STOCK', now(), now(), now())
       on conflict ("productId") do update
         set "currentStock" = excluded."currentStock",
             "reservedStock" = excluded."reservedStock",
             "availableStock" = excluded."availableStock",
             "updatedAt" = now()`,
      [inventory.id, inventory.productId, inventory.vendorId, inventory.sku, inventory.currentStock, inventory.reservedStock, inventory.availableStock],
    );
  }
}

const partsEnv = readEnvFile(".env.staging.db.parts.local");
const stagingEnv = readEnvFile(".env.staging.local");
const testEnv = readEnvFile(".env.staging.test.local");
assertSafe(partsEnv, stagingEnv);
assertNoProduction(testEnv);

const mappings = await resolveAuthMappings(partsEnv, testEnv);
const records = makeRecords(mappings);
const summary = {
  targetRef: STAGING_REF,
  mode: CLEANUP ? "cleanup" : APPLY ? "apply" : "preview",
  fakeOnly: true,
  proposedRows: {
    User: 5,
    Vendor: 2,
    Category: categorySpecs.length,
    Subcategory: records.subcategories.length,
    ProductType: records.productTypes.length,
    HomepageContent: 1,
    Product: records.products.length,
    ProductVariant: records.variants.length,
    Inventory: records.inventories.length,
    VendorBankAccount: 0,
    VendorWallet: 0,
    VendorPayout: 0,
    VendorPayoutSettlement: 0,
    SettlementReport: 0,
    RefundAdjustment: 0,
    Order: 0,
    OrderItem: 0,
  },
  sampleNames: {
    categories: categorySpecs.slice(0, 3).map((category) => category.name),
    products: productNames.slice(0, 4),
  },
  authMapping: Object.fromEntries(
    Object.entries(mappings).map(([label, mapping]) => [
      label,
      {
        authUserFound: true,
        authIdPrefix: `${mapping.id.slice(0, 8)}...`,
        expectedRole: mapping.role,
        appMetadataRole: mapping.appMetadataRole,
        adminMetadataOk: mapping.role === "ADMIN" ? mapping.appMetadataRole === "ADMIN" : mapping.appMetadataRole !== "ADMIN",
      },
    ]),
  ),
  transactionPlan: "single transaction; rollback on failure",
  cleanupPlan: "delete only stable stg_demo_* IDs/slugs created by this seed; no non-demo deletes",
  exclusions: [
    "VendorBankAccount",
    "VendorWallet balances",
    "VendorPayout",
    "VendorPayoutSettlement",
    "SettlementReport",
    "RefundAdjustment",
    "Order",
    "OrderItem",
    "real customer data",
    "real bank data",
    "real OTP values",
    "real addresses",
  ],
};

if (!APPLY && !CLEANUP) {
  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
}

const client = new pg.Client({
  ...directDbConfig(partsEnv),
});

await client.connect();
try {
  await client.query("begin");
  if (CLEANUP) await cleanup(client, mappings);
  if (APPLY) await seed(client, mappings);
  await client.query("commit");
  console.log(JSON.stringify({ ...summary, executed: true }, null, 2));
} catch (error) {
  await client.query("rollback").catch(() => {});
  const message = String(error?.message || "unknown")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "<REDACTED_EMAIL>")
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "<REDACTED_DATABASE_URL>");
  console.error(`STAGING_DEMO_SEED_FAILED=${message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
