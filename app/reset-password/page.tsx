"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import ZyloBrandLogo from "@/components/brand/ZyloBrandLogo";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const [token, setToken] = useState(searchParams.get("token") || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await response.json();
    setLoading(false);
    setMessage(data.message || data.error || "Password reset complete.");
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
          Reset Password
        </h1>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <input
            placeholder="Reset token"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            className="w-full rounded-lg border p-3"
            required
          />
          <div className="flex rounded-lg border bg-white">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="New password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg p-3 outline-none"
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
          {message && (
            <p className="rounded-lg bg-pink-50 p-3 text-sm text-pink-700">
              {message}
            </p>
          )}
          <button
            disabled={loading}
            className="w-full rounded-lg bg-pink-600 py-3 font-bold text-white disabled:opacity-60"
          >
            {loading ? "Saving..." : "Reset Password"}
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="p-10 text-center">Loading...</main>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
