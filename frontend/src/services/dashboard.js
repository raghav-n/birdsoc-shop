import api from './api';

export const dashboardService = {
  getAnalytics: () => api.get('/analytics/dashboard').then(r => r.data),
};
