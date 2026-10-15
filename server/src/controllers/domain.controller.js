/*
|--------------------------------------------------------------------------
| VIVA-HEADER – M.R. Ahamed (Users, Sessions) and S.N. Herathge (Company Content, Financing Configurations)
| Several CRUD resources – see the label above each function
|--------------------------------------------------------------------------
|   CREATE  contents             POST/PUT/DELETE /api/v1/content(/:id)
|   READ    finances             GET /api/v1/financing-config
|   READ    listContent          GET /api/v1/content
|   CREATE  createFinance        POST /api/v1/financing-config
|   UPDATE  activateFinance      PUT /api/v1/financing-config/:id
|   DELETE  deleteFinance        DELETE /api/v1/financing-config/:id
|   READ    listUsers            GET /api/v1/users
|   READ    getUser              GET /api/v1/users/:id
|   CREATE  createUser           POST /api/v1/users
|   UPDATE  updateUser           PUT /api/v1/users/:id
|   UPDATE  userStatus           PATCH /api/v1/users/:id/status
|   DELETE  deleteUser           DELETE /api/v1/users/:id
|   READ    listSessions         GET /api/v1/sessions
|   DELETE  revokeSession        DELETE /api/v1/sessions/:id
|   DELETE  revokeAll            DELETE /api/v1/sessions
|
| October 2026 additions
|   READ    listFinance          GET /api/v1/financing-config (with the plan's vehicle)
|   READ    userOverview         GET /api/v1/users/:id/overview (detail panel)
|   UPDATE  unlockUser           PATCH /api/v1/users/:id/unlock
|   UPDATE  bulkUsers            POST /api/v1/users/bulk (activate / deactivate)
|   READ    sessionActivity      GET /api/v1/sessions/:id/activity ("Check activity")
|   READ    loginHistory         GET /api/v1/sessions/login-history (incl. failed logins)
|   DELETE  deleteStaffPermanently DELETE /api/v1/users/:id/permanent (Staff only)
|   DELETE  bulkDeleteStaff      POST /api/v1/users/bulk-delete (Staff only)
|   Admins can no longer set or see another user's password: passwords are
|   changed only by the owner (Profile, or "Forgot password?").
| Every write goes through Sequelize to MySQL/MariaDB and is recorded in
| activity_logs (services/activity.service.js) where it changes data.
*/

import bcrypt from 'bcrypt';

import {
  sequelize,
  User,
  Session,
  Content,
  Finance,
  StaffPermission,
  Vehicle,
  VehicleImage,
  SessionEvent,
  ActivityLog,
  TestDriveBooking,
  Enquiry,
  Complaint
} from '../models/index.js';

import {
  endSessions,
  recordSessionEvent
} from '../services/auth.service.js';

import { planSummary } from '../services/finance.service.js';
import { describeDevice } from '../utils/device.js';

import {
  ok
} from '../middleware/core.js';

import {
  crud
} from '../services/resource.service.js';

import {
  Op
} from 'sequelize';

import {
  logActivity
} from '../services/activity.service.js';

import { NO_ACCESS } from './permission.controller.js';

function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, (character) => `\\${character}`);
}

/*
|--------------------------------------------------------------------------
| Generic Content and Finance CRUD Helpers
|--------------------------------------------------------------------------
*/

const basic = (
  model,
  label,
  entityType = label,
  idField = null
) => {
  const resource =
    crud(model);

  return {
    list: async (req, res) => {
      return ok(
        res,
        `${label} retrieved`,
        await resource.list(
          req.query
        )
      );
    },

    one: async (req, res) => {
      const record =
        await resource.one(
          req.params.id
        );

      if (!record) {
        return res.status(404).json({
          success: false,
          message:
            `${label} not found`,
          errors: []
        });
      }

      return ok(
        res,
        `${label} retrieved`,
        record
      );
    },

    create: async (req, res) => {
      const record =
        await resource.create(
          req.validated?.body ||
          req.body
        );

      await logActivity(
        req,
        `${entityType.toLowerCase()}.created`,
        entityType,
        idField && record ? record[idField] : Number(req.params.id) || null,
        `${label} created: ${record?.title || record?.name || record?.sectionSlug || ''}`
      );

      return res.status(201).json({
        success: true,
        message:
          `${label} created`,
        data: record,
        meta: {}
      });
    },

    update: async (req, res) => {
      const record =
        await resource.update(
          req.params.id,

          req.validated?.body ||
          req.body
        );

      if (!record) {
        return res.status(404).json({
          success: false,
          message:
            `${label} not found`,
          errors: []
        });
      }

      await logActivity(
        req,
        `${entityType.toLowerCase()}.updated`,
        entityType,
        idField && record ? record[idField] : Number(req.params.id) || null,
        `${label} updated: ${record?.title || record?.name || record?.sectionSlug || ''}`
      );

      return ok(
        res,
        `${label} updated`,
        record
      );
    },

    remove: async (req, res) => {
      const record =
        await resource.one(
          req.params.id
        );

      if (!record) {
        return res.status(404).json({
          success: false,
          message:
            `${label} not found`,
          errors: []
        });
      }

      await resource.remove(
        req.params.id
      );

      await logActivity(
        req,
        `${entityType.toLowerCase()}.deleted`,
        entityType,
        idField && record ? record[idField] : Number(req.params.id) || null,
        `${label} deleted: ${record?.title || record?.name || record?.sectionSlug || ''}`
      );

      return ok(
        res,
        `${label} deleted`
      );
    }
  };
};

