import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CategorySpecTemplate } from '@/lib/category-upload-templates';

const mocks = vi.hoisted(() => ({
  requireAdminApiUser: vi.fn(),
  prisma: {
    $queryRaw: vi.fn(), $executeRaw: vi.fn(), $executeRawUnsafe: vi.fn(), $transaction: vi.fn(),
    category: { findUnique: vi.fn() }, subcategory: { findUnique: vi.fn() }, productType: { findUnique: vi.fn() },
  },
}));
vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }));
vi.mock('@/lib/admin-auth', () => ({ requireAdminApiUser: mocks.requireAdminApiUser }));

import { GET, POST } from '@/app/api/category-templates/route';

const categoryId = 'category-kurtis';
const subcategoryId = 'subcategory-kurtis';
const productTypeId = 'festive';
const provider = { version: 1 as const, enabled: false, provideToProductTypes: true, excludedKeys: [] };
const inherit = { version: 1 as const, enabled: true, provideToProductTypes: false, source: { categoryId, subcategoryId }, excludedKeys: [] };
const field = (name: string) => ({ name, label: name, placeholder: '', fieldType: 'Text' as const });
type Row = { id: string; categoryId: string; subcategoryId: string | null; productTypeId: string | null; productTypes: string; specTemplate: string; variantConfig: string; sizeChart: string; requiredFields: string; createdAt: string; updatedAt: string };
let rows: Row[];
const row = (specTemplate: CategorySpecTemplate, child: string | null = null): Row => ({ id: child || 'parent', categoryId, subcategoryId, productTypeId: child, productTypes: '[]', specTemplate: JSON.stringify(specTemplate), variantConfig: '{"keep":"variants"}', sizeChart: 'untouched', requiredFields: '[]', createdAt: 'before', updatedAt: 'before' });
const spec = (fields = [field('fabric')], extras: Partial<CategorySpecTemplate> = {}): CategorySpecTemplate => ({ title: 'Specifications', helpText: 'Details', fields, ...extras });
const url = (resolved = false, child = productTypeId) => `http://localhost/api/category-templates?categoryId=${categoryId}&subcategoryId=${subcategoryId}&productTypeId=${child}${resolved ? '&mode=resolved-specifications' : ''}`;
const save = (specTemplate: CategorySpecTemplate, child: string | null = null, extras = {}) => POST(new Request('http://localhost/api/category-templates', { method: 'POST', body: JSON.stringify({ categoryId, subcategoryId, productTypeId: child, specTemplate, variantConfig: { keep: 'variants' }, sizeChart: 'untouched', ...extras }) }));

beforeEach(() => {
  vi.clearAllMocks();
  rows = [];
  mocks.requireAdminApiUser.mockResolvedValue({ user: { id: 'admin', role: 'ADMIN' }, response: null });
  mocks.prisma.category.findUnique.mockResolvedValue({ id: categoryId });
  mocks.prisma.subcategory.findUnique.mockResolvedValue({ id: subcategoryId, categoryId });
  mocks.prisma.productType.findUnique.mockImplementation(async ({ where }) => ({ id: where.id, subcategoryId }));
  mocks.prisma.$executeRawUnsafe.mockResolvedValue(0);
  mocks.prisma.$queryRaw.mockImplementation(async (_sql: TemplateStringsArray, ...values: string[]) => rows.filter((item) => item.categoryId === values[0] && (item.subcategoryId || '') === (values[1] || '') && (item.productTypeId || '') === (values[2] || '')).slice(0, 1));
  mocks.prisma.$executeRaw.mockImplementation(async (sql: TemplateStringsArray, ...values: string[]) => {
    if (sql.join('').includes('DELETE FROM')) rows = rows.filter((item) => !(item.categoryId === values[0] && (item.subcategoryId || '') === (values[1] || '') && (item.productTypeId || '') === (values[2] || '')));
    else {
      rows.push({ id: values[0], categoryId: values[1], subcategoryId: values[2], productTypeId: values[3], productTypes: values[4], specTemplate: values[5], variantConfig: values[6], sizeChart: values[7], requiredFields: values[8], createdAt: 'now', updatedAt: 'now' });
    }
    return 1;
  });
  mocks.prisma.$transaction.mockImplementation(async (callback) => {
    const before = structuredClone(rows);
    try { return await callback(mocks.prisma); }
    catch (error) { rows = before; throw error; }
  });
});

