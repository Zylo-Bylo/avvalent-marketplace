// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import Page from '@/app/vendor/dashboard/upload/page';
import { useVendorProductTypeSpecifications, vendorSpecificationRequest, type VendorSpecificationScope } from '@/lib/vendor-product-type-specifications';
import { resolveCategorySpecifications, type SpecificationInheritance } from '@/lib/category-specification-inheritance';
import { specificationTypes, type VendorSpecField } from '@/lib/vendor-specifications';
const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/components/navbar/Navbar', () => ({ default: () => null }));
vi.mock('@/components/forms/FileUploadField', () => ({ default: ({ onUploaded }: { onUploaded: (url: string) => void }) => <button type="button" onClick={() => onUploaded('https://example.test/image.jpg')}>Mock upload image</button> }));
vi.mock('@/components/forms/LanguageAssistPanel', () => ({ default: () => null }));
afterEach(cleanup);
const scope: VendorSpecificationScope = { categoryId: 'category-id', subcategoryId: 'subcategory-id', productTypeId: 'a-line-id' };
const field = (name: string, extra: Partial<VendorSpecField> = {}): VendorSpecField => ({ name, label: name, placeholder: '', fieldType: 'Text', ...extra });
const response = (fields: VendorSpecField[], extra = {}) => ({ template: { specTemplate: { title: 'Resolved Specifications', helpText: 'Details', fields } }, ...extra });
const http = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;
const mockFetch = (callback: (url: string, options?: RequestInit) => Promise<Response>) => vi.spyOn(globalThis, 'fetch').mockImplementation((url, options) => callback(String(url), options));
function deferred() { let resolve!: (value: Response) => void; const promise = new Promise<Response>((done) => { resolve = done; }); return { promise, resolve }; }

describe('vendor ProductType specification requests', () => {
  it('includes all stable IDs and explicit resolved mode', () => {
    const url = new URL(vendorSpecificationRequest(scope), 'http://localhost');
    expect(Object.fromEntries(url.searchParams)).toEqual({ ...scope, mode: 'resolved-specifications' });
  });
  it('uses no resolved mode without a ProductType and the hook makes no duplicate default request', () => {
    const fetch = mockFetch(async () => http({}));
    const parentScope = { ...scope, productTypeId: '' };
    expect(vendorSpecificationRequest(parentScope)).not.toContain('mode=');
    renderHook(() => useVendorProductTypeSpecifications(parentScope)); expect(fetch).not.toHaveBeenCalled();
  });
  it('rejects incomplete ProductType scopes', () => expect(() => vendorSpecificationRequest({ ...scope, subcategoryId: '' })).toThrow('Subcategory'));
  it('passes the effective inherited/local/override/exclusion list through without duplicates or re-merging', async () => {
    const metadata: SpecificationInheritance = { version: 1, enabled: true, source: { categoryId: scope.categoryId, subcategoryId: scope.subcategoryId }, excludedKeys: ['excluded'], provideToProductTypes: false };
    const result = resolveCategorySpecifications({ scope, hierarchy: { category: { id: scope.categoryId }, subcategory: { id: scope.subcategoryId, categoryId: scope.categoryId }, productType: { id: scope.productTypeId, subcategoryId: scope.subcategoryId } }, parent: { scope: { ...scope, productTypeId: null }, specTemplate: { fields: [field('inherited'), field('override'), field('excluded')], inheritance: { version: 1, enabled: false, excludedKeys: [], provideToProductTypes: true } } }, child: { inheritance: metadata, fields: [field('override', { label: 'Child override' }), field('local')] } });
    mockFetch(async () => http(response(result.fields)));
    const { result: hook } = renderHook(() => useVendorProductTypeSpecifications(scope));
    await waitFor(() => expect(hook.current.loading).toBe(false));
    expect(hook.current.template!.fields).toEqual(result.fields);
    expect(hook.current.template!.fields.map((f) => f.name)).toEqual(['inherited', 'override', 'local']);
    expect(hook.current.template!.fields[1].label).toBe('Child override');
  });
  it.each(['standalone-id', 'festive-id'])('preserves %s response without forcing inheritance', async (productTypeId) => {
    mockFetch(async () => http(response([field('standalone')], { resolution: { inheritanceApplied: false } })));
    const { result } = renderHook(() => useVendorProductTypeSpecifications({ ...scope, productTypeId }));
    await waitFor(() => expect(result.current.loading).toBe(false)); expect(result.current.template!.fields.map((f) => f.name)).toEqual(['standalone']);
  });
  it('preserves a legitimate null standalone fallback response', async () => {
    mockFetch(async () => http({ template: null, resolution: { inheritanceApplied: false } }));
    const { result } = renderHook(() => useVendorProductTypeSpecifications(scope));
    await waitFor(() => expect(result.current.loading).toBe(false)); expect(result.current.error).toBe(''); expect(result.current.template).toBeNull();
  });
  it('shows missing published snapshot error without issuing a fallback request and supports retry', async () => {
    const fetch = mockFetch(async () => http({ code: 'PUBLISHED_SPECIFICATIONS_UNAVAILABLE' }, 409));
    const { result } = renderHook(() => useVendorProductTypeSpecifications(scope));
    await waitFor(() => expect(result.current.error).toContain('publish its parent'));
    expect(result.current.template).toBeNull(); expect(fetch).toHaveBeenCalledTimes(1);
    fetch.mockResolvedValue(http(response([field('ready')])));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.template?.fields[0].name).toBe('ready'));
    for (const [url] of fetch.mock.calls) expect(String(url)).toContain('mode=resolved-specifications');
  });
  it.each([400, 500])('does not substitute a fallback on HTTP %s', async (status) => {
    mockFetch(async () => http({ error: 'invalid template' }, status));
    const { result } = renderHook(() => useVendorProductTypeSpecifications(scope));
    await waitFor(() => expect(result.current.error).not.toBe('')); expect(result.current.template).toBeNull();
  });
  it('switches scopes, aborts old work, and ignores an old response even if cancellation is ignored', async () => {
    const first = deferred(), second = deferred();
    const fetch = mockFetch((url) => url.includes('a-line-id') ? first.promise : second.promise);
    const { result, rerender } = renderHook(({ selected }) => useVendorProductTypeSpecifications(selected), { initialProps: { selected: scope } });
    rerender({ selected: { ...scope, productTypeId: 'anarkali-id' } });
    expect(result.current.template).toBeNull(); expect(result.current.loading).toBe(true);
    expect((fetch.mock.calls[0][1]?.signal as AbortSignal).aborted).toBe(true);
    await act(async () => second.resolve(http(response([field('anarkali')]))));
    await waitFor(() => expect(result.current.template?.fields[0].name).toBe('anarkali'));
    await act(async () => first.resolve(http(response([field('a-line')]))));
    expect(result.current.template!.fields.map((f) => f.name)).toEqual(['anarkali']);
  });
  it('clears an already-loaded sibling list immediately when a new scope starts loading', async () => {
    const pending = deferred(); mockFetch((url) => url.includes('a-line-id') ? Promise.resolve(http(response([field('a-only')]))) : pending.promise);
    const { result, rerender } = renderHook(({ selected }) => useVendorProductTypeSpecifications(selected), { initialProps: { selected: scope } });
    await waitFor(() => expect(result.current.loading).toBe(false)); rerender({ selected: { ...scope, productTypeId: 'anarkali-id' } });
    expect(result.current.template).toBeNull(); expect(result.current.loading).toBe(true);
  });
});

