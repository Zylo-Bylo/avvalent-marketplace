"use client";

import Link from "next/link";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { useEffect, useMemo, useState } from "react";
import Navbar from "@/components/navbar/Navbar";

type Wallet = {
  grossSales: number;
  commissionDeducted: number;
  refundDeducted: number;
  penaltyDeducted?: number;
  availableBalance: number;
  pendingBalance: number;
  paidBalance: number;
};

type Bank = {
  id: string;
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  upiId?: string | null;
  panNumber: string;
  gstNumber?: string | null;
  verificationStatus: "PENDING" | "VERIFIED" | "REJECTED";
  rejectionReason?: string | null;
};

type Payout = {
  id: string;
  vendorId: string;
  payoutAmount: number;
  payoutStatus: PayoutStatus;
  payoutMethod: string;
  bankAccountId?: string | null;
  transactionId?: string | null;
  failureReason?: string | null;
  approvedAt?: string | null;
  paidAt?: string | null;
  requestedAt?: string | null;
  createdAt: string;
};

type PayoutStatus =
  | "PENDING"
  | "ON_HOLD"
  | "APPROVED"
  | "PROCESSING"
  | "PAID"
  | "FAILED"
  | "REJECTED";

type AdminPayoutRow = {
  vendor: {
    id: string;
    storeName: string;
    status: string;
    kycStatus: string;
    mobile?: string | null;
    upiId?: string | null;
    bankDetails?: string | null;
    user?: {
      id: string;
      name: string;
      email: string;
    } | null;
  };
  wallet: Wallet;
  bank?: Bank | null;
  payouts: Payout[];
  pendingPayoutAmount: number;
};

type PayoutData = {
  rows: AdminPayoutRow[];
  payouts: Payout[];
  summary: {
    grossSales: number;
    availableBalance: number;
    pendingBalance: number;
    paidBalance: number;
    commissionDeducted: number;
    refundDeducted: number;
    pendingPayouts: number;
    bankPending: number;
    vendors: number;
  };
};

const statuses: Array<"ALL" | PayoutStatus> = [
  "ALL",
  "PENDING",
  "ON_HOLD",
  "APPROVED",
  "PROCESSING",
  "PAID",
  "FAILED",
  "REJECTED",
];

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

const emptyData: PayoutData = {
  rows: [],
  payouts: [],
  summary: {
    grossSales: 0,
    availableBalance: 0,
    pendingBalance: 0,
    paidBalance: 0,
    commissionDeducted: 0,
    refundDeducted: 0,
    pendingPayouts: 0,
    bankPending: 0,
    vendors: 0,
  },
};

function money(value: number | string | null | undefined) {
  return `Rs. ${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function date(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("en-IN") : "-";
}

function statusBadge(status?: string | null) {
  const value = status || "PENDING";
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusColors[value] || statusColors.PENDING}`}>
      {value.replace("_", " ")}
    </span>
  );
}

