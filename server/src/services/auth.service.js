/*
|--------------------------------------------------------------------------
| VIVA – M.R. Ahamed – Authentication service
|--------------------------------------------------------------------------
| Password hashing (bcrypt), JWT access tokens, rotating refresh tokens,
| session records, and (October 2026):
|   - account lockout after LOGIN_LOCK_ATTEMPTS wrong passwords
|   - session activity: device label, last seen, refresh count, how and
|     by whom a session ended, and a session_events history
|   - "Forgot password?" one-time reset links (only the account owner can
|     change a password; Admins never see or set other people's passwords)
*/

import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';

import {
  PasswordResetToken,
  Session,
  SessionEvent,
  StaffPermission,
  User,
  sequelize
} from '../models/index.js';

import { describeDevice } from '../utils/device.js';

export const PERMISSION_NAMES = [
  'canManageInventory',
  'canManageEnquiries',
  'canViewAssignedContacts',
  'canArchiveRecords',
  'canManageComplaints',
  'canViewLimitedAnalytics',
  // Added October 2026
  'canManageBookings',
  'canExportReports'
];

const permissionNames = PERMISSION_NAMES;

const LOCK_ATTEMPTS = () => Math.max(Number(process.env.LOGIN_LOCK_ATTEMPTS) || 5, 1);
const LOCK_MINUTES = () => Math.max(Number(process.env.LOGIN_LOCK_MINUTES) || 15, 1);
const RESET_MINUTES = () => Math.max(Number(process.env.PASSWORD_RESET_MINUTES) || 30, 5);

const httpError = (status, message, extra = {}) => Object.assign(new Error(message), { status, ...extra });

/*
|--------------------------------------------------------------------------
| Session events ("Check activity" timeline)
|--------------------------------------------------------------------------
| Never interrupts the operation that triggered it.
*/
export async function recordSessionEvent(eventType, data = {}, transaction) {
  try {
    const device = data.userAgent !== undefined ? describeDevice(data.userAgent) : null;

    await SessionEvent.create(
      {
        eventType,
        sessionId: data.sessionId ?? null,
        userId: data.userId ?? null,
        actorId: data.actorId ?? null,
        email: data.email ? String(data.email).slice(0, 150) : null,
        detail: data.detail ? String(data.detail).slice(0, 255) : null,
        ipAddress: data.ipAddress ? String(data.ipAddress).slice(0, 45) : null,
        userAgent: data.userAgent ? String(data.userAgent).slice(0, 500) : null,
        deviceLabel: data.deviceLabel || device?.label || null
      },
      transaction ? { transaction } : undefined
    );
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('[session event]', error.message);
    }
  }
}

/**
 * Ends sessions (sets revoked_at) and records how and by whom.
 * reason: logout | revoked | signed_out_others | password_changed |
 *         password_reset | deactivated
 * Returns the number of sessions ended.
 */
export async function endSessions(where, { reason, endedBy = null, detail = null, meta = {}, transaction } = {}) {
  const sessions = await Session.findAll({
    where: { ...where, revokedAt: null },
    attributes: ['sessionId', 'userId'],
    transaction
  });

  if (!sessions.length) {
    return 0;
  }

  const now = new Date();

  await Session.update(
    { revokedAt: now, endedReason: reason, endedBy },
    { where: { sessionId: { [Op.in]: sessions.map((session) => session.sessionId) } }, transaction }
  );

  for (const session of sessions) {
    await recordSessionEvent(
      reason,
      {
        sessionId: session.sessionId,
        userId: session.userId,
        actorId: endedBy,
        detail,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent
      },
      transaction
    );
  }

  return sessions.length;
}

const hashToken = (token) => {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
};

const createAccessToken = (
  user,
  sessionId
) => {
  return jwt.sign(
    {
      sub: user.userId,
      role: user.role,
      sid: sessionId
    },
    process.env.JWT_ACCESS_SECRET,
    {
      expiresIn:
        process.env.ACCESS_TOKEN_TTL ||
        '15m'
    }
  );
};

