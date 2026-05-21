"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import MobileNavbar from "@/components/MobileNavbar";

type Product = {
  id: string;
  name: string;
  price: number;
  inventory: number;
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
  const [error, setError] = useState("");

  const selectedCategory = categories.find(
    (category) => category.id === categoryId
  );
  const subcategoryOptions = selectedCategory?.subcategories || [];

  useEffect(() => {
    let isActive = true;

    async function loadCategories() {
      const response = await fetch("/api/categories", { cache: "no-store" });

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

    async function loadProducts() {
      setLoading(true);
      setError("");

      const params = new URLSearchParams({
        limit: "100",
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
        setProducts([]);
        setError(data.error || "Could not load products.");
        setLoading(false);
        return;
      }

      setProducts(data.products || []);
      setLoading(false);
    }

    loadProducts();

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

      <main className="mx-auto grid max-w-7xl gap-5 px-4 py-6 lg:grid-cols-[280px_1fr]">
        <aside className="h-fit border border-[#dfd1bd] bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-xl font-bold">Filters</h1>
            {activeFilterCount > 0 && (
              <button
                onClick={resetFilters}
                className="text-sm font-semibold text-[#6b145d]"
              >
                Clear
              </button>
            )}
          </div>

          <div className="mt-4 space-y-4">
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full border border-stone-300 px-3 py-3 text-sm outline-none focus:border-[#6b145d]"
            />

            <select
              value={categoryId}
              onChange={(event) => handleCategoryChange(event.target.value)}
              className="w-full border border-stone-300 px-3 py-3 text-sm outline-none focus:border-[#6b145d]"
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>

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
                {loading ? "Loading..." : `${products.length} product(s) found`}
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
              {products.map((product) => (
                <Link key={product.id} href={`/products/${product.id}`}>
                  <div className="group h-full bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                    <div className="aspect-[4/5] overflow-hidden bg-[#e8dccb]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={product.images?.[0] || fallbackImage}
                        alt={product.name}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      />
                    </div>

                    <div className="p-4">
                      <p className="truncate text-xs font-semibold uppercase tracking-[0.14em] text-[#9c7a34]">
                        {product.subcategory?.name ||
                          product.category?.name ||
                          "Product"}
                      </p>
                      <h3 className="mt-2 truncate font-bold">
                        {product.name}
                      </h3>
                      <p className="mt-1 truncate text-sm text-stone-500">
                        {product.vendor?.storeName || "Marketplace vendor"}
                      </p>
                      <div className="mt-4 flex items-end justify-between gap-3">
                        <p className="text-xl font-bold text-[#315c48]">
                          Rs. {product.price}
                        </p>
                        <p
                          className={`text-xs font-semibold ${
                            product.inventory > 0
                              ? "text-green-700"
                              : "text-red-600"
                          }`}
                        >
                          {product.inventory > 0
                            ? `${product.inventory} left`
                            : "Out of stock"}
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {!loading && products.length === 0 && (
            <p className="mt-4 border border-[#dfd1bd] bg-white py-12 text-center text-stone-500">
              No products found for these filters.
            </p>
          )}
        </section>
      </main>

      <MobileNavbar />
    </div>
  );
}
