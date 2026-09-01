import {
  hasSizeGuideContent,
  normalizeCategorySizeGuide,
  normalizeSizeGuideKey,
} from '@/lib/category-size-guide';

export type AtelierCategorySummary = {
  id: string;
  name: string;
  slug: string;
  status?: string;
  sortOrder?: number;
  subcategories?: Array<{
    id: string;
    name: string;
    slug: string;
    status?: string;
    sortOrder?: number;
    productTypes?: Array<{ id: string; name: string; slug: string }>;
  }>;
};

export type AtelierSpecFieldSummary = {
  name: string;
  label: string;
  fieldType: string;
  required?: boolean;
  dropdownValues?: string[];
  filterable?: boolean;
};

export type AtelierVariantSummary = {
  sku?: string;
  price?: string;
  mrp?: string;
  stock?: string;
};

export type AtelierBusinessRulesSummary = {
  returnAllowed: boolean;
  returnWindow: string;
  returnReasons?: string;
  nonReturnable: boolean;
  nonReturnableReason?: string;
  replacementWindow?: string;
  installationRequired: boolean;
  installationDetails?: string;
  warrantyRequired: boolean;
  warrantyDuration?: string;
};

export type AtelierValidationInput = {
  categoryId?: string;
  name: string;
  slug: string;
  sortOrder?: string | number;
  homepageIcon?: string;
  categoryImage?: string;
  desktopBanner?: string;
  mobileBanner?: string;
  productTypes: string[];
  specs: AtelierSpecFieldSummary[];
  variants: AtelierVariantSummary[];
  sizeGuideRows: unknown;
  businessRules: AtelierBusinessRulesSummary;
  categories: AtelierCategorySummary[];
};

export type AtelierValidationIssue = {
  tab:
    | 'metadata'
    | 'product-types'
    | 'specifications'
    | 'variants'
    | 'size-guide'
    | 'business-rules'
    | 'customer-filters';
  field?: string;
  message: string;
  severity: 'error' | 'warning';
};

export type AtelierNodeType = 'category' | 'subcategory' | 'productType';

