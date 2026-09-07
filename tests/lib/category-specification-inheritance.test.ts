import { describe, expect, it } from 'vitest';
import {
  resolveCategorySpecifications, prepareSpecificationSave, publishedParentSpecifications,
  type SpecificationDocument, type SpecificationInheritance,
} from '@/lib/category-specification-inheritance';
import type { VendorSpecField } from '@/lib/vendor-specifications';

const scope = { categoryId: 'category-kurtis', subcategoryId: 'subcategory-kurtis', productTypeId: 'anarkali' };
const parentScope = { ...scope, productTypeId: null };
const hierarchy = { category: { id: scope.categoryId }, subcategory: { id: scope.subcategoryId, categoryId: scope.categoryId }, productType: { id: 'anarkali', subcategoryId: scope.subcategoryId } };
const provider: SpecificationInheritance = { version: 1, enabled: false, provideToProductTypes: true, excludedKeys: [] };
const inherit: SpecificationInheritance = { version: 1, enabled: true, provideToProductTypes: false, source: { categoryId: scope.categoryId, subcategoryId: scope.subcategoryId }, excludedKeys: [] };
const field = (name: string, displayOrder?: number, extra: Partial<VendorSpecField> = {}): VendorSpecField => ({ name, label: name, placeholder: '', fieldType: 'Text', ...(displayOrder === undefined ? {} : { displayOrder }), ...extra });
function input(parentFields = [field('fabric'), field('pattern')], localFields: VendorSpecField[] = [], metadata: SpecificationInheritance = inherit) {
  return { scope, hierarchy, parent: { scope: parentScope, specTemplate: { fields: parentFields, inheritance: provider } }, child: { fields: localFields, inheritance: metadata } };
}
const names = (result: ReturnType<typeof resolveCategorySpecifications>) => result.fields.map((item) => item.name);

