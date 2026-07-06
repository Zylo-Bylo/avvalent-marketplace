import fs from 'fs';
import crypto from 'crypto';
import Database from 'better-sqlite3';

const DEFAULT_SQLITE_PATH = './dev.db';
const LOCAL_AUTH_PATH = './.local-auth.json';

type LocalRole = 'CUSTOMER' | 'VENDOR' | 'ADMIN';
type LocalVendorStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'INACTIVE';
type LocalKycStatus = 'NOT_SUBMITTED' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

type LocalUserRow = {
  id: string;
  email: string;
};

type LocalUserWithVendorRow = {
  id: string;
  email: string;
  name: string;
  role: LocalRole;
  vendorId: string | null;
  storeName: string | null;
  description: string | null;
  logoUrl: string | null;
  mobile: string | null;
  businessCategory: string | null;
  businessAddress: string | null;
  gstNumber: string | null;
  panNumber: string | null;
  aadhaarNumber: string | null;
  bankDetails: string | null;
  upiId: string | null;
  documentsKyc: string | null;
  metadata?: Record<string, unknown> | null;
  panCardUrl: string | null;
  aadhaarUrl: string | null;
  gstCertificateUrl: string | null;
  bankProofUrl: string | null;
  status: LocalVendorStatus | null;
  kycStatus: LocalKycStatus | null;
  rejectionReason: string | null;
  approvedAt: string | null;
  workingHours: string | null;
  deliveryArea: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type LocalLoginUserRow = {
  id: string;
  email: string;
  name: string;
  role: LocalRole;
  password: string;
  emailVerified: number;
  failedLoginAttempts: number;
  lockedUntil: string | null;
  vendorId: string | null;
  vendorStatus: LocalVendorStatus | null;
  vendorKycStatus: LocalKycStatus | null;
};

type LocalResetTokenRow = {
  id: string;
  tokenHash: string;
  userId: string;
  expiresAt: string;
  usedAt: string | null;
};

type LocalStoredUser = {
  id: string;
  email: string;
  name: string;
  role: LocalRole;
  passwordHash: string;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
};

type LocalStoredVendor = {
  id: string;
  userId: string;
  storeName: string;
  description: string | null;
  logoUrl: string | null;
  mobile: string | null;
  businessCategory: string | null;
  businessAddress: string | null;
  gstNumber: string | null;
  panNumber: string | null;
  aadhaarNumber: string | null;
  bankDetails: string | null;
  upiId: string | null;
  documentsKyc: string | null;
  metadata: Record<string, unknown> | null;
  panCardUrl: string | null;
  aadhaarUrl: string | null;
  gstCertificateUrl: string | null;
  bankProofUrl: string | null;
  status: LocalVendorStatus;
  kycStatus: LocalKycStatus;
  rejectionReason: string | null;
  approvedAt: string | null;
  workingHours: string | null;
  deliveryArea: string | null;
  createdAt: string;
  updatedAt: string;
};

type LocalVendorProfileOverride = Partial<
  Pick<
    LocalStoredVendor,
    | 'storeName'
    | 'description'
    | 'logoUrl'
    | 'mobile'
    | 'businessCategory'
    | 'businessAddress'
    | 'gstNumber'
    | 'panNumber'
    | 'aadhaarNumber'
    | 'bankDetails'
    | 'upiId'
    | 'documentsKyc'
    | 'metadata'
    | 'panCardUrl'
    | 'aadhaarUrl'
    | 'gstCertificateUrl'
    | 'bankProofUrl'
    | 'kycStatus'
    | 'workingHours'
    | 'deliveryArea'
    | 'updatedAt'
  >
> & {
  name?: string;
};

type LocalAuthState = {
  resetTokens: Record<string, LocalResetTokenRow>;
  passwordOverrides: Record<
    string,
    {
      passwordHash: string;
      updatedAt: string;
    }
  >;
  localUsers: Record<string, LocalStoredUser>;
  localVendors: Record<string, LocalStoredVendor>;
  vendorStatusOverrides: Record<
    string,
    {
      status: LocalVendorStatus;
      kycStatus?: LocalKycStatus;
      rejectionReason?: string | null;
      approvedAt?: string | null;
      updatedAt: string;
    }
  >;
  vendorProfileOverrides: Record<string, LocalVendorProfileOverride>;
};

export function shouldUseLocalSqliteAuth() {
  return !process.env.DATABASE_URL || process.env.DATABASE_URL === 'file:./dev.db';
}

function openLocalDatabase() {
  return new Database(DEFAULT_SQLITE_PATH, { fileMustExist: true });
}

function localId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
}

