import api from './api';

const BASE = '/console/users';

export const consoleUsersService = {
  // List console users; optional search by email/name.
  listUsers: (search = '') =>
    api.get(`${BASE}${search ? `?search=${encodeURIComponent(search)}` : ''}`).then(r => r.data),

  // Set a user's console group membership. `groups` is an array of group names.
  updateUserGroups: (id, groups) =>
    api.patch(`${BASE}/${id}`, { groups }).then(r => r.data),
};
