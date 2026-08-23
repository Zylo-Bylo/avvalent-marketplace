import { beforeEach, describe, expect, it } from 'vitest';
import {
  cacheCategoryListing,
  cachePublicCategoryTree,
  clearCategoryListingCaches,
  getCachedCategoryListing,
  getCachedPublicCategoryTree,
} from '@/lib/category-listing-cache';
import type { PublicCategoryNode } from '@/lib/public-category-navigation';

describe('category listing client cache', () => {
  beforeEach(() => {
    clearCategoryListingCaches();
  });

  it('never returns one category listing for another category key', () => {
    cacheCategoryListing('/api/products?subcategoryId=a', {
      products: [{ id: 'product-a' }],
      total: 1,
    }, 1_000);

    expect(
      getCachedCategoryListing('/api/products?subcategoryId=b', 1_001),
    ).toBeNull();
    expect(
      getCachedCategoryListing<{ id: string }>(
        '/api/products?subcategoryId=a',
        1_001,
      ),
    ).toEqual({ products: [{ id: 'product-a' }], total: 1 });
  });

  it('expires product listings so Back restoration is controlled', () => {
    cacheCategoryListing('/api/products?subcategoryId=a', {
      products: [{ id: 'product-a' }],
      total: 1,
    }, 1_000);

    expect(
      getCachedCategoryListing('/api/products?subcategoryId=a', 61_001),
    ).toBeNull();
  });

  it('reuses the compact category tree only within its TTL', () => {
    const tree = [{ id: 'category-1' }] as PublicCategoryNode[];
    cachePublicCategoryTree(tree, 1_000);

    expect(getCachedPublicCategoryTree(120_999)).toBe(tree);
    expect(getCachedPublicCategoryTree(121_001)).toBeNull();
  });
});
