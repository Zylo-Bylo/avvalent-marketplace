"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Navbar from "@/components/navbar/Navbar";
import {
  VENDOR_AGREEMENT_VERSION,
  hasAcceptedCurrentVendorAgreement,
} from "@/lib/legal-policy";

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
  metadata?: Record<string, unknown> | null;
  rejectionReason?: string | null;
  approvedAt?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "INACTIVE";
  kycStatus: "NOT_SUBMITTED" | "SUBMITTED" | "APPROVED" | "REJECTED";
  createdAt: string;
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function documentCount(vendor: Vendor) {
  return [
    vendor.panCardUrl,
    vendor.aadhaarUrl,
    vendor.gstCertificateUrl,
    vendor.bankProofUrl,
  ].filter(Boolean).length;
}

function getAgreementValue(vendor: Vendor, key: string) {
  const metadata = vendor.metadata;
  if (!metadata || typeof metadata !== "object") {
    return "";
  }

  const value = metadata[key];
  return typeof value === "string" || typeof value === "boolean" ? String(value) : "";
}

function agreementAccepted(vendor: Vendor) {
  return hasAcceptedCurrentVendorAgreement(vendor.metadata);
}

function missingReviewItems(vendor: Vendor) {
  const missing = [];

  if (!vendor.storeName) missing.push("store name");
  if (!vendor.mobile) missing.push("mobile");
  if (!vendor.businessCategory) missing.push("business category");
  if (!vendor.businessAddress) missing.push("business address");
  if (!vendor.panNumber) missing.push("PAN number");
  if (!vendor.aadhaarNumber) missing.push("Aadhaar number");
  if (!vendor.bankDetails) missing.push("bank details");
  if (!vendor.panCardUrl) missing.push("PAN card document");
  if (!vendor.aadhaarUrl) missing.push("Aadhaar document");
  if (!vendor.bankProofUrl) missing.push("bank proof");

  return missing;
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  return (
    <div className="border border-stone-200 bg-stone-50 p-3">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-500">
        {label}
      </p>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm text-stone-900">
        {value || "Not submitted"}
      </p>
    </div>
  );
}

function DocumentLink({
  label,
  url,
}: {
  label: string;
  url?: string | null;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border border-stone-200 bg-white p-3">
      <div>
        <p className="text-sm font-bold text-stone-900">{label}</p>
        <p className="mt-1 max-w-[260px] truncate text-xs text-stone-500">
          {url || "Not submitted"}
        </p>
      </div>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 bg-[#6b145d] px-3 py-2 text-xs font-bold text-white"
        >
          Open
        </a>
      ) : (
        <span className="shrink-0 border border-stone-200 px-3 py-2 text-xs font-bold text-stone-400">
          Missing
        </span>
      )}
    </div>
  );
}

