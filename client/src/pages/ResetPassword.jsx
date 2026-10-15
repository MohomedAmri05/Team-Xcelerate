/*
| VIVA-UI – M.R. Ahamed – Reset password (step 2, from the emailed link)
|   /reset-password?token=… → POST /auth/reset-password { token, newPassword }
|   The link works once and expires; every signed-in device is signed out.
| API paths are relative to /api/v1 (services/api.js).
*/

import { CircleCheck, KeyRound, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';

import Brand from '../components/Brand';
import PasswordInput, { passwordStrength } from '../components/ui/PasswordInput';
import { api, errorMessage } from '../services/api';

export default function ResetPassword() {
  const location = useLocation();
  const token = useMemo(() => new URLSearchParams(location.search).get('token') || '', [location.search]);
  const validLink = /^[a-f0-9]{64}$/i.test(token);

  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [linkProblem, setLinkProblem] = useState(validLink ? '' : 'This reset link is incomplete. Open the link from the email again, or request a new one.');

  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();

    if (!passwordStrength(form.newPassword).meetsRules) {
      toast.error('The new password does not meet the rules yet');
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      toast.error('The passwords do not match');
      return;
    }

    setSubmitting(true);

    try {
      await api.post('/auth/reset-password', { token, newPassword: form.newPassword });
      setDone(true);
      toast.success('Password reset. You can log in now.');
    } catch (error) {
      if (error.response?.status === 400) {
        setLinkProblem(errorMessage(error));
      } else {
        toast.error(errorMessage(error, 'Could not reset the password'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login">
      <form onSubmit={submit}>
        <Brand />

        <div>
          <p className="eyebrow">ACCOUNT SECURITY</p>
          <h1>Choose a new password.</h1>
          <p className="auth-intro">Only you know this password — High Street staff can never see it.</p>
        </div>

        {done ? (
          <div className="auth-notice" role="status">
            <CircleCheck aria-hidden="true" />
            <div>
              <strong>Your password has been reset</strong>
              <p>For your security every device was signed out. Log in with the new password.</p>
            </div>
          </div>
        ) : linkProblem ? (
          <div className="auth-notice auth-notice--warning" role="alert">
            <TriangleAlert aria-hidden="true" />
            <div>
              <strong>This link cannot be used</strong>
              <p>{linkProblem}</p>
            </div>
          </div>
        ) : (
          <>
            <PasswordInput
              label="New password"
              name="newPassword"
              autoComplete="new-password"
              required
              minLength={10}
              value={form.newPassword}
              onChange={update}
              showStrength
            />

            <PasswordInput
              label="Confirm new password"
              name="confirmPassword"
              autoComplete="new-password"
              required
              minLength={10}
              value={form.confirmPassword}
              onChange={update}
              hint={form.confirmPassword && form.confirmPassword !== form.newPassword ? 'The passwords do not match yet.' : undefined}
            />

            <button className="button" type="submit" disabled={submitting}>
              <KeyRound size={17} />
              {submitting ? 'Saving…' : 'Reset password'}
            </button>
          </>
        )}

        <p className="auth-switch">
          {done ? <Link to="/login">Go to log in</Link> : <>Need a new link? <Link to="/forgot-password">Request another one</Link></>}
        </p>
      </form>
    </main>
  );
}
