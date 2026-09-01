import type { CategorySizeGuide, SizeGuideFieldDefinition } from "@/lib/category-size-guide";

export type FitPreference = "snug" | "regular" | "relaxed";

export type SmartSizeInputValue = {
  value: number | string;
  unit?: string;
};

export type SmartSizeRecommendationInput = {
  sizeGuide: CategorySizeGuide | null | undefined;
  measurements: Record<string, SmartSizeInputValue | string | number | null | undefined>;
  availableSizes?: string[];
  unavailableSizes?: string[];
  fitPreference?: FitPreference;
  enabled?: boolean;
  tolerance?: number;
};

export type SmartSizeRecommendation = {
  status: "recommended" | "disabled" | "missing-input" | "no-match" | "no-available-size";
  recommendedSize?: string;
  confidence?: "high" | "medium" | "low";
  fitLabel?: "Best Fit" | "Snug Fit" | "Relaxed Fit";
  missingFields?: string[];
  alternatives?: Array<{
    size: string;
    label: "Snug" | "Regular" | "Relaxed";
    confidence: "medium" | "low";
  }>;
  message: string;
};

const sizeKeys = new Set([
  "size",
  "india_size",
  "uk_size",
  "us_size",
  "eu_size",
  "age_group",
]);

const nonMeasurementKeys = new Set(["label", "name", "fit", "guide_type"]);

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeKey(value: string) {
  return value
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeUnit(value: unknown) {
  const unit = text(value).toLowerCase();
  if (["in", "inch", "inches", '"'].includes(unit)) return "inch";
  if (["cm", "centimeter", "centimeters"].includes(unit)) return "cm";
  if (["kg", "kilogram", "kilograms"].includes(unit)) return "kg";
  if (["lb", "lbs", "pound", "pounds"].includes(unit)) return "lb";
  return unit;
}

function convertValue(value: number, fromUnit: string, toUnit: string) {
  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);
  if (!from || !to || from === to) return value;
  if (from === "cm" && to === "inch") return value / 2.54;
  if (from === "inch" && to === "cm") return value * 2.54;
  if (from === "kg" && to === "lb") return value * 2.20462;
  if (from === "lb" && to === "kg") return value / 2.20462;
  return value;
}

function parseRange(value: unknown) {
  const source = text(value).replace(/,/g, ".");
  if (!source) return null;
  const numbers = source.match(/-?\d+(?:\.\d+)?/g)?.map(Number).filter(Number.isFinite) || [];
  if (!numbers.length) return null;
  if (numbers.length === 1) {
    return { min: numbers[0], max: numbers[0], mid: numbers[0] };
  }
  const min = Math.min(numbers[0], numbers[1]);
  const max = Math.max(numbers[0], numbers[1]);
  return { min, max, mid: (min + max) / 2 };
}

function fieldIsMeasurement(field: SizeGuideFieldDefinition) {
  const key = normalizeKey(field.key);
  if (!key || sizeKeys.has(key) || nonMeasurementKeys.has(key)) return false;
  return true;
}

function getSizeValue(rowValues: Record<string, string>) {
  for (const key of sizeKeys) {
    const value = text(rowValues[key]);
    if (value) return value;
  }
  const firstValue = Object.values(rowValues).map(text).find(Boolean);
  return firstValue || "";
}

function normalizeSizeSet(values: string[] | undefined) {
  return new Set((values || []).map((item) => normalizeKey(item)));
}

function getGuideSizeSet(sizeGuide: CategorySizeGuide | null | undefined) {
  return new Set(
    (sizeGuide?.rows || [])
      .map((row) => normalizeKey(getSizeValue(row.values)))
      .filter(Boolean),
  );
}

function inputNumber(
  measurements: SmartSizeRecommendationInput["measurements"],
  field: SizeGuideFieldDefinition,
) {
  const raw = measurements[field.key] ?? measurements[normalizeKey(field.key)];
  if (raw === null || raw === undefined || raw === "") return null;
  const value =
    typeof raw === "object" && "value" in raw
      ? Number((raw as SmartSizeInputValue).value)
      : Number(raw);
  if (!Number.isFinite(value)) return null;
  const inputUnit =
    typeof raw === "object" && "unit" in raw ? String((raw as SmartSizeInputValue).unit || "") : "";
  return convertValue(value, inputUnit, field.unit);
}