// VIVA CRUD CREATE – Herathge – Company Content create / update / delete (generic CRUD helper) (POST/PUT/DELETE /api/v1/content(/:id))
export const contents =
  basic(
    Content,
    'Content',
    'Content',
    'contentId'
  );

// VIVA CRUD READ – Herathge – Financing Configurations list (generic CRUD helper) (GET /api/v1/financing-config)
export const finances =
  basic(
    Finance,
    'Finance configuration',
    'Finance',
    'configId'
  );

/*
|--------------------------------------------------------------------------
| Company Content
|--------------------------------------------------------------------------
*/

// VIVA CRUD READ – Herathge – Company Content list (drafts only for Admin) (GET /api/v1/content)
export async function listContent(
  req,
  res
) {
  // Draft content is visible to Admins only.
  const where =
    req.user?.role === 'Admin'
      ? {}
      : {
          isPublished: true
        };

  const content =
    await Content.findAll({
      where,

      order: [
        ['displayOrder', 'ASC']
      ]
    });

  return ok(
    res,
    'Content retrieved',
    content
  );
}

/*
|--------------------------------------------------------------------------
| Financing Configurations
|--------------------------------------------------------------------------
*/

/*
| VIVA – Herathge – a plan is for ONE vehicle (vehicleId) or is the general
| plan (vehicleId = null). Only Available vehicles can be chosen for a new
| plan; a plan may keep a vehicle that has since been sold.
*/
const vehicleLabel = (vehicle) => `${vehicle.year} ${vehicle.make} ${vehicle.model}`;

async function resolvePlanVehicle(vehicleId, currentVehicleId = null) {
  if (vehicleId === null || vehicleId === undefined) {
    return null;
  }

  const vehicle = await Vehicle.findByPk(vehicleId);

  if (!vehicle) {
    throw Object.assign(new Error('Choose a vehicle that is currently in the store'), { status: 422 });
  }

  if (vehicle.status !== 'Available' && Number(currentVehicleId) !== vehicle.vehicleId) {
    throw Object.assign(
      new Error(`${vehicleLabel(vehicle)} is ${vehicle.status.toLowerCase()}. Only Available vehicles can get a new financing plan.`),
      { status: 422 }
    );
  }

  return vehicle;
}

const planIncludes = [
  {
    model: Vehicle,
    as: 'vehicle',
    required: false,
    paranoid: false,
    attributes: ['vehicleId', 'make', 'model', 'year', 'price', 'status'],
    include: [{ model: VehicleImage, as: 'images', required: false, attributes: ['imageId', 'url', 'isPrimary', 'altText', 'sortOrder'] }]
  }
];

function presentPlan(plan) {
  const data = plan.get({ plain: true });
  data.scope = data.vehicleId ? 'vehicle' : 'general';
  data.example = data.vehicle ? planSummary(plan, data.vehicle.price) : null;
  return data;
}

async function loadPlan(configId) {
  return Finance.findByPk(configId, { include: planIncludes });
}

// VIVA CRUD READ – Herathge – Financing Configurations list, with each plan's vehicle (GET /api/v1/financing-config)
export async function listFinance(req, res) {
  const plans = await Finance.findAll({
    include: planIncludes,
    order: [['createdAt', 'DESC']]
  });

  const rows = plans.map(presentPlan);

  return ok(res, 'Finance configuration retrieved', { count: rows.length, rows });
}

// VIVA CRUD CREATE – Herathge – Financing Configurations create, optionally for one chosen vehicle (POST /api/v1/financing-config)
export async function createFinance(
  req,
  res
) {
  const data =
    { ...req.validated.body, vehicleId: req.validated.body.vehicleId ?? null };

  const vehicle = await resolvePlanVehicle(data.vehicleId);

  const finance =
    await sequelize.transaction(
      async (transaction) => {
        if (data.isActive) {
          // One active plan per vehicle, and one active general plan.
          await Finance.update(
            {
              isActive: false
            },
            {
              where: { vehicleId: data.vehicleId },
              transaction
            }
          );
        }

        return Finance.create(
          data,
          {
            transaction
          }
        );
      }
    );

  await logActivity(req, 'finance.created', 'Finance', finance.configId, `Financing plan "${finance.name}" created${vehicle ? ` for ${vehicleLabel(vehicle)}` : ' (general plan)'}`);

  return res.status(201).json({
    success: true,

    message:
      vehicle
        ? `Finance configuration created for ${vehicleLabel(vehicle)}`
        : 'Finance configuration created',

    data: presentPlan(await loadPlan(finance.configId)),
    meta: {}
  });
}

// VIVA CRUD UPDATE – Herathge – Financing Configurations update / change vehicle / make active (PUT /api/v1/financing-config/:id)
export async function activateFinance(
  req,
  res
) {
  const configuration =
    await Finance.findByPk(
      req.params.id
    );

  if (!configuration) {
    return res.status(404).json({
      success: false,

      message:
        'Financing configuration not found',

      errors: []
    });
  }

  const data =
    { ...req.validated.body };

  // Older clients do not send vehicleId: keep the plan's current vehicle.
  if (!('vehicleId' in data) || data.vehicleId === undefined) {
    data.vehicleId = configuration.vehicleId;
  }

  const vehicle = await resolvePlanVehicle(data.vehicleId, configuration.vehicleId);

  const result =
    await sequelize.transaction(
      async (transaction) => {
        if (data.isActive) {
          await Finance.update(
            {
              isActive: false
            },
            {
              where: {
                vehicleId: data.vehicleId,
                configId: { [Op.ne]: configuration.configId }
              },
              transaction
            }
          );
        }

        await configuration.update(
          data,
          {
            transaction
          }
        );

        return configuration;
      }
    );

  await logActivity(req, 'finance.updated', 'Finance', result.configId, `Financing plan "${result.name}" updated${vehicle ? ` for ${vehicleLabel(vehicle)}` : ' (general plan)'}${result.isActive ? ' (active)' : ''}`);

  return ok(
    res,
    'Finance configuration updated',
    presentPlan(await loadPlan(result.configId))
  );
}

