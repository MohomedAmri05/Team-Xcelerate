const ACCESS_TOKEN_KEY = 'highStreetAccessToken';
const REFRESH_TOKEN_KEY = 'highStreetRefreshToken';
const USER_KEY = 'highStreetUser';

export function saveAuthentication({
  accessToken,
  refreshToken,
  user
}) {
  if (accessToken) {
    sessionStorage.setItem(
      ACCESS_TOKEN_KEY,
      accessToken
    );

    // Compatibility with the existing Axios interceptor.
    sessionStorage.setItem(
      'accessToken',
      accessToken
    );
  }

  if (refreshToken) {
    localStorage.setItem(
      REFRESH_TOKEN_KEY,
      refreshToken
    );

    // Compatibility with the existing application.
    localStorage.setItem(
      'refreshToken',
      refreshToken
    );
  }

  if (user) {
    localStorage.setItem(
      USER_KEY,
      JSON.stringify(user)
    );
  }
}

export function getAccessToken() {
  return (
    sessionStorage.getItem(ACCESS_TOKEN_KEY) ||
    sessionStorage.getItem('accessToken')
  );
}

export function getRefreshToken() {
  return (
    localStorage.getItem(REFRESH_TOKEN_KEY) ||
    localStorage.getItem('refreshToken')
  );
}

export function getStoredUser() {
  const storedUser = localStorage.getItem(USER_KEY);

  if (!storedUser) {
    return null;
  }

  try {
    return JSON.parse(storedUser);
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

export function updateStoredUser(user) {
  if (!user) {
    localStorage.removeItem(USER_KEY);
    return;
  }

  localStorage.setItem(
    USER_KEY,
    JSON.stringify(user)
  );
}

export function clearAuthentication() {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem('accessToken');

  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem('refreshToken');

  localStorage.removeItem(USER_KEY);
}