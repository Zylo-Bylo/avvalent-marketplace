"use client";

import Link from "next/link";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await response.json();
    setLoading(false);
    setMessage(data.resetUrl ? `${data.message} ${data.resetUrl}` : data.message || data.error);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
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
            <p className="rounded-lg bg-pink-50 p-3 text-sm text-pink-700">
              {message}
            </p>
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
