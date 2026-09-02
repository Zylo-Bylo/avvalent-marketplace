"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
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

const utilityLinks = [
  { label: "Products", href: "/products" },
  { label: "Top Deals", href: "/products?offer=true" },
  { label: "Contact", href: "/profile" },
  { label: "Best Seller", href: "/products?sort=popular" },
  { label: "Free Gift", href: "/products?offer=true" },
  { label: "Bulk Purchase", href: "/products?bulk=true" },
  { label: "Sell on Zylo-Buylo", href: "/vendor/register" },
  { label: "Track Order", href: "/orders" },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const cartCount = useCartStore((state) => state.getTotalItems());
  const clearCart = useCartStore((state) => state.clearCart);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [categories, setCategories] = useState<PublicCategoryNode[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");

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

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = search.trim();
    router.push(query ? `/products?search=${encodeURIComponent(query)}` : "/products");
  }

  async function handleLogout() {
    clearCart();
    setUser(null);
    setMenuOpen(false);
    window.dispatchEvent(new Event("zylo-auth-change"));
    window.location.href = "/api/auth/logout?next=/login";
  }

  return (
    <header className="sticky top-0 z-50 w-full max-w-full border-b border-[#e7dcc8] bg-[#fffdf8]/98 shadow-[0_8px_20px_rgba(42,35,25,0.045)] backdrop-blur">
      {showCategoryBar && (
        <div className="border-b border-[#eee5d6] bg-[#241f18] text-[#f8ead0]">
          <div className="mx-auto flex max-w-[1440px] min-w-0 items-center justify-between gap-3 px-3 py-1.5 text-[11px] sm:px-6 lg:px-8">
            <span className="hidden md:inline">Premium multivendor marketplace</span>
            <div className="zylo-home-scroll-row flex min-w-0 max-w-full gap-4 overflow-x-auto overscroll-x-contain md:w-auto md:justify-end md:overflow-visible">
              {utilityLinks.map((item) => (
                <Link key={item.href} href={item.href} className="shrink-0 hover:text-white">
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto flex max-w-[1440px] min-w-0 items-center gap-2 px-3 py-2.5 sm:px-6 md:gap-4 lg:px-8">
        <Link
          href="/"
          className="flex min-w-0 shrink-0 items-center"
          aria-label="Zylo-Buylo - Buy Smart, Sell Easy"
        >
          <ZyloBrandLogo />
        </Link>

        {showCategoryBar && (
          <form
            onSubmit={submitSearch}
            className="hidden h-10 min-w-0 flex-1 items-center rounded-sm border border-[#d8cbb8] bg-white px-2.5 md:flex lg:h-11 lg:px-3"
          >
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search products, categories and brands"
              className="h-full min-w-0 flex-1 bg-transparent text-sm text-[#241f18] outline-none placeholder:text-[#9a9288]"
              aria-label="Search products, categories and brands"
            />
            <button
              type="submit"
              className="rounded-sm bg-[#241f18] px-3 py-2 text-xs font-medium uppercase tracking-[0.08em] text-[#fffaf1] hover:bg-[#111]"
            >
              Search
            </button>
          </form>
        )}

        <div className="ml-auto flex min-w-0 items-center justify-end gap-2 md:gap-3">
          {user ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                className="flex h-10 items-center gap-2 rounded-sm border border-[#d9c7a6] bg-[#fffaf1] px-3 text-sm font-medium text-[#5f4a28] hover:border-[#b58b3b] hover:bg-white"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
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
                    type="button"
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
                className="hidden h-10 items-center rounded-sm border border-[#d9c7a6] bg-white px-3 text-sm font-medium text-[#241f18] hover:bg-[#fffaf1] md:inline-flex"
              >
                Customer Login
              </Link>

              <Link
                href="/login?role=vendor&next=/vendor/dashboard"
                className="hidden h-10 items-center rounded-sm border border-[#b58b3b] bg-white px-3 text-sm font-medium text-[#5f4a28] hover:bg-[#fffaf1] lg:inline-flex"
              >
                Vendor Login
              </Link>

              <Link
                href="/login"
                className="inline-flex h-10 items-center rounded-sm border border-[#b58b3b] bg-[#fff4dc] px-3 text-sm font-medium text-[#5f4a28] hover:bg-[#f6e7bb]"
              >
                Login / Signup
              </Link>
            </>
          )}

          <Link
            href="/wishlist"
            className="hidden h-10 items-center gap-1.5 rounded-sm border border-[#e1d4c0] bg-white px-3 text-sm font-medium text-[#241f18] hover:border-[#b58b3b] hover:bg-[#fffaf1] md:inline-flex"
          >
            <span className="text-base leading-none text-[#b58b3b]" aria-hidden="true">
              ♡
            </span>
            <span>Wishlist</span>
          </Link>

          <Link
            href="/cart"
            className="flex h-10 items-center gap-2 rounded-sm border border-[#e1d4c0] bg-white px-3 text-sm font-medium text-[#241f18] hover:border-[#b58b3b] hover:bg-[#fffaf1]"
          >
            <span>Cart</span>
            <span>{visibleCartCount}</span>
          </Link>
        </div>
      </div>
      {showCategoryBar && (
        <form
          onSubmit={submitSearch}
          className="mx-auto flex h-10 max-w-[1440px] items-center border-t border-[#eee5d6] bg-[#fffdf8] px-3 py-1.5 md:hidden"
        >
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search Zylo-Buylo"
            className="h-full min-w-0 flex-1 rounded-sm border border-[#d8cbb8] bg-white px-3 text-sm outline-none placeholder:text-[#9a9288]"
            aria-label="Search products, categories and brands"
          />
          <button
            type="submit"
            className="ml-2 h-full rounded-sm bg-[#241f18] px-3 text-[11px] font-medium uppercase tracking-[0.08em] text-[#fffaf1]"
          >
            Search
          </button>
        </form>
      )}
      {showCategoryBar && categories.length > 0 && (
        <nav className="border-t border-[#eee5d6] bg-[#fffaf1]/98" aria-label="Category navigation">
          <div className="zylo-home-scroll-row mx-auto flex w-full max-w-[1440px] min-w-0 gap-2 overflow-x-auto overscroll-x-contain px-3 py-2 sm:px-6 lg:px-8">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={getCategoryHref(category)}
                className="shrink-0 rounded-sm px-3 py-1.5 text-xs font-medium text-[#4f463b] transition hover:bg-white hover:text-[#8a6a30] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b58b3b] md:text-sm"
              >
                {category.name}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
