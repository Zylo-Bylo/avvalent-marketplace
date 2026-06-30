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

type FormState = {
  name: string;
  email: string;
  password: string;
  storeName: string;
  description: string;
  mobile: string;
  businessCategory: string;
  categoryId: string;
  subcategoryId: string;
  businessAddress: string;
  gstNumber: string;
  panNumber: string;
  aadhaarNumber: string;
  bankDetails: string;
  upiId: string;
  panCardUrl: string;
  aadhaarUrl: string;
  gstCertificateUrl: string;
  bankProofUrl: string;
  vendorAgreementAccepted: boolean;
};

type DocumentState = {
  panCardFile: File | null;
  aadhaarFile: File | null;
  gstCertificateFile: File | null;
  bankProofFile: File | null;
};

const steps = [
  "Mobile OTP",
  "Account & Store",
  "GST / KYC",
  "Bank Details",
  "Documents & Agreement",
];

const initialForm: FormState = {
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
};

const initialDocuments: DocumentState = {
  panCardFile: null,
  aadhaarFile: null,
  gstCertificateFile: null,
  bankProofFile: null,
};

function cleanMobile(value: string) {
  return value.replace(/\D/g, "").slice(0, 10);
}

function isValidMobile(value: string) {
  return cleanMobile(value).length === 10;
}

function DocumentPicker({
  label,
  helper,
  file,
  required,
  onChange,
}: {
  label: string;
  helper: string;
  file: File | null;
  required?: boolean;
  onChange: (file: File | null) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-bold text-slate-950">
            {label} {required && <span className="text-pink-600">*</span>}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{helper}</p>
          {file && (
            <p className="mt-2 rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700">
              Selected: {file.name}
            </p>
          )}
        </div>
        <label className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white">
          Choose file
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={(event) => onChange(event.target.files?.[0] || null)}
            className="sr-only"
          />
        </label>
      </div>
    </div>
  );
}

