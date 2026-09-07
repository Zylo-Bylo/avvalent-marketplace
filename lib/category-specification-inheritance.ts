import type { VendorSpecField } from '@/lib/vendor-specifications';

export type SpecificationScope = {
  categoryId: string;
  subcategoryId?: string | null;
  productTypeId?: string | null;
};

export type SpecificationInheritance = {
  version: 1;
  enabled: boolean;
  source?: { categoryId: string; subcategoryId: string };
  excludedKeys: string[];
  provideToProductTypes: boolean;
};

export type PublishedSpecifications = {
  version: 1;
  publishedAt: string;
  fields: VendorSpecField[];
  provideToProductTypes: boolean;
};

export type SpecificationDocument = {
  fields: VendorSpecField[];
  inheritance?: SpecificationInheritance;
  publishedSpecifications?: PublishedSpecifications;
  templateMeta?: Record<string, unknown>;
};

export type SpecificationHierarchy = {
  category: { id: string };
  subcategory: { id: string; categoryId: string };
  productType?: { id: string; subcategoryId: string };
};

export class SpecificationInheritanceError extends Error {
  constructor(message: string, public readonly code = 'INVALID_SPECIFICATION_INHERITANCE') {
    super(message);
    this.name = 'SpecificationInheritanceError';
  }
}

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new SpecificationInheritanceError(message);
}

function validKey(key: unknown): asserts key is string {
  check(typeof key === 'string' && Boolean(key.trim()) && key === key.trim(), 'Field keys must be nonblank and must not contain surrounding whitespace.');
}

export function validateSpecificationFields(fields: VendorSpecField[]) {
  check(Array.isArray(fields), 'Specification fields must be an array.');
  const names = new Set<string>();
  for (const field of fields) {
    check(field && typeof field === 'object', 'Invalid specification field.');
    validKey(field.name);
    const canonical = field.name.toLowerCase();
    check(!names.has(canonical), `Duplicate or case-colliding specification key: ${field.name}.`);
    names.add(canonical);
  }
}

export function validateSpecificationScope(scope: SpecificationScope, hierarchy: SpecificationHierarchy) {
  check(Boolean(scope.categoryId) && Boolean(scope.subcategoryId), 'A Category and Subcategory scope is required.');
  check(hierarchy.category.id === scope.categoryId && hierarchy.subcategory.id === scope.subcategoryId && hierarchy.subcategory.categoryId === scope.categoryId, 'Subcategory does not belong to the specified Category.');
  if (scope.productTypeId) {
    check(hierarchy.productType?.id === scope.productTypeId && hierarchy.productType.subcategoryId === scope.subcategoryId, 'ProductType does not belong to the specified Subcategory.');
  }
}

export function validateSpecificationInheritance(metadata: SpecificationInheritance, scope: SpecificationScope) {
  check(metadata && typeof metadata === 'object' && metadata.version === 1, 'Unsupported specification inheritance version.');
  check(typeof metadata.enabled === 'boolean' && typeof metadata.provideToProductTypes === 'boolean', 'Inheritance switches must be booleans.');
  check(Boolean(scope.subcategoryId), 'Category-level specification inheritance is not supported.');
  check(Array.isArray(metadata.excludedKeys), 'Excluded keys must be an array.');
  const keys = new Set<string>();
  for (const key of metadata.excludedKeys) {
    validKey(key);
    check(!keys.has(key.toLowerCase()), `Duplicate or case-colliding exclusion: ${key}.`);
    keys.add(key.toLowerCase());
  }
  if (metadata.source !== undefined) {
    const source = metadata.source;
    check(source && typeof source === 'object' && Object.keys(source).every((key) => key === 'categoryId' || key === 'subcategoryId'), 'Source must be a Subcategory scope, never a ProductType or recursive reference.');
    check(Boolean(scope.productTypeId) && source.categoryId === scope.categoryId && source.subcategoryId === scope.subcategoryId, 'Source must be the immediate Subcategory in the same Category.');
  }
  if (metadata.enabled) check(Boolean(scope.productTypeId) && Boolean(metadata.source), 'Only a ProductType may inherit from its immediate Subcategory.');
  if (scope.productTypeId) check(!metadata.provideToProductTypes, 'A ProductType cannot provide specifications to another ProductType.');
  else check(!metadata.enabled && metadata.excludedKeys.length === 0 && metadata.source === undefined, 'Subcategory templates may provide local specifications only.');
}

export type ResolvedSpecifications = {
  fields: VendorSpecField[];
  provenance: Array<{ name: string; origin: 'inherited' | 'local' | 'override'; source: SpecificationScope }>;
  inheritanceApplied: boolean;
};

function ordered(fields: VendorSpecField[]) {
  return fields.map((field, index) => ({ field, index }))
    .sort((a, b) => (Number.isFinite(a.field.displayOrder) ? a.field.displayOrder! : a.index + 1) - (Number.isFinite(b.field.displayOrder) ? b.field.displayOrder! : b.index + 1) || a.index - b.index)
    .map(({ field }) => field);
}

