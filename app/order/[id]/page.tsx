'use client';

import { useEffect, useState } from 'react';
import Navbar from '@/components/navbar/Navbar';
import FileUploadField from '@/components/forms/FileUploadField';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { buildUpiPaymentUri, qrCodeUrl } from '@/lib/upi';

type OrderItem = {
  id: string;
  productId: string;
  variantId?: string | null;
  sizeLabel?: string | null;
  numericSize?: string | null;
  variantColor?: string | null;
  variantSku?: string | null;
  quantity: number;
  price: number;
  mrp?: number | null;
  shippingCharge?: number | null;
  product?: {
    id: string;
    name: string;
    images?: string[] | null;
    sku?: string | null;
    category?: { name: string } | null;
    subcategory?: { name: string } | null;
  } | null;
};

type Order = {
  id: string;
  totalAmount: number;
  status: string;
  paymentMethod: string;
  paymentId?: string | null;
  shippingName?: string | null;
  shippingPhone?: string | null;
  shippingAddress?: string | null;
  shippingCity?: string | null;
  shippingState?: string | null;
  shippingZipCode?: string | null;
  trackingNumber?: string | null;
  carrier?: string | null;
  statusNote?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  createdAt: string;
  vendor?: {
    storeName: string;
  } | null;
  user?: {
    name: string;
    email: string;
  } | null;
  items: OrderItem[];
};

type PaymentConfig = {
  methods?: {
    UPI?: {
      enabled: boolean;
      upiId?: string | null;
    };
  };
};

type ReturnRequest = {
  id: string;
  reason: string;
  status: string;
  adminNote?: string | null;
  refundReference?: string | null;
  createdAt: string;
};

type TrustSnapshot = {
  verification?: {
    verificationId?: string;
    openBoxEligible?: boolean;
    customerProductConfirmed?: boolean;
    verifiedDelivered?: boolean;
    correctProduct?: boolean;
    correctBrand?: boolean;
    correctSize?: boolean;
    correctColor?: boolean;
    correctQuantity?: boolean;
  } | null;
  dispatchImages?: Array<{
    id: string;
    imageType: string;
    url: string;
    createdAt: string;
  }>;
  deliveryOtp?: {
    otp?: string;
    verified?: boolean;
    verifiedAt?: string | null;
  } | null;
  openBox?: {
    verified?: boolean;
    gpsLocation?: string | null;
    verifiedAt?: string | null;
  } | null;
  returnRequest?: {
    status?: string;
    riskLevel?: string;
    riskScore?: number;
  } | null;
  returnEvidence?: Array<{
    id: string;
    evidenceType: string;
    url: string;
  }>;
  riskAssessment?: {
    riskLevel?: string;
    riskScore?: number;
    signals?: string;
  } | null;
};

const returnReasonGroups = [
  {
    label: 'Product condition / damage',
    reasons: [
      'Manufacturing Defect',
      'Product Damaged After Opening',
      'Transit Damage Hidden Inside Package',
      'Quality Not Matching Vendor Description',
    ],
  },
  {
    label: 'Electronics / appliances / spare parts',
    reasons: ['Product Not Working', 'Missing Parts', 'Warranty Issue'],
  },
  {
    label: 'Delivery mismatch',
    reasons: ['Wrong Product Received', 'Fake Product Suspected'],
  },
];

const returnReasons = returnReasonGroups.flatMap((group) => group.reasons);

function getOrderCategoryText(order: Order | null) {
  return (order?.items || [])
    .flatMap((item) => [
      item.product?.category?.name,
      item.product?.subcategory?.name,
      item.product?.name,
    ])
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function getCategoryReturnReasonGroups(order: Order | null, hideMismatchReasons: boolean) {
  const text = getOrderCategoryText(order);
  const isFashion = /fashion|shirt|t-shirt|jeans|trouser|kurti|saree|lehenga|wear|clothing|footwear|shoe|sandal|slipper/.test(text);
  const isElectronics = /electronic|mobile|accessor|ac|tv|washing|machine|appliance|part|spare|motor|compressor/.test(text);
  const groups = returnReasonGroups
    .map((group) => {
      let reasons = group.reasons;
      if (hideMismatchReasons) {
        reasons = reasons.filter((reason) => reason !== 'Wrong Product Received');
      }
      if (group.label.includes('Electronics') && !isElectronics) {
        reasons = reasons.filter((reason) => ['Missing Parts', 'Warranty Issue'].includes(reason));
      }
      if (group.label.includes('Product condition') && isFashion) {
        reasons = [
          'Manufacturing Defect',
          'Product Damaged After Opening',
          'Quality Not Matching Vendor Description',
          'Transit Damage Hidden Inside Package',
        ];
      }
      return { ...group, reasons };
    })
    .filter((group) => group.reasons.length > 0);

  return groups.length > 0 ? groups : returnReasonGroups;
}

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PAID: 'bg-blue-100 text-blue-800',
  SHIPPED: 'bg-purple-100 text-purple-800',
  DELIVERED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
  RETURNED: 'bg-gray-200 text-gray-800',
};

