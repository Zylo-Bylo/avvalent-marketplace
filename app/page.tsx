"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import MobileNavbar from "@/components/MobileNavbar";
import {
  applianceCategoryTree,
  getPartHref,
} from "@/data/category-tree";
import {
  defaultHomepageContent,
  normalizeHomepageContent,
  type HomepageContent,
} from "@/lib/homepage-content";
import { useCartStore } from "@/store/cart-store";
import { useWishlistStore } from "@/store/wishlist-store";

type Subcategory = {
  id: string;
  name: string;
  categoryId: string;
};

type Category = {
  id: string;
  name: string;
  slug?: string;
  subcategories?: Subcategory[];
};

type Product = {
  id: string;
  name: string;
  price: number;
  mrp?: number | null;
  discountPercent?: number | null;
  inventory?: number | null;
  images: string[];
  categoryId?: string | null;
  subcategoryId?: string | null;
  category?: {
    name: string;
  } | null;
  subcategory?: {
    name: string;
  } | null;
  vendor?: {
    storeName: string;
  } | null;
};

type CurrentUser = {
  id: string;
  email: string;
  name?: string | null;
  role: "CUSTOMER" | "VENDOR" | "ADMIN";
  vendorProfile?: {
    storeName?: string | null;
  } | null;
};

const fallbackImage = "https://placehold.co/900x900/png?text=ZYLO+BUYLO";

const categoryShortcuts = [
  { name: "Fashion", slug: "fashion", icon: "F" },
  { name: "Beauty", slug: "beauty", icon: "B" },
  { name: "Electronics", slug: "electronics", icon: "E" },
  { name: "Home & Kitchen", slug: "home-kitchen", icon: "HK" },
  { name: "AC Parts", slug: "ac-parts", icon: "AC" },
  { name: "TV Parts", slug: "tv-parts", icon: "TV" },
  { name: "Washing Machine Parts", slug: "washing-machine-parts", icon: "WM" },
  { name: "Mobile Accessories", slug: "mobile-accessories", icon: "MA" },
];

const promoShortcuts = [
  { title: "New Arrivals", text: "Fresh products from vendors", href: "/products?sort=new" },
  { title: "Best Sellers", text: "Popular marketplace picks", href: "/products?sort=popular" },
  { title: "Deals", text: "Discounted products and offers", href: "/products?offer=true" },
  { title: "Bulk Buy", text: "Stock-ready products for repeat orders", href: "/products?bulk=true" },
];

const brandShortcuts = [
  { name: "Samsung", slug: "samsung" },
  { name: "LG", slug: "lg" },
  { name: "Whirlpool", slug: "whirlpool" },
  { name: "IFB", slug: "ifb" },
  { name: "Haier", slug: "haier" },
  { name: "Bajaj", slug: "bajaj" },
  { name: "Boat", slug: "boat" },
  { name: "Noise", slug: "noise" },
];

const quickShopLinks = [
  { title: "Under Rs. 199", href: "/products?maxPrice=199" },
  { title: "Under Rs. 499", href: "/products?maxPrice=499" },
  { title: "Best Deals", href: "/products?offer=true" },
  { title: "New Today", href: "/products?sort=new" },
  { title: "Spare Parts", href: "/products?category=ac-parts" },
  { title: "Bulk Buy", href: "/products?bulk=true" },
];

const trendingShortcuts = [
  { title: "Trending Fashion", category: "fashion" },
  { title: "Trending Electronics", category: "electronics" },
  { title: "Trending Beauty", category: "beauty" },
  { title: "Trending Home Products", category: "home-kitchen" },
  { title: "Trending Spare Parts", category: "ac-parts" },
];

const topUtilityLinks = [
  { title: "Track Order", text: "Delivery progress", href: "/orders" },
  { title: "Contact", text: "Help and support", href: "/profile" },
  { title: "Best Sellers", text: "Top products", href: "/products?sort=popular" },
  { title: "Free Gifts", text: "Offers and deals", href: "/products?offer=true" },
  { title: "Bulk Purchase", text: "Vendor stock", href: "/products?bulk=true" },
];

