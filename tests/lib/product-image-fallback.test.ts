import { describe, expect, it } from "vitest";
import {
  PRODUCT_PLACEHOLDER_IMAGE,
  normalizeProductImageFallback,
  normalizeProductImages,
} from "@/lib/product-image-fallback";
import { getFallbackProducts } from "@/lib/fallback-catalog";

describe("product image fallback normalization", () => {
  it("normalizes known external placeholder hosts to the local fallback", () => {
    expect(normalizeProductImages(["https://placehold.co/600x600"])).toEqual([
      PRODUCT_PLACEHOLDER_IMAGE,
    ]);
    expect(
      normalizeProductImages([
        "https://via.placeholder.com/600x600/FFB6C1/000000?text=T-Shirt",
      ]),
    ).toEqual([PRODUCT_PLACEHOLDER_IMAGE]);
  });

  it("normalizes missing or empty images to the local fallback", () => {
    expect(normalizeProductImages(undefined)).toEqual([PRODUCT_PLACEHOLDER_IMAGE]);
    expect(normalizeProductImages([])).toEqual([PRODUCT_PLACEHOLDER_IMAGE]);
    expect(normalizeProductImages(["", "   "])).toEqual([
      PRODUCT_PLACEHOLDER_IMAGE,
    ]);
  });

  it("preserves valid catalogue images and drops stale placeholder alternates", () => {
    const validImage = "https://cdn.example.com/catalogue/product.webp";

    expect(
      normalizeProductImages([
        validImage,
        "https://placehold.co/600x600",
      ]),
    ).toEqual([validImage]);
  });

  it("normalizes product image arrays without changing other product fields", () => {
    const product = {
      id: "product-1",
      name: "Valid Product",
      images: ["https://placeholder.com/600x600"],
    };

    expect(normalizeProductImageFallback(product)).toEqual({
      ...product,
      images: [PRODUCT_PLACEHOLDER_IMAGE],
    });
  });

  it("keeps the fallback product catalogue free of external placeholder hosts", () => {
    const response = getFallbackProducts(new URLSearchParams());
    const serialized = JSON.stringify(response.products);

    expect(serialized).not.toContain("placehold.co");
    expect(serialized).not.toContain("via.placeholder.com");
    expect(serialized).not.toContain("placeholder.com");
  });
});