describe('category template API compatibility and opt-in resolution', () => {
  it('keeps the default response and cache semantics unchanged, including draft templates', async () => {
    rows = [row(spec([field('copied')], { templateMeta: { status: 'DRAFT' } }), productTypeId)];
    const response = await GET(new Request(url()));
    const data = await response.json();
    expect(Object.keys(data)).toEqual(['template']);
    expect(data.template.specTemplate).toEqual(JSON.parse(rows[0].specTemplate));
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=30, s-maxage=120, stale-while-revalidate=60');
    expect(mocks.prisma.category.findUnique).not.toHaveBeenCalled();
    expect(mocks.prisma.$executeRaw).not.toHaveBeenCalled();
    expect(mocks.prisma.$executeRawUnsafe).not.toHaveBeenCalled();
  });
  it('retains exact empty child templates and missing-child fallback without persisting anything', async () => {
    rows = [row(spec()), row(spec([]), productTypeId)];
    expect((await (await GET(new Request(url(true)))).json()).template.specTemplate.fields).toEqual([]);
    const fallback = await (await GET(new Request(url(true, 'a-line')))).json();
    expect(fallback.template.id).toBe('parent');
    expect(fallback.resolution.inheritanceApplied).toBe(false);
    expect(rows).toHaveLength(2);
    expect(mocks.prisma.$executeRaw).not.toHaveBeenCalled();
    expect(mocks.prisma.$executeRawUnsafe).not.toHaveBeenCalled();
  });
  it('never opts an existing copied Festive template into inheritance', async () => {
    rows = [row(spec([field('parent-new')], { inheritance: provider })), row(spec([field('copied')]), productTypeId)];
    const data = await (await GET(new Request(url(true)))).json();
    expect(data.template.specTemplate.fields).toEqual([field('copied')]);
    expect(data.resolution.inheritanceApplied).toBe(false);
  });
  it('returns published effective fields and provenance only when explicitly requested', async () => {
    const parent = spec([field('draft-only')], { inheritance: { ...provider, provideToProductTypes: false }, publishedSpecifications: { version: 1, publishedAt: 'published', fields: [field('fabric')], provideToProductTypes: true }, filterConfig: ['unchanged'] });
    rows = [row(parent), row(spec([field('flare')], { inheritance: inherit }), productTypeId)];
    const before = structuredClone(rows);
    const response = await GET(new Request(url(true)));
    const data = await response.json();
    expect(data.template.specTemplate.fields.map((item: { name: string }) => item.name)).toEqual(['fabric', 'flare']);
    expect(data.resolution.provenance.map((item: { origin: string }) => item.origin)).toEqual(['inherited', 'local']);
    expect(data.template.variantConfig).toEqual({ keep: 'variants' });
    expect(data.template.sizeChart).toBe('untouched');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(rows).toEqual(before);
    const normal = await (await GET(new Request(url()))).json();
    expect(normal.template.specTemplate.fields).toEqual([field('flare')]);
    expect(mocks.prisma.$executeRaw).not.toHaveBeenCalled();
    const roundTrip = await POST(new Request('http://localhost/api/category-templates', { method: 'POST', body: JSON.stringify(data.template) }));
    expect(roundTrip.status).toBe(400);
  });
  it('returns a clear conflict instead of falling back to a draft parent or broad Category', async () => {
    rows = [row(spec([], { inheritance: provider })), row(spec([], { inheritance: inherit }), productTypeId)];
    const response = await GET(new Request(url(true)));
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('PUBLISHED_SPECIFICATIONS_UNAVAILABLE');
  });
  it('rejects missing leaf IDs and cross-branch scope before resolution', async () => {
    expect((await GET(new Request(`http://localhost/api/category-templates?categoryId=${categoryId}&mode=resolved-specifications`))).status).toBe(400);
    mocks.prisma.productType.findUnique.mockResolvedValue({ id: productTypeId, subcategoryId: 'unrelated' });
    expect((await GET(new Request(url(true)))).status).toBe(400);
    expect(mocks.prisma.$executeRaw).not.toHaveBeenCalled();
  });
  it('continues supporting fresh reads and existing categoryId validation', async () => {
    expect((await GET(new Request('http://localhost/api/category-templates'))).status).toBe(400);
    expect((await GET(new Request(url() + '&fresh=1'))).headers.get('Cache-Control')).toBe('private, no-store');
  });
});

