import axios from 'axios';

const API_BASE_URL = '/api/v1';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token management
const TOKEN_KEY = 'birdsoc_access_token';
const REFRESH_TOKEN_KEY = 'birdsoc_refresh_token';
const CART_ID_KEY = 'birdsoc_cart_id';

export const tokenManager = {
  getAccessToken: () => localStorage.getItem(TOKEN_KEY),
  getRefreshToken: () => localStorage.getItem(REFRESH_TOKEN_KEY),
  setTokens: (access, refresh) => {
    localStorage.setItem(TOKEN_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  },
  clearTokens: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
  getCartId: () => localStorage.getItem(CART_ID_KEY),
  setCartId: (cartId) => localStorage.setItem(CART_ID_KEY, cartId),
  clearCartId: () => localStorage.removeItem(CART_ID_KEY),
};

// Request interceptor to add auth token and cart ID
api.interceptors.request.use(
  (config) => {
    const token = tokenManager.getAccessToken();
    const cartId = tokenManager.getCartId();
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    if (cartId && !token) {
      config.headers['X-Cart-Id'] = cartId;
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

// Shared refresh state so concurrent 401s don't race
let refreshPromise = null;

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry && !original.url.includes('/auth/token/')) {
      original._retry = true;

      const refreshToken = tokenManager.getRefreshToken();
      if (refreshToken) {
        // If a refresh is already in-flight, wait for it instead of starting another
        if (!refreshPromise) {
          refreshPromise = axios.post(`${API_BASE_URL}/auth/token/refresh/`, {
            refresh: refreshToken,
          }).then((response) => {
            const { access } = response.data;
            tokenManager.setTokens(access);
            return access;
          }).catch((refreshError) => {
            tokenManager.clearTokens();
            window.location.href = '/login';
            return Promise.reject(refreshError);
          }).finally(() => {
            refreshPromise = null;
          });
        }

        try {
          const access = await refreshPromise;
          original.headers.Authorization = `Bearer ${access}`;
          return api(original);
        } catch (refreshError) {
          return Promise.reject(refreshError);
        }
      } else {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default api;
