"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import FileUploadField from "@/components/forms/FileUploadField";
import Navbar from "@/components/navbar/Navbar";
import { applianceCategoryTree } from "@/data/category-tree";
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

type Vendor = {
  id: string;
  storeName: string;
  status: string;
  user?: {
    name: string;
    email: string;
  };
};

const initialForm = {
  vendorId: "",
  name: "",
  brand: "",
  modelNumber: "",
  partNumber: "",
  productType: "",
  condition: "NEW",
  warranty: "",
  description: "",
  sku: "",
  categoryId: "",
  subcategoryId: "",
  treeMain: "",
  treeGroup: "",
  treePart: "",
  color: "",
  size: "",
  material: "",
  fitment: "",
  returnPolicy: "7 days replacement for eligible items",
  searchKeywords: "",
  vendorPrice: "",
  mrp: "",
  discountPercent: "",
  platformCommissionPercent: "10",
  stock: "",
  weightGrams: "",
  packageSize: "AUTO",
  fragile: false,
  shippingCharge: "",
  codCharge: "0",
  imageUrls: "",
};

export default function AddProductPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const approvedVendors = vendors.filter((vendor) => vendor.status === "APPROVED");
  const selectedCategory = categories.find(
    (category) => category.id === form.categoryId,
  );
  const subcategoryOptions = selectedCategory?.subcategories || [];
  const selectedTreeMain = applianceCategoryTree.find(
    (category) => category.slug === form.treeMain,
  );
  const selectedTreeGroup = selectedTreeMain?.groups.find(
    (group) => group.slug === form.treeGroup,
  );
  const pricingPreview = calculateMarketplacePricing({
    mrp: form.mrp,
    vendorPrice: form.vendorPrice,
    discountPercent: form.discountPercent,
    platformCommissionPercent: form.platformCommissionPercent,
    weightGrams: form.weightGrams,
    packageSize: form.packageSize,
    fragile: form.fragile,
    shippingCharge: form.shippingCharge,
    codCharge: form.codCharge,
  });
  const imageList = useMemo(
    () =>
      form.imageUrls
        .split(/\r?\n|,/)
        .map((item) => item.trim())
        .filter(Boolean),
    [form.imageUrls],
  );

  useEffect(() => {
    let isActive = true;

    async function loadData() {
      setLoading(true);
      setError("");

      try {
        const [categoriesResponse, vendorsResponse] = await Promise.all([
          fetch("/api/categories", { cache: "no-store" }),
          fetch("/api/admin/vendors", { cache: "no-store" }),
        ]);
        const categoriesData = await categoriesResponse.json();
        const vendorsData = await vendorsResponse.json();

        if (!isActive) {
          return;
        }

        if (categoriesResponse.ok) {
          setCategories(categoriesData.categories || []);
        } else {
          setError(categoriesData.error || "Could not load categories.");
        }

        if (vendorsResponse.ok) {
          setVendors(vendorsData.vendors || []);
        } else {
          setError(vendorsData.error || "Could not load vendors.");
        }
      } catch {
        if (isActive) {
          setError("Product form data could not be loaded.");
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isActive = false;
    };
  }, []);

  function updateField(
    event: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) {
    const { name, value } = event.target;
    const nextValue =
      event.target instanceof HTMLInputElement && event.target.type === "checkbox"
        ? event.target.checked
        : value;

    setForm((current) => {
      if (name === "categoryId") {
        return {
          ...current,
          categoryId: value,
          subcategoryId: "",
        };
      }

      if (name === "treeMain") {
        return {
          ...current,
          treeMain: value,
          treeGroup: "",
          treePart: "",
        };
      }

      if (name === "treeGroup") {
        return {
          ...current,
          treeGroup: value,
          treePart: "",
        };
      }

      return {
        ...current,
        [name]: nextValue,
      };
    });
  }

  function appendUploadedImage(url: string) {
    setForm((current) => ({
      ...current,
      imageUrls: current.imageUrls ? `${current.imageUrls.trim()}\n${url}` : url,
    }));
  }

  function buildDescription() {
    const treeLabels = [
      selectedTreeMain?.name,
      selectedTreeGroup?.name,
      selectedTreeGroup?.parts.find((part) => part.slug === form.treePart)?.name,
    ]
      .filter(Boolean)
      .join(" / ");

    return [form.description.trim(), treeLabels ? `Category tree: ${treeLabels}` : ""]
      .filter(Boolean)
      .join("\n\n");
  }

  async function submitProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!form.vendorId) {
      setError("Please select an approved vendor.");
      return;
    }

    if (!form.name || !form.description || !form.vendorPrice || !form.categoryId) {
      setError("Product name, description, vendor price and category are required.");
      return;
    }

    if (subcategoryOptions.length > 0 && !form.subcategoryId) {
      setError("Please select a subcategory for this category.");
      return;
    }

    if (imageList.length === 0) {
      setError("Please add at least one product image.");
      return;
    }

    setSaving(true);

    const response = await fetch("/api/products/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vendorId: form.vendorId,
        name: form.name,
        description: buildDescription(),
        brand: form.brand,
        modelNumber: form.modelNumber,
        partNumber: form.partNumber,
        productType: form.productType,
        condition: form.condition,
        warranty: form.warranty,
        color: form.color,
        size: form.size,
        material: form.material,
        fitment: form.fitment,
        returnPolicy: form.returnPolicy,
        searchKeywords: form.searchKeywords,
        sku: form.sku,
        mrp: Number(form.mrp || pricingPreview.mrp),
        vendorPrice: Number(form.vendorPrice),
        discountPercent: form.discountPercent
          ? Number(form.discountPercent)
          : undefined,
        platformCommissionPercent: Number(
          form.platformCommissionPercent || 10,
        ),
        weightGrams: form.weightGrams ? Number(form.weightGrams) : undefined,
        packageSize: form.packageSize,
        fragile: form.fragile,
        packagingCharge: pricingPreview.packagingCharge,
        shippingCharge: form.shippingCharge
          ? Number(form.shippingCharge)
          : undefined,
        codCharge: Number(form.codCharge || 0),
        inventory: Number(form.stock || 0),
        categoryId: form.categoryId,
        subcategoryId: form.subcategoryId,
        images: imageList,
      }),
    });
    const data = await response.json();

    setSaving(false);

    if (!response.ok) {
      setError(data.error || "Product could not be saved.");
      return;
    }

    setMessage("Product added successfully.");
    setForm(initialForm);
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <Navbar />

      <section className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 md:flex-row md:items-end md:justify-between">
          <div>
            <Link href="/admin/products" className="text-sm font-semibold text-pink-600">
              Back to product management
            </Link>
            <h1 className="mt-2 text-3xl font-black">Add Marketplace Product</h1>
            <p className="mt-2 text-sm text-slate-600">
              Add all required details for category matching, pricing, packaging,
              shipping and vendor payout.
            </p>
          </div>
          <Link
            href="/admin/categories"
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold"
          >
            Manage Categories
          </Link>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {loading ? (
          <div className="rounded-2xl bg-white p-8 text-center text-slate-600 shadow">
            Loading product form...
          </div>
        ) : (
          <form onSubmit={submitProduct} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-6">
              <section className="rounded-2xl bg-white p-5 shadow">
                <h2 className="text-xl font-bold">1. Vendor and category</h2>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <select
                    name="vendorId"
                    value={form.vendorId}
                    onChange={updateField}
                    className="rounded-xl border p-3"
                    required
                  >
                    <option value="">Select approved vendor</option>
                    {approvedVendors.map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.storeName} - {vendor.user?.email}
                      </option>
                    ))}
                  </select>
                  <input
                    name="sku"
                    value={form.sku}
                    onChange={updateField}
                    placeholder="SKU / barcode / product code"
                    className="rounded-xl border p-3"
                  />
                  <select
                    name="categoryId"
                    value={form.categoryId}
                    onChange={updateField}
                    className="rounded-xl border p-3"
                    required
                  >
                    <option value="">Select store category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  <select
                    name="subcategoryId"
                    value={form.subcategoryId}
                    onChange={updateField}
                    disabled={!form.categoryId || subcategoryOptions.length === 0}
                    className="rounded-xl border p-3 disabled:bg-slate-100"
                  >
                    <option value="">
                      {!form.categoryId
                        ? "Select category first"
                        : subcategoryOptions.length
                          ? "Select subcategory"
                          : "No subcategory available"}
                    </option>
                    {subcategoryOptions.map((subcategory) => (
                      <option key={subcategory.id} value={subcategory.id}>
                        {subcategory.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <select
                    name="treeMain"
                    value={form.treeMain}
                    onChange={updateField}
                    className="rounded-xl border p-3"
                  >
                    <option value="">Optional catalogue tree</option>
                    {applianceCategoryTree.map((category) => (
                      <option key={category.slug} value={category.slug}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  <select
                    name="treeGroup"
                    value={form.treeGroup}
                    onChange={updateField}
                    disabled={!selectedTreeMain}
                    className="rounded-xl border p-3 disabled:bg-slate-100"
                  >
                    <option value="">Tree group</option>
                    {selectedTreeMain?.groups.map((group) => (
                      <option key={group.slug} value={group.slug}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                  <select
                    name="treePart"
                    value={form.treePart}
                    onChange={updateField}
                    disabled={!selectedTreeGroup}
                    className="rounded-xl border p-3 disabled:bg-slate-100"
                  >
                    <option value="">Tree item / part</option>
                    {selectedTreeGroup?.parts.map((part) => (
                      <option key={part.slug} value={part.slug}>
                        {part.name}
                      </option>
                    ))}
                  </select>
                </div>
              </section>

              <section className="rounded-2xl bg-white p-5 shadow">
                <h2 className="text-xl font-bold">2. Product identity</h2>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <input
                    name="name"
                    value={form.name}
                    onChange={updateField}
                    placeholder="Product title"
                    className="rounded-xl border p-3 md:col-span-2"
                    required
                  />
                  <input
                    name="brand"
                    value={form.brand}
                    onChange={updateField}
                    placeholder="Brand"
                    className="rounded-xl border p-3"
                  />
                  <input
                    name="modelNumber"
                    value={form.modelNumber}
                    onChange={updateField}
                    placeholder="Model number"
                    className="rounded-xl border p-3"
                  />
                  <input
                    name="partNumber"
                    value={form.partNumber}
                    onChange={updateField}
                    placeholder="Part number / MPN"
                    className="rounded-xl border p-3"
                  />
                  <input
                    name="productType"
                    value={form.productType}
                    onChange={updateField}
                    placeholder="Product type, e.g. spare part, fashion, grocery"
                    className="rounded-xl border p-3"
                  />
                  <select
                    name="condition"
                    value={form.condition}
                    onChange={updateField}
                    className="rounded-xl border p-3"
                  >
                    <option value="NEW">New</option>
                    <option value="REFURBISHED">Refurbished</option>
                    <option value="OPEN_BOX">Open box</option>
                  </select>
                  <input
                    name="warranty"
                    value={form.warranty}
                    onChange={updateField}
                    placeholder="Warranty, e.g. 6 months seller warranty"
                    className="rounded-xl border p-3"
                  />
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={updateField}
                    placeholder="Full product description, use, included items, care instructions"
                    className="min-h-32 rounded-xl border p-3 md:col-span-2"
                    required
                  />
                </div>
              </section>

              <section className="rounded-2xl bg-white p-5 shadow">
                <h2 className="text-xl font-bold">3. Category-specific details</h2>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <input
                    name="color"
                    value={form.color}
                    onChange={updateField}
                    placeholder="Color / shade"
                    className="rounded-xl border p-3"
                  />
                  <input
                    name="size"
                    value={form.size}
                    onChange={updateField}
                    placeholder="Size / capacity / dimensions"
                    className="rounded-xl border p-3"
                  />
                  <input
                    name="material"
                    value={form.material}
                    onChange={updateField}
                    placeholder="Material / fabric / build"
                    className="rounded-xl border p-3"
                  />
                  <input
                    name="fitment"
                    value={form.fitment}
                    onChange={updateField}
                    placeholder="Compatibility / appliance fitment / vehicle model"
                    className="rounded-xl border p-3"
                  />
                  <input
                    name="returnPolicy"
                    value={form.returnPolicy}
                    onChange={updateField}
                    placeholder="Return policy"
                    className="rounded-xl border p-3"
                  />
                  <input
                    name="searchKeywords"
                    value={form.searchKeywords}
                    onChange={updateField}
                    placeholder="Search keywords"
                    className="rounded-xl border p-3"
                  />
                </div>
              </section>

              <section className="rounded-2xl bg-white p-5 shadow">
                <h2 className="text-xl font-bold">4. Images</h2>
                <textarea
                  name="imageUrls"
                  value={form.imageUrls}
                  onChange={updateField}
                  placeholder="Image URLs, one per line or comma separated"
                  className="mt-4 min-h-24 w-full rounded-xl border p-3"
                />
                <div className="mt-4">
                  <FileUploadField
                    label="Upload product image"
                    purpose="product"
                    accept="image/*"
                    onUploaded={appendUploadedImage}
                  />
                </div>
                {imageList.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                    {imageList.slice(0, 8).map((image) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={image}
                        src={image}
                        alt="Product preview"
                        className="aspect-square rounded-xl border bg-slate-100 object-cover"
                      />
                    ))}
                  </div>
                )}
              </section>
            </div>

            <aside className="space-y-6">
              <section className="rounded-2xl bg-white p-5 shadow">
                <h2 className="text-xl font-bold">Pricing</h2>
                <div className="mt-4 space-y-3">
                  <input
                    type="number"
                    name="vendorPrice"
                    value={form.vendorPrice}
                    onChange={updateField}
                    placeholder="Vendor wants / payout"
                    className="w-full rounded-xl border p-3"
                    min="1"
                    required
                  />
                  <input
                    type="number"
                    name="mrp"
                    value={form.mrp}
                    onChange={updateField}
                    placeholder="MRP"
                    className="w-full rounded-xl border p-3"
                    min="1"
                  />
                  <input
                    type="number"
                    name="discountPercent"
                    value={form.discountPercent}
                    onChange={updateField}
                    placeholder="Discount %"
                    className="w-full rounded-xl border p-3"
                    min="0"
                  />
                  <input
                    type="number"
                    name="platformCommissionPercent"
                    value={form.platformCommissionPercent}
                    onChange={updateField}
                    placeholder="Platform commission %"
                    className="w-full rounded-xl border p-3"
                    min="0"
                  />
                  <input
                    type="number"
                    name="stock"
                    value={form.stock}
                    onChange={updateField}
                    placeholder="Stock quantity"
                    className="w-full rounded-xl border p-3"
                    min="0"
                    required
                  />
                </div>
              </section>

              <section className="rounded-2xl bg-white p-5 shadow">
                <h2 className="text-xl font-bold">Packaging and delivery</h2>
                <div className="mt-4 space-y-3">
                  <input
                    type="number"
                    name="weightGrams"
                    value={form.weightGrams}
                    onChange={updateField}
                    placeholder="Weight in grams"
                    className="w-full rounded-xl border p-3"
                    min="0"
                  />
                  <select
                    name="packageSize"
                    value={form.packageSize}
                    onChange={updateField}
                    className="w-full rounded-xl border p-3"
                  >
                    {PACKAGE_SIZE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 rounded-xl border p-3 text-sm font-bold">
                    <input
                      type="checkbox"
                      name="fragile"
                      checked={form.fragile}
                      onChange={updateField}
                    />
                    Fragile item
                  </label>
                  <input
                    type="number"
                    name="shippingCharge"
                    value={form.shippingCharge}
                    onChange={updateField}
                    placeholder="Delivery charge override"
                    className="w-full rounded-xl border p-3"
                    min="0"
                  />
                  <input
                    type="number"
                    name="codCharge"
                    value={form.codCharge}
                    onChange={updateField}
                    placeholder="COD charge"
                    className="w-full rounded-xl border p-3"
                    min="0"
                  />
                </div>
              </section>

              <section className="rounded-2xl border border-pink-100 bg-pink-50 p-5 shadow">
                <h2 className="text-xl font-bold">Live price preview</h2>
                <div className="mt-4 grid gap-3 text-sm">
                  <Row label="Customer price" value={formatRupees(pricingPreview.finalCustomerPrice)} strong />
                  <Row label="Vendor payout" value={formatRupees(pricingPreview.vendorPayout)} />
                  <Row label="Platform fee" value={formatRupees(pricingPreview.platformCommissionAmount)} />
                  <Row label="Packaging" value={formatRupees(pricingPreview.packagingCharge)} />
                  <Row label="Delivery" value={formatRupees(pricingPreview.shippingCharge)} />
                  <Row label="COD charge" value={formatRupees(pricingPreview.codCharge)} />
                  <Row label="Customer saving" value={`${pricingPreview.discountPercent}% off`} />
                </div>
              </section>

              {error && (
                <p className="rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">
                  {error}
                </p>
              )}
              {message && (
                <p className="rounded-xl bg-green-50 p-4 text-sm font-semibold text-green-700">
                  {message}
                </p>
              )}

              <button
                disabled={saving}
                className="w-full rounded-xl bg-slate-950 p-4 text-sm font-black text-white disabled:opacity-60"
              >
                {saving ? "Saving Product..." : "Save Product"}
              </button>
            </aside>
          </form>
        )}
      </main>
    </main>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3 border-b border-pink-100 pb-2 last:border-b-0">
      <span className="text-slate-600">{label}</span>
      <span className={strong ? "font-black text-pink-700" : "font-bold"}>
        {value}
      </span>
    </div>
  );
}
