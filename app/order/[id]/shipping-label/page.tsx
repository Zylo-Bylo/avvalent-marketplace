"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getOrderItemDetailPairs } from "@/lib/order-item-details";
import { buildUpiPaymentUri, qrCodeUrl } from "@/lib/upi";

type LabelItem = {
  id: string;
  quantity: number;
  price: number;
  product?: {
    name: string;
    sku?: string | null;
    description?: string | null;
    weightGrams?: number | null;
    packageSize?: string | null;
    category?: { name?: string | null } | null;
    subcategory?: { name?: string | null } | null;
  } | null;
  sizeLabel?: string | null;
  numericSize?: string | null;
  variantColor?: string | null;
  variantSku?: string | null;
};

type LabelOrder = {
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
  createdAt: string;
  vendor?: {
    storeName: string;
    mobile?: string | null;
    businessAddress?: string | null;
  } | null;
  user?: {
    name: string;
    email: string;
  } | null;
  items: LabelItem[];
};

type BusinessProfile = {
  brandName: string;
  businessName: string;
  supportPhone: string;
  settlementUpiId: string;
};

type LabelPayload = {
  order: LabelOrder;
  business: BusinessProfile;
};

const code39: Record<string, string> = {
  "0": "nnnwwnwnn",
  "1": "wnnwnnnnw",
  "2": "nnwwnnnnw",
  "3": "wnwwnnnnn",
  "4": "nnnwwnnnw",
  "5": "wnnwwnnnn",
  "6": "nnwwwnnnn",
  "7": "nnnwnnwnw",
  "8": "wnnwnnwnn",
  "9": "nnwwnnwnn",
  A: "wnnnnwnnw",
  B: "nnwnnwnnw",
  C: "wnwnnwnnn",
  D: "nnnnwwnnw",
  E: "wnnnwwnnn",
  F: "nnwnwwnnn",
  G: "nnnnnwwnw",
  H: "wnnnnwwnn",
  I: "nnwnnwwnn",
  J: "nnnnwwwnn",
  K: "wnnnnnnww",
  L: "nnwnnnnww",
  M: "wnwnnnnwn",
  N: "nnnnwnnww",
  O: "wnnnwnnwn",
  P: "nnwnwnnwn",
  Q: "nnnnnnwww",
  R: "wnnnnnwwn",
  S: "nnwnnnwwn",
  T: "nnnnwnwwn",
  U: "wwnnnnnnw",
  V: "nwwnnnnnw",
  W: "wwwnnnnnn",
  X: "nwnnwnnnw",
  Y: "wwnnwnnnn",
  Z: "nwwnwnnnn",
  "-": "nwnnnnwnw",
  ".": "wwnnnnwnn",
  " ": "nwwnnnwnn",
  "*": "nwnnwnwnn",
};

function money(value: number | null | undefined) {
  return `Rs. ${Number(value || 0).toFixed(2)}`;
}

function cleanBarcodeText(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9-. ]/g, "").slice(-18);
}

function Barcode({ value }: { value: string }) {
  const text = cleanBarcodeText(value) || "ZYLOBUYLO";
  const sequence = `*${text}*`;
  const narrow = 2;
  const wide = 5;
  const gap = 2;
  let x = 0;
  const bars: Array<{ x: number; width: number }> = [];

  for (const character of sequence) {
    const pattern = code39[character] || code39["0"];
    pattern.split("").forEach((part, index) => {
      const width = part === "w" ? wide : narrow;
      if (index % 2 === 0) {
        bars.push({ x, width });
      }
      x += width;
    });
    x += gap;
  }

  return (
    <div className="text-center">
      <svg
        viewBox={`0 0 ${x} 64`}
        className="mx-auto h-16 w-full"
        role="img"
        aria-label={`Barcode ${text}`}
      >
        <rect width={x} height="64" fill="white" />
        {bars.map((bar, index) => (
          <rect key={`${bar.x}-${index}`} x={bar.x} y="0" width={bar.width} height="64" fill="black" />
        ))}
      </svg>
      <p className="mt-1 text-[10px] font-black tracking-[0.18em]">{text}</p>
    </div>
  );
}

