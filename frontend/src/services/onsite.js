import api from './api';

export const onsiteService = {
  calculate: async (products, voucher_code = '') => {
    const response = await api.post('/onsite/calculate', { products, voucher_code });
    return response.data;
  },

  createPending: async (products, voucher_code = '') => {
    const response = await api.post('/onsite/pending', { products, voucher_code });
    return response.data;
  },

  placeOrder: async (products, voucher_code = '') => {
    const response = await api.post('/onsite/order', { products, voucher_code });
    return response.data;
  },
};
