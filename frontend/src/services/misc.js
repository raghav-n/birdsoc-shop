import api from './api';

export const miscService = {
  // Health check
  getHealth: async () => {
    const response = await api.get('/health');
    return response.data;
  },

  // Get shop config
  getConfig: async () => {
    const response = await api.get('/config');
    return response.data;
  },

  // Get FAQ items (public)
  getFAQ: async () => {
    const response = await api.get('/faq');
    return response.data;
  },

  // Get shipping methods (public)
  getShippingMethods: async (selfCollect = null) => {
    const params = selfCollect !== null ? { self_collect: selfCollect } : {};
    const response = await api.get('/shipping/methods', { params });
    return response.data;
  },
};

export const refundService = {
  // Create refund request
  createRefundRequest: async (refundData) => {
    const response = await api.post('/refunds', refundData);
    return response.data;
  },

  // Get refund request details
  getRefundRequest: async (id) => {
    const response = await api.get(`/refunds/${id}`);
    return response.data;
  },
};

export const bannerService = {
  getBanners: async (type = null) => {
    const params = type ? { type } : {};
    const response = await api.get('/banners', { params });
    return response.data;
  },
  getTextBanner: async () => {
    const response = await api.get('/banners/text');
    return response.data;
  },
};

export const eventService = {
  // Get events
  getEvents: async () => {
    const response = await api.get('/events');
    return response.data;
  },

  // Get event details
  getEvent: async (id) => {
    const response = await api.get(`/events/${id}`);
    return response.data;
  },

  // Register for event
  registerForEvent: async (eventId, registrationData) => {
    const response = await api.post(`/events/${eventId}/register`, registrationData);
    return response.data;
  },
};
