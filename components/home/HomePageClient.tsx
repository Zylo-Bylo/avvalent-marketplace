"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, MouseEvent, useEffect, useMemo, useState } from "react";
import ZyloBrandLogo from "@/components/brand/ZyloBrandLogo";
import MobileNavbar from "@/components/MobileNavbar";
import {
  categoryPlaceholderImage,
  getCategoryHref,
  getCategorySmallImage,
  normalizePublicCategoryTree,
  type PublicCategoryNode,
} from "@/lib/public-category-navigation";
import {
  defaultHomepageContent,
  normalizeHomepageContent,
  type HomepageContent,
} from "@/lib/homepage-content";
import {
  buildCategoryProductRails,
  buildDepartmentNavigation,
  compactProductCardText,
  getProductDiscountPercent,
  getProductRating,
  getProductReviewCount,
  homepageV2DealShortcuts,
  safeInternalRoute,
  type HomepageV2Product,
} from "@/lib/homepage-v2";
import { useCartStore } from "@/store/cart-store";
import { useWishlistStore } from "@/store/wishlist-store";

type Product = HomepageV2Product;

type CurrentUser = {
  id: string;
  email: string;
  name?: string | null;
  role: "CUSTOMER" | "VENDOR" | "ADMIN";
  vendorProfile?: {
    storeName?: string | null;
  } | null;
};

type HomePageClientProps = {
  initialProducts?: Product[];
  initialCategories?: PublicCategoryNode[];
  initialHomepageContent?: HomepageContent;
};

const fallbackImage = "/product-placeholder.svg";

