// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Page from '@/app/admin/products/page';
vi.mock('@/components/navbar/Navbar', () => ({ default: () => null }));
afterEach(cleanup);
const categories = [{ id: 'c1', name: 'Category One', subcategories: [
  { id: 's1', name: 'First Subcategory', productTypes: [{ id: 't1', name: 'Original Type' }, { id: 't2', name: 'New Type' }] },
  { id: 's2', name: 'Second Subcategory', productTypes: [{ id: 't3', name: 'Other Type' }] },
] }, { id: 'c2', name: 'Category Two', subcategories: [] }];
async function open() {
  const product = { id: 'p1', name: 'Kurti', description: 'Existing description', price: 500, inventory: 3, images: [], categoryId: 'c1', subcategoryId: 's1', productTypeId: 't1' };
  const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => ({
    ok: true, json: async () => options?.method === 'PUT' ? { ...product, ...JSON.parse(options.body as string) }
      : String(url).startsWith('/api/categories') ? { categories } : { products: [product] },
  }) as Response);
  render(<Page />);
  fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
  return fetch;
}
describe('admin ProductType edit payload', () => {
  it('loads and sends the persisted ID rather than an option label', async () => {
    const fetch = await open();
    expect((screen.getByLabelText('ProductType') as HTMLSelectElement).value).toBe('t1');
    fireEvent.change(screen.getByLabelText('ProductType'), { target: { value: 't2' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Save Product' }).closest('form')!);
    await waitFor(() => expect(fetch.mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(true));
    const payload = JSON.parse(fetch.mock.calls.find(([, options]) => options?.method === 'PUT')![1]!.body as string);
    expect(payload).toMatchObject({ categoryId: 'c1', subcategoryId: 's1', productTypeId: 't2', description: 'Existing description' });
  });
  it('clears ProductType when subcategory changes and restricts available IDs', async () => {
    await open();
    fireEvent.change(screen.getByLabelText('Subcategory'), { target: { value: 's2' } });
    expect((screen.getByLabelText('ProductType') as HTMLSelectElement).value).toBe('');
    expect(screen.queryByRole('option', { name: 'Original Type' })).toBeNull();
    expect((screen.getByRole('option', { name: 'Other Type' }) as HTMLOptionElement).value).toBe('t3');
  });
  it('clears both descendants when category changes', async () => {
    await open();
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'c2' } });
    expect((screen.getByLabelText('Subcategory') as HTMLSelectElement).value).toBe('');
    expect((screen.getByLabelText('ProductType') as HTMLSelectElement).value).toBe('');
    expect((screen.getByLabelText('ProductType') as HTMLSelectElement).disabled).toBe(true);
  });
});
