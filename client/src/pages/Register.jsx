import { useState } from 'react';
import {
  Eye,
  EyeOff
} from 'lucide-react';

import {
  Link,
  useLocation,
  useNavigate
} from 'react-router-dom';

import toast from 'react-hot-toast';

import Brand from '../components/Brand';
import { useAuth } from '../features/auth/AuthContext';

export default function Register() {
  const { register } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();

  const [showPassword, setShowPassword] =
    useState(false);

  const [submitting, setSubmitting] =
    useState(false);

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    password: '',
    confirmPassword: ''
  });

  const searchParams = new URLSearchParams(
    location.search
  );

  const requestedRedirect =
    searchParams.get('redirect');

  const handleChange = (event) => {
    const {
      name,
      value
    } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setSubmitting(true);

    try {
      const customer = await register({
        name: form.name,
        email: form.email,
        phone: form.phone,
        address: form.address,
        password: form.password
      });

      toast.success(
        `Welcome to High Street, ${customer.name}`
      );

      const destination =
        requestedRedirect &&
        !requestedRedirect.startsWith('/admin')
          ? requestedRedirect
          : '/';

      navigate(destination, {
        replace: true
      });
    } catch (error) {
      const validationErrors =
        error.response?.data?.errors;

      if (
        Array.isArray(validationErrors) &&
        validationErrors.length > 0
      ) {
        toast.error(
          validationErrors[0].message
        );
      } else {
        toast.error(
          error.response?.data?.message ||
          'Account registration failed.'
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login register-page">
      <form onSubmit={handleSubmit}>
        <Brand />

        <div>
          <p className="eyebrow">
            JOIN HIGH STREET
          </p>

          <h1>Create account.</h1>

          <p className="auth-intro">
            Save vehicles and manage your
            enquiries through one account.
          </p>
        </div>

        <label>
          Full name

          <input
            type="text"
            name="name"
            autoComplete="name"
            required
            minLength="2"
            maxLength="100"
            value={form.name}
            onChange={handleChange}
            placeholder="Your full name"
          />
        </label>

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
          Phone number

          <input
            type="tel"
            name="phone"
            autoComplete="tel"
            required
            pattern="\+?[0-9 ()-]{7,20}"
            value={form.phone}
            onChange={handleChange}
            placeholder="0771234567"
          />
        </label>

        <label>
          Address (optional)

          <input
            type="text"
            name="address"
            autoComplete="street-address"
            maxLength="500"
            value={form.address}
            onChange={handleChange}
            placeholder="Kandy, Sri Lanka"
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
              autoComplete="new-password"
              required
              minLength="10"
              maxLength="72"
              value={form.password}
              onChange={handleChange}
              placeholder="Minimum 10 characters"
            />

            <button
              type="button"
              aria-label={
                showPassword
                  ? 'Hide passwords'
                  : 'Show passwords'
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

        <label>
          Confirm password

          <input
            type={
              showPassword
                ? 'text'
                : 'password'
            }
            name="confirmPassword"
            autoComplete="new-password"
            required
            minLength="10"
            maxLength="72"
            value={form.confirmPassword}
            onChange={handleChange}
            placeholder="Enter the password again"
          />
        </label>

        <p className="password-guidance">
          Use at least 10 characters with an
          uppercase letter, lowercase letter
          and number.
        </p>

        <button
          className="button"
          type="submit"
          disabled={submitting}
        >
          {submitting
            ? 'Creating account…'
            : 'Create account'}
        </button>

        <p className="auth-switch">
          Already have an account?{' '}

          <Link
            to={
              requestedRedirect
                ? `/login?redirect=${encodeURIComponent(
                    requestedRedirect
                  )}`
                : '/login'
            }
          >
            Log in
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