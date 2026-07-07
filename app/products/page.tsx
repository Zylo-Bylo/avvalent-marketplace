"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import MobileNavbar from "@/components/MobileNavbar";
import { getFashionCategoryHref } from "@/lib/categoryFilters";
import { useCartStore } from "@/store/cart-store";

type Product = {
  id: string;
  name: string;
  price: number;
  mrp?: number | null;
  discountPercent?: number | null;
  inventory: number;
  inventories?: Array<{
    availableStock: number;
    lowStockThreshold: number;
    criticalStockThreshold: number;
    stockStatus: string;
    allowBackorder: boolean;
    isPreOrder: boolean;
  }>;
  images: string[];
  categoryId?: string | null;
  subcategoryId?: string | null;
  category?: {
    id: string;
    name: string;
  } | null;
  subcategory?: {
    id: string;
    name: string;
  } | null;
  vendor?: {
    storeName: string;
  } | null;
};

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

const fallbackImage = "https://placehold.co/600x800/png?text=No+Image";

const attributeFilterGroups = [
  { title: "Color", values: ["Black", "White", "Blue", "Pink", "Green"] },
  { title: "Size", values: ["S", "M", "L", "XL"] },
  { title: "Rating", values: ["4.0+", "3.5+", "3.0+"] },
];

