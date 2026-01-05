import axios, { AxiosError } from 'axios';
import { useAuthStore } from '../stores/authStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: string }>) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().clearAuth();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// 认证 API
export const authApi = {
  login: (username: string, password: string) =>
    api.post('/admin/login', { username, password }),
  logout: () => api.post('/admin/logout'),
  changePassword: (oldPassword: string, newPassword: string) =>
    api.put('/admin/password', { oldPassword, newPassword }),
};

// API 密钥 API
export const apiKeysApi = {
  get: () => api.get('/admin/api-keys'),
  regenerate: () => api.post('/admin/api-keys/regenerate'),
};

// 激活码 API
export const codesApi = {
  create: (data: {
    app_name: string;
    user_name: string;
    duration_hours: number;
    remark?: string;
  }) => api.post('/admin/codes', data),
  list: (params: {
    page?: number;
    pageSize?: number;
    code?: string;
    app_name?: string;
    user_name?: string;
    status?: string;
    start_date?: string;
    end_date?: string;
  }) => api.get('/admin/codes', { params }),
  get: (id: string) => api.get(`/admin/codes/${id}`),
  revoke: (id: string) => api.put(`/admin/codes/${id}/revoke`),
  delete: (id: string) => api.delete(`/admin/codes/${id}`),
  export: (params: { status?: string; app_name?: string }) =>
    api.get('/admin/codes/export/csv', { params, responseType: 'blob' }),
};

// 统计 API
export const statsApi = {
  byApp: () => api.get('/admin/stats/by-app'),
  byTime: (period?: string, days?: number) =>
    api.get('/admin/stats/by-time', { params: { period, days } }),
  byStatus: () => api.get('/admin/stats/by-status'),
};

// 日志 API
export const logsApi = {
  list: (params: {
    page?: number;
    pageSize?: number;
    action?: string;
    start_date?: string;
    end_date?: string;
  }) => api.get('/admin/logs', { params }),
};

export default api;
