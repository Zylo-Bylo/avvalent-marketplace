// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Page from '@/app/vendor/dashboard/upload/page';
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));
vi.mock('@/components/navbar/Navbar', () => ({ default: () => null }));
vi.mock('@/components/forms/FileUploadField', () => ({ default: () => null }));
vi.mock('@/components/forms/LanguageAssistPanel', () => ({ default: () => null }));
afterEach(cleanup);

describe('existing bulk ProductType support boundary', () => {
  it.each(['', ',ProductType,ProductType Slug', ',ProductType ID'])(
    'retains legacy creation without inferring a ProductType from unsupported columns %s', async (extraHeaders) => {
      const categories = [{ id: 'c1', name: 'Kurtis', subcategories: [{ id: 's1', categoryId: 'c1', name: 'Kurtis', productTypes: [{ id: 't1', name: 'A-Line Kurtis', slug: 'a-line-kurtis' }] }] }];
      const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => ({
        ok: true, json: async () => String(url) === '/api/auth/me'
          ? { user: { role: 'VENDOR', vendorProfile: { status: 'APPROVED' } } }
          : String(url) === '/api/categories' ? { categories }
          : options?.method === 'POST' ? { id: 'created' } : {},
      }) as Response);
      render(<Page />);
      fireEvent.click(await screen.findByRole('button', { name: /Bulk Catalog/ }));
      const extraValues = extraHeaders.includes('Slug') ? ',A-Line Kurtis,a-line-kurtis' : extraHeaders ? ',t1' : '';
      const csv = `Product Name,Category,Subcategory,Vendor Price,Stock,Image URLs${extraHeaders}\nKurti,Kurtis,Kurtis,500,3,https://example.test/image.jpg${extraValues}`;
      const file = new File([csv], 'products.csv', { type: 'text/csv' });
      Object.defineProperty(file, 'text', { value: async () => csv });
      fireEvent.change(screen.getByLabelText('Upload CSV'), { target: { files: [file] } });
      const submit = screen.getByRole('button', { name: 'Submit Valid Rows' });
      await waitFor(() => expect((submit as HTMLButtonElement).disabled).toBe(false));
      fireEvent.click(submit);
      await waitFor(() => expect(fetch.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(true));
      const payload = JSON.parse(fetch.mock.calls.find(([, options]) => options?.method === 'POST')![1]!.body as string);
      expect(payload).toMatchObject({ categoryId: 'c1', subcategoryId: 's1', name: 'Kurti' });
      expect(payload).not.toHaveProperty('productTypeId');
      expect(payload).not.toHaveProperty('productType');
    },
  );
});
