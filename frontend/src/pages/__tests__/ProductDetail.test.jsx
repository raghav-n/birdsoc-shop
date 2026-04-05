import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProductDetail from '../ProductDetail';

const mocks = vi.hoisted(() => ({
  getProduct: vi.fn(),
  addToCart: vi.fn(),
  trackViewItem: vi.fn(),
  trackAddToCart: vi.fn(),
  shopOpen: true,
}));

vi.mock('../../services/catalogue', () => ({
  catalogueService: {
    getProduct: (...args) => mocks.getProduct(...args),
  },
}));

vi.mock('../../context/CartContext', () => ({
  useCart: () => ({
    addToCart: (...args) => mocks.addToCart(...args),
    shopOpen: mocks.shopOpen,
  }),
}));

vi.mock('../../utils/analytics', () => ({
  trackViewItem: (...args) => mocks.trackViewItem(...args),
  trackAddToCart: (...args) => mocks.trackAddToCart(...args),
}));

vi.mock('../../components/Loading', () => ({
  default: ({ text }) => <div>{text}</div>,
}));

vi.mock('../../components/Alert', () => ({
  default: ({ children }) => <div role="alert">{children}</div>,
}));

vi.mock('../../components/SafeHtml', () => ({
  default: ({ html, tag: Tag = 'div', ...props }) => <Tag {...props}>{html}</Tag>,
}));

vi.mock('../../utils/safeContent', () => ({
  sanitizeText: (value) => value,
}));

const parentProduct = {
  id: 77,
  title: 'Club Tee',
  structure: 'parent',
  description: '<p>Soft cotton tee</p>',
  images: [],
  children: [
    {
      id: 201,
      title: 'Club Tee - M',
      attributes: [{ value: 'M' }],
      price: { incl_tax: 20, currency: 'SGD' },
      stock: { is_available: true, num_in_stock: 3, low_stock_threshold: 5 },
    },
    {
      id: 202,
      title: 'Club Tee - L',
      attributes: [{ value: 'L' }],
      price: { incl_tax: 24, currency: 'SGD' },
      stock: { is_available: false, num_in_stock: 0, low_stock_threshold: 5 },
    },
  ],
  attributes: [{ name: 'Material', value: 'Cotton' }],
};

const renderProductDetail = () =>
  render(
    <MemoryRouter
      initialEntries={['/products/77']}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/products/:id" element={<ProductDetail />} />
      </Routes>
    </MemoryRouter>
  );

describe('ProductDetail', () => {
  beforeEach(() => {
    mocks.getProduct.mockReset();
    mocks.addToCart.mockReset();
    mocks.trackViewItem.mockReset();
    mocks.trackAddToCart.mockReset();
    mocks.shopOpen = true;
  });

  it('updates variant-specific price, stock, and quantity state', async () => {
    mocks.getProduct.mockResolvedValue(parentProduct);

    renderProductDetail();

    await screen.findByText('Club Tee');

    expect(screen.getByRole('button', { name: 'M' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Low Stock')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /increase quantity/i }));
    expect(screen.getByText('2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'L' }));

    expect(screen.getByRole('button', { name: 'L' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Out of Stock')).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes('24.00'))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add to cart/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'M' }));

    expect(screen.getByRole('button', { name: 'M' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('adds the selected variant and quantity to cart', async () => {
    mocks.getProduct.mockResolvedValue(parentProduct);
    mocks.addToCart.mockResolvedValue({ success: true });

    renderProductDetail();

    await screen.findByText('Club Tee');

    fireEvent.click(screen.getByRole('button', { name: /increase quantity/i }));
    fireEvent.click(screen.getByRole('button', { name: /add to cart/i }));

    await waitFor(() => {
      expect(mocks.addToCart).toHaveBeenCalledWith(201, 2);
    });
  });

  it('shows an error message when the product cannot be loaded', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.getProduct.mockRejectedValue(new Error('network error'));

    renderProductDetail();

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load product details');
    consoleError.mockRestore();
  });
});