const createRefreshToken = (user) => {
  return jwt.sign(
    {
      sub: user.userId,
      jti: crypto.randomUUID()
    },
    process.env.JWT_REFRESH_SECRET,
    {
      expiresIn:
        `${process.env.REFRESH_TOKEN_DAYS || 7}d`
    }
  );
};

function createPermissionObject(
  value = false
) {
  return Object.fromEntries(
    permissionNames.map(
      (permission) => [
        permission,
        value
      ]
    )
  );
}

async function getUserPermissions(user) {
  if (user.role === 'Admin') {
    return createPermissionObject(true);
  }

  if (user.role === 'Customer') {
    return createPermissionObject(false);
  }

  const permissionRecord =
    await StaffPermission.findOne({
      where: {
        userId: user.userId
      }
    });

  if (!permissionRecord) {
    return createPermissionObject(false);
  }

  const plainPermissions =
    permissionRecord.get({
      plain: true
    });

  return Object.fromEntries(
    permissionNames.map(
      (permissionName) => [
        permissionName,
        Boolean(
          plainPermissions[
            permissionName
          ]
        )
      ]
    )
  );
}

export async function createSafeUser(
  user
) {
  return {
    userId: user.userId,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    phone: user.phone,
    address: user.address,
    profileImageUrl:
      user.profileImageUrl,
    emailVerifiedAt:
      user.emailVerifiedAt,
    lastLoginAt: user.lastLoginAt,

    // The user must replace an Admin-set temporary password first.
    mustChangePassword:
      Boolean(user.mustChangePassword),

    permissions:
      await getUserPermissions(user)
  };
}

const createSession = async (
  user,
  meta = {}
) => {
  const refreshToken =
    createRefreshToken(user);

  const refreshTokenDays = Number(
    process.env.REFRESH_TOKEN_DAYS || 7
  );

  const device = describeDevice(meta.userAgent);

  // "New device" = this account has signed in before, but never with this
  // browser/system combination (used for the new-device alert email).
  const previousSessions = await Session.count({ where: { userId: user.userId } });
  const knownDevice = previousSessions
    ? await Session.count({ where: { userId: user.userId, deviceLabel: device.label } })
    : 0;

  const session = await Session.create({
    userId: user.userId,

    refreshTokenHash:
      hashToken(refreshToken),

    expiresAt: new Date(
      Date.now() +
        refreshTokenDays *
          24 *
          60 *
          60 *
          1000
    ),

    ipAddress:
      meta.ipAddress || null,

    userAgent:
      meta.userAgent || null,

    deviceLabel: device.label,
    lastSeenAt: new Date()
  });

  await recordSessionEvent('login', {
    sessionId: session.sessionId,
    userId: user.userId,
    actorId: user.userId,
    email: user.email,
    detail: meta.eventDetail || null,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    deviceLabel: device.label
  });

  const accessToken =
    createAccessToken(
      user,
      session.sessionId
    );

  return {
    accessToken,
    refreshToken,
    user: await createSafeUser(user),
    // Not part of the JSON contract the browser relies on; used by the
    // controller to send the new-device alert.
    newDevice: previousSessions > 0 && knownDevice === 0,
    sessionId: session.sessionId,
    deviceLabel: device.label
  };
};

export async function registerCustomer(
  data,
  meta = {}
) {
  const normalizedEmail =
    data.email
      .trim()
      .toLowerCase();

  const existingUser =
    await User.unscoped().findOne({
      where: {
        email: normalizedEmail
      }
    });

  if (existingUser) {
    throw Object.assign(
      new Error(
        'An account with this email already exists'
      ),
      {
        status: 409
      }
    );
  }

  const passwordHash =
    await bcrypt.hash(
      data.password,
      12
    );

  const user =
    await sequelize.transaction(
      async (transaction) => {
        return User.create(
          {
            name: data.name.trim(),
            email: normalizedEmail,
            phone: data.phone.trim(),

            address:
              data.address?.trim() ||
              null,

            passwordHash,
            role: 'Customer',
            isActive: true
          },
          {
            transaction
          }
        );
      }
    );

  return createSession(user, { ...meta, eventDetail: 'Account registered' });
}

