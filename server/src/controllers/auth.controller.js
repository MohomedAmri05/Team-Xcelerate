/*
|--------------------------------------------------------------------------
| VIVA-HEADER – M.R. Ahamed – Admin Dashboard & Authentication
| Authentication + CRUD resource 2: Sessions (table `admin_sessions`)
|--------------------------------------------------------------------------
|   CREATE  register             POST /api/v1/auth/register
|   CREATE  login                POST /api/v1/auth/login
|   UPDATE  refresh              POST /api/v1/auth/refresh
|   DELETE  logout               POST /api/v1/auth/logout
|   READ    me                   GET /api/v1/auth/me
|   (Oct 2026) forgotPassword    POST /api/v1/auth/forgot-password
|              resetPassword     POST /api/v1/auth/reset-password
|   Login also records a session event, locks the account after repeated
|   wrong passwords and emails a "new device" alert.
| Every write goes through Sequelize to MySQL/MariaDB and is recorded in
| activity_logs (services/activity.service.js) where it changes data.
*/

import * as authService from '../services/auth.service.js';
import { ok } from '../middleware/core.js';
import { queueMail } from '../services/mail.service.js';
import { logActivity } from '../services/activity.service.js';

const getRequestMetadata = (req) => {
  return {
    ipAddress: req.ip,
    userAgent: req.get('user-agent') || null
  };
};