const categories = [{ id: scope.categoryId, name: 'Kurtis Category', subcategories: [{ id: scope.subcategoryId, categoryId: scope.categoryId, name: 'Kurtis', productTypes: [{ id: 'a-line-id', subcategoryId: scope.subcategoryId, name: 'A-Line Kurtis' }, { id: 'anarkali-id', subcategoryId: scope.subcategoryId, name: 'Anarkali Kurtis' }, { id: 'festive-id', subcategoryId: scope.subcategoryId, name: 'Festive Kurtis' }] }] }];
async function openPage(load: (url: string) => Response | Promise<Response>) {
  const fetch = mockFetch(async (url) => {
    if (url === '/api/auth/me') return http({ user: { role: 'VENDOR', vendorProfile: { status: 'APPROVED' } } });
    if (url === '/api/categories') return http({ categories });
    if (url.includes('mode=resolved-specifications')) return load(url);
    return http(response([field('default-field') ]));
  });
  render(<Page />);
  fireEvent.click(await screen.findByRole('button', { name: /Single Catalog/ }));
  fireEvent.click(screen.getByRole('button', { name: '2 Basic Info' }));
  fireEvent.click(screen.getByRole('button', { name: 'Kurtis Category' }));
  fireEvent.click(screen.getByRole('button', { name: 'Kurtis' }));
  return fetch;
}
const select = (id: string) => fireEvent.change(screen.getByLabelText('Catalog ProductType'), { target: { value: id } });
const specs = () => fireEvent.click(screen.getByRole('button', { name: '3 Size / Specs' }));