const brandFilters = [
  { name: "Samsung", slug: "samsung" },
  { name: "LG", slug: "lg" },
  { name: "Whirlpool", slug: "whirlpool" },
  { name: "IFB", slug: "ifb" },
  { name: "Haier", slug: "haier" },
  { name: "Bajaj", slug: "bajaj" },
  { name: "Boat", slug: "boat" },
  { name: "Noise", slug: "noise" },
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function getMetric(seed: string, min: number, range: number) {
  const total = seed.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return min + (total % range);
}

export default function ProductsPage() {
  const router = useRouter();
  const addCartItem = useCartStore((state) => state.addItem);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categorySlug, setCategorySlug] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState("newest");
  const [offerOnly, setOfferOnly] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState("");
  const [bulkOnly, setBulkOnly] = useState(false);
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showOutOfStock, setShowOutOfStock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [totalProducts, setTotalProducts] = useState(0);
  const [filtersHydrated, setFiltersHydrated] = useState(false);

  const selectedCategory = categories.find(
    (category) =>
      category.id === categoryId ||
      (categorySlug && (category.slug || slugify(category.name)) === categorySlug)
  );
  const subcategoryOptions = selectedCategory?.subcategories || [];
  const vendorBrandOptions = useMemo(() => {
    return Array.from(
      new Set(
        products
          .map((product) => product.vendor?.storeName)
          .filter((value): value is string => Boolean(value))
      )
    )
      .map((name) => ({ name, slug: slugify(name) }))
      .slice(0, 8);
  }, [products]);
  const visibleProducts = products;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryCategory = params.get("category") || "";
    const categoryListingHref = getFashionCategoryHref(queryCategory);

    if (categoryListingHref) {
      params.delete("category");
      const query = params.toString();
      router.replace(query ? `${categoryListingHref}?${query}` : categoryListingHref);
      return;
    }

    setSearch(params.get("search") || "");
    setCategoryId(params.get("categoryId") || "");
    setCategorySlug(queryCategory);
    setSubcategoryId(params.get("subcategoryId") || "");
    setMinPrice(params.get("minPrice") || "");
    setMaxPrice(params.get("maxPrice") || "");
    setSort(params.get("sort") || "newest");
    setOfferOnly(params.get("offer") === "true");
    setSelectedBrand(params.get("brand") || "");
    setBulkOnly(params.get("bulk") === "true");
    setFeaturedOnly(params.get("featured") === "true");
    setShowOutOfStock(params.get("includeOutOfStock") === "true");
    setFiltersHydrated(true);
  }, [router]);

  useEffect(() => {
    let isActive = true;

    async function loadCategories() {
      const response = await fetch("/api/categories");

      if (!isActive || !response.ok) {
        return;
      }

      const data = await response.json();
      setCategories(data.categories || []);
    }

    loadCategories();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!filtersHydrated) {
      return;
    }

    let isActive = true;

    async function loadProducts(nextOffset = 0, append = false) {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError("");

      const params = new URLSearchParams({
        limit: "24",
        offset: String(nextOffset),
        sort,
      });

      if (search.trim()) {
        params.set("search", search.trim());
      }

      if (categoryId) {
        params.set("categoryId", categoryId);
      }

      if (categorySlug && !categoryId) {
        params.set("category", categorySlug);
      }

      if (subcategoryId) {
        params.set("subcategoryId", subcategoryId);
      }

      if (minPrice) {
        params.set("minPrice", minPrice);
      }

      if (maxPrice) {
        params.set("maxPrice", maxPrice);
      }

      if (offerOnly) {
        params.set("offer", "true");
      }

      if (selectedBrand) {
        params.set("brand", selectedBrand);
      }

      if (bulkOnly) {
        params.set("bulk", "true");
      }

      if (featuredOnly) {
        params.set("featured", "true");
      }

      if (showOutOfStock) {
        params.set("includeOutOfStock", "true");
      }

      const response = await fetch(`/api/products?${params.toString()}`);
      const data = await response.json();

      if (!isActive) {
        return;
      }

      if (!response.ok) {
        if (!append) {
          setProducts([]);
        }
        setError(data.error || "Could not load products.");
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      setProducts((current) =>
        append ? [...current, ...(data.products || [])] : data.products || [],
      );
      setHasMore(Boolean(data.hasMore));
      setTotalProducts(Number(data.total || 0));
      setLoading(false);
      setLoadingMore(false);
    }

    loadProducts(0, false);

    return () => {
      isActive = false;
    };
  }, [
    categoryId,
    categorySlug,
    maxPrice,
    minPrice,
    bulkOnly,
    featuredOnly,
    offerOnly,
    search,
    selectedBrand,
    showOutOfStock,
    sort,
    subcategoryId,
    filtersHydrated,
  ]);

  const activeFilterCount = useMemo(
    () =>
      [search, categoryId, subcategoryId, minPrice, maxPrice].filter(Boolean)
        .length +
      (categorySlug ? 1 : 0) +
      (offerOnly ? 1 : 0) +
      (selectedBrand ? 1 : 0) +
      (bulkOnly ? 1 : 0) +
      (featuredOnly ? 1 : 0) +
      (showOutOfStock ? 1 : 0),
    [
      bulkOnly,
      categoryId,
      categorySlug,
      featuredOnly,
      maxPrice,
      minPrice,
      offerOnly,
      search,
      selectedBrand,
      showOutOfStock,
      subcategoryId,
    ]
  );

  function resetFilters() {
    setSearch("");
    setCategoryId("");
    setCategorySlug("");
    setSubcategoryId("");
    setMinPrice("");
    setMaxPrice("");
    setSort("newest");
    setOfferOnly(false);
    setSelectedBrand("");
    setBulkOnly(false);
    setFeaturedOnly(false);
    setShowOutOfStock(false);
  }

  function handleCategoryChange(value: string) {
    setCategoryId(value);
    setCategorySlug("");
    setSubcategoryId("");
  }

  function getProductCategoryName(product: Product) {
    return product.subcategory?.name || product.category?.name || "Product";
  }

  function addProductToCart(product: Product) {
    addCartItem({
      id: product.id,
      name: product.name,
      category: getProductCategoryName(product),
      price: Number(product.price),
      mrp: product.mrp || undefined,
      discountPercent: product.discountPercent || undefined,
      image: product.images?.[0] || fallbackImage,
      shippingCharge: 0,
    });
  }

  function handleAddToCart(
    event: React.MouseEvent<HTMLButtonElement>,
    product: Product,
  ) {
    event.preventDefault();
    addProductToCart(product);
  }

  function handleBuyNow(
    event: React.MouseEvent<HTMLButtonElement>,
    product: Product,
  ) {
    event.preventDefault();
    addProductToCart(product);
    router.push("/checkout");
  }

  return (
    <div className="min-h-screen bg-[#f6f0e8] pb-20 text-stone-950">
      <header className="border-b border-[#dfd1bd] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <Link href="/" className="text-3xl font-bold text-[#6b145d]">
              Zylo-Buylo.com
            </Link>
            <p className="mt-1 text-sm text-stone-500">
              Browse products with category, price and stock filters.
            </p>
          </div>

          <div className="flex gap-2">
            <Link
              href="/"
              className="border border-stone-300 bg-white px-4 py-2 text-sm font-semibold"
            >
              Home
            </Link>
            <Link
              href="/cart"
              className="bg-[#6b145d] px-4 py-2 text-sm font-semibold text-white"
            >
              Cart
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6">
        <div className="sticky top-0 z-30 mb-4 rounded-2xl border border-[#ead7e8] bg-white/95 p-3 shadow-[0_10px_24px_rgba(15,23,42,0.10)] backdrop-blur lg:hidden">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="flex-1 rounded-full bg-[#6b145d] px-4 py-2.5 text-xs font-black uppercase text-white"
            >
              Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
            </button>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              aria-label="Sort products"
              className="min-w-0 flex-1 rounded-full border border-[#ead7e8] bg-white px-3 py-2.5 text-xs font-black text-[#6b145d] outline-none focus:border-[#6b145d]"
            >
              <option value="newest">Newest</option>
              <option value="popular">Popular</option>
              <option value="price-asc">Low price</option>
              <option value="price-desc">High price</option>
              <option value="trending">Trending</option>
            </select>
          </div>
          <p className="mt-2 text-center text-[11px] font-semibold text-stone-500">
            {loading
              ? "Loading products..."
              : `${visibleProducts.length}${totalProducts ? ` of ${totalProducts}` : ""} products shown`}
          </p>
        </div>

        {filtersOpen && (
          <button
            type="button"
            aria-label="Close filters"
            onClick={() => setFiltersOpen(false)}
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          />
        )}

        <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <aside
          className={`h-fit border border-[#dfd1bd] bg-white p-4 shadow-sm lg:sticky lg:top-4 ${
            filtersOpen
              ? "fixed inset-y-0 left-0 z-50 w-[88vw] max-w-sm overflow-y-auto"
              : "hidden lg:block"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-lg font-bold uppercase">Filters</h1>
              <p className="text-xs text-stone-500">
                {visibleProducts.length} Products
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFiltersOpen(false)}
              className="text-sm font-bold text-stone-500 lg:hidden"
            >
              Close
            </button>
            {activeFilterCount > 0 && (
              <button
                onClick={resetFilters}
                className="text-sm font-semibold text-[#6b145d]"
              >
                Clear
              </button>
            )}
          </div>

          <div className="mt-4 space-y-5">
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full border border-stone-300 px-3 py-3 text-sm outline-none focus:border-[#6b145d]"
            />

            <div className="border-t border-stone-200 pt-4">
              <p className="mb-3 text-sm font-bold">Category</p>
              <div className="max-h-56 space-y-2 overflow-auto pr-1">
                <label className="flex items-center gap-2 text-sm text-stone-700">
                  <input
                    type="radio"
                    checked={!categoryId && !categorySlug}
                    onChange={() => handleCategoryChange("")}
                  />
                  All categories
                </label>
                {categories.map((category) => (
                  <label
                    key={category.id}
                    className="flex items-center gap-2 text-sm text-stone-700"
                  >
                    <input
                      type="radio"
                      checked={
                        categoryId === category.id ||
                        (!!categorySlug &&
                          categorySlug === (category.slug || slugify(category.name)))
                      }
                      onChange={() => handleCategoryChange(category.id)}
                    />
                    {category.name}
                  </label>
                ))}
              </div>
            </div>

            <select
              value={subcategoryId}
              onChange={(event) => setSubcategoryId(event.target.value)}
              disabled={!selectedCategory}
              className="w-full border border-stone-300 px-3 py-3 text-sm outline-none focus:border-[#6b145d] disabled:bg-stone-100"
            >
              <option value="">
                {selectedCategory ? "All subcategories" : "Select category first"}
              </option>
              {subcategoryOptions.map((subcategory) => (
                <option key={subcategory.id} value={subcategory.id}>
                  {subcategory.name}
                </option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                min="0"
                placeholder="Min price"
                value={minPrice}
                onChange={(event) => setMinPrice(event.target.value)}
                className="w-full border border-stone-300 px-3 py-3 text-sm outline-none focus:border-[#6b145d]"
              />
              <input
                type="number"
                min="0"
                placeholder="Max price"
                value={maxPrice}
                onChange={(event) => setMaxPrice(event.target.value)}
                className="w-full border border-stone-300 px-3 py-3 text-sm outline-none focus:border-[#6b145d]"
              />
            </div>

            <div className="border-t border-stone-200 pt-4">
              <p className="mb-3 text-sm font-bold">Brand / Vendor</p>
              <select
                value={selectedBrand}
                onChange={(event) => setSelectedBrand(event.target.value)}
                className="w-full border border-stone-300 px-3 py-3 text-sm outline-none focus:border-[#6b145d]"
              >
                <option value="">All brands</option>
                {[...brandFilters, ...vendorBrandOptions].map((brand, index) => (
                  <option key={`${brand.slug}-${index}`} value={brand.slug}>
                    {brand.name}
                  </option>
                ))}
              </select>
            </div>

            {attributeFilterGroups.map((group) => (
              <details key={group.title} className="border-t border-stone-200 pt-4" open={group.title === "Rating"}>
                <summary className="cursor-pointer text-sm font-bold">
                  {group.title}
                </summary>
                <div className="mt-3 flex flex-wrap gap-2">
                  {group.values.map((value) => (
                    <span
                      key={value}
                      className="rounded-full border border-stone-200 px-3 py-1 text-xs font-semibold text-stone-600"
                    >
                      {value}
                    </span>
                  ))}
                </div>
              </details>
            ))}

            <select
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              className="w-full border border-stone-300 px-3 py-3 text-sm outline-none focus:border-[#6b145d]"
            >
              <option value="newest">Newest first</option>
              <option value="new">New arrivals</option>
              <option value="popular">Popular first</option>
              <option value="trending">Trending first</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
              <option value="stock-low">Low stock first</option>
            </select>

            <label className="flex items-center gap-2 text-sm font-semibold text-stone-700">
              <input
                type="checkbox"
                checked={offerOnly}
                onChange={(event) => setOfferOnly(event.target.checked)}
              />
              Deals and offers only
            </label>

            <label className="flex items-center gap-2 text-sm font-semibold text-stone-700">
              <input
                type="checkbox"
                checked={bulkOnly}
                onChange={(event) => setBulkOnly(event.target.checked)}
              />
              Bulk quantity available
            </label>

            <label className="flex items-center gap-2 text-sm font-semibold text-stone-700">
              <input
                type="checkbox"
                checked={featuredOnly}
                onChange={(event) => setFeaturedOnly(event.target.checked)}
              />
              Featured products
            </label>

            <div className="border-t border-stone-200 pt-4">
              <p className="mb-3 text-sm font-bold">Stock status</p>
              <label className="flex items-center gap-2 text-sm font-semibold text-stone-700">
                <input
                  type="checkbox"
                  checked={showOutOfStock}
                  onChange={(event) => setShowOutOfStock(event.target.checked)}
                />
                Include out of stock
              </label>
            </div>
          </div>
        </aside>

        <section>
          <div className="mb-4 flex flex-col justify-between gap-3 bg-white px-4 py-3 shadow-sm md:flex-row md:items-center">
            <div>
              <h2 className="text-2xl font-bold">Product Listing</h2>
              <p className="text-sm text-stone-500">
                {loading
                  ? "Loading..."
                  : `${visibleProducts.length}${totalProducts ? ` of ${totalProducts}` : ""} product(s) loaded`}
              </p>
            </div>
            <Link
              href="/vendor/dashboard/upload"
              className="bg-[#17130f] px-4 py-2 text-sm font-semibold text-white"
            >
              Sell a Product
            </Link>
          </div>

          {error && (
            <p className="mb-4 border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          {loading ? (
            <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div
                  key={index}
                  className="overflow-hidden rounded-sm border border-stone-200 bg-white shadow-sm"
                >
                  <div className="aspect-[2/3] animate-pulse bg-stone-200 sm:aspect-[3/4]" />
                  <div className="space-y-1.5 p-1.5 sm:space-y-3 sm:p-4">
                    <div className="h-3 w-20 animate-pulse rounded bg-stone-200" />
                    <div className="h-4 w-full animate-pulse rounded bg-stone-200" />
                    <div className="h-4 w-2/3 animate-pulse rounded bg-stone-200" />
                    <div className="h-9 w-full animate-pulse rounded-full bg-stone-200" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
              {visibleProducts.map((product, index) => {
                const inventory = product.inventories?.[0];
                const available = Number(inventory?.availableStock ?? product.inventory ?? 0);
                const signal =
                  inventory?.isPreOrder
                    ? { label: "Pre Order Available", className: "bg-blue-100 text-blue-800" }
                    : inventory?.allowBackorder || inventory?.stockStatus === "BACKORDER"
                      ? { label: "Backorder Available", className: "bg-blue-100 text-blue-800" }
                      : available <= 0
                        ? { label: "Out of Stock", className: "bg-gray-200 text-gray-800" }
                        : available <= Number(inventory?.criticalStockThreshold ?? 3)
                          ? { label: `Only ${available} left - Order Soon`, className: "bg-red-100 text-red-800" }
                          : available <= Number(inventory?.lowStockThreshold ?? 10)
                            ? { label: `Only ${available} left`, className: "bg-orange-100 text-orange-800" }
                            : { label: "In Stock", className: "bg-green-100 text-green-800" };

                return (
                  <article
                    key={product.id}
                    className="group h-full overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl sm:rounded-sm"
                  >
                    <Link href={`/products/${product.id}`} className="block">
                      <div className="relative aspect-[2/3] overflow-hidden bg-[#e8dccb] sm:aspect-[3/4]">
                        <Image
                          src={product.images?.[0] || fallbackImage}
                          alt={product.name}
                          fill
                          priority={index < 4}
                          sizes="(min-width: 1280px) 240px, (min-width: 768px) 33vw, 50vw"
                          className="object-cover transition duration-300 group-hover:scale-105"
                        />
                        <span className={`absolute left-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold sm:left-2 sm:top-2 sm:px-2 sm:py-1 sm:text-[11px] ${signal.className}`}>
                          {signal.label}
                        </span>
                      </div>
                    </Link>

                    <div className="p-1.5 sm:p-4">
                      <Link href={`/products/${product.id}`} className="block">
                        <p className="hidden truncate text-[10px] font-semibold uppercase tracking-[0.1em] text-[#9c7a34] sm:block sm:text-xs sm:tracking-[0.14em]">
                          {getProductCategoryName(product)}
                        </p>
                        <h3 className="line-clamp-2 min-h-8 text-[11px] font-black leading-4 sm:mt-2 sm:min-h-0 sm:line-clamp-1 sm:text-base sm:leading-5">
                          {product.name}
                        </h3>
                        <p className="mt-1 hidden truncate text-sm text-stone-500 sm:block">
                          {product.vendor?.storeName || "Marketplace vendor"}
                        </p>
                      </Link>
                      <div className="mt-1.5 flex flex-col gap-0.5 sm:mt-4 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
                        <div>
                          <p className="text-sm font-black text-[#315c48] sm:text-xl">
                            Rs. {product.price}
                          </p>
                          {product.mrp && product.mrp > product.price && (
                            <p className="text-[11px] text-stone-500 sm:text-xs">
                              <span className="line-through">
                                Rs. {product.mrp}
                              </span>{" "}
                              <span className="font-bold text-green-700">
                                {product.discountPercent || 0}% off
                              </span>
                            </p>
                          )}
                        </div>
                        <p className="hidden text-[11px] font-semibold text-stone-600 sm:block sm:text-xs">
                          {available > 0 ? `${available} available` : "Notify me"}
                        </p>
                      </div>
                      <div className="mt-2 hidden items-center gap-1.5 sm:mt-3 sm:flex sm:gap-2">
                        <span className="rounded-full bg-green-600 px-1.5 py-0.5 text-[10px] font-bold text-white sm:px-2 sm:text-xs">
                          3.{getMetric(product.id, 5, 5)}
                        </span>
                        <span className="truncate text-[10px] text-stone-500 sm:text-xs">
                          {getMetric(product.id, 24, 780)} Reviews
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-1 sm:mt-4 sm:gap-2">
                        <button
                          type="button"
                          onClick={(event) => handleAddToCart(event, product)}
                          className="rounded-lg bg-[#6b145d] px-1.5 py-1.5 text-[9px] font-black uppercase text-white hover:bg-[#8b2c72] sm:rounded-sm sm:px-2 sm:py-2 sm:text-xs"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={(event) => handleBuyNow(event, product)}
                          className="rounded-lg border border-[#6b145d] bg-white px-1.5 py-1.5 text-[9px] font-black uppercase text-[#6b145d] hover:bg-[#fff4fb] sm:rounded-sm sm:px-2 sm:py-2 sm:text-xs"
                        >
                          Buy Now
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {!loading && visibleProducts.length === 0 && (
            <p className="mt-4 border border-[#dfd1bd] bg-white py-12 text-center text-stone-500">
              No products found for these filters.
            </p>
          )}

          {!loading && hasMore && (
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => {
                  const nextOffset = products.length;
                  const params = new URLSearchParams({
                    limit: "24",
                    offset: String(nextOffset),
                    sort,
                  });
                  if (search.trim()) params.set("search", search.trim());
                  if (categoryId) params.set("categoryId", categoryId);
                  if (categorySlug && !categoryId) params.set("category", categorySlug);
                  if (subcategoryId) params.set("subcategoryId", subcategoryId);
                  if (minPrice) params.set("minPrice", minPrice);
                  if (maxPrice) params.set("maxPrice", maxPrice);
                  if (offerOnly) params.set("offer", "true");
                  if (selectedBrand) params.set("brand", selectedBrand);
                  if (bulkOnly) params.set("bulk", "true");
                  if (featuredOnly) params.set("featured", "true");
                  if (showOutOfStock) params.set("includeOutOfStock", "true");

                  setLoadingMore(true);
                  fetch(`/api/products?${params.toString()}`)
                    .then((response) => response.json().then((data) => ({ response, data })))
                    .then(({ response, data }) => {
                      if (!response.ok) {
                        setError(data.error || "Could not load more products.");
                        return;
                      }
                      setProducts((current) => [...current, ...(data.products || [])]);
                      setHasMore(Boolean(data.hasMore));
                      setTotalProducts(Number(data.total || totalProducts));
                    })
                    .catch((loadError) => {
                      setError(loadError instanceof Error ? loadError.message : "Could not load more products.");
                    })
                    .finally(() => setLoadingMore(false));
                }}
                disabled={loadingMore}
                className="rounded-full bg-[#6b145d] px-6 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingMore ? "Loading..." : "Load More Products"}
              </button>
            </div>
          )}
        </section>
        </div>
      </main>

      <MobileNavbar />
    </div>
  );
}
