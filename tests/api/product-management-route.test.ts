import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => {
  const prisma = {
    user: {
      findUnique: vi.fn(),
    },
    vendor: {
      findUnique: vi.fn(),
    },
    product: {
      count: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    productVariant: {
      findMany: vi.fn(),
    },
    category: {
      findUnique: vi.fn(),
    },
    subcategory: {
      findFirst: vi.fn(),
    },
  };

  return {
    cookies: vi.fn(),
    verifyToken: vi.fn(),
    shouldUseLocalSqliteAuth: vi.fn(),
    getLocalVendorUser: vi.fn(),
    ensureVariantSchema: vi.fn(),
    ensureProductInventory: vi.fn(),
    adjustProductStock: vi.fn(),
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
}));

vi.mock("@/lib/variants", () => ({
  ensureVariantSchema: mocks.ensureVariantSchema,
}));

vi.mock("@/lib/inventory", () => ({
  adjustProductStock: mocks.adjustProductStock,
  ensureProductInventory: mocks.ensureProductInventory,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

import { GET as getVendorProducts } from "@/app/api/vendor/products/route";
import {
  DELETE as deleteProduct,
  PUT as updateProduct,
} from "@/app/api/products/[id]/route";

function setAuthToken(token?: string) {
  mocks.cookies.mockResolvedValue({
    get: vi.fn(() => (token ? { value: token } : undefined)),
  });
}

function jsonRequest(url: string, body: Record<string, unknown>, method = "PUT") {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function params(id = "product-1") {
  return { params: Promise.resolve({ id }) };
}

describe("vendor product management API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAuthToken("auth-token");
    mocks.verifyToken.mockReturnValue({ userId: "vendor-user-1", role: "VENDOR" });
    mocks.shouldUseLocalSqliteAuth.mockReturnValue(false);
    mocks.ensureProductInventory.mockResolvedValue(undefined);
    mocks.adjustProductStock.mockResolvedValue(undefined);
    mocks.prisma.category.findUnique.mockResolvedValue({ id: "category-1" });
    mocks.prisma.subcategory.findFirst.mockResolvedValue({ id: "subcategory-1" });
  });

  it("lists only products belonging to the approved current vendor", async () => {
    mocks.prisma.vendor.findUnique.mockResolvedValue({
      id: "vendor-1",
      status: "APPROVED",
    });
    mocks.prisma.product.findMany.mockResolvedValue([{ id: "product-1" }]);
    mocks.prisma.product.count.mockResolvedValue(1);

    const response = await getVendorProducts(
      new Request("http://localhost/api/vendor/products?limit=25&offset=5") as NextRequest,
    );

    expect(response.status).toBe(200);
    expect(mocks.prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { vendorId: "vendor-1" },
        take: 25,
        skip: 5,
      }),
    );
    expect(mocks.prisma.product.count).toHaveBeenCalledWith({
      where: { vendorId: "vendor-1" },
    });
  });

  it("blocks pending vendors from listing operational product data", async () => {
    mocks.prisma.vendor.findUnique.mockResolvedValue({
      id: "vendor-1",
      status: "PENDING",
    });

    const response = await getVendorProducts(
      new Request("http://localhost/api/vendor/products") as NextRequest,
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Vendor account is pending admin approval.",
    });
    expect(mocks.prisma.product.findMany).not.toHaveBeenCalled();
  });

  it("lets an approved vendor update their own product", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: "vendor-user-1",
      role: "VENDOR",
      vendorProfile: { id: "vendor-1", status: "APPROVED" },
    });
    mocks.prisma.product.findUnique.mockResolvedValue({
      id: "product-1",
      vendorId: "vendor-1",
      categoryId: "category-1",
      subcategoryId: null,
      price: 100,
      mrp: 120,
      vendorPrice: 90,
      sellingPrice: null,
      discountPercent: null,
      platformCommissionPercent: null,
      packagingCharge: 0,
      weightGrams: null,
      packageSize: "SMALL",
      fragile: false,
      shippingCharge: 0,
      codCharge: 0,
      priceApproved: true,
    });
    mocks.prisma.product.update.mockResolvedValue({
      id: "product-1",
      vendorId: "vendor-1",
      sku: "SKU-1",
      inventory: 10,
    });

    const response = await updateProduct(
      jsonRequest("http://localhost/api/products/product-1", {
        name: "Updated Product",
        inventory: "10",
      }),
      params(),
    );

    expect(response.status).toBe(200);
    expect(mocks.prisma.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "product-1" },
        data: expect.objectContaining({
          name: "Updated Product",
          inventory: 10,
        }),
      }),
    );
    expect(mocks.adjustProductStock).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: "product-1",
        quantity: 10,
        mode: "SET",
        adjustedByUserId: "vendor-user-1",
      }),
    );
  });

  it("hides another vendor product from update attempts", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: "vendor-user-1",
      role: "VENDOR",
      vendorProfile: { id: "vendor-1", status: "APPROVED" },
    });
    mocks.prisma.product.findUnique.mockResolvedValue({
      id: "product-2",
      vendorId: "vendor-2",
    });

    const response = await updateProduct(
      jsonRequest("http://localhost/api/products/product-2", {
        name: "Nope",
      }),
      params("product-2"),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Product not found or unauthorized",
    });
    expect(mocks.prisma.product.update).not.toHaveBeenCalled();
  });

  it("blocks unapproved vendors from editing products", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: "vendor-user-1",
      role: "VENDOR",
      vendorProfile: { id: "vendor-1", status: "REJECTED" },
    });

    const response = await updateProduct(
      jsonRequest("http://localhost/api/products/product-1", {
        name: "Nope",
      }),
      params(),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Vendor account must be approved before managing products.",
    });
    expect(mocks.prisma.product.findUnique).not.toHaveBeenCalled();
  });

  it("lets an admin update any product without clearing price approval", async () => {
    mocks.verifyToken.mockReturnValue({ userId: "admin-1", role: "ADMIN" });
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      vendorProfile: null,
    });
    mocks.prisma.product.findUnique.mockResolvedValue({
      id: "product-1",
      vendorId: "vendor-1",
      categoryId: "category-1",
      subcategoryId: null,
      price: 100,
      mrp: 120,
      vendorPrice: 90,
      sellingPrice: null,
      discountPercent: null,
      platformCommissionPercent: null,
      packagingCharge: 0,
      weightGrams: null,
      packageSize: "SMALL",
      fragile: false,
      shippingCharge: 0,
      codCharge: 0,
      priceApproved: false,
    });
    mocks.prisma.product.update.mockResolvedValue({
      id: "product-1",
      vendorId: "vendor-1",
      sku: "SKU-1",
      inventory: 5,
    });

    const response = await updateProduct(
      jsonRequest("http://localhost/api/products/product-1", {
        price: 150,
      }),
      params(),
    );

    expect(response.status).toBe(200);
    expect(mocks.prisma.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          priceApproved: true,
        }),
      }),
    );
  });

  it("lets an approved vendor delete their own product", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: "vendor-user-1",
      role: "VENDOR",
      vendorProfile: { id: "vendor-1", status: "APPROVED" },
    });
    mocks.prisma.product.findUnique.mockResolvedValue({
      id: "product-1",
      vendorId: "vendor-1",
    });
    mocks.prisma.product.delete.mockResolvedValue({ id: "product-1" });

    const response = await deleteProduct(
      new Request("http://localhost/api/products/product-1", { method: "DELETE" }),
      params(),
    );

    expect(response.status).toBe(200);
    expect(mocks.prisma.product.delete).toHaveBeenCalledWith({
      where: { id: "product-1" },
    });
  });

  it("hides another vendor product from delete attempts", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: "vendor-user-1",
      role: "VENDOR",
      vendorProfile: { id: "vendor-1", status: "APPROVED" },
    });
    mocks.prisma.product.findUnique.mockResolvedValue({
      id: "product-2",
      vendorId: "vendor-2",
    });

    const response = await deleteProduct(
      new Request("http://localhost/api/products/product-2", { method: "DELETE" }),
      params("product-2"),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Product not found or unauthorized",
    });
    expect(mocks.prisma.product.delete).not.toHaveBeenCalled();
  });
});
