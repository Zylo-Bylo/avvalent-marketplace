"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import ZyloBrandLogo from "@/components/brand/ZyloBrandLogo";
import {
  getCategoryHref,
  normalizePublicCategoryTree,
  type PublicCategoryNode,
} from "@/lib/public-category-navigation";
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
  const [categories, setCategories] = useState<PublicCategoryNode[]>([]);
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

  const isManagementPath =
    pathname?.startsWith("/admin") ||
    pathname?.startsWith("/vendor/dashboard") ||
    pathname?.startsWith("/vendor/approval-pending");
  const showCategoryBar = !isManagementPath;

  useEffect(() => {
    if (!showCategoryBar) {
      setCategories([]);
      return;
    }

    let isActive = true;

    async function loadCategories() {
      try {
        const response = await fetch("/api/categories", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        const normalized = normalizePublicCategoryTree(data);

        if (isActive) {
          setCategories(normalized.slice(0, 12));
        }
      } catch {
        if (isActive) {
          setCategories([]);
        }
      }
    }

    loadCategories();

    return () => {
      isActive = false;
    };
  }, [showCategoryBar]);

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
    <nav className="sticky top-0 z-40 w-full max-w-full overflow-x-clip border-b border-[#e7dcc8] bg-[#fffdf8]/95 shadow-[0_8px_24px_rgba(42,35,25,0.07)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl min-w-0 items-center justify-between gap-3 px-3 py-3 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex min-w-0 shrink-0 items-center"
          aria-label="Zylo-Buylo - Buy Smart, Sell Easy"
        >
          <ZyloBrandLogo />
        </Link>

        <div className="hidden min-w-0 flex-1 items-center justify-center gap-5 text-sm text-[#4f463b] md:flex">
          <Link href="/products" className="hover:text-[#8a6a30]">
            Products
          </Link>

          <Link
            href="/wishlist"
            className="inline-flex items-center gap-1.5 font-semibold text-[#241f18] hover:text-[#8a6a30]"
          >
            <span className="text-base leading-none text-[#b58b3b]" aria-hidden="true">
              ♡
            </span>
            <span>Wishlist</span>
          </Link>

          {isAdmin ? (
            <Link href="/admin/dashboard" className="hover:text-[#8a6a30]">
              Admin Dashboard
            </Link>
          ) : isVendor ? (
            <Link href="/vendor/dashboard" className="hover:text-[#8a6a30]">
              Vendor Dashboard
            </Link>
          ) : (
            <Link href="/vendor/register" className="hover:text-[#8a6a30]">
              Become a Vendor
            </Link>
          )}
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen((open) => !open)}
                className="flex items-center gap-2 rounded-full border border-[#d9c7a6] bg-[#fffaf1] px-4 py-2 text-sm font-medium text-[#5f4a28] hover:border-[#b58b3b] hover:bg-white"
              >
                <span className="max-w-32 truncate">{displayName}</span>
                <span className="text-xs">v</span>
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 overflow-hidden rounded-md border border-[#e7dcc8] bg-[#fffdf8] shadow-[0_18px_45px_rgba(42,35,25,0.16)]">
                  <div className="border-b border-[#eee5d6] px-4 py-3">
                    <p className="font-semibold text-[#241f18]">
                      {displayName}
                    </p>
                    <p className="text-xs text-[#756a5e]">{user.email}</p>
                  </div>

                  {isAdmin ? (
                    <>
                      <Link
                        href="/admin/dashboard"
                        className="block bg-[#fff4dc] px-4 py-3 text-sm font-semibold text-[#5f4a28] hover:bg-[#f6e7bb]"
                        onClick={() => setMenuOpen(false)}
                      >
                        Open Admin Dashboard
                      </Link>

                      <Link
                        href="/admin/vendors"
                        className="block px-4 py-2 text-sm hover:bg-[#f8f4ec]"
                        onClick={() => setMenuOpen(false)}
                      >
                        Vendor Approvals
                      </Link>

                      <Link
                        href="/admin/products"
                        className="block px-4 py-2 text-sm hover:bg-[#f8f4ec]"
                        onClick={() => setMenuOpen(false)}
                      >
                        Product Management
                      </Link>
                    </>
                  ) : isVendor ? (
                    <>
                      <Link
                        href="/vendor/dashboard"
                        className="block bg-[#fff4dc] px-4 py-3 text-sm font-semibold text-[#5f4a28] hover:bg-[#f6e7bb]"
                        onClick={() => setMenuOpen(false)}
                      >
                        Open Vendor Dashboard
                      </Link>

                      {vendorMenuItems.map((item) => (
                        <Link
                          key={item.label}
                          href={item.href}
                          className="block px-4 py-2 text-sm hover:bg-[#f8f4ec]"
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
                        className="block bg-[#fff4dc] px-4 py-3 text-sm font-semibold text-[#5f4a28] hover:bg-[#f6e7bb]"
                        onClick={() => setMenuOpen(false)}
                      >
                        My Profile
                      </Link>

                      <Link
                        href="/orders"
                        className="block px-4 py-2 text-sm hover:bg-[#f8f4ec]"
                        onClick={() => setMenuOpen(false)}
                      >
                        My Orders
                      </Link>

                      <Link
                        href="/wishlist"
                        className="block px-4 py-2 text-sm hover:bg-[#f8f4ec]"
                        onClick={() => setMenuOpen(false)}
                      >
                        Wishlist
                      </Link>

                      <Link
                        href="/vendor/register"
                        className="block px-4 py-2 text-sm hover:bg-[#f8f4ec]"
                        onClick={() => setMenuOpen(false)}
                      >
                        Become a Vendor
                      </Link>
                    </>
                  )}

                  <button
                    onClick={handleLogout}
                    className="block w-full border-t border-[#eee5d6] px-4 py-3 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
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
                className="hidden rounded-full border border-[#d9c7a6] bg-white px-4 py-2 text-sm font-medium text-[#241f18] hover:bg-[#fffaf1] md:inline-block"
              >
                Customer Login
              </Link>

              <Link
                href="/login?role=vendor&next=/vendor/dashboard"
                className="hidden rounded-full border border-[#b58b3b] bg-white px-4 py-2 text-sm font-medium text-[#5f4a28] hover:bg-[#fffaf1] lg:inline-block"
              >
                Vendor Login
              </Link>

              <Link
                href="/login"
                className="rounded-full border border-[#b58b3b] bg-[#fff4dc] px-4 py-2 text-sm font-medium text-[#5f4a28] hover:bg-[#f6e7bb]"
              >
                Login / Signup
              </Link>
            </>
          )}

          <Link
            href="/cart"
            className="flex items-center gap-2 rounded-full border border-[#e1d4c0] bg-white px-4 py-2 text-sm font-medium text-[#241f18] hover:border-[#b58b3b] hover:bg-[#fffaf1]"
          >
            <span>Cart</span>
            <span>{visibleCartCount}</span>
          </Link>
        </div>
      </div>
      {showCategoryBar && categories.length > 0 && (
        <div className="border-t border-[#eee5d6] bg-[#fffaf1]/98">
          <div className="zylo-home-scroll-row mx-auto flex w-full max-w-7xl min-w-0 gap-2 overflow-x-auto overscroll-x-contain px-3 py-2 sm:px-6 lg:px-8">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={getCategoryHref(category)}
                className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium text-[#4f463b] transition hover:bg-white hover:text-[#8a6a30] md:text-sm"
              >
                {category.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