describe('template snapshot persistence through the existing JSON columns', () => {
  it('round-trips local metadata and fields without storing the resolved parent fields', async () => {
    rows = [row(spec([field('fabric')], { inheritance: provider }))];
    const response = await save(spec([field('flare')], { inheritance: { ...inherit, excludedKeys: ['lining'] } }), productTypeId);
    expect(response.status).toBe(200);
    const saved = JSON.parse(rows.find((item) => item.productTypeId === productTypeId)!.specTemplate);
    expect(saved.fields).toEqual([field('flare')]);
    expect(saved.inheritance.excludedKeys).toEqual(['lining']);
    expect(JSON.parse(rows.find((item) => !item.productTypeId)!.specTemplate).fields).toEqual([field('fabric')]);
    const sql = mocks.prisma.$executeRaw.mock.calls.map(([strings]) => strings.join('')).join('\n');
    expect(sql).toContain('"specTemplate"');
    expect(sql).not.toMatch(/UPDATE\s+"Product"|INSERT INTO\s+"Product"/);
    expect(mocks.prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
  });
  it('preserves a server-owned publication across drafts and replaces it on publishing', async () => {
    expect((await save(spec([field('published')], { inheritance: provider, templateMeta: { status: 'PUBLISHED' } }))).status).toBe(200);
    const snapshot = JSON.parse(rows[0].specTemplate).publishedSpecifications;
    const draft = await save(spec([field('draft')], { templateMeta: { status: 'DRAFT' }, publishedSpecifications: { ...snapshot, fields: [field('forged')] } }));
    expect(draft.status).toBe(200);
    expect(JSON.parse(rows[0].specTemplate).publishedSpecifications).toEqual(snapshot);
    expect(JSON.parse(rows[0].specTemplate).fields).toEqual([field('draft')]);
    await save(spec([field('republished')], { templateMeta: { status: 'PUBLISHED' } }));
    expect(JSON.parse(rows[0].specTemplate).publishedSpecifications.fields).toEqual([field('republished')]);
  });
  it('does not fabricate snapshots from drafts or legacy templates', async () => {
    await save(spec([], { inheritance: provider, templateMeta: { status: 'DRAFT' } }));
    expect(JSON.parse(rows[0].specTemplate).publishedSpecifications).toBeUndefined();
    rows = [];
    await save(spec([field('legacy')], { templateMeta: { status: 'PUBLISHED' } }));
    expect(JSON.parse(rows[0].specTemplate)).toEqual(spec([field('legacy')], { templateMeta: { status: 'PUBLISHED' } }));
  });
  it('rejects invalid inheritance before replacing any template row', async () => {
    rows = [row(spec([field('original')]), productTypeId)];
    const before = structuredClone(rows);
    const response = await save(spec([], { inheritance: { ...inherit, source: { categoryId: 'other', subcategoryId } } }), productTypeId);
    expect(response.status).toBe(400);
    expect(rows).toEqual(before);
    expect(mocks.prisma.$executeRaw).not.toHaveBeenCalled();
  });
  it('retains the original row and snapshot if replacement insertion fails', async () => {
    rows = [row(spec([], { inheritance: provider, publishedSpecifications: { version: 1, publishedAt: 'before', fields: [field('keep')], provideToProductTypes: true } }))];
    const before = structuredClone(rows);
    mocks.prisma.$executeRaw.mockImplementationOnce(async () => { rows = []; return 1; }).mockRejectedValueOnce(new Error('simulated failure'));
    const response = await save(spec([], { templateMeta: { status: 'DRAFT' } }));
    expect(response.status).toBe(500);
    expect(rows).toEqual(before);
  });
  it('retains admin authorization and performs no persistence for denied callers', async () => {
    mocks.requireAdminApiUser.mockResolvedValue({ response: Response.json({ error: 'Unauthorized' }, { status: 401 }) });
    expect((await save(spec())).status).toBe(401);
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    expect(mocks.prisma.$executeRawUnsafe).not.toHaveBeenCalled();
  });
});
