"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/navbar/Navbar";

type Category = {
  id: string;
  name: string;
  subcategories?: Subcategory[];
};

type Subcategory = {
  id: string;
  name: string;
  categoryId: string;
};

export default function ProductUploadPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    title: "",
    description: "",
    sku: "",
    price: "",
    comparePrice: "",
    stock: "",
    imageUrls: "",
    categoryId: "",
    subcategoryId: "",
  });

  const selectedCategory = categories.find(
    (category) => category.id === form.categoryId
  );
  const subcategoryOptions = selectedCategory?.subcategories || [];

  useEffect(() => {
    let isActive = true;

    async function loadCategories() {
      const response = await fetch("/api/categories", { cache: "no-store" });

      if (!isActive) {
        return;
      }

      if (!response.ok) {
        setError("Could not load categories.");
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

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) {
    const { name, value } = e.target;

    if (name === "categoryId") {
      setForm((currentForm) => ({
        ...currentForm,
        categoryId: value,
        subcategoryId: "",
      }));
      return;
    }

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (
      !form.title ||
      !form.price ||
      !form.categoryId
    ) {
      setError("Please fill title, price and category.");
      return;
    }

    setLoading(true);

    const response = await fetch("/api/products/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.title,
        description: form.description || "No description provided.",
        sku: form.sku,
        price: Number(form.price),
        inventory: form.stock ? Number(form.stock) : 0,
        categoryId: form.categoryId,
        subcategoryId: form.subcategoryId,
        images: form.imageUrls
          .split(/\r?\n|,/)
          .map((item) => item.trim())
          .filter(Boolean),
      }),
    });

    const data = await response.json();

    setLoading(false);

    if (!response.ok) {
      if (response.status === 401) {
        router.push("/login?role=vendor&next=/vendor/dashboard/upload");
        return;
      }

      if (response.status === 403) {
        router.push("/vendor/register");
        return;
      }

      setError(data.error || "Product save failed.");
      return;
    }

    router.push("/vendor/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />

      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="rounded-2xl bg-white p-6 shadow">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">Add Vendor Product</h1>
              <p className="mt-1 text-sm text-gray-500">
                Add an item to your vendor catalogue.
              </p>
            </div>

            <Link href="/vendor/dashboard" className="text-pink-600">
              Back
            </Link>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              name="title"
              placeholder="Product Title"
              value={form.title}
              onChange={handleChange}
              className="w-full rounded-xl border p-3"
              required
            />

            <textarea
              name="description"
              placeholder="Product Description"
              value={form.description}
              onChange={handleChange}
              className="h-32 w-full rounded-xl border p-3"
            />

            <input
              type="text"
              name="sku"
              placeholder="SKU Number (optional)"
              value={form.sku}
              onChange={handleChange}
              className="w-full rounded-xl border p-3"
            />

            <div className="grid gap-4 md:grid-cols-3">
              <input
                type="number"
                name="price"
                placeholder="Price"
                value={form.price}
                onChange={handleChange}
                className="w-full rounded-xl border p-3"
                required
              />

              <input
                type="number"
                name="comparePrice"
                placeholder="Compare Price"
                value={form.comparePrice}
                onChange={handleChange}
                className="w-full rounded-xl border p-3"
              />

              <input
                type="number"
                name="stock"
                placeholder="Stock Quantity"
                value={form.stock}
                onChange={handleChange}
                className="w-full rounded-xl border p-3"
              />
            </div>

            <select
              name="categoryId"
              value={form.categoryId}
              onChange={handleChange}
              className="w-full rounded-xl border p-3"
              required
            >
              <option value="">Select Category</option>

              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>

            <select
              name="subcategoryId"
              value={form.subcategoryId}
              onChange={handleChange}
              className="w-full rounded-xl border p-3"
              disabled={!form.categoryId}
            >
              <option value="">
                {form.categoryId ? "Select Subcategory" : "Select Category First"}
              </option>

              {subcategoryOptions.map((subcategory) => (
                <option key={subcategory.id} value={subcategory.id}>
                  {subcategory.name}
                </option>
              ))}
            </select>

            <textarea
              name="imageUrls"
              placeholder="Image URLs, one per line or separated by commas"
              value={form.imageUrls}
              onChange={handleChange}
              className="h-24 w-full rounded-xl border p-3"
            />

            {form.imageUrls.trim() && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={
                  form.imageUrls
                    .split(/\r?\n|,/)
                    .map((item) => item.trim())
                    .filter(Boolean)[0]
                }
                alt="Product preview"
                className="h-64 w-full rounded-xl border object-cover"
              />
            )}

            {error && (
              <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-black p-3 font-semibold text-white disabled:opacity-60"
            >
              {loading ? "Saving..." : "Submit Product"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
