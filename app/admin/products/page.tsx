"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/navbar/Navbar";

type User = {
  id: string;
  role: "CUSTOMER" | "VENDOR" | "ADMIN";
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

type Product = {
  id: string;
  name: string;
  description: string;
  sku?: string | null;
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
    id: string;
    storeName: string;
  } | null;
};

type ProductForm = {
  name: string;
  description: string;
  sku: string;
  price: string;
  inventory: string;
  categoryId: string;
  subcategoryId: string;
  imageUrls: string;
};

const fallbackImage = "https://placehold.co/300x300/png?text=Product";

function formFromProduct(product: Product): ProductForm {
  return {
    name: product.name,
    description: product.description,
    sku: product.sku || "",
    price: String(product.price),
    inventory: String(product.inventory),
    categoryId: product.categoryId || product.category?.id || "",
    subcategoryId: product.subcategoryId || product.subcategory?.id || "",
    imageUrls: (product.images || []).join("\n"),
  };
}

function imageList(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function AdminProductsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState<ProductForm | null>(null);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const selectedFormCategory = categories.find(
    (category) => category.id === form?.categoryId
  );
  const formSubcategories = selectedFormCategory?.subcategories || [];

  const filteredProducts = useMemo(
    () =>
      products.filter((product) => {
        const text = `${product.name} ${product.sku || ""} ${
          product.vendor?.storeName || ""
        }`.toLowerCase();
        const matchesSearch = text.includes(search.toLowerCase());
        const matchesCategory = !categoryId || product.categoryId === categoryId;

        return matchesSearch && matchesCategory;
      }),
    [categoryId, products, search]
  );

  async function loadProducts() {
    setMessage("");

    const [productsResponse, categoriesResponse] = await Promise.all([
      fetch("/api/products?limit=200&includeOutOfStock=true", {
        cache: "no-store",
      }),
      fetch("/api/categories", { cache: "no-store" }),
    ]);

    const productsData = await productsResponse.json();
    const categoriesData = await categoriesResponse.json();

    if (productsResponse.ok) {
      setProducts(productsData.products || []);
    } else {
      setMessage(productsData.error || "Could not load products.");
    }

    if (categoriesResponse.ok) {
      setCategories(categoriesData.categories || []);
    }
  }

  useEffect(() => {
    let isActive = true;

    async function loadAdminPage() {
      const userResponse = await fetch("/api/auth/me", { cache: "no-store" });
      const userData = await userResponse.json();

      if (!isActive) {
        return;
      }

      setUser(userData.user);

      if (userData.user?.role === "ADMIN") {
        await loadProducts();
      }

      if (isActive) {
        setLoading(false);
      }
    }

    loadAdminPage();

    return () => {
      isActive = false;
    };
  }, []);

  function startEdit(product: Product) {
    setEditingId(product.id);
    setForm(formFromProduct(product));
    setMessage("");
  }

  function cancelEdit() {
    setEditingId("");
    setForm(null);
  }

  function updateForm(
    event: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) {
    const { name, value } = event.target;

    setForm((current) => {
      if (!current) {
        return current;
      }

      if (name === "categoryId") {
        return {
          ...current,
          categoryId: value,
          subcategoryId: "",
        };
      }

      return {
        ...current,
        [name]: value,
      };
    });
  }

  async function saveProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form || !editingId) {
      return;
    }

    setSaving(true);
    setMessage("");

    const response = await fetch(`/api/products/${editingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        description: form.description,
        sku: form.sku,
        price: form.price,
        inventory: form.inventory,
        categoryId: form.categoryId,
        subcategoryId: form.subcategoryId,
        images: imageList(form.imageUrls),
      }),
    });
    const data = await response.json();

    setSaving(false);

    if (!response.ok) {
      setMessage(data.error || "Could not update product.");
      return;
    }

    setProducts((current) =>
      current.map((product) => (product.id === data.id ? data : product))
    );
    setMessage("Product updated.");
    cancelEdit();
  }

  async function deleteProduct(product: Product) {
    if (!confirm(`Delete ${product.name}? This cannot be undone.`)) {
      return;
    }

    setMessage("");
    const response = await fetch(`/api/products/${product.id}`, {
      method: "DELETE",
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error || "Could not delete product.");
      return;
    }

    setProducts((current) =>
      current.filter((item) => item.id !== product.id)
    );
    setMessage("Product deleted.");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f2ea]">
        <Navbar />
        <p className="py-20 text-center text-stone-500">
          Loading admin products...
        </p>
      </main>
    );
  }

  if (user?.role !== "ADMIN") {
    return (
      <main className="min-h-screen bg-[#f7f2ea]">
        <Navbar />
        <section className="mx-auto max-w-xl px-4 py-16 text-center">
          <div className="bg-white p-8 shadow">
            <h1 className="text-2xl font-bold">Admin Access Needed</h1>
            <p className="mt-3 text-stone-600">
              Login as an admin to manage marketplace products.
            </p>
            <Link
              href="/login"
              className="mt-5 inline-block bg-[#6b145d] px-5 py-3 font-semibold text-white"
            >
              Login
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f2ea] text-stone-950">
      <Navbar />

      <section className="border-b border-stone-200 bg-[#17130f] text-[#f8efe2]">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-8 md:flex-row md:items-end md:justify-between">
          <div>
            <Link href="/admin/dashboard" className="text-sm text-[#d6b36a]">
              Back to Admin Dashboard
            </Link>
            <h1 className="mt-3 text-4xl font-bold">Product Management</h1>
            <p className="mt-2 max-w-2xl text-sm text-[#d8c8af]">
              Review vendor products, fix categories, update stock and remove
              bad listings.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="border border-[#d6b36a]/40 px-5 py-4">
              <p className="text-3xl font-bold text-[#d6b36a]">
                {products.length}
              </p>
              <p className="text-xs uppercase tracking-[0.2em]">Products</p>
            </div>
            <div className="border border-[#d6b36a]/40 px-5 py-4">
              <p className="text-3xl font-bold text-[#d6b36a]">
                {products.filter((product) => product.inventory === 0).length}
              </p>
              <p className="text-xs uppercase tracking-[0.2em]">Out of Stock</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-5 grid gap-3 bg-white p-4 shadow md:grid-cols-[1fr_260px_auto]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search product, SKU or vendor..."
            className="border border-stone-300 px-4 py-3 text-sm outline-none focus:border-[#6b145d]"
          />
          <select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            className="border border-stone-300 px-4 py-3 text-sm outline-none focus:border-[#6b145d]"
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <button
            onClick={loadProducts}
            className="bg-[#17130f] px-5 py-3 text-sm font-semibold text-white"
          >
            Refresh
          </button>
        </div>

        {message && (
          <p className="mb-5 border border-[#dfd1bd] bg-white p-3 text-sm text-stone-700">
            {message}
          </p>
        )}

        <div className="space-y-4">
          {filteredProducts.map((product) => (
            <article key={product.id} className="bg-white shadow">
              <div className="grid gap-4 p-4 lg:grid-cols-[90px_1fr_180px_170px] lg:items-center">
                <div className="h-24 w-24 overflow-hidden bg-stone-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={product.images?.[0] || fallbackImage}
                    alt={product.name}
                    className="h-full w-full object-cover"
                  />
                </div>

                <div>
                  <h2 className="text-lg font-bold">{product.name}</h2>
                  <p className="mt-1 line-clamp-2 text-sm text-stone-500">
                    {product.description}
                  </p>
                  <p className="mt-2 text-xs text-stone-500">
                    {product.category?.name || "No category"} /{" "}
                    {product.subcategory?.name || "No subcategory"} /{" "}
                    {product.vendor?.storeName || "Vendor"}
                  </p>
                </div>

                <div>
                  <p className="text-xl font-bold text-[#315c48]">
                    Rs. {product.price}
                  </p>
                  <p className="text-sm text-stone-500">
                    Stock: {product.inventory}
                  </p>
                  <p className="text-xs text-stone-500">
                    SKU: {product.sku || "Not set"}
                  </p>
                </div>

                <div className="flex gap-2 lg:justify-end">
                  <button
                    onClick={() => startEdit(product)}
                    className="border border-stone-300 px-4 py-2 text-sm font-semibold"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteProduct(product)}
                    className="border border-red-200 px-4 py-2 text-sm font-semibold text-red-600"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {editingId === product.id && form && (
                <form
                  onSubmit={saveProduct}
                  className="grid gap-3 border-t border-stone-200 bg-[#fffaf1] p-4 md:grid-cols-2"
                >
                  <input
                    name="name"
                    value={form.name}
                    onChange={updateForm}
                    placeholder="Product name"
                    className="border border-stone-300 px-4 py-3 text-sm outline-none"
                    required
                  />
                  <input
                    name="sku"
                    value={form.sku}
                    onChange={updateForm}
                    placeholder="SKU"
                    className="border border-stone-300 px-4 py-3 text-sm outline-none"
                  />
                  <input
                    type="number"
                    name="price"
                    value={form.price}
                    onChange={updateForm}
                    placeholder="Price"
                    className="border border-stone-300 px-4 py-3 text-sm outline-none"
                    required
                  />
                  <input
                    type="number"
                    name="inventory"
                    value={form.inventory}
                    onChange={updateForm}
                    placeholder="Inventory"
                    className="border border-stone-300 px-4 py-3 text-sm outline-none"
                    required
                  />
                  <select
                    name="categoryId"
                    value={form.categoryId}
                    onChange={updateForm}
                    className="border border-stone-300 px-4 py-3 text-sm outline-none"
                  >
                    <option value="">No category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  <select
                    name="subcategoryId"
                    value={form.subcategoryId}
                    onChange={updateForm}
                    disabled={!form.categoryId}
                    className="border border-stone-300 px-4 py-3 text-sm outline-none disabled:bg-stone-100"
                  >
                    <option value="">No subcategory</option>
                    {formSubcategories.map((subcategory) => (
                      <option key={subcategory.id} value={subcategory.id}>
                        {subcategory.name}
                      </option>
                    ))}
                  </select>
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={updateForm}
                    placeholder="Description"
                    className="min-h-28 border border-stone-300 px-4 py-3 text-sm outline-none md:col-span-2"
                  />
                  <textarea
                    name="imageUrls"
                    value={form.imageUrls}
                    onChange={updateForm}
                    placeholder="Image URLs, one per line"
                    className="min-h-24 border border-stone-300 px-4 py-3 text-sm outline-none md:col-span-2"
                  />

                  <div className="flex gap-2 md:col-span-2">
                    <button
                      disabled={saving}
                      className="bg-[#6b145d] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {saving ? "Saving..." : "Save Product"}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="border border-stone-300 px-5 py-3 text-sm font-semibold"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </article>
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <p className="bg-white py-12 text-center text-stone-500">
            No products match this search.
          </p>
        )}
      </section>
    </main>
  );
}