// VIVA CRUD DELETE – Herathge – Financing Configurations delete (not the active one) (DELETE /api/v1/financing-config/:id)
export async function deleteFinance(
  req,
  res
) {
  const configuration =
    await Finance.findByPk(
      req.params.id
    );

  if (!configuration) {
    return res.status(404).json({
      success: false,

      message:
        'Financing configuration not found',

      errors: []
    });
  }

  if (configuration.isActive) {
    return res.status(409).json({
      success: false,

      message:
        'The active financing configuration cannot be deleted. Activate another configuration first.',

      errors: []
    });
  }

  await configuration.destroy();

  await logActivity(req, 'finance.deleted', 'Finance', configuration.configId, `Financing plan "${configuration.name}" deleted`);

  return ok(
    res,
    'Financing configuration deleted'
  );
}

/*
|--------------------------------------------------------------------------
| User Management
|--------------------------------------------------------------------------
*/

// VIVA CRUD READ – Ahamed – Users list: role / status filters, search, sort, optional pages (GET /api/v1/users)
export async function listUsers(
  req,
  res
) {
  const where = {};
  const now = new Date();

  if (['Admin', 'Staff', 'Customer'].includes(req.query.role)) {
    where.role = req.query.role;
  }

  if (req.query.isActive === 'true' || req.query.isActive === 'false') {
    where.isActive = req.query.isActive === 'true';
  }

  // status=active|inactive|locked (the filter chips)
  if (req.query.status === 'active') where.isActive = true;
  if (req.query.status === 'inactive') where.isActive = false;
  if (req.query.status === 'locked') where.lockedUntil = { [Op.gt]: now };

  if (req.query.search) {
    const raw = String(req.query.search).trim().slice(0, 100);
    const term = `%${escapeLike(raw)}%`;

    where[Op.or] = [
      { name: { [Op.like]: term } },
      { email: { [Op.like]: term } },
      { phone: { [Op.like]: term } },
      ...(/^\d+$/.test(raw) ? [{ userId: Number(raw) }] : [])
    ];
  }

  const orders = {
    newest: [['createdAt', 'DESC']],
    oldest: [['createdAt', 'ASC']],
    name: [['name', 'ASC']],
    lastLogin: [['lastLoginAt', 'DESC']]
  };

  const paged = req.query.page !== undefined;
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const page = Math.max(Number(req.query.page) || 1, 1);

  const { rows, count } = await User.findAndCountAll({
    where,
    order: orders[req.query.sort] || orders.newest,
    ...(paged ? { limit, offset: (page - 1) * limit } : {})
  });

  // Active sessions per user (one grouped query).
  const sessionCounts = rows.length
    ? await Session.findAll({
        attributes: ['userId', [sequelize.fn('COUNT', sequelize.col('session_id')), 'total']],
        where: { userId: { [Op.in]: rows.map((user) => user.userId) }, revokedAt: null, expiresAt: { [Op.gt]: now } },
        group: ['userId'],
        raw: true
      })
    : [];
  const activeSessions = Object.fromEntries(sessionCounts.map((row) => [row.userId, Number(row.total)]));

  const users = rows.map((user) => ({
    ...user.toJSON(),
    isLocked: Boolean(user.lockedUntil && new Date(user.lockedUntil) > now),
    activeSessions: activeSessions[user.userId] || 0
  }));

  // Numbers for the filter chips (whole table, not only this page).
  const [byRole, byStatus, locked] = await Promise.all([
    User.findAll({ attributes: ['role', [sequelize.fn('COUNT', sequelize.col('user_id')), 'total']], group: ['role'], raw: true }),
    User.findAll({ attributes: ['isActive', [sequelize.fn('COUNT', sequelize.col('user_id')), 'total']], group: ['isActive'], raw: true }),
    User.count({ where: { lockedUntil: { [Op.gt]: now } } })
  ]);

  const counts = { __all: byRole.reduce((sum, row) => sum + Number(row.total), 0), Locked: locked, Active: 0, Inactive: 0 };
  byRole.forEach((row) => { counts[row.role] = Number(row.total); });
  byStatus.forEach((row) => { counts[row.isActive ? 'Active' : 'Inactive'] = Number(row.total); });

  return ok(
    res,
    'Users retrieved',
    users,
    {
      counts,
      total: count,
      ...(paged ? { page, limit, pages: Math.max(Math.ceil(count / limit), 1) } : {})
    }
  );
}

