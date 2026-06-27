"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import Navbar from "@/components/navbar/Navbar";

type Row = {
  product: {
    id: string;
    name: string;
    sku?: string | null;
    images?: string[] | null;
    vendorId: string;
    category?: { name: string } | null;
  };
  variants?: {
    id: string;
    sizeLabel?: string | null;
    numericSize?: string | null;
    color?: string | null;
    sku?: string | null;
    stockQuantity: number;
    price?: number | null;
    mrp?: number | null;
    status: string;
  }[];
  vendor?: { storeName: string; user?: { email: string } } | null;
  inventory: {
    mpn?: string | null;
    currentStock: number;
    reservedStock: number;
    availableStock: number;
    lowStockThreshold: number;
    criticalStockThreshold: number;
    minimumOrderQuantity: number;
    maximumOrderQuantity?: number | null;
    stockStatus: string;
    restockDate?: string | null;
    lastStockUpdatedAt: string;
  };
  signal: { label: string; tone: string };
};

type Data = {
  rows: Row[];
  movements: any[];
  summary: {
    totalProducts: number;
    inStock: number;
    lowStock: number;
    criticalStock: number;
    outOfStock: number;
    alerts: number;
  };
};

const emptyData: Data = {
  rows: [],
  movements: [],
  summary: { totalProducts: 0, inStock: 0, lowStock: 0, criticalStock: 0, outOfStock: 0, alerts: 0 },
};

const statuses = ["ALL", "IN_STOCK", "LOW_STOCK", "CRITICAL_STOCK", "OUT_OF_STOCK", "PRE_ORDER", "BACKORDER"];
const badgeColors: Record<string, string> = {
  green: "bg-green-100 text-green-800",
  orange: "bg-orange-100 text-orange-800",
  red: "bg-red-100 text-red-800",
  gray: "bg-gray-200 text-gray-800",
  blue: "bg-blue-100 text-blue-800",
};

