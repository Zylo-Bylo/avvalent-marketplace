import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => {
  const tx: any = {};
  const prisma: any = {
    user: { findUnique: vi.fn() },
    vendorAddress: { findFirst: vi.fn() },
    vendorWarehouse: {
      count: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn((callback: any) => callback(tx)),
  };
  Object.assign(tx, prisma);
  return {
    prisma,
    getAuthSession: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/session-cookies", () => ({ getAuthSession: mocks.getAuthSession }));

import * as warehousesRoute from "@/app/api/vendor/warehouses/route";
import * as warehouseRoute from "@/app/api/vendor/warehouses/[id]/route";
import * as defaultRoute from "@/app/api/vendor/warehouses/[id]/default/route";

function jsonRequest(path: string, body: Record<string, unknown>, method = "POST") {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as NextRequest;
}

function params(id = "warehouse-1") {
  return { params: Promise.resolve({ id }) };
}

describe("Phase-2 vendor warehouse routes", () => {
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
        kycStatus: "APPROVED",
      },
    });
    mocks.prisma.vendorAddress.findFirst.mockResolvedValue({ id: "address-1" });
    mocks.prisma.vendorWarehouse.count.mockResolvedValue(2);
    mocks.prisma.vendorWarehouse.create.mockResolvedValue({
      id: "warehouse-1",
      vendorId: "vendor-1",
      code: "DEL-NORTH",
      name: "Delhi North",
      isDefault: true,
      isActive: true,
      status: "PENDING",
    });
    mocks.prisma.vendorWarehouse.update.mockResolvedValue({
      id: "warehouse-1",
      vendorId: "vendor-1",
      code: "DEL-NORTH",
      name: "Delhi North",
      isDefault: true,
      isActive: true,
      status: "PENDING",
    });
    mocks.prisma.vendorWarehouse.findFirst.mockResolvedValue({
      id: "warehouse-1",
      vendorId: "vendor-1",
      isDefault: false,
      isActive: true,
    });
  });

  it("lists only the authenticated vendor warehouses", async () => {
    mocks.prisma.vendorWarehouse.findMany.mockResolvedValue([{ id: "warehouse-1" }]);

    const response = await warehousesRoute.GET();

    expect(response.status).toBe(200);
    expect(mocks.prisma.vendorWarehouse.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { vendorId: "vendor-1" } }),
    );
  });

  it("creates a warehouse for the authenticated vendor and clears prior default", async () => {
    const response = await warehousesRoute.POST(
      jsonRequest("/api/vendor/warehouses", {
        vendorId: "other-vendor",
        code: " del north ",
        name: "Delhi North",
        addressId: "address-1",
        isDefault: true,
      }),
    );

    expect(response.status).toBe(201);
    expect(mocks.prisma.vendorWarehouse.updateMany).toHaveBeenCalledWith({
      where: { vendorId: "vendor-1", isDefault: true },
      data: { isDefault: false },
    });
    expect(mocks.prisma.vendorWarehouse.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          vendorId: "vendor-1",
          code: "DEL-NORTH",
          status: "PENDING",
        }),
      }),
    );
  });

  it("denies warehouse updates when ownership does not match", async () => {
    mocks.prisma.vendorWarehouse.findFirst.mockResolvedValue(null);

    const response = await warehouseRoute.PATCH(
      jsonRequest("/api/vendor/warehouses/warehouse-1", { name: "Updated" }, "PATCH"),
      params(),
    );

    expect(response.status).toBe(400);
    expect(mocks.prisma.vendorWarehouse.update).not.toHaveBeenCalled();
  });

  it("sets exactly one default warehouse per vendor", async () => {
    const response = await defaultRoute.POST(
      jsonRequest("/api/vendor/warehouses/warehouse-1/default", {}),
      params(),
    );

    expect(response.status).toBe(200);
    expect(mocks.prisma.vendorWarehouse.updateMany).toHaveBeenCalledWith({
      where: { vendorId: "vendor-1", isDefault: true },
      data: { isDefault: false },
    });
    expect(mocks.prisma.vendorWarehouse.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "warehouse-1" },
        data: { isDefault: true, isActive: true },
      }),
    );
  });

  it("does not deactivate a default warehouse", async () => {
    mocks.prisma.vendorWarehouse.findFirst.mockResolvedValue({
      id: "warehouse-1",
      vendorId: "vendor-1",
      isDefault: true,
      isActive: true,
    });

    const response = await warehouseRoute.DELETE(
      jsonRequest("/api/vendor/warehouses/warehouse-1", {}, "DELETE"),
      params(),
    );

    expect(response.status).toBe(400);
    expect(mocks.prisma.vendorWarehouse.update).not.toHaveBeenCalled();
  });

  it("does not deactivate the only active warehouse", async () => {
    mocks.prisma.vendorWarehouse.count.mockResolvedValue(1);

    const response = await warehouseRoute.DELETE(
      jsonRequest("/api/vendor/warehouses/warehouse-1", {}, "DELETE"),
      params(),
    );

    expect(response.status).toBe(400);
    expect(mocks.prisma.vendorWarehouse.update).not.toHaveBeenCalled();
  });
});
