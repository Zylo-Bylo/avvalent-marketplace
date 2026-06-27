export type HomepageHeroSlide = {
  eyebrow: string;
  title: string;
  highlight: string;
  text: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
  image: string;
  imageAlt: string;
  theme: string;
  panel: string;
};

export type HomepageLinkItem = {
  title: string;
  text?: string;
  href: string;
};

export type HomepageBrandItem = {
  name: string;
  slug: string;
};

export type HomepagePromoBanner = {
  eyebrow: string;
  title: string;
  text: string;
  ctaLabel: string;
  href: string;
  image: string;
  imageAlt: string;
};

export type HomepageDiscountBanner = {
  eyebrow: string;
  title: string;
  percent: string;
  text: string;
  ctaLabel: string;
  href: string;
  image: string;
  imageAlt: string;
};

export type HomepageContent = {
  heroSlides: HomepageHeroSlide[];
  utilityLinks: HomepageLinkItem[];
  quickShopLinks: HomepageLinkItem[];
  brandShortcuts: HomepageBrandItem[];
  promoBanner: HomepagePromoBanner;
  dealCards: HomepageLinkItem[];
  discountBanner: HomepageDiscountBanner;
};

export const defaultHomepageContent: HomepageContent = {
  utilityLinks: [
    { title: "Track Order", text: "Delivery progress", href: "/orders" },
    { title: "Contact", text: "Help and support", href: "/profile" },
    { title: "Best Sellers", text: "Top products", href: "/products?sort=popular" },
    { title: "Free Gifts", text: "Offers and deals", href: "/products?offer=true" },
    { title: "Bulk Purchase", text: "Vendor stock", href: "/products?bulk=true" },
  ],
  quickShopLinks: [
    { title: "Under Rs. 199", href: "/products?maxPrice=199" },
    { title: "Under Rs. 499", href: "/products?maxPrice=499" },
    { title: "Best Deals", href: "/products?offer=true" },
    { title: "New Today", href: "/products?sort=new" },
    { title: "Spare Parts", href: "/products?category=ac-parts" },
    { title: "Bulk Buy", href: "/products?bulk=true" },
  ],
  brandShortcuts: [
    { name: "Samsung", slug: "samsung" },
    { name: "LG", slug: "lg" },
    { name: "Whirlpool", slug: "whirlpool" },
    { name: "IFB", slug: "ifb" },
    { name: "Haier", slug: "haier" },
    { name: "Bajaj", slug: "bajaj" },
    { name: "Boat", slug: "boat" },
    { name: "Noise", slug: "noise" },
  ],
  heroSlides: [
    {
      eyebrow: "Zylo-Buylo premium marketplace",
      title: "Shop smart, sell easy",
      highlight: "Luxury deals. Trusted sellers.",
      text: "A cleaner marketplace experience for fashion, beauty, electronics, home products and appliance parts.",
      primaryLabel: "Shop now",
      primaryHref: "/products",
      secondaryLabel: "Become a seller",
      secondaryHref: "/supplier",
      image: "/hero-marketplace-visual.png",
      imageAlt: "Zylo-Buylo marketplace shopping",
      theme: "bg-[#fff6fb]",
      panel: "bg-[#fff0f6]",
    },
    {
      eyebrow: "Best deals today",
      title: "Up to 70% off",
      highlight: "Deals, gifts and fast checkout",
      text: "Discover daily offers, discount products, gifting picks and best-price marketplace items.",
      primaryLabel: "Shop deals",
      primaryHref: "/products?offer=true",
      secondaryLabel: "New arrivals",
      secondaryHref: "/products?sort=new",
      image: "/hero-banner.png",
      imageAlt: "Zylo-Buylo deals and gifts",
      theme: "bg-[#fff8ec]",
      panel: "bg-[#2a140c]",
    },
    {
      eyebrow: "Top seller highlights",
      title: "Grow your business online",
      highlight: "Sell products across India",
      text: "Vendor tools, product catalog, stock management, payments and delivery workflow in one place.",
      primaryLabel: "Become vendor",
      primaryHref: "/vendor/register",
      secondaryLabel: "View products",
      secondaryHref: "/products?sort=popular",
      image: "/hero-marketplace-visual.png",
      imageAlt: "Zylo-Buylo vendor marketplace",
      theme: "bg-[#f4f9ff]",
      panel: "bg-[#eef6ff]",
    },
  ],
  promoBanner: {
    eyebrow: "Luxury picks",
    title: "Gold style, daily value",
    text: "Premium fashion, accessories and gifting products selected for Zylo-Buylo shoppers.",
    ctaLabel: "Explore fashion",
    href: "/products?category=fashion&sort=trending",
    image: "/hero-banner.png",
    imageAlt: "Luxury marketplace collection",
  },
  dealCards: [
    {
      title: "Up to 70% off",
      text: "Fresh discounts on fashion, beauty, home and spare parts.",
      href: "/products?offer=true",
    },
    {
      title: "Original vendor products",
      text: "Explore latest uploads from approved Zylo-Buylo sellers.",
      href: "/products?sort=new",
    },
  ],
  discountBanner: {
    eyebrow: "Mega Discount",
    title: "Up to 70% Off",
    percent: "70%",
    text: "Best price products, limited stock deals, and fast checkout for Zylo-Buylo customers.",
    ctaLabel: "Shop Deals",
    href: "/products?offer=true",
    image: "/hero-banner.png",
    imageAlt: "Mega discount products",
  },
};

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown, fallback: string, max = 600) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, max)
    : fallback;
}