function scoreMeasurement(value: number, rowValue: string, fitPreference: FitPreference, tolerance: number) {
  const range = parseRange(rowValue);
  if (!range) return null;
  const looseBias = fitPreference === "relaxed" ? tolerance * 0.35 : fitPreference === "snug" ? -tolerance * 0.25 : 0;
  const adjusted = value + looseBias;
  if (adjusted >= range.min && adjusted <= range.max) {
    const centerDistance = Math.abs(adjusted - range.mid);
    return centerDistance / Math.max(1, range.max - range.min || tolerance);
  }
  const distance = adjusted < range.min ? range.min - adjusted : adjusted - range.max;
  return 1 + distance / Math.max(tolerance, 0.5);
}

export function getSmartSizeMeasurementFields(sizeGuide: CategorySizeGuide | null | undefined) {
  return (sizeGuide?.fields || [])
    .filter(fieldIsMeasurement)
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

export function canUseSmartSizeFinder(sizeGuide: CategorySizeGuide | null | undefined) {
  return Boolean(
    sizeGuide?.smartSizeFinder?.enabled !== false &&
      sizeGuide?.rows?.length &&
      getSmartSizeMeasurementFields(sizeGuide).length,
  );
}

export function canUseSmartSizeFinderForOptions(
  sizeGuide: CategorySizeGuide | null | undefined,
  sizeOptions: Array<{ label: string; available?: boolean }> | undefined,
) {
  if (!canUseSmartSizeFinder(sizeGuide)) return false;
  const availableOptions = (sizeOptions || [])
    .filter((option) => option.available !== false)
    .map((option) => normalizeKey(option.label))
    .filter(Boolean);
  if (!availableOptions.length) return false;

  const guideSizes = getGuideSizeSet(sizeGuide);
  return availableOptions.some((option) => guideSizes.has(option));
}

export function recommendSmartSize(input: SmartSizeRecommendationInput): SmartSizeRecommendation {
  const sizeGuide = input.sizeGuide;
  if (!sizeGuide || input.enabled === false || !canUseSmartSizeFinder(sizeGuide)) {
    return {
      status: "disabled",
      message: "Smart Size Finder is not enabled for this category.",
    };
  }

  const fields = getSmartSizeMeasurementFields(sizeGuide);
  const requiredFields = fields.filter((field) => field.required);
  const missingFields = requiredFields.filter((field) => inputNumber(input.measurements, field) === null);
  if (missingFields.length) {
    return {
      status: "missing-input",
      missingFields: missingFields.map((field) => field.label || field.key),
      message: "Add the required measurements to calculate a size.",
    };
  }

  const available = normalizeSizeSet(input.availableSizes);
  const unavailable = normalizeSizeSet(input.unavailableSizes);
  const hasAvailabilityFilter = Boolean(input.availableSizes?.length);
  const tolerance = Number(input.tolerance || sizeGuide.smartSizeFinder?.recommendationTolerance || 1.5);
  const fitPreference = input.fitPreference || "regular";
  const scoredRows = sizeGuide.rows
    .map((row) => {
      const size = getSizeValue(row.values);
      const normalizedSize = normalizeKey(size);
      if (!size || unavailable.has(normalizedSize)) return null;
      if (hasAvailabilityFilter && !available.has(normalizedSize)) return null;

      const scores = fields
        .map((field) => {
          const value = inputNumber(input.measurements, field);
          if (value === null) return null;
          return scoreMeasurement(value, row.values[field.key], fitPreference, tolerance);
        })
        .filter((score): score is number => score !== null);

      if (!scores.length) return null;
      const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      return { size, score: average };
    })
    .filter((row): row is { size: string; score: number } => Boolean(row))
    .sort((a, b) => a.score - b.score);

  if (!scoredRows.length) {
    return {
      status: hasAvailabilityFilter ? "no-available-size" : "no-match",
      message: "Your measurements fall between the available size ranges. Please check the Size Chart.",
    };
  }

  const best = scoredRows[0];
  if (best.score > 2.4) {
    return {
      status: "no-match",
      message: "Your measurements fall outside the available size ranges. Please check the Size Chart.",
    };
  }

  const confidence = best.score <= 0.45 ? "high" : best.score <= 1.2 ? "medium" : "low";
  const fitLabel =
    fitPreference === "snug" ? "Snug Fit" : fitPreference === "relaxed" ? "Relaxed Fit" : "Best Fit";

  return {
    status: "recommended",
    recommendedSize: best.size,
    confidence,
    fitLabel,
    alternatives: scoredRows
      .slice(1, 3)
      .filter((row) => row.score <= 1.8)
      .map((row) => ({
        size: row.size,
        label: row.score <= 0.8 ? "Regular" : row.score <= 1.3 ? "Snug" : "Relaxed",
        confidence: row.score <= 1.1 ? "medium" : "low",
      })),
    message: `Recommended Size: ${best.size}`,
  };
}
