"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/navbar/Navbar";
import FileUploadField from "@/components/forms/FileUploadField";
import LanguageAssistPanel from "@/components/forms/LanguageAssistPanel";
import VendorSpecificationField from "@/components/forms/VendorSpecificationField";
import {
  normalizeVendorSpecField,
  missingRequiredSpecification,
  vendorCanEditSpecification,
  vendorSpecificationLines,
  type VendorSpecField as SpecField,
} from "@/lib/vendor-specifications";
import { useVendorProductTypeSpecifications, vendorSpecificationScopeKey } from "@/lib/vendor-product-type-specifications";
import { applianceCategoryTree } from "@/data/category-tree";
import {
  PACKAGE_SIZE_OPTIONS,
  calculateMarketplacePricing,
  formatRupees,
} from "@/lib/pricing";
import { parseBulkProductCsv } from "@/lib/bulk-product-csv";
import { resolveBulkCategory } from "@/lib/bulk-category-resolver";
import {
  generateVariantCombinations,
  normalizeStructuredVariantConfig,
  validateVendorVariantRows,
  type StructuredVariantConfig,
} from "@/lib/category-variant-config";

type Category = {
  id: string;
  name: string;
  subcategories?: Subcategory[];
};

type PersistedProductType = { id: string; name: string; subcategoryId: string };

type Subcategory = {
  id: string;
  name: string;
  categoryId: string;
  productTypes?: PersistedProductType[];
};

type VendorUser = {
  role: "CUSTOMER" | "VENDOR" | "ADMIN";
  vendorProfile?: {
    status?: "PENDING" | "APPROVED" | "REJECTED" | "INACTIVE";
    rejectionReason?: string | null;
  } | null;
};

type UploadMode = "home" | "single" | "bulk";
type SingleStep = "images" | "basic" | "specs" | "variants" | "final";

type VariantFormRow = {
  id: string;
  sizeLabel: string;
  numericSize: string;
  color: string;
  sku: string;
  barcode: string;
  stockQuantity: string;
  price: string;
  vendorPrice: string;
  mrp: string;
  imageUrl: string;
  lowStockThreshold: string;
  weight: string;
  active: boolean;
  isDefault: boolean;
  selected: boolean;
};

type VariantExample = Partial<Omit<VariantFormRow, "id">> & {
  size?: string;
  label?: string;
};

type VariantFieldConfig = {
  title: string;
  note: string;
  selectedStyle: string;
  sizeLabelHeading: string;
  sizeLabelPlaceholder: string;
  numericSizeHeading: string;
  numericSizePlaceholder: string;
  colorHeading: string;
  colorPlaceholder: string;
  skuHeading: string;
  skuPlaceholder: string;
  defaultSizePlaceholder: string;
  availableSizesPlaceholder: string;
  brandMappingPlaceholder: string;
  examples: VariantExample[];
  dimensions?: StructuredVariantConfig["dimensions"];
  rowFields?: StructuredVariantConfig["rowFields"];
  combinationRules?: StructuredVariantConfig["combinationRules"];
  examplePreview?: StructuredVariantConfig["examplePreview"];
};

type BulkProductRow = {
  rowNumber: number;
  name: string;
  description: string;
  categoryName: string;
  subcategoryName: string;
  brand: string;
  sku: string;
  mrp: string;
  vendorPrice: string;
  stock: string;
  color: string;
  sizeLabel: string;
  numericSize: string;
  variantSku: string;
  imageUrls: string[];
  status: "READY" | "ERROR" | "CREATED";
  message: string;
  productId?: string;
};

type SpecTemplate = {
  title: string;
  helpText: string;
  fields: SpecField[];
};

type ManagedUploadTemplate = {
  productTypes?: string[];
  specTemplate?: SpecTemplate;
  variantConfig?: VariantFieldConfig;
  sizeChart?: string;
};

const imageRules = [
  "Front image should clearly show the product.",
  "No watermark, price text, fake brand logo or blurred image.",
  "Use clean background and avoid props that hide the product.",
  "Upload extra images for packaging, usage, size and close-up details.",
];

const blockedImageTypes = [
  "Watermark image",
  "Image with price",
  "Blur / unclear image",
  "Stretched / shrunk image",
  "Fake branded / first-copy image",
  "Image with heavy text",
];

const bulkTemplateHeaders = [
  "Product Name",
  "Description",
  "Category",
  "Subcategory",
  "Brand",
  "SKU",
  "MRP",
  "Vendor Price",
  "Stock",
  "Color",
  "Size Label",
  "Numeric Size",
  "Variant SKU",
  "Image URLs",
];

const defaultVariantExamples: VariantExample[] = [
  {
    sizeLabel: "Standard",
    numericSize: "1 piece",
    color: "",
    sku: "STD-1",
    stockQuantity: "5",
    price: "",
    vendorPrice: "",
    mrp: "",
    imageUrl: "",
  },
];

function resolveUploadFamily(value: string) {
  const segments = value
    .toLowerCase()
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
  const allText = segments.join(" ");

  const matchers = [
    { family: "baby", regex: /\b(baby care|baby|diaper|diapers|infant|nappy)\b/ },
    { family: "toy", regex: /\b(toy|toys|games|remote car|puzzle|doll|blocks|indoor games|outdoor games)\b/ },
    { family: "bag", regex: /\b(bag|bags|backpack|handbag|purse|luggage|wallet|belt)\b/ },
    { family: "footwear", regex: /\b(footwear|shoe|shoes|sandal|sandals|slipper|slippers|sneakers|loafers|sports shoe|safety shoe)\b/ },
    { family: "ethnic", regex: /\b(saree|sarees|lehenga|lehengas|kurti|kurtis|ethnic|blouse)\b/ },
    { family: "fashion", regex: /\b(fashion|shirt|shirts|t-shirt|tshirt|jeans|trouser|trousers|clothing|wear|jacket|blazer|suit|men|women)\b/ },
  ] as const;

  for (const segment of segments) {
    const isMixedParent = /&| and |,/.test(segment);
    if (segments.length > 1 && isMixedParent) continue;

    const match = matchers.find((item) => item.regex.test(segment));
    if (match) return match.family;
  }

  return matchers.find((item) => item.regex.test(allText))?.family || "general";
}

function getProductTypeOptions(categoryText: string) {
  const text = categoryText.toLowerCase();
  const family = resolveUploadFamily(categoryText);

  if (family === "footwear") {
    return [
      "Formal shoes",
      "Sports shoes",
      "Casual shoes",
      "Sandals",
      "Slippers",
      "Safety shoes",
      "School shoes",
      "Loafers",
      "Sneakers",
    ];
  }

  if (family === "bag") {
    return [
      "Handbag",
      "Backpack",
      "School bag",
      "Travel bag",
      "Laptop bag",
      "Wallet",
      "Belt",
      "Trolley bag",
    ];
  }

  if (family === "ethnic") {
    return [
      "Saree",
      "Lehenga",
      "Kurti",
      "Blouse",
      "Dress Material",
      "Dupatta",
      "Ethnic Set",
      "Gown",
    ];
  }

  if (family === "fashion") {
    return [
      "Shirt",
      "T-Shirt",
      "Jeans",
      "Trousers",
      "Kurti",
      "Saree",
      "Lehenga",
      "Dress",
      "Jacket",
      "Blazer",
    ];
  }

  if (/\b(electronic|electronics|appliance|ac|tv|washing|machine|compressor|motor|spare|part|parts|mobile accessory|mobile accessories)\b/.test(text)) {
    return [
      "Compressor",
      "Motor",
      "PCB",
      "Remote",
      "Sensor",
      "Capacitor",
      "Fan blade",
      "Filter",
      "Mobile charger",
      "Mobile cover",
    ];
  }

  if (/\b(beauty|personal care|shampoo|conditioner|cream|oil|makeup|skin|hair|grocery|groceries|food|health)\b/.test(text)) {
    return [
      "Shampoo",
      "Conditioner",
      "Hair oil",
      "Face wash",
      "Cream",
      "Serum",
      "Soap",
      "Makeup",
      "Grocery pack",
      "Health supplement",
    ];
  }

  if (/\b(toy|toys|games|kids toys|kids & toys|remote car|puzzle|doll|blocks|indoor games|outdoor games)\b/.test(text)) {
    return [
      "Educational toy",
      "Remote control toy",
      "Toy car",
      "Doll",
      "Building blocks",
      "Puzzle",
      "Board game",
      "Soft toy",
      "Outdoor toy",
      "Musical toy",
    ];
  }

  if (/\b(diaper|diapers|baby care|infant|baby shampoo|baby lotion|baby wipes|baby food|baby clothing)\b/.test(text)) {
    return [
      "Baby diaper pants",
      "Tape diaper",
      "Baby shampoo",
      "Baby lotion",
      "Baby wipes",
      "Baby food",
      "Baby clothing",
    ];
  }

  if (/\b(home|kitchen|furniture|decor|utility)\b/.test(text)) {
    return [
      "Sofa",
      "Chair",
      "Table",
      "Bottle",
      "Kitchen container",
      "Cookware",
      "Storage rack",
      "Home decor",
    ];
  }

  return [
    "Standard product",
    "Pack product",
    "Replacement part",
    "Accessory",
  ];
}

