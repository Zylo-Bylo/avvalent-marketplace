"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/navbar/Navbar";

type AdminProfile = {
  businessName: string;
  legalName: string;
  brandName: string;
  registeredAddress: string;
  supportEmail: string;
  supportPhone: string;
  gstNumber: string;
  panNumber: string;
  cinNumber: string;
  shopActNumber: string;
  gstCertificateUrl: string;
  panCardUrl: string;
  incorporationCertificateUrl: string;
  cancelledChequeUrl: string;
  addressProofUrl: string;
  trademarkCertificateUrl: string;
  bankAccountName: string;
  bankAccountNumber: string;
  ifscCode: string;
  bankName: string;
  bankBranch: string;
  settlementUpiId: string;
  payoutCycle: string;
  paymentNotes: string;
};

type Field = {
  name: keyof AdminProfile;
  label: string;
  placeholder?: string;
  type?: string;
  textarea?: boolean;
};

const emptyProfile: AdminProfile = {
  businessName: "",
  legalName: "",
  brandName: "",
  registeredAddress: "",
  supportEmail: "",
  supportPhone: "",
  gstNumber: "",
  panNumber: "",
  cinNumber: "",
  shopActNumber: "",
  gstCertificateUrl: "",
  panCardUrl: "",
  incorporationCertificateUrl: "",
  cancelledChequeUrl: "",
  addressProofUrl: "",
  trademarkCertificateUrl: "",
  bankAccountName: "",
  bankAccountNumber: "",
  ifscCode: "",
  bankName: "",
  bankBranch: "",
  settlementUpiId: "",
  payoutCycle: "",
  paymentNotes: "",
};

const businessFields: Field[] = [
  { name: "businessName", label: "Business display name", placeholder: "Zylo-Buylo" },
  { name: "legalName", label: "Legal entity name", placeholder: "Registered company/proprietor name" },
  { name: "brandName", label: "Brand name", placeholder: "Zylo-Buylo.com" },
  { name: "supportEmail", label: "Support email", type: "email", placeholder: "support@zylo-buylo.com" },
  { name: "supportPhone", label: "Support phone", placeholder: "+91 ..." },
  { name: "registeredAddress", label: "Registered address", textarea: true },
];

const legalFields: Field[] = [
  { name: "gstNumber", label: "GST number", placeholder: "GSTIN" },
  { name: "panNumber", label: "PAN number", placeholder: "Business PAN" },
  { name: "cinNumber", label: "CIN / registration number", placeholder: "Optional" },
  { name: "shopActNumber", label: "Shop act / MSME / license number", placeholder: "Optional" },
];

const documentFields: Field[] = [
  { name: "gstCertificateUrl", label: "GST certificate" },
  { name: "panCardUrl", label: "PAN card" },
  { name: "incorporationCertificateUrl", label: "Incorporation / registration certificate" },
  { name: "cancelledChequeUrl", label: "Cancelled cheque / bank proof" },
  { name: "addressProofUrl", label: "Address proof" },
  { name: "trademarkCertificateUrl", label: "Trademark certificate" },
];

const bankFields: Field[] = [
  { name: "bankAccountName", label: "Account holder name", placeholder: "Legal account name" },
  { name: "bankAccountNumber", label: "Bank account number", placeholder: "Real settlement account" },
  { name: "ifscCode", label: "IFSC code", placeholder: "BANK0000000" },
  { name: "bankName", label: "Bank name", placeholder: "Bank name" },
  { name: "bankBranch", label: "Branch", placeholder: "Branch/city" },
  { name: "settlementUpiId", label: "Settlement UPI ID", placeholder: "merchant@upi" },
  { name: "payoutCycle", label: "Payout cycle", placeholder: "Daily / Weekly / Manual" },
  { name: "paymentNotes", label: "Payment notes", textarea: true },
];

function getCompletion(profile: AdminProfile) {
  const required: (keyof AdminProfile)[] = [
    "businessName",
    "legalName",
    "registeredAddress",
    "supportEmail",
    "supportPhone",
    "gstNumber",
    "panNumber",
    "gstCertificateUrl",
    "panCardUrl",
    "cancelledChequeUrl",
    "bankAccountName",
    "bankAccountNumber",
    "ifscCode",
    "bankName",
  ];
  const filled = required.filter((field) => profile[field]?.trim()).length;

  return Math.round((filled / required.length) * 100);
}

