import type { PublicCategoryNode } from '@/lib/public-category-navigation';

const CATEGORY_TREE_TTL_MS = 2 * 60 * 1000;
const PRODUCT_LISTING_TTL_MS = 60 * 1000;

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

export type CategoryListingSnapshot<T> = {
  products: T[];
  total: number;
};

let categoryTreeCache: CacheEntry<PublicCategoryNode[]> | null = null;
const productListingCache = new Map<string, CacheEntry<CategoryListingSnapshot<unknown>>>();

export function getCachedPublicCategoryTree(now = Date.now()) {
  if (!categoryTreeCache || categoryTreeCache.expiresAt <= now) {
    categoryTreeCache = null;
    return null;
  }

  return categoryTreeCache.value;
}

export function cachePublicCategoryTree(
  tree: PublicCategoryNode[],
  now = Date.now(),
) {
  categoryTreeCache = {
    expiresAt: now + CATEGORY_TREE_TTL_MS,
    value: tree,
  };
}

export function getCachedCategoryListing<T>(key: string, now = Date.now()) {
  const entry = productListingCache.get(key);
  if (!entry || entry.expiresAt <= now) {
    productListingCache.delete(key);
    return null;
  }

  return entry.value as CategoryListingSnapshot<T>;
}

export function cacheCategoryListing<T>(
  key: string,
  value: CategoryListingSnapshot<T>,
  now = Date.now(),
) {
  productListingCache.set(key, {
    expiresAt: now + PRODUCT_LISTING_TTL_MS,
    value,
  });
}

export function clearCategoryListingCaches() {
  categoryTreeCache = null;
  productListingCache.clear();
}
