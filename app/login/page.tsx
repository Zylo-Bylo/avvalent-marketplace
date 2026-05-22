"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

type LoginUser = {
  role: "CUSTOMER" | "VENDOR" | "ADMIN";
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const role = searchParams.get("role");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(data.error || "Login failed");
      return;
    }

    const user = data.user as LoginUser;

    if (next) {
      router.push(next);
      router.refresh();
      return;
    }

    if (user.role === "VENDOR") {
      router.push("/vendor/dashboard");
    } else if (user.role === "ADMIN") {
      router.push("/admin/dashboard");
    } else {
      router.push("/");
    }

    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <div className="mb-6 text-center">
          <Link href="/" className="text-2xl font-bold text-pink-600">
            ZYLO BUYLO
          </Link>
          <h1 className="mt-4 text-3xl font-bold text-gray-900">
            {role === "vendor" ? "Vendor Login" : "Login"}
          </h1>
          {role === "vendor" && (
            <p className="mt-2 text-sm text-gray-500">
              Login to manage products, inventory, orders, and payments.
            </p>
          )}
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
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

          {error && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-pink-600 py-3 font-bold text-white transition hover:bg-pink-700 disabled:opacity-60"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <p className="mt-5 text-center text-gray-500">
          Don&apos;t have an account?
          <Link
            href={role === "vendor" ? "/vendor/register" : "/signup"}
            className="ml-2 font-semibold text-pink-600"
          >
            {role === "vendor" ? "Register as vendor" : "Signup"}
          </Link>
        </p>
        <p className="mt-3 text-center text-sm">
          <Link href="/forgot-password" className="font-semibold text-pink-600">
            Forgot password?
          </Link>
          <span className="mx-2 text-gray-300">/</span>
          <Link href="/verify-email" className="font-semibold text-pink-600">
            Verify email OTP
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-gray-100">
          <p className="text-gray-600">Loading login...</p>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
