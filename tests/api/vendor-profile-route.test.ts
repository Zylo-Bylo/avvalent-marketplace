import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => {
  const prisma = {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    vendor: {
      update: vi.fn(),
    },
    $transaction: vi.fn((operations: unknown[]) => Promise.all(operations)),
  };

  return {
    cookies: vi.fn(),
    verifyToken: vi.fn(),
    shouldUseLocalSqliteAuth: vi.fn(),
    getLocalVendorUser: vi.fn(),
    updateLocalVendorProfile: vi.fn(),
    prisma,
  };
});

vi.mock("next/headers", () => ({
  cookies: mocks.cookies,
}));

vi.mock("@/lib/auth", () => ({
  verifyToken: mocks.verifyToken,
}));

vi.mock("@/lib/local-sqlite-auth", () => ({
  getLocalVendorUser: mocks.getLocalVendorUser,
  shouldUseLocalSqliteAuth: mocks.shouldUseLocalSqliteAuth,
  updateLocalVendorProfile: mocks.updateLocalVendorProfile,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

import { GET, PUT } from "@/app/api/vendor/profile/route";

function setAuthToken(token?: string) {
  mocks.cookies.mockResolvedValue({
    get: vi.fn(() => (token ? { value: token } : undefined)),
  });
}

function putRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/vendor/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as NextRequest;
}

describe("vendor profile API route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.shouldUseLocalSqliteAuth.mockReturnValue(false);
    mocks.verifyToken.mockReturnValue({ userId: "vendor-user-1", role: "VENDOR" });
    setAuthToken("auth-token");
  });

  it("rejects unauthenticated requests", async () => {
    setAuthToken(undefined);

    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("rejects authenticated non-vendor users", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: "customer-1",
      role: "CUSTOMER",
      vendorProfile: null,
    });

    const response = await GET();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Not a vendor" });
  });

  it("returns the current vendor profile", async () => {
    const user = {
      id: "vendor-user-1",
      email: "vendor@example.com",
      name: "Vendor",
      role: "VENDOR",
      vendorProfile: {
        id: "vendor-profile-1",
        storeName: "Vendor Store",
        kycStatus: "NOT_SUBMITTED",
      },
    };
    mocks.prisma.user.findUnique.mockResolvedValue(user);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ user });
    expect(mocks.prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "vendor-user-1" },
      }),
    );
  });

  it("normalizes blank profile fields to null and preserves non-blank values", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: "vendor-user-1",
      role: "VENDOR",
      vendorProfile: {
        id: "vendor-profile-1",
        metadata: { existing: true },
      },
    });
    mocks.prisma.user.update.mockResolvedValue({
      id: "vendor-user-1",
      email: "vendor@example.com",
      name: "Vendor Name",
      role: "VENDOR",
    });
    mocks.prisma.vendor.update.mockResolvedValue({
      id: "vendor-profile-1",
      storeName: "Updated Store",
      description: null,
      panCardUrl: "https://files.example/pan.pdf",
      kycStatus: "SUBMITTED",
    });

    const response = await PUT(
      putRequest({
        name: "  Vendor Name  ",
        storeName: "  Updated Store  ",
        description: "   ",
        businessCategory: "  Electronics  ",
        panCardUrl: "  https://files.example/pan.pdf  ",
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.prisma.vendor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "vendor-profile-1" },
        data: expect.objectContaining({
          storeName: "Updated Store",
          description: null,
          businessCategory: "Electronics",
          metadata: { existing: true, business_category: "Electronics" },
          panCardUrl: "https://files.example/pan.pdf",
          kycStatus: "SUBMITTED",
        }),
      }),
    );
  });

  it("does not mark KYC submitted for whitespace-only document fields", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: "vendor-user-1",
      role: "VENDOR",
      vendorProfile: {
        id: "vendor-profile-1",
        metadata: null,
      },
    });
    mocks.prisma.user.update.mockResolvedValue({
      id: "vendor-user-1",
      email: "vendor@example.com",
      name: "Vendor",
      role: "VENDOR",
    });
    mocks.prisma.vendor.update.mockResolvedValue({
      id: "vendor-profile-1",
      storeName: "Vendor Store",
      documentsKyc: null,
      panCardUrl: null,
      kycStatus: "NOT_SUBMITTED",
    });

    const response = await PUT(
      putRequest({
        storeName: "",
        documentsKyc: "   ",
        panCardUrl: "   ",
        aadhaarUrl: "",
        gstCertificateUrl: "",
        bankProofUrl: "",
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.prisma.vendor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          storeName: "Vendor Store",
          documentsKyc: null,
          panCardUrl: null,
          aadhaarUrl: null,
          gstCertificateUrl: null,
          bankProofUrl: null,
          kycStatus: undefined,
        }),
      }),
    );
  });
});
