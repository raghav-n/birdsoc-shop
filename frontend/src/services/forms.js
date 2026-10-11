import api from './api';

const withToken = (token) => (token ? { params: { token } } : {});

// Public: render and submit a form, optionally through a personal invite link.
export const formService = {
  getForm: (slug, token) =>
    api.get(`/forms/${slug}/schema`, withToken(token)).then(r => r.data),

  submit: (slug, token, data) =>
    api.post(`/forms/${slug}/submit`, data, withToken(token)).then(r => r.data),
};

const BASE = '/console/forms';

export const consoleFormService = {
  listForms: () =>
    api.get(BASE).then(r => r.data),

  getForm: (id) =>
    api.get(`${BASE}/${id}`).then(r => r.data),

  createForm: (data) =>
    api.post(BASE, data).then(r => r.data),

  updateForm: (id, data) =>
    api.patch(`${BASE}/${id}`, data).then(r => r.data),

  deleteForm: (id) =>
    api.delete(`${BASE}/${id}`),

  getResponses: (id) =>
    api.get(`${BASE}/${id}/responses`).then(r => r.data),

  downloadResponsesCsv: (id) =>
    api.get(`${BASE}/${id}/responses.csv`, { responseType: 'blob' }).then(r => r.data),

  getInvites: (id) =>
    api.get(`${BASE}/${id}/invites`).then(r => r.data),

  sendInviteBatch: (id, { attendedOnly = false, limit = 20 } = {}) =>
    api.post(`${BASE}/${id}/invites`, { attended_only: attendedOnly, limit }).then(r => r.data),
};