// VIVA CRUD READ – Ahamed – user detail panel: profile, sessions, permissions, recent activity (GET /api/v1/users/:id/overview)
export async function userOverview(req, res) {
  const user = await User.findByPk(req.params.id, {
    include: [{ model: StaffPermission, as: 'permissions', required: false }]
  });

  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found', errors: [] });
  }

  const now = new Date();
  const [sessions, activeSessions, activity, failedLogins] = await Promise.all([
    Session.findAll({
      where: { userId: user.userId },
      attributes: { exclude: ['refreshTokenHash'] },
      order: [['createdAt', 'DESC']],
      limit: 8
    }),
    Session.count({ where: { userId: user.userId, revokedAt: null, expiresAt: { [Op.gt]: now } } }),
    ActivityLog.findAll({
      where: { [Op.or]: [{ actorId: user.userId }, { entityType: 'User', entityId: user.userId }] },
      include: [{ model: User, as: 'actor', attributes: ['userId', 'name', 'role'] }],
      order: [['createdAt', 'DESC']],
      limit: 15
    }),
    SessionEvent.count({ where: { userId: user.userId, eventType: 'login_failed', createdAt: { [Op.gte]: new Date(now - 30 * 24 * 3600 * 1000) } } })
  ]);

  const data = user.toJSON();
  data.isLocked = Boolean(user.lockedUntil && new Date(user.lockedUntil) > now);
  data.activeSessions = activeSessions;
  data.failedLogins30Days = failedLogins;
  data.sessions = sessions.map((session) => presentSession(session, req));
  data.activity = activity;

  return ok(res, 'User overview retrieved', data);
}

// VIVA CRUD READ – Ahamed – Users one account (GET /api/v1/users/:id)
export async function getUser(
  req,
  res
) {
  const user =
    await User.findByPk(
      req.params.id
    );

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
      errors: []
    });
  }

  return ok(
    res,
    'User retrieved',
    user
  );
}

// VIVA CRUD CREATE – Ahamed – Users create Staff (bcrypt hash) + permission record (POST /api/v1/users)
export async function createUser(
  req,
  res
) {
  const body =
    req.validated.body;

  if (!body.password) {
    return res.status(422).json({
      success: false,
      message:
        'Password is required',
      errors: []
    });
  }

  const passwordHash =
    await bcrypt.hash(
      body.password,
      12
    );

  const user =
    await User.create({
      name: body.name.trim(),

      email:
        body.email
          .trim()
          .toLowerCase(),

      role: body.role,

      isActive:
        body.isActive ?? true,

      phone: body.phone || null,

      passwordHash,

      /*
       * VIVA – Ahamed – the password typed by the Admin is temporary: the
       * new user must replace it at the first sign-in, so after that only
       * the user knows their password.
       */
      mustChangePassword: true
    });

  const safeUser =
    user.toJSON();

  delete safeUser.passwordHash;

  /*
   * VIVA – Ahamed – Staff Permissions: CREATE.
   * Every new Staff account gets its permission record straight away,
   * with no access ticked. The Admin then grants access in the
   * Permissions tab (UPDATE).
   */
  if (user.role === 'Staff') {
    await StaffPermission.findOrCreate({
      where: { userId: user.userId },
      defaults: { userId: user.userId, ...NO_ACCESS }
    });
  }

  await logActivity(req, 'user.created', 'User', user.userId, `${user.role} account created for ${user.email}`);

  return res.status(201).json({
    success: true,
    message: 'User created',
    data: safeUser,
    meta: {}
  });
}

// VIVA CRUD UPDATE – Ahamed – Users edit / reset password (last Admin protected) (PUT /api/v1/users/:id)
export async function updateUser(
  req,
  res
) {
  const user =
    await User.unscoped().findByPk(
      req.params.id
    );

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
      errors: []
    });
  }

  /*
   * VIVA – Ahamed – Admins cannot set or change another user's password.
   * Passwords are changed only by the account owner (Profile › Change
   * password, or "Forgot password?" on the login page).
   */
  if (req.body?.password) {
    return res.status(422).json({
      success: false,
      message:
        'Passwords can only be changed by the account owner (Profile › Change password, or "Forgot password?" on the login page).',
      errors: [{ field: 'password', message: 'Admins cannot change another user’s password' }]
    });
  }

  const body = {
    ...req.validated.body
  };

  delete body.password;

  const removesActiveAdmin =
    user.role === 'Admin' &&
    user.isActive &&
    (
      body.role !== 'Admin' ||
      body.isActive === false
    );

  if (removesActiveAdmin) {
    const activeAdminCount =
      await User.count({
        where: {
          role: 'Admin',
          isActive: true
        }
      });

    if (activeAdminCount <= 1) {
      return res.status(409).json({
        success: false,

        message:
          'The final active Admin cannot be deactivated or changed to another role',

        errors: []
      });
    }
  }

  await user.update(body);

  if (!user.isActive) {
    await endSessions(
      { userId: user.userId },
      { reason: 'deactivated', endedBy: req.user.userId, detail: 'Account deactivated by an Admin', meta: { ipAddress: req.ip } }
    );
  }

  const safeUser =
    user.toJSON();

  delete safeUser.passwordHash;

  await logActivity(req, 'user.updated', 'User', user.userId, `Account ${user.email} updated (${user.role}, ${user.isActive ? 'active' : 'inactive'})`);

  return ok(
    res,
    'User updated',
    safeUser
  );
}

