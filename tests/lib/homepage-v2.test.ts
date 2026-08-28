import { describe, expect, it } from "vitest";
import {
  buildCategoryProductRails,
  buildDepartmentNavigation,
  compactProductCardText,
  getProductDiscountPercent,
  homepageV2DealShortcuts,
  safeInternalRoute,
} from "@/lib/homepage-v2";
import type { PublicCategoryNode } from "@/lib/public-category-navigation";

function category(overrides: Partial<PublicCategoryNode> = {}): PublicCategoryNode {
  return {
    id: "cat-fashion",
    name: "Fashion",
    slug: "fashion",
    entityType: "category",
    parentId: null,
    categorySlug: "fashion",
    subcategorySlug: "",
    sortOrder: 1,
    status: "ACTIVE",
    homepageVisible: true,
    homepageIconUrl: "https://images.example.test/fashion.webp?v=1",
    categoryImageUrl: "",
    desktopBannerUrl: "",
    mobileBannerUrl: "",
    imageVersion: "1",
    altText: "Fashion",
    children: [],
    productTypes: [],
    ...overrides,
  };
}

describe("homepage v2 helpers", () => {
  it("keeps admin CTAs on safe internal routes", () => {
    expect(safeInternalRoute("/products?offer=true")).toBe("/products?offer=true");
    expect(safeInternalRoute("/vendor/register")).toBe("/vendor/register");
    expect(safeInternalRoute("/api/admin/homepage")).toBe("/products");
    expect(safeInternalRoute("https://example.com/sale")).toBe("/products");
    expect(safeInternalRoute("//evil.example/path")).toBe("/products");
  });

  it("builds department navigation from the category admin tree", () => {
    const departments = buildDepartmentNavigation([
      category({
        children: [
          category({
            id: "sub-kurtis",
            name: "Kurtis",
            slug: "kurtis",
            entityType: "subcategory",
            parentId: "cat-fashion",
            categorySlug: "fashion",
            subcategorySlug: "kurtis",
            productTypes: [
              category({
                id: "type-cotton",
                name: "Cotton Kurtis",
                slug: "cotton-kurtis",
                entityType: "productType",
                parentId: "sub-kurtis",
                categorySlug: "fashion",
                subcategorySlug: "kurtis",
              }),
            ],
          }),
        ],
      }),
    ]);

    expect(departments).toHaveLength(1);
    expect(departments[0].href).toContain("/category/fashion/kurtis");
    expect(departments[0].children[0].href).toContain("/category/fashion/kurtis");
    expect(departments[0].children[0].productTypes[0].href).toContain(
      "/category/fashion/kurtis/cotton-kurtis",
    );
  });

  it("derives compact product cards without long description fields", () => {
    const card = compactProductCardText({
      id: "product-1",
      name: "Printed Cotton Kurti With Regular Fit",
      price: 499,
      mrp: 999,
      inventory: 7,
      category: { name: "Fashion" },
      vendor: { storeName: "Demo Seller" },
    });

    expect(card).toEqual({
      title: "Printed Cotton Kurti With Regular Fit",
      subtitle: "Fashion",
      discountPercent: 50,
      stockBadge: "In stock",
    });
    expect(card).not.toHaveProperty("description");
  });

  it("creates category rails only from real matching products", () => {
    const rails = buildCategoryProductRails(
      [category(), category({ id: "cat-empty", name: "Empty", slug: "empty" })],
      [
        {
          id: "product-1",
          name: "Kurti 1",
          price: 499,
          categoryId: "cat-fashion",
          category: { name: "Fashion" },
        },
        {
          id: "product-2",
          name: "Kurti 2",
          price: 599,
          categoryId: "cat-fashion",
          category: { name: "Fashion" },
        },
      ],
    );

    expect(rails).toHaveLength(1);
    expect(rails[0].title).toBe("Shop Fashion");
    expect(rails[0].products.map((product) => product.id)).toEqual([
      "product-1",
      "product-2",
    ]);
  });

  it("keeps deal shortcuts on supported product routes", () => {
    expect(homepageV2DealShortcuts.every((item) => item.href.startsWith("/products"))).toBe(
      true,
    );
    expect(homepageV2DealShortcuts.some((item) => item.href.includes("sort=new"))).toBe(
      true,
    );
    expect(homepageV2DealShortcuts.some((item) => item.href.includes("offer=true"))).toBe(
      true,
    );
  });

  it("calculates discount from MRP when admin/product payload has no discount", () => {
    expect(
      getProductDiscountPercent({
        id: "product-1",
        name: "Demo",
        price: 750,
        mrp: 1000,
      }),
    ).toBe(25);
  });
});
