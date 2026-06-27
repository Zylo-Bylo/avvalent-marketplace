"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/navbar/Navbar";

type OrderStatus =
  | "PENDING"
  | "PAID"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "RETURNED";

type OrderItem = {
  id: string;
  variantId?: string | null;
  sizeLabel?: string | null;
  numericSize?: string | null;
  variantColor?: string | null;
  variantSku?: string | null;
  quantity: number;
  price: number;
  vendorPayout?: number | null;
  platformCommissionAmount?: number | null;
  packagingCharge?: number | null;
  shippingCharge?: number | null;
  product?: {
    id: string;
    name: string;
    images?: string[] | null;
    sku?: string | null;
  } | null;
};

type Order = {
  id: string;
  totalAmount: number;
  status: OrderStatus;
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
  createdAt: string;
  user?: {
    name: string;
    email: string;
  } | null;
  vendor?: {
    storeName: string;
    mobile?: string | null;
  } | null;
  items: OrderItem[];
};

type SummaryItem = {
  status: OrderStatus;
  count: number;
  totalAmount: number;
};

const statuses: Array<"ALL" | OrderStatus> = [
  "ALL",
  "PENDING",
  "PAID",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
];

const statusTones: Record<OrderStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  PAID: "bg-blue-100 text-blue-800",
  SHIPPED: "bg-purple-100 text-purple-800",
  DELIVERED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
  RETURNED: "bg-stone-200 text-stone-800",
};

const courierCompanies = [
  "Delhivery",
  "Blue Dart",
  "DTDC",
  "Ekart Logistics",
  "Ecom Express",
  "XpressBees",
  "India Post",
  "Shadowfax",
  "Amazon Shipping",
  "Shiprocket",
  "DHL",
  "FedEx",
  "Aramex",
  "Porter",
  "Local Courier",
];

