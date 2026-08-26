"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/navbar/Navbar";
import {
  PACKAGE_SIZE_OPTIONS,
  calculateMarketplacePricing,
  formatRupees,
} from "@/lib/pricing";

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
  mrp?: number | null;
  vendorPrice?: number | null;
  sellingPrice?: number | null;
  discountPercent?: number | null;
  platformCommissionPercent?: number | null;
  platformCommissionAmount?: number | null;
  vendorPayout?: number | null;
  packagingCharge?: number | null;
  weightGrams?: number | null;
  packageSize?: string | null;
  fragile?: boolean | null;
  shippingCharge?: number | null;
  codCharge?: number | null;
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
  mrp: string;
  vendorPrice: string;
  discountPercent: string;
  platformCommissionPercent: string;
  packagingCharge: string;
  weightGrams: string;
  packageSize: string;
  fragile: boolean;
  shippingCharge: string;
  codCharge: string;
  inventory: string;
  categoryId: string;
  subcategoryId: string;
  imageUrls: string;
};

const fallbackImage = "/product-placeholder.svg";

function formFromProduct(product: Product): ProductForm {
  return {
    name: product.name,
    description: product.description,
    sku: product.sku || "",
    price: String(product.price),
    mrp: String(product.mrp || ""),
    vendorPrice: String(product.vendorPrice || product.price),
    discountPercent: String(product.discountPercent || ""),
    platformCommissionPercent: String(product.platformCommissionPercent || 10),
    packagingCharge: String(product.packagingCharge || ""),
    weightGrams: String(product.weightGrams || ""),
    packageSize: product.packageSize || "AUTO",
    fragile: Boolean(product.fragile),
    shippingCharge: String(product.shippingCharge || ""),
    codCharge: String(product.codCharge || 0),
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
  const pricingPreview = form
    ? calculateMarketplacePricing({
        price: form.price,
        mrp: form.mrp,
        vendorPrice: form.vendorPrice,
        discountPercent: form.discountPercent,
        platformCommissionPercent: form.platformCommissionPercent,
        packagingCharge: form.packagingCharge,
        weightGrams: form.weightGrams,
        packageSize: form.packageSize,
        fragile: form.fragile,
        shippingCharge: form.shippingCharge,
        codCharge: form.codCharge,
      })
    : null;

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
      fetch("/api/categories?fresh=1", { cache: "no-store" }),
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
    async function loadAdminPage() {
      await loadProducts();
      setLoading(false);
    }

    loadAdminPage();
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
    const nextValue =
      event.target instanceof HTMLInputElement && event.target.type === "checkbox"
        ? event.target.checked
        : value;

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
        [name]: nextValue,
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
        mrp: form.mrp,
        vendorPrice: form.vendorPrice,
        discountPercent: form.discountPercent,
        platformCommissionPercent: form.platformCommissionPercent,
        packagingCharge: form.packagingCharge,
        weightGrams: form.weightGrams,
        packageSize: form.packageSize,
        fragile: form.fragile,
        shippingCharge: form.shippingCharge,
        codCharge: form.codCharge,
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

    setProducts((current) => current.filter((item) => item.id !== product.id));
    setMessage("Product deleted.");
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
            <h1 className="mt-3 text-4xl font-bold">Products</h1>
            <p className="mt-2 max-w-2xl text-sm text-[#d8c8af]">
              Product images, vendor listings, categories, price, stock and status.
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

        {loading ? (
          <p className="bg-white py-12 text-center text-stone-500 shadow">
            Loading admin products...
          </p>
        ) : (
          <div className="overflow-hidden bg-white shadow">
            <div className="overflow-x-auto">
              <table className="min-w-[1050px] w-full border-collapse text-left text-sm">
                <thead className="bg-[#17130f] text-[#f8efe2]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Product Image</th>
                    <th className="px-4 py-3 font-semibold">Product Name</th>
                    <th className="px-4 py-3 font-semibold">Category</th>
                    <th className="px-4 py-3 font-semibold">Vendor</th>
                    <th className="px-4 py-3 font-semibold">Price</th>
                    <th className="px-4 py-3 font-semibold">Stock</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => (
                    <Fragment key={product.id}>
                      <tr className="border-b border-stone-100">
                        <td className="px-4 py-4 align-top">
                          <div className="h-16 w-16 overflow-hidden bg-stone-100">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={product.images?.[0] || fallbackImage}
                              alt={product.name}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <p className="font-bold text-stone-950">
                            {product.name}
                          </p>
                          <p className="mt-1 text-xs text-stone-500">
                            SKU: {product.sku || "Not set"}
                          </p>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <p>{product.category?.name || "No category"}</p>
                          <p className="mt-1 text-xs text-stone-500">
                            {product.subcategory?.name || "No subcategory"}
                          </p>
                        </td>
                        <td className="px-4 py-4 align-top">
                          {product.vendor?.storeName || "Marketplace"}
                        </td>
                        <td className="px-4 py-4 align-top">
                          <p className="font-bold text-[#315c48]">
                            {formatRupees(product.price)}
                          </p>
                          {product.mrp && product.mrp > product.price && (
                            <p className="text-xs text-stone-500">
                              <span className="line-through">
                                {formatRupees(product.mrp)}
                              </span>{" "}
                              {product.discountPercent || 0}% off
                            </p>
                          )}
                          <p className="mt-1 text-xs text-stone-500">
                            Payout {formatRupees(product.vendorPayout || product.vendorPrice || product.price)}
                          </p>
                          <p className="mt-1 text-xs text-stone-500">
                            Packaging {formatRupees(product.packagingCharge || 0)}
                          </p>
                          <p className="mt-1 text-xs text-stone-500">
                            Delivery {formatRupees(product.shippingCharge || 0)}
                          </p>
                        </td>
                        <td className="px-4 py-4 align-top">
                          {product.inventory}
                        </td>
                        <td className="px-4 py-4 align-top">
                          <span
                            className={`inline-block px-3 py-1 text-xs font-bold ${
                              product.inventory > 0
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {product.inventory > 0 ? "Active" : "Out of stock"}
                          </span>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => startEdit(product)}
                              className="border border-stone-300 px-3 py-2 text-xs font-semibold"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteProduct(product)}
                              className="border border-red-200 px-3 py-2 text-xs font-semibold text-red-600"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>

                      {editingId === product.id && form && (
                        <tr>
                          <td colSpan={8} className="bg-[#fffaf1] p-4">
                            <form
                              onSubmit={saveProduct}
                              className="grid gap-3 md:grid-cols-2"
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
                                name="vendorPrice"
                                value={form.vendorPrice}
                                onChange={updateForm}
                                placeholder="Vendor payout"
                                className="border border-stone-300 px-4 py-3 text-sm outline-none"
                                required
                              />
                              <input
                                type="number"
                                name="mrp"
                                value={form.mrp}
                                onChange={updateForm}
                                placeholder="MRP"
                                className="border border-stone-300 px-4 py-3 text-sm outline-none"
                              />
                              <input
                                type="number"
                                name="discountPercent"
                                value={form.discountPercent}
                                onChange={updateForm}
                                placeholder="Discount %"
                                className="border border-stone-300 px-4 py-3 text-sm outline-none"
                              />
                              <input
                                type="number"
                                name="platformCommissionPercent"
                                value={form.platformCommissionPercent}
                                onChange={updateForm}
                                placeholder="Commission %"
                                className="border border-stone-300 px-4 py-3 text-sm outline-none"
                              />
                              <input
                                type="number"
                                name="weightGrams"
                                value={form.weightGrams}
                                onChange={updateForm}
                                placeholder="Weight grams"
                                className="border border-stone-300 px-4 py-3 text-sm outline-none"
                              />
                              <select
                                name="packageSize"
                                value={form.packageSize}
                                onChange={updateForm}
                                className="border border-stone-300 px-4 py-3 text-sm outline-none"
                              >
                                {PACKAGE_SIZE_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                              <label className="flex items-center gap-2 border border-stone-300 bg-white px-4 py-3 text-sm font-semibold">
                                <input
                                  type="checkbox"
                                  name="fragile"
                                  checked={form.fragile}
                                  onChange={updateForm}
                                  className="h-4 w-4"
                                />
                                Fragile
                              </label>
                              <input
                                type="number"
                                name="packagingCharge"
                                value={form.packagingCharge}
                                onChange={updateForm}
                                placeholder="Packaging charge"
                                className="border border-stone-300 px-4 py-3 text-sm outline-none"
                              />
                              <input
                                type="number"
                                name="shippingCharge"
                                value={form.shippingCharge}
                                onChange={updateForm}
                                placeholder="Delivery charge auto"
                                className="border border-stone-300 px-4 py-3 text-sm outline-none"
                              />
                              <input
                                type="number"
                                name="codCharge"
                                value={form.codCharge}
                                onChange={updateForm}
                                placeholder="COD charge"
                                className="border border-stone-300 px-4 py-3 text-sm outline-none"
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

                              {pricingPreview && (
                                <div className="grid gap-3 border border-[#dfd1bd] bg-white p-4 text-sm md:col-span-2 md:grid-cols-6">
                                  <div>
                                    <p className="text-xs uppercase text-stone-500">Customer price</p>
                                    <p className="mt-1 font-bold text-[#315c48]">
                                      {formatRupees(pricingPreview.finalCustomerPrice)}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs uppercase text-stone-500">Vendor payout</p>
                                    <p className="mt-1 font-bold">
                                      {formatRupees(pricingPreview.vendorPayout)}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs uppercase text-stone-500">Platform fee</p>
                                    <p className="mt-1 font-bold">
                                      {formatRupees(pricingPreview.platformCommissionAmount)}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs uppercase text-stone-500">Packaging</p>
                                    <p className="mt-1 font-bold">
                                      {formatRupees(pricingPreview.packagingCharge)}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs uppercase text-stone-500">Delivery</p>
                                    <p className="mt-1 font-bold">
                                      {formatRupees(pricingPreview.shippingCharge)}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs uppercase text-stone-500">Discount</p>
                                    <p className="mt-1 font-bold text-green-700">
                                      {pricingPreview.discountPercent}% off
                                    </p>
                                  </div>
                                </div>
                              )}

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
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredProducts.length === 0 && (
              <p className="py-12 text-center text-stone-500">
                No products match this search.
              </p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
