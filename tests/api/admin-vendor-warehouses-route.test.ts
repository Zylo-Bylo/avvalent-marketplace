import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => {
  const prisma: any = {
    vendor: { findUnique: vi.fn() },
    vendorWarehouse: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };
  return {
    prisma,
    requireAdminApiUser: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/admin-auth", () => ({ requireAdminApiUser: mocks.requireAdminApiUser }));

import * as adminVendorWarehousesRoute from "@/app/api/admin/vendors/[id]/warehouses/route";
import * as adminWarehouseRoute from "@/app/api/admin/vendor-warehouses/[warehouseId]/route";

function jsonRequest(path: string, body: Record<string, unknown>, method = "PATCH") {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as NextRequest;
}

function vendorParams(id = "vendor-1") {
  return { params: Promise.resolve({ id }) };
}

function warehouseParams(warehouseId = "warehouse-1") {
  return { params: Promise.resolve({ warehouseId }) };
}

describe("Phase-2 admin vendor warehouse routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminApiUser.mockResolvedValue({
      user: { id: "admin-1", role: "ADMIN" },
      response: null,
    });
    mocks.prisma.vendor.findUnique.mockResolvedValue({ id: "vendor-1" });
    mocks.prisma.vendorWarehouse.findMany.mockResolvedValue([{ id: "warehouse-1" }]);
    mocks.prisma.vendorWarehouse.findUnique.mockResolvedValue({
      id: "warehouse-1",
      vendorId: "vendor-1",
      status: "PENDING",
      isActive: true,
      isDefault: false,
      vendor: { id: "vendor-1", storeName: "Store", user: { id: "user-1" } },
    });
    mocks.prisma.vendorWarehouse.count.mockResolvedValue(2);
    mocks.prisma.vendorWarehouse.update.mockResolvedValue({
      id: "warehouse-1",
      status: "APPROVED",
      isActive: true,
    });
  });

  it("rejects warehouse listing for non-admin callers", async () => {
    mocks.requireAdminApiUser.mockResolvedValue({
      user: null,
      response: Response.json({ error: "Admin access required" }, { status: 403 }),
    });

    const response = await adminVendorWarehousesRoute.GET(
      new Request("http://localhost/api/admin/vendors/vendor-1/warehouses") as NextRequest,
      vendorParams(),
    );

    expect(response.status).toBe(403);
    expect(mocks.prisma.vendorWarehouse.findMany).not.toHaveBeenCalled();
  });

  it("lists vendor warehouses for admins", async () => {
    const response = await adminVendorWarehousesRoute.GET(
      new Request("http://localhost/api/admin/vendors/vendor-1/warehouses") as NextRequest,
      vendorParams(),
    );

    expect(response.status).toBe(200);
    expect(mocks.prisma.vendorWarehouse.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { vendorId: "vendor-1" } }),
    );
  });

  it("approves a warehouse without changing ownership", async () => {
    const response = await adminWarehouseRoute.PATCH(
      jsonRequest("/api/admin/vendor-warehouses/warehouse-1", {
        status: "APPROVED",
        isActive: true,
      }),
      warehouseParams(),
    );

    expect(response.status).toBe(200);
    expect(mocks.prisma.vendorWarehouse.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "warehouse-1" },
        data: expect.objectContaining({ status: "APPROVED", isActive: true }),
      }),
    );
  });

  it("does not let admin deactivate a default warehouse", async () => {
    mocks.prisma.vendorWarehouse.findUnique.mockResolvedValue({
      id: "warehouse-1",
      vendorId: "vendor-1",
      status: "APPROVED",
      isActive: true,
      isDefault: true,
      vendor: { id: "vendor-1", storeName: "Store", user: { id: "user-1" } },
    });

    const response = await adminWarehouseRoute.PATCH(
      jsonRequest("/api/admin/vendor-warehouses/warehouse-1", {
        status: "DEACTIVATED",
        isActive: false,
      }),
      warehouseParams(),
    );

    expect(response.status).toBe(400);
    expect(mocks.prisma.vendorWarehouse.update).not.toHaveBeenCalled();
  });
});
