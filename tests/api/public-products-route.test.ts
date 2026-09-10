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

  it("normalizes placeholder product images at the public serialization boundary", async () => {
    const validImage = "https://cdn.example.com/catalogue/real-product.webp";
    mocks.prisma.product.findMany.mockResolvedValue([
      {
        id: "product-placeholder",
        name: "Placeholder Product",
        images: ["https://placehold.co/600x600"],
      },
      {
        id: "product-real",
        name: "Real Product",
        images: [validImage, "https://via.placeholder.com/600x600"],
      },
      {
        id: "product-missing",
        name: "Missing Image Product",
        images: [],
      },
    ]);
    mocks.prisma.product.count.mockResolvedValue(3);

    const response = await getProducts(
      new Request("http://localhost/api/products?includeOutOfStock=true") as NextRequest,
    );
    const data = await response.json();
    const serialized = JSON.stringify(data);

    expect(data.products).toEqual([
      expect.objectContaining({
        id: "product-placeholder",
        images: ["/product-placeholder.svg"],
      }),
      expect.objectContaining({
        id: "product-real",
        images: [validImage],
      }),
      expect.objectContaining({
        id: "product-missing",
        images: ["/product-placeholder.svg"],
      }),
    ]);
    expect(serialized).not.toContain("placehold.co");
    expect(serialized).not.toContain("via.placeholder.com");
    expect(serialized).not.toContain("placeholder.com");
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

  it("filters size queries against product variant size labels instead of generic product text", async () => {
    const response = await getProducts(
      new Request("http://localhost/api/products?categoryId=cat-kurtis&size=M") as NextRequest,
    );

    expect(response.status).toBe(200);
    expect(mocks.prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          categoryId: "cat-kurtis",
          AND: expect.arrayContaining([
            expect.objectContaining({
              variants: {
                some: expect.objectContaining({
                  OR: expect.arrayContaining([
                    { sizeLabel: expect.objectContaining({ equals: "M" }) },
                    { numericSize: expect.objectContaining({ equals: "M" }) },
                  ]),
                }),
              },
            }),
          ]),
        }),
      }),
    );
    expect(mocks.prisma.product.findMany).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              OR: expect.arrayContaining([
                { name: expect.objectContaining({ contains: "M" }) },
              ]),
            }),
          ]),
        }),
      }),
    );
  });

  it("matches numeric and slugged footwear sizes through variant size fields", async () => {
    const response = await getProducts(
      new Request("http://localhost/api/products?subcategoryId=sub-shoes&size=uk-8") as NextRequest,
    );

    expect(response.status).toBe(200);
    expect(mocks.prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          subcategoryId: "sub-shoes",
          AND: expect.arrayContaining([
            expect.objectContaining({
              variants: {
                some: expect.objectContaining({
                  OR: expect.arrayContaining([
                    { sizeLabel: expect.objectContaining({ equals: "uk-8" }) },
                    { sizeLabel: expect.objectContaining({ equals: "uk 8" }) },
                    { numericSize: expect.objectContaining({ equals: "8" }) },
                  ]),
                }),
              },
            }),
          ]),
        }),
      }),
    );
  });

  it("handles case and whitespace safely for variant size comparison", async () => {
    const response = await getProducts(
      new Request("http://localhost/api/products?productTypeId=type-shirts&size=%20m%20") as NextRequest,
    );

    expect(response.status).toBe(200);
    expect(mocks.prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          productTypeId: "type-shirts",
          AND: expect.arrayContaining([
            expect.objectContaining({
              variants: {
                some: expect.objectContaining({
                  OR: expect.arrayContaining([
                    { sizeLabel: expect.objectContaining({ equals: "m" }) },
                    { numericSize: expect.objectContaining({ equals: "m" }) },
                  ]),
                }),
              },
            }),
          ]),
        }),
      }),
    );
  });

  it("combines size filtering with existing price and customer filter params", async () => {
    const response = await getProducts(
      new Request(
        "http://localhost/api/products?categoryId=cat-denim&size=36&color=Blue&minPrice=500&maxPrice=2500&sort=price-desc",
      ) as NextRequest,
    );

    expect(response.status).toBe(200);
    expect(mocks.prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          categoryId: "cat-denim",
          price: { gte: 500, lte: 2500 },
          AND: expect.arrayContaining([
            expect.objectContaining({ variants: expect.any(Object) }),
            expect.objectContaining({
              OR: expect.arrayContaining([
                { description: expect.objectContaining({ contains: "Blue" }) },
              ]),
            }),
          ]),
        }),
        orderBy: { price: "desc" },
      }),
    );
  });

  it("keeps unknown non-size query parameters on the existing generic filter path", async () => {
    const response = await getProducts(
      new Request("http://localhost/api/products?category=beauty&packQuantity=100ml") as NextRequest,
    );

    expect(response.status).toBe(200);
    expect(mocks.prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          category: expect.any(Object),
          AND: expect.arrayContaining([
            expect.objectContaining({
              OR: expect.arrayContaining([
                { sku: expect.objectContaining({ contains: "100ml" }) },
              ]),
            }),
          ]),
        }),
      }),
    );
  });

  it("does not add variant size filtering when non-sized category requests have no size query", async () => {
    const response = await getProducts(
      new Request("http://localhost/api/products?category=beauty&sort=popular") as NextRequest,
    );

    expect(response.status).toBe(200);
    expect(mocks.prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({ variants: expect.any(Object) }),
          ]),
        }),
      }),
    );
  });

  it("returns product detail for approved vendor products", async () => {
    mocks.prisma.product.findUnique.mockResolvedValue({
      id: "product-1",
      images: ["https://placehold.co/600x600"],
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
        images: ["/product-placeholder.svg"],
        vendor: {
          status: "APPROVED",
        },
        variants: [],
      },
    });
    expect(mocks.prisma.product.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({ productTypeId: true }),
      }),
    );
  });

  it("returns the canonical ProductType ID when one is persisted", async () => {
    mocks.prisma.product.findUnique.mockResolvedValue({
      id: "product-with-type",
      productTypeId: "a-line-kurtis",
      images: [],
      vendor: { status: "APPROVED" },
    });

    const response = await getProductById(
      new Request("http://localhost/api/products/product-with-type"),
      params({ id: "product-with-type" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      product: {
        id: "product-with-type",
        productTypeId: "a-line-kurtis",
        images: ["/product-placeholder.svg"],
        vendor: { status: "APPROVED" },
        variants: [],
      },
    });
  });

  it("returns legacy products safely when ProductType is null", async () => {
    mocks.prisma.product.findUnique.mockResolvedValue({
      id: "legacy-product",
      productTypeId: null,
      images: [],
      vendor: { status: "APPROVED" },
    });

    const response = await getProductById(
      new Request("http://localhost/api/products/legacy-product"),
      params({ id: "legacy-product" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      product: {
        id: "legacy-product",
        productTypeId: null,
        images: ["/product-placeholder.svg"],
        vendor: { status: "APPROVED" },
        variants: [],
      },
    });
  });

  it("preserves valid images on slug product detail responses", async () => {
    const validImage = "https://cdn.example.com/catalogue/slug-product.webp";
    mocks.prisma.product.findUnique.mockResolvedValue({
      id: "product-1",
      slug: "valid-product",
      images: [validImage, "https://via.placeholder.com/600x600"],
      vendor: {
        status: "APPROVED",
      },
    });

    const response = await getProductBySlug(
      new Request("http://localhost/api/products/slug/valid-product"),
      params({ slug: "valid-product" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      product: {
        id: "product-1",
        slug: "valid-product",
        images: [validImage],
        vendor: {
          status: "APPROVED",
        },
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
