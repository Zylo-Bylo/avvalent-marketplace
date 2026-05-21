"use client";

import Link from "next/link";
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

const fallbackImage = "https://placehold.co/900x1200/png?text=ZYLO+BUYLO";

const luxuryCollections = [
  "Fashion",
  "Beauty",
  "Hardware",
  "AC Parts",
  "Bathroom Fitting",
  "Electric Fitting",
];

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categoryRows, setCategoryRows] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState("");
  const [search, setSearch] = useState("");
  const [activeTreeSlug, setActiveTreeSlug] = useState(
    applianceCategoryTree[0]?.slug || ""
  );
  const [treeMenuOpen, setTreeMenuOpen] = useState(false);
  const [openMobileCategory, setOpenMobileCategory] = useState("");
  const [mounted, setMounted] = useState(false);

  const cartCount = useCartStore((state) => state.getTotalItems());
  const addWishlistItem = useWishlistStore((state) => state.addItem);
  const removeWishlistItem = useWishlistStore((state) => state.removeItem);
  const isInWishlist = useWishlistStore((state) => state.isInWishlist);

  useEffect(() => {
    let isActive = true;
    setMounted(true);

    async function loadHomeData() {
      const [productsResponse, categoriesResponse] = await Promise.all([
        fetch("/api/products?limit=100", { cache: "no-store" }),
        fetch("/api/categories", { cache: "no-store" }),
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
    }

    loadHomeData();

    return () => {
      isActive = false;
    };
  }, []);

  const selectedCategory = categoryRows.find(
    (category) => category.id === selectedCategoryId
  );
  const subcategoryRows = selectedCategory?.subcategories || [];
  const heroImage = products[0]?.images?.[0] || fallbackImage;
  const activeTreeCategory =
    applianceCategoryTree.find((category) => category.slug === activeTreeSlug) ||
    applianceCategoryTree[0];
  const visibleCartCount = mounted ? cartCount : 0;

  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name
      .toLowerCase()
      .includes(search.toLowerCase());

    const matchesCategory =
      !selectedCategoryId || product.categoryId === selectedCategoryId;

    const matchesSubcategory =
      !selectedSubcategoryId || product.subcategoryId === selectedSubcategoryId;

    return matchesSearch && matchesCategory && matchesSubcategory;
  });

  const featuredCategories = useMemo(
    () =>
      categoryRows.slice(0, 9).map((category, index) => ({
        ...category,
        tone:
          [
            "border-[#c8a968] bg-[#fff9ed]",
            "border-[#315c48] bg-[#eef8f1]",
            "border-[#9b4d48] bg-[#fff0ed]",
          ][index % 3],
      })),
    [categoryRows]
  );

  function getCategoryName(product: Product) {
    return product.category?.name || "Curated";
  }

  function getWishlistId(productId: string) {
    return productId.split("").reduce((total, character) => {
      return total + character.charCodeAt(0);
    }, 0);
  }

  function chooseCategory(categoryId: string) {
    setSelectedCategoryId(categoryId);
    setSelectedSubcategoryId("");
  }

  function handleWishlistClick(
    event: React.MouseEvent<HTMLButtonElement>,
    product: Product
  ) {
    event.preventDefault();

    const wishlistId = getWishlistId(product.id);

    if (isInWishlist(wishlistId)) {
      removeWishlistItem(wishlistId);
    } else {
      addWishlistItem({
        id: wishlistId,
        name: product.name,
        category: getCategoryName(product),
        price: Number(product.price),
        image: product.images?.[0] || fallbackImage,
      });
    }
  }

  return (
    <main className="min-h-screen bg-[#f5efe5] text-[#18130f]">
      <header className="relative z-40 border-b border-[#dfd1bd] bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-5 px-4 py-4">
          <Link
            href="/"
            className="shrink-0 whitespace-nowrap text-3xl font-bold tracking-tight text-[#6b145d] lg:text-4xl"
          >
            Zylo-Buylo.com
          </Link>

          <div className="hidden flex-1 items-center border border-[#b9adbd] bg-white px-4 md:flex">
            <span className="mr-3 text-xs font-bold uppercase tracking-[0.18em] text-stone-400">
              Search
            </span>
            <input
              type="text"
              placeholder="Try Saree, AC Compressor or Search by Product Code"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="min-h-11 w-full text-sm outline-none"
            />
          </div>

          <div className="hidden items-center divide-x divide-stone-200 text-sm font-semibold text-[#18130f] md:flex">
            <Link
              href="/vendor/register"
              className="px-4 leading-tight hover:text-[#6b145d]"
            >
              Become a<br />Supplier
            </Link>
            <Link
              href="/admin/categories"
              className="px-4 leading-tight hover:text-[#6b145d]"
            >
              Category<br />Manager
            </Link>
            <Link
              href="/login"
              className="px-4 text-center hover:text-[#6b145d]"
            >
              Profile
            </Link>
            <Link
              href="/cart"
              className="px-4 text-center hover:text-[#6b145d]"
            >
              Cart {visibleCartCount}
            </Link>
          </div>
        </div>

        <div className="px-4 pb-3 md:hidden">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" className="text-3xl font-bold text-[#6b145d]">
              Zylo-Buylo.com
            </Link>
            <Link href="/cart" className="text-sm font-semibold">
              Cart {visibleCartCount}
            </Link>
          </div>
          <input
            type="text"
            placeholder="Search AC, TV, washing machine parts..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="mt-3 w-full border border-[#b9adbd] px-4 py-3 text-sm outline-none"
          />
        </div>

        <div
          className="relative hidden border-t border-[#ede5ef] md:block"
          onMouseLeave={() => setTreeMenuOpen(false)}
        >
          <nav className="mx-auto flex max-w-7xl items-center gap-5 overflow-x-auto px-4">
            {applianceCategoryTree.map((category) => (
              <button
                key={category.slug}
                onMouseEnter={() => {
                  setActiveTreeSlug(category.slug);
                  setTreeMenuOpen(true);
                }}
                onFocus={() => {
                  setActiveTreeSlug(category.slug);
                  setTreeMenuOpen(true);
                }}
                onClick={() => {
                  setActiveTreeSlug(category.slug);
                  setTreeMenuOpen((open) => !open);
                }}
                className={`shrink-0 border-b-2 px-1 py-4 text-sm font-semibold transition ${
                  activeTreeSlug === category.slug && treeMenuOpen
                    ? "border-[#6b145d] text-[#6b145d]"
                    : "border-transparent text-[#18130f] hover:text-[#6b145d]"
                }`}
              >
                {category.name}
              </button>
            ))}
          </nav>

          {treeMenuOpen && activeTreeCategory && (
            <div className="absolute left-1/2 top-full z-50 w-[min(1224px,calc(100vw-64px))] -translate-x-1/2 border border-[#ead8e8] bg-white shadow-2xl">
              <div className="grid auto-cols-fr md:grid-cols-4">
                {activeTreeCategory.groups.map((group, index) => (
                  <div
                    key={group.slug}
                    className={`min-h-64 p-5 ${
                      index % 2 === 1 ? "bg-[#f7f4fb]" : "bg-white"
                    }`}
                  >
                    <p className="mb-2 text-sm font-bold text-[#6b145d]">
                      {group.name}
                    </p>
                    <div className="grid gap-1">
                      {group.parts.map((item) => (
                        <Link
                          key={item.slug}
                          href={getPartHref(
                            activeTreeCategory.slug,
                            group.slug,
                            item.slug
                          )}
                          className="block rounded px-2 py-1.5 text-sm text-stone-600 hover:bg-[#fff1fb] hover:text-[#6b145d]"
                        >
                          {item.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-[#ede5ef] px-4 py-3 md:hidden">
          <div className="space-y-2">
            {applianceCategoryTree.map((category) => (
              <div key={category.slug} className="border border-[#ead8e8] bg-white">
                <button
                  onClick={() =>
                    setOpenMobileCategory((current) =>
                      current === category.slug ? "" : category.slug
                    )
                  }
                  className="flex w-full items-center justify-between px-3 py-3 text-left text-sm font-bold"
                >
                  <span>{category.name}</span>
                  <span>{openMobileCategory === category.slug ? "-" : "+"}</span>
                </button>

                {openMobileCategory === category.slug && (
                  <div className="grid gap-3 border-t border-[#ead8e8] p-3">
                    {category.groups.map((group) => (
                      <div key={group.slug}>
                        <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-[#6b145d]">
                          {group.name}
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {group.parts.map((item) => (
                            <Link
                              key={item.slug}
                              href={getPartHref(
                                category.slug,
                                group.slug,
                                item.slug
                              )}
                              className="bg-[#faf2f8] px-3 py-2 text-xs font-semibold text-stone-700"
                            >
                              {item.name}
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </header>

      <section
        className="relative min-h-[440px] overflow-hidden bg-[#17130f] text-[#fff8ed]"
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(23,19,15,0.96), rgba(23,19,15,0.78), rgba(23,19,15,0.25)), url("${heroImage}")`,
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
      >
        <div className="mx-auto flex min-h-[440px] max-w-7xl flex-col justify-between px-4 py-8">
          <div className="max-w-3xl py-12">
            <p className="text-sm font-semibold uppercase tracking-[0.38em] text-[#d5b46b]">
              Premium marketplace
            </p>
            <h1 className="mt-5 text-4xl font-bold leading-tight md:text-6xl">
              Curated style, spares, fittings and essentials.
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-[#e5d6bf]">
              Shop fashion and beauty with the same ease as hardware, AC parts,
              washing machine parts, bathroom fittings, and electric fittings.
            </p>
            <Link
              href="#products"
              className="mt-8 inline-block bg-white px-8 py-4 text-lg font-bold text-[#6b145d]"
            >
              Shop Now
            </Link>
          </div>

          <div className="grid gap-3 pb-2 md:grid-cols-3">
            {["Trusted vendors", "Luxury catalogue", "Daily utility parts"].map(
              (item) => (
                <div key={item} className="border border-white/20 px-4 py-3">
                  <p className="text-sm font-semibold">{item}</p>
                </div>
              )
            )}
          </div>
        </div>
      </section>

      <section className="border-b border-[#dfd1bd] bg-[#fffaf1]">
        <div className="mx-auto flex max-w-7xl gap-3 overflow-x-auto px-4 py-4">
          <button
            onClick={() => chooseCategory("")}
            className={`whitespace-nowrap border px-5 py-2 text-sm font-semibold ${
              !selectedCategoryId
                ? "border-[#17130f] bg-[#17130f] text-white"
                : "border-[#d8c6aa] bg-white text-[#17130f]"
            }`}
          >
            All Collections
          </button>

          {categoryRows.map((category) => (
            <button
              key={category.id}
              onClick={() => chooseCategory(category.id)}
              className={`whitespace-nowrap border px-5 py-2 text-sm font-semibold ${
                selectedCategoryId === category.id
                  ? "border-[#9c7a34] bg-[#9c7a34] text-white"
                  : "border-[#d8c6aa] bg-white text-[#17130f]"
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>

        {subcategoryRows.length > 0 && (
          <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 pb-4">
            <button
              onClick={() => setSelectedSubcategoryId("")}
              className={`whitespace-nowrap px-4 py-2 text-xs font-semibold ${
                !selectedSubcategoryId
                  ? "bg-[#315c48] text-white"
                  : "bg-[#eadfce] text-[#17130f]"
              }`}
            >
              All {selectedCategory?.name}
            </button>
            {subcategoryRows.map((subcategory) => (
              <button
                key={subcategory.id}
                onClick={() => setSelectedSubcategoryId(subcategory.id)}
                className={`whitespace-nowrap px-4 py-2 text-xs font-semibold ${
                  selectedSubcategoryId === subcategory.id
                    ? "bg-[#315c48] text-white"
                    : "bg-[#eadfce] text-[#17130f]"
                }`}
              >
                {subcategory.name}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="mb-6 flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#9c7a34]">
              Category plan
            </p>
            <h2 className="mt-2 text-3xl font-bold">Marketplace discovery</h2>
          </div>
          <p className="max-w-xl text-sm text-stone-600">
            A broad tree for fashion and home shopping, extended with practical
            repair and fitting categories for local marketplace vendors.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {featuredCategories.map((category) => (
            <button
              key={category.id}
              onClick={() => chooseCategory(category.id)}
              className={`border p-5 text-left transition hover:-translate-y-1 ${category.tone}`}
            >
              <p className="text-xl font-bold">{category.name}</p>
              <p className="mt-3 line-clamp-2 text-sm text-stone-600">
                {(category.subcategories || [])
                  .slice(0, 4)
                  .map((subcategory) => subcategory.name)
                  .join(" / ") || "Add subcategories from admin"}
              </p>
            </button>
          ))}
        </div>
      </section>

      <section className="bg-[#17130f] text-[#fff8ed]">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 md:grid-cols-6">
          {luxuryCollections.map((item) => (
            <div key={item} className="border border-[#d5b46b]/30 p-4">
              <p className="text-sm font-semibold text-[#d5b46b]">{item}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="products" className="mx-auto max-w-7xl px-4 py-10">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#9c7a34]">
              Live marketplace
            </p>
            <h2 className="mt-2 text-3xl font-bold">Featured Products</h2>
          </div>

          <Link href="/products" className="font-semibold text-[#315c48]">
            View All
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-5 md:grid-cols-4 lg:grid-cols-5">
          {filteredProducts.map((product) => (
            <Link key={product.id} href={`/products/${product.id}`}>
              <div className="group relative cursor-pointer overflow-hidden bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                <div className="aspect-[4/5] overflow-hidden bg-[#e8dccb]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={product.images?.[0] || fallbackImage}
                    alt={product.name}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                </div>

                <button
                  onClick={(event) => handleWishlistClick(event, product)}
                  className="absolute right-3 top-3 bg-white px-3 py-2 text-xs font-bold text-[#9b4d48] shadow"
                >
                  {isInWishlist(getWishlistId(product.id)) ? "Saved" : "Save"}
                </button>

                <div className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9c7a34]">
                    {product.subcategory?.name || getCategoryName(product)}
                  </p>
                  <h3 className="mt-2 truncate text-base font-bold">
                    {product.name}
                  </h3>
                  <p className="mt-1 truncate text-sm text-stone-500">
                    {product.vendor?.storeName || "Marketplace vendor"}
                  </p>
                  <p className="mt-4 text-xl font-bold text-[#315c48]">
                    Rs. {product.price}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <p className="border border-[#d8c6aa] bg-white py-10 text-center text-stone-500">
            No products found in this selection.
          </p>
        )}
      </section>

      <footer className="border-t border-[#dfd1bd] bg-[#fffaf1]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-4">
          <div>
            <h3 className="text-xl font-bold text-[#17130f]">ZYLO BUYLO</h3>
            <p className="mt-3 text-stone-500">
              A premium marketplace for style, home, fittings, and parts.
            </p>
          </div>

          {["Company", "Support", "Legal"].map((section) => (
            <div key={section}>
              <h4 className="mb-3 font-bold">{section}</h4>
              <ul className="space-y-2 text-stone-500">
                <li>Marketplace</li>
                <li>Vendor Desk</li>
                <li>Help Center</li>
              </ul>
            </div>
          ))}
        </div>
      </footer>

      <MobileNavbar />
    </main>
  );
}