export default function AdminProfilePage() {
  const [profile, setProfile] = useState<AdminProfile>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const completion = useMemo(() => getCompletion(profile), [profile]);

  useEffect(() => {
    async function loadProfile() {
      try {
        const response = await fetch("/api/admin/profile", { cache: "no-store" });
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Could not load admin profile.");
          return;
        }

        setProfile({
          ...emptyProfile,
          ...(data.profile || {}),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load profile.");
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  function updateField(name: keyof AdminProfile, value: string) {
    setProfile((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function uploadDocument(field: keyof AdminProfile, file: File | null) {
    if (!file) {
      return;
    }

    setUploadingField(field);
    setError("");
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("purpose", "kyc");

      const response = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Upload failed.");
        return;
      }

      updateField(field, data.url);
      setMessage("Document uploaded. Save profile to keep this change.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploadingField("");
    }
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Profile save failed.");
        return;
      }

      setProfile({
        ...emptyProfile,
        ...(data.profile || {}),
      });
      setMessage("Admin business profile saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Profile save failed.");
    } finally {
      setSaving(false);
    }
  }

  function renderField(field: Field) {
    const value = profile[field.name] || "";

    return (
      <label key={field.name} className={field.textarea ? "md:col-span-2" : ""}>
        <span className="text-sm font-semibold text-stone-700">{field.label}</span>
        {field.textarea ? (
          <textarea
            value={value}
            onChange={(event) => updateField(field.name, event.target.value)}
            className="mt-2 min-h-28 w-full border border-stone-300 px-4 py-3 text-sm outline-none focus:border-[#6b145d]"
            placeholder={field.placeholder}
          />
        ) : (
          <input
            type={field.type || "text"}
            value={value}
            onChange={(event) => updateField(field.name, event.target.value)}
            className="mt-2 w-full border border-stone-300 px-4 py-3 text-sm outline-none focus:border-[#6b145d]"
            placeholder={field.placeholder}
          />
        )}
      </label>
    );
  }

  function renderDocumentField(field: Field) {
    const value = profile[field.name] || "";

    return (
      <div key={field.name} className="border border-stone-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold">{field.label}</p>
            <p className="mt-1 text-xs text-stone-500">
              Upload PDF/image or paste a document URL.
            </p>
          </div>
          {value && (
            <a
              href={value}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-semibold text-[#6b145d]"
            >
              View
            </a>
          )}
        </div>
        <input
          value={value}
          onChange={(event) => updateField(field.name, event.target.value)}
          className="mt-3 w-full border border-stone-300 px-4 py-3 text-sm outline-none focus:border-[#6b145d]"
          placeholder="https://..."
        />
        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={(event) => uploadDocument(field.name, event.target.files?.[0] || null)}
          className="mt-3 w-full text-sm"
          disabled={Boolean(uploadingField)}
        />
        {uploadingField === field.name && (
          <p className="mt-2 text-xs font-semibold text-[#6b145d]">Uploading...</p>
        )}
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f2ea] text-stone-950">
      <Navbar />

      <section className="border-b border-stone-200 bg-[#17130f] text-[#f8efe2]">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <Link href="/admin/dashboard" className="text-sm font-semibold text-[#d6b36a]">
            Back to dashboard
          </Link>
          <h1 className="mt-3 text-4xl font-bold">Admin Business Profile</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#d8c8af]">
            Save marketplace legal identity, document proof and real settlement
            bank details used for payments, invoices and operations.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8">
        {loading ? (
          <p className="bg-white py-12 text-center text-stone-500 shadow">
            Loading profile...
          </p>
        ) : (
          <form onSubmit={saveProfile} className="space-y-6">
            <div className="grid gap-4 bg-white p-5 shadow md:grid-cols-[1fr_260px] md:items-center">
              <div>
                <h2 className="text-2xl font-bold">Profile completion</h2>
                <p className="mt-2 text-sm text-stone-600">
                  Fill business, legal document and bank details before payment
                  gateway onboarding or vendor payout processing.
                </p>
              </div>
              <div>
                <div className="h-3 overflow-hidden bg-stone-200">
                  <div
                    className="h-full bg-[#315c48]"
                    style={{ width: `${completion}%` }}
                  />
                </div>
                <p className="mt-2 text-right text-sm font-bold">{completion}% complete</p>
              </div>
            </div>

            {error && (
              <p className="border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {error}
              </p>
            )}
            {message && (
              <p className="border border-green-200 bg-green-50 p-4 text-sm text-green-700">
                {message}
              </p>
            )}

            <section className="bg-white p-6 shadow">
              <h2 className="text-2xl font-bold">Business Details</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {businessFields.map(renderField)}
              </div>
            </section>

            <section className="bg-white p-6 shadow">
              <h2 className="text-2xl font-bold">Legal Numbers</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {legalFields.map(renderField)}
              </div>
            </section>

            <section className="bg-white p-6 shadow">
              <h2 className="text-2xl font-bold">Legal Documents</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {documentFields.map(renderDocumentField)}
              </div>
            </section>

            <section className="bg-white p-6 shadow">
              <h2 className="text-2xl font-bold">Bank And Settlement Details</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {bankFields.map(renderField)}
              </div>
            </section>

            <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border border-stone-200 bg-white p-4 shadow-2xl">
              <p className="text-sm text-stone-600">
                Bank details are admin-only. Keep this information accurate for
                payment settlement and vendor payout records.
              </p>
              <button
                type="submit"
                disabled={saving || Boolean(uploadingField)}
                className="bg-[#6b145d] px-6 py-3 text-sm font-bold text-white disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Admin Profile"}
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
