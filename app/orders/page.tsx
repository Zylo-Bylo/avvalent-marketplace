'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/navbar/Navbar';

interface OrderItem {
  id: string;
  productId: string;
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  totalAmount: number;
  status: string;
  createdAt: string;
  items: OrderItem[];
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await fetch('/api/customer/orders');
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Failed to fetch orders');
          return;
        }

        setOrders(data.orders);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      PAID: 'bg-blue-100 text-blue-800',
      SHIPPED: 'bg-purple-100 text-purple-800',
      DELIVERED: 'bg-green-100 text-green-800',
      CANCELLED: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="rounded-3xl bg-white p-8 shadow-xl">
          <h1 className="text-3xl font-semibold text-slate-900">My Orders</h1>
          <p className="mt-2 text-sm text-slate-600">View and manage all your orders</p>

          {loading ? (
            <div className="mt-8 text-center text-slate-600">Loading orders...</div>
          ) : error ? (
            <div className="mt-8 text-center text-red-600">{error}</div>
          ) : orders.length === 0 ? (
            <div className="mt-8 text-center">
              <p className="mb-4 text-slate-600">You haven't placed any orders yet</p>
              <Link href="/products" className="inline-block rounded-full bg-pink-600 px-5 py-2 text-sm font-medium text-white hover:bg-pink-700">
                Start Shopping
              </Link>
            </div>
          ) : (
            <div className="mt-8 space-y-4">
              {orders.map((order) => (
                <Link key={order.id} href={`/order/${order.id}`}>
                  <div className="rounded-2xl border border-gray-200 p-4 hover:shadow-lg transition-shadow cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900">Order #{order.id}</p>
                        <p className="text-sm text-slate-600">{new Date(order.createdAt).toLocaleDateString()}</p>
                        <p className="mt-1 text-sm text-slate-600">{order.items.length} item{order.items.length !== 1 ? 's' : ''}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-pink-600">₹{order.totalAmount.toFixed(2)}</p>
                        <span className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-semibold ${getStatusColor(order.status)}`}>
                          {order.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
