/*
| VIVA-UI – M.R. Ahamed – Users (own account)
|   UPDATE profile → PUT /auth/profile
|   UPDATE password → PUT /auth/change-password
|   October 2026: show/hide + strength meter; when an Admin created the
|   account with a temporary password (?password=required) the user must
|   change it here first – only the account owner can change a password.
| API paths are relative to /api/v1 (services/api.js).
*/

import {
  useEffect,
  useState
} from 'react';

import {
  KeyRound,
  Save,
  ShieldAlert,
  ShieldCheck,
  UserRound
} from 'lucide-react';

import toast from 'react-hot-toast';

import {
  useNavigate
} from 'react-router-dom';

import PasswordInput, {
  passwordStrength
} from '../components/ui/PasswordInput';

import {
  api
} from '../services/api';

import {
  useAuth
} from '../features/auth/AuthContext';

export default function Profile() {
  const {
    user,
    refreshUser
  } = useAuth();

  const navigate = useNavigate();

  const mustChange = Boolean(
    user?.mustChangePassword
  );

  const [
    profileForm,
    setProfileForm
  ] = useState({
    name: '',
    phone: '',
    address: ''
  });

  const [
    passwordForm,
    setPasswordForm
  ] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [
    savingProfile,
    setSavingProfile
  ] = useState(false);

  const [
    savingPassword,
    setSavingPassword
  ] = useState(false);

  useEffect(() => {
    if (user) {
      setProfileForm({
        name: user.name || '',
        phone: user.phone || '',
        address: user.address || ''
      });
    }
  }, [user]);

  const updateProfileField = (event) => {
    const {
      name,
      value
    } = event.target;

    setProfileForm((currentForm) => ({
      ...currentForm,
      [name]: value
    }));
  };

  const updatePasswordField = (event) => {
    const {
      name,
      value
    } = event.target;

    setPasswordForm((currentForm) => ({
      ...currentForm,
      [name]: value
    }));
  };

  const submitProfile = async (event) => {
    event.preventDefault();
    setSavingProfile(true);

    try {
      await api.put(
        '/auth/profile',
        profileForm
      );

      await refreshUser();

      toast.success(
        'Profile updated successfully'
      );
    } catch (error) {
      const validationErrors =
        error.response?.data?.errors;

      toast.error(
        validationErrors?.[0]?.message ||
        error.response?.data?.message ||
        'Profile could not be updated'
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const submitPassword = async (event) => {
    event.preventDefault();

    if (!passwordStrength(passwordForm.newPassword).meetsRules) {
      toast.error(
        'The new password does not meet the rules yet'
      );

      return;
    }

    if (
      passwordForm.newPassword !==
      passwordForm.confirmPassword
    ) {
      toast.error(
        'New passwords do not match'
      );

      return;
    }

    setSavingPassword(true);

    try {
      await api.put(
        '/auth/change-password',
        {
          currentPassword:
            passwordForm.currentPassword,

          newPassword:
            passwordForm.newPassword
        }
      );

      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });

      toast.success(
        'Password changed successfully'
      );

      // The temporary password has been replaced: continue to the site.
      if (mustChange) {
        const refreshed = await refreshUser();

        navigate(
          refreshed.role === 'Admin' || refreshed.role === 'Staff'
            ? '/admin'
            : '/',
          { replace: true }
        );
      }
    } catch (error) {
      const validationErrors =
        error.response?.data?.errors;

      toast.error(
        validationErrors?.[0]?.message ||
        error.response?.data?.message ||
        'Password could not be changed'
      );
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <section className="page section profile-page">
      <div className="profile-heading">
        <div>
          <p className="eyebrow">
            HIGH STREET ACCOUNT
          </p>

          <h1>My profile.</h1>
        </div>

        <div className="profile-role">
          <ShieldCheck />

          <div>
            <small>ACCOUNT ROLE</small>
            <strong>{user?.role}</strong>
          </div>
        </div>
      </div>

      {mustChange && (
        <div className="auth-notice auth-notice--warning profile-required" role="alert">
          <ShieldAlert aria-hidden="true" />
          <div>
            <strong>Change your temporary password</strong>
            <p>
              Your account was created by an Admin with a temporary password. Choose your own password below — after
              that only you will know it. The rest of the website opens once it is changed.
            </p>
          </div>
        </div>
      )}

      <div className={`profile-grid ${mustChange ? 'profile-grid--password-first' : ''}`}>
        <form
          className="panel profile-form"
          onSubmit={submitProfile}
        >
          <div className="profile-form-heading">
            <UserRound />

            <div>
              <p className="eyebrow">
                PERSONAL INFORMATION
              </p>

              <h2>Account details</h2>
            </div>
          </div>

          <label>
            Full name

            <input
              type="text"
              name="name"
              required
              minLength="2"
              maxLength="100"
              autoComplete="name"
              value={profileForm.name}
              onChange={updateProfileField}
            />
          </label>

          <label>
            Email address

            <input
              type="email"
              value={user?.email || ''}
              disabled
            />

            <small>
              Email changes require account
              verification and are currently
              managed by an administrator.
            </small>
          </label>

          <label>
            Phone number

            <input
              type="tel"
              name="phone"
              required
              pattern="\+?[0-9 \(\)\-]{7,20}"
              autoComplete="tel"
              value={profileForm.phone}
              onChange={updateProfileField}
              placeholder="0771234567"
            />
          </label>

          <label>
            Address

            <textarea
              name="address"
              maxLength="500"
              autoComplete="street-address"
              value={profileForm.address}
              onChange={updateProfileField}
              placeholder="Kandy, Sri Lanka"
            />
          </label>

          <button
            className="button"
            type="submit"
            disabled={savingProfile}
          >
            <Save />

            {savingProfile
              ? 'Saving…'
              : 'Save profile'}
          </button>
        </form>

        <form
          className="panel profile-form"
          onSubmit={submitPassword}
        >
          <div className="profile-form-heading">
            <KeyRound />

            <div>
              <p className="eyebrow">
                ACCOUNT SECURITY
              </p>

              <h2>Change password</h2>
            </div>
          </div>

          <PasswordInput
            label={mustChange ? 'Temporary password' : 'Current password'}
            name="currentPassword"
            required
            minLength={8}
            autoComplete="current-password"
            value={
              passwordForm.currentPassword
            }
            onChange={updatePasswordField}
          />

          <PasswordInput
            label="New password"
            name="newPassword"
            required
            minLength={10}
            autoComplete="new-password"
            value={
              passwordForm.newPassword
            }
            onChange={updatePasswordField}
            showStrength
          />

          <PasswordInput
            label="Confirm new password"
            name="confirmPassword"
            required
            minLength={10}
            autoComplete="new-password"
            value={
              passwordForm.confirmPassword
            }
            onChange={updatePasswordField}
            hint={
              passwordForm.confirmPassword &&
              passwordForm.confirmPassword !== passwordForm.newPassword
                ? 'The passwords do not match yet.'
                : undefined
            }
          />

          <p className="password-guidance">
            Use at least 10 characters with an
            uppercase letter, lowercase letter
            and number.
          </p>

          <button
            className="button"
            type="submit"
            disabled={savingPassword}
          >
            <KeyRound />

            {savingPassword
              ? 'Changing…'
              : 'Change password'}
          </button>
        </form>
      </div>
    </section>
  );
}