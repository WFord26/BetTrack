import axios from 'axios';

const LOCAL_API_BASE_URL = 'http://localhost:3001/api';
const LEGACY_API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function ensureApiPath(value: string): string {
  const normalizedValue = stripTrailingSlash(value);
  return normalizedValue.endsWith('/api') ? normalizedValue : `${normalizedValue}/api`;
}

function resolveApiBaseUrl(): string {
  const configuredApiUrl = import.meta.env.VITE_API_URL || LEGACY_API_BASE_URL;

  if (configuredApiUrl) {
    return ensureApiPath(configuredApiUrl);
  }

  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    const isLocalDevelopmentHost = ['localhost', '127.0.0.1', '0.0.0.0'].includes(hostname);

    if (isLocalDevelopmentHost) {
      return LOCAL_API_BASE_URL;
    }

    if (hostname.startsWith('api.')) {
      return `${protocol}//${hostname}/api`;
    }

    return `${protocol}//api.${hostname}/api`;
  }

  return LOCAL_API_BASE_URL;
}

export const API_BASE_URL = resolveApiBaseUrl();

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    return Promise.reject(error);
  }
);

// Default export for convenience
export default apiClient;