export function resolveAtelierNode(
  categories: AtelierCategorySummary[],
  nodeType: AtelierNodeType,
  nodeId: string,
) {
  for (const category of categories) {
    if (nodeType === 'category' && category.id === nodeId) {
      return {
        entity: category,
        entityType: nodeType,
        breadcrumb: category.name,
        parentName: '',
        categoryId: category.id,
        subcategoryId: '',
        productTypeId: '',
      };
    }

    for (const subcategory of category.subcategories || []) {
      if (nodeType === 'subcategory' && subcategory.id === nodeId) {
        return {
          entity: subcategory,
          entityType: nodeType,
          breadcrumb: `${category.name} > ${subcategory.name}`,
          parentName: category.name,
          categoryId: category.id,
          subcategoryId: subcategory.id,
          productTypeId: '',
        };
      }

      for (const productType of subcategory.productTypes || []) {
        if (nodeType === 'productType' && productType.id === nodeId) {
          return {
            entity: productType,
            entityType: nodeType,
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

export function selectedAndLoadedEntityMatch(input: {
  selectedNodeId: string;
  selectedNodeType: AtelierNodeType;
  loadedEntityId: string;
  loadedEntityType: AtelierNodeType | '';
}) {
  return (
    input.selectedNodeId === input.loadedEntityId &&
    input.selectedNodeType === input.loadedEntityType
  );
}

export const atelierTabs = [
  'metadata',
  'product-types',
  'specifications',
  'variants',
  'size-guide',
  'business-rules',
  'customer-filters',
  'preview',
  'audit-log',
] as const;

export type AtelierTab = (typeof atelierTabs)[number];

export function normalizeAtelierSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getValidAtelierTab(value: string | null | undefined): AtelierTab {
  return atelierTabs.includes(value as AtelierTab) ? (value as AtelierTab) : 'metadata';
}

export function buildAtelierQuery(input: {
  categoryId?: string;
  subcategoryId?: string;
  productTypeId?: string;
  tab: AtelierTab;
}) {
  const params = new URLSearchParams();
  if (input.categoryId) params.set('categoryId', input.categoryId);
  if (input.subcategoryId) params.set('subcategoryId', input.subcategoryId);
  if (input.productTypeId) params.set('productTypeId', input.productTypeId);
  params.set('tab', input.tab);
  return `/admin/categories?${params.toString()}`;
}

function hasDuplicates(values: string[]) {
  const seen = new Set<string>();
  for (const value of values) {
    const key = value.trim().toLowerCase();
    if (!key) continue;
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}

function getRawSizeGuideFields(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return [];
  const fields = (input as { fields?: unknown }).fields;
  return Array.isArray(fields) ? fields : [];
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export function validateCategoryMetadata(
  input: Pick<AtelierValidationInput, 'categoryId' | 'name' | 'slug' | 'categories'>,
) {
  const issues: AtelierValidationIssue[] = [];
  const slug = normalizeAtelierSlug(input.slug);

  if (!input.name.trim()) {
    issues.push({
      tab: 'metadata',
      field: 'name',
      message: 'Name is required.',
      severity: 'error',
    });
  }

  if (!slug) {
    issues.push({
      tab: 'metadata',
      field: 'slug',
      message: 'Slug is required.',
      severity: 'error',
    });
  }

  if (input.slug && input.slug !== slug) {
    issues.push({
      tab: 'metadata',
      field: 'slug',
      message: `Slug will be saved as "${slug}".`,
      severity: 'warning',
    });
  }

  const duplicate = input.categories.some(
    (category) => category.id !== input.categoryId && normalizeAtelierSlug(category.slug) === slug,
  );
  if (duplicate) {
    issues.push({
      tab: 'metadata',
      field: 'slug',
      message: 'Another category already uses this slug.',
      severity: 'error',
    });
  }

  return issues;
}

export function validateAtelierForPublish(input: AtelierValidationInput) {
  const issues = validateCategoryMetadata(input);
  const productTypes = input.productTypes.map((item) => item.trim()).filter(Boolean);
  const fieldKeys = input.specs.map((field) => field.name.trim()).filter(Boolean);
  const variantSkus = input.variants.map((variant) => String(variant.sku || '').trim()).filter(Boolean);
  const returnDays = Number(input.businessRules.returnWindow || 0);
  const replacementDays = Number(input.businessRules.replacementWindow || 0);

  if (productTypes.length === 0) {
    issues.push({
      tab: 'product-types',
      field: 'productTypes',
      message: 'At least one product type is required.',
      severity: 'error',
    });
  }

  if (hasDuplicates(productTypes)) {
    issues.push({
      tab: 'product-types',
      field: 'productTypes',
      message: 'Duplicate product-type names are not allowed.',
      severity: 'error',
    });
  }

  if (input.specs.length === 0 || !input.specs.some((field) => field.required)) {
    issues.push({
      tab: 'specifications',
      field: 'specifications',
      message: 'At least one required specification field is needed.',
      severity: 'error',
    });
  }

  if (hasDuplicates(fieldKeys)) {
    issues.push({
      tab: 'specifications',
      field: 'specifications',
      message: 'Duplicate specification field keys are not allowed.',
      severity: 'error',
    });
  }

  for (const field of input.specs) {
    const needsOptions = field.fieldType === 'Dropdown' || field.fieldType === 'Multi-select';
    if (needsOptions && !field.dropdownValues?.filter(Boolean).length) {
      issues.push({
        tab: 'specifications',
        field: field.name,
        message: `${field.label || field.name} needs dropdown options.`,
        severity: 'error',
      });
    }
  }

  if (input.variants.length === 0) {
    issues.push({
      tab: 'variants',
      field: 'variants',
      message: 'At least one variant row is required.',
      severity: 'error',
    });
  }

  const rawSizeGuideFields = getRawSizeGuideFields(input.sizeGuideRows);
  const rawSizeGuideFieldKeys = rawSizeGuideFields.map((field) => {
    const row = field as { key?: unknown; name?: unknown; label?: unknown };
    if (Object.prototype.hasOwnProperty.call(row, 'key')) {
      return normalizeSizeGuideKey(text(row.key));
    }
    return normalizeSizeGuideKey(text(row.name) || text(row.label));
  });
  const rawSizeGuideFieldLabels = rawSizeGuideFields
    .map((field) => text((field as { label?: unknown })?.label))
    .filter(Boolean);
  const sizeGuide = normalizeCategorySizeGuide(input.sizeGuideRows);
  const sizeGuideFieldKeys = sizeGuide.fields.map((field) => normalizeSizeGuideKey(field.key));
  if (!sizeGuide.fields.length || !hasSizeGuideContent(sizeGuide)) {
    issues.push({
      tab: 'size-guide',
      field: 'sizeGuide',
      message: 'Add category-specific size guide fields and at least one measurement row.',
      severity: 'error',
    });
  }

  if (rawSizeGuideFields.some((_, index) => !rawSizeGuideFieldKeys[index])) {
    issues.push({
      tab: 'size-guide',
      field: 'sizeGuide',
      message: 'Size guide field keys cannot be empty.',
      severity: 'error',
    });
  }

  if (hasDuplicates(rawSizeGuideFieldKeys) || hasDuplicates(sizeGuideFieldKeys)) {
    issues.push({
      tab: 'size-guide',
      field: 'sizeGuide',
      message: 'Duplicate size guide field keys are not allowed.',
      severity: 'error',
    });
  }

  if (hasDuplicates(rawSizeGuideFieldLabels)) {
    issues.push({
      tab: 'size-guide',
      field: 'sizeGuide',
      message: 'Duplicate size guide field labels are not allowed.',
      severity: 'error',
    });
  }

  for (const row of sizeGuide.rows) {
    for (const field of sizeGuide.fields) {
      if (field.required && !String(row.values[field.key] || '').trim()) {
        issues.push({
          tab: 'size-guide',
          field: field.key,
          message: `${field.label || field.key} is required in every size guide row.`,
          severity: 'error',
        });
        break;
      }
    }
  }

  if (hasDuplicates(variantSkus)) {
    issues.push({
      tab: 'variants',
      field: 'sku',
      message: 'Duplicate variant SKUs are not allowed.',
      severity: 'error',
    });
  }

  if (!input.specs.some((field) => field.filterable)) {
    issues.push({
      tab: 'customer-filters',
      field: 'filters',
      message: 'Select at least one customer filter.',
      severity: 'error',
    });
  }

  if (input.businessRules.returnAllowed && input.businessRules.nonReturnable) {
    issues.push({
      tab: 'business-rules',
      field: 'returnAllowed',
      message: 'Return Allowed and Non-Returnable cannot both be enabled.',
      severity: 'error',
    });
  }

  if (input.businessRules.returnAllowed) {
    if (!input.businessRules.returnWindow || returnDays <= 0) {
      issues.push({
        tab: 'business-rules',
        field: 'returnWindow',
        message: 'Return window must be greater than zero.',
        severity: 'error',
      });
    }
    if (!input.businessRules.returnReasons?.trim()) {
      issues.push({
        tab: 'business-rules',
        field: 'returnReasons',
        message: 'Return reasons are required when returns are allowed.',
        severity: 'error',
      });
    }
  }

  if (input.businessRules.nonReturnable && !input.businessRules.nonReturnableReason?.trim()) {
    issues.push({
      tab: 'business-rules',
      field: 'nonReturnableReason',
      message: 'A non-returnable reason is required.',
      severity: 'error',
    });
  }

  if (replacementDays < 0 || returnDays < 0) {
    issues.push({
      tab: 'business-rules',
      field: 'returnWindow',
      message: 'Return and replacement days cannot be negative.',
      severity: 'error',
    });
  }

  if (replacementDays > returnDays && input.businessRules.returnAllowed) {
    issues.push({
      tab: 'business-rules',
      field: 'replacementWindow',
      message: 'Replacement days cannot exceed return days.',
      severity: 'error',
    });
  }

  if (input.businessRules.warrantyRequired && !input.businessRules.warrantyDuration?.trim()) {
    issues.push({
      tab: 'business-rules',
      field: 'warrantyDuration',
      message: 'Warranty duration is required.',
      severity: 'error',
    });
  }

  if (input.businessRules.installationRequired && !input.businessRules.installationDetails?.trim()) {
    issues.push({
      tab: 'business-rules',
      field: 'installationDetails',
      message: 'Installation details are required.',
      severity: 'error',
    });
  }

  return issues;
}

export function completionFromIssues(issues: AtelierValidationIssue[]) {
  const sections = new Set<AtelierTab>([
    'metadata',
    'product-types',
    'specifications',
    'variants',
    'size-guide',
    'business-rules',
    'customer-filters',
  ]);
  for (const issue of issues) {
    if (issue.severity === 'error') sections.delete(issue.tab);
  }
  return Math.round((sections.size / 7) * 100);
}
