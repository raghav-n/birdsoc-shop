import api from './api';

export const catalogueService = {
  // Get products with filters
  getProducts: async (params = {}) => {
    const response = await api.get('/products', { params });
    return response.data;
  },

  // Get single product
  getProduct: async (id) => {
    const response = await api.get(`/products/${id}`);
    return response.data;
  },

  // Get categories
  getCategories: async (flat = false) => {
    const response = await api.get('/categories', { 
      params: flat ? { flat: true } : {} 
    });
    return response.data;
  },
};
