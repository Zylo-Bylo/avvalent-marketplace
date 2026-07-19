export type VariantDimensionConfig = {
  key: string;
  label: string;
  type: 'dropdown' | 'color' | 'text' | 'number';
  required: boolean;
  vendorEditable: boolean;
  customerVisible: boolean;
  filterable: boolean;
  affectsSku: boolean;
  affectsStock: boolean;
  affectsPrice: boolean;
  imageMapping?: boolean;
  options: string[];
};

export type VariantRowFieldConfig = {
  enabled: boolean;
  required?: boolean;
  unique?: boolean;
  vendorEditable?: boolean;
  adminEditable?: boolean;
  customerVisible?: boolean;
  min?: number;
  max?: number;
  default?: string | number | boolean;
  integer?: boolean;
  unit?: string;
  onlyOne?: boolean;
  validationMessage?: string;
};

export type VariantTemplatePreviewRow = {
  size?: string;
  color?: string;
  label?: string;
};

export type StructuredVariantConfig = {
  title: string;
  note: string;
  selectedStyle: string;
  dimensions: VariantDimensionConfig[];
  rowFields: Record<string, VariantRowFieldConfig>;
  combinationRules: {
    uniqueDimensionCombination: boolean;
    uniqueSku: boolean;
    onlyOneDefault: boolean;
    stockCannotBeNegative: boolean;
    priceCannotExceedMrp: boolean;
    weightMustBePositive: boolean;
  };
  examplePreview: VariantTemplatePreviewRow[];
  examples?: VariantTemplatePreviewRow[];
};

export const defaultVariantRowFields: Record<string, VariantRowFieldConfig> = {
  sku: {
    enabled: true,
    required: true,
    unique: true,
    vendorEditable: true,
    adminEditable: true,
    customerVisible: false,
    validationMessage: 'SKU is required and must be unique.',
  },
  barcode: {
    enabled: true,
    required: false,
    vendorEditable: true,
    adminEditable: true,
    customerVisible: false,
  },
  stock: {
    enabled: true,
    required: true,
    min: 0,
    integer: true,
    vendorEditable: true,
    adminEditable: true,
    customerVisible: false,
    validationMessage: 'Stock must be a non-negative whole number.',
  },
  lowStockAlert: {
    enabled: true,
    required: false,
    default: 3,
    min: 0,
    integer: true,
    vendorEditable: true,
    adminEditable: true,
    customerVisible: false,
  },
  price: {
    enabled: true,
    required: true,
    min: 0,
    vendorEditable: true,
    adminEditable: true,
    customerVisible: true,
    validationMessage: 'Selling price cannot exceed MRP.',
  },
  mrp: {
    enabled: true,
    required: true,
    min: 0,
    vendorEditable: true,
    adminEditable: true,
    customerVisible: true,
  },
  weight: {
    enabled: true,
    required: true,
    min: 1,
    unit: 'g',
    vendorEditable: true,
    adminEditable: true,
    customerVisible: false,
    validationMessage: 'Weight must be greater than zero.',
  },
  variantImage: {
    enabled: true,
    required: false,
    vendorEditable: true,
    adminEditable: true,
    customerVisible: true,
    validationMessage: 'Variant image can be uploaded or selected from product images.',
  },
  active: {
    enabled: true,
    default: true,
    vendorEditable: true,
    adminEditable: true,
    customerVisible: false,
  },
  isDefault: {
    enabled: true,
    default: false,
    onlyOne: true,
    vendorEditable: true,
    adminEditable: true,
    customerVisible: false,
    validationMessage: 'Only one variant row may be default.',
  },
};

export const tshirtVariantConfig: StructuredVariantConfig = {
  title: 'Variant Configuration',
  note: 'Admin configures variant dimensions, row fields, and validation. Vendors enter actual product variant stock during upload.',
  selectedStyle: 'Template configuration only',
  dimensions: [
    {
      key: 'size',
      label: 'Size',
      type: 'dropdown',
      required: true,
      vendorEditable: true,
      customerVisible: true,
      filterable: true,
      affectsSku: true,
      affectsStock: true,
      affectsPrice: true,
      options: ['S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL'],
    },
    {
      key: 'color',
      label: 'Colour',
      type: 'color',
      required: true,
      vendorEditable: true,
      customerVisible: true,
      filterable: true,
      affectsSku: true,
      affectsStock: true,
      affectsPrice: true,
      imageMapping: true,
      options: ['Black', 'White', 'Navy Blue', 'Grey', 'Red', 'Green', 'Maroon', 'Yellow'],
    },
  ],
  rowFields: defaultVariantRowFields,
  combinationRules: {
    uniqueDimensionCombination: true,
    uniqueSku: true,
    onlyOneDefault: true,
    stockCannotBeNegative: true,
    priceCannotExceedMrp: true,
    weightMustBePositive: true,
  },
  examplePreview: [
    { size: 'M', color: 'Navy Blue' },
    { size: 'L', color: 'Navy Blue' },
    { size: 'M', color: 'White' },
  ],
};

type LegacyVariantConfig = Partial<StructuredVariantConfig> & {
  examples?: Array<{
    sizeLabel?: string;
    numericSize?: string;
    color?: string;
    sku?: string;
    stockQuantity?: string;
    price?: string;
    mrp?: string;
  }>;
};

