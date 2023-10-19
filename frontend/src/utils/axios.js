import axios from 'axios';
import { ca } from 'date-fns/locale';

import { HOST_API } from 'src/config-global';

// ----------------------------------------------------------------------

const axiosInstance = axios.create({ baseURL: HOST_API, withCredentials: true });

axiosInstance.interceptors.response.use(
  (res) => res,
  (error) =>
    Promise.reject(
      (error.response && error.response.data) ||
        'Something went wrong. Retry or contact an Administrator'
    )
);

// Add a request interceptor
axiosInstance.interceptors.request.use(
  (config) => {
    // Check if the request method is POST, PUT, or DELETE
    try {
      if (['POST', 'PUT', 'DELETE'].includes(config.method.toUpperCase())) {
        // Get the CSRF token from your cookies (you might need to use a library for this)
        const csrfToken = getCsrfTokenFromCookies();

        // Set the X-CSRF-TOKEN header with the CSRF token
        if (csrfToken) {
          config.headers['X-CSRF-TOKEN'] = csrfToken;
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      return config;
    }
  },
  (error) => Promise.reject(error)
);

function getCsrfTokenFromCookies() {
  const cookies = document.cookie
    .split(';')
    .map((cookie) => cookie.trim())
    .reduce((cookieMap, cookie) => {
      const [name, value] = cookie.split('=');
      cookieMap[name] = decodeURIComponent(value);
      return cookieMap;
    }, {});

  return cookies.csrf_access_token || null;
}

export default axiosInstance;

// ----------------------------------------------------------------------

export const fetcher = async (args) => {
  const [url, config] = Array.isArray(args) ? args : [args];

  const res = await axiosInstance.get(url, { ...config });

  return res.data;
};

// ----------------------------------------------------------------------

export const endpoints = {
  auth: {
    me: '/api/auth/me',
    login: '/api/auth/login',
    logout: '/api/auth/logout',
    forgotPassword: '/api/auth/forgot-password',
    resetPassword: '/api/auth/reset-password',
    checkUserReset: '/api/auth/check-user-reset'
  },
};
