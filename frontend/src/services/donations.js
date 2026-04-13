import api from './api';

export const donationService = {
  recordDonation: async ({ name, amount, email, note, reference }) => {
    const response = await api.post('/donations', { name, amount, email, note, reference });
    return response.data;
  },
};