export default function AdminVendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [status, setStatus] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);

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
    setMessage("");

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
    const vendor = vendors.find((item) => item.id === vendorId);
    const missingItems = vendor ? missingReviewItems(vendor) : [];

    if (nextStatus === "APPROVED" && missingItems.length > 0) {
      const shouldApprove = window.confirm(
        `Some KYC details are missing: ${missingItems.join(", ")}. Approve this vendor anyway?`
      );

      if (!shouldApprove) {
        setSelectedVendor(vendor || null);
        return;
      }
    }

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
    setSelectedVendor((current) =>
      current?.id === vendorId ? data.vendor : current
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
            <h1 className="mt-3 text-4xl font-bold">Vendors</h1>
            <p className="mt-2 max-w-2xl text-sm text-[#d8c8af]">
              Vendor approval, KYC status, contact details and admin actions.
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
          <p className="bg-white py-12 text-center text-stone-500 shadow">
            Loading vendors...
          </p>
        ) : (
          <div className="overflow-hidden bg-white shadow">
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full border-collapse text-left text-sm">
                <thead className="bg-[#17130f] text-[#f8efe2]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Vendor Name</th>
                    <th className="px-4 py-3 font-semibold">Email</th>
                    <th className="px-4 py-3 font-semibold">Phone</th>
                    <th className="px-4 py-3 font-semibold">Business Name</th>
                    <th className="px-4 py-3 font-semibold">Created Date</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVendors.map((vendor) => (
                    <tr key={vendor.id} className="border-b border-stone-100">
                      <td className="px-4 py-4 align-top">
                        <p className="font-bold text-stone-950">{vendor.user.name}</p>
                        <p className="mt-1 text-xs text-stone-500">
                          GST: {vendor.gstNumber || "Not set"} / PAN:{" "}
                          {vendor.panNumber || "Not set"}
                        </p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <p>{vendor.user.email}</p>
                        <p className="mt-1 text-xs text-stone-500">
                          {vendor.user.emailVerified
                            ? "Email verified"
                            : "Email not verified"}
                        </p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        {vendor.mobile || "Not set"}
                      </td>
                      <td className="px-4 py-4 align-top">
                        {vendor.storeName || "Not set"}
                      </td>
                      <td className="px-4 py-4 align-top">
                        {formatDate(vendor.createdAt)}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <span
                          className={`inline-block px-3 py-1 text-xs font-bold ${statusTone[vendor.status]}`}
                        >
                          {vendor.status}
                        </span>
                        <p className="mt-2 text-xs text-stone-500">
                          KYC {vendor.kycStatus}
                        </p>
                        <p className="mt-1 text-xs text-stone-500">
                          Docs {documentCount(vendor)}/4
                        </p>
                        <p
                          className={`mt-1 text-xs font-semibold ${
                            agreementAccepted(vendor) ? "text-green-700" : "text-red-700"
                          }`}
                        >
                          Agreement {agreementAccepted(vendor) ? "accepted" : "due"}
                        </p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/vendor/dashboard?adminVendorId=${vendor.id}`}
                            className="bg-[#6b145d] px-3 py-2 text-xs font-semibold text-white"
                          >
                            View Dashboard
                          </Link>
                          <button
                            onClick={() => setSelectedVendor(vendor)}
                            className="border border-stone-300 px-3 py-2 text-xs font-semibold"
                          >
                            Review KYC
                          </button>
                          <button
                            onClick={() => updateVendor(vendor.id, "APPROVED")}
                            disabled={vendor.status === "APPROVED"}
                            className="bg-green-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => updateVendor(vendor.id, "REJECTED")}
                            disabled={vendor.status === "REJECTED"}
                            className="bg-red-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => updateVendor(vendor.id, "INACTIVE")}
                            disabled={vendor.status === "INACTIVE"}
                            className="border border-stone-300 px-3 py-2 text-xs font-semibold disabled:opacity-50"
                          >
                            Deactivate
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredVendors.length === 0 && (
              <p className="py-12 text-center text-stone-500">
                No vendors found for this filter.
              </p>
            )}
          </div>
        )}
      </section>

      {selectedVendor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <section className="max-h-[92vh] w-full max-w-5xl overflow-y-auto bg-white p-6 shadow-xl">
            <div className="flex flex-col gap-4 border-b border-stone-200 pb-5 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex flex-wrap gap-2">
                  <p
                    className={`inline-block px-3 py-1 text-xs font-bold ${statusTone[selectedVendor.status]}`}
                  >
                    {selectedVendor.status}
                  </p>
                  <p className="inline-block bg-stone-100 px-3 py-1 text-xs font-bold text-stone-700">
                    KYC {selectedVendor.kycStatus}
                  </p>
                  <p className="inline-block bg-[#fff4d6] px-3 py-1 text-xs font-bold text-[#8a6717]">
                    Docs {documentCount(selectedVendor)}/4
                  </p>
                </div>
                <h2 className="mt-3 text-2xl font-bold">
                  {selectedVendor.storeName || selectedVendor.user.name}
                </h2>
                <p className="text-sm text-stone-500">
                  Owner: {selectedVendor.user.name} / {selectedVendor.user.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedVendor(null)}
                className="border border-stone-300 px-3 py-2 text-sm font-semibold"
              >
                Close
              </button>
            </div>

            {missingReviewItems(selectedVendor).length > 0 ? (
              <div className="mt-5 border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
                <p className="font-bold">KYC review warning</p>
                <p className="mt-1">
                  Missing: {missingReviewItems(selectedVendor).join(", ")}.
                </p>
              </div>
            ) : (
              <div className="mt-5 border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                Main KYC fields and document links are submitted.
              </div>
            )}

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <DetailItem label="Business name" value={selectedVendor.storeName} />
              <DetailItem label="Business category" value={selectedVendor.businessCategory} />
              <DetailItem label="Mobile" value={selectedVendor.mobile} />
              <DetailItem label="Email verified" value={selectedVendor.user.emailVerified ? "Yes" : "No"} />
              <DetailItem label="Registered" value={formatDate(selectedVendor.createdAt)} />
              <DetailItem
                label="Approved on"
                value={
                  selectedVendor.approvedAt
                    ? formatDate(selectedVendor.approvedAt)
                    : "Not approved"
                }
              />
              <DetailItem label="PAN number" value={selectedVendor.panNumber} />
              <DetailItem label="Aadhaar number" value={selectedVendor.aadhaarNumber} />
              <DetailItem label="GST number" value={selectedVendor.gstNumber} />
              <DetailItem label="UPI ID" value={selectedVendor.upiId} />
              <DetailItem label="Products" value={selectedVendor._count.products} />
              <DetailItem label="Orders" value={selectedVendor._count.orders} />
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <DetailItem label="Business address" value={selectedVendor.businessAddress} />
              <DetailItem label="Bank details" value={selectedVendor.bankDetails} />
              <DetailItem label="Store description" value={selectedVendor.description} />
              <DetailItem label="Rejection reason" value={selectedVendor.rejectionReason} />
            </div>

            <div className="mt-6 rounded-xl border border-stone-200 bg-stone-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold">Vendor Agreement Proof</h3>
                  <p className="mt-1 text-sm text-stone-500">
                    Check this before approval. Current required version is{" "}
                    {VENDOR_AGREEMENT_VERSION}.
                  </p>
                </div>
                <span
                  className={`px-3 py-1 text-xs font-bold ${
                    agreementAccepted(selectedVendor)
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {agreementAccepted(selectedVendor) ? "CURRENT AGREEMENT ACCEPTED" : "AGREEMENT DUE"}
                </span>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <DetailItem
                  label="Accepted"
                  value={getAgreementValue(selectedVendor, "vendor_agreement_accepted") || "No"}
                />
                <DetailItem
                  label="Accepted version"
                  value={getAgreementValue(selectedVendor, "vendor_agreement_version") || "Not recorded"}
                />
                <DetailItem
                  label="Accepted at"
                  value={getAgreementValue(selectedVendor, "vendor_agreement_accepted_at") || "Not recorded"}
                />
                <DetailItem
                  label="IP address"
                  value={getAgreementValue(selectedVendor, "vendor_agreement_ip_address") || "Not recorded"}
                />
                <DetailItem
                  label="Browser / user agent"
                  value={getAgreementValue(selectedVendor, "vendor_agreement_user_agent") || "Not recorded"}
                />
                <DetailItem
                  label="Admin action"
                  value={
                    agreementAccepted(selectedVendor)
                      ? "Vendor accepted current agreement."
                      : "Ask vendor to login and accept latest agreement before approval."
                  }
                />
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-bold">Submitted Documents</h3>
              <p className="mt-1 text-sm text-stone-500">
                Open each document and match it with PAN, Aadhaar, GST and bank details
                before approving.
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <DocumentLink label="PAN Card" url={selectedVendor.panCardUrl} />
                <DocumentLink label="Aadhaar" url={selectedVendor.aadhaarUrl} />
                <DocumentLink label="GST Certificate" url={selectedVendor.gstCertificateUrl} />
                <DocumentLink label="Bank Proof" url={selectedVendor.bankProofUrl} />
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2 border-t border-stone-200 pt-5">
              <Link
                href={`/vendor/dashboard?adminVendorId=${selectedVendor.id}`}
                className="bg-[#6b145d] px-4 py-2 text-sm font-semibold text-white"
              >
                View Vendor Dashboard
              </Link>
              <button
                onClick={() => updateVendor(selectedVendor.id, "APPROVED")}
                disabled={selectedVendor.status === "APPROVED"}
                className="bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Approve
              </button>
              <button
                onClick={() => updateVendor(selectedVendor.id, "REJECTED")}
                disabled={selectedVendor.status === "REJECTED"}
                className="bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
