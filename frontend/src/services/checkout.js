import api from './api';

export const checkoutService = {
  // Set checkout email (for guest checkout)
  setCheckoutEmail: async (email) => {
    const response = await api.post('/checkout/email', { email });
    return response.data;
  },

  // Get shipping methods
  getShippingMethods: async () => {
    const response = await api.get('/checkout/shipping-methods');
    return response.data;
  },

  // Set shipping address
  setShippingAddress: async (addressData) => {
    const response = await api.post('/checkout/address', addressData);
    return response.data;
  },

  // Upload PayNow proof
  uploadPayNowProof: async (formData) => {
    const response = await api.post('/checkout/payment/paynow-proof', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Place order
  placeOrder: async (orderData) => {
    const response = await api.post('/checkout/place-order', orderData);
    return response.data;
  },

  // Check whether a PayNow confirmation email has been received yet
  checkPayNowEmail: async (orderNumber) => {
    const response = await api.get('/checkout/payment/paynow-email-check', {
      params: { order: orderNumber },
    });
    return response.data;
  },

  // Send a localhost-only test email that matches the PayNow polling parser
  sendPayNowTestEmail: async (orderNumber) => {
    const response = await api.post('/checkout/payment/paynow-email-test', {
      order: orderNumber,
    });
    return response.data;
  },

  // Save pending checkout intent (called when reaching payment step)
  savePendingCheckout: async (data) => {
    const response = await api.post('/checkout/pending', data);
    return response.data;
  },
};