function isoDate() {
  return new Date().toISOString();
}

function nullableString(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

function vendorMetadata(businessCategory: string | null) {
  return {
    business_category: businessCategory,
  };
}

function isPresent<T>(value: T | null | undefined): value is T {
  return Boolean(value);
}

function emptyLocalAuthState(): LocalAuthState {
  return {
    resetTokens: {},
    passwordOverrides: {},
    localUsers: {},
    localVendors: {},
    vendorStatusOverrides: {},
    vendorProfileOverrides: {},
  };
}

function normalizeLocalAuthState(state: Partial<LocalAuthState>): LocalAuthState {
  return {
    resetTokens: state.resetTokens || {},
    passwordOverrides: state.passwordOverrides || {},
    localUsers: state.localUsers || {},
    localVendors: state.localVendors || {},
    vendorStatusOverrides: state.vendorStatusOverrides || {},
    vendorProfileOverrides: state.vendorProfileOverrides || {},
  };
}

function readLocalAuthState() {
  if (!fs.existsSync(LOCAL_AUTH_PATH)) {
    return emptyLocalAuthState();
  }

  try {
    return normalizeLocalAuthState(JSON.parse(fs.readFileSync(LOCAL_AUTH_PATH, 'utf8')));
  } catch {
    return emptyLocalAuthState();
  }
}

function writeLocalAuthState(state: LocalAuthState) {
  fs.writeFileSync(LOCAL_AUTH_PATH, JSON.stringify(normalizeLocalAuthState(state), null, 2));
}

function findStoredUserByEmail(state: LocalAuthState, email: string) {
  const lowerEmail = email.toLowerCase();

  return (
    Object.values(state.localUsers).find((user) => user.email.toLowerCase() === lowerEmail) ||
    null
  );
}

function findStoredVendorByUserId(state: LocalAuthState, userId: string) {
  return Object.values(state.localVendors).find((vendor) => vendor.userId === userId) || null;
}

function applyVendorState(
  row: LocalUserWithVendorRow,
  state: LocalAuthState
): LocalUserWithVendorRow {
  const profileOverride = state.vendorProfileOverrides[row.id] || {};
  const statusOverride = row.vendorId ? state.vendorStatusOverrides[row.vendorId] : null;

  return {
    ...row,
    name: profileOverride.name || row.name,
    storeName: profileOverride.storeName ?? row.storeName,
    description: profileOverride.description ?? row.description,
    logoUrl: profileOverride.logoUrl ?? row.logoUrl,
    mobile: profileOverride.mobile ?? row.mobile,
    businessCategory: profileOverride.businessCategory ?? row.businessCategory,
    businessAddress: profileOverride.businessAddress ?? row.businessAddress,
    gstNumber: profileOverride.gstNumber ?? row.gstNumber,
    panNumber: profileOverride.panNumber ?? row.panNumber,
    aadhaarNumber: profileOverride.aadhaarNumber ?? row.aadhaarNumber,
    bankDetails: profileOverride.bankDetails ?? row.bankDetails,
    upiId: profileOverride.upiId ?? row.upiId,
    documentsKyc: profileOverride.documentsKyc ?? row.documentsKyc,
    metadata: profileOverride.metadata ?? row.metadata,
    panCardUrl: profileOverride.panCardUrl ?? row.panCardUrl,
    aadhaarUrl: profileOverride.aadhaarUrl ?? row.aadhaarUrl,
    gstCertificateUrl: profileOverride.gstCertificateUrl ?? row.gstCertificateUrl,
    bankProofUrl: profileOverride.bankProofUrl ?? row.bankProofUrl,
    status: statusOverride?.status ?? row.status,
    kycStatus: statusOverride?.kycStatus ?? profileOverride.kycStatus ?? row.kycStatus,
    rejectionReason: statusOverride?.rejectionReason ?? row.rejectionReason,
    approvedAt: statusOverride?.approvedAt ?? row.approvedAt,
    workingHours: profileOverride.workingHours ?? row.workingHours,
    deliveryArea: profileOverride.deliveryArea ?? row.deliveryArea,
  };
}

function localVendorToRow(user: LocalStoredUser, vendor: LocalStoredVendor): LocalUserWithVendorRow {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    vendorId: vendor.id,
    storeName: vendor.storeName,
    description: vendor.description,
    logoUrl: vendor.logoUrl,
    mobile: vendor.mobile,
    businessCategory: vendor.businessCategory,
    businessAddress: vendor.businessAddress,
    gstNumber: vendor.gstNumber,
    panNumber: vendor.panNumber,
    aadhaarNumber: vendor.aadhaarNumber,
    bankDetails: vendor.bankDetails,
    upiId: vendor.upiId,
    documentsKyc: vendor.documentsKyc,
    metadata: vendor.metadata,
    panCardUrl: vendor.panCardUrl,
    aadhaarUrl: vendor.aadhaarUrl,
    gstCertificateUrl: vendor.gstCertificateUrl,
    bankProofUrl: vendor.bankProofUrl,
    status: vendor.status,
    kycStatus: vendor.kycStatus,
    rejectionReason: vendor.rejectionReason,
    approvedAt: vendor.approvedAt,
    workingHours: vendor.workingHours,
    deliveryArea: vendor.deliveryArea,
    createdAt: vendor.createdAt,
    updatedAt: vendor.updatedAt,
  };
}