export function normalizeStructuredVariantConfig(
  input?: LegacyVariantConfig | null,
): StructuredVariantConfig {
  const rawPreviewRows = (input?.examplePreview || input?.examples || []) as Array<{
    size?: string;
    sizeLabel?: string;
    numericSize?: string;
    color?: string;
    label?: string;
  }>;
  const legacyPreview = rawPreviewRows
    .map((row) => ({
      size: row.size || row.sizeLabel || row.numericSize || '',
      color: row.color || '',
      label: row.label || [row.sizeLabel || row.numericSize, row.color].filter(Boolean).join(' + '),
    }))
    .filter((row) => row.size || row.color || row.label);

  return {
    ...tshirtVariantConfig,
    ...input,
    title: input?.title || 'Variant Configuration',
    note:
      input?.note ||
      'Admin configures variant dimensions, row fields, and validation. Vendors enter actual stock rows during product upload.',
    selectedStyle: input?.selectedStyle || 'Template configuration only',
    dimensions: input?.dimensions?.length ? input.dimensions : tshirtVariantConfig.dimensions,
    rowFields: {
      ...defaultVariantRowFields,
      ...(input?.rowFields || {}),
    },
    combinationRules: {
      ...tshirtVariantConfig.combinationRules,
      ...(input?.combinationRules || {}),
    },
    examplePreview: legacyPreview.length ? legacyPreview : tshirtVariantConfig.examplePreview,
    examples: legacyPreview.length ? legacyPreview : tshirtVariantConfig.examplePreview,
  };
}

export function validateStructuredVariantConfig(config: StructuredVariantConfig) {
  const errors: string[] = [];
  const keys = config.dimensions.map((dimension) => dimension.key.trim().toLowerCase());
  if (!config.dimensions.length) errors.push('At least one variant dimension is required.');
  if (new Set(keys).size !== keys.length) errors.push('Duplicate variant dimension keys are not allowed.');
  for (const dimension of config.dimensions) {
    if (!dimension.key.trim()) errors.push('Every variant dimension needs a key.');
    if (!dimension.label.trim()) errors.push(`Dimension ${dimension.key || 'unknown'} needs a label.`);
    if ((dimension.type === 'dropdown' || dimension.type === 'color') && !dimension.options.filter(Boolean).length) {
      errors.push(`${dimension.label || dimension.key} needs at least one allowed option.`);
    }
  }
  const enabledRequiredFields = Object.entries(config.rowFields).filter(
    ([, field]) => field.enabled && field.required,
  );
  if (!enabledRequiredFields.length) errors.push('At least one required vendor row field must be configured.');
  return errors;
}

export type GeneratedVendorVariant = {
  sizeLabel: string;
  color: string;
  sku: string;
  stockQuantity: string;
  lowStockThreshold: string;
  price: string;
  vendorPrice: string;
  mrp: string;
  imageUrl: string;
  numericSize: string;
  barcode: string;
  weight: string;
  active: boolean;
  isDefault: boolean;
};

export function generateVariantCombinations(input: {
  sizes: string[];
  colors: string[];
  baseSku?: string;
  lowStockAlert?: string;
}): GeneratedVendorVariant[] {
  const rows: GeneratedVendorVariant[] = [];
  const sizes = input.sizes.map((item) => item.trim()).filter(Boolean);
  const colors = input.colors.map((item) => item.trim()).filter(Boolean);
  for (const size of sizes) {
    for (const color of colors) {
      const skuParts = [input.baseSku, size, color]
        .filter(Boolean)
        .map((item) => String(item).toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, ''));
      rows.push({
        sizeLabel: size,
        numericSize: size,
        color,
        sku: skuParts.join('-'),
        stockQuantity: '0',
        lowStockThreshold: input.lowStockAlert || '3',
        price: '',
        vendorPrice: '',
        mrp: '',
        imageUrl: '',
        barcode: '',
        weight: '',
        active: true,
        isDefault: rows.length === 0,
      });
    }
  }
  return rows;
}

export function validateVendorVariantRows(
  rows: Array<Partial<GeneratedVendorVariant>>,
) {
  const errors: string[] = [];
  const combinations = new Set<string>();
  const skus = new Set<string>();
  let defaultCount = 0;

  for (const [index, row] of rows.entries()) {
    const label = `Row ${index + 1}`;
    const comboSize = String(row.sizeLabel || '').trim();
    const comboColor = String(row.color || '').trim();
    const combo = `${comboSize}::${comboColor}`.toLowerCase();
    if (comboSize || comboColor) {
      if (combinations.has(combo)) errors.push(`${label}: duplicate Size + Colour combination.`);
      combinations.add(combo);
    }

    const sku = String(row.sku || '').trim().toLowerCase();
    if (sku) {
      if (skus.has(sku)) errors.push(`${label}: duplicate SKU.`);
      skus.add(sku);
    }

    if (Number(row.stockQuantity || 0) < 0) errors.push(`${label}: stock cannot be negative.`);
    if (Number(row.price || 0) > Number(row.mrp || 0) && Number(row.mrp || 0) > 0) {
      errors.push(`${label}: selling price cannot exceed MRP.`);
    }
    if (row.weight !== undefined && row.weight !== '' && Number(row.weight) <= 0) {
      errors.push(`${label}: weight must be greater than zero.`);
    }
    if (row.isDefault) defaultCount += 1;
  }

  if (defaultCount > 1) errors.push('Only one default variant is allowed.');
  return errors;
}
