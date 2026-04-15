import api from './api';

export const miscService = {
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
};

export const refundService = {
  // Create refund request
  createRefundRequest: async (refundData) => {
    const response = await api.post('/refunds', refundData);
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
