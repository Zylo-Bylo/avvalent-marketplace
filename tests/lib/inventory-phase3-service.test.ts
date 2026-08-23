import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx: any = {
    $executeRaw: vi.fn(),
    product: { update: vi.fn() },
  };
  return {
    tx,
    prisma: {
      product: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      vendor: { findUnique: vi.fn() },
      vendorWarehouse: { findFirst: vi.fn(), findMany: vi.fn() },
      user: { findMany: vi.fn() },
      notification: { create: vi.fn() },
      $executeRaw: vi.fn(),
      $executeRawUnsafe: vi.fn(),
      $queryRaw: vi.fn(),
      $transaction: vi.fn((callback: any) => callback(tx)),
    },
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/variants", () => ({
  getVariantsForProducts: vi.fn().mockResolvedValue([]),
  reduceVariantStockForOrder: vi.fn(),
  restoreVariantStockForOrder: vi.fn(),
}));

import { adjustProductStock, getStockStatus, updateInventorySettings } from "@/lib/inventory";

const inventory = {
  id: "inventory-1",
  productId: "product-1",
  vendorId: "vendor-1",
  warehouseId: null,
  variantId: null,
  sku: "SKU-1",
  mpn: null,
  openingStock: 10,
  receivedStock: 0,
  damagedStock: 1,
  currentStock: 10,
  reservedStock: 2,
  availableStock: 7,
  lowStockThreshold: 5,
  criticalStockThreshold: 2,
  minimumOrderQuantity: 1,
  maximumOrderQuantity: null,
  restockDate: null,
  stockStatus: "IN_STOCK",
  allowBackorder: false,
  isPreOrder: false,
  bulkPricingTiers: null,
  lastLowStockAlertAt: null,
  lastCriticalStockAlertAt: null,
  lastStockUpdatedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("Phase-3 inventory service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$executeRawUnsafe.mockResolvedValue(undefined);
    mocks.prisma.product.findMany.mockResolvedValue([]);
    mocks.prisma.product.findUnique.mockResolvedValue({
      id: "product-1",
      vendorId: "vendor-1",
      sku: "SKU-1",
      inventory: 10,
    });
    mocks.prisma.$queryRaw.mockResolvedValue([inventory]);
    mocks.prisma.vendorWarehouse.findFirst.mockResolvedValue({
      id: "warehouse-1",
      name: "Main Warehouse",
      code: "MAIN",
    });
    mocks.tx.$executeRaw.mockResolvedValue(undefined);
    mocks.tx.product.update.mockResolvedValue(undefined);
  });

  it("deducts damaged stock from availability status math", () => {
    expect(
      getStockStatus({
        currentStock: 5,
        reservedStock: 1,
        damagedStock: 4,
        lowStockThreshold: 2,
        criticalStockThreshold: 1,
      }),
    ).toBe("OUT_OF_STOCK");
  });

  it("records damaged stock against the selected active warehouse", async () => {
    await adjustProductStock({
      productId: "product-1",
      quantity: 2,
      mode: "DAMAGE",
      warehouseId: "warehouse-1",
      adjustedByUserId: "admin-1",
    });

    expect(mocks.prisma.vendorWarehouse.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "warehouse-1",
          vendorId: "vendor-1",
          isActive: true,
        }),
      }),
    );
    expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("prevents stock-out beyond available stock instead of clamping", async () => {
    await expect(
      adjustProductStock({
        productId: "product-1",
        quantity: 8,
        mode: "REMOVE",
        warehouseId: "warehouse-1",
      }),
    ).rejects.toThrow("Only 7 available stock can be removed.");

    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects inactive or cross-vendor warehouse assignment", async () => {
    mocks.prisma.vendorWarehouse.findFirst.mockResolvedValue(null);

    await expect(
      updateInventorySettings({
        productId: "product-1",
        warehouseId: "warehouse-other",
      }),
    ).rejects.toThrow("Warehouse not found, inactive, or unauthorized.");
  });
});
