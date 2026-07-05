import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const prisma = {
    product: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $executeRaw: vi.fn(),
    $executeRawUnsafe: vi.fn(),
    $queryRaw: vi.fn(),
  };

  return { prisma };
});

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@/lib/variants", () => ({
  getVariantsForProducts: vi.fn(),
  reduceVariantStockForOrder: vi.fn(),
  restoreVariantStockForOrder: vi.fn(),
}));

import { validateCartStock } from "@/lib/inventory";

describe("checkout inventory performance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$executeRawUnsafe.mockResolvedValue(undefined);
    mocks.prisma.product.findMany.mockResolvedValue([
      {
        id: "product-1",
        name: "Test Product",
        vendorId: "vendor-1",
        sku: "SKU-1",
        inventory: 10,
      },
    ]);
    mocks.prisma.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "inventory-1",
          productId: "product-1",
          vendorId: "vendor-1",
          sku: "SKU-1",
          currentStock: 10,
          reservedStock: 0,
          availableStock: 10,
          lowStockThreshold: 3,
          criticalStockThreshold: 1,
          minimumOrderQuantity: 1,
          maximumOrderQuantity: null,
          allowBackorder: false,
          isPreOrder: false,
          stockStatus: "IN_STOCK",
        },
      ]);
  });

  it("validates only cart products instead of scanning the full catalog", async () => {
    const result = await validateCartStock([
      { id: "product-1", name: "Test Product", quantity: 1 },
    ]);

    expect(result).toEqual({ ok: true });
    expect(mocks.prisma.product.findMany).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.product.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["product-1"] } },
      select: { id: true, name: true, vendorId: true, sku: true, inventory: true },
    });
    expect(mocks.prisma.product.findUnique).not.toHaveBeenCalled();
  });
});
