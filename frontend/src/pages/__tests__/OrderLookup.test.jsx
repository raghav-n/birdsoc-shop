import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import OrderLookup from '../OrderLookup';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('../../services/api', () => ({
  default: {
    get: (...args) => mocks.get(...args),
    post: (...args) => mocks.post(...args),
  },
}));

vi.mock('../../components/CollectionQrScanner', () => ({
  default: ({ onScan }) => (
    <button type="button" onClick={() => onScan({ number: '12345', accessId: 'scan-id' })}>
      Mock scan
    </button>
  ),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: (...args) => mocks.toastSuccess(...args),
    error: (...args) => mocks.toastError(...args),
  },
}));

const renderOrderLookup = (initialEntry = '/console/order-lookup') => render(
  <MemoryRouter initialEntries={[initialEntry]}>
    <Routes>
      <Route path="/console/order-lookup" element={<OrderLookup />} />
      <Route path="/console/order-lookup/:number" element={<OrderLookup />} />
    </Routes>
  </MemoryRouter>
);

describe('OrderLookup', () => {
  beforeEach(() => {
    mocks.get.mockReset();
    mocks.post.mockReset();
    mocks.toastSuccess.mockReset();
    mocks.toastError.mockReset();
    mocks.get.mockResolvedValue({
      data: {
        orders: [
          {
            number: '12345',
            customer_name: 'Alex Tan',
            status: 'Ready',
            items: [{ title: 'Bird Guide', quantity: 1, category: 'Books' }],
          },
        ],
      },
    });
  });

  it('loads a deep-linked collection order on mount', async () => {
    renderOrderLookup('/console/order-lookup/12345?id=deep-link');

    await waitFor(() => {
      expect(mocks.get).toHaveBeenCalledWith('/orders/search', {
        params: { number: '12345', id: 'deep-link' },
      });
    });

    expect(await screen.findByDisplayValue('12345')).toBeInTheDocument();
    expect(screen.getByText('Alex Tan', { exact: false })).toBeInTheDocument();
  });

  it('looks up an order when the scanner resolves a collection QR', async () => {
    renderOrderLookup();

    fireEvent.click(screen.getByRole('button', { name: 'Mock scan' }));

    await waitFor(() => {
      expect(mocks.get).toHaveBeenCalledWith('/orders/search', {
        params: { number: '12345', id: 'scan-id' },
      });
    });

    expect(await screen.findByDisplayValue('12345')).toBeInTheDocument();
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Opened order 12345');
  });

  it('expands every active order and leaves collected orders collapsed', async () => {
    mocks.get.mockResolvedValue({
      data: {
        orders: [
          {
            number: '12345',
            customer_name: 'Alex Tan',
            status: 'Ready',
            items: [{ title: 'Bird Guide', quantity: 1, category: 'Books' }],
          },
          {
            number: '12346',
            customer_name: 'Alex Tan',
            status: 'Ready',
            items: [{ title: 'Field Binoculars', quantity: 1, category: 'Gear' }],
          },
          {
            number: '12300',
            customer_name: 'Alex Tan',
            status: 'Collected',
            items: [{ title: 'Old Sticker', quantity: 1, category: 'Misc' }],
          },
        ],
      },
    });

    renderOrderLookup('/console/order-lookup/12345?id=deep-link');

    // Both active orders' items are visible (expanded) without any clicks.
    expect(await screen.findByText('Bird Guide')).toBeInTheDocument();
    expect(screen.getByText('Field Binoculars')).toBeInTheDocument();
    // The collected order stays collapsed.
    expect(screen.queryByText('Old Sticker')).not.toBeInTheDocument();
  });
});