export default function AdminPayoutsPage() {
  const [data, setData] = useState<PayoutData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");
  const [minAmount, setMinAmount] = useState("");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [transactionIds, setTransactionIds] = useState<Record<string, string>>({});
  const [failureReasons, setFailureReasons] = useState<Record<string, string>>({});

  async function loadData() {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({
      q,
      status,
      minAmount,
    });
    const response = await fetch(`/api/admin/payouts?${params.toString()}`, {
      cache: "no-store",
    });
    const result = await response.json();

    if (!response.ok) {
      setError(result.error || "Could not load payout data.");
      setLoading(false);
      return;
    }

    setData(result);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grouped = useMemo(() => {
    const rows = data.rows || [];
    return {
      bankPending: rows.filter((row) => row.bank?.verificationStatus === "PENDING"),
      balances: rows.filter((row) => Number(row.wallet?.availableBalance || 0) > 0),
      pendingRows: rows.filter((row) =>
        row.payouts.some((payout) => ["PENDING", "ON_HOLD"].includes(payout.payoutStatus)),
      ),
      activeRows: rows.filter((row) =>
        row.payouts.some((payout) => ["APPROVED", "PROCESSING"].includes(payout.payoutStatus)),
      ),
      completedRows: rows.filter((row) =>
        row.payouts.some((payout) => ["PAID", "FAILED", "REJECTED"].includes(payout.payoutStatus)),
      ),
    };
  }, [data.rows]);

  async function postAction(body: Record<string, unknown>, busyKey: string) {
    setSavingId(busyKey);
    setMessage("");
    setError("");
    const response = await fetch("/api/admin/payouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    setSavingId("");

    if (!response.ok) {
      setError(result.error || "Payout action failed.");
      return;
    }

    setData({
      rows: result.rows || [],
      payouts: result.payouts || [],
      summary: result.summary || emptyData.summary,
    });
    setMessage(result.message || "Payout action completed.");
  }

  function exportReport(format: "csv" | "excel" | "pdf") {
    const params = new URLSearchParams({
      q,
      status,
      minAmount,
      format,
    });
    window.open(`/api/admin/payouts?${params.toString()}`, "_blank");
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <Navbar />

      <section className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-4 py-7">
          <Link href="/admin/dashboard" className="text-sm font-bold text-pink-600">
            Back to admin dashboard
          </Link>
          <h1 className="mt-2 text-3xl font-black">Vendor Payout Management</h1>
          <p className="mt-2 text-sm text-slate-600">
            Verify bank accounts, approve vendor payouts, track refunds, and export settlement reports.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-6">
        {message && <p className="mb-4 rounded-xl bg-green-50 p-3 text-sm text-green-700">{message}</p>}
        {error && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-8">
          {[
            ["Gross Sales", data.summary.grossSales],
            ["Available", data.summary.availableBalance],
            ["Pending", data.summary.pendingBalance],
            ["Paid", data.summary.paidBalance],
            ["Commission", data.summary.commissionDeducted],
            ["Refund", data.summary.refundDeducted],
            ["Bank Pending", data.summary.bankPending],
            ["Pending Payouts", data.summary.pendingPayouts],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-2 text-xl font-black">
                {typeof value === "number" && String(label).includes("Pending") && label !== "Pending"
                  ? value
                  : typeof value === "number"
                    ? money(value)
                    : value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-2xl bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-[1fr_180px_160px_auto]">
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Search vendor, email, phone, UPI"
              className="rounded-xl border border-slate-300 p-3 text-sm"
            />
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="rounded-xl border border-slate-300 p-3 text-sm"
            >
              {statuses.map((item) => (
                <option key={item} value={item}>
                  {item.replace("_", " ")}
                </option>
              ))}
            </select>
            <input
              value={minAmount}
              onChange={(event) => setMinAmount(event.target.value)}
              placeholder="Min amount"
              type="number"
              className="rounded-xl border border-slate-300 p-3 text-sm"
            />
            <button
              onClick={loadData}
              className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white"
            >
              Apply
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => exportReport("csv")} className="rounded-xl border px-4 py-2 text-sm font-bold">
              Export CSV
            </button>
            <button onClick={() => exportReport("excel")} className="rounded-xl border px-4 py-2 text-sm font-bold">
              Export Excel
            </button>
            <button onClick={() => exportReport("pdf")} className="rounded-xl border px-4 py-2 text-sm font-bold">
              PDF / Print
            </button>
          </div>
        </div>

        {loading ? (
          <p className="mt-5 rounded-2xl bg-white py-12 text-center text-slate-500 shadow-sm">
            Loading payout records...
          </p>
        ) : (
          <div className="mt-5 space-y-5">
            <Panel title="Bank Verification Pending" rows={grouped.bankPending}>
              {(row) => (
                <VendorBankCard
                  row={row}
                  savingId={savingId}
                  onVerify={(bankAccountId) =>
                    postAction({ action: "verify-bank", bankAccountId, status: "VERIFIED" }, `bank-${bankAccountId}`)
                  }
                  onReject={(bankAccountId) => {
                    const reason = window.prompt("Reason for bank rejection?") || "Rejected by admin.";
                    postAction(
                      { action: "verify-bank", bankAccountId, status: "REJECTED", reason },
                      `bank-${bankAccountId}`,
                    );
                  }}
                />
              )}
            </Panel>

            <Panel title="Vendor Balances" rows={grouped.balances}>
              {(row) => (
                <VendorBalanceCard
                  row={row}
                  amount={amounts[row.vendor.id] ?? String(Number(row.wallet.availableBalance || 0).toFixed(2))}
                  savingId={savingId}
                  onAmountChange={(value) =>
                    setAmounts((current) => ({ ...current, [row.vendor.id]: value }))
                  }
                  onCreatePayout={() =>
                    postAction(
                      {
                        action: "create-payout",
                        vendorId: row.vendor.id,
                        amount: Number(amounts[row.vendor.id] || row.wallet.availableBalance || 0),
                      },
                      `create-${row.vendor.id}`,
                    )
                  }
                />
              )}
            </Panel>

            <Panel title="Pending / On Hold Payouts" rows={grouped.pendingRows}>
              {(row) => (
                <VendorPayoutCard
                  row={row}
                  statuses={["PENDING", "ON_HOLD"]}
                  savingId={savingId}
                  transactionIds={transactionIds}
                  failureReasons={failureReasons}
                  setTransactionIds={setTransactionIds}
                  setFailureReasons={setFailureReasons}
                  postAction={postAction}
                />
              )}
            </Panel>

            <Panel title="Approved / Processing Payouts" rows={grouped.activeRows}>
              {(row) => (
                <VendorPayoutCard
                  row={row}
                  statuses={["APPROVED", "PROCESSING"]}
                  savingId={savingId}
                  transactionIds={transactionIds}
                  failureReasons={failureReasons}
                  setTransactionIds={setTransactionIds}
                  setFailureReasons={setFailureReasons}
                  postAction={postAction}
                />
              )}
            </Panel>

            <Panel title="Paid / Failed / Rejected History" rows={grouped.completedRows}>
              {(row) => (
                <VendorPayoutCard
                  row={row}
                  statuses={["PAID", "FAILED", "REJECTED"]}
                  savingId={savingId}
                  transactionIds={transactionIds}
                  failureReasons={failureReasons}
                  setTransactionIds={setTransactionIds}
                  setFailureReasons={setFailureReasons}
                  postAction={postAction}
                />
              )}
            </Panel>
          </div>
        )}
      </section>
    </main>
  );
}

function Panel({
  title,
  rows,
  children,
}: {
  title: string;
  rows: AdminPayoutRow[];
  children: (row: AdminPayoutRow) => ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-black">{title}</h2>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
          {rows.length}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed p-6 text-center text-sm text-slate-500">
          No records found.
        </p>
      ) : (
        <div className="mt-4 space-y-3">{rows.map((row) => children(row))}</div>
      )}
    </section>
  );
}

function VendorHeader({ row }: { row: AdminPayoutRow }) {
  return (
    <div>
      <h3 className="font-black">{row.vendor.storeName}</h3>
      <p className="text-xs text-slate-500">
        {row.vendor.user?.name || "Vendor"} · {row.vendor.user?.email || "-"} · {row.vendor.mobile || "-"}
      </p>
    </div>
  );
}

function VendorBankCard({
  row,
  savingId,
  onVerify,
  onReject,
}: {
  row: AdminPayoutRow;
  savingId: string;
  onVerify: (bankAccountId: string) => void;
  onReject: (bankAccountId: string) => void;
}) {
  if (!row.bank) {
    return null;
  }

  return (
    <article className="rounded-2xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <VendorHeader row={row} />
        {statusBadge(row.bank.verificationStatus)}
      </div>
      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <p><b>Holder:</b> {row.bank.accountHolderName}</p>
        <p><b>Bank:</b> {row.bank.bankName}</p>
        <p><b>Account:</b> {row.bank.accountNumber}</p>
        <p><b>IFSC:</b> {row.bank.ifscCode}</p>
        <p><b>UPI:</b> {row.bank.upiId || "-"}</p>
        <p><b>PAN:</b> {row.bank.panNumber}</p>
        <p><b>GST:</b> {row.bank.gstNumber || "-"}</p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => onVerify(row.bank!.id)}
          disabled={savingId === `bank-${row.bank.id}`}
          className="rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
        >
          Verify Bank
        </button>
        <button
          onClick={() => onReject(row.bank!.id)}
          disabled={savingId === `bank-${row.bank.id}`}
          className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
        >
          Reject
        </button>
      </div>
    </article>
  );
}

function VendorBalanceCard({
  row,
  amount,
  savingId,
  onAmountChange,
  onCreatePayout,
}: {
  row: AdminPayoutRow;
  amount: string;
  savingId: string;
  onAmountChange: (value: string) => void;
  onCreatePayout: () => void;
}) {
  const bankVerified = row.bank?.verificationStatus === "VERIFIED";
  return (
    <article className="rounded-2xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <VendorHeader row={row} />
        <div className="text-right text-sm">
          <p className="font-black text-green-700">{money(row.wallet.availableBalance)}</p>
          <p className="text-xs text-slate-500">available</p>
        </div>
      </div>
      <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <p><b>Gross:</b> {money(row.wallet.grossSales)}</p>
        <p><b>Pending:</b> {money(row.wallet.pendingBalance)}</p>
        <p><b>Commission:</b> {money(row.wallet.commissionDeducted)}</p>
        <p><b>Refund:</b> {money(row.wallet.refundDeducted)}</p>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-[180px_auto_1fr]">
        <input
          type="number"
          value={amount}
          onChange={(event) => onAmountChange(event.target.value)}
          className="rounded-xl border border-slate-300 p-2 text-sm"
        />
        <button
          onClick={onCreatePayout}
          disabled={!bankVerified || savingId === `create-${row.vendor.id}`}
          className="rounded-xl bg-pink-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
        >
          Create Approved Payout
        </button>
        <p className="self-center text-xs text-slate-500">
          Bank: {row.bank ? statusBadge(row.bank.verificationStatus) : "No bank details"}
        </p>
      </div>
    </article>
  );
}

function VendorPayoutCard({
  row,
  statuses: visibleStatuses,
  savingId,
  transactionIds,
  failureReasons,
  setTransactionIds,
  setFailureReasons,
  postAction,
}: {
  row: AdminPayoutRow;
  statuses: PayoutStatus[];
  savingId: string;
  transactionIds: Record<string, string>;
  failureReasons: Record<string, string>;
  setTransactionIds: Dispatch<SetStateAction<Record<string, string>>>;
  setFailureReasons: Dispatch<SetStateAction<Record<string, string>>>;
  postAction: (body: Record<string, unknown>, busyKey: string) => void;
}) {
  const payouts = row.payouts.filter((payout) => visibleStatuses.includes(payout.payoutStatus));
  if (payouts.length === 0) {
    return null;
  }

  return (
    <article className="rounded-2xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <VendorHeader row={row} />
        <p className="text-sm font-bold">Available: {money(row.wallet.availableBalance)}</p>
      </div>

      <div className="mt-4 space-y-3">
        {payouts.map((payout) => (
          <div key={payout.id} className="rounded-xl bg-slate-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-black">{money(payout.payoutAmount)}</p>
                <p className="text-xs text-slate-500">
                  {payout.payoutMethod} · Requested {date(payout.requestedAt || payout.createdAt)}
                </p>
              </div>
              {statusBadge(payout.payoutStatus)}
            </div>

            <div className="mt-3 grid gap-2 lg:grid-cols-[1fr_1fr_auto]">
              <input
                value={transactionIds[payout.id] ?? payout.transactionId ?? ""}
                onChange={(event) =>
                  setTransactionIds((current) => ({ ...current, [payout.id]: event.target.value }))
                }
                placeholder="Transaction ID for paid payout"
                className="rounded-xl border border-slate-300 p-2 text-sm"
              />
              <input
                value={failureReasons[payout.id] ?? payout.failureReason ?? ""}
                onChange={(event) =>
                  setFailureReasons((current) => ({ ...current, [payout.id]: event.target.value }))
                }
                placeholder="Failure / rejection reason"
                className="rounded-xl border border-slate-300 p-2 text-sm"
              />
              <div className="flex flex-wrap gap-2">
                {(["APPROVED", "ON_HOLD", "PROCESSING", "PAID", "FAILED", "REJECTED"] as PayoutStatus[]).map(
                  (nextStatus) => (
                    <button
                      key={nextStatus}
                      onClick={() =>
                        postAction(
                          {
                            action: "update-payout",
                            payoutId: payout.id,
                            status: nextStatus,
                            transactionId: transactionIds[payout.id] || payout.transactionId || "",
                            failureReason: failureReasons[payout.id] || "",
                          },
                          `payout-${payout.id}-${nextStatus}`,
                        )
                      }
                      disabled={savingId === `payout-${payout.id}-${nextStatus}`}
                      className="rounded-lg border bg-white px-3 py-2 text-xs font-bold hover:bg-slate-100 disabled:opacity-60"
                    >
                      {nextStatus.replace("_", " ")}
                    </button>
                  ),
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
