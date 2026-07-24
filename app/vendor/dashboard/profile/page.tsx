"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Contact = {
  id: string;
  name: string;
  designation?: string | null;
  phone?: string | null;
  email?: string | null;
  isPrimary: boolean;
  isActive: boolean;
};

type Address = {
  id: string;
  type: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  isDefault: boolean;
  isActive: boolean;
};

type KycDocument = {
  id: string;
  type: string;
  documentNumberMasked?: string | null;
  status: string;
  rejectionReason?: string | null;
  hasFile?: boolean;
};

type VendorProfile = {
  storeName: string;
  status: string;
  kycStatus: string;
  rejectionReason?: string | null;
  contactPersons?: Contact[];
  addresses?: Address[];
  kycDocuments?: KycDocument[];
  verificationEvents?: Array<{ id: string; newStatus: string; reason?: string | null; createdAt: string }>;
  suspensionEvents?: Array<{ id: string; action: string; reason?: string | null; createdAt: string }>;
};

const addressTypes = ["REGISTERED", "PICKUP", "RETURN", "OTHER"];
const documentTypes = ["GST", "PAN", "AADHAAR", "BUSINESS_REGISTRATION", "BANK_PROOF", "ADDRESS_PROOF", "OTHER"];

export default function VendorOperationsProfilePage() {
  const [profile, setProfile] = useState<VendorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [contact, setContact] = useState({ name: "", designation: "", phone: "", email: "", isPrimary: false });
  const [address, setAddress] = useState({
    type: "PICKUP",
    addressLine1: "",
    city: "",
    state: "",
    postalCode: "",
    contactName: "",
    contactPhone: "",
    isDefault: false,
  });
  const [documentForm, setDocumentForm] = useState({ type: "GST", documentNumber: "" });
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentFileInputKey, setDocumentFileInputKey] = useState(0);

  async function loadProfile() {
    setLoading(true);
    setError("");
    const response = await fetch("/api/vendor/profile", { cache: "no-store" });
    const result = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(result.error || "Could not load vendor profile.");
      return;
    }
    setProfile(result.user?.vendorProfile || null);
  }

  useEffect(() => {
    loadProfile();
  }, []);

  const timeline = useMemo(() => {
    return [
      ...(profile?.verificationEvents || []).map((event) => ({
        id: `v-${event.id}`,
        label: event.newStatus,
        note: event.reason,
        createdAt: event.createdAt,
      })),
      ...(profile?.suspensionEvents || []).map((event) => ({
        id: `s-${event.id}`,
        label: event.action,
        note: event.reason,
        createdAt: event.createdAt,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [profile]);

  async function submitContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    const response = await fetch("/api/vendor/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(contact),
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error || "Contact save failed.");
      return;
    }
    setMessage("Contact saved.");
    setContact({ name: "", designation: "", phone: "", email: "", isPrimary: false });
    await loadProfile();
  }

  async function submitAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    const response = await fetch("/api/vendor/addresses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(address),
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error || "Address save failed.");
      return;
    }
    setMessage("Address saved.");
    setAddress({ ...address, addressLine1: "", city: "", state: "", postalCode: "", contactName: "", contactPhone: "" });
    await loadProfile();
  }

  async function submitDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    const body = documentFile ? new FormData() : JSON.stringify(documentForm);
    if (documentFile && body instanceof FormData) {
      body.append("type", documentForm.type);
      body.append("documentNumber", documentForm.documentNumber);
      body.append("file", documentFile);
    }
    const response = await fetch("/api/vendor/kyc-documents", {
      method: "POST",
      headers: documentFile ? undefined : { "Content-Type": "application/json" },
      body,
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error || "KYC document save failed.");
      return;
    }
    setMessage(documentFile ? "KYC document uploaded." : "KYC document metadata submitted.");
    setDocumentForm({ type: "GST", documentNumber: "" });
    setDocumentFile(null);
    setDocumentFileInputKey((key) => key + 1);
    await loadProfile();
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-950">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/vendor/dashboard" className="text-sm font-bold text-pink-700">
              Back to vendor dashboard
            </Link>
            <h1 className="mt-2 text-3xl font-black">Vendor Profile Operations</h1>
            <p className="text-sm text-slate-600">{profile?.storeName || "Complete your vendor profile and KYC."}</p>
          </div>
          {profile && (
            <div className="rounded border border-slate-200 bg-white px-4 py-3 text-sm font-bold">
              Status: {profile.status} / KYC: {profile.kycStatus}
            </div>
          )}
        </div>

        {loading && <p>Loading profile...</p>}
        {error && <p className="mb-4 border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
        {message && <p className="mb-4 border border-green-200 bg-green-50 p-3 text-sm font-bold text-green-700">{message}</p>}
        {profile?.status === "INACTIVE" && (
          <div className="mb-5 border border-red-300 bg-red-50 p-4 text-sm font-bold text-red-800">
            Your vendor account is suspended. Check the timeline below or contact Zylo-Buylo support.
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-3">
          <section className="border border-slate-200 bg-white p-5">
            <h2 className="text-xl font-black">Contact Persons</h2>
            <form onSubmit={submitContact} className="mt-4 space-y-3">
              <input className="w-full border p-3" placeholder="Name" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} />
              <input className="w-full border p-3" placeholder="Designation" value={contact.designation} onChange={(e) => setContact({ ...contact, designation: e.target.value })} />
              <input className="w-full border p-3" placeholder="Phone" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} />
              <input className="w-full border p-3" placeholder="Email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} />
              <label className="flex items-center gap-2 text-sm font-bold">
                <input type="checkbox" checked={contact.isPrimary} onChange={(e) => setContact({ ...contact, isPrimary: e.target.checked })} />
                Primary contact
              </label>
              <button className="w-full bg-black px-4 py-3 font-bold text-white">Add Contact</button>
            </form>
            <div className="mt-5 space-y-2">
              {(profile?.contactPersons || []).map((item) => (
                <div key={item.id} className="border bg-slate-50 p-3 text-sm">
                  <b>{item.name}</b> {item.isPrimary ? "(Primary)" : ""}
                  <div>{item.designation || "No designation"} · {item.phone || "No phone"}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="border border-slate-200 bg-white p-5">
            <h2 className="text-xl font-black">Addresses</h2>
            <form onSubmit={submitAddress} className="mt-4 space-y-3">
              <select className="w-full border p-3" value={address.type} onChange={(e) => setAddress({ ...address, type: e.target.value })}>
                {addressTypes.map((type) => <option key={type}>{type}</option>)}
              </select>
              <input className="w-full border p-3" placeholder="Address line 1" value={address.addressLine1} onChange={(e) => setAddress({ ...address, addressLine1: e.target.value })} />
              <input className="w-full border p-3" placeholder="City" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} />
              <input className="w-full border p-3" placeholder="State" value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value })} />
              <input className="w-full border p-3" placeholder="Postal code" value={address.postalCode} onChange={(e) => setAddress({ ...address, postalCode: e.target.value })} />
              <label className="flex items-center gap-2 text-sm font-bold">
                <input type="checkbox" checked={address.isDefault} onChange={(e) => setAddress({ ...address, isDefault: e.target.checked })} />
                Default for this type
              </label>
              <button className="w-full bg-black px-4 py-3 font-bold text-white">Add Address</button>
            </form>
            <div className="mt-5 space-y-2">
              {(profile?.addresses || []).map((item) => (
                <div key={item.id} className="border bg-slate-50 p-3 text-sm">
                  <b>{item.type}</b> {item.isDefault ? "(Default)" : ""}
                  <div>{item.addressLine1}, {item.city}, {item.state} {item.postalCode}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="border border-slate-200 bg-white p-5">
            <h2 className="text-xl font-black">KYC Checklist</h2>
            <form onSubmit={submitDocument} className="mt-4 space-y-3">
              <select className="w-full border p-3" value={documentForm.type} onChange={(e) => setDocumentForm({ ...documentForm, type: e.target.value })}>
                {documentTypes.map((type) => <option key={type}>{type}</option>)}
              </select>
              <input className="w-full border p-3" placeholder="Document number" value={documentForm.documentNumber} onChange={(e) => setDocumentForm({ ...documentForm, documentNumber: e.target.value })} />
              <input
                key={documentFileInputKey}
                className="w-full border p-3"
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(event) => setDocumentFile(event.target.files?.[0] || null)}
              />
              <button className="w-full bg-black px-4 py-3 font-bold text-white">{documentFile ? "Upload Document" : "Submit Metadata"}</button>
            </form>
            <div className="mt-5 space-y-2">
              {(profile?.kycDocuments || []).map((item) => (
                <div key={item.id} className="border bg-slate-50 p-3 text-sm">
                  <b>{item.type}</b> · {item.status}
                  <div>{item.documentNumberMasked || "Number not provided"} {item.hasFile ? "· File uploaded" : ""}</div>
                  {item.rejectionReason && <div className="text-red-700">{item.rejectionReason}</div>}
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="mt-5 border border-slate-200 bg-white p-5">
          <h2 className="text-xl font-black">KYC Status Timeline</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {timeline.length === 0 ? (
              <p className="text-sm text-slate-500">No verification events yet.</p>
            ) : (
              timeline.map((item) => (
                <div key={item.id} className="border bg-slate-50 p-3 text-sm">
                  <b>{item.label}</b>
                  <div>{item.note || "No note"}</div>
                  <div className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
