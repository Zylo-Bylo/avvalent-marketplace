import { describe, expect, it } from "vitest";
import {
  generateVariantCombinations,
  normalizeStructuredVariantConfig,
  tshirtVariantConfig,
  validateStructuredVariantConfig,
  validateVendorVariantRows,
} from "@/lib/category-variant-config";

describe("category variant configuration", () => {
  it("normalizes legacy variant examples into admin preview rows", () => {
    const config = normalizeStructuredVariantConfig({
      examples: [
        {
          sizeLabel: "M",
          numericSize: "38",
          color: "Navy Blue",
          sku: "LIVE-SKU",
          stockQuantity: "25",
          price: "499",
          mrp: "799",
        },
      ],
    });

    expect(config.dimensions.map((dimension) => dimension.key)).toContain("size");
    expect(config.dimensions.map((dimension) => dimension.key)).toContain("color");
    expect(config.examplePreview).toEqual([
      { size: "M", color: "Navy Blue", label: "M + Navy Blue" },
    ]);
    expect(config.examplePreview[0]).not.toHaveProperty("stockQuantity");
    expect(config.examplePreview[0]).not.toHaveProperty("price");
  });

  it("validates duplicate dimension keys and missing options", () => {
    const config = normalizeStructuredVariantConfig({
      dimensions: [
        { ...tshirtVariantConfig.dimensions[0], key: "size", options: [] },
        { ...tshirtVariantConfig.dimensions[1], key: "SIZE" },
      ],
    });

    expect(validateStructuredVariantConfig(config)).toEqual(
      expect.arrayContaining([
        "Duplicate variant dimension keys are not allowed.",
        "Size needs at least one allowed option.",
      ]),
    );
  });

  it("generates vendor-owned combinations with zero stock", () => {
    const rows = generateVariantCombinations({
      sizes: ["M", "L"],
      colors: ["Navy Blue", "White"],
      baseSku: "TSHIRT",
      lowStockAlert: "5",
    });

    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({
      sizeLabel: "M",
      color: "Navy Blue",
      sku: "TSHIRT-M-NAVY-BLUE",
      stockQuantity: "0",
      lowStockThreshold: "5",
      isDefault: true,
    });
  });

  it("validates vendor variant rows before product submit", () => {
    const errors = validateVendorVariantRows([
      {
        sizeLabel: "M",
        color: "Black",
        sku: "SKU-M-BLK",
        stockQuantity: "2",
        price: "900",
        mrp: "800",
        weight: "0",
        isDefault: true,
      },
      {
        sizeLabel: "M",
        color: "Black",
        sku: "SKU-M-BLK",
        stockQuantity: "-1",
        isDefault: true,
      },
    ]);

    expect(errors).toEqual(
      expect.arrayContaining([
        "Row 1: selling price cannot exceed MRP.",
        "Row 1: weight must be greater than zero.",
        "Row 2: duplicate Size + Colour combination.",
        "Row 2: duplicate SKU.",
        "Row 2: stock cannot be negative.",
        "Only one default variant is allowed.",
      ]),
    );
  });

  it("allows blank draft rows without duplicate-combination errors", () => {
    expect(
      validateVendorVariantRows([
        { sku: "", stockQuantity: "0" },
        { sku: "", stockQuantity: "0" },
      ]),
    ).toEqual([]);
  });
});
