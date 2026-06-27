'use client';

import Link from 'next/link';
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

type PaymentMethod = 'COD' | 'UPI' | 'RAZORPAY' | 'STRIPE';

type PaymentConfig = {
  methods: Record<
    PaymentMethod,
    {
      enabled: boolean;
      label: string;
      description: string;
      upiId?: string | null;
    }
  >;
};

const paymentMethodOrder: PaymentMethod[] = ['COD', 'UPI', 'RAZORPAY', 'STRIPE'];

const fallbackPaymentConfig: PaymentConfig = {
  methods: {
    COD: {
      enabled: true,
      label: 'Cash on Delivery',
      description: 'Pay when the order reaches you.',
    },
    UPI: {
      enabled: false,
      label: 'UPI Transfer',
      description: 'UPI is not configured yet.',
    },
    RAZORPAY: {
      enabled: false,
      label: 'Razorpay',
      description: 'Razorpay is not configured yet.',
    },
    STRIPE: {
      enabled: false,
      label: 'Stripe',
      description: 'Stripe is not configured yet.',
    },
  },
};

export default function CheckoutPage() {
  const router = useRouter();
  const { items, getTotalPrice, clearCart } = useCartStore();
  const deliveryIncluded = items.reduce(
    (sum, item) => sum + (item.shippingCharge || 0) * item.quantity,
    0
  );
  const [loading, setLoading] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [checkoutAuthToken, setCheckoutAuthToken] = useState('');
  const [error, setError] = useState('');
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [paymentConfig, setPaymentConfig] =
    useState<PaymentConfig>(fallbackPaymentConfig);
  const [formData, setFormData] = useState({
    address: '',
    city: '',
    state: '',
    zipCode: '',
    phone: '',
    paymentMethod: 'COD',
    termsAccepted: false,
    codTermsAccepted: false,
  });
  const loginUrl = `/login?role=customer&next=${encodeURIComponent('/checkout')}`;

  useEffect(() => {
    if (!orderPlaced && items.length === 0) {
      router.push('/cart');
    }
  }, [items, orderPlaced, router]);

  useEffect(() => {
    let isActive = true;

    async function checkLogin() {
      try {
        const response = await fetch('/api/auth/me', {
          cache: 'no-store',
          credentials: 'include',
        });
        const data = await response.json();

        if (!isActive) {
          return;
        }

        setCheckoutAuthToken(data.checkoutAuthToken || '');
        setAuthRequired(!response.ok || !data.user);
      } catch {
        if (isActive) {
          setAuthRequired(true);
        }
      } finally {
        if (isActive) {
          setAuthChecking(false);
        }
      }
    }

    checkLogin();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadPaymentConfig() {
      try {
        const response = await fetch('/api/payments/config', { cache: 'no-store' });
        const config = (await response.json()) as PaymentConfig;

        if (!isActive || !config?.methods) {
          return;
        }

        setPaymentConfig(config);
        setFormData((current) => {
          const selectedMethod = current.paymentMethod as PaymentMethod;
          if (config.methods[selectedMethod]?.enabled) {
            return current;
          }

          const firstEnabledMethod =
            paymentMethodOrder.find((method) => config.methods[method]?.enabled) ||
            'COD';

          return {
            ...current,
            paymentMethod: firstEnabledMethod,
          };
        });
      } catch (configError) {
        console.error('Payment config load failed:', configError);
      }
    }

    loadPaymentConfig();

    return () => {
      isActive = false;
    };
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const target = e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    const { name, value } = target;
    if (
      name === 'paymentMethod' &&
      !paymentConfig.methods[value as PaymentMethod]?.enabled
    ) {
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]:
        target instanceof HTMLInputElement && target.type === 'checkbox'
          ? target.checked
          : value,
    }));
  };

  function getSubmitText() {
    if (loading) {
      return 'Processing...';
    }

    if (formData.paymentMethod === 'RAZORPAY') {
      return `Pay with Razorpay Rs. ${getTotalPrice().toFixed(2)}`;
    }

    if (formData.paymentMethod === 'STRIPE') {
      return `Pay with Stripe Rs. ${getTotalPrice().toFixed(2)}`;
    }

    if (formData.paymentMethod === 'UPI') {
      return `Place UPI Order Rs. ${getTotalPrice().toFixed(2)}`;
    }

    return `Place COD Order Rs. ${getTotalPrice().toFixed(2)}`;
  }

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
      name: 'Zylo-Buylo.com',
      description: 'Order payment',
      handler: async function (response: any) {
        setError('');
        if (!response.razorpay_payment_id) {
          setError('Payment could not be completed.');
          return;
        }

        const confirmResponse = await fetch('/api/orders/confirm', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: payload.orderId,
            orderIds: payload.orderIds,
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

        if (payload.orderAccessToken) {
          sessionStorage.setItem(
            `orderAccess:${payload.orderId}`,
            payload.orderAccessToken,
          );
        }

        setOrderPlaced(true);
        clearCart();
        router.push(`/order/${payload.orderId}?placed=1`);
      },
      prefill: {
        name: '',
        email: '',
        contact: formData.phone,
      },
      config: {
        display: {
          blocks: {
            upiPreferred: {
              name: 'Pay instantly with UPI ID or App',
              instruments: [
                {
                  method: 'upi',
                  flows: ['collect', 'intent', 'qr'],
                  apps: ['google_pay', 'phonepe'],
                },
              ],
            },
          },
          sequence: ['block.upiPreferred', 'upi', 'card', 'netbanking', 'wallet'],
          preferences: {
            show_default_blocks: true,
          },
        },
      },
      theme: {
        color: '#ec4899',
      },
      modal: {
        ondismiss: function () {
          setError('Payment was cancelled. Your order is still pending; you can try payment again from checkout.');
        },
      },
    };

    const razorpay = new window.Razorpay(options);
    razorpay.on('payment.failed', function (response: any) {
      const message =
        response?.error?.description ||
        response?.error?.reason ||
        'Razorpay payment failed. Please try another payment method.';
      setError(message);
    });
    razorpay.open();
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!formData.termsAccepted) {
      setLoading(false);
      setError('Please accept Zylo-Buylo terms, return policy and order verification rules before placing an order.');
      return;
    }

    if (formData.paymentMethod === 'COD' && !formData.codTermsAccepted) {
      setLoading(false);
      setError('Please accept Cash on Delivery terms before placing a COD order.');
      return;
    }

    try {
      const response = await fetch('/api/orders/create', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(checkoutAuthToken
            ? { 'x-checkout-auth-token': checkoutAuthToken }
            : {}),
        },
        body: JSON.stringify({
          items,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          zipCode: formData.zipCode,
          phone: formData.phone,
          paymentMethod: formData.paymentMethod,
          termsAccepted: formData.termsAccepted,
          codTermsAccepted: formData.codTermsAccepted,
          totalAmount: getTotalPrice(),
        }),
      });

      const data = await response.json();
      setLoading(false);

      if (!response.ok) {
        if (response.status === 401 && data.errorCode === 'AUTH_REQUIRED') {
          setAuthRequired(true);
          router.push(loginUrl);
          return;
        }

        setError(data.error || 'Failed to create order');
        return;
      }

      if (data.paymentMethod === 'RAZORPAY' && data.razorpayOrderId) {
        if (data.orderAccessToken) {
          sessionStorage.setItem(
            `orderAccess:${data.orderId}`,
            data.orderAccessToken,
          );
        }
        await handleRazorpayPayment(data);
      } else if (data.paymentMethod === 'STRIPE' && data.paymentUrl) {
        if (data.orderIds?.length) {
          sessionStorage.setItem('pendingStripeOrderIds', JSON.stringify(data.orderIds));
        }
        if (data.orderAccessToken) {
          sessionStorage.setItem(
            `orderAccess:${data.orderId}`,
            data.orderAccessToken,
          );
        }
        setOrderPlaced(true);
        clearCart();
        window.location.href = data.paymentUrl;
      } else {
        if (data.orderAccessToken) {
          sessionStorage.setItem(
            `orderAccess:${data.orderId}`,
            data.orderAccessToken,
          );
        }
        setOrderPlaced(true);
        clearCart();
        router.push(
          `/order/${data.orderId}?placed=1${
            data.paymentMethod === 'UPI' ? '&upi=1' : ''
          }`
        );
      }
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  if (items.length === 0) {
    return null;
  }

  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
          <div className="rounded-3xl bg-white p-8 text-center shadow-xl">
            <p className="text-slate-600">Checking login before checkout...</p>
          </div>
        </main>
      </div>
    );
  }

  if (authRequired) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
          <div className="rounded-3xl bg-white p-8 text-center shadow-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-pink-600">
              Login Required
            </p>
            <h1 className="mt-3 text-3xl font-bold text-slate-900">
              Login to continue your order
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">
              Your cart is saved. Please login or create a customer account, then
              you will come back here to complete payment and delivery details.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href={loginUrl}
                className="rounded-xl bg-pink-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-pink-700"
              >
                Login and Continue
              </Link>
              <Link
                href={`/signup?next=${encodeURIComponent('/checkout')}`}
                className="rounded-xl border border-slate-300 px-6 py-3 text-sm font-bold text-slate-800 transition hover:bg-slate-50"
              >
                Create Account
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
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

                  <div className="grid gap-3">
                    {paymentMethodOrder.map((method) => {
                      const option =
                        paymentConfig.methods[method] ||
                        fallbackPaymentConfig.methods[method];
                      const checked = formData.paymentMethod === method;

                      return (
                        <label
                          key={method}
                          className={`flex cursor-pointer gap-3 rounded-2xl border p-4 transition ${
                            checked
                              ? 'border-pink-500 bg-pink-50'
                              : 'border-gray-200 bg-white'
                          } ${
                            option.enabled
                              ? 'hover:border-pink-300'
                              : 'cursor-not-allowed opacity-60'
                          }`}
                        >
                          <input
                            type="radio"
                            name="paymentMethod"
                            value={method}
                            checked={checked}
                            onChange={handleChange}
                            disabled={!option.enabled}
                            className="mt-1 h-4 w-4"
                          />
                          <span className="min-w-0">
                            <span className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
                              {option.label}
                              {method === 'RAZORPAY' && option.enabled && (
                                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">
                                  Recommended
                                </span>
                              )}
                              {!option.enabled && (
                                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-600">
                                  Not configured
                                </span>
                              )}
                            </span>
                            <span className="mt-1 block text-sm leading-5 text-slate-600">
                              {option.description}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
                  <p className="font-bold">Order terms and return policy</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 leading-6">
                    <li>Delivery OTP should be shared only after payment and package/product verification.</li>
                    <li>Only genuine return reasons are eligible under Zylo-Buylo return rules.</li>
                    <li>Product image/video evidence may be required for return or dispute review.</li>
                  </ul>
                  <label className="mt-3 flex gap-3 rounded-xl bg-white p-3 font-semibold text-slate-900">
                    <input
                      type="checkbox"
                      name="termsAccepted"
                      checked={formData.termsAccepted}
                      onChange={handleChange}
                      className="mt-1 h-4 w-4"
                    />
                    <span>
                      I accept Zylo-Buylo Terms, Return Policy, order verification and delivery security rules.
                      <Link href="/terms" className="ml-1 text-pink-600 underline">
                        Read terms
                      </Link>
                      <Link href="/return-policy" className="ml-2 text-pink-600 underline">
                        Return policy
                      </Link>
                    </span>
                  </label>
                </div>

                {formData.paymentMethod === 'COD' && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                    <p className="font-bold">Cash on Delivery terms</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 leading-6">
                      <li>Keep exact cash ready at delivery.</li>
                      <li>Delivery OTP must be shared only after payment and product/package verification.</li>
                      <li>Open-box eligible products must be checked before OTP confirmation.</li>
                      <li>COD refusal, fake orders, or repeated failed delivery may restrict COD access.</li>
                      <li>COD refunds are processed to bank, UPI, or wallet, not by cash at doorstep.</li>
                    </ul>
                    <label className="mt-3 flex gap-3 rounded-xl bg-white p-3 font-semibold text-slate-900">
                      <input
                        type="checkbox"
                        name="codTermsAccepted"
                        checked={formData.codTermsAccepted}
                        onChange={handleChange}
                        className="mt-1 h-4 w-4"
                      />
                      <span>
                        I accept Zylo-Buylo COD, delivery OTP, open-box, return and refund terms.
                        <Link href="/cod-policy" className="ml-1 text-pink-600 underline">
                          Read COD policy
                        </Link>
                      </span>
                    </label>
                  </div>
                )}

                {error && <p className="text-sm text-red-600">{error}</p>}

                <Button type="submit" className="w-full" disabled={loading}>
                  {getSubmitText()}
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
                      {(item.sizeLabel || item.numericSize || item.color || item.sku) && (
                        <p className="text-xs font-semibold text-slate-500">
                          {[item.sizeLabel, item.numericSize && `Size ${item.numericSize}`, item.color, item.sku && `SKU ${item.sku}`]
                            .filter(Boolean)
                            .join(' / ')}
                        </p>
                      )}
                      {item.mrp && item.mrp > item.price && (
                        <p className="text-xs text-green-700">
                          {item.discountPercent || 0}% off MRP
                        </p>
                      )}
                      <p className="text-xs text-green-700">
                        Delivery {item.shippingCharge ? `Rs. ${item.shippingCharge} included` : "included"}
                      </p>
                    </div>
                    <p className="font-semibold text-slate-900">Rs. {(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 space-y-3">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span>Rs. {getTotalPrice().toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Shipping</span>
                  <span className="text-green-600">
                    Included (Rs. {deliveryIncluded.toFixed(2)})
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Tax</span>
                  <span>Calculated at checkout</span>
                </div>
              </div>

              <div className="mt-6 border-t border-gray-200 pt-4">
                <div className="flex justify-between text-lg font-bold text-slate-900">
                  <span>Total</span>
                  <span className="text-pink-600">Rs. {getTotalPrice().toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
