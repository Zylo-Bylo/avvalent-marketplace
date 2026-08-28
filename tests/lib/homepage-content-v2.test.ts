import { describe, expect, it } from "vitest";
import {
  defaultHomepageContent,
  normalizeHomepageContent,
} from "@/lib/homepage-content";

describe("homepage content v2 normalization", () => {
  it("preserves admin-controlled hero media and layout fields", () => {
    const content = normalizeHomepageContent({
      heroSlides: [
        {
          ...defaultHomepageContent.heroSlides[0],
          title: "Premium Launch",
          image: "/desktop-hero.webp",
          mobileImage: "/mobile-hero.webp",
          videoPoster: "/hero-poster.webp",
          objectPosition: "35% center",
          overlayStrength: "strong",
          textAlign: "center",
          textPosition: "center",
          order: 5,
          active: false,
          startsAt: "2026-08-25T10:00",
          endsAt: "2026-08-31T23:59",
        },
      ],
    });

    expect(content.heroSlides[0]).toMatchObject({
      title: "Premium Launch",
      image: "/desktop-hero.webp",
      mobileImage: "/mobile-hero.webp",
      videoPoster: "/hero-poster.webp",
      objectPosition: "35% center",
      overlayStrength: "strong",
      textAlign: "center",
      textPosition: "center",
      order: 5,
      active: false,
      startsAt: "2026-08-25T10:00",
      endsAt: "2026-08-31T23:59",
    });
  });

  it("keeps promotional banner placement controls and section settings", () => {
    const content = normalizeHomepageContent({
      promoBanners: [
        {
          ...defaultHomepageContent.promoBanners[0],
          title: "Fashion Fiesta",
          mobileImage: "/fashion-mobile.webp",
          placement: "shopper",
          order: 2,
          active: true,
        },
        {
          ...defaultHomepageContent.promoBanners[1],
          title: "Seller Growth",
          placement: "seller",
          order: 1,
          active: false,
        },
      ],
      sections: [
        {
          key: "productsForYou",
          title: "Curated For You",
          subtitle: "Fresh marketplace products",
          enabled: true,
          order: 3,
          limit: 18,
          source: "popular-products",
        },
      ],
    });

    expect(content.promoBanners.map((banner) => banner.title)).toEqual([
      "Seller Growth",
      "Fashion Fiesta",
    ]);
    expect(content.promoBanners[0]).toMatchObject({
      placement: "seller",
      active: false,
    });
    expect(content.promoBanners[1]).toMatchObject({
      mobileImage: "/fashion-mobile.webp",
      placement: "shopper",
    });
    expect(content.sections[0]).toMatchObject({
      key: "productsForYou",
      title: "Curated For You",
      subtitle: "Fresh marketplace products",
      enabled: true,
      order: 3,
      limit: 18,
    });
  });

  it("maps the legacy promo banner into v2 promo banners when no v2 rows exist", () => {
    const content = normalizeHomepageContent({
      promoBanner: {
        ...defaultHomepageContent.promoBanner,
        title: "Legacy Admin Promo",
        image: "/legacy-promo.webp",
      },
    });

    expect(content.promoBanner.title).toBe("Legacy Admin Promo");
    expect(content.promoBanners[0]).toMatchObject({
      title: "Legacy Admin Promo",
      image: "/legacy-promo.webp",
      placement: "shopper",
    });
  });
});