function getCategoryVariantConfig(categoryText: string): VariantFieldConfig {
  const text = categoryText.toLowerCase();
  const family = resolveUploadFamily(categoryText);

  if (family === "footwear") {
    return {
      title: "Footwear Size, Color & Stock Variants",
      note: "Customer will see one footwear product only. Each row is a selectable shoe/sandal size with its own stock.",
      selectedStyle: "Footwear size template",
      sizeLabelHeading: "India / UK Size",
      sizeLabelPlaceholder: "6 / 7 / 8",
      numericSizeHeading: "Foot Length",
      numericSizePlaceholder: "25 cm / 26 cm",
      colorHeading: "Color",
      colorPlaceholder: "Black",
      skuHeading: "Variant SKU",
      skuPlaceholder: "SHOE-BLK-7",
      defaultSizePlaceholder: "Default shoe size / UK size",
      availableSizesPlaceholder: "Available sizes, e.g. 6, 7, 8, 9",
      brandMappingPlaceholder: "Brand size mapping, e.g. UK 7 = EU 41",
      examples: [
        { sizeLabel: "UK 6", numericSize: "25 cm", color: "Black", sku: "UK6", stockQuantity: "4", price: "", mrp: "" },
        { sizeLabel: "UK 7", numericSize: "26 cm", color: "Black", sku: "UK7", stockQuantity: "5", price: "", mrp: "" },
        { sizeLabel: "UK 8", numericSize: "27 cm", color: "Black", sku: "UK8", stockQuantity: "3", price: "", mrp: "" },
        { sizeLabel: "UK 9", numericSize: "28 cm", color: "Black", sku: "UK9", stockQuantity: "3", price: "", mrp: "" },
      ],
    };
  }

  if (family === "bag") {
    return {
      title: "Bag Size, Color & Stock Variants",
      note: "Customer will see one bag product only. Add each dimension/capacity/color as a row.",
      selectedStyle: "Bag capacity template",
      sizeLabelHeading: "Bag Size / Capacity",
      sizeLabelPlaceholder: "Small / Medium / 24 inch",
      numericSizeHeading: "Dimension / Volume",
      numericSizePlaceholder: "30 x 12 x 42 cm / 20L",
      colorHeading: "Color / Material",
      colorPlaceholder: "Tan / Black / Leather",
      skuHeading: "Variant SKU",
      skuPlaceholder: "BAG-M-BLK",
      defaultSizePlaceholder: "Default bag dimension / capacity",
      availableSizesPlaceholder: "Bags: Small, Medium, Large / 20L / 32 inch",
      brandMappingPlaceholder: "Medium = 30 x 12 x 42 cm / 20L",
      examples: [
        { sizeLabel: "Small Bag", numericSize: "24 x 10 x 34 cm", color: "Black", sku: "BAG-S-BLK", stockQuantity: "5", price: "", mrp: "" },
        { sizeLabel: "Medium Bag", numericSize: "30 x 12 x 42 cm", color: "Black", sku: "BAG-M-BLK", stockQuantity: "4", price: "", mrp: "" },
        { sizeLabel: "Large Bag", numericSize: "36 x 15 x 48 cm", color: "Black", sku: "BAG-L-BLK", stockQuantity: "3", price: "", mrp: "" },
      ],
    };
  }

  if (family === "toy") {
    return {
      title: "Toy Type, Age Group & Stock Variants",
      note: "Customer will see one toy listing only. Add rows for age group, pack type, color/theme or model-wise stock.",
      selectedStyle: "Kids toys template",
      sizeLabelHeading: "Age / Pack",
      sizeLabelPlaceholder: "2-3 years / Pack of 1",
      numericSizeHeading: "Toy Size / Pieces",
      numericSizePlaceholder: "Medium / 24 pcs",
      colorHeading: "Color / Theme",
      colorPlaceholder: "Multicolor / Car theme",
      skuHeading: "Toy SKU",
      skuPlaceholder: "TOY-CAR-2Y",
      defaultSizePlaceholder: "Default age group / pack size",
      availableSizesPlaceholder: "Age groups, e.g. 0-2 years, 2-3 years, 3-5 years",
      brandMappingPlaceholder: "Age/pack mapping, e.g. 2-3 years = medium toy / 24 pcs",
      examples: [
        { sizeLabel: "2-3 years", numericSize: "Medium", color: "Multicolor", sku: "TOY-2-3Y", stockQuantity: "6", price: "", mrp: "" },
        { sizeLabel: "3-5 years", numericSize: "Large", color: "Multicolor", sku: "TOY-3-5Y", stockQuantity: "5", price: "", mrp: "" },
        { sizeLabel: "Pack of 1", numericSize: "1 toy", color: "Car theme", sku: "TOY-CAR-1", stockQuantity: "4", price: "", mrp: "" },
        { sizeLabel: "Pack of 4", numericSize: "4 pcs", color: "Blocks", sku: "TOY-BLOCKS-4", stockQuantity: "3", price: "", mrp: "" },
      ],
    };
  }

  if (family === "baby") {
    return {
      title: "Pack Size, Baby Size & Stock Variants",
      note: "Customer will see one diaper/baby product only. Each row can represent diaper size, baby weight range and pack count.",
      selectedStyle: "Baby care pack template",
      sizeLabelHeading: "Diaper / Pack Size",
      sizeLabelPlaceholder: "S / M / L / XL",
      numericSizeHeading: "Baby Weight / Count",
      numericSizePlaceholder: "5-9 kg / 64 pcs",
      colorHeading: "Pack Type",
      colorPlaceholder: "Pants / Tape / Jumbo",
      skuHeading: "Pack SKU",
      skuPlaceholder: "DIAPER-M-64",
      defaultSizePlaceholder: "Default pack size / baby weight range",
      availableSizesPlaceholder: "Pack sizes, e.g. S 42 pcs, M 64 pcs, L 54 pcs",
      brandMappingPlaceholder: "Brand size mapping, e.g. M = 7-12 kg",
      examples: [
        { sizeLabel: "S", numericSize: "4-8 kg / 72 pcs", color: "Pants", sku: "S-72", stockQuantity: "6", price: "", mrp: "" },
        { sizeLabel: "M", numericSize: "7-12 kg / 64 pcs", color: "Pants", sku: "M-64", stockQuantity: "5", price: "", mrp: "" },
        { sizeLabel: "L", numericSize: "9-14 kg / 54 pcs", color: "Pants", sku: "L-54", stockQuantity: "4", price: "", mrp: "" },
        { sizeLabel: "XL", numericSize: "12-17 kg / 48 pcs", color: "Pants", sku: "XL-48", stockQuantity: "3", price: "", mrp: "" },
      ],
    };
  }

  if (family === "ethnic") {
    return {
      title: "Ethnic Size, Color & Stock Variants",
      note: "Customer will see one ethnic product only. Add stitch type, size/color and stock as variant rows.",
      selectedStyle: "Ethnic wear template",
      sizeLabelHeading: "Size / Stitch Type",
      sizeLabelPlaceholder: "Free Size / M / Semi-stitched",
      numericSizeHeading: "Length / Fit Detail",
      numericSizePlaceholder: "5.5 m / 38 inch bust",
      colorHeading: "Color / Work",
      colorPlaceholder: "Yellow / Embroidered",
      skuHeading: "Variant SKU",
      skuPlaceholder: "ETH-YEL-FREE",
      defaultSizePlaceholder: "Default size/stitch type",
      availableSizesPlaceholder: "Available options, e.g. Free Size, M, L, Unstitched",
      brandMappingPlaceholder: "Size mapping, e.g. M = 38 inch bust / Saree = 5.5 m",
      examples: [
        { sizeLabel: "Free Size", numericSize: "5.5 m + blouse", color: "Yellow", sku: "FREE-YEL", stockQuantity: "5", price: "", mrp: "" },
        { sizeLabel: "M", numericSize: "38 inch bust", color: "Pink", sku: "M-PNK", stockQuantity: "4", price: "", mrp: "" },
        { sizeLabel: "L", numericSize: "40 inch bust", color: "Pink", sku: "L-PNK", stockQuantity: "3", price: "", mrp: "" },
      ],
    };
  }

  if (family === "fashion") {
    return {
      title: "Size, Color & Stock Variants",
      note: "Customer will see one fashion product only. Each row is a selectable size/color stock option.",
      selectedStyle: "Fashion size template",
      sizeLabelHeading: "Size Label",
      sizeLabelPlaceholder: "S / M / L / XL",
      numericSizeHeading: "Numeric Size",
      numericSizePlaceholder: "30 / 32 / 34",
      colorHeading: "Color",
      colorPlaceholder: "Blue",
      skuHeading: "Variant SKU",
      skuPlaceholder: "SHIRT-BLUE-32",
      defaultSizePlaceholder: "Default size, e.g. M / 32",
      availableSizesPlaceholder: "Available sizes, e.g. S, M, L, XL",
      brandMappingPlaceholder: "Brand size mapping, e.g. M = 38 inch chest",
      examples: [
        { sizeLabel: "S", numericSize: "30", color: "Blue", sku: "S-30", stockQuantity: "4", price: "", mrp: "" },
        { sizeLabel: "M", numericSize: "32", color: "Blue", sku: "M-32", stockQuantity: "5", price: "", mrp: "" },
        { sizeLabel: "L", numericSize: "34", color: "Blue", sku: "L-34", stockQuantity: "2", price: "", mrp: "" },
        { sizeLabel: "XL", numericSize: "36", color: "Blue", sku: "XL-36", stockQuantity: "7", price: "", mrp: "" },
      ],
    };
  }

  if (
    /\b(beauty|personal care|shampoo|conditioner|cream|oil|makeup|skin|hair|grocery|groceries|food|health)\b/.test(
      text,
    )
  ) {
    return {
      title: "Capacity, Shade & Stock Variants",
      note: "Customer will see one product only. Each row can represent bottle size, shade, flavour or pack count.",
      selectedStyle: "Beauty/grocery capacity template",
      sizeLabelHeading: "Variant Name",
      sizeLabelPlaceholder: "100 ml / 200 g",
      numericSizeHeading: "Net Quantity",
      numericSizePlaceholder: "100 ml / Pack of 2",
      colorHeading: "Shade / Flavour",
      colorPlaceholder: "Rose / Herbal / Natural",
      skuHeading: "Variant SKU",
      skuPlaceholder: "SHAMPOO-200ML",
      defaultSizePlaceholder: "Default capacity / net quantity",
      availableSizesPlaceholder: "Variants, e.g. 100 ml, 200 ml, Pack of 2",
      brandMappingPlaceholder: "Brand mapping, e.g. Shade 01 = Natural",
      examples: [
        { sizeLabel: "100 ml", numericSize: "100 ml", color: "Herbal", sku: "100ML", stockQuantity: "8", price: "", mrp: "" },
        { sizeLabel: "200 ml", numericSize: "200 ml", color: "Herbal", sku: "200ML", stockQuantity: "6", price: "", mrp: "" },
        { sizeLabel: "Pack of 2", numericSize: "2 x 100 ml", color: "Herbal", sku: "PACK2", stockQuantity: "4", price: "", mrp: "" },
      ],
    };
  }

  if (
    /\b(electronic|electronics|appliance|ac|tv|washing|machine|compressor|motor|spare|part|parts|mobile accessory|mobile accessories)\b/.test(
      text,
    )
  ) {
    return {
      title: "Model, Compatibility & Stock Variants",
      note: "Customer will see one spare/electronic product only. Each row can represent compatible model, capacity or MPN-wise stock.",
      selectedStyle: "Electronics/spare compatibility template",
      sizeLabelHeading: "Compatible Model",
      sizeLabelPlaceholder: "IFB 30L / LG 1.5T",
      numericSizeHeading: "Capacity / Spec",
      numericSizePlaceholder: "1.5 ton / 30L / 12V",
      colorHeading: "Brand / Type",
      colorPlaceholder: "LG / IFB / Copper",
      skuHeading: "MPN / SKU",
      skuPlaceholder: "AC-COMP-LG15",
      defaultSizePlaceholder: "Default capacity / compatible model",
      availableSizesPlaceholder: "Compatible models, capacity or part variants",
      brandMappingPlaceholder: "Fitment mapping, e.g. LG 1.5T 2020-2024",
      examples: [
        { sizeLabel: "LG 1.5T", numericSize: "1.5 ton", color: "LG", sku: "LG15", stockQuantity: "4", price: "", mrp: "" },
        { sizeLabel: "IFB 30L", numericSize: "30 litre", color: "IFB", sku: "IFB30", stockQuantity: "3", price: "", mrp: "" },
        { sizeLabel: "Universal", numericSize: "12V", color: "Generic", sku: "UNI12V", stockQuantity: "5", price: "", mrp: "" },
      ],
    };
  }

  if (/\b(home|kitchen|furniture|decor|utility)\b/.test(text)) {
    return {
      title: "Capacity, Material & Stock Variants",
      note: "Customer will see one home product only. Each row can represent capacity, dimensions, material or color-wise stock.",
      selectedStyle: "Home/kitchen variant template",
      sizeLabelHeading: "Capacity / Dimension",
      sizeLabelPlaceholder: "1L / 12 inch",
      numericSizeHeading: "Size Detail",
      numericSizePlaceholder: "1 litre / 30 cm",
      colorHeading: "Color / Material",
      colorPlaceholder: "Steel / Black",
      skuHeading: "Variant SKU",
      skuPlaceholder: "BOTTLE-1L-BLK",
      defaultSizePlaceholder: "Default capacity / dimension",
      availableSizesPlaceholder: "Variants, e.g. 500 ml, 1L, 2L",
      brandMappingPlaceholder: "Material/size mapping, e.g. 1L = 30 cm height",
      examples: [
        { sizeLabel: "500 ml", numericSize: "500 ml", color: "Steel", sku: "500ML", stockQuantity: "6", price: "", mrp: "" },
        { sizeLabel: "1 L", numericSize: "1 litre", color: "Steel", sku: "1L", stockQuantity: "5", price: "", mrp: "" },
        { sizeLabel: "2 L", numericSize: "2 litre", color: "Steel", sku: "2L", stockQuantity: "3", price: "", mrp: "" },
      ],
    };
  }

  return {
    title: "Variant, Option & Stock Rows",
    note: "Customer will see one product only. Add rows only for selectable options and stock differences.",
    selectedStyle: "General product template",
    sizeLabelHeading: "Option Label",
    sizeLabelPlaceholder: "Standard / Pack of 2",
    numericSizeHeading: "Option Detail",
    numericSizePlaceholder: "1 piece / 500 g",
    colorHeading: "Color / Type",
    colorPlaceholder: "Default",
    skuHeading: "Variant SKU",
    skuPlaceholder: "STD-1",
    defaultSizePlaceholder: "Default size / capacity / option",
    availableSizesPlaceholder: "Available options, e.g. Standard, Pack of 2",
    brandMappingPlaceholder: "Brand option mapping if applicable",
    examples: defaultVariantExamples,
  };
}

