export type SizeGuideFieldDefinition = {
  id: string;
  key: string;
  label: string;
  unit: string;
  displayOrder: number;
  required: boolean;
};

export type SizeGuideMeasurementRow = {
  id: string;
  values: Record<string, string>;
};

export type CategorySizeGuide = {
  id: string;
  guideType: string;
  guideName: string;
  smartSizeFinder?: {
    enabled: boolean;
    version: number;
    fitPreferenceEnabled: boolean;
    recommendationTolerance: number;
    notes: string;
  };
  fields: SizeGuideFieldDefinition[];
  rows: SizeGuideMeasurementRow[];
};

type LegacySizeGuideRow = {
  id?: string;
  guideType?: string;
  india?: string;
  uk?: string;
  us?: string;
  eu?: string;
  chest?: string;
  waist?: string;
  hip?: string;
  length?: string;
  footLength?: string;
  ageGroup?: string;
};

type SizeGuideTemplate = {
  key: string;
  name: string;
  fields: Array<Pick<SizeGuideFieldDefinition, "key" | "label" | "unit" | "required">>;
  exampleRows: Array<Record<string, string>>;
};

export const localId = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;

export const sizeGuideTemplates: SizeGuideTemplate[] = [
  {
    key: "womens-kurtis",
    name: "Women's Kurtis",
    fields: [
      { key: "size", label: "Size", unit: "", required: true },
      { key: "bust", label: "Bust / Chest", unit: "inch", required: true },
      { key: "waist", label: "Waist", unit: "inch", required: true },
      { key: "hip", label: "Hip", unit: "inch", required: false },
      { key: "kurti_length", label: "Kurti Length", unit: "inch", required: false },
    ],
    exampleRows: [
      { size: "S", bust: "36", waist: "32", hip: "38", kurti_length: "42" },
      { size: "M", bust: "38", waist: "34", hip: "40", kurti_length: "43" },
      { size: "L", bust: "40", waist: "36", hip: "42", kurti_length: "44" },
    ],
  },
  {
    key: "mens-shirts",
    name: "Men's Shirts",
    fields: [
      { key: "size", label: "Size", unit: "", required: true },
      { key: "chest", label: "Chest", unit: "inch", required: true },
      { key: "shoulder", label: "Shoulder", unit: "inch", required: false },
      { key: "sleeve_length", label: "Sleeve Length", unit: "inch", required: false },
      { key: "shirt_length", label: "Shirt Length", unit: "inch", required: false },
    ],
    exampleRows: [
      { size: "S", chest: "38", shoulder: "17", sleeve_length: "24", shirt_length: "28" },
      { size: "M", chest: "40", shoulder: "18", sleeve_length: "25", shirt_length: "29" },
      { size: "L", chest: "42", shoulder: "19", sleeve_length: "26", shirt_length: "30" },
    ],
  },
  {
    key: "womens-tops",
    name: "Women's Tops",
    fields: [
      { key: "size", label: "Size", unit: "", required: true },
      { key: "bust", label: "Bust", unit: "inch", required: true },
      { key: "waist", label: "Waist", unit: "inch", required: false },
      { key: "shoulder", label: "Shoulder", unit: "inch", required: false },
      { key: "top_length", label: "Top Length", unit: "inch", required: false },
    ],
    exampleRows: [
      { size: "S", bust: "34", waist: "30", shoulder: "14", top_length: "24" },
      { size: "M", bust: "36", waist: "32", shoulder: "15", top_length: "25" },
      { size: "L", bust: "38", waist: "34", shoulder: "16", top_length: "26" },
    ],
  },
  {
    key: "trousers-jeans",
    name: "Trousers / Jeans",
    fields: [
      { key: "waist", label: "Waist", unit: "inch", required: true },
      { key: "hip", label: "Hip", unit: "inch", required: false },
      { key: "inseam", label: "Inseam", unit: "inch", required: false },
      { key: "outseam", label: "Outseam", unit: "inch", required: false },
    ],
    exampleRows: [
      { waist: "30", hip: "36", inseam: "30", outseam: "40" },
      { waist: "32", hip: "38", inseam: "31", outseam: "41" },
      { waist: "34", hip: "40", inseam: "32", outseam: "42" },
    ],
  },
  {
    key: "footwear",
    name: "Footwear",
    fields: [
      { key: "india_size", label: "India Size", unit: "", required: true },
      { key: "uk_size", label: "UK Size", unit: "", required: false },
      { key: "us_size", label: "US Size", unit: "", required: false },
      { key: "eu_size", label: "EU Size", unit: "", required: false },
      { key: "foot_length_cm", label: "Foot Length", unit: "cm", required: false },
    ],
    exampleRows: [
      { india_size: "6", uk_size: "6", us_size: "7", eu_size: "40", foot_length_cm: "25" },
      { india_size: "7", uk_size: "7", us_size: "8", eu_size: "41", foot_length_cm: "26" },
      { india_size: "8", uk_size: "8", us_size: "9", eu_size: "42", foot_length_cm: "27" },
    ],
  },
  {
    key: "kids-clothing",
    name: "Kids Clothing",
    fields: [
      { key: "age_group", label: "Age Group", unit: "years", required: true },
      { key: "height_cm", label: "Height", unit: "cm", required: true },
      { key: "chest", label: "Chest", unit: "inch", required: false },
      { key: "waist", label: "Waist", unit: "inch", required: false },
      { key: "garment_length", label: "Garment Length", unit: "inch", required: false },
    ],
    exampleRows: [
      { age_group: "2-3Y", height_cm: "92-98", chest: "21", waist: "20", garment_length: "18" },
      { age_group: "4-5Y", height_cm: "104-110", chest: "23", waist: "22", garment_length: "20" },
      { age_group: "6-7Y", height_cm: "116-122", chest: "25", waist: "23", garment_length: "22" },
    ],
  },
];

