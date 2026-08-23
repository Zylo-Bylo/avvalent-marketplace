import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  prisma: {
    user: { findUnique: vi.fn() },
    product: { findFirst: vi.fn() },
    $queryRaw: vi.fn(),
  },
  adjustProductStock: vi.fn(),
  getVendorInventoryData: vi.fn(),
  updateInventorySettings: vi.fn(),
  adjustVariantStock: vi.fn(),
  ensureVariantSchema: vi.fn(),
}));

vi.mock("@/lib/session-cookies", () => ({ getAuthSession: mocks.getAuthSession }));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/inventory", () => ({
  adjustProductStock: mocks.adjustProductStock,
  getVendorInventoryData: mocks.getVendorInventoryData,
  updateInventorySettings: mocks.updateInventorySettings,
}));
vi.mock("@/lib/variants", () => ({
  adjustVariantStock: mocks.adjustVariantStock,
  ensureVariantSchema: mocks.ensureVariantSchema,
}));

import * as route from "@/app/api/vendor/inventory/route";

function jsonRequest(path: string, body: Record<string, unknown>, method = "POST") {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as NextRequest;
}

describe("Phase-3 vendor inventory route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthSession.mockResolvedValue({ userId: "vendor-user-1" });
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: "vendor-user-1",
      role: "VENDOR",
      vendorProfile: { id: "vendor-1" },
    });
    mocks.prisma.product.findFirst.mockResolvedValue({ id: "product-1" });
    mocks.getVendorInventoryData.mockResolvedValue({
      rows: [],
      movements: [],
      warehouses: [{ id: "warehouse-1", code: "WH-1", name: "Main Warehouse" }],
      summary: {},
    });
  });

  it("passes warehouse filters to vendor inventory data", async () => {
    const response = await route.GET(
      new Request("http://localhost/api/vendor/inventory?warehouseId=warehouse-1") as NextRequest,
    );

    expect(response.status).toBe(200);
    expect(mocks.getVendorInventoryData).toHaveBeenCalledWith("vendor-1", {
      warehouseId: "warehouse-1",
    });
  });

  it("updates damaged stock with warehouse context", async () => {
    const response = await route.POST(
      jsonRequest("/api/vendor/inventory", {
        productId: "product-1",
        warehouseId: "warehouse-1",
        mode: "DAMAGE",
        quantity: 2,
        reasonCode: "DAMAGED_STOCK",
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.adjustProductStock).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: "product-1",
        warehouseId: "warehouse-1",
        mode: "DAMAGE",
        quantity: 2,
        reasonCode: "DAMAGED_STOCK",
        adjustedByUserId: "vendor-user-1",
      }),
    );
  });

  it("saves nullable warehouse assignment through settings", async () => {
    const response = await route.PATCH(
      jsonRequest(
        "/api/vendor/inventory",
        {
          productId: "product-1",
          warehouseId: "warehouse-1",
          lowStockThreshold: 5,
          criticalStockThreshold: 2,
          minimumOrderQuantity: 1,
        },
        "PATCH",
      ),
    );

    expect(response.status).toBe(200);
    expect(mocks.updateInventorySettings).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: "product-1",
        warehouseId: "warehouse-1",
      }),
    );
  });

  it("denies non-vendors before inventory access", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: "customer-1",
      role: "CUSTOMER",
      vendorProfile: null,
    });

    const response = await route.GET(new Request("http://localhost/api/vendor/inventory") as NextRequest);

    expect(response.status).toBe(403);
    expect(mocks.getVendorInventoryData).not.toHaveBeenCalled();
  });
});
