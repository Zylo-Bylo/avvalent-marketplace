import fs from "node:fs";

const BASE_URL = process.env.STAGING_APP_URL || "http://127.0.0.1:3100";
const STAGING_REF = "tltcnxuhrqweyxpxjdtd";
const PRODUCTION_REF = "uvembydjrayvnrooyywl";

const FULL_ADMIN_ROUTES = [
  "/admin",
  "/admin/dashboard",
  "/admin/categories",
  "/admin/products",
  "/admin/add-product",
  "/admin/homepage",
  "/admin/inventory",
  "/admin/orders",
  "/admin/payments",
  "/admin/payouts",
  "/admin/policies",
  "/admin/profile",
  "/admin/refunds",
  "/admin/security",
  "/admin/vendors",
];
const SMOKE_ADMIN_ROUTES = ["/admin", "/admin/dashboard", "/admin/categories", "/admin/products"];
const ADMIN_ROUTES = process.argv.includes("--smoke") ? SMOKE_ADMIN_ROUTES : FULL_ADMIN_ROUTES;

const ACCOUNTS = [
  ["admin", "STAGING_ADMIN_EMAIL", "STAGING_ADMIN_PASSWORD", "ADMIN"],
  ["customerA", "STAGING_CUSTOMER_A_EMAIL", "STAGING_CUSTOMER_A_PASSWORD", "CUSTOMER"],
  ["customerB", "STAGING_CUSTOMER_B_EMAIL", "STAGING_CUSTOMER_B_PASSWORD", "CUSTOMER"],
  ["vendorA", "STAGING_VENDOR_A_EMAIL", "STAGING_VENDOR_A_PASSWORD", "VENDOR"],
  ["vendorB", "STAGING_VENDOR_B_EMAIL", "STAGING_VENDOR_B_PASSWORD", "VENDOR"],
];

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

function assertStaging(values) {
  if (values.STAGING_SUPABASE_PROJECT_REF !== STAGING_REF) {
    throw new Error("Refusing non-staging project ref");
  }
  if (Object.values(values).some((value) => String(value).includes(PRODUCTION_REF))) {
    throw new Error("Refusing production ref in staging config");
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
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
      redirect: options.redirect || "manual",
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(120000),
    });
    jar?.store(response);
    return {
      status: response.status,
      redirected: response.status >= 300 && response.status < 400,
      location: response.headers.get("location") || null,
      error: null,
    };
  } catch (error) {
    return {
      status: 0,
      redirected: false,
      location: null,
      error: error?.name || "RequestError",
    };
  }
}

async function login(test, label, emailKey, passwordKey, expectedRole) {
  const jar = makeCookieJar();
  const response = await request(
    "/api/auth/login",
    {
      method: "POST",
      redirect: "follow",
      body: {
        email: requireValue(test, emailKey),
        password: requireValue(test, passwordKey),
        expectedRole,
      },
    },
    jar,
  );
  return { label, expectedRole, loginStatus: response.status, jar };
}

const staging = readEnvFile(".env.staging.local");
const test = readEnvFile(".env.staging.test.local");
assertStaging(staging);

const identities = [
  { label: "anonymous", expectedRole: null, loginStatus: null, jar: null },
];
identities.push(
  ...(await Promise.all(
    ACCOUNTS.map(([label, emailKey, passwordKey, expectedRole]) =>
      login(test, label, emailKey, passwordKey, expectedRole),
    ),
  )),
);

const results = {};
const identityResults = await Promise.all(
  identities.map(async (identity) => {
    const pageResults = await Promise.all(
      ADMIN_ROUTES.map(async (route) => [route, await request(route, {}, identity.jar)]),
    );
    return [identity.label, {
      expectedRole: identity.expectedRole,
      loginStatus: identity.loginStatus,
      pages: Object.fromEntries(
        pageResults.map(([route, response]) => [
          route,
          {
            status: response.status,
            redirect: response.location
              ? response.location.replace(BASE_URL, "").replace(/^https?:\/\/[^/]+/, "")
              : null,
            error: response.error,
          },
        ]),
      ),
    }];
  }),
);
for (const [label, result] of identityResults) {
  results[label] = result;
}

const adminOk = ADMIN_ROUTES.every((route) => {
  const status = results.admin.pages[route]?.status;
  return status === 200 || status === 307 || status === 308;
});
const anonymousDenied = ADMIN_ROUTES.every((route) => {
  const page = results.anonymous.pages[route];
  return [301, 302, 303, 307, 308, 401].includes(page.status) && String(page.redirect || "").includes("/login");
});
const nonAdminsDenied = ["customerA", "customerB", "vendorA", "vendorB"].every((label) =>
  ADMIN_ROUTES.every((route) => {
    const page = results[label].pages[route];
    return [301, 302, 303, 307, 308, 403].includes(page.status) &&
      (page.status === 403 || String(page.redirect || "").includes("/unauthorized"));
  }),
);

console.log(JSON.stringify({
  targetRef: STAGING_REF,
  adminRoutesChecked: ADMIN_ROUTES,
  summary: { adminOk, anonymousDenied, nonAdminsDenied },
  identities: results,
}, null, 2));

if (!adminOk || !anonymousDenied || !nonAdminsDenied) {
  process.exit(1);
}