function mapLocalUserWithVendor(row: LocalUserWithVendorRow) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    vendorProfile: row.vendorId
      ? {
          id: row.vendorId,
          storeName: row.storeName || 'Vendor Store',
          description: row.description,
          logoUrl: row.logoUrl,
          mobile: row.mobile,
          businessCategory: row.businessCategory,
          businessAddress: row.businessAddress,
          gstNumber: row.gstNumber,
          panNumber: row.panNumber,
          aadhaarNumber: row.aadhaarNumber,
          bankDetails: row.bankDetails,
          upiId: row.upiId,
          documentsKyc: row.documentsKyc,
          metadata: row.metadata,
          panCardUrl: row.panCardUrl,
          aadhaarUrl: row.aadhaarUrl,
          gstCertificateUrl: row.gstCertificateUrl,
          bankProofUrl: row.bankProofUrl,
          status: row.status || 'PENDING',
          kycStatus: row.kycStatus || 'NOT_SUBMITTED',
          rejectionReason: row.rejectionReason,
          approvedAt: row.approvedAt,
          workingHours: row.workingHours,
          deliveryArea: row.deliveryArea,
        }
      : null,
  };
}

function mapAdminVendor(
  row: Record<string, unknown>,
  state: LocalAuthState
) {
  const userId = String(row.userId || '');
  const vendorId = String(row.id || '');
  const profileOverride = state.vendorProfileOverrides[userId] || {};
  const statusOverride = state.vendorStatusOverrides[vendorId];

  return {
    ...row,
    storeName: profileOverride.storeName ?? row.storeName,
    description: profileOverride.description ?? row.description,
    logoUrl: profileOverride.logoUrl ?? row.logoUrl,
    mobile: profileOverride.mobile ?? row.mobile,
    businessCategory: profileOverride.businessCategory ?? row.businessCategory,
    businessAddress: profileOverride.businessAddress ?? row.businessAddress,
    gstNumber: profileOverride.gstNumber ?? row.gstNumber,
    panNumber: profileOverride.panNumber ?? row.panNumber,
    aadhaarNumber: profileOverride.aadhaarNumber ?? row.aadhaarNumber,
    bankDetails: profileOverride.bankDetails ?? row.bankDetails,
    upiId: profileOverride.upiId ?? row.upiId,
    documentsKyc: profileOverride.documentsKyc ?? row.documentsKyc,
    metadata: profileOverride.metadata ?? row.metadata,
    panCardUrl: profileOverride.panCardUrl ?? row.panCardUrl,
    aadhaarUrl: profileOverride.aadhaarUrl ?? row.aadhaarUrl,
    gstCertificateUrl: profileOverride.gstCertificateUrl ?? row.gstCertificateUrl,
    bankProofUrl: profileOverride.bankProofUrl ?? row.bankProofUrl,
    status: statusOverride?.status ?? row.status,
    kycStatus: statusOverride?.kycStatus ?? profileOverride.kycStatus ?? row.kycStatus,
    rejectionReason: statusOverride?.rejectionReason ?? row.rejectionReason,
    approvedAt: statusOverride?.approvedAt ?? row.approvedAt,
    workingHours: profileOverride.workingHours ?? row.workingHours,
    deliveryArea: profileOverride.deliveryArea ?? row.deliveryArea,
    user: {
      id: row.userId,
      name: profileOverride.name ?? row.userName,
      email: row.userEmail,
      emailVerified: Boolean(row.userEmailVerified),
      createdAt: row.userCreatedAt,
    },
    _count: {
      products: Number(row.productCount || 0),
      orders: Number(row.orderCount || 0),
    },
  };
}

