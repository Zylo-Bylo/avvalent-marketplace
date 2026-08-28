"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import ZyloBrandLogo from "@/components/brand/ZyloBrandLogo";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const safeNext = next?.startsWith("/") ? next : "";
  const loginHref = safeNext
    ? `/login?role=customer&next=${encodeURIComponent(safeNext)}`
    : "/login";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const text = await response.text();
      const data = text ? JSON.parse(text) : {};

      if (!response.ok) {
        setError(data.error || "Signup failed. Please try again.");
        return;
      }

      router.push(
        `/verify-email?email=${encodeURIComponent(email)}${
          safeNext ? `&next=${encodeURIComponent(safeNext)}` : ""
        }`
      );
      router.refresh();
    } catch {
      setError("Signup service is not responding. Restart server and try again.");
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
        <h1 className="mb-6 text-center text-3xl font-bold text-pink-600">
          Create Account
        </h1>

        <form onSubmit={handleSignup} className="space-y-4">
          <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border p-3"
            required
          />

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border p-3"
            required
          />

          <div className="flex rounded-lg border bg-white">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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

          {error && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-pink-500 py-3 font-bold text-white transition hover:bg-pink-600 disabled:opacity-60"
          >
            {loading ? "Creating..." : "Sign Up"}
          </button>
        </form>

        <p className="mt-5 text-center text-gray-500">
          Already have an account?
          <Link href={loginHref} className="ml-2 text-pink-600">
            Login
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-gray-100">
          <p className="text-gray-600">Loading signup...</p>
        </main>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
