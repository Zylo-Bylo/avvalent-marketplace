"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/navbar/Navbar";
import {
  mapCsvCategories,
  type CsvCategoryRow,
  type CsvMappingResult,
} from "@/lib/category-csv-mapping";

const fieldTypes = [
  "Text",
  "Textarea",
  "Number",
  "Dropdown",
  "Multi-select",
  "Yes/No",
  "Measurement",
  "Date",
] as const;

const guideTypes = [
  "Men's shirts",
  "Men's T-shirts",
  "Trousers",
  "Women's kurtis",
  "Women's dresses",
  "Kids clothing",
  "Men's footwear",
  "Women's footwear",
];

type Status = "ACTIVE" | "INACTIVE" | "ARCHIVED";

type ProductType = {
  id: string;
  name: string;
  slug: string;
  subcategoryId: string;
  status: Status;
  sortOrder: number;
  homepageIcon?: string | null;
  categoryImage?: string | null;
  desktopBanner?: string | null;
  mobileBanner?: string | null;
  altText?: string | null;
};

type Subcategory = {
  id: string;
  name: string;
  slug: string;
  categoryId: string;
  status: Status;
  sortOrder: number;
  homepageIcon?: string | null;
  categoryImage?: string | null;
  desktopBanner?: string | null;
  mobileBanner?: string | null;
  altText?: string | null;
  productTypes: ProductType[];
};

type Category = {
  id: string;
  name: string;
  slug: string;
  status: Status;
  sortOrder: number;
  homepageIcon?: string | null;
  categoryImage?: string | null;
  desktopBanner?: string | null;
  mobileBanner?: string | null;
  altText?: string | null;
  subcategories: Subcategory[];
};

type SpecField = {
  name: string;
  label: string;
  fieldType: (typeof fieldTypes)[number];
  required: boolean;
  dropdownValues: string[];
  unit: string;
  placeholder: string;
  customerVisible: boolean;
  filterable: boolean;
  searchable: boolean;
  vendorEditable: boolean;
  adminOnly: boolean;
  displayOrder: number;
};

type VariantRow = {
  sizeLabel: string;
  numericSize: string;
  color: string;
  sku: string;
  barcode: string;
  stock: string;
  lowStockThreshold: string;
  price: string;
  mrp: string;
  weight: string;
  variantImage: string;
  active: boolean;
  defaultVariant: boolean;
};

type SizeGuideRow = {
  id: string;
  guideType: string;
  india: string;
  uk: string;
  us: string;
  eu: string;
  chest: string;
  waist: string;
  hip: string;
  length: string;
  footLength: string;
  ageGroup: string;
};

type BusinessRules = {
  returnAllowed: boolean;
  returnWindow: string;
  nonReturnable: boolean;
  openBoxDelivery: boolean;
  fragile: boolean;
  installationRequired: boolean;
  warrantyRequired: boolean;
  minimumImageCount: string;
  productVideoRequired: boolean;
};

type TemplateRecord = {
  id?: string;
  categoryId: string;
  subcategoryId?: string | null;
  productTypes?: string[];
  specTemplate?: {
    title?: string;
    helpText?: string;
    fields?: Partial<SpecField>[];
    filterConfig?: string[];
    sizeGuide?: SizeGuideRow[];
    businessRules?: BusinessRules;
    templateMeta?: {
      status?: "DRAFT" | "PUBLISHED";
      savedBy?: string;
      savedAt?: string;
      version?: number;
    };
  };
  variantConfig?: {
    title?: string;
    note?: string;
    examples?: Partial<VariantRow>[];
  };
  sizeChart?: string;
  updatedAt?: string;
};

type AuditLog = {
  id: string;
  adminUser: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  createdAt: string;
};

type EntitySelection = {
  type: "category" | "subcategory" | "productType";
  id: string;
};

type DragItem = EntitySelection & {
  parentId?: string;
};

