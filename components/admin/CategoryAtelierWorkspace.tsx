"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Navbar from "@/components/navbar/Navbar";
import {
  mapCsvCategories,
  type CsvCategoryRow,
  type CsvMappingResult,
} from "@/lib/category-csv-mapping";
import {
  atelierTabs,
  buildAtelierQuery,
  completionFromIssues,
  getValidAtelierTab,
  normalizeAtelierSlug,
  validateAtelierForPublish,
  validateCategoryMetadata,
  type AtelierTab,
  type AtelierValidationIssue,
} from "@/lib/category-atelier-validation";
import {
  normalizeStructuredVariantConfig,
  tshirtVariantConfig,
  validateStructuredVariantConfig,
  type StructuredVariantConfig,
  type VariantDimensionConfig,
} from "@/lib/category-variant-config";
import {
  isTemporaryImageUrl,
  type CategoryMetadataImageField,
} from "@/lib/category-metadata-images";

const tabLabels: Record<AtelierTab, string> = {
  metadata: "Metadata",
  "product-types": "Product Types",
  specifications: "Specifications",
  variants: "Variants",
  "size-guide": "Size Guide",
  "business-rules": "Business Rules",
  "customer-filters": "Customer Filters",
  preview: "Preview",
  "audit-log": "Audit Log",
};

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
  returnReasons: string;
  replacementWindow: string;
  nonReturnable: boolean;
  nonReturnableReason: string;
  openBoxDelivery: boolean;
  fragile: boolean;
  installationRequired: boolean;
  installationDetails: string;
  warrantyRequired: boolean;
  warrantyDuration: string;
  minimumImageCount: string;
  productVideoRequired: boolean;
};

