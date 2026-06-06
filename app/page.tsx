"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import MobileNavbar from "@/components/MobileNavbar";
import {
  applianceCategoryTree,
  getPartHref,
} from "@/data/category-tree";
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
  subcategories?: Subcategory[];
};

type Product = {
  id: string;
  name: string;
  price: number;
  mrp?: number | null;
  discountPercent?: number | null;
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

const marketplaceBenefits = [
  { title: "100% Secure Payments", text: "COD, Razorpay and Stripe ready" },
  { title: "Trusted by Sellers", text: "Approved vendor marketplace" },
  { title: "Fast Delivery", text: "Track every confirmed order" },
  { title: "24/7 Customer Support", text: "Help for buyers and vendors" },
  { title: "Sell Across India", text: "Grow your business online" },
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

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categoryRows, setCategoryRows] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [search, setSearch] = useState("");
  const [activeTreeSlug, setActiveTreeSlug] = useState(
    applianceCategoryTree[0]?.slug || "",
  );
  const [treeMenuOpen, setTreeMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);

  const cartCount = useCartStore((state) => state.getTotalItems());
  const addWishlistItem = useWishlistStore((state) => state.addItem);
  const removeWishlistItem = useWishlistStore((state) => state.removeItem);
  const isInWishlist = useWishlistStore((state) => state.isInWishlist);

  useEffect(() => {
    let isActive = true;

    async function loadHomeData() {
      const [productsResponse, categoriesResponse, authResponse] = await Promise.all([
        fetch("/api/products?limit=48", { cache: "no-store" }),
        fetch("/api/categories"),
        fetch("/api/auth/me", { cache: "no-store", credentials: "include" }),
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

      setAuthLoaded(true);
    }

    loadHomeData();

    return () => {
      isActive = false;
    };
  }, []);

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

  const treeShowcase = useMemo(() => {
    return applianceCategoryTree.slice(0, 8).map((category, index) => ({
      ...category,
      accent:
        [
          "bg-[#eef6ff] text-[#123b63]",
          "bg-[#fff3dc] text-[#6f3f00]",
          "bg-[#ecf8ee] text-[#1f5132]",
          "bg-[#fff0f5] text-[#7c1740]",
        ][index % 4],
    }));
  }, []);

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

  function chooseCategory(categoryId: string) {
    setSelectedCategoryId(categoryId);
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

  function ProductTile({ product }: { product: Product }) {
    const wishlistId = getWishlistId(product.id);
    const hasDeal = Boolean(product.mrp && product.mrp > product.price);

    return (
      <Link
        href={`/products/${product.id}`}
        className="group block min-w-[190px] max-w-[190px] rounded-sm bg-white p-3 shadow-sm transition hover:shadow-md"
      >
        <div className="relative aspect-square overflow-hidden bg-[#f3f4f6]">
          <Image
            src={product.images?.[0] || fallbackImage}
            alt={product.name}
            fill
            sizes="190px"
            className="object-contain transition duration-300 group-hover:scale-105"
          />
          <button
            type="button"
            onClick={(event) => handleWishlistClick(event, product)}
            className="absolute right-2 top-2 rounded-full bg-white px-2 py-1 text-xs font-bold text-[#b12704] shadow"
          >
            {isInWishlist(wishlistId) ? "Saved" : "Save"}
          </button>
        </div>
        <p className="mt-3 line-clamp-2 h-10 text-sm font-semibold leading-5 text-[#111827]">
          {product.name}
        </p>
        <p className="mt-1 truncate text-xs text-[#565959]">
          {product.vendor?.storeName || getCategoryName(product)}
        </p>
        <p className="mt-2 text-lg font-bold text-[#b12704]">
          {priceLabel(product.price)}
        </p>
        {hasDeal && (
          <p className="text-xs text-[#565959]">
            <span className="line-through">{priceLabel(product.mrp || 0)}</span>{" "}
            <span className="font-bold text-green-700">
              {product.discountPercent || 0}% off
            </span>
          </p>
        )}
      </Link>
    );
  }

  return (
    <main className="min-h-screen overflow-x-clip bg-[#e3e6e6] pb-24 text-[#111827] md:pb-0">
      <header className="sticky top-0 z-50 bg-[#131921] text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-3 py-2 md:flex-nowrap md:gap-3">
          <Link
            href="/"
            className="order-1 shrink-0 rounded-sm border border-transparent px-1 py-2 text-xl font-bold tracking-tight hover:border-white sm:px-2 sm:text-2xl"
          >
            Zylo-Buylo
          </Link>

          <Link
            href={currentUser ? "/profile" : "/login?role=customer&next=/profile"}
            className="order-2 hidden max-w-[150px] rounded-sm border border-transparent px-2 py-1 text-xs leading-tight hover:border-white md:block"
          >
            <span className="block text-[#c8d0d6]">{deliveryTopLabel}</span>
            <span className="block truncate font-bold">{deliveryBottomLabel}</span>
          </Link>

          <div className="order-4 flex min-w-0 basis-full overflow-hidden rounded-md border-2 border-[#febd69] bg-white shadow-sm focus-within:border-[#f3a847] md:order-3 md:flex-1 md:basis-auto">
            <select
              aria-label="Search category"
              className="hidden bg-[#e6e6e6] px-3 text-sm text-[#111827] outline-none sm:block"
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
              className="min-h-11 w-full min-w-0 px-3 text-sm text-[#111827] outline-none sm:px-4"
            />
            <Link
              href="#products"
              className="flex min-w-14 items-center justify-center bg-[#febd69] px-4 text-sm font-bold text-[#111827] hover:bg-[#f3a847]"
            >
              Go
            </Link>
          </div>

          <div className="order-4 hidden items-center gap-1 text-xs lg:flex">
            <Link
              href={accountHref}
              className="rounded-sm border border-transparent px-2 py-1 hover:border-white"
            >
              <span className="block text-[#c8d0d6]">{accountTopLabel}</span>
              <span className="block max-w-[120px] truncate font-bold">
                {accountBottomLabel}
              </span>
            </Link>
            <Link
              href={currentUser?.role === "VENDOR" ? "/vendor/dashboard" : "/vendor/register"}
              className="rounded-sm border border-transparent px-2 py-1 hover:border-white"
            >
              <span className="block text-[#c8d0d6]">
                {currentUser?.role === "VENDOR" ? "Open" : "Sell on"}
              </span>
              <span className="font-bold">
                {currentUser?.role === "VENDOR" ? "Vendor Panel" : "Zylo-Buylo"}
              </span>
            </Link>
            {currentUser?.role === "ADMIN" && (
              <Link
                href="/admin/dashboard"
                className="rounded-sm border border-transparent px-2 py-1 hover:border-white"
              >
                <span className="block text-[#c8d0d6]">Admin</span>
                <span className="font-bold">Dashboard</span>
              </Link>
            )}
          </div>

          <Link
            href="/cart"
            className="order-2 ml-auto shrink-0 rounded-sm border border-transparent px-2 py-2 text-sm font-bold hover:border-white md:order-5 md:ml-0"
          >
            Cart {cartCount}
          </Link>
        </div>

        <div
          className="relative bg-[#232f3e]"
          onMouseLeave={() => setTreeMenuOpen(false)}
        >
          <div className="mx-auto flex max-w-7xl items-center gap-4 overflow-x-auto px-3 text-sm">
            <button
              type="button"
              onClick={() => setTreeMenuOpen((open) => !open)}
              className="shrink-0 py-2 font-bold"
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
                    ? "font-bold text-[#febd69]"
                    : "text-[#f3f4f6] hover:text-white"
                }`}
              >
                {category.name}
              </button>
            ))}
            <Link
              href="/vendor/register"
              className="shrink-0 py-2 font-semibold text-[#febd69] hover:text-white"
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
          <Link
            href={accountHref}
            className="flex items-center justify-between border-y border-[#eef0f4] bg-[#f8f9ff] px-4 py-3 text-sm font-bold"
          >
            <span className="min-w-0 truncate">
              {currentUser
                ? `${currentUser.role === "VENDOR" ? "Vendor" : currentUser.role === "ADMIN" ? "Admin" : "Customer"}: ${userDisplayName}`
                : "Sign in to set delivery location and see your account"}
            </span>
            <span className="text-lg text-[#8b2c72]">&gt;&gt;</span>
          </Link>

          <div className="flex gap-4 overflow-x-auto px-4 py-4">
            <button
              type="button"
              onClick={() => chooseCategory("")}
              className="flex w-20 shrink-0 flex-col items-center gap-2 text-center"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#fde7f2] text-xl font-black text-[#8b2c72]">
                All
              </span>
              <span className="line-clamp-2 text-xs font-bold leading-4">Categories</span>
            </button>
            {(topCategories.length ? topCategories : categoryRows).slice(0, 10).map((category, index) => (
              <button
                key={category.id}
                type="button"
                onClick={() => chooseCategory(category.id)}
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
              </button>
            ))}
          </div>
        </div>
      </header>

      <section id="products" className="bg-white md:hidden">
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

      <section className="relative hidden overflow-hidden bg-[#fff7ef] text-[#071947] md:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_17%_18%,rgba(255,108,22,0.16),transparent_28%),radial-gradient(circle_at_76%_26%,rgba(17,55,116,0.10),transparent_32%),linear-gradient(115deg,#fff6ed_0%,#ffffff_52%,#eef5ff_100%)]" />
        <div className="relative mx-auto grid min-h-[380px] max-w-7xl gap-6 px-4 pb-16 pt-8 md:grid-cols-[minmax(0,0.95fr)_minmax(360px,1.05fr)] md:items-center md:pb-20 md:pt-10">
          <div className="relative z-10 max-w-2xl">
            <p className="inline-flex items-center rounded-full bg-white px-4 py-2 text-sm font-bold text-[#071947] shadow-sm ring-1 ring-[#f3d5bd]">
              <span className="mr-3 h-2 w-2 rounded-full bg-[#ff6b1a]" />
              India&apos;s Multi-Vendor Marketplace
            </p>
            <h1 className="mt-4 text-4xl font-black leading-[0.95] text-[#071947] md:text-6xl">
              Buy Smart,
              <span className="mt-2 block text-[#ff6b1a]">Sell Easy</span>
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-[#24324b]">
              Explore products from trusted sellers. Best prices, great deals,
              vendor payouts, delivery and category tree all connected.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="#products"
                className="rounded-full bg-[#ff6b1a] px-7 py-3 text-sm font-black uppercase text-white shadow-lg shadow-[#ff6b1a]/25 hover:bg-[#e95d10]"
              >
                Shop now
              </Link>
              <Link
                href="/vendor/register"
                className="rounded-full border border-[#d7dee9] bg-white px-7 py-3 text-sm font-black uppercase text-[#071947] shadow-sm hover:border-[#ff6b1a] hover:text-[#ff6b1a]"
              >
                Become a seller
              </Link>
            </div>
          </div>

          <div className="relative min-h-[300px] md:min-h-[380px]">
            <div className="absolute left-[18%] top-4 hidden h-48 w-48 rounded-full bg-[#ffd36b] md:block" />
            <div className="relative h-[270px] overflow-hidden md:h-[330px]">
              <Image
                src="/hero-marketplace-visual.png"
                alt="Zylo-Buylo customers and products"
                fill
                priority
                sizes="(min-width: 768px) 690px, 92vw"
                className="object-contain object-center"
              />
            </div>
            <div className="relative z-10 mx-auto mt-2 grid max-w-lg grid-cols-3 gap-2 text-center text-[10px] font-black uppercase tracking-wide text-[#071947] sm:text-xs">
              {["Secure Shopping", "Best Prices", "Fast Delivery"].map((item) => (
                <div
                  key={item}
                  className="flex min-h-10 items-center justify-center rounded-full bg-white px-2 shadow-lg shadow-[#071947]/10 ring-1 ring-[#eef1f5] sm:px-4"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto -mt-8 hidden max-w-7xl px-4 md:block">
        <div className="rounded-lg bg-white px-4 py-4 shadow-xl shadow-[#071947]/10">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-10">
            {treeShowcase.slice(0, 10).map((category, index) => (
              <Link
                key={category.slug}
                href={firstPartHref(category)}
                className="group flex min-h-[96px] flex-col items-center justify-center gap-2 rounded-lg px-2 text-center transition hover:bg-[#fff4ec]"
              >
                <span
                  className={`flex h-14 w-14 items-center justify-center rounded-full ${
                    [
                      "bg-[#e9f2ff] text-[#194f94]",
                      "bg-[#fff0e5] text-[#ff6b1a]",
                      "bg-[#eaf8ed] text-[#2f7a3d]",
                      "bg-[#fff0f6] text-[#b32761]",
                    ][index % 4]
                  }`}
                >
                  <span className="h-7 w-5 rounded-sm border-2 border-current" />
                </span>
                <span className="text-xs font-bold leading-4 text-[#071947] group-hover:text-[#ff6b1a]">
                  {category.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto mt-3 hidden max-w-7xl px-4 md:block">
        <div className="grid gap-0 overflow-hidden rounded-lg bg-[#071947] text-white shadow-lg md:grid-cols-5">
          {marketplaceBenefits.map((card) => (
            <div
              key={card.title}
              className="border-b border-white/15 px-5 py-4 md:border-b-0 md:border-r md:last:border-r-0"
            >
              <p className="text-base font-bold">{card.title}</p>
              <p className="mt-1 text-sm leading-5 text-[#cfd8ea]">{card.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="products-desktop" className="mx-auto mt-5 hidden max-w-7xl px-4 md:block">
        <div className="bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-bold">Today&apos;s deals</h2>
            <Link href="/products" className="text-sm font-semibold text-[#007185]">
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
          <div className="bg-white p-5 shadow-sm">
            <h2 className="text-2xl font-bold">Recommended for you</h2>
            <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {freshProducts.map((product) => (
                <Link
                  key={product.id}
                  href={`/products/${product.id}`}
                  className="group block border border-[#e5e7eb] p-3 transition hover:border-[#febd69]"
                >
                  <div className="relative aspect-square bg-[#f3f4f6]">
                    <Image
                      src={product.images?.[0] || fallbackImage}
                      alt={product.name}
                      fill
                      sizes="(min-width: 1280px) 260px, (min-width: 768px) 33vw, 50vw"
                      className="object-contain transition duration-300 group-hover:scale-105"
                    />
                  </div>
                  <p className="mt-3 line-clamp-2 h-10 text-sm font-semibold">
                    {product.name}
                  </p>
                  <p className="mt-2 font-bold text-[#b12704]">
                    {priceLabel(product.price)}
                  </p>
                  {product.mrp && product.mrp > product.price && (
                    <p className="text-xs text-[#565959]">
                      <span className="line-through">
                        {priceLabel(product.mrp)}
                      </span>{" "}
                      <span className="font-bold text-green-700">
                        {product.discountPercent || 0}% off
                      </span>
                    </p>
                  )}
                </Link>
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
                href="/vendor/register"
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

      <footer className="mt-8 hidden bg-[#131921] text-white md:block">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-4">
          <div>
            <h3 className="text-xl font-bold">Zylo-Buylo</h3>
            <p className="mt-3 text-sm leading-6 text-[#c8d0d6]">
              Marketplace for electronics, fashion, home, fittings and appliance
              spare parts.
            </p>
          </div>
          {["Shop", "Sell", "Support"].map((section) => (
            <div key={section}>
              <h4 className="mb-3 font-bold">{section}</h4>
              <div className="grid gap-2 text-sm text-[#c8d0d6]">
                <Link href="/products">Products</Link>
                <Link href="/vendor/register">Vendor registration</Link>
                <Link href="/login">Account</Link>
              </div>
            </div>
          ))}
        </div>
      </footer>

      <MobileNavbar />
    </main>
  );
}