function money(value: number | null | undefined) {
  return `Rs. ${Number(value || 0).toFixed(2)}`;
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<SummaryItem[]>([]);
  const [status, setStatus] = useState<"ALL" | OrderStatus>("ALL");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [tracking, setTracking] = useState<Record<string, string>>({});
  const [carrier, setCarrier] = useState<Record<string, string>>({});
  const [paymentIds, setPaymentIds] = useState<Record<string, string>>({});

  const totals = useMemo(() => {
    return summary.reduce(
      (result, item) => ({
        count: result.count + item.count,
        amount: result.amount + item.totalAmount,
      }),
      { count: 0, amount: 0 },
    );
  }, [summary]);

  async function fetchOrders() {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (status !== "ALL") {
        params.set("status", status);
      }
      if (paymentMethod) {
        params.set("paymentMethod", paymentMethod);
      }
      if (query.trim()) {
        params.set("q", query.trim());
      }

      const response = await fetch(`/api/admin/orders?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Could not fetch orders.");
        return;
      }

      setOrders(data.orders || []);
      setSummary(data.summary || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not fetch orders.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, paymentMethod]);

  async function updateOrder(order: Order, nextStatus: OrderStatus) {
    const nextTrackingNumber = tracking[order.id] || order.trackingNumber || "";
    const nextCarrier = carrier[order.id] || order.carrier || "";

    if (nextStatus === "SHIPPED" && (!nextTrackingNumber.trim() || !nextCarrier.trim())) {
      setError("Please enter courier company and tracking number before marking shipped.");
      return;
    }

    setUpdatingId(order.id);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          trackingNumber: nextTrackingNumber,
          carrier: nextCarrier,
          paymentId: paymentIds[order.id] || order.paymentId || "",
          statusNote:
            nextStatus === "PAID"
              ? "Payment verified by admin."
              : nextStatus === "SHIPPED"
                ? "Shipment updated by admin."
                : "",
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Order update failed.");
        return;
      }

      setOrders((currentOrders) =>
        currentOrders.map((currentOrder) =>
          currentOrder.id === order.id ? data.order : currentOrder,
        ),
      );
      setMessage(`Order #${order.id.slice(-8)} updated to ${nextStatus}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Order update failed.");
    } finally {
      setUpdatingId("");
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f2ea] text-stone-950">
      <Navbar />

      <section className="border-b border-stone-200 bg-[#17130f] text-[#f8efe2]">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <Link href="/admin/dashboard" className="text-sm font-semibold text-[#d6b36a]">
            Back to dashboard
          </Link>
          <h1 className="mt-3 text-4xl font-bold">Admin Orders</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#d8c8af]">
            Manage customer orders, payment verification, shipment and delivery
            from one control panel.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="bg-white p-5 shadow">
            <p className="text-sm font-semibold text-stone-500">Total Orders</p>
            <p className="mt-2 text-3xl font-bold">{totals.count}</p>
          </div>
          <div className="bg-white p-5 shadow lg:col-span-2">
            <p className="text-sm font-semibold text-stone-500">Total Amount</p>
            <p className="mt-2 text-3xl font-bold text-[#315c48]">
              {money(totals.amount)}
            </p>
          </div>
          {summary.slice(0, 2).map((item) => (
            <div key={item.status} className="bg-white p-5 shadow">
              <p className="text-sm font-semibold text-stone-500">{item.status}</p>
              <p className="mt-2 text-3xl font-bold">{item.count}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-3 bg-white p-4 shadow md:grid-cols-[1fr_180px_180px_auto]">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                fetchOrders();
              }
            }}
            placeholder="Search order ID, customer, phone, vendor, payment ID"
            className="border border-stone-300 px-4 py-3 text-sm outline-none focus:border-[#6b145d]"
          />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as "ALL" | OrderStatus)}
            className="border border-stone-300 px-4 py-3 text-sm outline-none focus:border-[#6b145d]"
          >
            {statuses.map((item) => (
              <option key={item} value={item}>
                {item === "ALL" ? "All Status" : item}
              </option>
            ))}
          </select>
          <select
            value={paymentMethod}
            onChange={(event) => setPaymentMethod(event.target.value)}
            className="border border-stone-300 px-4 py-3 text-sm outline-none focus:border-[#6b145d]"
          >
            <option value="">All Payments</option>
            <option value="COD">COD</option>
            <option value="UPI">UPI</option>
            <option value="RAZORPAY">Razorpay</option>
            <option value="STRIPE">Stripe</option>
          </select>
          <button
            onClick={fetchOrders}
            className="bg-[#6b145d] px-5 py-3 text-sm font-bold text-white"
          >
            Search
          </button>
        </div>

        {message && (
          <p className="mt-5 border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            {message}
          </p>
        )}
        {error && (
          <p className="mt-5 border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </p>
        )}

        <datalist id="admin-courier-companies">
          {courierCompanies.map((company) => (
            <option key={company} value={company} />
          ))}
        </datalist>

        <div className="mt-6 overflow-hidden bg-white shadow">
          {loading ? (
            <p className="py-12 text-center text-stone-500">Loading orders...</p>
          ) : orders.length === 0 ? (
            <p className="py-12 text-center text-stone-500">
              No orders found for this filter.
            </p>
          ) : (
            <div className="divide-y divide-stone-200">
              {orders.map((order) => (
                <article key={order.id} className="p-5">
                  <div className="flex flex-col justify-between gap-4 lg:flex-row">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-xl font-bold">
                          Order #{order.id.slice(-8)}
                        </h2>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${statusTones[order.status]}`}
                        >
                          {order.status}
                        </span>
                        <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-700">
                          {order.paymentMethod}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-stone-600">
                        {new Date(order.createdAt).toLocaleString()} /{" "}
                        {order.vendor?.storeName || "Vendor missing"}
                      </p>
                      <p className="mt-1 text-sm text-stone-600">
                        {order.user?.name || order.shippingName || "Customer"} /{" "}
                        {order.user?.email || "Email missing"} /{" "}
                        {order.shippingPhone || "Phone missing"}
                      </p>
                      <p className="mt-1 text-sm text-stone-600">
                        {[order.shippingAddress, order.shippingCity, order.shippingState, order.shippingZipCode]
                          .filter(Boolean)
                          .join(", ") || "Address missing"}
                      </p>
                    </div>
                    <div className="text-left lg:text-right">
                      <p className="text-2xl font-bold text-[#315c48]">
                        {money(order.totalAmount)}
                      </p>
                      <p className="mt-1 text-xs text-stone-500">
                        Payment ID: {order.paymentId || "Pending"}
                      </p>
                      <p className="mt-1 text-xs text-stone-500">
                        Tracking: {order.trackingNumber || "Not shipped"}
                      </p>
                    </div>
                  </div>

                  {order.statusNote && (
                    <p className="mt-4 border-l-4 border-[#d6b36a] bg-[#fffaf1] px-4 py-3 text-sm text-stone-700">
                      {order.statusNote}
                    </p>
                  )}

                  <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex gap-3 border border-stone-200 p-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={
                            item.product?.images?.[0] ||
                            "https://placehold.co/80x80/png?text=Product"
                          }
                          alt={item.product?.name || "Product"}
                          className="h-16 w-16 bg-stone-100 object-cover"
                        />
                        <div className="min-w-0">
                          <p className="truncate font-semibold">
                            {item.product?.name || "Product"}
                          </p>
                          <p className="text-xs text-stone-500">
                            Qty {item.quantity} / {money(item.price)}
                          </p>
                          {(item.sizeLabel || item.numericSize || item.variantColor || item.variantSku) && (
                            <p className="text-xs font-semibold text-[#6b145d]">
                              {[item.sizeLabel, item.numericSize && `Size ${item.numericSize}`, item.variantColor, item.variantSku && `SKU ${item.variantSku}`]
                                .filter(Boolean)
                                .join(" / ")}
                            </p>
                          )}
                          <p className="text-xs text-stone-500">
                            Payout {money(item.vendorPayout)} / Commission{" "}
                            {money(item.platformCommissionAmount)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 grid gap-3 border-t border-stone-100 pt-4 md:grid-cols-3">
                    <input
                      value={paymentIds[order.id] ?? order.paymentId ?? ""}
                      onChange={(event) =>
                        setPaymentIds((current) => ({
                          ...current,
                          [order.id]: event.target.value,
                        }))
                      }
                      placeholder="Payment reference ID"
                      className="border border-stone-300 px-4 py-3 text-sm outline-none focus:border-[#6b145d]"
                    />
                    <input
                      value={tracking[order.id] ?? order.trackingNumber ?? ""}
                      onChange={(event) =>
                        setTracking((current) => ({
                          ...current,
                          [order.id]: event.target.value,
                        }))
                      }
                      placeholder="Tracking number"
                      className="border border-stone-300 px-4 py-3 text-sm outline-none focus:border-[#6b145d]"
                    />
                    <input
                      list="admin-courier-companies"
                      value={carrier[order.id] ?? order.carrier ?? ""}
                      onChange={(event) =>
                        setCarrier((current) => ({
                          ...current,
                          [order.id]: event.target.value,
                        }))
                      }
                      placeholder="Courier company"
                      className="border border-stone-300 px-4 py-3 text-sm outline-none focus:border-[#6b145d]"
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {order.status === "PENDING" && (
                      <button
                        onClick={() => updateOrder(order, "PAID")}
                        disabled={updatingId === order.id}
                        className="bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                      >
                        Mark Paid
                      </button>
                    )}
                    {["PENDING", "PAID"].includes(order.status) && (
                      <button
                        onClick={() => updateOrder(order, "SHIPPED")}
                        disabled={updatingId === order.id}
                        className="bg-purple-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                      >
                        Mark Shipped
                      </button>
                    )}
                    {order.status === "SHIPPED" && (
                      <button
                        onClick={() => updateOrder(order, "DELIVERED")}
                        disabled={updatingId === order.id}
                        className="bg-green-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                      >
                        Mark Delivered
                      </button>
                    )}
                    {!["DELIVERED", "CANCELLED", "RETURNED"].includes(order.status) && (
                      <button
                        onClick={() => updateOrder(order, "CANCELLED")}
                        disabled={updatingId === order.id}
                        className="border border-red-200 px-4 py-2 text-sm font-bold text-red-600 disabled:opacity-60"
                      >
                        Cancel
                      </button>
                    )}
                    <Link
                      href={`/order/${order.id}`}
                      className="border border-stone-300 px-4 py-2 text-sm font-bold"
                    >
                      Customer View
                    </Link>
                    <Link
                      href={`/order/${order.id}/receipt`}
                      className="border border-stone-300 px-4 py-2 text-sm font-bold"
                    >
                      Receipt
                    </Link>
                    <Link
                      href={`/order/${order.id}/shipping-label`}
                      className="border border-stone-300 px-4 py-2 text-sm font-bold"
                    >
                      Shipping Label
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
