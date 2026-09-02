import { describe, expect, it } from "vitest";
import {
  getShopBySizeStripConfig,
  sortShopBySizeValues,
} from "@/components/category/CategoryListingClient";
import type { CategoryFilter } from "@/lib/categoryFilters";

const sizeFilter: CategoryFilter = {
  key: "size",
  label: "Size",
  options: [
    { label: "L", value: "l" },
    { label: "S", value: "s" },
    { label: "M", value: "m" },
    { label: "XL", value: "xl" },
  ],
};

describe("category shop-by-size strip", () => {
  it("shows apparel categories with existing size values", () => {
    const config = getShopBySizeStripConfig({
      context: "Women Ethnic Wear Kurtis",
      filters: [sizeFilter],
      products: [
        { variants: [{ sizeLabel: "S", stockQuantity: 4 }, { sizeLabel: "M", stockQuantity: 2 }] },
      ],
    });

    expect(config?.filterKey).toBe("size");
    expect(config?.options.map((option) => option.label)).toEqual(["S", "M"]);
  });

  it("hides non-sized categories even when misleading variant values exist", () => {
    const config = getShopBySizeStripConfig({
      context: "Beauty Personal Care Face Wash",
      filters: [sizeFilter],
      products: [{ variants: [{ sizeLabel: "S", stockQuantity: 10 }] }],
    });

    expect(config).toBeNull();
  });

  it("dedupes sizes and keeps meaningful order", () => {
    const config = getShopBySizeStripConfig({
      context: "Men Jeans Trousers",
      filters: [sizeFilter],
      products: [
        {
          variants: [
            { numericSize: "34", stockQuantity: 1 },
            { numericSize: "30", stockQuantity: 1 },
            { numericSize: "34", stockQuantity: 3 },
            { numericSize: "32", stockQuantity: 2 },
          ],
        },
      ],
    });

    expect(config?.options.map((option) => option.label)).toEqual(["30", "32", "34"]);
  });

  it("preserves selected size state from the existing query filter", () => {
    const config = getShopBySizeStripConfig({
      context: "Women Dresses",
      filters: [sizeFilter],
      products: [{ variants: [{ sizeLabel: "M", stockQuantity: 5 }] }],
      selectedValue: "m",
    });

    expect(config?.selectedValue).toBe("m");
  });

  it("can represent the selected size clearing path", () => {
    const config = getShopBySizeStripConfig({
      context: "Women Dresses",
      filters: [sizeFilter],
      products: [{ variants: [{ sizeLabel: "M", stockQuantity: 5 }] }],
      selectedValue: "m",
    });
    const nextFilters: Record<string, string> = { sort: "popular", size: "m" };
    delete nextFilters[config?.filterKey || "size"];

    expect(nextFilters).toEqual({ sort: "popular" });
  });

  it("keeps unrelated filters intact when size is selected", () => {
    const config = getShopBySizeStripConfig({
      context: "Women Dresses",
      filters: [sizeFilter],
      products: [{ variants: [{ sizeLabel: "L", stockQuantity: 5 }] }],
    });
    const nextFilters = { sort: "popular", color: "blue", [config?.filterKey || "size"]: "l" };

    expect(nextFilters).toMatchObject({ sort: "popular", color: "blue", size: "l" });
  });

  it("does not generate fake sizes without existing size filter or variant data", () => {
    const config = getShopBySizeStripConfig({
      context: "Women Dresses",
      filters: [{ key: "color", label: "Color", options: [{ label: "Blue", value: "blue" }] }],
      products: [],
    });

    expect(config).toBeNull();
  });

  it("sorts apparel, kids and numeric sizes predictably", () => {
    expect(
      sortShopBySizeValues([
        { label: "XL", value: "xl" },
        { label: "S", value: "s" },
        { label: "30", value: "30" },
        { label: "M", value: "m" },
      ]).map((option) => option.label),
    ).toEqual(["S", "M", "XL", "30"]);
  });
});
