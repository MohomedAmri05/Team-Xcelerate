/*
| VIVA-UI – M.R. Ahamed – Forgot password (step 1)
|   The account owner enters their email → POST /auth/forgot-password
|   The answer is always the same, so the page never reveals whether an
|   email has an account. The emailed link opens /reset-password.
| API paths are relative to /api/v1 (services/api.js).
*/

import { MailCheck, Send } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

import Brand from '../components/Brand';
import { api, errorMessage } from '../services/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);

    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setSentTo(email.trim());
    } catch (error) {
      toast.error(
        error.response?.status === 429
          ? 'Too many requests. Please wait a few minutes and try again.'
          : errorMessage(error, 'Could not send the reset link')
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login">
      <form onSubmit={submit} noValidate={false}>
        <Brand />

        <div>
          <p className="eyebrow">ACCOUNT SECURITY</p>
          <h1>Forgot your password?</h1>
          <p className="auth-intro">
            Enter the email address of your account. We will email you a link to choose a new password yourself.
          </p>
        </div>

        {sentTo ? (
          <div className="auth-notice" role="status">
            <MailCheck aria-hidden="true" />
            <div>
              <strong>Check your email</strong>
              <p>
                If an account exists for <b>{sentTo}</b>, we have sent a link to reset the password. The link works once and
                expires in 30 minutes. Check the spam folder if you cannot see it.
              </p>
            </div>
          </div>
        ) : (
          <>
            <label>
              Email address
              <input
                type="email"
                name="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </label>

            <button className="button" type="submit" disabled={submitting || !email.trim()}>
              <Send size={17} />
              {submitting ? 'Sending…' : 'Send reset link'}
            </button>
          </>
        )}

        <p className="auth-switch">
          Remembered it? <Link to="/login">Back to log in</Link>
        </p>
      </form>
    </main>
  );
}
