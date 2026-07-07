"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import MobileNavbar from "@/components/MobileNavbar";
import Navbar from "@/components/navbar/Navbar";
import {
  getCategoryListingConfig,
  getDefaultSizes,
  getSizeGuideLabel,
} from "@/lib/categoryFilters";
import type { CategoryFilter } from "@/lib/categoryFilters";
import { findCategoryPart } from "@/data/category-tree";
import { useWishlistStore } from "@/store/wishlist-store";

type Product = {
  id: string;
  slug?: string;
  name: string;
  price: number;
  mrp?: number | null;
  discountPercent?: number | null;
  inventory?: number | null;
  images: string[];
  variants?: Array<{
    id: string;
    sizeLabel?: string | null;
    numericSize?: string | null;
    stockQuantity: number;
  }>;
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

type CategoryListingClientProps = {
  mainSlug: string;
  groupSlug?: string;
  partSlug: string;
};

const fallbackImage = "https://placehold.co/900x1200/png?text=ZYLO+BUYLO";

function titleFromSlug(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function metric(seed: string, min: number, range: number) {
  const total = seed.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return min + (total % range);
}

function getProductHref(product: Product) {
  return `/products/${product.id}`;
}

function getStockSignal(product: Product) {
  const available = Number(product.inventory ?? 0);

  if (available <= 0) {
    return {
      label: "Out of Stock",
      className: "bg-stone-200 text-stone-700",
    };
  }

  if (available <= 3) {
    return {
      label: `Only ${available} left`,
      className: "bg-red-100 text-red-700",
    };
  }

  if (available <= 10) {
    return {
      label: "Low Stock",
      className: "bg-amber-100 text-amber-700",
    };
  }

  return {
    label: "In Stock",
    className: "bg-emerald-100 text-emerald-700",
  };
}

function getProductSizes(product: Product, fallbackSizes: string[]) {
  const variantSizes =
    product.variants
      ?.map((variant) => variant.sizeLabel || variant.numericSize)
      .filter((value): value is string => Boolean(value))
      .filter((value, index, list) => list.indexOf(value) === index)
      .slice(0, 5) || [];

  return variantSizes.length > 0 ? variantSizes : fallbackSizes;
}

function getActiveChips(filters: Record<string, string>, filterDefs: CategoryFilter[]) {
  return Object.entries(filters)
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => {
      const filter = filterDefs.find((item) => item.key === key);
      const option = filter?.options.find((item) => item.value === value);
      return {
        key,
        label: `${filter?.label || key}: ${option?.label || value}`,
      };
    });
}

export default function CategoryListingClient({
  mainSlug,
  groupSlug = "",
  partSlug,
}: CategoryListingClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const categoryPart = useMemo(
    () => (groupSlug ? findCategoryPart(mainSlug, groupSlug, partSlug) : null),
    [groupSlug, mainSlug, partSlug],
  );
  const config = useMemo(
    () =>
      getCategoryListingConfig({
        mainSlug,
        groupSlug,
        partSlug,
        mainName: categoryPart?.main.name || titleFromSlug(mainSlug),
        groupName: categoryPart?.group.name || (groupSlug ? titleFromSlug(groupSlug) : ""),
        partName: categoryPart?.part.name || titleFromSlug(partSlug),
      }),
    [categoryPart, groupSlug, mainSlug, partSlug],
  );
  const fallbackSizes = useMemo(
    () => getDefaultSizes(config.sizeGuideType),
    [config.sizeGuideType],
  );
  const sizeGuideLabel = getSizeGuideLabel(config.sizeGuideType);
  const addWishlist = useWishlistStore((state) => state.addItem);
  const removeWishlist = useWishlistStore((state) => state.removeItem);
  const isInWishlist = useWishlistStore((state) => state.isInWishlist);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [totalProducts, setTotalProducts] = useState(0);
  const [filterDraft, setFilterDraft] = useState<Record<string, string>>({});
  const [appliedFilters, setAppliedFilters] = useState<Record<string, string>>({});
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [filtersHydrated, setFiltersHydrated] = useState(false);

  const activeChips = getActiveChips(appliedFilters, config.filters);
  const searchTerm = config.displayName;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialFilters: Record<string, string> = {};

    config.filters.forEach((filter) => {
      const value = params.get(filter.key);
      if (value) {
        initialFilters[filter.key] = value;
      }
    });

    const legacySort = params.get("sort");
    if (legacySort && !initialFilters.sort) {
      initialFilters.sort = legacySort;
    }

    setFilterDraft(initialFilters);
    setAppliedFilters(initialFilters);
    setFiltersHydrated(true);
  }, [config.filters]);

  useEffect(() => {
    if (!filtersHydrated) {
      return;
    }

    let isActive = true;

    async function loadProducts() {
      setLoading(true);
      setError("");

      const params = new URLSearchParams({
        limit: "48",
        search: searchTerm,
        sort: appliedFilters.sort || "popular",
        includeInventoryDetails: "true",
      });

      const discount = appliedFilters.discount || appliedFilters.allDiscount;
      if (discount) {
        params.set("offer", "true");
      }

      const priceFilter = config.filters
        .find((filter) => filter.key === "price")
        ?.options.find((option) => option.value === appliedFilters.price);

      if (priceFilter?.minPrice) {
        params.set("minPrice", priceFilter.minPrice);
      }

      if (priceFilter?.maxPrice) {
        params.set("maxPrice", priceFilter.maxPrice);
      }

      if (appliedFilters.brand) {
        params.set("brand", appliedFilters.brand);
      }

      const response = await fetch(`/api/products?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await response.json();

      if (!isActive) {
        return;
      }

      if (!response.ok) {
        setProducts([]);
        setTotalProducts(0);
        setError(data.error || "Products could not be loaded.");
        setLoading(false);
        return;
      }

      setProducts(data.products || []);
      setTotalProducts(Number(data.total || 0));
      setLoading(false);
    }

    loadProducts();

    return () => {
      isActive = false;
    };
  }, [appliedFilters, config.filters, filtersHydrated, searchTerm]);

  function setDraftFilter(key: string, value: string) {
    setFilterDraft((current) => ({
      ...current,
      [key]: current[key] === value ? "" : value,
    }));
  }

  function applyFilters(nextFilters = filterDraft) {
    const cleanFilters = Object.fromEntries(
      Object.entries(nextFilters).filter(([, value]) => Boolean(value)),
    );
    const params = new URLSearchParams();

    Object.entries(cleanFilters).forEach(([key, value]) => {
      params.set(key, value);
    });

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    setAppliedFilters(cleanFilters);
    setFilterDraft(cleanFilters);
    setMobileFiltersOpen(false);
  }

  function clearFilters() {
    setFilterDraft({});
    applyFilters({});
  }

  function removeFilter(key: string) {
    const nextFilters = { ...appliedFilters };
    delete nextFilters[key];
    applyFilters(nextFilters);
  }

  function renderFilterControl(filter: CategoryFilter, compact = false) {
    return (
      <div key={filter.key} className={compact ? "border-b border-stone-200 py-4" : "relative"}>
        {compact ? (
          <p className="text-sm font-black text-[#132238]">{filter.label}</p>
        ) : (
          <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[#7a6426]">
            {filter.label}
          </p>
        )}
        <div className={compact ? "mt-3 grid grid-cols-2 gap-2" : "flex min-w-44 flex-col gap-1 rounded-lg border border-[#e6d6b9] bg-white p-2 shadow-sm"}>
          {filter.options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setDraftFilter(filter.key, option.value)}
              className={`rounded-md px-3 py-2 text-left text-xs font-bold transition ${
                filterDraft[filter.key] === option.value
                  ? "bg-[#132238] text-white"
                  : "bg-[#fbf7ef] text-stone-700 hover:bg-[#efe2c9]"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f7f1e7] pb-20 text-[#17130f]">
      <Navbar />

      <section className="bg-[#132238] text-[#fff8ed]">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 md:grid-cols-[minmax(0,1fr)_390px] md:items-center md:py-10">
          <div>
            <Link href="/" className="text-sm font-bold text-[#d5b46b] hover:text-white">
              Back to Home
            </Link>
            <p className="mt-5 text-xs font-black uppercase tracking-[0.28em] text-[#d5b46b]">
              Product Listing
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-normal md:text-5xl">
              {config.displayName}
            </h1>
            <p className="mt-3 text-sm font-semibold text-[#decfb5]">
              {config.breadcrumb.join(" / ")}
            </p>
            <p className="mt-5 max-w-2xl text-sm leading-6 text-[#f0e3ca]">
              Curated Zylo-Buylo fashion picks with quick category paths, smart filters,
              size cues and fresh marketplace stock.
            </p>
          </div>
          <div className="relative min-h-52 overflow-hidden rounded-md border border-[#d5b46b]/30 bg-[#efe2c9] md:min-h-72">
            <Image
              src={config.bannerImage}
              alt={`${config.displayName} category banner`}
              fill
              priority
              sizes="(min-width: 768px) 390px, 100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#132238]/65 via-transparent to-transparent" />
            <div className="absolute bottom-4 left-4 rounded-full bg-white/95 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-[#132238]">
              {sizeGuideLabel}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[#e5d6bd] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-black text-[#132238]">Select Your Category</h2>
              <p className="text-sm text-stone-500">Jump to related fashion shelves.</p>
            </div>
            <Link
              href="/products?category=fashion"
              className="w-fit rounded-full border border-[#d5b46b] px-4 py-2 text-xs font-black uppercase text-[#132238]"
            >
              View All Fashion
            </Link>
          </div>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {config.shortcutButtons.map((shortcut) => (
              <Link
                key={shortcut.slug}
                href={shortcut.href}
                className="shrink-0 rounded-full border border-[#e2cfaa] bg-[#fbf7ef] px-4 py-2 text-sm font-bold text-[#132238] hover:border-[#132238] hover:bg-white"
              >
                {shortcut.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-5">
        <div className="mb-4 rounded-md border border-[#e4d5bc] bg-white p-3 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#7a6426]">
                Filters
              </p>
              <p className="text-sm text-stone-500">
                {loading ? "Loading products..." : `${products.length} of ${totalProducts || products.length} products shown`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(true)}
              className="rounded-full bg-[#132238] px-4 py-2 text-sm font-black text-white lg:hidden"
            >
              Filter & Sort{activeChips.length ? ` (${activeChips.length})` : ""}
            </button>
          </div>

          <div className="mt-4 hidden gap-3 overflow-x-auto pb-2 lg:flex">
            {config.filters.map((filter) => (
              <details key={filter.key} className="group shrink-0">
                <summary className="cursor-pointer list-none rounded-full border border-[#e2cfaa] bg-[#fbf7ef] px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-[#132238]">
                  {filter.label}
                </summary>
                <div className="absolute z-20 mt-2">{renderFilterControl(filter)}</div>
              </details>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {activeChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => removeFilter(chip.key)}
                className="rounded-full bg-[#132238] px-3 py-1.5 text-xs font-bold text-white"
              >
                {chip.label} x
              </button>
            ))}
            {activeChips.length > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-full border border-[#d5b46b] px-3 py-1.5 text-xs font-black text-[#132238]"
              >
                Clear All
              </button>
            )}
            <button
              type="button"
              onClick={() => applyFilters()}
              className="hidden rounded-full bg-[#d5b46b] px-4 py-1.5 text-xs font-black text-[#132238] lg:inline-flex"
            >
              Apply
            </button>
          </div>
        </div>

        {error && (
          <p className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
            {error}
          </p>
        )}

        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, index) => (
              <div key={index} className="overflow-hidden rounded-md bg-white shadow-sm">
                <div className="aspect-[3/4] animate-pulse bg-stone-200" />
                <div className="space-y-2 p-3">
                  <div className="h-3 w-24 animate-pulse rounded bg-stone-200" />
                  <div className="h-4 w-full animate-pulse rounded bg-stone-200" />
                  <div className="h-4 w-20 animate-pulse rounded bg-stone-200" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-md bg-white p-8 text-center shadow-sm">
            <h2 className="text-2xl font-black">No products found yet</h2>
            <p className="mt-2 text-stone-500">
              Vendors can add products for {config.displayName} from the vendor dashboard.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {products.map((product, index) => {
              const stock = getStockSignal(product);
              const sizes = getProductSizes(product, fallbackSizes);
              const wishlistActive = isInWishlist(product.id);
              const categoryName = product.subcategory?.name || product.category?.name || config.displayName;

              return (
                <article
                  key={product.id}
                  className="group overflow-hidden rounded-md border border-[#eadcc2] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
                >
                  <div className="relative aspect-[3/4] overflow-hidden bg-[#e8dccb]">
                    <Link href={getProductHref(product)}>
                      <Image
                        src={product.images?.[0] || fallbackImage}
                        alt={product.name}
                        fill
                        priority={index < 4}
                        sizes="(min-width: 1280px) 220px, (min-width: 768px) 25vw, 50vw"
                        className="object-cover transition duration-300 group-hover:scale-105"
                      />
                    </Link>
                    <button
                      type="button"
                      aria-label={wishlistActive ? "Remove from wishlist" : "Add to wishlist"}
                      onClick={() => {
                        if (wishlistActive) {
                          removeWishlist(product.id);
                        } else {
                          addWishlist({
                            id: product.id,
                            name: product.name,
                            category: categoryName,
                            price: product.price,
                            mrp: product.mrp || undefined,
                            discountPercent: product.discountPercent || undefined,
                            image: product.images?.[0] || fallbackImage,
                          });
                        }
                      }}
                      className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-white/95 text-lg font-black text-[#132238] shadow"
                    >
                      {wishlistActive ? "\u2665" : "\u2661"}
                    </button>
                    <span className={`absolute left-2 top-2 rounded-full px-2 py-1 text-[10px] font-black ${stock.className}`}>
                      {stock.label}
                    </span>
                  </div>
                  <div className="p-3">
                    <p className="truncate text-[10px] font-black uppercase tracking-[0.14em] text-[#9c7a34]">
                      {product.vendor?.storeName || "Marketplace Brand"}
                    </p>
                    <Link href={getProductHref(product)}>
                      <h3 className="mt-1 line-clamp-2 min-h-9 text-sm font-black leading-5 text-[#17130f] hover:text-[#6b145d]">
                        {product.name}
                      </h3>
                    </Link>
                    <div className="mt-2 flex flex-wrap items-baseline gap-2">
                      <span className="text-base font-black text-[#315c48]">
                        Rs. {Number(product.price || 0).toLocaleString("en-IN")}
                      </span>
                      {product.mrp && product.mrp > product.price && (
                        <>
                          <span className="text-xs text-stone-500 line-through">
                            Rs. {Number(product.mrp).toLocaleString("en-IN")}
                          </span>
                          <span className="text-xs font-black text-green-700">
                            {product.discountPercent || 0}% off
                          </span>
                        </>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      <span className="rounded bg-green-600 px-1.5 py-0.5 font-black text-white">
                        4.{metric(product.id, 1, 8)}
                      </span>
                      <span className="text-stone-500">{metric(product.id, 24, 680)} ratings</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {sizes.map((size) => (
                        <span
                          key={size}
                          className="rounded-full border border-[#e2cfaa] px-2 py-1 text-[10px] font-bold text-stone-700"
                        >
                          {size}
                        </span>
                      ))}
                    </div>
                    <p className="mt-3 text-xs font-bold text-[#6b145d]">
                      {sizeGuideLabel}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 lg:hidden">
          <div className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-stone-200 bg-white pb-3">
              <div>
                <h2 className="text-lg font-black text-[#132238]">Filter & Sort</h2>
                <p className="text-xs text-stone-500">{config.displayName}</p>
              </div>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="rounded-full border border-stone-300 px-3 py-1.5 text-xs font-black"
              >
                Close
              </button>
            </div>
            <div>{config.filters.map((filter) => renderFilterControl(filter, true))}</div>
            <div className="sticky bottom-0 mt-4 grid grid-cols-2 gap-3 border-t border-stone-200 bg-white pt-3">
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-full border border-[#132238] px-4 py-3 text-sm font-black text-[#132238]"
              >
                Clear All
              </button>
              <button
                type="button"
                onClick={() => applyFilters()}
                className="rounded-full bg-[#132238] px-4 py-3 text-sm font-black text-white"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      <MobileNavbar />
    </main>
  );
}
