import { describe, expect, it } from "vitest";
import {
  getProductGalleryPresentation,
  getRecoverableGalleryImages,
  getVisibleGalleryImages,
  PRODUCT_GALLERY_FALLBACK_IMAGE,
} from "@/components/products/ProductImageGallery";

describe("product image gallery helpers", () => {
  it("keeps a single image as the only visible gallery item", () => {
    const items = getRecoverableGalleryImages(["/product-a.webp"]);

    expect(items).toHaveLength(1);
    expect(getVisibleGalleryImages(items).map((item) => item.src)).toEqual([
      "/product-a.webp",
    ]);
  });

  it("keeps a balanced two-image set visible", () => {
    const items = getRecoverableGalleryImages(["/front.webp", "/back.webp"]);

    expect(getVisibleGalleryImages(items).map((item) => item.src)).toEqual([
      "/front.webp",
      "/back.webp",
    ]);
  });

  it("keeps three images visible for the dominant-plus-secondary layout", () => {
    const items = getRecoverableGalleryImages([
      "/front.webp",
      "/side.webp",
      "/detail.webp",
    ]);

    expect(getVisibleGalleryImages(items)).toHaveLength(3);
  });

  it("limits large desktop galleries to five initial images", () => {
    const items = getRecoverableGalleryImages([
      "/1.webp",
      "/2.webp",
      "/3.webp",
      "/4.webp",
      "/5.webp",
      "/6.webp",
      "/7.webp",
    ]);

    expect(getVisibleGalleryImages(items).map((item) => item.src)).toEqual([
      "/1.webp",
      "/2.webp",
      "/3.webp",
      "/4.webp",
      "/5.webp",
    ]);
  });

  it("removes failed secondary images from gallery navigation", () => {
    const items = getRecoverableGalleryImages(
      ["/front.webp", "/broken.webp", "/back.webp"],
      ["/broken.webp"],
    );

    expect(items.map((item) => item.src)).toEqual(["/front.webp", "/back.webp"]);
  });

  it("falls back safely when the primary and all other images fail", () => {
    const items = getRecoverableGalleryImages(
      ["/front.webp", "/broken.webp"],
      ["/front.webp", "/broken.webp"],
    );

    expect(items).toEqual([
      {
        src: PRODUCT_GALLERY_FALLBACK_IMAGE,
        originalIndex: 0,
        isFallback: true,
      },
    ]);
  });

  it("uses an image-heavy fashion presentation for apparel context", () => {
    const presentation = getProductGalleryPresentation("Women Kurtis Ethnic Wear");

    expect(presentation.mode).toBe("fashion");
    expect(presentation.mobileFrameClass).toContain("aspect-[4/5]");
    expect(presentation.mosaicFrameClass).toContain("2xl:h-[700px]");
    expect(presentation.imageClassName).toContain("object-cover");
  });

  it("uses a more contained presentation for beauty and electronics context", () => {
    const presentation = getProductGalleryPresentation("Beauty Face Wash Serum");

    expect(presentation.mode).toBe("contained");
    expect(presentation.mobileFrameClass).toContain("aspect-square");
    expect(presentation.imageClassName).toContain("object-contain");
  });
});