type TemplateRecord = {
  id?: string;
  categoryId: string;
  subcategoryId?: string | null;
  productTypeId?: string | null;
  productTypes?: string[];
  specTemplate?: {
    fields?: Partial<SpecField>[];
    filterConfig?: string[];
    sizeGuide?: SizeGuideRow[];
    businessRules?: Partial<BusinessRules>;
    templateMeta?: {
      status?: "DRAFT" | "PUBLISHED";
      savedBy?: string;
      savedAt?: string;
      version?: number;
    };
  };
  variantConfig?: {
    dimensions?: VariantDimensionConfig[];
    rowFields?: StructuredVariantConfig["rowFields"];
    combinationRules?: StructuredVariantConfig["combinationRules"];
    examplePreview?: StructuredVariantConfig["examplePreview"];
    examples?: StructuredVariantConfig["examplePreview"];
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
  createdAt: string;
};

type MetadataForm = {
  name: string;
  slug: string;
  sortOrder: string;
  homepageIcon: string;
  categoryImage: string;
  desktopBanner: string;
  mobileBanner: string;
  altText: string;
  status: Status;
};

type ImageInfo = {
  fileName: string;
  fileSize: string;
  dimensions: string;
  progress: number;
  error: string;
  status: "idle" | "uploading" | "success" | "failed";
};

type SelectedNodeType = "category" | "subcategory" | "productType";

type MetadataEntity = {
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
};

const emptyBusinessRules: BusinessRules = {
  returnAllowed: true,
  returnWindow: "7",
  returnReasons: "Damaged, wrong item, size issue",
  replacementWindow: "7",
  nonReturnable: false,
  nonReturnableReason: "",
  openBoxDelivery: false,
  fragile: false,
  installationRequired: false,
  installationDetails: "",
  warrantyRequired: false,
  warrantyDuration: "",
  minimumImageCount: "3",
  productVideoRequired: false,
};

function linesToList(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeSpecField(field: Partial<SpecField>, index: number): SpecField {
  const legacy = field as Partial<SpecField> & { options?: string[]; multiline?: boolean };
  const label = String(field.label || field.name || `Field ${index + 1}`).trim();
  const fieldType = fieldTypes.includes(legacy.fieldType as (typeof fieldTypes)[number])
    ? (legacy.fieldType as (typeof fieldTypes)[number])
    : legacy.dropdownValues?.length || legacy.options?.length
      ? "Dropdown"
      : legacy.multiline
        ? "Textarea"
        : "Text";
  return {
    name: String(field.name || normalizeAtelierSlug(label).replace(/-/g, "_") || `field_${index + 1}`),
    label,
    fieldType,
    required: Boolean(field.required),
    dropdownValues: (legacy.dropdownValues || legacy.options || []).filter(Boolean),
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

function parseCsv(value: string): CsvCategoryRow[] {
  const [headerLine = "", ...lines] = value.trim().split(/\r?\n/);
  const headers = headerLine.split(",").map((item) => item.trim().toLowerCase());
  return lines.filter(Boolean).map((line) => {
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

function emptyMetadata(): MetadataForm {
  return {
    name: "",
    slug: "",
    sortOrder: "0",
    homepageIcon: "",
    categoryImage: "",
    desktopBanner: "",
    mobileBanner: "",
    altText: "",
    status: "ACTIVE",
  };
}

function metadataFromEntity(entity: MetadataEntity | null): MetadataForm {
  if (!entity) return emptyMetadata();
  return {
    name: entity.name,
    slug: entity.slug,
    sortOrder: String(entity.sortOrder || 0),
    homepageIcon: entity.homepageIcon || "",
    categoryImage: entity.categoryImage || "",
    desktopBanner: entity.desktopBanner || "",
    mobileBanner: entity.mobileBanner || "",
    altText: entity.altText || "",
    status: entity.status || "ACTIVE",
  };
}

function resolveSelectedNode(categories: Category[], nodeType: SelectedNodeType, nodeId: string) {
  for (const category of categories) {
    if (nodeType === "category" && category.id === nodeId) {
      return {
        entity: category as MetadataEntity,
        breadcrumb: category.name,
        parentName: "",
        categoryId: category.id,
        subcategoryId: "",
        productTypeId: "",
      };
    }

    for (const subcategory of category.subcategories) {
      if (nodeType === "subcategory" && subcategory.id === nodeId) {
        return {
          entity: subcategory as MetadataEntity,
          breadcrumb: `${category.name} > ${subcategory.name}`,
          parentName: category.name,
          categoryId: category.id,
          subcategoryId: subcategory.id,
          productTypeId: "",
        };
      }

      for (const productType of subcategory.productTypes) {
        if (nodeType === "productType" && productType.id === nodeId) {
          return {
            entity: productType as MetadataEntity,
            breadcrumb: `${category.name} > ${subcategory.name} > ${productType.name}`,
            parentName: subcategory.name,
            categoryId: category.id,
            subcategoryId: subcategory.id,
            productTypeId: productType.id,
          };
        }
      }
    }
  }

  return null;
}

function formatDate(value: string) {
  if (!value) return "Not saved";
  return new Date(value).toLocaleString();
}

const metadataImageAccept = "image/jpeg,image/jpg,image/png,image/webp";
const metadataImageMaxBytes = 10 * 1024 * 1024;

function entityTypeLabel(type: SelectedNodeType | "") {
  if (type === "category") return "Category";
  if (type === "subcategory") return "Subcategory";
  if (type === "productType") return "Product Type";
  return "No entity";
}

export default function CategoryAtelierWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mainScrollRef = useRef<HTMLDivElement | null>(null);
  const treeItemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const initialProductTypeId = searchParams.get("productTypeId") || "";
  const initialSubcategoryId = searchParams.get("subcategoryId") || "";
  const initialCategoryId = searchParams.get("categoryId") || "";
  const pendingSelectionRef = useRef<{
    nodeId: string;
    nodeType: SelectedNodeType;
    tab?: AtelierTab;
  } | null>(null);
  const selectionVersionRef = useRef(0);

  const [categories, setCategories] = useState<Category[]>([]);
  const [templates, setTemplates] = useState<TemplateRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [templateFilter, setTemplateFilter] = useState("ALL");
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [subcategoryId, setSubcategoryId] = useState(initialSubcategoryId);
  const [productTypeId, setProductTypeId] = useState(initialProductTypeId);
  const [selectedNodeId, setSelectedNodeId] = useState(initialProductTypeId || initialSubcategoryId || initialCategoryId);
  const [selectedNodeType, setSelectedNodeType] = useState<SelectedNodeType>(
    initialProductTypeId ? "productType" : initialSubcategoryId ? "subcategory" : "category",
  );
  const [selectedNodeName, setSelectedNodeName] = useState("");
  const [loadedEntityId, setLoadedEntityId] = useState("");
  const [loadedEntityType, setLoadedEntityType] = useState<SelectedNodeType | "">("");
  const [loadedParentName, setLoadedParentName] = useState("");
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<AtelierTab>(getValidAtelierTab(searchParams.get("tab")));
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [expandAll, setExpandAll] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [validationModalOpen, setValidationModalOpen] = useState(false);
  const [validationIssues, setValidationIssues] = useState<AtelierValidationIssue[]>([]);
  const [metadata, setMetadata] = useState<MetadataForm>(emptyMetadata());
  const [productTypeOptions, setProductTypeOptions] = useState("");
  const [newMainName, setNewMainName] = useState("");
  const [newSubName, setNewSubName] = useState("");
  const [newLeafName, setNewLeafName] = useState("");
  const [specFields, setSpecFields] = useState<SpecField[]>([]);
  const [variantConfigForm, setVariantConfigForm] = useState<StructuredVariantConfig>(tshirtVariantConfig);
  const [sizeGuideRows, setSizeGuideRows] = useState<SizeGuideRow[]>([]);
  const [businessRules, setBusinessRules] = useState<BusinessRules>(emptyBusinessRules);
  const [previewMode, setPreviewMode] = useState("Vendor upload form");
  const [csvText, setCsvText] = useState("categoryName,subcategoryName,productTypeName\nMen Fashion,Shirts,T-Shirts");
  const [csvPreview, setCsvPreview] = useState<CsvMappingResult[]>([]);
  const [imageInfo, setImageInfo] = useState<Record<string, ImageInfo>>({});
  const [pendingImageUploads, setPendingImageUploads] = useState(0);
  const [sortDrafts, setSortDrafts] = useState<Record<string, string>>({});

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === categoryId) || null,
    [categories, categoryId],
  );
  const currentTemplate = useMemo(
    () => {
      const exact = templates.find(
        (template) =>
          template.categoryId === categoryId &&
          (template.subcategoryId || "") === (subcategoryId || "") &&
          (template.productTypeId || "") === (productTypeId || ""),
      );
      if (exact) return exact;

      if (productTypeId) {
        return (
          templates.find(
            (template) =>
              template.categoryId === categoryId &&
              (template.subcategoryId || "") === (subcategoryId || "") &&
              !(template.productTypeId || ""),
          ) || null
        );
      }

      return (
        templates.find(
          (template) =>
            template.categoryId === categoryId &&
            (template.subcategoryId || "") === (subcategoryId || "") &&
            !(template.productTypeId || ""),
        ) || null
      );
    },
    [templates, categoryId, subcategoryId, productTypeId],
  );
  const selectedResolvedNode = useMemo(
    () => resolveSelectedNode(categories, selectedNodeType, selectedNodeId),
    [categories, selectedNodeId, selectedNodeType],
  );

  const categorySummaries = useMemo(
    () =>
      categories.map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        subcategories: category.subcategories,
      })),
    [categories],
  );

  const publishIssues = useMemo(() => {
    const issues = validateAtelierForPublish({
        categoryId,
        name: metadata.name,
        slug: metadata.slug,
        sortOrder: metadata.sortOrder,
        homepageIcon: metadata.homepageIcon,
        categoryImage: metadata.categoryImage,
        desktopBanner: metadata.desktopBanner,
        mobileBanner: metadata.mobileBanner,
        productTypes: linesToList(productTypeOptions),
        specs: specFields,
        variants: variantConfigForm.dimensions.map((dimension) => ({
          sku: dimension.key,
          stock: dimension.options.join(","),
        })),
        sizeGuideRows,
        businessRules,
        categories: categorySummaries,
    });
    for (const message of validateStructuredVariantConfig(variantConfigForm)) {
      issues.push({
        tab: "variants",
        field: "variants",
        message,
        severity: "error",
      });
    }
    return issues;
  }, [businessRules, categoryId, categorySummaries, metadata, productTypeOptions, sizeGuideRows, specFields, variantConfigForm]);
  const completionPercent = completionFromIssues(publishIssues);
  const hasPublishErrors = publishIssues.some((issue) => issue.severity === "error");
  const metadataIssues = validateCategoryMetadata({
    categoryId,
    name: metadata.name,
    slug: metadata.slug,
    categories: categorySummaries,
  });

  const breadcrumb = selectedResolvedNode?.breadcrumb || "No category selected";
  const lastSaved = currentTemplate?.specTemplate?.templateMeta?.savedAt || currentTemplate?.updatedAt || "";
  const templateStatus = currentTemplate?.specTemplate?.templateMeta?.status || (metadata.status === "ACTIVE" ? "Active" : metadata.status || "Draft");
  const recordMismatch = Boolean(selectedNodeId) && (selectedNodeId !== loadedEntityId || selectedNodeType !== loadedEntityType);
  const hasPendingImageUploads = pendingImageUploads > 0;

  const filteredCategories = useMemo(() => {
    const query = categorySearch.trim().toLowerCase();
    return categories.filter((category) => {
      const haystack = [
        category.name,
        category.slug,
        ...category.subcategories.flatMap((subcategory) => [
          subcategory.name,
          subcategory.slug,
          ...subcategory.productTypes.map((leaf) => leaf.name),
        ]),
      ].join(" ").toLowerCase();
      const template = templates.find((item) => item.categoryId === category.id);
      const sectionIssues = validateAtelierForPublish({
        categoryId: category.id,
        name: category.name,
        slug: category.slug,
        productTypes: template?.productTypes || [],
        specs: (template?.specTemplate?.fields || []).map(normalizeSpecField),
        variants: normalizeStructuredVariantConfig(template?.variantConfig).dimensions.map((dimension) => ({
          sku: dimension.key,
          stock: dimension.options.join(","),
        })),
        sizeGuideRows: template?.specTemplate?.sizeGuide || [],
        businessRules: { ...emptyBusinessRules, ...(template?.specTemplate?.businessRules || {}) },
        categories: categorySummaries,
      });
      const percent = completionFromIssues(sectionIssues);
      return (
        (!query || haystack.includes(query)) &&
        (templateFilter === "ALL" ||
          (templateFilter === "COMPLETE" && percent === 100) ||
          (templateFilter === "INCOMPLETE" && percent < 100))
      );
    });
  }, [categories, categorySearch, categorySummaries, templateFilter, templates]);

  const setUrlState = useCallback(
    (next: { categoryId?: string; subcategoryId?: string; productTypeId?: string; tab?: AtelierTab }) => {
      const target = buildAtelierQuery({
        categoryId: next.categoryId ?? categoryId,
        subcategoryId: next.subcategoryId ?? subcategoryId,
        productTypeId: next.productTypeId ?? productTypeId,
        tab: next.tab ?? activeTab,
      });
      router.replace(target, { scroll: false });
    },
    [activeTab, categoryId, productTypeId, router, subcategoryId],
  );

  const markDirty = useCallback(() => setDirty(true), []);

  async function loadAtelier(options: { keepScroll?: boolean; initial?: boolean } = {}) {
    const scrollTop = mainScrollRef.current?.scrollTop || 0;
    if (options.initial) setLoading(true);
    try {
      const response = await fetch("/api/admin/category-atelier", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        setToast(data.error || "Could not load category atelier.");
        return;
      }
      setCategories(data.categories || []);
      setTemplates(data.templates || []);
      setAuditLogs(data.auditLogs || []);
      if (Array.isArray(data.invalidImageCleanup) && data.invalidImageCleanup.length > 0) {
        setToast(`Cleared ${data.invalidImageCleanup.length} invalid temporary image URL(s).`);
      }
      requestAnimationFrame(() => {
        if (options.keepScroll && mainScrollRef.current) mainScrollRef.current.scrollTop = scrollTop;
      });
    } catch {
      setToast("Could not connect to category atelier.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const stored = localStorage.getItem("categoryAtelierExpanded");
    if (stored) setExpandedIds(new Set(JSON.parse(stored) as string[]));
    loadAtelier({ initial: true });
  }, []);

  useEffect(() => {
    localStorage.setItem("categoryAtelierExpanded", JSON.stringify([...expandedIds]));
  }, [expandedIds]);

  useEffect(() => {
    const version = selectionVersionRef.current + 1;
    selectionVersionRef.current = version;

    setMetadata(emptyMetadata());
    setImageInfo({});
    setValidationIssues([]);
    setCsvPreview([]);
    setLoadedEntityId("");
    setLoadedEntityType("");
    setLoadedParentName("");
    setMetadataLoading(Boolean(selectedNodeId));

    if (!selectedNodeId) {
      setSelectedNodeName("");
      setMetadataLoading(false);
      return;
    }

    const timeout = window.setTimeout(() => {
      if (selectionVersionRef.current !== version) return;
      const resolved = resolveSelectedNode(categories, selectedNodeType, selectedNodeId);
      if (!resolved) {
        setToast("Selected record could not be found.");
        setMetadataLoading(false);
        return;
      }

      setCategoryId(resolved.categoryId);
      setSubcategoryId(resolved.subcategoryId);
      setProductTypeId(resolved.productTypeId);
      setSelectedNodeName(resolved.entity.name);
      setLoadedEntityId(resolved.entity.id);
      setLoadedEntityType(selectedNodeType);
      setLoadedParentName(resolved.parentName);
      setMetadata(metadataFromEntity(resolved.entity));
      setMetadataLoading(false);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [categories, selectedNodeId, selectedNodeType]);

  useEffect(() => {
    if (!currentTemplate) {
      setProductTypeOptions("");
      setSpecFields([]);
      setVariantConfigForm(tshirtVariantConfig);
      setSizeGuideRows([]);
      setBusinessRules(emptyBusinessRules);
      return;
    }
    setProductTypeOptions((currentTemplate.productTypes || []).join("\n"));
    setSpecFields((currentTemplate.specTemplate?.fields || []).map(normalizeSpecField));
    setVariantConfigForm(normalizeStructuredVariantConfig(currentTemplate.variantConfig));
    setSizeGuideRows(currentTemplate.specTemplate?.sizeGuide || []);
    setBusinessRules({ ...emptyBusinessRules, ...(currentTemplate.specTemplate?.businessRules || {}) });
  }, [currentTemplate, categoryId, subcategoryId, productTypeId]);

  useEffect(() => {
    const item = treeItemRefs.current[selectedNodeId];
    item?.scrollIntoView({ block: "nearest" });
  }, [filteredCategories.length, selectedNodeId]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "You have unsaved changes.";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        saveDraft();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function requestSelection(nextNodeType: SelectedNodeType, nextNodeId: string, nextTab = activeTab) {
    if (dirty) {
      pendingSelectionRef.current = { nodeId: nextNodeId, nodeType: nextNodeType, tab: nextTab };
      setShowUnsavedDialog(true);
      return;
    }
    applySelection(nextNodeType, nextNodeId, nextTab);
  }

  function applySelection(nextNodeType: SelectedNodeType, nextNodeId: string, nextTab = activeTab) {
    const resolved = resolveSelectedNode(categories, nextNodeType, nextNodeId);
    const nextCategoryId = resolved?.categoryId || (nextNodeType === "category" ? nextNodeId : "");
    const nextSubcategoryId = resolved?.subcategoryId || "";
    const nextProductTypeId = resolved?.productTypeId || "";

    setSelectedNodeId(nextNodeId);
    setSelectedNodeType(nextNodeType);
    setSelectedNodeName(resolved?.entity.name || "");
    setCategoryId(nextCategoryId);
    setSubcategoryId(nextSubcategoryId);
    setProductTypeId(nextProductTypeId);
    setActiveTab(nextTab);
    setUrlState({
      categoryId: nextCategoryId,
      subcategoryId: nextSubcategoryId,
      productTypeId: nextProductTypeId,
      tab: nextTab,
    });
    setDrawerOpen(false);
    setDirty(false);
  }

  function updateMetadata(updates: Partial<MetadataForm>) {
    setMetadata((current) => ({ ...current, ...updates }));
    markDirty();
  }

  async function runAction(action: string, payload: Record<string, unknown> = {}) {
    const scrollTop = mainScrollRef.current?.scrollTop || 0;
    setSaving(true);
    try {
      const response = await fetch("/api/admin/category-atelier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const data = await response.json();
      if (!response.ok) {
        setToast(data.error || "Action failed.");
        return false;
      }
      setToast("Saved.");
      await loadAtelier({ keepScroll: true });
      requestAnimationFrame(() => {
        if (mainScrollRef.current) mainScrollRef.current.scrollTop = scrollTop;
      });
      return true;
    } catch {
      setToast("Could not connect to category atelier.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function recordAudit(action: string, oldValue: unknown, newValue: unknown) {
    try {
      await fetch("/api/admin/category-atelier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "recordAudit",
          entityType: loadedEntityType || selectedNodeType,
          entityId: loadedEntityId || selectedNodeId,
          auditAction: action,
          oldValue,
          newValue,
        }),
      });
    } catch {
      // Audit logging should not make a successful save look failed to the admin.
    }
  }

  async function saveMetadata() {
    if (!selectedNodeId) {
      setToast("Select a category, subcategory, or product type first.");
      return false;
    }
    if (selectedNodeId !== loadedEntityId || selectedNodeType !== loadedEntityType) {
      setToast("Selected item and loaded form do not match.");
      return false;
    }
    if (selectedNodeType === "productType" && (!productTypeId || productTypeId !== loadedEntityId)) {
      setToast("Selected product type and loaded template do not match.");
      return false;
    }
    if (hasPendingImageUploads) {
      setToast("Wait for image uploads to finish before saving metadata.");
      return false;
    }
    const temporaryImageField = (["homepageIcon", "categoryImage", "desktopBanner", "mobileBanner"] as CategoryMetadataImageField[])
      .find((field) => isTemporaryImageUrl(metadata[field]));
    if (temporaryImageField) {
      setToast("Temporary image URLs cannot be saved. Upload the image file again.");
      return false;
    }
    const errors = metadataIssues.filter((issue) => issue.severity === "error");
    if (errors.length) {
      setValidationIssues(metadataIssues);
      setValidationModalOpen(true);
      return false;
    }
    const oldValue = selectedResolvedNode?.entity || null;
    const ok = await runAction("updateEntity", {
      entityType: selectedNodeType,
      id: selectedNodeId,
      updates: {
        name: metadata.name.trim(),
        slug: normalizeAtelierSlug(metadata.slug),
        sortOrder: Number(metadata.sortOrder || 0),
        homepageIcon: metadata.homepageIcon,
        categoryImage: metadata.categoryImage,
        desktopBanner: metadata.desktopBanner,
        mobileBanner: metadata.mobileBanner,
        altText: metadata.altText,
        status: metadata.status,
      },
    });
    if (ok) {
      setDirty(false);
      await recordAudit("metadata-update", oldValue, metadata);
      setToast("Metadata saved successfully.");
    }
    return ok;
  }

  async function saveTemplate(status: "DRAFT" | "PUBLISHED") {
    if (!selectedNodeId) {
      setToast("Select a category, subcategory, or product type first.");
      return false;
    }
    if (selectedNodeId !== loadedEntityId || selectedNodeType !== loadedEntityType) {
      setToast("Selected item and loaded form do not match.");
      return false;
    }
    if (selectedNodeType === "productType" && (!productTypeId || productTypeId !== loadedEntityId)) {
      setToast("Selected product type and loaded template do not match.");
      return false;
    }
    const issues = validateAtelierForPublish({
      categoryId,
      name: metadata.name,
      slug: metadata.slug,
      productTypes: linesToList(productTypeOptions),
      specs: specFields,
      variants: variantConfigForm.dimensions.map((dimension) => ({
        sku: dimension.key,
        stock: dimension.options.join(","),
      })),
      sizeGuideRows,
      businessRules,
      categories: categorySummaries,
    });
    const variantConfigErrors = validateStructuredVariantConfig(variantConfigForm);
    for (const message of variantConfigErrors) {
      issues.push({
        tab: "variants",
        field: "variants",
        message,
        severity: "error",
      });
    }
    if (status === "PUBLISHED" && issues.some((issue) => issue.severity === "error")) {
      setValidationIssues(issues);
      setValidationModalOpen(true);
      return false;
    }
    setSaving(true);
    const savedAt = new Date().toISOString();
    const body = {
      categoryId,
      subcategoryId: subcategoryId || null,
      productTypeId: selectedNodeType === "productType" ? productTypeId : null,
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
          savedBy: "admin",
          savedAt,
          version: Number(currentTemplate?.specTemplate?.templateMeta?.version || 0) + 1,
        },
      },
      variantConfig: {
        title: "Variant Configuration",
        note: "Admin configures dimensions and row validation. Vendors enter actual stock rows during product upload.",
        selectedStyle: "Template Preview Only - Actual values will be entered by vendors.",
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
        dimensions: variantConfigForm.dimensions,
        rowFields: variantConfigForm.rowFields,
        combinationRules: variantConfigForm.combinationRules,
        examplePreview: variantConfigForm.examplePreview,
        examples: variantConfigForm.examplePreview,
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
        setToast(data.error || "Template could not be saved.");
        return false;
      }
      if (data.template) {
        setTemplates((current) => {
          const updated = data.template as TemplateRecord;
          const withoutSavedRecord = current.filter(
            (template) =>
              template.id !== updated.id &&
              !(
                template.categoryId === updated.categoryId &&
                (template.subcategoryId || "") === (updated.subcategoryId || "") &&
                (template.productTypeId || "") === (updated.productTypeId || "")
              ),
          );
          return [updated, ...withoutSavedRecord];
        });
        setVariantConfigForm(normalizeStructuredVariantConfig(data.template.variantConfig));
        setSpecFields((data.template.specTemplate?.fields || []).map(normalizeSpecField));
        setSizeGuideRows(data.template.specTemplate?.sizeGuide || []);
        setBusinessRules({ ...emptyBusinessRules, ...(data.template.specTemplate?.businessRules || {}) });
      }
      setDirty(false);
      setToast(activeTab === "variants" ? "Variant configuration saved successfully." : status === "PUBLISHED" ? "Template published." : "Draft saved.");
      await recordAudit(status === "PUBLISHED" ? "publish" : "save-draft", currentTemplate, body);
      await loadAtelier({ keepScroll: true });
      return true;
    } catch {
      setToast("Could not connect to template service.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveDraft() {
    const metadataSaved = await saveMetadata();
    if (!metadataSaved) return false;
    return saveTemplate("DRAFT");
  }

  async function publish() {
    if (!(await saveMetadata())) return;
    await saveTemplate("PUBLISHED");
  }

  async function createMainCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newMainName.trim()) return;
    if (!confirm(`Create main category "${newMainName.trim()}"?`)) return;
    const ok = await runAction("createCategory", { name: newMainName.trim() });
    if (ok) setNewMainName("");
  }

  async function createSubcategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedNodeType !== "category") {
      setToast("Select a Category to add a Subcategory.");
      return;
    }
    if (!categoryId || !newSubName.trim()) return;
    const ok = await runAction("createSubcategory", { name: newSubName.trim(), categoryId });
    if (ok) setNewSubName("");
  }

  async function createLeaf(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedNodeType !== "subcategory") {
      setToast(`${selectedNodeName || "This item"} is a Product Type. Select its parent subcategory ${loadedParentName || "first"} to add another Product Type.`);
      return;
    }
    if (!subcategoryId || !newLeafName.trim()) return;
    const ok = await runAction("createProductType", { name: newLeafName.trim(), subcategoryId });
    if (ok) setNewLeafName("");
  }

  function siblingIdsFor(nodeType: SelectedNodeType, nodeId: string) {
    if (nodeType === "category") return categories.map((category) => category.id);

    for (const category of categories) {
      if (nodeType === "subcategory" && category.subcategories.some((subcategory) => subcategory.id === nodeId)) {
        return category.subcategories.map((subcategory) => subcategory.id);
      }

      for (const subcategory of category.subcategories) {
        if (nodeType === "productType" && subcategory.productTypes.some((leaf) => leaf.id === nodeId)) {
          return subcategory.productTypes.map((leaf) => leaf.id);
        }
      }
    }

    return [];
  }

  async function moveTreeItem(nodeType: SelectedNodeType, nodeId: string, target: "first" | "up" | "down" | "last") {
    const siblings = siblingIdsFor(nodeType, nodeId);
    const from = siblings.indexOf(nodeId);
    if (from < 0) return;

    const next = [...siblings];
    const [moved] = next.splice(from, 1);
    const to =
      target === "first"
        ? 0
        : target === "last"
          ? next.length
          : target === "up"
            ? Math.max(0, from - 1)
            : Math.min(next.length, from + 1);

    next.splice(to, 0, moved);
    if (next.join("|") === siblings.join("|")) return;

    await runAction("reorder", {
      items: next.map((id, index) => ({
        id,
        entityType: nodeType,
        sortOrder: index + 1,
      })),
    });
  }

  function sortDraftKey(nodeType: SelectedNodeType, nodeId: string) {
    return `${nodeType}:${nodeId}`;
  }

  function setTreeSortDraft(nodeType: SelectedNodeType, nodeId: string, value: string, currentSortOrder: number) {
    const key = sortDraftKey(nodeType, nodeId);
    setSortDrafts((drafts) => {
      const next = { ...drafts };
      if (value === String(currentSortOrder || 0)) delete next[key];
      else next[key] = value;
      return next;
    });
  }

  async function saveTreeSortDrafts() {
    const items = Object.entries(sortDrafts)
      .map(([key, value]) => {
        const [entityType, id] = key.split(":") as [SelectedNodeType, string];
        const sortOrder = Number(value);
        return Number.isFinite(sortOrder) && sortOrder >= 0
          ? { entityType, id, sortOrder }
          : null;
      })
      .filter((item): item is { entityType: SelectedNodeType; id: string; sortOrder: number } => Boolean(item));

    if (items.length === 0) {
      setToast("Enter valid order numbers first.");
      return;
    }

    const ok = await runAction("reorder", { items });
    if (ok) {
      setSortDrafts({});
      setToast("Order numbers saved.");
    }
  }

  function treeOrderControls(nodeType: SelectedNodeType, nodeId: string, name: string, sortOrder: number) {
    const draftKey = sortDraftKey(nodeType, nodeId);
    const draftValue = sortDrafts[draftKey] ?? String(sortOrder || 0);
    const hasDraft = sortDrafts[draftKey] !== undefined;

    return (
      <div className="mt-1 flex flex-wrap items-center gap-1">
        <label className="flex items-center gap-1 text-[10px] font-semibold text-stone-600">
          No.
          <input
            type="number"
            min="0"
            value={draftValue}
            onChange={(event) => setTreeSortDraft(nodeType, nodeId, event.target.value, sortOrder)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                saveTreeSortDrafts();
              }
            }}
            className={`h-6 w-14 border px-1 text-[11px] font-bold ${hasDraft ? "border-amber-500 bg-amber-50" : "border-stone-300 bg-white"}`}
            aria-label={`Sort order for ${name}`}
          />
        </label>
        <button type="button" onClick={() => requestSelection(nodeType, nodeId, "metadata")} className="border px-1.5 py-0.5 text-[10px] font-semibold">
          Edit
        </button>
        <button type="button" onClick={() => moveTreeItem(nodeType, nodeId, "first")} className="border px-1.5 py-0.5 text-[10px] font-semibold">
          {nodeType === "category" ? "Popular first" : "First"}
        </button>
        <button type="button" onClick={() => moveTreeItem(nodeType, nodeId, "up")} className="border px-1.5 py-0.5 text-[10px] font-semibold">
          Up
        </button>
        <button type="button" onClick={() => moveTreeItem(nodeType, nodeId, "down")} className="border px-1.5 py-0.5 text-[10px] font-semibold">
          Down
        </button>
        <button type="button" onClick={() => moveTreeItem(nodeType, nodeId, "last")} className="border px-1.5 py-0.5 text-[10px] font-semibold">
          Last
        </button>
        <button
          type="button"
          onClick={() =>
            confirmAction(`Remove ${name}`, () =>
              runAction("deleteEntity", { entityType: nodeType, id: nodeId, confirmed: true }),
            )
          }
          className="border border-red-200 px-1.5 py-0.5 text-[10px] font-semibold text-red-600"
        >
          Remove
        </button>
      </div>
    );
  }

  function addSpecField() {
    setSpecFields((fields) => [
      ...fields,
      normalizeSpecField({ label: "", fieldType: "Text", vendorEditable: true, customerVisible: true }, fields.length),
    ]);
    markDirty();
  }

  function updateVariantDimension(index: number, updates: Partial<VariantDimensionConfig>) {
    setVariantConfigForm((current) => ({
      ...current,
      dimensions: current.dimensions.map((dimension, dimensionIndex) =>
        dimensionIndex === index ? { ...dimension, ...updates } : dimension,
      ),
    }));
    markDirty();
  }

  function addVariantDimension() {
    setVariantConfigForm((current) => ({
      ...current,
      dimensions: [
        ...current.dimensions,
        {
          key: `option_${current.dimensions.length + 1}`,
          label: `Option ${current.dimensions.length + 1}`,
          type: "dropdown",
          required: true,
          vendorEditable: true,
          customerVisible: true,
          filterable: true,
          affectsSku: true,
          affectsStock: true,
          affectsPrice: false,
          options: ["Option 1", "Option 2"],
        },
      ],
    }));
    markDirty();
  }

  function updateVariantRowField(key: string, updates: Record<string, unknown>) {
    setVariantConfigForm((current) => ({
      ...current,
      rowFields: {
        ...current.rowFields,
        [key]: {
          ...current.rowFields[key],
          ...updates,
        },
      },
    }));
    markDirty();
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
    markDirty();
  }

  function setTab(tab: AtelierTab) {
    setActiveTab(tab);
    setUrlState({ tab });
  }

  function updateBusinessRules(updates: Partial<BusinessRules>) {
    setBusinessRules((rules) => {
      const next = { ...rules, ...updates };
      if (updates.returnAllowed) {
        next.nonReturnable = false;
        next.nonReturnableReason = "";
      }
      if (updates.nonReturnable) {
        next.returnAllowed = false;
        next.returnWindow = "";
        next.returnReasons = "";
      }
      return next;
    });
    markDirty();
  }

  function readUploadError(response: Response, fallback: string) {
    return response.text().then((text) => {
      if (!text) return fallback;
      try {
        const data = JSON.parse(text) as { error?: string };
        return data.error || fallback;
      } catch {
        return text.slice(0, 180) || fallback;
      }
    });
  }

  function validateMetadataImage(field: CategoryMetadataImageField, file: File) {
    if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.type)) {
      return "Only JPG, JPEG, PNG and WebP images are allowed.";
    }
    if (file.size > metadataImageMaxBytes) {
      return "Image must be 10MB or smaller.";
    }
    if (!selectedNodeId || recordMismatch || metadataLoading) {
      return "Wait for the selected record to finish loading before uploading.";
    }
    return "";
  }

  async function handleImageFile(field: CategoryMetadataImageField, file: File | null, recommended: string) {
    if (!file) return;
    const validationError = validateMetadataImage(field, file);
    const info: ImageInfo = {
      fileName: file.name,
      fileSize: `${Math.round(file.size / 1024)} KB`,
      dimensions: validationError ? "Not uploaded" : "Reading...",
      progress: validationError ? 0 : 10,
      error: validationError,
      status: validationError ? "failed" : "uploading",
    };
    setImageInfo((current) => ({ ...current, [field]: info }));
    if (validationError) return;

    const image = new Image();
    const previewUrl = URL.createObjectURL(file);
    image.onload = () => {
      const squareRequired = field === "homepageIcon" || field === "categoryImage";
      const landscapeRequired = field === "desktopBanner";
      const portraitRequired = field === "mobileBanner";
      const error =
        (squareRequired && image.width !== image.height && `${recommended} recommended.`) ||
        (landscapeRequired && image.width <= image.height && `${recommended} recommended.`) ||
        (portraitRequired && image.height < image.width && `${recommended} recommended.`) ||
        "";
      setImageInfo((current) => ({
        ...current,
        [field]: {
          ...info,
          dimensions: `${image.width} x ${image.height}`,
          error,
          status: "uploading",
          progress: 30,
        },
      }));
      URL.revokeObjectURL(previewUrl);
    };
    image.src = previewUrl;

    setPendingImageUploads((count) => count + 1);
    try {
      const signResponse = await fetch("/api/uploads/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
          size: file.size,
          purpose: "category-asset",
          scopeType: selectedNodeType,
          scopeId: selectedNodeId,
          assetField: field,
        }),
      });

      if (!signResponse.ok) {
        throw new Error(await readUploadError(signResponse, "Upload sign failed."));
      }

      const signedUpload = (await signResponse.json()) as {
        signedUrl?: string;
        url?: string;
      };

      if (!signedUpload.signedUrl || !signedUpload.url || isTemporaryImageUrl(signedUpload.url)) {
        throw new Error("Upload service returned an invalid image URL.");
      }

      setImageInfo((current) => ({
        ...current,
        [field]: {
          ...(current[field] || info),
          progress: 65,
          status: "uploading",
          error: current[field]?.error || "",
        },
      }));

      const uploadData = new FormData();
      uploadData.append("cacheControl", "3600");
      uploadData.append("", file);

      const uploadResponse = await fetch(signedUpload.signedUrl, {
        method: "PUT",
        headers: { "x-upsert": "false" },
        body: uploadData,
      });

      if (!uploadResponse.ok) {
        throw new Error(await readUploadError(uploadResponse, "Upload failed."));
      }

      updateMetadata({ [field]: signedUpload.url } as Partial<MetadataForm>);
      setImageInfo((current) => ({
        ...current,
        [field]: {
          ...(current[field] || info),
          progress: 100,
          status: "success",
          error: current[field]?.error || "",
        },
      }));
    } catch (error) {
      setImageInfo((current) => ({
        ...current,
        [field]: {
          ...(current[field] || info),
          progress: 0,
          status: "failed",
          error: error instanceof Error ? error.message : "Upload failed.",
        },
      }));
    } finally {
      setPendingImageUploads((count) => Math.max(0, count - 1));
    }
  }

  function handleImageUrlChange(field: CategoryMetadataImageField, value: string) {
    if (isTemporaryImageUrl(value)) {
      setImageInfo((current) => ({
        ...current,
        [field]: {
          fileName: "Temporary URL rejected",
          fileSize: "",
          dimensions: "",
          progress: 0,
          error: "blob: and data: URLs cannot be saved. Upload the image file first.",
          status: "failed",
        },
      }));
      return;
    }
    updateMetadata({ [field]: value } as Partial<MetadataForm>);
  }

  function downloadMasterCsv() {
    const rows = ["level,id,name,slug,parentId,status,sortOrder"];
    categories.forEach((category) => {
      rows.push(`main,${category.id},${category.name},${category.slug},,${category.status},${category.sortOrder}`);
      category.subcategories.forEach((subcategory) => {
        rows.push(`subcategory,${subcategory.id},${subcategory.name},${subcategory.slug},${category.id},${subcategory.status},${subcategory.sortOrder}`);
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
    setCsvPreview(mapCsvCategories(parseCsv(csvText), categories));
  }

  function openIssue(issue: AtelierValidationIssue) {
    setTab(issue.tab);
    setValidationModalOpen(false);
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-field="${issue.field || issue.tab}"]`)?.focus();
    });
  }

  function confirmAction(label: string, fn: () => void) {
    if (confirm(`${label}?`)) fn();
  }

  function renderImageControl(field: CategoryMetadataImageField, label: string, recommended: string) {
    const info = imageInfo[field];
    const isUploading = info?.status === "uploading";
    return (
      <div className="min-w-0 border border-stone-200 bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold">{label}</p>
          <span className="text-xs text-stone-500">{recommended}</span>
        </div>
        <div className="mt-2 aspect-[3/2] overflow-hidden border bg-stone-50">
          {metadata[field] && !isTemporaryImageUrl(metadata[field]) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={metadata[field]} alt={label} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-stone-500">No image</div>
          )}
        </div>
        <input
          value={metadata[field]}
          onChange={(event) => handleImageUrlChange(field, event.target.value)}
          placeholder={`${label} URL`}
          className="mt-2 w-full min-w-0 border px-2 py-2 text-sm"
        />
        {metadata[field] && isTemporaryImageUrl(metadata[field]) && (
          <p className="mt-1 text-xs font-semibold text-red-600">
            Temporary URL rejected. Upload the file again.
          </p>
        )}
        <input
          type="file"
          accept={metadataImageAccept}
          disabled={isUploading}
          onChange={(event) => handleImageFile(field, event.target.files?.[0] || null, recommended)}
          className="mt-2 w-full text-xs"
        />
        {info && (
          <div className="mt-2 text-xs text-stone-600">
            <p>{info.fileName} · {info.fileSize} · {info.dimensions}</p>
            <p>
              {info.status === "uploading" && "Uploading..."}
              {info.status === "success" && "Upload successful"}
              {info.status === "failed" && "Upload failed"}
              {info.status === "idle" && "Ready"}
              {` (${info.progress}%)`}
            </p>
            {info.error && <p className="text-red-600">{info.error}</p>}
          </div>
        )}
        <p className="mt-2 text-xs text-stone-500">
          {metadata[field] ? "Replace by choosing a new file." : "Choose a file to upload before saving."}
        </p>
        <button
          type="button"
          onClick={() => {
            updateMetadata({ [field]: "" } as Partial<MetadataForm>);
            setImageInfo((current) => ({
              ...current,
              [field]: {
                fileName: "Removed",
                fileSize: "",
                dimensions: "",
                progress: 100,
                error: "",
                status: "success",
              },
            }));
          }}
          className="mt-2 text-xs font-semibold text-red-600"
        >
          Remove
        </button>
      </div>
    );
  }

  function sectionStatus(tab: AtelierTab) {
    const issue = publishIssues.find((item) => item.tab === tab && item.severity === "error");
    if (issue) return "Error";
    if (tab === "metadata") return metadata.name && metadata.slug ? "Complete" : "Missing";
    if (tab === "product-types") return linesToList(productTypeOptions).length ? "Complete" : "Missing";
    if (tab === "specifications") return specFields.length ? "Complete" : "Missing";
    if (tab === "variants") return validateStructuredVariantConfig(variantConfigForm).length ? "Error" : "Complete";
    if (tab === "size-guide") return sizeGuideRows.length ? "Complete" : "Incomplete";
    if (tab === "customer-filters") return specFields.some((field) => field.filterable) ? "Complete" : "Missing";
    return "Complete";
  }

  const sidebar = (
    <aside className="sticky top-[116px] max-h-[calc(100vh-124px)] min-w-0 overflow-hidden border-r border-stone-200 bg-white lg:block">
      <div className="sticky top-0 z-10 border-b bg-white p-3">
        <form onSubmit={createMainCategory} className="grid gap-2">
          <input
            value={newMainName}
            onChange={(event) => setNewMainName(event.target.value)}
            placeholder='Add Category, e.g. "Men"'
            className="min-w-0 border px-3 py-2 text-sm"
          />
          <button className="bg-stone-950 px-3 py-2 text-sm font-semibold text-white">Add Category</button>
        </form>
        <input
          value={categorySearch}
          onChange={(event) => setCategorySearch(event.target.value)}
          placeholder="Search category tree"
          className="mt-3 w-full min-w-0 border px-3 py-2 text-sm"
        />
        <select value={templateFilter} onChange={(event) => setTemplateFilter(event.target.value)} className="mt-2 w-full border px-3 py-2 text-sm">
          <option value="ALL">All templates</option>
          <option value="COMPLETE">Complete</option>
          <option value="INCOMPLETE">Incomplete</option>
        </select>
        <button
          type="button"
          onClick={saveTreeSortDrafts}
          disabled={saving || Object.keys(sortDrafts).length === 0}
          className="mt-2 w-full border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-950 disabled:opacity-50"
        >
          Save order numbers{Object.keys(sortDrafts).length ? ` (${Object.keys(sortDrafts).length})` : ""}
        </button>
      </div>
      <div className="max-h-[calc(100vh-300px)] overflow-y-auto p-3">
        {filteredCategories.map((category) => {
          const expanded = expandAll || expandedIds.has(category.id) || category.id === categoryId;
          const selected = selectedNodeType === "category" && category.id === selectedNodeId;
          return (
            <div key={category.id} className="min-w-0">
              <button
                ref={(node) => {
                  treeItemRefs.current[category.id] = node;
                }}
                onClick={() => requestSelection("category", category.id)}
                className={`flex w-full min-w-0 items-center justify-between gap-2 rounded px-2 py-2 text-left text-sm ${selected ? "bg-amber-100 text-amber-950" : "hover:bg-stone-100"}`}
              >
                <span className="min-w-0 truncate font-semibold">{category.name}</span>
                <span className="shrink-0 text-[10px] uppercase text-stone-500">{category.status}</span>
              </button>
              <button
                onClick={() =>
                  setExpandedIds((ids) => {
                    const next = new Set(ids);
                    if (next.has(category.id)) next.delete(category.id);
                    else next.add(category.id);
                    return next;
                  })
                }
                className="ml-2 text-xs text-stone-500"
              >
                {expanded ? "Collapse" : "Expand"}
              </button>
              <div className="ml-2">
                {treeOrderControls("category", category.id, category.name, category.sortOrder)}
              </div>
              {expanded && (
                <div className="ml-3 border-l pl-2">
                  {category.subcategories.map((subcategory) => (
                    <Fragment key={subcategory.id}>
                      <button
                        ref={(node) => {
                          treeItemRefs.current[subcategory.id] = node;
                        }}
                        onClick={() => requestSelection("subcategory", subcategory.id)}
                        className={`mt-1 w-full min-w-0 rounded px-2 py-1 text-left text-xs ${selectedNodeType === "subcategory" && subcategory.id === selectedNodeId ? "bg-stone-900 text-white" : "hover:bg-stone-100"}`}
                      >
                        <span className="block truncate">{subcategory.name}</span>
                      </button>
                      <div className="ml-1">
                        {treeOrderControls("subcategory", subcategory.id, subcategory.name, subcategory.sortOrder)}
                      </div>
                      <div className="ml-3 flex min-w-0 flex-wrap gap-1 py-1">
                        {subcategory.productTypes.map((leaf) => (
                          <div key={leaf.id} className="max-w-full">
                            <button
                              ref={(node) => {
                                treeItemRefs.current[leaf.id] = node;
                              }}
                              onClick={() => requestSelection("productType", leaf.id)}
                              className={`max-w-full truncate rounded border px-2 py-1 text-[11px] ${leaf.id === productTypeId ? "border-amber-700 bg-amber-100 text-amber-950" : "text-stone-600"}`}
                            >
                              {leaf.name}
                            </button>
                            {treeOrderControls("productType", leaf.id, leaf.name, leaf.sortOrder)}
                          </div>
                        ))}
                      </div>
                    </Fragment>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f6f4ef] text-stone-950">
      <Navbar />
      <div className="sticky top-0 z-30 border-b border-stone-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-2">
          <button onClick={() => setDrawerOpen(true)} className="border px-3 py-2 text-sm font-semibold lg:hidden">Tree</button>
          <Link href="/admin/dashboard" className="text-sm font-semibold text-[#8a6a26]">Admin</Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">
              <span className="mr-2 rounded-full border border-stone-300 px-2 py-0.5 text-[10px] uppercase text-stone-600">
                {entityTypeLabel(loadedEntityType || selectedNodeType)}
              </span>
              {breadcrumb}
            </p>
            <p className="text-xs text-stone-500">
              {templateStatus} · {completionPercent}% complete · {dirty ? "Unsaved changes" : "Saved"} · Last saved {formatDate(lastSaved)}
            </p>
          </div>
          <button onClick={() => saveDraft()} disabled={saving || !selectedNodeId || recordMismatch || metadataLoading || hasPendingImageUploads} className="bg-stone-950 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {saving ? "Saving..." : "Save Draft"}
          </button>
          <button onClick={() => { setValidationIssues(publishIssues); setValidationModalOpen(true); }} className="border px-3 py-2 text-sm font-semibold">Validate</button>
          <button onClick={() => setTab("preview")} className="border px-3 py-2 text-sm font-semibold">Preview</button>
          <button onClick={publish} disabled={saving || hasPublishErrors || !selectedNodeId || recordMismatch || metadataLoading || hasPendingImageUploads} className="bg-[#8a6a26] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Publish</button>
        </div>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden">
          <div className="h-full w-[88vw] max-w-sm bg-white">
            <button onClick={() => setDrawerOpen(false)} className="m-3 border px-3 py-2 text-sm font-semibold">Close</button>
            {sidebar}
          </div>
        </div>
      )}

      <section className="mx-auto grid max-w-[1500px] grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="hidden lg:block">{sidebar}</div>
        <div ref={mainScrollRef} className="min-w-0 overflow-x-hidden px-3 py-4 md:px-5">
          {toast && <div className="sticky top-0 z-20 mb-3 border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">{toast}</div>}
          <div className="mb-3 flex gap-2 overflow-x-auto border-b border-stone-200 bg-[#f6f4ef] pb-2">
            {atelierTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setTab(tab)}
                className={`shrink-0 border px-3 py-2 text-sm font-semibold ${activeTab === tab ? "border-stone-950 bg-stone-950 text-white" : "bg-white"}`}
              >
                {tabLabels[tab]} <span className="ml-1 text-[10px]">{sectionStatus(tab)}</span>
              </button>
            ))}
            <button onClick={() => setExpandAll((value) => !value)} className="shrink-0 border px-3 py-2 text-sm font-semibold">
              {expandAll ? "Collapse Tree" : "Expand Tree"}
            </button>
          </div>

          {loading ? (
            <p className="py-16 text-center text-stone-500">Loading category atelier...</p>
          ) : metadataLoading || recordMismatch ? (
            <div className="border border-amber-200 bg-amber-50 p-6 text-sm font-semibold text-amber-950">
              Loading selected record...
            </div>
          ) : (
            <div className="min-w-0 space-y-4">
              {(activeTab === "metadata" || expandAll) && (
                <section className="min-w-0 bg-white p-4 shadow-sm">
                  <h2 className="text-xl font-bold">Metadata</h2>
                  <div className="mt-3 grid gap-2 border border-stone-200 bg-stone-50 p-3 text-sm md:grid-cols-2">
                    <p className="min-w-0 break-words"><strong>Editing:</strong> {breadcrumb}</p>
                    <p className="min-w-0 break-words"><strong>Selected Node:</strong> {selectedNodeName || "Loading"}</p>
                    <p><strong>Entity Type:</strong> {loadedEntityType || selectedNodeType}</p>
                    <p className="min-w-0 break-all"><strong>Record ID:</strong> {loadedEntityId || selectedNodeId || "None"}</p>
                    <p className="min-w-0 break-words"><strong>Parent:</strong> {loadedParentName || "Root"}</p>
                  </div>
                  <p className="mt-3 text-sm text-stone-500">For Men, use Name: Men and Slug: men.</p>
                  {(metadataLoading || recordMismatch) ? (
                    <div className="mt-4 border border-amber-200 bg-amber-50 p-6 text-sm font-semibold text-amber-950">
                      Loading selected record...
                    </div>
                  ) : (
                  <>
                  <div className="mt-4 grid min-w-0 gap-3 md:grid-cols-2">
                    <label className="min-w-0 text-sm font-semibold">Name
                      <input data-field="name" value={metadata.name} onChange={(event) => updateMetadata({ name: event.target.value, slug: normalizeAtelierSlug(event.target.value) })} className="mt-1 w-full min-w-0 border px-3 py-2" />
                    </label>
                    <label className="min-w-0 text-sm font-semibold">Slug
                      <input data-field="slug" value={metadata.slug} onChange={(event) => updateMetadata({ slug: normalizeAtelierSlug(event.target.value) })} className="mt-1 w-full min-w-0 border px-3 py-2" />
                      <span className="text-xs text-stone-500">Preview: /category/{normalizeAtelierSlug(metadata.slug) || "slug"}</span>
                    </label>
                    <label className="text-sm font-semibold">Sort order
                      <input type="number" value={metadata.sortOrder} onChange={(event) => updateMetadata({ sortOrder: event.target.value })} className="mt-1 w-full border px-3 py-2" />
                    </label>
                    <label className="text-sm font-semibold">Status
                      <select value={metadata.status} onChange={(event) => updateMetadata({ status: event.target.value as Status })} className="mt-1 w-full border px-3 py-2">
                        <option value="ACTIVE">Active</option>
                        <option value="INACTIVE">Inactive</option>
                        <option value="ARCHIVED">Archived</option>
                      </select>
                    </label>
                    <label className="md:col-span-2 text-sm font-semibold">Alt text
                      <input value={metadata.altText} onChange={(event) => updateMetadata({ altText: event.target.value })} className="mt-1 w-full min-w-0 border px-3 py-2" />
                    </label>
                  </div>
                  {metadataIssues.length > 0 && (
                    <div className="mt-3 grid gap-1 text-sm">
                      {metadataIssues.map((issue) => <p key={issue.message} className={issue.severity === "error" ? "text-red-600" : "text-amber-700"}>{issue.message}</p>)}
                    </div>
                  )}
                  <div className="mt-4 grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {renderImageControl("homepageIcon", "Homepage icon", "Square, 256 x 256")}
                    {renderImageControl("categoryImage", "Category image", "Square, 800 x 800")}
                    {renderImageControl("desktopBanner", "Desktop banner", "Wide landscape, 1600 x 500")}
                    {renderImageControl("mobileBanner", "Mobile banner", "Portrait/mobile, 900 x 1200")}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button onClick={saveMetadata} disabled={saving || !selectedNodeId || recordMismatch || metadataLoading || hasPendingImageUploads} className="bg-stone-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Save Metadata</button>
                    {hasPendingImageUploads && <span className="px-2 py-2 text-sm font-semibold text-amber-700">Image upload pending...</span>}
                    <button onClick={() => confirmAction("Activate selected item", () => runAction("updateEntity", { entityType: selectedNodeType, id: selectedNodeId, updates: { status: "ACTIVE" } }))} className="border px-4 py-2 text-sm font-semibold">Activate</button>
                    <button onClick={() => confirmAction("Deactivate selected item", () => runAction("updateEntity", { entityType: selectedNodeType, id: selectedNodeId, updates: { status: "INACTIVE" } }))} className="border px-4 py-2 text-sm font-semibold">Deactivate</button>
                    <button onClick={() => confirmAction("Archive selected item", () => runAction("updateEntity", { entityType: selectedNodeType, id: selectedNodeId, updates: { status: "ARCHIVED" } }))} className="border px-4 py-2 text-sm font-semibold">Archive</button>
                    {selectedNodeType === "category" && <select onChange={(event) => event.target.value && confirmAction("Merge category", () => runAction("mergeCategory", { sourceId: categoryId, targetId: event.target.value }))} className="border px-3 py-2 text-sm">
                      <option value="">Merge into...</option>
                      {categories.filter((category) => category.id !== categoryId).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                    </select>}
                    {selectedNodeType === "category" && <button onClick={() => confirmAction("Duplicate category", () => runAction("duplicateCategory", { id: categoryId }))} className="border px-4 py-2 text-sm font-semibold">Duplicate</button>}
                    <button onClick={() => confirmAction("Delete selected item", () => runAction("deleteEntity", { entityType: selectedNodeType, id: selectedNodeId, confirmed: true }))} className="border border-red-200 px-4 py-2 text-sm font-semibold text-red-600">Delete</button>
                  </div>
                  </>
                  )}
                </section>
              )}

              {(activeTab === "product-types" || expandAll) && (
                <section className="min-w-0 bg-white p-4 shadow-sm">
                  <h2 className="text-xl font-bold">Product Types</h2>
                  <p className="mt-2 rounded border border-blue-100 bg-blue-50 p-3 text-sm font-semibold text-blue-900">
                    Actual products are added by vendors from Vendor Product Upload, not from Category Management.
                  </p>
                  {selectedNodeType === "category" && (
                    <form onSubmit={createSubcategory} className="mt-3 grid gap-2 lg:max-w-xl">
                      <input value={newSubName} onChange={(event) => setNewSubName(event.target.value)} placeholder="Add subcategory" className="border px-3 py-2" />
                      <button className="border px-3 py-2 text-sm font-semibold">Add Subcategory</button>
                    </form>
                  )}
                  {selectedNodeType === "subcategory" && (
                    <form onSubmit={createLeaf} className="mt-3 grid gap-2 lg:max-w-xl">
                      <input value={newLeafName} onChange={(event) => setNewLeafName(event.target.value)} placeholder="Polo T-Shirts / Sports T-Shirts / Tank Tops" className="border px-3 py-2" />
                      <button className="border px-3 py-2 text-sm font-semibold">Add Product Type / Leaf</button>
                    </form>
                  )}
                  {selectedNodeType === "productType" && (
                    <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                      <p className="font-semibold">
                        {selectedNodeName || "This item"} is a Product Type. Select its parent subcategory {loadedParentName || "parent"} to add another Product Type.
                      </p>
                      {subcategoryId && (
                        <button
                          type="button"
                          onClick={() => applySelection("subcategory", subcategoryId, "product-types")}
                          className="mt-3 border border-amber-300 bg-white px-3 py-2 text-sm font-semibold"
                        >
                          Go to parent: {loadedParentName || "Parent subcategory"}
                        </button>
                      )}
                      <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                        {[
                          "Edit Metadata",
                          "Configure Specifications",
                          "Configure Variants",
                          "Configure Size Guide",
                          "Configure Business Rules",
                          "Configure Customer Filters",
                        ].map((action) => (
                          <span key={action} className="border bg-white px-3 py-2">{action}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <textarea data-field="productTypes" value={productTypeOptions} onChange={(event) => { setProductTypeOptions(event.target.value); markDirty(); }} placeholder="Template product type options, one per line" className="mt-4 h-40 w-full min-w-0 border p-3" />
                  <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {selectedCategory?.subcategories.map((subcategory) => (
                      <div key={subcategory.id} className="min-w-0 border p-3">
                        <p className="font-semibold">{subcategory.name}</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {subcategory.productTypes.map((leaf) => <span key={leaf.id} className="max-w-full truncate border px-2 py-1 text-xs">{leaf.name}</span>)}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {(activeTab === "specifications" || expandAll) && (
                <section className="min-w-0 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-xl font-bold">Specifications</h2>
                    <button onClick={addSpecField} className="border px-3 py-2 text-sm font-semibold">Add Specification</button>
                  </div>
                  <div className="mt-3 grid gap-3">
                    {specFields.map((field, index) => (
                      <div key={`${field.name}-${index}`} className="min-w-0 border p-3">
                        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                          <input data-field={field.name} value={field.name} onChange={(event) => { setSpecFields((fields) => fields.map((item, i) => i === index ? { ...item, name: event.target.value } : item)); markDirty(); }} placeholder="Name/key" className="min-w-0 border px-2 py-2" />
                          <input value={field.label} onChange={(event) => { setSpecFields((fields) => fields.map((item, i) => i === index ? { ...item, label: event.target.value } : item)); markDirty(); }} placeholder="Label" className="min-w-0 border px-2 py-2" />
                          <select value={field.fieldType} onChange={(event) => { setSpecFields((fields) => fields.map((item, i) => i === index ? { ...item, fieldType: event.target.value as SpecField["fieldType"] } : item)); markDirty(); }} className="border px-2 py-2">
                            {fieldTypes.map((type) => <option key={type}>{type}</option>)}
                          </select>
                          <input value={field.unit} onChange={(event) => { setSpecFields((fields) => fields.map((item, i) => i === index ? { ...item, unit: event.target.value } : item)); markDirty(); }} placeholder="Unit" className="min-w-0 border px-2 py-2" />
                          <input value={field.placeholder} onChange={(event) => { setSpecFields((fields) => fields.map((item, i) => i === index ? { ...item, placeholder: event.target.value } : item)); markDirty(); }} placeholder="Placeholder" className="min-w-0 border px-2 py-2 md:col-span-2" />
                          <textarea value={field.dropdownValues.join("\n")} onChange={(event) => { setSpecFields((fields) => fields.map((item, i) => i === index ? { ...item, dropdownValues: linesToList(event.target.value) } : item)); markDirty(); }} placeholder="Dropdown values" className="min-w-0 border p-2 md:col-span-2" />
                        </div>
                        <div className="mt-2 flex flex-wrap gap-3 text-xs">
                          {(["required", "customerVisible", "filterable", "searchable", "vendorEditable", "adminOnly"] as const).map((key) => (
                            <label key={key} className="flex items-center gap-1">
                              <input type="checkbox" checked={Boolean(field[key])} onChange={(event) => { setSpecFields((fields) => fields.map((item, i) => i === index ? { ...item, [key]: event.target.checked } : item)); markDirty(); }} />
                              {key}
                            </label>
                          ))}
                          <button onClick={() => { setSpecFields((fields) => fields.filter((_, i) => i !== index)); markDirty(); }} className="font-semibold text-red-600">Remove</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {(activeTab === "variants" || expandAll) && (
                <section className="min-w-0 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="text-xl font-bold">Variant Configuration</h2>
                      <p className="mt-1 text-sm text-stone-500">
                        Configure variant dimensions and validation. Actual stock, SKU, price, and image rows are entered by vendors.
                      </p>
                    </div>
                    <button onClick={addVariantDimension} className="border px-3 py-2 text-sm font-semibold">Add Dimension</button>
                  </div>
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-950">
                    Template Preview Only - Actual values will be entered by vendors. These examples are not product inventory, vendor stock, order stock, or live SKUs.
                  </div>

                  <div className="mt-4 grid gap-3">
                    {variantConfigForm.dimensions.map((dimension, index) => (
                      <div key={`${dimension.key}-${index}`} className="min-w-0 border p-3">
                        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                          <input value={dimension.label} onChange={(event) => updateVariantDimension(index, { label: event.target.value })} placeholder="Name, e.g. Size" className="min-w-0 border px-2 py-2" />
                          <input value={dimension.key} onChange={(event) => updateVariantDimension(index, { key: normalizeAtelierSlug(event.target.value).replace(/-/g, "_") })} placeholder="Key, e.g. size" className="min-w-0 border px-2 py-2" />
                          <select value={dimension.type} onChange={(event) => updateVariantDimension(index, { type: event.target.value as VariantDimensionConfig["type"] })} className="border px-2 py-2">
                            <option value="dropdown">Dropdown</option>
                            <option value="color">Colour Selector</option>
                            <option value="text">Text</option>
                            <option value="number">Number</option>
                          </select>
                          <textarea value={dimension.options.join("\n")} onChange={(event) => updateVariantDimension(index, { options: linesToList(event.target.value) })} placeholder="Allowed values, one per line" className="min-w-0 border p-2" />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-3 text-xs">
                          {(["required", "vendorEditable", "customerVisible", "filterable", "affectsSku", "affectsStock", "affectsPrice", "imageMapping"] as const).map((key) => (
                            <label key={key} className="flex items-center gap-1">
                              <input
                                type="checkbox"
                                checked={Boolean(dimension[key])}
                                onChange={(event) => updateVariantDimension(index, { [key]: event.target.checked } as Partial<VariantDimensionConfig>)}
                              />
                              {key}
                            </label>
                          ))}
                          <button
                            onClick={() => {
                              setVariantConfigForm((current) => ({
                                ...current,
                                dimensions: current.dimensions.filter((_, dimensionIndex) => dimensionIndex !== index),
                              }));
                              markDirty();
                            }}
                            className="font-semibold text-red-600"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6">
                    <h3 className="font-bold">Vendor Row Fields</h3>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {Object.entries(variantConfigForm.rowFields).map(([key, field]) => (
                        <div key={key} className="min-w-0 border p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold">{key}</p>
                            <label className="text-xs"><input type="checkbox" checked={field.enabled} onChange={(event) => updateVariantRowField(key, { enabled: event.target.checked })} /> Enabled</label>
                          </div>
                          <div className="mt-2 grid gap-2 text-xs md:grid-cols-2">
                            {(["required", "vendorEditable", "adminEditable", "customerVisible", "unique", "integer", "onlyOne"] as const).map((flag) => (
                              <label key={flag} className="flex items-center gap-1">
                                <input type="checkbox" checked={Boolean(field[flag])} onChange={(event) => updateVariantRowField(key, { [flag]: event.target.checked })} />
                                {flag}
                              </label>
                            ))}
                            <input value={field.min ?? ""} onChange={(event) => updateVariantRowField(key, { min: event.target.value === "" ? undefined : Number(event.target.value) })} placeholder="Minimum value" className="border px-2 py-2" />
                            <input value={field.max ?? ""} onChange={(event) => updateVariantRowField(key, { max: event.target.value === "" ? undefined : Number(event.target.value) })} placeholder="Maximum value" className="border px-2 py-2" />
                            <input value={String(field.default ?? "")} onChange={(event) => updateVariantRowField(key, { default: event.target.value })} placeholder="Default value" className="border px-2 py-2" />
                            <input value={field.unit || ""} onChange={(event) => updateVariantRowField(key, { unit: event.target.value })} placeholder="Unit" className="border px-2 py-2" />
                            <input value={field.validationMessage || ""} onChange={(event) => updateVariantRowField(key, { validationMessage: event.target.value })} placeholder="Validation message" className="border px-2 py-2 md:col-span-2" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 lg:grid-cols-2">
                    <div className="min-w-0">
                      <h3 className="font-bold">Combination Rules</h3>
                      <div className="mt-3 grid gap-2 text-sm">
                        {Object.entries(variantConfigForm.combinationRules).map(([key, value]) => (
                          <label key={key} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={Boolean(value)}
                              onChange={(event) => {
                                setVariantConfigForm((current) => ({
                                  ...current,
                                  combinationRules: {
                                    ...current.combinationRules,
                                    [key]: event.target.checked,
                                  },
                                }));
                                markDirty();
                              }}
                            />
                            {key}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold">Example Variant Preview</h3>
                      <p className="mt-1 text-xs font-semibold text-amber-800">Template Preview Only - Actual values will be entered by vendors.</p>
                      <textarea
                        value={variantConfigForm.examplePreview.map((row) => [row.size, row.color].filter(Boolean).join(" + ")).join("\n")}
                        onChange={(event) => {
                          setVariantConfigForm((current) => ({
                            ...current,
                            examplePreview: linesToList(event.target.value).map((line) => {
                              const [size = "", color = ""] = line.split("+").map((part) => part.trim());
                              return { size, color, label: line };
                            }),
                          }));
                          markDirty();
                        }}
                        className="mt-3 h-32 w-full border p-3 text-sm"
                        placeholder={"M + Navy Blue\nL + Navy Blue\nM + White"}
                      />
                    </div>
                  </div>
                </section>
              )}

              {(activeTab === "size-guide" || expandAll) && (
                <section className="min-w-0 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-xl font-bold">Size Guide</h2>
                    <button onClick={addSizeGuideRow} className="border px-3 py-2 text-sm font-semibold">Add Row</button>
                  </div>
                  <div className="mt-3 grid gap-3">
                    {sizeGuideRows.map((row, index) => (
                      <div key={row.id} className="grid min-w-0 gap-2 border p-3 md:grid-cols-3 xl:grid-cols-4">
                        <select value={row.guideType} onChange={(event) => { setSizeGuideRows((rows) => rows.map((item, i) => i === index ? { ...item, guideType: event.target.value } : item)); markDirty(); }} className="border px-2 py-2">
                          {guideTypes.map((type) => <option key={type}>{type}</option>)}
                        </select>
                        {(["india", "uk", "us", "eu", "chest", "waist", "hip", "length", "footLength", "ageGroup"] as const).map((key) => (
                          <input key={key} value={row[key]} onChange={(event) => { setSizeGuideRows((rows) => rows.map((item, i) => i === index ? { ...item, [key]: event.target.value } : item)); markDirty(); }} placeholder={key} className="min-w-0 border px-2 py-2" />
                        ))}
                        <button onClick={() => { setSizeGuideRows((rows) => rows.filter((_, i) => i !== index)); markDirty(); }} className="text-left text-sm font-semibold text-red-600">Remove</button>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {(activeTab === "business-rules" || expandAll) && (
                <section className="min-w-0 bg-white p-4 shadow-sm">
                  <h2 className="text-xl font-bold">Business Rules</h2>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label><input type="checkbox" checked={businessRules.returnAllowed} onChange={(event) => updateBusinessRules({ returnAllowed: event.target.checked })} /> Return allowed</label>
                    <label><input type="checkbox" checked={businessRules.nonReturnable} onChange={(event) => updateBusinessRules({ nonReturnable: event.target.checked })} /> Non-returnable</label>
                    <input disabled={businessRules.nonReturnable} value={businessRules.returnWindow} onChange={(event) => updateBusinessRules({ returnWindow: event.target.value })} placeholder="Return days" className="border px-3 py-2 disabled:bg-stone-100" />
                    <input value={businessRules.replacementWindow} onChange={(event) => updateBusinessRules({ replacementWindow: event.target.value })} placeholder="Replacement days" className="border px-3 py-2" />
                    <input disabled={businessRules.nonReturnable} value={businessRules.returnReasons} onChange={(event) => updateBusinessRules({ returnReasons: event.target.value })} placeholder="Return reasons" className="border px-3 py-2 disabled:bg-stone-100" />
                    <input value={businessRules.nonReturnableReason} onChange={(event) => updateBusinessRules({ nonReturnableReason: event.target.value })} placeholder="Non-returnable reason" className="border px-3 py-2" />
                    <label><input type="checkbox" checked={businessRules.openBoxDelivery} onChange={(event) => updateBusinessRules({ openBoxDelivery: event.target.checked })} /> Open-box delivery</label>
                    <label><input type="checkbox" checked={businessRules.fragile} onChange={(event) => updateBusinessRules({ fragile: event.target.checked })} /> Fragile</label>
                    <label><input type="checkbox" checked={businessRules.installationRequired} onChange={(event) => updateBusinessRules({ installationRequired: event.target.checked })} /> Installation required</label>
                    <input value={businessRules.installationDetails} onChange={(event) => updateBusinessRules({ installationDetails: event.target.value })} placeholder="Installation details" className="border px-3 py-2" />
                    <label><input type="checkbox" checked={businessRules.warrantyRequired} onChange={(event) => updateBusinessRules({ warrantyRequired: event.target.checked })} /> Warranty required</label>
                    <input value={businessRules.warrantyDuration} onChange={(event) => updateBusinessRules({ warrantyDuration: event.target.value })} placeholder="Warranty duration" className="border px-3 py-2" />
                    <input value={businessRules.minimumImageCount} onChange={(event) => updateBusinessRules({ minimumImageCount: event.target.value })} placeholder="Minimum image count" className="border px-3 py-2" />
                    <label><input type="checkbox" checked={businessRules.productVideoRequired} onChange={(event) => updateBusinessRules({ productVideoRequired: event.target.checked })} /> Product video required</label>
                  </div>
                </section>
              )}

              {(activeTab === "customer-filters" || expandAll) && (
                <section className="min-w-0 bg-white p-4 shadow-sm">
                  <h2 className="text-xl font-bold">Customer Filters</h2>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {specFields.map((field, index) => (
                      <label key={field.name || index} className="flex min-w-0 items-center gap-2 border p-2 text-sm">
                        <input type="checkbox" checked={field.filterable} onChange={(event) => { setSpecFields((fields) => fields.map((item, i) => i === index ? { ...item, filterable: event.target.checked } : item)); markDirty(); }} />
                        <span className="min-w-0 truncate">{field.label || field.name}</span>
                      </label>
                    ))}
                  </div>
                </section>
              )}

              {(activeTab === "preview" || expandAll) && (
                <section className="min-w-0 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-xl font-bold">Preview</h2>
                    <select value={previewMode} onChange={(event) => setPreviewMode(event.target.value)} className="border px-3 py-2">
                      <option>Vendor upload form</option>
                      <option>Customer product page</option>
                      <option>Customer filter preview</option>
                      <option>Mobile preview</option>
                    </select>
                  </div>
                  <div className={`mt-4 min-w-0 border bg-stone-50 p-4 ${previewMode === "Mobile preview" ? "mx-auto max-w-[360px]" : ""}`}>
                    {previewMode === "Vendor upload form" && specFields.map((field) => <input key={field.name} placeholder={field.placeholder || field.label} className="mt-2 block w-full min-w-0 border bg-white px-3 py-2" />)}
                    {previewMode === "Customer product page" && specFields.filter((field) => field.customerVisible).map((field) => <p key={field.name} className="break-words text-sm"><strong>{field.label}:</strong> {field.placeholder || "Configured value"}</p>)}
                    {previewMode === "Customer filter preview" && <div className="flex flex-wrap gap-2">{specFields.filter((field) => field.filterable).map((field) => <span key={field.name} className="max-w-full truncate border bg-white px-3 py-2 text-sm">{field.label}</span>)}</div>}
                    {previewMode === "Mobile preview" && variantConfigForm.examplePreview.slice(0, 3).map((row, index) => <div key={index} className="mb-2 border bg-white p-2 text-sm">{[row.size, row.color].filter(Boolean).join(" + ") || row.label || "Variant preview"}</div>)}
                  </div>
                  <div className="mt-6 grid gap-5 lg:grid-cols-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-bold">CSV tools</h3>
                        <button onClick={downloadMasterCsv} className="border px-3 py-2 text-sm font-semibold">Download master CSV</button>
                      </div>
                      <textarea value={csvText} onChange={(event) => setCsvText(event.target.value)} className="mt-3 h-32 w-full min-w-0 border p-3 text-sm" />
                      <button onClick={previewCsv} className="mt-3 bg-stone-950 px-3 py-2 text-sm font-semibold text-white">Preview CSV mapping</button>
                      <div className="mt-3 grid gap-2 text-sm">
                        {csvPreview.map((row, index) => <div key={index} className="min-w-0 break-words border p-2"><strong>{row.status}</strong> · {row.categoryName || row.row.categoryName || "Missing"} · {row.notes.join("; ")}</div>)}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold">Duplicate detection</h3>
                      <p className="mt-2 text-sm text-stone-500">Validation checks duplicate slugs, field keys, SKUs, and product type names before publish.</p>
                    </div>
                  </div>
                </section>
              )}

              {(activeTab === "audit-log" || expandAll) && (
                <section className="min-w-0 bg-white p-4 shadow-sm">
                  <h2 className="text-xl font-bold">Audit Log</h2>
                  <div className="mt-3 grid gap-2">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="min-w-0 break-words border p-2 text-sm">
                        <strong>{log.action}</strong> · {log.entityType} · {log.entityId || "n/a"} · {log.adminUser} · {new Date(log.createdAt).toLocaleString()}
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </section>

      {showUnsavedDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md bg-white p-5 shadow-xl">
            <h2 className="text-lg font-bold">You have unsaved changes.</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={async () => { if (await saveDraft()) { const pending = pendingSelectionRef.current; if (pending) applySelection(pending.nodeType, pending.nodeId, pending.tab || activeTab); setShowUnsavedDialog(false); } }} className="bg-stone-950 px-3 py-2 text-sm font-semibold text-white">Save and Continue</button>
              <button onClick={() => { const pending = pendingSelectionRef.current; setDirty(false); if (pending) applySelection(pending.nodeType, pending.nodeId, pending.tab || activeTab); setShowUnsavedDialog(false); }} className="border px-3 py-2 text-sm font-semibold">Discard Changes</button>
              <button onClick={() => setShowUnsavedDialog(false)} className="border px-3 py-2 text-sm font-semibold">Stay Here</button>
            </div>
          </div>
        </div>
      )}

      {validationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Validation summary</h2>
                <p className="text-sm text-stone-500">{validationIssues.filter((issue) => issue.severity === "error").length} errors must be resolved before publishing.</p>
              </div>
              <button onClick={() => setValidationModalOpen(false)} className="border px-3 py-1 text-sm">Close</button>
            </div>
            <div className="mt-4 grid gap-2">
              {(validationIssues.length ? validationIssues : publishIssues).map((issue) => (
                <button key={`${issue.tab}-${issue.field}-${issue.message}`} onClick={() => openIssue(issue)} className={`min-w-0 break-words border p-3 text-left text-sm ${issue.severity === "error" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}>
                  <strong>{tabLabels[issue.tab]}</strong>: {issue.message}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
