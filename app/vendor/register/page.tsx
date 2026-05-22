"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Navbar from "@/components/navbar/Navbar";

export default function VendorRegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    storeName: "",
    description: "",
    mobile: "",
    businessCategory: "",
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
  });

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target;
    setForm((currentForm) => ({ ...currentForm, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!form.name || !form.email || !form.password || !form.storeName) {
      setError("Please fill name, email, password and store name.");
      return;
    }

    setLoading(true);

    const response = await fetch("/api/vendor/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(data.error || "Vendor registration failed");
      return;
    }

    router.push(`/verify-email?email=${encodeURIComponent(form.email)}`);
    router.refresh();
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
              <input
                name="businessCategory"
                placeholder="Business category"
                value={form.businessCategory}
                onChange={handleChange}
                className="w-full rounded-xl border p-3"
              />
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
