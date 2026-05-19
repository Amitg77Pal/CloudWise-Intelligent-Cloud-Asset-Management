import api from './api';

export const authService = {
  login: async (email, password) => {
    const response = await api.post('/api/auth/login', { email, password });
    return response.data;
  },

  register: async (userData) => {
    const response = await api.post('/api/auth/register', userData);
    return response.data;
  },

  logout: async () => {
    try {
      await api.post('/api/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
    }
  },

  forgotPassword: async (email) => {
    const response = await api.post('/api/auth/forgot-password', { email });
    return response.data;
  },

  verifyPasswordResetOtp: async ({ email, otp }) => {
    const response = await api.post('/api/auth/verify-otp', { email, otp });
    return response.data;
  },

  resetPassword: async ({ token, password }) => {
    const response = await api.post('/api/auth/reset-password', { token, password });
    return response.data;
  },

  getProfile: async () => {
    const response = await api.get('/api/user/profile');
    return response.data;
  },

  updatePreferences: async (preferences) => {
    const response = await api.put('/api/user/preferences', preferences);
    return response.data;
  },
};
