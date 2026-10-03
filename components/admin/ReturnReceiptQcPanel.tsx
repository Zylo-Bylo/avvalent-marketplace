"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type DispositionType = "RESELLABLE" | "DAMAGED" | "REJECTED";
type Disposition = {
  id: string;
  disposition: DispositionType;
  quantity: number;
  processedAt?: string | null;
  stockMovementId?: string | null;
};
type ReceiptItem = {
  id: string;
  productId: string;
  productName?: string | null;
  variantId?: string | null;
  sizeLabel?: string | null;
  variantColor?: string | null;
  orderedQuantity: number;
  receivedQuantity: number;
  dispositions: Disposition[];
};
type Receipt = {
  id: string;
  status: "PENDING" | "RECEIVED" | "QC_COMPLETED";
  receivedAt?: string | null;
  qcCompletedAt?: string | null;
  qcNote?: string | null;
  items: ReceiptItem[];
};
type QcDraft = Record<string, {
  receivedQuantity: string;
  RESELLABLE: string;
  DAMAGED: string;
  REJECTED: string;
}>;

const badgeTone: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  RECEIVED: "bg-blue-100 text-blue-800",
  QC_COMPLETED: "bg-emerald-100 text-emerald-800",
  PROCESSED: "bg-emerald-100 text-emerald-800",
  ALREADY_PROCESSED: "bg-stone-200 text-stone-700",
  FAILED: "bg-red-100 text-red-700",
};

function draftFromReceipt(receipt: Receipt | null): QcDraft {
  if (!receipt) return {};
  return Object.fromEntries(receipt.items.map((item) => {
    const quantities = Object.fromEntries(item.dispositions.map((entry) => [entry.disposition, entry.quantity]));
    return [item.id, {
      receivedQuantity: String(item.receivedQuantity ?? 0),
      RESELLABLE: quantities.RESELLABLE ? String(quantities.RESELLABLE) : "",
      DAMAGED: quantities.DAMAGED ? String(quantities.DAMAGED) : "",
      REJECTED: quantities.REJECTED ? String(quantities.REJECTED) : "",
    }];
  }));
}

