import { describe, expect, it } from "vitest";
import {
  getPdpNonSizeOptionRows,
  getPdpSizeFitRows,
  getProductOptionLabel,
  getRecommendationCardPresentation,
  getRecommendationRailLayout,
  isPdpSizeFitApplicable,
} from "@/components/products/ProductDetailsClient";

function product(overrides: Record<string, unknown> = {}) {
  return {
    id: "product-1",
    name: "Product",
    price: 499,
    images: ["/product-placeholder.svg"],
    ...overrides,
  };
}

describe("product detail option labels", () => {
  it("uses apparel size wording for configured apparel guides", () => {
    expect(
      getProductOptionLabel(
        product({
          name: "Beige Floral Kurti",
          category: { name: "Women" },
          subcategory: { name: "Kurtis" },
        }) as never,
        {},
        true,
      ),
    ).toBe("Select Size");
  });

  it("uses pack or volume wording for beauty variants", () => {
    expect(
      getProductOptionLabel(
        product({
          name: "Gentle Face Wash 100 ml",
          category: { name: "Beauty & Personal Care" },
          subcategory: { name: "Face Wash" },
        }) as never,
        { Volume: "100 ml" },
        false,
      ),
    ).toBe("Select Pack Size / Volume");
  });

  it("uses storage wording for memory products", () => {
    expect(
      getProductOptionLabel(
        product({
          name: "Mobile Storage Card",
          productType: { name: "Memory Card" },
        }) as never,
        { Capacity: "128 GB" },
        false,
      ),
    ).toBe("Select Storage");
  });

  it("falls back to generic option wording for non-sized products", () => {
    expect(getProductOptionLabel(product({ name: "Desk Lamp" }) as never, {}, false)).toBe(
      "Select Option",
    );
  });

  it("keeps apparel products eligible for Size & Fit", () => {
    const kurti = product({
      name: "Floral Embroidered Kurti",
      category: { name: "Women" },
      subcategory: { name: "Kurtis" },
    }) as never;

    expect(isPdpSizeFitApplicable(kurti, {}, false)).toBe(true);
    expect(
      getPdpSizeFitRows(
        [{ label: "S" }, { label: "M" }, { label: "L" }],
        true,
        "Kurtis size guide",
        true,
      ),
    ).toEqual([
      { label: "Available options", value: "S, M, L" },
      { label: "Guide", value: "Kurtis size guide" },
    ]);
  });

  it("does not show apparel Size & Fit for beauty products with misleading variant sizes", () => {
    const faceWash = product({
      name: "Gentle Face Wash",
      category: { name: "Beauty & Personal Care" },
      subcategory: { name: "Skincare" },
    }) as never;

    expect(isPdpSizeFitApplicable(faceWash, {}, false)).toBe(false);
    expect(getPdpSizeFitRows([{ label: "S / 36" }], false, null, false)).toEqual([]);
  });

  it("keeps relevant non-fashion options in specifications instead of Size & Fit", () => {
    expect(
      getPdpNonSizeOptionRows(
        [{ label: "100 ml" }, { label: "200 ml" }],
        "Select Pack Size / Volume",
        false,
      ),
    ).toEqual([{ label: "Pack size / volume", value: "100 ml, 200 ml" }]);
  });

  it("does not duplicate apparel options into specifications when Size & Fit is shown", () => {
    expect(
      getPdpNonSizeOptionRows(
        [{ label: "S" }, { label: "M" }],
        "Select Size",
        true,
      ),
    ).toEqual([]);
  });
});

describe("PDP recommendation card presentation", () => {
  it("uses taller image-first treatment for fashion recommendations", () => {
    const presentation = getRecommendationCardPresentation(
      product({
        name: "Embroidered Kurti",
        category: { name: "Women Fashion" },
        subcategory: { name: "Kurtis" },
        productType: { name: "Kurti Set" },
      }) as never,
    );

    expect(presentation.imageFrameClass).toContain("aspect-[4/5]");
    expect(presentation.imageClassName).toContain("object-cover");
    expect(presentation.categoryLabel).toBe("Kurti Set");
  });

  it("uses contained treatment for beauty recommendations", () => {
    const presentation = getRecommendationCardPresentation(
      product({
        name: "Gentle Face Wash",
        category: { name: "Beauty & Personal Care" },
        subcategory: { name: "Face Wash" },
      }) as never,
    );

    expect(presentation.imageFrameClass).toContain("aspect-[5/6]");
    expect(presentation.imageClassName).toContain("object-contain");
    expect(presentation.categoryLabel).toBe("Face Wash");
  });

  it("hides empty recommendation rails without placeholder layout", () => {
    expect(getRecommendationRailLayout(0)).toBeNull();
  });

  it("keeps a one-product recommendation rail compact and left aligned", () => {
    const layout = getRecommendationRailLayout(1);

    expect(layout?.className).toContain("md:inline-grid");
    expect(layout?.className).toContain("minmax(210px,240px)");
    expect(layout?.railCount).toBe(1);
  });

  it("keeps two-to-three recommendation cards unique-width and balanced", () => {
    const two = getRecommendationRailLayout(2);
    const three = getRecommendationRailLayout(3);

    expect(two?.className).toContain("repeat(var(--rail-count),minmax(210px,250px))");
    expect(three?.className).toContain("repeat(var(--rail-count),minmax(210px,250px))");
    expect(two?.railCount).toBe(2);
    expect(three?.railCount).toBe(3);
  });

  it("keeps four-plus recommendations to four or five useful desktop cards", () => {
    const layout = getRecommendationRailLayout(6);

    expect(layout?.className).toContain("xl:grid-cols-4");
    expect(layout?.className).toContain("2xl:grid-cols-5");
    expect(layout?.className).not.toContain("grid-cols-6");
  });
});
