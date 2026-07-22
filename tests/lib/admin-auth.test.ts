import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  getLocalUserRole: vi.fn(),
  shouldUseLocalSqliteAuth: vi.fn(),
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

vi.mock("@/lib/session-cookies", () => ({
  getAuthSession: mocks.getAuthSession,
}));

vi.mock("@/lib/local-sqlite-auth", () => ({
  getLocalUserRole: mocks.getLocalUserRole,
  shouldUseLocalSqliteAuth: mocks.shouldUseLocalSqliteAuth,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

import { getAdminAuthState, requireAdminApiUser } from "@/lib/admin-auth";

function session(userId = "app-admin-1") {
  return { token: "redacted-token", userId, role: "ADMIN" };
}

describe("protected admin auth mapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.shouldUseLocalSqliteAuth.mockReturnValue(false);
    mocks.getAuthSession.mockResolvedValue(session());
    mocks.prisma.$queryRaw.mockResolvedValue([
      {
        user_id: "auth-admin-1",
        app_role: "ADMIN",
        protected_role: "ADMIN",
      },
    ]);
  });

  it("returns 401 for missing sessions", async () => {
    mocks.getAuthSession.mockResolvedValue(null);

    const auth = await requireAdminApiUser();

    expect(auth.user).toBeNull();
    expect(auth.response?.status).toBe(401);
  });

  it("authorizes only a mapped admin with protected Auth metadata and app role ADMIN", async () => {
    const state = await getAdminAuthState();

    expect(state).toEqual({
      status: "authorized",
      user: { id: "auth-admin-1", role: "ADMIN" },
    });
    expect(mocks.prisma.$queryRaw).toHaveBeenCalled();
  });

  it("fails closed when AuthIdentityMapping is missing", async () => {
    mocks.prisma.$queryRaw.mockRejectedValue({ code: "42P01" });

    const auth = await requireAdminApiUser();

    expect(auth.user).toBeNull();
    expect(auth.response?.status).toBe(403);
  });

  it("denies app_metadata ADMIN without a trusted mapping row", async () => {
    mocks.prisma.$queryRaw.mockResolvedValue([]);

    const auth = await requireAdminApiUser();

    expect(auth.user).toBeNull();
    expect(auth.response?.status).toBe(403);
  });

  it("denies app User ADMIN without protected Auth metadata ADMIN", async () => {
    mocks.prisma.$queryRaw.mockResolvedValue([
      {
        user_id: "auth-admin-1",
        app_role: "ADMIN",
        protected_role: null,
      },
    ]);

    const auth = await requireAdminApiUser();

    expect(auth.user).toBeNull();
    expect(auth.response?.status).toBe(403);
  });

  it("denies protected Auth ADMIN when the mapped app User is not ADMIN", async () => {
    mocks.prisma.$queryRaw.mockResolvedValue([
      {
        user_id: "auth-admin-1",
        app_role: "CUSTOMER",
        protected_role: "ADMIN",
      },
    ]);

    const auth = await requireAdminApiUser();

    expect(auth.user).toBeNull();
    expect(auth.response?.status).toBe(403);
  });
});