function mapLocalStoredVendorForAdmin(
  user: LocalStoredUser,
  vendor: LocalStoredVendor,
  state: LocalAuthState
) {
  const row = {
    ...vendor,
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    userEmailVerified: user.emailVerified,
    userCreatedAt: user.createdAt,
    productCount: 0,
    orderCount: 0,
  };

  return mapAdminVendor(row, state);
}

export function findLocalUserByEmail(email: string) {
  const state = readLocalAuthState();
  const storedUser = findStoredUserByEmail(state, email);

  if (storedUser) {
    return { id: storedUser.id, email: storedUser.email } satisfies LocalUserRow;
  }

  const database = openLocalDatabase();

  try {
    return database
      .prepare('SELECT id, email FROM User WHERE lower(email) = lower(?) LIMIT 1')
      .get(email) as LocalUserRow | undefined;
  } finally {
    database.close();
  }
}

export function findLocalLoginUserByEmail(email: string) {
  const state = readLocalAuthState();
  const storedUser = findStoredUserByEmail(state, email);

  if (storedUser) {
    const vendor = findStoredVendorByUserId(state, storedUser.id);

    return {
      id: storedUser.id,
      email: storedUser.email,
      name: storedUser.name,
      role: storedUser.role,
      password: state.passwordOverrides[storedUser.id]?.passwordHash || storedUser.passwordHash,
      emailVerified: storedUser.emailVerified,
      failedLoginAttempts: 0,
      lockedUntil: null,
      vendorProfile: vendor
        ? {
            status: state.vendorStatusOverrides[vendor.id]?.status || vendor.status,
            kycStatus:
              state.vendorStatusOverrides[vendor.id]?.kycStatus ||
              state.vendorProfileOverrides[storedUser.id]?.kycStatus ||
              vendor.kycStatus,
          }
        : null,
    };
  }

  const database = openLocalDatabase();

  try {
    const row = database
      .prepare(
        `SELECT
          u.id,
          u.email,
          u.name,
          u.role,
          u.password,
          u.emailVerified,
          u.failedLoginAttempts,
          u.lockedUntil,
          v.id as vendorId,
          v.status as vendorStatus,
          v.kycStatus as vendorKycStatus
        FROM User u
        LEFT JOIN Vendor v ON v.userId = u.id
        WHERE lower(u.email) = lower(?)
        LIMIT 1`
      )
      .get(email) as LocalLoginUserRow | undefined;

    if (!row) {
      return null;
    }

    const statusOverride = row.vendorId ? state.vendorStatusOverrides[row.vendorId] : null;

    return {
      id: row.id,
      email: row.email,
      name: state.vendorProfileOverrides[row.id]?.name || row.name,
      role: row.role,
      password: state.passwordOverrides[row.id]?.passwordHash || row.password,
      emailVerified: Boolean(row.emailVerified),
      failedLoginAttempts: row.failedLoginAttempts,
      lockedUntil: row.lockedUntil ? new Date(row.lockedUntil) : null,
      vendorProfile: row.vendorId
        ? {
            status: statusOverride?.status || row.vendorStatus,
            kycStatus:
              statusOverride?.kycStatus ||
              state.vendorProfileOverrides[row.id]?.kycStatus ||
              row.vendorKycStatus,
          }
        : null,
    };
  } finally {
    database.close();
  }
}

