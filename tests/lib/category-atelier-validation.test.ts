import { describe, expect, it } from "vitest";
import {
  buildAtelierQuery,
  completionFromIssues,
  getValidAtelierTab,
  normalizeAtelierSlug,
  resolveAtelierNode,
  selectedAndLoadedEntityMatch,
  validateAtelierForPublish,
  validateCategoryMetadata,
} from "@/lib/category-atelier-validation";

const categories = [
  {
    id: "cat-men",
    name: "Men",
    slug: "men",
    subcategories: [
      {
        id: "sub-top-wear",
        name: "Top Wear",
        slug: "top-wear",
        productTypes: [{ id: "leaf-tshirts", name: "T-Shirts", slug: "t-shirts" }],
      },
    ],
  },
  { id: "cat-women", name: "Women", slug: "women" },
];

const validBase = {
  categoryId: "cat-men",
  name: "Men",
  slug: "men",
  productTypes: ["T-Shirts"],
  specs: [
    {
      name: "size",
      label: "Size",
      fieldType: "Dropdown",
      required: true,
      dropdownValues: ["S", "M"],
      filterable: true,
    },
  ],
  variants: [{ sku: "TSHIRT-M", price: "499", stock: "10" }],
  sizeGuideRows: [{ india: "M" }],
  businessRules: {
    returnAllowed: true,
    returnWindow: "7",
    returnReasons: "Damaged, wrong item",
    nonReturnable: false,
    replacementWindow: "7",
    installationRequired: false,
    warrantyRequired: false,
  },
  categories,
};

describe("category atelier validation", () => {
  it("normalizes slugs for metadata save", () => {
    expect(normalizeAtelierSlug(" Men's Top Wear!! ")).toBe("mens-top-wear");
  });

  it("rejects duplicate category slugs", () => {
    const issues = validateCategoryMetadata({
      categoryId: "cat-men",
      name: "Men Updated",
      slug: "women",
      categories,
    });

    expect(issues.some((issue) => issue.message.includes("already uses this slug"))).toBe(true);
  });

  it("builds and restores tab query state", () => {
    expect(buildAtelierQuery({ categoryId: "123", subcategoryId: "456", tab: "variants" })).toBe(
      "/admin/categories?categoryId=123&subcategoryId=456&tab=variants",
    );
    expect(getValidAtelierTab("variants")).toBe("variants");
    expect(getValidAtelierTab("unknown")).toBe("metadata");
  });

  it("blocks publish when required sections are incomplete", () => {
    const issues = validateAtelierForPublish({
      ...validBase,
      productTypes: [],
      specs: [],
      variants: [],
    });

    expect(issues.some((issue) => issue.tab === "product-types")).toBe(true);
    expect(issues.some((issue) => issue.tab === "specifications")).toBe(true);
    expect(issues.some((issue) => issue.tab === "variants")).toBe(true);
    expect(completionFromIssues(issues)).toBeLessThan(100);
  });

  it("validates mutually exclusive return rules", () => {
    const issues = validateAtelierForPublish({
      ...validBase,
      businessRules: {
        ...validBase.businessRules,
        returnAllowed: true,
        nonReturnable: true,
      },
    });

    expect(issues.some((issue) => issue.message.includes("cannot both be enabled"))).toBe(true);
  });

  it("rejects invalid structured size guide fields", () => {
    const issues = validateAtelierForPublish({
      ...validBase,
      sizeGuideRows: {
        guideType: "kurtis",
        guideName: "Kurtis",
        fields: [
          { key: "size", label: "Size", required: true },
          { key: "Size", label: "Size", required: false },
          { key: "", label: "Bust", required: true },
          { key: "bust", label: "Bust", required: true },
        ],
        rows: [{ values: { size: "M", bust: "" } }],
      },
    });

    expect(issues.some((issue) => issue.message.includes("field keys cannot be empty"))).toBe(true);
    expect(issues.some((issue) => issue.message.includes("Duplicate size guide field keys"))).toBe(true);
    expect(issues.some((issue) => issue.message.includes("Duplicate size guide field labels"))).toBe(true);
    expect(issues.some((issue) => issue.message.includes("Bust is required"))).toBe(true);
  });

  it("loads exact metadata for category, subcategory, and product type nodes", () => {
    const men = resolveAtelierNode(categories, "category", "cat-men");
    const topWear = resolveAtelierNode(categories, "subcategory", "sub-top-wear");
    const tshirts = resolveAtelierNode(categories, "productType", "leaf-tshirts");

    expect(men?.entity.name).toBe("Men");
    expect(men?.breadcrumb).toBe("Men");

    expect(topWear?.entity.name).toBe("Top Wear");
    expect(topWear?.entity.slug).toBe("top-wear");
    expect(topWear?.parentName).toBe("Men");
    expect(topWear?.breadcrumb).toBe("Men > Top Wear");

    expect(tshirts?.entity.name).toBe("T-Shirts");
    expect(tshirts?.entity.slug).toBe("t-shirts");
    expect(tshirts?.parentName).toBe("Top Wear");
    expect(tshirts?.breadcrumb).toBe("Men > Top Wear > T-Shirts");
  });

  it("blocks save when selected node and loaded form identity do not match", () => {
    expect(
      selectedAndLoadedEntityMatch({
        selectedNodeId: "sub-top-wear",
        selectedNodeType: "subcategory",
        loadedEntityId: "cat-men",
        loadedEntityType: "category",
      }),
    ).toBe(false);

    expect(
      selectedAndLoadedEntityMatch({
        selectedNodeId: "leaf-tshirts",
        selectedNodeType: "productType",
        loadedEntityId: "leaf-tshirts",
        loadedEntityType: "productType",
      }),
    ).toBe(true);
  });
});
