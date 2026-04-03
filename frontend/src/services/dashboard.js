import api from './api';

export const dashboardService = {
  getAnalytics: ({ start, end } = {}) => {
    const params = {};
    if (start) params.start = start;
    if (end) params.end = end;
    return api.get('/analytics/dashboard', { params }).then(r => r.data);
  },
};
