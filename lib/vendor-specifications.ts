export const specificationTypes = ["Text", "Textarea", "Number", "Dropdown", "Multi-select", "Yes/No", "Measurement", "Date"] as const;
export type SpecificationType = (typeof specificationTypes)[number];

export type VendorSpecField = {
  name: string;
  label: string;
  placeholder: string;
  fieldType?: SpecificationType;
  dropdownValues?: string[];
  unit?: string;
  options?: string[];
  multiline?: boolean;
  required?: boolean;
  vendorEditable?: boolean;
  adminOnly?: boolean;
  customerVisible?: boolean;
  filterable?: boolean;
  searchable?: boolean;
  displayOrder?: number;
};

export type NormalizedVendorSpecField = VendorSpecField & {
  fieldType: SpecificationType;
  dropdownValues: string[];
};

export function normalizeVendorSpecField(field: VendorSpecField): NormalizedVendorSpecField {
  const currentType = specificationTypes.includes(field.fieldType as SpecificationType) ? field.fieldType : undefined;
  const rawLabel = String(field.label || field.name || "").trim();
  const colon = rawLabel.indexOf(":");
  const embedded = !currentType && field.dropdownValues === undefined && !field.options?.length && colon > 0;
  const label = embedded ? rawLabel.slice(0, colon).trim() : rawLabel;
  const dropdownValues = [...(field.dropdownValues ?? field.options ?? (embedded ? rawLabel.slice(colon + 1).split(",").map((option) => option.trim()).filter(Boolean) : []))];
  return {
    ...field,
    // A display-label edit must never redirect values to a different form key.
    name: field.name || label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48),
    label: label || "Product Detail",
    placeholder: field.placeholder ?? `Select or enter ${label || "value"}`,
    fieldType: currentType ?? (field.multiline ? "Textarea" : dropdownValues.length ? "Dropdown" : "Text"),
    dropdownValues,
  };
}

export function vendorCanEditSpecification(field: VendorSpecField) {
  return !field.adminOnly && field.vendorEditable !== false;
}

// Multiple values remain a string, as required by the existing upload payload
// and description persistence. CSV quoting preserves commas and quotes in options.
export function serializeSpecSelections(values: string[]): string {
  return values.map((value) => values.length > 1 || /[",\r\n]|^\s|\s$/.test(value) ? `"${value.replace(/"/g, '""')}"` : value).join(",");
}

export function parseSpecSelections(value: unknown, options: string[] = []): string[] {
  if (Array.isArray(value)) return value.map(String);
  const text = String(value ?? "");
  if (!text.trim()) return [];
  // Preserve an existing single option whose own value contains a comma.
  if (options.includes(text) && !text.startsWith('"')) return [text];
  const values: string[] = [];
  let item = "";
  let quoted = false;
  let wasQuoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"' && (quoted || !item.trim())) {
      if (quoted && text[i + 1] === '"') { item += '"'; i += 1; }
      else { if (!quoted) item = ""; quoted = !quoted; wasQuoted = true; }
    } else if (char === "," && !quoted) {
      values.push(wasQuoted ? item : item.trim()); item = ""; wasQuoted = false;
    } else if (!(wasQuoted && !quoted && /\s/.test(char))) item += char;
  }
  values.push(wasQuoted ? item : item.trim());
  return values.filter(Boolean);
}

export function specificationValueText(field: NormalizedVendorSpecField, value: unknown): string {
  if (field.fieldType === "Multi-select") return serializeSpecSelections(parseSpecSelections(value, field.dropdownValues));
  if (field.fieldType === "Yes/No") {
    if (value === true || value === "true") return "Yes";
    if (value === false || value === "false") return "No";
  }
  return String(value ?? "");
}

export function missingRequiredSpecification(fields: NormalizedVendorSpecField[], values: Record<string, unknown>) {
  return fields.find((field) => field.required && vendorCanEditSpecification(field) && !specificationValueText(field, values[field.name]).trim());
}

export function vendorSpecificationLines(fields: NormalizedVendorSpecField[], values: Record<string, unknown>, excludedNames = new Set<string>()) {
  return fields.filter((field) => !field.adminOnly && !excludedNames.has(field.name)).flatMap((field) => {
    const value = specificationValueText(field, values[field.name]).trim();
    return value ? [`${field.label}: ${value}${field.fieldType === "Measurement" && field.unit ? ` ${field.unit}` : ""}`] : [];
  });
}
