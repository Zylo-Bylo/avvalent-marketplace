import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  ensureCategoryAtelierSchema: vi.fn(),
  prisma: {
    category: {
      findMany: vi.fn(),
    },
    subcategory: {
      findMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
    $executeRawUnsafe: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

vi.mock('@/lib/category-atelier-schema', () => ({
  ensureCategoryAtelierSchema: mocks.ensureCategoryAtelierSchema,
}));

vi.mock('@/lib/fallback-catalog', () => ({
  getFallbackCategories: vi.fn(() => []),
  shouldUseFallbackCatalog: vi.fn(() => false),
}));

import { GET as getCategories } from '@/app/api/categories/route';
import { GET as getSubcategories } from '@/app/api/subcategories/route';
import { getCategoryUploadTemplate } from '@/lib/category-upload-templates';

const largeEmbeddedImage = `data:image/png;base64,${'A'.repeat(400_000)}`;

describe('public catalogue performance read paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.category.findMany.mockResolvedValue([]);
    mocks.prisma.subcategory.findMany.mockResolvedValue([]);
    mocks.prisma.$queryRaw.mockResolvedValue([]);
  });

  it('returns a compact category tree without GET-path DDL', async () => {
    mocks.prisma.category.findMany.mockResolvedValue([
      {
        id: 'category-1',
        name: 'Fashion',
        slug: 'fashion',
        status: 'ACTIVE',
        sortOrder: 1,
        homepageIcon: largeEmbeddedImage,
        categoryImage: largeEmbeddedImage,
        desktopBanner: 'https://cdn.example.com/fashion.webp',
        mobileBanner: null,
        altText: 'Fashion banner',
        subcategories: [
          {
            id: 'subcategory-1',
            name: 'Kurtis',
            slug: 'kurtis',
            status: 'ACTIVE',
            sortOrder: 1,
            homepageIcon: largeEmbeddedImage,
            categoryImage: null,
            desktopBanner: null,
            mobileBanner: null,
            altText: null,
            categoryId: 'category-1',
            productTypes: [],
          },
        ],
      },
    ]);

    const response = await getCategories(
      new Request('http://localhost/api/categories'),
    );
    const data = await response.json();
    const category = data.categories[0];

    expect(response.status).toBe(200);
    expect(mocks.ensureCategoryAtelierSchema).not.toHaveBeenCalled();
    expect(mocks.prisma.category.findMany).toHaveBeenCalledTimes(1);
    expect(category).not.toHaveProperty('children');
    expect(category).not.toHaveProperty('homepageIcon');
    expect(category.homepageIconUrl).toBe('');
    expect(category.categoryImageUrl).toBe('');
    expect(category.desktopBannerUrl).toBe(
      'https://cdn.example.com/fashion.webp',
    );
    expect(category.subcategories[0].homepageIconUrl).toBe('');
    expect(Number(response.headers.get('X-Catalogue-Payload-Bytes'))).toBeLessThan(
      5_000,
    );
    expect(response.headers.get('Cache-Control')).toContain('s-maxage=120');
    expect(response.headers.get('Server-Timing')).toContain('db;dur=');
  });

  it('keeps administrative category reads private and fresh', async () => {
    const response = await getCategories(
      new Request('http://localhost/api/categories?fresh=1'),
    );

    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('reads compact subcategories without schema initialization', async () => {
    const response = await getSubcategories(
      new Request('http://localhost/api/subcategories?categoryId=category-1'),
    );

    expect(response.status).toBe(200);
    expect(mocks.ensureCategoryAtelierSchema).not.toHaveBeenCalled();
    expect(mocks.prisma.subcategory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { categoryId: 'category-1' },
        select: expect.objectContaining({
          id: true,
          productTypes: expect.any(Object),
        }),
      }),
    );
  });

  it('reads category templates without table or index creation', async () => {
    await getCategoryUploadTemplate('category-1', 'subcategory-1');

    expect(mocks.prisma.$queryRaw).toHaveBeenCalled();
    expect(mocks.prisma.$executeRawUnsafe).not.toHaveBeenCalled();
  });
});
