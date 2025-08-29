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

  // Get category by slug
  getCategory: async (slug) => {
    const response = await api.get(`/categories/${slug}`);
    return response.data;
  },

  // Get product recommendations
  getProductRecommendations: async (productId) => {
    const response = await api.get(`/products/${productId}/recommendations`);
    return response.data;
  },

  // Search products
  searchProducts: async (query, filters = {}) => {
    const params = { q: query, ...filters };
    const response = await api.get('/products', { params });
    return response.data;
  },
};
