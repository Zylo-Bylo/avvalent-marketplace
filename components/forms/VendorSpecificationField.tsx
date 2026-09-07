"use client";

import { useId } from "react";
import {
  parseSpecSelections, serializeSpecSelections, specificationValueText,
  vendorCanEditSpecification, type NormalizedVendorSpecField,
} from "@/lib/vendor-specifications";

export default function VendorSpecificationField({ field, value, onChange }: {
  field: NormalizedVendorSpecField;
  value: unknown;
  onChange: (value: string) => void;
}) {
  const id = useId();
  if (field.adminOnly) return null;
  const disabled = !vendorCanEditSpecification(field);
  const text = specificationValueText(field, value);
  const common = {
    id, name: field.name, disabled, required: Boolean(field.required && !disabled),
    className: "w-full min-w-0 rounded-xl border bg-white p-3 font-normal text-slate-900 disabled:bg-slate-100",
  };
  let control;
  if (field.fieldType === "Textarea") {
    control = <textarea {...common} value={text} placeholder={field.placeholder} onChange={(event) => onChange(event.target.value)} rows={4} />;
  } else if (field.fieldType === "Dropdown" || field.fieldType === "Multi-select" || field.fieldType === "Yes/No") {
    const multiple = field.fieldType === "Multi-select";
    const selected = multiple ? parseSpecSelections(value, field.dropdownValues) : [text];
    const configured = field.fieldType === "Yes/No" ? ["Yes", "No"] : field.dropdownValues;
    // Keep saved values selectable even if an administrator later removes an option.
    const options = [...new Set([...configured, ...selected.filter(Boolean)])];
    control = <select {...common} multiple={multiple} value={multiple ? selected : text} size={multiple ? Math.min(6, Math.max(3, options.length)) : undefined}
      onChange={(event) => onChange(multiple ? serializeSpecSelections(Array.from(event.target.selectedOptions, (option) => option.value)) : event.target.value)}>
      {!multiple && <option value="">{field.placeholder || "Select an option"}</option>}
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>;
  } else {
    const numeric = field.fieldType === "Number" || field.fieldType === "Measurement";
    control = <input {...common} type={numeric ? "number" : field.fieldType === "Date" ? "date" : "text"} step={numeric ? "any" : undefined}
      value={text} placeholder={field.placeholder} aria-describedby={field.unit ? `${id}-unit` : undefined} onChange={(event) => onChange(event.target.value)} />;
  }
  return <div className="grid min-w-0 gap-2 text-sm font-bold text-slate-700">
    <label htmlFor={id}>{field.label}{field.required && !disabled ? " *" : ""}</label>
    <div className="flex items-center gap-2">{control}{field.unit && <span id={`${id}-unit`} className="shrink-0 font-normal">{field.unit}</span>}</div>
    {field.fieldType === "Multi-select" && <span className="text-xs font-normal">{field.placeholder || "Select one or more values."} Use Ctrl (Windows) or Command (Mac) to select multiple.</span>}
  </div>;
}
