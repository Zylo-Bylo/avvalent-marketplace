import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => {
  const tx: any = {};
  const prisma: any = {
    user: { findUnique: vi.fn() },
    vendor: { findUnique: vi.fn(), update: vi.fn() },
    vendorContactPerson: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    vendorAddress: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    vendorKycDocument: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    vendorVerificationEvent: { create: vi.fn(), findMany: vi.fn() },
    vendorSuspensionEvent: { create: vi.fn(), findMany: vi.fn() },
    notification: { create: vi.fn() },
    $transaction: vi.fn((callback: any) => callback(tx)),
  };
  Object.assign(tx, prisma);
  return {
    prisma,
    getAuthSession: vi.fn(),
    requireAdminApiUser: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/session-cookies", () => ({ getAuthSession: mocks.getAuthSession }));
vi.mock("@/lib/admin-auth", () => ({ requireAdminApiUser: mocks.requireAdminApiUser }));
vi.mock("@/lib/uploads", () => ({
  getUploadClient: vi.fn(() => null),
  hasUploadProvider: vi.fn(() => false),
  isAllowedUploadType: vi.fn(() => true),
  sanitizeFileName: vi.fn((name: string) => name),
}));

import * as contactsRoute from "@/app/api/vendor/contacts/route";
import * as addressesRoute from "@/app/api/vendor/addresses/route";
import * as kycRoute from "@/app/api/vendor/kyc-documents/route";
import * as adminVerifyRoute from "@/app/api/admin/vendors/[id]/kyc/[documentId]/verify/route";
import * as adminSuspendRoute from "@/app/api/admin/vendors/[id]/suspend/route";

function jsonRequest(path: string, body: Record<string, unknown>, method = "POST") {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as NextRequest;
}

function params<T extends Record<string, string>>(value: T) {
  return { params: Promise.resolve(value) };
}

describe("Phase-1 vendor profile operations routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthSession.mockResolvedValue({ userId: "vendor-user-1", role: "VENDOR" });
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: "vendor-user-1",
      role: "VENDOR",
      vendorProfile: {
        id: "vendor-1",
        userId: "vendor-user-1",
        status: "APPROVED",
        kycStatus: "SUBMITTED",
      },
    });
    mocks.requireAdminApiUser.mockResolvedValue({
      user: { id: "admin-1", role: "ADMIN" },
      response: null,
    });
  });

  it("creates a vendor-owned primary contact and clears previous primary contact", async () => {
    mocks.prisma.vendorContactPerson.create.mockResolvedValue({
      id: "contact-1",
      vendorId: "vendor-1",
      name: "Ops Lead",
      isPrimary: true,
    });

    const response = await contactsRoute.POST(
      jsonRequest("/api/vendor/contacts", {
        vendorId: "other-vendor",
        name: "Ops Lead",
        isPrimary: true,
      }),
    );

    expect(response.status).toBe(201);
    expect(mocks.prisma.vendorContactPerson.updateMany).toHaveBeenCalledWith({
      where: { vendorId: "vendor-1", isPrimary: true },
      data: { isPrimary: false },
    });
    expect(mocks.prisma.vendorContactPerson.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ vendorId: "vendor-1", name: "Ops Lead" }),
      }),
    );
  });

  it("creates one default address per vendor and address type", async () => {
    mocks.prisma.vendorAddress.create.mockResolvedValue({
      id: "address-1",
      vendorId: "vendor-1",
      type: "PICKUP",
      addressLine1: "A-1",
      city: "Delhi",
      state: "Delhi",
      postalCode: "110001",
      isDefault: true,
    });

    const response = await addressesRoute.POST(
      jsonRequest("/api/vendor/addresses", {
        vendorId: "other-vendor",
        type: "PICKUP",
        addressLine1: "A-1",
        city: "Delhi",
        state: "Delhi",
        postalCode: "110001",
        isDefault: true,
      }),
    );

    expect(response.status).toBe(201);
    expect(mocks.prisma.vendorAddress.updateMany).toHaveBeenCalledWith({
      where: { vendorId: "vendor-1", type: "PICKUP", isDefault: true },
      data: { isDefault: false },
    });
    expect(mocks.prisma.vendorAddress.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ vendorId: "vendor-1", type: "PICKUP" }),
      }),
    );
  });

  it("allows vendor KYC metadata submission but never lets vendor set verified status", async () => {
    mocks.prisma.vendorKycDocument.create.mockResolvedValue({
      id: "doc-1",
      vendorId: "vendor-1",
      type: "PAN",
      documentNumberMasked: "PAN-*****1234",
      status: "PENDING",
      storagePath: "private/path",
    });
    mocks.prisma.vendor.update.mockResolvedValue({ id: "vendor-1" });

    const response = await kycRoute.POST(
      jsonRequest("/api/vendor/kyc-documents", {
        vendorId: "other-vendor",
        type: "PAN",
        documentNumber: "ABCDE1234F",
        status: "VERIFIED",
        verifiedById: "vendor-user-1",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(mocks.prisma.vendorKycDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          vendorId: "vendor-1",
          status: "PENDING",
        }),
      }),
    );
    expect(mocks.prisma.vendorKycDocument.create.mock.calls[0][0].data).not.toHaveProperty(
      "verifiedById",
    );
    expect(JSON.stringify(body)).not.toContain("storagePath");
  });

  it("denies admin KYC verification to non-admin callers", async () => {
    mocks.requireAdminApiUser.mockResolvedValue({
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });

    const response = await adminVerifyRoute.POST(
      jsonRequest("/api/admin/vendors/vendor-1/kyc/doc-1/verify", {}),
      params({ id: "vendor-1", documentId: "doc-1" }),
    );

    expect(response.status).toBe(403);
    expect(mocks.prisma.vendorKycDocument.update).not.toHaveBeenCalled();
  });

  it("lets admin verify KYC and creates append-only events", async () => {
    mocks.prisma.vendorKycDocument.findFirst.mockResolvedValue({
      id: "doc-1",
      vendorId: "vendor-1",
      type: "PAN",
      status: "PENDING",
      storagePath: null,
      vendor: { id: "vendor-1", userId: "vendor-user-1" },
    });
    mocks.prisma.vendorKycDocument.update.mockResolvedValue({
      id: "doc-1",
      vendorId: "vendor-1",
      type: "PAN",
      status: "VERIFIED",
    });
    mocks.prisma.vendor.update.mockResolvedValue({ id: "vendor-1", kycStatus: "APPROVED" });
    mocks.prisma.vendorVerificationEvent.create.mockResolvedValue({ id: "event-1" });
    mocks.prisma.notification.create.mockResolvedValue({ id: "note-1" });

    const response = await adminVerifyRoute.POST(
      jsonRequest("/api/admin/vendors/vendor-1/kyc/doc-1/verify", {}),
      params({ id: "vendor-1", documentId: "doc-1" }),
    );

    expect(response.status).toBe(200);
    expect(mocks.prisma.vendorVerificationEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ vendorId: "vendor-1", newStatus: "KYC_DOCUMENT_VERIFIED" }),
      }),
    );
  });

  it("lets admin suspend a vendor and records suspension history", async () => {
    mocks.prisma.vendor.findUnique.mockResolvedValue({
      id: "vendor-1",
      status: "APPROVED",
      userId: "vendor-user-1",
    });
    mocks.prisma.vendor.update.mockResolvedValue({ id: "vendor-1", status: "INACTIVE" });
    mocks.prisma.vendorSuspensionEvent.create.mockResolvedValue({ id: "suspension-1" });
    mocks.prisma.vendorVerificationEvent.create.mockResolvedValue({ id: "event-1" });
    mocks.prisma.notification.create.mockResolvedValue({ id: "note-1" });

    const response = await adminSuspendRoute.POST(
      jsonRequest("/api/admin/vendors/vendor-1/suspend", { reason: "Policy issue" }),
      params({ id: "vendor-1" }),
    );

    expect(response.status).toBe(200);
    expect(mocks.prisma.vendor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "INACTIVE", rejectionReason: "Policy issue" }),
      }),
    );
    expect(mocks.prisma.vendorSuspensionEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "SUSPENDED", reason: "Policy issue" }),
      }),
    );
  });
});
