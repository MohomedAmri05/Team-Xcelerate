import axios from 'axios';

/*
|--------------------------------------------------------------------------
| API client
|--------------------------------------------------------------------------
|
| - Attaches the short-lived access token to every request.
| - When the API answers 401 because the access token expired, the stored
|   refresh token is exchanged once for a new pair (rotating refresh
|   tokens) and the original request is retried transparently.
| - Concurrent 401s share a single refresh request.
|
*/

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

export const api = axios.create({
  baseURL: API_URL
});

const ACCESS_KEYS = ['highStreetAccessToken', 'accessToken'];
const REFRESH_KEYS = ['highStreetRefreshToken', 'refreshToken'];

const readAccess = () => ACCESS_KEYS.map((key) => sessionStorage.getItem(key)).find(Boolean) || null;
const readRefresh = () => REFRESH_KEYS.map((key) => localStorage.getItem(key)).find(Boolean) || null;

function storeTokens({ accessToken, refreshToken, user }) {
  if (accessToken) {
    ACCESS_KEYS.forEach((key) => sessionStorage.setItem(key, accessToken));
  }

  if (refreshToken) {
    REFRESH_KEYS.forEach((key) => localStorage.setItem(key, refreshToken));
  }

  if (user) {
    localStorage.setItem('highStreetUser', JSON.stringify(user));
  }
}

function clearTokens() {
  ACCESS_KEYS.forEach((key) => sessionStorage.removeItem(key));
  REFRESH_KEYS.forEach((key) => localStorage.removeItem(key));
  localStorage.removeItem('highStreetUser');
}

api.interceptors.request.use((config) => {
  const token = readAccess();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

let refreshPromise = null;

export function refreshSession() {
  const refreshToken = readRefresh();

  if (!refreshToken) {
    return Promise.reject(new Error('No refresh token'));
  }

  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${API_URL}/auth/refresh`, { refreshToken })
      .then((response) => {
        storeTokens(response.data.data);
        window.dispatchEvent(new CustomEvent('highstreet:session-refreshed', { detail: response.data.data.user }));
        return response.data.data;
      })
      .catch((error) => {
        clearTokens();
        window.dispatchEvent(new Event('highstreet:session-expired'));
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

const NO_REFRESH = ['/auth/login', '/auth/register', '/auth/refresh', '/sessions/refresh'];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    if (
      status === 401 &&
      original &&
      !original._retried &&
      !NO_REFRESH.some((path) => original.url?.startsWith(path)) &&
      readRefresh()
    ) {
      original._retried = true;

      try {
        const tokens = await refreshSession();
        original.headers.Authorization = `Bearer ${tokens.accessToken}`;

        return api(original);
      } catch {
        // fall through to the original error
      }
    }

    /*
     * VIVA – Ahamed – the account still has an Admin-set temporary
     * password: AuthContext reloads the user and the route guard opens
     * Profile › Change password.
     */
    if (status === 403 && error.response?.data?.code === 'PASSWORD_CHANGE_REQUIRED') {
      window.dispatchEvent(new Event('highstreet:password-change-required'));
    }

    return Promise.reject(error);
  }
);

/**
 * Human-readable message for an API error (validation details first).
 */
export function errorMessage(error, fallback = 'Something went wrong') {
  const data = error?.response?.data;

  if (Array.isArray(data?.errors) && data.errors.length && data.errors[0]?.message) {
    return data.errors[0].message;
  }

  if (data?.message) {
    return data.message;
  }

  if (error?.code === 'ERR_NETWORK') {
    return 'Cannot reach the High Street server. Check that the API is running.';
  }

  return error?.message || fallback;
}

/**
 * Downloads a protected file (report export or private document) using the
 * Authorization header, then saves it with the server-provided file name.
 */
export async function downloadFile(url, params, fallbackName = 'download') {
  const response = await api.get(url, {
    params,
    responseType: 'blob'
  });

  const disposition = response.headers['content-disposition'] || '';
  const utfName = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  const plainName = disposition.match(/filename="?([^";]+)"?/i);
  const filename = utfName ? decodeURIComponent(utfName[1]) : plainName ? plainName[1] : fallbackName;

  const blobUrl = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 4000);

  return {
    filename,
    rows: response.headers['x-report-rows'] ? Number(response.headers['x-report-rows']) : null,
    truncated: response.headers['x-report-truncated'] === 'true'
  };
}

/**
 * Opens a protected PDF/image in a new tab for preview.
 */
export async function previewFile(url) {
  const preview = window.open('', '_blank');

  try {
    const response = await api.get(url, {
      params: { disposition: 'inline' },
      responseType: 'blob'
    });

    const blobUrl = URL.createObjectURL(response.data);

    if (preview) {
      preview.location.href = blobUrl;
    } else {
      window.location.assign(blobUrl);
    }

    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  } catch (error) {
    preview?.close();
    throw error;
  }
}
