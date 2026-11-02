import axios from 'axios';

import { API_BASE_URL, AUTH_TOKEN_KEY } from '@/constant/env';

// Create axios instance with base configuration
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Add auth token to requests
apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem(AUTH_TOKEN_KEY);
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    // For file uploads, drop the default JSON content-type so the browser sets
    // `multipart/form-data` WITH the boundary, otherwise multer sees no files.
    if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
      config.headers.delete('Content-Type');
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor - Handle 401 and other errors
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear token on 401
      if (typeof window !== 'undefined') {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        // Trigger auth context update if available
        if (window.authContext) {
          window.authContext.setAuthenticated('');
        }
        // Redirect to login
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export default apiClient;
