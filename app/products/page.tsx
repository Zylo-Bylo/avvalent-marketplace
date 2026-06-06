"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import MobileNavbar from "@/components/MobileNavbar";

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
  subcategories?: Subcategory[];
};

const fallbackImage = "https://placehold.co/600x800/png?text=No+Image";

const visualFilterGroups = [
  { title: "Gender", values: ["Boys", "Men", "Women"] },
  { title: "Color", values: ["Black", "White", "Blue", "Pink", "Green"] },
  { title: "Fabric", values: ["Cotton", "Polyester", "Silk", "Denim"] },
  { title: "Size", values: ["S", "M", "L", "XL"] },
  { title: "Rating", values: ["4.0+", "3.5+", "3.0+"] },
];

function getMetric(seed: string, min: number, range: number) {
  const total = seed.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return min + (total % range);
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState("newest");
  const [showOutOfStock, setShowOutOfStock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [totalProducts, setTotalProducts] = useState(0);

  const selectedCategory = categories.find(
    (category) => category.id === categoryId
  );
  const subcategoryOptions = selectedCategory?.subcategories || [];

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
    let isActive = true;

    async function loadProducts(nextOffset = 0, append = false) {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError("");

      const params = new URLSearchParams({
        limit: "40",
        offset: String(nextOffset),
        sort,
      });

      if (search.trim()) {
        params.set("search", search.trim());
      }

      if (categoryId) {
        params.set("categoryId", categoryId);
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

      if (showOutOfStock) {
        params.set("includeOutOfStock", "true");
      }

      const response = await fetch(`/api/products?${params.toString()}`, {
        cache: "no-store",
      });
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
    maxPrice,
    minPrice,
    search,
    showOutOfStock,
    sort,
    subcategoryId,
  ]);

  const activeFilterCount = useMemo(
    () =>
      [search, categoryId, subcategoryId, minPrice, maxPrice].filter(Boolean)
        .length + (showOutOfStock ? 1 : 0),
    [categoryId, maxPrice, minPrice, search, showOutOfStock, subcategoryId]
  );

  function resetFilters() {
    setSearch("");
    setCategoryId("");
    setSubcategoryId("");
    setMinPrice("");
    setMaxPrice("");
    setSort("newest");
    setShowOutOfStock(false);
  }

  function handleCategoryChange(value: string) {
    setCategoryId(value);
    setSubcategoryId("");
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

      <main className="mx-auto grid max-w-7xl gap-5 px-4 py-6 lg:grid-cols-[260px_1fr]">
        <aside className="h-fit border border-[#dfd1bd] bg-white p-4 shadow-sm lg:sticky lg:top-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-lg font-bold uppercase">Filters</h1>
              <p className="text-xs text-stone-500">{products.length} Products</p>
            </div>
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
                    checked={!categoryId}
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
                      checked={categoryId === category.id}
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
              disabled={!categoryId}
              className="w-full border border-stone-300 px-3 py-3 text-sm outline-none focus:border-[#6b145d] disabled:bg-stone-100"
            >
              <option value="">
                {categoryId ? "All subcategories" : "Select category first"}
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

            {visualFilterGroups.map((group) => (
              <details key={group.title} className="border-t border-stone-200 pt-4" open={group.title === "Gender"}>
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
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
              <option value="stock-low">Low stock first</option>
            </select>

            <label className="flex items-center gap-2 text-sm font-semibold text-stone-700">
              <input
                type="checkbox"
                checked={showOutOfStock}
                onChange={(event) => setShowOutOfStock(event.target.checked)}
              />
              Include out of stock
            </label>
          </div>
        </aside>

        <section>
          <div className="mb-4 flex flex-col justify-between gap-3 bg-white px-4 py-3 shadow-sm md:flex-row md:items-center">
            <div>
              <h2 className="text-2xl font-bold">Product Listing</h2>
              <p className="text-sm text-stone-500">
                {loading
                  ? "Loading..."
                  : `${products.length}${totalProducts ? ` of ${totalProducts}` : ""} product(s) loaded`}
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
            <p className="bg-white py-12 text-center text-stone-500">
              Loading products...
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {products.map((product) => {
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
                  <Link key={product.id} href={`/products/${product.id}`}>
                    <div className="group h-full overflow-hidden rounded-sm border border-stone-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                    <div className="relative aspect-[3/4] overflow-hidden bg-[#e8dccb]">
                      <Image
                        src={product.images?.[0] || fallbackImage}
                        alt={product.name}
                        fill
                        sizes="(min-width: 1280px) 240px, (min-width: 768px) 33vw, 50vw"
                        className="object-cover transition duration-300 group-hover:scale-105"
                      />
                      <span className={`absolute left-2 top-2 rounded-full px-2 py-1 text-[11px] font-bold ${signal.className}`}>
                        {signal.label}
                      </span>
                    </div>

                    <div className="p-4">
                      <p className="truncate text-xs font-semibold uppercase tracking-[0.14em] text-[#9c7a34]">
                        {product.subcategory?.name ||
                          product.category?.name ||
                          "Product"}
                      </p>
                      <h3 className="mt-2 line-clamp-1 font-bold">
                        {product.name}
                      </h3>
                      <p className="mt-1 truncate text-sm text-stone-500">
                        {product.vendor?.storeName || "Marketplace vendor"}
                      </p>
                      <div className="mt-4 flex items-end justify-between gap-3">
                        <div>
                          <p className="text-xl font-bold text-[#315c48]">
                            Rs. {product.price}
                          </p>
                          {product.mrp && product.mrp > product.price && (
                            <p className="text-xs text-stone-500">
                              <span className="line-through">
                                Rs. {product.mrp}
                              </span>{" "}
                              <span className="font-bold text-green-700">
                                {product.discountPercent || 0}% off
                              </span>
                            </p>
                          )}
                        </div>
                        <p className="text-xs font-semibold text-stone-600">
                          {available > 0 ? `${available} available` : "Notify me"}
                        </p>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <span className="rounded-full bg-green-600 px-2 py-0.5 text-xs font-bold text-white">
                          3.{getMetric(product.id, 5, 5)}
                        </span>
                        <span className="text-xs text-stone-500">
                          {getMetric(product.id, 24, 780)} Reviews
                        </span>
                      </div>
                    </div>
                  </div>
                  </Link>
                );
              })}
            </div>
          )}

          {!loading && products.length === 0 && (
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
                    limit: "40",
                    offset: String(nextOffset),
                    sort,
                  });
                  if (search.trim()) params.set("search", search.trim());
                  if (categoryId) params.set("categoryId", categoryId);
                  if (subcategoryId) params.set("subcategoryId", subcategoryId);
                  if (minPrice) params.set("minPrice", minPrice);
                  if (maxPrice) params.set("maxPrice", maxPrice);
                  if (showOutOfStock) params.set("includeOutOfStock", "true");

                  setLoadingMore(true);
                  fetch(`/api/products?${params.toString()}`, { cache: "no-store" })
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
      </main>

      <MobileNavbar />
    </div>
  );
}
