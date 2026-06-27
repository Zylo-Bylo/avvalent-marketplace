"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getOrderItemDetailPairs } from "@/lib/order-item-details";

type ReceiptItem = {
  id: string;
  quantity: number;
  price: number;
  mrp?: number | null;
  packagingCharge?: number | null;
  shippingCharge?: number | null;
  product?: {
    id: string;
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

type ReceiptOrder = {
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
    gstNumber?: string | null;
    panNumber?: string | null;
    businessAddress?: string | null;
  } | null;
  user?: {
    name: string;
    email: string;
  } | null;
  items: ReceiptItem[];
};

type BusinessProfile = {
  businessName: string;
  legalName: string;
  brandName: string;
  registeredAddress: string;
  supportEmail: string;
  supportPhone: string;
  gstNumber: string;
  panNumber: string;
  bankAccountName: string;
  bankAccountNumberMasked?: string | null;
  ifscCode: string;
  bankName: string;
  bankBranch: string;
  settlementUpiId: string;
};

type ReceiptPayload = {
  order: ReceiptOrder;
  business: BusinessProfile;
  issuedAt: string;
};

function money(value: number | null | undefined) {
  return `Rs. ${Number(value || 0).toFixed(2)}`;
}

function shortId(id: string) {
  return id.slice(-8).toUpperCase();
}

export default function OrderReceiptPage() {
  const params = useParams();
  const orderId = params.id as string;
  const [receipt, setReceipt] = useState<ReceiptPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const order = receipt?.order;
  const business = receipt?.business;

  const itemSubtotal = useMemo(() => {
    return (
      order?.items.reduce((sum, item) => sum + Number(item.price || 0) * item.quantity, 0) ||
      0
    );
  }, [order]);

  const deliveryIncluded = useMemo(() => {
    return (
      order?.items.reduce(
        (sum, item) => sum + Number(item.shippingCharge || 0) * item.quantity,
        0,
      ) || 0
    );
  }, [order]);

  const packagingIncluded = useMemo(() => {
    return (
      order?.items.reduce(
        (sum, item) => sum + Number(item.packagingCharge || 0) * item.quantity,
        0,
      ) || 0
    );
  }, [order]);

  useEffect(() => {
    async function loadReceipt() {
      try {
        const response = await fetch(`/api/orders/${orderId}/receipt`, {
          cache: "no-store",
        });
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Could not load receipt.");
          return;
        }

        setReceipt(data.receipt);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load receipt.");
      } finally {
        setLoading(false);
      }
    }

    if (orderId) {
      loadReceipt();
    }
  }, [orderId]);

  if (loading) {
    return (
      <main className="min-h-screen bg-stone-100 px-4 py-10 text-center text-stone-600">
        Loading receipt...
      </main>
    );
  }

  if (error || !order || !business) {
    return (
      <main className="min-h-screen bg-stone-100 px-4 py-10">
        <div className="mx-auto max-w-3xl bg-white p-8 text-center shadow">
          <p className="text-red-600">{error || "Receipt not found."}</p>
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
    <main className="min-h-screen bg-stone-100 px-4 py-8 text-stone-950 print:bg-white print:px-0 print:py-0">
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
          }
          table {
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
        }
      `}</style>

      <div className="no-print mx-auto mb-4 flex max-w-5xl flex-wrap items-center justify-between gap-3">
        <Link href={`/order/${order.id}`} className="text-sm font-bold text-[#6b145d]">
          Back to order
        </Link>
        <button
          onClick={() => window.print()}
          className="bg-[#6b145d] px-5 py-3 text-sm font-bold text-white"
        >
          Print / Save PDF
        </button>
      </div>

      <section className="mx-auto max-w-5xl bg-white p-6 shadow print:max-w-none print:shadow-none md:p-10">
        <header className="grid gap-6 border-b border-stone-200 pb-6 md:grid-cols-[1fr_auto]">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-[#6b145d]">
              Tax Invoice / Order Receipt
            </p>
            <h1 className="mt-3 text-3xl font-black">{business.brandName}</h1>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              {business.legalName}
              {business.registeredAddress ? ` / ${business.registeredAddress}` : ""}
            </p>
            <p className="mt-1 text-sm text-stone-600">
              {business.supportEmail}
              {business.supportPhone ? ` / ${business.supportPhone}` : ""}
            </p>
          </div>

          <div className="text-left md:text-right">
            <p className="text-sm text-stone-500">Invoice No.</p>
            <p className="text-xl font-black">INV-{shortId(order.id)}</p>
            <p className="mt-3 text-sm text-stone-500">Issued</p>
            <p className="font-bold">
              {new Date(receipt.issuedAt).toLocaleDateString()}
            </p>
            <p className="mt-3 text-sm text-stone-500">Order Date</p>
            <p className="font-bold">
              {new Date(order.createdAt).toLocaleDateString()}
            </p>
          </div>
        </header>

        <div className="grid gap-5 border-b border-stone-200 py-6 md:grid-cols-3">
          <section>
            <h2 className="text-sm font-bold uppercase text-stone-500">Bill To</h2>
            <div className="mt-2 text-sm leading-6">
              <p className="font-bold">{order.user?.name || order.shippingName || "Customer"}</p>
              <p>{order.user?.email || "Email not available"}</p>
              <p>{order.shippingPhone || "Phone not saved"}</p>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-bold uppercase text-stone-500">Ship To</h2>
            <div className="mt-2 text-sm leading-6">
              <p>{order.shippingName || order.user?.name || "Customer"}</p>
              <p>{order.shippingAddress || "Address not saved"}</p>
              <p>
                {[order.shippingCity, order.shippingState, order.shippingZipCode]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-bold uppercase text-stone-500">Seller</h2>
            <div className="mt-2 text-sm leading-6">
              <p className="font-bold">{order.vendor?.storeName || business.businessName}</p>
              <p>{order.vendor?.businessAddress || business.registeredAddress}</p>
              <p>{order.vendor?.mobile || business.supportPhone}</p>
            </div>
          </section>
        </div>

        <div className="grid gap-4 border-b border-stone-200 py-5 text-sm md:grid-cols-4">
          <div>
            <p className="text-stone-500">Payment</p>
            <p className="mt-1 font-bold">{order.paymentMethod}</p>
            <p className="text-xs text-stone-500">{order.paymentId || "Payment ID pending"}</p>
          </div>
          <div>
            <p className="text-stone-500">Order Status</p>
            <p className="mt-1 font-bold">{order.status}</p>
          </div>
          <div>
            <p className="text-stone-500">Tracking</p>
            <p className="mt-1 font-bold">{order.trackingNumber || "Not shipped"}</p>
            <p className="text-xs text-stone-500">{order.carrier || ""}</p>
          </div>
          <div>
            <p className="text-stone-500">Tax IDs</p>
            <p className="mt-1 font-bold">GST: {order.vendor?.gstNumber || business.gstNumber || "N/A"}</p>
            <p className="text-xs text-stone-500">
              PAN: {order.vendor?.panNumber || business.panNumber || "N/A"}
            </p>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse text-left text-sm">
            <thead>
              <tr className="bg-stone-100 text-stone-600">
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Order Item Details</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 text-right">Unit Price</th>
                <th className="px-4 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => {
                const details = getOrderItemDetailPairs(item);
                const sku = details.find(([label]) => label === "SKU")?.[1] || item.product?.sku || "-";

                return (
                  <tr key={item.id} className="border-b border-stone-100 align-top">
                    <td className="px-4 py-4 font-semibold">
                      {item.product?.name || "Product"}
                    </td>
                    <td className="px-4 py-4">
                      {details.length ? (
                        <div className="grid gap-1 text-xs text-stone-700 sm:grid-cols-2">
                          {details.map(([label, value]) => (
                            <p key={`${item.id}-${label}`}>
                              <span className="font-bold text-stone-950">{label}:</span> {value}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <span className="text-stone-500">Details not saved</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-stone-600">
                      {sku}
                    </td>
                    <td className="px-4 py-4 text-right">{item.quantity}</td>
                    <td className="px-4 py-4 text-right">{money(item.price)}</td>
                    <td className="px-4 py-4 text-right font-bold">
                      {money(item.price * item.quantity)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-[1fr_320px]">
          <section className="text-sm leading-6 text-stone-600">
            <h2 className="font-bold text-stone-950">Payment / Bank Reference</h2>
            <p className="mt-2">
              Delivery and packaging charges are included in the product price
              wherever applicable.
            </p>
            {(business.settlementUpiId || business.bankName || business.ifscCode) && (
              <div className="mt-3 rounded border border-stone-200 bg-stone-50 p-3">
                <p className="font-semibold text-stone-950">Marketplace payment account</p>
                {business.settlementUpiId && <p>UPI: {business.settlementUpiId}</p>}
                {business.bankName && <p>Bank: {business.bankName}</p>}
                {business.bankAccountName && <p>Account name: {business.bankAccountName}</p>}
                {business.bankAccountNumberMasked && (
                  <p>Account: {business.bankAccountNumberMasked}</p>
                )}
                {business.ifscCode && <p>IFSC: {business.ifscCode}</p>}
              </div>
            )}
          </section>

          <section className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span>Item subtotal</span>
              <span className="font-bold">{money(itemSubtotal)}</span>
            </div>
            <div className="flex justify-between text-stone-600">
              <span>Delivery included</span>
              <span>{money(deliveryIncluded)}</span>
            </div>
            <div className="flex justify-between text-stone-600">
              <span>Packaging included</span>
              <span>{money(packagingIncluded)}</span>
            </div>
            <div className="border-t border-stone-200 pt-3">
              <div className="flex justify-between text-xl font-black">
                <span>Total Paid / Payable</span>
                <span>{money(order.totalAmount)}</span>
              </div>
            </div>
          </section>
        </div>

        <footer className="mt-8 border-t border-stone-200 pt-5 text-xs leading-5 text-stone-500">
          This is a computer-generated receipt for order #{order.id}. For support,
          contact {business.supportEmail || "Zylo-Buylo support"}.
        </footer>
      </section>
    </main>
  );
}
