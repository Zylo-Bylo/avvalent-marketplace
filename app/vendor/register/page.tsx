"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Navbar from "@/components/navbar/Navbar";
import { VENDOR_AGREEMENT_VERSION } from "@/lib/legal-policy";

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
  subcategories?: Subcategory[];
};

export default function VendorRegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    storeName: "",
    description: "",
    mobile: "",
    businessCategory: "",
    categoryId: "",
    subcategoryId: "",
    businessAddress: "",
    gstNumber: "",
    panNumber: "",
    aadhaarNumber: "",
    bankDetails: "",
    upiId: "",
    panCardUrl: "",
    aadhaarUrl: "",
    gstCertificateUrl: "",
    bankProofUrl: "",
    vendorAgreementAccepted: false,
  });

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === form.categoryId),
    [categories, form.categoryId]
  );
  const subcategoryOptions = selectedCategory?.subcategories || [];

  useEffect(() => {
    let isActive = true;

    async function loadCategories() {
      try {
        const response = await fetch("/api/categories", { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const data = await response.json();
        if (isActive) {
          setCategories(data.categories || []);
        }
      } catch {
        if (isActive) {
          setError("Could not load business categories. You can try again in a moment.");
        }
      } finally {
        if (isActive) {
          setCategoriesLoading(false);
        }
      }
    }

    loadCategories();

    return () => {
      isActive = false;
    };
  }, []);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const target = e.target;
    const { name, value } = target;

    setForm((currentForm) => {
      if (name === "categoryId") {
        const category = categories.find((item) => item.id === value);

        return {
          ...currentForm,
          categoryId: value,
          subcategoryId: "",
          businessCategory: category?.name || "",
        };
      }

      if (name === "subcategoryId") {
        const subcategory = subcategoryOptions.find((item) => item.id === value);
        const categoryName = selectedCategory?.name || currentForm.businessCategory;

        return {
          ...currentForm,
          subcategoryId: value,
          businessCategory:
            subcategory && categoryName
              ? `${categoryName} > ${subcategory.name}`
              : categoryName,
        };
      }

      return {
        ...currentForm,
        [name]:
          target instanceof HTMLInputElement && target.type === "checkbox"
            ? target.checked
            : value,
      };
    });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!form.name || !form.email || !form.password || !form.storeName) {
      setError("Please fill name, email, password and store name.");
      return;
    }

    if (!form.vendorAgreementAccepted) {
      setError("Please accept the Zylo-Buylo vendor agreement before registration.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/vendor/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const text = await response.text();
      const data = text ? JSON.parse(text) : {};

      if (!response.ok) {
        setError(data.error || "Vendor registration failed");
        return;
      }

      router.push(
        `/vendor/approval-pending?email=${encodeURIComponent(form.email)}`
      );
      router.refresh();
    } catch {
      setError("Vendor registration service is not responding. Restart server and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />

      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="rounded-2xl bg-white p-6 shadow">
          <h1 className="text-3xl font-bold text-gray-900">
            Register as Vendor
          </h1>
          <p className="mt-2 text-gray-600">
            Create your vendor account and go directly to your dashboard to add
            products.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <input
              type="text"
              name="name"
              placeholder="Your Name"
              value={form.name}
              onChange={handleChange}
              className="w-full rounded-xl border p-3"
              required
            />

            <input
              type="email"
              name="email"
              placeholder="Email"
              value={form.email}
              onChange={handleChange}
              className="w-full rounded-xl border p-3"
              required
            />

            <div className="flex rounded-xl border bg-white">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Password"
                value={form.password}
                onChange={handleChange}
                className="w-full rounded-xl p-3 outline-none"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                className="px-3 text-sm font-semibold text-pink-600"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Use 8+ characters with uppercase, lowercase, number and special character.
            </p>

            <input
              type="text"
              name="storeName"
              placeholder="Store Name"
              value={form.storeName}
              onChange={handleChange}
              className="w-full rounded-xl border p-3"
              required
            />

            <textarea
              name="description"
              placeholder="Store Description"
              value={form.description}
              onChange={handleChange}
              className="h-28 w-full rounded-xl border p-3"
            />

            <div className="grid gap-4 md:grid-cols-2">
              <input
                name="mobile"
                placeholder="Mobile number"
                value={form.mobile}
                onChange={handleChange}
                className="w-full rounded-xl border p-3"
              />
              <select
                name="categoryId"
                value={form.categoryId}
                onChange={handleChange}
                disabled={categoriesLoading}
                className="w-full rounded-xl border p-3"
              >
                <option value="">
                  {categoriesLoading ? "Loading categories..." : "Select business category"}
                </option>
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
                disabled={!form.categoryId || subcategoryOptions.length === 0}
                className="w-full rounded-xl border p-3 disabled:bg-gray-100 disabled:text-gray-500"
              >
                <option value="">
                  {!form.categoryId
                    ? "Select category first"
                    : subcategoryOptions.length
                      ? "Select subcategory"
                      : "No subcategories"}
                </option>
                {subcategoryOptions.map((subcategory) => (
                  <option key={subcategory.id} value={subcategory.id}>
                    {subcategory.name}
                  </option>
                ))}
              </select>
              <input
                name="gstNumber"
                placeholder="GST number"
                value={form.gstNumber}
                onChange={handleChange}
                className="w-full rounded-xl border p-3"
              />
              <input
                name="panNumber"
                placeholder="PAN number"
                value={form.panNumber}
                onChange={handleChange}
                className="w-full rounded-xl border p-3"
              />
              <input
                name="aadhaarNumber"
                placeholder="Aadhaar number"
                value={form.aadhaarNumber}
                onChange={handleChange}
                className="w-full rounded-xl border p-3"
              />
              <input
                name="upiId"
                placeholder="UPI ID"
                value={form.upiId}
                onChange={handleChange}
                className="w-full rounded-xl border p-3"
              />
            </div>

            <textarea
              name="businessAddress"
              placeholder="Business address"
              value={form.businessAddress}
              onChange={handleChange}
              className="h-24 w-full rounded-xl border p-3"
            />

            <textarea
              name="bankDetails"
              placeholder="Bank details"
              value={form.bankDetails}
              onChange={handleChange}
              className="h-24 w-full rounded-xl border p-3"
            />

            <div className="grid gap-4 md:grid-cols-2">
              <input
                name="panCardUrl"
                placeholder="PAN card document URL"
                value={form.panCardUrl}
                onChange={handleChange}
                className="w-full rounded-xl border p-3"
              />
              <input
                name="aadhaarUrl"
                placeholder="Aadhaar document URL"
                value={form.aadhaarUrl}
                onChange={handleChange}
                className="w-full rounded-xl border p-3"
              />
              <input
                name="gstCertificateUrl"
                placeholder="GST certificate URL"
                value={form.gstCertificateUrl}
                onChange={handleChange}
                className="w-full rounded-xl border p-3"
              />
              <input
                name="bankProofUrl"
                placeholder="Bank proof URL"
                value={form.bankProofUrl}
                onChange={handleChange}
                className="w-full rounded-xl border p-3"
              />
            </div>

            <div className="rounded-2xl border border-pink-100 bg-pink-50 p-4 text-sm text-gray-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold text-gray-950">Zylo-Buylo Vendor Agreement</p>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-pink-700">
                  Version {VENDOR_AGREEMENT_VERSION}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-gray-700">
                This is an electronic agreement. By accepting it, you confirm that your vendor
                information, products, dispatch, COD payout and return handling will follow
                Zylo-Buylo marketplace rules.
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 leading-6">
                <li>Business, KYC, GST, PAN, bank and UPI details must be true and verifiable.</li>
                <li>Product title, images, brand, SKU, size, color, stock, HSN, GST, MRP and price must be correct.</li>
                <li>Restricted or certified products need valid compliance documents such as BIS, FSSAI, safety, warranty or brand authorization where applicable.</li>
                <li>Packaging and labels must show required declarations such as MRP, net quantity, manufacturer/packer/importer, country of origin and expiry/best-before where applicable.</li>
                <li>Fake brand, copied listing, duplicate SKU misuse, wrong category or wrong dispatch may lead to account action.</li>
                <li>Courier name, tracking number, packed product proof and shipping label proof must be uploaded where required.</li>
                <li>COD payout is released only after delivery, cash collection and reconciliation.</li>
                <li>Only genuine return reasons are eligible after delivery OTP/open-box/customer verification.</li>
                <li>Vendor is responsible for legal claims, customer loss, penalties, recalls or payout adjustments caused by vendor-side violations.</li>
              </ul>
              <label className="mt-3 flex gap-3 rounded-xl bg-white p-3 font-semibold">
                <input
                  type="checkbox"
                  name="vendorAgreementAccepted"
                  checked={form.vendorAgreementAccepted}
                  onChange={handleChange}
                  className="mt-1 h-4 w-4"
                />
                <span>
                  I have read and accept the Zylo-Buylo Vendor Agreement, product quality rules,
                  dispatch rules, COD payout rules, return rules and account policy rules.
                  <Link href="/vendor-agreement" className="ml-1 text-pink-600 underline">
                    Read full agreement
                  </Link>
                </span>
              </label>
            </div>

            {error && (
              <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-pink-600 p-3 font-semibold text-white disabled:opacity-60"
            >
              {loading ? "Registering..." : "Register Vendor"}
            </button>
          </form>

          <p className="mt-5 text-center text-gray-600">
            Already registered?
            <Link
              href="/login?role=vendor&next=/vendor/dashboard"
              className="ml-2 font-semibold text-pink-600"
            >
              Vendor Login
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