export default function VendorRegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<FormState>(initialForm);
  const [documents, setDocuments] = useState<DocumentState>(initialDocuments);
  const [sentOtp, setSentOtp] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [mobileOtpToken, setMobileOtpToken] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [mobileVerified, setMobileVerified] = useState(false);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === form.categoryId),
    [categories, form.categoryId],
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
          setError("Could not load business categories. Please refresh and try again.");
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

  function setField(name: keyof FormState, value: string | boolean) {
    setForm((currentForm) => ({ ...currentForm, [name]: value }));
  }

  function handleChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    const target = event.target;
    const { name, value } = target;

    if (name === "mobile") {
      setMobileVerified(false);
      setSentOtp("");
      setMobileOtpToken("");
      setOtpInput("");
      setField("mobile", cleanMobile(value));
      return;
    }

    if (name === "categoryId") {
      const category = categories.find((item) => item.id === value);
      setForm((currentForm) => ({
        ...currentForm,
        categoryId: value,
        subcategoryId: "",
        businessCategory: category?.name || "",
      }));
      return;
    }

    if (name === "subcategoryId") {
      const subcategory = subcategoryOptions.find((item) => item.id === value);
      const categoryName = selectedCategory?.name || form.businessCategory;
      setForm((currentForm) => ({
        ...currentForm,
        subcategoryId: value,
        businessCategory:
          subcategory && categoryName ? `${categoryName} > ${subcategory.name}` : categoryName,
      }));
      return;
    }

    setField(
      name as keyof FormState,
      target instanceof HTMLInputElement && target.type === "checkbox" ? target.checked : value,
    );
  }

  async function sendMobileOtp() {
    setError("");
    setNotice("");

    if (!isValidMobile(form.mobile)) {
      setError("Please enter a valid 10 digit mobile number.");
      return;
    }

    setOtpSending(true);

    try {
      const response = await fetch("/api/vendor/mobile-otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile: form.mobile }),
      });
      const data = await response.json();

      setSentOtp(data.devOtp || "sent");
      setOtpInput("");
      setMobileOtpToken("");
      setMobileVerified(false);

      if (!response.ok) {
        setSentOtp("");
        setError(data.error || "Could not send OTP. Please try again.");
        return;
      }

      setNotice(
        data.devOtp
          ? `${data.message} Setup mode OTP: ${data.devOtp}`
          : data.message || `OTP sent to ${form.mobile}.`,
      );
    } catch {
      setError("Mobile OTP service is not responding. Please try again.");
    } finally {
      setOtpSending(false);
    }
  }

  async function verifyMobileOtp() {
    setError("");

    if (!sentOtp) {
      setError("Please send OTP first.");
      return;
    }

    if (!otpInput.trim()) {
      setError("Please enter OTP.");
      return;
    }

    setOtpVerifying(true);

    try {
      const response = await fetch("/api/vendor/mobile-otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile: form.mobile, otp: otpInput }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Invalid mobile OTP.");
        return;
      }

      setMobileOtpToken(data.mobileOtpToken || "");
      setMobileVerified(true);
      setNotice("Mobile number verified. Continue vendor registration.");
    } catch {
      setError("Mobile OTP verification service is not responding. Please try again.");
    } finally {
      setOtpVerifying(false);
    }
  }

  function validateStep(targetStep = step) {
    if (targetStep === 0 && !mobileVerified) {
      return "Mobile OTP verification is required.";
    }

    if (
      targetStep === 1 &&
      (!form.name || !form.email || !form.password || !form.storeName || !form.categoryId)
    ) {
      return "Please fill name, email, password, store name and business category.";
    }

    if (targetStep === 2 && (!form.businessAddress || !form.panNumber || !form.aadhaarNumber)) {
      return "Business address, PAN and Aadhaar details are required.";
    }

    if (targetStep === 3 && !form.bankDetails) {
      return "Bank details are required for vendor payouts.";
    }

    if (targetStep === 4) {
      if (!documents.panCardFile && !form.panCardUrl) {
        return "PAN card document upload is required.";
      }

      if (!documents.aadhaarFile && !form.aadhaarUrl) {
        return "Aadhaar document upload is required.";
      }

      if (!documents.bankProofFile && !form.bankProofUrl) {
        return "Bank proof upload is required.";
      }

      if (form.gstNumber && !documents.gstCertificateFile && !form.gstCertificateUrl) {
        return "GST certificate upload is required when GST number is provided.";
      }

      if (!form.vendorAgreementAccepted) {
        return "Please accept the Zylo-Buylo vendor agreement before registration.";
      }
    }

    return "";
  }

  function goNext() {
    const message = validateStep();
    setError(message);
    setNotice("");

    if (message) {
      return;
    }

    setStep((currentStep) => Math.min(currentStep + 1, steps.length - 1));
  }

  function goBack() {
    setError("");
    setNotice("");
    setStep((currentStep) => Math.max(currentStep - 1, 0));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    for (let index = 0; index < steps.length; index += 1) {
      const message = validateStep(index);
      if (message) {
        setStep(index);
        setError(message);
        return;
      }
    }

    setLoading(true);

    try {
      const payload = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        payload.append(key, typeof value === "boolean" ? String(value) : value);
      });
      payload.append("mobileVerified", String(mobileVerified));
      payload.append("mobileOtpToken", mobileOtpToken);

      Object.entries(documents).forEach(([key, file]) => {
        if (file) {
          payload.append(key, file);
        }
      });

      const response = await fetch("/api/vendor/register", {
        method: "POST",
        body: payload,
      });

      const text = await response.text();
      const data = text ? JSON.parse(text) : {};

      if (!response.ok) {
        setError(data.error || "Vendor registration failed.");
        return;
      }

      router.push(`/vendor/approval-pending?email=${encodeURIComponent(form.email)}`);
      router.refresh();
    } catch {
      setError("Vendor registration service is not responding. Restart server and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="rounded-3xl border border-pink-100 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-pink-600">
                Vendor onboarding
              </p>
              <h1 className="mt-2 text-3xl font-black text-slate-950">
                Register as Vendor
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Start with mobile OTP, then complete store, GST/KYC, bank and document verification.
                Admin approval will happen after submitted documents are checked.
              </p>
            </div>
            <Link
              href="/login?role=vendor&next=/vendor/dashboard"
              className="rounded-2xl border border-pink-200 px-5 py-3 text-sm font-bold text-pink-700"
            >
              Already registered? Vendor Login
            </Link>
          </div>

          <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
            {steps.map((label, index) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  if (index <= step) {
                    setStep(index);
                    setError("");
                    setNotice("");
                  }
                }}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold ${
                  index === step
                    ? "bg-pink-600 text-white"
                    : index < step
                      ? "bg-green-50 text-green-700"
                      : "bg-slate-100 text-slate-500"
                }`}
              >
                {index + 1}. {label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            {step === 0 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-2xl font-black text-slate-950">Mobile OTP Verification</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Vendor registration starts from mobile verification. This mobile number will be
                    used for order, payout and support communication.
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                  <input
                    name="mobile"
                    inputMode="numeric"
                    placeholder="Enter 10 digit mobile number"
                    value={form.mobile}
                    onChange={handleChange}
                    className="w-full rounded-2xl border border-slate-300 p-4 font-semibold outline-none focus:border-pink-500"
                  />
                  <button
                    type="button"
                    onClick={sendMobileOtp}
                    disabled={otpSending}
                    className="rounded-2xl bg-slate-950 px-6 py-4 font-bold text-white disabled:opacity-60"
                  >
                    {otpSending ? "Sending..." : "Send OTP"}
                  </button>
                </div>

                <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                  <input
                    inputMode="numeric"
                    placeholder="Enter OTP"
                    value={otpInput}
                    onChange={(event) => setOtpInput(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="w-full rounded-2xl border border-slate-300 p-4 font-semibold outline-none focus:border-pink-500"
                  />
                  <button
                    type="button"
                    onClick={verifyMobileOtp}
                    disabled={otpVerifying}
                    className="rounded-2xl bg-pink-600 px-6 py-4 font-bold text-white disabled:opacity-60"
                  >
                    {otpVerifying ? "Verifying..." : "Verify OTP"}
                  </button>
                </div>

                {mobileVerified && (
                  <div className="rounded-2xl bg-green-50 p-4 text-sm font-bold text-green-700">
                    Mobile verified successfully.
                  </div>
                )}
              </div>
            )}

            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-2xl font-black text-slate-950">Account & Store Details</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    These details create the vendor login and store profile.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <input
                    type="text"
                    name="name"
                    placeholder="Owner name *"
                    value={form.name}
                    onChange={handleChange}
                    className="rounded-2xl border border-slate-300 p-4 outline-none focus:border-pink-500"
                  />
                  <input
                    type="email"
                    name="email"
                    placeholder="Email *"
                    value={form.email}
                    onChange={handleChange}
                    className="rounded-2xl border border-slate-300 p-4 outline-none focus:border-pink-500"
                  />
                  <div className="flex rounded-2xl border border-slate-300 bg-white focus-within:border-pink-500">
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      placeholder="Password *"
                      value={form.password}
                      onChange={handleChange}
                      className="w-full rounded-2xl p-4 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((visible) => !visible)}
                      className="px-4 text-sm font-bold text-pink-600"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  <input
                    type="text"
                    name="storeName"
                    placeholder="Store / company name *"
                    value={form.storeName}
                    onChange={handleChange}
                    className="rounded-2xl border border-slate-300 p-4 outline-none focus:border-pink-500"
                  />
                  <select
                    name="categoryId"
                    value={form.categoryId}
                    onChange={handleChange}
                    disabled={categoriesLoading}
                    className="rounded-2xl border border-slate-300 p-4 outline-none focus:border-pink-500 disabled:bg-slate-100"
                  >
                    <option value="">
                      {categoriesLoading ? "Loading categories..." : "Select business category *"}
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
                    className="rounded-2xl border border-slate-300 p-4 outline-none focus:border-pink-500 disabled:bg-slate-100"
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
                </div>

                <textarea
                  name="description"
                  placeholder="Store description"
                  value={form.description}
                  onChange={handleChange}
                  className="h-28 w-full rounded-2xl border border-slate-300 p-4 outline-none focus:border-pink-500"
                />

                <p className="text-xs text-slate-500">
                  Password should use 8+ characters with uppercase, lowercase, number and special character.
                </p>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-2xl font-black text-slate-950">GST & KYC Details</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Add legal identity and business address. GST is optional for non-GST sellers, but
                    GST certificate is required if GST number is filled.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <input
                    name="gstNumber"
                    placeholder="GST number, if applicable"
                    value={form.gstNumber}
                    onChange={handleChange}
                    className="rounded-2xl border border-slate-300 p-4 uppercase outline-none focus:border-pink-500"
                  />
                  <input
                    name="panNumber"
                    placeholder="PAN number *"
                    value={form.panNumber}
                    onChange={handleChange}
                    className="rounded-2xl border border-slate-300 p-4 uppercase outline-none focus:border-pink-500"
                  />
                  <input
                    name="aadhaarNumber"
                    placeholder="Aadhaar number *"
                    value={form.aadhaarNumber}
                    onChange={handleChange}
                    className="rounded-2xl border border-slate-300 p-4 outline-none focus:border-pink-500"
                  />
                  <input
                    value={form.mobile}
                    readOnly
                    className="rounded-2xl border border-green-200 bg-green-50 p-4 font-bold text-green-800"
                  />
                </div>

                <textarea
                  name="businessAddress"
                  placeholder="Full business address *"
                  value={form.businessAddress}
                  onChange={handleChange}
                  className="h-28 w-full rounded-2xl border border-slate-300 p-4 outline-none focus:border-pink-500"
                />
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-2xl font-black text-slate-950">Bank & Payout Details</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    This account will be used for online order payouts and COD reconciliation.
                  </p>
                </div>

                <textarea
                  name="bankDetails"
                  placeholder="Bank account details: account holder, bank name, account number, IFSC, branch *"
                  value={form.bankDetails}
                  onChange={handleChange}
                  className="h-36 w-full rounded-2xl border border-slate-300 p-4 outline-none focus:border-pink-500"
                />
                <input
                  name="upiId"
                  placeholder="UPI ID optional"
                  value={form.upiId}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-slate-300 p-4 outline-none focus:border-pink-500"
                />
              </div>
            )}

            {step === 4 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-2xl font-black text-slate-950">Documents & Agreement</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Upload document files directly. PAN, Aadhaar and bank proof are mandatory.
                  </p>
                </div>

                <div className="grid gap-4">
                  <DocumentPicker
                    label="PAN card"
                    helper="Upload clear PAN card image or PDF."
                    file={documents.panCardFile}
                    required
                    onChange={(file) => setDocuments((current) => ({ ...current, panCardFile: file }))}
                  />
                  <DocumentPicker
                    label="Aadhaar"
                    helper="Upload front/back combined PDF or clear image."
                    file={documents.aadhaarFile}
                    required
                    onChange={(file) => setDocuments((current) => ({ ...current, aadhaarFile: file }))}
                  />
                  {form.gstNumber && (
                    <DocumentPicker
                      label="GST certificate"
                      helper="Required because GST number is entered."
                      file={documents.gstCertificateFile}
                      required
                      onChange={(file) =>
                        setDocuments((current) => ({ ...current, gstCertificateFile: file }))
                      }
                    />
                  )}
                  <DocumentPicker
                    label="Bank proof"
                    helper="Cancelled cheque, passbook or bank letter."
                    file={documents.bankProofFile}
                    required
                    onChange={(file) => setDocuments((current) => ({ ...current, bankProofFile: file }))}
                  />
                </div>

                <div className="rounded-2xl border border-pink-100 bg-pink-50 p-4 text-sm text-slate-800">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-black text-slate-950">Zylo-Buylo Vendor Agreement</p>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-pink-700">
                      Version {VENDOR_AGREEMENT_VERSION}
                    </span>
                  </div>
                  <ul className="mt-3 list-disc space-y-1 pl-5 leading-6">
                    <li>Business, KYC, GST, PAN, bank and UPI details must be true and verifiable.</li>
                    <li>Product title, images, brand, SKU, size, color, stock, HSN, GST, MRP and price must be correct.</li>
                    <li>Fake brand, copied listing, duplicate SKU misuse, wrong category or wrong dispatch may lead to account action.</li>
                    <li>COD payout is released only after delivery, cash collection and reconciliation.</li>
                    <li>Only genuine return reasons are eligible after delivery OTP/open-box/customer verification.</li>
                  </ul>
                  <label className="mt-4 flex gap-3 rounded-2xl bg-white p-4 font-bold">
                    <input
                      type="checkbox"
                      name="vendorAgreementAccepted"
                      checked={form.vendorAgreementAccepted}
                      onChange={handleChange}
                      className="mt-1 h-4 w-4"
                    />
                    <span>
                      I accept Zylo-Buylo vendor agreement, product quality, dispatch, COD payout,
                      return and legal responsibility rules.
                      <Link href="/vendor-agreement" className="ml-1 text-pink-600 underline">
                        Read full agreement
                      </Link>
                    </span>
                  </label>
                </div>
              </div>
            )}

            {(error || notice) && (
              <div
                className={`mt-6 rounded-2xl p-4 text-sm font-bold ${
                  error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
                }`}
              >
                {error || notice}
              </div>
            )}

            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <button
                type="button"
                onClick={goBack}
                disabled={step === 0 || loading}
                className="rounded-2xl border border-slate-300 px-6 py-3 font-bold text-slate-900 disabled:opacity-40"
              >
                Back
              </button>

              {step < steps.length - 1 ? (
                <button
                  type="button"
                  onClick={goNext}
                  className="rounded-2xl bg-pink-600 px-7 py-3 font-bold text-white"
                >
                  Continue
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-2xl bg-pink-600 px-7 py-3 font-bold text-white disabled:opacity-60"
                >
                  {loading ? "Submitting..." : "Submit for Approval"}
                </button>
              )}
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-black text-slate-950">Registration checklist</h3>
              <div className="mt-4 space-y-3 text-sm">
                {[
                  ["Mobile verified", mobileVerified],
                  ["Store details", Boolean(form.name && form.email && form.storeName)],
                  ["Business KYC", Boolean(form.businessAddress && form.panNumber && form.aadhaarNumber)],
                  ["Bank details", Boolean(form.bankDetails)],
                  ["Documents", Boolean(documents.panCardFile && documents.aadhaarFile && documents.bankProofFile)],
                  ["Agreement", form.vendorAgreementAccepted],
                ].map(([label, done]) => (
                  <div key={String(label)} className="flex items-center justify-between gap-3">
                    <span className="text-slate-600">{label}</span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        done ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {done ? "Done" : "Due"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
              <h3 className="font-black">Important</h3>
              <p className="mt-2">
                Admin will approve the vendor only after checking business details, KYC documents,
                bank proof and agreement acceptance.
              </p>
            </div>
          </aside>
        </form>
      </main>
    </div>
  );
}