export async function login(
  email,
  password,
  meta = {}
) {
  const normalizedEmail =
    email
      .trim()
      .toLowerCase();

  const user =
    await User.unscoped().findOne({
      where: {
        email: normalizedEmail
      }
    });

  const passwordIsValid =
    user &&
    await bcrypt.compare(
      password,
      user.passwordHash
    );

  const lockedNow = Boolean(user?.lockedUntil && new Date(user.lockedUntil) > new Date());

  if (!user || !passwordIsValid) {
    /*
     * Failed attempt: recorded in the login history. Repeated wrong
     * passwords lock the account for LOGIN_LOCK_MINUTES. The message is
     * the same whether or not the account exists.
     */
    if (user && !lockedNow) {
      const attempts = Number(user.failedLoginCount || 0) + 1;

      if (attempts >= LOCK_ATTEMPTS()) {
        const until = new Date(Date.now() + LOCK_MINUTES() * 60 * 1000);
        await user.update({ failedLoginCount: 0, lockedUntil: until });
        await recordSessionEvent('locked', {
          userId: user.userId,
          email: user.email,
          detail: `Locked until ${until.toISOString()} after ${attempts} wrong passwords`,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent
        });
      } else {
        await user.update({ failedLoginCount: attempts });
      }
    }

    await recordSessionEvent('login_failed', {
      userId: user?.userId ?? null,
      email: normalizedEmail,
      detail: user ? (lockedNow ? 'Wrong password while locked' : 'Wrong password') : 'Unknown email',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent
    });

    throw Object.assign(
      new Error(
        'Invalid email or password'
      ),
      {
        status: 401
      }
    );
  }

  // Correct password, but the account is still locked.
  if (lockedNow) {
    await recordSessionEvent('login_failed', {
      userId: user.userId,
      email: normalizedEmail,
      detail: 'Account locked',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent
    });

    const until = new Date(user.lockedUntil);

    throw httpError(
      423,
      `This account is locked after too many wrong passwords. Try again after ${until.toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit' })}, or ask an Admin to unlock it.`,
      { code: 'ACCOUNT_LOCKED', lockedUntil: until.toISOString() }
    );
  }

  if (!user.isActive) {
    throw Object.assign(
      new Error(
        'This account has been deactivated'
      ),
      {
        status: 403
      }
    );
  }

  user.lastLoginAt = new Date();
  user.failedLoginCount = 0;
  user.lockedUntil = null;
  await user.save();

  return createSession(user, meta);
}

export async function refresh(
  refreshToken,
  meta = {}
) {
  if (!refreshToken) {
    throw Object.assign(
      new Error(
        'Refresh token is required'
      ),
      {
        status: 401
      }
    );
  }

  let payload;

  try {
    payload = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET
    );
  } catch {
    throw Object.assign(
      new Error(
        'Invalid or expired refresh token'
      ),
      {
        status: 401
      }
    );
  }

  const currentSession =
    await Session.findOne({
      where: {
        userId: payload.sub,

        refreshTokenHash:
          hashToken(refreshToken),

        revokedAt: null
      }
    });

  if (
    !currentSession ||
    currentSession.expiresAt <
      new Date()
  ) {
    throw Object.assign(
      new Error(
        'Session expired or revoked'
      ),
      {
        status: 401
      }
    );
  }

  const user =
    await User.findByPk(
      payload.sub
    );

  if (!user || !user.isActive) {
    throw Object.assign(
      new Error(
        'Account unavailable'
      ),
      {
        status: 401
      }
    );
  }

  const replacementRefreshToken =
    createRefreshToken(user);

  currentSession.refreshTokenHash =
    hashToken(
      replacementRefreshToken
    );

  currentSession.ipAddress =
    meta.ipAddress ||
    currentSession.ipAddress;

  currentSession.userAgent =
    meta.userAgent ||
    currentSession.userAgent;

  currentSession.refreshCount =
    Number(currentSession.refreshCount || 0) + 1;

  currentSession.lastSeenAt = new Date();

  if (meta.userAgent) {
    currentSession.deviceLabel = describeDevice(meta.userAgent).label;
  }

  await currentSession.save();

  await recordSessionEvent('refresh', {
    sessionId: currentSession.sessionId,
    userId: user.userId,
    actorId: user.userId,
    detail: `Token refreshed (#${currentSession.refreshCount})`,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent
  });

  return {
    accessToken:
      createAccessToken(
        user,
        currentSession.sessionId
      ),

    refreshToken:
      replacementRefreshToken,

    user:
      await createSafeUser(user)
  };
}

