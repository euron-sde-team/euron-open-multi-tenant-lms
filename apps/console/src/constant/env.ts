export const isProd = process.env.NODE_ENV === 'production';
export const isLocal = process.env.NODE_ENV === 'development';

export const showLogger = isLocal
  ? true
  : process.env.NEXT_PUBLIC_SHOW_LOGGER === 'true';

// API Configuration
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5076/api/v1';

// App Configuration
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3600';

// Auth Configuration
export const AUTH_TOKEN_KEY = 'adminAuthToken';