export default function ReturnReceiptQcPanel({ returnRequestId }: { returnRequestId: string }) {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [qcNote, setQcNote] = useState("");
  const [draft, setDraft] = useState<QcDraft>({});
  const [processResults, setProcessResults] = useState<Array<{
    dispositionId: string;
    status: string;
    error?: string;
  }>>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/refunds/${returnRequestId}/receipt`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load return receipt.");
      setReceipt(data.receipt || null);
      setDraft(draftFromReceipt(data.receipt || null));
      setQcNote(data.receipt?.qcNote || "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load return receipt.");
    } finally {
      setLoading(false);
    }
  }, [returnRequestId]);

  useEffect(() => { load(); }, [load]);

  async function mutate(method: "POST" | "PATCH", body?: unknown) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/admin/refunds/${returnRequestId}/receipt`, {
        method,
        headers: { "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Return receipt update failed.");
      setMessage("Return receipt updated.");
      await load();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Return receipt update failed.");
      return false;
    } finally { setBusy(false); }
  }

  const validationError = useMemo(() => {
    if (!receipt || receipt.status !== "RECEIVED") return "";
    for (const item of receipt.items) {
      const values = draft[item.id];
      const received = Number(values?.receivedQuantity ?? -1);
      const allocations = (["RESELLABLE", "DAMAGED", "REJECTED"] as const)
        .map((key) => values?.[key] ? Number(values[key]) : 0);
      if (!Number.isInteger(received) || received < 0) return "Received quantity must be a nonnegative integer.";
      if (received > item.orderedQuantity) return "Received quantity cannot exceed ordered quantity.";
      if (allocations.some((value) => !Number.isInteger(value) || value < 0)) return "Disposition quantities must be nonnegative integers.";
      if (allocations.reduce((sum, value) => sum + value, 0) !== received) return "Disposition total must equal received quantity.";
    }
    return "";
  }, [draft, receipt]);

  function qcPayload() {
    return receipt?.items.map((item) => {
      const values = draft[item.id];
      return {
        receiptItemId: item.id,
        receivedQuantity: Number(values.receivedQuantity),
        dispositions: (["RESELLABLE", "DAMAGED", "REJECTED"] as const)
          .map((disposition) => ({ disposition, quantity: Number(values[disposition] || 0) }))
          .filter((entry) => entry.quantity > 0),
      };
    }) || [];
  }

  async function completeQc() {
    if (validationError) { setError(validationError); return; }
    const saved = await mutate("PATCH", { action: "SAVE_QC", items: qcPayload() });
    if (saved) await mutate("PATCH", { action: "FINALIZE_QC", qcNote });
  }

  async function processStock() {
    setBusy(true); setError(""); setProcessResults([]);
    try {
      const response = await fetch(`/api/admin/refunds/${returnRequestId}/receipt/process`, { method: "POST" });
      const data = await response.json();
      const successes = (data.results || []).map((result: Record<string, unknown>) => ({
        dispositionId: String(result.dispositionId || "Disposition"), status: String(result.status || "PROCESSED"),
      }));
      const failures = (data.failures || []).map((failure: Record<string, unknown>) => ({
        dispositionId: String(failure.dispositionId || "Disposition"), status: "FAILED", error: String(failure.error || "Processing failed"),
      }));
      setProcessResults([...successes, ...failures]);
      if (!response.ok && failures.length === 0) throw new Error(data.error || "Stock processing failed.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Stock processing failed.");
    } finally { setBusy(false); }
  }

  if (loading) return <div className="mt-4 border border-stone-200 p-4 text-sm text-stone-500">Loading return receipt...</div>;

  return (
    <section className="mt-5 border border-stone-300 bg-stone-50 p-4" aria-label="Return Receipt">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h3 className="font-bold">Return Receipt</h3><p className="text-xs text-stone-500">Physical receipt, QC and stock restoration</p></div>
        {receipt && <span className={`rounded-full px-3 py-1 text-xs font-bold ${badgeTone[receipt.status]}`}>{receipt.status.replace("_", " ")}</span>}
      </div>
      {error && <p role="alert" className="mt-3 border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {message && <p className="mt-3 border border-green-200 bg-green-50 p-3 text-sm text-green-700">{message}</p>}

      {!receipt && <button disabled={busy} onClick={() => mutate("POST")} className="mt-4 bg-stone-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Open Return Receipt</button>}
      {receipt?.status === "PENDING" && <button disabled={busy} onClick={() => mutate("PATCH", { action: "RECEIVE" })} className="mt-4 bg-stone-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Mark as Received</button>}

      {receipt && receipt.status !== "PENDING" && <div className="mt-4 space-y-4">
        <h4 className="text-sm font-bold">Items &amp; QC</h4>
        {receipt.items.map((item) => {
          const readonly = receipt.status === "QC_COMPLETED";
          const values = draft[item.id];
          return <div key={item.id} className="border border-stone-200 bg-white p-3">
            <p className="font-semibold">{item.productName || `Product ${item.productId.slice(-6)}`}</p>
            <p className="text-xs text-stone-500">{[item.sizeLabel, item.variantColor].filter(Boolean).join(" / ") || "Standard variant"} · Ordered {item.orderedQuantity}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-4">
              {(["receivedQuantity", "RESELLABLE", "DAMAGED", "REJECTED"] as const).map((key) => <label key={key} className="text-xs font-semibold text-stone-600">{key === "receivedQuantity" ? "Received" : key}
                <input aria-label={`${item.id}-${key}`} type="number" min={0} max={key === "receivedQuantity" ? item.orderedQuantity : undefined} readOnly={readonly} value={values?.[key] ?? ""} onChange={(event) => setDraft((current) => ({ ...current, [item.id]: { ...current[item.id], [key]: event.target.value } }))} className="mt-1 w-full border border-stone-300 px-2 py-2 text-sm read-only:bg-stone-100" />
              </label>)}
            </div>
            {readonly && <div className="mt-3 flex flex-wrap gap-2">{item.dispositions.map((entry) => <span key={entry.id} className={`rounded-full px-2 py-1 text-xs font-bold ${badgeTone[entry.processedAt ? "PROCESSED" : "PENDING"]}`}>{entry.disposition}: {entry.quantity} · {entry.processedAt ? "PROCESSED" : "PENDING"}</span>)}</div>}
          </div>;
        })}
        {receipt.status === "RECEIVED" && <>
          <label className="block text-xs font-semibold text-stone-600">QC note<textarea value={qcNote} onChange={(event) => setQcNote(event.target.value)} rows={2} className="mt-1 w-full border border-stone-300 p-2 text-sm" /></label>
          {validationError && <p className="text-sm text-amber-700">{validationError}</p>}
          <button disabled={busy || Boolean(validationError)} onClick={completeQc} className="bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Complete QC</button>
        </>}
        {receipt.status === "QC_COMPLETED" && <button disabled={busy} onClick={processStock} className="bg-stone-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Process Stock</button>}
      </div>}

      {processResults.length > 0 && <div className="mt-4 space-y-2"><h4 className="text-sm font-bold">Stock Processing</h4>{processResults.map((result, index) => <div key={`${result.dispositionId}-${index}`} className="flex flex-wrap items-center gap-2 text-sm"><span className={`rounded-full px-2 py-1 text-xs font-bold ${badgeTone[result.status] || badgeTone.FAILED}`}>{result.status.replace("_", " ")}</span><span>{result.dispositionId}</span>{result.error && <span className="text-red-700">{result.error}</span>}</div>)}</div>}
    </section>
  );
}
