'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/navbar/Navbar';

type OrderItem = {
  id: string;
  quantity: number;
  price: number;
  product?: {
    id: string;
    name: string;
    images?: string[] | null;
  } | null;
};

type Order = {
  id: string;
  totalAmount: number;
  status: string;
  paymentMethod: string;
  shippingCity?: string | null;
  shippingState?: string | null;
  trackingNumber?: string | null;
  carrier?: string | null;
  createdAt: string;
  vendor?: {
    storeName: string;
  } | null;
  items: OrderItem[];
};

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PAID: 'bg-blue-100 text-blue-800',
  SHIPPED: 'bg-purple-100 text-purple-800',
  DELIVERED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
  RETURNED: 'bg-gray-200 text-gray-800',
};

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await fetch('/api/customer/orders', {
          credentials: 'include',
        });
        const data = await response.json();

        if (response.status === 401) {
          router.push('/login?role=customer&next=/orders');
          return;
        }

        if (!response.ok) {
          setError(data.error || 'Failed to fetch orders');
          return;
        }

        setOrders(data.orders || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="rounded-3xl bg-white p-6 shadow-xl md:p-8">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <h1 className="text-3xl font-semibold text-slate-900">My Orders</h1>
              <p className="mt-2 text-sm text-slate-600">
                Track payment, shipping and delivery status.
              </p>
            </div>
            <Link
              href="/products"
              className="rounded-full bg-pink-600 px-5 py-2 text-sm font-semibold text-white hover:bg-pink-700"
            >
              Continue Shopping
            </Link>
          </div>

          {loading ? (
            <div className="mt-8 text-center text-slate-600">Loading orders...</div>
          ) : error ? (
            <div className="mt-8 rounded-2xl bg-red-50 p-5 text-center text-red-700">
              {error}
            </div>
          ) : orders.length === 0 ? (
            <div className="mt-8 text-center">
              <p className="mb-4 text-slate-600">You have not placed any orders yet.</p>
              <Link
                href="/products"
                className="inline-block rounded-full bg-pink-600 px-5 py-2 text-sm font-medium text-white hover:bg-pink-700"
              >
                Start Shopping
              </Link>
            </div>
          ) : (
            <div className="mt-8 space-y-4">
              {orders.map((order) => {
                const firstItem = order.items[0];

                return (
                  <Link key={order.id} href={`/order/${order.id}`} className="block">
                    <article className="rounded-2xl border border-gray-200 p-4 transition hover:shadow-lg">
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-4">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={
                              firstItem?.product?.images?.[0] ||
                              'https://placehold.co/96x96/png?text=Order'
                            }
                            alt={firstItem?.product?.name || 'Order'}
                            className="h-20 w-20 rounded-xl bg-slate-100 object-cover"
                          />
                          <div>
                            <p className="font-semibold text-slate-900">
                              Order #{order.id.slice(-8)}
                            </p>
                            <p className="mt-1 text-sm text-slate-600">
                              {order.vendor?.storeName || 'Marketplace vendor'}
                            </p>
                            <p className="mt-1 text-sm text-slate-600">
                              {order.items.length} item{order.items.length !== 1 ? 's' : ''} /{' '}
                              {new Date(order.createdAt).toLocaleDateString()}
                            </p>
                            {order.trackingNumber && (
                              <p className="mt-1 text-sm font-semibold text-purple-700">
                                {order.carrier || 'Tracking'}: {order.trackingNumber}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="text-left md:text-right">
                          <p className="font-bold text-pink-600">
                            Rs. {Number(order.totalAmount || 0).toFixed(2)}
                          </p>
                          <span
                            className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                              statusColors[order.status] || 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {order.status}
                          </span>
                          <p className="mt-2 text-xs text-slate-500">
                            {order.paymentMethod} / {order.shippingCity || 'Delivery address'}
                          </p>
                        </div>
                      </div>
                    </article>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