export default function ShippingLabelPage() {
  const params = useParams();
  const orderId = params.id as string;
  const [payload, setPayload] = useState<LabelPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const order = payload?.order;
  const business = payload?.business;

  const itemCount = useMemo(
    () => order?.items.reduce((sum, item) => sum + item.quantity, 0) || 0,
    [order],
  );

  const paymentBadge = useMemo(() => {
    if (!order) {
      return "ORDER";
    }
    if (order.paymentMethod === "COD") {
      return `COD ${money(order.totalAmount)}`;
    }
    if (order.status === "PENDING") {
      return `${order.paymentMethod} DUE`;
    }
    return "PREPAID";
  }, [order]);

  const qrData = useMemo(() => {
    if (!order || !business) {
      return "";
    }

    if (order.paymentMethod === "UPI" && order.status === "PENDING" && business.settlementUpiId) {
      return buildUpiPaymentUri({
        upiId: business.settlementUpiId,
        payeeName: business.brandName || "Zylo-Buylo",
        amount: Number(order.totalAmount || 0),
        note: `Zylo-Buylo ${order.id.slice(-8)}`,
      });
    }

    return `https://zylo-buylo.com/order/${order.id}`;
  }, [business, order]);

  useEffect(() => {
    async function loadLabel() {
      try {
        const response = await fetch(`/api/orders/${orderId}/receipt`, {
          cache: "no-store",
        });
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Could not load shipping label.");
          return;
        }

        setPayload(data.receipt);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load shipping label.");
      } finally {
        setLoading(false);
      }
    }

    if (orderId) {
      loadLabel();
    }
  }, [orderId]);

  if (loading) {
    return (
      <main className="min-h-screen bg-stone-100 px-4 py-10 text-center text-stone-600">
        Loading shipping label...
      </main>
    );
  }

  if (error || !order || !business) {
    return (
      <main className="min-h-screen bg-stone-100 px-4 py-10">
        <div className="mx-auto max-w-md bg-white p-6 text-center shadow">
          <p className="text-red-600">{error || "Shipping label not found."}</p>
          <Link
            href={`/order/${orderId}`}
            className="mt-5 inline-block border border-stone-300 px-5 py-3 text-sm font-bold"
          >
            Back to order
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-stone-200 px-4 py-8 text-black print:bg-white print:p-0">
      <style jsx global>{`
        @page {
          size: 4in 6in;
          margin: 0;
        }
        @media print {
          html,
          body {
            width: 4in;
            height: 6in;
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
          .label-sheet {
            box-shadow: none !important;
            margin: 0 !important;
            width: 4in !important;
            height: 6in !important;
          }
        }
      `}</style>

      <div className="no-print mx-auto mb-4 flex max-w-[4in] flex-wrap items-center justify-between gap-3">
        <Link href={`/order/${order.id}`} className="text-sm font-bold text-[#6b145d]">
          Back to order
        </Link>
        <button
          onClick={() => window.print()}
          className="bg-black px-4 py-2 text-sm font-bold text-white"
        >
          Print 4x6 Label
        </button>
      </div>

      <section className="label-sheet mx-auto flex h-[6in] w-[4in] flex-col bg-white p-[0.16in] shadow-xl">
        <header className="flex items-start justify-between gap-2 border-b-2 border-black pb-2">
          <div>
            <p className="text-[22px] font-black leading-none">ZYLO-BUYLO</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wide">
              {order.carrier || "Courier"} Shipping Label
            </p>
          </div>
          <div className="border-2 border-black px-2 py-1 text-center">
            <p className="text-[9px] font-black">PAYMENT</p>
            <p className="text-[13px] font-black leading-tight">{paymentBadge}</p>
          </div>
        </header>

        <section className="grid grid-cols-[1fr_1.05in] gap-2 border-b border-black py-2">
          <div>
            <p className="text-[9px] font-black uppercase">Ship To</p>
            <p className="mt-1 text-[17px] font-black leading-tight">
              {order.shippingName || order.user?.name || "Customer"}
            </p>
            <p className="mt-1 text-[12px] font-bold leading-tight">
              {order.shippingPhone || "Phone missing"}
            </p>
            <p className="mt-1 text-[12px] font-bold leading-tight">
              {order.shippingAddress || "Address missing"}
            </p>
            <p className="text-[12px] font-bold leading-tight">
              {[order.shippingCity, order.shippingState, order.shippingZipCode]
                .filter(Boolean)
                .join(", ")}
            </p>
          </div>

          <div className="text-center">
            {qrData && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrCodeUrl(qrData, 300)}
                alt="Payment or order QR code"
                className="mx-auto h-[1.18in] w-[1.18in] bg-white p-[0.04in]"
              />
            )}
            <p className="mt-1 text-[8px] font-bold leading-tight">
              {order.paymentMethod === "UPI" && order.status === "PENDING"
                ? "SCAN TO PAY"
                : "SCAN ORDER"}
            </p>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-2 border-b border-black py-2 text-[10px]">
          <div>
            <p className="font-black uppercase">Order</p>
            <p className="text-[13px] font-black">#{order.id.slice(-8).toUpperCase()}</p>
            <p className="mt-1">Date: {new Date(order.createdAt).toLocaleDateString()}</p>
            <p>Items: {itemCount}</p>
          </div>
          <div>
            <p className="font-black uppercase">Pickup / Seller</p>
            <p className="font-bold leading-tight">{order.vendor?.storeName || business.businessName}</p>
            <p className="leading-tight">{order.vendor?.mobile || business.supportPhone || ""}</p>
            <p className="leading-tight">{order.vendor?.businessAddress || "Pickup address pending"}</p>
          </div>
        </section>

        <section className="border-b border-black py-2">
          <div className="mb-1 grid grid-cols-[0.9in_1fr] gap-2 text-[10px]">
            <p className="font-black uppercase">Courier</p>
            <p className="font-black leading-tight">{order.carrier || "Courier not selected"}</p>
            <p className="font-black uppercase">Tracking ID</p>
            <p className="break-all text-[13px] font-black leading-tight">
              {order.trackingNumber || order.id.slice(-14).toUpperCase()}
            </p>
          </div>
          <Barcode value={order.trackingNumber || order.id.slice(-14)} />
          <p className="mt-1 text-center text-[9px] font-bold leading-tight">
            Barcode is for scanner. Use Tracking ID above for manual courier tracking.
          </p>
        </section>

        <section className="flex-1 border-b border-black py-2 text-[9px]">
          <div>
            <p className="font-black uppercase">Item Details</p>
            <div className="mt-1 space-y-1.5">
              {order.items.slice(0, 3).map((item) => (
                <div key={item.id} className="leading-tight">
                  <p className="line-clamp-1 text-[10px] font-black">
                    {item.quantity}x {item.product?.name || "Product"}
                  </p>
                  <p className="line-clamp-2">
                    {getOrderItemDetailPairs(item)
                      .slice(0, 7)
                      .map(([label, value]) => `${label}: ${value}`)
                      .join(" / ") || "Details not saved"}
                  </p>
                </div>
              ))}
              {order.items.length > 3 && (
                <p className="font-bold">+{order.items.length - 3} more item lines on receipt</p>
              )}
            </div>
          </div>
          <div className="mt-1 grid grid-cols-2 gap-x-2 border-t border-dashed border-black pt-1 text-[9px]">
            <p>Status: <span className="font-bold">{order.status}</span></p>
            <p>Total: <span className="font-bold">{money(order.totalAmount)}</span></p>
          </div>
        </section>

        <footer className="pt-2 text-center">
          <p className="text-[10px] font-black">
            {business.brandName || "Zylo-Buylo"} / {business.supportPhone || "Support"}
          </p>
          <p className="mt-1 text-[8px] font-bold">
            Verify address and payment before dispatch. Keep label visible on package.
          </p>
        </footer>
      </section>
    </main>
  );
}