describe('pure immediate Subcategory specification inheritance', () => {
  it('preserves standalone legacy fields and order when metadata is missing or disabled', () => {
    const fields = [field('LegacyKey', 9, { options: ['A'], multiline: true }), field('second', 1)];
    for (const inheritance of [undefined, { ...inherit, enabled: false }]) {
      const result = resolveCategorySpecifications({ ...input(), child: { fields, inheritance } });
      expect(result.fields).toEqual(fields);
      expect(result.inheritanceApplied).toBe(false);
    }
  });
  it('inherits enabled parent fields and records stable-ID provenance', () => {
    const result = resolveCategorySpecifications(input());
    expect(names(result)).toEqual(['fabric', 'pattern']);
    expect(result.provenance).toEqual(['fabric', 'pattern'].map((name) => ({ name, origin: 'inherited', source: parentScope })));
  });
  it('appends a child-only addition', () => {
    const result = resolveCategorySpecifications(input(undefined, [field('flare')]));
    expect(names(result)).toEqual(['fabric', 'pattern', 'flare']);
    expect(result.provenance[2].origin).toBe('local');
  });
  it('uses whole-field overrides once, retaining the inherited position', () => {
    const result = resolveCategorySpecifications(input([field('occasion', 1, { fieldType: 'Dropdown', dropdownValues: ['Casual'], unit: 'parent' }), field('fabric', 2)], [field('occasion', 99, { label: 'Child occasion' })]));
    expect(names(result)).toEqual(['occasion', 'fabric']);
    expect(result.fields[0]).toEqual(field('occasion', 1, { label: 'Child occasion' }));
    expect(result.fields[0].dropdownValues).toBeUndefined();
    expect(result.provenance[0].origin).toBe('override');
  });
  it('excludes only in this child and restores the current parent definition', () => {
    const parent = [field('fabric'), field('lining', 2, { dropdownValues: ['New'] })];
    expect(names(resolveCategorySpecifications(input(parent, [], { ...inherit, excludedKeys: ['lining'] })))).toEqual(['fabric']);
    const restored = resolveCategorySpecifications(input(parent));
    expect(restored.fields[1].dropdownValues).toEqual(['New']);
    const sibling = { ...input(parent), scope: { ...scope, productTypeId: 'a-line' }, hierarchy: { ...hierarchy, productType: { id: 'a-line', subcategoryId: scope.subcategoryId } } };
    expect(names(resolveCategorySpecifications(sibling))).toEqual(['fabric', 'lining']);
  });
  it('propagates parent additions, option changes and deletions without changing child data', () => {
    const child = input().child;
    expect(names(resolveCategorySpecifications({ ...input([field('fabric'), field('occasion')]), child }))).toEqual(['fabric', 'occasion']);
    expect(resolveCategorySpecifications({ ...input([field('fabric', 1, { dropdownValues: ['Cotton', 'Chanderi'] })]), child }).fields[0].dropdownValues).toEqual(['Cotton', 'Chanderi']);
    expect(resolveCategorySpecifications({ ...input([]), child }).fields).toEqual([]);
    expect(child.fields).toEqual([]);
  });
  it('keeps an override through parent changes and parent deletion', () => {
    const own = field('occasion', 1, { dropdownValues: ['Wedding'] });
    expect(resolveCategorySpecifications(input([field('occasion', 1, { dropdownValues: ['Party'] })], [own])).fields[0]).toEqual(own);
    const result = resolveCategorySpecifications(input([], [own]));
    expect(result.fields[0]).toEqual(own);
    expect(result.provenance[0].origin).toBe('local');
  });
  it('retains exclusions when a parent removes and reintroduces a key', () => {
    const metadata = { ...inherit, excludedKeys: ['lining'] };
    expect(names(resolveCategorySpecifications(input([], [], metadata)))).toEqual([]);
    expect(names(resolveCategorySpecifications(input([field('lining')], [], metadata)))).toEqual([]);
    expect(metadata.excludedKeys).toEqual(['lining']);
  });
  it('orders parent fields, overrides, additions and ties deterministically', () => {
    const request = input([field('pattern', 2), field('fabric', 1)], [field('flare', 9), field('pattern', 100), field('hemline', 3), field('lining', 3)]);
    const result = resolveCategorySpecifications(request);
    expect(names(result)).toEqual(['fabric', 'pattern', 'hemline', 'lining', 'flare']);
    expect(result.fields.map((item) => item.displayOrder)).toEqual([1, 2, 3, 4, 5]);
    expect(resolveCategorySpecifications(request)).toEqual(result);
  });
  it('never aliases or mutates input fields, arrays, metadata or scope objects', () => {
    const request = input([field('fabric', 1, { options: ['Cotton'] })]);
    const before = structuredClone(request);
    const result = resolveCategorySpecifications(request);
    result.fields[0].options!.push('Silk');
    result.provenance[0].source.categoryId = 'other';
    expect(request).toEqual(before);
  });
  it.each([
    [field('fabric'), field('fabric')], [field('Fabric'), field('fabric')], [field(' fabric')], [field('fabric ')], [field('')],
  ])('rejects duplicate, case-colliding or whitespace local keys: %j', (...fields) => {
    expect(() => resolveCategorySpecifications(input([], fields))).toThrow();
  });
  it('rejects cross-layer case collisions and exclusion/local conflicts', () => {
    expect(() => resolveCategorySpecifications(input([field('Fabric')], [field('fabric')]))).toThrow(/collision/);
    expect(() => resolveCategorySpecifications(input(undefined, [field('lining')], { ...inherit, excludedKeys: ['lining'] }))).toThrow(/both local and excluded/);
  });
  it('rejects wrong Category, wrong Subcategory and missing verified hierarchy', () => {
    expect(() => resolveCategorySpecifications({ ...input(), hierarchy: { ...hierarchy, subcategory: { ...hierarchy.subcategory, categoryId: 'other' } } })).toThrow(/Category/);
    expect(() => resolveCategorySpecifications({ ...input(), hierarchy: { ...hierarchy, productType: { id: 'anarkali', subcategoryId: 'other' } } })).toThrow(/ProductType/);
    expect(() => resolveCategorySpecifications({ ...input(), hierarchy: undefined })).toThrow(/Verified/);
  });
  it('forbids unrelated sources, ProductType sources, cycles and Category-to-Subcategory inheritance', () => {
    for (const source of [{ categoryId: 'other', subcategoryId: scope.subcategoryId }, { categoryId: scope.categoryId, subcategoryId: 'other' }, { ...inherit.source!, productTypeId: 'anarkali' }]) {
      expect(() => resolveCategorySpecifications(input(undefined, [], { ...inherit, source }))).toThrow();
    }
    expect(() => resolveCategorySpecifications({ ...input(), scope: parentScope })).toThrow();
    expect(() => resolveCategorySpecifications({ ...input(), parent: { ...input().parent, scope } })).toThrow(/immediate/);
    expect(() => resolveCategorySpecifications({ ...input(), parent: { scope: parentScope, specTemplate: { fields: [], inheritance: { ...provider, enabled: true } } } })).toThrow();
  });
  it('requires explicit parent provisioning', () => {
    expect(() => resolveCategorySpecifications({ ...input(), parent: { scope: parentScope, specTemplate: { fields: [] } } })).toThrow(/Parent/);
  });
});

