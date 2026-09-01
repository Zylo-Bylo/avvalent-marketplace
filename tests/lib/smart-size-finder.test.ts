import { describe, expect, it } from "vitest";
import { createSizeGuideFromTemplate } from "@/lib/category-size-guide";
import {
  canUseSmartSizeFinder,
  canUseSmartSizeFinderForOptions,
  getSmartSizeMeasurementFields,
  recommendSmartSize,
} from "@/lib/smart-size-finder";

describe("smart size finder", () => {
  it("recommends an exact matching kurti size from category guide rows", () => {
    const guide = createSizeGuideFromTemplate("womens-kurtis");

    const result = recommendSmartSize({
      sizeGuide: guide,
      measurements: {
        bust: { value: 38, unit: "inch" },
        waist: { value: 34, unit: "inch" },
      },
      availableSizes: ["S", "M", "L"],
    });

    expect(result.status).toBe("recommended");
    expect(result.recommendedSize).toBe("M");
    expect(result.confidence).toBe("high");
  });

  it("handles measurements between sizes with lower confidence", () => {
    const guide = createSizeGuideFromTemplate("womens-kurtis");

    const result = recommendSmartSize({
      sizeGuide: guide,
      measurements: {
        bust: { value: 39, unit: "inch" },
        waist: { value: 35, unit: "inch" },
      },
      availableSizes: ["S", "M", "L"],
    });

    expect(result.status).toBe("recommended");
    expect(result.recommendedSize).toMatch(/M|L/);
    expect(result.confidence).toMatch(/medium|low/);
  });

  it("does not recommend unavailable variants", () => {
    const guide = createSizeGuideFromTemplate("womens-kurtis");

    const result = recommendSmartSize({
      sizeGuide: guide,
      measurements: {
        bust: { value: 38, unit: "inch" },
        waist: { value: 34, unit: "inch" },
      },
      availableSizes: ["S", "L"],
      unavailableSizes: ["M"],
    });

    expect(result.status).toBe("recommended");
    expect(result.recommendedSize).not.toBe("M");
  });

  it("converts centimetre inputs for inch-based guides", () => {
    const guide = createSizeGuideFromTemplate("womens-kurtis");

    const result = recommendSmartSize({
      sizeGuide: guide,
      measurements: {
        bust: { value: 96.52, unit: "cm" },
        waist: { value: 86.36, unit: "cm" },
      },
      availableSizes: ["S", "M", "L"],
    });

    expect(result.status).toBe("recommended");
    expect(result.recommendedSize).toBe("M");
  });

  it("returns missing input when required measurements are absent", () => {
    const guide = createSizeGuideFromTemplate("womens-kurtis");

    const result = recommendSmartSize({
      sizeGuide: guide,
      measurements: {
        bust: 38,
      },
    });

    expect(result.status).toBe("missing-input");
    expect(result.missingFields).toContain("Waist");
  });

  it("returns no-match for oversized measurements outside the guide", () => {
    const guide = createSizeGuideFromTemplate("womens-kurtis");

    const result = recommendSmartSize({
      sizeGuide: guide,
      measurements: {
        bust: 60,
        waist: 54,
      },
      availableSizes: ["S", "M", "L"],
    });

    expect(result.status).toBe("no-match");
  });

  it("detects disabled or non-sized categories", () => {
    expect(
      recommendSmartSize({
        sizeGuide: null,
        measurements: {},
      }).status,
    ).toBe("disabled");
  });

  it("honors category-level disabled Smart Size Finder config", () => {
    const guide = {
      ...createSizeGuideFromTemplate("womens-kurtis"),
      smartSizeFinder: {
        enabled: false,
        version: 1,
        fitPreferenceEnabled: true,
        recommendationTolerance: 1.5,
        notes: "",
      },
    };

    expect(
      recommendSmartSize({
        sizeGuide: guide,
        measurements: {
          bust: 38,
          waist: 34,
        },
      }).status,
    ).toBe("disabled");
  });

  it("exposes only measurement fields, not size labels", () => {
    const guide = createSizeGuideFromTemplate("footwear");

    expect(canUseSmartSizeFinder(guide)).toBe(true);
    expect(getSmartSizeMeasurementFields(guide).map((field) => field.key)).toEqual([
      "foot_length_cm",
    ]);
  });

  it("shows the finder only when configured guide rows match available product sizes", () => {
    const guide = createSizeGuideFromTemplate("womens-kurtis");

    expect(
      canUseSmartSizeFinderForOptions(guide, [
        { label: "S", available: true },
        { label: "M", available: true },
      ]),
    ).toBe(true);
    expect(
      canUseSmartSizeFinderForOptions(guide, [
        { label: "Default option", available: true },
      ]),
    ).toBe(false);
    expect(
      canUseSmartSizeFinderForOptions(guide, [
        { label: "S", available: false },
      ]),
    ).toBe(false);
  });
});
