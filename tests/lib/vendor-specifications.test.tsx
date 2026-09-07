// @vitest-environment jsdom
import React, { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import VendorSpecificationField from "@/components/forms/VendorSpecificationField";
import { normalizeVendorSpecField, parseSpecSelections, serializeSpecSelections, specificationValueText, missingRequiredSpecification, vendorSpecificationLines, type VendorSpecField } from "@/lib/vendor-specifications";

afterEach(cleanup);
const definition = (overrides: Partial<VendorSpecField> = {}) => normalizeVendorSpecField({ name: "internal_key", label: "Display Label", placeholder: "Enter a value", ...overrides });
function Harness({ field, initial = "" }: { field: ReturnType<typeof definition>; initial?: string | boolean | number }) {
  const [value, setValue] = useState<string | boolean | number>(initial);
  return <><VendorSpecificationField field={field} value={value} onChange={setValue} /><output data-testid="value">{String(value)}</output></>;
}

describe("vendor specification compatibility", () => {
  it.each(["Text", "Textarea", "Number", "Date"] as const)("renders %s with the admin label and applicable placeholder", (fieldType) => {
    render(<Harness field={definition({ fieldType })} />);
    const input = screen.getByLabelText("Display Label") as HTMLInputElement;
    expect(input.tagName).toBe(fieldType === "Textarea" ? "TEXTAREA" : "INPUT");
    if (fieldType !== "Textarea") expect(input.type).toBe(fieldType === "Number" ? "number" : fieldType === "Date" ? "date" : "text");
    expect(input.getAttribute("placeholder")).toBe("Enter a value");
    expect(input.name).toBe("internal_key");
  });

  it("renders current Dropdown values instead of legacy options", async () => {
    const user = userEvent.setup();
    render(<Harness field={definition({ fieldType: "Dropdown", dropdownValues: ["Current"], options: ["Legacy"] })} />);
    expect(screen.queryByRole("option", { name: "Legacy" })).toBeNull();
    expect(screen.getByRole("option", { name: "Enter a value" })).toBeTruthy();
    await user.selectOptions(screen.getByLabelText("Display Label"), "Current");
    expect(screen.getByTestId("value").textContent).toBe("Current");
  });

  it("selects and reloads multiple values using the existing string description persistence", async () => {
    const user = userEvent.setup();
    const field = definition({ fieldType: "Multi-select", dropdownValues: ["Red", "Blue", "Red,Blue", 'Size "M"'] });
    const view = render(<Harness field={field} />);
    const select = screen.getByRole("listbox") as HTMLSelectElement;
    expect(select.multiple).toBe(true);
    await user.selectOptions(select, ["Red", "Blue", 'Size "M"']);
    const stored = screen.getByTestId("value").textContent!;
    expect(typeof stored).toBe("string");
    expect(parseSpecSelections(stored, field.dropdownValues)).toEqual(["Red", "Blue", 'Size "M"']);
    const lines = vendorSpecificationLines([field], { internal_key: stored });
    const payload = JSON.parse(JSON.stringify({ description: `Compliance details:\n${lines.join("\n")}` }));
    expect(payload.description).toBe(`Compliance details:\nDisplay Label: ${stored}`);
    view.unmount();
    render(<Harness field={field} initial={stored} />);
    expect(Array.from((screen.getByRole("listbox") as HTMLSelectElement).selectedOptions, (option) => option.value)).toEqual(["Red", "Blue", 'Size "M"']);
    await user.deselectOptions(screen.getByRole("listbox"), "Blue");
    expect(parseSpecSelections(screen.getByTestId("value").textContent)).toEqual(["Red", 'Size "M"']);
  });

  it("renders Yes/No and preserves false as an answered required value", async () => {
    const user = userEvent.setup();
    const field = definition({ fieldType: "Yes/No", required: true });
    render(<Harness field={field} initial={false} />);
    const select = screen.getByLabelText("Display Label *") as HTMLSelectElement;
    expect(select.value).toBe("No");
    expect(missingRequiredSpecification([field], { internal_key: false })).toBeUndefined();
    await user.selectOptions(select, "Yes");
    expect(screen.getByTestId("value").textContent).toBe("Yes");
  });

  it("renders Measurement as numeric entry with an associated configured unit", async () => {
    const user = userEvent.setup();
    const field = definition({ fieldType: "Measurement", label: "Chest", unit: "inch" });
    render(<Harness field={field} initial={38} />);
    const input = screen.getByLabelText("Chest") as HTMLInputElement;
    expect(input.type).toBe("number");
    expect(input.value).toBe("38");
    expect(document.getElementById(input.getAttribute("aria-describedby")!)?.textContent).toBe("inch");
    await user.clear(input);
    await user.type(input, "40.5");
    expect(vendorSpecificationLines([field], { internal_key: screen.getByTestId("value").textContent })).toEqual(["Chest: 40.5 inch"]);
  });

  it("prefers explicit current types and even empty current option arrays without mutating templates", () => {
    const original = { name: "stable_key", label: "Display: unchanged", placeholder: "", fieldType: "Text" as const, dropdownValues: [], options: ["Legacy"], multiline: true };
    const snapshot = JSON.stringify(original);
    const field = normalizeVendorSpecField(original);
    expect(field).toMatchObject({ name: "stable_key", label: "Display: unchanged", fieldType: "Text", dropdownValues: [], placeholder: "" });
    expect(JSON.stringify(original)).toBe(snapshot);
    expect(field.dropdownValues).not.toBe(original.dropdownValues);
  });

  it.each([{ options: ["Legacy"], expected: "Dropdown" }, { multiline: true, expected: "Textarea" }])("supports legacy $expected templates", ({ expected, ...legacy }) => {
    const field = definition(legacy);
    expect(field.fieldType).toBe(expected);
    render(<Harness field={field} initial={expected === "Dropdown" ? "Legacy" : "Existing text"} />);
    expect(screen.getByLabelText("Display Label").tagName).toBe(expected === "Dropdown" ? "SELECT" : "TEXTAREA");
  });

  it("retains legacy embedded options while keeping the saved key", () => {
    expect(definition({ name: "originalKey", label: "Fit: Slim, Regular" })).toMatchObject({ name: "originalKey", label: "Fit", fieldType: "Dropdown", dropdownValues: ["Slim", "Regular"] });
  });

  it("hides admin-only fields and disables non-vendor-editable fields without requiring them", async () => {
    const user = userEvent.setup();
    const hidden = definition({ adminOnly: true, required: true });
    const locked = definition({ vendorEditable: false, required: true });
    const view = render(<Harness field={hidden} initial="secret" />);
    expect(screen.queryByLabelText("Display Label")).toBeNull();
    view.unmount();
    render(<Harness field={locked} initial="Existing" />);
    const input = screen.getByLabelText("Display Label") as HTMLInputElement;
    expect(input.disabled).toBe(true);
    expect(input.required).toBe(false);
    await user.type(input, "changed");
    expect(input.value).toBe("Existing");
    expect(missingRequiredSpecification([hidden, locked], {})).toBeUndefined();
    expect(vendorSpecificationLines([hidden], { internal_key: "secret" })).toEqual([]);
    expect(vendorSpecificationLines([locked], { internal_key: "Existing" })).toEqual(["Display Label: Existing"]);
  });

  it("requires editable fields, rejects empty multiselect, and accepts numeric zero", () => {
    const field = definition({ fieldType: "Multi-select", required: true, dropdownValues: ["S"] });
    render(<Harness field={field} />);
    expect((screen.getByRole("listbox") as HTMLSelectElement).required).toBe(true);
    expect(missingRequiredSpecification([field], { internal_key: [] })).toBe(field);
    expect(missingRequiredSpecification([field], { internal_key: "S" })).toBeUndefined();
    expect(missingRequiredSpecification([definition({ fieldType: "Number", required: true })], { internal_key: 0 })).toBeUndefined();
  });

  it("loads existing single selections and retains values removed from the template", () => {
    render(<Harness field={definition({ fieldType: "Dropdown", dropdownValues: ["New"] })} initial="Old" />);
    expect((screen.getByLabelText("Display Label") as HTMLSelectElement).value).toBe("Old");
    expect(screen.getByRole("option", { name: "Old" })).toBeTruthy();
    expect(parseSpecSelections("Old")).toEqual(["Old"]);
    expect(parseSpecSelections("Red, Blue", ["Red, Blue"])).toEqual(["Red, Blue"]);
    expect(parseSpecSelections(serializeSpecSelections(["Red", "Blue"]), ["Red,Blue", "Red", "Blue"])).toEqual(["Red", "Blue"]);
    expect(parseSpecSelections(serializeSpecSelections(['Size "M"', "Cotton, linen"]))).toEqual(['Size "M"', "Cotton, linen"]);
    expect(parseSpecSelections('"Red", "Blue"')).toEqual(["Red", "Blue"]);
    expect(parseSpecSelections(serializeSpecSelections([" spaced ", "other"]))).toEqual([" spaced ", "other"]);
    expect(parseSpecSelections('Size "M"')).toEqual(['Size "M"']);
    expect(specificationValueText(definition(), "Existing text")).toBe("Existing text");
  });
});
