"use client";

import { useMemo, useState } from "react";
import type { CategorySizeGuide } from "@/lib/category-size-guide";
import {
  canUseSmartSizeFinder,
  canUseSmartSizeFinderForOptions,
  getSmartSizeMeasurementFields,
  recommendSmartSize,
  type FitPreference,
} from "@/lib/smart-size-finder";

type SizeOption = {
  label: string;
  available: boolean;
};

type SmartSizeFinderProps = {
  sizeGuide: CategorySizeGuide | null;
  sizeOptions: SizeOption[];
  onSelectSize: (size: string) => void;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export default function SmartSizeFinder({
  sizeGuide,
  sizeOptions,
  onSelectSize,
}: SmartSizeFinderProps) {
  const [chartOpen, setChartOpen] = useState(false);
  const [finderOpen, setFinderOpen] = useState(false);
  const [fitPreference, setFitPreference] = useState<FitPreference>("regular");
  const [measurements, setMeasurements] = useState<Record<string, string>>({});
  const fields = useMemo(() => getSmartSizeMeasurementFields(sizeGuide), [sizeGuide]);
  const hasChart = Boolean(sizeGuide?.fields?.length && sizeGuide.rows.length);
  const availableSizes = sizeOptions.filter((item) => item.available).map((item) => item.label);
  const unavailableSizes = sizeOptions.filter((item) => !item.available).map((item) => item.label);
  const finderEnabled =
    canUseSmartSizeFinder(sizeGuide) &&
    canUseSmartSizeFinderForOptions(sizeGuide, sizeOptions);
  const fitPreferenceEnabled = sizeGuide?.smartSizeFinder?.fitPreferenceEnabled !== false;
  const recommendation = recommendSmartSize({
    sizeGuide,
    measurements,
    availableSizes,
    unavailableSizes,
    fitPreference: fitPreferenceEnabled ? fitPreference : "regular",
  });

  if (!hasChart) {
    return null;
  }

  return (
    <>
      {finderEnabled ? (
        <div className="mt-4 w-full rounded-2xl border border-[#d6ad55] bg-[#fffdf8] p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-[#1f1b16]">Find My Best Size</p>
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                New
              </span>
            </div>
            <button
              type="button"
              onClick={() => setChartOpen(true)}
              className="text-xs font-medium text-[#6b551d] underline underline-offset-4"
            >
              Size Chart
            </button>
          </div>
          <div className="mt-3 grid gap-2 text-[11px] text-[#4a4035] sm:grid-cols-3">
            {["Quick fit finder", "Personal size match", "Fewer returns"].map((label) => (
              <span key={label} className="rounded-xl border border-[#eadfce] bg-white px-2 py-2 text-center">
                {label}
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setFinderOpen(true)}
            className="mt-3 w-full rounded-xl bg-[#1f1b16] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#332b22]"
          >
            Find My Best Size
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setChartOpen(true)}
          className="rounded-full border border-[#d8c7aa] bg-white px-4 py-2 text-sm font-medium text-[#2a241d] transition hover:border-[#a7833f]"
        >
          Size Chart
        </button>
      )}

      {chartOpen && sizeGuide && (
        <div
          className="fixed inset-0 z-[75] flex items-center justify-center bg-black/70 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Size chart"
        >
          <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-[#eadfce] px-4 py-3">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-[#9b7a2f]">
                  Size Chart
                </p>
                <h2 className="text-lg font-semibold text-[#1f1b16]">
                  {sizeGuide.guideName}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setChartOpen(false)}
                className="rounded-full bg-[#1f1b16] px-4 py-2 text-sm font-medium text-white"
              >
                Close
              </button>
            </div>
            <div className="overflow-auto p-4">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-[#f6efe4] text-[#4a4035]">
                    {sizeGuide.fields.map((field) => (
                      <th key={field.id || field.key} className="border border-[#eadfce] px-3 py-2 font-semibold">
                        {field.label}
                        {field.unit && <span className="font-normal text-[#7a6b59]"> ({field.unit})</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sizeGuide.rows.map((row) => (
                    <tr key={row.id}>
                      {sizeGuide.fields.map((field) => (
                        <td key={`${row.id}-${field.key}`} className="border border-[#eadfce] px-3 py-2 text-[#2a241d]">
                          {clean(row.values[field.key]) || "-"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-4 rounded-xl bg-[#fff8e8] p-3 text-sm text-[#6b551d]">
                Brand sizing can vary. Use this chart with your preferred fit before selecting a size.
              </p>
            </div>
          </div>
        </div>
      )}

      {finderOpen && sizeGuide && (
        <div
          className="fixed inset-0 z-[75] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Smart Size Finder"
        >
          <div className="max-h-[95vh] w-full max-w-2xl overflow-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-[#9b7a2f]">
                  Zylo-Buylo Smart Size Finder
                </p>
                <h2 className="mt-1 text-2xl font-semibold text-[#1f1b16]">
                  Find your best fit
                </h2>
                <p className="mt-2 text-sm text-[#6f6659]">
                  Enter only the measurements configured for this category.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFinderOpen(false)}
                className="rounded-full border border-[#d8c7aa] px-4 py-2 text-sm font-medium text-[#2a241d]"
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {fields.map((field) => (
                <label key={field.key} className="block">
                  <span className="text-sm font-medium text-[#2a241d]">
                    {field.label}
                    {field.required && <span className="text-red-600"> *</span>}
                  </span>
                  <div className="mt-2 flex rounded-xl border border-[#d8c7aa] bg-[#fffaf1]">
                    <input
                      value={measurements[field.key] || ""}
                      onChange={(event) =>
                        setMeasurements((current) => ({
                          ...current,
                          [field.key]: event.target.value,
                        }))
                      }
                      inputMode="decimal"
                      className="min-w-0 flex-1 rounded-l-xl bg-transparent px-3 py-3 text-sm outline-none"
                      placeholder="Enter value"
                    />
                    {field.unit && (
                      <span className="grid min-w-14 place-items-center border-l border-[#d8c7aa] px-3 text-xs font-medium text-[#7a6b59]">
                        {field.unit}
                      </span>
                    )}
                  </div>
                </label>
              ))}
            </div>

            {fitPreferenceEnabled && (
            <div className="mt-5">
              <p className="text-sm font-medium text-[#2a241d]">Fit preference</p>
              <div className="mt-2 grid grid-cols-3 rounded-full border border-[#d8c7aa] bg-[#fffaf1] p-1">
                {(["snug", "regular", "relaxed"] as FitPreference[]).map((fit) => (
                  <button
                    key={fit}
                    type="button"
                    onClick={() => setFitPreference(fit)}
                    className={`rounded-full px-3 py-2 text-sm capitalize transition ${
                      fitPreference === fit ? "bg-[#1f1b16] text-white" : "text-[#6f6659]"
                    }`}
                  >
                    {fit}
                  </button>
                ))}
              </div>
            </div>
            )}

            <div className="mt-6 rounded-2xl bg-[#f6efe4] p-4">
              {recommendation.status === "recommended" ? (
                <>
                  <p className="text-sm text-[#6f6659]">Recommended Size</p>
                  <p className="mt-1 text-3xl font-semibold text-[#1f1b16]">
                    {recommendation.recommendedSize}
                  </p>
                  <p className="mt-1 text-sm font-medium text-[#9b7a2f]">
                    {recommendation.fitLabel} · {recommendation.confidence} confidence
                  </p>
                  {recommendation.alternatives?.length ? (
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      {recommendation.alternatives.map((item) => (
                        <span key={item.size} className="rounded-full bg-white px-3 py-1 text-[#4a4035]">
                          {item.size} - {item.label}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      if (recommendation.recommendedSize) {
                        onSelectSize(recommendation.recommendedSize);
                      }
                      setFinderOpen(false);
                    }}
                    className="mt-4 rounded-full bg-[#1f1b16] px-5 py-3 text-sm font-semibold text-white"
                  >
                    Select Size {recommendation.recommendedSize}
                  </button>
                </>
              ) : (
                <>
                  <p className="text-base font-semibold text-[#1f1b16]">
                    Check the Size Chart
                  </p>
                  <p className="mt-2 text-sm text-[#6f6659]">
                    {recommendation.message}
                  </p>
                  {recommendation.missingFields?.length ? (
                    <p className="mt-2 text-sm text-red-700">
                      Missing: {recommendation.missingFields.join(", ")}
                    </p>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
