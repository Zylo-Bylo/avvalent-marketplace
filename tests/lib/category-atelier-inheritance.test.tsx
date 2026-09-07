// @vitest-environment jsdom
import React, { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Workspace, { SpecificationsEditor, normalizeSpecField, serializeSpecifications, previewAdminSpecifications, type AdminInheritanceContext } from '@/components/admin/CategoryAtelierWorkspace';
import { prepareSpecificationSave, type SpecificationDocument, type SpecificationInheritance } from '@/lib/category-specification-inheritance';
vi.mock('@/components/navbar/Navbar', () => ({ default: () => null }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }), useSearchParams: () => new URLSearchParams('categoryId=c&subcategoryId=s&productTypeId=p&tab=specifications') }));
afterEach(cleanup);
const scope = { categoryId: 'c', subcategoryId: 's', productTypeId: 'p' };
const hierarchy = { category: { id: 'c' }, subcategory: { id: 's', categoryId: 'c' }, productType: { id: 'p', subcategoryId: 's' } };
const meta: SpecificationInheritance = { version: 1, enabled: true, source: { categoryId: 'c', subcategoryId: 's' }, excludedKeys: [], provideToProductTypes: false };
const fabric = { name: 'fabric', label: 'Fabric', placeholder: '', fieldType: 'Text' as const, required: true };
const makeParent = (): SpecificationDocument => ({ fields: [{ ...fabric, label: 'Unpublished draft' }], publishedSpecifications: { version: 1, publishedAt: '2026-09-01', fields: [fabric], provideToProductTypes: true } });
const context = (parent = makeParent()): AdminInheritanceContext => ({ scope, hierarchy, parentName: 'Kurtis', parent, metadata: meta, onMetadataChange: () => {} });
type Field = ReturnType<typeof normalizeSpecField>;
function Harness({ parent = makeParent(), initial = [], metadata = meta }: { parent?: SpecificationDocument; initial?: Field[]; metadata?: SpecificationInheritance | null }) {
  const [fields, setFields] = useState(initial);
  const [inheritance, setInheritance] = useState(metadata || undefined);
  const ctx = { ...context(parent), metadata: inheritance, onMetadataChange: setInheritance };
  const preview = previewAdminSpecifications(fields, ctx);
  return <><SpecificationsEditor fields={fields} onChange={setFields} inheritance={ctx} /><output data-testid="saved">{JSON.stringify({ fields: serializeSpecifications(fields), inheritance })}</output><output data-testid="effective">{JSON.stringify(preview.result?.fields || [])}</output></>;
}
const saved = () => JSON.parse(screen.getByTestId('saved').textContent!);
const effective = () => JSON.parse(screen.getByTestId('effective').textContent!);
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

