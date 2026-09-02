import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const navbarSource = readFileSync(
  join(process.cwd(), "components/navbar/Navbar.tsx"),
  "utf8",
);
const mobileNavbarSource = readFileSync(
  join(process.cwd(), "components/MobileNavbar.tsx"),
  "utf8",
);

describe("shared public navigation guardrails", () => {
  it("keeps the approved logo linked to the homepage", () => {
    expect(navbarSource).toContain('href="/"');
    expect(navbarSource).toContain("<ZyloBrandLogo />");
    expect(navbarSource).toContain('aria-label="Zylo-Buylo - Buy Smart, Sell Easy"');
  });

  it("keeps search on the existing products search route", () => {
    expect(navbarSource).toContain("router.push(query ? `/products?search=${encodeURIComponent(query)}` : \"/products\")");
    expect(navbarSource).toContain("onSubmit={submitSearch}");
  });

  it("keeps account, wishlist, cart, and utility destinations unchanged", () => {
    for (const href of [
      "/login?role=customer&next=/profile",
      "/login?role=vendor&next=/vendor/dashboard",
      "/login",
      "/wishlist",
      "/cart",
      "/products",
      "/products?offer=true",
      "/profile",
      "/products?sort=popular",
      "/products?bulk=true",
      "/vendor/register",
      "/orders",
    ]) {
      expect(
        navbarSource.includes(`href="${href}"`) ||
          navbarSource.includes(`href: "${href}"`),
      ).toBe(true);
    }
  });

  it("renders only utility links with existing reviewed destinations", () => {
    for (const label of [
      "Products",
      "Top Deals",
      "Contact",
      "Best Seller",
      "Free Gift",
      "Bulk Purchase",
      "Sell on Zylo-Buylo",
      "Track Order",
    ]) {
      expect(navbarSource).toContain(`label: "${label}"`);
    }

    expect(navbarSource).not.toContain('label: "Gift"');
    expect(navbarSource).not.toContain('href: "/gift"');
  });

  it("keeps category navigation sourced from the existing category API", () => {
    expect(navbarSource).toContain('fetch("/api/categories", { cache: "no-store" })');
    expect(navbarSource).toContain("normalizePublicCategoryTree(data)");
    expect(navbarSource).toContain("href={getCategoryHref(category)}");
    expect(navbarSource).toContain('aria-label="Category navigation"');
  });

  it("keeps mobile bottom navigation destinations stable while using the premium palette", () => {
    for (const href of ["/", "/products", "/wishlist", "/cart", "/profile"]) {
      expect(mobileNavbarSource).toContain(`href: "${href}"`);
    }
    expect(mobileNavbarSource).toContain("text-[#8a6a30]");
    expect(mobileNavbarSource).not.toContain("text-pink-600");
  });
});
