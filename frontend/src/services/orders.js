import api from './api';

export const orderService = {
  // Get user's orders
  getOrders: async () => {
    const response = await api.get('/orders');
    return response.data;
  },

  // Get order by number
  getOrder: async (orderNumber) => {
    const response = await api.get(`/orders/${orderNumber}`);
    return response.data;
  },

  // Get order receipt
  getOrderReceipt: async (orderNumber) => {
    const response = await api.get(`/orders/${orderNumber}/receipt`, {
      responseType: 'blob',
    });
    return response.data;
  },
};