const timeline = [
  { key: 'PENDING', label: 'Placed' },
  { key: 'PAID', label: 'Payment' },
  { key: 'SHIPPED', label: 'Shipped' },
  { key: 'DELIVERED', label: 'Delivered' },
];

function statusIndex(status: string) {
  if (status === 'CANCELLED' || status === 'RETURNED') {
    return 0;
  }
  return Math.max(0, timeline.findIndex((item) => item.key === status));
}

function money(value: number | null | undefined) {
  return `Rs. ${Number(value || 0).toFixed(2)}`;
}

function getOrderShortId(orderId: string) {
  return orderId.slice(-8).toUpperCase();
}

function getProductImage(item: OrderItem) {
  return item.product?.images?.[0] || 'https://placehold.co/96x96/png?text=Product';
}

function OrderConfirmationPanel({ order }: { order: Order }) {
  const itemCount = order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const shippingTotal = order.items.reduce(
    (sum, item) => sum + Number(item.shippingCharge || 0) * Number(item.quantity || 0),
    0,
  );
  const firstName =
    order.shippingName?.split(' ').filter(Boolean)[0] ||
    order.user?.name?.split(' ').filter(Boolean)[0] ||
    'Customer';
  const paymentText =
    order.paymentMethod === 'COD'
      ? 'Cash on Delivery'
      : order.paymentMethod === 'RAZORPAY'
        ? 'Razorpay'
        : order.paymentMethod;

  return (
    <section className="mb-8 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4 p-5 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-blue-500 text-2xl font-bold text-blue-600">
              ✓
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Confirmation #{getOrderShortId(order.id)}
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-950 sm:text-3xl">
                Thank you, {firstName}!
              </h1>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 p-5">
            <h2 className="text-lg font-semibold text-slate-950">
              Your order is confirmed
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              You will receive order, shipping and delivery updates on your registered
              contact details.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 p-5">
            <h2 className="text-lg font-semibold text-slate-950">Order updates</h2>
            <p className="mt-2 text-sm text-slate-600">
              Track dispatch proof, courier details, delivery OTP and return status
              from this page.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href={`/order/${order.id}/receipt`}
                className="rounded-xl border border-blue-200 px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-50"
              >
                View order receipt
              </a>
              <a
                href="/orders"
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                My orders
              </a>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 p-5">
            <h2 className="text-lg font-semibold text-slate-950">Order details</h2>
            <div className="mt-4 grid gap-5 text-sm text-slate-700 sm:grid-cols-2">
              <div>
                <p className="font-semibold text-slate-950">Contact information</p>
                <p className="mt-2">{order.shippingPhone || 'Phone not saved'}</p>
                <p>{order.user?.email || 'Email updates enabled after login'}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-950">Payment method</p>
                <p className="mt-2">
                  {paymentText} · {money(order.totalAmount)}
                </p>
                <p className="text-xs text-slate-500">
                  {order.paymentId || 'Payment reference pending'}
                </p>
              </div>
              <div>
                <p className="font-semibold text-slate-950">Shipping address</p>
                <p className="mt-2">{order.shippingName || order.user?.name || 'Customer'}</p>
                <p>{order.shippingAddress || 'Address not saved'}</p>
                <p>
                  {[order.shippingCity, order.shippingState, order.shippingZipCode]
                    .filter(Boolean)
                    .join(', ')}
                </p>
              </div>
              <div>
                <p className="font-semibold text-slate-950">Seller</p>
                <p className="mt-2">{order.vendor?.storeName || 'Zylo-Buylo vendor'}</p>
                <p className="text-xs text-slate-500">
                  Courier: {order.carrier || 'Will be updated after dispatch'}
                </p>
                <p className="text-xs text-slate-500">
                  Tracking: {order.trackingNumber || 'Will be updated soon'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <aside className="border-t border-slate-200 bg-slate-50 p-5 sm:p-8 lg:border-l lg:border-t-0">
          <div className="space-y-4">
            {order.items.map((item) => (
              <div key={item.id} className="flex gap-4">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getProductImage(item)}
                    alt={item.product?.name || 'Product'}
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black text-xs font-bold text-white">
                    {item.quantity}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium text-slate-950">
                    {item.product?.name || 'Product'}
                  </p>
                  {(item.sizeLabel || item.numericSize || item.variantColor) && (
                    <p className="mt-1 text-xs text-slate-500">
                      {[item.sizeLabel, item.numericSize, item.variantColor]
                        .filter(Boolean)
                        .join(' / ')}
                    </p>
                  )}
                </div>
                <p className="shrink-0 text-sm font-semibold text-slate-950">
                  {money(item.price * item.quantity)}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 space-y-3 border-t border-slate-200 pt-5 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>
                Subtotal · {itemCount} {itemCount === 1 ? 'item' : 'items'}
              </span>
              <span>{money(order.totalAmount)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Shipping</span>
              <span>{shippingTotal > 0 ? money(shippingTotal) : 'FREE / Included'}</span>
            </div>
            <div className="flex items-end justify-between border-t border-slate-200 pt-4">
              <div>
                <p className="text-lg font-semibold text-slate-950">Total</p>
                <p className="text-xs text-slate-500">Inclusive of applicable taxes</p>
              </div>
              <p className="text-xl font-bold text-slate-950">{money(order.totalAmount)}</p>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

export default function OrderPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = params.id as string;
  const sessionId = searchParams.get('session_id');
  const placed = searchParams.get('placed') === '1';
  const upiPayment = searchParams.get('upi') === '1';
  const [order, setOrder] = useState<Order | null>(null);
  const [returnRequest, setReturnRequest] = useState<ReturnRequest | null>(null);
  const [trust, setTrust] = useState<TrustSnapshot | null>(null);
  const [returnReason, setReturnReason] = useState(returnReasons[0]);
  const [returnDetails, setReturnDetails] = useState('');
  const [returnProductImages, setReturnProductImages] = useState<string[]>([]);
  const [returnDefectImages, setReturnDefectImages] = useState<string[]>([]);
  const [returnVideos, setReturnVideos] = useState<string[]>([]);
  const [returnMessage, setReturnMessage] = useState('');
  const [returnLoading, setReturnLoading] = useState(false);
  const [deliveryOtp, setDeliveryOtp] = useState('');
  const [trustMessage, setTrustMessage] = useState('');
  const [trustLoading, setTrustLoading] = useState(false);
  const [matchChecklist, setMatchChecklist] = useState({
    correctProduct: true,
    correctBrand: true,
    correctSize: true,
    correctColor: true,
    correctQuantity: true,
  });
  const [upiId, setUpiId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const thankYouBanner = placed ? (
    <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 p-5 text-green-800">
      <h2 className="text-2xl font-bold">Thank you for shopping with Zylo-Buylo</h2>
      <p className="mt-2 text-sm">
        Your order is placed successfully. We have sent the confirmation to your
        registered email. You can track shipment and delivery updates on this page.
      </p>
    </div>
  ) : null;

  const fetchOrder = async () => {
    try {
      const orderAccessToken =
        typeof window !== 'undefined'
          ? sessionStorage.getItem(`orderAccess:${orderId}`)
          : null;
      const response = await fetch(`/api/orders/${orderId}`, {
        credentials: 'include',
        headers: orderAccessToken
          ? { 'x-order-access-token': orderAccessToken }
          : undefined,
      });
      const data = await response.json();

      if (response.status === 401) {
        router.push(
          `/login?role=customer&next=${encodeURIComponent(`/order/${orderId}`)}`,
        );
        return null;
      }

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

  const fetchReturnRequest = async () => {
    try {
      const response = await fetch(`/api/orders/${orderId}/return-request`, {
        cache: 'no-store',
        credentials: 'include',
      });
      const data = await response.json();

      if (response.ok) {
        setReturnRequest(data.request || null);
      }
    } catch (requestError) {
      console.error('Return request fetch failed:', requestError);
    }
  };

  const fetchTrust = async () => {
    try {
      const response = await fetch(`/api/orders/${orderId}/trust`, {
        cache: 'no-store',
        credentials: 'include',
      });
      const data = await response.json();

      if (response.ok) {
        setTrust(data.trust || null);
      }
    } catch (trustError) {
      console.error('Trust details fetch failed:', trustError);
    }
  };

  const submitReturnRequest = async () => {
    setReturnLoading(true);
    setReturnMessage('');
    setError('');

    try {
      const response = await fetch(`/api/orders/${orderId}/return-request`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: returnReason,
          details: returnDetails.trim(),
          productImages: returnProductImages,
          defectImages: returnDefectImages,
          videos: returnVideos,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Return request failed');
        return;
      }

      setReturnRequest(data.request);
      setTrust(data.trust || trust);
      setReturnReason(returnReasons[0]);
      setReturnDetails('');
      setReturnProductImages([]);
      setReturnDefectImages([]);
      setReturnVideos([]);
      setReturnMessage(data.message || 'Return request submitted.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Return request failed');
    } finally {
      setReturnLoading(false);
    }
  };

  async function verifyDeliveryOtp() {
    setTrustLoading(true);
    setTrustMessage('');
    setError('');

    try {
      const response = await fetch(`/api/orders/${orderId}/trust`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify-delivery-otp',
          otp: deliveryOtp,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'OTP verification failed.');
        return;
      }

      setTrust(data.trust || null);
      setDeliveryOtp('');
      setTrustMessage(data.message || 'Delivery OTP verified.');
      await fetchOrder();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OTP verification failed.');
    } finally {
      setTrustLoading(false);
    }
  }

  async function confirmProductMatch() {
    setTrustLoading(true);
    setTrustMessage('');
    setError('');

    try {
      const response = await fetch(`/api/orders/${orderId}/trust`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm-product-match',
          ...matchChecklist,
          productName: order?.items?.[0]?.product?.name || '',
          quantity: String(
            order?.items?.reduce((sum, item) => sum + Number(item.quantity || 0), 0) ||
              '',
          ),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Product match confirmation failed.');
        return;
      }

      setTrust(data.trust || null);
      if (!Object.values(matchChecklist).every(Boolean)) {
        setReturnReason('Quality Not Matching Vendor Description');
        setReturnDetails(
          'Open box delivery issue found. Please describe which product detail did not match.',
        );
        setTrustMessage(
          data.message ||
            'Issue saved. Please submit a return request with image/video evidence below.',
        );
        return;
      }
      setTrustMessage(data.message || 'Product verification saved.');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Product match confirmation failed.',
      );
    } finally {
      setTrustLoading(false);
    }
  }

  const confirmStripePayment = async () => {
    if (!sessionId) {
      return;
    }

    try {
      const storedOrderIds = sessionStorage.getItem('pendingStripeOrderIds');
      const orderIds = storedOrderIds ? JSON.parse(storedOrderIds) : undefined;
      const response = await fetch('/api/orders/confirm', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          orderIds,
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
      sessionStorage.removeItem('pendingStripeOrderIds');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  useEffect(() => {
    let isActive = true;

    async function loadPaymentConfig() {
      try {
        const response = await fetch('/api/payments/config', { cache: 'no-store' });
        const config = (await response.json()) as PaymentConfig;
        if (isActive) {
          setUpiId(config.methods?.UPI?.upiId || '');
        }
      } catch (configError) {
        console.error('Payment config load failed:', configError);
      }
    }

    loadPaymentConfig();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    const initialize = async () => {
      const loadedOrder = await fetchOrder();
      await fetchReturnRequest();
      await fetchTrust();
      if (loadedOrder?.status === 'PENDING' && sessionId) {
        await confirmStripePayment();
      }
      setLoading(false);
    };

    if (orderId) {
      initialize();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, sessionId, router]);

  useEffect(() => {
    const deliveryVerified = Boolean(
      trust?.verification?.verifiedDelivered ||
        trust?.verification?.customerProductConfirmed,
    );

    if (deliveryVerified && returnReason === 'Wrong Product Received') {
      setReturnReason('Manufacturing Defect');
    }
  }, [returnReason, trust]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
          {thankYouBanner}
          <div className="text-center text-slate-600">Loading order details...</div>
        </main>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
          {thankYouBanner}
          <div className="rounded-3xl bg-white p-8 text-center shadow-xl">
            <p className="text-red-600">{error || 'Order not found'}</p>
          </div>
        </main>
      </div>
    );
  }

  const activeIndex = statusIndex(order.status);
  const showUpiInstructions =
    (upiPayment || order.paymentMethod === 'UPI') && order.status === 'PENDING';
  const upiQrData =
    showUpiInstructions && upiId
      ? buildUpiPaymentUri({
          upiId,
          payeeName: 'Zylo-Buylo',
          amount: Number(order.totalAmount || 0),
          note: `Zylo-Buylo ${order.id.slice(-8)}`,
        })
      : '';
  const dispatchImages = trust?.dispatchImages || [];
  const productProofImages = dispatchImages.filter(
    (image) => image.imageType === 'PRODUCT',
  );
  const packedProofImages = dispatchImages.filter(
    (image) => image.imageType === 'PACKED_PRODUCT',
  );
  const shippingLabelProof = dispatchImages.find(
    (image) => image.imageType === 'SHIPPING_LABEL',
  );
  const showDeliveryOtpBox =
    order.status === 'SHIPPED' && trust?.deliveryOtp && !trust.deliveryOtp.verified;
  const showProductMatchChecklist =
    order.status === 'DELIVERED' && !trust?.verification?.customerProductConfirmed;
  const smartReturnReasonGroups = getCategoryReturnReasonGroups(
    order,
    Boolean(trust?.verification?.verifiedDelivered),
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {placed && <OrderConfirmationPanel order={order} />}
        <div className="rounded-3xl bg-white p-6 shadow-xl md:p-8">
          {showUpiInstructions && (
            <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-5 text-blue-900">
              <h2 className="text-xl font-bold">UPI payment pending</h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-[160px_1fr] sm:items-center">
                {upiQrData && (
                  <div className="rounded-2xl bg-white p-3 text-center shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrCodeUrl(upiQrData, 280)}
                      alt="UPI payment QR code"
                      className="mx-auto h-36 w-36"
                    />
                    <p className="mt-2 text-xs font-bold text-blue-900">Scan to pay</p>
                  </div>
                )}
                <p className="text-sm leading-6">
                  Please pay Rs. {Number(order.totalAmount || 0).toFixed(2)} to{' '}
                  <span className="font-bold">{upiId || 'merchant UPI ID'}</span>.
                  After payment, keep your UPI reference number safe. Admin/vendor
                  will mark the order as paid after verification.
                </p>
              </div>
            </div>
          )}
          {returnMessage && (
            <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 p-5 text-green-800">
              {returnMessage}
            </div>
          )}
          {trustMessage && (
            <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-5 text-blue-800">
              {trustMessage}
            </div>
          )}

          <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-pink-600">
                Order Tracking
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-900">
                Order #{order.id.slice(-8)}
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Placed on {new Date(order.createdAt).toLocaleString()} from{' '}
                {order.vendor?.storeName || 'Zylo-Buylo vendor'}
              </p>
            </div>
            <span
              className={`w-fit rounded-full px-4 py-2 text-sm font-semibold ${
                statusColors[order.status] || 'bg-gray-100 text-gray-800'
              }`}
            >
              {order.status}
            </span>
            <a
              href={`/order/${order.id}/receipt`}
              className="w-fit rounded-full border border-pink-200 px-4 py-2 text-sm font-semibold text-pink-700 hover:bg-pink-50"
            >
              View Receipt
            </a>
            <a
              href={`/order/${order.id}/shipping-label`}
              className="w-fit rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Shipping Label
            </a>
          </div>

          <div className="mb-8 grid gap-3 md:grid-cols-4">
            {timeline.map((step, index) => {
              const active =
                order.status === 'DELIVERED' || index <= activeIndex;

              return (
                <div
                  key={step.key}
                  className={`rounded-2xl border p-4 ${
                    active
                      ? 'border-green-200 bg-green-50 text-green-800'
                      : 'border-gray-200 bg-white text-gray-500'
                  }`}
                >
                  <p className="text-sm font-bold">{step.label}</p>
                  <p className="mt-1 text-xs">
                    {active ? 'Completed or in progress' : 'Waiting'}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mb-8 grid gap-6 md:grid-cols-3">
            <div className="rounded-xl border border-gray-200 p-4">
              <p className="text-sm font-medium text-slate-600">Order Total</p>
              <p className="mt-2 text-3xl font-bold text-pink-600">
                Rs. {Number(order.totalAmount || 0).toFixed(2)}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 p-4">
              <p className="text-sm font-medium text-slate-600">Payment</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {order.paymentMethod}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {order.paymentId || 'Payment ID pending'}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 p-4">
              <p className="text-sm font-medium text-slate-600">Shipment</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {order.trackingNumber || 'Not shipped yet'}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {order.carrier || 'Carrier pending'}
              </p>
            </div>
          </div>

          <section className="mb-8 rounded-xl border border-blue-100 bg-blue-50 p-5">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
              <div>
                <h2 className="text-lg font-bold text-blue-950">
                  Zylo-Buylo Trust Verification
                </h2>
                <p className="mt-1 text-sm text-blue-800">
                  Verification ID:{' '}
                  <span className="font-bold">
                    {trust?.verification?.verificationId || 'Generated after dispatch'}
                  </span>
                </p>
              </div>
              <div className="rounded-full bg-white px-4 py-2 text-sm font-bold text-blue-900">
                {trust?.verification?.verifiedDelivered
                  ? 'Verified Delivered'
                  : trust?.deliveryOtp?.verified
                    ? 'OTP Verified'
                    : dispatchImages.length > 0
                      ? 'Dispatch Proof Added'
                      : 'Waiting Dispatch Proof'}
              </div>
            </div>

            {dispatchImages.length > 0 ? (
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <div>
                  <p className="mb-2 text-sm font-bold text-blue-950">
                    Product Proof
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {productProofImages.slice(0, 4).map((image) => (
                      <a
                        key={image.id}
                        href={image.url}
                        target="_blank"
                        className="block overflow-hidden rounded-xl bg-white"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={image.url}
                          alt="Product proof"
                          className="h-24 w-full object-cover"
                        />
                      </a>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-sm font-bold text-blue-950">
                    Packed Product Proof
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {packedProofImages.slice(0, 4).map((image) => (
                      <a
                        key={image.id}
                        href={image.url}
                        target="_blank"
                        className="block overflow-hidden rounded-xl bg-white"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={image.url}
                          alt="Packed product proof"
                          className="h-24 w-full object-cover"
                        />
                      </a>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-sm font-bold text-blue-950">
                    Shipping Label
                  </p>
                  {shippingLabelProof ? (
                    <a
                      href={shippingLabelProof.url}
                      target="_blank"
                      className="block overflow-hidden rounded-xl bg-white"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={shippingLabelProof.url}
                        alt="Shipping label proof"
                        className="h-24 w-full object-cover"
                      />
                    </a>
                  ) : (
                    <p className="rounded-xl bg-white p-4 text-sm text-blue-800">
                      Shipping label proof pending.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <p className="mt-4 rounded-xl bg-white p-4 text-sm text-blue-800">
                Vendor dispatch proof will appear here after packing and shipping.
              </p>
            )}
          </section>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <section className="rounded-xl border border-gray-200">
              <div className="border-b border-gray-200 bg-slate-50 px-6 py-4">
                <h2 className="font-semibold text-slate-900">Order Items</h2>
              </div>
              <div className="divide-y divide-gray-200">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-4 px-6 py-4">
                    <div className="flex min-w-0 items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={
                          item.product?.images?.[0] ||
                          'https://placehold.co/80x80/png?text=Product'
                        }
                        alt={item.product?.name || 'Product'}
                        className="h-16 w-16 rounded-xl bg-slate-100 object-cover"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">
                          {item.product?.name || `Product ID: ${item.productId}`}
                        </p>
                        <p className="text-sm text-slate-600">Quantity: {item.quantity}</p>
                        {(item.sizeLabel || item.numericSize || item.variantColor || item.variantSku) && (
                          <p className="text-xs font-semibold text-slate-500">
                            {[item.sizeLabel, item.numericSize && `Size ${item.numericSize}`, item.variantColor, item.variantSku && `SKU ${item.variantSku}`]
                              .filter(Boolean)
                              .join(' / ')}
                          </p>
                        )}
                        {item.product?.sku && (
                          <p className="text-xs text-slate-500">SKU: {item.product.sku}</p>
                        )}
                      </div>
                    </div>
                    <p className="shrink-0 font-semibold text-slate-900">
                      Rs. {(item.price * item.quantity).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <aside className="space-y-6">
              <section className="rounded-xl border border-gray-200 p-5">
                <h2 className="font-semibold text-slate-900">Delivery Address</h2>
                <div className="mt-3 text-sm leading-6 text-slate-600">
                  <p className="font-semibold text-slate-900">
                    {order.shippingName || 'Customer'}
                  </p>
                  <p>{order.shippingPhone || 'Phone not saved'}</p>
                  <p>{order.shippingAddress || 'Address not saved'}</p>
                  <p>
                    {[order.shippingCity, order.shippingState, order.shippingZipCode]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                </div>
              </section>

              <section className="rounded-xl border border-gray-200 p-5">
                <h2 className="font-semibold text-slate-900">Status Note</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {order.statusNote ||
                    (order.status === 'PENDING' &&
                      'Your order is awaiting payment or vendor confirmation.') ||
                    (order.status === 'PAID' &&
                      'Payment received. Your order will be shipped soon.') ||
                    (order.status === 'SHIPPED' && 'Your order is on its way.') ||
                    (order.status === 'DELIVERED' &&
                      'Your order has been delivered. Thank you.') ||
                    (order.status === 'CANCELLED' && 'This order has been cancelled.') ||
                    'Order status is being updated.'}
                </p>
              </section>

              <section className="rounded-xl border border-blue-200 bg-blue-50 p-5">
                <h2 className="font-semibold text-blue-950">Delivery Security</h2>
                {order.paymentMethod === 'COD' && (
                  <p className="mt-3 rounded-xl bg-white p-3 text-sm font-semibold leading-6 text-blue-900">
                    COD order: first pay the delivery partner, then share/verify OTP.
                    For open-box delivery, check product after OTP step. If any issue
                    is found, use the return request section with proof images/video.
                  </p>
                )}
                {trust?.verification?.openBoxEligible && (
                  <p className="mt-3 rounded-xl bg-white p-3 text-sm leading-6 text-blue-900">
                    Open box enabled: verify product name, brand, size, color and
                    quantity before final confirmation.
                  </p>
                )}
                {showDeliveryOtpBox ? (
                  <div className="mt-3 space-y-3">
                    <p className="rounded-xl bg-white p-3 text-sm text-blue-900">
                      Your delivery OTP is{' '}
                      <span className="text-lg font-black">
                        {trust?.deliveryOtp?.otp}
                      </span>
                      . Share it only after checking the package.
                    </p>
                    <input
                      value={deliveryOtp}
                      onChange={(event) => setDeliveryOtp(event.target.value)}
                      placeholder="Enter OTP to verify delivery"
                      className="w-full rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-600"
                    />
                    <button
                      type="button"
                      onClick={verifyDeliveryOtp}
                      disabled={trustLoading || deliveryOtp.trim().length < 6}
                      className="w-full rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                    >
                      Verify Delivery OTP
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 text-sm leading-6 text-blue-900">
                    <p>
                      OTP proof:{' '}
                      <span className="font-bold">
                        {trust?.deliveryOtp?.verified ? 'Verified' : 'Pending'}
                      </span>
                    </p>
                    <p>
                      Open box:{' '}
                      <span className="font-bold">
                        {trust?.openBox?.verified ? 'Verified' : 'Not verified'}
                      </span>
                    </p>
                  </div>
                )}
              </section>

              {showProductMatchChecklist && (
                <section className="rounded-xl border border-green-200 bg-green-50 p-5">
                  <h2 className="font-semibold text-green-950">
                    Product Match Confirmation
                  </h2>
                  <p className="mt-2 text-sm text-green-800">
                    Confirm only after checking product, brand, size, color and
                    quantity.
                  </p>
                  <div className="mt-3 space-y-2">
                    {[
                      ['correctProduct', 'Correct Product'],
                      ['correctBrand', 'Correct Brand'],
                      ['correctSize', 'Correct Size'],
                      ['correctColor', 'Correct Color'],
                      ['correctQuantity', 'Correct Quantity'],
                    ].map(([key, label]) => (
                      <label
                        key={key}
                        className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-green-900"
                      >
                        <input
                          type="checkbox"
                          checked={
                            matchChecklist[key as keyof typeof matchChecklist]
                          }
                          onChange={(event) =>
                            setMatchChecklist((current) => ({
                              ...current,
                              [key]: event.target.checked,
                            }))
                          }
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={confirmProductMatch}
                    disabled={trustLoading}
                    className="mt-4 w-full rounded-xl bg-green-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                  >
                    {Object.values(matchChecklist).every(Boolean)
                      ? 'Confirm Product Match'
                      : 'Save Issue and Start Return'}
                  </button>
                  {!Object.values(matchChecklist).every(Boolean) && (
                    <p className="mt-3 rounded-xl bg-white p-3 text-xs font-semibold leading-5 text-green-900">
                      One or more checks failed. After saving this issue, submit the
                      return request below with product image, defect image and video.
                    </p>
                  )}
                </section>
              )}

              <section className="rounded-xl border border-gray-200 p-5">
                <h2 className="font-semibold text-slate-900">Return / Refund</h2>
                {returnRequest ? (
                  <div className="mt-3 text-sm leading-6 text-slate-600">
                    <p>
                      Status: <span className="font-bold">{returnRequest.status}</span>
                    </p>
                    <p>Reason: {returnRequest.reason}</p>
                    {returnRequest.adminNote && (
                      <p>Admin note: {returnRequest.adminNote}</p>
                    )}
                    {returnRequest.refundReference && (
                      <p>Refund ref: {returnRequest.refundReference}</p>
                    )}
                  </div>
                ) : order.status === 'DELIVERED' ? (
                  <div className="mt-3 space-y-3">
                    <label className="block text-sm font-semibold text-slate-700">
                      Select return reason
                    </label>
                    <select
                      value={returnReason}
                      onChange={(event) => setReturnReason(event.target.value)}
                      className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-pink-500"
                    >
                      {smartReturnReasonGroups.map((group) => (
                        <optgroup key={group.label} label={group.label}>
                          {group.reasons.map((reason) => (
                            <option key={reason} value={reason}>
                              {reason}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    <p className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                      Reasons are filtered according to your ordered category:{' '}
                      <span className="font-bold">
                        {order.items
                          .map((item) => item.product?.category?.name || item.product?.subcategory?.name)
                          .filter(Boolean)
                          .join(', ') || 'General product'}
                      </span>
                      . If an open-box mismatch is found, select the closest genuine
                      reason and upload evidence.
                    </p>
                    <p className="text-xs leading-5 text-slate-500">
                      Preference reasons such as changed mind, did not like product
                      or found cheaper elsewhere are not eligible under Zylo-Buylo
                      Trust Rule.
                    </p>
                    <label className="block text-sm font-semibold text-slate-700">
                      Explain the issue
                    </label>
                    <textarea
                      value={returnDetails}
                      onChange={(event) => setReturnDetails(event.target.value)}
                      className="min-h-28 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-pink-500"
                      placeholder="Example: product arrived damaged, wrong size, missing item, or not working..."
                    />
                    <p className="text-xs text-slate-500">
                      Evidence is mandatory: product image, defect image and short
                      video.
                    </p>
                    <FileUploadField
                      label={`Product image evidence (${returnProductImages.length})`}
                      purpose="return-evidence"
                      accept="image/*"
                      onUploaded={(url) =>
                        setReturnProductImages((current) => [...current, url])
                      }
                    />
                    <FileUploadField
                      label={`Defect/damage image evidence (${returnDefectImages.length})`}
                      purpose="return-evidence"
                      accept="image/*"
                      onUploaded={(url) =>
                        setReturnDefectImages((current) => [...current, url])
                      }
                    />
                    <FileUploadField
                      label={`Short video evidence (${returnVideos.length})`}
                      purpose="return-evidence"
                      accept="video/*"
                      onUploaded={(url) =>
                        setReturnVideos((current) => [...current, url])
                      }
                    />
                    <button
                      type="button"
                      onClick={submitReturnRequest}
                      disabled={
                        returnLoading ||
                        returnDetails.trim().length < 10 ||
                        returnProductImages.length === 0 ||
                        returnDefectImages.length === 0 ||
                        returnVideos.length === 0
                      }
                      className="w-full rounded-xl bg-pink-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                    >
                      {returnLoading ? 'Submitting...' : 'Request Return'}
                    </button>
                  </div>
                ) : (
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    Return request becomes available after delivery.
                  </p>
                )}
              </section>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}
