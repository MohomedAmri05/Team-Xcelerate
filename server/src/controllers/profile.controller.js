/*
|--------------------------------------------------------------------------
| VIVA-HEADER – M.R. Ahamed – Admin Dashboard & Authentication
| Users (own account)
|--------------------------------------------------------------------------
|   UPDATE  updateProfile        PUT /api/v1/auth/profile
|   UPDATE  changePassword       PUT /api/v1/auth/change-password
|           (also used for the forced change of an Admin-set temporary
|            password at the first sign-in – clears must_change_password)
| Every write goes through Sequelize to MySQL/MariaDB and is recorded in
| activity_logs (services/activity.service.js) where it changes data.
*/

import bcrypt from 'bcrypt';
import { Op } from 'sequelize';

import {
  User,
  sequelize
} from '../models/index.js';

import {
  ok
} from '../middleware/core.js';
import { endSessions } from '../services/auth.service.js';
import { queueMail } from '../services/mail.service.js';
import { logActivity } from '../services/activity.service.js';

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
  mustChangePassword: Boolean(user.mustChangePassword),
  passwordChangedAt: user.passwordChangedAt,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
});

// VIVA CRUD UPDATE – own name / phone / address (PUT /api/v1/auth/profile)
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

  await logActivity(req, 'user.profile_updated', 'User', user.userId, `${user.email} updated their profile`);

  return ok(
    res,
    'Profile updated successfully',
    safeUser(user)
  );
}

// VIVA CRUD UPDATE – checks the current password, signs out other devices (PUT /api/v1/auth/change-password)
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
          passwordHash: newPasswordHash,
          // A temporary password set by an Admin has now been replaced.
          mustChangePassword: false,
          passwordChangedAt: new Date()
        },
        {
          transaction
        }
      );

      /*
       * Revoke every other session after changing
       * the password. The current session remains active.
       */
      await endSessions(
        {
          userId: user.userId,

          sessionId: {
            [Op.ne]: req.sessionId
          }
        },
        {
          reason: 'password_changed',
          endedBy: user.userId,
          detail: 'Signed out because the password was changed',
          meta: { ipAddress: req.ip, userAgent: req.get('user-agent') || null },
          transaction
        }
      );
    }
  );

  await logActivity(req, 'user.password_changed', 'User', user.userId, `${user.email} changed their password`);

  // Security notification (never includes the password itself).
  await queueMail(
    {
      to: user.email,
      subject: 'Your High Street password was changed',
      heading: 'Password changed',
      text: [
        `Dear ${user.name},`,
        `The password for your High Street account was changed on ${new Date().toLocaleString('en-LK')}. Other signed-in devices were signed out.`,
        'If you did not make this change, reply to this email immediately so we can secure your account.',
        'High Street (PVT) Ltd.'
      ].join('\n\n')
    },
    {
      messageKey: `user-${user.userId}-password-${Date.now()}`,
      template: 'account-password',
      relatedType: 'User',
      relatedId: user.userId,
      createdBy: user.userId
    }
  );

  return ok(
    res,
    'Password changed successfully'
  );
}