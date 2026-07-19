import { describe, expect, it } from "vitest";
import {
  isPermanentImageUrl,
  isTemporaryImageUrl,
  metadataImageStorageFolder,
  sanitizeMetadataImageUpdates,
  sanitizeMetadataImageValue,
} from "@/lib/category-metadata-images";

describe("category metadata images", () => {
  it("rejects browser-only temporary URLs", () => {
    expect(isTemporaryImageUrl("blob:https://zylo-buylo.com/abc")).toBe(true);
    expect(isTemporaryImageUrl("data:image/png;base64,abc")).toBe(true);
    expect(sanitizeMetadataImageValue("blob:https://zylo-buylo.com/abc")).toBeNull();
    expect(sanitizeMetadataImageValue("data:image/png;base64,abc")).toBeNull();
  });

  it("keeps permanent image URLs", () => {
    const url = "https://storage.example.com/categories/cat-1/homepage-icon/icon.webp";
    expect(isPermanentImageUrl(url)).toBe(true);
    expect(sanitizeMetadataImageValue(` ${url} `)).toBe(url);
  });

  it("sanitizes only metadata image fields", () => {
    expect(
      sanitizeMetadataImageUpdates({
        name: "T-Shirts",
        homepageIcon: "blob:https://zylo-buylo.com/icon",
        desktopBanner: "https://storage.example.com/banner.webp",
      }),
    ).toEqual({
      name: "T-Shirts",
      homepageIcon: null,
      desktopBanner: "https://storage.example.com/banner.webp",
    });
  });

  it("builds scoped storage folders for category and product type assets", () => {
    expect(metadataImageStorageFolder("category", "cat-1", "categoryImage")).toBe(
      "categories/cat-1/category-image",
    );
    expect(metadataImageStorageFolder("productType", "pt-tshirts", "desktopBanner")).toBe(
      "product-types/pt-tshirts/desktop-banner",
    );
  });
});