const emptyBusinessRules: BusinessRules = {
  returnAllowed: true,
  returnWindow: "7",
  nonReturnable: false,
  openBoxDelivery: false,
  fragile: false,
  installationRequired: false,
  warrantyRequired: false,
  minimumImageCount: "3",
  productVideoRequired: false,
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function linesToList(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeSpecField(field: Partial<SpecField>, index: number): SpecField {
  const legacyField = field as Partial<SpecField> & {
    options?: string[];
    multiline?: boolean;
  };
  const label = String(field.label || field.name || `Field ${index + 1}`).trim();
  return {
    name: String(field.name || slugify(label).replace(/-/g, "_") || `field_${index + 1}`),
    label,
    fieldType: fieldTypes.includes(legacyField.fieldType as (typeof fieldTypes)[number])
      ? (legacyField.fieldType as (typeof fieldTypes)[number])
      : legacyField.dropdownValues?.length || legacyField.options?.length
        ? "Dropdown"
        : legacyField.multiline
          ? "Textarea"
          : "Text",
    required: Boolean(field.required),
    dropdownValues: (legacyField.dropdownValues || legacyField.options || []).filter(Boolean) as string[],
    unit: String(field.unit || ""),
    placeholder: String(field.placeholder || ""),
    customerVisible: field.customerVisible !== false,
    filterable: Boolean(field.filterable),
    searchable: Boolean(field.searchable),
    vendorEditable: field.vendorEditable !== false,
    adminOnly: Boolean(field.adminOnly),
    displayOrder: Number(field.displayOrder ?? index + 1),
  };
}

function normalizeVariantRow(row: Partial<VariantRow>, index: number): VariantRow {
  const legacyRow = row as Partial<VariantRow> & {
    stockQuantity?: string;
    imageUrl?: string;
  };
  return {
    sizeLabel: String(row.sizeLabel || ""),
    numericSize: String(row.numericSize || ""),
    color: String(row.color || ""),
    sku: String(row.sku || ""),
    barcode: String(row.barcode || ""),
    stock: String(legacyRow.stock ?? legacyRow.stockQuantity ?? "0"),
    lowStockThreshold: String(row.lowStockThreshold || "3"),
    price: String(row.price || ""),
    mrp: String(row.mrp || ""),
    weight: String(row.weight || ""),
    variantImage: String(legacyRow.variantImage || legacyRow.imageUrl || ""),
    active: row.active !== false,
    defaultVariant: Boolean(row.defaultVariant || index === 0),
  };
}

function completionFor(template?: TemplateRecord | null) {
  const fields = (template?.specTemplate?.fields || []).map(normalizeSpecField);
  const variants = (template?.variantConfig?.examples || []).map(normalizeVariantRow);
  const sizeGuide = template?.specTemplate?.sizeGuide || [];
  const rules = template?.specTemplate?.businessRules;
  const checks = {
    specifications: fields.length > 0,
    variants: variants.length > 0,
    sizeGuide: sizeGuide.length > 0 || Boolean(template?.sizeChart),
    filters: fields.some((field) => field.filterable),
    returnRules: Boolean(rules),
  };
  const done = Object.values(checks).filter(Boolean).length;
  return { checks, percent: Math.round((done / 5) * 100) };
}

function parseCsv(value: string): CsvCategoryRow[] {
  const [headerLine = "", ...lines] = value.trim().split(/\r?\n/);
  const headers = headerLine.split(",").map((item) => item.trim().toLowerCase());
  return lines
    .filter(Boolean)
    .map((line) => {
      const columns = line.split(",").map((item) => item.trim());
      const row: CsvCategoryRow = {};
      headers.forEach((header, index) => {
        if (header.includes("categoryid")) row.categoryId = columns[index];
        if (header.includes("categoryslug")) row.categorySlug = columns[index];
        if (header === "category" || header.includes("categoryname")) row.categoryName = columns[index];
        if (header.includes("subcategory")) row.subcategoryName = columns[index];
        if (header.includes("producttype") || header.includes("leaf")) row.productTypeName = columns[index];
      });
      return row;
    });
}

export default function CategoryAtelierManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [templates, setTemplates] = useState<TemplateRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | Status>("ALL");
  const [templateFilter, setTemplateFilter] = useState("ALL");
  const [selection, setSelection] = useState<EntitySelection | null>(null);
  const [dragItem, setDragItem] = useState<DragItem | null>(null);
  const [previewMode, setPreviewMode] = useState("Vendor upload form");
  const [csvText, setCsvText] = useState("categoryName,subcategoryName,productTypeName\nMen Fashion,Shirts,Formal Shirt");
  const [csvPreview, setCsvPreview] = useState<CsvMappingResult[]>([]);
  const [newMain, setNewMain] = useState("");
  const [newSub, setNewSub] = useState("");
  const [newLeaf, setNewLeaf] = useState("");
  const [templateCategoryId, setTemplateCategoryId] = useState("");
  const [templateSubcategoryId, setTemplateSubcategoryId] = useState("");
  const [productTypeOptions, setProductTypeOptions] = useState("");
  const [specFields, setSpecFields] = useState<SpecField[]>([]);
  const [variantRows, setVariantRows] = useState<VariantRow[]>([]);
  const [sizeGuideRows, setSizeGuideRows] = useState<SizeGuideRow[]>([]);
  const [businessRules, setBusinessRules] = useState<BusinessRules>(emptyBusinessRules);
  const [templateStatus, setTemplateStatus] = useState<"DRAFT" | "PUBLISHED">("DRAFT");
  const [lastSaved, setLastSaved] = useState("");
  const [savedBy, setSavedBy] = useState("admin");

  const flatSubcategories = useMemo(
    () => categories.flatMap((category) => category.subcategories),
    [categories],
  );
  const selectedCategory = categories.find((item) => item.id === templateCategoryId) || null;
  const selectedSubcategories = selectedCategory?.subcategories || [];
  const currentTemplate = templates.find(
    (item) =>
      item.categoryId === templateCategoryId &&
      (item.subcategoryId || "") === (templateSubcategoryId || ""),
  );

  const selectedEntity = useMemo(() => {
    if (!selection) return null;
    if (selection.type === "category") return categories.find((item) => item.id === selection.id) || null;
    if (selection.type === "subcategory") {
      return flatSubcategories.find((item) => item.id === selection.id) || null;
    }
    return flatSubcategories.flatMap((item) => item.productTypes).find((item) => item.id === selection.id) || null;
  }, [categories, flatSubcategories, selection]);

  const filteredCategories = useMemo(() => {
    const query = search.trim().toLowerCase();
    return categories.filter((category) => {
      const statusMatches = statusFilter === "ALL" || category.status === statusFilter;
      const text = [
        category.name,
        category.slug,
        ...category.subcategories.flatMap((subcategory) => [
          subcategory.name,
          subcategory.slug,
          ...subcategory.productTypes.flatMap((leaf) => [leaf.name, leaf.slug]),
        ]),
      ]
        .join(" ")
        .toLowerCase();
      const searchMatches = !query || text.includes(query);
      const categoryTemplate = templates.find((item) => item.categoryId === category.id);
      const completion = completionFor(categoryTemplate);
      const templateMatches =
        templateFilter === "ALL" ||
        (templateFilter === "COMPLETE" && completion.percent === 100) ||
        (templateFilter === "INCOMPLETE" && completion.percent < 100) ||
        (templateFilter === "MISSING_SIZE" && !completion.checks.sizeGuide) ||
        (templateFilter === "MISSING_SPECS" && !completion.checks.specifications);
      return statusMatches && searchMatches && templateMatches;
    });
  }, [categories, search, statusFilter, templateFilter, templates]);

  const duplicateGroups = useMemo(() => {
    const names = new Map<string, string[]>();
    for (const category of categories) {
      const categoryKey = `main:${category.name.trim().toLowerCase()}`;
      names.set(categoryKey, [...(names.get(categoryKey) || []), category.name]);
      for (const subcategory of category.subcategories) {
        const subKey = `sub:${category.id}:${subcategory.name.trim().toLowerCase()}`;
        names.set(subKey, [...(names.get(subKey) || []), `${category.name} / ${subcategory.name}`]);
        for (const leaf of subcategory.productTypes) {
          const leafKey = `leaf:${subcategory.id}:${leaf.name.trim().toLowerCase()}`;
          names.set(leafKey, [...(names.get(leafKey) || []), `${subcategory.name} / ${leaf.name}`]);
        }
      }
    }
    return [...names.values()].filter((items) => items.length > 1);
  }, [categories]);

  async function loadAtelier() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/category-atelier", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || "Could not load category atelier.");
        return;
      }
      setCategories(data.categories || []);
      setTemplates(data.templates || []);
      setAuditLogs(data.auditLogs || []);
    } catch {
      setMessage("Could not connect to category atelier.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAtelier();
  }, []);

  useEffect(() => {
    if (!currentTemplate) return;
    setProductTypeOptions((currentTemplate.productTypes || []).join("\n"));
    setSpecFields((currentTemplate.specTemplate?.fields || []).map(normalizeSpecField));
    setVariantRows((currentTemplate.variantConfig?.examples || []).map(normalizeVariantRow));
    setSizeGuideRows(currentTemplate.specTemplate?.sizeGuide || []);
    setBusinessRules(currentTemplate.specTemplate?.businessRules || emptyBusinessRules);
    setTemplateStatus(currentTemplate.specTemplate?.templateMeta?.status || "DRAFT");
    setLastSaved(currentTemplate.specTemplate?.templateMeta?.savedAt || currentTemplate.updatedAt || "");
    setSavedBy(currentTemplate.specTemplate?.templateMeta?.savedBy || "admin");
  }, [currentTemplate]);

  async function runAction(action: string, payload: Record<string, unknown> = {}) {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/category-atelier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || "Action failed.");
        return false;
      }
      await loadAtelier();
      setMessage("Category atelier updated.");
      return true;
    } catch {
      setMessage("Could not connect to category atelier.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function createMainCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await runAction("createCategory", { name: newMain })) setNewMain("");
  }

  async function createSubcategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!templateCategoryId) {
      setMessage("Select a main category first.");
      return;
    }
    if (await runAction("createSubcategory", { name: newSub, categoryId: templateCategoryId })) setNewSub("");
  }

  async function createLeaf(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!templateSubcategoryId) {
      setMessage("Select a subcategory first.");
      return;
    }
    if (await runAction("createProductType", { name: newLeaf, subcategoryId: templateSubcategoryId })) setNewLeaf("");
  }

  async function updateSelected(updates: Record<string, unknown>) {
    if (!selection) return;
    await runAction("updateEntity", {
      entityType: selection.type,
      id: selection.id,
      updates,
    });
  }

  function addSpecField() {
    setSpecFields((fields) => [
      ...fields,
      normalizeSpecField({ label: "", fieldType: "Text", vendorEditable: true, customerVisible: true }, fields.length),
    ]);
  }

  function addVariantRow() {
    setVariantRows((rows) => [...rows, normalizeVariantRow({}, rows.length)]);
  }

  function addSizeGuideRow() {
    setSizeGuideRows((rows) => [
      ...rows,
      {
        id: crypto.randomUUID(),
        guideType: guideTypes[0],
        india: "",
        uk: "",
        us: "",
        eu: "",
        chest: "",
        waist: "",
        hip: "",
        length: "",
        footLength: "",
        ageGroup: "",
      },
    ]);
  }

  async function saveTemplate(status: "DRAFT" | "PUBLISHED") {
    if (!templateCategoryId) {
      setMessage("Select a category before saving a template.");
      return;
    }
    setSaving(true);
    const savedAt = new Date().toISOString();
    const body = {
      categoryId: templateCategoryId,
      subcategoryId: templateSubcategoryId || null,
      productTypes: linesToList(productTypeOptions),
      specTemplate: {
        title: "Category Specifications",
        helpText: "Vendor must complete the category-specific fields configured by admin.",
        fields: specFields.map((field, index) => ({ ...field, displayOrder: index + 1 })),
        filterConfig: specFields.filter((field) => field.filterable).map((field) => field.name),
        sizeGuide: sizeGuideRows,
        businessRules,
        templateMeta: {
          status,
          savedBy,
          savedAt,
          version: Number(currentTemplate?.specTemplate?.templateMeta?.version || 0) + 1,
        },
      },
      variantConfig: {
        title: "Variant, Option & Stock Rows",
        note: "Vendor can use these variant rows as starting options.",
        selectedStyle: "Admin managed category template",
        sizeLabelHeading: "Size label",
        sizeLabelPlaceholder: "S / UK 7 / Pack of 2",
        numericSizeHeading: "Numeric size",
        numericSizePlaceholder: "32 / 26 cm",
        colorHeading: "Color",
        colorPlaceholder: "Blue",
        skuHeading: "SKU",
        skuPlaceholder: "SKU-BLUE-M",
        defaultSizePlaceholder: "Default size",
        availableSizesPlaceholder: "Available sizes",
        brandMappingPlaceholder: "Brand size mapping",
        examples: variantRows,
      },
      sizeChart: sizeGuideRows
        .map((row) => `${row.guideType}: IN ${row.india}, UK ${row.uk}, US ${row.us}, EU ${row.eu}`)
        .join("\n"),
    };

    try {
      const response = await fetch("/api/category-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || "Template could not be saved.");
        return;
      }
      setTemplateStatus(status);
      setLastSaved(savedAt);
      setMessage(status === "PUBLISHED" ? "Template published." : "Draft saved.");
      await loadAtelier();
    } catch {
      setMessage("Could not connect to template service.");
    } finally {
      setSaving(false);
    }
  }

  function downloadMasterCsv() {
    const rows = ["level,id,name,slug,parentId,status,sortOrder"];
    categories.forEach((category) => {
      rows.push(`main,${category.id},${category.name},${category.slug},,${category.status},${category.sortOrder}`);
      category.subcategories.forEach((subcategory) => {
        rows.push(
          `subcategory,${subcategory.id},${subcategory.name},${subcategory.slug},${category.id},${subcategory.status},${subcategory.sortOrder}`,
        );
        subcategory.productTypes.forEach((leaf) => {
          rows.push(`productType,${leaf.id},${leaf.name},${leaf.slug},${subcategory.id},${leaf.status},${leaf.sortOrder}`);
        });
      });
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv" }));
    link.download = "zylo-buylo-category-master.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function previewCsv() {
    const rows = parseCsv(csvText);
    setCsvPreview(mapCsvCategories(rows, categories));
  }

  async function reorder(dropTarget: DragItem) {
    if (!dragItem || dragItem.type !== dropTarget.type || dragItem.parentId !== dropTarget.parentId) return;
    const siblings =
      dragItem.type === "category"
        ? categories.map((item) => item.id)
        : dragItem.type === "subcategory"
          ? categories.find((item) => item.id === dragItem.parentId)?.subcategories.map((item) => item.id) || []
          : flatSubcategories.find((item) => item.id === dragItem.parentId)?.productTypes.map((item) => item.id) || [];
    const from = siblings.indexOf(dragItem.id);
    const to = siblings.indexOf(dropTarget.id);
    if (from < 0 || to < 0) return;
    const next = [...siblings];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    await runAction("reorder", {
      items: next.map((id, index) => ({ id, sortOrder: index + 1, entityType: dragItem.type })),
    });
    setDragItem(null);
  }

  const templateCompletion = completionFor(currentTemplate || {
    categoryId: templateCategoryId,
    specTemplate: { fields: specFields, sizeGuide: sizeGuideRows, businessRules },
    variantConfig: { examples: variantRows },
  });

  return (
    <main className="min-h-screen bg-[#f6f4ef] text-stone-950">
      <Navbar />
      <section className="border-b border-stone-200 bg-[#191612] text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link href="/admin/dashboard" className="text-sm text-[#d6b36a]">
              Back to Admin Dashboard
            </Link>
            <h1 className="mt-3 text-3xl font-bold md:text-4xl">Category Atelier</h1>
            <p className="mt-2 max-w-2xl text-sm text-stone-300">
              Marketplace category management for hierarchy, templates, CSV mapping, previews, and audit history.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="border border-white/15 px-4 py-3">
              <strong className="block text-2xl text-[#d6b36a]">{categories.length}</strong>
              Main
            </div>
            <div className="border border-white/15 px-4 py-3">
              <strong className="block text-2xl text-[#d6b36a]">{flatSubcategories.length}</strong>
              Sub
            </div>
            <div className="border border-white/15 px-4 py-3">
              <strong className="block text-2xl text-[#d6b36a]">
                {flatSubcategories.reduce((total, item) => total + item.productTypes.length, 0)}
              </strong>
              Leaf
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-4 py-6 xl:grid-cols-[360px_1fr]">
        <aside className="space-y-4">
          <div className="bg-white p-4 shadow-sm">
            <h2 className="text-lg font-bold">Create hierarchy</h2>
            <form onSubmit={createMainCategory} className="mt-3 grid gap-2">
              <input value={newMain} onChange={(event) => setNewMain(event.target.value)} placeholder="Main Category" className="border px-3 py-2" required />
              <button disabled={saving} className="bg-stone-950 px-3 py-2 text-sm font-semibold text-white">Add Main Category</button>
            </form>
            <form onSubmit={createSubcategory} className="mt-4 grid gap-2">
              <select value={templateCategoryId} onChange={(event) => { setTemplateCategoryId(event.target.value); setTemplateSubcategoryId(""); }} className="border px-3 py-2">
                <option value="">Select main category</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
              <input value={newSub} onChange={(event) => setNewSub(event.target.value)} placeholder="Subcategory" className="border px-3 py-2" required />
              <button disabled={saving} className="bg-[#8a6a26] px-3 py-2 text-sm font-semibold text-white">Add Subcategory</button>
            </form>
            <form onSubmit={createLeaf} className="mt-4 grid gap-2">
              <select value={templateSubcategoryId} onChange={(event) => setTemplateSubcategoryId(event.target.value)} className="border px-3 py-2" disabled={!templateCategoryId}>
                <option value="">Select subcategory</option>
                {selectedSubcategories.map((subcategory) => <option key={subcategory.id} value={subcategory.id}>{subcategory.name}</option>)}
              </select>
              <input value={newLeaf} onChange={(event) => setNewLeaf(event.target.value)} placeholder="Product Type / Leaf Category" className="border px-3 py-2" required />
              <button disabled={saving} className="bg-stone-700 px-3 py-2 text-sm font-semibold text-white">Add Product Type</button>
            </form>
          </div>

          <div className="bg-white p-4 shadow-sm">
            <h2 className="text-lg font-bold">Search and filters</h2>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search category/subcategory" className="mt-3 w-full border px-3 py-2" />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "ALL" | Status)} className="mt-2 w-full border px-3 py-2">
              <option value="ALL">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="ARCHIVED">Archived</option>
            </select>
            <select value={templateFilter} onChange={(event) => setTemplateFilter(event.target.value)} className="mt-2 w-full border px-3 py-2">
              <option value="ALL">All templates</option>
              <option value="COMPLETE">Template complete</option>
              <option value="INCOMPLETE">Template incomplete</option>
              <option value="MISSING_SIZE">Missing size guide</option>
              <option value="MISSING_SPECS">Missing specifications</option>
            </select>
          </div>

          {message && <p className="bg-white p-3 text-sm text-stone-700 shadow-sm">{message}</p>}
        </aside>

        <div className="space-y-5">
          <section className="bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold">Template status dashboard</h2>
              <button onClick={loadAtelier} className="border px-3 py-2 text-sm font-semibold">Refresh</button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {categories.map((category) => {
                const status = completionFor(templates.find((template) => template.categoryId === category.id));
                return (
                  <button key={category.id} onClick={() => setTemplateCategoryId(category.id)} className="border border-stone-200 p-3 text-left">
                    <div className="flex items-center justify-between gap-2">
                      <strong>{category.name}</strong>
                      <span className="text-sm font-bold text-[#8a6a26]">{status.percent}%</span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-1 text-xs text-stone-600">
                      <span>Specs: {status.checks.specifications ? "Done" : "Missing"}</span>
                      <span>Variants: {status.checks.variants ? "Done" : "Missing"}</span>
                      <span>Size guide: {status.checks.sizeGuide ? "Done" : "Missing"}</span>
                      <span>Filters: {status.checks.filters ? "Done" : "Missing"}</span>
                      <span>Returns: {status.checks.returnRules ? "Done" : "Missing"}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-[1fr_330px]">
            <div className="bg-white p-4 shadow-sm">
              <h2 className="text-xl font-bold">Live category tree</h2>
              {loading ? (
                <p className="py-8 text-center text-sm text-stone-500">Loading...</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {filteredCategories.map((category) => (
                    <div
                      key={category.id}
                      draggable
                      onDragStart={() => setDragItem({ type: "category", id: category.id })}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => reorder({ type: "category", id: category.id })}
                      className="border border-stone-200"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3 bg-stone-50 px-3 py-2">
                        <button onClick={() => { setSelection({ type: "category", id: category.id }); setTemplateCategoryId(category.id); }} className="text-left">
                          <strong>{category.name}</strong>
                          <span className="ml-2 text-xs text-stone-500">{category.id}</span>
                          <span className="ml-2 text-xs font-semibold text-[#8a6a26]">{category.status}</span>
                        </button>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <button
                            onClick={() =>
                              runAction("updateEntity", {
                                entityType: "category",
                                id: category.id,
                                updates: { name: prompt("Rename category", category.name) || category.name },
                              })
                            }
                            className="border px-2 py-1"
                          >
                            Rename
                          </button>
                          <button onClick={() => runAction("duplicateCategory", { id: category.id })} className="border px-2 py-1">Duplicate</button>
                          <button onClick={() => runAction("updateEntity", { entityType: "category", id: category.id, updates: { status: category.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" } })} className="border px-2 py-1">{category.status === "ACTIVE" ? "Deactivate" : "Activate"}</button>
                          <button onClick={() => runAction("updateEntity", { entityType: "category", id: category.id, updates: { status: "ARCHIVED" } })} className="border px-2 py-1">Archive</button>
                          <button onClick={() => {
                            if (confirm(`Delete ${category.name}? This uncategorizes linked products.`)) runAction("deleteEntity", { entityType: "category", id: category.id, confirmed: true });
                          }} className="border border-red-200 px-2 py-1 text-red-600">Delete</button>
                        </div>
                      </div>
                      <div className="grid gap-2 p-3 md:grid-cols-2">
                        {category.subcategories.map((subcategory) => (
                          <div
                            key={subcategory.id}
                            draggable
                            onDragStart={() => setDragItem({ type: "subcategory", id: subcategory.id, parentId: category.id })}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={() => reorder({ type: "subcategory", id: subcategory.id, parentId: category.id })}
                            className="border bg-[#fbfaf7] p-3"
                          >
                            <button onClick={() => { setSelection({ type: "subcategory", id: subcategory.id }); setTemplateCategoryId(category.id); setTemplateSubcategoryId(subcategory.id); }} className="text-left text-sm font-semibold">
                              {subcategory.name} <span className="text-xs text-stone-500">{subcategory.status}</span>
                            </button>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {subcategory.productTypes.map((leaf) => (
                                <button
                                  key={leaf.id}
                                  draggable
                                  onDragStart={() => setDragItem({ type: "productType", id: leaf.id, parentId: subcategory.id })}
                                  onDragOver={(event) => event.preventDefault()}
                                  onDrop={() => reorder({ type: "productType", id: leaf.id, parentId: subcategory.id })}
                                  onClick={() => setSelection({ type: "productType", id: leaf.id })}
                                  className="border border-stone-200 bg-white px-2 py-1 text-xs"
                                >
                                  {leaf.name}
                                </button>
                              ))}
                              {subcategory.productTypes.length === 0 && <span className="text-xs text-stone-500">No product types</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white p-4 shadow-sm">
              <h2 className="text-lg font-bold">Metadata and actions</h2>
              {selectedEntity ? (
                <div className="mt-3 space-y-2 text-sm">
                  <p><strong>ID:</strong> {selectedEntity.id}</p>
                  <label className="block">Name<input defaultValue={selectedEntity.name} onBlur={(event) => updateSelected({ name: event.target.value })} className="mt-1 w-full border px-2 py-2" /></label>
                  <label className="block">Slug<input defaultValue={selectedEntity.slug} onBlur={(event) => updateSelected({ slug: event.target.value })} className="mt-1 w-full border px-2 py-2" /></label>
                  <label className="block">Sort order<input type="number" defaultValue={selectedEntity.sortOrder} onBlur={(event) => updateSelected({ sortOrder: event.target.value })} className="mt-1 w-full border px-2 py-2" /></label>
                  <label className="block">Homepage icon<input defaultValue={selectedEntity.homepageIcon || ""} onBlur={(event) => updateSelected({ homepageIcon: event.target.value })} className="mt-1 w-full border px-2 py-2" /></label>
                  <label className="block">Category image<input defaultValue={selectedEntity.categoryImage || ""} onBlur={(event) => updateSelected({ categoryImage: event.target.value })} className="mt-1 w-full border px-2 py-2" /></label>
                  <label className="block">Desktop banner<input defaultValue={selectedEntity.desktopBanner || ""} onBlur={(event) => updateSelected({ desktopBanner: event.target.value })} className="mt-1 w-full border px-2 py-2" /></label>
                  <label className="block">Mobile banner<input defaultValue={selectedEntity.mobileBanner || ""} onBlur={(event) => updateSelected({ mobileBanner: event.target.value })} className="mt-1 w-full border px-2 py-2" /></label>
                  <label className="block">Alt text<input defaultValue={selectedEntity.altText || ""} onBlur={(event) => updateSelected({ altText: event.target.value })} className="mt-1 w-full border px-2 py-2" /></label>
                  <select defaultValue={selectedEntity.status} onChange={(event) => updateSelected({ status: event.target.value })} className="w-full border px-2 py-2">
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                  {selection?.type === "subcategory" && (
                    <select onChange={(event) => runAction("move", { entityType: "subcategory", id: selection.id, parentId: event.target.value })} className="w-full border px-2 py-2">
                      <option value="">Move to main category</option>
                      {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                    </select>
                  )}
                  {selection?.type === "productType" && (
                    <select onChange={(event) => runAction("move", { entityType: "productType", id: selection.id, parentId: event.target.value })} className="w-full border px-2 py-2">
                      <option value="">Move to subcategory</option>
                      {flatSubcategories.map((subcategory) => <option key={subcategory.id} value={subcategory.id}>{subcategory.name}</option>)}
                    </select>
                  )}
                  {selection?.type === "category" && (
                    <select onChange={(event) => event.target.value && runAction("mergeCategory", { sourceId: selection.id, targetId: event.target.value })} className="w-full border px-2 py-2">
                      <option value="">Merge into category</option>
                      {categories.filter((category) => category.id !== selection.id).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                    </select>
                  )}
                </div>
              ) : (
                <p className="mt-3 text-sm text-stone-500">Select a category, subcategory, or product type.</p>
              )}
            </div>
          </section>

          <section className="bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">Template builder</h2>
                <p className="text-sm text-stone-500">Completion: {templateCompletion.percent}% · Last saved: {lastSaved || "Not saved"} · Saved by: {savedBy}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => saveTemplate("DRAFT")} disabled={saving} className="border px-3 py-2 text-sm font-semibold">Save Draft</button>
                <button onClick={() => saveTemplate("PUBLISHED")} disabled={saving} className="bg-stone-950 px-3 py-2 text-sm font-semibold text-white">Publish</button>
                <button onClick={() => { setSpecFields([...specFields]); setVariantRows([...variantRows]); setMessage("Template duplicated in editor; save it to persist."); }} className="border px-3 py-2 text-sm font-semibold">Duplicate</button>
                <button onClick={() => { setSpecFields([]); setVariantRows([]); setSizeGuideRows([]); setBusinessRules(emptyBusinessRules); }} className="border px-3 py-2 text-sm font-semibold">Reset</button>
                <button onClick={() => runAction("restoreTemplate", { categoryId: templateCategoryId, subcategoryId: templateSubcategoryId || null })} className="border px-3 py-2 text-sm font-semibold">Restore previous version</button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <select value={templateCategoryId} onChange={(event) => { setTemplateCategoryId(event.target.value); setTemplateSubcategoryId(""); }} className="border px-3 py-2">
                <option value="">Template category</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
              <select value={templateSubcategoryId} onChange={(event) => setTemplateSubcategoryId(event.target.value)} className="border px-3 py-2">
                <option value="">Whole category</option>
                {selectedSubcategories.map((subcategory) => <option key={subcategory.id} value={subcategory.id}>{subcategory.name}</option>)}
              </select>
              <select value={templateStatus} onChange={(event) => setTemplateStatus(event.target.value as "DRAFT" | "PUBLISHED")} className="border px-3 py-2">
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
              </select>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="font-bold">Specification Field Builder</h3>
                  <button onClick={addSpecField} className="border px-3 py-2 text-sm font-semibold">Add field</button>
                </div>
                <div className="mt-3 space-y-3">
                  {specFields.map((field, index) => (
                    <div key={`${field.name}-${index}`} className="border p-3">
                      <div className="grid gap-2 md:grid-cols-2">
                        <input value={field.name} onChange={(event) => setSpecFields((fields) => fields.map((item, i) => i === index ? { ...item, name: event.target.value } : item))} placeholder="Name" className="border px-2 py-2" />
                        <input value={field.label} onChange={(event) => setSpecFields((fields) => fields.map((item, i) => i === index ? { ...item, label: event.target.value } : item))} placeholder="Label" className="border px-2 py-2" />
                        <select value={field.fieldType} onChange={(event) => setSpecFields((fields) => fields.map((item, i) => i === index ? { ...item, fieldType: event.target.value as SpecField["fieldType"] } : item))} className="border px-2 py-2">
                          {fieldTypes.map((type) => <option key={type}>{type}</option>)}
                        </select>
                        <input value={field.unit} onChange={(event) => setSpecFields((fields) => fields.map((item, i) => i === index ? { ...item, unit: event.target.value } : item))} placeholder="Unit" className="border px-2 py-2" />
                        <input value={field.placeholder} onChange={(event) => setSpecFields((fields) => fields.map((item, i) => i === index ? { ...item, placeholder: event.target.value } : item))} placeholder="Placeholder" className="border px-2 py-2 md:col-span-2" />
                        <textarea value={field.dropdownValues.join("\n")} onChange={(event) => setSpecFields((fields) => fields.map((item, i) => i === index ? { ...item, dropdownValues: linesToList(event.target.value) } : item))} placeholder="Dropdown values, one per line" className="h-20 border px-2 py-2 md:col-span-2" />
                      </div>
                      <div className="mt-3 grid gap-2 text-xs md:grid-cols-4">
                        {(["required", "customerVisible", "filterable", "searchable", "vendorEditable", "adminOnly"] as const).map((key) => (
                          <label key={key} className="flex items-center gap-2">
                            <input type="checkbox" checked={Boolean(field[key])} onChange={(event) => setSpecFields((fields) => fields.map((item, i) => i === index ? { ...item, [key]: event.target.checked } : item))} />
                            {key}
                          </label>
                        ))}
                        <button onClick={() => setSpecFields((fields) => fields.filter((_, i) => i !== index))} className="text-left font-semibold text-red-600">Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <h3 className="font-bold">Variant Builder</h3>
                  <button onClick={addVariantRow} className="border px-3 py-2 text-sm font-semibold">Add variant</button>
                </div>
                <div className="mt-3 space-y-3">
                  {variantRows.map((row, index) => (
                    <div key={`${row.sku}-${index}`} className="grid gap-2 border p-3 md:grid-cols-3">
                      {(["sizeLabel", "numericSize", "color", "sku", "barcode", "stock", "lowStockThreshold", "price", "mrp", "weight", "variantImage"] as const).map((key) => (
                        <input key={key} value={row[key]} onChange={(event) => setVariantRows((rows) => rows.map((item, i) => i === index ? { ...item, [key]: event.target.value } : item))} placeholder={key} className="min-w-0 border px-2 py-2" />
                      ))}
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={row.active} onChange={(event) => setVariantRows((rows) => rows.map((item, i) => i === index ? { ...item, active: event.target.checked } : item))} /> Active</label>
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={row.defaultVariant} onChange={(event) => setVariantRows((rows) => rows.map((item, i) => i === index ? { ...item, defaultVariant: event.target.checked } : item))} /> Default</label>
                      <button onClick={() => setVariantRows((rows) => rows.filter((_, i) => i !== index))} className="text-left text-sm font-semibold text-red-600">Remove</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="font-bold">Size Guide Builder</h3>
                  <button onClick={addSizeGuideRow} className="border px-3 py-2 text-sm font-semibold">Add row</button>
                </div>
                <div className="mt-3 space-y-2">
                  {sizeGuideRows.map((row, index) => (
                    <div key={row.id} className="grid gap-2 border p-3 md:grid-cols-3">
                      <select value={row.guideType} onChange={(event) => setSizeGuideRows((rows) => rows.map((item, i) => i === index ? { ...item, guideType: event.target.value } : item))} className="border px-2 py-2">
                        {guideTypes.map((type) => <option key={type}>{type}</option>)}
                      </select>
                      {(["india", "uk", "us", "eu", "chest", "waist", "hip", "length", "footLength", "ageGroup"] as const).map((key) => (
                        <input key={key} value={row[key]} onChange={(event) => setSizeGuideRows((rows) => rows.map((item, i) => i === index ? { ...item, [key]: event.target.value } : item))} placeholder={key} className="min-w-0 border px-2 py-2" />
                      ))}
                      <button onClick={() => setSizeGuideRows((rows) => rows.filter((_, i) => i !== index))} className="text-left text-sm font-semibold text-red-600">Remove</button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-bold">Business rules and filters</h3>
                <textarea value={productTypeOptions} onChange={(event) => setProductTypeOptions(event.target.value)} placeholder="Valid product type names, one per line" className="mt-3 h-24 w-full border p-3" />
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <input value={businessRules.returnWindow} onChange={(event) => setBusinessRules((rules) => ({ ...rules, returnWindow: event.target.value }))} placeholder="Return window" className="border px-2 py-2" />
                  <input value={businessRules.minimumImageCount} onChange={(event) => setBusinessRules((rules) => ({ ...rules, minimumImageCount: event.target.value }))} placeholder="Minimum image count" className="border px-2 py-2" />
                  {(["returnAllowed", "nonReturnable", "openBoxDelivery", "fragile", "installationRequired", "warrantyRequired", "productVideoRequired"] as const).map((key) => (
                    <label key={key} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={businessRules[key]} onChange={(event) => setBusinessRules((rules) => ({ ...rules, [key]: event.target.checked }))} />
                      {key}
                    </label>
                  ))}
                </div>
                <div className="mt-3 bg-stone-50 p-3 text-sm">
                  Customer filters: {specFields.filter((field) => field.filterable).map((field) => field.label || field.name).join(", ") || "None selected"}
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-5 lg:grid-cols-2">
            <div className="bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xl font-bold">CSV tools</h2>
                <button onClick={downloadMasterCsv} className="border px-3 py-2 text-sm font-semibold">Download category master CSV</button>
              </div>
              <textarea value={csvText} onChange={(event) => setCsvText(event.target.value)} className="mt-3 h-32 w-full border p-3 text-sm" />
              <button onClick={previewCsv} className="mt-3 bg-stone-950 px-3 py-2 text-sm font-semibold text-white">Preview rows before import</button>
              <div className="mt-3 space-y-2 text-sm">
                {csvPreview.map((row, index) => (
                  <div key={index} className="border p-2">
                    <strong>{row.status}</strong> · {row.categoryName || row.row.categoryName || "Missing"} · {row.notes.join("; ")}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-4 shadow-sm">
              <h2 className="text-xl font-bold">Duplicate detection and merge</h2>
              <div className="mt-3 space-y-2 text-sm">
                {duplicateGroups.length === 0 ? <p className="text-stone-500">No duplicate sibling names detected.</p> : duplicateGroups.map((group, index) => (
                  <div key={index} className="border border-amber-200 bg-amber-50 p-2">{group.join(" / ")}</div>
                ))}
              </div>
            </div>
          </section>

          <section className="bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-bold">Preview modes</h2>
              <select value={previewMode} onChange={(event) => setPreviewMode(event.target.value)} className="border px-3 py-2">
                <option>Vendor upload form</option>
                <option>Customer product page</option>
                <option>Customer filter preview</option>
                <option>Mobile preview</option>
              </select>
            </div>
            <div className={`mt-4 border bg-stone-50 p-4 ${previewMode === "Mobile preview" ? "mx-auto max-w-[360px]" : ""}`}>
              <h3 className="font-bold">{previewMode}</h3>
              {previewMode === "Vendor upload form" && specFields.map((field) => <input key={field.name} placeholder={field.placeholder || field.label} className="mt-2 block w-full border bg-white px-3 py-2" />)}
              {previewMode === "Customer product page" && <div className="grid gap-2 text-sm">{specFields.filter((field) => field.customerVisible).map((field) => <p key={field.name}><strong>{field.label}:</strong> {field.placeholder || "Configured value"}</p>)}</div>}
              {previewMode === "Customer filter preview" && <div className="flex flex-wrap gap-2">{specFields.filter((field) => field.filterable).map((field) => <span key={field.name} className="border bg-white px-3 py-2 text-sm">{field.label}</span>)}</div>}
              {previewMode === "Mobile preview" && <div className="space-y-2 text-sm">{variantRows.slice(0, 3).map((row, index) => <div key={index} className="border bg-white p-2">{row.sizeLabel || "Variant"} · {row.color || "Color"} · Rs {row.price || "0"}</div>)}</div>}
            </div>
          </section>

          <section className="bg-white p-4 shadow-sm">
            <h2 className="text-xl font-bold">Audit log</h2>
            <div className="mt-3 grid gap-2 text-sm">
              {auditLogs.map((log) => (
                <div key={log.id} className="border p-2">
                  <strong>{log.action}</strong> · {log.entityType} · {log.adminUser} · {new Date(log.createdAt).toLocaleString()}
                </div>
              ))}
              {auditLogs.length === 0 && <p className="text-stone-500">No audit entries yet.</p>}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
