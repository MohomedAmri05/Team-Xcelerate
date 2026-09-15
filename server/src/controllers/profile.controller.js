import bcrypt from 'bcrypt';
import { Op } from 'sequelize';

import {
  Session,
  User,
  sequelize
} from '../models/index.js';

import {
  ok
} from '../middleware/core.js';

const safeUser = (user) => ({
  userId: user.userId,
  name: user.name,
  email: user.email,
  role: user.role,
  isActive: user.isActive,
  phone: user.phone,
  address: user.address,
  profileImageUrl: user.profileImageUrl,
  emailVerifiedAt: user.emailVerifiedAt,
  lastLoginAt: user.lastLoginAt,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
});

export async function updateProfile(req, res) {
  const user = await User.findByPk(
    req.user.userId
  );

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'Account not found',
      errors: []
    });
  }

  await user.update({
    name: req.validated.body.name,
    phone: req.validated.body.phone,

    address:
      req.validated.body.address || null
  });

  return ok(
    res,
    'Profile updated successfully',
    safeUser(user)
  );
}

export async function changePassword(req, res) {
  const user = await User.unscoped().findByPk(
    req.user.userId
  );

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'Account not found',
      errors: []
    });
  }

  const {
    currentPassword,
    newPassword
  } = req.validated.body;

  const currentPasswordIsValid =
    await bcrypt.compare(
      currentPassword,
      user.passwordHash
    );

  if (!currentPasswordIsValid) {
    return res.status(422).json({
      success: false,
      message: 'Current password is incorrect',
      errors: []
    });
  }

  const passwordIsUnchanged =
    await bcrypt.compare(
      newPassword,
      user.passwordHash
    );

  if (passwordIsUnchanged) {
    return res.status(422).json({
      success: false,
      message:
        'New password must be different from the current password',
      errors: []
    });
  }

  const newPasswordHash =
    await bcrypt.hash(newPassword, 12);

  await sequelize.transaction(
    async (transaction) => {
      await user.update(
        {
          passwordHash: newPasswordHash
        },
        {
          transaction
        }
      );

      /*
       * Revoke every other session after changing
       * the password. The current session remains active.
       */
      await Session.update(
        {
          revokedAt: new Date()
        },
        {
          where: {
            userId: user.userId,

            sessionId: {
              [Op.ne]: req.sessionId
            },

            revokedAt: null
          },

          transaction
        }
      );
    }
  );

  return ok(
    res,
    'Password changed successfully'
  );
}