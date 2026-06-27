"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/navbar/Navbar";

type EnvItem = {
  name: string;
  configured: boolean;
  purpose: string;
};

type GatewaySettings = {
  enabled: boolean;
  webhookReady?: boolean;
  webhookUrl?: string;
  requiredEnv?: EnvItem[];
  dashboardUrl?: string;
  webhookEvents?: string[];
  merchantUpiId?: string | null;
};

type PaymentSettings = {
  siteUrl: string;
  gateways: {
    razorpay: GatewaySettings;
    stripe: GatewaySettings;
    upi: GatewaySettings;
    cod: GatewaySettings;
  };
};

const gatewayLabels = {
  razorpay: "Razorpay",
  stripe: "Stripe",
  upi: "UPI Transfer",
  cod: "Cash on Delivery",
};

function StatusBadge({ ready, label }: { ready: boolean; label?: string }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-bold ${
        ready ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
      }`}
    >
      {label || (ready ? "Ready" : "Missing")}
    </span>
  );
}

export default function AdminPaymentsPage() {
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  useEffect(() => {
    async function loadSettings() {
      try {
        const response = await fetch("/api/admin/payments/settings", {
          cache: "no-store",
        });
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Could not load payment settings.");
          return;
        }

        setSettings(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load settings.");
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, []);

  async function copyText(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(""), 1800);
    } catch {
      setCopied("");
    }
  }

  function renderGateway(
    key: "razorpay" | "stripe" | "upi" | "cod",
    gateway: GatewaySettings,
  ) {
    return (
      <section key={key} className="bg-white p-6 shadow">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">{gatewayLabels[key]}</h2>
            <p className="mt-2 text-sm text-stone-600">
              {key === "razorpay" &&
                "India payment gateway for UPI, cards, wallets and net banking."}
              {key === "stripe" && "Card checkout for international-ready payments."}
              {key === "upi" && "Manual UPI transfer shown after order placement."}
              {key === "cod" && "Cash collected by vendor/delivery at order delivery."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge ready={gateway.enabled} />
            {typeof gateway.webhookReady === "boolean" && (
              <StatusBadge
                ready={gateway.webhookReady}
                label={gateway.webhookReady ? "Webhook Ready" : "Webhook Missing"}
              />
            )}
          </div>
        </div>

        {gateway.merchantUpiId && (
          <div className="mt-5 border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-semibold text-stone-600">Current UPI ID</p>
            <p className="mt-1 font-bold">{gateway.merchantUpiId}</p>
          </div>
        )}

        {gateway.webhookUrl && (
          <div className="mt-5 border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-semibold text-stone-600">Webhook URL</p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <code className="min-w-0 flex-1 overflow-x-auto bg-white px-3 py-2 text-sm">
                {gateway.webhookUrl}
              </code>
              <button
                type="button"
                onClick={() => copyText(gateway.webhookUrl || "", `${key}-webhook`)}
                className="bg-[#6b145d] px-4 py-2 text-sm font-bold text-white"
              >
                {copied === `${key}-webhook` ? "Copied" : "Copy"}
              </button>
            </div>
            {gateway.webhookEvents?.length ? (
              <p className="mt-2 text-xs text-stone-500">
                Events: {gateway.webhookEvents.join(", ")}
              </p>
            ) : null}
          </div>
        )}

        {gateway.requiredEnv?.length ? (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="bg-stone-100 text-stone-600">
                  <th className="px-4 py-3">Environment Variable</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Purpose</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {gateway.requiredEnv.map((item) => (
                  <tr key={item.name} className="border-b border-stone-100">
                    <td className="px-4 py-3 font-bold">{item.name}</td>
                    <td className="px-4 py-3">
                      <StatusBadge ready={item.configured} />
                    </td>
                    <td className="px-4 py-3 text-stone-600">{item.purpose}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => copyText(item.name, item.name)}
                        className="border border-stone-300 px-3 py-2 text-xs font-bold"
                      >
                        {copied === item.name ? "Copied" : "Copy Name"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {gateway.dashboardUrl && (
          <a
            href={gateway.dashboardUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-block border border-stone-300 px-5 py-3 text-sm font-bold"
          >
            Open Provider Dashboard
          </a>
        )}
      </section>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f2ea] text-stone-950">
      <Navbar />

      <section className="border-b border-stone-200 bg-[#17130f] text-[#f8efe2]">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <Link href="/admin/dashboard" className="text-sm font-semibold text-[#d6b36a]">
            Back to dashboard
          </Link>
          <h1 className="mt-3 text-4xl font-bold">Payment Settings</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#d8c8af]">
            Check Razorpay, Stripe, UPI and COD readiness. Copy webhook URLs and
            missing Vercel environment variable names from here.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8">
        {loading ? (
          <p className="bg-white py-12 text-center text-stone-500 shadow">
            Loading payment settings...
          </p>
        ) : error ? (
          <p className="border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </p>
        ) : settings ? (
          <div className="space-y-6">
            <div className="bg-white p-6 shadow">
              <h2 className="text-2xl font-bold">Live Website</h2>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <code className="min-w-0 flex-1 overflow-x-auto bg-stone-100 px-3 py-2 text-sm">
                  {settings.siteUrl}
                </code>
                <button
                  type="button"
                  onClick={() => copyText(settings.siteUrl, "site-url")}
                  className="bg-[#6b145d] px-4 py-2 text-sm font-bold text-white"
                >
                  {copied === "site-url" ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="mt-3 text-sm text-stone-600">
                Add payment keys in Vercel Environment Variables, then redeploy.
                This page will update automatically after deployment.
              </p>
            </div>

            {renderGateway("razorpay", settings.gateways.razorpay)}
            {renderGateway("stripe", settings.gateways.stripe)}
            {renderGateway("upi", settings.gateways.upi)}
            {renderGateway("cod", settings.gateways.cod)}
          </div>
        ) : null}
      </section>
    </main>
  );
}
