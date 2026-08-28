import type { PublicCategoryNode } from '@/lib/public-category-navigation';

const CATEGORY_TREE_TTL_MS = 2 * 60 * 1000;
const PRODUCT_LISTING_TTL_MS = 60 * 1000;

type CacheEntry<T> = {
  expiresAt: number;
  version: string;
  value: T;
};

export type CategoryListingSnapshot<T> = {
  products: T[];
  total: number;
};

let categoryTreeCache: CacheEntry<PublicCategoryNode[]> | null = null;
const productListingCache = new Map<string, CacheEntry<CategoryListingSnapshot<unknown>>>();

function normalizeVersion(version: unknown) {
  return typeof version === 'string' ? version.trim() : '';
}

function isOlderVersion(cachedVersion: string, minimumVersion: string) {
  return Boolean(minimumVersion && cachedVersion && cachedVersion < minimumVersion);
}

export function getCategoryTreeVersion(tree: PublicCategoryNode[]) {
  return tree.reduce((latest, node) => {
    const children = Array.isArray(node.children) ? node.children : [];
    const versions = [
      node.imageVersion,
      ...children.map((child) => child.imageVersion),
      ...children.flatMap((child) =>
        (Array.isArray(child.productTypes) ? child.productTypes : []).map(
          (productType) => productType.imageVersion,
        ),
      ),
    ].filter(Boolean);

    return versions.reduce(
      (currentLatest, version) => (version > currentLatest ? version : currentLatest),
      latest,
    );
  }, '');
}

export function getCachedPublicCategoryTree(
  now = Date.now(),
  minimumVersion = '',
) {
  if (!categoryTreeCache || categoryTreeCache.expiresAt <= now) {
    categoryTreeCache = null;
    return null;
  }

  if (isOlderVersion(categoryTreeCache.version, normalizeVersion(minimumVersion))) {
    categoryTreeCache = null;
    return null;
  }

  return categoryTreeCache.value;
}

export function cachePublicCategoryTree(
  tree: PublicCategoryNode[],
  now = Date.now(),
  version = getCategoryTreeVersion(tree),
) {
  categoryTreeCache = {
    expiresAt: now + CATEGORY_TREE_TTL_MS,
    version: normalizeVersion(version),
    value: tree,
  };
}

export function getCachedCategoryListing<T>(
  key: string,
  now = Date.now(),
  minimumVersion = '',
) {
  const entry = productListingCache.get(key);
  if (!entry || entry.expiresAt <= now) {
    productListingCache.delete(key);
    return null;
  }

  if (isOlderVersion(entry.version, normalizeVersion(minimumVersion))) {
    productListingCache.delete(key);
    return null;
  }

  return entry.value as CategoryListingSnapshot<T>;
}

export function cacheCategoryListing<T>(
  key: string,
  value: CategoryListingSnapshot<T>,
  now = Date.now(),
  version = '',
) {
  productListingCache.set(key, {
    expiresAt: now + PRODUCT_LISTING_TTL_MS,
    version: normalizeVersion(version),
    value,
  });
}

export function clearCategoryListingCaches() {
  categoryTreeCache = null;
  productListingCache.clear();
}
