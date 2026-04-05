import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProductCard from '../ProductCard';

const mocks = vi.hoisted(() => ({
  addToCart: vi.fn(),
  trackAddToCart: vi.fn(),
}));

vi.mock('../../context/CartContext', () => ({
  useCart: () => ({
    addToCart: mocks.addToCart,
    shopOpen: true,
  }),
}));

vi.mock('../../utils/analytics', () => ({
  trackAddToCart: mocks.trackAddToCart,
}));

vi.mock('../../utils/helpers', () => ({
  formatCurrency: (value, currency) => `${currency} ${value}`,
  getImageUrl: (path) => path,
  isProductInStock: ({ stock }) => Boolean(stock?.is_available && stock?.num_in_stock > 0),
}));

vi.mock('../../utils/safeContent', () => ({
  sanitizeText: (value) => value,
}));

const product = {
  id: 42,
  title: 'Field Guide',
  structure: 'standalone',
  price: {
    incl_tax: '12.50',
    currency: 'SGD',
  },
  stock: {
    is_available: true,
    num_in_stock: 8,
  },
  images: [],
};

const renderProductCard = () =>
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ProductCard product={product} />
    </MemoryRouter>
  );

describe('ProductCard', () => {
  beforeEach(() => {
    mocks.addToCart.mockReset();
    mocks.trackAddToCart.mockReset();
  });

  it('tracks add_to_cart after a successful quick add', async () => {
    mocks.addToCart.mockResolvedValue({ success: true });

    renderProductCard();
    fireEvent.click(screen.getByRole('button', { name: /add to cart/i }));

    await waitFor(() => {
      expect(mocks.addToCart).toHaveBeenCalledWith(product.id, 1);
      expect(mocks.trackAddToCart).toHaveBeenCalledWith(product, null, 1, product.price);
    });
  });

  it('does not track add_to_cart when quick add fails', async () => {
    mocks.addToCart.mockResolvedValue({ success: false });

    renderProductCard();
    fireEvent.click(screen.getByRole('button', { name: /add to cart/i }));

    await waitFor(() => {
      expect(mocks.addToCart).toHaveBeenCalledWith(product.id, 1);
    });
    expect(mocks.trackAddToCart).not.toHaveBeenCalled();
  });
});