export default function AdminInventoryPage() {
  const [data, setData] = useState<Data>(emptyData);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [sendingReminderId, setSendingReminderId] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ q, status });
    const response = await fetch(`/api/admin/inventory?${params.toString()}`, { cache: "no-store" });
    const result = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(result.error || "Could not load inventory.");
      return;
    }
    setData(result);
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const vendors = useMemo(() => {
    return Array.from(new Set(data.rows.map((row) => row.vendor?.storeName).filter(Boolean)));
  }, [data.rows]);

  async function action(productId: string, body: Record<string, unknown>) {
    setMessage("");
    setError("");
    const isReminder = body.action === "reminder";

    if (isReminder) {
      setSendingReminderId(productId);
    }

    try {
      const response = await fetch("/api/admin/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, ...body }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error || "Inventory action failed.");
        return;
      }
      setMessage(result.message || "Inventory updated.");
      setData({ rows: result.rows || [], movements: result.movements || [], summary: result.summary || emptyData.summary });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Inventory action failed.");
    } finally {
      if (isReminder) {
        setSendingReminderId("");
      }
    }
  }

  function exportReport(format: "csv" | "excel") {
    const params = new URLSearchParams({ q, status, format });
    window.open(`/api/admin/inventory?${params.toString()}`, "_blank");
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <Navbar />
      <section className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-4 py-7">
          <Link href="/admin/dashboard" className="text-sm font-bold text-pink-600">Back to admin dashboard</Link>
          <h1 className="mt-2 text-3xl font-black">Admin Inventory</h1>
          <p className="mt-2 text-sm text-slate-600">Monitor all vendors, low-stock alerts, out-of-stock products and stock movements.</p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-6">
        {message && <p className="mb-4 rounded-xl bg-green-50 p-3 text-sm text-green-700">{message}</p>}
        {error && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ["Total Products", data.summary.totalProducts],
            ["Low Stock", data.summary.lowStock],
            ["Out of Stock", data.summary.outOfStock],
            ["Vendor Alerts", data.summary.alerts],
            ["Need Restock", data.summary.lowStock + data.summary.criticalStock + data.summary.outOfStock],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-black">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-2xl bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
            <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search product, SKU, MPN, vendor" className="rounded-xl border border-slate-300 p-3 text-sm" />
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border border-slate-300 p-3 text-sm">
              {statuses.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}
            </select>
            <button onClick={loadData} className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white">Apply</button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => exportReport("csv")} className="rounded-xl border px-4 py-2 text-sm font-bold">Export CSV</button>
            <button onClick={() => exportReport("excel")} className="rounded-xl border px-4 py-2 text-sm font-bold">Export Excel</button>
            <span className="self-center text-xs text-slate-500">{vendors.length} vendors loaded</span>
          </div>
        </div>

        {loading ? (
          <p className="mt-5 rounded-2xl bg-white py-12 text-center text-slate-500 shadow-sm">Loading inventory...</p>
        ) : (
          <div className="mt-5 overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] text-left text-sm">
                <thead className="bg-slate-100 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="p-3">Product</th>
                    <th className="p-3">Vendor</th>
                    <th className="p-3">SKU / MPN</th>
                    <th className="p-3">Current</th>
                    <th className="p-3">Reserved</th>
                    <th className="p-3">Available</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Updated</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <Fragment key={row.product.id}>
                    <tr className="border-t align-top">
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={row.product.images?.[0] || "https://placehold.co/80x80/png?text=Product"} alt={row.product.name} className="h-14 w-14 rounded-lg object-cover" />
                          <div>
                            <p className="font-bold">{row.product.name}</p>
                            <p className="text-xs text-slate-500">{row.product.category?.name || "-"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <p className="font-bold">{row.vendor?.storeName || "-"}</p>
                        <p className="text-xs text-slate-500">{row.vendor?.user?.email || "-"}</p>
                      </td>
                      <td className="p-3">{row.product.sku || "-"}<br /><span className="text-xs text-slate-500">{row.inventory?.mpn || "-"}</span></td>
                      <td className="p-3 font-bold">{row.inventory?.currentStock || 0}</td>
                      <td className="p-3">{row.inventory?.reservedStock || 0}</td>
                      <td className="p-3 font-bold text-green-700">{row.inventory?.availableStock || 0}</td>
                      <td className="p-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-bold ${badgeColors[row.signal.tone] || badgeColors.gray}`}>
                          {row.signal.label}
                        </span>
                      </td>
                      <td className="p-3 text-xs text-slate-500">{row.inventory?.lastStockUpdatedAt ? new Date(row.inventory.lastStockUpdatedAt).toLocaleString("en-IN") : "-"}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          <input value={quantities[row.product.id] || ""} onChange={(event) => setQuantities((current) => ({ ...current, [row.product.id]: event.target.value }))} type="number" placeholder="Qty" className="w-20 rounded-lg border p-2 text-xs" />
                          <button onClick={() => action(row.product.id, { mode: "ADD", quantity: Number(quantities[row.product.id] || 0) })} className="rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white">Add</button>
                          <button onClick={() => action(row.product.id, { mode: "REMOVE", quantity: Number(quantities[row.product.id] || 0) })} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white">Reduce</button>
                          <button
                            onClick={() => action(row.product.id, { action: "reminder" })}
                            disabled={sendingReminderId === row.product.id}
                            className="rounded-lg border px-3 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {sendingReminderId === row.product.id ? "Sending..." : "Reminder"}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {(row.variants || []).length > 0 && (
                      <tr className="border-t bg-slate-50">
                        <td colSpan={9} className="p-3">
                          <div className="rounded-xl border border-slate-200 bg-white p-3">
                            <div className="mb-2 flex items-center justify-between gap-3">
                              <p className="text-xs font-black uppercase text-slate-500">Variant Stock by Size / Color</p>
                              <p className="text-xs text-slate-500">{row.variants?.length || 0} variants</p>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full min-w-[760px] text-left text-xs">
                                <thead className="bg-slate-100 uppercase text-slate-500">
                                  <tr>
                                    <th className="p-2">Size</th>
                                    <th className="p-2">Color</th>
                                    <th className="p-2">SKU</th>
                                    <th className="p-2">Price</th>
                                    <th className="p-2">Stock</th>
                                    <th className="p-2">Status</th>
                                    <th className="p-2">Admin Update</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(row.variants || []).map((variant) => {
                                    const quantityKey = `variant:${variant.id}`;
                                    return (
                                      <tr key={variant.id} className="border-t">
                                        <td className="p-2 font-bold">
                                          {[variant.sizeLabel, variant.numericSize].filter(Boolean).join(" / ") || "Free size"}
                                        </td>
                                        <td className="p-2">{variant.color || "-"}</td>
                                        <td className="p-2">{variant.sku || "-"}</td>
                                        <td className="p-2">Rs. {Number(variant.price || 0).toLocaleString("en-IN")}</td>
                                        <td className="p-2 font-black">{variant.stockQuantity}</td>
                                        <td className="p-2">
                                          <span className={`rounded-full px-2 py-1 font-bold ${
                                            variant.status === "IN_STOCK"
                                              ? "bg-green-100 text-green-700"
                                              : variant.status === "LOW_STOCK"
                                                ? "bg-orange-100 text-orange-700"
                                                : "bg-red-100 text-red-700"
                                          }`}>
                                            {variant.status.replaceAll("_", " ")}
                                          </span>
                                        </td>
                                        <td className="p-2">
                                          <div className="flex flex-wrap gap-2">
                                            <input
                                              value={quantities[quantityKey] || ""}
                                              onChange={(event) => setQuantities((current) => ({ ...current, [quantityKey]: event.target.value }))}
                                              type="number"
                                              placeholder="Qty"
                                              className="w-20 rounded-lg border p-2 text-xs"
                                            />
                                            <button onClick={() => action(row.product.id, { variantId: variant.id, mode: "ADD", quantity: Number(quantities[quantityKey] || 0) })} className="rounded-lg bg-green-600 px-3 py-2 font-bold text-white">Add</button>
                                            <button onClick={() => action(row.product.id, { variantId: variant.id, mode: "REMOVE", quantity: Number(quantities[quantityKey] || 0) })} className="rounded-lg bg-red-600 px-3 py-2 font-bold text-white">Reduce</button>
                                            <button onClick={() => action(row.product.id, { variantId: variant.id, mode: "SET", quantity: Number(quantities[quantityKey] || 0) })} className="rounded-lg border px-3 py-2 font-bold">Set</button>
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <section className="mt-5 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-lg font-black">Stock Movement History</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase text-slate-500">
                <tr><th className="p-3">Date</th><th className="p-3">Product</th><th className="p-3">Type</th><th className="p-3">Qty</th><th className="p-3">Old</th><th className="p-3">New</th><th className="p-3">Reason</th></tr>
              </thead>
              <tbody>
                {(data.movements || []).slice(0, 80).map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="p-3">{new Date(row.createdAt).toLocaleString("en-IN")}</td>
                    <td className="p-3">{row.productId?.slice(-8)}</td>
                    <td className="p-3 font-bold">{row.type}</td>
                    <td className="p-3">{row.quantity}</td>
                    <td className="p-3">{row.oldStock}</td>
                    <td className="p-3">{row.newStock}</td>
                    <td className="p-3">{row.reason || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}