export function getLocalUserRole(userId: string) {
  const state = readLocalAuthState();
  const storedUser = state.localUsers[userId];

  if (storedUser) {
    return storedUser.role;
  }

  const database = openLocalDatabase();

  try {
    const row = database
      .prepare('SELECT role FROM User WHERE id = ? LIMIT 1')
      .get(userId) as { role: LocalRole } | undefined;

    return row?.role || null;
  } finally {
    database.close();
  }
}

export function createLocalCustomer(input: {
  email: string;
  name: string;
  passwordHash: string;
  emailOtpHash: string;
  emailOtpExpiresAt: Date;
}) {
  const state = readLocalAuthState();
  const id = localId('user');
  const now = isoDate();

  state.localUsers[id] = {
    id,
    email: input.email,
    name: input.name,
    role: 'CUSTOMER',
    passwordHash: input.passwordHash,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  };

  writeLocalAuthState(state);

  return {
    id,
    email: input.email,
    name: input.name,
    role: 'CUSTOMER' as const,
  };
}

export function createLocalVendorAccount(input: {
  email: string;
  name: string;
  passwordHash: string;
  storeName: string;
  description?: string;
  mobile?: string;
  businessCategory?: string;
  businessAddress?: string;
  gstNumber?: string;
  panNumber?: string;
  aadhaarNumber?: string;
  bankDetails?: string;
  upiId?: string;
  panCardUrl?: string;
  aadhaarUrl?: string;
  gstCertificateUrl?: string;
  bankProofUrl?: string;
  metadata?: Record<string, unknown>;
}) {
  const state = readLocalAuthState();
  const now = isoDate();
  const userId = localId('user');
  const vendorId = localId('vendor');
  const hasKycDocuments = Boolean(
    input.panCardUrl || input.aadhaarUrl || input.gstCertificateUrl || input.bankProofUrl
  );

  state.localUsers[userId] = {
    id: userId,
    email: input.email,
    name: input.name,
    role: 'VENDOR',
    passwordHash: input.passwordHash,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  };

  state.localVendors[vendorId] = {
    id: vendorId,
    userId,
    storeName: input.storeName,
    description: nullableString(input.description),
    logoUrl: null,
    mobile: nullableString(input.mobile),
    businessCategory: nullableString(input.businessCategory),
    businessAddress: nullableString(input.businessAddress),
    gstNumber: nullableString(input.gstNumber),
    panNumber: nullableString(input.panNumber),
    aadhaarNumber: nullableString(input.aadhaarNumber),
    bankDetails: nullableString(input.bankDetails),
    upiId: nullableString(input.upiId),
    documentsKyc:
      [input.panCardUrl, input.aadhaarUrl, input.gstCertificateUrl, input.bankProofUrl]
        .map(nullableString)
        .filter(Boolean)
        .join('\n') || null,
    metadata: {
      ...vendorMetadata(nullableString(input.businessCategory)),
      ...(input.metadata || {}),
    },
    panCardUrl: nullableString(input.panCardUrl),
    aadhaarUrl: nullableString(input.aadhaarUrl),
    gstCertificateUrl: nullableString(input.gstCertificateUrl),
    bankProofUrl: nullableString(input.bankProofUrl),
    status: 'PENDING',
    kycStatus: hasKycDocuments ? 'SUBMITTED' : 'NOT_SUBMITTED',
    rejectionReason: null,
    approvedAt: null,
    workingHours: null,
    deliveryArea: null,
    createdAt: now,
    updatedAt: now,
  };

  writeLocalAuthState(state);

  return {
    id: userId,
    email: input.email,
    name: input.name,
    role: 'VENDOR' as const,
    vendorProfile: state.localVendors[vendorId],
  };
}

