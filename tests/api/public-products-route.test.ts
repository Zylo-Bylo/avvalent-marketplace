import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => {
  const prisma = {
    product: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    productVariant: {
      findMany: vi.fn(),
    },
  };

  return {
    ensureInventorySchema: vi.fn(),
    getFallbackProductById: vi.fn(),
    getFallbackProductBySlug: vi.fn(),
    getFallbackProducts: vi.fn(),
    shouldUseFallbackCatalog: vi.fn(),
    prisma,
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@/lib/inventory", () => ({
  ensureInventorySchema: mocks.ensureInventorySchema,
}));

vi.mock("@/lib/fallback-catalog", () => ({
  getFallbackProductById: mocks.getFallbackProductById,
  getFallbackProductBySlug: mocks.getFallbackProductBySlug,
  getFallbackProducts: mocks.getFallbackProducts,
  shouldUseFallbackCatalog: mocks.shouldUseFallbackCatalog,
}));

import { GET as getProductById } from "@/app/api/products/[id]/route";
import { GET as getProducts } from "@/app/api/products/route";
import { GET as getProductBySlug } from "@/app/api/products/slug/[slug]/route";

function params<T extends Record<string, string>>(value: T) {
  return { params: Promise.resolve(value) };
}

describe("public products API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ensureInventorySchema.mockResolvedValue(undefined);
    mocks.shouldUseFallbackCatalog.mockReturnValue(false);
    mocks.prisma.product.findMany.mockResolvedValue([]);
    mocks.prisma.product.count.mockResolvedValue(0);
    mocks.prisma.productVariant.findMany.mockResolvedValue([]);
  });

  it("filters public listings to approved vendors by default", async () => {
    const response = await getProducts(
      new Request("http://localhost/api/products?limit=12") as NextRequest,
    );

    expect(response.status).toBe(200);
    expect(mocks.prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          vendor: {
            is: {
              status: "APPROVED",
            },
          },
          inventory: {
            gt: 0,
          },
        }),
        take: 12,
      }),
    );
    expect(mocks.prisma.product.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        vendor: {
          is: {
            status: "APPROVED",
          },
        },
      }),
    });
    expect(mocks.ensureInventorySchema).not.toHaveBeenCalled();
    expect(mocks.prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          variants: expect.objectContaining({
            take: 5,
            select: {
              id: true,
              sizeLabel: true,
              numericSize: true,
              stockQuantity: true,
            },
          }),
        }),
      }),
    );
  });

  it("preserves approved-vendor filtering with search, category, offer, and price filters", async () => {
    const response = await getProducts(
      new Request(
        "http://localhost/api/products?search=phone&category=electronics&offer=true&minPrice=100&maxPrice=5000&sort=price-asc",
      ) as NextRequest,
    );

    expect(response.status).toBe(200);
    expect(mocks.prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          vendor: {
            is: {
              status: "APPROVED",
            },
          },
          category: expect.any(Object),
          discountPercent: {
            gt: 0,
          },
          price: {
            gte: 100,
            lte: 5000,
          },
          AND: expect.any(Array),
        }),
        orderBy: { price: "asc" },
      }),
    );
  });

  it("preserves approved-vendor filtering when a vendor id is requested", async () => {
    const response = await getProducts(
      new Request("http://localhost/api/products?vendorId=vendor-1&includeOutOfStock=true") as NextRequest,
    );

    expect(response.status).toBe(200);
    expect(mocks.prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          vendorId: "vendor-1",
          vendor: {
            is: {
              status: "APPROVED",
            },
          },
        }),
      }),
    );
  });

  it("applies dynamic category template filters to product text fields", async () => {
    const response = await getProducts(
      new Request("http://localhost/api/products?subcategoryId=sub-baby-diapers&packQuantity=20%20Pieces") as NextRequest,
    );

    expect(response.status).toBe(200);
    expect(mocks.prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          subcategoryId: "sub-baby-diapers",
          AND: expect.arrayContaining([
            {
              OR: expect.arrayContaining([
                { description: expect.objectContaining({ contains: "20 Pieces" }) },
              ]),
            },
          ]),
        }),
      }),
    );
  });

  it("returns product detail for approved vendor products", async () => {
    mocks.prisma.product.findUnique.mockResolvedValue({
      id: "product-1",
      vendor: {
        status: "APPROVED",
      },
    });

    const response = await getProductById(
      new Request("http://localhost/api/products/product-1"),
      params({ id: "product-1" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      product: {
        id: "product-1",
        vendor: {
          status: "APPROVED",
        },
        variants: [],
      },
    });
  });

  it("hides product detail for non-approved vendor products", async () => {
    mocks.prisma.product.findUnique.mockResolvedValue({
      id: "product-1",
      vendor: {
        status: "PENDING",
      },
    });

    const response = await getProductById(
      new Request("http://localhost/api/products/product-1"),
      params({ id: "product-1" }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Product not found",
    });
  });

  it("hides slug detail for non-approved vendor products", async () => {
    mocks.prisma.product.findUnique.mockResolvedValue({
      id: "product-1",
      slug: "hidden-product",
      vendor: {
        status: "REJECTED",
      },
    });

    const response = await getProductBySlug(
      new Request("http://localhost/api/products/slug/hidden-product"),
      params({ slug: "hidden-product" }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Product not found",
    });
  });
});
