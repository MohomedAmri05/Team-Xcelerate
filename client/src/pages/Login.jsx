import { useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import {
  Link,
  useLocation,
  useNavigate
} from 'react-router-dom';
import toast from 'react-hot-toast';

import Brand from '../components/Brand';
import { useAuth } from '../features/auth/AuthContext';

export default function Login() {
  const { login, user, isAuthenticated } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();

  const [showPassword, setShowPassword] =
    useState(false);

  const [submitting, setSubmitting] =
    useState(false);

  const [form, setForm] = useState({
    email: '',
    password: ''
  });

  const searchParams = new URLSearchParams(
    location.search
  );

  const requestedRedirect =
    searchParams.get('redirect');

  const getDestination = (loggedInUser) => {
    if (
      loggedInUser.role === 'Admin' ||
      loggedInUser.role === 'Staff'
    ) {
      return '/admin';
    }

    if (
      requestedRedirect &&
      !requestedRedirect.startsWith('/admin')
    ) {
      return requestedRedirect;
    }

    return '/';
  };

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(getDestination(user), {
        replace: true
      });
    }
  }, [isAuthenticated, user]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);

    try {
      const loggedInUser = await login(form);

      toast.success(
        `Welcome back, ${loggedInUser.name}`
      );

      navigate(getDestination(loggedInUser), {
        replace: true
      });
    } catch (error) {
      if (error.response?.status === 429) {
        toast.error(
          'Too many login attempts. Please wait and try again.'
        );
      } else {
        toast.error(
          error.response?.data?.message ||
          'Login failed. Please check your details.'
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login">
      <form onSubmit={handleSubmit}>
        <Brand />

        <div>
          <p className="eyebrow">
            YOUR HIGH STREET ACCOUNT
          </p>

          <h1>Welcome back.</h1>

          <p className="auth-intro">
            Log in to continue to High Street.
          </p>
        </div>

        <label>
          Email address

          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={handleChange}
            placeholder="you@example.com"
          />
        </label>

        <label>
          Password

          <div className="password">
            <input
              type={
                showPassword
                  ? 'text'
                  : 'password'
              }
              name="password"
              autoComplete="current-password"
              required
              minLength="8"
              value={form.password}
              onChange={handleChange}
              placeholder="Enter your password"
            />

            <button
              type="button"
              aria-label={
                showPassword
                  ? 'Hide password'
                  : 'Show password'
              }
              onClick={() => {
                setShowPassword(
                  (currentValue) =>
                    !currentValue
                );
              }}
            >
              {showPassword ? (
                <EyeOff />
              ) : (
                <Eye />
              )}
            </button>
          </div>
        </label>

        <button
          className="button"
          type="submit"
          disabled={submitting}
        >
          {submitting
            ? 'Logging in…'
            : 'Log in'}
        </button>

        <p className="auth-switch">
          Don&apos;t have an account?{' '}

          <Link
            to={
              requestedRedirect
                ? `/register?redirect=${encodeURIComponent(
                    requestedRedirect
                  )}`
                : '/register'
            }
          >
            Create an account
          </Link>
        </p>

        <Link
          className="auth-store-link"
          to="/"
        >
          Continue browsing the Store
        </Link>
      </form>
    </main>
  );
}