export function updateLocalVendorStatus(input: {
  vendorId: string;
  status: LocalVendorStatus;
  kycStatus?: LocalKycStatus;
  rejectionReason?: string;
}) {
  const state = readLocalAuthState();
  const now = isoDate();
  const nextKycStatus =
    input.kycStatus ||
    (input.status === 'APPROVED'
      ? 'APPROVED'
      : input.status === 'REJECTED'
        ? 'REJECTED'
        : undefined);

  state.vendorStatusOverrides[input.vendorId] = {
    status: input.status,
    ...(nextKycStatus && { kycStatus: nextKycStatus }),
    rejectionReason:
      input.status === 'REJECTED' ? input.rejectionReason || 'Rejected by admin' : null,
    approvedAt: input.status === 'APPROVED' ? now : null,
    updatedAt: now,
  };

  if (state.localVendors[input.vendorId]) {
    state.localVendors[input.vendorId] = {
      ...state.localVendors[input.vendorId],
      status: input.status,
      kycStatus: nextKycStatus || state.localVendors[input.vendorId].kycStatus,
      rejectionReason:
        input.status === 'REJECTED' ? input.rejectionReason || 'Rejected by admin' : null,
      approvedAt: input.status === 'APPROVED' ? now : null,
      updatedAt: now,
    };
  }

  writeLocalAuthState(state);

  return findLocalVendorForAdmin(input.vendorId);
}

export function findLocalVendorForAdmin(vendorId: string) {
  const state = readLocalAuthState();
  const localVendor = state.localVendors[vendorId];

  if (localVendor) {
    const user = state.localUsers[localVendor.userId];
    return user ? mapLocalStoredVendorForAdmin(user, localVendor, state) : null;
  }

  const database = openLocalDatabase();

  try {
    const row = database
      .prepare(
        `SELECT
          v.*,
          u.id as userId,
          u.name as userName,
          u.email as userEmail,
          u.emailVerified as userEmailVerified,
          u.createdAt as userCreatedAt,
          (SELECT count(*) FROM Product p WHERE p.vendorId = v.id) as productCount,
          (SELECT count(*) FROM "Order" o WHERE o.vendorId = v.id) as orderCount
        FROM Vendor v
        JOIN User u ON u.id = v.userId
        WHERE v.id = ?
        LIMIT 1`
      )
      .get(vendorId) as Record<string, unknown> | undefined;

    return row ? mapAdminVendor(row, state) : null;
  } finally {
    database.close();
  }
}

