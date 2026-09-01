import { describe, expect, it } from "vitest";
import {
  createSizeGuideFromTemplate,
  formatSizeGuideChart,
  getRecommendedSizeGuideTemplateKey,
  hasSizeGuideContent,
  normalizeCategorySizeGuide,
  normalizeSizeGuideKey,
} from "@/lib/category-size-guide";

function fieldKeys(input: unknown, context = "") {
  return normalizeCategorySizeGuide(input, context).fields.map((field) => field.key);
}

describe("category-specific size guides", () => {
  it("uses Kurti-specific fields only for women's Kurtis", () => {
    const guide = createSizeGuideFromTemplate("womens-kurtis");

    expect(guide.guideName).toBe("Women's Kurtis");
    expect(guide.fields.map((field) => field.key)).toEqual([
      "size",
      "bust",
      "waist",
      "hip",
      "kurti_length",
    ]);
    expect(guide.fields.map((field) => field.key)).not.toContain("foot_length_cm");
    expect(guide.fields.map((field) => field.key)).not.toContain("age_group");
  });

  it("uses footwear fields only for footwear categories", () => {
    const guide = createSizeGuideFromTemplate("footwear");

    expect(guide.fields.map((field) => field.key)).toEqual([
      "india_size",
      "uk_size",
      "us_size",
      "eu_size",
      "foot_length_cm",
    ]);
    expect(guide.fields.map((field) => field.key)).not.toContain("bust");
    expect(guide.fields.map((field) => field.key)).not.toContain("kurti_length");
  });

  it("uses age and height fields for kids clothing", () => {
    const guide = createSizeGuideFromTemplate("kids-clothing");

    expect(guide.fields.map((field) => field.key)).toEqual([
      "age_group",
      "height_cm",
      "chest",
      "waist",
      "garment_length",
    ]);
  });

  it("does not leak fields when switching category contexts", () => {
    const kurtiKeys = fieldKeys(undefined, "Women Ethnic Wear Kurtis");
    const footwearKeys = fieldKeys(undefined, "Bags Footwear Shoes");
    const kidsKeys = fieldKeys(undefined, "Kids Clothing");

    expect(kurtiKeys).toContain("kurti_length");
    expect(kurtiKeys).not.toContain("foot_length_cm");

    expect(footwearKeys).toContain("foot_length_cm");
    expect(footwearKeys).not.toContain("kurti_length");

    expect(kidsKeys).toContain("age_group");
    expect(kidsKeys).toContain("height_cm");
    expect(kidsKeys).not.toContain("uk_size");
  });

  it("reloads saved structured guides without replacing their fields", () => {
    const saved = {
      guideType: "mens-shirts",
      guideName: "Men's Shirts",
      fields: [
        { id: "field-size", key: "size", label: "Size", unit: "", displayOrder: 1, required: true },
        { id: "field-chest", key: "chest", label: "Chest", unit: "inch", displayOrder: 2, required: true },
        { id: "field-sleeve", key: "sleeve_length", label: "Sleeve Length", unit: "inch", displayOrder: 3, required: false },
      ],
      rows: [
        { id: "row-m", values: { size: "M", chest: "40", sleeve_length: "25" } },
      ],
    };

    const guide = normalizeCategorySizeGuide(saved, "Footwear");

    expect(guide.fields.map((field) => field.key)).toEqual(["size", "chest", "sleeve_length"]);
    expect(guide.rows[0].values).toMatchObject({ size: "M", chest: "40", sleeve_length: "25" });
    expect(formatSizeGuideChart(guide)).toContain("Sleeve Length (inch): 25");
    expect(hasSizeGuideContent(guide)).toBe(true);
  });

  it("keeps Smart Size Finder config backward-compatible inside the size guide JSON", () => {
    const defaultGuide = normalizeCategorySizeGuide(undefined, "Women Kurtis");
    const disabledGuide = normalizeCategorySizeGuide({
      guideType: "womens-kurtis",
      guideName: "Kurtis",
      smartSizeFinder: {
        enabled: false,
        fitPreferenceEnabled: false,
        recommendationTolerance: 2,
      },
      fields: [
        { id: "size", key: "size", label: "Size", unit: "", displayOrder: 1, required: true },
        { id: "bust", key: "bust", label: "Bust", unit: "inch", displayOrder: 2, required: true },
      ],
      rows: [{ id: "m", values: { size: "M", bust: "38" } }],
    });

    expect(defaultGuide.smartSizeFinder).toMatchObject({
      enabled: true,
      fitPreferenceEnabled: true,
      recommendationTolerance: 1.5,
    });
    expect(disabledGuide.smartSizeFinder).toMatchObject({
      enabled: false,
      fitPreferenceEnabled: false,
      recommendationTolerance: 2,
    });
  });

  it("keeps existing legacy size-guide rows by converting only populated columns", () => {
    const guide = normalizeCategorySizeGuide(
      [
        {
          id: "legacy-1",
          guideType: "Legacy footwear",
          india: "7",
          uk: "7",
          footLength: "26 cm",
          ageGroup: "",
        },
      ],
      "Footwear",
    );

    expect(guide.guideName).toBe("Legacy footwear");
    expect(guide.fields.map((field) => field.key)).toEqual(["india", "uk", "foot_length"]);
    expect(guide.rows[0].values).toMatchObject({
      india: "7",
      uk: "7",
      foot_length: "26 cm",
    });
    expect(guide.fields.map((field) => field.key)).not.toContain("age_group");
  });

  it("normalizes admin-entered field keys safely", () => {
    expect(normalizeSizeGuideKey("Kurti Length")).toBe("kurti_length");
    expect(normalizeSizeGuideKey("footLength")).toBe("foot_length");
    expect(getRecommendedSizeGuideTemplateKey("Kids Toys Clothing")).toBe("kids-clothing");
  });
});