// VIVA CRUD UPDATE – Ahamed – Users activate / deactivate, revokes sessions (PATCH /api/v1/users/:id/status)
export async function userStatus(
  req,
  res
) {
  const user =
    await User.findByPk(
      req.params.id
    );

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
      errors: []
    });
  }

  if (
    typeof req.body?.isActive !==
    'boolean'
  ) {
    return res.status(422).json({
      success: false,

      message:
        'isActive must be true or false',

      errors: []
    });
  }

  if (
    user.role === 'Admin' &&
    user.isActive &&
    req.body.isActive === false
  ) {
    const activeAdminCount =
      await User.count({
        where: {
          role: 'Admin',
          isActive: true
        }
      });

    if (activeAdminCount <= 1) {
      return res.status(409).json({
        success: false,

        message:
          'The final active Admin cannot be deactivated',

        errors: []
      });
    }
  }

  if (
    req.body.isActive === false &&
    user.userId === req.user.userId
  ) {
    return res.status(409).json({
      success: false,
      message: 'You cannot deactivate your own account',
      errors: []
    });
  }

  await user.update({
    isActive:
      req.body.isActive
  });

  if (!user.isActive) {
    await endSessions(
      { userId: user.userId },
      { reason: 'deactivated', endedBy: req.user.userId, detail: 'Account deactivated by an Admin', meta: { ipAddress: req.ip } }
    );
  }

  await logActivity(req, user.isActive ? 'user.activated' : 'user.deactivated', 'User', user.userId, `Account ${user.email} ${user.isActive ? 'activated' : 'deactivated'}`);

  return ok(
    res,
    user.isActive
      ? 'User activated'
      : 'User deactivated',
    user
  );
}

// VIVA CRUD DELETE – Ahamed – Users soft delete = deactivate (DELETE /api/v1/users/:id)
export async function deleteUser(
  req,
  res
) {
  // Express 5 leaves req.body undefined when a DELETE has no body.
  req.body = { ...(req.body || {}), isActive: false };

  return userStatus(
    req,
    res
  );
}

/*
|--------------------------------------------------------------------------
| VIVA – Ahamed – permanently delete Staff accounts ("Delete staff")
|--------------------------------------------------------------------------
| Only Staff accounts can be deleted this way (Admins and Customers keep
| the "Deactivate" rule). The database decides what happens to the rest:
|   removed with the account   sessions, permissions, saved reports,
|                              leave days, reset links
|   kept, now without a name   enquiry responses, uploaded documents,
|                              complaint replies, vehicles they added,
|                              activity log, templates  ("Deleted staff member")
|   unassigned                 test drives, enquiries and complaints that
|                              were assigned to them (the Admin reassigns)
| The audit log keeps the name and email of the deleted account.
*/
async function deleteOneStaff(req, userId, transaction) {
  const user = await User.findByPk(userId, { transaction });

  if (!user) {
    return { userId, deleted: false, status: 404, reason: 'not found' };
  }

  if (user.role !== 'Staff') {
    return { userId, deleted: false, status: 422, reason: 'only Staff accounts can be permanently deleted' };
  }

  // A Staff account never books or complains as a customer; if old data says
  // otherwise, keep the account instead of losing customer history.
  const [customerBookings, customerComplaints] = await Promise.all([
    TestDriveBooking.count({ where: { customerId: user.userId }, transaction }),
    Complaint.count({ where: { customerId: user.userId }, transaction })
  ]);

  if (customerBookings || customerComplaints) {
    return { userId, deleted: false, status: 409, reason: 'this account has customer bookings or complaints' };
  }

  const [unassignedBookings, unassignedEnquiries, unassignedComplaints] = await Promise.all([
    TestDriveBooking.count({ where: { assignedTo: user.userId, status: { [Op.in]: ['Pending', 'Confirmed'] } }, transaction }),
    Enquiry.count({ where: { assignedTo: user.userId }, transaction }),
    Complaint.count({ where: { assignedTo: user.userId }, transaction })
  ]);

  const { name, email } = user;

  await user.destroy({ transaction });

  await logActivity(
    req,
    'user.deleted_permanently',
    'User',
    userId,
    `Staff account ${name} <${email}> permanently deleted` +
      (unassignedBookings || unassignedEnquiries || unassignedComplaints
        ? ` (now unassigned: ${unassignedBookings} active test drive(s), ${unassignedEnquiries} enquiry(ies), ${unassignedComplaints} complaint(s))`
        : '')
  );

  return { userId, deleted: true, name, email, unassigned: { bookings: unassignedBookings, enquiries: unassignedEnquiries, complaints: unassignedComplaints } };
}

// VIVA CRUD DELETE – Ahamed – permanently delete one Staff account (DELETE /api/v1/users/:id/permanent)
export async function deleteStaffPermanently(req, res) {
  const userId = Number(req.params.id);

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(404).json({ success: false, message: 'User not found', errors: [] });
  }

  const result = await sequelize.transaction((transaction) => deleteOneStaff(req, userId, transaction));

  if (!result.deleted) {
    return res.status(result.status).json({ success: false, message: `This account cannot be deleted: ${result.reason}`, errors: [] });
  }

  return ok(res, `${result.name} was permanently deleted`, result);
}

// VIVA CRUD DELETE – Ahamed – permanently delete several Staff accounts (POST /api/v1/users/bulk-delete)
export async function bulkDeleteStaff(req, res) {
  const deleted = [];
  const skipped = [];

  for (const userId of req.validated.body.userIds) {
    const result = await sequelize.transaction((transaction) => deleteOneStaff(req, userId, transaction));
    (result.deleted ? deleted : skipped).push(result);
  }

  return ok(res, `${deleted.length} Staff account${deleted.length === 1 ? '' : 's'} permanently deleted`, { deleted, skipped });
}