export function listLocalVendorsForAdmin() {
  const state = readLocalAuthState();
  const database = openLocalDatabase();

  try {
    const rows = database
      .prepare(
        `SELECT
          v.*,
          u.id as userId,
          u.name as userName,
          u.email as userEmail,
          u.emailVerified as userEmailVerified,
          u.createdAt as userCreatedAt,
          (SELECT count(*) FROM Product p WHERE p.vendorId = v.id) as productCount,
          (SELECT count(*) FROM "Order" o WHERE o.vendorId = v.id) as orderCount
        FROM Vendor v
        JOIN User u ON u.id = v.userId
        ORDER BY v.createdAt DESC`
      )
      .all() as Record<string, unknown>[];

    const databaseVendors = rows.map((row) => mapAdminVendor(row, state));
    const localVendors = Object.values(state.localVendors)
      .map((vendor) => {
        const user = state.localUsers[vendor.userId];
        return user ? mapLocalStoredVendorForAdmin(user, vendor, state) : null;
      })
      .filter(isPresent);

    return [...localVendors, ...databaseVendors];
  } finally {
    database.close();
  }
}

export function getLocalVendorUser(userId: string) {
  const state = readLocalAuthState();
  const storedUser = state.localUsers[userId];

  if (storedUser) {
    const storedVendor = findStoredVendorByUserId(state, userId);

    if (!storedVendor) {
      return {
        id: storedUser.id,
        email: storedUser.email,
        name: storedUser.name,
        role: storedUser.role,
        vendorProfile: null,
      };
    }

    return mapLocalUserWithVendor(applyVendorState(localVendorToRow(storedUser, storedVendor), state));
  }

  const database = openLocalDatabase();

  try {
    const row = database
      .prepare(
        `SELECT
          u.id,
          u.email,
          u.name,
          u.role,
          v.id as vendorId,
          v.storeName,
          v.description,
          v.logoUrl,
          v.mobile,
          v.businessCategory,
          v.businessAddress,
          v.gstNumber,
          v.panNumber,
          v.aadhaarNumber,
          v.bankDetails,
          v.upiId,
          v.documentsKyc,
          NULL as metadata,
          v.panCardUrl,
          v.aadhaarUrl,
          v.gstCertificateUrl,
          v.bankProofUrl,
          v.status,
          v.kycStatus,
          v.rejectionReason,
          v.approvedAt,
          v.workingHours,
          v.deliveryArea
        FROM User u
        LEFT JOIN Vendor v ON v.userId = u.id
        WHERE u.id = ?
        LIMIT 1`
      )
      .get(userId) as LocalUserWithVendorRow | undefined;

    return row ? mapLocalUserWithVendor(applyVendorState(row, state)) : null;
  } finally {
    database.close();
  }
}

export function updateLocalVendorProfile(userId: string, body: Record<string, unknown>) {
  const state = readLocalAuthState();
  const user = getLocalVendorUser(userId);

  if (!user || user.role !== 'VENDOR' || !user.vendorProfile) {
    return null;
  }

  const hasKycDocument = Boolean(
    body.panCardUrl ||
      body.aadhaarUrl ||
      body.gstCertificateUrl ||
      body.bankProofUrl ||
      body.documentsKyc
  );

  const existingOverride = state.vendorProfileOverrides[userId] || {};
  const existingMetadata =
    (existingOverride.metadata as Record<string, unknown> | undefined) ||
    (user.vendorProfile.metadata as Record<string, unknown> | undefined) ||
    {};
  const name = nullableString(body.name);
  const nextOverride: LocalVendorProfileOverride = {
    ...existingOverride,
    ...(name && { name }),
    storeName: nullableString(body.storeName) || 'Vendor Store',
    description: nullableString(body.description),
    logoUrl: nullableString(body.logoUrl),
    mobile: nullableString(body.mobile),
    businessCategory: nullableString(body.businessCategory),
    businessAddress: nullableString(body.businessAddress),
    gstNumber: nullableString(body.gstNumber),
    panNumber: nullableString(body.panNumber),
    aadhaarNumber: nullableString(body.aadhaarNumber),
    bankDetails: nullableString(body.bankDetails),
    upiId: nullableString(body.upiId),
    documentsKyc: nullableString(body.documentsKyc),
    metadata: {
      ...existingMetadata,
      ...vendorMetadata(nullableString(body.businessCategory)),
    },
    panCardUrl: nullableString(body.panCardUrl),
    aadhaarUrl: nullableString(body.aadhaarUrl),
    gstCertificateUrl: nullableString(body.gstCertificateUrl),
    bankProofUrl: nullableString(body.bankProofUrl),
    ...(hasKycDocument && { kycStatus: 'SUBMITTED' as const }),
    workingHours: nullableString(body.workingHours),
    deliveryArea: nullableString(body.deliveryArea),
    updatedAt: isoDate(),
  };

  state.vendorProfileOverrides[userId] = nextOverride;

  if (state.localUsers[userId] && name) {
    state.localUsers[userId] = {
      ...state.localUsers[userId],
      name,
      updatedAt: isoDate(),
    };
  }

  if (state.localVendors[user.vendorProfile.id]) {
    state.localVendors[user.vendorProfile.id] = {
      ...state.localVendors[user.vendorProfile.id],
      ...nextOverride,
      name: undefined,
      storeName: nextOverride.storeName || state.localVendors[user.vendorProfile.id].storeName,
      kycStatus:
        nextOverride.kycStatus || state.localVendors[user.vendorProfile.id].kycStatus,
      updatedAt: isoDate(),
    } as LocalStoredVendor;
  }

  writeLocalAuthState(state);

  return getLocalVendorUser(userId);
}

