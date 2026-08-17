"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type VendorAddress = {
  id: string;
  type: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  isActive: boolean;
};

type VendorWarehouse = {
  id: string;
  code: string;
  name: string;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  addressId?: string | null;
  capacity?: number | null;
  isDefault: boolean;
  isActive: boolean;
  status: string;
  notes?: string | null;
  address?: VendorAddress | null;
};

type WarehouseForm = {
  id: string;
  code: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  addressId: string;
  capacity: string;
  isDefault: boolean;
  notes: string;
};

const emptyForm: WarehouseForm = {
  id: "",
  code: "",
  name: "",
  contactPerson: "",
  phone: "",
  email: "",
  addressId: "",
  capacity: "",
  isDefault: false,
  notes: "",
};

function addressLabel(address?: VendorAddress | null) {
  if (!address) return "No linked address";
  return `${address.type}: ${address.addressLine1}, ${address.city}, ${address.state} ${address.postalCode}`;
}

export default function VendorWarehousesPage() {
  const [warehouses, setWarehouses] = useState<VendorWarehouse[]>([]);
  const [addresses, setAddresses] = useState<VendorAddress[]>([]);
  const [form, setForm] = useState<WarehouseForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const activeWarehouses = useMemo(
    () => warehouses.filter((warehouse) => warehouse.isActive),
    [warehouses],
  );

  async function loadData() {
    setLoading(true);
    setError("");
    const [warehouseResponse, profileResponse] = await Promise.all([
      fetch("/api/vendor/warehouses", { cache: "no-store" }),
      fetch("/api/vendor/profile", { cache: "no-store" }),
    ]);
    const warehouseResult = await warehouseResponse.json();
    const profileResult = await profileResponse.json();
    setLoading(false);

    if (!warehouseResponse.ok) {
      setError(warehouseResult.error || "Could not load warehouses.");
      return;
    }

    setWarehouses(warehouseResult.warehouses || []);
    if (profileResponse.ok) {
      setAddresses(
        (profileResult.user?.vendorProfile?.addresses || []).filter(
          (address: VendorAddress) => address.isActive,
        ),
      );
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function editWarehouse(warehouse: VendorWarehouse) {
    setForm({
      id: warehouse.id,
      code: warehouse.code,
      name: warehouse.name,
      contactPerson: warehouse.contactPerson || "",
      phone: warehouse.phone || "",
      email: warehouse.email || "",
      addressId: warehouse.addressId || "",
      capacity: warehouse.capacity === null || warehouse.capacity === undefined ? "" : String(warehouse.capacity),
      isDefault: warehouse.isDefault,
      notes: warehouse.notes || "",
    });
    setMessage("");
    setError("");
  }

  async function saveWarehouse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    const method = form.id ? "PATCH" : "POST";
    const path = form.id ? `/api/vendor/warehouses/${form.id}` : "/api/vendor/warehouses";
    const response = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: form.code,
        name: form.name,
        contactPerson: form.contactPerson,
        phone: form.phone,
        email: form.email,
        addressId: form.addressId || null,
        capacity: form.capacity,
        isDefault: form.isDefault,
        notes: form.notes,
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error || "Warehouse save failed.");
      return;
    }
    setMessage(form.id ? "Warehouse updated." : "Warehouse created.");
    setForm(emptyForm);
    await loadData();
  }

  async function action(path: string, method = "POST") {
    setMessage("");
    setError("");
    const response = await fetch(path, { method });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error || "Warehouse action failed.");
      return;
    }
    setMessage(result.message || "Warehouse action completed.");
    await loadData();
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-950">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/vendor/dashboard" className="text-sm font-bold text-pink-700">
              Back to vendor dashboard
            </Link>
            <h1 className="mt-2 text-3xl font-black">Warehouses</h1>
            <p className="text-sm text-slate-600">
              Manage pickup, packing and fulfilment locations for your store.
            </p>
          </div>
          <div className="border bg-white px-4 py-3 text-sm font-bold">
            {activeWarehouses.length} active / {warehouses.length} total
          </div>
        </div>

        {loading && <p>Loading warehouses...</p>}
        {error && <p className="mb-4 border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
        {message && <p className="mb-4 border border-green-200 bg-green-50 p-3 text-sm font-bold text-green-700">{message}</p>}

        <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
          <section className="border bg-white p-5">
            <h2 className="text-xl font-black">{form.id ? "Edit Warehouse" : "Create Warehouse"}</h2>
            <form onSubmit={saveWarehouse} className="mt-4 space-y-3">
              <input className="w-full border p-3" placeholder="Code, e.g. DEL-NORTH" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} />
              <input className="w-full border p-3" placeholder="Warehouse name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              <input className="w-full border p-3" placeholder="Contact person" value={form.contactPerson} onChange={(event) => setForm({ ...form, contactPerson: event.target.value })} />
              <input className="w-full border p-3" placeholder="Phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
              <input className="w-full border p-3" placeholder="Email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
              <select className="w-full border p-3" value={form.addressId} onChange={(event) => setForm({ ...form, addressId: event.target.value })}>
                <option value="">No linked address</option>
                {addresses.map((address) => (
                  <option key={address.id} value={address.id}>
                    {addressLabel(address)}
                  </option>
                ))}
              </select>
              <input className="w-full border p-3" placeholder="Capacity" value={form.capacity} onChange={(event) => setForm({ ...form, capacity: event.target.value })} />
              <textarea className="min-h-24 w-full border p-3" placeholder="Notes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
              <label className="flex items-center gap-2 text-sm font-bold">
                <input type="checkbox" checked={form.isDefault} onChange={(event) => setForm({ ...form, isDefault: event.target.checked })} />
                Default warehouse
              </label>
              <div className="flex gap-2">
                <button className="flex-1 bg-black px-4 py-3 font-bold text-white">
                  {form.id ? "Save Changes" : "Create Warehouse"}
                </button>
                {form.id && (
                  <button type="button" className="border px-4 py-3 font-bold" onClick={() => setForm(emptyForm)}>
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </section>

          <section className="border bg-white p-5">
            <h2 className="text-xl font-black">Warehouse List</h2>
            <div className="mt-4 grid gap-3">
              {warehouses.length === 0 ? (
                <p className="border bg-slate-50 p-4 text-sm">No warehouses added yet.</p>
              ) : (
                warehouses.map((warehouse) => (
                  <div key={warehouse.id} className="border bg-slate-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-black">{warehouse.name}</h3>
                          {warehouse.isDefault && <span className="bg-black px-2 py-1 text-xs font-bold text-white">DEFAULT</span>}
                          <span className="border px-2 py-1 text-xs font-bold">{warehouse.status}</span>
                          <span className={`px-2 py-1 text-xs font-bold ${warehouse.isActive ? "bg-green-100 text-green-800" : "bg-stone-200 text-stone-700"}`}>
                            {warehouse.isActive ? "ACTIVE" : "INACTIVE"}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-600">{warehouse.code}</p>
                        <p className="mt-2 text-sm">{addressLabel(warehouse.address)}</p>
                        <p className="mt-1 text-sm text-slate-600">
                          {warehouse.contactPerson || "No contact"} {warehouse.phone ? `- ${warehouse.phone}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button className="border px-3 py-2 text-xs font-bold" onClick={() => editWarehouse(warehouse)}>Edit</button>
                        {!warehouse.isDefault && warehouse.isActive && (
                          <button className="border px-3 py-2 text-xs font-bold" onClick={() => action(`/api/vendor/warehouses/${warehouse.id}/default`)}>
                            Set Default
                          </button>
                        )}
                        {warehouse.isActive && (
                          <button className="border border-red-300 px-3 py-2 text-xs font-bold text-red-700" onClick={() => action(`/api/vendor/warehouses/${warehouse.id}`, "DELETE")}>
                            Deactivate
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
