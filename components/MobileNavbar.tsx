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
    <div className="fixed bottom-0 left-0 z-50 w-full border-t bg-white shadow-lg md:hidden">
      <div className="grid grid-cols-5">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex min-h-[72px] flex-col items-center justify-center gap-1 py-2 text-xs transition ${
              pathname === item.href
                ? "font-bold text-pink-600"
                : "text-gray-500"
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
