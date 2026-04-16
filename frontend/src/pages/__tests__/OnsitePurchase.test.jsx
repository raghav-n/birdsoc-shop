import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OnsitePurchase from '../OnsitePurchase';

const mocks = vi.hoisted(() => ({
  getProducts: vi.fn(),
  getCategories: vi.fn(),
  calculate: vi.fn(),
  createPending: vi.fn(),
  placeOrder: vi.fn(),
  checkPayNowEmail: vi.fn(),
  toast: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('../../services/catalogue', () => ({
  catalogueService: {
    getProducts: (...args) => mocks.getProducts(...args),
    getCategories: (...args) => mocks.getCategories(...args),
  },
}));

vi.mock('../../services/onsite', () => ({
  onsiteService: {
    calculate: (...args) => mocks.calculate(...args),
    createPending: (...args) => mocks.createPending(...args),
    placeOrder: (...args) => mocks.placeOrder(...args),
  },
}));

vi.mock('../../services/checkout', () => ({
  checkoutService: {
    checkPayNowEmail: (...args) => mocks.checkPayNowEmail(...args),
  },
}));

vi.mock('../../components/PayNowQR', () => ({
  default: () => <div>PayNow QR</div>,
}));

vi.mock('react-hot-toast', () => ({
  default: Object.assign(
    (...args) => mocks.toast(...args),
    {
      error: (...args) => mocks.toastError(...args),
    }
  ),
}));

const parentProduct = {
  id: 77,
  title: 'Club Tee',
  structure: 'parent',
  is_public: true,
  category_slugs: ['apparel'],
  images: [],
  children: [
    {
      id: 201,
      title: 'Club Tee - M',
      attributes: [{ value: 'M' }],
      price: { incl_tax: 20, currency: 'SGD' },
      stock: { is_available: true, num_in_stock: 3 },
    },
    {
      id: 202,
      title: 'Club Tee - L',
      attributes: [{ value: 'L' }],
      price: { incl_tax: 24, currency: 'SGD' },
      stock: { is_available: true, num_in_stock: 2 },
    },
  ],
};

const samePriceParentProduct = {
  id: 88,
  title: 'Club Cap',
  structure: 'parent',
  is_public: true,
  category_slugs: ['accessories'],
  images: [],
  children: [
    {
      id: 301,
      title: 'Club Cap - S',
      attributes: [{ value: 'S' }],
      price: { incl_tax: 18, currency: 'SGD' },
      stock: { is_available: true, num_in_stock: 5 },
    },
    {
      id: 302,
      title: 'Club Cap - M',
      attributes: [{ value: 'M' }],
      price: { incl_tax: 18, currency: 'SGD' },
      stock: { is_available: true, num_in_stock: 2 },
    },
  ],
};

const standaloneProduct = {
  id: 99,
  title: 'Bird Guide',
  structure: 'standalone',
  is_public: true,
  category_slugs: ['books'],
  images: [{ thumbnail: '/thumb.jpg', original: '/original.jpg' }],
  price: { incl_tax: 12, currency: 'SGD' },
  stock: { is_available: true, num_in_stock: 10 },
};

const sharedWordProductA = {
  id: 111,
  title: 'Bird Society Mug',
  structure: 'standalone',
  is_public: true,
  category_slugs: ['gifts'],
  images: [],
  price: { incl_tax: 15, currency: 'SGD' },
  stock: { is_available: true, num_in_stock: 8 },
};

const sharedWordProductB = {
  id: 112,
  title: 'Bird Society Tote',
  structure: 'standalone',
  is_public: true,
  category_slugs: ['gifts'],
  images: [],
  price: { incl_tax: 22, currency: 'SGD' },
  stock: { is_available: true, num_in_stock: 6 },
};

const categories = [
  { id: 1, slug: 'accessories', name: 'Accessories' },
  { id: 2, slug: 'apparel', name: 'Apparel' },
  { id: 3, slug: 'books', name: 'Books' },
  { id: 4, slug: 'gifts', name: 'Gifts' },
];

describe('OnsitePurchase', () => {
  beforeEach(() => {
    mocks.getProducts.mockReset();
    mocks.getCategories.mockReset();
    mocks.calculate.mockReset();
    mocks.createPending.mockReset();
    mocks.placeOrder.mockReset();
    mocks.checkPayNowEmail.mockReset();
    mocks.toast.mockReset();
    mocks.toastError.mockReset();
    mocks.getCategories.mockResolvedValue({ results: categories });
    mocks.calculate.mockResolvedValue({ subtotal: '20.00', total: '20.00' });
    mocks.createPending.mockResolvedValue({
      order_number: '2ABCDE',
      reference: 'MER-2ABCDE',
      total: '20.00',
      pending: true,
    });
    mocks.checkPayNowEmail.mockResolvedValue({ confirmed: false });
  });

  it('adds the clicked variant instead of the parent product card', async () => {
    mocks.getProducts.mockResolvedValue({ results: [parentProduct] });

    render(
      <MemoryRouter>
        <OnsitePurchase />
      </MemoryRouter>
    );

    await screen.findByText('Club Tee');

    fireEvent.click(screen.getByText('Club Tee'));
    expect(screen.queryByText('Club Tee - M')).not.toBeInTheDocument();
    expect(mocks.calculate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Add Club Tee - M' }));

    expect(screen.getByText('Club Tee - M')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Club Tee - M' })).toHaveTextContent('1');

    await waitFor(() => {
      expect(mocks.calculate).toHaveBeenCalledWith([{ id: 201, quantity: 1 }], '');
    });
  });

  it('shows a shared parent price and only low-stock variant metadata', async () => {
    mocks.getProducts.mockResolvedValue({ results: [samePriceParentProduct] });

    render(
      <MemoryRouter>
        <OnsitePurchase />
      </MemoryRouter>
    );

    await screen.findByText('Club Cap');

    expect(screen.getByText('$18.00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Club Cap - S' })).toHaveTextContent('S');
    expect(screen.getByRole('button', { name: 'Add Club Cap - S' })).not.toHaveTextContent('$18.00');
    expect(screen.getByRole('button', { name: 'Add Club Cap - S' })).not.toHaveTextContent('5 in stock');
    expect(screen.getByRole('button', { name: 'Add Club Cap - M' })).toHaveTextContent('Only 2 left');
  });

  it('groups products by category and does not render thumbnails', async () => {
    mocks.getProducts.mockResolvedValue({
      results: [standaloneProduct, parentProduct, samePriceParentProduct],
    });

    const { container } = render(
      <MemoryRouter>
        <OnsitePurchase />
      </MemoryRouter>
    );

    await screen.findByText('Accessories');
    await screen.findByText('Apparel');
    await screen.findByText('Books');

    expect(screen.getByText('Club Cap').compareDocumentPosition(screen.getByText('Club Tee')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText('Club Tee').compareDocumentPosition(screen.getByText('Bird Guide')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelectorAll('img')).toHaveLength(0);
  });

  it('strips category-common words from the left display only', async () => {
    mocks.getProducts.mockResolvedValue({
      results: [sharedWordProductA, sharedWordProductB],
    });

    render(
      <MemoryRouter>
        <OnsitePurchase />
      </MemoryRouter>
    );

    const giftsSection = (await screen.findByText('Gifts')).closest('section');

    expect(giftsSection).not.toBeNull();
    expect(within(giftsSection).getByText('Mug')).toBeInTheDocument();
    expect(within(giftsSection).getByText('Tote')).toBeInTheDocument();
    expect(within(giftsSection).queryByText('Bird Society Mug')).not.toBeInTheDocument();

    fireEvent.click(within(giftsSection).getByText('Mug'));

    expect(screen.getByText('Bird Society Mug')).toBeInTheDocument();

    await waitFor(() => {
      expect(mocks.calculate).toHaveBeenCalledWith([{ id: 111, quantity: 1 }], '');
    });
  });

  it('proceeds to payment without placing the order immediately', async () => {
    mocks.getProducts.mockResolvedValue({ results: [parentProduct] });

    render(
      <MemoryRouter>
        <OnsitePurchase />
      </MemoryRouter>
    );

    await screen.findByText('Club Tee');

    fireEvent.click(screen.getByRole('button', { name: 'Add Club Tee - M' }));
    const proceedButton = await screen.findByRole('button', { name: 'Proceed to Payment' });
    fireEvent.click(proceedButton);

    await waitFor(() => {
      expect(mocks.createPending).toHaveBeenCalledWith([{ id: 201, quantity: 1 }], '');
    });

    expect(mocks.placeOrder).not.toHaveBeenCalled();
    expect(screen.getByText('Order Reference')).toBeInTheDocument();
    expect(screen.getByText('MER-2ABCDE')).toBeInTheDocument();
  });

  it('can return from payment to cart editing without clearing the cart', async () => {
    mocks.getProducts.mockResolvedValue({ results: [parentProduct] });

    render(
      <MemoryRouter>
        <OnsitePurchase />
      </MemoryRouter>
    );

    await screen.findByText('Club Tee');

    fireEvent.click(screen.getByRole('button', { name: 'Add Club Tee - M' }));
    const proceedButton = await screen.findByRole('button', { name: 'Proceed to Payment' });
    fireEvent.click(proceedButton);

    await screen.findByText('MER-2ABCDE');

    fireEvent.click(screen.getByRole('button', { name: 'Back to Cart' }));

    expect(screen.getByText('Club Tee - M')).toBeInTheDocument();
    expect(screen.getByText('Cart (1)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Proceed to Payment' })).toBeInTheDocument();
    expect(screen.queryByText('MER-2ABCDE')).not.toBeInTheDocument();
  });
});
