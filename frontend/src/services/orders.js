import axios from 'axios';
import api from './api';

const guestOrderApi = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const orderService = {
  // Get user's orders
  getOrders: async () => {
    const response = await api.get('/orders');
    return response.data;
  },

  // Get order by number
  getOrder: async (orderNumber, accessId) => {
    const client = accessId ? guestOrderApi : api;
    const response = await client.get(`/orders/${orderNumber}`, {
      params: accessId ? { id: accessId } : undefined,
    });
    return response.data;
  },

  // Get order receipt
  getOrderReceipt: async (orderNumber, accessId) => {
    const client = accessId ? guestOrderApi : api;
    const response = await client.get(`/orders/${orderNumber}/receipt`, {
      params: accessId ? { id: accessId } : undefined,
      responseType: 'blob',
    });
    return response.data;
  },
};