function isLikelyMediaUrl(value: string) {
  return (
    /^\/.+\.(png|jpe?g|webp|avif|gif|mp4|webm|ogg)(\?|#|$)/i.test(value) ||
    /^https?:\/\/.+\.(png|jpe?g|webp|avif|gif|mp4|webm|ogg)(\?|#|$)/i.test(value) ||
    /^https?:\/\/images\./i.test(value) ||
    /^https?:\/\/.+\/image\/upload\//i.test(value)
  );
}

function routeOrFallback(value: string, fallback: string) {
  if (!value || isLikelyMediaUrl(value)) {
    return fallback;
  }

  if (value.startsWith("/") || value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  return fallback;
}

function cleanHeroSlide(value: unknown, fallback: HomepageHeroSlide): HomepageHeroSlide {
  const row = asObject(value);
  const rawImage = text(row.image, fallback.image, 1000);
  const rawPrimaryHref = text(row.primaryHref, fallback.primaryHref, 1000);
  const rawSecondaryHref = text(row.secondaryHref, fallback.secondaryHref, 1000);
  const repairedImage = isLikelyMediaUrl(rawImage)
    ? rawImage
    : isLikelyMediaUrl(rawPrimaryHref)
      ? rawPrimaryHref
      : isLikelyMediaUrl(rawSecondaryHref)
        ? rawSecondaryHref
        : rawImage || fallback.image;

  return {
    eyebrow: text(row.eyebrow, fallback.eyebrow, 80),
    title: text(row.title, fallback.title, 120),
    highlight: text(row.highlight, fallback.highlight, 140),
    text: text(row.text, fallback.text, 500),
    primaryLabel: text(row.primaryLabel, fallback.primaryLabel, 40),
    primaryHref: routeOrFallback(rawPrimaryHref, fallback.primaryHref),
    secondaryLabel: text(row.secondaryLabel, fallback.secondaryLabel, 40),
    secondaryHref: routeOrFallback(rawSecondaryHref, fallback.secondaryHref),
    image: repairedImage,
    imageAlt: text(row.imageAlt, fallback.imageAlt, 180),
    theme: text(row.theme, fallback.theme, 80),
    panel: text(row.panel, fallback.panel, 80),
  };
}

function cleanLinkList(
  value: unknown,
  fallback: HomepageLinkItem[],
  maxItems: number,
) {
  const rows = Array.isArray(value) ? value : fallback;
  return rows.slice(0, maxItems).map((item, index) => {
    const row = asObject(item);
    const source = fallback[index] || fallback[0] || { title: "Shop", href: "/products" };
    return {
      title: text(row.title, source.title, 80),
      text: text(row.text, source.text || "", 180),
      href: text(row.href, source.href, 200),
    };
  });
}

function cleanBrandList(value: unknown, fallback: HomepageBrandItem[]) {
  const rows = Array.isArray(value) ? value : fallback;
  return rows.slice(0, 16).map((item, index) => {
    const row = asObject(item);
    const source = fallback[index] || fallback[0] || { name: "Brand", slug: "brand" };
    return {
      name: text(row.name, source.name, 80),
      slug: text(row.slug, source.slug, 80),
    };
  });
}

export function normalizeHomepageContent(value: unknown): HomepageContent {
  const input = asObject(value);
  const defaults = defaultHomepageContent;
  const heroRows = Array.isArray(input.heroSlides)
    ? input.heroSlides
    : defaults.heroSlides;
  const promo = asObject(input.promoBanner);
  const discount = asObject(input.discountBanner);

  return {
    heroSlides: heroRows
      .slice(0, 6)
      .map((slide, index) =>
        cleanHeroSlide(slide, defaults.heroSlides[index] || defaults.heroSlides[0]),
      ),
    utilityLinks: cleanLinkList(input.utilityLinks, defaults.utilityLinks, 8),
    quickShopLinks: cleanLinkList(input.quickShopLinks, defaults.quickShopLinks, 10),
    brandShortcuts: cleanBrandList(input.brandShortcuts, defaults.brandShortcuts),
    promoBanner: {
      eyebrow: text(promo.eyebrow, defaults.promoBanner.eyebrow, 80),
      title: text(promo.title, defaults.promoBanner.title, 140),
      text: text(promo.text, defaults.promoBanner.text, 500),
      ctaLabel: text(promo.ctaLabel, defaults.promoBanner.ctaLabel, 60),
      href: text(promo.href, defaults.promoBanner.href, 200),
      image: text(promo.image, defaults.promoBanner.image, 1000),
      imageAlt: text(promo.imageAlt, defaults.promoBanner.imageAlt, 180),
    },
    dealCards: cleanLinkList(input.dealCards, defaults.dealCards, 4),
    discountBanner: {
      eyebrow: text(discount.eyebrow, defaults.discountBanner.eyebrow, 80),
      title: text(discount.title, defaults.discountBanner.title, 140),
      percent: text(discount.percent, defaults.discountBanner.percent, 20),
      text: text(discount.text, defaults.discountBanner.text, 500),
      ctaLabel: text(discount.ctaLabel, defaults.discountBanner.ctaLabel, 60),
      href: text(discount.href, defaults.discountBanner.href, 200),
      image: text(discount.image, defaults.discountBanner.image, 1000),
      imageAlt: text(discount.imageAlt, defaults.discountBanner.imageAlt, 180),
    },
  };
}
