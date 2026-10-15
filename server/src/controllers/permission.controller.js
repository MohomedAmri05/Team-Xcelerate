/*
|--------------------------------------------------------------------------
| VIVA – M.R. Ahamed – Admin Dashboard & Authentication module
| CRUD resource 3: Staff Permissions (table `staff_permissions`)
|--------------------------------------------------------------------------
|   CREATE  createPermissions   POST   /api/v1/users/:id/permissions
|           (also created automatically, with no access, when an Admin
|            creates a Staff account – see domain.controller createUser)
|   READ    getPermissions      GET    /api/v1/users/:id/permissions
|   UPDATE  updatePermissions   PUT    /api/v1/users/:id/permissions
|   DELETE  deletePermissions   DELETE /api/v1/users/:id/permissions
|   READ    listStaffPermissions GET   /api/v1/staff-permissions
|           (every Staff member with their permissions, for the search,
|            filters and matrix view – October 2026)
|   UPDATE  resetPermissions    PATCH  /api/v1/users/:id/permissions/reset
|           ("Reset": every permission back to no access; the record is
|            kept, so Undo can put the previous ticks back)
|
| October 2026: 8 permissions (new: Manage bookings, Export reports).
| "Undo" in the dashboard simply sends the previous values again with
| { undo: true }, which is recorded as permissions.restored in the audit log.
|
| Admin only (routes use `auth` + `adminOnly`). Staff without a permission
| row have no operational access: middleware/core.js requirePermission()
| returns 403 when req.permissions is null.
*/

import { Op } from 'sequelize';

import {
  StaffPermission,
  User
} from '../models/index.js';

import {
  ok
} from '../middleware/core.js';

import { logActivity } from '../services/activity.service.js';
import { dayStatus, isDate } from '../services/availability.service.js';

export const PERMISSION_FIELDS = [
  'canManageInventory',
  'canManageEnquiries',
  'canViewAssignedContacts',
  'canArchiveRecords',
  'canManageComplaints',
  'canViewLimitedAnalytics',
  'canManageBookings',
  'canExportReports'
];

// Only the permission flags that were actually sent (undefined = unchanged).
const sentFlags = (body = {}) =>
  Object.fromEntries(PERMISSION_FIELDS.filter((field) => typeof body[field] === 'boolean').map((field) => [field, body[field]]));

export const NO_ACCESS = Object.fromEntries(
  PERMISSION_FIELDS.map((field) => [field, false])
);

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

const userSummary = (staffUser) => ({
  userId: staffUser.userId,
  name: staffUser.name,
  email: staffUser.email,
  role: staffUser.role
});

const granted = (record) =>
  PERMISSION_FIELDS.filter((field) => record?.[field]).join(', ') || 'no access';

/*
|--------------------------------------------------------------------------
| CREATE – create the permission record for a Staff member
|--------------------------------------------------------------------------
| 201 Created, or 409 if the record already exists (use UPDATE instead).
*/
export async function createPermissions(req, res) {
  const staffUser = await findStaffUser(req.params.id);

  const existing = await StaffPermission.findOne({
    where: { userId: staffUser.userId }
  });

  if (existing) {
    return res.status(409).json({
      success: false,
      message: 'This Staff member already has a permission record. Update it instead.',
      errors: []
    });
  }

  const permissions = await StaffPermission.create({
    userId: staffUser.userId,
    ...NO_ACCESS,
    ...sentFlags(req.validated?.body)
  });

  const undo = Boolean(req.validated?.body?.undo);
  await logActivity(req, undo ? 'permissions.restored' : 'permissions.created', 'User', staffUser.userId, `Permissions ${undo ? 'restored (undo)' : 'created'} for ${staffUser.email}: ${granted(permissions)}`);

  return res.status(201).json({
    success: true,
    message: 'Staff permissions created',
    data: { user: userSummary(staffUser), permissions, exists: true },
    meta: {}
  });
}

/*
|--------------------------------------------------------------------------
| READ – current permissions of a Staff member
|--------------------------------------------------------------------------
| If no record exists yet, "no access" values are returned with
| exists: false (nothing is written to the database by a READ).
*/
export async function getPermissions(req, res) {
  const staffUser = await findStaffUser(
    req.params.id
  );

  const permissions = await StaffPermission.findOne({
    where: {
      userId: staffUser.userId
    }
  });

  return ok(
    res,
    'Staff permissions retrieved',
    {
      user: userSummary(staffUser),
      permissions: permissions || { userId: staffUser.userId, ...NO_ACCESS },
      exists: Boolean(permissions)
    }
  );
}

/*
|--------------------------------------------------------------------------
| UPDATE – change the ticked permissions
|--------------------------------------------------------------------------
| Kept as an "upsert" (creates the record if it is missing) so the
| original dashboard behaviour is unchanged.
*/
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
      ...NO_ACCESS,
      ...sentFlags(req.validated.body)
    }
  });

  if (!created) {
    await permissions.update(
      sentFlags(req.validated.body)
    );
  }

  const undo = Boolean(req.validated.body.undo);
  await logActivity(req, undo ? 'permissions.restored' : 'permissions.updated', 'User', staffUser.userId, `Permissions ${undo ? 'restored (undo)' : 'updated'} for ${staffUser.email}: ${granted(permissions)}`);

  return ok(
    res,
    'Staff permissions updated',
    {
      user: userSummary(staffUser),
      permissions,
      exists: true
    }
  );
}

