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

  // Compute price breakdown without registering
  priceBreakdown: async (eventId, payload) => {
    const response = await api.post(`/events/${eventId}/price-breakdown`, payload);
    return response.data;
  },

  // Upload PayNow proof for an individual event registration
  uploadEventProof: async (regId, formData) => {
    const response = await api.post(`/event-registrations/${regId}/payment/paynow-proof`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // Poll Gmail for PayNow confirmation of an individual event registration
  checkEventPayNowEmail: async (regId) => {
    const response = await api.get(`/event-registrations/${regId}/payment/paynow-email-check`);
    return response.data;
  },

  // Upload PayNow proof for a group event registration
  uploadEventGroupProof: async (groupId, formData) => {
    const response = await api.post(`/event-registration-groups/${groupId}/payment/paynow-proof`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // Poll Gmail for PayNow confirmation of a group event registration
  checkEventGroupPayNowEmail: async (groupId) => {
    const response = await api.get(`/event-registration-groups/${groupId}/payment/paynow-email-check`);
    return response.data;
  },
};
