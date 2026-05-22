"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Navbar from "@/components/navbar/Navbar";

type Vendor = {
  id: string;
  storeName: string;
  description?: string | null;
  mobile?: string | null;
  businessCategory?: string | null;
  businessAddress?: string | null;
  gstNumber?: string | null;
  panNumber?: string | null;
  aadhaarNumber?: string | null;
  bankDetails?: string | null;
  upiId?: string | null;
  panCardUrl?: string | null;
  aadhaarUrl?: string | null;
  gstCertificateUrl?: string | null;
  bankProofUrl?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "INACTIVE";
  kycStatus: "NOT_SUBMITTED" | "SUBMITTED" | "APPROVED" | "REJECTED";
  rejectionReason?: string | null;
  user: {
    name: string;
    email: string;
    emailVerified: boolean;
  };
  _count: {
    products: number;
    orders: number;
  };
};

const statusTone: Record<Vendor["status"], string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  INACTIVE: "bg-stone-200 text-stone-700",
};

export default function AdminVendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [status, setStatus] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const filteredVendors = useMemo(
    () => vendors.filter((vendor) => !status || vendor.status === status),
    [status, vendors]
  );
  const statusCounts = useMemo(
    () => ({
      PENDING: vendors.filter((vendor) => vendor.status === "PENDING").length,
      APPROVED: vendors.filter((vendor) => vendor.status === "APPROVED").length,
      REJECTED: vendors.filter((vendor) => vendor.status === "REJECTED").length,
      INACTIVE: vendors.filter((vendor) => vendor.status === "INACTIVE").length,
    }),
    [vendors]
  );

  async function loadVendors() {
    setLoading(true);
    const response = await fetch("/api/admin/vendors", { cache: "no-store" });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error || "Could not load vendors.");
      setLoading(false);
      return;
    }

    setVendors(data.vendors || []);
    setLoading(false);
  }

  useEffect(() => {
    const queryStatus = new URLSearchParams(window.location.search).get("status");

    if (
      queryStatus &&
      ["PENDING", "APPROVED", "REJECTED", "INACTIVE"].includes(queryStatus)
    ) {
      setStatus(queryStatus);
    }

    loadVendors();
  }, []);

  async function updateVendor(vendorId: string, nextStatus: Vendor["status"]) {
    const rejectionReason =
      nextStatus === "REJECTED"
        ? prompt("Reason for rejection?") || "Rejected by admin"
        : "";

    const response = await fetch(`/api/admin/vendors/${vendorId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: nextStatus,
        rejectionReason,
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error || "Could not update vendor.");
      return;
    }

    setVendors((current) =>
      current.map((vendor) => (vendor.id === vendorId ? data.vendor : vendor))
    );
    setMessage(`Vendor marked ${nextStatus.toLowerCase()}.`);
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
            <h1 className="mt-3 text-4xl font-bold">Vendor KYC Approval</h1>
            <p className="mt-2 max-w-2xl text-sm text-[#d8c8af]">
              Approve, reject, or deactivate vendors after checking business,
              bank, GST, PAN and document details.
            </p>
          </div>

          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="border border-[#d6b36a]/50 bg-[#17130f] px-4 py-3 text-sm text-white"
          >
            <option value="">All vendors</option>
            <option value="PENDING">Pending ({statusCounts.PENDING})</option>
            <option value="APPROVED">Approved ({statusCounts.APPROVED})</option>
            <option value="REJECTED">Rejected ({statusCounts.REJECTED})</option>
            <option value="INACTIVE">Inactive ({statusCounts.INACTIVE})</option>
          </select>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-6">
        {message && (
          <p className="mb-5 border border-[#dfd1bd] bg-white p-3 text-sm text-stone-700">
            {message}
          </p>
        )}

        {loading ? (
          <p className="bg-white py-12 text-center text-stone-500">
            Loading vendors...
          </p>
        ) : message && vendors.length === 0 ? (
          <div className="bg-white p-8 text-center shadow">
            <h2 className="text-2xl font-bold">Admin Login Required</h2>
            <p className="mt-3 text-stone-600">
              You are not logged in as an admin. Logout from the vendor account,
              then login with an admin account to approve vendors.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href="/login?next=/admin/vendors"
                className="bg-[#6b145d] px-5 py-3 text-sm font-semibold text-white"
              >
                Login as Admin
              </Link>
              <Link
                href="/vendor/dashboard"
                className="border border-stone-300 px-5 py-3 text-sm font-semibold"
              >
                Back to Vendor
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredVendors.map((vendor) => (
              <article key={vendor.id} className="bg-white p-5 shadow">
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-bold">{vendor.storeName}</h2>
                      <span className={`px-3 py-1 text-xs font-bold ${statusTone[vendor.status]}`}>
                        {vendor.status}
                      </span>
                      <span className="bg-stone-100 px-3 py-1 text-xs font-bold text-stone-700">
                        KYC {vendor.kycStatus}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-stone-500">
                      {vendor.user.name} / {vendor.user.email} /{" "}
                      {vendor.user.emailVerified ? "Email verified" : "Email not verified"}
                    </p>
                    <p className="mt-2 text-sm text-stone-600">
                      {vendor.description || "No business description"}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => updateVendor(vendor.id, "APPROVED")}
                      disabled={vendor.status === "APPROVED"}
                      className="bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => updateVendor(vendor.id, "REJECTED")}
                      disabled={vendor.status === "REJECTED"}
                      className="bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => updateVendor(vendor.id, "INACTIVE")}
                      disabled={vendor.status === "INACTIVE"}
                      className="border border-stone-300 px-4 py-2 text-sm font-semibold disabled:opacity-50"
                    >
                      Deactivate
                    </button>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 text-sm md:grid-cols-2 lg:grid-cols-4">
                  <p><span className="font-semibold">Mobile:</span> {vendor.mobile || "Not set"}</p>
                  <p><span className="font-semibold">Category:</span> {vendor.businessCategory || "Not set"}</p>
                  <p><span className="font-semibold">GST:</span> {vendor.gstNumber || "Not set"}</p>
                  <p><span className="font-semibold">PAN:</span> {vendor.panNumber || "Not set"}</p>
                  <p><span className="font-semibold">Aadhaar:</span> {vendor.aadhaarNumber || "Not set"}</p>
                  <p><span className="font-semibold">UPI:</span> {vendor.upiId || "Not set"}</p>
                  <p><span className="font-semibold">Products:</span> {vendor._count.products}</p>
                  <p><span className="font-semibold">Orders:</span> {vendor._count.orders}</p>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-sm">
                  {[
                    ["PAN Card", vendor.panCardUrl],
                    ["Aadhaar", vendor.aadhaarUrl],
                    ["GST Certificate", vendor.gstCertificateUrl],
                    ["Bank Proof", vendor.bankProofUrl],
                  ].map(([label, url]) =>
                    url ? (
                      <a
                        key={label}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="border border-[#d6b36a] px-3 py-2 font-semibold text-[#6b145d]"
                      >
                        View {label}
                      </a>
                    ) : null
                  )}
                </div>
              </article>
            ))}
            {filteredVendors.length === 0 && (
              <p className="bg-white py-12 text-center text-stone-500">
                No vendors found for this filter.
              </p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
