import { beforeEach, describe, expect, it } from 'vitest';
import {
  cacheCategoryListing,
  cachePublicCategoryTree,
  clearCategoryListingCaches,
  getCachedCategoryListing,
  getCachedPublicCategoryTree,
} from '@/lib/category-listing-cache';
import type { PublicCategoryNode } from '@/lib/public-category-navigation';

describe('category listing navigation cache safety', () => {
  beforeEach(() => {
    clearCategoryListingCaches();
  });

  it('keeps product listings isolated by full request URL', () => {
    cacheCategoryListing('/api/products?subcategoryId=old&limit=24', {
      products: [{ id: 'old-product' }],
      total: 1,
    }, 1_000);
    cacheCategoryListing('/api/products?subcategoryId=new&limit=24', {
      products: [{ id: 'new-product' }],
      total: 1,
    }, 1_000);

    expect(
      getCachedCategoryListing<{ id: string }>(
        '/api/products?subcategoryId=old&limit=24',
        1_001,
      ),
    ).toEqual({ products: [{ id: 'old-product' }], total: 1 });
    expect(
      getCachedCategoryListing<{ id: string }>(
        '/api/products?subcategoryId=new&limit=24',
        1_001,
      ),
    ).toEqual({ products: [{ id: 'new-product' }], total: 1 });
  });

  it('expires listing snapshots before they can mask fresh navigation data', () => {
    cacheCategoryListing('/api/products?subcategoryId=old&limit=24', {
      products: [{ id: 'old-product' }],
      total: 1,
    }, 1_000);

    expect(
      getCachedCategoryListing('/api/products?subcategoryId=old&limit=24', 61_001),
    ).toBeNull();
  });

  it('keeps the category tree cache bounded to the public metadata TTL', () => {
    const tree = [{ id: 'category-1' }] as PublicCategoryNode[];
    cachePublicCategoryTree(tree, 1_000);

    expect(getCachedPublicCategoryTree(120_999)).toBe(tree);
    expect(getCachedPublicCategoryTree(121_001)).toBeNull();
  });
});