function getSpecTemplate(categoryText: string): SpecTemplate {
  const text = categoryText.toLowerCase();
  const family = resolveUploadFamily(categoryText);

  if (family === "footwear") {
    return {
      title: "Footwear Size Guide / Specifications",
      helpText:
        "Add UK/India size, EU size and foot length. Variant stock is added size-wise in the next step.",
      fields: [
        { name: "productType", label: "Product Type", placeholder: "Select product type", options: ["Formal shoes", "Sports shoes", "Casual shoes", "Sandals", "Slippers", "Safety shoes", "School shoes", "Loafers", "Sneakers"] },
        { name: "size", label: "Base UK / India Size", placeholder: "Select base size", options: ["UK 5", "UK 6", "UK 7", "UK 8", "UK 9", "UK 10", "UK 11"] },
        { name: "dimensions", label: "Foot Length", placeholder: "26 cm foot length" },
        { name: "material", label: "Upper / Sole Material", placeholder: "Select material", options: ["Genuine leather", "Synthetic leather", "Canvas", "Mesh", "Rubber", "PU", "EVA", "Textile"] },
        { name: "fitment", label: "Fit / Closure / Occasion", placeholder: "Regular fit / lace-up / formal wear", multiline: true },
        { name: "brandSizeMapping", label: "Size Guide Mapping", placeholder: "UK 7 = EU 41 = 26 cm foot length", multiline: true },
      ],
    };
  }

  if (family === "bag") {
    return {
      title: "Bag Size / Capacity Specifications",
      helpText:
        "Add dimensions, capacity, compartments and material. Variant stock is added by size/color in the next step.",
      fields: [
        { name: "productType", label: "Product Type", placeholder: "Select product type", options: ["Handbag", "Backpack", "School bag", "Travel bag", "Laptop bag", "Wallet", "Belt", "Trolley bag"] },
        { name: "size", label: "Bag Size / Capacity", placeholder: "Select size", options: ["Small", "Medium", "Large", "XL", "10 litre", "20 litre", "30 litre", "24 inch", "28 inch", "32 inch"] },
        { name: "dimensions", label: "Dimensions", placeholder: "30 x 12 x 42 cm" },
        { name: "material", label: "Outer Material", placeholder: "Select material", options: ["Genuine leather", "Synthetic leather", "Canvas", "Polyester", "Nylon", "Denim", "Cotton", "PU"] },
        { name: "fitment", label: "Capacity / Compartments / Closure", placeholder: "20L capacity / 3 compartments / zip closure", multiline: true },
        { name: "brandSizeMapping", label: "Size Guide Mapping", placeholder: "Medium = 30 x 12 x 42 cm / 20L", multiline: true },
      ],
    };
  }

  if (/\b(home|furniture|sofa|chair|table|bed|kitchen|decor)\b/.test(text)) {
    return {
      title: "Home / Furniture Specifications",
      helpText:
        "Add exact dimensions, seating/capacity and material details. Customers compare furniture by size, fabric, foam and weight before ordering.",
      fields: [
        { name: "seatingCapacity", label: "Seating / Capacity", placeholder: "Select seating/capacity", options: ["1 seater", "2 seater", "3 seater", "4 seater", "5 seater", "500 ml", "1 litre", "2 litre", "Pack of 2", "Pack of 4", "Pack of 6"] },
        { name: "dimensions", label: "Dimensions", placeholder: "Length x Width x Height in cm/inch" },
        { name: "material", label: "Material", placeholder: "Select material", options: ["Sheesham wood", "Engineered wood", "Stainless steel", "Plastic", "Glass", "Iron", "Aluminium", "Bamboo", "Ceramic"] },
        { name: "fabricType", label: "Fabric Type", placeholder: "Select fabric", options: ["Cotton blend", "Velvet", "Leatherette", "Linen", "Polyester", "Jute", "Microfiber", "Not applicable"] },
        { name: "foamType", label: "Foam Type", placeholder: "Select foam", options: ["High density foam", "Memory foam", "PU foam", "Rebonded foam", "Not applicable"] },
        { name: "fitment", label: "Assembly / Fitment Note", placeholder: "Assembly required / foldable / wall mounted", multiline: true },
      ],
    };
  }

  if (family === "ethnic") {
    return {
      title: "Ethnic Wear Size Guide & Specifications",
      helpText:
        "Add stitch type, fabric, length and occasion details. Customers compare saree/lehenga products by fabric, length, work and fitting.",
      fields: [
        { name: "productType", label: "Product Type", placeholder: "Select ethnic product type", options: ["Saree", "Lehenga", "Kurti", "Blouse", "Dress Material", "Dupatta", "Ethnic Set", "Gown"] },
        { name: "size", label: "Size / Stitch Type", placeholder: "Select size/stitch type", options: ["Free Size", "XS", "S", "M", "L", "XL", "XXL", "3XL", "Unstitched", "Semi-stitched", "Readymade"] },
        { name: "dimensions", label: "Length / Width", placeholder: "Saree 5.5 m + blouse 0.8 m / Lehenga waist and length" },
        { name: "material", label: "Fabric / Material", placeholder: "Select fabric", options: ["Silk", "Cotton", "Georgette", "Chiffon", "Net", "Velvet", "Rayon", "Crepe", "Organza", "Polyester"] },
        { name: "fitment", label: "Occasion / Work / Fit Note", placeholder: "Wedding wear / embroidered / regular fit", multiline: true },
        { name: "brandSizeMapping", label: "Size Guide Mapping", placeholder: "Free size = standard drape; M = 38 inch bust", multiline: true },
      ],
    };
  }

  if (family === "fashion") {
    return {
      title: "Fashion Size Guide & Specifications",
      helpText:
        "Add size guide details clearly. These fields help customers choose the correct size and reduce returns.",
      fields: [
        { name: "size", label: "Base Size / Fit", placeholder: "Select base size", options: ["XS", "S", "M", "L", "XL", "XXL", "3XL", "28", "30", "32", "34", "36", "38", "40", "Regular fit", "Slim fit", "Oversized"] },
        { name: "chest", label: "Chest / Bust", placeholder: "38 inch / 96 cm" },
        { name: "dimensions", label: "Length / Outseam", placeholder: "28 inch shirt length / 40 inch trouser length" },
        { name: "sleeveLength", label: "Sleeve / Shoulder", placeholder: "24.5 inch sleeve / 17 inch shoulder" },
        { name: "material", label: "Fabric / Material", placeholder: "Select fabric", options: ["100% cotton", "Cotton blend", "Rayon", "Denim", "Polyester", "Lycra", "Silk", "Georgette", "Chiffon", "Wool", "Linen"] },
        { name: "brandSizeMapping", label: "Brand Size Mapping", placeholder: "M = 38 inch chest, L = 40 inch chest", multiline: true },
      ],
    };
  }

  if (
    /\b(electronic|electronics|appliance|ac|tv|washing|machine|compressor|motor|spare|part|parts|mobile accessory|mobile accessories)\b/.test(
      text,
    )
  ) {
    return {
      title: "Electronics / Parts Compatibility",
      helpText:
        "Add compatibility and technical specs. Customers must know model fitment, voltage, part type and dimensions before ordering spare parts.",
      fields: [
        { name: "fitment", label: "Compatibility / Model Fitment", placeholder: "Fits LG 1.5T 2020-2024 / IFB 30L", multiline: true },
        { name: "voltage", label: "Voltage / Power", placeholder: "Select voltage/power", options: ["5V", "12V", "24V", "110V", "220V", "1 ton", "1.5 ton", "2 ton", "Not applicable"] },
        { name: "partType", label: "Part Type", placeholder: "Select part type", options: ["Compressor", "Motor", "PCB", "Remote", "Sensor", "Capacitor", "Fan blade", "Pipe", "Filter", "Switch", "Cable", "Adaptor", "Other"] },
        { name: "dimensions", label: "Dimensions", placeholder: "Length x Width x Height" },
        { name: "material", label: "Material / Build", placeholder: "Select material", options: ["Copper", "Plastic", "Aluminium", "Steel", "Rubber", "Brass", "Mixed material", "Not applicable"] },
        { name: "brandSizeMapping", label: "Model Mapping", placeholder: "Model no. and compatible part list", multiline: true },
      ],
    };
  }

  if (family === "toy") {
    return {
      title: "Kids Toys / Games Specifications",
      helpText:
        "Add age group, toy type, safety, material, pieces and dimensions clearly. Variant stock is added by age/pack/theme in the next step.",
      fields: [
        { name: "productType", label: "Product Type", placeholder: "Select product type", options: ["Educational toy", "Remote control toy", "Toy car", "Doll", "Building blocks", "Puzzle", "Board game", "Soft toy", "Outdoor toy", "Musical toy"] },
        { name: "size", label: "Age Group / Pack", placeholder: "Select age group", options: ["0-2 years", "2-3 years", "3-5 years", "5-8 years", "8+ years", "Pack of 1", "Pack of 2", "Pack of 4"] },
        { name: "dimensions", label: "Toy Size / Pieces", placeholder: "Medium / 24 pcs / 20 x 10 x 8 cm" },
        { name: "material", label: "Material", placeholder: "Select material", options: ["Plastic", "Wood", "Soft fabric", "Rubber", "Metal", "Foam", "Non-toxic plastic", "ABS plastic"] },
        { name: "fitment", label: "Use / Skill / Safety Note", placeholder: "Indoor game / motor skills / non-toxic / adult supervision", multiline: true },
        { name: "brandSizeMapping", label: "Age & Variant Mapping", placeholder: "2-3 years = medium toy; Pack of 4 = 4 small toys", multiline: true },
      ],
    };
  }

  if (/\b(diaper|diapers|baby care|infant|baby shampoo|baby lotion|baby wipes|baby food|baby clothing)\b/.test(text)) {
    return {
      title: "Baby Care Pack & Size Specifications",
      helpText:
        "Select baby size, weight range and pack type clearly. Variant stock is added size-wise in the next step.",
      fields: [
        { name: "productType", label: "Product Type", placeholder: "Select product type", options: ["Baby diaper pants", "Tape diaper", "Baby shampoo", "Baby lotion", "Baby wipes", "Baby food", "Baby toy", "Baby clothing"] },
        { name: "size", label: "Baby / Pack Size", placeholder: "Select size", options: ["New born", "S", "M", "L", "XL", "XXL", "Pack of 24", "Pack of 48", "Pack of 64", "Pack of 72"] },
        { name: "dimensions", label: "Baby Weight / Count", placeholder: "7-12 kg / 64 pcs" },
        { name: "material", label: "Material / Ingredient Type", placeholder: "Select material/type", options: ["Cotton soft", "Non-woven", "Herbal", "Tear-free", "Fragrance free", "Plastic", "Fabric"] },
        { name: "fitment", label: "Age / Usage / Skin Type", placeholder: "0-6 months / sensitive skin / day use", multiline: true },
        { name: "brandSizeMapping", label: "Brand Size Mapping", placeholder: "M = 7-12 kg, L = 9-14 kg", multiline: true },
      ],
    };
  }

  if (/\b(beauty|personal care|shampoo|conditioner|cream|oil|makeup|skin|hair|grocery|groceries|food|health)\b/.test(text)) {
    return {
      title: "Beauty / Grocery Attribute Specifications",
      helpText:
        "Select capacity, concern, flavour/shade and shelf-life details like a catalog form. Variant stock can be added by pack size or shade in the next step.",
      fields: [
        { name: "productType", label: "Product Type", placeholder: "Select product type", options: ["Shampoo", "Conditioner", "Hair oil", "Face wash", "Cream", "Serum", "Soap", "Makeup", "Grocery pack", "Health supplement"] },
        { name: "size", label: "Capacity / Net Quantity", placeholder: "Select quantity", options: ["50 ml", "100 ml", "200 ml", "500 ml", "1 litre", "50 g", "100 g", "250 g", "500 g", "1 kg", "Pack of 2", "Pack of 4"] },
        { name: "material", label: "Concern / Ingredient Type", placeholder: "Select concern/type", options: ["Hair fall", "Dandruff", "Dry skin", "Oily skin", "Herbal", "Ayurvedic", "Organic", "Vitamin C", "Protein", "Not applicable"] },
        { name: "fabricType", label: "Flavour / Shade / Fragrance", placeholder: "Select flavour/shade", options: ["Natural", "Rose", "Aloe vera", "Lemon", "Chocolate", "Vanilla", "Black", "Brown", "Nude", "Not applicable"] },
        { name: "fitment", label: "Ideal For / Usage", placeholder: "Men / women / kids / daily use", multiline: true },
        { name: "brandSizeMapping", label: "Shelf Life / Extra Details", placeholder: "24 months / best before / storage instruction", multiline: true },
      ],
    };
  }

  return {
    title: "Category Specifications",
    helpText:
      "Add the details customers need to compare this product. Admin can later move these templates into managed category settings.",
    fields: [
      { name: "size", label: "Size / Capacity", placeholder: "Standard / 500 ml / pack of 2" },
      { name: "dimensions", label: "Dimensions", placeholder: "Length x Width x Height if applicable" },
      { name: "material", label: "Material", placeholder: "Cotton / steel / plastic / herbal" },
      { name: "fitment", label: "Compatibility / Usage", placeholder: "Use case, fitment or suitable for", multiline: true },
      { name: "brandSizeMapping", label: "Brand Mapping / Extra Spec", placeholder: "Brand-wise size, shade, pack or model mapping", multiline: true },
    ],
  };
}

function createVariantRow(index: number, color = ""): VariantFormRow {
  return {
    id: `${Date.now()}-${index}`,
    sizeLabel: "",
    numericSize: "",
    color,
    sku: "",
    barcode: "",
    stockQuantity: "",
    price: "",
    vendorPrice: "",
    mrp: "",
    imageUrl: "",
    lowStockThreshold: "3",
    weight: "",
    active: true,
    isDefault: index === 0,
    selected: false,
  };
}

function getVariantStatus(stockQuantity: string, lowStockThreshold = "3") {
  const stock = Math.max(0, Math.floor(Number(stockQuantity || 0)));
  const threshold = Math.max(1, Math.floor(Number(lowStockThreshold || 3)));
  if (stock <= 0) return "Out of Stock";
  if (stock <= threshold) return "Low Stock";
  return "In Stock";
}

function getStatusClass(status: string) {
  if (status === "Out of Stock") return "bg-gray-200 text-gray-800";
  if (status === "Low Stock") return "bg-orange-100 text-orange-800";
  return "bg-green-100 text-green-800";
}

function getVariantOptionValues(
  field: keyof Omit<VariantFormRow, "id">,
  config: VariantFieldConfig,
) {
  const values =
    field === "sizeLabel"
      ? config.examples.map((example) => example.sizeLabel)
      : field === "numericSize"
        ? config.examples.map((example) => example.numericSize)
        : field === "color"
          ? config.examples.map((example) => example.color)
          : [];

  return Array.from(new Set(values.filter(Boolean)));
}

function getStructuredDimensionOptions(
  key: "size" | "color",
  config: StructuredVariantConfig,
) {
  const dimension =
    config.dimensions.find((item) => item.key.toLowerCase() === key) ||
    config.dimensions[key === "size" ? 0 : 1];
  return {
    dimension,
    options: dimension?.options?.filter(Boolean) || [],
  };
}

function normalizeSkuToken(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toUpperCase();
}

function buildVariantSku(baseSku: string, variant: VariantFormRow, index: number) {
  const parts = [
    normalizeSkuToken(baseSku),
    normalizeSkuToken(variant.sku),
    normalizeSkuToken(variant.sizeLabel),
    normalizeSkuToken(variant.numericSize),
    normalizeSkuToken(variant.color),
  ].filter(Boolean);

  return parts.length ? parts.join("-") : `VARIANT-${index + 1}`;
}

function prepareUniqueVariantRows(rows: VariantFormRow[], baseSku: string) {
  const used = new Map<string, number>();

  return rows.map((row, index) => {
    const rawSku = normalizeSkuToken(row.sku) || buildVariantSku(baseSku, row, index);
    const count = used.get(rawSku) || 0;
    used.set(rawSku, count + 1);

    return {
      ...row,
      sku: count === 0 ? rawSku : `${rawSku}-${count + 1}`,
    };
  });
}

function getDuplicateVariantSkus(rows: VariantFormRow[]) {
  const counts = new Map<string, number>();

  rows.forEach((row) => {
    const sku = normalizeSkuToken(row.sku);
    if (!sku) return;
    counts.set(sku, (counts.get(sku) || 0) + 1);
  });

  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([sku]) => sku);
}