const legacyFieldLabels: Record<keyof LegacySizeGuideRow, string> = {
  id: "ID",
  guideType: "Guide Type",
  india: "India Size",
  uk: "UK Size",
  us: "US Size",
  eu: "EU Size",
  chest: "Chest",
  waist: "Waist",
  hip: "Hip",
  length: "Length",
  footLength: "Foot Length",
  ageGroup: "Age Group",
};

const legacyFieldUnits: Record<string, string> = {
  chest: "inch",
  waist: "inch",
  hip: "inch",
  length: "inch",
  footLength: "cm",
  ageGroup: "years",
};

const legacyKeys: Array<keyof LegacySizeGuideRow> = [
  "india",
  "uk",
  "us",
  "eu",
  "chest",
  "waist",
  "hip",
  "length",
  "footLength",
  "ageGroup",
];

export function normalizeSizeGuideKey(value: string) {
  return value
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSmartSizeFinderConfig(input: unknown) {
  const row = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const tolerance = Number(row.recommendationTolerance);
  return {
    enabled: row.enabled === false ? false : true,
    version: Number.isFinite(Number(row.version)) ? Number(row.version) : 1,
    fitPreferenceEnabled: row.fitPreferenceEnabled === false ? false : true,
    recommendationTolerance: Number.isFinite(tolerance) && tolerance > 0 ? tolerance : 1.5,
    notes: text(row.notes),
  };
}

function createFields(
  fields: SizeGuideTemplate["fields"],
): SizeGuideFieldDefinition[] {
  return fields.map((field, index) => ({
    id: localId("sg-field"),
    key: normalizeSizeGuideKey(field.key),
    label: field.label,
    unit: field.unit,
    displayOrder: index + 1,
    required: field.required,
  }));
}

function createRows(rows: SizeGuideTemplate["exampleRows"]): SizeGuideMeasurementRow[] {
  return rows.map((row) => ({
    id: localId("sg-row"),
    values: Object.fromEntries(
      Object.entries(row).map(([key, value]) => [normalizeSizeGuideKey(key), String(value)]),
    ),
  }));
}

export function createSizeGuideFromTemplate(templateKey: string): CategorySizeGuide {
  const template =
    sizeGuideTemplates.find((item) => item.key === templateKey) ||
    sizeGuideTemplates[0];

  return {
    id: localId("sg"),
    guideType: template.key,
    guideName: template.name,
    smartSizeFinder: normalizeSmartSizeFinderConfig(undefined),
    fields: createFields(template.fields),
    rows: createRows(template.exampleRows),
  };
}

export function getRecommendedSizeGuideTemplateKey(context: string) {
  const source = context.toLowerCase();
  if (/footwear|shoe|sandal|slipper|sneaker|boot/.test(source)) return "footwear";
  if (/kid|child|children|baby|boys|girls/.test(source)) return "kids-clothing";
  if (/trouser|jean|pant|bottom/.test(source)) return "trousers-jeans";
  if (/shirt|formal|top wear|mens|men's/.test(source)) return "mens-shirts";
  if (/top|western/.test(source)) return "womens-tops";
  if (/kurti|ethnic|saree|lehenga|dress/.test(source)) return "womens-kurtis";
  return "womens-kurtis";
}

function sanitizeFields(input: unknown[]): SizeGuideFieldDefinition[] {
  const seen = new Set<string>();

  return input
    .map((item, index) => {
      const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const key = normalizeSizeGuideKey(text(row.key) || text(row.name) || text(row.label));
      if (!key || seen.has(key)) return null;
      seen.add(key);
      return {
        id: text(row.id) || localId("sg-field"),
        key,
        label: text(row.label) || key.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
        unit: text(row.unit),
        displayOrder: Number.isFinite(Number(row.displayOrder)) ? Number(row.displayOrder) : index + 1,
        required: row.required === false ? false : true,
      };
    })
    .filter((field): field is SizeGuideFieldDefinition => Boolean(field))
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((field, index) => ({ ...field, displayOrder: index + 1 }));
}

function sanitizeRows(input: unknown[], fields: SizeGuideFieldDefinition[]): SizeGuideMeasurementRow[] {
  const fieldKeys = new Set(fields.map((field) => field.key));
  return input.map((item) => {
    const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const sourceValues =
      row.values && typeof row.values === "object" ? (row.values as Record<string, unknown>) : row;
    const values: Record<string, string> = {};
    for (const field of fields) {
      values[field.key] = text(sourceValues[field.key]);
    }
    for (const [key, value] of Object.entries(sourceValues)) {
      const normalizedKey = normalizeSizeGuideKey(key);
      if (fieldKeys.has(normalizedKey)) {
        values[normalizedKey] = text(value);
      }
    }
    return {
      id: text(row.id) || localId("sg-row"),
      values,
    };
  });
}

function normalizeLegacySizeGuide(input: LegacySizeGuideRow[], context: string): CategorySizeGuide {
  const guideName =
    input.map((row) => text(row.guideType)).find(Boolean) ||
    sizeGuideTemplates.find((item) => item.key === getRecommendedSizeGuideTemplateKey(context))?.name ||
    "Category Size Guide";
  const activeLegacyKeys = legacyKeys.filter((key) =>
    input.some((row) => text(row[key]).length > 0),
  );
  const fieldKeys: Array<keyof LegacySizeGuideRow> = activeLegacyKeys.length
    ? activeLegacyKeys
    : createSizeGuideFromTemplate(getRecommendedSizeGuideTemplateKey(context)).fields
        .map((field) => field.key)
        .filter((key): key is keyof LegacySizeGuideRow => legacyKeys.includes(key as keyof LegacySizeGuideRow));
  const fields = fieldKeys.map((key, index) => ({
    id: localId("sg-field"),
    key: normalizeSizeGuideKey(String(key)),
    label: legacyFieldLabels[key] || String(key),
    unit: legacyFieldUnits[String(key)] || "",
    displayOrder: index + 1,
    required: index === 0,
  }));

  return {
    id: localId("sg"),
    guideType: normalizeSizeGuideKey(guideName) || getRecommendedSizeGuideTemplateKey(context),
    guideName,
    smartSizeFinder: normalizeSmartSizeFinderConfig(undefined),
    fields,
    rows: sanitizeRows(input, fields),
  };
}

export function normalizeCategorySizeGuide(input: unknown, context = ""): CategorySizeGuide {
  if (Array.isArray(input)) {
    return normalizeLegacySizeGuide(input as LegacySizeGuideRow[], context);
  }

  const row = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const fields = sanitizeFields(Array.isArray(row.fields) ? row.fields : []);
  const fallback = createSizeGuideFromTemplate(getRecommendedSizeGuideTemplateKey(context));
  const normalizedFields = fields.length ? fields : fallback.fields;

  return {
    id: text(row.id) || localId("sg"),
    guideType: text(row.guideType) || fallback.guideType,
    guideName: text(row.guideName) || text(row.name) || fallback.guideName,
    smartSizeFinder: normalizeSmartSizeFinderConfig(row.smartSizeFinder),
    fields: normalizedFields,
    rows: sanitizeRows(Array.isArray(row.rows) ? row.rows : [], normalizedFields),
  };
}

export function createEmptySizeGuide(context = ""): CategorySizeGuide {
  const guide = createSizeGuideFromTemplate(getRecommendedSizeGuideTemplateKey(context));
  return {
    ...guide,
    rows: [],
  };
}

export function hasSizeGuideContent(sizeGuide: CategorySizeGuide) {
  return (
    sizeGuide.fields.length > 0 &&
    sizeGuide.rows.some((row) =>
      sizeGuide.fields.some((field) => text(row.values[field.key]).length > 0),
    )
  );
}

export function formatSizeGuideChart(sizeGuide: CategorySizeGuide) {
  return sizeGuide.rows
    .map((row) => {
      const values = sizeGuide.fields
        .map((field) => {
          const value = text(row.values[field.key]);
          if (!value) return "";
          return `${field.label}${field.unit ? ` (${field.unit})` : ""}: ${value}`;
        })
        .filter(Boolean);
      return values.length ? `${sizeGuide.guideName}: ${values.join(", ")}` : "";
    })
    .filter(Boolean)
    .join("\n");
}
