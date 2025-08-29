import api from './api';

export const authService = {
  // Login
  login: async (email, password) => {
    const response = await api.post('/auth/token/', { email, password });
    return response.data;
  },

  // Register
  register: async (userData) => {
    const response = await api.post('/auth/register/', userData);
    return response.data;
  },

  // Get current user
  getCurrentUser: async () => {
    const response = await api.get('/users/me/');
    return response.data;
  },

  // Update user profile
  updateProfile: async (userData) => {
    const response = await api.patch('/users/me/', userData);
    return response.data;
  },

  // Password reset request
  requestPasswordReset: async (email) => {
    const response = await api.post('/auth/password/reset/', { email });
    return response.data;
  },

  // Password reset confirm
  confirmPasswordReset: async (uid, token, newPassword) => {
    const response = await api.post('/auth/password/reset/confirm/', {
      uid,
      token,
      new_password: newPassword,
    });
    return response.data;
  },
};