export default function ProductUploadPage() {
  const router = useRouter();
  const [mode, setMode] = useState<UploadMode>("home");
  const [step, setStep] = useState<SingleStep>("images");
  const [categories, setCategories] = useState<Category[]>([]);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [vendorStatus, setVendorStatus] = useState<
    "PENDING" | "APPROVED" | "REJECTED" | "INACTIVE" | null
  >(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [bulkRows, setBulkRows] = useState<BulkProductRow[]>([]);
  const [bulkFileName, setBulkFileName] = useState("");
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkMessage, setBulkMessage] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [managedTemplate, setManagedTemplate] = useState<ManagedUploadTemplate | null>(null);

  const [productTypeId, setProductTypeId] = useState("");
  const [specificationValues, setSpecificationValues] = useState<{ scope: string; values: Record<string, string> }>({ scope: "", values: {} });
  const [baseForm, setForm] = useState({
    title: "",
    description: "",
    brand: "",
    modelNumber: "",
    partNumber: "",
    productType: "",
    condition: "NEW",
    warranty: "",
    color: "",
    size: "",
    availableSizes: "",
    brandSizeMapping: "",
    material: "",
    fitment: "",
    seatingCapacity: "",
    dimensions: "",
    fabricType: "",
    foamType: "",
    chest: "",
    sleeveLength: "",
    voltage: "",
    partType: "",
    returnPolicy: "7 days replacement for eligible items",
    searchKeywords: "",
    sku: "",
    hsnCode: "",
    gstPercent: "18",
    manufacturerName: "",
    manufacturerAddress: "",
    packerName: "",
    packerAddress: "",
    countryOfOrigin: "India",
    bisCertificateUrl: "",
    fssaiLicenseUrl: "",
    brandAuthorizationUrl: "",
    safetyCertificateUrl: "",
    warrantyDocumentUrl: "",
    mrp: "",
    vendorPrice: "",
    discountPercent: "",
    platformCommissionPercent: "10",
    weightGrams: "",
    packageSize: "AUTO",
    fragile: false,
    shippingCharge: "",
    codCharge: "0",
    stock: "",
    imageUrls: "",
    categoryId: "",
    subcategoryId: "",
    treeMain: "",
    treeGroup: "",
    treePart: "",
  });
  const specificationScope = { categoryId: baseForm.categoryId, subcategoryId: baseForm.subcategoryId, productTypeId };
  const specificationScopeKey = vendorSpecificationScopeKey(specificationScope);
  const form = { ...baseForm, ...(specificationValues.scope === specificationScopeKey ? specificationValues.values : {}) };
  const resolvedSpecifications = useVendorProductTypeSpecifications(specificationScope);
  const specificationLoadingError = resolvedSpecifications.loading ? "Loading specifications. Please wait." : resolvedSpecifications.error;
  const [variants, setVariants] = useState<VariantFormRow[]>([
    createVariantRow(0),
  ]);
  const [selectedVariantSizes, setSelectedVariantSizes] = useState<string[]>([]);
  const [selectedVariantColors, setSelectedVariantColors] = useState<string[]>([]);
  const [bulkVariantValues, setBulkVariantValues] = useState({
    price: "",
    vendorPrice: "",
    mrp: "",
    weight: "",
    lowStockThreshold: "3",
  });

  const selectedCategory = categories.find(
    (category) => category.id === form.categoryId,
  );
  const subcategoryOptions = selectedCategory?.subcategories || [];
  const selectedSubcategory = subcategoryOptions.find(
    (subcategory) => subcategory.id === form.subcategoryId,
  );
  const persistedProductTypes = (selectedSubcategory?.productTypes || []).filter((item) => item.subcategoryId === selectedSubcategory?.id);
  const selectedProductType = persistedProductTypes.find((item) => item.id === productTypeId);
  const selectedTreeMain = applianceCategoryTree.find(
    (category) => category.slug === form.treeMain,
  );
  const selectedTreeGroup = selectedTreeMain?.groups.find(
    (group) => group.slug === form.treeGroup,
  );
  const selectedTreePart = selectedTreeGroup?.parts.find(
    (part) => part.slug === form.treePart,
  );
  const images = useMemo(
    () =>
      form.imageUrls
        .split(/\r?\n|,/)
        .map((item) => item.trim())
        .filter(Boolean),
    [form.imageUrls],
  );
  const filteredCategories = useMemo(() => {
    const query = categorySearch.trim().toLowerCase();
    if (!query) return categories;
    return categories.filter((category) => {
      const haystack = [
        category.name,
        ...(category.subcategories || []).map((subcategory) => subcategory.name),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [categories, categorySearch]);
  const pricingPreview = calculateMarketplacePricing({
    mrp: form.mrp,
    vendorPrice: form.vendorPrice,
    discountPercent: form.discountPercent,
    platformCommissionPercent: form.platformCommissionPercent,
    weightGrams: form.weightGrams,
    packageSize: form.packageSize,
    fragile: form.fragile,
    shippingCharge: form.shippingCharge,
    codCharge: form.codCharge,
  });
  const selectedTreePartName = selectedTreePart?.name || "";
  const selectedTreeGroupName = selectedTreeGroup?.name || "";
  const selectedSubcategoryName = selectedSubcategory?.name || "";
  const selectedTreeMainName = selectedTreeMain?.name || "";
  const selectedCategoryName = selectedCategory?.name || "";
  const categoryContext = [
    selectedTreePartName,
    form.productType,
    form.title,
    selectedTreeGroupName,
    selectedSubcategoryName,
    selectedTreeMainName,
    selectedCategoryName,
  ]
    .filter(Boolean)
    .join(" / ");
  const managedProductTypes = managedTemplate?.productTypes?.filter(Boolean) || [];
  const productTypeOptions =
    managedProductTypes.length > 0
      ? managedProductTypes
      : getProductTypeOptions(
          [
            selectedCategoryName,
            selectedSubcategoryName,
            selectedTreeMainName,
            selectedTreeGroupName,
            selectedTreePartName,
            form.title,
          ]
            .filter(Boolean)
            .join(" / "),
        );
  const variantConfig = useMemo(
    () => managedTemplate?.variantConfig || getCategoryVariantConfig(categoryContext),
    [categoryContext, managedTemplate?.variantConfig],
  );
  const structuredVariantConfig = useMemo(
    () => normalizeStructuredVariantConfig(variantConfig),
    [variantConfig],
  );
  const sizeDimensionConfig = getStructuredDimensionOptions(
    "size",
    structuredVariantConfig,
  );
  const colorDimensionConfig = getStructuredDimensionOptions(
    "color",
    structuredVariantConfig,
  );
  const duplicateVariantSkus = useMemo(
    () => getDuplicateVariantSkus(variants),
    [variants],
  );
  const specTemplate = useMemo(
    () => {
      if (productTypeId && specificationLoadingError) return { title: "Product Specifications", helpText: "", fields: [] };
      const template = (productTypeId ? resolvedSpecifications.template : null) || managedTemplate?.specTemplate || getSpecTemplate(categoryContext);
      return { ...template, fields: template.fields.map(normalizeVendorSpecField) };
    },
    [categoryContext, managedTemplate?.specTemplate, productTypeId, resolvedSpecifications.template, specificationLoadingError],
  );

  useEffect(() => {
    let isActive = true;

    async function loadPageData() {
      const userResponse = await fetch("/api/auth/me", { cache: "no-store" });
      const userData = await userResponse.json();

      if (!isActive) return;

      if (!userData.user) {
        router.push("/login?role=vendor&next=/vendor/dashboard/upload");
        return;
      }

      const user = userData.user as VendorUser;
      if (user.role !== "VENDOR" || !user.vendorProfile) {
        router.push("/vendor/register");
        return;
      }

      const status = user.vendorProfile.status || "PENDING";
      setVendorStatus(status);
      setRejectionReason(user.vendorProfile.rejectionReason || "");

      if (status !== "APPROVED") {
        setCheckingAccess(false);
        return;
      }

      const categoriesResponse = await fetch("/api/categories", {
        cache: "no-store",
      });

      if (!isActive) return;

      if (!categoriesResponse.ok) {
        setError("Could not load categories.");
        setCheckingAccess(false);
        return;
      }

      const data = await categoriesResponse.json();
      setCategories(data.categories || []);
      if (!data.categories?.length) {
        setError("No categories found. Ask admin to add categories first.");
      }
      setCheckingAccess(false);
    }

    loadPageData();

    return () => {
      isActive = false;
    };
  }, [router]);

  useEffect(() => {
    let isActive = true;

    async function loadManagedTemplate() {
      if (!form.categoryId) {
        setManagedTemplate(null);
        return;
      }

      const query = new URLSearchParams({ categoryId: form.categoryId });
      if (form.subcategoryId) {
        query.set("subcategoryId", form.subcategoryId);
      }

      try {
        const response = await fetch(`/api/category-templates?${query.toString()}`, {
          cache: "no-store",
        });
        const data = await response.json();

        if (!isActive) return;
        const template = data.template as ManagedUploadTemplate | null;
        setManagedTemplate(
          template
            ? {
                ...template,
                specTemplate: template.specTemplate
                  ? {
                      ...template.specTemplate,
                      fields: template.specTemplate.fields || [],
                    }
                  : undefined,
                variantConfig: template.variantConfig
                  ? {
                      ...template.variantConfig,
                      examples: (template.variantConfig.examples || []).map(
                        (example) => ({
                          ...example,
                          stockQuantity:
                            String(example.stockQuantity || "").replace(
                              /[^\d]/g,
                              "",
                            ) || "0",
                        }),
                      ),
                    }
                  : undefined,
              }
            : null,
        );
      } catch {
        if (isActive) {
          setManagedTemplate(null);
        }
      }
    }

    loadManagedTemplate();

    return () => {
      isActive = false;
    };
  }, [form.categoryId, form.subcategoryId]);

  function changeSpecification(name: string, value: string) {
    const field = specTemplate.fields.find((item) => item.name === name);
    if (!field || !vendorCanEditSpecification(field)) return;
    setSpecificationValues((current) => ({ scope: specificationScopeKey, values: { ...(current.scope === specificationScopeKey ? current.values : {}), [name]: value } }));
  }

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) {
    const { name, value } = e.target;
    const specification = specTemplate.fields.find((field) => field.name === name);
    if (specification) { changeSpecification(name, value); return; }
    const nextValue =
      e.target instanceof HTMLInputElement && e.target.type === "checkbox"
        ? e.target.checked
        : value;

    if (name === "categoryId") {
      setProductTypeId("");
      setForm((currentForm) => ({
        ...currentForm,
        categoryId: value,
        subcategoryId: "",
      }));
      return;
    }

    if (name === "treeMain") {
      setForm((currentForm) => ({
        ...currentForm,
        treeMain: value,
        treeGroup: "",
        treePart: "",
      }));
      return;
    }

    if (name === "treeGroup") {
      setForm((currentForm) => ({
        ...currentForm,
        treeGroup: value,
        treePart: "",
      }));
      return;
    }

    setForm((currentForm) => ({
      ...currentForm,
      [name]: nextValue,
    }));
  }

  function selectCategory(categoryId: string) {
    setProductTypeId("");
    setForm((currentForm) => ({
      ...currentForm,
      categoryId,
      subcategoryId: "",
    }));
  }

  function selectSubcategory(subcategoryId: string) {
    setProductTypeId("");
    setForm((currentForm) => ({
      ...currentForm,
      subcategoryId,
    }));
  }

  function appendUploadedImage(url: string) {
    setForm((currentForm) => ({
      ...currentForm,
      imageUrls: currentForm.imageUrls
        ? `${currentForm.imageUrls.trim()}\n${url}`
        : url,
    }));
  }

  function removeImage(url: string) {
    setForm((currentForm) => ({
      ...currentForm,
      imageUrls: currentForm.imageUrls
        .split(/\r?\n|,/)
        .map((item) => item.trim())
        .filter((item) => item && item !== url)
        .join("\n"),
    }));
  }

  function updateVariantRow(
    id: string,
    field: keyof Omit<VariantFormRow, "id">,
    value: string | boolean,
  ) {
    setVariants((currentRows) =>
      currentRows.map((row) =>
        row.id === id
          ? {
              ...row,
              [field]: value,
              ...(field === "isDefault" && value
                ? { selected: row.selected }
                : {}),
            }
          : row,
      ),
    );
  }

  function toggleVariantValue(
    value: string,
    selectedValues: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>,
  ) {
    setter(
      selectedValues.includes(value)
        ? selectedValues.filter((item) => item !== value)
        : [...selectedValues, value],
    );
  }

  function setDefaultVariant(id: string) {
    setVariants((currentRows) =>
      currentRows.map((row) => ({
        ...row,
        isDefault: row.id === id,
      })),
    );
  }

  function applyLanguageFix(fieldKey: string, value: string) {
    setForm((currentForm) => ({
      ...currentForm,
      [fieldKey]: value,
    }));
  }

  function addVariantRow() {
    const example =
      structuredVariantConfig.examplePreview[
        variants.length % structuredVariantConfig.examplePreview.length
      ] || defaultVariantExamples[0];
    const previewSize = example.size || "";
    const previewColor = example.color || form.color;
    const draftRow = {
      ...createVariantRow(variants.length, previewColor),
      sizeLabel: previewSize,
      numericSize: previewSize,
      color: previewColor,
    };
    setVariants((currentRows) => [
      ...currentRows,
      {
        ...createVariantRow(currentRows.length, previewColor),
        ...example,
        sizeLabel: previewSize,
        numericSize: previewSize,
        color: previewColor,
        sku: buildVariantSku(form.sku, draftRow, currentRows.length),
        stockQuantity: "0",
        price: form.vendorPrice ? String(pricingPreview.finalCustomerPrice) : "",
        vendorPrice: form.vendorPrice,
        mrp: form.mrp || "",
        imageUrl: images[0] || "",
      },
    ]);
  }

  function applyVariantTemplate() {
    setVariants(
      structuredVariantConfig.examplePreview.map((example, index) => ({
        ...createVariantRow(index, example.color || form.color),
        ...example,
        sizeLabel: example.size || "",
        numericSize: example.size || "",
        color: example.color || form.color,
        sku: buildVariantSku(
          form.sku,
          {
            ...createVariantRow(index, example.color || form.color),
            sizeLabel: example.size || "",
            numericSize: example.size || "",
            color: example.color || form.color,
          },
          index,
        ),
        stockQuantity: "0",
        price: "",
        vendorPrice: form.vendorPrice,
        mrp: form.mrp || "",
        imageUrl: images[index] || images[0] || "",
      })),
    );
  }

  function generateConfiguredVariantRows() {
    const generatedRows = generateVariantCombinations({
      sizes:
        selectedVariantSizes.length > 0
          ? selectedVariantSizes
          : sizeDimensionConfig.options.slice(0, 1),
      colors:
        selectedVariantColors.length > 0
          ? selectedVariantColors
          : colorDimensionConfig.options.slice(0, 1),
      baseSku: form.sku,
      lowStockAlert: String(
        structuredVariantConfig.rowFields.lowStockAlert?.default || "3",
      ),
    });

    if (generatedRows.length === 0) {
      setError("Select at least one configured size and one configured colour.");
      return;
    }

    setError("");
    setVariants((currentRows) => {
      const existingCombos = new Set(
        currentRows.map((row) =>
          `${row.sizeLabel.trim()}::${row.color.trim()}`.toLowerCase(),
        ),
      );
      const nextRows = generatedRows
        .filter(
          (row) =>
            !existingCombos.has(
              `${row.sizeLabel.trim()}::${row.color.trim()}`.toLowerCase(),
            ),
        )
        .map((row, index) => ({
          ...createVariantRow(currentRows.length + index, row.color),
          ...row,
          id: `${Date.now()}-generated-${index}`,
          price: bulkVariantValues.price,
          vendorPrice: bulkVariantValues.vendorPrice || form.vendorPrice,
          mrp: bulkVariantValues.mrp || form.mrp,
          weight: bulkVariantValues.weight,
          lowStockThreshold:
            bulkVariantValues.lowStockThreshold || row.lowStockThreshold,
          imageUrl: images[0] || "",
          isDefault: currentRows.length === 0 && index === 0,
        }));
      return nextRows.length ? [...currentRows, ...nextRows] : currentRows;
    });
  }

  function updateSelectedVariantRows(updates: Partial<VariantFormRow>) {
    setVariants((currentRows) =>
      currentRows.map((row) =>
        row.selected
          ? {
              ...row,
              ...updates,
            }
          : row,
      ),
    );
  }

  function applyBulkVariantValues() {
    const updates: Partial<VariantFormRow> = {};
    if (bulkVariantValues.price) updates.price = bulkVariantValues.price;
    if (bulkVariantValues.vendorPrice) updates.vendorPrice = bulkVariantValues.vendorPrice;
    if (bulkVariantValues.mrp) updates.mrp = bulkVariantValues.mrp;
    if (bulkVariantValues.weight) updates.weight = bulkVariantValues.weight;
    if (bulkVariantValues.lowStockThreshold) {
      updates.lowStockThreshold = bulkVariantValues.lowStockThreshold;
    }
    setVariants((currentRows) =>
      currentRows.map((row) => ({
        ...row,
        ...updates,
      })),
    );
  }

  function deleteSelectedVariants() {
    setVariants((currentRows) => {
      const remainingRows = currentRows.filter((row) => !row.selected);
      return remainingRows.length ? remainingRows : currentRows;
    });
  }

  function autoFixVariantSkus() {
    setVariants((currentRows) => prepareUniqueVariantRows(currentRows, form.sku));
  }

  function removeVariantRow(id: string) {
    setVariants((currentRows) =>
      currentRows.length === 1
        ? currentRows
        : currentRows.filter((row) => row.id !== id),
    );
  }

  function buildDescription() {
    const categoryTrail = [
      selectedCategory?.name,
      selectedSubcategory?.name,
      selectedProductType?.name,
      selectedTreeMain?.name,
      selectedTreeGroup?.name,
      selectedTreePart?.name,
    ]
      .filter(Boolean)
      .join(" / ");
    const extraSpecs = [
      ["Seating / capacity", form.seatingCapacity],
      ["Dimensions", form.dimensions],
      ["Fabric type", form.fabricType],
      ["Foam type", form.foamType],
      ["Chest / bust", form.chest],
      ["Sleeve / shoulder", form.sleeveLength],
      ["Voltage / power", form.voltage],
      ["Part type", form.partType],
      ["HSN Code", form.hsnCode],
      ["GST", form.gstPercent ? `${form.gstPercent}%` : ""],
      ["Manufacturer", form.manufacturerName],
      ["Manufacturer address", form.manufacturerAddress],
      ["Packer", form.packerName],
      ["Packer address", form.packerAddress],
      ["Country of origin", form.countryOfOrigin],
      ["BIS / safety certificate", form.bisCertificateUrl],
      ["FSSAI license", form.fssaiLicenseUrl],
      ["Brand authorization", form.brandAuthorizationUrl],
      ["Product safety certificate", form.safetyCertificateUrl],
      ["Warranty document", form.warrantyDocumentUrl],
    ]
      .filter(([, value]) => String(value || "").trim())
      .map(([label, value]) => `${label}: ${value}`);
    const managedSpecNames = new Set([
      "seatingCapacity",
      "dimensions",
      "fabricType",
      "foamType",
      "chest",
      "sleeveLength",
      "voltage",
      "partType",
      "productType",
      "fitment",
      "size",
      "material",
      "brandSizeMapping",
    ]);
    const managedSpecs = vendorSpecificationLines(specTemplate.fields, form, managedSpecNames);
    const allSpecs = [...extraSpecs, ...managedSpecs];

    return [
      form.description.trim(),
      categoryTrail ? `Catalog path: ${categoryTrail}` : "",
      allSpecs.length ? `Compliance details:\n${allSpecs.join("\n")}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  function downloadBulkTemplate() {
    const csv = `${bulkTemplateHeaders.join(",")}\n`;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    link.download = "zylo-buylo-bulk-product-template.csv";
    link.click();
  }

  function splitBulkImages(value: string) {
    return value
      .split(/[|\n;]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function validateBulkRow(row: BulkProductRow) {
    const resolved = resolveBulkCategory(categories, row.categoryName, row.subcategoryName);
    const category = resolved.category;
    const subcategory = resolved.subcategory;

    if (!row.name) return "Product Name is required.";
    if (!row.vendorPrice || Number(row.vendorPrice) <= 0) {
      return "Vendor Price must be greater than 0.";
    }
    if (!row.stock || Number(row.stock) <= 0) {
      return "Stock must be greater than 0.";
    }
    if (!row.categoryName || !category) {
      return "Category must match an existing category name.";
    }
    if ((category.subcategories || []).length > 0 && !subcategory) {
      return "Subcategory must match this category.";
    }
    if (row.imageUrls.length === 0) {
      return "At least one Image URL is required.";
    }

    return resolved.message || "";
  }

  async function handleBulkCsvFile(file: File | null) {
    setBulkMessage("");
    setError("");

    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please upload a CSV file. Excel upload can be connected later.");
      return;
    }

    const text = await file.text();
    const parsedRows = parseBulkProductCsv(text).map(({ rowNumber, row }) => {
      const bulkRow: BulkProductRow = {
        rowNumber,
        name: row["product name"] || "",
        description: row.description || "",
        categoryName: row.category || "",
        subcategoryName: row.subcategory || "",
        brand: row.brand || "",
        sku: row.sku || "",
        mrp: row.mrp || "",
        vendorPrice: row["vendor price"] || "",
        stock: row.stock || "",
        color: row.color || "",
        sizeLabel: row["size label"] || "",
        numericSize: row["numeric size"] || "",
        variantSku: row["variant sku"] || "",
        imageUrls: splitBulkImages(row["image urls"] || ""),
        status: "READY",
        message: "",
      };
      const message = validateBulkRow(bulkRow);
      const hasError = Boolean(message && !message.startsWith("Mapped to "));
      return {
        ...bulkRow,
        status: hasError ? "ERROR" as const : "READY" as const,
        message,
      };
    });

    setBulkRows(parsedRows);
    setBulkFileName(file.name);
    setBulkMessage(
      parsedRows.length
        ? `${parsedRows.length} rows loaded. Fix error rows before submit.`
        : "No product rows found in CSV.",
    );
  }

  async function submitBulkProducts() {
    setError("");
    setBulkMessage("");

    const readyRows = bulkRows.filter((row) => row.status === "READY");
    if (readyRows.length === 0) {
      setError("No valid bulk rows are ready to submit.");
      return;
    }

    setBulkSubmitting(true);

    const nextRows = [...bulkRows];
    let createdCount = 0;

    for (const row of readyRows) {
      const rowIndex = nextRows.findIndex((entry) => entry.rowNumber === row.rowNumber);
      const resolved = resolveBulkCategory(categories, row.categoryName, row.subcategoryName);
      const category = resolved.category;
      const subcategory = resolved.subcategory;

      if (!category || ((category.subcategories || []).length > 0 && !subcategory)) {
        nextRows[rowIndex] = {
          ...row,
          status: "ERROR",
          message: "Category or subcategory no longer matches.",
        };
        setBulkRows([...nextRows]);
        continue;
      }

      const variantSku =
        row.variantSku ||
        [row.sku, row.sizeLabel || row.numericSize || "STD", row.color]
          .filter(Boolean)
          .join("-");
      const response = await fetch("/api/products/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: row.name,
          description: row.description || row.name,
          brand: row.brand,
          sku: row.sku,
          mrp: Number(row.mrp || row.vendorPrice),
          vendorPrice: Number(row.vendorPrice),
          inventory: Number(row.stock),
          categoryId: category.id,
          subcategoryId: subcategory?.id,
          images: row.imageUrls,
          color: row.color,
          size: row.sizeLabel,
          variants: [
            {
              sizeLabel: row.sizeLabel || "Standard",
              numericSize: row.numericSize,
              color: row.color,
              sku: variantSku,
              stockQuantity: Number(row.stock),
              vendorPrice: Number(row.vendorPrice),
              mrp: Number(row.mrp || row.vendorPrice),
              imageUrl: row.imageUrls[0] || "",
              lowStockThreshold: 3,
            },
          ],
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        nextRows[rowIndex] = {
          ...row,
          status: "ERROR",
          message: data.error || "Product could not be created.",
        };
      } else {
        createdCount += 1;
        nextRows[rowIndex] = {
          ...row,
          status: "CREATED",
          message: "Created",
          productId: data.id,
        };
      }

      setBulkRows([...nextRows]);
    }

    setBulkSubmitting(false);
    setBulkMessage(`${createdCount} products created from ${readyRows.length} valid rows.`);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (specificationLoadingError) { setError(specificationLoadingError); setStep("specs"); return; }
    const missingRequiredField = missingRequiredSpecification(specTemplate.fields, form);
    if (missingRequiredField) {
      setError(`Please complete required field: ${missingRequiredField.label}.`);
      setStep("specs");
      return;
    }

    if (!form.title || !form.vendorPrice || !form.categoryId) {
      setError("Please fill product name, vendor price and category.");
      return;
    }

    if (subcategoryOptions.length > 0 && !form.subcategoryId) {
      setError("Please select a subcategory for this category.");
      setStep("basic");
      return;
    }

    if (images.length === 0) {
      setError("Please upload at least one front product image.");
      setStep("images");
      return;
    }

    const validVariants = variants.filter(
      (variant) =>
        variant.sizeLabel.trim() ||
        variant.numericSize.trim() ||
        variant.color.trim() ||
        variant.sku.trim() ||
        Number(variant.stockQuantity || 0) > 0,
    );

    if (validVariants.length === 0) {
      setError("Please add at least one size/color/stock variant.");
      setStep("variants");
      return;
    }

    const preparedVariants = prepareUniqueVariantRows(validVariants, form.sku);
    const variantRowErrors = validateVendorVariantRows(preparedVariants);
    if (variantRowErrors.length > 0) {
      setError(variantRowErrors[0]);
      setStep("variants");
      return;
    }

    if (duplicateVariantSkus.length > 0) {
      setVariants((currentRows) => prepareUniqueVariantRows(currentRows, form.sku));
    }

    setLoading(true);
    const totalVariantStock = preparedVariants.reduce(
      (sum, variant) => sum + Number(variant.stockQuantity || 0),
      0,
    );
    const fallbackVariantSize =
      form.size ||
      form.availableSizes
        .split(/[,/|]/)
        .map((item) => item.trim())
        .filter(Boolean)[0] ||
      "";

    const response = await fetch("/api/products/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.title,
        description: buildDescription() || "No description provided.",
        brand: form.brand,
        modelNumber: form.modelNumber,
        partNumber: form.partNumber,
        productType: form.productType,
        productTypeId,
        condition: form.condition,
        warranty: form.warranty,
        color: form.color,
        size: form.size,
        availableSizes: form.availableSizes,
        brandSizeMapping: form.brandSizeMapping,
        material: form.material,
        fitment: form.fitment,
        returnPolicy: form.returnPolicy,
        searchKeywords: form.searchKeywords,
        sku: form.sku,
        price: pricingPreview.finalCustomerPrice,
        mrp: Number(form.mrp || pricingPreview.mrp),
        vendorPrice: Number(form.vendorPrice),
        discountPercent: form.discountPercent
          ? Number(form.discountPercent)
          : undefined,
        platformCommissionPercent: Number(form.platformCommissionPercent || 10),
        weightGrams: form.weightGrams ? Number(form.weightGrams) : undefined,
        packageSize: form.packageSize,
        fragile: form.fragile,
        packagingCharge: pricingPreview.packagingCharge,
        shippingCharge: form.shippingCharge
          ? Number(form.shippingCharge)
          : undefined,
        codCharge: Number(form.codCharge || 0),
        inventory: form.stock ? Number(form.stock) : totalVariantStock,
        variants: preparedVariants.map((variant) => ({
          sizeLabel: variant.sizeLabel || fallbackVariantSize,
          numericSize: variant.numericSize,
          color: variant.color || form.color,
          sku: variant.sku,
          stockQuantity: Number(variant.stockQuantity || 0),
          price: variant.price
            ? Number(variant.price)
            : pricingPreview.finalCustomerPrice,
          vendorPrice: variant.vendorPrice
            ? Number(variant.vendorPrice)
            : Number(form.vendorPrice || 0),
          mrp: variant.mrp ? Number(variant.mrp) : Number(form.mrp || 0),
          imageUrl: variant.imageUrl,
          lowStockThreshold: Number(variant.lowStockThreshold || 3),
          barcode: variant.barcode,
          weight: variant.weight ? Number(variant.weight) : undefined,
          active: variant.active,
          isDefault: variant.isDefault,
        })),
        categoryId: form.categoryId,
        subcategoryId: form.subcategoryId,
        images,
      }),
    });

    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      if (response.status === 401) {
        router.push("/login?role=vendor&next=/vendor/dashboard/upload");
        return;
      }

      if (response.status === 403) {
        router.push("/vendor/dashboard");
        return;
      }

      setError(data.error || "Product save failed.");
      return;
    }

    router.push("/vendor/dashboard");
    router.refresh();
  }

  function goToBasic() {
    setError("");
    if (images.length === 0) {
      setError("Please upload at least one front product image.");
      return;
    }
    setStep("basic");
  }

  function goToSpecs() {
    setError("");
    if (!form.title.trim()) {
      setError("Please enter product name.");
      return;
    }
    if (!form.categoryId) {
      setError("Please select a category.");
      return;
    }
    if (subcategoryOptions.length > 0 && !form.subcategoryId) {
      setError("Please select a subcategory.");
      return;
    }
    setStep("specs");
  }

  function goToVariants() {
    if (specificationLoadingError) { setError(specificationLoadingError); return; }
    setError("");
    const missingRequiredField = missingRequiredSpecification(specTemplate.fields, form);
    if (missingRequiredField) {
      setError(`Please complete required field: ${missingRequiredField.label}.`);
      return;
    }
    setStep("variants");
  }

  function goToFinal() {
    setError("");
    const hasVariant = variants.some(
      (variant) =>
        variant.sizeLabel.trim() ||
        variant.numericSize.trim() ||
        variant.color.trim() ||
        variant.sku.trim() ||
        Number(variant.stockQuantity || 0) > 0,
    );
    if (!hasVariant) {
      setError("Please add at least one product variant row.");
      return;
    }
    const variantRowErrors = validateVendorVariantRows(variants);
    if (variantRowErrors.length > 0) {
      setError(variantRowErrors[0]);
      return;
    }
    setStep("final");
  }

  if (checkingAccess) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Navbar />
        <main className="flex min-h-[calc(100vh-88px)] items-center justify-center px-4">
          <p className="text-gray-600">Checking vendor approval...</p>
        </main>
      </div>
    );
  }

  if (vendorStatus && vendorStatus !== "APPROVED") {
    return (
      <div className="min-h-screen bg-gray-100">
        <Navbar />
        <main className="mx-auto flex min-h-[calc(100vh-88px)] max-w-3xl items-center px-4 py-10">
          <section className="w-full rounded-2xl bg-white p-8 shadow">
            <span
              className={`inline-flex rounded-full px-4 py-2 text-sm font-bold uppercase tracking-[0.18em] ${
                vendorStatus === "REJECTED"
                  ? "bg-red-100 text-red-700"
                  : "bg-yellow-100 text-yellow-800"
              }`}
            >
              {vendorStatus}
            </span>
            <h1 className="mt-5 text-3xl font-bold">
              {vendorStatus === "REJECTED"
                ? "Your vendor account was rejected."
                : "Your vendor account is waiting for admin approval."}
            </h1>
            <p className="mt-3 text-gray-600">
              Product upload and product management are available only after
              admin approval.
            </p>
            {rejectionReason && (
              <p className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">
                {rejectionReason}
              </p>
            )}
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/vendor/dashboard"
                className="rounded-xl bg-pink-600 px-5 py-3 text-sm font-semibold text-white"
              >
                View Approval Status
              </Link>
              <Link
                href="/"
                className="rounded-xl border px-5 py-3 text-sm font-semibold"
              >
                Go Home
              </Link>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f5fb]">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-4 flex flex-col justify-between gap-3 rounded-2xl bg-white p-5 shadow-sm md:flex-row md:items-center">
          <div>
            <Link
              href="/vendor/dashboard"
              className="text-sm font-bold text-[#4b2bbf]"
            >
              Back to Vendor Dashboard
            </Link>
            <h1 className="mt-2 text-3xl font-black text-slate-950">
              Zylo-Buylo Catalog Upload
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Select category, upload clean product images, add details,
              variants and stock.
            </p>
          </div>
          <div className="rounded-xl border border-[#ddd7ff] bg-[#f8f6ff] px-4 py-3 text-sm font-bold text-[#4b2bbf]">
            QC-ready product upload
          </div>
        </div>

        {mode === "home" && (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                {["Upload catalog", "QC check", "Go live"].map((item, index) => (
                  <div key={item} className="flex items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-[#efe9ff] text-sm font-black text-[#4b2bbf]">
                      {index + 1}
                    </span>
                    <span className="hidden text-sm font-bold text-slate-700 sm:inline">
                      {item}
                    </span>
                  </div>
                ))}
              </div>
              <h2 className="text-xl font-black text-slate-950">
                Choose how you want to upload products
              </h2>
              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode("single");
                    setStep("images");
                  }}
                  className="rounded-2xl border border-[#dcd6ff] bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow"
                >
                  <div className="aspect-[16/8] rounded-xl bg-gradient-to-br from-[#efe9ff] to-[#fff8e7] p-5">
                    <p className="text-sm font-black uppercase text-[#4b2bbf]">
                      Single Catalog
                    </p>
                    <p className="mt-3 text-2xl font-black text-slate-950">
                      Add Single Product
                    </p>
                  </div>
                  <ul className="mt-4 space-y-2 text-sm text-slate-600">
                    <li>One product at a time</li>
                    <li>Image and variant checklist included</li>
                    <li>Best for first upload and testing</li>
                  </ul>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("bulk")}
                  className="rounded-2xl border border-[#dcd6ff] bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow"
                >
                  <div className="aspect-[16/8] rounded-xl bg-gradient-to-br from-[#e8f7ff] to-[#f2fff2] p-5">
                    <p className="text-sm font-black uppercase text-[#135e7a]">
                      Bulk Catalog
                    </p>
                    <p className="mt-3 text-2xl font-black text-slate-950">
                      Prepare Bulk Upload
                    </p>
                  </div>
                  <ul className="mt-4 space-y-2 text-sm text-slate-600">
                    <li>Download template</li>
                    <li>Prepare many products together</li>
                    <li>Bulk submit backend can be added next</li>
                  </ul>
                </button>
              </div>
            </section>

            <aside className="space-y-5">
              <section className="rounded-2xl bg-white p-5 shadow-sm">
                <h3 className="font-black text-slate-950">Quality reminders</h3>
                <div className="mt-4 space-y-3 text-sm text-slate-700">
                  {imageRules.map((rule, index) => (
                    <p key={rule} className="flex gap-3">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#efe9ff] text-xs font-black text-[#4b2bbf]">
                        {index + 1}
                      </span>
                      {rule}
                    </p>
                  ))}
                </div>
              </section>
              <section className="rounded-2xl bg-white p-5 shadow-sm">
                <h3 className="font-black text-slate-950">Useful links</h3>
                <div className="mt-4 grid gap-2 text-sm font-bold">
                  <Link href="/vendor/dashboard/inventory" className="rounded-xl bg-slate-50 p-3">
                    Inventory and stock
                  </Link>
                  <Link href="/vendor/dashboard/payouts" className="rounded-xl bg-slate-50 p-3">
                    Payments and payouts
                  </Link>
                  <Link href="/vendor/dashboard" className="rounded-xl bg-slate-50 p-3">
                    Vendor dashboard
                  </Link>
                </div>
              </section>
            </aside>
          </div>
        )}

        {mode === "bulk" && (
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <button
              type="button"
              onClick={() => setMode("home")}
              className="text-sm font-bold text-[#4b2bbf]"
            >
              Back
            </button>
            <h2 className="mt-4 text-2xl font-black">Bulk Catalog Upload</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Upload a CSV with one product per row. Category and subcategory
              names must match the marketplace categories already configured by
              admin.
            </p>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <button
                type="button"
                onClick={downloadBulkTemplate}
                className="rounded-xl bg-[#4b2bbf] px-5 py-3 text-sm font-bold text-white"
              >
                Download CSV Template
              </button>
              <label className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-3 text-sm font-bold text-slate-600">
                Upload CSV
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(event) => handleBulkCsvFile(event.target.files?.[0] || null)}
                />
              </label>
              <button
                type="button"
                onClick={submitBulkProducts}
                disabled={bulkSubmitting || bulkRows.every((row) => row.status !== "READY")}
                className="rounded-xl bg-pink-600 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {bulkSubmitting ? "Creating products..." : "Submit Valid Rows"}
              </button>
            </div>
            <p className="mt-4 rounded-xl bg-blue-50 p-4 text-sm font-semibold text-blue-800">
              Use pipe-separated image URLs in the Image URLs column. Example:
              https://example.com/front.jpg | https://example.com/side.jpg
            </p>
            {bulkFileName && (
              <p className="mt-4 text-sm font-bold text-slate-700">
                Loaded: {bulkFileName}
              </p>
            )}
            {bulkMessage && (
              <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-700">
                {bulkMessage}
              </p>
            )}
            {bulkRows.length > 0 && (
              <div className="mt-5 overflow-x-auto rounded-xl border">
                <table className="min-w-[900px] w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="p-3">Row</th>
                      <th className="p-3">Product</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Price / Stock</th>
                      <th className="p-3">Images</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkRows.map((row) => (
                      <tr key={row.rowNumber} className="border-t">
                        <td className="p-3 font-bold">{row.rowNumber}</td>
                        <td className="p-3">
                          <p className="font-bold text-slate-900">{row.name || "-"}</p>
                          <p className="text-xs text-slate-500">{row.sku || "No SKU"}</p>
                        </td>
                        <td className="p-3">
                          <p>{row.categoryName || "-"}</p>
                          <p className="text-xs text-slate-500">{row.subcategoryName || "No subcategory"}</p>
                        </td>
                        <td className="p-3">
                          <p>Vendor: Rs. {row.vendorPrice || "0"}</p>
                          <p className="text-xs text-slate-500">Stock: {row.stock || "0"}</p>
                        </td>
                        <td className="p-3">{row.imageUrls.length}</td>
                        <td className="p-3">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-black ${
                              row.status === "CREATED"
                                ? "bg-green-100 text-green-700"
                                : row.status === "ERROR"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {row.status}
                          </span>
                          {row.message && (
                            <p className="mt-1 max-w-xs text-xs text-slate-500">{row.message}</p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {mode === "single" && (
          <form onSubmit={handleSubmit} className="space-y-5">
            {productTypeId && specificationLoadingError && <div role={resolvedSpecifications.error ? "alert" : "status"} className="rounded-xl border bg-amber-50 p-3 text-sm">
              {specificationLoadingError}
              {resolvedSpecifications.error && <button type="button" onClick={resolvedSpecifications.retry} className="ml-3 font-bold underline">Retry specifications</button>}
            </div>}
            <section className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                <div>
                  <button
                    type="button"
                    onClick={() => setMode("home")}
                    className="text-sm font-bold text-[#4b2bbf]"
                  >
                    Back to upload choices
                  </button>
                  <h2 className="mt-2 text-2xl font-black">Add Single Catalog</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    ["images", "1 Images"],
                    ["basic", "2 Basic Info"],
                    ["specs", "3 Size / Specs"],
                    ["variants", "4 Variants"],
                    ["final", "5 Final Submit"],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setStep(key as SingleStep)}
                      className={`rounded-full px-4 py-2 text-sm font-bold ${
                        step === key
                          ? "bg-[#4b2bbf] text-white"
                          : "bg-[#efe9ff] text-[#4b2bbf]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {error && (
              <p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">
                {error}
              </p>
            )}

            {step === "basic" && (
              <section className="rounded-2xl bg-white p-5 shadow-sm">
                <h3 className="text-xl font-black">Basic Product Information</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Add the core product information first. Category and subcategory control the next size/specification step.
                </p>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <input name="title" value={form.title} onChange={handleChange} placeholder="Product Name *" className="rounded-xl border p-3" required />
                  <input name="sku" value={form.sku} onChange={handleChange} placeholder="Main SKU / Style code" className="rounded-xl border p-3" />
                  <input name="brand" value={form.brand} onChange={handleChange} placeholder="Brand" className="rounded-xl border p-3" />
                  <input name="modelNumber" value={form.modelNumber} onChange={handleChange} placeholder="Model Number" className="rounded-xl border p-3" />
                  <input name="partNumber" value={form.partNumber} onChange={handleChange} placeholder="MPN / Part Number" className="rounded-xl border p-3" />
                  <div className="grid gap-2">
                    <select
                      name="productType"
                      value={form.productType}
                      onChange={handleChange}
                      className="rounded-xl border bg-white p-3"
                    >
                      <option value="">Select product type</option>
                      {productTypeOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    <input
                      name="productType"
                      value={form.productType}
                      onChange={handleChange}
                      placeholder="Or type custom product type"
                      className="rounded-xl border p-3 text-sm"
                    />
                  </div>
                  <textarea name="description" value={form.description} onChange={handleChange} placeholder="Short Description" className="h-24 rounded-xl border p-3 md:col-span-2" />
                  <textarea name="searchKeywords" value={form.searchKeywords} onChange={handleChange} placeholder="Search keywords / alternate names" className="h-20 rounded-xl border p-3 md:col-span-2" />
                </div>
                <div className="mt-5">
                  <LanguageAssistPanel
                    title="Product Language Solver"
                    fields={[
                      { key: "title", label: "Product Name", value: form.title },
                      { key: "description", label: "Description", value: form.description },
                      { key: "searchKeywords", label: "Search Keywords", value: form.searchKeywords },
                    ]}
                    onApply={applyLanguageFix}
                  />
                </div>
                <h4 className="mt-8 text-lg font-black">Category & Subcategory</h4>
                <input
                  value={categorySearch}
                  onChange={(event) => setCategorySearch(event.target.value)}
                  placeholder="Search category, e.g. Saree, AC Part, Shampoo"
                  className="mt-4 w-full max-w-xl rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#4b2bbf]"
                />
                <div className="mt-6 grid gap-4 lg:grid-cols-[220px_240px_1fr]">
                  <div className="max-h-[420px] overflow-auto rounded-xl border bg-slate-50">
                    {filteredCategories.map((category) => (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => selectCategory(category.id)}
                        className={`block w-full border-b px-4 py-3 text-left text-sm font-bold ${
                          form.categoryId === category.id
                            ? "bg-[#4b2bbf] text-white"
                            : "bg-white text-slate-800 hover:bg-[#f6f3ff]"
                        }`}
                      >
                        {category.name}
                      </button>
                    ))}
                  </div>
                  <div className="max-h-[420px] overflow-auto rounded-xl border bg-slate-50">
                    {subcategoryOptions.length > 0 ? (
                      subcategoryOptions.map((subcategory) => (
                        <button
                          key={subcategory.id}
                          type="button"
                          onClick={() => selectSubcategory(subcategory.id)}
                          className={`block w-full border-b px-4 py-3 text-left text-sm font-bold ${
                            form.subcategoryId === subcategory.id
                              ? "bg-[#4b2bbf] text-white"
                              : "bg-white text-slate-800 hover:bg-[#f6f3ff]"
                          }`}
                        >
                          {subcategory.name}
                        </button>
                      ))
                    ) : (
                      <p className="p-4 text-sm text-slate-500">
                        {selectedCategory
                          ? "No subcategory required."
                          : "Select main category first."}
                      </p>
                    )}
                  </div>
                  <div className="rounded-xl border bg-[#f8f6ff] p-5">
                    {persistedProductTypes.length > 0 && <label className="mb-4 grid gap-2 text-sm font-bold">Catalog ProductType
                      <select value={productTypeId} onChange={(event) => setProductTypeId(event.target.value)} className="rounded-xl border bg-white p-3">
                        <option value="">Select ProductType (optional)</option>
                        {persistedProductTypes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </select>
                    </label>}
                    <p className="text-sm font-bold text-[#4b2bbf]">
                      Selected path
                    </p>
                    <h4 className="mt-2 text-xl font-black text-slate-950">
                      {[selectedCategory?.name, selectedSubcategory?.name, selectedProductType?.name]
                        .filter(Boolean)
                        .join(" / ") || "No category selected"}
                    </h4>
                    <div className="mt-5 grid gap-3 md:grid-cols-3">
                      <select
                        name="treeMain"
                        value={form.treeMain}
                        onChange={handleChange}
                        className="rounded-xl border bg-white p-3 text-sm"
                      >
                        <option value="">Optional category tree</option>
                        {applianceCategoryTree.map((category) => (
                          <option key={category.slug} value={category.slug}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                      <select
                        name="treeGroup"
                        value={form.treeGroup}
                        onChange={handleChange}
                        disabled={!selectedTreeMain}
                        className="rounded-xl border bg-white p-3 text-sm disabled:bg-slate-100"
                      >
                        <option value="">Group</option>
                        {selectedTreeMain?.groups.map((group) => (
                          <option key={group.slug} value={group.slug}>
                            {group.name}
                          </option>
                        ))}
                      </select>
                      <select
                        name="treePart"
                        value={form.treePart}
                        onChange={handleChange}
                        disabled={!selectedTreeGroup}
                        className="rounded-xl border bg-white p-3 text-sm disabled:bg-slate-100"
                      >
                        <option value="">Item / part</option>
                        {selectedTreeGroup?.parts.map((part) => (
                          <option key={part.slug} value={part.slug}>
                            {part.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="mt-5 rounded-xl bg-white p-4">
                      <p className="text-sm font-black">Image guidance</p>
                      <p className="mt-2 text-sm text-slate-600">
                        For this category, upload a clean front product image
                        first. Extra product/detail images can be added in the
                        next step.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={goToSpecs}
                    className="rounded-xl bg-[#4b2bbf] px-5 py-3 text-sm font-bold text-white"
                  >
                    Continue to Size / Specifications
                  </button>
                </div>
              </section>
            )}

            {step === "images" && (
              <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
                <div className="rounded-2xl bg-white p-5 shadow-sm">
                  <h3 className="text-xl font-black">Add Product Images</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    Minimum 1 and maximum 9 product images. First image should
                    be the clean front image.
                  </p>
                  <div className="mt-5 rounded-2xl border border-dashed border-[#c7befa] bg-[#f8f6ff] p-5">
                    <FileUploadField
                      label={images.length ? "Add more product images" : "Upload front product image"}
                      purpose="product"
                      accept="image/*"
                      onUploaded={appendUploadedImage}
                    />
                  </div>
                  {images.length > 0 && (
                    <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                      {images.slice(0, 9).map((url, index) => (
                        <div key={url} className="rounded-xl border bg-white p-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt={`Product ${index + 1}`}
                            className="h-36 w-full rounded-lg object-cover"
                          />
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <span className="text-xs font-bold">
                              {index === 0 ? "Front Image" : `Image ${index + 1}`}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeImage(url)}
                              className="text-xs font-bold text-red-600"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <textarea
                    name="imageUrls"
                    placeholder="Or paste image URLs, one per line"
                    value={form.imageUrls}
                    onChange={handleChange}
                    className="mt-5 h-24 w-full rounded-xl border p-3 text-sm"
                  />
                  <div className="mt-6 flex flex-wrap justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setMode("home")}
                      className="rounded-xl border px-5 py-3 text-sm font-bold"
                    >
                      Back to Upload Choices
                    </button>
                    <button
                      type="button"
                      onClick={goToBasic}
                      className="rounded-xl bg-[#4b2bbf] px-5 py-3 text-sm font-bold text-white"
                    >
                      Continue to Basic Information
                    </button>
                  </div>
                </div>
                <aside className="space-y-5">
                  <section className="rounded-2xl bg-white p-5 shadow-sm">
                    <h4 className="font-black">Image Guidelines</h4>
                    <div className="mt-4 space-y-3 text-sm text-slate-700">
                      {imageRules.map((rule, index) => (
                        <p key={rule} className="flex gap-3">
                          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#efe9ff] text-xs font-black text-[#4b2bbf]">
                            {index + 1}
                          </span>
                          {rule}
                        </p>
                      ))}
                    </div>
                  </section>
                  <section className="rounded-2xl bg-white p-5 shadow-sm">
                    <h4 className="font-black text-red-700">Not allowed</h4>
                    <div className="mt-4 grid gap-2 text-xs font-bold text-slate-600">
                      {blockedImageTypes.map((item) => (
                        <div key={item} className="rounded-xl bg-red-50 p-3 text-red-700">
                          {item}
                        </div>
                      ))}
                    </div>
                  </section>
                </aside>
              </section>
            )}

            {["specs", "variants", "final"].includes(step) && (
              <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
                <div className="space-y-5">
                  {step === "specs" && (
                  <section className="rounded-2xl bg-white p-5 shadow-sm">
                    <h3 className="text-xl font-black">{specTemplate.title}</h3>
                    {managedTemplate && (
                      <p className="mt-2 w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                        Admin category template active
                      </p>
                    )}
                    <p className="mt-2 rounded-xl bg-blue-50 p-3 text-sm font-semibold text-blue-900">
                      {specTemplate.helpText}
                    </p>
                    {managedTemplate?.sizeChart && (
                      <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">
                        {managedTemplate.sizeChart}
                      </p>
                    )}
                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      {specTemplate.fields.map((field) => (
                        <VendorSpecificationField key={field.name} field={field} value={(form as Record<string, unknown>)[field.name]}
                          onChange={(value) => changeSpecification(field.name, value)} />
                      ))}
                      <input name="availableSizes" value={form.availableSizes} onChange={handleChange} placeholder={variantConfig.availableSizesPlaceholder} className="rounded-xl border p-3" />
                      <input name="color" value={form.color} onChange={handleChange} placeholder="Default color / shade" className="rounded-xl border p-3" />
                    </div>
                  </section>
                  )}

                  {step === "final" && (
                  <>
                  <section className="rounded-2xl bg-white p-5 shadow-sm">
                    <h3 className="text-xl font-black">Pricing, GST and Packaging</h3>
                    <div className="mt-5 grid gap-4 md:grid-cols-3">
                      <input type="number" name="vendorPrice" value={form.vendorPrice} onChange={handleChange} placeholder="Vendor price / payout *" className="rounded-xl border p-3" min="1" required />
                      <input type="number" name="mrp" value={form.mrp} onChange={handleChange} placeholder="MRP" className="rounded-xl border p-3" min="1" />
                      <input type="number" name="discountPercent" value={form.discountPercent} onChange={handleChange} placeholder="Discount %" className="rounded-xl border p-3" min="0" />
                      <select name="gstPercent" value={form.gstPercent} onChange={handleChange} className="rounded-xl border bg-white p-3">
                        <option value="">GST %</option>
                        {["0", "5", "12", "18", "28"].map((gst) => (
                          <option key={gst} value={gst}>
                            {gst}%
                          </option>
                        ))}
                      </select>
                      <select name="hsnCode" value={form.hsnCode} onChange={handleChange} className="rounded-xl border bg-white p-3">
                        <option value="">HSN Code</option>
                        <option value="4202">4202 - Bags, wallets, travel goods</option>
                        <option value="6403">6403 - Leather footwear</option>
                        <option value="6404">6404 - Textile/sports footwear</option>
                        <option value="6205">6205 - Men&apos;s shirts</option>
                        <option value="6109">6109 - T-shirts</option>
                        <option value="3305">3305 - Hair care products</option>
                        <option value="8504">8504 - Electrical parts/adaptors</option>
                      </select>
                      <input type="number" name="platformCommissionPercent" value={form.platformCommissionPercent} onChange={handleChange} placeholder="Commission %" className="rounded-xl border p-3" min="0" />
                      <input type="number" name="weightGrams" value={form.weightGrams} onChange={handleChange} placeholder="Net Weight (grams)" className="rounded-xl border p-3" min="0" />
                      <select name="packageSize" value={form.packageSize} onChange={handleChange} className="rounded-xl border p-3">
                        {PACKAGE_SIZE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <label className="flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold">
                        <input type="checkbox" name="fragile" checked={form.fragile} onChange={handleChange} />
                        Fragile product
                      </label>
                    </div>
                    <div className="mt-5 grid gap-3 rounded-2xl border border-pink-100 bg-pink-50 p-4 text-sm md:grid-cols-5">
                      {[
                        ["Customer price", formatRupees(pricingPreview.finalCustomerPrice)],
                        ["Vendor payout", formatRupees(pricingPreview.vendorPayout)],
                        ["Platform fee", formatRupees(pricingPreview.platformCommissionAmount)],
                        ["Packaging", formatRupees(pricingPreview.packagingCharge)],
                        ["Delivery", formatRupees(pricingPreview.shippingCharge)],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
                          <p className="mt-1 font-black text-slate-950">{value}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                  </>
                  )}

                  {step === "variants" && (
                  <section className="rounded-2xl bg-white p-5 shadow-sm">
                    <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                      <div>
                        <h3 className="text-xl font-black">Product Variants & Stock</h3>
                        <p className="mt-1 text-sm text-slate-600">
                          Vendor yahan real SKU, stock, price aur image rows add karega. Admin template sirf structure aur allowed options deta hai.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={applyVariantTemplate} className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-800">
                          Use Preview Rows (0 Stock)
                        </button>
                        <button type="button" onClick={addVariantRow} className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white">
                          Add Variant Row
                        </button>
                        <button type="button" onClick={autoFixVariantSkus} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-800">
                          Auto-fix SKUs
                        </button>
                      </div>
                    </div>
                    <div className="mt-4 rounded-2xl border border-violet-100 bg-violet-50 p-4 text-sm text-slate-700">
                      <p className="font-black text-violet-900">{structuredVariantConfig.selectedStyle}</p>
                      <p className="mt-1">
                        Admin configured dimensions: {structuredVariantConfig.dimensions.map((dimension) => dimension.label).join(" + ") || "Size + Colour"}.
                        Preview rows are not inventory until vendor fills stock and submits this product.
                      </p>
                      <p className="mt-2 text-xs font-bold text-violet-900">
                        Customer Price = buyer ko dikhne wala variant selling price. Vendor Payout = is variant par vendor ko milne wali amount. Blank chhodne par final pricing page ka default use hoga.
                      </p>
                    </div>
                    <div className="mt-4 grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-2">
                      <div>
                        <p className="text-sm font-black text-slate-900">Generate combinations</p>
                        <div className="mt-3 space-y-3">
                          <div>
                            <p className="text-xs font-bold uppercase text-slate-500">{sizeDimensionConfig.dimension?.label || "Size"}</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {sizeDimensionConfig.options.map((option) => (
                                <button
                                  key={option}
                                  type="button"
                                  onClick={() => toggleVariantValue(option, selectedVariantSizes, setSelectedVariantSizes)}
                                  className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                                    selectedVariantSizes.includes(option)
                                      ? "border-blue-700 bg-blue-700 text-white"
                                      : "border-slate-300 bg-white text-slate-700"
                                  }`}
                                >
                                  {option}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="text-xs font-bold uppercase text-slate-500">{colorDimensionConfig.dimension?.label || "Colour"}</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {colorDimensionConfig.options.map((option) => (
                                <button
                                  key={option}
                                  type="button"
                                  onClick={() => toggleVariantValue(option, selectedVariantColors, setSelectedVariantColors)}
                                  className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                                    selectedVariantColors.includes(option)
                                      ? "border-blue-700 bg-blue-700 text-white"
                                      : "border-slate-300 bg-white text-slate-700"
                                  }`}
                                >
                                  {option}
                                </button>
                              ))}
                            </div>
                          </div>
                          <button type="button" onClick={generateConfiguredVariantRows} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white">
                            Generate Variant Combinations
                          </button>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900">Bulk values</p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {[
                            ["vendorPrice", "Vendor payout"],
                            ["price", "Customer price"],
                            ["mrp", "MRP"],
                            ["weight", "Weight (g)"],
                            ["lowStockThreshold", "Low-stock threshold"],
                          ].map(([field, placeholder]) => (
                            <input
                              key={field}
                              type="number"
                              value={bulkVariantValues[field as keyof typeof bulkVariantValues]}
                              onChange={(event) =>
                                setBulkVariantValues((current) => ({
                                  ...current,
                                  [field]: event.target.value,
                                }))
                              }
                              placeholder={placeholder}
                              className="rounded-xl border bg-white p-3 text-sm"
                              min="0"
                            />
                          ))}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button type="button" onClick={applyBulkVariantValues} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-800">
                            Apply to All
                          </button>
                          <button type="button" onClick={() => updateSelectedVariantRows({ active: true })} className="rounded-xl border border-green-200 bg-green-50 px-4 py-2 text-xs font-bold text-green-800">
                            Activate Selected
                          </button>
                          <button type="button" onClick={() => updateSelectedVariantRows({ active: false })} className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-2 text-xs font-bold text-orange-800">
                            Deactivate Selected
                          </button>
                          <button type="button" onClick={deleteSelectedVariants} className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-700">
                            Delete Selected
                          </button>
                        </div>
                      </div>
                    </div>
                    {duplicateVariantSkus.length > 0 && (
                      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
                        Duplicate variant SKU found: {duplicateVariantSkus.join(", ")}. Click Auto-fix SKUs or edit SKU suffixes before submit.
                      </div>
                    )}
                    <div className="mt-4 space-y-4">
                      {variants.map((variant, index) => {
                        const status = getVariantStatus(variant.stockQuantity, variant.lowStockThreshold);
                        return (
                          <div key={variant.id} className="rounded-2xl border border-slate-200 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={variant.selected}
                                  onChange={(event) => updateVariantRow(variant.id, "selected", event.target.checked)}
                                />
                                Row {index + 1}
                              </label>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`rounded-full px-3 py-1 text-xs font-bold ${getStatusClass(status)}`}>
                                  {status}
                                </span>
                                <label className="flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 text-xs font-bold">
                                  <input
                                    type="checkbox"
                                    checked={variant.active}
                                    onChange={(event) => updateVariantRow(variant.id, "active", event.target.checked)}
                                  />
                                  Active
                                </label>
                                <label className="flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 text-xs font-bold">
                                  <input
                                    type="checkbox"
                                    checked={variant.isDefault}
                                    onChange={(event) =>
                                      event.target.checked
                                        ? setDefaultVariant(variant.id)
                                        : updateVariantRow(variant.id, "isDefault", false)
                                    }
                                  />
                                  Default
                                </label>
                                <button type="button" onClick={() => removeVariantRow(variant.id)} className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
                                  Remove
                                </button>
                              </div>
                            </div>
                            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                              <select
                                value={variant.sizeLabel}
                                onChange={(event) => updateVariantRow(variant.id, "sizeLabel", event.target.value)}
                                className="rounded-xl border bg-white p-3 text-sm"
                              >
                                <option value="">{sizeDimensionConfig.dimension?.label || variantConfig.sizeLabelPlaceholder}</option>
                                {sizeDimensionConfig.options.map((option) => (
                                  <option key={option} value={option}>{option}</option>
                                ))}
                              </select>
                              <input
                                value={variant.numericSize}
                                onChange={(event) => updateVariantRow(variant.id, "numericSize", event.target.value)}
                                placeholder={variantConfig.numericSizePlaceholder}
                                className="rounded-xl border p-3 text-sm"
                              />
                              <input
                                list={`variant-color-options-${variant.id}`}
                                value={variant.color}
                                onChange={(event) => updateVariantRow(variant.id, "color", event.target.value)}
                                placeholder={form.color || colorDimensionConfig.dimension?.label || variantConfig.colorPlaceholder}
                                className="rounded-xl border p-3 text-sm"
                              />
                              <datalist id={`variant-color-options-${variant.id}`}>
                                {colorDimensionConfig.options.map((option) => (
                                  <option key={option} value={option} />
                                ))}
                                {getVariantOptionValues("color", variantConfig).map((option) => (
                                  <option key={`legacy-${option}`} value={option} />
                                ))}
                              </datalist>
                              <input
                                value={variant.sku}
                                onChange={(event) => updateVariantRow(variant.id, "sku", event.target.value)}
                                placeholder={form.sku ? `${form.sku}-SIZE-COLOR` : variantConfig.skuPlaceholder}
                                className="rounded-xl border p-3 text-sm"
                              />
                              <input
                                value={variant.barcode}
                                onChange={(event) => updateVariantRow(variant.id, "barcode", event.target.value)}
                                placeholder="Barcode"
                                className="rounded-xl border p-3 text-sm"
                              />
                              <input
                                type="number"
                                value={variant.stockQuantity}
                                onChange={(event) => updateVariantRow(variant.id, "stockQuantity", event.target.value)}
                                placeholder="Stock"
                                className="rounded-xl border p-3 text-sm"
                                min="0"
                              />
                              <input
                                type="number"
                                value={variant.lowStockThreshold}
                                onChange={(event) => updateVariantRow(variant.id, "lowStockThreshold", event.target.value)}
                                placeholder="Low-stock alert"
                                className="rounded-xl border p-3 text-sm"
                                min="0"
                              />
                              <input
                                type="number"
                                value={variant.price}
                                onChange={(event) => updateVariantRow(variant.id, "price", event.target.value)}
                                placeholder={String(pricingPreview.finalCustomerPrice)}
                                className="rounded-xl border p-3 text-sm"
                                min="0"
                              />
                              <input
                                type="number"
                                value={variant.vendorPrice}
                                onChange={(event) => updateVariantRow(variant.id, "vendorPrice", event.target.value)}
                                placeholder={form.vendorPrice || "Vendor payout"}
                                className="rounded-xl border p-3 text-sm"
                                min="0"
                              />
                              <input
                                type="number"
                                value={variant.mrp}
                                onChange={(event) => updateVariantRow(variant.id, "mrp", event.target.value)}
                                placeholder={form.mrp || "MRP"}
                                className="rounded-xl border p-3 text-sm"
                                min="0"
                              />
                              <input
                                type="number"
                                value={variant.weight}
                                onChange={(event) => updateVariantRow(variant.id, "weight", event.target.value)}
                                placeholder="Weight (g)"
                                className="rounded-xl border p-3 text-sm"
                                min="0"
                              />
                            </div>
                            <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_280px]">
                              <div className="space-y-2">
                                <select
                                  value={variant.imageUrl}
                                  onChange={(event) => updateVariantRow(variant.id, "imageUrl", event.target.value)}
                                  className="w-full rounded-xl border bg-white p-3 text-sm"
                                >
                                  <option value="">Pick from uploaded product images</option>
                                  {images.map((image, imageIndex) => (
                                    <option key={`${image}-${imageIndex}`} value={image}>
                                      {imageIndex === 0 ? "Front image" : `Product image ${imageIndex + 1}`}
                                    </option>
                                  ))}
                                </select>
                                <FileUploadField
                                  label="Upload variant image"
                                  purpose="product"
                                  accept="image/*"
                                  onUploaded={(url) => updateVariantRow(variant.id, "imageUrl", url)}
                                />
                              </div>
                              {variant.imageUrl ? (
                                <div className="rounded-xl border bg-slate-50 p-2">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={variant.imageUrl}
                                    alt={`${variant.color || "Variant"} preview`}
                                    className="h-32 w-full rounded-lg object-cover"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => updateVariantRow(variant.id, "imageUrl", "")}
                                    className="mt-2 text-xs font-bold text-red-600"
                                  >
                                    Remove image
                                  </button>
                                </div>
                              ) : (
                                <div className="rounded-xl bg-slate-50 p-4 text-xs font-semibold text-slate-500">
                                  No variant image selected
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                  )}

                  {step === "specs" && (
                  <section className="rounded-2xl bg-white p-5 shadow-sm">
                    <h3 className="text-xl font-black">Product Details</h3>
                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <select name="condition" value={form.condition} onChange={handleChange} className="rounded-xl border p-3">
                        <option value="NEW">New</option>
                        <option value="REFURBISHED">Refurbished</option>
                        <option value="OPEN_BOX">Open box</option>
                      </select>
                      <input name="warranty" value={form.warranty} onChange={handleChange} placeholder="Warranty" className="rounded-xl border p-3" />
                      <input name="returnPolicy" value={form.returnPolicy} onChange={handleChange} placeholder="Return policy" className="rounded-xl border p-3" />
                      <input name="productType" value={form.productType} onChange={handleChange} placeholder="Product type / occasion / use" className="rounded-xl border p-3" />
                      <textarea name="fitment" value={form.fitment} onChange={handleChange} placeholder="Extra compatibility / fitment / size guide note" className="h-24 rounded-xl border p-3 md:col-span-2" />
                    </div>
                  </section>
                  )}

                  {step === "final" && (
                  <>
                  <section className="rounded-2xl bg-white p-5 shadow-sm">
                    <h3 className="text-xl font-black">Compliance / Manufacturer Details</h3>
                    <p className="mt-2 rounded-xl bg-yellow-50 p-3 text-sm font-semibold text-yellow-900">
                      For toys, electronics, safety items, food, cosmetics, health or branded products,
                      upload the applicable BIS/FSSAI/safety/brand/warranty proof. Missing documents
                      may delay approval or payout.
                    </p>
                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <input name="manufacturerName" value={form.manufacturerName} onChange={handleChange} placeholder="Manufacturer Name" className="rounded-xl border p-3" />
                      <input name="manufacturerAddress" value={form.manufacturerAddress} onChange={handleChange} placeholder="Manufacturer Address" className="rounded-xl border p-3" />
                      <input name="packerName" value={form.packerName} onChange={handleChange} placeholder="Packer Name" className="rounded-xl border p-3" />
                      <input name="packerAddress" value={form.packerAddress} onChange={handleChange} placeholder="Packer Address" className="rounded-xl border p-3" />
                      <input name="countryOfOrigin" value={form.countryOfOrigin} onChange={handleChange} placeholder="Country of Origin" className="rounded-xl border p-3" />
                    </div>
                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <FileUploadField
                        label="BIS / ISI / Safety certificate"
                        purpose="kyc"
                        onUploaded={(url) => setForm((current) => ({ ...current, bisCertificateUrl: url }))}
                      />
                      <FileUploadField
                        label="FSSAI / food license"
                        purpose="kyc"
                        onUploaded={(url) => setForm((current) => ({ ...current, fssaiLicenseUrl: url }))}
                      />
                      <FileUploadField
                        label="Brand authorization"
                        purpose="kyc"
                        onUploaded={(url) => setForm((current) => ({ ...current, brandAuthorizationUrl: url }))}
                      />
                      <FileUploadField
                        label="Warranty / product certificate"
                        purpose="kyc"
                        onUploaded={(url) => setForm((current) => ({ ...current, warrantyDocumentUrl: url }))}
                      />
                    </div>
                  </section>

                  <section className="rounded-2xl bg-white p-5 shadow-sm">
                    <h3 className="text-xl font-black">Final QC Checklist</h3>
                    <div className="mt-4 grid gap-3 text-sm font-semibold text-slate-700 md:grid-cols-2">
                      {[
                        "Front image is clean and correct",
                        "Category and subcategory are correct",
                        "Variant stock and SKU rows are added",
                        "Customer price, GST and packaging are checked",
                        "Warranty and return policy are correct",
                        "Manufacturer/packer details are filled where needed",
                        "MRP, net quantity, country of origin and pack details are correct",
                        "Required BIS/FSSAI/brand/safety documents are uploaded where applicable",
                      ].map((item) => (
                        <label key={item} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                          <input type="checkbox" className="h-4 w-4" />
                          {item}
                        </label>
                      ))}
                    </div>
                  </section>
                  </>
                  )}

                  <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-4 shadow-xl">
                    {step === "specs" && (
                      <>
                        <button type="button" onClick={() => setStep("basic")} className="rounded-xl border px-5 py-3 text-sm font-bold">
                          Back to Basic Info
                        </button>
                        <button type="button" onClick={goToVariants} className="rounded-xl bg-[#4b2bbf] px-6 py-3 text-sm font-black text-white">
                          Continue to Variants
                        </button>
                      </>
                    )}
                    {step === "variants" && (
                      <>
                        <button type="button" onClick={() => setStep("specs")} className="rounded-xl border px-5 py-3 text-sm font-bold">
                          Back to Size / Specs
                        </button>
                        <button type="button" onClick={goToFinal} className="rounded-xl bg-[#4b2bbf] px-6 py-3 text-sm font-black text-white">
                          Continue to Pricing & Submit
                        </button>
                      </>
                    )}
                    {step === "final" && (
                      <>
                        <button type="button" onClick={() => setStep("variants")} className="rounded-xl border px-5 py-3 text-sm font-bold">
                          Save and Go Back
                        </button>
                        <button type="submit" disabled={loading} className="rounded-xl bg-[#4b2bbf] px-6 py-3 text-sm font-black text-white disabled:opacity-60">
                          {loading ? "Submitting..." : "Submit Catalog"}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <aside className="space-y-5">
                  <LanguageAssistPanel
                    title="Vendor Language Solver"
                    fields={[
                      { key: "title", label: "Product Name", value: form.title },
                      { key: "description", label: "Description", value: form.description },
                      { key: "searchKeywords", label: "Search Keywords", value: form.searchKeywords },
                      { key: "fitment", label: "Compatibility / Fitment", value: form.fitment },
                      { key: "returnPolicy", label: "Return Policy", value: form.returnPolicy },
                    ]}
                    onApply={applyLanguageFix}
                  />
                  <section className="rounded-2xl bg-white p-5 shadow-sm">
                    <h4 className="font-black">Uploaded Images</h4>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      {images.slice(0, 6).map((url, index) => (
                        <div key={url} className="rounded-xl border p-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt="" className="h-24 w-full rounded-lg object-cover" />
                          <p className="mt-1 text-xs font-bold">{index === 0 ? "Front Image" : `Image ${index + 1}`}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                  <section className="rounded-2xl bg-yellow-50 p-5 shadow-sm">
                    <h4 className="font-black text-yellow-900">Quality Check</h4>
                    <p className="mt-2 text-sm leading-6 text-yellow-800">
                      Products should have correct category, clean image, price,
                      GST/HSN where applicable, stock rows and useful description.
                    </p>
                  </section>
                </aside>
              </section>
            )}
          </form>
        )}
      </main>
    </div>
  );
}
