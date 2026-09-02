import { describe, expect, it } from "vitest";
import { getProductListingImageTreatment } from "@/components/products/ProductCard";

describe("product listing image treatment", () => {
  it("uses editorial top-crop treatment for fashion catalogue cards", () => {
    const treatment = getProductListingImageTreatment("Women Kurtis Floral Kurta Set");

    expect(treatment.imageClassName).toContain("object-cover");
    expect(treatment.imageClassName).toContain("object-top");
  });

  it("uses contained treatment for beauty catalogue cards", () => {
    const treatment = getProductListingImageTreatment("Beauty Personal Care Vitamin C Serum");

    expect(treatment.imageClassName).toContain("object-contain");
    expect(treatment.frameClassName).toContain("bg-[#f6efe4]");
  });

  it("uses contained treatment for home and electronics catalogue cards", () => {
    expect(getProductListingImageTreatment("Home Living Table Lamp").imageClassName).toContain(
      "object-contain",
    );
    expect(getProductListingImageTreatment("Electronics Mobile Charger").imageClassName).toContain(
      "object-contain",
    );
  });
});
