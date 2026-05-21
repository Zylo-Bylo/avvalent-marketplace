'use client';

import { useEffect, useState } from 'react';
import Navbar from '@/components/navbar/Navbar';
import { useParams, useSearchParams } from 'next/navigation';

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
  paymentMethod: string;
  paymentId?: string | null;
  createdAt: string;
  items: OrderItem[];
}

export default function OrderPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const orderId = params.id as string;
  const sessionId = searchParams.get('session_id');
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchOrder = async () => {
    try {
      const response = await fetch(`/api/orders/${orderId}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to fetch order');
        return null;
      }

      setOrder(data.order);
      return data.order as Order;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    }
  };

  const confirmStripePayment = async () => {
    if (!sessionId) {
      return;
    }

    try {
      const response = await fetch('/api/orders/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          paymentMethod: 'STRIPE',
          sessionId,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Could not confirm Stripe payment');
        return;
      }

      setOrder(data.order);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  useEffect(() => {
    const initialize = async () => {
      const loadedOrder = await fetchOrder();
      if (loadedOrder?.status === 'PENDING' && sessionId) {
        await confirmStripePayment();
      }
      setLoading(false);
    };

    if (orderId) {
      initialize();
    }
  }, [orderId, sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
          <div className="text-center text-slate-600">Loading order details...</div>
        </main>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
          <div className="rounded-3xl bg-white p-8 shadow-xl text-center">
            <p className="text-red-600">{error || 'Order not found'}</p>
          </div>
        </main>
      </div>
    );
  }

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
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div className="rounded-3xl bg-white p-8 shadow-xl">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-slate-900">Order #{order.id}</h1>
              <p className="mt-1 text-sm text-slate-600">{new Date(order.createdAt).toLocaleDateString()}</p>
            </div>
            <span className={`rounded-full px-4 py-2 text-sm font-semibold ${getStatusColor(order.status)}`}>
              {order.status}
            </span>
          </div>

          <div className="mb-8 grid gap-6 md:grid-cols-3">
            <div className="rounded-xl border border-gray-200 p-4">
              <p className="text-sm font-medium text-slate-600">Order Total</p>
              <p className="mt-2 text-3xl font-bold text-pink-600">₹{order.totalAmount.toFixed(2)}</p>
            </div>
            <div className="rounded-xl border border-gray-200 p-4">
              <p className="text-sm font-medium text-slate-600">Payment Method</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{order.paymentMethod}</p>
            </div>
            <div className="rounded-xl border border-gray-200 p-4">
              <p className="text-sm font-medium text-slate-600">Transaction ID</p>
              <p className="mt-2 text-sm text-slate-900">{order.paymentId ?? 'Pending'}</p>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200">
            <div className="border-b border-gray-200 bg-slate-50 px-6 py-4">
              <h2 className="font-semibold text-slate-900">Order Items</h2>
            </div>
            <div className="divide-y divide-gray-200">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between px-6 py-4">
                  <div>
                    <p className="font-medium text-slate-900">Product ID: {item.productId}</p>
                    <p className="text-sm text-slate-600">Quantity: {item.quantity}</p>
                  </div>
                  <p className="font-semibold text-slate-900">₹{(item.price * item.quantity).toFixed(2)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 text-center">
            <p className="text-sm text-slate-600">
              {order.status === 'PENDING' && 'Your order is awaiting payment. Please complete the payment to proceed.'}
              {order.status === 'PAID' && 'Payment received. Your order will be shipped soon.'}
              {order.status === 'SHIPPED' && 'Your order is on its way!'}
              {order.status === 'DELIVERED' && 'Your order has been delivered. Thank you!'}
              {order.status === 'CANCELLED' && 'This order has been cancelled.'}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
