/*
| VIVA-UI – M.R. Ahamed – Authentication state
|   login / register / logout / GET /auth/me; tokens kept in authStorage.js
|   October 2026:
|   - Admin and Staff are signed out automatically after IDLE_MINUTES
|     without any activity (warning 2 minutes before, "Stay signed in").
|   - When the API says the temporary password must be changed, the user
|     is reloaded so the route guard opens Profile › Change password.
| API paths are relative to /api/v1 (services/api.js).
*/

import toast from 'react-hot-toast';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';

import {
  api,
  refreshSession
} from '../../services/api';

import {
  clearAuthentication,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  saveAuthentication,
  updateStoredUser
} from './authStorage';

const AuthContext = createContext(null);

// Inactivity sign-out for the dashboard (Admin / Staff). Can be changed with
// VITE_IDLE_MINUTES in client/.env (minimum 5 minutes).
export const IDLE_MINUTES = Math.max(Number(import.meta.env?.VITE_IDLE_MINUTES) || 30, 5);
const WARNING_MS = 2 * 60 * 1000;
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart', 'wheel'];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(
    getStoredUser()
  );

  const [loading, setLoading] = useState(
    Boolean(getAccessToken() || getRefreshToken())
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
    const onRefreshed = (event) => {
      if (event.detail) {
        setUser(event.detail);
      }
    };

    const onExpired = () => {
      setUser(null);
    };

    window.addEventListener('highstreet:session-refreshed', onRefreshed);
    window.addEventListener('highstreet:session-expired', onExpired);

    return () => {
      window.removeEventListener('highstreet:session-refreshed', onRefreshed);
      window.removeEventListener('highstreet:session-expired', onExpired);
    };
  }, []);

  useEffect(() => {
    const onPasswordRequired = () => {
      refreshUser().catch(() => {});
    };

    window.addEventListener('highstreet:password-change-required', onPasswordRequired);

    return () => window.removeEventListener('highstreet:password-change-required', onPasswordRequired);
  }, [refreshUser]);

  /*
   * VIVA – Ahamed – automatic sign-out after inactivity (Admin / Staff).
   * Any click, key press, scroll or touch counts as activity. The last
   * activity time is shared between tabs through localStorage.
   */
  const lastActivity = useRef(Date.now());
  const warningId = useRef(null);
  const dashboardUser = user && (user.role === 'Admin' || user.role === 'Staff');

  useEffect(() => {
    if (!dashboardUser) {
      return undefined;
    }

    const idleMs = IDLE_MINUTES * 60 * 1000;
    const storageKey = 'highStreetLastActivity';

    const readShared = () => {
      try {
        return Number(localStorage.getItem(storageKey)) || 0;
      } catch {
        return 0;
      }
    };

    const markActive = () => {
      const now = Date.now();

      // Write at most every 15 seconds.
      if (now - lastActivity.current > 15000) {
        try {
          localStorage.setItem(storageKey, String(now));
        } catch {
          // Storage may be unavailable; the timer still works in this tab.
        }
      }

      lastActivity.current = now;

      if (warningId.current) {
        toast.dismiss(warningId.current);
        warningId.current = null;
      }
    };

    markActive();
    ACTIVITY_EVENTS.forEach((name) => window.addEventListener(name, markActive, { passive: true }));

    const timer = window.setInterval(() => {
      const last = Math.max(lastActivity.current, readShared());
      const idle = Date.now() - last;

      if (idle >= idleMs) {
        window.clearInterval(timer);
        toast.dismiss(warningId.current || undefined);
        logout().then(() => {
          toast('You were signed out after ' + IDLE_MINUTES + ' minutes without activity.', { icon: '🔒', duration: 8000 });
          if (window.location.pathname.startsWith('/admin')) {
            window.location.assign('/login?redirect=%2Fadmin');
          }
        });
        return;
      }

      if (idle >= idleMs - WARNING_MS && !warningId.current) {
        warningId.current = toast(
          (shown) => (
            <span className="idle-warning">
              You will be signed out in 2 minutes because of inactivity.
              <button
                type="button"
                className="button ghost"
                onClick={() => {
                  lastActivity.current = Date.now();
                  try {
                    localStorage.setItem(storageKey, String(Date.now()));
                  } catch {
                    // ignore
                  }
                  toast.dismiss(shown.id);
                  warningId.current = null;
                }}
              >
                Stay signed in
              </button>
            </span>
          ),
          { duration: WARNING_MS, icon: '⏳' }
        );
      }
    }, 15000);

    return () => {
      window.clearInterval(timer);
      ACTIVITY_EVENTS.forEach((name) => window.removeEventListener(name, markActive));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboardUser]);

  useEffect(() => {
    const token = getAccessToken();

    // A new tab has no session-scoped access token yet, but the
    // refresh token (kept in localStorage) can restore the session.
    if (!token && getRefreshToken()) {
      refreshSession()
        .then(() => refreshUser())
        .catch(() => {
          clearAuthentication();
          setUser(null);
        })
        .finally(() => {
          setLoading(false);
        });

      return;
    }

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