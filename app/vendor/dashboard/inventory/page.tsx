"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import Navbar from "@/components/navbar/Navbar";

type InventoryRow = {
  product: {
    id: string;
    name: string;
    sku?: string | null;
    images?: string[] | null;
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
  inventory: {
    warehouseId?: string | null;
    mpn?: string | null;
    damagedStock?: number;
    currentStock: number;
    reservedStock: number;
    availableStock: number;
    lowStockThreshold: number;
    criticalStockThreshold: number;
    minimumOrderQuantity: number;
    maximumOrderQuantity?: number | null;
    restockDate?: string | null;
    stockStatus: string;
    allowBackorder: boolean;
    isPreOrder: boolean;
    lastStockUpdatedAt: string;
  };
  warehouse?: Warehouse | null;
  signal: { label: string; tone: string };
};

type Warehouse = {
  id: string;
  code: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  status: string;
};

type InventoryData = {
  rows: InventoryRow[];
  movements: any[];
  warehouses: Warehouse[];
  summary: {
    totalProducts: number;
    inStock: number;
    lowStock: number;
    criticalStock: number;
    outOfStock: number;
    alerts: number;
  };
};

const emptyData: InventoryData = {
  rows: [],
  movements: [],
  warehouses: [],
  summary: { totalProducts: 0, inStock: 0, lowStock: 0, criticalStock: 0, outOfStock: 0, alerts: 0 },
};

const badgeColors: Record<string, string> = {
  green: "bg-green-100 text-green-800",
  orange: "bg-orange-100 text-orange-800",
  red: "bg-red-100 text-red-800",
  gray: "bg-gray-200 text-gray-800",
  blue: "bg-blue-100 text-blue-800",
};

const statusOptions = [
  "ALL",
  "IN_STOCK",
  "LOW_STOCK",
  "CRITICAL_STOCK",
  "OUT_OF_STOCK",
  "PRE_ORDER",
  "BACKORDER",
];

export default function VendorInventoryPage() {
  const [data, setData] = useState<InventoryData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [warehouseFilter, setWarehouseFilter] = useState("ALL");
  const [stockFilter, setStockFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("UPDATED_DESC");

  async function loadData() {
    setLoading(true);
    setError("");
    const response = await fetch("/api/vendor/inventory", { cache: "no-store" });
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
  }, []);

  const categories = useMemo(() => {
    return Array.from(
      new Set(
        data.rows
          .map((row) => row.product.category?.name)
          .filter((name): name is string => Boolean(name)),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [data.rows]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rows = data.rows.filter((row) => {
      const inventory = row.inventory;
      const availableStock = Number(inventory?.availableStock || 0);
      const reservedStock = Number(inventory?.reservedStock || 0);
      const matchesSearch =
        !query ||
        [
          row.product.name,
          row.product.sku,
          ...(row.variants || []).flatMap((variant) => [
            variant.sku,
            variant.sizeLabel,
            variant.numericSize,
            variant.color,
            variant.status,
          ]),
          inventory?.mpn,
          row.product.category?.name,
          inventory?.stockStatus,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      const matchesStatus =
        statusFilter === "ALL" || inventory?.stockStatus === statusFilter;
      const matchesCategory =
        categoryFilter === "ALL" || row.product.category?.name === categoryFilter;
      const matchesWarehouse =
        warehouseFilter === "ALL" ||
        (warehouseFilter === "UNASSIGNED" && !inventory?.warehouseId) ||
        inventory?.warehouseId === warehouseFilter;
      const matchesStock =
        stockFilter === "ALL" ||
        (stockFilter === "AVAILABLE" && availableStock > 0) ||
        (stockFilter === "RESERVED" && reservedStock > 0) ||
        (stockFilter === "LOW_OR_CRITICAL" &&
          ["LOW_STOCK", "CRITICAL_STOCK"].includes(inventory?.stockStatus || "")) ||
        (stockFilter === "OUT" && inventory?.stockStatus === "OUT_OF_STOCK") ||
        (stockFilter === "PREORDER_BACKORDER" &&
          ["PRE_ORDER", "BACKORDER"].includes(inventory?.stockStatus || ""));

      return matchesSearch && matchesStatus && matchesCategory && matchesWarehouse && matchesStock;
    });

    return [...rows].sort((a, b) => {
      const aInventory = a.inventory;
      const bInventory = b.inventory;
      if (sortBy === "NAME_ASC") {
        return a.product.name.localeCompare(b.product.name);
      }
      if (sortBy === "AVAILABLE_ASC") {
        return Number(aInventory?.availableStock || 0) - Number(bInventory?.availableStock || 0);
      }
      if (sortBy === "AVAILABLE_DESC") {
        return Number(bInventory?.availableStock || 0) - Number(aInventory?.availableStock || 0);
      }
      if (sortBy === "CURRENT_ASC") {
        return Number(aInventory?.currentStock || 0) - Number(bInventory?.currentStock || 0);
      }
      return (
        new Date(bInventory?.lastStockUpdatedAt || 0).getTime() -
        new Date(aInventory?.lastStockUpdatedAt || 0).getTime()
      );
    });
  }, [categoryFilter, data.rows, search, sortBy, statusFilter, stockFilter, warehouseFilter]);

  const movementRows = useMemo(() => data.movements || [], [data.movements]);

  async function action(productId: string, body: Record<string, unknown>, method = "POST") {
    setMessage("");
    setError("");
    const response = await fetch("/api/vendor/inventory", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, ...body }),
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error || "Inventory action failed.");
      return;
    }
    setMessage(result.message || "Inventory updated.");
    setData({
      rows: result.rows || [],
      movements: result.movements || [],
      warehouses: result.warehouses || [],
      summary: result.summary || emptyData.summary,
    });
  }

  function exportCsv() {
    const header = ["Product Name", "Warehouse", "SKU", "MPN", "Current Stock", "Reserved Stock", "Damaged Stock", "Available Stock", "Status", "Last Updated"];
    const csv = [
      header.join(","),
      ...filteredRows.map((row) =>
        [
          row.product.name,
          row.warehouse ? `${row.warehouse.name} (${row.warehouse.code})` : "Unassigned",
          row.product.sku || "",
          row.inventory?.mpn || "",
          row.inventory?.currentStock || 0,
          row.inventory?.reservedStock || 0,
          row.inventory?.damagedStock || 0,
          row.inventory?.availableStock || 0,
          row.inventory?.stockStatus || "",
          row.inventory?.lastStockUpdatedAt || "",
        ].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    link.download = "zylo-buylo-vendor-inventory.csv";
    link.click();
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <Navbar />
      <section className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-4 py-7">
          <Link href="/vendor/dashboard" className="text-sm font-bold text-pink-600">Back to vendor dashboard</Link>
          <h1 className="mt-2 text-3xl font-black">Stock Management</h1>
          <p className="mt-2 text-sm text-slate-600">Track available, reserved, low, critical and out-of-stock products.</p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-6">
        {message && <p className="mb-4 rounded-xl bg-green-50 p-3 text-sm text-green-700">{message}</p>}
        {error && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Total Products", data.summary.totalProducts],
            ["In Stock", data.summary.inStock],
            ["Low Stock", data.summary.lowStock],
            ["Critical", data.summary.criticalStock],
            ["Out of Stock", data.summary.outOfStock],
          ].map(([label, value]) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                if (label === "In Stock") setStatusFilter("IN_STOCK");
                if (label === "Low Stock") setStatusFilter("LOW_STOCK");
                if (label === "Critical") setStatusFilter("CRITICAL_STOCK");
                if (label === "Out of Stock") setStatusFilter("OUT_OF_STOCK");
                if (label === "Total Products") {
                  setStatusFilter("ALL");
                  setStockFilter("ALL");
                }
              }}
              className="rounded-2xl bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow"
            >
              <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-black">{value}</p>
            </button>
          ))}
        </div>

        <div className="mt-5 rounded-2xl bg-white p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_170px_170px_190px_190px_180px]">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search product, SKU, MPN, category, status"
              className="rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-pink-500"
            />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-pink-500"
            >
              {statusOptions.map((item) => (
                <option key={item} value={item}>{item.replaceAll("_", " ")}</option>
              ))}
            </select>
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-pink-500"
            >
              <option value="ALL">All Categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <select
              value={stockFilter}
              onChange={(event) => setStockFilter(event.target.value)}
              className="rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-pink-500"
            >
              <option value="ALL">All Stock</option>
              <option value="AVAILABLE">Available Stock</option>
              <option value="RESERVED">Reserved Stock</option>
              <option value="LOW_OR_CRITICAL">Low / Critical</option>
              <option value="OUT">Out of Stock</option>
              <option value="PREORDER_BACKORDER">Pre-order / Backorder</option>
            </select>
            <select
              value={warehouseFilter}
              onChange={(event) => setWarehouseFilter(event.target.value)}
              className="rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-pink-500"
            >
              <option value="ALL">All Warehouses</option>
              <option value="UNASSIGNED">Unassigned</option>
              {data.warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name} ({warehouse.code})
                </option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              className="rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-pink-500"
            >
              <option value="UPDATED_DESC">Recently Updated</option>
              <option value="NAME_ASC">Name A-Z</option>
              <option value="AVAILABLE_ASC">Available Low First</option>
              <option value="AVAILABLE_DESC">Available High First</option>
              <option value="CURRENT_ASC">Current Low First</option>
            </select>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button onClick={exportCsv} className="rounded-xl border px-4 py-2 text-sm font-bold">Export Filtered CSV</button>
            <Link href="/vendor/dashboard/upload" className="rounded-xl bg-pink-600 px-4 py-2 text-sm font-bold text-white">Add Product</Link>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setStatusFilter("ALL");
                setCategoryFilter("ALL");
                setWarehouseFilter("ALL");
                setStockFilter("ALL");
                setSortBy("UPDATED_DESC");
              }}
              className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold"
            >
              Reset Filters
            </button>
            <span className="text-xs font-semibold text-slate-500">
              Showing {filteredRows.length} of {data.rows.length} products
            </span>
          </div>
        </div>

        {loading ? (
          <p className="mt-5 rounded-2xl bg-white py-12 text-center text-slate-500 shadow-sm">Loading inventory...</p>
        ) : (
          <div className="mt-5 overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1240px] text-left text-sm">
                <thead className="bg-slate-100 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="p-3">Product</th>
                    <th className="p-3">SKU / MPN</th>
                    <th className="p-3">Warehouse</th>
                    <th className="p-3">Current</th>
                    <th className="p-3">Reserved</th>
                    <th className="p-3">Damaged</th>
                    <th className="p-3">Available</th>
                    <th className="p-3">Thresholds</th>
                    <th className="p-3">MOQ / Max</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => {
                    const productSettings = settings[row.product.id] || row.inventory || {};
                    return (
                      <Fragment key={row.product.id}>
                      <tr key={row.product.id} className="border-t align-top">
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={row.product.images?.[0] || "/product-placeholder.svg"} alt={row.product.name} className="h-14 w-14 rounded-lg object-cover" />
                            <div>
                              <p className="font-bold">{row.product.name}</p>
                              <p className="text-xs text-slate-500">{row.product.category?.name || "No category"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <p>{row.product.sku || "-"}</p>
                          <input
                            value={productSettings.mpn || ""}
                            onChange={(event) => setSettings((current) => ({ ...current, [row.product.id]: { ...productSettings, mpn: event.target.value } }))}
                            placeholder="MPN"
                            className="mt-2 w-28 rounded-lg border p-2 text-xs"
                          />
                        </td>
                        <td className="p-3">
                          <select
                            value={productSettings.warehouseId ?? row.inventory?.warehouseId ?? ""}
                            onChange={(event) =>
                              setSettings((current) => ({
                                ...current,
                                [row.product.id]: { ...productSettings, warehouseId: event.target.value || null },
                              }))
                            }
                            className="w-44 rounded-lg border p-2 text-xs"
                          >
                            <option value="">Unassigned</option>
                            {data.warehouses.map((warehouse) => (
                              <option key={warehouse.id} value={warehouse.id}>
                                {warehouse.name} ({warehouse.code})
                              </option>
                            ))}
                          </select>
                          <p className="mt-1 text-[11px] text-slate-500">
                            {row.warehouse ? `${row.warehouse.name} (${row.warehouse.code})` : "No warehouse"}
                          </p>
                        </td>
                        <td className="p-3 font-bold">{row.inventory?.currentStock || 0}</td>
                        <td className="p-3">{row.inventory?.reservedStock || 0}</td>
                        <td className="p-3 text-red-700">{row.inventory?.damagedStock || 0}</td>
                        <td className="p-3 font-bold text-green-700">{row.inventory?.availableStock || 0}</td>
                        <td className="p-3">
                          <input type="number" value={productSettings.lowStockThreshold ?? 10} onChange={(event) => setSettings((current) => ({ ...current, [row.product.id]: { ...productSettings, lowStockThreshold: event.target.value } }))} className="mb-1 w-20 rounded-lg border p-2 text-xs" />
                          <input type="number" value={productSettings.criticalStockThreshold ?? 3} onChange={(event) => setSettings((current) => ({ ...current, [row.product.id]: { ...productSettings, criticalStockThreshold: event.target.value } }))} className="w-20 rounded-lg border p-2 text-xs" />
                        </td>
                        <td className="p-3">
                          <input type="number" value={productSettings.minimumOrderQuantity ?? 1} onChange={(event) => setSettings((current) => ({ ...current, [row.product.id]: { ...productSettings, minimumOrderQuantity: event.target.value } }))} className="mb-1 w-20 rounded-lg border p-2 text-xs" />
                          <input type="number" value={productSettings.maximumOrderQuantity ?? ""} onChange={(event) => setSettings((current) => ({ ...current, [row.product.id]: { ...productSettings, maximumOrderQuantity: event.target.value } }))} placeholder="Max" className="w-20 rounded-lg border p-2 text-xs" />
                        </td>
                        <td className="p-3">
                          <span className={`rounded-full px-2 py-1 text-xs font-bold ${badgeColors[row.signal.tone] || badgeColors.gray}`}>{row.signal.label}</span>
                          <label className="mt-3 flex items-center gap-2 text-xs">
                            <input type="checkbox" checked={Boolean(productSettings.isPreOrder)} onChange={(event) => setSettings((current) => ({ ...current, [row.product.id]: { ...productSettings, isPreOrder: event.target.checked } }))} />
                            Pre-order
                          </label>
                          <label className="mt-1 flex items-center gap-2 text-xs">
                            <input type="checkbox" checked={Boolean(productSettings.allowBackorder)} onChange={(event) => setSettings((current) => ({ ...current, [row.product.id]: { ...productSettings, allowBackorder: event.target.checked } }))} />
                            Backorder
                          </label>
                        </td>
                        <td className="p-3">
                          <div className="flex gap-2">
                            <input value={quantities[row.product.id] || ""} onChange={(event) => setQuantities((current) => ({ ...current, [row.product.id]: event.target.value }))} type="number" placeholder="Qty" className="w-20 rounded-lg border p-2 text-xs" />
                            <button onClick={() => action(row.product.id, { mode: "ADD", quantity: Number(quantities[row.product.id] || 0), warehouseId: productSettings.warehouseId ?? row.inventory?.warehouseId ?? null, reasonCode: "STOCK_IN" })} className="rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white">Add</button>
                            <button onClick={() => action(row.product.id, { mode: "REMOVE", quantity: Number(quantities[row.product.id] || 0), warehouseId: productSettings.warehouseId ?? row.inventory?.warehouseId ?? null, reasonCode: "STOCK_OUT" })} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white">Reduce</button>
                            <button onClick={() => action(row.product.id, { mode: "DAMAGE", quantity: Number(quantities[row.product.id] || 0), warehouseId: productSettings.warehouseId ?? row.inventory?.warehouseId ?? null, reasonCode: "DAMAGED_STOCK" })} className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white">Damage</button>
                          </div>
                          <button onClick={() => action(row.product.id, productSettings, "PATCH")} className="mt-2 rounded-lg border px-3 py-2 text-xs font-bold">Save Settings</button>
                        </td>
                      </tr>
                      {(row.variants || []).length > 0 && (
                        <tr key={`${row.product.id}-variants`} className="border-t bg-slate-50">
                          <td colSpan={11} className="p-3">
                            <div className="rounded-xl border border-slate-200 bg-white p-3">
                              <div className="mb-2 flex items-center justify-between gap-3">
                                <p className="text-xs font-black uppercase text-slate-500">Size / Color Variant Stock</p>
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
                                      <th className="p-2">Update</th>
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
                    );
                  })}
                  {filteredRows.length === 0 && (
                    <tr>
                      <td colSpan={11} className="p-8 text-center text-sm text-slate-500">
                        No products match these filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <section className="mt-5 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-lg font-black">Recent Stock History</h2>
          <div className="mt-3 max-h-96 overflow-auto">
            {movementRows.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">No stock movements yet.</p>
            ) : (
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="bg-slate-100 text-xs uppercase text-slate-500">
                  <tr><th className="p-3">Date</th><th className="p-3">Warehouse</th><th className="p-3">Type</th><th className="p-3">Reason Code</th><th className="p-3">Quantity</th><th className="p-3">Old</th><th className="p-3">New</th><th className="p-3">Reason</th></tr>
                </thead>
                <tbody>
                  {movementRows.map((row) => (
                    <tr key={row.id} className="border-t">
                      <td className="p-3">{new Date(row.createdAt).toLocaleString("en-IN")}</td>
                      <td className="p-3">{row.warehouse ? `${row.warehouse.name} (${row.warehouse.code})` : "Unassigned"}</td>
                      <td className="p-3 font-bold">{row.type}</td>
                      <td className="p-3">{row.reasonCode || "-"}</td>
                      <td className="p-3">{row.quantity}</td>
                      <td className="p-3">{row.oldStock}</td>
                      <td className="p-3">{row.newStock}</td>
                      <td className="p-3">{row.reason || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
