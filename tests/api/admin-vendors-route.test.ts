import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => {
  const prisma = {
    user: {
      findUnique: vi.fn(),
    },
    vendor: {
      count: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  };

  return {
    cookies: vi.fn(),
    verifyToken: vi.fn(),
    shouldUseLocalSqliteAuth: vi.fn(),
    getLocalUserRole: vi.fn(),
    listLocalVendorsForAdmin: vi.fn(),
    updateLocalVendorStatus: vi.fn(),
    sendVendorStatusEmail: vi.fn(),
    requireAdminApiUser: vi.fn(),
    prisma,
  };
});

vi.mock("next/headers", () => ({
  cookies: mocks.cookies,
}));

vi.mock("@/lib/auth", () => ({
  verifyToken: mocks.verifyToken,
}));

vi.mock("@/lib/admin-auth", () => ({
  requireAdminApiUser: mocks.requireAdminApiUser,
}));

vi.mock("@/lib/local-sqlite-auth", () => ({
  getLocalUserRole: mocks.getLocalUserRole,
  listLocalVendorsForAdmin: mocks.listLocalVendorsForAdmin,
  shouldUseLocalSqliteAuth: mocks.shouldUseLocalSqliteAuth,
  updateLocalVendorStatus: mocks.updateLocalVendorStatus,
}));

vi.mock("@/lib/email", () => ({
  sendVendorStatusEmail: mocks.sendVendorStatusEmail,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

import { GET } from "@/app/api/admin/vendors/route";
import { PATCH } from "@/app/api/admin/vendors/[id]/route";

function setAuthToken(token?: string) {
  mocks.cookies.mockResolvedValue({
    get: vi.fn(() => (token ? { value: token } : undefined)),
  });
}

function patchRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/admin/vendors/vendor-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as NextRequest;
}

function params(id = "vendor-1") {
  return { params: Promise.resolve({ id }) };
}

const approvedVendor = {
  id: "vendor-1",
  storeName: "Approved Store",
  status: "APPROVED",
  kycStatus: "APPROVED",
  rejectionReason: null,
  user: {
    id: "user-1",
    name: "Vendor",
    email: "vendor@example.com",
    emailVerified: true,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
  },
  _count: {
    products: 3,
    orders: 2,
  },
};

describe("admin vendors API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAuthToken("admin-token");
    mocks.verifyToken.mockReturnValue({ userId: "admin-1", role: "ADMIN" });
    mocks.shouldUseLocalSqliteAuth.mockReturnValue(false);
    mocks.prisma.user.findUnique.mockResolvedValue({ role: "ADMIN" });
    mocks.sendVendorStatusEmail.mockResolvedValue(undefined);
    mocks.requireAdminApiUser.mockResolvedValue({
      user: { id: "admin-1", role: "ADMIN" },
      response: null,
    });
  });

  it("rejects vendor listing for non-admin users", async () => {
    mocks.requireAdminApiUser.mockResolvedValue({
      user: null,
      response: Response.json({ error: "Admin access required" }, { status: 403 }),
    });

    const response = await GET(
      new Request("http://localhost/api/admin/vendors") as NextRequest,
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Admin access required",
    });
    expect(mocks.prisma.vendor.findMany).not.toHaveBeenCalled();
  });

  it("lists vendors with pagination for admins", async () => {
    mocks.prisma.vendor.findMany.mockResolvedValue([approvedVendor]);
    mocks.prisma.vendor.count.mockResolvedValue(12);

    const response = await GET(
      new Request("http://localhost/api/admin/vendors?limit=5&offset=5") as NextRequest,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      vendors: [
        {
          ...approvedVendor,
          user: {
            ...approvedVendor.user,
            createdAt: "2026-07-01T00:00:00.000Z",
          },
        },
      ],
      total: 12,
      hasMore: true,
    });
    expect(mocks.prisma.vendor.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 5,
        skip: 5,
        orderBy: { createdAt: "desc" },
      }),
    );
  });

  it("rejects status updates for non-admin users", async () => {
    mocks.requireAdminApiUser.mockResolvedValue({
      user: null,
      response: Response.json({ error: "Admin access required" }, { status: 403 }),
    });

    const response = await PATCH(patchRequest({ status: "APPROVED" }), params());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Admin access required",
    });
    expect(mocks.prisma.vendor.update).not.toHaveBeenCalled();
  });

  it("rejects invalid vendor status values", async () => {
    const response = await PATCH(patchRequest({ status: "SUSPENDED" }), params());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid vendor status",
    });
    expect(mocks.prisma.vendor.update).not.toHaveBeenCalled();
  });

  it("approves a vendor and marks KYC approved", async () => {
    mocks.prisma.vendor.update.mockResolvedValue(approvedVendor);

    const response = await PATCH(patchRequest({ status: "APPROVED" }), params());

    expect(response.status).toBe(200);
    expect(mocks.prisma.vendor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "vendor-1" },
        data: expect.objectContaining({
          status: "APPROVED",
          kycStatus: "APPROVED",
          rejectionReason: null,
          approvedAt: expect.any(Date),
        }),
      }),
    );
    expect(mocks.sendVendorStatusEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "vendor@example.com",
        storeName: "Approved Store",
        status: "APPROVED",
      }),
    );
  });

  it("rejects a vendor with a default reason and KYC rejected", async () => {
    mocks.prisma.vendor.update.mockResolvedValue({
      ...approvedVendor,
      status: "REJECTED",
      kycStatus: "REJECTED",
      rejectionReason: "Rejected by admin",
    });

    const response = await PATCH(patchRequest({ status: "REJECTED" }), params());

    expect(response.status).toBe(200);
    expect(mocks.prisma.vendor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "REJECTED",
          kycStatus: "REJECTED",
          rejectionReason: "Rejected by admin",
          approvedAt: null,
        }),
      }),
    );
  });

  it("marks a vendor inactive without overwriting KYC status", async () => {
    mocks.prisma.vendor.update.mockResolvedValue({
      ...approvedVendor,
      status: "INACTIVE",
      kycStatus: "APPROVED",
    });

    const response = await PATCH(patchRequest({ status: "INACTIVE" }), params());

    expect(response.status).toBe(200);
    expect(mocks.prisma.vendor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({
          kycStatus: expect.any(String),
        }),
      }),
    );
    expect(mocks.prisma.vendor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "INACTIVE",
          rejectionReason: null,
          approvedAt: null,
        }),
      }),
    );
  });

  it("returns 404 when the vendor no longer exists", async () => {
    mocks.prisma.vendor.update.mockRejectedValue({ code: "P2025" });

    const response = await PATCH(patchRequest({ status: "APPROVED" }), params("missing"));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Vendor not found",
    });
    expect(mocks.sendVendorStatusEmail).not.toHaveBeenCalled();
  });
});
