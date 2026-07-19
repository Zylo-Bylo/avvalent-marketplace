import { describe, expect, it } from "vitest";
import { resolveBulkCategory } from "@/lib/bulk-category-resolver";

const categories = [
  {
    id: "cat-kurtis",
    name: "Kurtis",
    subcategories: [
      { id: "sub-kurta-sets", name: "Kurta Sets", categoryId: "cat-kurtis" },
      { id: "sub-kurti-combo", name: "Kurti Combo Sets", categoryId: "cat-kurtis" },
      { id: "sub-kurtis", name: "Kurtis", categoryId: "cat-kurtis" },
    ],
  },
  {
    id: "cat-lehenga-sarees",
    name: "Lehenga & Sarees",
    subcategories: [
      { id: "sub-sarees", name: "Sarees", categoryId: "cat-lehenga-sarees" },
      { id: "sub-lehengas", name: "Lehengas", categoryId: "cat-lehenga-sarees" },
      { id: "sub-saree-combo", name: "Saree Combo Sets", categoryId: "cat-lehenga-sarees" },
    ],
  },
];

describe("bulk category resolver", () => {
  it("maps legacy kurti/saree/lehenga category rows to current admin categories", () => {
    expect(resolveBulkCategory(categories, "Kurti, Saree & Lehenga", "kurti sets")).toMatchObject({
      category: { name: "Kurtis" },
      subcategory: { name: "Kurta Sets" },
    });

    expect(resolveBulkCategory(categories, "Kurti, Saree & Lehenga", "silk saree")).toMatchObject({
      category: { name: "Lehenga & Sarees" },
      subcategory: { name: "Sarees" },
    });

    expect(resolveBulkCategory(categories, "Kurti, Saree & Lehenga", "party lehenga")).toMatchObject({
      category: { name: "Lehenga & Sarees" },
      subcategory: { name: "Lehengas" },
    });
  });

  it("keeps exact admin category and subcategory names unchanged", () => {
    expect(resolveBulkCategory(categories, "Lehenga & Sarees", "Sarees")).toMatchObject({
      category: { name: "Lehenga & Sarees" },
      subcategory: { name: "Sarees" },
      message: "",
    });
  });
});
