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

  promoteFromWaitlist: (eventId, epId) =>
    api.post(`${BASE}/${eventId}/participants/${epId}/promote-from-waitlist`).then(r => r.data),

  promoteFromLottery: (eventId, epId) =>
    api.post(`${BASE}/${eventId}/participants/${epId}/promote-from-lottery`).then(r => r.data),

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

  // Guide token
  regenerateGuideToken: (id) =>
    api.post(`${BASE}/${id}/regenerate-guide-token`).then(r => r.data),

  // Lottery
  previewLotteryDraw: (id, { seed, reserved_member_slots } = {}) =>
    api.post(`${BASE}/${id}/preview-lottery-draw`, {
      ...(seed != null ? { seed } : {}),
      ...(reserved_member_slots ? { reserved_member_slots } : {}),
    }).then(r => r.data),

  runLotteryDraw: (id, { seed, reserved_member_slots } = {}) =>
    api.post(`${BASE}/${id}/run-lottery-draw`, {
      ...(seed != null ? { seed } : {}),
      ...(reserved_member_slots ? { reserved_member_slots } : {}),
    }).then(r => r.data),

  sendTestLotteryEmails: (id, email) =>
    api.post(`${BASE}/${id}/send-test-lottery-emails`, { email }).then(r => r.data),

  // Follow-up email — send to all confirmed participants, or to a test address
  sendFollowupEmail: (id, { subject, body, test_email } = {}) =>
    api.post(`${BASE}/${id}/send-followup-email`, {
      subject,
      body,
      ...(test_email ? { test_email } : {}),
    }).then(r => r.data),
};

export const guideService = {
  getEvent: (token) =>
    api.get(`/guide/${token}/event`).then(r => r.data),

  toggleAttendance: (token, epId) =>
    api.post(`/guide/${token}/participants/${epId}/toggle-attendance`).then(r => r.data),

  updateNotes: (token, epId, notes) =>
    api.patch(`/guide/${token}/participants/${epId}`, { notes }).then(r => r.data),
};
