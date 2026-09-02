"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { name: "Home", href: "/", icon: "⌂" },
  { name: "Products", href: "/products", icon: "□" },
  { name: "Wishlist", href: "/wishlist", icon: "♡" },
  { name: "Cart", href: "/cart", icon: "▱" },
  { name: "Profile", href: "/profile", icon: "○" },
];

export default function MobileNavbar() {
  const pathname = usePathname();

  return (
    <div className="fixed bottom-0 left-0 z-50 w-full border-t border-[#e7dcc8] bg-[#fffdf8] shadow-[0_-8px_22px_rgba(42,35,25,0.08)] md:hidden">
      <div className="grid grid-cols-5">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex min-h-[72px] flex-col items-center justify-center gap-1 py-2 text-xs transition ${
              pathname === item.href
                ? "font-semibold text-[#8a6a30]"
                : "text-[#756a5e]"
            }`}
          >
            <span className="text-2xl leading-none">{item.icon}</span>
            <span>{item.name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