/*
|--------------------------------------------------------------------------
| Forgot password – step 1: email a one-time reset link
|--------------------------------------------------------------------------
| Returns { user, token, expiresAt } when an active account exists, or
| null. The HTTP response is the same in both cases, so the form cannot be
| used to find out which emails are registered.
*/
export async function createPasswordReset(email, meta = {}) {
  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await User.findOne({ where: { email: normalizedEmail } });

  await recordSessionEvent('password_reset_requested', {
    userId: user?.userId ?? null,
    email: normalizedEmail,
    detail: user ? (user.isActive ? 'Reset link created' : 'Inactive account – no link sent') : 'Unknown email – no link sent',
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent
  });

  if (!user || !user.isActive) {
    return null;
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + RESET_MINUTES() * 60 * 1000);

  await sequelize.transaction(async (transaction) => {
    // Only the newest link works.
    await PasswordResetToken.update(
      { usedAt: new Date() },
      { where: { userId: user.userId, usedAt: null }, transaction }
    );

    await PasswordResetToken.create(
      {
        userId: user.userId,
        tokenHash: hashToken(token),
        expiresAt,
        ipAddress: meta.ipAddress ? String(meta.ipAddress).slice(0, 45) : null
      },
      { transaction }
    );
  });

  return { user, token, expiresAt, minutes: RESET_MINUTES() };
}

/*
|--------------------------------------------------------------------------
| Forgot password – step 2: set the new password with the link
|--------------------------------------------------------------------------
| The link works once and only before it expires. Every session of the
| account is signed out; the lockout and "must change password" flags are
| cleared.
*/
export async function resetPasswordWithToken(token, newPassword, meta = {}) {
  const record = await PasswordResetToken.findOne({
    where: {
      tokenHash: hashToken(String(token || '')),
      usedAt: null,
      expiresAt: { [Op.gt]: new Date() }
    }
  });

  if (!record) {
    throw httpError(400, 'This reset link is invalid or has expired. Please request a new one.');
  }

  const user = await User.unscoped().findByPk(record.userId);

  if (!user || !user.isActive) {
    throw httpError(400, 'This reset link is invalid or has expired. Please request a new one.');
  }

  if (await bcrypt.compare(newPassword, user.passwordHash)) {
    throw httpError(422, 'Choose a password you have not used for this account');
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await sequelize.transaction(async (transaction) => {
    await user.update(
      {
        passwordHash,
        mustChangePassword: false,
        failedLoginCount: 0,
        lockedUntil: null,
        passwordChangedAt: new Date()
      },
      { transaction }
    );

    await record.update({ usedAt: new Date() }, { transaction });

    await endSessions(
      { userId: user.userId },
      { reason: 'password_reset', endedBy: user.userId, detail: 'Password reset with an emailed link', meta, transaction }
    );
  });

  await recordSessionEvent('password_reset', {
    userId: user.userId,
    actorId: user.userId,
    email: user.email,
    detail: 'Password reset with an emailed link',
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent
  });

  return user;
}
