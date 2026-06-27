"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Navbar from "@/components/navbar/Navbar";
import { useCartStore } from "@/store/cart-store";

type ProfileUser = {
  id: string;
  name: string;
  email: string;
  role: "CUSTOMER" | "VENDOR" | "ADMIN";
  avatarUrl?: string | null;
  emailVerified: boolean;
  createdAt: string;
  _count?: {
    orders: number;
    wishlist: number;
  };
};

export default function ProfilePage() {
  const router = useRouter();
  const clearCart = useCartStore((state) => state.clearCart);
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let isActive = true;

    async function loadProfile() {
      const response = await fetch("/api/customer/profile", { cache: "no-store" });
      const data = await response.json();

      if (!isActive) {
        return;
      }

      if (response.status === 401) {
        router.push("/login?role=customer&next=/profile");
        return;
      }

      if (!response.ok) {
        setError(data.error || "Could not load profile.");
        setLoading(false);
        return;
      }

      setUser(data.user);
      setName(data.user.name || "");
      setAvatarUrl(data.user.avatarUrl || "");
      setLoading(false);
    }

    loadProfile();

    return () => {
      isActive = false;
    };
  }, [router]);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/customer/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, avatarUrl }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Profile update failed.");
        return;
      }

      setUser(data.user);
      setMessage(data.message || "Profile updated.");
      router.refresh();
    } catch {
      setError("Profile service is not responding.");
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    clearCart();
    router.push("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="p-10 text-center text-slate-600">Loading profile...</div>
      </main>
    );
  }

  if (error && !user) {
    return (
      <main className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="mx-auto max-w-xl p-6">
          <div className="rounded-2xl bg-white p-8 text-center shadow">
            <p className="text-red-600">{error}</p>
            <Link
              href="/login?role=customer&next=/profile"
              className="mt-5 inline-block rounded-xl bg-pink-600 px-5 py-3 font-semibold text-white"
            >
              Customer Login
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <Navbar />
      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="rounded-2xl bg-white p-6 shadow">
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-pink-100 text-3xl font-bold text-pink-700">
                {user?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  user?.name?.charAt(0).toUpperCase() || "C"
                )}
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-bold text-slate-900">
                  {user?.name}
                </h1>
                <p className="truncate text-sm text-slate-500">{user?.email}</p>
                <span className="mt-2 inline-block rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700">
                  {user?.emailVerified ? "Verified" : "Email not verified"}
                </span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Orders</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {user?._count?.orders || 0}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Wishlist</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {user?._count?.wishlist || 0}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-2">
              <Link
                href="/orders"
                className="rounded-xl bg-pink-600 px-4 py-3 text-center font-semibold text-white"
              >
                My Orders
              </Link>
              <Link
                href="/wishlist"
                className="rounded-xl bg-slate-100 px-4 py-3 text-center font-semibold text-slate-900"
              >
                Wishlist
              </Link>
              <button
                type="button"
                onClick={logout}
                className="rounded-xl bg-red-50 px-4 py-3 font-semibold text-red-700"
              >
                Logout
              </button>
            </div>
          </aside>

          <div className="space-y-6">
            <section className="rounded-2xl bg-white p-6 shadow">
              <div className="border-b pb-4">
                <h2 className="text-2xl font-bold text-slate-900">Profile Details</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Manage your customer account information.
                </p>
              </div>

              <form onSubmit={saveProfile} className="mt-6 grid gap-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Full Name
                  </label>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-pink-500"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Email
                  </label>
                  <input
                    value={user?.email || ""}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-500"
                    disabled
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Avatar Image URL
                  </label>
                  <input
                    value={avatarUrl}
                    onChange={(event) => setAvatarUrl(event.target.value)}
                    placeholder="https://..."
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-pink-500"
                  />
                </div>

                {message && (
                  <p className="rounded-xl bg-green-50 p-3 text-sm text-green-700">
                    {message}
                  </p>
                )}
                {error && (
                  <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={saving}
                  className="w-fit rounded-xl bg-pink-600 px-6 py-3 font-semibold text-white disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save Profile"}
                </button>
              </form>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow">
              <h2 className="text-2xl font-bold text-slate-900">Account Shortcuts</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <Link href="/products" className="rounded-xl bg-slate-50 p-4 font-semibold">
                  Browse Products
                </Link>
                <Link href="/cart" className="rounded-xl bg-slate-50 p-4 font-semibold">
                  Cart
                </Link>
                <Link href="/forgot-password" className="rounded-xl bg-slate-50 p-4 font-semibold">
                  Reset Password
                </Link>
              </div>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
