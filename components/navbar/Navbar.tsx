"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useCartStore } from "@/store/cart-store";

type CurrentUser = {
  id: string;
  email: string;
  name: string;
  role: "CUSTOMER" | "VENDOR" | "ADMIN";
  vendorProfile?: {
    storeName: string;
  } | null;
};

const vendorMenuItems = [
  { label: "My Profile", href: "/vendor/dashboard" },
  { label: "Business Details", href: "/vendor/dashboard" },
  { label: "My Products / Services", href: "/vendor/dashboard" },
  { label: "Orders", href: "/vendor/dashboard" },
  { label: "Payments", href: "/vendor/dashboard" },
  { label: "Reviews", href: "/vendor/dashboard" },
  { label: "Notifications", href: "/vendor/dashboard" },
  { label: "Settings", href: "/vendor/dashboard" },
  { label: "Help & Support", href: "/vendor/dashboard" },
];

export default function Navbar() {
  const pathname = usePathname();
  const cartCount = useCartStore((state) => state.getTotalItems());
  const clearCart = useCartStore((state) => state.clearCart);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let isActive = true;
    setMounted(true);

    async function loadUser() {
      try {
        const response = await fetch("/api/auth/me", {
          cache: "no-store",
          credentials: "include",
        });
        const data = await response.json();

        if (isActive) {
          setUser(data.user || null);
        }
      } catch {
        if (isActive) {
          setUser(null);
        }
      }
    }

    loadUser();
    window.addEventListener("focus", loadUser);
    window.addEventListener("pageshow", loadUser);
    window.addEventListener("zylo-auth-change", loadUser);

    return () => {
      isActive = false;
      window.removeEventListener("focus", loadUser);
      window.removeEventListener("pageshow", loadUser);
      window.removeEventListener("zylo-auth-change", loadUser);
    };
  }, [pathname]);

  const isVendor = user?.role === "VENDOR";
  const isAdmin = user?.role === "ADMIN";
  const displayName =
    user?.vendorProfile?.storeName || user?.name || user?.email || "Account";
  const visibleCartCount = mounted ? cartCount : 0;

  async function handleLogout() {
    clearCart();
    setUser(null);
    setMenuOpen(false);
    window.dispatchEvent(new Event("zylo-auth-change"));
    window.location.href = "/api/auth/logout?next=/login";
  }

  return (
    <nav className="sticky top-0 z-40 border-b border-pink-200 bg-white/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="text-xl font-bold text-pink-600">
          ZYLO-Buylo.com
        </Link>

        <div className="hidden flex-1 items-center justify-center gap-6 text-sm text-slate-700 md:flex">
          <Link href="/products" className="hover:text-pink-600">
            Products
          </Link>

          <Link href="/wishlist" className="hover:text-pink-600">
            Wishlist
          </Link>

          {isAdmin ? (
            <Link href="/admin/dashboard" className="hover:text-pink-600">
              Admin Dashboard
            </Link>
          ) : isVendor ? (
            <Link href="/vendor/dashboard" className="hover:text-pink-600">
              Vendor Dashboard
            </Link>
          ) : (
            <Link href="/vendor/register" className="hover:text-pink-600">
              Become a Vendor
            </Link>
          )}
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen((open) => !open)}
                className="flex items-center gap-2 rounded-full border border-pink-600 bg-pink-50 px-4 py-2 text-sm font-medium text-pink-700 hover:bg-pink-100"
              >
                <span className="max-w-32 truncate">{displayName}</span>
                <span className="text-xs">v</span>
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
                  <div className="border-b px-4 py-3">
                    <p className="font-semibold text-slate-900">
                      {displayName}
                    </p>
                    <p className="text-xs text-slate-500">{user.email}</p>
                  </div>

                  {isAdmin ? (
                    <>
                      <Link
                        href="/admin/dashboard"
                        className="block bg-pink-50 px-4 py-3 text-sm font-semibold text-pink-700 hover:bg-pink-100"
                        onClick={() => setMenuOpen(false)}
                      >
                        Open Admin Dashboard
                      </Link>

                      <Link
                        href="/admin/vendors"
                        className="block px-4 py-2 text-sm hover:bg-slate-100"
                        onClick={() => setMenuOpen(false)}
                      >
                        Vendor Approvals
                      </Link>

                      <Link
                        href="/admin/products"
                        className="block px-4 py-2 text-sm hover:bg-slate-100"
                        onClick={() => setMenuOpen(false)}
                      >
                        Product Management
                      </Link>
                    </>
                  ) : isVendor ? (
                    <>
                      <Link
                        href="/vendor/dashboard"
                        className="block bg-pink-50 px-4 py-3 text-sm font-semibold text-pink-700 hover:bg-pink-100"
                        onClick={() => setMenuOpen(false)}
                      >
                        Open Vendor Dashboard
                      </Link>

                      {vendorMenuItems.map((item) => (
                        <Link
                          key={item.label}
                          href={item.href}
                          className="block px-4 py-2 text-sm hover:bg-slate-100"
                          onClick={() => setMenuOpen(false)}
                        >
                          {item.label}
                        </Link>
                      ))}
                    </>
                  ) : (
                    <>
                      <Link
                        href="/profile"
                        className="block bg-pink-50 px-4 py-3 text-sm font-semibold text-pink-700 hover:bg-pink-100"
                        onClick={() => setMenuOpen(false)}
                      >
                        My Profile
                      </Link>

                      <Link
                        href="/orders"
                        className="block px-4 py-2 text-sm hover:bg-slate-100"
                        onClick={() => setMenuOpen(false)}
                      >
                        My Orders
                      </Link>

                      <Link
                        href="/wishlist"
                        className="block px-4 py-2 text-sm hover:bg-slate-100"
                        onClick={() => setMenuOpen(false)}
                      >
                        Wishlist
                      </Link>

                      <Link
                        href="/vendor/register"
                        className="block px-4 py-2 text-sm hover:bg-slate-100"
                        onClick={() => setMenuOpen(false)}
                      >
                        Become a Vendor
                      </Link>
                    </>
                  )}

                  <button
                    onClick={handleLogout}
                    className="block w-full border-t px-4 py-3 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link
                href="/login?role=customer&next=/profile"
                className="hidden rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 md:inline-block"
              >
                Customer Login
              </Link>

              <Link
                href="/login?role=vendor&next=/vendor/dashboard"
                className="hidden rounded-full border border-pink-600 bg-white px-4 py-2 text-sm font-medium text-pink-700 hover:bg-pink-50 lg:inline-block"
              >
                Vendor Login
              </Link>

              <Link
                href="/login"
                className="rounded-full border border-pink-600 bg-pink-50 px-4 py-2 text-sm font-medium text-pink-700 hover:bg-pink-100"
              >
                Login / Signup
              </Link>
            </>
          )}

          <Link
            href="/cart"
            className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-200"
          >
            <span>Cart</span>
            <span>{visibleCartCount}</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}