// VIVA CRUD UPDATE – Ahamed – unlock an account locked after repeated wrong passwords (PATCH /api/v1/users/:id/unlock)
export async function unlockUser(req, res) {
  const user = await User.findByPk(req.params.id);

  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found', errors: [] });
  }

  await user.update({ failedLoginCount: 0, lockedUntil: null });
  await recordSessionEvent('unlocked', { userId: user.userId, actorId: req.user.userId, email: user.email, detail: `Unlocked by ${req.user.name}`, ipAddress: req.ip });
  await logActivity(req, 'user.unlocked', 'User', user.userId, `Account ${user.email} unlocked`);

  return ok(res, 'Account unlocked', user);
}

// VIVA CRUD UPDATE – Ahamed – bulk activate / deactivate (POST /api/v1/users/bulk)
export async function bulkUsers(req, res) {
  const { action, userIds } = req.validated.body;
  const activate = action === 'activate';
  const updated = [];
  const skipped = [];

  const users = await User.findAll({ where: { userId: { [Op.in]: userIds } } });

  for (const user of users) {
    if (user.isActive === activate) {
      skipped.push({ userId: user.userId, reason: `already ${activate ? 'active' : 'inactive'}` });
      continue;
    }

    if (!activate && user.userId === req.user.userId) {
      skipped.push({ userId: user.userId, reason: 'you cannot deactivate your own account' });
      continue;
    }

    if (!activate && user.role === 'Admin') {
      const activeAdmins = await User.count({ where: { role: 'Admin', isActive: true } });

      if (activeAdmins <= 1) {
        skipped.push({ userId: user.userId, reason: 'the final active Admin cannot be deactivated' });
        continue;
      }
    }

    await user.update({ isActive: activate });

    if (!activate) {
      await endSessions(
        { userId: user.userId },
        { reason: 'deactivated', endedBy: req.user.userId, detail: 'Account deactivated by an Admin (bulk)', meta: { ipAddress: req.ip } }
      );
    }

    await logActivity(req, activate ? 'user.activated' : 'user.deactivated', 'User', user.userId, `Account ${user.email} ${activate ? 'activated' : 'deactivated'} (bulk action)`);
    updated.push(user.userId);
  }

  userIds.filter((id) => !users.some((user) => user.userId === id)).forEach((userId) => skipped.push({ userId, reason: 'not found' }));

  return ok(res, `${updated.length} account${updated.length === 1 ? '' : 's'} ${activate ? 'activated' : 'deactivated'}`, { updated, skipped });
}

/*
|--------------------------------------------------------------------------
| Session Management
|--------------------------------------------------------------------------
*/

/*
| VIVA – Ahamed – how a session is shown in the dashboard
|   status: Active | Expired | Logged out | Revoked | Ended
*/
const ENDED_LABELS = {
  logout: 'Logged out',
  revoked: 'Revoked',
  signed_out_others: 'Signed out from another device',
  password_changed: 'Ended by a password change',
  password_reset: 'Ended by a password reset',
  deactivated: 'Ended: account deactivated'
};

function sessionStatus(session, now = new Date()) {
  if (session.revokedAt) {
    return session.endedReason === 'logout' ? 'Logged out' : session.endedReason ? 'Revoked' : 'Revoked';
  }

  return new Date(session.expiresAt) <= now ? 'Expired' : 'Active';
}

function presentSession(session, req) {
  const data = session.toJSON ? session.toJSON() : { ...session };
  delete data.refreshTokenHash;
  const now = new Date();
  const device = describeDevice(data.userAgent);
  const end = data.revokedAt ? new Date(data.revokedAt) : new Date(Math.min(now.getTime(), new Date(data.expiresAt).getTime()));
  const lastActivity = data.lastSeenAt ? new Date(data.lastSeenAt) : null;

  return {
    ...data,
    isCurrent: data.sessionId === req.sessionId,
    status: sessionStatus(data, now),
    endedLabel: data.revokedAt ? ENDED_LABELS[data.endedReason] || 'Revoked' : null,
    device: { label: data.deviceLabel || device.label, type: device.type, browser: device.browser, os: device.os },
    // How long the session was used: from login to its end (or to the last
    // request for sessions that simply expired).
    durationMs: Math.max(
      (data.revokedAt ? end : lastActivity && lastActivity < end ? lastActivity : end).getTime() - new Date(data.createdAt).getTime(),
      0
    )
  };
}

const SESSION_STATUSES = ['active', 'expired', 'revoked', 'logged_out', 'ended', 'all'];

function sessionStatusWhere(status, now) {
  switch (status) {
    case 'active':
      return { revokedAt: null, expiresAt: { [Op.gt]: now } };
    case 'expired':
      return { revokedAt: null, expiresAt: { [Op.lte]: now } };
    case 'logged_out':
      return { revokedAt: { [Op.ne]: null }, endedReason: 'logout' };
    case 'revoked':
      return { revokedAt: { [Op.ne]: null }, [Op.or]: [{ endedReason: null }, { endedReason: { [Op.ne]: 'logout' } }] };
    case 'ended':
      return { [Op.or]: [{ revokedAt: { [Op.ne]: null } }, { expiresAt: { [Op.lte]: now } }] };
    default:
      return {};
  }
}