describe('published specification contract', () => {
  const published: SpecificationDocument = prepareSpecificationSave({ incoming: { fields: [field('fabric')], inheritance: provider, templateMeta: { status: 'PUBLISHED' } }, scope: parentScope, now: '2026-09-06T00:00:00Z' });
  it('preserves the last publication during draft saves even if the client omits metadata', () => {
    const result = prepareSpecificationSave({ incoming: { fields: [field('draft')], templateMeta: { status: 'DRAFT' } }, existing: published, scope: parentScope, now: 'later' });
    expect(result.fields[0].name).toBe('draft');
    expect(result.publishedSpecifications).toEqual(published.publishedSpecifications);
    expect(result.inheritance).toEqual(provider);
  });
  it('replaces the published snapshot only on an explicit publish', () => {
    const result = prepareSpecificationSave({ incoming: { fields: [field('new')], inheritance: provider, templateMeta: { status: 'PUBLISHED' } }, existing: published, scope: parentScope, now: 'new-publication' });
    expect(result.publishedSpecifications?.fields[0].name).toBe('new');
    expect(result.publishedSpecifications?.publishedAt).toBe('new-publication');
    expect(published.publishedSpecifications?.fields[0].name).toBe('fabric');
  });
  it('does not fabricate publication from drafts or standalone legacy publish requests', () => {
    for (const incoming of [{ fields: [], inheritance: provider, templateMeta: { status: 'DRAFT' } }, { fields: [], templateMeta: { status: 'PUBLISHED' } }]) {
      expect(prepareSpecificationSave({ incoming, scope: parentScope, now: 'now' }).publishedSpecifications).toBeUndefined();
    }
  });
  it('ignores client-supplied snapshots, preserves server snapshots and survives JSON round-trip', () => {
    const incoming = { fields: [], inheritance: provider, publishedSpecifications: { ...published.publishedSpecifications!, fields: [field('forged')] } };
    expect(prepareSpecificationSave({ incoming, scope: parentScope, now: 'now' }).publishedSpecifications).toBeUndefined();
    const result = prepareSpecificationSave({ incoming, existing: published, scope: parentScope, now: 'now' });
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
    expect(result.publishedSpecifications).toEqual(published.publishedSpecifications);
  });
  it('resolves from the published parent despite draft changes or draft provisioning changes', () => {
    const draft = { ...published, fields: [field('draft-only')], inheritance: { ...provider, provideToProductTypes: false } };
    const result = resolveCategorySpecifications({ ...input(), parent: { scope: parentScope, specTemplate: publishedParentSpecifications(draft) } });
    expect(names(result)).toEqual(['fabric']);
    expect(() => publishedParentSpecifications({ fields: [field('draft-only')] })).toThrow(/no retained published/);
  });
});
