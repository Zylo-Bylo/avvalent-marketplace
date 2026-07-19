import { describe, expect, it } from "vitest";
import { mapCsvCategories, normalizeCategoryKey } from "@/lib/category-csv-mapping";

const categories = [
  {
    id: "cat-men",
    name: "Men Fashion",
    slug: "men-fashion",
    subcategories: [
      {
        id: "sub-shirts",
        name: "Shirts",
        slug: "shirts",
        productTypes: [
          { id: "leaf-formal", name: "Formal Shirt", slug: "formal-shirt" },
        ],
      },
    ],
  },
  {
    id: "cat-women",
    name: "Women Ethnic",
    slug: "women-ethnic",
    subcategories: [],
  },
];

describe("category CSV mapping", () => {
  it("normalizes category keys before matching", () => {
    expect(normalizeCategoryKey("  Men   Fashion  ")).toBe("men fashion");
  });

  it("maps category, subcategory, and leaf category with trimmed case-insensitive names", () => {
    const [result] = mapCsvCategories(
      [
        {
          categoryName: " men fashion ",
          subcategoryName: "shirts",
          productTypeName: "formal shirt",
        },
      ],
      categories,
    );

    expect(result.status).toBe("matched");
    expect(result.categoryId).toBe("cat-men");
    expect(result.subcategoryId).toBe("sub-shirts");
    expect(result.productTypeId).toBe("leaf-formal");
  });

  it("detects missing categories and suggests close spellings", () => {
    const [result] = mapCsvCategories(
      [{ categoryName: "Men Fashon", subcategoryName: "Shirts" }],
      categories,
    );

    expect(result.status).toBe("missing");
    expect(result.spellingSuggestion).toBe("Men Fashion");
  });

  it("marks missing leaf categories as partial matches", () => {
    const [result] = mapCsvCategories(
      [{ categoryName: "Men Fashion", subcategoryName: "Shirts", productTypeName: "Casual Shirt" }],
      categories,
    );

    expect(result.status).toBe("partial");
    expect(result.notes).toContain("Missing product type");
  });
});