/*
|--------------------------------------------------------------------------
| DELETE – remove the permission record ("Remove all access")
|--------------------------------------------------------------------------
| The row is deleted from staff_permissions; the Staff account itself is
| kept. From the next request the Staff member has no operational access.
*/
export async function deletePermissions(req, res) {
  const staffUser = await findStaffUser(req.params.id);

  const removed = await StaffPermission.destroy({
    where: { userId: staffUser.userId }
  });

  if (!removed) {
    return res.status(404).json({
      success: false,
      message: 'This Staff member has no permission record to remove',
      errors: []
    });
  }

  await logActivity(req, 'permissions.deleted', 'User', staffUser.userId, `All permissions removed for ${staffUser.email}`);

  return ok(
    res,
    'All permissions removed',
    { user: userSummary(staffUser), permissions: { userId: staffUser.userId, ...NO_ACCESS }, exists: false }
  );
}

/*
|--------------------------------------------------------------------------
| UPDATE – "Reset": clear every permission (back to no access)
|--------------------------------------------------------------------------
| Unlike DELETE ("Remove all access"), the record stays, with every flag
| false. Creates the record (with no access) when it is missing.
*/
export async function resetPermissions(req, res) {
  const staffUser = await findStaffUser(req.params.id);

  const [permissions, created] = await StaffPermission.findOrCreate({
    where: { userId: staffUser.userId },
    defaults: { userId: staffUser.userId, ...NO_ACCESS }
  });

  const before = created ? 'no record' : granted(permissions);

  if (!created) {
    await permissions.update(NO_ACCESS);
  }

  await logActivity(req, 'permissions.reset', 'User', staffUser.userId, `Permissions reset to no access for ${staffUser.email} (was: ${before})`);

  return ok(res, 'Permissions reset to no access', { user: userSummary(staffUser), permissions, exists: true });
}

// Account state shown beside the name on each card (same words as Users).
const accountState = (user) => {
  if (!user.isActive) return 'Inactive';
  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) return 'Locked';
  if (user.mustChangePassword) return 'Password change needed';
  return 'Active';
};

/*
|--------------------------------------------------------------------------
| READ – every Staff member with their permissions (one request)
|--------------------------------------------------------------------------
| ?search= name or email · ?status=active|inactive|missing|locked|
|          password|leave  (leave = on leave on ?date, default today)
| ?has=<permission> only Staff who have that permission
| ?date=YYYY-MM-DD the day used for "today's availability"
| meta.counts gives the numbers for the filter chips.
*/
export async function listStaffPermissions(req, res) {
  const where = { role: 'Staff' };

  if (req.query.search) {
    const term = `%${String(req.query.search).trim().slice(0, 100).replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
    where[Op.or] = [{ name: { [Op.like]: term } }, { email: { [Op.like]: term } }];
  }

  const staff = await User.findAll({
    where,
    include: [{ model: StaffPermission, as: 'permissions', required: false }],
    order: [['name', 'ASC']]
  });

  const date = isDate(req.query.date) ? req.query.date : new Date().toISOString().slice(0, 10);
  const today = await dayStatus(date, staff.map((user) => user.userId));

  let rows = staff.map((user) => {
    const record = user.permissions;
    const permissions = Object.fromEntries(PERMISSION_FIELDS.map((field) => [field, Boolean(record?.[field])]));

    return {
      user: {
        ...userSummary(user),
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt,
        accountState: accountState(user),
        isLocked: accountState(user) === 'Locked',
        mustChangePassword: Boolean(user.mustChangePassword)
      },
      availability: today[user.userId],
      permissions,
      exists: Boolean(record),
      grantedCount: PERMISSION_FIELDS.filter((field) => permissions[field]).length,
      updatedAt: record?.updatedAt || null
    };
  });

  const counts = {
    __all: rows.length,
    Active: rows.filter((row) => row.user.isActive).length,
    Inactive: rows.filter((row) => !row.user.isActive).length,
    Locked: rows.filter((row) => row.user.isLocked).length,
    'Password change needed': rows.filter((row) => row.user.accountState === 'Password change needed').length,
    'On leave': rows.filter((row) => row.availability?.onLeave).length,
    'No record yet': rows.filter((row) => !row.exists).length
  };

  if (req.query.status === 'active') rows = rows.filter((row) => row.user.isActive);
  if (req.query.status === 'inactive') rows = rows.filter((row) => !row.user.isActive);
  if (req.query.status === 'missing') rows = rows.filter((row) => !row.exists);
  if (req.query.status === 'locked') rows = rows.filter((row) => row.user.isLocked);
  if (req.query.status === 'password') rows = rows.filter((row) => row.user.accountState === 'Password change needed');
  if (req.query.status === 'leave') rows = rows.filter((row) => row.availability?.onLeave);

  if (PERMISSION_FIELDS.includes(req.query.has)) {
    rows = rows.filter((row) => row.permissions[req.query.has]);
  }

  return ok(res, 'Staff permissions retrieved', rows, { counts, fields: PERMISSION_FIELDS, date });
}