describe('admin specification inheritance', () => {
  it.each(['Legacy', 'Festive Kurtis'])('%s remains standalone until explicitly enabled', () => {
    render(<Harness metadata={null} initial={[normalizeSpecField({ name: 'occasion', label: 'Occasion' }, 0)]} />);
    expect((screen.getByRole('checkbox', { name: 'Inherit specifications from Kurtis' }) as HTMLInputElement).checked).toBe(false);
    expect(saved().inheritance).toBeUndefined();
    expect(effective().map((f: Field) => f.name)).toEqual(['occasion']);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Inherit specifications from Kurtis' }));
    expect(saved().inheritance).toEqual(meta);
    expect(effective().map((f: Field) => f.name)).toEqual(['fabric', 'occasion']);
  });
  it('displays the immediate source, separate inherited group, and no parent editing controls', () => {
    render(<Harness />);
    expect(screen.getByRole('heading', { name: 'Inherited from Kurtis' })).toBeTruthy();
    expect(screen.getByText(/Immediate Subcategory: Kurtis/)).toBeTruthy();
    expect(screen.queryByLabelText('Field Key')).toBeNull();
    expect(screen.queryByText('Unpublished draft')).toBeNull();
    expect(saved().fields).toEqual([]);
  });
  it('adds only a child-local field and reserves inherited default keys', () => {
    const parent = makeParent(); parent.publishedSpecifications!.fields.push({ ...fabric, name: 'field_1' });
    render(<Harness parent={parent} />); click('Add Specification');
    expect(saved().fields.map((f: Field) => f.name)).toEqual(['field_2']);
    expect(effective()).toHaveLength(3);
  });
  it('rejects an inherited key typed as a normal local key', () => {
    render(<Harness />); click('Add Specification');
    fireEvent.change(screen.getByLabelText('Field Key'), { target: { value: 'FABRIC' } });
    expect(screen.getByRole('alert').textContent).toContain('Use Override');
    expect(saved().fields[0].name).toBe('field_1');
  });
  it('creates one same-key override with a locked key and one effective field', () => {
    render(<Harness />); click('Override');
    expect(saved().fields).toHaveLength(1);
    expect(saved().fields[0].name).toBe('fabric');
    expect((screen.getByLabelText('Field Key') as HTMLInputElement).readOnly).toBe(true);
    fireEvent.change(screen.getByLabelText('Display Label'), { target: { value: 'Child Fabric' } });
    expect(effective()).toHaveLength(1); expect(effective()[0].label).toBe('Child Fabric');
  });
  it('reverts to the current published definition without a stale local copy', () => {
    const view = render(<Harness />); click('Override');
    const parent = makeParent(); parent.publishedSpecifications!.fields[0] = { ...fabric, label: 'Updated Fabric' };
    view.rerender(<Harness parent={parent} />); click('Revert to Inherited');
    expect(saved().fields).toEqual([]); expect(effective()[0].label).toBe('Updated Fabric');
  });
  it('excludes by key and restores the current published definition', () => {
    const view = render(<Harness />); click('Exclude');
    expect(saved().inheritance.excludedKeys).toEqual(['fabric']); expect(effective()).toEqual([]);
    const parent = makeParent(); parent.publishedSpecifications!.fields[0] = { ...fabric, label: 'Current Fabric' };
    view.rerender(<Harness parent={parent} />); click('Restore');
    expect(saved().fields).toEqual([]); expect(saved().inheritance.excludedKeys).toEqual([]);
    expect(effective()[0].label).toBe('Current Fabric');
  });
  it('does not mutate the parent or a sibling during override/exclude/restore', () => {
    const parent = makeParent(), before = structuredClone(parent), sibling = { fields: [fabric] }, siblingBefore = structuredClone(sibling);
    render(<Harness parent={parent} />); click('Override'); click('Revert to Inherited'); click('Exclude'); click('Restore');
    expect(parent).toEqual(before); expect(sibling).toEqual(siblingBefore);
    expect(previewAdminSpecifications([], context(parent)).result!.fields[0].name).toBe('fabric');
  });
  it('round-trips only locals, overrides, metadata and exclusions through the Phase 2 save contract', () => {
    const parent = makeParent(); parent.publishedSpecifications!.fields.push({ ...fabric, name: 'lining', label: 'Lining' });
    render(<Harness parent={parent} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Exclude' })[1]); click('Override'); click('Add Specification');
    const payload = { ...saved(), templateMeta: { status: 'DRAFT' } };
    const result = prepareSpecificationSave({ incoming: payload, scope, now: 'now' });
    expect(result).toEqual(payload); expect(result.fields.map((f: Field) => f.name)).toEqual(['fabric', 'field_1']);
    expect(result.inheritance.excludedKeys).toEqual(['lining']); expect(result.publishedSpecifications).toBeUndefined();
  });
  it('warns on a missing published snapshot and never uses draft fields', () => {
    render(<Harness parent={{ fields: [fabric] }} />);
    expect(screen.getByRole('alert').textContent).toContain('valid published specification snapshot');
    expect(effective()).toEqual([]); expect(screen.queryByRole('button', { name: 'Override' })).toBeNull();
  });
  it('accepts an empty published snapshot without substituting draft fields', () => {
    const parent = makeParent(); parent.publishedSpecifications!.fields = [];
    render(<Harness parent={parent} />); expect(effective()).toEqual([]); expect(screen.queryByRole('alert')).toBeNull();
  });
  it.each([
    { ...meta, source: { categoryId: 'other', subcategoryId: 's' } },
    { ...meta, excludedKeys: ['fabric'] },
  ])('flags invalid source or local/exclusion conflict', (metadata) => {
    render(<Harness metadata={metadata} initial={[normalizeSpecField(fabric, 0)]} />);
    expect(screen.getByRole('alert')).toBeTruthy(); expect(effective()).toEqual([]);
  });
  it('rejects an invalid immediate relationship', () => {
    const ctx = context(); ctx.hierarchy = { ...hierarchy, productType: { id: 'p', subcategoryId: 'other' } };
    expect(previewAdminSpecifications([], ctx).error).toContain('does not belong');
  });
  it('rejects Category sources without broad fallback leakage', () => {
    const ctx = context(); ctx.metadata = { ...meta, source: { categoryId: 'c', subcategoryId: '' } };
    expect(previewAdminSpecifications([], ctx).result).toBeNull();
  });
  it('turning inheritance off preserves local fields and exclusion metadata', () => {
    render(<Harness initial={[normalizeSpecField({ name: 'flare' }, 0)]} metadata={{ ...meta, excludedKeys: ['fabric'] }} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Inherit specifications from Kurtis' }));
    expect(saved().inheritance.enabled).toBe(false); expect(saved().inheritance.excludedKeys).toEqual(['fabric']);
    expect(effective().map((f: Field) => f.name)).toEqual(['flare']);
  });
  it('Subcategory sharing is explicit and does not publish', () => {
    const changed = vi.fn();
    render(<SpecificationsEditor fields={[]} onChange={vi.fn()} inheritance={{ ...context(), scope: { categoryId: 'c', subcategoryId: 's' }, metadata: undefined, onMetadataChange: changed }} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Provide published specifications to immediate ProductTypes' }));
    expect(changed).toHaveBeenCalledWith({ version: 1, enabled: false, excludedKeys: [], provideToProductTypes: true });
  });
  it('draft preview preserves the retained published snapshot and never reads parent draft fields', () => {
    const parent = makeParent(); const before = JSON.stringify(parent);
    const result = previewAdminSpecifications([], context(parent));
    expect(result.result!.fields[0].label).toBe('Fabric'); expect(JSON.stringify(parent)).toBe(before);
  });
});


describe('workspace save integration', () => {
  it.each([false, true])('saves an inheriting child with local fields only (existing child: %s)', async (hasChild) => {
    Element.prototype.scrollIntoView = vi.fn();
    const parent = { id: 'parent', categoryId: 'c', subcategoryId: 's', productTypeId: null, specTemplate: makeParent() };
    const festive = { id: 'festive', categoryId: 'c', subcategoryId: 's', productTypeId: 'festive', specTemplate: { fields: [fabric] } };
    const beforeParent = JSON.stringify(parent), beforeFestive = JSON.stringify(festive);
    const templates = [parent, festive, ...(hasChild ? [{ id: 'child', ...scope, specTemplate: { fields: [{ ...fabric, name: 'flare', label: 'Flare' }] } }] : [])];
    const entity = { status: 'ACTIVE', sortOrder: 0, slug: 'kurtis' };
    const categories = [{ ...entity, id: 'c', name: 'Kurtis Category', subcategories: [{ ...entity, id: 's', categoryId: 'c', name: 'Kurtis', productTypes: [{ ...entity, id: 'p', subcategoryId: 's', name: 'A-Line Kurtis' }, { ...entity, id: 'festive', subcategoryId: 's', name: 'Festive Kurtis' }] }] }];
    const payloads: Array<{ categoryId: string; subcategoryId: string; productTypeId: string; specTemplate: SpecificationDocument }> = [];
    const previousFetch = globalThis.fetch;
    vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
      if (url === '/api/category-templates') {
        const payload = JSON.parse(options!.body as string); payloads.push(payload);
        return { ok: true, json: async () => ({ template: { ...payload, id: 'saved' } }) };
      }
      return { ok: true, json: async () => options?.method === 'POST' ? {} : ({ categories, templates, auditLogs: [] }) };
    }));
    render(<Workspace />);
    const toggle = await screen.findByRole('checkbox', { name: 'Inherit specifications from Kurtis' });
    await waitFor(() => expect((screen.getByRole('button', { name: 'Save Draft' }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(toggle);
    await screen.findByRole('heading', { name: 'Inherited from Kurtis' });
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(payloads).toHaveLength(1));
    expect(payloads[0]).toMatchObject(scope);
    expect(payloads[0].specTemplate.fields.map((f) => f.name)).toEqual(hasChild ? ['flare'] : []);
    expect(payloads[0].specTemplate.inheritance).toEqual(meta);
    expect(payloads[0].specTemplate.templateMeta?.status).toBe('DRAFT');
    expect(payloads[0].specTemplate.publishedSpecifications).toBeUndefined();
    expect(JSON.stringify(parent)).toBe(beforeParent); expect(JSON.stringify(festive)).toBe(beforeFestive);
    vi.stubGlobal('fetch', previousFetch);
  });
});