const heroSlides = [
  {
    eyebrow: "Zylo-Buylo marketplace sale",
    title: "Shop smart, sell easy",
    highlight: "Trusted vendors. Better prices.",
    text: "Fashion, beauty, electronics, home products and appliance parts from verified sellers.",
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
];

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

function firstPartHref(category: (typeof applianceCategoryTree)[number]) {
  const group = category.groups[0];
  const item = group?.parts[0];

  if (!group || !item) {
    return "/products";
  }

  return getPartHref(category.slug, group.slug, item.slug);
}

function categoryInitial(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isVideoMedia(src: string) {
  return /\.(mp4|webm|ogg)(\?|#|$)/i.test(src);
}

function AdminManagedMedia({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className: string;
}) {
  if (isVideoMedia(src)) {
    return (
      <video
        src={src}
        className={className}
        autoPlay
        muted
        loop
        playsInline
        aria-label={alt}
      />
    );
  }

  return <img src={src} alt={alt} className={className} loading="lazy" />;
}

function SmartBannerMedia({
  src,
  alt,
  className = "",
  mediaClassName = "",
  badge,
}: {
  src: string;
  alt: string;
  className?: string;
  mediaClassName?: string;
  badge?: string;
}) {
  const isVideo = isVideoMedia(src);

  if (!src) {
    return (
      <div
        className={`grid h-full min-h-[150px] w-full place-items-center bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.94),rgba(255,245,250,0.82)_48%,rgba(107,20,93,0.12))] text-xs font-black uppercase tracking-wide text-[#6b145d] ${className}`}
      >
        Banner media
      </div>
    );
  }

  return (
    <div
      className={`relative h-full min-h-[150px] w-full overflow-hidden bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.94),rgba(255,245,250,0.82)_48%,rgba(107,20,93,0.12))] ${className}`}
    >
      {!isVideo && src && (
        <AdminManagedMedia
          src={src}
          alt=""
          className="absolute inset-0 h-full w-full scale-110 object-cover opacity-20 blur-xl"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-br from-white/70 via-transparent to-[#6b145d]/10" />
      <AdminManagedMedia
        src={src}
        alt={alt}
        className={`relative z-10 h-full w-full object-contain p-2 sm:p-3 ${mediaClassName}`}
      />
      {badge && (
        <div className="absolute right-3 top-3 z-20 hidden rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-black uppercase text-[#6b145d] shadow-lg md:block">
          {badge}
        </div>
      )}
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [categoryRows, setCategoryRows] = useState<Category[]>([]);
  const [homepageContent, setHomepageContent] = useState<HomepageContent>(
    defaultHomepageContent,
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [search, setSearch] = useState("");
  const [activeTreeSlug, setActiveTreeSlug] = useState(
    applianceCategoryTree[0]?.slug || "",
  );
  const [treeMenuOpen, setTreeMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [activeHeroSlide, setActiveHeroSlide] = useState(0);

  const cartCount = useCartStore((state) => state.getTotalItems());
  const addCartItem = useCartStore((state) => state.addItem);
  const clearCart = useCartStore((state) => state.clearCart);
  const addWishlistItem = useWishlistStore((state) => state.addItem);
  const removeWishlistItem = useWishlistStore((state) => state.removeItem);
  const isInWishlist = useWishlistStore((state) => state.isInWishlist);

  const heroSlides = homepageContent.heroSlides.length
    ? homepageContent.heroSlides
    : defaultHomepageContent.heroSlides;
  const topUtilityLinks = homepageContent.utilityLinks.length
    ? homepageContent.utilityLinks
    : defaultHomepageContent.utilityLinks;
  const quickShopLinks = homepageContent.quickShopLinks.length
    ? homepageContent.quickShopLinks
    : defaultHomepageContent.quickShopLinks;
  const brandShortcuts = homepageContent.brandShortcuts.length
    ? homepageContent.brandShortcuts
    : defaultHomepageContent.brandShortcuts;
  const promoBanner = homepageContent.promoBanner || defaultHomepageContent.promoBanner;
  const dealCards = homepageContent.dealCards.length
    ? homepageContent.dealCards
    : defaultHomepageContent.dealCards;
  const discountBanner =
    homepageContent.discountBanner || defaultHomepageContent.discountBanner;

  useEffect(() => {
    let isActive = true;

    async function loadHomeData() {
      const [
        productsResponse,
        categoriesResponse,
        authResponse,
        homepageContentResponse,
      ] = await Promise.all([
        fetch("/api/products?limit=24&sort=popular"),
        fetch("/api/categories"),
        fetch("/api/auth/me", { cache: "no-store", credentials: "include" }),
        fetch(`/api/homepage-content?t=${Date.now()}`, { cache: "no-store" }),
      ]);

      if (!isActive) {
        return;
      }

      if (productsResponse.ok) {
        const data = await productsResponse.json();
        setProducts(data.products || []);
      }

      if (categoriesResponse.ok) {
        const data = await categoriesResponse.json();
        setCategoryRows(data.categories || []);
      }

      if (authResponse.ok) {
        const data = await authResponse.json();
        setCurrentUser(data.user || null);
      } else {
        setCurrentUser(null);
      }

      if (homepageContentResponse.ok) {
        const data = await homepageContentResponse.json();
        setHomepageContent(normalizeHomepageContent(data.content));
      }

      setAuthLoaded(true);
    }

    loadHomeData();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveHeroSlide((current) => (current + 1) % Math.max(heroSlides.length, 1));
    }, 5500);

    return () => window.clearInterval(timer);
  }, [heroSlides.length]);

  const activeTreeCategory =
    applianceCategoryTree.find((category) => category.slug === activeTreeSlug) ||
    applianceCategoryTree[0];

  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesCategory =
      !selectedCategoryId || product.categoryId === selectedCategoryId;

    return matchesSearch && matchesCategory;
  });

  const topCategories = useMemo(() => categoryRows.slice(0, 10), [categoryRows]);
  const dealProducts = useMemo(
    () => [...filteredProducts].sort((a, b) => Number(a.price) - Number(b.price)),
    [filteredProducts],
  );
  const freshProducts = useMemo(
    () => [...filteredProducts].slice(0, 12),
    [filteredProducts],
  );
  const baseHero = heroSlides[0] || defaultHomepageContent.heroSlides[0];
  const activeHeroMedia =
    heroSlides[activeHeroSlide % Math.max(heroSlides.length, 1)] || baseHero;

  const userDisplayName =
    currentUser?.vendorProfile?.storeName ||
    currentUser?.name ||
    currentUser?.email?.split("@")[0] ||
    "";
  const accountHref =
    currentUser?.role === "ADMIN"
      ? "/admin/dashboard"
      : currentUser?.role === "VENDOR"
        ? "/vendor/dashboard"
        : currentUser
          ? "/profile"
          : "/login?role=customer&next=/profile";
  const accountTopLabel = currentUser
    ? currentUser.role === "ADMIN"
      ? "Admin"
      : currentUser.role === "VENDOR"
        ? "Vendor"
        : "Hello"
    : authLoaded
      ? "Hello, sign in"
      : "Checking account";
  const accountBottomLabel = currentUser
    ? userDisplayName
    : "Account";
  const deliveryTopLabel = currentUser ? "Deliver to" : "Delivery";
  const deliveryBottomLabel = currentUser
    ? userDisplayName
    : authLoaded
      ? "Sign in to set location"
      : "Checking location";

  function getCategoryName(product: Product) {
    return product.subcategory?.name || product.category?.name || "Product";
  }

  function getCategoryPreviewImage(category: Category) {
    const categorySlug = category.slug || slugify(category.name);
    const match = products.find((product) => {
      const productCategorySlug = product.category?.name
        ? slugify(product.category.name)
        : "";

      return (
        product.categoryId === category.id ||
        productCategorySlug === categorySlug ||
        product.category?.name?.toLowerCase() === category.name.toLowerCase()
      );
    });

    return match?.images?.[0] || fallbackImage;
  }

  function chooseCategory(categoryId: string) {
    setSelectedCategoryId(categoryId);
  }

  function getProductsSearchHref() {
    const params = new URLSearchParams();

    if (search.trim()) {
      params.set("search", search.trim());
    }

    if (selectedCategoryId) {
      params.set("categoryId", selectedCategoryId);
    }

    const query = params.toString();
    return query ? `/products?${query}` : "/products";
  }

  function submitHomeSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(getProductsSearchHref());
  }

  async function logoutFromHome() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      clearCart();
      setCurrentUser(null);
      setAccountMenuOpen(false);
      router.refresh();
    }
  }

  function handleWishlistClick(
    event: React.MouseEvent<HTMLButtonElement>,
    product: Product,
  ) {
    event.preventDefault();

    const wishlistId = getWishlistId(product.id);

    if (isInWishlist(wishlistId)) {
      removeWishlistItem(wishlistId);
      return;
    }

    addWishlistItem({
      id: wishlistId,
      name: product.name,
      category: getCategoryName(product),
      price: Number(product.price),
      mrp: product.mrp || undefined,
      discountPercent: product.discountPercent || undefined,
      image: product.images?.[0] || fallbackImage,
    });
  }

  function handleAddToCartClick(
    event: React.MouseEvent<HTMLButtonElement>,
    product: Product,
  ) {
    event.preventDefault();

    addCartItem({
      id: product.id,
      name: product.name,
      category: getCategoryName(product),
      price: Number(product.price),
      mrp: product.mrp || undefined,
      discountPercent: product.discountPercent || undefined,
      image: product.images?.[0] || fallbackImage,
      shippingCharge: 0,
    });
  }

  function handleBuyNowClick(
    event: React.MouseEvent<HTMLButtonElement>,
    product: Product,
  ) {
    handleAddToCartClick(event, product);
    router.push("/checkout");
  }

  function ProductTile({ product }: { product: Product }) {
    const wishlistId = getWishlistId(product.id);
    const hasDeal = Boolean(product.mrp && product.mrp > product.price);
    const available = Number(product.inventory || 0);

    return (
      <article className="group min-w-[215px] max-w-[215px] overflow-hidden rounded-2xl border border-[#f0d8e8] bg-white p-2.5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#9f2089] hover:shadow-xl">
        <div className="relative">
          <Link href={`/products/${product.id}`} className="block">
            <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-gradient-to-br from-[#fff8fc] to-[#f3f4f6]">
              <Image
                src={product.images?.[0] || fallbackImage}
                alt={product.name}
                fill
                sizes="215px"
                className="object-contain transition duration-300 group-hover:scale-105"
              />
            </div>
          </Link>
          <button
            type="button"
            onClick={(event) => handleWishlistClick(event, product)}
            className="absolute right-2 top-2 rounded-full bg-white px-2 py-1 text-xs font-bold text-[#b12704] shadow"
          >
            {isInWishlist(wishlistId) ? "Saved" : "Save"}
          </button>
        </div>
        <Link href={`/products/${product.id}`} className="block">
          <p className="mt-2 line-clamp-2 min-h-9 text-sm font-black leading-[18px] text-[#111827]">
            {product.name}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-[#565959]">
            {product.vendor?.storeName || getCategoryName(product)}
          </p>
        </Link>
        <p className="mt-1.5 text-lg font-black text-[#c2410c]">
          {priceLabel(product.price)}
        </p>
        {hasDeal && (
          <p className="text-[11px] text-[#565959]">
            <span className="line-through">{priceLabel(product.mrp || 0)}</span>{" "}
            <span className="font-bold text-green-700">
              {product.discountPercent || 0}% off
            </span>
          </p>
        )}
        <div className="mt-1.5 flex items-center gap-2 text-[11px]">
          <span className="rounded-full bg-green-600 px-2 py-0.5 font-bold text-white">
            3.{getWishlistId(product.id) % 5}
          </span>
          <span className="text-[#565959]">
            {available > 0 ? "In stock" : "Limited stock"}
          </span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={(event) => handleAddToCartClick(event, product)}
            className="rounded-lg bg-[#6b145d] px-2 py-2 text-[10px] font-black uppercase text-white shadow-sm hover:bg-[#8b2c72]"
          >
            Add
          </button>
          <button
            type="button"
            onClick={(event) => handleBuyNowClick(event, product)}
            className="rounded-lg border border-[#6b145d] bg-white px-2 py-2 text-[10px] font-black uppercase text-[#6b145d] hover:bg-[#fff4fb]"
          >
            Buy Now
          </button>
        </div>
      </article>
    );
  }

  return (
    <main className="min-h-screen overflow-x-clip bg-[#130817] bg-[radial-gradient(circle_at_top_left,rgba(159,32,137,0.24),transparent_30%),linear-gradient(180deg,#130817_0%,#1b0d21_42%,#0f1117_100%)] pb-24 text-[#111827] md:pb-0">
      <header className="sticky top-0 z-50 border-b border-[#e8d9e6] bg-white text-[#242334]">
        <div className="border-b border-[#f0e6ef] bg-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-2 text-xs">
            <div className="hidden items-center gap-4 font-bold uppercase text-[#4b5563] md:flex">
              <Link href="/" className="hover:text-[#6b145d]">Home</Link>
              <Link href="/supplier" className="hover:text-[#6b145d]">Sell on Zylo-Buylo</Link>
              <Link href="/products?bulk=true" className="hover:text-[#6b145d]">Wholesale Purchase</Link>
            </div>
            <div className="flex w-full items-center gap-2 overflow-x-auto md:w-auto md:justify-end">
              {topUtilityLinks.map((item) => (
                <Link
                  key={item.title}
                  href={item.href}
                  className="flex shrink-0 items-center gap-2 rounded-full border border-[#ead7e8] bg-[#fff8fc] px-3 py-2 text-left transition hover:border-[#9f2089] hover:bg-white"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-black text-[#6b145d] shadow-sm">
                    {item.title.slice(0, 1)}
                  </span>
                  <span>
                    <span className="block font-black text-[#111827]">{item.title}</span>
                    <span className="hidden text-[11px] text-[#6b7280] lg:block">{item.text}</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="hidden">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-3 py-4">
            <Link href="/" className="flex shrink-0 items-center gap-3">
              <span className="grid h-16 w-16 place-items-center rounded-full border-4 border-[#f1d3eb] bg-[#6b145d] text-2xl font-black text-white shadow-sm">
                Z
              </span>
              <span>
                <span className="block text-2xl font-black tracking-tight text-[#6b145d]">
                  Zylo-Buylo
                </span>
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a5b00]">
                  Smart marketplace
                </span>
              </span>
            </Link>

            <div className="grid flex-1 grid-cols-3 gap-4 lg:grid-cols-4">
              <Link href="/orders" className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-[#fff8fc]">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[#eef6ff] text-lg">📦</span>
                <span>
                  <span className="block text-sm font-black text-[#111827]">Track Your Order</span>
                  <span className="text-xs text-[#6b7280]">Delivery progress</span>
                </span>
              </Link>
              <Link href="/profile" className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-[#fff8fc]">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[#fff0f6] text-lg">✉</span>
                <span>
                  <span className="block text-sm font-black text-[#111827]">Contact</span>
                  <span className="text-xs text-[#6b7280]">Help and support</span>
                </span>
              </Link>
              <Link href="/products?offer=true" className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-[#fff8fc]">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[#fff7dd] text-lg">🎁</span>
                <span>
                  <span className="block text-sm font-black text-[#111827]">Free Gifts</span>
                  <span className="text-xs text-[#6b7280]">Offers and deals</span>
                </span>
              </Link>
              <Link href="/products?bulk=true" className="hidden items-center gap-3 rounded-xl px-3 py-2 hover:bg-[#fff8fc] lg:flex">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[#f0fdf4] text-lg">🛒</span>
                <span>
                  <span className="block text-sm font-black text-[#111827]">Bulk Purchase</span>
                  <span className="text-xs text-[#6b7280]">Vendor stock</span>
                </span>
              </Link>
            </div>
          </div>
        </div>

        <div>
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-3 py-2 md:flex-nowrap md:gap-3">
          <Link
            href="/"
            className="order-1 shrink-0 rounded-sm border border-transparent px-1 py-2 text-xl font-black tracking-tight text-[#6b145d] hover:border-[#6b145d]/20 sm:px-2 sm:text-2xl"
          >
            Zylo-Buylo
          </Link>

          <button
            type="button"
            onClick={() => setTreeMenuOpen((open) => !open)}
            className="hidden"
          >
            <span className="text-lg">☰</span>
            Our Products
          </button>

          <Link
            href={currentUser ? "/profile" : "/login?role=customer&next=/profile"}
            className="order-2 hidden max-w-[150px] rounded-sm border border-transparent px-2 py-1 text-xs leading-tight text-[#111827] hover:border-[#6b145d]/20 md:block"
          >
            <span className="block text-[#4b5563]">{deliveryTopLabel}</span>
            <span className="block truncate font-bold text-[#111827]">{deliveryBottomLabel}</span>
          </Link>

          <form
            onSubmit={submitHomeSearch}
            className="order-4 flex min-w-0 basis-full overflow-hidden rounded-sm border border-[#b58aaa] bg-white shadow-sm focus-within:border-[#6b145d] md:order-3 md:flex-1 md:basis-auto"
          >
            <select
              aria-label="Search category"
              className="hidden border-r border-[#e8d9e6] bg-[#f8f9ff] px-3 text-sm text-[#111827] outline-none sm:block"
              value={selectedCategoryId}
              onChange={(event) => chooseCategory(event.target.value)}
            >
              <option value="">All</option>
              {categoryRows.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Search Zylo-Buylo products, vendors and parts"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="min-h-10 w-full min-w-0 px-3 text-sm text-[#111827] outline-none sm:px-4"
            />
            <button
              type="submit"
              className="flex min-w-16 items-center justify-center bg-[#6b145d] px-4 text-[0px] font-black text-white before:text-sm before:content-['Go'] hover:bg-[#8b2c72]"
            >
              🔍
            </button>
          </form>

          <div className="order-4 hidden items-center gap-1 text-xs lg:flex">
            <div
              className="relative"
              onMouseEnter={() => setAccountMenuOpen(true)}
              onMouseLeave={() => setAccountMenuOpen(false)}
            >
              {currentUser ? (
                <>
                  <button
                    type="button"
                    onClick={() => setAccountMenuOpen((open) => !open)}
                    className="rounded-sm border border-transparent px-2 py-1 text-left hover:border-[#6b145d]/20"
                    aria-expanded={accountMenuOpen}
                  >
                    <span className="block text-[#4b5563]">{accountTopLabel}</span>
                    <span className="block max-w-[120px] truncate font-bold">
                      {accountBottomLabel}
                    </span>
                  </button>
                  {accountMenuOpen && (
                    <div className="absolute right-0 top-full z-[70] mt-2 w-56 overflow-hidden rounded-md bg-white py-2 text-sm text-[#111827] shadow-2xl ring-1 ring-black/10">
                      <div className="border-b border-gray-100 px-4 py-3">
                        <p className="font-bold">{userDisplayName}</p>
                        <p className="mt-1 truncate text-xs text-gray-500">
                          {currentUser.email}
                        </p>
                      </div>
                      <Link
                        href={accountHref}
                        className="block px-4 py-2 font-semibold hover:bg-gray-50"
                        onClick={() => setAccountMenuOpen(false)}
                      >
                        {currentUser.role === "VENDOR"
                          ? "Vendor dashboard"
                          : currentUser.role === "ADMIN"
                            ? "Admin dashboard"
                            : "My profile"}
                      </Link>
                      <Link
                        href="/orders"
                        className="block px-4 py-2 font-semibold hover:bg-gray-50"
                        onClick={() => setAccountMenuOpen(false)}
                      >
                        My orders
                      </Link>
                      <button
                        type="button"
                        onClick={logoutFromHome}
                        className="block w-full px-4 py-2 text-left font-bold text-red-600 hover:bg-red-50"
                      >
                        Logout
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setAccountMenuOpen((open) => !open)}
                    className="block rounded-sm border border-transparent px-2 py-1 text-left hover:border-[#6b145d]/20"
                    aria-expanded={accountMenuOpen}
                    aria-haspopup="menu"
                  >
                    <span className="block text-[#4b5563]">{accountTopLabel}</span>
                    <span className="block max-w-[120px] truncate font-bold">
                      {accountBottomLabel}
                    </span>
                  </button>
                  {accountMenuOpen && (
                    <div className="absolute right-0 top-full z-[70] mt-2 w-56 overflow-hidden rounded-md bg-white py-2 text-sm text-[#111827] shadow-2xl ring-1 ring-black/10">
                      <div className="border-b border-gray-100 px-4 py-3">
                        <p className="font-bold">Welcome to Zylo-Buylo</p>
                        <p className="mt-1 text-xs text-gray-500">
                          Login or create an account to order faster.
                        </p>
                      </div>
                      <Link
                        href="/login?next=/profile"
                        className="block px-4 py-2 font-semibold hover:bg-gray-50"
                        onClick={() => setAccountMenuOpen(false)}
                      >
                        Customer Login
                      </Link>
                      <Link
                        href="/login?next=/vendor/dashboard"
                        className="block px-4 py-2 font-semibold hover:bg-gray-50"
                        onClick={() => setAccountMenuOpen(false)}
                      >
                        Vendor Login
                      </Link>
                      <Link
                        href="/login?next=/admin/dashboard&admin=1"
                        className="block px-4 py-2 font-semibold hover:bg-gray-50"
                        onClick={() => setAccountMenuOpen(false)}
                      >
                        Admin Login
                      </Link>
                      <Link
                        href="/signup"
                        className="block border-t border-gray-100 px-4 py-2 font-bold text-[#6b145d] hover:bg-[#fff4fb]"
                        onClick={() => setAccountMenuOpen(false)}
                      >
                        Register Account
                      </Link>
                    </div>
                  )}
                </>
              )}
            </div>
            <Link
              href={currentUser?.role === "VENDOR" ? "/vendor/dashboard" : "/supplier"}
              className="rounded-sm border border-transparent px-2 py-1 hover:border-[#6b145d]/20"
            >
              <span className="block text-[#4b5563]">
                {currentUser?.role === "VENDOR" ? "Open" : "Sell on"}
              </span>
              <span className="font-bold">
                {currentUser?.role === "VENDOR" ? "Vendor Panel" : "Zylo-Buylo"}
              </span>
            </Link>
            {currentUser?.role === "ADMIN" && (
              <Link
                href="/admin/dashboard"
                className="rounded-sm border border-transparent px-2 py-1 hover:border-[#6b145d]/20"
              >
                <span className="block text-[#4b5563]">Admin</span>
                <span className="font-bold">Dashboard</span>
              </Link>
            )}
          </div>

          <Link
            href="/cart"
            className="order-2 ml-auto shrink-0 rounded-sm border border-transparent px-2 py-2 text-sm font-bold hover:border-[#6b145d]/20 md:order-5 md:ml-0"
          >
            Cart {cartCount}
          </Link>
          </div>
        </div>

        <div
          className="relative border-t border-white/10 bg-[#130817] text-white shadow-[inset_0_-1px_0_rgba(255,255,255,0.08)]"
          onMouseLeave={() => setTreeMenuOpen(false)}
        >
          <div className="mx-auto flex max-w-7xl items-center gap-5 overflow-x-auto px-3 text-sm">
            <button
              type="button"
              onClick={() => setTreeMenuOpen((open) => !open)}
              className="shrink-0 py-2 font-bold text-[#ffd166] hover:text-white md:hidden"
            >
              All
            </button>
            {applianceCategoryTree.slice(0, 12).map((category) => (
              <button
                key={category.slug}
                type="button"
                onMouseEnter={() => {
                  setActiveTreeSlug(category.slug);
                  setTreeMenuOpen(true);
                }}
                onClick={() => {
                  setActiveTreeSlug(category.slug);
                  setTreeMenuOpen((open) =>
                    activeTreeSlug === category.slug ? !open : true,
                  );
                }}
                className={`shrink-0 py-2 text-left ${
                  activeTreeSlug === category.slug && treeMenuOpen
                    ? "font-bold text-[#ffd166]"
                    : "text-white/85 hover:text-[#ffd166]"
                }`}
              >
                {category.name}
              </button>
            ))}
            <Link
              href="/supplier"
              className="shrink-0 py-2 font-semibold text-[#ffd166] hover:text-white"
            >
              Become a Supplier
            </Link>
          </div>

          {treeMenuOpen && activeTreeCategory && (
            <div className="absolute left-1/2 top-full z-50 w-[min(1180px,calc(100vw-32px))] -translate-x-1/2 border border-[#d5d9d9] bg-white text-[#111827] shadow-2xl">
              <div className="grid md:grid-cols-[260px_minmax(0,1fr)]">
                <aside className="bg-[#f7fafa] p-4">
                  <p className="mb-3 text-sm font-bold">Shop by department</p>
                  <div className="grid gap-1">
                    {applianceCategoryTree.map((category) => (
                      <button
                        key={category.slug}
                        type="button"
                        onMouseEnter={() => setActiveTreeSlug(category.slug)}
                        onClick={() => setActiveTreeSlug(category.slug)}
                        className={`rounded px-3 py-2 text-left text-sm font-semibold ${
                          activeTreeSlug === category.slug
                            ? "bg-[#232f3e] text-white"
                            : "hover:bg-[#e3e6e6]"
                        }`}
                      >
                        {category.name}
                      </button>
                    ))}
                  </div>
                </aside>
                <div className="grid gap-4 p-5 md:grid-cols-4">
                  {activeTreeCategory.groups.map((group) => (
                    <div key={group.slug}>
                      <p className="mb-2 text-sm font-bold text-[#111827]">
                        {group.name}
                      </p>
                      <div className="grid gap-1">
                        {group.parts.map((item) => (
                          <Link
                            key={item.slug}
                            href={getPartHref(
                              activeTreeCategory.slug,
                              group.slug,
                              item.slug,
                            )}
                            className="rounded py-1 text-sm text-[#565959] hover:text-[#c45500]"
                          >
                            {item.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white text-[#111827] md:hidden">
          <div className="relative border-y border-[#eef0f4] bg-[#f8f9ff] px-4 py-3">
            <button
              type="button"
              onClick={() => setAccountMenuOpen((open) => !open)}
              className="flex w-full items-center justify-between text-left text-sm font-bold"
              aria-expanded={accountMenuOpen}
              aria-haspopup="menu"
            >
              <span className="min-w-0 truncate">
                {currentUser
                  ? `${currentUser.role === "VENDOR" ? "Vendor" : currentUser.role === "ADMIN" ? "Admin" : "Customer"}: ${userDisplayName}`
                  : "Sign in to set delivery location and see your account"}
              </span>
              <span className="text-lg text-[#8b2c72]">
                {accountMenuOpen ? "^" : "v"}
              </span>
            </button>

            {accountMenuOpen && (
              <div className="absolute left-4 right-4 top-[calc(100%-6px)] z-[70] overflow-hidden rounded-md bg-white py-2 text-sm shadow-2xl ring-1 ring-black/10">
                {currentUser ? (
                  <>
                    <div className="border-b border-gray-100 px-4 py-3">
                      <p className="font-bold">{userDisplayName}</p>
                      <p className="mt-1 truncate text-xs text-gray-500">
                        {currentUser.email}
                      </p>
                    </div>
                    <Link
                      href={accountHref}
                      className="block px-4 py-3 font-semibold hover:bg-gray-50"
                      onClick={() => setAccountMenuOpen(false)}
                    >
                      {currentUser.role === "VENDOR"
                        ? "Vendor dashboard"
                        : currentUser.role === "ADMIN"
                          ? "Admin dashboard"
                          : "Profile"}
                    </Link>
                    <Link
                      href="/orders"
                      className="block px-4 py-3 font-semibold hover:bg-gray-50"
                      onClick={() => setAccountMenuOpen(false)}
                    >
                      My Orders
                    </Link>
                    <button
                      type="button"
                      onClick={logoutFromHome}
                      className="block w-full border-t border-gray-100 px-4 py-3 text-left font-bold text-red-600 hover:bg-red-50"
                    >
                      Logout
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login?next=/profile"
                      className="block px-4 py-3 font-semibold hover:bg-gray-50"
                      onClick={() => setAccountMenuOpen(false)}
                    >
                      Customer Login
                    </Link>
                    <Link
                      href="/login?next=/vendor/dashboard"
                      className="block px-4 py-3 font-semibold hover:bg-gray-50"
                      onClick={() => setAccountMenuOpen(false)}
                    >
                      Vendor Login
                    </Link>
                    <Link
                      href="/login?next=/admin/dashboard&admin=1"
                      className="block px-4 py-3 font-semibold hover:bg-gray-50"
                      onClick={() => setAccountMenuOpen(false)}
                    >
                      Admin Login
                    </Link>
                    <Link
                      href="/signup"
                      className="block border-t border-gray-100 px-4 py-3 font-bold text-[#6b145d] hover:bg-[#fff4fb]"
                      onClick={() => setAccountMenuOpen(false)}
                    >
                      Register Account
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="hidden gap-4 overflow-x-auto px-4 py-4">
            <Link
              href="/products"
              className="flex w-20 shrink-0 flex-col items-center gap-2 text-center"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#fde7f2] text-xl font-black text-[#8b2c72]">
                All
              </span>
              <span className="line-clamp-2 text-xs font-bold leading-4">Categories</span>
            </Link>
            {(topCategories.length ? topCategories : categoryRows).slice(0, 10).map((category, index) => (
              <Link
                key={category.id}
                href={`/products?category=${category.slug || slugify(category.name)}`}
                className="flex w-20 shrink-0 flex-col items-center gap-2 text-center"
              >
                <span
                  className={`flex h-14 w-14 items-center justify-center rounded-full text-base font-black ${
                    [
                      "bg-[#fff0e5] text-[#ff6b1a]",
                      "bg-[#e9f2ff] text-[#194f94]",
                      "bg-[#eaf8ed] text-[#2f7a3d]",
                      "bg-[#fff0f6] text-[#b32761]",
                    ][index % 4]
                  }`}
                >
                  {categoryInitial(category.name)}
                </span>
                <span className="line-clamp-2 text-xs font-bold leading-4">
                  {category.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </header>

      <section className="bg-[#100713] bg-[radial-gradient(circle_at_top,rgba(247,200,91,0.14),transparent_32%),radial-gradient(circle_at_20%_10%,rgba(159,32,137,0.25),transparent_34%),linear-gradient(180deg,#19091f,#0f1117)] px-2.5 pb-28 pt-2.5 md:hidden">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-black text-white">Products for you</h1>
            <p className="text-[10px] font-semibold text-white/60">
              Category se choose karo, fast order karo
            </p>
          </div>
          <Link href="/products" className="rounded-full bg-[#f7c85b] px-3 py-1.5 text-[10px] font-black uppercase text-[#160716]">
            View all
          </Link>
        </div>

        <div className="mb-2.5 overflow-x-auto rounded-xl border border-white/10 bg-white/10 p-1.5 shadow-[0_14px_28px_rgba(0,0,0,0.22)] backdrop-blur">
          <div className="flex min-w-max gap-1.5">
            <Link
              href="/products"
                className="flex w-[72px] shrink-0 flex-col items-center gap-1 rounded-xl border border-white/10 bg-white p-1.5 text-center"
            >
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-[#fde7f2] text-sm font-black text-[#8b2c72]">
                All
              </span>
              <span className="line-clamp-1 text-[10px] font-black text-[#111827]">
                All
              </span>
            </Link>
            {(topCategories.length ? topCategories : categoryRows).slice(0, 12).map((category) => (
              <Link
                key={category.id}
                href={`/products?category=${category.slug || slugify(category.name)}`}
                className="flex w-[72px] shrink-0 flex-col items-center gap-1 rounded-xl border border-white/10 bg-white p-1.5 text-center"
              >
                <span className="relative h-12 w-12 overflow-hidden rounded-xl bg-[#fff4fb]">
                  <Image
                    src={getCategoryPreviewImage(category)}
                    alt={category.name}
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                </span>
                <span className="line-clamp-1 text-[10px] font-black text-[#111827]">
                  {category.name}
                </span>
              </Link>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {freshProducts.slice(0, 12).map((product, index) => {
            const hasDeal = Boolean(product.mrp && product.mrp > product.price);

            return (
              <article
                key={product.id}
                className="overflow-hidden rounded-xl border border-white/10 bg-white shadow-[0_12px_24px_rgba(0,0,0,0.22)]"
              >
                <Link href={`/products/${product.id}`} className="block">
                  <div className="relative aspect-[4/5] overflow-hidden bg-[#f7f7f9]">
                    <Image
                      src={product.images?.[0] || fallbackImage}
                      alt={product.name}
                      fill
                      priority={index < 4}
                      sizes="50vw"
                      className="object-contain p-1"
                    />
                    {hasDeal && (
                      <span className="absolute left-1.5 top-1.5 rounded-full bg-green-600 px-1.5 py-0.5 text-[9px] font-black text-white">
                        {product.discountPercent || 0}% off
                      </span>
                    )}
                  </div>
                  <div className="px-1.5 pb-2 pt-1">
                    <h2 className="line-clamp-1 text-[10.5px] font-black leading-3 text-[#111827]">
                      {product.name}
                    </h2>
                    <div className="mt-1 flex items-end justify-between gap-1">
                      <p className="text-[13px] font-black leading-4 text-[#b12704]">
                        {priceLabel(product.price)}
                      </p>
                      <span className="rounded-full bg-[#f3f4f6] px-1.5 py-0.5 text-[8px] font-bold text-[#315c48]">
                        View
                      </span>
                    </div>
                    {product.mrp && product.mrp > product.price && (
                      <p className="mt-0.5 truncate text-[9px] text-[#6b7280]">
                        <span className="line-through">{priceLabel(product.mrp)}</span>
                      </p>
                    )}
                  </div>
                </Link>
              </article>
            );
          })}
        </div>

        {freshProducts.length === 0 && (
          <p className="rounded-2xl bg-white px-4 py-8 text-center text-sm font-semibold text-[#6b7280]">
            No products found yet.
          </p>
        )}
      </section>

      <section id="products" className="hidden">
        <div className="border-y border-[#e5e7eb] px-4 py-4">
          <h1 className="text-2xl font-semibold text-[#242334]">
            Products For You
          </h1>
        </div>
        <div className="grid grid-cols-4 border-b border-[#e5e7eb] text-sm font-bold text-[#242334]">
          <button className="border-r border-[#e5e7eb] px-2 py-3">Sort</button>
          <button className="border-r border-[#e5e7eb] px-2 py-3">Category</button>
          <button className="border-r border-[#e5e7eb] px-2 py-3">Deals</button>
          <Link href="/products" className="px-2 py-3 text-center">
            Filters
          </Link>
        </div>

        {freshProducts.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-[#565959]">
            No products found. Try another category.
          </div>
        ) : (
          <div className="grid grid-cols-2 border-b border-[#e5e7eb]">
            {freshProducts.slice(0, 24).map((product) => {
              const wishlistId = getWishlistId(product.id);
              const hasDeal = Boolean(product.mrp && product.mrp > product.price);

              return (
                <Link
                  key={product.id}
                  href={`/products/${product.id}`}
                  className="relative min-h-[286px] border-r border-t border-[#e5e7eb] bg-white p-3 odd:border-l-0"
                >
                  <div className="relative aspect-square bg-[#f7f7f7]">
                    <Image
                      src={product.images?.[0] || fallbackImage}
                      alt={product.name}
                      fill
                      sizes="50vw"
                      className="object-contain"
                    />
                    <button
                      type="button"
                      onClick={(event) => handleWishlistClick(event, product)}
                      className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white text-lg text-[#8b2c72] shadow"
                      aria-label="Save product"
                    >
                      {isInWishlist(wishlistId) ? "♥" : "♡"}
                    </button>
                  </div>
                  <p className="mt-3 line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-[#242334]">
                    {product.name}
                  </p>
                  <p className="mt-2 text-lg font-black text-[#b12704]">
                    {priceLabel(product.price)}
                  </p>
                  {hasDeal ? (
                    <p className="text-xs text-[#565959]">
                      <span className="line-through">
                        {priceLabel(product.mrp || 0)}
                      </span>{" "}
                      <span className="font-bold text-green-700">
                        {product.discountPercent || 0}% off
                      </span>
                    </p>
                  ) : (
                    <p className="text-xs font-semibold text-green-700">
                      Best price
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="hidden bg-[#120817] bg-[radial-gradient(circle_at_top_left,rgba(159,32,137,0.34),transparent_28%),linear-gradient(135deg,#120817,#1f1024_48%,#0b0f18)] md:block">
        <div className="mx-auto max-w-7xl space-y-5 px-4 py-5">
          <div className={`overflow-hidden rounded-[26px] border border-white/15 shadow-[0_24px_70px_rgba(0,0,0,0.36)] ${baseHero.theme}`}>
            <div className="relative grid overflow-hidden md:h-[325px] md:grid-cols-[0.82fr_1.18fr]">
              <div className="relative z-10 flex h-full flex-col justify-center px-8 py-7 lg:px-10">
                <p className="w-fit rounded-full border border-white/50 bg-white/90 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-[#6b145d] shadow-sm">
                  {baseHero.eyebrow}
                </p>
                <h1 className="mt-4 max-w-xl text-4xl font-black leading-[1.02] text-[#081225] lg:text-5xl">
                  {baseHero.title}
                  <span className="block bg-gradient-to-r from-[#6b145d] via-[#e71876] to-[#ff7a1a] bg-clip-text text-transparent">
                    {baseHero.highlight}
                  </span>
                </h1>
                <p className="mt-4 line-clamp-2 max-w-xl text-base leading-6 text-[#374151]">
                  {baseHero.text}
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    href={baseHero.primaryHref}
                    className="rounded-full bg-[#6b145d] px-7 py-3 text-xs font-black uppercase text-white shadow-[0_14px_30px_rgba(107,20,93,0.28)] transition hover:-translate-y-0.5 hover:bg-[#8b2c72]"
                  >
                    {baseHero.primaryLabel}
                  </Link>
                  <Link
                    href={baseHero.secondaryHref}
                    className="rounded-full border border-[#6b145d] bg-white/90 px-7 py-3 text-xs font-black uppercase text-[#6b145d] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#fff4fb]"
                  >
                    {baseHero.secondaryLabel}
                  </Link>
                </div>
                <div className="mt-5 flex items-center gap-2">
                  {heroSlides.map((slide, index) => (
                    <button
                      key={`${slide.image}-${index}`}
                      type="button"
                      onClick={() => setActiveHeroSlide(index)}
                      className={`h-2.5 rounded-full transition-all ${
                        activeHeroSlide === index
                          ? "w-9 bg-[#6b145d]"
                          : "w-2.5 bg-[#d8bfd2] hover:bg-[#9f2089]"
                      }`}
                      aria-label={`Show banner media ${index + 1}`}
                    />
                  ))}
                </div>
              </div>
              <div className="relative z-0 flex h-full items-center justify-center px-5 py-0 pl-0">
                <div className={`relative h-[210px] w-full max-w-[720px] overflow-hidden rounded-[24px] border border-white/70 bg-white/60 shadow-[0_18px_44px_rgba(15,23,42,0.16)] lg:h-[230px] ${baseHero.panel}`}>
                  <SmartBannerMedia
                    key={activeHeroSlide}
                    src={activeHeroMedia.image}
                    alt={activeHeroMedia.imageAlt || baseHero.imageAlt}
                    className="h-full"
                    badge="Admin managed"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setActiveHeroSlide((current) =>
                    current === 0 ? heroSlides.length - 1 : current - 1,
                  )
                }
                className="absolute left-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-lg font-black text-[#6b145d] shadow-lg ring-1 ring-[#ead7e8] hover:bg-white md:flex"
                aria-label="Previous banner media"
              >
                {"<"}
              </button>
              <button
                type="button"
                onClick={() =>
                  setActiveHeroSlide((current) => (current + 1) % heroSlides.length)
                }
                className="absolute right-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-lg font-black text-[#6b145d] shadow-lg ring-1 ring-[#ead7e8] hover:bg-white md:flex"
                aria-label="Next banner media"
              >
                {">"}
              </button>
            </div>
            <div className="grid gap-px bg-[#ead7e8] text-center text-[11px] font-black uppercase tracking-wide text-[#111827] sm:grid-cols-3">
              <div className="bg-white/90 px-3 py-2.5">Secure shopping</div>
              <div className="bg-white/90 px-3 py-2.5">Best prices</div>
              <div className="bg-white/90 px-3 py-2.5">Fast delivery</div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-[24px] border border-[#ead7e8] bg-white px-4 py-5 shadow-[0_14px_36px_rgba(15,23,42,0.08)]">
            <div className="flex min-w-max items-start justify-center gap-5 lg:gap-9">
              {categoryShortcuts.map((category, index) => (
                <Link
                  key={category.slug}
                  href={`/products?category=${category.slug}`}
                  className="group flex w-24 shrink-0 flex-col items-center gap-2 text-center transition hover:-translate-y-1 sm:w-28"
                >
                  <span
                    className={`flex h-16 w-16 items-center justify-center rounded-[22px] text-lg font-black shadow-sm ring-1 ring-[#f0e6ef] transition group-hover:shadow-xl sm:h-20 sm:w-20 sm:text-2xl ${
                      [
                        "bg-[#fff0f5] text-[#9f2089]",
                        "bg-[#fff6dd] text-[#9a5b00]",
                        "bg-[#eaf8ed] text-[#2f7a3d]",
                        "bg-[#eef6ff] text-[#194f94]",
                      ][index % 4]
                    }`}
                  >
                    {category.icon}
                  </span>
                  <span className="line-clamp-2 min-h-8 text-xs font-bold leading-4 text-[#242334] group-hover:text-[#9f2089]">
                    {category.name}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-[#ead7e8] bg-white p-4 shadow-[0_14px_36px_rgba(15,23,42,0.07)]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-black text-[#111827]">Quick shop</h2>
              <Link href="/products" className="text-xs font-bold text-[#007185]">
                All products
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {quickShopLinks.map((item) => (
                <Link
                  key={item.title}
                  href={item.href}
                  className="rounded-2xl border border-[#e8d9e6] bg-[#fff8fc] px-3 py-3 text-center text-sm font-black text-[#6b145d] transition hover:-translate-y-0.5 hover:border-[#9f2089] hover:bg-white hover:shadow-md"
                >
                  {item.title}
                </Link>
              ))}
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
            <Link
              href={promoBanner.href}
              className="relative grid min-h-[300px] overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#2a140c,#5a2718_45%,#140910)] text-white shadow-[0_20px_50px_rgba(42,20,12,0.22)] transition hover:-translate-y-0.5 md:grid-cols-[1fr_0.85fr]"
            >
              <div className="flex flex-col justify-center px-6 py-8 sm:px-10">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-[#facc15]">
                  {promoBanner.eyebrow}
                </p>
                <h2 className="mt-3 text-4xl font-black leading-tight md:text-5xl">
                  {promoBanner.title}
                </h2>
                <p className="mt-3 max-w-md text-sm leading-6 text-white/80">
                  {promoBanner.text}
                </p>
                <span className="mt-5 w-fit rounded-full bg-[#facc15] px-6 py-3 text-sm font-black uppercase text-[#2a140c] shadow-lg">
                  {promoBanner.ctaLabel}
                </span>
              </div>
              <div className="relative min-h-[230px] bg-[#3a1c10]">
                <SmartBannerMedia
                  src={promoBanner.image}
                  alt={promoBanner.imageAlt}
                  className="h-full min-h-[230px]"
                  mediaClassName="opacity-95"
                />
                <div className="absolute inset-0 bg-gradient-to-l from-transparent to-[#2a140c]/35" />
              </div>
            </Link>

            <div className="grid gap-5">
              {dealCards.slice(0, 2).map((card, index) => (
                <Link
                  key={`${card.title}-${index}`}
                  href={card.href}
                  className={`rounded-[24px] border p-6 shadow-[0_14px_32px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 ${
                    index === 0
                      ? "border-[#e8d9e6] bg-white hover:border-[#9f2089]"
                      : "border-[#d6e7ff] bg-[#f4f9ff] hover:border-[#194f94]"
                  }`}
                >
                  <p className={`text-xs font-black uppercase tracking-wide ${
                    index === 0 ? "text-[#6b7280]" : "text-[#194f94]"
                  }`}>
                    {index === 0 ? "Best deals" : "New arrivals"}
                  </p>
                  <h2 className={`mt-2 font-black ${
                    index === 0 ? "text-3xl text-[#6b145d]" : "text-2xl text-[#111827]"
                  }`}>
                    {card.title}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[#565959]">
                    {card.text}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-5 max-w-7xl px-4">
        <div className="grid gap-4 rounded-[24px] border border-[#ead7e8] bg-white p-4 shadow-[0_14px_36px_rgba(15,23,42,0.07)] sm:grid-cols-2 lg:grid-cols-4">
          {promoShortcuts.map((shortcut) => (
            <Link
              key={shortcut.title}
              id={shortcut.title === "Download App" ? "download-app" : undefined}
              href={shortcut.href}
              className="group rounded-2xl border border-[#f0e6ef] bg-[#fff8fc] p-5 transition hover:-translate-y-0.5 hover:border-[#9f2089] hover:bg-white hover:shadow-md"
            >
              <p className="text-lg font-black text-[#6b145d] group-hover:text-[#9f2089]">
                {shortcut.title}
              </p>
              <p className="mt-2 text-sm leading-5 text-[#565959]">
                {shortcut.text}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-5 max-w-7xl px-4">
        <div className="rounded-[24px] border border-[#ead7e8] bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.07)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-2xl font-bold">Shop by brand</h2>
            <Link href="/products" className="text-sm font-semibold text-[#007185]">
              View all brands
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {brandShortcuts.map((brand, index) => (
              <Link
                key={brand.slug}
                href={`/products?brand=${brand.slug}`}
                className="group flex min-h-24 flex-col items-center justify-center rounded-2xl border border-[#e8d9e6] bg-[#fbf8fc] p-3 text-center transition hover:-translate-y-0.5 hover:border-[#9f2089] hover:bg-white hover:shadow-md"
              >
                <span
                  className={`flex h-12 w-12 items-center justify-center rounded-full text-sm font-black ${
                    [
                      "bg-[#eef6ff] text-[#194f94]",
                      "bg-[#fff0f5] text-[#9f2089]",
                      "bg-[#fff7ed] text-[#9a5b00]",
                      "bg-[#f0fdf4] text-[#2f7a3d]",
                    ][index % 4]
                  }`}
                >
                  {categoryInitial(brand.name)}
                </span>
                <span className="mt-2 text-sm font-black text-[#242334] group-hover:text-[#9f2089]">
                  {brand.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto mt-5 max-w-7xl px-4">
        <Link
          href={discountBanner.href}
          className="grid overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#6b145d,#9f2089_55%,#ff7a1a)] text-white shadow-[0_20px_55px_rgba(107,20,93,0.24)] md:grid-cols-[1fr_360px]"
        >
          <div className="px-6 py-8 sm:px-10">
            <p className="text-sm font-black uppercase tracking-[0.24em] text-[#ffd166]">
              {discountBanner.eyebrow}
            </p>
            <h2 className="mt-3 text-4xl font-black leading-tight md:text-5xl">
              {discountBanner.title}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
              {discountBanner.text}
            </p>
            <span className="mt-5 inline-flex rounded-full bg-white px-7 py-3 text-sm font-black uppercase text-[#6b145d] shadow-lg">
              {discountBanner.ctaLabel}
            </span>
          </div>
          <div className="relative hidden min-h-[220px] items-center justify-center overflow-hidden bg-[#8b2c72] p-6 md:flex">
            {discountBanner.image && (
              <SmartBannerMedia
                src={discountBanner.image}
                alt={discountBanner.imageAlt}
                className="absolute inset-0 h-full w-full"
                mediaClassName="opacity-35"
              />
            )}
            <div className="relative z-10 rounded-full border-4 border-white/35 bg-white/10 px-8 py-10 text-center backdrop-blur-sm">
              <p className="text-5xl font-black">{discountBanner.percent}</p>
              <p className="mt-1 text-sm font-black uppercase">Off</p>
            </div>
          </div>
        </Link>
      </section>

      <section className="mx-auto mt-5 hidden max-w-7xl px-4 md:block">
        <div className="rounded-[24px] border border-[#ead7e8] bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.07)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-2xl font-bold">Trending now</h2>
            <Link href="/products?sort=trending" className="text-sm font-semibold text-[#007185]">
              Explore trending
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {trendingShortcuts.map((shortcut, index) => (
              <Link
                key={shortcut.title}
                href={`/products?category=${shortcut.category}&sort=trending`}
                className={`min-h-32 rounded-2xl border border-[#e5e7eb] p-4 transition hover:-translate-y-0.5 hover:border-[#febd69] hover:shadow-md ${
                  [
                    "bg-[#fff7ed]",
                    "bg-[#eef6ff]",
                    "bg-[#fff0f6]",
                    "bg-[#f0fdf4]",
                    "bg-[#f8fafc]",
                  ][index % 5]
                }`}
              >
                <span className="text-xs font-black uppercase tracking-wide text-[#6b7280]">
                  Marketplace pick
                </span>
                <p className="mt-3 text-lg font-black text-[#111827]">
                  {shortcut.title}
                </p>
                <p className="mt-2 text-sm text-[#565959]">
                  View category products with trending sort.
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section id="products-desktop" className="mx-auto mt-5 hidden max-w-7xl px-4 md:block">
        <div className="rounded-[24px] border border-[#ead7e8] bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.07)]">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-bold">Best Deals Today</h2>
            <Link href="/products?offer=true" className="text-sm font-semibold text-[#007185]">
              View all products
            </Link>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {dealProducts.slice(0, 14).map((product) => (
              <ProductTile key={product.id} product={product} />
            ))}
          </div>
          {dealProducts.length === 0 && (
            <p className="py-8 text-center text-sm text-[#565959]">
              No products found in this selection.
            </p>
          )}
        </div>
      </section>

      <section className="mx-auto mt-5 hidden max-w-7xl px-4 md:block">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-[24px] border border-[#ead7e8] bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.07)]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-2xl font-bold">Featured Products</h2>
              <Link href="/products?featured=true" className="text-sm font-semibold text-[#007185]">
                View All
              </Link>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {freshProducts.slice(0, 12).map((product) => (
                <article
                  key={product.id}
                  className="group rounded-2xl border border-[#f0d8e8] bg-white p-2.5 shadow-sm transition hover:-translate-y-1 hover:border-[#9f2089] hover:shadow-xl"
                >
                  <Link href={`/products/${product.id}`} className="block">
                    <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-gradient-to-br from-[#fff8fc] to-[#f3f4f6]">
                      <Image
                        src={product.images?.[0] || fallbackImage}
                        alt={product.name}
                        fill
                        sizes="(min-width: 1280px) 260px, (min-width: 768px) 33vw, 50vw"
                        className="object-contain transition duration-300 group-hover:scale-105"
                      />
                    </div>
                    <p className="mt-2 line-clamp-2 min-h-9 text-sm font-black leading-[18px] text-[#111827]">
                      {product.name}
                    </p>
                  </Link>
                  <p className="mt-1.5 text-lg font-black text-[#c2410c]">
                    {priceLabel(product.price)}
                  </p>
                  {product.mrp && product.mrp > product.price && (
                    <p className="text-[11px] text-[#565959]">
                      <span className="line-through">
                        {priceLabel(product.mrp)}
                      </span>{" "}
                      <span className="font-bold text-green-700">
                        {product.discountPercent || 0}% off
                      </span>
                    </p>
                  )}
                  <div className="mt-1.5 flex items-center gap-2 text-[11px]">
                    <span className="rounded-full bg-green-600 px-2 py-0.5 font-bold text-white">
                      3.{getWishlistId(product.id) % 5}
                    </span>
                    <span className="text-[#565959]">
                      {Number(product.inventory || 0) > 0 ? "In stock" : "Limited stock"}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={(event) => handleAddToCartClick(event, product)}
                      className="rounded-lg bg-[#6b145d] px-2 py-2 text-[10px] font-black uppercase text-white shadow-sm hover:bg-[#8b2c72]"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={(event) => handleBuyNowClick(event, product)}
                      className="rounded-lg border border-[#6b145d] bg-white px-2 py-2 text-[10px] font-black uppercase text-[#6b145d] hover:bg-[#fff4fb]"
                    >
                      Buy Now
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="bg-white p-5 shadow-sm">
              <h2 className="text-xl font-bold">Become a supplier</h2>
              <p className="mt-2 text-sm leading-6 text-[#565959]">
                Register your shop, upload products and start receiving
                marketplace orders after approval.
              </p>
              <Link
                href="/supplier"
                className="mt-4 block rounded-md bg-[#ffd814] px-4 py-3 text-center text-sm font-bold text-[#111827] hover:bg-[#f7ca00]"
              >
                Start selling
              </Link>
            </div>

            <div className="bg-white p-5 shadow-sm">
              <h2 className="text-xl font-bold">Shop by category</h2>
              <div className="mt-4 grid gap-2">
                <button
                  type="button"
                  onClick={() => chooseCategory("")}
                  className={`rounded px-3 py-2 text-left text-sm font-semibold ${
                    !selectedCategoryId ? "bg-[#232f3e] text-white" : "bg-[#f3f4f6]"
                  }`}
                >
                  All departments
                </button>
                {applianceCategoryTree.slice(0, 8).map((category) => (
                  <Link
                    key={category.slug}
                    href={firstPartHref(category)}
                    className="rounded bg-[#f3f4f6] px-3 py-2 text-left text-sm font-semibold hover:bg-[#e3e6e6]"
                  >
                    {category.name}
                  </Link>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="mx-auto mt-5 hidden max-w-7xl px-4 md:block">
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-md bg-[#111827] p-6 text-white shadow-sm sm:p-8">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-[#ffd166]">
              Seller growth
            </p>
            <h2 className="mt-3 text-3xl font-black">Sell on Zylo-Buylo</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/75">
              Start selling your products online with vendor dashboard, stock
              management, orders and payout reports.
            </p>
            <Link
              href="/supplier"
              className="mt-5 inline-flex rounded-sm bg-white px-6 py-3 text-sm font-black uppercase text-[#111827] hover:bg-[#f3f4f6]"
            >
              Become Vendor
            </Link>
          </div>

          <div id="download-app" className="rounded-md bg-white p-6 shadow-sm sm:p-8">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-[#6b145d]">
              Mobile shopping
            </p>
            <h2 className="mt-3 text-3xl font-black text-[#111827]">
              Download Zylo-Buylo App
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[#565959]">
              App links are being prepared. Customers can continue shopping on
              Zylo-Buylo.com now.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/download-app"
                className="rounded-sm bg-[#111827] px-5 py-3 text-sm font-black text-white hover:bg-[#2f3748]"
              >
                Google Play
              </Link>
              <Link
                href="/download-app"
                className="rounded-sm border border-[#111827] px-5 py-3 text-sm font-black text-[#111827] hover:bg-[#f3f4f6]"
              >
                App Store
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="mt-8 bg-[#131921] pb-24 text-white md:pb-0">
        <div className="border-b border-white/10 bg-[#232f3e]">
          <div className="mx-auto grid max-w-7xl gap-3 px-4 py-4 text-sm font-semibold sm:grid-cols-3">
            <div className="rounded-md bg-white/5 px-4 py-3">Secure payments with Razorpay</div>
            <div className="rounded-md bg-white/5 px-4 py-3">Verified vendors and order tracking</div>
            <div className="rounded-md bg-white/5 px-4 py-3">Support for returns, refunds and payouts</div>
          </div>
        </div>

        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1fr]">
          <div className="sm:col-span-2 lg:col-span-1">
            <h3 className="text-2xl font-black">Zylo-Buylo</h3>
            <p className="mt-3 max-w-sm text-sm leading-6 text-[#c8d0d6]">
              Zylo-Buylo is a multi-vendor ecommerce marketplace for fashion,
              electronics, home essentials, appliance parts, fittings and daily
              shopping needs.
            </p>
            <div className="mt-5 grid gap-2 text-sm text-[#d7dee7]">
              <p>
                <span className="font-bold text-white">Business:</span>{" "}
                Zylo-Buylo Marketplace
              </p>
              <p>
                <span className="font-bold text-white">Location:</span>{" "}
                New Delhi, India
              </p>
              <p>
                <span className="font-bold text-white">Email:</span>{" "}
                support@zylo-buylo.com
              </p>
              <p>
                <span className="font-bold text-white">Support:</span>{" "}
                10:00 AM to 7:00 PM
              </p>
            </div>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-black uppercase tracking-wide">Shop</h4>
            <div className="grid gap-3 text-sm text-[#c8d0d6]">
              <Link href="/products" className="hover:text-white">All products</Link>
              <Link href="/cart" className="hover:text-white">Cart</Link>
              <Link href="/wishlist" className="hover:text-white">Wishlist</Link>
              <Link href="/orders" className="hover:text-white">My orders</Link>
              <Link href="/profile" className="hover:text-white">Customer profile</Link>
            </div>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-black uppercase tracking-wide">Categories</h4>
            <div className="grid gap-3 text-sm text-[#c8d0d6]">
              {applianceCategoryTree.slice(0, 6).map((category) => (
                <Link
                  key={category.slug}
                  href={firstPartHref(category)}
                  className="hover:text-white"
                >
                  {category.name}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-black uppercase tracking-wide">Sell</h4>
            <div className="grid gap-3 text-sm text-[#c8d0d6]">
              <Link href="/supplier" className="hover:text-white">Become a seller</Link>
              <Link href="/vendor/dashboard" className="hover:text-white">Vendor dashboard</Link>
              <Link href="/vendor/dashboard/upload" className="hover:text-white">Add product</Link>
              <Link href="/vendor/dashboard/inventory" className="hover:text-white">Stock management</Link>
              <Link href="/vendor/dashboard/payouts" className="hover:text-white">Vendor payouts</Link>
            </div>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-black uppercase tracking-wide">Company</h4>
            <div className="grid gap-3 text-sm text-[#c8d0d6]">
              <Link href="/login" className="hover:text-white">Login</Link>
              <Link href="/signup" className="hover:text-white">Create account</Link>
              <Link href="/admin/dashboard" className="hover:text-white">Admin dashboard</Link>
              <Link href="/forgot-password" className="hover:text-white">Password help</Link>
              <Link href="/verify-email" className="hover:text-white">Verify email</Link>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10">
          <div className="mx-auto grid max-w-7xl gap-5 px-4 py-6 text-xs leading-5 text-[#aeb8c4] md:grid-cols-[1.4fr_1fr] md:items-center">
            <p>
              (c) {new Date().getFullYear()} Zylo-Buylo. All rights reserved.
              Product prices, availability, delivery charges and seller policies
              may change based on vendor updates and order location.
            </p>
            <div className="flex flex-wrap gap-2 md:justify-end">
              {["COD", "UPI", "Razorpay", "Cards", "Netbanking"].map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-white/15 px-3 py-1 font-semibold text-[#d7dee7]"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </footer>

      <MobileNavbar />
    </main>
  );
}
