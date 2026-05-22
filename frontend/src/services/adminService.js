import api from './api';

export const adminService = {
  getStats: async () => {
    const response = await api.get('/api/admin/stats');
    return response.data;
  },

  getUsers: async () => {
    const response = await api.get('/api/admin/users');
    return response.data;
  },

  updateUserStatus: async ({ id, active }) => {
    const response = await api.patch(`/api/admin/users/${id}/status`, { active });
    return response.data;
  },

  updateUserStorageLimit: async ({ id, storageLimitBytes }) => {
    const response = await api.patch(`/api/admin/users/${id}/storage-limit`, { storageLimitBytes });
    return response.data;
  },

  getSettings: async () => {
    const response = await api.get('/api/admin/settings');
    return response.data;
  },

  updateSettings: async (payload) => {
    const response = await api.put('/api/admin/settings', payload);
    return response.data;
  },

  getTransfers: async () => {
    const response = await api.get('/api/admin/transfers', {
      params: { client_base_url: window.location.origin },
    });
    return response.data;
  },

  endTransfer: async ({ session_id }) => {
    const response = await api.post('/api/admin/transfers/end', { session_id });
    return response.data;
  },

  getAuditReport: async ({ from, to } = {}) => {
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;
    const response = await api.get('/api/admin/audit-report', { params });
    return response.data;
  },

  getAuditLogs: async () => {
    const response = await api.get('/api/admin/audit-logs');
    return response.data;
  },
};
