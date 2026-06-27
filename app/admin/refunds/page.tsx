"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/navbar/Navbar";

type RefundStatus = "PENDING" | "REFUND_PENDING" | "REJECTED" | "REFUNDED";

type OrderItem = {
  id: string;
  quantity: number;
  price: number;
  product?: {
    id: string;
    name: string;
    sku?: string | null;
    images?: string[] | null;
  } | null;
};

type RefundOrder = {
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

type RefundRequest = {
  id: string;
  orderId: string;
  userId: string;
  reason: string;
  status: RefundStatus;
  adminNote?: string | null;
  refundReference?: string | null;
  createdAt: string;
  updatedAt: string;
  order?: RefundOrder | null;
};

const statuses: Array<"ALL" | RefundStatus> = [
  "ALL",
  "PENDING",
  "REFUND_PENDING",
  "REJECTED",
  "REFUNDED",
];

const statusTones: Record<RefundStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  REFUND_PENDING: "bg-blue-100 text-blue-800",
  REJECTED: "bg-red-100 text-red-800",
  REFUNDED: "bg-green-100 text-green-800",
};

function money(value: number | null | undefined) {
  return `Rs. ${Number(value || 0).toFixed(2)}`;
}

function shortId(id: string) {
  return id.slice(-8).toUpperCase();
}

