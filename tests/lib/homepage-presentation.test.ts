import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "components/home/HomePageClient.tsx"),
  "utf8",
);

describe("homepage presentation guardrails", () => {
  it("keeps homepage product rails capped at five cards on wide screens", () => {
    const productRailGrid =
      /function renderProductRail[\s\S]*?<div className="([^"]*min-\[1440px\]:grid-cols-5[^"]*)"/.exec(
        source,
      )?.[1] || "";

    expect(productRailGrid).toContain(
      "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 lg:gap-5 min-[1440px]:grid-cols-5",
    );
    expect(productRailGrid).not.toContain("grid-cols-6");
    expect(productRailGrid).not.toContain("grid-cols-7");
  });

  it("keeps the hero CTA driven by existing homepage CMS data", () => {
    expect(source).toContain("href={safeInternalRoute(activeHero.primaryHref)}");
    expect(source).toContain("{activeHero.primaryLabel || \"Shop Now\"}");
  });

  it("keeps homepage sections controlled by existing section flags", () => {
    for (const sectionKey of [
      "categories",
      "shortcuts",
      "productsForYou",
      "bestDeals",
      "newArrivals",
      "brands",
    ]) {
      expect(source).toContain(`isSectionEnabled("${sectionKey}")`);
    }
  });
});
