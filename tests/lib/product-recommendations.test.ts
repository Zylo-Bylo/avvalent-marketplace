import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    product: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

import {
  getProductRecommendations,
  hasRecommendationAffinity,
} from "@/lib/product-recommendations";

function product(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    slug: id,
    name: `Kids School Shoes ${id}`,
    price: 1000,
    mrp: 1200,
    discountPercent: 10,
    shippingCharge: 0,
    inventory: 5,
    images: ["https://cdn.example.com/product.webp"],
    categoryId: "cat-kids",
    subcategoryId: "sub-kids-footwear",
    productTypeId: "type-school-shoes",
    vendorId: "vendor-2",
    category: { id: "cat-kids", name: "Kids Fashion" },
    subcategory: { id: "sub-kids-footwear", name: "Kids Footwear" },
    productType: { id: "type-school-shoes", name: "School Shoes" },
    inventories: [
      {
        availableStock: 5,
        lowStockThreshold: 2,
        criticalStockThreshold: 1,
        stockStatus: "IN_STOCK",
        isPreOrder: false,
        allowBackorder: false,
      },
    ],
    ...overrides,
  };
}

const seed = {
  id: "current",
  name: "Black Kids School Shoes",
  vendorId: "vendor-1",
  categoryId: "cat-kids",
  subcategoryId: "sub-kids-footwear",
  productTypeId: "type-school-shoes",
  price: 1000,
  category: { id: "cat-kids", name: "Kids Fashion" },
  subcategory: { id: "sub-kids-footwear", name: "Kids Footwear" },
  productType: { id: "type-school-shoes", name: "School Shoes" },
};

describe("product recommendations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty groups without a product seed", async () => {
    await expect(getProductRecommendations(null)).resolves.toEqual({
      similarProducts: [],
      youMayAlsoLike: [],
      moreFromSeller: [],
    });
    expect(mocks.prisma.product.findMany).not.toHaveBeenCalled();
  });

  it("prioritizes exact category and product type matches", async () => {
    mocks.prisma.product.findMany
      .mockResolvedValueOnce([product("exact-shoe")])
      .mockResolvedValueOnce([product("leaf-shoe", { productTypeId: "type-sneakers", productType: { id: "type-sneakers", name: "Sneakers" } })])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await getProductRecommendations(seed);

    expect(result.similarProducts.map((item) => item.id)).toEqual([
      "exact-shoe",
      "leaf-shoe",
    ]);
    expect(mocks.prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { not: "current" },
          vendor: { is: { status: "APPROVED" } },
          inventory: { gt: 0 },
          subcategoryId: "sub-kids-footwear",
          productTypeId: "type-school-shoes",
        }),
        take: 12,
      }),
    );
  });

  it("uses parent-category fallback only when shopper affinity remains relevant", async () => {
    mocks.prisma.product.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        product("kids-sandal", {
          subcategoryId: "sub-sandals",
          productTypeId: "type-sandals",
          subcategory: { id: "sub-sandals", name: "Kids Sandals" },
          productType: { id: "type-sandals", name: "Sandals" },
        }),
      ])
      .mockResolvedValueOnce([]);

    const result = await getProductRecommendations(seed);

    expect(result.similarProducts.map((item) => item.id)).toEqual(["kids-sandal"]);
  });

  it("rejects unrelated parent-category products instead of using filler", async () => {
    mocks.prisma.product.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        product("steel-bottle", {
          name: "Steel Bottle",
          subcategoryId: "sub-bottle",
          productTypeId: "type-bottle",
          subcategory: { id: "sub-bottle", name: "Water Bottles" },
          productType: { id: "type-bottle", name: "Steel Bottle" },
        }),
      ])
      .mockResolvedValueOnce([]);

    const result = await getProductRecommendations(seed);

    expect(result.similarProducts).toEqual([]);
    expect(result.youMayAlsoLike).toEqual([]);
    expect(hasRecommendationAffinity(seed, product("steel-bottle", {
      name: "Steel Bottle",
      subcategoryId: "sub-bottle",
      productTypeId: "type-bottle",
      subcategory: { id: "sub-bottle", name: "Water Bottles" },
      productType: { id: "type-bottle", name: "Steel Bottle" },
    }))).toBe(false);
  });

  it("excludes the current product and avoids duplicates across groups", async () => {
    const duplicate = product("duplicate-shoe");
    mocks.prisma.product.findMany
      .mockResolvedValueOnce([product("current"), duplicate])
      .mockResolvedValueOnce([duplicate])
      .mockResolvedValueOnce([duplicate, product("kids-sneaker", { productType: { id: "type-sneakers", name: "Sneakers" } })])
      .mockResolvedValueOnce([duplicate, product("seller-shoe", { vendorId: "vendor-1" })]);

    const result = await getProductRecommendations(seed);
    const ids = [
      ...result.similarProducts,
      ...result.youMayAlsoLike,
      ...result.moreFromSeller,
    ].map((item) => item.id);

    expect(ids).not.toContain("current");
    expect(ids).toEqual(Array.from(new Set(ids)));
  });

  it("ranks seller recommendations with same-category products first", async () => {
    mocks.prisma.product.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        product("seller-bag", {
          vendorId: "vendor-1",
          categoryId: "cat-accessories",
          category: { id: "cat-accessories", name: "Accessories" },
          subcategory: { id: "sub-bags", name: "Bags" },
          productType: { id: "type-bags", name: "Bags" },
        }),
        product("seller-shoe", { vendorId: "vendor-1" }),
      ]);

    const result = await getProductRecommendations(seed);

    expect(result.moreFromSeller.map((item) => item.id)).toEqual([
      "seller-shoe",
      "seller-bag",
    ]);
  });

  it("normalizes stale placeholder images in recommendation cards", async () => {
    mocks.prisma.product.findMany
      .mockResolvedValueOnce([product("similar-1", { images: ["https://placehold.co/600x600"] })])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await getProductRecommendations(seed);

    expect(result.similarProducts[0].images).toEqual(["/product-placeholder.svg"]);
  });
});