// VIVA CRUD READ – Ahamed – Sessions list: scope, status, search, dates, role, device, sort, pages (GET /api/v1/sessions)
export async function listSessions(
  req,
  res
) {
  const allUsers =
    req.user.role === 'Admin' &&
    req.query.scope === 'all';

  const now = new Date();
  const status = SESSION_STATUSES.includes(req.query.status) ? req.query.status : null;

  // Without ?status the original behaviour is kept: active sessions only.
  const where = status
    ? sessionStatusWhere(status, now)
    : {
        revokedAt: null,
        ...(req.query.activeOnly !== 'false' ? { expiresAt: { [Op.gt]: now } } : {})
      };

  const and = [];

  if (!allUsers) {
    where.userId = req.user.userId;
  }

  if (req.query.from) {
    and.push({ createdAt: { [Op.gte]: new Date(`${req.query.from}T00:00:00`) } });
  }

  if (req.query.to) {
    and.push({ createdAt: { [Op.lte]: new Date(`${req.query.to}T23:59:59`) } });
  }

  const userWhere = {};

  if (allUsers && ['Admin', 'Staff', 'Customer'].includes(req.query.role)) {
    userWhere.role = req.query.role;
  }

  if (req.query.search) {
    const term = `%${escapeLike(String(req.query.search).trim().slice(0, 100))}%`;
    and.push({
      [Op.or]: [
        { ipAddress: { [Op.like]: term } },
        { deviceLabel: { [Op.like]: term } },
        { userAgent: { [Op.like]: term } },
        ...(allUsers ? [{ '$user.name$': { [Op.like]: term } }, { '$user.email$': { [Op.like]: term } }] : [])
      ]
    });
  }

  if (req.query.device === 'mobile') {
    and.push({ userAgent: { [Op.regexp]: 'Mobi|iPhone|iPad|Android' } });
  } else if (req.query.device === 'desktop') {
    and.push({ [Op.or]: [{ userAgent: null }, { userAgent: { [Op.notRegexp]: 'Mobi|iPhone|iPad|Android' } }] });
  }

  if (and.length) {
    where[Op.and] = and;
  }

  const sort = {
    newest: [['createdAt', 'DESC']],
    oldest: [['createdAt', 'ASC']],
    lastSeen: [['lastSeenAt', 'DESC']]
  }[req.query.sort] || [['createdAt', 'DESC']];

  const paged = req.query.page !== undefined;
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const page = Math.max(Number(req.query.page) || 1, 1);

  const include = [
    {
      model: User,
      as: 'user',
      attributes: ['userId', 'name', 'email', 'role'],
      required: Object.keys(userWhere).length > 0,
      ...(Object.keys(userWhere).length ? { where: userWhere } : {})
    },
    { model: User, as: 'endedByUser', attributes: ['userId', 'name', 'role'], required: false }
  ];

  const { rows: sessionRecords, count } =
    await Session.findAndCountAll({
      where,
      attributes: {
        exclude: [
          'refreshTokenHash'
        ]
      },
      include,
      order: sort,
      distinct: true,
      subQuery: false,
      ...(paged
        ? { limit, offset: (page - 1) * limit }
        : { limit: allUsers ? 300 : undefined })
    });

  let sessions =
    sessionRecords.map(
      (session) => presentSession(session, req)
    );

  if (!allUsers) {
    sessions = sessions.map((session) => {
      delete session.user;
      return session;
    });
  }

  if (req.query.sort === 'longest') {
    sessions.sort((a, b) => b.durationMs - a.durationMs);
  }

  // Counts for the status chips (same scope, ignoring the status filter).
  const scopeWhere = allUsers ? {} : { userId: req.user.userId };
  const [active, expired, loggedOut, revoked] = await Promise.all([
    Session.count({ where: { ...scopeWhere, ...sessionStatusWhere('active', now) } }),
    Session.count({ where: { ...scopeWhere, ...sessionStatusWhere('expired', now) } }),
    Session.count({ where: { ...scopeWhere, ...sessionStatusWhere('logged_out', now) } }),
    Session.count({ where: { ...scopeWhere, ...sessionStatusWhere('revoked', now) } })
  ]);

  return ok(
    res,
    'Sessions retrieved',
    sessions,
    {
      total: count,
      counts: { __all: active + expired + loggedOut + revoked, Active: active, Expired: expired, 'Logged out': loggedOut, Revoked: revoked },
      ...(paged ? { page, limit, pages: Math.max(Math.ceil(count / limit), 1) } : {})
    }
  );
}