export default function AdminRefundsPage() {
  const [requests, setRequests] = useState<RefundRequest[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [status, setStatus] = useState<"ALL" | RefundStatus>("ALL");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [references, setReferences] = useState<Record<string, string>>({});

  const totals = useMemo(
    () => ({
      all: Object.values(summary).reduce((sum, count) => sum + count, 0),
      pending: summary.PENDING || 0,
      refundPending: summary.REFUND_PENDING || 0,
      refunded: summary.REFUNDED || 0,
    }),
    [summary],
  );

  async function fetchRefunds() {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (status !== "ALL") {
        params.set("status", status);
      }

      const response = await fetch(`/api/admin/refunds?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Could not fetch return requests.");
        return;
      }

      setRequests(data.requests || []);
      setSummary(data.summary || {});
      setNotes(
        Object.fromEntries(
          (data.requests || []).map((request: RefundRequest) => [
            request.id,
            request.adminNote || "",
          ]),
        ),
      );
      setReferences(
        Object.fromEntries(
          (data.requests || []).map((request: RefundRequest) => [
            request.id,
            request.refundReference || "",
          ]),
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not fetch return requests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRefunds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function updateRefund(request: RefundRequest, nextStatus: RefundStatus) {
    setUpdatingId(request.id);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/admin/refunds/${request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          adminNote: notes[request.id] || "",
          refundReference: references[request.id] || "",
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Refund update failed.");
        return;
      }

      setMessage(data.message || `Return request updated to ${nextStatus}.`);
      await fetchRefunds();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refund update failed.");
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
          <h1 className="mt-3 text-4xl font-bold">Returns & Refunds</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#d8c8af]">
            Review customer return requests, approve refund action and keep a clear
            admin trail for every case.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-white p-5 shadow">
            <p className="text-sm font-semibold text-stone-500">Total Requests</p>
            <p className="mt-2 text-3xl font-bold">{totals.all}</p>
          </div>
          <div className="bg-white p-5 shadow">
            <p className="text-sm font-semibold text-stone-500">Pending Review</p>
            <p className="mt-2 text-3xl font-bold text-[#9c7a34]">
              {totals.pending}
            </p>
          </div>
          <div className="bg-white p-5 shadow">
            <p className="text-sm font-semibold text-stone-500">Refund Pending</p>
            <p className="mt-2 text-3xl font-bold text-blue-700">
              {totals.refundPending}
            </p>
          </div>
          <div className="bg-white p-5 shadow">
            <p className="text-sm font-semibold text-stone-500">Refunded</p>
            <p className="mt-2 text-3xl font-bold text-[#315c48]">
              {totals.refunded}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 bg-white p-4 shadow sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold">Return Queue</h2>
            <p className="text-sm text-stone-500">
              Use refund references from Razorpay, UPI, bank transfer or manual refund.
            </p>
          </div>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as "ALL" | RefundStatus)}
            className="border border-stone-300 px-4 py-3 text-sm outline-none focus:border-[#6b145d]"
          >
            {statuses.map((item) => (
              <option key={item} value={item}>
                {item === "ALL" ? "All Status" : item.replace("_", " ")}
              </option>
            ))}
          </select>
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

        <div className="mt-6 overflow-hidden bg-white shadow">
          {loading ? (
            <p className="py-12 text-center text-stone-500">
              Loading return requests...
            </p>
          ) : requests.length === 0 ? (
            <p className="py-12 text-center text-stone-500">
              No return requests found for this filter.
            </p>
          ) : (
            <div className="divide-y divide-stone-200">
              {requests.map((request) => {
                const order = request.order;

                return (
                  <article key={request.id} className="p-5">
                    <div className="flex flex-col justify-between gap-4 lg:flex-row">
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <h2 className="text-xl font-bold">
                            Return #{shortId(request.id)}
                          </h2>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${statusTones[request.status]}`}
                          >
                            {request.status.replace("_", " ")}
                          </span>
                          <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-700">
                            Order #{shortId(request.orderId)}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-stone-600">
                          Requested {new Date(request.createdAt).toLocaleString()}
                        </p>
                        <p className="mt-1 text-sm text-stone-600">
                          {order?.user?.name || order?.shippingName || "Customer"} /{" "}
                          {order?.user?.email || "Email missing"} /{" "}
                          {order?.shippingPhone || "Phone missing"}
                        </p>
                        <p className="mt-1 text-sm text-stone-600">
                          Vendor: {order?.vendor?.storeName || "Vendor missing"}
                        </p>
                      </div>
                      <div className="text-left lg:text-right">
                        <p className="text-2xl font-bold text-[#315c48]">
                          {money(order?.totalAmount)}
                        </p>
                        <p className="mt-1 text-xs text-stone-500">
                          Payment: {order?.paymentMethod || "Unknown"}
                        </p>
                        <p className="mt-1 text-xs text-stone-500">
                          Ref: {order?.paymentId || "Pending"}
                        </p>
                        <p className="mt-1 text-xs text-stone-500">
                          Order status: {order?.status || "Missing"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_360px]">
                      <div>
                        <div className="border border-stone-200 bg-[#fffaf1] p-4">
                          <p className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">
                            Customer reason
                          </p>
                          <p className="mt-2 text-sm text-stone-800">
                            {request.reason}
                          </p>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          {order?.items?.map((item) => (
                            <div
                              key={item.id}
                              className="flex gap-3 border border-stone-200 p-3"
                            >
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
                                <p className="text-xs text-stone-500">
                                  SKU: {item.product?.sku || "Not set"}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>

                        <p className="mt-4 text-sm text-stone-600">
                          Ship to:{" "}
                          {[
                            order?.shippingAddress,
                            order?.shippingCity,
                            order?.shippingState,
                            order?.shippingZipCode,
                          ]
                            .filter(Boolean)
                            .join(", ") || "Address missing"}
                        </p>
                      </div>

                      <div className="border border-stone-200 p-4">
                        <label className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">
                          Admin note
                        </label>
                        <textarea
                          value={notes[request.id] ?? ""}
                          onChange={(event) =>
                            setNotes((current) => ({
                              ...current,
                              [request.id]: event.target.value,
                            }))
                          }
                          rows={3}
                          placeholder="Reason for approval/rejection or internal note"
                          className="mt-2 w-full border border-stone-300 px-3 py-2 text-sm outline-none focus:border-[#6b145d]"
                        />

                        <label className="mt-4 block text-xs font-bold uppercase tracking-[0.18em] text-stone-500">
                          Refund reference
                        </label>
                        <input
                          value={references[request.id] ?? ""}
                          onChange={(event) =>
                            setReferences((current) => ({
                              ...current,
                              [request.id]: event.target.value,
                            }))
                          }
                          placeholder="Razorpay/UPI/bank refund ID"
                          className="mt-2 w-full border border-stone-300 px-3 py-2 text-sm outline-none focus:border-[#6b145d]"
                        />

                        <div className="mt-4 flex flex-wrap gap-2">
                          {request.status === "PENDING" && (
                            <button
                              onClick={() => updateRefund(request, "REFUND_PENDING")}
                              disabled={updatingId === request.id}
                              className="bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                            >
                              Approve
                            </button>
                          )}
                          {request.status === "REFUND_PENDING" && (
                            <button
                              onClick={() => updateRefund(request, "REFUNDED")}
                              disabled={updatingId === request.id}
                              className="bg-green-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                            >
                              Mark Refunded
                            </button>
                          )}
                          {request.status !== "REFUNDED" && (
                            <button
                              onClick={() => updateRefund(request, "REJECTED")}
                              disabled={updatingId === request.id}
                              className="border border-red-200 px-4 py-2 text-sm font-bold text-red-600 disabled:opacity-60"
                            >
                              Reject
                            </button>
                          )}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2 border-t border-stone-100 pt-4">
                          <Link
                            href={`/order/${request.orderId}`}
                            className="border border-stone-300 px-3 py-2 text-xs font-bold"
                          >
                            Order
                          </Link>
                          <Link
                            href={`/order/${request.orderId}/receipt`}
                            className="border border-stone-300 px-3 py-2 text-xs font-bold"
                          >
                            Receipt
                          </Link>
                          <Link
                            href={`/order/${request.orderId}/shipping-label`}
                            className="border border-stone-300 px-3 py-2 text-xs font-bold"
                          >
                            Shipping Label
                          </Link>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
