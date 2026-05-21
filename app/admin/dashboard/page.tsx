'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/navbar/Navbar';

interface DashboardStats {
  totalUsers: number;
  totalVendors: number;
  totalProducts: number;
  totalOrders: number;
  totalRevenue: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/admin/stats');
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Failed to fetch stats');
          return;
        }

        setStats(data.stats);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="text-center text-slate-600">Loading admin dashboard...</div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="rounded-3xl bg-white p-8 shadow-xl text-center">
            <p className="text-red-600">{error}</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="rounded-3xl bg-white p-8 shadow-xl">
          <h1 className="text-3xl font-semibold text-slate-900">Admin Dashboard</h1>
          <p className="mt-2 text-sm text-slate-600">Marketplace overview and management</p>

          {stats && (
            <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-blue-50 to-blue-100 p-6">
                <p className="text-sm font-medium text-slate-600">Total Users</p>
                <p className="mt-2 text-3xl font-bold text-blue-600">{stats.totalUsers}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-green-50 to-green-100 p-6">
                <p className="text-sm font-medium text-slate-600">Total Vendors</p>
                <p className="mt-2 text-3xl font-bold text-green-600">{stats.totalVendors}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-purple-50 to-purple-100 p-6">
                <p className="text-sm font-medium text-slate-600">Total Products</p>
                <p className="mt-2 text-3xl font-bold text-purple-600">{stats.totalProducts}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-orange-50 to-orange-100 p-6">
                <p className="text-sm font-medium text-slate-600">Total Orders</p>
                <p className="mt-2 text-3xl font-bold text-orange-600">{stats.totalOrders}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-pink-50 to-pink-100 p-6">
                <p className="text-sm font-medium text-slate-600">Total Revenue</p>
                <p className="mt-2 text-2xl font-bold text-pink-600">₹{stats.totalRevenue.toFixed(0)}</p>
              </div>
            </div>
          )}

          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900">Quick Actions</h2>
              <div className="mt-4 space-y-2">
                <button className="block w-full rounded-lg bg-slate-100 px-4 py-2 text-left text-sm font-medium text-slate-900 hover:bg-slate-200">
                  Manage Users
                </button>
                <button className="block w-full rounded-lg bg-slate-100 px-4 py-2 text-left text-sm font-medium text-slate-900 hover:bg-slate-200">
                  Manage Vendors
                </button>
                <button className="block w-full rounded-lg bg-slate-100 px-4 py-2 text-left text-sm font-medium text-slate-900 hover:bg-slate-200">
                  Review Orders
                </button>
                <Link
                  href="/admin/categories"
                  className="block w-full rounded-lg bg-slate-100 px-4 py-2 text-left text-sm font-medium text-slate-900 hover:bg-slate-200"
                >
                  Manage Categories
                </Link>
                <Link
                  href="/admin/products"
                  className="block w-full rounded-lg bg-slate-100 px-4 py-2 text-left text-sm font-medium text-slate-900 hover:bg-slate-200"
                >
                  Manage Products
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900">Recent Activity</h2>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <p>• New vendor registered</p>
                <p>• Product uploaded</p>
                <p>• Order completed</p>
                <p>• Payment received</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
