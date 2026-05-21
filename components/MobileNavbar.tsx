"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function MobileNavbar() {

  const pathname = usePathname();

  const navItems = [
    {
      name: "Home",
      href: "/",
      icon: "🏠",
    },
    {
      name: "Products",
      href: "/products",
      icon: "📦",
    },
    {
      name: "Wishlist",
      href: "/wishlist",
      icon: "❤️",
    },
    {
      name: "Cart",
      href: "/cart",
      icon: "🛒",
    },
    {
      name: "Profile",
      href: "/profile",
      icon: "👤",
    },
  ];

  return (

    <div className="fixed bottom-0 left-0 w-full bg-white border-t shadow-lg md:hidden z-50">

      <div className="grid grid-cols-5">

        {navItems.map((item) => (

          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center py-3 text-sm transition ${
              pathname === item.href
                ? "text-pink-600 font-bold"
                : "text-gray-500"
            }`}
          >

            <span className="text-xl">
              {item.icon}
            </span>

            <span>
              {item.name}
            </span>

          </Link>

        ))}

      </div>

    </div>

  );
}