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

  // Poll Gmail for PayNow confirmation for the given order number
  checkPayNowEmail: async (orderNumber) => {
    const response = await api.get('/checkout/payment/paynow-email-check', {
      params: { order: orderNumber },
    });
    return response.data;
  },
};
