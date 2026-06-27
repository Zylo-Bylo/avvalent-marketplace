"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Navbar from "@/components/navbar/Navbar";
import MobileNavbar from "@/components/MobileNavbar";
import { findCategoryPart } from "@/data/category-tree";

type Product = {
  id: string;
  name: string;
  price: number;
  mrp?: number | null;
  discountPercent?: number | null;
  images: string[];
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

const fallbackImage = "https://placehold.co/900x1200/png?text=ZYLO+BUYLO";

export default function CategoryPartPage() {
  const params = useParams();
  const mainSlug = String(params?.main || "");
  const subSlug = String(params?.sub || "");
  const partSlug = String(params?.part || "");
  const categoryPart = findCategoryPart(mainSlug, subSlug, partSlug);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const searchTerm = useMemo(
    () => categoryPart?.part.name || partSlug.replace(/-/g, " "),
    [categoryPart, partSlug]
  );

  useEffect(() => {
    let isActive = true;

    async function loadProducts() {
      setLoading(true);
      const response = await fetch(
        `/api/products?limit=100&search=${encodeURIComponent(searchTerm)}`,
        { cache: "no-store" }
      );

      if (!isActive) {
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setProducts(data.products || []);
      }

      setLoading(false);
    }

    loadProducts();

    return () => {
      isActive = false;
    };
  }, [searchTerm]);

  return (
    <main className="min-h-screen bg-[#f5efe5] text-[#18130f]">
      <Navbar />

      <section className="bg-[#17130f] text-[#fff8ed]">
        <div className="mx-auto max-w-7xl px-4 py-10">
          <Link href="/" className="text-sm font-semibold text-[#d5b46b]">
            Back to Home
          </Link>
          <p className="mt-5 text-sm uppercase tracking-[0.28em] text-[#d5b46b]">
            Product listing
          </p>
          <h1 className="mt-3 text-4xl font-bold">
            {categoryPart?.part.name || searchTerm}
          </h1>
          <p className="mt-2 text-sm text-[#d8c8af]">
            {categoryPart
              ? `${categoryPart.main.name} / ${categoryPart.group.name} / ${categoryPart.part.name}`
              : "Category part"}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8">
        {loading ? (
          <p className="bg-white py-12 text-center text-stone-500">
            Loading products...
          </p>
        ) : products.length === 0 ? (
          <div className="bg-white p-8 text-center shadow">
            <h2 className="text-2xl font-bold">No products found yet</h2>
            <p className="mt-2 text-stone-500">
              Vendors can add products for {searchTerm} from the vendor
              dashboard.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-5 md:grid-cols-4 lg:grid-cols-5">
            {products.map((product) => (
              <Link key={product.id} href={`/products/${product.id}`}>
                <div className="overflow-hidden bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                  <div className="aspect-[4/5] overflow-hidden bg-[#e8dccb]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={product.images?.[0] || fallbackImage}
                      alt={product.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9c7a34]">
                      {product.subcategory?.name ||
                        product.category?.name ||
                        "Product"}
                    </p>
                    <h2 className="mt-2 truncate font-bold">{product.name}</h2>
                    <p className="mt-1 truncate text-sm text-stone-500">
                      {product.vendor?.storeName || "Marketplace vendor"}
                    </p>
                    <p className="mt-4 text-xl font-bold text-[#315c48]">
                      Rs. {product.price}
                    </p>
                    {product.mrp && product.mrp > product.price && (
                      <p className="text-xs text-stone-500">
                        <span className="line-through">Rs. {product.mrp}</span>{" "}
                        <span className="font-bold text-green-700">
                          {product.discountPercent || 0}% off
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <MobileNavbar />
    </main>
  );
}
