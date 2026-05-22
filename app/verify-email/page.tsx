"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [otp, setOtp] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submitOtp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const response = await fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp }),
    });
    const data = await response.json();
    setLoading(false);
    setMessage(data.message || data.error || "Verification complete.");
  }

  async function resendOtp() {
    setLoading(true);
    setMessage("");
    const response = await fetch("/api/auth/resend-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await response.json();
    setLoading(false);
    setMessage(data.devOtp ? `${data.message} Dev OTP: ${data.devOtp}` : data.message || data.error);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="text-center text-3xl font-bold text-pink-600">
          Verify Email
        </h1>
        <form onSubmit={submitOtp} className="mt-6 space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-lg border p-3"
            required
          />
          <input
            inputMode="numeric"
            placeholder="6 digit OTP"
            value={otp}
            onChange={(event) => setOtp(event.target.value)}
            className="w-full rounded-lg border p-3"
            required
          />
          {message && (
            <p className="rounded-lg bg-pink-50 p-3 text-sm text-pink-700">
              {message}
            </p>
          )}
          <button
            disabled={loading}
            className="w-full rounded-lg bg-pink-600 py-3 font-bold text-white disabled:opacity-60"
          >
            {loading ? "Checking..." : "Verify OTP"}
          </button>
        </form>
        <button
          onClick={resendOtp}
          className="mt-4 w-full rounded-lg border py-3 text-sm font-semibold"
        >
          Resend OTP
        </button>
        <p className="mt-5 text-center text-sm">
          <Link href="/login" className="font-semibold text-pink-600">
            Back to login
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<main className="p-10 text-center">Loading...</main>}>
      <VerifyEmailForm />
    </Suspense>
  );
}
