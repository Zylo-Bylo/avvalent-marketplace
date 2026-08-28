"use client";

import Link from "next/link";
import { useState } from "react";
import ZyloBrandLogo from "@/components/brand/ZyloBrandLogo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [resetUrl, setResetUrl] = useState("");
  const [accountFound, setAccountFound] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setResetUrl("");
    setAccountFound(null);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const text = await response.text();
      const data = text ? JSON.parse(text) : {};

      setMessage(data.error || data.message || "Reset request complete.");
      setResetUrl(data.resetUrl || "");
      setAccountFound(
        typeof data.accountFound === "boolean"
          ? data.accountFound
          : response.ok
            ? null
            : false
      );
    } catch {
      setMessage("Password reset service is not responding. Restart server and try again.");
      setAccountFound(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <Link
          href="/"
          className="mb-4 inline-flex w-full justify-center"
          aria-label="Zylo-Buylo - Buy Smart, Sell Easy"
        >
          <ZyloBrandLogo mode="horizontal" />
        </Link>
        <h1 className="text-center text-3xl font-bold text-pink-600">
          Forgot Password
        </h1>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-lg border p-3"
            required
          />
          {message && (
            <p
              className={`rounded-lg p-3 text-sm ${
                accountFound === false
                  ? "bg-red-50 text-red-700"
                  : "bg-pink-50 text-pink-700"
              }`}
            >
              {message}
            </p>
          )}
          {resetUrl && (
            <Link
              href={resetUrl}
              className="block rounded-lg border border-pink-200 bg-white p-3 text-center text-sm font-semibold text-pink-600"
            >
              Open Reset Password Page
            </Link>
          )}
          <button
            disabled={loading}
            className="w-full rounded-lg bg-pink-600 py-3 font-bold text-white disabled:opacity-60"
          >
            {loading ? "Generating..." : "Generate Reset Link"}
          </button>
        </form>
        <p className="mt-5 text-center text-sm">
          <Link href="/login" className="font-semibold text-pink-600">
            Back to login
          </Link>
        </p>
      </div>
    </main>
  );
}