describe('Vendor Upload integration with the unchanged Step B renderer', () => {
  it('uses persisted option IDs, renders effective fields, and isolates sibling answers', async () => {
    const fetch = await openPage((url) => http(response([field('shared'), field(url.includes('a-line-id') ? 'a-only' : 'b-only')])));
    expect((screen.getByRole('option', { name: 'A-Line Kurtis' }) as HTMLOptionElement).value).toBe('a-line-id');
    select('a-line-id'); specs(); await screen.findByLabelText('a-only');
    fireEvent.change(screen.getByLabelText('shared'), { target: { value: 'A answer' } });
    fireEvent.click(screen.getByRole('button', { name: '2 Basic Info' })); select('anarkali-id'); specs();
    await screen.findByLabelText('b-only'); expect(screen.queryByLabelText('a-only')).toBeNull();
    expect((screen.getByLabelText('shared') as HTMLInputElement).value).toBe('');
    expect(fetch.mock.calls.some(([url]) => String(url).includes('productTypeId=anarkali-id'))).toBe(true);
  });
  it('renders all eight types, preserves options/units/restrictions, and validates required fields', async () => {
    const fields = specificationTypes.map((fieldType, i) => field('type_' + i, { label: fieldType, fieldType, dropdownValues: ['Current'], options: ['Legacy'], unit: fieldType === 'Measurement' ? 'cm' : '', required: fieldType === 'Text' }));
    await openPage(() => http(response([...fields, field('hidden', { adminOnly: true }), field('locked', { vendorEditable: false })])));
    select('a-line-id'); specs(); await screen.findByLabelText('Text *');
    for (const type of specificationTypes) expect(screen.getByLabelText(type === 'Text' ? 'Text *' : type)).toBeTruthy();
    expect(screen.queryByLabelText('hidden')).toBeNull(); expect((screen.getByLabelText('locked') as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByRole('option', { name: 'Legacy' })).toBeNull(); expect(screen.getByText('cm')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Variants' })); expect(screen.getByText('Please complete required field: Text.')).toBeTruthy();
  });
  it('shows an explicit recoverable missing-snapshot error and hides the default template', async () => {
    await openPage(() => http({ code: 'PUBLISHED_SPECIFICATIONS_UNAVAILABLE' }, 409));
    select('a-line-id'); specs();
    await screen.findByRole('button', { name: 'Retry specifications' });
    expect(screen.getByRole('alert').textContent).toContain('publish its parent');
    expect(screen.queryByLabelText('default-field')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Variants' }));
    expect(screen.getByRole('heading', { name: 'Product Specifications' })).toBeTruthy();
  });
});


it('submits the selected canonical ProductType ID while preserving specification and legacy text payloads', async () => {
  const fetch = await openPage(() => http(response([field('choices', { fieldType: 'Multi-select', dropdownValues: ['Red', 'Blue'] }), field('material')], { resolution: { inheritanceApplied: true, provenance: [] } })));
  fireEvent.change(screen.getByPlaceholderText('Product Name *'), { target: { value: 'Test Kurti' } });
  select('a-line-id'); specs(); await screen.findByLabelText('choices');
  const choices = screen.getByLabelText('choices') as HTMLSelectElement;
  for (const option of Array.from(choices.options)) option.selected = true;
  fireEvent.change(choices);
  fireEvent.change(screen.getByLabelText('material'), { target: { value: 'Cotton' } });
  fireEvent.click(screen.getByRole('button', { name: '1 Images' }));
  fireEvent.click(screen.getByRole('button', { name: 'Mock upload image' }));
  fireEvent.click(screen.getByRole('button', { name: '4 Variants' }));
  fireEvent.change(screen.getByPlaceholderText('Stock'), { target: { value: '5' } });
  fireEvent.click(screen.getByRole('button', { name: '5 Final Submit' }));
  fireEvent.change(screen.getByPlaceholderText('Vendor price / payout *'), { target: { value: '500' } });
  fireEvent.submit(screen.getByRole('button', { name: 'Submit Catalog' }).closest('form')!);
  await waitFor(() => expect(fetch.mock.calls.some(([url]) => String(url) === '/api/products/create')).toBe(true));
  const payload = JSON.parse(fetch.mock.calls.find(([url]) => String(url) === '/api/products/create')![1]!.body as string);
  expect(payload.material).toBe('Cotton');
  expect(payload.productTypeId).toBe('a-line-id');
  expect(payload).toHaveProperty('productType');
  expect(payload.categoryId).toBe('category-id');
  expect(payload.subcategoryId).toBe('subcategory-id');
  expect(payload.description).toContain('choices: "Red","Blue"');
  expect(payload.description).toContain('A-Line Kurtis');
  expect(payload).not.toHaveProperty('inheritance'); expect(payload).not.toHaveProperty('resolution'); expect(payload).not.toHaveProperty('specTemplate');
});
