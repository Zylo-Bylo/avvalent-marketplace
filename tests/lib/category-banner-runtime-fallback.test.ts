import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("category listing banner runtime fallback", () => {
  it("protects the category hero image with a local fallback on load errors", () => {
    const source = readFileSync(
      join(process.cwd(), "components/category/CategoryListingClient.tsx"),
      "utf8",
    );

    expect(source).toContain("const [bannerRenderSrc, setBannerRenderSrc]");
    expect(source).toContain("src={bannerRenderSrc}");
    expect(source).toContain("onError={() =>");
    expect(source).toContain("setBannerRenderSrc(categoryPlaceholderImage)");
  });
});
