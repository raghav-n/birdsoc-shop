import api from './api';

const BASE = '/console/events';

export const consoleEventService = {
  // Events CRUD
  listEvents: (q = '') =>
    api.get(`${BASE}${q ? `?q=${encodeURIComponent(q)}` : ''}`).then(r => r.data),

  getEvent: (id) =>
    api.get(`${BASE}/${id}`).then(r => r.data),

  createEvent: (data) =>
    api.post(BASE, data).then(r => r.data),

  updateEvent: (id, data) =>
    api.patch(`${BASE}/${id}`, data).then(r => r.data),

  deleteEvent: (id) =>
    api.delete(`${BASE}/${id}`),

  // Participants
  toggleAttendance: (eventId, epId) =>
    api.post(`${BASE}/${eventId}/participants/${epId}/toggle-attendance`).then(r => r.data),

  updateParticipant: (eventId, epId, data) =>
    api.patch(`${BASE}/${eventId}/participants/${epId}`, data).then(r => r.data),

  removeParticipant: (eventId, epId) =>
    api.delete(`${BASE}/${eventId}/participants/${epId}/remove`).then(r => r.data),

  // Registration verification
  verifyRegistration: (regId) =>
    api.post(`/console/event-registrations/${regId}/verify`).then(r => r.data),

  verifyGroup: (groupId) =>
    api.post(`/console/event-registration-groups/${groupId}/verify`).then(r => r.data),

  // Global registration toggle
  getRegistrationStatus: () =>
    api.get('/console/registration-toggle').then(r => r.data),

  setRegistrationClosed: (closed) =>
    api.post('/console/registration-toggle', { registration_closed: closed }).then(r => r.data),

  // Event images
  listImages: () =>
    api.get('/console/event-images').then(r => r.data),

  uploadImage: (formData) =>
    api.post('/console/event-images', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data),

  // Tags
  listTags: () =>
    api.get('/console/event-tags').then(r => r.data),
};
