"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Navbar from "@/components/navbar/Navbar";

type Wallet = {
  grossSales: number;
  commissionDeducted: number;
  refundDeducted: number;
  penaltyDeducted: number;
  availableBalance: number;
  pendingBalance: number;
  paidBalance: number;
};

type Bank = {
  id?: string;
  accountHolderName?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  upiId?: string | null;
  panNumber?: string;
  gstNumber?: string | null;
  verificationStatus?: "PENDING" | "VERIFIED" | "REJECTED";
  rejectionReason?: string | null;
};

type Payout = {
  id: string;
  payoutAmount: number;
  payoutStatus: string;
  payoutMethod: string;
  transactionId?: string | null;
  failureReason?: string | null;
  createdAt: string;
  paidAt?: string | null;
};

type Ledger = {
  id: string;
  type: string;
  orderId?: string | null;
  creditAmount: number;
  debitAmount: number;
  balanceAfter: number;
  note?: string | null;
  createdAt: string;
};

type Order = {
  id: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  items: Array<{
    id: string;
    quantity: number;
    price: number;
    vendorPayout?: number | null;
    platformCommissionAmount?: number | null;
    product?: { name: string } | null;
  }>;
};

type PayoutData = {
  wallet?: Wallet;
  bank?: Bank | null;
  payouts?: Payout[];
  ledger?: Ledger[];
  reports?: any[];
  refunds?: any[];
  orders?: Order[];
  minimumPayoutAmount?: number;
};

const tabs = ["Overview", "Pending", "Available", "Paid", "Failed", "Ledger", "Bank Details", "Reports"];

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  ON_HOLD: "bg-orange-100 text-orange-800",
  APPROVED: "bg-blue-100 text-blue-800",
  PROCESSING: "bg-purple-100 text-purple-800",
  PAID: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
  REJECTED: "bg-gray-200 text-gray-800",
  VERIFIED: "bg-green-100 text-green-800",
};

const emptyWallet: Wallet = {
  grossSales: 0,
  commissionDeducted: 0,
  refundDeducted: 0,
  penaltyDeducted: 0,
  availableBalance: 0,
  pendingBalance: 0,
  paidBalance: 0,
};

