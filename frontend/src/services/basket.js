import api from './api';

export const basketService = {
  // Create new basket (guest)
  createBasket: async () => {
    const response = await api.post('/baskets');
    return response.data;
  },

  // Get current basket
  getCurrentBasket: async () => {
    const response = await api.get('/baskets/current');
    return response.data;
  },

  // Add line to basket
  addToBasket: async (basketId, productId, quantity, options = {}) => {
    const response = await api.post(`/baskets/${basketId}/lines`, {
      product_id: productId,
      quantity,
      options,
    });
    return response.data;
  },

  // Update basket line
  updateBasketLine: async (basketId, lineId, quantity) => {
    const response = await api.patch(`/baskets/${basketId}/lines/${lineId}`, {
      quantity,
    });
    return response.data;
  },

  // Remove basket line
  removeBasketLine: async (basketId, lineId) => {
    await api.delete(`/baskets/${basketId}/lines/${lineId}`);
  },

  // Apply voucher
  applyVoucher: async (basketId, code) => {
    const response = await api.post(`/baskets/${basketId}/apply-voucher`, {
      code,
    });
    return response.data;
  },

  // Merge baskets (for logged in users)
  mergeBaskets: async (sourceCartId) => {
    const response = await api.post('/baskets/merge', {
      source_cart_id: sourceCartId,
    });
    return response.data;
  },
};
