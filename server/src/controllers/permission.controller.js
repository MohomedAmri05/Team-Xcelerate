import {
  StaffPermission,
  User
} from '../models/index.js';

import {
  ok
} from '../middleware/core.js';

const findStaffUser = async (userId) => {
  const user = await User.findByPk(userId);

  if (!user) {
    throw Object.assign(
      new Error('User not found'),
      {
        status: 404
      }
    );
  }

  if (user.role !== 'Staff') {
    throw Object.assign(
      new Error(
        'Permissions can only be assigned to Staff accounts'
      ),
      {
        status: 422
      }
    );
  }

  return user;
};

export async function getPermissions(req, res) {
  const staffUser = await findStaffUser(
    req.params.id
  );

  const [permissions] =
    await StaffPermission.findOrCreate({
      where: {
        userId: staffUser.userId
      },

      defaults: {
        userId: staffUser.userId,
        canManageInventory: false,
        canManageEnquiries: false,
        canViewAssignedContacts: false,
        canArchiveRecords: false,
        canViewLimitedAnalytics: false
      }
    });

  return ok(
    res,
    'Staff permissions retrieved',
    {
      user: {
        userId: staffUser.userId,
        name: staffUser.name,
        email: staffUser.email,
        role: staffUser.role
      },

      permissions
    }
  );
}

export async function updatePermissions(req, res) {
  const staffUser = await findStaffUser(
    req.params.id
  );

  const [
    permissions,
    created
  ] = await StaffPermission.findOrCreate({
    where: {
      userId: staffUser.userId
    },

    defaults: {
      userId: staffUser.userId,
      ...req.validated.body
    }
  });

  if (!created) {
    await permissions.update(
      req.validated.body
    );
  }

  return ok(
    res,
    'Staff permissions updated',
    {
      user: {
        userId: staffUser.userId,
        name: staffUser.name,
        email: staffUser.email,
        role: staffUser.role
      },

      permissions
    }
  );
}