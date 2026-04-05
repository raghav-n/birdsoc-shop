import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  createBasket: vi.fn(),
  getCurrentBasket: vi.fn(),
  addToBasket: vi.fn(),
  updateBasketLine: vi.fn(),
  removeBasketLine: vi.fn(),
  applyVoucher: vi.fn(),
  mergeBaskets: vi.fn(),
  getCartId: vi.fn(),
  setCartId: vi.fn(),
  clearCartId: vi.fn(),
  authState: { isAuthenticated: false, loading: false },
  shopState: { shopOpen: true },
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('../../services/basket', () => ({
  basketService: {
    createBasket: (...args) => mocks.createBasket(...args),
    getCurrentBasket: (...args) => mocks.getCurrentBasket(...args),
    addToBasket: (...args) => mocks.addToBasket(...args),
    updateBasketLine: (...args) => mocks.updateBasketLine(...args),
    removeBasketLine: (...args) => mocks.removeBasketLine(...args),
    applyVoucher: (...args) => mocks.applyVoucher(...args),
    mergeBaskets: (...args) => mocks.mergeBaskets(...args),
  },
}));

vi.mock('../../services/api', () => ({
  tokenManager: {
    getCartId: () => mocks.getCartId(),
    setCartId: (cartId) => mocks.setCartId(cartId),
    clearCartId: () => mocks.clearCartId(),
  },
}));

vi.mock('../AuthContext', () => ({
  useAuth: () => mocks.authState,
}));

vi.mock('../ShopConfigContext', () => ({
  useShopConfig: () => ({ ...mocks.shopState, loading: false, config: null }),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: (...args) => mocks.toastSuccess(...args),
    error: (...args) => mocks.toastError(...args),
  },
}));

import { CartProvider, useCart } from '../CartContext';

const CartHarness = () => {
  const { addToCart, cart, getCartCount, loading } = useCart();

  return (
    <div>
      <div data-testid="loading">{String(loading)}</div>
      <div data-testid="cart-id">{cart?.id ?? 'none'}</div>
      <div data-testid="cart-count">{String(getCartCount())}</div>
      <button onClick={() => addToCart(55, 2, { size: 'M' })}>Add item</button>
    </div>
  );
};

const renderCartProvider = () =>
  render(
    <CartProvider>
      <CartHarness />
    </CartProvider>
  );

describe('CartProvider', () => {
  beforeEach(() => {
    mocks.createBasket.mockReset();
    mocks.getCurrentBasket.mockReset();
    mocks.addToBasket.mockReset();
    mocks.updateBasketLine.mockReset();
    mocks.removeBasketLine.mockReset();
    mocks.applyVoucher.mockReset();
    mocks.mergeBaskets.mockReset();
    mocks.getCartId.mockReset();
    mocks.setCartId.mockReset();
    mocks.clearCartId.mockReset();
    mocks.toastSuccess.mockReset();
    mocks.toastError.mockReset();

    mocks.authState.isAuthenticated = false;
    mocks.authState.loading = false;
    mocks.shopState.shopOpen = true;
  });

  it('creates and stores a guest basket when none exists', async () => {
    mocks.getCartId.mockReturnValue(null);
    mocks.createBasket.mockResolvedValue({
      cart_id: 'guest-1',
      basket: {
        id: 101,
        lines: [{ quantity: 2 }],
      },
    });

    renderCartProvider();

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
      expect(screen.getByTestId('cart-id')).toHaveTextContent('101');
      expect(screen.getByTestId('cart-count')).toHaveTextContent('2');
    });

    expect(mocks.createBasket).toHaveBeenCalledTimes(1);
    expect(mocks.setCartId).toHaveBeenCalledWith('guest-1');
  });

  it('retries add-to-cart against the fresh basket when the current basket is stale', async () => {
    mocks.getCartId.mockReturnValue('guest-1');
    mocks.getCurrentBasket
      .mockResolvedValueOnce({
        id: 1,
        lines: [{ quantity: 1 }],
      })
      .mockResolvedValueOnce({
        id: 2,
        lines: [{ quantity: 1 }],
      })
      .mockResolvedValueOnce({
        id: 2,
        lines: [{ quantity: 1 }],
      })
      .mockResolvedValueOnce({
        id: 2,
        lines: [{ quantity: 3 }],
      });
    mocks.addToBasket
      .mockRejectedValueOnce({ response: { status: 410 } })
      .mockResolvedValueOnce({});

    renderCartProvider();

    await waitFor(() => {
      expect(screen.getByTestId('cart-id')).toHaveTextContent('1');
    });

    fireEvent.click(screen.getByRole('button', { name: /add item/i }));

    await waitFor(() => {
      expect(screen.getByTestId('cart-id')).toHaveTextContent('2');
      expect(screen.getByTestId('cart-count')).toHaveTextContent('3');
    });

    expect(mocks.addToBasket).toHaveBeenNthCalledWith(1, 1, 55, 2, { size: 'M' });
    expect(mocks.addToBasket).toHaveBeenNthCalledWith(2, 2, 55, 2, { size: 'M' });
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Item added to cart');
  });

  it('blocks add-to-cart when the shop is closed', async () => {
    mocks.shopState.shopOpen = false;
    mocks.getCartId.mockReturnValue('guest-1');
    mocks.getCurrentBasket.mockResolvedValue({
      id: 1,
      lines: [],
    });

    renderCartProvider();

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    fireEvent.click(screen.getByRole('button', { name: /add item/i }));

    expect(mocks.addToBasket).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledWith('The shop is currently closed');
  });
});
