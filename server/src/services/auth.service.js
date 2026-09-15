import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

import {
  Session,
  StaffPermission,
  User,
  sequelize
} from '../models/index.js';

const permissionNames = [
  'canManageInventory',
  'canManageEnquiries',
  'canViewAssignedContacts',
  'canArchiveRecords',
  'canViewLimitedAnalytics'
];

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
      meta.userAgent || null
  });

  const accessToken =
    createAccessToken(
      user,
      session.sessionId
    );

  return {
    accessToken,
    refreshToken,
    user: await createSafeUser(user)
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

  return createSession(user, meta);
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

  if (!user || !passwordIsValid) {
    throw Object.assign(
      new Error(
        'Invalid email or password'
      ),
      {
        status: 401
      }
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

  await currentSession.save();

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