export function resolveCategorySpecifications(input: {
  scope: SpecificationScope;
  hierarchy?: SpecificationHierarchy;
  parent?: { scope: SpecificationScope; specTemplate: SpecificationDocument } | null;
  child: SpecificationDocument;
}): ResolvedSpecifications {
  const { scope, child, parent, hierarchy } = input;
  const metadata = child.inheritance;
  if (metadata) validateSpecificationInheritance(metadata, scope);
  if (!metadata?.enabled) {
    return { fields: structuredClone(child.fields), provenance: child.fields.map((field) => ({ name: field.name, origin: 'local', source: { ...scope } })), inheritanceApplied: false };
  }
  check(hierarchy, 'Verified hierarchy is required for inheritance.');
  validateSpecificationScope(scope, hierarchy);
  check(parent && !parent.scope.productTypeId && parent.scope.categoryId === scope.categoryId && parent.scope.subcategoryId === scope.subcategoryId, 'An exact immediate Subcategory template is required.');
  check(parent.specTemplate.inheritance, 'Parent has not enabled providing specifications.');
  validateSpecificationInheritance(parent.specTemplate.inheritance, parent.scope);
  check(parent.specTemplate.inheritance.provideToProductTypes, 'Parent has not enabled providing specifications.');
  validateSpecificationFields(parent.specTemplate.fields);
  validateSpecificationFields(child.fields);
  const exactKeys = new Map<string, string>();
  for (const key of [...parent.specTemplate.fields.map((field) => field.name), ...child.fields.map((field) => field.name), ...metadata.excludedKeys]) {
    const existing = exactKeys.get(key.toLowerCase());
    check(existing === undefined || existing === key, `Unsafe case collision between ${existing} and ${key}.`);
    exactKeys.set(key.toLowerCase(), key);
  }
  const excluded = new Set(metadata.excludedKeys);
  const local = new Map(child.fields.map((field) => [field.name, field]));
  for (const key of excluded) check(!local.has(key), `Field ${key} cannot be both local and excluded.`);
  const result: ResolvedSpecifications = { fields: [], provenance: [], inheritanceApplied: true };
  const append = (field: VendorSpecField, origin: 'inherited' | 'local' | 'override') => {
    result.fields.push({ ...structuredClone(field), displayOrder: result.fields.length + 1 });
    result.provenance.push({ name: field.name, origin, source: { ...(origin === 'inherited' ? parent.scope : scope) } });
  };
  for (const field of ordered(parent.specTemplate.fields)) {
    if (excluded.has(field.name)) continue;
    const override = local.get(field.name);
    append(override || field, override ? 'override' : 'inherited');
    local.delete(field.name);
  }
  for (const field of ordered(child.fields)) if (local.has(field.name)) append(field, 'local');
  return result;
}

// Call only while saving an explicitly configured template. Published state is
// server-owned: request payloads can neither supply nor erase a saved snapshot.
export function prepareSpecificationSave<T extends SpecificationDocument>(input: {
  incoming: T; existing?: SpecificationDocument | null; scope: SpecificationScope; now: string;
}): T & SpecificationDocument {
  const { incoming, existing, scope, now } = input;
  const result = structuredClone(incoming);
  delete result.publishedSpecifications;
  if (result.inheritance === undefined && existing?.inheritance) result.inheritance = structuredClone(existing.inheritance);
  if (existing?.publishedSpecifications) result.publishedSpecifications = structuredClone(existing.publishedSpecifications);
  if (result.inheritance) {
    validateSpecificationInheritance(result.inheritance, scope);
    validateSpecificationFields(result.fields);
    for (const key of result.inheritance.excludedKeys) check(!result.fields.some((field) => field.name.toLowerCase() === key.toLowerCase()), `Field ${key} cannot be both local and excluded.`);
    if (!scope.productTypeId && incoming.templateMeta?.status === 'PUBLISHED') {
      result.publishedSpecifications = { version: 1, publishedAt: now, fields: structuredClone(result.fields), provideToProductTypes: result.inheritance.provideToProductTypes };
    }
  }
  return result;
}

export function publishedParentSpecifications(parent: SpecificationDocument): SpecificationDocument {
  const snapshot = parent.publishedSpecifications;
  if (!snapshot) throw new SpecificationInheritanceError('The parent has no retained published specification snapshot.', 'PUBLISHED_SPECIFICATIONS_UNAVAILABLE');
  check(snapshot.version === 1 && typeof snapshot.publishedAt === 'string' && typeof snapshot.provideToProductTypes === 'boolean', 'Invalid published specification snapshot.');
  return {
    fields: structuredClone(snapshot.fields),
    inheritance: { version: 1, enabled: false, excludedKeys: [], provideToProductTypes: snapshot.provideToProductTypes },
  };
}
