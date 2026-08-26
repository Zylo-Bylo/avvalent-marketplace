"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import MobileNavbar from "@/components/MobileNavbar";
import Navbar from "@/components/navbar/Navbar";

type Product = {
  id: string;
  name: string;
  price: number;
  mrp?: number | null;
  discountPercent?: number | null;
  images: string[];
  inventory: number;
  category?: { id: string; name: string } | null;
  subcategory?: { id: string; name: string } | null;
  _count?: { reviews?: number };
};

type Vendor = {
  id: string;
  storeName: string;
  description?: string | null;
  logoUrl?: string | null;
  businessCategory?: string | null;
  deliveryArea?: string | null;
  _count?: {
    products?: number;
    orders?: number;
  };
};

type Category = {
  id: string;
  name: string;
};

const fallbackImage = "/product-placeholder.svg";

function money(value: number | null | undefined) {
  return `Rs. ${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  })}`;
}

function getMetric(seed: string, min: number, range: number) {
  const total = seed.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return min + (total % range);
}

export default function VendorShopPage() {
  const params = useParams();
  const id = String(params?.id || "");
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState("newest");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const followerCount = useMemo(
    () => getMetric(vendor?.id || id, 180, 2600),
    [id, vendor?.id],
  );

  useEffect(() => {
    let isActive = true;

    async function loadShop() {
      if (!id) {
        return;
      }

      setLoading(true);
      setError("");
      const params = new URLSearchParams({ sort });

      if (categoryId) {
        params.set("categoryId", categoryId);
      }
      if (minPrice) {
        params.set("minPrice", minPrice);
      }
      if (maxPrice) {
        params.set("maxPrice", maxPrice);
      }

      const response = await fetch(`/api/vendors/${id}/shop?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await response.json();

      if (!isActive) {
        return;
      }

      if (!response.ok) {
        setError(data.error || "Could not load shop.");
        setLoading(false);
        return;
      }

      setVendor(data.vendor);
      setProducts(data.products || []);
      setCategories(data.categories || []);
      setLoading(false);
    }

    loadShop();

    return () => {
      isActive = false;
    };
  }, [categoryId, id, maxPrice, minPrice, sort]);

  function resetFilters() {
    setCategoryId("");
    setMinPrice("");
    setMaxPrice("");
    setSort("newest");
  }

  return (
    <main className="min-h-screen bg-[#f7f2ea] pb-20 text-stone-950">
      <Navbar />

      <section className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-5">
          <div className="h-36 rounded-sm bg-[linear-gradient(135deg,#ffd6e8,#f6ecff_45%,#fff4cf)]" />
          <div className="-mt-8 flex flex-col gap-4 px-2 md:flex-row md:items-end md:justify-between">
            <div className="flex items-end gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-pink-50 text-3xl font-black text-pink-700 shadow">
                {vendor?.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={vendor.logoUrl}
                    alt=""
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  vendor?.storeName?.slice(0, 1) || "Z"
                )}
              </div>
              <div className="pb-1">
                <h1 className="text-2xl font-bold">
                  {vendor?.storeName || "Vendor Shop"}
                </h1>
                <p className="mt-1 text-sm text-stone-500">
                  {vendor?.description ||
                    vendor?.businessCategory ||
                    "Verified seller on Zylo-Buylo marketplace."}
                </p>
                <div className="mt-2 flex flex-wrap gap-3 text-sm text-stone-600">
                  <span className="rounded bg-green-100 px-2 py-0.5 font-bold text-green-700">
                    4.3 rating
                  </span>
                  <span>{followerCount} Followers</span>
                  <span>{vendor?._count?.products || products.length} Products</span>
                  <span>{vendor?._count?.orders || 0} Orders</span>
                </div>
              </div>
            </div>
            <button className="rounded-sm bg-[#9f2089] px-10 py-3 text-sm font-bold text-white">
              Follow
            </button>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-4 py-6 lg:grid-cols-[250px_1fr]">
        <aside className="h-fit border border-stone-200 bg-white p-4 shadow-sm lg:sticky lg:top-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold">FILTERS</h2>
              <p className="text-xs text-stone-500">{products.length} Products</p>
            </div>
            <button
              onClick={resetFilters}
              className="text-xs font-bold text-[#9f2089]"
            >
              Clear
            </button>
          </div>

          <div className="mt-5 space-y-5">
            <div>
              <label className="text-sm font-bold">Sort by</label>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value)}
                className="mt-2 w-full border border-stone-300 px-3 py-2 text-sm"
              >
                <option value="newest">Relevance</option>
                <option value="price-asc">Price low to high</option>
                <option value="price-desc">Price high to low</option>
              </select>
            </div>

            <div className="border-t border-stone-200 pt-4">
              <p className="text-sm font-bold">Category</p>
              <div className="mt-3 space-y-2">
                <label className="flex items-center gap-2 text-sm text-stone-700">
                  <input
                    type="radio"
                    checked={!categoryId}
                    onChange={() => setCategoryId("")}
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
                      onChange={() => setCategoryId(category.id)}
                    />
                    {category.name}
                  </label>
                ))}
              </div>
            </div>

            <div className="border-t border-stone-200 pt-4">
              <p className="text-sm font-bold">Price</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min="0"
                  value={minPrice}
                  onChange={(event) => setMinPrice(event.target.value)}
                  placeholder="Min"
                  className="w-full border border-stone-300 px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  min="0"
                  value={maxPrice}
                  onChange={(event) => setMaxPrice(event.target.value)}
                  placeholder="Max"
                  className="w-full border border-stone-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>
        </aside>

        <section>
          <div className="mb-4">
            <h2 className="text-xl font-bold">All Products</h2>
            <p className="text-sm text-stone-500">
              {loading ? "Loading..." : `Showing ${products.length} product(s)`}
            </p>
          </div>

          {error && (
            <p className="mb-4 border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </p>
          )}

          {loading ? (
            <p className="bg-white py-12 text-center text-stone-500">Loading shop...</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {products.map((product) => (
                <Link
                  key={product.id}
                  href={`/products/${product.id}`}
                  className="overflow-hidden rounded-sm border border-stone-200 bg-white shadow-sm transition hover:shadow-lg"
                >
                  <div className="aspect-[3/4] bg-stone-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={product.images?.[0] || fallbackImage}
                      alt={product.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="p-3">
                    <p className="line-clamp-1 text-sm text-stone-600">{product.name}</p>
                    <p className="mt-1 text-lg font-bold">{money(product.price)}</p>
                    {product.mrp && product.mrp > product.price && (
                      <p className="text-xs text-stone-500">
                        <span className="line-through">{money(product.mrp)}</span>{" "}
                        <span className="font-bold text-green-700">
                          {product.discountPercent || 0}% off
                        </span>
                      </p>
                    )}
                    <div className="mt-3 flex items-center gap-2">
                      <span className="rounded-full bg-green-600 px-2 py-0.5 text-xs font-bold text-white">
                        4.{getMetric(product.id, 1, 8)}
                      </span>
                      <span className="text-xs text-stone-500">
                        {product._count?.reviews || getMetric(product.id, 18, 900)} Reviews
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </section>

      <MobileNavbar />
    </main>
  );
}
