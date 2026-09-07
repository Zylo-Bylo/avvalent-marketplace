// @vitest-environment jsdom
import React, { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  SpecificationsEditor, normalizeSpecField, createSpecification,
  serializeSpecifications, specificationIdentityIssues,
} from "@/components/admin/CategoryAtelierWorkspace";

vi.mock("@/components/navbar/Navbar", () => ({ default: () => null }));
vi.mock("next/navigation", () => ({ useRouter: vi.fn(), useSearchParams: vi.fn() }));
afterEach(cleanup);

type Field = ReturnType<typeof normalizeSpecField>;
function Harness({ initial }: { initial: Field[] }) {
  const [fields, setFields] = useState(initial);
  return <><SpecificationsEditor fields={fields} onChange={setFields} /><output data-testid="saved">{JSON.stringify(serializeSpecifications(fields))}</output></>;
}
const saved = () => JSON.parse(screen.getByTestId("saved").textContent || "[]");

describe("active specification editor", () => {
  it("shows persistent labels, all eight types, and six readable flag labels with existing defaults", () => {
    render(<Harness initial={[normalizeSpecField({ fieldType: "Measurement" }, 0)]} />);
    for (const label of ["Field Key", "Display Label", "Field Type", "Unit", "Placeholder"]) expect(screen.getByLabelText(label)).toBeTruthy();
    expect(within(screen.getByLabelText("Field Type")).getAllByRole("option").map((option) => option.textContent)).toEqual(["Text", "Textarea", "Number", "Dropdown", "Multi-select", "Yes/No", "Measurement", "Date"]);
    for (const label of ["Required", "Customer Visible", "Filterable", "Searchable", "Vendor Editable", "Admin Only"]) expect(screen.getByRole("checkbox", { name: label })).toBeTruthy();
    expect(screen.getAllByRole("checkbox")).toHaveLength(6);
    expect(saved()[0]).toMatchObject({ required: false, customerVisible: true, filterable: false, searchable: false, vendorEditable: true, adminOnly: false });
    expect(screen.getByRole("heading", { name: "Specification 1 — Field 1" })).toBeTruthy();
  });

  it.each(["Dropdown", "Multi-select"] as const)("supports Enter, paste, and array serialization for %s", async (fieldType) => {
    const user = userEvent.setup();
    render(<Harness initial={[normalizeSpecField({ fieldType }, 0)]} />);
    const options = screen.getByRole("textbox", { name: /Dropdown \/ Multi-select Values/ }) as HTMLTextAreaElement;
    await user.type(options, "Shirt{Enter}");
    expect(options.value).toBe("Shirt\n");
    await user.type(options, "T-Shirt{Enter}Jeans{Enter}");
    await user.paste(" Trousers \n\nKurti\n");
    expect(options.value).toBe("Shirt\nT-Shirt\nJeans\n Trousers \n\nKurti\n");
    expect(saved()[0].dropdownValues).toEqual(["Shirt", "T-Shirt", "Jeans", "Trousers", "Kurti"]);
    await user.tab();
    expect(options.value).toBe("Shirt\nT-Shirt\nJeans\nTrousers\nKurti");
  });

  it("updates each flag through its readable label without changing other flags", async () => {
    const user = userEvent.setup();
    render(<Harness initial={[normalizeSpecField({}, 0)]} />);
    const flags = { required: "Required", customerVisible: "Customer Visible", filterable: "Filterable", searchable: "Searchable", vendorEditable: "Vendor Editable", adminOnly: "Admin Only" };
    for (const [key, label] of Object.entries(flags)) {
      const before = saved()[0];
      await user.click(screen.getByRole("checkbox", { name: label }));
      expect(saved()[0]).toEqual({ ...before, [key]: !before[key] });
    }
  });

  it("keeps focus and row identity while editing Field Key and deleting a preceding row", async () => {
    const user = userEvent.setup();
    render(<Harness initial={[normalizeSpecField({}, 0), normalizeSpecField({}, 1)]} />);
    const key = screen.getAllByLabelText("Field Key")[1] as HTMLInputElement;
    await user.clear(key);
    await user.type(key, "product_type");
    expect(document.activeElement).toBe(key);
    expect(screen.getAllByLabelText("Field Key")[1]).toBe(key);
    expect(key.value).toBe("product_type");
    await user.click(screen.getAllByRole("button", { name: "Remove" })[0]);
    expect(screen.getByLabelText("Field Key")).toBe(key);
    expect(saved()[0].name).toBe("product_type");
  });

  it("adds collision-free keys after deletion and manual renaming", async () => {
    const user = userEvent.setup();
    const fields = [normalizeSpecField({}, 0), normalizeSpecField({}, 2)];
    expect(createSpecification(fields).name).toBe("field_2");
    expect(createSpecification([...fields, normalizeSpecField({ name: " FIELD_2 " }, 3)]).name).toBe("field_4");
    render(<Harness initial={fields} />);
    await user.click(screen.getByRole("button", { name: "Add Specification" }));
    expect(saved().map((field: Field) => field.name)).toEqual(["field_1", "field_3", "field_2"]);
  });

  it("preserves options and units across type changes and excludes UI identity from the stored object", async () => {
    const user = userEvent.setup();
    render(<Harness initial={[normalizeSpecField({ fieldType: "Dropdown", dropdownValues: ["S", "M"], unit: "inch" }, 0)]} />);
    await user.selectOptions(screen.getByLabelText("Field Type"), "Text");
    expect(screen.queryByRole("textbox", { name: /Dropdown \/ Multi-select Values/ })).toBeNull();
    expect(saved()[0]).toMatchObject({ dropdownValues: ["S", "M"], unit: "inch" });
    await user.selectOptions(screen.getByLabelText("Field Type"), "Multi-select");
    expect((screen.getByRole("textbox", { name: /Dropdown \/ Multi-select Values/ }) as HTMLTextAreaElement).value).toBe("S\nM");
    const result = serializeSpecifications([normalizeSpecField({}, 0)])[0];
    expect(Object.getOwnPropertySymbols(result)).toHaveLength(0);
    expect(Object.keys(result).sort()).toEqual(["name", "label", "fieldType", "dropdownValues", "unit", "placeholder", "required", "customerVisible", "filterable", "searchable", "vendorEditable", "adminOnly", "displayOrder"].sort());
  });

  it("shows Unit for Measurement and Number while keeping it unobtrusive for other empty-unit types", async () => {
    const user = userEvent.setup();
    render(<Harness initial={[normalizeSpecField({}, 0)]} />);
    expect(screen.queryByLabelText("Unit")).toBeNull();
    for (const type of ["Measurement", "Number"]) {
      await user.selectOptions(screen.getByLabelText("Field Type"), type);
      expect(screen.getByLabelText("Unit")).toBeTruthy();
    }
  });

  it("identifies blank keys, blank labels and duplicate keys using publish issue objects and inline messages", async () => {
    const user = userEvent.setup();
    render(<Harness initial={[normalizeSpecField({}, 0), normalizeSpecField({}, 1)]} />);
    await user.clear(screen.getAllByLabelText("Field Key")[0]);
    await user.clear(screen.getAllByLabelText("Display Label")[0]);
    expect(screen.getByText("Specification 1: Field Key is required.")).toBeTruthy();
    expect(screen.getByText("Specification 1: Display Label is required.")).toBeTruthy();
    await user.type(screen.getAllByLabelText("Field Key")[0], "field_2");
    expect(screen.getAllByText(/Field Key must be unique/)).toHaveLength(2);
    expect(specificationIdentityIssues([{ ...normalizeSpecField({}, 0), name: "", label: "" }])).toEqual([
      { tab: "specifications", field: "", message: "Specification 1: Field Key is required.", severity: "error" },
      { tab: "specifications", field: "", message: "Specification 1: Display Label is required.", severity: "error" },
    ]);
  });
});