// The website address used in emailed links (first CLIENT_URL entry).
const clientUrl = () => String(process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim().replace(/\/$/, '');

// Removes server-only fields before the session is sent to the browser.
function publicSession({ newDevice, sessionId, deviceLabel, ...data }) {
  void newDevice;
  void sessionId;
  void deviceLabel;
  return data;
}

async function sendNewDeviceAlert(req, result) {
  if (!result.newDevice) {
    return;
  }

  await queueMail(
    {
      to: result.user.email,
      subject: 'New sign-in to your High Street account',
      heading: 'New device signed in',
      text: [
        `Dear ${result.user.name},`,
        `Your High Street account was used to sign in from a new device: ${result.deviceLabel} (IP address ${req.ip || 'unknown'}) on ${new Date().toLocaleString('en-LK')}.`,
        'If this was you, you do not need to do anything.',
        'If it was not you, change your password straight away (Profile › Change password) — this signs out every other device — and reply to this email.',
        'High Street (PVT) Ltd.'
      ].join('\n\n')
    },
    {
      messageKey: `user-${result.user.userId}-new-device-${result.sessionId}`,
      template: 'account-new-device',
      relatedType: 'User',
      relatedId: result.user.userId,
      createdBy: result.user.userId
    }
  );
}

// VIVA CRUD CREATE – customer account (Users CREATE) + first session (POST /api/v1/auth/register)
export async function register(req, res) {
  const result = await authService.registerCustomer(
    req.validated.body,
    getRequestMetadata(req)
  );

  await logActivity(
    { user: result.user, ip: req.ip },
    'user.registered',
    'User',
    result.user.userId,
    `Customer account created for ${result.user.email}`
  );

  await queueMail(
    {
      to: result.user.email,
      subject: 'Welcome to High Street',
      heading: `Welcome, ${result.user.name}`,
      text: [
        `Dear ${result.user.name},`,
        'Your High Street customer account is ready. You can now save vehicles to your wishlist, send enquiries, request test drives and track complaints from your account.',
        'If you did not create this account, please reply to this email.',
        'High Street (PVT) Ltd. · Katugastota, Kandy'
      ].join('\n\n')
    },
    {
      messageKey: `user-${result.user.userId}-welcome`,
      template: 'account-welcome',
      relatedType: 'User',
      relatedId: result.user.userId,
      createdBy: result.user.userId
    }
  );

  return res.status(201).json({
    success: true,
    message: 'Customer account created successfully',
    data: publicSession(result),
    meta: {}
  });
}

// VIVA CRUD CREATE – Sessions CREATE: hashed refresh token, IP, browser (POST /api/v1/auth/login)
export async function login(req, res) {
  const result = await authService.login(
    req.validated.body.email,
    req.validated.body.password,
    getRequestMetadata(req)
  );

  await sendNewDeviceAlert(req, result);

  return ok(
    res,
    'Login successful',
    publicSession(result)
  );
}

// VIVA CRUD UPDATE – Sessions UPDATE: rotates the refresh token (POST /api/v1/auth/refresh)
export async function refresh(req, res) {
  const result = await authService.refresh(
    req.body.refreshToken,
    getRequestMetadata(req)
  );

  return ok(
    res,
    'Session refreshed',
    result
  );
}

// VIVA CRUD DELETE – Sessions DELETE: revokes this session (POST /api/v1/auth/logout)
export async function logout(req, res) {
  await authService.endSessions(
    { sessionId: req.sessionId },
    { reason: 'logout', endedBy: req.user.userId, detail: 'Signed out by the user', meta: getRequestMetadata(req) }
  );

  return ok(
    res,
    'Logged out successfully'
  );
}

/*
|--------------------------------------------------------------------------
| VIVA – Ahamed – Forgot password (the account owner resets it)
|--------------------------------------------------------------------------
| Step 1 POST /auth/forgot-password { email } → emails a one-time link.
| The answer is always the same, so the form does not reveal which emails
| have an account.
*/
export async function forgotPassword(req, res) {
  const reset = await authService.createPasswordReset(req.validated.body.email, getRequestMetadata(req));

  if (reset) {
    const link = `${clientUrl()}/reset-password?token=${reset.token}`;

    await queueMail(
      {
        to: reset.user.email,
        subject: 'Reset your High Street password',
        heading: 'Reset your password',
        text: [
          `Dear ${reset.user.name},`,
          'We received a request to reset the password for your High Street account.',
          `Open this link to choose a new password (it works once and expires in ${reset.minutes} minutes):`,
          link,
          'If you did not ask for this, you can ignore this email — your password stays the same.',
          'High Street (PVT) Ltd.'
        ].join('\n\n')
      },
      {
        messageKey: `user-${reset.user.userId}-reset-${Date.now()}`,
        template: 'account-password-reset',
        relatedType: 'User',
        relatedId: reset.user.userId,
        createdBy: null
      }
    );

    await logActivity({ user: reset.user, ip: req.ip }, 'user.password_reset_requested', 'User', reset.user.userId, `Password reset link sent to ${reset.user.email}`);
  }

  return ok(
    res,
    'If an account exists for that email, we have sent a link to reset the password.'
  );
}

/*
| Step 2 POST /auth/reset-password { token, newPassword } → sets the new
| password, signs out every device and emails a confirmation.
*/
export async function resetPassword(req, res) {
  const user = await authService.resetPasswordWithToken(
    req.validated.body.token,
    req.validated.body.newPassword,
    getRequestMetadata(req)
  );

  await logActivity({ user, ip: req.ip }, 'user.password_reset', 'User', user.userId, `${user.email} reset their password with an emailed link`);

  await queueMail(
    {
      to: user.email,
      subject: 'Your High Street password was reset',
      heading: 'Password reset',
      text: [
        `Dear ${user.name},`,
        `The password for your High Street account was reset on ${new Date().toLocaleString('en-LK')}. Every signed-in device was signed out.`,
        'If you did not do this, reply to this email immediately so we can secure your account.',
        'High Street (PVT) Ltd.'
      ].join('\n\n')
    },
    {
      messageKey: `user-${user.userId}-reset-done-${Date.now()}`,
      template: 'account-password',
      relatedType: 'User',
      relatedId: user.userId,
      createdBy: user.userId
    }
  );

  return ok(
    res,
    'Your password has been reset. You can now log in with the new password.'
  );
}

// VIVA CRUD READ – the signed-in user (GET /api/v1/auth/me)
export async function me(req, res) {
  const safeUser =
    await authService.createSafeUser(
      req.user
    );

  return ok(
    res,
    'Authenticated user retrieved',
    safeUser
  );
}