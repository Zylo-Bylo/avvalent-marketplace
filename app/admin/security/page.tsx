"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/navbar/Navbar";

type SecuritySummary = {
  verifiedOrders: number;
  openBoxOrders: number;
  highRiskReturns: number;
  totalReturns: number;
  dispatchProofOrders: number;
  vendorDisputes: number;
};

type ReturnRow = {
  id: string;
  orderId: string;
  reason: string;
  status: string;
  riskLevel: string;
  riskScore: number;
  signals?: string | null;
  createdAt: string;
};

type ProtectionLog = {
  id: string;
  orderId: string;
  eventType: string;
  message: string;
  createdAt: string;
};

export default function AdminSecurityPage() {
  const [summary, setSummary] = useState<SecuritySummary | null>(null);
  const [returns, setReturns] = useState<ReturnRow[]>([]);
  const [logs, setLogs] = useState<ProtectionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadSecurity() {
      try {
        const response = await fetch("/api/admin/security", { cache: "no-store" });
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Could not load security center.");
          return;
        }

        setSummary(data.summary);
        setReturns(data.recentReturns || []);
        setLogs(data.recentProtectionLogs || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load security center.");
      } finally {
        setLoading(false);
      }
    }

    loadSecurity();
  }, []);

  const cards = summary
    ? [
        ["Verified Orders", summary.verifiedOrders],
        ["Open Box Orders", summary.openBoxOrders],
        ["High Risk Returns", summary.highRiskReturns],
        ["Vendor Disputes", summary.vendorDisputes],
        ["Return Analytics", summary.totalReturns],
        ["Dispatch Proof Orders", summary.dispatchProofOrders],
      ]
    : [];

  return (
    <main className="min-h-screen bg-[#f7f2ea] text-stone-950">
      <Navbar />

      <section className="border-b border-stone-200 bg-[#17130f] text-[#f8efe2]">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <Link href="/admin/dashboard" className="text-sm font-semibold text-[#d6b36a]">
            Back to dashboard
          </Link>
          <h1 className="mt-3 text-4xl font-bold">Order Security Center</h1>
          <p className="mt-2 max-w-3xl text-sm text-[#d8c8af]">
            Track dispatch proof, delivery OTP, open-box verification, return risk
            and vendor protection records.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8">
        {loading ? (
          <p className="bg-white py-12 text-center text-stone-500 shadow">
            Loading security center...
          </p>
        ) : error ? (
          <p className="border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cards.map(([label, value]) => (
                <div key={label} className="bg-white p-5 shadow">
                  <p className="text-sm font-semibold text-stone-500">{label}</p>
                  <p className="mt-2 text-3xl font-bold text-[#6b145d]">
                    {value}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              <section className="bg-white p-5 shadow">
                <h2 className="text-xl font-bold">High Risk / Recent Returns</h2>
                <div className="mt-4 divide-y">
                  {returns.length === 0 ? (
                    <p className="py-8 text-center text-stone-500">
                      No smart return records yet.
                    </p>
                  ) : (
                    returns.map((row) => (
                      <div key={row.id} className="py-4">
                        <div className="flex items-center justify-between gap-3">
                          <Link
                            href={`/order/${row.orderId}`}
                            className="font-bold text-[#6b145d]"
                          >
                            Order #{row.orderId.slice(-8)}
                          </Link>
                          <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold">
                            {row.riskLevel} / {row.riskScore}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-stone-700">{row.reason}</p>
                        <p className="mt-1 text-xs text-stone-500">
                          Status {row.status} / {new Date(row.createdAt).toLocaleString()}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="bg-white p-5 shadow">
                <h2 className="text-xl font-bold">Vendor Protection Logs</h2>
                <div className="mt-4 divide-y">
                  {logs.length === 0 ? (
                    <p className="py-8 text-center text-stone-500">
                      No protection logs yet.
                    </p>
                  ) : (
                    logs.map((log) => (
                      <div key={log.id} className="py-4">
                        <p className="font-bold text-stone-950">{log.eventType}</p>
                        <p className="mt-1 text-sm text-stone-700">{log.message}</p>
                        <Link
                          href={`/order/${log.orderId}`}
                          className="mt-2 inline-block text-xs font-bold text-[#6b145d]"
                        >
                          Order #{log.orderId.slice(-8)}
                        </Link>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
