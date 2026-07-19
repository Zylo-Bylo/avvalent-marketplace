export const categoryMetadataImageFields = [
  'homepageIcon',
  'categoryImage',
  'desktopBanner',
  'mobileBanner',
] as const;

export type CategoryMetadataImageField = (typeof categoryMetadataImageFields)[number];

const temporaryUrlPattern = /^(blob|data):/i;

export function isTemporaryImageUrl(value: unknown) {
  return typeof value === 'string' && temporaryUrlPattern.test(value.trim());
}

export function isPermanentImageUrl(value: unknown) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || isTemporaryImageUrl(trimmed)) return false;
  return /^https:\/\//i.test(trimmed) || trimmed.startsWith('/');
}

export function sanitizeMetadataImageValue(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || isTemporaryImageUrl(trimmed)) return null;
  return trimmed;
}

export function sanitizeMetadataImageUpdates<T extends Record<string, unknown>>(input: T): T {
  const next: Record<string, unknown> = { ...input };
  for (const field of categoryMetadataImageFields) {
    if (field in next) {
      next[field] = sanitizeMetadataImageValue(next[field]);
    }
  }
  return next as T;
}

export function metadataImageStorageFolder(
  entityType: 'category' | 'subcategory' | 'productType',
  entityId: string,
  field: CategoryMetadataImageField,
) {
  const folderByField: Record<CategoryMetadataImageField, string> = {
    homepageIcon: 'homepage-icon',
    categoryImage: 'category-image',
    desktopBanner: 'desktop-banner',
    mobileBanner: 'mobile-banner',
  };

  if (entityType === 'productType') {
    return `product-types/${entityId}/${folderByField[field]}`;
  }

  const root = entityType === 'subcategory' ? 'subcategories' : 'categories';
  return `${root}/${entityId}/${folderByField[field]}`;
}
