"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/navbar/Navbar";
import LanguageAssistPanel from "@/components/forms/LanguageAssistPanel";
import CategoryAtelierWorkspace from "@/components/admin/CategoryAtelierWorkspace";

type Subcategory = {
  id: string;
  name: string;
  slug: string;
  categoryId: string;
};

type Category = {
  id: string;
  name: string;
  slug: string;
  subcategories: Subcategory[];
};

type TemplateField = {
  name: string;
  label: string;
  placeholder: string;
  options?: string[];
  multiline?: boolean;
  required?: boolean;
};

type VariantExample = {
  sizeLabel: string;
  numericSize: string;
  color: string;
  sku: string;
  stockQuantity: string;
  price: string;
  mrp: string;
};

function linesToList(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function slugFieldKey(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

function normalizeTemplateField(field: TemplateField): TemplateField {
  const rawLabel = String(field.label || field.name || "").trim();
  const colonIndex = rawLabel.indexOf(":");
  const hasEmbeddedOptions = colonIndex > 0 && (!field.options || field.options.length === 0);
  const label = hasEmbeddedOptions ? rawLabel.slice(0, colonIndex).trim() : rawLabel;
  const embeddedOptions = hasEmbeddedOptions
    ? rawLabel
        .slice(colonIndex + 1)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

  return {
    name: slugFieldKey(label || field.name) || `field_${Date.now()}`,
    label: label || "Product Detail",
    placeholder: field.placeholder || `Select or enter ${label || "value"}`,
    options: (field.options || []).filter(Boolean).length
      ? (field.options || []).filter(Boolean)
      : embeddedOptions,
    multiline: Boolean(field.multiline),
    required: Boolean(field.required),
  };
}

function fieldsFromText(value: string): TemplateField[] {
  return linesToList(value).map((line) => {
    const [name = "", label = "", placeholder = "", options = "", multiline = ""] =
      line.split("|").map((part) => part.trim());

    return {
      name,
      label: label || name,
      placeholder,
      options: options
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      multiline: /yes|true|multi|multiline/i.test(multiline),
      required: false,
    };
  }).filter((field) => field.name && field.label);
}

function variantRowsFromText(value: string): VariantExample[] {
  return linesToList(value).map((line) => {
    const [
      sizeLabel = "",
      numericSize = "",
      color = "",
      sku = "",
      stockQuantity = "5",
      price = "",
      mrp = "",
    ] = line.split("|").map((part) => part.trim());

    return {
      sizeLabel,
      numericSize,
      color,
      sku,
      stockQuantity,
      price,
      mrp,
    };
  }).filter((row) => row.sizeLabel || row.numericSize || row.color);
}

function resolveTemplateFamily(value: string) {
  const segments = value
    .toLowerCase()
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
  const allText = segments.join(" ");

  const matchers = [
    { family: "baby", regex: /\b(baby|diaper|diapers|nappy|infant)\b/ },
    { family: "toy", regex: /\b(toy|toys|games|puzzle|doll|blocks)\b/ },
    { family: "bag", regex: /\b(bag|bags|backpack|handbag|purse|luggage|wallet|belt)\b/ },
    { family: "footwear", regex: /\b(shoe|shoes|footwear|sandal|sandals|slipper|slippers|sneaker|sneakers)\b/ },
    { family: "ethnic", regex: /\b(saree|sarees|lehenga|lehengas|kurti|kurtis|ethnic|blouse)\b/ },
    { family: "fashion", regex: /\b(fashion|shirt|shirts|t-shirt|tshirt|clothing|women|men|jeans|trouser|trousers|wear|jacket|blazer|suit)\b/ },
  ] as const;

  for (const segment of segments) {
    const isMixedParent = /&| and |,/.test(segment);
    if (segments.length > 1 && isMixedParent) continue;

    const match = matchers.find((item) => item.regex.test(segment));
    if (match) return match.family;
  }

  return matchers.find((item) => item.regex.test(allText))?.family || "general";
}

function defaultTemplateForCategory(name: string) {
  const family = resolveTemplateFamily(name);

  if (family === "baby") {
    return {
      productTypes:
        "Newborn Baby Diapers\nPant Style Diapers\nTape Style Diapers\nOvernight Diapers\nPremium Soft Diapers\nOrganic Baby Diapers\nSwimming Diapers\nTraining Pants\nBaby Diaper Combo Packs",
      specFields:
        "productType | Product Type | Select diaper type | Newborn Baby Diapers, Pant Style Diapers, Tape Style Diapers, Overnight Diapers, Premium Soft Diapers, Organic Baby Diapers, Swimming Diapers, Training Pants, Baby Diaper Combo Packs |\nsize | Size | Select diaper size | NB, S, M, L, XL, XXL, XXXL |\nweightRange | Baby Weight Range | Select baby weight range | Up to 5 kg, 4-8 kg, 6-11 kg, 9-14 kg, 12-17 kg, 15-25 kg, 20-35 kg |\npackQuantity | Pack Quantity | Select pieces in pack | 10 Pieces, 20 Pieces, 30 Pieces, 50 Pieces, 72 Pieces, 96 Pieces, 120 Pieces |\nmaterial | Material | Select material | Cotton Soft, Organic Cotton, Bamboo Fiber, Plant Based Material, Ultra Soft Fabric |\nabsorptionCapacity | Absorption Capacity | Select protection duration | 6 Hours, 8 Hours, 10 Hours, 12 Hours, 14 Hours, Overnight Protection |\nwetnessIndicator | Wetness Indicator | Select option | Yes, No |\nleakProtection | Leak Protection | Select protection type | Basic, Double Leak Guard, 360 Leak Protection, Leak Lock Technology, Overnight Leak Protection |\nantiRashProtection | Anti-Rash Protection | Select option | Yes, No, Aloe Vera, Vitamin E, Aloe Vera + Vitamin E |\nskinType | Skin Type | Select suitable skin type | Normal Skin, Sensitive Skin, Dry Skin, All Skin Types |\nnetWeight | Net Weight | Select packed weight | 250 g, 500 g, 750 g, 1 kg, 1.5 kg, 2 kg, 2.5 kg, 3 kg |\npackageType | Package Type | Select package type | Pack, Bag, Box, Combo Pack, Value Pack, Jumbo Pack |\nshelfLife | Shelf Life | Select shelf life | 12 Months, 18 Months, 24 Months, 36 Months |",
      variantRows:
        "NB | Up to 5 kg / 20 Pieces | White | NB-20 | 20 |  | \nS | 4-8 kg / 30 Pieces | White | S-30 | 20 |  | \nM | 6-11 kg / 50 Pieces | White | M-50 | 20 |  | \nL | 9-14 kg / 72 Pieces | White | L-72 | 20 |  | \nXL | 12-17 kg / 96 Pieces | White | XL-96 | 20 |  | ",
    };
  }

  if (family === "toy") {
    return {
      productTypes: "Educational toy\nRemote control toy\nToy car\nDoll\nBuilding blocks\nPuzzle\nBoard game\nSoft toy",
      specFields:
        "productType | Product Type | Select product type | Educational toy, Remote control toy, Toy car, Doll, Building blocks, Puzzle, Board game, Soft toy |\nsize | Age Group / Pack | Select age group | 0-2 years, 2-3 years, 3-5 years, 5-8 years, 8+ years, Pack of 1, Pack of 4 |\ndimensions | Toy Size / Pieces | Medium / 24 pcs / 20 x 10 x 8 cm | |\nmaterial | Material | Select material | Plastic, Wood, Soft fabric, Rubber, Metal, Non-toxic plastic, ABS plastic |\nfitment | Use / Skill / Safety Note | Indoor game / motor skills / non-toxic / adult supervision | | multiline\nbrandSizeMapping | Age & Variant Mapping | 2-3 years = medium toy; Pack of 4 = 4 small toys | | multiline",
      variantRows:
        "2-3 years | Medium | Multicolor | TOY-2-3Y | 6 |  | \n3-5 years | Large | Multicolor | TOY-3-5Y | 5 |  | \nPack of 1 | 1 toy | Car theme | TOY-CAR-1 | 4 |  | \nPack of 4 | 4 pcs | Blocks | TOY-BLOCKS-4 | 3 |  | ",
    };
  }

  if (family === "bag") {
    return {
      productTypes:
        "Handbag\nBackpack\nSchool bag\nTravel bag\nLaptop bag\nWallet\nBelt\nTrolley bag\nSling bag\nDuffel bag",
      specFields:
        "productType | Product Type | Select bag type | Handbag, Backpack, School bag, Travel bag, Laptop bag, Wallet, Belt, Trolley bag, Sling bag, Duffel bag |\nsize | Bag Size / Capacity | Select bag size/capacity | Small, Medium, Large, XL, 10 litre, 20 litre, 30 litre, 24 inch, 28 inch, 32 inch |\ndimensions | Dimensions | 30 x 12 x 42 cm | |\nmaterial | Outer Material | Select material | Genuine leather, Synthetic leather, Canvas, Polyester, Nylon, Denim, Cotton, PU |\nfitment | Capacity / Compartments / Closure | 20L capacity / 3 compartments / zip closure | | multiline\nbrandSizeMapping | Size Guide Mapping | Medium = 30 x 12 x 42 cm / 20L | | multiline",
      variantRows:
        "Small Bag | 24 x 10 x 34 cm | Black | BAG-S-BLK | 5 |  | \nMedium Bag | 30 x 12 x 42 cm | Black | BAG-M-BLK | 4 |  | \nLarge Bag | 36 x 15 x 48 cm | Black | BAG-L-BLK | 3 |  | ",
    };
  }

  if (family === "footwear") {
    return {
      productTypes: "Formal shoes\nSports shoes\nCasual shoes\nSandals\nSlippers\nSafety shoes\nSchool shoes\nSneakers",
      specFields:
        "productType | Product Type | Select product type | Formal shoes, Sports shoes, Casual shoes, Sandals, Slippers, Safety shoes, Sneakers |\nsize | Base UK / India Size | Select base size | UK 5, UK 6, UK 7, UK 8, UK 9, UK 10 |\ndimensions | Foot Length | 26 cm foot length | |\nmaterial | Upper / Sole Material | Select material | Genuine leather, Synthetic leather, Canvas, Mesh, Rubber, PU, EVA |\nfitment | Fit / Closure / Occasion | Regular fit / lace-up / formal wear | | multiline\nbrandSizeMapping | Size Guide Mapping | UK 7 = EU 41 = 26 cm foot length | | multiline",
      variantRows:
        "UK 6 | 25 cm | Black | UK6 | 4 |  | \nUK 7 | 26 cm | Black | UK7 | 5 |  | \nUK 8 | 27 cm | Black | UK8 | 3 |  | \nUK 9 | 28 cm | Black | UK9 | 3 |  | ",
    };
  }

  if (family === "ethnic") {
    return {
      productTypes:
        "Saree\nLehenga\nKurti\nBlouse\nDress Material\nDupatta\nEthnic Set\nGown",
      specFields:
        "productType | Product Type | Select ethnic product type | Saree, Lehenga, Kurti, Blouse, Dress Material, Dupatta, Ethnic Set, Gown |\nsize | Size / Stitch Type | Select size or stitch type | Free Size, XS, S, M, L, XL, XXL, 3XL, Unstitched, Semi-stitched, Readymade |\ndimensions | Length / Width | Saree 5.5 m + blouse 0.8 m / Lehenga waist and length | |\nmaterial | Fabric / Material | Select fabric | Silk, Cotton, Georgette, Chiffon, Net, Velvet, Rayon, Crepe, Organza, Polyester |\nfitment | Occasion / Work / Fit Note | Wedding wear / embroidered / regular fit | | multiline\nbrandSizeMapping | Size Guide Mapping | Free size = standard drape; M = 38 inch bust | | multiline",
      variantRows:
        "Free Size | Saree 5.5 m | Yellow | ETH-FREE-YEL | 5 |  | \nM | 38 inch bust | Pink | ETH-M-PNK | 4 |  | \nL | 40 inch bust | Pink | ETH-L-PNK | 3 |  | ",
    };
  }

  if (family === "fashion") {
    return {
      productTypes: "Shirt\nT-Shirt\nJeans\nTrousers\nKurti\nSaree\nLehenga\nDress\nJacket",
      specFields:
        "productType | Product Type | Select product type | Shirt, T-Shirt, Jeans, Trousers, Kurti, Saree, Lehenga, Dress |\nsize | Base Size / Fit | Select base size | XS, S, M, L, XL, XXL, 28, 30, 32, 34, 36 |\nchest | Chest / Bust | 38 inch / 96 cm | |\ndimensions | Length / Outseam | 28 inch shirt length / 40 inch trouser length | |\nsleeveLength | Sleeve / Shoulder | 24.5 inch sleeve / 17 inch shoulder | |\nmaterial | Fabric / Material | Select fabric | 100% cotton, Cotton blend, Rayon, Denim, Polyester, Lycra, Silk, Georgette |\nbrandSizeMapping | Brand Size Mapping | M = 38 inch chest, L = 40 inch chest | | multiline",
      variantRows:
        "S | 30 | Blue | S-30 | 4 |  | \nM | 32 | Blue | M-32 | 5 |  | \nL | 34 | Blue | L-34 | 2 |  | \nXL | 36 | Blue | XL-36 | 7 |  | ",
    };
  }

  return {
    productTypes: "Standard product\nPack product\nReplacement part\nAccessory",
    specFields:
      "productType | Product Type | Select product type | Standard product, Pack product, Replacement part, Accessory |\nsize | Size / Capacity | Standard / 500 ml / pack of 2 | |\ndimensions | Dimensions | Length x Width x Height if applicable | |\nmaterial | Material | Cotton / steel / plastic | |\nfitment | Compatibility / Usage | Use case, fitment or suitable for | | multiline",
    variantRows:
      "Standard | 1 piece | Default | STD-1 | 5 |  | ",
  };
}

const starterPlan = [
  {
    name: "Women Ethnic",
    subcategories: ["Sarees", "Kurtis", "Lehengas", "Dress Materials"],
  },
  {
    name: "Men Fashion",
    subcategories: ["Shirts", "T-Shirts", "Jeans", "Footwear"],
  },
  {
    name: "Beauty & Personal Care",
    subcategories: ["Makeup", "Skin Care", "Hair Care", "Fragrance"],
  },
  {
    name: "Home & Kitchen",
    subcategories: ["Decor", "Cookware", "Storage", "Furniture"],
  },
  {
    name: "Hardware",
    subcategories: ["Hand Tools", "Fasteners", "Door Hardware", "Safety Gear"],
  },
  {
    name: "AC Parts",
    subcategories: ["Compressors", "Cooling Coils", "Capacitors", "Remote Controls"],
  },
  {
    name: "Washing Machine Parts",
    subcategories: ["Motors", "Belts", "Drain Pumps", "Inlet Valves"],
  },
  {
    name: "Home Bathroom Fitting",
    subcategories: ["Faucets", "Showers", "Health Faucets", "Drainage Fittings"],
  },
  {
    name: "Electric Fitting",
    subcategories: ["Switches", "Sockets", "Wires", "MCB & Distribution"],
  },
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LegacyAdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryName, setCategoryName] = useState("");
  const [subcategoryName, setSubcategoryName] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [templateCategoryId, setTemplateCategoryId] = useState("");
  const [templateSubcategoryId, setTemplateSubcategoryId] = useState("");
  const [templateProductTypes, setTemplateProductTypes] = useState("");
  const [templateSpecTitle, setTemplateSpecTitle] = useState("Category Specifications");
  const [templateSpecHelp, setTemplateSpecHelp] = useState("Add product details needed for this category.");
  const [templateSpecFields, setTemplateSpecFields] = useState<TemplateField[]>([]);
  const [templateVariantTitle, setTemplateVariantTitle] = useState("Variant, Option & Stock Rows");
  const [templateVariantNote, setTemplateVariantNote] = useState("Add rows for selectable options and stock differences.");
  const [templateVariantRows, setTemplateVariantRows] = useState<VariantExample[]>([]);
  const [templateSizeChart, setTemplateSizeChart] = useState("");
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateSaving, setTemplateSaving] = useState(false);

  const templateCategory = categories.find((category) => category.id === templateCategoryId);
  const templateSubcategoryOptions = templateCategory?.subcategories || [];

  const totalSubcategories = useMemo(
    () =>
      categories.reduce(
        (total, category) => total + category.subcategories.length,
        0
      ),
    [categories]
  );

  async function loadCategories() {
    setLoading(true);
    try {
      const response = await fetch("/api/categories?fresh=1", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Could not load categories.");
        return;
      }

      setCategories(data.categories || []);
    } catch {
      setMessage("Could not connect to the category service.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCategories();
  }, []);

  async function createCategory(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    setSaving(true);

    const response = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: categoryName }),
    });

    const data = await response.json();
    setSaving(false);

    if (!response.ok) {
      setMessage(data.error || "Could not add category.");
      return;
    }

    setCategoryName("");
    setMessage("Category added.");
    loadCategories();
  }

  async function createSubcategory(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    setSaving(true);

    const response = await fetch("/api/subcategories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: subcategoryName,
        categoryId: selectedCategoryId,
      }),
    });

    const data = await response.json();
    setSaving(false);

    if (!response.ok) {
      setMessage(data.error || "Could not add subcategory.");
      return;
    }

    setSubcategoryName("");
    setMessage("Subcategory added.");
    loadCategories();
  }

  async function deleteCategory(categoryId: string) {
    if (!confirm("Remove this category and its subcategories? Products will be uncategorized.")) {
      return;
    }

    await fetch(`/api/categories/${categoryId}`, { method: "DELETE" });
    loadCategories();
  }

  async function deleteSubcategory(subcategoryId: string) {
    if (!confirm("Remove this subcategory? Products will keep their main category.")) {
      return;
    }

    await fetch(`/api/subcategories/${subcategoryId}`, { method: "DELETE" });
    loadCategories();
  }

  function applySmartTemplate() {
    const templateSubcategory = templateSubcategoryOptions.find(
      (item) => item.id === templateSubcategoryId,
    );
    const displayName = [templateCategory?.name, templateSubcategory?.name]
      .filter(Boolean)
      .join(" / ");
    const templateSubject = [templateSubcategory?.name, templateCategory?.name]
      .filter(Boolean)
      .join(" / ");
    const defaults = defaultTemplateForCategory(templateSubject || "general");

    setTemplateProductTypes(defaults.productTypes);
    setTemplateSpecFields(
      fieldsFromText(defaults.specFields).map(normalizeTemplateField),
    );
    setTemplateVariantRows(variantRowsFromText(defaults.variantRows));
    setTemplateSpecTitle(`${displayName || "Category"} Specifications`);
    setTemplateSpecHelp("Vendor will see these category-wise fields while adding products.");
    setTemplateVariantTitle(`${displayName || "Category"} Variants & Stock`);
    setTemplateVariantNote("Vendor will add selectable variant rows from these examples.");
  }

  async function loadTemplate() {
    if (!templateCategoryId) {
      setMessage("Select a category first.");
      return;
    }

    setTemplateLoading(true);
    setMessage("");

    const query = new URLSearchParams({ categoryId: templateCategoryId });
    if (templateSubcategoryId) {
      query.set("subcategoryId", templateSubcategoryId);
    }

    try {
      query.set("fresh", "1");
      const response = await fetch(`/api/category-templates?${query.toString()}`, {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Could not load template.");
        return;
      }

      if (!data.template) {
        applySmartTemplate();
        setMessage("No saved template found. Smart default loaded; edit and save it.");
        return;
      }

      setTemplateProductTypes((data.template.productTypes || []).join("\n"));
      setTemplateSpecTitle(data.template.specTemplate?.title || "Category Specifications");
      setTemplateSpecHelp(data.template.specTemplate?.helpText || "");
      setTemplateSpecFields(
        (data.template.specTemplate?.fields || []).map(normalizeTemplateField),
      );
      setTemplateVariantTitle(data.template.variantConfig?.title || "Variant, Option & Stock Rows");
      setTemplateVariantNote(data.template.variantConfig?.note || "");
      setTemplateVariantRows(data.template.variantConfig?.examples || []);
      setTemplateSizeChart(data.template.sizeChart || "");
      setMessage("Saved template loaded.");
    } catch {
      setMessage("Could not connect to template service.");
    } finally {
      setTemplateLoading(false);
    }
  }

  async function saveTemplate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!templateCategoryId) {
      setMessage("Select a category first.");
      return;
    }

    setTemplateSaving(true);
    setMessage("");

    const response = await fetch("/api/category-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoryId: templateCategoryId,
        subcategoryId: templateSubcategoryId || null,
        productTypes: linesToList(templateProductTypes),
        specTemplate: {
          title: templateSpecTitle,
          helpText: templateSpecHelp,
          fields: templateSpecFields.map(normalizeTemplateField),
        },
        variantConfig: {
          title: templateVariantTitle,
          note: templateVariantNote,
          selectedStyle: "Admin managed category template",
          sizeLabelHeading: "Size / Option",
          sizeLabelPlaceholder: "S / UK 7 / Pack of 2",
          numericSizeHeading: "Detail",
          numericSizePlaceholder: "32 / 26 cm / 500 ml",
          colorHeading: "Color / Type",
          colorPlaceholder: "Blue / Default",
          skuHeading: "Variant SKU",
          skuPlaceholder: "VAR-1",
          defaultSizePlaceholder: "Default size / capacity / option",
          availableSizesPlaceholder: "Available sizes/options from template",
          brandMappingPlaceholder: "Size chart or brand mapping",
          examples: templateVariantRows.map((row) => ({
            ...row,
            stockQuantity: String(row.stockQuantity || "").replace(/[^\d]/g, "") || "0",
          })),
        },
        sizeChart: templateSizeChart,
      }),
    });

    const data = await response.json();
    setTemplateSaving(false);

    if (!response.ok) {
      setMessage(data.error || "Template could not be saved.");
      return;
    }

    setMessage("Product upload template saved. Vendor upload will use it now.");
  }

  function addSpecificationField() {
    setTemplateSpecFields((fields) => [
      ...fields,
      {
        name: `field_${fields.length + 1}`,
        label: "",
        placeholder: "",
        options: [],
        multiline: false,
        required: false,
      },
    ]);
  }

  function updateSpecificationField(
    index: number,
    updates: Partial<TemplateField>,
  ) {
    setTemplateSpecFields((fields) =>
      fields.map((field, fieldIndex) => {
        if (fieldIndex !== index) return field;
        return { ...field, ...updates };
      }),
    );
  }

  function removeSpecificationField(index: number) {
    setTemplateSpecFields((fields) =>
      fields.filter((_, fieldIndex) => fieldIndex !== index),
    );
  }

  function addVariantExample() {
    setTemplateVariantRows((rows) => [
      ...rows,
      {
        sizeLabel: "",
        numericSize: "",
        color: "",
        sku: "",
        stockQuantity: "0",
        price: "",
        mrp: "",
      },
    ]);
  }

  function updateVariantExample(
    index: number,
    field: keyof VariantExample,
    value: string,
  ) {
    setTemplateVariantRows((rows) =>
      rows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row,
      ),
    );
  }

  function removeVariantExample(index: number) {
    setTemplateVariantRows((rows) =>
      rows.filter((_, rowIndex) => rowIndex !== index),
    );
  }

  function applyAdminLanguageFix(fieldKey: string, value: string) {
    if (fieldKey === "categoryName") setCategoryName(value);
    if (fieldKey === "subcategoryName") setSubcategoryName(value);
    if (fieldKey === "templateProductTypes") setTemplateProductTypes(value);
    if (fieldKey === "templateSizeChart") setTemplateSizeChart(value);
    if (fieldKey === "templateSpecHelp") setTemplateSpecHelp(value);
    if (fieldKey === "templateVariantNote") setTemplateVariantNote(value);
  }

  return (
    <main className="min-h-screen bg-[#f7f2ea] text-stone-950">
      <Navbar />

      <section className="border-b border-stone-200 bg-[#17130f] text-[#f8efe2]">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 md:flex-row md:items-end md:justify-between">
          <div>
            <Link href="/admin/dashboard" className="text-sm text-[#d6b36a]">
              Back to Admin Dashboard
            </Link>
            <h1 className="mt-3 text-4xl font-bold">Category Atelier</h1>
            <p className="mt-2 max-w-2xl text-sm text-[#d8c8af]">
              Build a Meesho-style catalogue tree with fashion, home, hardware,
              AC parts, washing machine parts, bathroom fittings, and electric
              fittings.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="border border-[#d6b36a]/40 px-5 py-4">
              <p className="text-3xl font-bold text-[#d6b36a]">
                {categories.length}
              </p>
              <p className="text-xs uppercase tracking-[0.2em]">Categories</p>
            </div>
            <div className="border border-[#d6b36a]/40 px-5 py-4">
              <p className="text-3xl font-bold text-[#d6b36a]">
                {totalSubcategories}
              </p>
              <p className="text-xs uppercase tracking-[0.2em]">Subcategories</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 lg:grid-cols-[380px_1fr]">
        <aside className="space-y-5">
          <form onSubmit={createCategory} className="bg-white p-5 shadow">
            <h2 className="text-xl font-bold">Add Category</h2>
            <input
              value={categoryName}
              onChange={(event) => setCategoryName(event.target.value)}
              placeholder="Example: Hardware"
              className="mt-4 w-full border border-stone-300 px-4 py-3 outline-none focus:border-[#9c7a34]"
              required
            />
            <button
              disabled={saving}
              className="mt-4 w-full bg-[#17130f] px-4 py-3 font-semibold text-white disabled:opacity-60"
            >
              Add Category
            </button>
          </form>

          <form onSubmit={createSubcategory} className="bg-white p-5 shadow">
            <h2 className="text-xl font-bold">Add Subcategory</h2>
            <select
              value={selectedCategoryId}
              onChange={(event) => setSelectedCategoryId(event.target.value)}
              className="mt-4 w-full border border-stone-300 px-4 py-3 outline-none focus:border-[#9c7a34]"
              required
            >
              <option value="">Select Category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <input
              value={subcategoryName}
              onChange={(event) => setSubcategoryName(event.target.value)}
              placeholder="Example: Compressors"
              className="mt-4 w-full border border-stone-300 px-4 py-3 outline-none focus:border-[#9c7a34]"
              required
            />
            <button
              disabled={saving}
              className="mt-4 w-full bg-[#9c7a34] px-4 py-3 font-semibold text-white disabled:opacity-60"
            >
              Add Subcategory
            </button>
          </form>

          {message && (
            <p className="bg-white px-4 py-3 text-sm text-stone-700 shadow">
              {message}
            </p>
          )}

          <LanguageAssistPanel
            title="Admin Language Solver"
            fields={[
              { key: "categoryName", label: "Category Name", value: categoryName },
              { key: "subcategoryName", label: "Subcategory Name", value: subcategoryName },
            ]}
            onApply={applyAdminLanguageFix}
          />
        </aside>

        <div className="space-y-6">
          <form onSubmit={saveTemplate} className="bg-white p-5 shadow">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">Product Upload Template</h2>
                <p className="mt-1 text-sm text-stone-500">
                  Category-wise dropdowns, size/spec fields and variant stock rows for vendor product upload.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={applySmartTemplate}
                  className="border border-[#9c7a34] px-4 py-2 text-sm font-semibold text-[#6f541f]"
                >
                  Load Smart Default
                </button>
                <button
                  type="button"
                  onClick={loadTemplate}
                  disabled={templateLoading}
                  className="border border-stone-300 px-4 py-2 text-sm font-semibold disabled:opacity-60"
                >
                  {templateLoading ? "Loading..." : "Load Saved"}
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 md:grid-cols-4">
              <div>
                <p className="font-bold">1. Select</p>
                <p>Choose exact category and subcategory, e.g. Bags & Footwear / Women Footwear.</p>
              </div>
              <div>
                <p className="font-bold">2. Smart Default</p>
                <p>Load a matching starter template, then edit options as needed.</p>
              </div>
              <div>
                <p className="font-bold">3. Add Fields</p>
                <p>Use dropdown fields for sizes, material, type, weight, age group and other specs.</p>
              </div>
              <div>
                <p className="font-bold">4. Save</p>
                <p>Vendor upload will show only this saved template for the selected category path.</p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <select
                value={templateCategoryId}
                onChange={(event) => {
                  setTemplateCategoryId(event.target.value);
                  setTemplateSubcategoryId("");
                }}
                className="border border-stone-300 px-4 py-3 outline-none focus:border-[#9c7a34]"
                required
              >
                <option value="">Select category for template</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>

              <select
                value={templateSubcategoryId}
                onChange={(event) => setTemplateSubcategoryId(event.target.value)}
                className="border border-stone-300 px-4 py-3 outline-none focus:border-[#9c7a34]"
                disabled={!templateCategoryId}
              >
                <option value="">Whole category template</option>
                {templateSubcategoryOptions.map((subcategory) => (
                  <option key={subcategory.id} value={subcategory.id}>
                    {subcategory.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs font-semibold text-slate-600">
              {templateSubcategoryId
                ? "You are editing an exact subcategory template. Vendors selecting this subcategory will see these fields first."
                : "You are editing a whole-category fallback template. Use this only for common fields; create separate subcategory templates when Bags, Footwear, Toys, Diapers, etc. need different fields."}
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <label className="block">
                <span className="text-sm font-bold">Product Type Dropdown Options</span>
                <textarea
                  value={templateProductTypes}
                  onChange={(event) => setTemplateProductTypes(event.target.value)}
                  placeholder={"Toy car\nPuzzle\nBlocks\nSoft toy"}
                  className="mt-2 h-36 w-full border border-stone-300 p-3 text-sm outline-none focus:border-[#9c7a34]"
                />
                <span className="text-xs text-stone-500">One option per line.</span>
              </label>

              <label className="block">
                <span className="text-sm font-bold">Size Guide / Extra Note</span>
                <textarea
                  value={templateSizeChart}
                  onChange={(event) => setTemplateSizeChart(event.target.value)}
                  placeholder="Example: 2-3 years = medium toy; UK 7 = EU 41 = 26 cm foot length"
                  className="mt-2 h-36 w-full border border-stone-300 p-3 text-sm outline-none focus:border-[#9c7a34]"
                />
                <span className="text-xs text-stone-500">This appears as template guidance for vendor/admin reference.</span>
              </label>
            </div>

            <div className="mt-5">
              <LanguageAssistPanel
                title="Template Language Solver"
                fields={[
                  {
                    key: "templateProductTypes",
                    label: "Product Type Options",
                    value: templateProductTypes,
                  },
                  {
                    key: "templateSizeChart",
                    label: "Size Guide / Extra Note",
                    value: templateSizeChart,
                  },
                  {
                    key: "templateSpecHelp",
                    label: "Specification Help Text",
                    value: templateSpecHelp,
                  },
                  {
                    key: "templateVariantNote",
                    label: "Variant Note",
                    value: templateVariantNote,
                  },
                ]}
                onApply={applyAdminLanguageFix}
              />
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <input
                value={templateSpecTitle}
                onChange={(event) => setTemplateSpecTitle(event.target.value)}
                placeholder="Spec section title"
                className="border border-stone-300 px-4 py-3 outline-none focus:border-[#9c7a34]"
              />
              <input
                value={templateVariantTitle}
                onChange={(event) => setTemplateVariantTitle(event.target.value)}
                placeholder="Variant section title"
                className="border border-stone-300 px-4 py-3 outline-none focus:border-[#9c7a34]"
              />
            </div>

            <section className="mt-6 border-t border-stone-200 pt-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold">Specification Fields</h3>
                  <p className="mt-1 text-sm text-stone-500">
                    Create the exact fields the vendor must fill for this category.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addSpecificationField}
                  className="bg-[#9c7a34] px-4 py-2 text-sm font-semibold text-white"
                >
                  Add Specification
                </button>
              </div>

              <textarea
                value={templateSpecHelp}
                onChange={(event) => setTemplateSpecHelp(event.target.value)}
                placeholder="Short instructions shown above these fields to the vendor"
                className="mt-4 h-20 w-full border border-stone-300 p-3 text-sm outline-none focus:border-[#9c7a34]"
              />

              <div className="mt-4 space-y-3">
                {templateSpecFields.length === 0 ? (
                  <div className="border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">
                    No specification fields yet. Use Smart Default or Add Specification.
                  </div>
                ) : (
                  templateSpecFields.map((field, index) => {
                    const inputType = field.multiline
                      ? "textarea"
                      : field.options?.length
                        ? "dropdown"
                        : "text";

                    return (
                      <div key={`spec-field-${index}`} className="border border-stone-200 bg-stone-50 p-4">
                        <div className="grid gap-3 md:grid-cols-[1.1fr_0.8fr_1.2fr_auto]">
                          <label className="grid gap-1 text-xs font-bold text-stone-600">
                            Field Label
                            <input
                              value={field.label}
                              onChange={(event) =>
                                updateSpecificationField(index, { label: event.target.value })
                              }
                              placeholder="Example: Weight Range"
                              className="border border-stone-300 bg-white px-3 py-2 text-sm font-normal text-stone-950"
                            />
                          </label>
                          <label className="grid gap-1 text-xs font-bold text-stone-600">
                            Input Type
                            <select
                              value={inputType}
                              onChange={(event) => {
                                const type = event.target.value;
                                updateSpecificationField(index, {
                                  multiline: type === "textarea",
                                  options:
                                    type === "dropdown"
                                      ? field.options?.length
                                        ? field.options
                                        : ["Option 1", "Option 2"]
                                      : [],
                                });
                              }}
                              className="border border-stone-300 bg-white px-3 py-2 text-sm font-normal text-stone-950"
                            >
                              <option value="text">Text / Number</option>
                              <option value="dropdown">Dropdown</option>
                              <option value="textarea">Long Text</option>
                            </select>
                          </label>
                          <label className="grid gap-1 text-xs font-bold text-stone-600">
                            Placeholder / Help
                            <input
                              value={field.placeholder}
                              onChange={(event) =>
                                updateSpecificationField(index, {
                                  placeholder: event.target.value,
                                })
                              }
                              placeholder="Example: Select baby weight range"
                              className="border border-stone-300 bg-white px-3 py-2 text-sm font-normal text-stone-950"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => removeSpecificationField(index)}
                            className="self-end border border-red-200 px-3 py-2 text-sm font-semibold text-red-600"
                            aria-label={`Remove ${field.label || "field"}`}
                          >
                            Remove
                          </button>
                        </div>

                        {inputType === "dropdown" && (
                          <label className="mt-3 grid gap-1 text-xs font-bold text-stone-600">
                            Dropdown Options
                            <textarea
                              value={(field.options || []).join("\n")}
                              onChange={(event) =>
                                updateSpecificationField(index, {
                                  options: linesToList(event.target.value),
                                })
                              }
                              placeholder={"One option per line\nExample: 0-5 kg\n4-8 kg\n6-11 kg"}
                              className="h-28 border border-stone-300 bg-white p-3 text-sm font-normal text-stone-950"
                            />
                          </label>
                        )}

                        <label className="mt-3 flex items-center gap-2 text-sm font-semibold">
                          <input
                            type="checkbox"
                            checked={Boolean(field.required)}
                            onChange={(event) =>
                              updateSpecificationField(index, {
                                required: event.target.checked,
                              })
                            }
                          />
                          Required before product submission
                        </label>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            <section className="mt-6 border-t border-stone-200 pt-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold">Variant Example Rows</h3>
                  <p className="mt-1 text-sm text-stone-500">
                    These become ready-to-use size, color, stock and price rows for vendors.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addVariantExample}
                  className="bg-[#17130f] px-4 py-2 text-sm font-semibold text-white"
                >
                  Add Variant Row
                </button>
              </div>

              <textarea
                value={templateVariantNote}
                onChange={(event) => setTemplateVariantNote(event.target.value)}
                placeholder="Short instructions shown above variant rows"
                className="mt-4 h-20 w-full border border-stone-300 p-3 text-sm outline-none focus:border-[#9c7a34]"
              />

              <div className="mt-4 overflow-x-auto">
                <div className="min-w-[980px]">
                  <div className="grid grid-cols-[1fr_1.1fr_1fr_1fr_90px_100px_100px_70px] gap-2 bg-stone-100 px-3 py-2 text-xs font-bold uppercase text-stone-600">
                    <span>Size / Option</span>
                    <span>Detail</span>
                    <span>Color / Type</span>
                    <span>SKU Suffix</span>
                    <span>Stock</span>
                    <span>Price</span>
                    <span>MRP</span>
                    <span />
                  </div>
                  <div className="space-y-2 pt-2">
                    {templateVariantRows.map((row, index) => (
                      <div
                        key={`${row.sku}-${index}`}
                        className="grid grid-cols-[1fr_1.1fr_1fr_1fr_90px_100px_100px_70px] gap-2 border border-stone-200 p-3"
                      >
                        {(
                          [
                            ["sizeLabel", "S / UK 7 / Pack of 2"],
                            ["numericSize", "32 / 26 cm / 500 ml"],
                            ["color", "Blue / Pants / Default"],
                            ["sku", "BLUE-M"],
                            ["stockQuantity", "5"],
                            ["price", "499"],
                            ["mrp", "799"],
                          ] as Array<[keyof VariantExample, string]>
                        ).map(([fieldName, placeholder]) => (
                          <input
                            key={fieldName}
                            type={["stockQuantity", "price", "mrp"].includes(fieldName) ? "number" : "text"}
                            value={row[fieldName]}
                            onChange={(event) =>
                              updateVariantExample(index, fieldName, event.target.value)
                            }
                            placeholder={placeholder}
                            className="min-w-0 border border-stone-300 px-2 py-2 text-sm"
                          />
                        ))}
                        <button
                          type="button"
                          onClick={() => removeVariantExample(index)}
                          className="text-xs font-semibold text-red-600"
                          aria-label="Remove variant row"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    {templateVariantRows.length === 0 && (
                      <div className="border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">
                        No example rows yet. Add the normal options vendors should start with.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <div className="mt-5 flex justify-end">
              <button
                disabled={templateSaving}
                className="bg-[#17130f] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {templateSaving ? "Saving Template..." : "Save Upload Template"}
              </button>
            </div>
          </form>

          <section className="bg-white p-5 shadow">
            <h2 className="text-xl font-bold">Suggested Category Plan</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {starterPlan.map((item) => (
                <div key={item.name} className="border border-stone-200 p-4">
                  <p className="font-semibold">{item.name}</p>
                  <p className="mt-2 text-sm text-stone-500">
                    {item.subcategories.join(" / ")}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white p-5 shadow">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold">Live Category Tree</h2>
              <button
                onClick={loadCategories}
                className="border border-stone-300 px-4 py-2 text-sm font-semibold"
              >
                Refresh
              </button>
            </div>

            {loading ? (
              <p className="py-10 text-center text-stone-500">Loading...</p>
            ) : (
              <div className="mt-4 space-y-4">
                {categories.map((category) => (
                  <div key={category.id} className="border border-stone-200">
                    <div className="flex items-center justify-between gap-4 border-b border-stone-200 bg-stone-50 px-4 py-3">
                      <div>
                        <p className="font-semibold">{category.name}</p>
                        <p className="text-xs text-stone-500">{category.slug}</p>
                      </div>
                      <button
                        onClick={() => deleteCategory(category.id)}
                        className="border border-red-200 px-3 py-2 text-sm font-semibold text-red-600"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="grid gap-2 p-4 md:grid-cols-2 xl:grid-cols-3">
                      {category.subcategories.length === 0 ? (
                        <p className="text-sm text-stone-500">
                          No subcategories yet.
                        </p>
                      ) : (
                        category.subcategories.map((subcategory) => (
                          <div
                            key={subcategory.id}
                            className="flex items-center justify-between gap-3 bg-[#f7f2ea] px-3 py-2 text-sm"
                          >
                            <span>{subcategory.name}</span>
                            <button
                              onClick={() => deleteSubcategory(subcategory.id)}
                              className="text-xs font-semibold text-red-600"
                            >
                              Remove
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}

export default function AdminCategoriesPage() {
  return <CategoryAtelierWorkspace />;
}
