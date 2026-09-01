import { describe, expect, it } from "vitest";
import {
  getProductOptionLabel,
  getRecommendationCardPresentation,
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
});