export function updateLocalVendorAgreement(
  userId: string,
  metadata: Record<string, unknown>
) {
  const state = readLocalAuthState();
  const user = getLocalVendorUser(userId);

  if (!user || user.role !== 'VENDOR' || !user.vendorProfile?.id) {
    return null;
  }

  const existingOverride = state.vendorProfileOverrides[userId] || {};
  const existingMetadata =
    (existingOverride.metadata as Record<string, unknown> | undefined) ||
    (user.vendorProfile.metadata as Record<string, unknown> | undefined) ||
    {};

  const nextMetadata = {
    ...existingMetadata,
    ...metadata,
  };

  state.vendorProfileOverrides[userId] = {
    ...existingOverride,
    metadata: nextMetadata,
    updatedAt: isoDate(),
  };

  if (state.localVendors[user.vendorProfile.id]) {
    state.localVendors[user.vendorProfile.id] = {
      ...state.localVendors[user.vendorProfile.id],
      metadata: nextMetadata,
      updatedAt: isoDate(),
    };
  }

  writeLocalAuthState(state);

  return getLocalVendorUser(userId);
}

export function createLocalPasswordResetToken(input: {
  tokenHash: string;
  userId: string;
  expiresAt: Date;
}) {
  const state = readLocalAuthState();
  const id = `reset_${crypto.randomUUID().replace(/-/g, '')}`;

  state.resetTokens[input.tokenHash] = {
    id,
    tokenHash: input.tokenHash,
    userId: input.userId,
    expiresAt: input.expiresAt.toISOString(),
    usedAt: null,
  };

  writeLocalAuthState(state);
}

export function findLocalPasswordResetToken(tokenHash: string) {
  return readLocalAuthState().resetTokens[tokenHash];
}

export function resetLocalPassword(input: {
  userId: string;
  tokenId: string;
  passwordHash: string;
}) {
  const state = readLocalAuthState();
  const token = Object.values(state.resetTokens).find(
    (item) => item.id === input.tokenId
  );

  if (token) {
    token.usedAt = new Date().toISOString();
  }

  state.passwordOverrides[input.userId] = {
    passwordHash: input.passwordHash,
    updatedAt: new Date().toISOString(),
  };

  if (state.localUsers[input.userId]) {
    state.localUsers[input.userId] = {
      ...state.localUsers[input.userId],
      passwordHash: input.passwordHash,
      updatedAt: new Date().toISOString(),
    };
  }

  writeLocalAuthState(state);
}

export function getLocalPasswordHash(userId: string) {
  return readLocalAuthState().passwordOverrides[userId]?.passwordHash;
}
