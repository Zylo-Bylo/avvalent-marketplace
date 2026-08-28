"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import ZyloBrandLogo from "@/components/brand/ZyloBrandLogo";

type LoginUser = {
  role: "CUSTOMER" | "VENDOR" | "ADMIN";
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const role = searchParams.get("role");
  const customerLogin = role === "customer" || next === "/profile";
  const adminRequired =
    searchParams.get("admin") === "1" || next?.startsWith("/admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [verifyEmailUrl, setVerifyEmailUrl] = useState("");

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setVerifyEmailUrl("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          expectedRole: adminRequired
            ? "ADMIN"
            : role === "vendor"
              ? "VENDOR"
              : undefined,
        }),
      });

      const text = await response.text();
      const data = text ? JSON.parse(text) : {};

      if (!response.ok) {
        setError(data.error || "Login failed. Please try again.");
        if (data.requiresVerification) {
          setVerifyEmailUrl(
            data.verifyEmailUrl ||
              `/verify-email?email=${encodeURIComponent(email)}`,
          );
        }
        return;
      }

      const user = data.user as LoginUser;

      if (next?.startsWith("/admin") && user.role !== "ADMIN") {
        await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
        setError("Admin login is required to access dashboard.");
        return;
      }

      const redirectTo =
        next ||
        (user.role === "VENDOR"
          ? "/vendor/dashboard"
          : user.role === "ADMIN"
            ? "/admin/dashboard"
            : "/profile");

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("zylo-auth-change"));
        window.location.assign(redirectTo);
        return;
      }

      router.push(redirectTo);
      router.refresh();
    } catch {
      setError("Login service is not responding. Restart server and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <div className="mb-6 text-center">
          <Link
            href="/"
            className="inline-flex justify-center"
            aria-label="Zylo-Buylo - Buy Smart, Sell Easy"
          >
            <ZyloBrandLogo mode="horizontal" />
          </Link>
          <h1 className="mt-4 text-3xl font-bold text-gray-900">
            {role === "vendor"
              ? "Vendor Login"
              : customerLogin
                ? "Customer Login"
                : "Login"}
          </h1>
          {customerLogin && (
            <p className="mt-2 text-sm text-gray-500">
              Login to view your profile, orders, wishlist, and delivery updates.
            </p>
          )}
          {role === "vendor" && (
            <p className="mt-2 text-sm text-gray-500">
              Login to manage products, inventory, orders, and payments.
            </p>
          )}
          {adminRequired && (
            <p className="mt-3 rounded-lg bg-pink-50 px-4 py-3 text-sm font-semibold text-pink-700">
              Admin login is required to access dashboard.
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
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <p>{error}</p>
              {verifyEmailUrl && (
                <Link
                  href={verifyEmailUrl}
                  className="mt-2 inline-flex font-semibold text-pink-700 underline"
                >
                  Enter OTP and verify email
                </Link>
              )}
            </div>
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
