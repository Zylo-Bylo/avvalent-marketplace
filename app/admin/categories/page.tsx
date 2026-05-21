"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/navbar/Navbar";

type Subcategory = {
  id: string;
  name: string;
  slug: string;
  categoryId: string;
};

type Category = {
  id: string;
  name: string;
  slug: string;
  subcategories: Subcategory[];
};

const starterPlan = [
  {
    name: "Women Ethnic",
    subcategories: ["Sarees", "Kurtis", "Lehengas", "Dress Materials"],
  },
  {
    name: "Men Fashion",
    subcategories: ["Shirts", "T-Shirts", "Jeans", "Footwear"],
  },
  {
    name: "Beauty & Personal Care",
    subcategories: ["Makeup", "Skin Care", "Hair Care", "Fragrance"],
  },
  {
    name: "Home & Kitchen",
    subcategories: ["Decor", "Cookware", "Storage", "Furniture"],
  },
  {
    name: "Hardware",
    subcategories: ["Hand Tools", "Fasteners", "Door Hardware", "Safety Gear"],
  },
  {
    name: "AC Parts",
    subcategories: ["Compressors", "Cooling Coils", "Capacitors", "Remote Controls"],
  },
  {
    name: "Washing Machine Parts",
    subcategories: ["Motors", "Belts", "Drain Pumps", "Inlet Valves"],
  },
  {
    name: "Home Bathroom Fitting",
    subcategories: ["Faucets", "Showers", "Health Faucets", "Drainage Fittings"],
  },
  {
    name: "Electric Fitting",
    subcategories: ["Switches", "Sockets", "Wires", "MCB & Distribution"],
  },
];

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryName, setCategoryName] = useState("");
  const [subcategoryName, setSubcategoryName] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const totalSubcategories = useMemo(
    () =>
      categories.reduce(
        (total, category) => total + category.subcategories.length,
        0
      ),
    [categories]
  );

  async function loadCategories() {
    setLoading(true);
    try {
      const response = await fetch("/api/categories", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Could not load categories.");
        return;
      }

      setCategories(data.categories || []);
    } catch {
      setMessage("Could not connect to the category service.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCategories();
  }, []);

  async function createCategory(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    setSaving(true);

    const response = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: categoryName }),
    });

    const data = await response.json();
    setSaving(false);

    if (!response.ok) {
      setMessage(data.error || "Could not add category.");
      return;
    }

    setCategoryName("");
    setMessage("Category added.");
    loadCategories();
  }

  async function createSubcategory(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    setSaving(true);

    const response = await fetch("/api/subcategories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: subcategoryName,
        categoryId: selectedCategoryId,
      }),
    });

    const data = await response.json();
    setSaving(false);

    if (!response.ok) {
      setMessage(data.error || "Could not add subcategory.");
      return;
    }

    setSubcategoryName("");
    setMessage("Subcategory added.");
    loadCategories();
  }

  async function deleteCategory(categoryId: string) {
    if (!confirm("Remove this category and its subcategories? Products will be uncategorized.")) {
      return;
    }

    await fetch(`/api/categories/${categoryId}`, { method: "DELETE" });
    loadCategories();
  }

  async function deleteSubcategory(subcategoryId: string) {
    if (!confirm("Remove this subcategory? Products will keep their main category.")) {
      return;
    }

    await fetch(`/api/subcategories/${subcategoryId}`, { method: "DELETE" });
    loadCategories();
  }

  return (
    <main className="min-h-screen bg-[#f7f2ea] text-stone-950">
      <Navbar />

      <section className="border-b border-stone-200 bg-[#17130f] text-[#f8efe2]">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 md:flex-row md:items-end md:justify-between">
          <div>
            <Link href="/admin/dashboard" className="text-sm text-[#d6b36a]">
              Back to Admin Dashboard
            </Link>
            <h1 className="mt-3 text-4xl font-bold">Category Atelier</h1>
            <p className="mt-2 max-w-2xl text-sm text-[#d8c8af]">
              Build a Meesho-style catalogue tree with fashion, home, hardware,
              AC parts, washing machine parts, bathroom fittings, and electric
              fittings.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="border border-[#d6b36a]/40 px-5 py-4">
              <p className="text-3xl font-bold text-[#d6b36a]">
                {categories.length}
              </p>
              <p className="text-xs uppercase tracking-[0.2em]">Categories</p>
            </div>
            <div className="border border-[#d6b36a]/40 px-5 py-4">
              <p className="text-3xl font-bold text-[#d6b36a]">
                {totalSubcategories}
              </p>
              <p className="text-xs uppercase tracking-[0.2em]">Subcategories</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 lg:grid-cols-[380px_1fr]">
        <aside className="space-y-5">
          <form onSubmit={createCategory} className="bg-white p-5 shadow">
            <h2 className="text-xl font-bold">Add Category</h2>
            <input
              value={categoryName}
              onChange={(event) => setCategoryName(event.target.value)}
              placeholder="Example: Hardware"
              className="mt-4 w-full border border-stone-300 px-4 py-3 outline-none focus:border-[#9c7a34]"
              required
            />
            <button
              disabled={saving}
              className="mt-4 w-full bg-[#17130f] px-4 py-3 font-semibold text-white disabled:opacity-60"
            >
              Add Category
            </button>
          </form>

          <form onSubmit={createSubcategory} className="bg-white p-5 shadow">
            <h2 className="text-xl font-bold">Add Subcategory</h2>
            <select
              value={selectedCategoryId}
              onChange={(event) => setSelectedCategoryId(event.target.value)}
              className="mt-4 w-full border border-stone-300 px-4 py-3 outline-none focus:border-[#9c7a34]"
              required
            >
              <option value="">Select Category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <input
              value={subcategoryName}
              onChange={(event) => setSubcategoryName(event.target.value)}
              placeholder="Example: Compressors"
              className="mt-4 w-full border border-stone-300 px-4 py-3 outline-none focus:border-[#9c7a34]"
              required
            />
            <button
              disabled={saving}
              className="mt-4 w-full bg-[#9c7a34] px-4 py-3 font-semibold text-white disabled:opacity-60"
            >
              Add Subcategory
            </button>
          </form>

          {message && (
            <p className="bg-white px-4 py-3 text-sm text-stone-700 shadow">
              {message}
            </p>
          )}
        </aside>

        <div className="space-y-6">
          <section className="bg-white p-5 shadow">
            <h2 className="text-xl font-bold">Suggested Category Plan</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {starterPlan.map((item) => (
                <div key={item.name} className="border border-stone-200 p-4">
                  <p className="font-semibold">{item.name}</p>
                  <p className="mt-2 text-sm text-stone-500">
                    {item.subcategories.join(" / ")}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white p-5 shadow">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold">Live Category Tree</h2>
              <button
                onClick={loadCategories}
                className="border border-stone-300 px-4 py-2 text-sm font-semibold"
              >
                Refresh
              </button>
            </div>

            {loading ? (
              <p className="py-10 text-center text-stone-500">Loading...</p>
            ) : (
              <div className="mt-4 space-y-4">
                {categories.map((category) => (
                  <div key={category.id} className="border border-stone-200">
                    <div className="flex items-center justify-between gap-4 border-b border-stone-200 bg-stone-50 px-4 py-3">
                      <div>
                        <p className="font-semibold">{category.name}</p>
                        <p className="text-xs text-stone-500">{category.slug}</p>
                      </div>
                      <button
                        onClick={() => deleteCategory(category.id)}
                        className="border border-red-200 px-3 py-2 text-sm font-semibold text-red-600"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="grid gap-2 p-4 md:grid-cols-2 xl:grid-cols-3">
                      {category.subcategories.length === 0 ? (
                        <p className="text-sm text-stone-500">
                          No subcategories yet.
                        </p>
                      ) : (
                        category.subcategories.map((subcategory) => (
                          <div
                            key={subcategory.id}
                            className="flex items-center justify-between gap-3 bg-[#f7f2ea] px-3 py-2 text-sm"
                          >
                            <span>{subcategory.name}</span>
                            <button
                              onClick={() => deleteSubcategory(subcategory.id)}
                              className="text-xs font-semibold text-red-600"
                            >
                              Remove
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