// VIVA CRUD READ – Ahamed – "Check activity" for one session: device, timeline, how it ended, other sessions (GET /api/v1/sessions/:id/activity)
export async function sessionActivity(req, res) {
  const session = await Session.findByPk(req.params.id, {
    attributes: { exclude: ['refreshTokenHash'] },
    include: [
      { model: User, as: 'user', attributes: ['userId', 'name', 'email', 'role', 'isActive', 'lastLoginAt'] },
      { model: User, as: 'endedByUser', attributes: ['userId', 'name', 'role'], required: false }
    ]
  });

  // Users may check only their own sessions; Admins may check anyone's.
  if (!session || (req.user.role !== 'Admin' && session.userId !== req.user.userId)) {
    return res.status(404).json({ success: false, message: 'Session not found', errors: [] });
  }

  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const [events, otherSessions, failedLogins] = await Promise.all([
    SessionEvent.findAll({
      where: { sessionId: session.sessionId },
      include: [{ model: User, as: 'actor', attributes: ['userId', 'name', 'role'], required: false }],
      order: [['createdAt', 'ASC'], ['eventId', 'ASC']],
      limit: 300
    }),
    Session.findAll({
      where: { userId: session.userId, sessionId: { [Op.ne]: session.sessionId } },
      attributes: { exclude: ['refreshTokenHash'] },
      order: [['createdAt', 'DESC']],
      limit: 8
    }),
    SessionEvent.findAll({
      where: { userId: session.userId, eventType: { [Op.in]: ['login_failed', 'locked'] }, createdAt: { [Op.gte]: since } },
      order: [['createdAt', 'DESC']],
      limit: 10
    })
  ]);

  const timeline = events.map((event) => event.toJSON());

  // Sessions created before October 2026 have no events: rebuild the basics.
  if (!timeline.some((event) => event.eventType === 'login')) {
    timeline.unshift({ eventId: null, eventType: 'login', createdAt: session.createdAt, ipAddress: session.ipAddress, deviceLabel: session.deviceLabel, detail: 'Signed in' });
  }

  if (session.revokedAt && !timeline.some((event) => ['logout', 'revoked', 'signed_out_others', 'password_changed', 'password_reset', 'deactivated'].includes(event.eventType))) {
    timeline.push({ eventId: null, eventType: session.endedReason || 'revoked', createdAt: session.revokedAt, detail: ENDED_LABELS[session.endedReason] || 'Revoked' });
  }

  if (!session.revokedAt && new Date(session.expiresAt) <= new Date()) {
    timeline.push({ eventId: null, eventType: 'expired', createdAt: session.expiresAt, detail: 'The session expired' });
  }

  return ok(res, 'Session activity retrieved', {
    session: presentSession(session, req),
    timeline,
    otherSessions: otherSessions.map((item) => presentSession(item, req)),
    failedLogins: failedLogins.map((event) => event.toJSON())
  });
}

// VIVA CRUD READ – Ahamed – login history incl. failed attempts and lockouts (Admin) (GET /api/v1/sessions/login-history)
export async function loginHistory(req, res) {
  const types = {
    all: ['login', 'login_failed', 'locked', 'unlocked', 'password_reset', 'password_reset_requested'],
    success: ['login'],
    failed: ['login_failed'],
    locked: ['locked', 'unlocked']
  };
  const where = { eventType: { [Op.in]: types[req.query.type] || types.all } };
  const and = [];

  if (req.query.from) and.push({ createdAt: { [Op.gte]: new Date(`${req.query.from}T00:00:00`) } });
  if (req.query.to) and.push({ createdAt: { [Op.lte]: new Date(`${req.query.to}T23:59:59`) } });

  if (req.query.search) {
    const term = `%${escapeLike(String(req.query.search).trim().slice(0, 100))}%`;
    and.push({ [Op.or]: [{ email: { [Op.like]: term } }, { ipAddress: { [Op.like]: term } }, { deviceLabel: { [Op.like]: term } }, { '$user.name$': { [Op.like]: term } }] });
  }

  if (and.length) where[Op.and] = and;

  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
  const page = Math.max(Number(req.query.page) || 1, 1);

  const { rows, count } = await SessionEvent.findAndCountAll({
    where,
    include: [{ model: User, as: 'user', attributes: ['userId', 'name', 'email', 'role'], required: false }],
    order: [['createdAt', 'DESC'], ['eventId', 'DESC']],
    limit,
    offset: (page - 1) * limit,
    subQuery: false
  });

  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const [failed24h, locked] = await Promise.all([
    SessionEvent.count({ where: { eventType: 'login_failed', createdAt: { [Op.gte]: since } } }),
    User.count({ where: { lockedUntil: { [Op.gt]: new Date() } } })
  ]);

  return ok(res, 'Login history retrieved', rows, { total: count, page, limit, pages: Math.max(Math.ceil(count / limit), 1), failed24h, lockedAccounts: locked });
}

// VIVA CRUD DELETE – Ahamed – Sessions revoke one (DELETE /api/v1/sessions/:id)
export async function revokeSession(
  req,
  res
) {
  const ended = await endSessions(
    {
      sessionId:
        req.params.id,
      // Admins may revoke any user's session; others only their own.
      ...(req.user.role === 'Admin'
        ? {}
        : {
            userId:
              req.user.userId
          })
    },
    {
      reason: 'revoked',
      endedBy: req.user.userId,
      detail: `Revoked by ${req.user.name}`,
      meta: { ipAddress: req.ip, userAgent: req.get('user-agent') || null }
    }
  );

  if (!ended) {
    return res.status(404).json({
      success: false,

      message:
        'Active session not found',

      errors: []
    });
  }

  await logActivity(req, 'session.revoked', 'User', null, `Session #${req.params.id} revoked`);

  return ok(
    res,
    'Session revoked'
  );
}

// VIVA CRUD DELETE – Ahamed – Sessions sign out all other devices (DELETE /api/v1/sessions)
export async function revokeAll(
  req,
  res
) {
  await endSessions(
    {
      userId:
        req.user.userId,

      sessionId: {
        [Op.ne]:
          req.sessionId
      }
    },
    {
      reason: 'signed_out_others',
      endedBy: req.user.userId,
      detail: 'Signed out from another device ("Log out other devices")',
      meta: { ipAddress: req.ip, userAgent: req.get('user-agent') || null }
    }
  );

  return ok(
    res,
    'All other sessions revoked'
  );
}
