// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReturnReceiptQcPanel from '@/components/admin/ReturnReceiptQcPanel';

function response(data: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  }));
}

const item = {
  id: 'item-1', productId: 'product-1', productName: 'Festive Kurti', variantId: 'variant-1',
  sizeLabel: 'M', variantColor: 'Red', orderedQuantity: 3, receivedQuantity: 0, dispositions: [],
};

function receipt(status: 'PENDING' | 'RECEIVED' | 'QC_COMPLETED', overrides: Record<string, unknown> = {}) {
  return { id: 'receipt-1', status, items: [{ ...item }], ...overrides };
}

describe('admin return receipt QC panel', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('shows Open Return Receipt when no receipt exists', async () => {
    vi.stubGlobal('fetch', vi.fn(() => response({ receipt: null })));
    render(<ReturnReceiptQcPanel returnRequestId="return-1" />);
    expect(await screen.findByRole('button', { name: 'Open Return Receipt' })).toBeTruthy();
  });

  it('shows Mark as Received for a pending receipt', async () => {
    vi.stubGlobal('fetch', vi.fn(() => response({ receipt: receipt('PENDING') })));
    render(<ReturnReceiptQcPanel returnRequestId="return-1" />);
    expect(await screen.findByRole('button', { name: 'Mark as Received' })).toBeTruthy();
  });

  it('shows editable QC inputs for RECEIVED and read-only inputs for QC_COMPLETED', async () => {
    const fetchMock = vi.fn(() => response({ receipt: receipt('RECEIVED') }));
    vi.stubGlobal('fetch', fetchMock);
    const view = render(<ReturnReceiptQcPanel returnRequestId="return-1" />);
    const received = await screen.findByLabelText('item-1-receivedQuantity');
    expect(received.hasAttribute('readonly')).toBe(false);

    fetchMock.mockImplementation(() => response({ receipt: receipt('QC_COMPLETED', {
      items: [{ ...item, receivedQuantity: 3, dispositions: [{ id: 'd1', disposition: 'RESELLABLE', quantity: 3, processedAt: null }] }],
    }) }));
    view.rerender(<ReturnReceiptQcPanel returnRequestId="return-2" />);
    expect((await screen.findByLabelText('item-1-receivedQuantity')).hasAttribute('readonly')).toBe(true);
    expect(screen.getByRole('button', { name: 'Process Stock' })).toBeTruthy();
  });

  it('surfaces the backend missing-warehouse error', async () => {
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => response({ receipt: null }))
      .mockImplementationOnce(() => response({ error: 'Original fulfilment warehouse is unavailable; stock receipt cannot be opened safely.' }, 400));
    vi.stubGlobal('fetch', fetchMock);
    render(<ReturnReceiptQcPanel returnRequestId="return-1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Open Return Receipt' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Original fulfilment warehouse is unavailable');
  });

  it('blocks invalid totals and sends the valid authoritative QC payload', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input); calls.push({ url, init });
      if (!init?.method || init.method === 'GET') return response({ receipt: receipt('RECEIVED') });
      return response({ status: init.method === 'PATCH' ? 'RECEIVED' : 'OK' });
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<ReturnReceiptQcPanel returnRequestId="return-1" />);
    const received = await screen.findByLabelText('item-1-receivedQuantity');
    const resellable = screen.getByLabelText('item-1-RESELLABLE');
    fireEvent.change(received, { target: { value: '3' } });
    fireEvent.change(resellable, { target: { value: '2' } });
    expect((screen.getByRole('button', { name: 'Complete QC' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Disposition total must equal received quantity.')).toBeTruthy();

    fireEvent.change(resellable, { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Complete QC' }));
    await waitFor(() => expect(calls.some((call) => {
      if (call.init?.method !== 'PATCH' || !call.init.body) return false;
      const body = JSON.parse(String(call.init.body));
      return body.action === 'SAVE_QC' && body.items[0].receiptItemId === 'item-1' &&
        body.items[0].receivedQuantity === 3 && body.items[0].dispositions[0].quantity === 3;
    })).toBe(true));
  });

  it('shows processed, already-processed and partial failure results', async () => {
    const completed = receipt('QC_COMPLETED', {
      items: [{ ...item, dispositions: [{ id: 'd1', disposition: 'RESELLABLE', quantity: 3, processedAt: null }] }],
    });
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('/process') && init?.method === 'POST') {
        return response({
          results: [
            { dispositionId: 'd1', status: 'PROCESSED' },
            { dispositionId: 'd2', status: 'ALREADY_PROCESSED' },
          ],
          failures: [{ dispositionId: 'd3', error: 'warehouse invalid' }],
        }, 409);
      }
      return response({ receipt: completed });
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<ReturnReceiptQcPanel returnRequestId="return-1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Process Stock' }));
    expect(await screen.findByText('PROCESSED')).toBeTruthy();
    expect(screen.getByText('ALREADY PROCESSED')).toBeTruthy();
    expect(screen.getByText('warehouse invalid')).toBeTruthy();
  });

  it('does not render a warehouse selector', async () => {
    vi.stubGlobal('fetch', vi.fn(() => response({ receipt: receipt('RECEIVED') })));
    render(<ReturnReceiptQcPanel returnRequestId="return-1" />);
    await screen.findByText('Items & QC');
    expect(screen.queryByLabelText(/warehouse/i)).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
  });
});
