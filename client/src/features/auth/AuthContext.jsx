import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';

import { api } from '../../services/api';

import {
  clearAuthentication,
  getAccessToken,
  getStoredUser,
  saveAuthentication,
  updateStoredUser
} from './authStorage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(
    getStoredUser()
  );

  const [loading, setLoading] = useState(
    Boolean(getAccessToken())
  );

  const setAuthenticatedUser = useCallback(
    (authenticationData) => {
      saveAuthentication(authenticationData);
      setUser(authenticationData.user);
    },
    []
  );

  const login = useCallback(
    async ({ email, password }) => {
      const response = await api.post(
        '/auth/login',
        {
          email,
          password
        }
      );

      const authenticationData = response.data.data;

      setAuthenticatedUser(authenticationData);

      return authenticationData.user;
    },
    [setAuthenticatedUser]
  );

  const register = useCallback(
    async ({
      name,
      email,
      phone,
      address,
      password
    }) => {
      const response = await api.post(
        '/auth/register',
        {
          name,
          email,
          phone,
          address,
          password
        }
      );

      const authenticationData = response.data.data;

      setAuthenticatedUser(authenticationData);

      return authenticationData.user;
    },
    [setAuthenticatedUser]
  );

  const logout = useCallback(async () => {
    try {
      if (getAccessToken()) {
        await api.post('/auth/logout');
      }
    } catch {
      // Local logout still continues if the API is unavailable.
    } finally {
      clearAuthentication();
      setUser(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const response = await api.get('/auth/me');
    const authenticatedUser = response.data.data;

    updateStoredUser(authenticatedUser);
    setUser(authenticatedUser);

    return authenticatedUser;
  }, []);

  useEffect(() => {
    const token = getAccessToken();

    if (!token) {
      clearAuthentication();
      setUser(null);
      setLoading(false);
      return;
    }

    refreshUser()
      .catch(() => {
        clearAuthentication();
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [refreshUser]);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      role: user?.role || null,
      login,
      register,
      logout,
      refreshUser
    }),
    [
      user,
      loading,
      login,
      register,
      logout,
      refreshUser
    ]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuth must be used inside AuthProvider'
    );
  }

  return context;
}