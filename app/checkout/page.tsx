'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/store/cart-store';
import Navbar from '@/components/navbar/Navbar';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

declare global {
  interface Window {
    Razorpay?: any;
  }
}

function loadRazorpayScript() {
  return new Promise<boolean>((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }

    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function CheckoutPage() {
  const router = useRouter();
  const { items, getTotalPrice, clearCart } = useCartStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    address: '',
    city: '',
    state: '',
    zipCode: '',
    phone: '',
    paymentMethod: 'RAZORPAY',
  });

  useEffect(() => {
    if (items.length === 0) {
      router.push('/cart');
    }
  }, [items, router]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleRazorpayPayment = async (payload: any) => {
    const scriptLoaded = await loadRazorpayScript();
    if (!scriptLoaded) {
      setError('Unable to load Razorpay checkout. Please try again.');
      return;
    }

    const options = {
      key: payload.razorpayKeyId,
      amount: payload.amount,
      currency: payload.currency,
      order_id: payload.razorpayOrderId,
      name: 'ZYLO-Buylo',
      description: 'Order payment',
      handler: async function (response: any) {
        if (!response.razorpay_payment_id) {
          setError('Payment could not be completed.');
          return;
        }

        const confirmResponse = await fetch('/api/orders/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: payload.orderId,
            paymentMethod: 'RAZORPAY',
            razorpayPaymentId: response.razorpay_payment_id,
            razorpayOrderId: response.razorpay_order_id,
            razorpaySignature: response.razorpay_signature,
          }),
        });

        const confirmData = await confirmResponse.json();
        if (!confirmResponse.ok) {
          setError(confirmData.error || 'Payment verification failed');
          return;
        }

        clearCart();
        router.push(`/order/${payload.orderId}`);
      },
      prefill: {
        name: '',
        email: '',
        contact: formData.phone,
      },
      theme: {
        color: '#ec4899',
      },
    };

    const razorpay = new window.Razorpay(options);
    razorpay.open();
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          zipCode: formData.zipCode,
          phone: formData.phone,
          paymentMethod: formData.paymentMethod,
          totalAmount: getTotalPrice(),
        }),
      });

      const data = await response.json();
      setLoading(false);

      if (!response.ok) {
        setError(data.error || 'Failed to create order');
        return;
      }

      if (data.paymentMethod === 'RAZORPAY' && data.razorpayOrderId) {
        await handleRazorpayPayment(data);
      } else if (data.paymentMethod === 'STRIPE' && data.paymentUrl) {
        clearCart();
        window.location.href = data.paymentUrl;
      } else {
        clearCart();
        router.push(`/order/${data.orderId}`);
      }
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="rounded-3xl bg-white p-8 shadow-xl">
              <h1 className="text-3xl font-semibold text-slate-900">Checkout</h1>
              <p className="mt-2 text-sm text-slate-600">Complete your purchase</p>

              <form onSubmit={handleSubmit} className="mt-8 space-y-6">
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-slate-900">Shipping Address</h2>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Address</label>
                    <textarea
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      rows={3}
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-500"
                      placeholder="Enter your full address"
                      required
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">City</label>
                      <Input name="city" value={formData.city} onChange={handleChange} placeholder="City" required />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">State</label>
                      <Input name="state" value={formData.state} onChange={handleChange} placeholder="State" required />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">ZIP Code</label>
                      <Input name="zipCode" value={formData.zipCode} onChange={handleChange} placeholder="PIN" required />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Phone Number</label>
                    <Input name="phone" value={formData.phone} onChange={handleChange} placeholder="+91 9876543210" required />
                  </div>
                </div>

                <div className="space-y-4 border-t border-gray-200 pt-6">
                  <h2 className="text-lg font-semibold text-slate-900">Payment Method</h2>

                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="RAZORPAY"
                        checked={formData.paymentMethod === 'RAZORPAY'}
                        onChange={handleChange}
                        className="h-4 w-4"
                      />
                      <span className="text-slate-900">Razorpay (Recommended)</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="STRIPE"
                        checked={formData.paymentMethod === 'STRIPE'}
                        onChange={handleChange}
                        className="h-4 w-4"
                      />
                      <span className="text-slate-900">Stripe</span>
                    </label>
                  </div>
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Processing...' : `Pay ₹${getTotalPrice().toFixed(2)}`}
                </Button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-6 rounded-3xl bg-white p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-slate-900">Order Summary</h2>

              <div className="mt-6 space-y-4 border-b border-gray-200 pb-6">
                {items.map((item) => (
                  <div key={item.id} className="flex justify-between">
                    <div>
                      <p className="font-medium text-slate-900">{item.name}</p>
                      <p className="text-sm text-slate-600">Qty: {item.quantity}</p>
                    </div>
                    <p className="font-semibold text-slate-900">₹{(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 space-y-3">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span>₹{getTotalPrice().toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Shipping</span>
                  <span className="text-green-600">Free</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Tax</span>
                  <span>Calculated at checkout</span>
                </div>
              </div>

              <div className="mt-6 border-t border-gray-200 pt-4">
                <div className="flex justify-between text-lg font-bold text-slate-900">
                  <span>Total</span>
                  <span className="text-pink-600">₹{getTotalPrice().toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
