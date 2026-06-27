"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/navbar/Navbar";

interface DashboardStats {
  totalUsers: number;
  totalVendors: number;
  pendingVendors: number;
  approvedVendors: number;
  rejectedVendors: number;
  inactiveVendors: number;
  pendingKyc: number;
  totalProducts: number;
  totalOrders: number;
  totalRevenue: number;
}

const quickCards = [
  {
    title: "Vendors",
    description: "Approve vendors and review KYC details.",
    href: "/admin/vendors",
    button: "View Vendors",
  },
  {
    title: "Vendor Dashboard",
    description: "Open the vendor workspace to check product upload and order flow.",
    href: "/vendor/dashboard",
    button: "Open Dashboard",
  },
  {
    title: "Products",
    description: "Check product listings, prices, stock and categories.",
    href: "/admin/products",
    button: "View Products",
  },
  {
    title: "Homepage Content",
    description: "Change hero slides, offer banners, discount text and brand buttons.",
    href: "/admin/homepage",
    button: "Manage Homepage",
  },
  {
    title: "Orders",
    description: "Review payments, shipping, delivery and cancellations.",
    href: "/admin/orders",
    button: "Manage Orders",
  },
  {
    title: "Payment Settings",
    description: "Check Razorpay, Stripe, UPI readiness and webhook URLs.",
    href: "/admin/payments",
    button: "View Payments",
  },
  {
    title: "Vendor Payouts",
    description: "Track payable balance, commission and settlement references.",
    href: "/admin/payouts",
    button: "View Payouts",
  },
  {
    title: "Inventory",
    description: "Monitor stock, reserved units, low stock alerts and restock needs.",
    href: "/admin/inventory",
    button: "Manage Stock",
  },
  {
    title: "Returns & Refunds",
    description: "Approve return requests, reject cases and record refund references.",
    href: "/admin/refunds",
    button: "Manage Refunds",
  },
  {
    title: "Order Security",
    description: "Review dispatch proofs, OTP, open-box checks and return risk.",
    href: "/admin/security",
    button: "Open Security Center",
  },
  {
    title: "Category Management",
    description: "Create categories and subcategories used by vendors.",
    href: "/admin/categories",
    button: "Manage Categories",
  },
  {
    title: "Business Profile",
    description: "Complete legal documents, support contacts and real bank details.",
    href: "/admin/profile",
    button: "Complete Profile",
  },
  {
    title: "Policy Center",
    description: "Review terms, COD, returns and vendor agreement versions.",
    href: "/admin/policies",
    button: "Open Policies",
  },
];

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch("/api/admin/stats", { cache: "no-store" });
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Failed to fetch stats");
          return;
        }

        setStats(data.stats);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  return (
    <main className="min-h-screen bg-[#f7f2ea] text-stone-950">
      <Navbar />

      <section className="border-b border-stone-200 bg-[#17130f] text-[#f8efe2]">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#d6b36a]">
            Admin
          </p>
          <h1 className="mt-3 text-4xl font-bold">Admin Dashboard</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#d8c8af]">
            Manage vendors, products and marketplace health from one clean panel.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8">
        {loading ? (
          <p className="bg-white py-12 text-center text-stone-500 shadow">
            Loading admin dashboard...
          </p>
        ) : error ? (
          <p className="border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </p>
        ) : (
          <>
            {stats && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <div className="bg-white p-5 shadow">
                  <p className="text-sm font-semibold text-stone-500">Vendors</p>
                  <p className="mt-2 text-3xl font-bold text-[#315c48]">
                    {stats.totalVendors}
                  </p>
                </div>
                <div className="bg-white p-5 shadow">
                  <p className="text-sm font-semibold text-stone-500">
                    Pending Approval
                  </p>
                  <p className="mt-2 text-3xl font-bold text-[#9c7a34]">
                    {stats.pendingVendors}
                  </p>
                </div>
                <div className="bg-white p-5 shadow">
                  <p className="text-sm font-semibold text-stone-500">Products</p>
                  <p className="mt-2 text-3xl font-bold text-[#6b145d]">
                    {stats.totalProducts}
                  </p>
                </div>
                <div className="bg-white p-5 shadow">
                  <p className="text-sm font-semibold text-stone-500">Orders</p>
                  <p className="mt-2 text-3xl font-bold text-[#9b4d48]">
                    {stats.totalOrders}
                  </p>
                </div>
                <div className="bg-white p-5 shadow">
                  <p className="text-sm font-semibold text-stone-500">Revenue</p>
                  <p className="mt-2 text-2xl font-bold text-[#17130f]">
                    Rs. {stats.totalRevenue.toFixed(0)}
                  </p>
                </div>
              </div>
            )}

            <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {quickCards.map((card) => (
                <Link
                  key={card.href}
                  href={card.href}
                  className="bg-white p-6 shadow transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <h2 className="text-2xl font-bold">{card.title}</h2>
                  <p className="mt-2 text-sm text-stone-600">
                    {card.description}
                  </p>
                  <span className="mt-5 inline-block bg-[#6b145d] px-5 py-3 text-sm font-semibold text-white">
                    {card.button}
                  </span>
                </Link>
              ))}
            </div>

            <div className="mt-8 bg-white p-6 shadow">
              <h2 className="text-xl font-bold">Quick Status</h2>
              <div className="mt-4 grid gap-3 text-sm text-stone-700 sm:grid-cols-2 lg:grid-cols-4">
                <p>Approved vendors: {stats?.approvedVendors || 0}</p>
                <p>KYC pending: {stats?.pendingKyc || 0}</p>
                <p>Rejected vendors: {stats?.rejectedVendors || 0}</p>
                <p>Inactive vendors: {stats?.inactiveVendors || 0}</p>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
