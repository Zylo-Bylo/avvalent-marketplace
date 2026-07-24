"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

type KycDocument = {
  id: string;
  type: string;
  documentNumberMasked?: string | null;
  status: string;
  rejectionReason?: string | null;
  hasFile?: boolean;
  signedUrl?: string;
};

type AdminVendorProfile = {
  id: string;
  storeName: string;
  status: string;
  kycStatus: string;
  rejectionReason?: string | null;
  user: { name: string; email: string; emailVerified: boolean };
  contactPersons: Array<{ id: string; name: string; designation?: string | null; phone?: string | null; email?: string | null; isPrimary: boolean }>;
  addresses: Array<{ id: string; type: string; addressLine1: string; city: string; state: string; postalCode: string; isDefault: boolean }>;
  kycDocuments: KycDocument[];
  verificationEvents: Array<{ id: string; newStatus: string; reason?: string | null; createdAt: string }>;
  suspensionEvents: Array<{ id: string; action: string; reason?: string | null; createdAt: string }>;
  _count?: { products: number; orders: number };
};

export default function AdminVendorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const [vendorId, setVendorId] = useState("");
  const [vendor, setVendor] = useState<AdminVendorProfile | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    params.then(({ id }) => setVendorId(id));
  }, [params]);

  const loadVendor = useCallback(async (id = vendorId) => {
    if (!id) return;
    setError("");
    const response = await fetch(`/api/admin/vendors/${id}/profile`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error || "Could not load vendor profile.");
      return;
    }
    setVendor(result.vendor);
  }, [vendorId]);

  useEffect(() => {
    if (vendorId) {
      loadVendor(vendorId);
    }
  }, [loadVendor, vendorId]);

  async function action(path: string, body: Record<string, unknown> = {}) {
    setError("");
    setMessage("");
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error || "Action failed.");
      return;
    }
    setMessage("Action completed.");
    setReason("");
    await loadVendor();
  }

  async function suspend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await action(`/api/admin/vendors/${vendorId}/suspend`, { reason });
  }

  if (!vendor) {
    return (
      <main className="min-h-screen bg-slate-50 p-8">
        <Link href="/admin/vendors" className="font-bold text-pink-700">Back to vendors</Link>
        <p className="mt-6">{error || "Loading vendor profile..."}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-950">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/admin/vendors" className="text-sm font-bold text-pink-700">Back to vendors</Link>
            <h1 className="mt-2 text-3xl font-black">{vendor.storeName}</h1>
            <p className="text-sm text-slate-600">{vendor.user.name} · {vendor.user.email}</p>
          </div>
          <div className="border bg-white px-4 py-3 text-sm font-bold">
            {vendor.status} / KYC {vendor.kycStatus}
          </div>
        </div>

        {error && <p className="mb-4 border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
        {message && <p className="mb-4 border border-green-200 bg-green-50 p-3 text-sm font-bold text-green-700">{message}</p>}

        <div className="grid gap-5 lg:grid-cols-3">
          <section className="border bg-white p-5">
            <h2 className="text-xl font-black">Business Summary</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div><dt className="font-bold">Products</dt><dd>{vendor._count?.products || 0}</dd></div>
              <div><dt className="font-bold">Orders</dt><dd>{vendor._count?.orders || 0}</dd></div>
              <div><dt className="font-bold">Email verified</dt><dd>{vendor.user.emailVerified ? "Yes" : "No"}</dd></div>
              {vendor.rejectionReason && <div><dt className="font-bold">Reason</dt><dd>{vendor.rejectionReason}</dd></div>}
            </dl>
          </section>

          <section className="border bg-white p-5">
            <h2 className="text-xl font-black">Contacts</h2>
            <div className="mt-4 space-y-2 text-sm">
              {vendor.contactPersons.length === 0 ? <p>No contacts added.</p> : vendor.contactPersons.map((item) => (
                <div key={item.id} className="border bg-slate-50 p-3">
                  <b>{item.name}</b> {item.isPrimary ? "(Primary)" : ""}
                  <div>{item.designation || "No designation"} · {item.phone || "No phone"}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="border bg-white p-5">
            <h2 className="text-xl font-black">Addresses</h2>
            <div className="mt-4 space-y-2 text-sm">
              {vendor.addresses.length === 0 ? <p>No addresses added.</p> : vendor.addresses.map((item) => (
                <div key={item.id} className="border bg-slate-50 p-3">
                  <b>{item.type}</b> {item.isDefault ? "(Default)" : ""}
                  <div>{item.addressLine1}, {item.city}, {item.state} {item.postalCode}</div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="mt-5 border bg-white p-5">
          <h2 className="text-xl font-black">KYC Review</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {vendor.kycDocuments.length === 0 ? <p>No KYC documents submitted.</p> : vendor.kycDocuments.map((document) => (
              <div key={document.id} className="border bg-slate-50 p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <b>{document.type}</b> · {document.status}
                    <div>{document.documentNumberMasked || "Number not provided"} {document.hasFile ? "· Private file attached" : ""}</div>
                  </div>
                  {document.signedUrl && <a className="font-bold text-pink-700" href={document.signedUrl} target="_blank">Open signed file</a>}
                </div>
                {document.rejectionReason && <p className="mt-2 text-red-700">{document.rejectionReason}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="border bg-black px-3 py-2 text-xs font-bold text-white" onClick={() => action(`/api/admin/vendors/${vendorId}/kyc/${document.id}/verify`, { reason: "Verified from admin review." })}>Verify</button>
                  <button className="border border-red-300 px-3 py-2 text-xs font-bold text-red-700" onClick={() => action(`/api/admin/vendors/${vendorId}/kyc/${document.id}/reject`, { reason: reason || "Rejected from admin review." })}>Reject</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-2">
          <div className="border bg-white p-5">
            <h2 className="text-xl font-black">Suspend / Reinstate</h2>
            <form onSubmit={suspend} className="mt-4 flex flex-col gap-3">
              <textarea className="min-h-24 border p-3" placeholder="Reason" value={reason} onChange={(event) => setReason(event.target.value)} />
              <div className="flex flex-wrap gap-2">
                <button className="bg-red-700 px-4 py-3 font-bold text-white">Suspend</button>
                <button type="button" className="border px-4 py-3 font-bold" onClick={() => action(`/api/admin/vendors/${vendorId}/reinstate`, { reason: reason || "Reinstated from admin review." })}>Reinstate</button>
              </div>
            </form>
          </div>

          <div className="border bg-white p-5">
            <h2 className="text-xl font-black">Verification Timeline</h2>
            <div className="mt-4 space-y-2 text-sm">
              {[...vendor.verificationEvents, ...vendor.suspensionEvents]
                .sort((a, b) => new Date((b as any).createdAt).getTime() - new Date((a as any).createdAt).getTime())
                .map((event: any) => (
                  <div key={`${event.id}-${event.createdAt}`} className="border bg-slate-50 p-3">
                    <b>{event.newStatus || event.action}</b>
                    <div>{event.reason || "No reason"}</div>
                    <div className="text-xs text-slate-500">{new Date(event.createdAt).toLocaleString()}</div>
                  </div>
                ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