function priceLabel(price: number) {
  return `Rs. ${Number(price || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function getWishlistId(productId: string) {
  return productId.split("").reduce((total, character) => {
    return total + character.charCodeAt(0);
  }, 0);
}

function isVideoMedia(src: string) {
  return /\.(mp4|webm|ogg)(\?|#|$)/i.test(src);
}

function CategoryImage({
  src,
  alt,
  sizes,
  className,
}: {
  src: string;
  alt: string;
  sizes: string;
  className: string;
}) {
  const [imageSrc, setImageSrc] = useState(src || categoryPlaceholderImage);

  useEffect(() => {
    setImageSrc(src || categoryPlaceholderImage);
  }, [src]);

  return (
    <Image
      src={imageSrc}
      alt={alt}
      fill
      sizes={sizes}
      className={className}
      onError={() => setImageSrc(categoryPlaceholderImage)}
    />
  );
}

function AdminMedia({
  src,
  alt,
  priority = false,
  className = "object-cover",
  poster = "",
  objectPosition = "center",
}: {
  src: string;
  alt: string;
  priority?: boolean;
  className?: string;
  poster?: string;
  objectPosition?: string;
}) {
  if (!src) {
    return (
      <div className="grid h-full min-h-[240px] place-items-center bg-[#f3efe6] text-sm font-medium text-[#8a6a30]">
        Zylo-Buylo
      </div>
    );
  }

  if (isVideoMedia(src)) {
    return (
      <video
        src={src}
        className={`h-full w-full ${className}`}
        autoPlay
        muted
        loop
        playsInline
        poster={poster || undefined}
        aria-label={alt}
        style={{ objectPosition }}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      priority={priority}
      sizes="(min-width: 1024px) 52vw, 100vw"
      className={className}
      style={{ objectPosition }}
    />
  );
}

function SectionHeader({
  title,
  href,
  label = "View all",
}: {
  title: string;
  href?: string;
  label?: string;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="font-serif text-xl font-semibold text-[#241f18] md:text-3xl">{title}</h2>
      {href && (
        <Link
          href={href}
          className="shrink-0 text-xs font-medium uppercase text-[#8a6a30] hover:text-[#241f18]"
        >
          {label}
        </Link>
      )}
    </div>
  );
}

function heroOverlayClass(strength: string) {
  if (strength === "light") {
    return "from-[#17130f]/62 via-[#17130f]/24 to-transparent";
  }

  if (strength === "strong") {
    return "from-[#17130f]/94 via-[#17130f]/54 to-[#17130f]/12";
  }

  return "from-[#17130f]/88 via-[#17130f]/36 to-transparent";
}

function heroTextPositionClass(position: string) {
  const normalized = position || "left";

  if (normalized === "center") {
    return "items-center justify-center";
  }

  if (normalized === "right" || normalized === "center-right") {
    return "items-center justify-end";
  }

  if (normalized === "bottom-left") {
    return "items-end justify-start";
  }

  if (normalized === "bottom-right") {
    return "items-end justify-end";
  }

  return "items-center justify-start";
}

function heroTextAlignClass(align: string) {
  if (align === "center") return "text-center";
  if (align === "right") return "text-right";
  return "text-left";
}

export default function HomePageClient({
  initialProducts = [],
  initialCategories = [],
  initialHomepageContent = defaultHomepageContent,
}: HomePageClientProps) {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [categoryRows, setCategoryRows] =
    useState<PublicCategoryNode[]>(initialCategories);
  const [homepageContent, setHomepageContent] = useState<HomepageContent>(
    initialHomepageContent,
  );
  const [search, setSearch] = useState("");
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [activeHeroSlide, setActiveHeroSlide] = useState(0);
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  const cartCount = useCartStore((state) => state.getTotalItems());
  const clearCart = useCartStore((state) => state.clearCart);
  const addCartItem = useCartStore((state) => state.addItem);
  const addWishlistItem = useWishlistStore((state) => state.addItem);
  const removeWishlistItem = useWishlistStore((state) => state.removeItem);
  const isInWishlist = useWishlistStore((state) => state.isInWishlist);

  const heroSlides = homepageContent.heroSlides.filter((slide) => slide.active !== false).length
    ? homepageContent.heroSlides.filter((slide) => slide.active !== false)
    : defaultHomepageContent.heroSlides;
  const quickShopLinks = homepageContent.quickShopLinks.length
    ? homepageContent.quickShopLinks
    : defaultHomepageContent.quickShopLinks;
  const brandShortcuts = homepageContent.brandShortcuts.length
    ? homepageContent.brandShortcuts
    : defaultHomepageContent.brandShortcuts;
  const dealCards = homepageContent.dealCards.length
    ? homepageContent.dealCards
    : defaultHomepageContent.dealCards;
  const discountBanner =
    homepageContent.discountBanner || defaultHomepageContent.discountBanner;
  const activePromoBanners = homepageContent.promoBanners
    .filter((banner) => banner.active !== false)
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));

  useEffect(() => {
    const controller = new AbortController();

    async function loadHomeData() {
      try {
        const [productsResponse, categoriesResponse, authResponse, contentResponse] =
          await Promise.all([
            initialProducts.length
              ? Promise.resolve(null)
              : fetch("/api/products?limit=24&sort=popular", {
                  signal: controller.signal,
                }),
            initialCategories.length
              ? Promise.resolve(null)
              : fetch("/api/categories", { signal: controller.signal }),
            fetch("/api/auth/me", {
              cache: "no-store",
              credentials: "include",
              signal: controller.signal,
            }),
            initialHomepageContent !== defaultHomepageContent
              ? Promise.resolve(null)
              : fetch("/api/homepage-content", {
                  cache: "no-store",
                  signal: controller.signal,
                }),
          ]);

        if (controller.signal.aborted) return;

        if (productsResponse?.ok) {
          const data = await productsResponse.json();
          setProducts(data.products || []);
        }

        if (categoriesResponse?.ok) {
          const data = await categoriesResponse.json();
          setCategoryRows(normalizePublicCategoryTree(data));
        }

        if (contentResponse?.ok) {
          const data = await contentResponse.json();
          setHomepageContent(normalizeHomepageContent(data.content));
        }

        if (authResponse.ok) {
          const data = await authResponse.json();
          setCurrentUser(data.user || null);
        } else {
          setCurrentUser(null);
        }
      } catch {
        if (!controller.signal.aborted) {
          setCurrentUser(null);
        }
      } finally {
        if (!controller.signal.aborted) {
          setAuthLoaded(true);
        }
      }
    }

    loadHomeData();
    return () => controller.abort();
  }, [initialCategories.length, initialHomepageContent, initialProducts.length]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveHeroSlide((current) => (current + 1) % Math.max(heroSlides.length, 1));
    }, 6500);

    return () => window.clearInterval(timer);
  }, [heroSlides.length]);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const syncViewport = () => setIsMobileViewport(query.matches);
    syncViewport();
    query.addEventListener("change", syncViewport);
    return () => query.removeEventListener("change", syncViewport);
  }, []);

  const departments = useMemo(
    () => buildDepartmentNavigation(categoryRows),
    [categoryRows],
  );
  const categoryShortcuts = useMemo(
    () => categoryRows.filter((category) => category.homepageVisible !== false).slice(0, 12),
    [categoryRows],
  );
  const productsForYou = useMemo(() => products.slice(0, 24), [products]);
  const newArrivals = useMemo(() => products.slice(0, 12), [products]);
  const bestDeals = useMemo(
    () =>
      [...products]
        .filter((product) => getProductDiscountPercent(product) > 0)
        .sort(
          (a, b) =>
            getProductDiscountPercent(b) - getProductDiscountPercent(a) ||
            Number(a.price) - Number(b.price),
        )
        .slice(0, 12),
    [products],
  );
  const categoryRails = useMemo(
    () => buildCategoryProductRails(categoryRows, products, 4),
    [categoryRows, products],
  );
  const supportedDealShortcuts = useMemo(
    () =>
      [
        ...dealCards.map((item) => ({
          title: item.title,
          text: item.text,
          href: safeInternalRoute(item.href),
        })),
        ...quickShopLinks.map((item) => ({
          title: item.title,
          text: item.text,
          href: safeInternalRoute(item.href),
        })),
        ...homepageV2DealShortcuts,
      ].slice(0, 8),
    [dealCards, quickShopLinks],
  );

  const activeHero =
    heroSlides[activeHeroSlide % Math.max(heroSlides.length, 1)] ||
    defaultHomepageContent.heroSlides[0];
  const heroMediaSrc =
    isMobileViewport && activeHero.mobileImage ? activeHero.mobileImage : activeHero.image;
  const shopperBanner =
    activePromoBanners.find((banner) => banner.placement === "shopper") ||
    homepageContent.promoBanner ||
    defaultHomepageContent.promoBanners[0];
  const sellerBanner =
    activePromoBanners.find((banner) => banner.placement === "seller") ||
    defaultHomepageContent.promoBanners[1];
  const shopperBannerImage =
    isMobileViewport && shopperBanner.mobileImage
      ? shopperBanner.mobileImage
      : shopperBanner.image;
  const sectionByKey = new Map(homepageContent.sections.map((section) => [section.key, section]));
  const getSection = (key: string) =>
    sectionByKey.get(key) || defaultHomepageContent.sections.find((section) => section.key === key);
  const isSectionEnabled = (key: string) => getSection(key)?.enabled !== false;
  const accountHref =
    currentUser?.role === "ADMIN"
      ? "/admin/dashboard"
      : currentUser?.role === "VENDOR"
        ? "/vendor/dashboard"
        : currentUser
          ? "/profile"
          : "/login?role=customer&next=/profile";
  const accountLabel = currentUser
    ? currentUser.vendorProfile?.storeName ||
      currentUser.name ||
      currentUser.email.split("@")[0]
    : authLoaded
      ? "Login"
      : "Account";

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = search.trim();
    router.push(query ? `/products?search=${encodeURIComponent(query)}` : "/products");
  }

  async function logout() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      clearCart();
      setCurrentUser(null);
      router.refresh();
    }
  }

  function productCategory(product: Product) {
    return product.subcategory?.name || product.category?.name || "Product";
  }

  function toggleWishlist(event: MouseEvent<HTMLButtonElement>, product: Product) {
    event.preventDefault();
    const wishlistId = getWishlistId(product.id);

    if (isInWishlist(wishlistId)) {
      removeWishlistItem(wishlistId);
      return;
    }

    addWishlistItem({
      id: wishlistId,
      name: product.name,
      category: productCategory(product),
      price: Number(product.price),
      mrp: product.mrp || undefined,
      discountPercent: product.discountPercent || undefined,
      image: product.images?.[0] || fallbackImage,
    });
  }

  function addToCart(event: MouseEvent<HTMLButtonElement>, product: Product) {
    event.preventDefault();
    addCartItem({
      id: product.id,
      name: product.name,
      category: productCategory(product),
      price: Number(product.price),
      mrp: product.mrp || undefined,
      discountPercent: product.discountPercent || undefined,
      image: product.images?.[0] || fallbackImage,
      shippingCharge: 0,
    });
  }

  function renderProductCard(product: Product, eager = false) {
    const text = compactProductCardText(product);
    const discount = getProductDiscountPercent(product);
    const wishlistId = getWishlistId(product.id);

    return (
      <article className="group min-w-0 overflow-hidden rounded-md border border-[#e7ded0] bg-[#fffdf8] shadow-[0_10px_28px_rgba(42,35,25,0.06)] transition hover:-translate-y-0.5 hover:border-[#c8a85f] hover:shadow-[0_16px_34px_rgba(42,35,25,0.1)] md:min-w-[190px]">
        <Link href={`/products/${product.id}`} className="block">
          <div className="relative aspect-[4/5] bg-[#f3efe6] md:aspect-square">
            <Image
              src={product.images?.[0] || fallbackImage}
              alt={product.name}
              fill
              priority={eager}
              sizes="(min-width: 1280px) 210px, (min-width: 768px) 25vw, 46vw"
              className="object-contain p-2 transition duration-300 group-hover:scale-[1.03] md:p-3"
            />
            {discount > 0 && (
              <span className="absolute left-1.5 top-1.5 rounded-sm bg-[#241f18] px-1.5 py-0.5 text-[9px] font-medium text-[#f6e7bb] md:left-2 md:top-2 md:py-1 md:text-[10px]">
                {discount}% OFF
              </span>
            )}
          </div>
        </Link>
        <div className="min-h-[96px] p-2.5 md:min-h-[112px] md:p-3">
          <div className="flex items-start gap-2">
            <Link href={`/products/${product.id}`} className="min-w-0 flex-1">
              <h3 className="line-clamp-2 min-h-8 text-xs font-normal leading-4 text-[#2b261f] md:min-h-9 md:text-sm md:leading-[18px]">
                {text.title}
              </h3>
            </Link>
            <button
              type="button"
              onClick={(event) => toggleWishlist(event, product)}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[#e1d4c0] bg-white text-base text-[#6f5630]"
              aria-label={isInWishlist(wishlistId) ? "Remove from wishlist" : "Save to wishlist"}
            >
              {isInWishlist(wishlistId) ? "♥" : "♡"}
            </button>
          </div>
          <div className="mt-1.5 flex items-end gap-1.5 md:mt-2">
            <p className="text-sm font-semibold text-[#241f18] md:text-base">{priceLabel(product.price)}</p>
            {product.mrp && product.mrp > product.price && (
              <p className="pb-0.5 text-xs text-[#9a9288] line-through">
                {priceLabel(product.mrp)}
              </p>
            )}
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-[#756a5e] md:mt-2 md:text-[11px]">
            <span>{getProductRating(product.id)} | {getProductReviewCount(product.id)}</span>
            <span className="truncate">{text.stockBadge}</span>
          </div>
          <button
            type="button"
            onClick={(event) => addToCart(event, product)}
            className="mt-2 h-8 w-full rounded-sm border border-[#2b261f] bg-[#2b261f] text-[11px] font-medium uppercase text-[#fffaf1] hover:bg-[#111] md:h-9 md:text-xs"
          >
            Add
          </button>
        </div>
      </article>
    );
  }

  function renderProductRail(title: string, railProducts: Product[], href: string) {
    if (!railProducts.length) return null;

    return (
      <section className="mx-auto max-w-7xl px-3 py-5 md:px-5">
        <SectionHeader title={title} href={href} />
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:gap-3 lg:grid-cols-5 xl:grid-cols-6">
          {railProducts.map((product, index) => (
            <div key={product.id}>{renderProductCard(product, index < 2)}</div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <main className="min-h-screen w-full max-w-full bg-[#f8f4ec] pb-24 text-[#241f18] md:pb-0">
      <div className="border-b border-[#eee5d6] bg-[#241f18] text-[#f8ead0]">
        <div className="mx-auto flex max-w-7xl min-w-0 items-center justify-between gap-3 px-3 py-1.5 text-[11px] md:px-5">
          <span className="hidden md:inline">Premium multivendor marketplace</span>
          <div className="zylo-home-scroll-row flex min-w-0 max-w-full gap-4 overflow-x-auto overscroll-x-contain md:w-auto md:justify-end md:overflow-visible">
            <Link href="/products?offer=true" className="shrink-0 hover:text-white">
              Top Deals
            </Link>
            <Link href="/vendor/register" className="shrink-0 hover:text-white">
              Sell on Zylo-Buylo
            </Link>
            <Link href="/orders" className="shrink-0 hover:text-white">
              Track Order
            </Link>
          </div>
        </div>
      </div>

      <header className="sticky top-0 z-50 w-full max-w-full border-b border-[#e7dcc8] bg-[#fffdf8] shadow-[0_8px_24px_rgba(42,35,25,0.07)]">
        <div className="mx-auto flex max-w-7xl min-w-0 items-center gap-2 px-3 py-3 md:gap-4 md:px-5">
          <Link href="/" className="flex min-w-0 shrink-0 items-center" aria-label="Zylo-Buylo - Buy Smart, Sell Easy">
            <ZyloBrandLogo />
          </Link>
          <form
            onSubmit={submitSearch}
            className="flex h-11 min-w-0 flex-1 items-center rounded-sm border border-[#d8cbb8] bg-white px-2.5 sm:px-3"
          >
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search products, categories and brands"
              className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
            <button
              type="submit"
              className="rounded-sm bg-[#241f18] px-3 py-2 text-xs font-medium uppercase text-[#fffaf1]"
            >
              Search
            </button>
          </form>
          <nav className="hidden items-center gap-4 text-sm font-medium lg:flex">
            <Link href={accountHref} className="text-[#241f18] hover:text-[#8a6a30]">
              {accountLabel}
            </Link>
            {currentUser && (
              <button
                type="button"
                onClick={logout}
                className="text-[#756a5e] hover:text-[#8a6a30]"
              >
                Logout
              </button>
            )}
            <Link
              href="/wishlist"
              className="inline-flex items-center gap-1.5 font-semibold text-[#241f18] hover:text-[#8a6a30]"
            >
              <span className="text-base leading-none text-[#b58b3b]" aria-hidden="true">
                ♡
              </span>
              <span>Wishlist</span>
            </Link>
            <Link href="/cart" className="hover:text-[#8a6a30]">
              Cart ({cartCount})
            </Link>
            <Link href="/vendor/register" className="hover:text-[#8a6a30]">
              Become Vendor
            </Link>
          </nav>
        </div>
        <div className="border-t border-[#eee5d6] bg-[#fffaf1]">
          <div className="zylo-home-scroll-row mx-auto flex w-full max-w-7xl min-w-0 gap-2 overflow-x-auto overscroll-x-contain px-3 py-2 md:px-5">
            {departments.map((department) => (
              <div key={department.id} className="group shrink-0">
                <Link
                  href={department.href}
                  className="block rounded-full px-3 py-2 text-sm font-medium text-[#3a3329] hover:bg-white hover:text-[#8a6a30]"
                >
                  {department.name}
                </Link>
                {department.children.length > 0 && (
                  <div className="invisible absolute left-0 right-0 top-full z-40 hidden border-t border-[#e7dcc8] bg-[#fffdf8] opacity-0 shadow-xl transition group-hover:visible group-hover:opacity-100 lg:block">
                    <div className="mx-auto grid max-w-7xl grid-cols-4 gap-6 px-5 py-6">
                      {department.children.slice(0, 8).map((subcategory) => (
                        <div key={subcategory.id}>
                          <Link
                            href={subcategory.href}
                            className="font-medium text-[#241f18] hover:text-[#8a6a30]"
                          >
                            {subcategory.name}
                          </Link>
                          <div className="mt-3 space-y-2">
                            {subcategory.productTypes.map((productType) => (
                              <Link
                                key={productType.id}
                                href={productType.href}
                                className="block text-sm text-[#756a5e] hover:text-[#8a6a30]"
                              >
                                {productType.name}
                              </Link>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </header>

      <section className="w-full max-w-full overflow-x-clip bg-[#fffaf1]">
        <div className="w-full max-w-full py-0 md:py-4">
          <div className="relative min-h-[360px] w-full max-w-full overflow-hidden bg-[#241f18] text-white sm:min-h-[390px] md:min-h-[590px]">
            <AdminMedia
              src={heroMediaSrc}
              alt={activeHero.imageAlt || activeHero.title}
              priority
              poster={activeHero.videoPoster}
              className="object-cover object-center"
              objectPosition={activeHero.objectPosition || "center"}
            />
            <div className={`absolute inset-0 bg-gradient-to-r ${heroOverlayClass(activeHero.overlayStrength)}`} />
            <div className={`absolute inset-0 flex px-4 py-8 md:px-14 md:py-10 ${heroTextPositionClass(activeHero.textPosition)}`}>
              <div className={`w-[min(88vw,32rem)] md:w-[38vw] md:max-w-[34rem] ${heroTextAlignClass(activeHero.textAlign)}`}>
                <p className="text-xs font-medium uppercase tracking-[0.24em] text-[#f2d28b]">
                  {activeHero.eyebrow}
                </p>
                <h1 className="mt-3 font-serif text-3xl font-semibold leading-tight sm:text-4xl md:mt-4 md:text-7xl">
                  {activeHero.title}
                </h1>
                <p className="mt-3 max-w-md text-sm font-light leading-6 text-white/86 md:mt-4 md:text-base">
                  {activeHero.text}
                </p>
                <div className="mt-5 flex flex-wrap gap-3 md:mt-6">
                  <Link
                    href={safeInternalRoute(activeHero.primaryHref)}
                    className="rounded-sm bg-[#fffaf1] px-5 py-2.5 text-xs font-medium uppercase text-[#241f18] md:px-6 md:py-3 md:text-sm"
                  >
                    {activeHero.primaryLabel || "Shop Now"}
                  </Link>
                </div>
              </div>
            </div>
            <div className="absolute bottom-4 left-4 flex max-w-[calc(100%-2rem)] gap-2 md:bottom-5 md:left-14">
              {heroSlides.map((slide, index) => (
                <button
                  key={`${slide.title}-${index}`}
                  type="button"
                  onClick={() => setActiveHeroSlide(index)}
                  className={`h-1.5 rounded-full transition ${
                    index === activeHeroSlide ? "w-10 bg-[#f2d28b]" : "w-5 bg-white/45"
                  }`}
                  aria-label={`Show hero ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {isSectionEnabled("categories") && (
      <section className="mx-auto w-full max-w-7xl min-w-0 px-3 py-6 md:px-5">
        <SectionHeader title={getSection("categories")?.title || "Shop by Category"} href="/products" />
        <div className="zylo-home-scroll-row flex min-w-0 max-w-full gap-3 overflow-x-auto overscroll-x-contain pb-1 md:grid md:grid-cols-6 md:overflow-visible lg:grid-cols-8">
          {categoryShortcuts.slice(0, getSection("categories")?.limit || 12).map((category) => (
            <Link
              key={category.id}
              href={getCategoryHref(category)}
              className="group w-[122px] shrink-0 rounded-sm bg-[#fffdf8] p-2 text-center shadow-[0_8px_22px_rgba(42,35,25,0.05)] ring-1 ring-[#e7dcc8] transition hover:-translate-y-0.5 hover:ring-[#c8a85f] md:w-auto"
            >
              <div className="relative mx-auto aspect-square w-full overflow-hidden rounded-md bg-[#f5f3f6]">
                <CategoryImage
                  src={getCategorySmallImage(category)}
                  alt={category.altText || category.name}
                  sizes="(min-width: 1024px) 130px, 110px"
                  className="object-cover transition duration-300 group-hover:scale-105"
                />
              </div>
              <p className="mt-2 line-clamp-2 min-h-9 text-xs font-medium leading-[17px] text-[#2b261f]">
                {category.name}
              </p>
            </Link>
          ))}
        </div>
      </section>
      )}

      {isSectionEnabled("shortcuts") && (
      <section className="mx-auto w-full max-w-7xl min-w-0 px-3 py-4 md:px-5">
        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
          <Link
            href={safeInternalRoute(shopperBanner.href)}
            className="relative min-h-[250px] overflow-hidden rounded-sm bg-[#efe4d2]"
          >
            <AdminMedia src={shopperBannerImage} alt={shopperBanner.imageAlt} />
            <div className="absolute inset-0 bg-gradient-to-r from-[#fffaf1]/95 via-[#fffaf1]/72 to-transparent" />
            <div className="absolute inset-0 flex max-w-sm flex-col justify-center p-7">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#8a6a30]">
                {shopperBanner.eyebrow}
              </p>
              <h2 className="mt-3 font-serif text-3xl font-semibold text-[#241f18] md:text-4xl">
                {shopperBanner.title}
              </h2>
              <p className="mt-3 line-clamp-2 text-sm leading-6 text-[#63594e]">
                {shopperBanner.text}
              </p>
              <span className="mt-5 text-sm font-medium uppercase text-[#241f18]">
                {shopperBanner.ctaLabel}
              </span>
            </div>
          </Link>
          <Link
            href={safeInternalRoute(sellerBanner.href, "/vendor/register")}
            className="grid min-h-[250px] rounded-sm border border-[#d9c7a6] bg-[#241f18] p-7 text-[#fffaf1] md:grid-cols-[1fr_0.76fr]"
          >
            <div className="self-center">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#f2d28b]">
                {sellerBanner.eyebrow}
              </p>
              <h2 className="mt-3 font-serif text-3xl font-semibold md:text-4xl">
                {sellerBanner.title}
              </h2>
              <p className="mt-3 text-sm leading-6 text-white/72">
                {sellerBanner.text}
              </p>
            </div>
            <div className="mt-5 grid content-end gap-2 text-sm text-[#f2d28b] md:mt-0">
              <span>{sellerBanner.ctaLabel}</span>
              <span>Secure Payments</span>
              <span>Dedicated Support</span>
            </div>
          </Link>
        </div>
      </section>
      )}

      {isSectionEnabled("shortcuts") && (
      <section className="mx-auto max-w-7xl px-3 py-2 md:px-5">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
          {supportedDealShortcuts.slice(0, getSection("shortcuts")?.limit || 8).map((item) => (
            <Link
              key={`${item.title}-${item.href}`}
              href={safeInternalRoute(item.href)}
              className="rounded-sm bg-[#fffdf8] px-3 py-3 shadow-sm ring-1 ring-[#e7dcc8] hover:ring-[#c8a85f]"
            >
              <p className="text-sm font-medium text-[#241f18]">{item.title}</p>
              {item.text && <p className="mt-1 text-xs text-[#756a5e]">{item.text}</p>}
            </Link>
          ))}
        </div>
      </section>
      )}

      {isSectionEnabled("productsForYou") &&
        renderProductRail(getSection("productsForYou")?.title || "Products For You", productsForYou.slice(0, getSection("productsForYou")?.limit || 24), "/products")}

      {isSectionEnabled("bestDeals") &&
        bestDeals.length > 0 &&
        renderProductRail(getSection("bestDeals")?.title || "Best Deals", bestDeals.slice(0, getSection("bestDeals")?.limit || 12), "/products?offer=true")}

      <section className="mx-auto max-w-7xl px-3 py-5 md:px-5">
        <Link
          href={safeInternalRoute(discountBanner.href)}
          className="relative grid min-h-[230px] overflow-hidden rounded-sm bg-[#2b261f] text-white md:grid-cols-[1fr_0.72fr]"
        >
          <div className="relative z-10 p-6 md:p-8">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#f2d28b]">
              {discountBanner.eyebrow}
            </p>
            <h2 className="mt-2 font-serif text-3xl font-semibold md:text-5xl">
              {discountBanner.title}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/80">
              {discountBanner.text}
            </p>
            <span className="mt-5 inline-flex rounded-sm bg-[#fffaf1] px-5 py-3 text-sm font-medium uppercase text-[#241f18]">
              {discountBanner.ctaLabel}
            </span>
          </div>
          <div className="relative min-h-[210px]">
            <AdminMedia src={discountBanner.image} alt={discountBanner.imageAlt} />
            <div className="absolute left-4 top-4 rounded-full border-4 border-white/50 bg-[#241f18] px-5 py-4 text-3xl font-semibold text-[#f2d28b]">
              {discountBanner.percent}
            </div>
          </div>
        </Link>
      </section>

      {isSectionEnabled("newArrivals") &&
        renderProductRail(getSection("newArrivals")?.title || "New Arrivals", newArrivals.slice(0, getSection("newArrivals")?.limit || 12), "/products?sort=new")}

      {isSectionEnabled("brands") && brandShortcuts.length > 0 && (
        <section className="mx-auto max-w-7xl px-3 py-5 md:px-5">
          <SectionHeader title={getSection("brands")?.title || "Shop by Brand"} href="/products" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
            {brandShortcuts.slice(0, getSection("brands")?.limit || 12).map((brand) => (
              <Link
                key={brand.slug}
                href={`/products?brand=${encodeURIComponent(brand.slug)}`}
                className="grid min-h-[92px] place-items-center rounded-sm bg-[#fffdf8] p-4 text-center shadow-sm ring-1 ring-[#e7dcc8] hover:ring-[#c8a85f]"
              >
                <span className="text-sm font-medium text-[#241f18]">{brand.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {categoryRails.map((rail) => (
        <div key={rail.id}>
          {renderProductRail(rail.title, rail.products, rail.href)}
        </div>
      ))}

      <section className="mx-auto max-w-7xl px-3 py-5 md:px-5">
        <div className="grid gap-4 rounded-sm bg-[#fffdf8] p-5 shadow-sm ring-1 ring-[#e7dcc8] md:grid-cols-[1.1fr_0.9fr] md:p-7">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#8a6a30]">
              Sell on Zylo-Buylo
            </p>
            <h2 className="mt-2 font-serif text-2xl font-semibold md:text-4xl">
              Manage products, stock, dispatch and payouts in one dashboard
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5d6674]">
              Vendor tools are built into the current Zylo-Buylo workflow, with
              warehouse, inventory and KYC systems ready for operating teams.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 md:justify-end">
            <Link
              href="/vendor/register"
              className="rounded-sm bg-[#241f18] px-5 py-3 text-sm font-medium uppercase text-[#fffaf1]"
            >
              Become a vendor
            </Link>
            <Link
              href="/login?role=vendor"
              className="rounded-sm border border-[#241f18] px-5 py-3 text-sm font-medium uppercase text-[#241f18]"
            >
              Vendor login
            </Link>
          </div>
        </div>
      </section>

      <section className="border-y border-[#e7dcc8] bg-[#fffdf8]">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-3 py-5 text-sm md:grid-cols-4 md:px-5">
          {[
            ["Trusted sellers", "Approved vendor catalogue"],
            ["Protected checkout", "Secure payment workflow"],
            ["Easy returns", "Return and evidence support"],
            ["Fast support", "Order, wallet and dispatch help"],
          ].map(([title, text]) => (
            <div key={title}>
              <p className="font-medium text-[#241f18]">{title}</p>
              <p className="mt-1 text-[#6b7280]">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-3 py-6 md:px-5">
        <div className="rounded-sm bg-[#241f18] p-5 text-white md:flex md:items-center md:justify-between md:p-7">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#f2d28b]">
              App-ready shopping
            </p>
            <h2 className="mt-2 font-serif text-2xl font-semibold">
              Add Zylo-Buylo to your home screen
            </h2>
          </div>
          <Link
            href="/products"
            className="mt-4 inline-flex rounded-sm bg-[#fffaf1] px-5 py-3 text-sm font-medium uppercase text-[#241f18] md:mt-0"
          >
            Continue shopping
          </Link>
        </div>
      </section>

      <footer className="bg-[#fffaf1] pb-20 pt-8 md:pb-8">
        <div className="mx-auto grid max-w-7xl gap-6 px-3 text-sm text-[#5d6674] md:grid-cols-4 md:px-5">
          <div>
            <Link
              href="/"
              className="inline-flex items-center"
              aria-label="Zylo-Buylo - Buy Smart, Sell Easy"
            >
              <ZyloBrandLogo mode="horizontal" className="h-10" />
            </Link>
            <p className="mt-3 leading-6">
              Marketplace shopping for products, sellers, stock and service
              workflows.
            </p>
          </div>
          <div>
            <p className="font-medium text-[#241f18]">Shop</p>
            <div className="mt-3 space-y-2">
              <Link href="/products" className="block hover:text-[#8a6a30]">
                Products
              </Link>
              <Link href="/wishlist" className="block hover:text-[#8a6a30]">
                Wishlist
              </Link>
              <Link href="/cart" className="block hover:text-[#8a6a30]">
                Cart
              </Link>
            </div>
          </div>
          <div>
            <p className="font-medium text-[#241f18]">Account</p>
            <div className="mt-3 space-y-2">
              <Link href="/login" className="block hover:text-[#8a6a30]">
                Login
              </Link>
              <Link href="/profile" className="block hover:text-[#8a6a30]">
                Profile
              </Link>
              <Link href="/orders" className="block hover:text-[#8a6a30]">
                Orders
              </Link>
            </div>
          </div>
          <div>
            <p className="font-medium text-[#241f18]">Sell</p>
            <div className="mt-3 space-y-2">
              <Link href="/vendor/register" className="block hover:text-[#8a6a30]">
                Become Vendor
              </Link>
              <Link href="/vendor/dashboard" className="block hover:text-[#8a6a30]">
                Vendor Dashboard
              </Link>
            </div>
          </div>
        </div>
      </footer>

      <MobileNavbar />
    </main>
  );
}
