import { calculateOrderTotal, getStockStatus, isProductInStock } from '../helpers';

describe('helpers', () => {
  it('identifies in-stock products correctly', () => {
    expect(isProductInStock({
      stock: { is_available: true, num_in_stock: 4 },
    })).toBe(true);

    expect(isProductInStock({
      stock: { is_available: true, num_in_stock: 0 },
    })).toBe(false);

    expect(isProductInStock({
      stock: { is_available: false, num_in_stock: 4 },
    })).toBe(false);
  });

  it('returns the correct stock status for the customer UI', () => {
    expect(getStockStatus()).toBe('Unknown');

    expect(getStockStatus({
      stock: { is_available: false, num_in_stock: 0, low_stock_threshold: 2 },
    })).toBe('Out of Stock');

    expect(getStockStatus({
      stock: { is_available: true, num_in_stock: 2, low_stock_threshold: 3 },
    })).toBe('Low Stock');

    expect(getStockStatus({
      stock: { is_available: true, num_in_stock: 10, low_stock_threshold: 3 },
    })).toBe('In Stock');
  });

  it('adds donations into the order total', () => {
    expect(calculateOrderTotal(18.5)).toBe(18.5);
    expect(calculateOrderTotal(18.5, 4)).toBe(22.5);
  });
});
