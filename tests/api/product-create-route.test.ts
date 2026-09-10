import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    user: { findUnique: vi.fn() },
    category: { findUnique: vi.fn() },
    subcategory: { findFirst: vi.fn() },
    productType: { findFirst: vi.fn() },
    product: { findUnique: vi.fn(), create: vi.fn() },
  },
  ensureProductInventory: vi.fn(),
  replaceProductVariants: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }));
vi.mock('@/lib/session-cookies', () => ({ getAuthSession: async () => ({ userId: 'vendor-user', role: 'VENDOR' }) }));
vi.mock('@/lib/local-sqlite-auth', () => ({ shouldUseLocalSqliteAuth: () => false, getLocalVendorUser: vi.fn() }));
vi.mock('@/lib/payouts', () => ({ getCommissionPercent: async () => 10 }));
vi.mock('@/lib/inventory', () => ({ ensureProductInventory: mocks.ensureProductInventory }));
vi.mock('@/lib/variants', () => ({ normalizeVariants: (rows: unknown[]) => rows, replaceProductVariants: mocks.replaceProductVariants }));

import { POST } from '@/app/api/products/create/route';

function create(overrides: Record<string, unknown> = {}) {
  return POST(new Request('http://localhost/api/products/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Kurti', description: 'Compliance details:\nproduct_type: unrelated specification',
      productType: 'Legacy fashion text', productTypeId: 'type-1',
      categoryId: 'category-1', subcategoryId: 'subcategory-1',
      vendorPrice: 500, inventory: 3,
      variants: [{ sizeLabel: 'M', stockQuantity: 3 }], ...overrides,
    }),
  }));
}

describe('single product creation ProductType persistence', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.prisma.user.findUnique.mockResolvedValue({ role: 'VENDOR', vendorProfile: { id: 'vendor-1', status: 'APPROVED' } });
    mocks.prisma.category.findUnique.mockResolvedValue({ id: 'category-1', subcategories: [{ id: 'subcategory-1' }] });
    mocks.prisma.subcategory.findFirst.mockImplementation(async ({ where }) =>
      where.id === 'subcategory-1' && where.categoryId === 'category-1' ? { id: 'subcategory-1' } : null);
    mocks.prisma.productType.findFirst.mockImplementation(async ({ where }) =>
      where.id === 'type-1' && where.subcategoryId === 'subcategory-1' ? { id: 'type-1' } : null);
    mocks.prisma.product.create.mockImplementation(async ({ data }) => ({ id: 'product-1', ...data }));
  });

  it('persists the stable ID with unchanged category/subcategory and legacy text', async () => {
    const result = await create();
    expect(result.status).toBe(201);
    const product = await result.json();
    expect(product).toMatchObject({ productTypeId: 'type-1', categoryId: 'category-1', subcategoryId: 'subcategory-1' });
    expect(product.description).toContain('Product type: Legacy fashion text');
    expect(product.description).toContain('product_type: unrelated specification');
    expect(mocks.prisma.subcategory.findFirst).toHaveBeenCalledWith({ where: { id: 'subcategory-1', categoryId: 'category-1' }, select: { id: true } });
    expect(mocks.prisma.productType.findFirst).toHaveBeenCalledWith({ where: { id: 'type-1', subcategoryId: 'subcategory-1' }, select: { id: true } });
    expect(mocks.prisma.product.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ productTypeId: 'type-1' }) }));
  });

  it.each(['missing-type', 'type-in-another-subcategory'])('rejects unavailable/cross-branch ID %s before writes', async (productTypeId) => {
    const result = await create({ productTypeId });
    expect(result.status).toBe(400);
    expect(await result.json()).toEqual({ error: 'Selected ProductType was not found in this subcategory.' });
    expect(mocks.prisma.product.create).not.toHaveBeenCalled();
    expect(mocks.ensureProductInventory).not.toHaveBeenCalled();
    expect(mocks.replaceProductVariants).not.toHaveBeenCalled();
  });

  it('rejects a subcategory from another category before ProductType lookup', async () => {
    const result = await create({ subcategoryId: 'other-subcategory' });
    expect(result.status).toBe(400);
    expect(await result.json()).toEqual({ error: 'Selected subcategory does not belong to this category.' });
    expect(mocks.prisma.productType.findFirst).not.toHaveBeenCalled();
    expect(mocks.prisma.product.create).not.toHaveBeenCalled();
  });

  it('rejects a missing category', async () => {
    mocks.prisma.category.findUnique.mockResolvedValue(null);
    expect((await create()).status).toBe(400);
    expect(mocks.prisma.product.create).not.toHaveBeenCalled();
  });

  it('requires a subcategory for a supplied ProductType even on a category without children', async () => {
    mocks.prisma.category.findUnique.mockResolvedValue({ id: 'category-1', subcategories: [] });
    expect((await create({ subcategoryId: undefined })).status).toBe(400);
    expect(mocks.prisma.product.create).not.toHaveBeenCalled();
  });

  it.each([undefined, null, ''])('preserves legacy creation for absent/empty ID %s', async (productTypeId) => {
    const result = await create({ productTypeId });
    expect(result.status).toBe(201);
    expect(mocks.prisma.productType.findFirst).not.toHaveBeenCalled();
    const product = await result.json();
    expect(product).not.toHaveProperty('productTypeId');
    expect(product).toMatchObject({ categoryId: 'category-1', subcategoryId: 'subcategory-1' });
    expect(product.description).toContain('Product type: Legacy fashion text');
  });

  it('preserves category-only legacy creation', async () => {
    mocks.prisma.category.findUnique.mockResolvedValue({ id: 'category-1', subcategories: [] });
    const result = await create({ productTypeId: undefined, subcategoryId: undefined });
    expect(result.status).toBe(201);
    expect(await result.json()).toMatchObject({ categoryId: 'category-1' });
  });

  it.each([123, false, {}, []])('rejects malformed ID %j', async (productTypeId) => {
    expect((await create({ productTypeId })).status).toBe(400);
    expect(mocks.prisma.productType.findFirst).not.toHaveBeenCalled();
    expect(mocks.prisma.product.create).not.toHaveBeenCalled();
  });
});