function money(value: number | null | undefined) {
  return `Rs. ${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function date(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("en-IN") : "-";
}

export default function VendorPayoutsPage() {
  const [activeTab, setActiveTab] = useState("Overview");
  const [data, setData] = useState<PayoutData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [requestAmount, setRequestAmount] = useState("");
  const [bankForm, setBankForm] = useState({
    accountHolderName: "",
    bankName: "",
    accountNumber: "",
    ifscCode: "",
    upiId: "",
    panNumber: "",
    gstNumber: "",
  });

  const wallet = data.wallet || emptyWallet;
  const minimumPayoutAmount = data.minimumPayoutAmount || 500;
  const payoutGroups = useMemo(() => {
    const payouts = data.payouts || [];
    return {
      pending: payouts.filter((payout) => ["PENDING", "ON_HOLD", "APPROVED", "PROCESSING"].includes(payout.payoutStatus)),
      paid: payouts.filter((payout) => payout.payoutStatus === "PAID"),
      failed: payouts.filter((payout) => ["FAILED", "REJECTED"].includes(payout.payoutStatus)),
    };
  }, [data.payouts]);

  async function loadData() {
    setLoading(true);
    setError("");
    const response = await fetch("/api/vendor/payouts", { cache: "no-store" });
    const result = await response.json();

    if (!response.ok) {
      setError(result.error || "Could not load payouts.");
      setLoading(false);
      return;
    }

    setData(result);
    if (result.bank) {
      setBankForm({
        accountHolderName: result.bank.accountHolderName || "",
        bankName: result.bank.bankName || "",
        accountNumber: result.bank.accountNumber || "",
        ifscCode: result.bank.ifscCode || "",
        upiId: result.bank.upiId || "",
        panNumber: result.bank.panNumber || "",
        gstNumber: result.bank.gstNumber || "",
      });
    }
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function saveBank(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    const response = await fetch("/api/vendor/payouts/bank", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bankForm),
    });
    const result = await response.json();

    setSaving(false);
    if (!response.ok) {
      setError(result.error || "Bank details could not be saved.");
      return;
    }

    setMessage("Bank details saved. Admin verification is required before payout.");
    await loadData();
  }

  async function requestPayout() {
    setSaving(true);
    setError("");
    setMessage("");

    const response = await fetch("/api/vendor/payouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: Number(requestAmount || wallet.availableBalance) }),
    });
    const result = await response.json();

    setSaving(false);
    if (!response.ok) {
      setError(result.error || "Payout request failed.");
      return;
    }

    setMessage("Payout request submitted to admin.");
    setData(result);
    setRequestAmount("");
  }

  function downloadReport(format: "csv" | "excel" | "pdf") {
    const rows = (data.orders || []).flatMap((order) =>
      order.items.map((item) => {
        const commission =
          Number(item.platformCommissionAmount || 0) * Number(item.quantity || 0);
        const netPayable =
          Number(item.vendorPayout || item.price || 0) * Number(item.quantity || 0);
        return {
          "Vendor Name": "My Store",
          "Order ID": order.id,
          "Product Name": item.product?.name || item.id,
          "Gross Amount": order.totalAmount,
          "Commission %": "",
          "Commission Amount": commission,
          "Refund Amount": 0,
          "Net Payable": netPayable,
          "Payout Status": order.status === "DELIVERED" ? "Eligible/Released" : "Pending",
          "Transaction ID": "",
          Date: order.createdAt,
        };
      }),
    );
    const header = Object.keys(rows[0] || {
      "Vendor Name": "",
      "Order ID": "",
      "Product Name": "",
      "Gross Amount": "",
      "Commission %": "",
      "Commission Amount": "",
      "Refund Amount": "",
      "Net Payable": "",
      "Payout Status": "",
      "Transaction ID": "",
      Date: "",
    });
    const csv = [
      header.join(","),
      ...rows.map((row) =>
        header.map((key) => `"${String((row as any)[key] ?? "").replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\n");

    if (format === "pdf") {
      const html = `<html><body><h1>Zylo-Buylo Vendor Payout Report</h1><pre>${csv}</pre></body></html>`;
      const blob = new Blob([html], { type: "text/html" });
      window.open(URL.createObjectURL(blob), "_blank");
      return;
    }

    const blob = new Blob([csv], {
      type: format === "excel" ? "application/vnd.ms-excel" : "text/csv",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `zylo-buylo-vendor-payout-report.${format === "excel" ? "xls" : "csv"}`;
    link.click();
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <Navbar />

      <section className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-4 py-7">
          <Link href="/vendor/dashboard" className="text-sm font-bold text-pink-600">
            Back to vendor dashboard
          </Link>
          <h1 className="mt-2 text-3xl font-black">Vendor Payouts</h1>
          <p className="mt-2 text-sm text-slate-600">
            Track order earnings, commission, refunds, settlement reports and bank verification.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-6">
        {message && <p className="mb-4 rounded-xl bg-green-50 p-3 text-sm text-green-700">{message}</p>}
        {error && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        {loading ? (
          <p className="rounded-2xl bg-white py-12 text-center text-slate-500 shadow">
            Loading payout dashboard...
          </p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-7">
              {[
                ["Total Sales", wallet.grossSales],
                ["Gross Revenue", wallet.grossSales],
                ["Commission", wallet.commissionDeducted],
                ["Refund", wallet.refundDeducted],
                ["Pending", wallet.pendingBalance],
                ["Available", wallet.availableBalance],
                ["Paid", wallet.paidBalance],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-white p-4 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
                  <p className="mt-2 text-xl font-black">{money(Number(value))}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 flex gap-2 overflow-x-auto rounded-2xl bg-white p-2 shadow-sm">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold ${
                    activeTab === tab ? "bg-pink-600 text-white" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {activeTab === "Overview" && (
              <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_360px]">
                <section className="rounded-2xl bg-white p-5 shadow-sm">
                  <h2 className="text-xl font-bold">Order-wise earnings</h2>
                  <OrderTable orders={data.orders || []} />
                </section>
                <section className="h-fit rounded-2xl bg-white p-5 shadow-sm">
                  <h2 className="text-xl font-bold">Request payout</h2>
                  <p className="mt-2 text-sm text-slate-500">
                    Minimum payout amount is {money(minimumPayoutAmount)}. Bank details must be verified.
                  </p>
                  <input
                    type="number"
                    min={minimumPayoutAmount}
                    value={requestAmount}
                    onChange={(event) => setRequestAmount(event.target.value)}
                    placeholder={String(wallet.availableBalance.toFixed(2))}
                    className="mt-4 w-full rounded-xl border p-3"
                  />
                  <button
                    onClick={requestPayout}
                    disabled={saving || wallet.availableBalance < minimumPayoutAmount}
                    className="mt-3 w-full rounded-xl bg-pink-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                  >
                    Request Payout
                  </button>
                  <p className="mt-3 text-xs text-slate-500">
                    Bank status:{" "}
                    <span className={`rounded-full px-2 py-1 font-bold ${statusColors[data.bank?.verificationStatus || "PENDING"] || statusColors.PENDING}`}>
                      {data.bank?.verificationStatus || "PENDING"}
                    </span>
                  </p>
                </section>
              </div>
            )}

            {activeTab === "Pending" && <PayoutTable payouts={payoutGroups.pending} />}
            {activeTab === "Available" && (
              <section className="mt-5 rounded-2xl bg-white p-6 shadow-sm">
                <p className="text-sm font-bold uppercase text-slate-500">Available balance</p>
                <p className="mt-2 text-4xl font-black text-green-700">{money(wallet.availableBalance)}</p>
              </section>
            )}
            {activeTab === "Paid" && <PayoutTable payouts={payoutGroups.paid} />}
            {activeTab === "Failed" && <PayoutTable payouts={payoutGroups.failed} />}
            {activeTab === "Ledger" && <LedgerTable ledger={data.ledger || []} />}
            {activeTab === "Bank Details" && (
              <form onSubmit={saveBank} className="mt-5 rounded-2xl bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-bold">Bank Details</h2>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusColors[data.bank?.verificationStatus || "PENDING"] || statusColors.PENDING}`}>
                    {data.bank?.verificationStatus || "PENDING"}
                  </span>
                </div>
                {data.bank?.rejectionReason && (
                  <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{data.bank.rejectionReason}</p>
                )}
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {[
                    ["accountHolderName", "Account Holder Name"],
                    ["bankName", "Bank Name"],
                    ["accountNumber", "Account Number"],
                    ["ifscCode", "IFSC Code"],
                    ["upiId", "UPI ID optional"],
                    ["panNumber", "PAN Number"],
                    ["gstNumber", "GST Number optional"],
                  ].map(([name, label]) => (
                    <input
                      key={name}
                      value={bankForm[name as keyof typeof bankForm]}
                      onChange={(event) =>
                        setBankForm((current) => ({ ...current, [name]: event.target.value }))
                      }
                      placeholder={label}
                      className="rounded-xl border p-3"
                      required={!["upiId", "gstNumber"].includes(name)}
                    />
                  ))}
                </div>
                <button
                  disabled={saving}
                  className="mt-5 rounded-xl bg-pink-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save Bank Details"}
                </button>
              </form>
            )}
            {activeTab === "Reports" && (
              <section className="mt-5 rounded-2xl bg-white p-5 shadow-sm">
                <h2 className="text-xl font-bold">Settlement Reports</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Download payout reports for accounting, GST and commission review.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button onClick={() => downloadReport("csv")} className="rounded-xl border px-4 py-3 text-sm font-bold">CSV</button>
                  <button onClick={() => downloadReport("excel")} className="rounded-xl border px-4 py-3 text-sm font-bold">Excel</button>
                  <button onClick={() => downloadReport("pdf")} className="rounded-xl border px-4 py-3 text-sm font-bold">PDF/Print</button>
                </div>
              </section>
            )}
          </>
        )}
      </section>
    </main>
  );
}

function PayoutTable({ payouts }: { payouts: Payout[] }) {
  return (
    <section className="mt-5 overflow-hidden rounded-2xl bg-white shadow-sm">
      {payouts.length === 0 ? (
        <p className="py-10 text-center text-slate-500">No payouts found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase text-slate-500">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Status</th>
                <th className="p-3">Method</th>
                <th className="p-3">Transaction</th>
                <th className="p-3">Reason</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((payout) => (
                <tr key={payout.id} className="border-t">
                  <td className="p-3">{date(payout.createdAt)}</td>
                  <td className="p-3 font-bold">{money(payout.payoutAmount)}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-bold ${statusColors[payout.payoutStatus] || statusColors.PENDING}`}>
                      {payout.payoutStatus}
                    </span>
                  </td>
                  <td className="p-3">{payout.payoutMethod}</td>
                  <td className="p-3">{payout.transactionId || "-"}</td>
                  <td className="p-3">{payout.failureReason || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function LedgerTable({ ledger }: { ledger: Ledger[] }) {
  return (
    <section className="mt-5 overflow-hidden rounded-2xl bg-white shadow-sm">
      {ledger.length === 0 ? (
        <p className="py-10 text-center text-slate-500">No ledger entries yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase text-slate-500">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Type</th>
                <th className="p-3">Order</th>
                <th className="p-3">Credit</th>
                <th className="p-3">Debit</th>
                <th className="p-3">Balance</th>
                <th className="p-3">Note</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((entry) => (
                <tr key={entry.id} className="border-t">
                  <td className="p-3">{date(entry.createdAt)}</td>
                  <td className="p-3 font-bold">{entry.type}</td>
                  <td className="p-3">{entry.orderId?.slice(-8) || "-"}</td>
                  <td className="p-3 text-green-700">{money(entry.creditAmount)}</td>
                  <td className="p-3 text-red-700">{money(entry.debitAmount)}</td>
                  <td className="p-3 font-bold">{money(entry.balanceAfter)}</td>
                  <td className="p-3">{entry.note || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function OrderTable({ orders }: { orders: Order[] }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase text-slate-500">
          <tr>
            <th className="p-3">Order</th>
            <th className="p-3">Status</th>
            <th className="p-3">Gross</th>
            <th className="p-3">Commission</th>
            <th className="p-3">Net Payable</th>
            <th className="p-3">Date</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const totals = order.items.reduce(
              (result, item) => ({
                commission:
                  result.commission +
                  Number(item.platformCommissionAmount || 0) * Number(item.quantity || 0),
                payout:
                  result.payout +
                  Number(item.vendorPayout || item.price || 0) * Number(item.quantity || 0),
              }),
              { commission: 0, payout: 0 },
            );
            return (
              <tr key={order.id} className="border-t">
                <td className="p-3 font-bold">#{order.id.slice(-8)}</td>
                <td className="p-3">{order.status}</td>
                <td className="p-3">{money(order.totalAmount)}</td>
                <td className="p-3">{money(totals.commission)}</td>
                <td className="p-3 font-bold">{money(totals.payout)}</td>
                <td className="p-3">{date(order.createdAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
