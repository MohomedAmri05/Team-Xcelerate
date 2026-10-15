/*
|--------------------------------------------------------------------------
| VIVA-HEADER – M.R.M. Amri – Vehicle Inventory
| CRUD resource 1: Vehicles (table `vehicles`)
|--------------------------------------------------------------------------
|   CREATE  create               POST /api/v1/vehicles
|   READ    list                 GET /api/v1/vehicles
|   READ    one                  GET /api/v1/vehicles/:id
|   UPDATE  update               PUT /api/v1/vehicles/:id
|   UPDATE  status               PATCH /api/v1/vehicles/:id/status
|   DELETE  remove               DELETE /api/v1/vehicles/:id
|   UPDATE  restore (Unarchive)  PATCH /api/v1/vehicles/:id/restore
| Every write goes through Sequelize to MySQL/MariaDB and is recorded in
| activity_logs (services/activity.service.js) where it changes data.
*/

import {
  Op
} from 'sequelize';

import {
  Vehicle,
  VehicleImage,
  TestDriveBooking,
  FinanceApplication
} from '../models/index.js';

import {
  ok
} from '../middleware/core.js';

import {
  logActivity
} from '../services/activity.service.js';

import {
  activePlanFor,
  activePlansForVehicles,
  planSummary
} from '../services/finance.service.js';

/*
 * VIVA – Herathge – each vehicle carries the financing plan that applies to
 * it (its own plan or the general plan) so the website can show
 * "Finance from LKR … / month" next to the right vehicle.
 */
async function withFinancePlans(vehicles) {
  const plans = await activePlansForVehicles(vehicles.map((vehicle) => vehicle.vehicleId));

  return vehicles.map((vehicle) => ({
    ...vehicle.toJSON(),
    financePlan: planSummary(plans.get(vehicle.vehicleId), vehicle.price)
  }));
}

function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, (character) => `\\${character}`);
}

function canManageInventory(req) {
  if (req.user?.role === 'Admin') {
    return true;
  }

  return (
    req.user?.role === 'Staff' &&
    Boolean(
      req.permissions
        ?.canManageInventory
    )
  );
}

// VIVA CRUD READ – search + filters + pagination (public sees Available/Sold only) (GET /api/v1/vehicles)
export async function list(
  req,
  res
) {
  const managementAccess =
    canManageInventory(req);

  const isCustomer =
    req.user?.role === 'Customer';

  const {
    search,
    type,
    make,
    model,
    minYear,
    maxYear,
    minPrice,
    maxPrice,
    condition,
    fuelType,
    transmission,
    status,
    sort = 'newest',
    page = 1,
    limit = 12,
    includeArchived = 'false'
  } = req.query;

  /*
   * Admin and authorized Staff can see all
   * operational vehicle statuses.
   *
   * Logged-in Customers can see Available
   * and Sold vehicles.
   *
   * Guests can see only Available vehicles.
   */
  const where =
    managementAccess
      ? {}
      : isCustomer
        ? {
            status: {
              [Op.in]: [
                'Available',
                'Sold'
              ]
            }
          }
        : {
            status: 'Available'
          };

  if (
    managementAccess &&
    status
  ) {
    where.status = status;
  }

  if (search) {
    const term = String(search).trim().slice(0, 100);

    where[Op.or] = [
      'make',
      'model',
      'type',
      'color'
    ].map((field) => ({
      [field]: {
        [Op.like]:
          `%${escapeLike(term)}%`
      }
    }));

    // Combined "make model" searches such as "Toyota Aqua".
    const parts = term.split(/\s+/).filter(Boolean);

    if (parts.length > 1) {
      where[Op.or].push({
        [Op.and]: parts.map((part) => ({
          [Op.or]: [
            { make: { [Op.like]: `%${escapeLike(part)}%` } },
            { model: { [Op.like]: `%${escapeLike(part)}%` } }
          ]
        }))
      });
    }

    if (managementAccess && /^\d+$/.test(term)) {
      where[Op.or].push({
        vehicleId: Number(term)
      });
    }
  }

  const exactFilters = {
    type,
    make,
    model,
    condition,
    fuelType,
    transmission
  };

  for (
    const [
      field,
      value
    ] of Object.entries(
      exactFilters
    )
  ) {
    if (value) {
      where[field] = value;
    }
  }

  if (minYear || maxYear) {
    where.year = {
      [Op.between]: [
        Number(minYear || 1900),
        Number(maxYear || 2100)
      ]
    };
  }

  if (minPrice || maxPrice) {
    where.price = {
      [Op.between]: [
        Number(minPrice || 0),

        Number(
          maxPrice ||
          Number.MAX_SAFE_INTEGER
        )
      ]
    };
  }

  const orders = {
    newest: [
      'createdAt',
      'DESC'
    ],

    price_asc: [
      'price',
      'ASC'
    ],

    price_desc: [
      'price',
      'DESC'
    ],

    year: [
      'year',
      'DESC'
    ],

    mileage: [
      'mileage',
      'ASC'
    ]
  };

  const requestedLimit =
    Number(limit);

  const take = Math.min(
    Math.max(
      Number.isFinite(
        requestedLimit
      )
        ? requestedLimit
        : 12,
      1
    ),
    50
  );

  const currentPage =
    Math.max(
      Number(page) || 1,
      1
    );

  const offset =
    (currentPage - 1) *
    take;

  const showArchived =
    managementAccess &&
    includeArchived === 'true';

  const result =
    await Vehicle.findAndCountAll({
      where,

      paranoid:
        !showArchived,

      include: [
        {
          model: VehicleImage,
          as: 'images',
          required: false
        }
      ],

      order: [
        orders[sort] ||
        orders.newest
      ],

      limit: take,
      offset,
      distinct: true
    });

  return ok(
    res,
    'Vehicles retrieved',
    await withFinancePlans(result.rows),
    {
      page: currentPage,
      limit: take,
      total: result.count,

      pages: Math.ceil(
        result.count / take
      )
    }
  );
}

// VIVA CRUD READ – vehicle details (GET /api/v1/vehicles/:id)
export async function one(
  req,
  res
) {
  const managementAccess =
    canManageInventory(req);

  const vehicleId =
    Number(req.params.id);

  let vehicle;

  if (managementAccess) {
    vehicle =
      await Vehicle.findByPk(
        vehicleId,
        {
          paranoid: false,

          include: [
            {
              model: VehicleImage,
              as: 'images'
            }
          ]
        }
      );
  } else {
    const visibleStatuses =
      req.user?.role === 'Customer'
        ? [
            'Available',
            'Sold'
          ]
        : [
            'Available'
          ];

    vehicle =
      await Vehicle.findOne({
        where: {
          vehicleId,

          status: {
            [Op.in]:
              visibleStatuses
          }
        },

        include: [
          {
            model: VehicleImage,
            as: 'images'
          }
        ]
      });
  }

  if (!vehicle) {
    return res.status(404).json({
      success: false,
      message: 'Vehicle not found',
      errors: []
    });
  }

  return ok(
    res,
    'Vehicle retrieved',
    {
      ...vehicle.toJSON(),
      financePlan: planSummary(await activePlanFor(vehicle.vehicleId), vehicle.price)
    }
  );
}

// VIVA CRUD CREATE – new vehicle, always saved as Draft first (POST /api/v1/vehicles)
export async function create(
  req,
  res
) {
  const data = {
    ...req.validated.body,

    createdBy:
      req.user.userId
  };

  /*
   * A new vehicle cannot be published until
   * at least one image has been uploaded.
   */
  if (
    data.status === 'Available'
  ) {
    data.status = 'Draft';
  }

  const vehicle =
    await Vehicle.create(data);

  await logActivity(
    req,
    'vehicle.created',
    'Vehicle',
    vehicle.vehicleId,
    `${vehicle.year} ${vehicle.make} ${vehicle.model} added as Draft`
  );

  return res.status(201).json({
    success: true,

    message:
      'Vehicle created as draft',

    data: vehicle,
    meta: {}
  });
}

// VIVA CRUD UPDATE – edit details (PUT /api/v1/vehicles/:id)
export async function update(
  req,
  res
) {
  const vehicle =
    await Vehicle.findByPk(
      req.params.id
    );

  if (!vehicle) {
    return res.status(404).json({
      success: false,
      message: 'Vehicle not found',
      errors: []
    });
  }

  if (
    req.validated.body.status ===
      'Available' &&
    !await VehicleImage.count({
      where: {
        vehicleId:
          vehicle.vehicleId
      }
    })
  ) {
    return res.status(422).json({
      success: false,

      message:
        'At least one image is required before publishing',

      errors: []
    });
  }

  if (req.validated.body.status === 'Archived' && vehicle.status !== 'Archived') {
    // Archiving from the edit form follows the archive rules too.
    if (!canArchive(req)) {
      return res.status(403).json({ success: false, message: 'You need the "Archive records" permission to archive vehicles', errors: [] });
    }

    const blocked = await archiveBlockedResponse(vehicle.vehicleId);

    if (blocked) {
      return res.status(409).json(blocked);
    }

    const { status: _archived, ...details } = req.validated.body;
    await archiveVehicle(vehicle, details);
  } else {
    await vehicle.update(
      req.validated.body
    );
  }

  await logActivity(
    req,
    'vehicle.updated',
    'Vehicle',
    vehicle.vehicleId,
    `${vehicle.year} ${vehicle.make} ${vehicle.model} updated (${vehicle.status})`
  );

  return ok(
    res,
    'Vehicle updated',
    vehicle
  );
}

/*
 * VIVA – Amri – business rule: a vehicle that customers are still relying
 * on cannot be archived (by the Archive button OR by setting the status to
 * "Archived"). Active test drives (Pending/Confirmed) and open finance
 * applications (Submitted/Under Review) must first be completed, cancelled
 * or decided. Past records do not block archiving: archiving is a soft
 * delete, so they stay linked to the vehicle.
 * Returns the 409 response body, or null when archiving is allowed.
 */
async function archiveBlockedResponse(vehicleId) {
  const [activeBookings, openApplications] = await Promise.all([
    TestDriveBooking.count({
      where: { vehicleId, status: ['Pending', 'Confirmed'] }
    }),
    FinanceApplication.count({
      where: { vehicleId, status: ['Submitted', 'Under Review'] }
    })
  ]);

  if (!activeBookings && !openApplications) {
    return null;
  }

  const reasons = [
    activeBookings
      ? `${activeBookings} active test-drive booking${activeBookings === 1 ? '' : 's'}`
      : null,
    openApplications
      ? `${openApplications} open finance application${openApplications === 1 ? '' : 's'}`
      : null
  ].filter(Boolean);

  return {
    success: false,
    message:
      `This vehicle cannot be archived because it has ${reasons.join(' and ')}. ` +
      'Complete or cancel them first (Dashboard › Bookings / Finance applications).',
    errors: [],
    meta: { activeBookings, openApplications }
  };
}

/*
 * VIVA – Amri – one way to archive, used by the Archive button, the status
 * drop-down and the edit form: remember the current status (for
 * Unarchive), set Archived and soft-delete (deleted_at). Staff need the
 * "Archive records" permission whichever way they archive.
 */
const canArchive = (req) => req.user?.role === 'Admin' || Boolean(req.permissions?.canArchiveRecords);

async function archiveVehicle(vehicle, changes = {}) {
  await vehicle.update({
    ...changes,
    statusBeforeArchive: vehicle.status === 'Archived' ? vehicle.statusBeforeArchive || 'Draft' : vehicle.status,
    status: 'Archived'
  });

  await vehicle.destroy();
}

// VIVA CRUD UPDATE – Draft / Available / Sold (PATCH /api/v1/vehicles/:id/status)
export async function status(
  req,
  res
) {
  const allowedStatuses = [
    'Draft',
    'Available',
    'Sold',
    'Archived'
  ];

  if (
    !allowedStatuses.includes(
      req.body.status
    )
  ) {
    return res.status(422).json({
      success: false,

      message:
        'Invalid vehicle status',

      errors: []
    });
  }

  const vehicle =
    await Vehicle.findByPk(
      req.params.id
    );

  if (!vehicle) {
    return res.status(404).json({
      success: false,
      message: 'Vehicle not found',
      errors: []
    });
  }

  if (
    req.body.status ===
      'Available' &&
    !await VehicleImage.count({
      where: {
        vehicleId:
          vehicle.vehicleId
      }
    })
  ) {
    return res.status(422).json({
      success: false,

      message:
        'At least one image is required before publishing',

      errors: []
    });
  }

  // Same business rule as the Archive button (cannot be bypassed here).
  if (req.body.status === 'Archived' && vehicle.status !== 'Archived') {
    if (!canArchive(req)) {
      return res.status(403).json({ success: false, message: 'You need the "Archive records" permission to archive vehicles', errors: [] });
    }

    const blocked = await archiveBlockedResponse(vehicle.vehicleId);

    if (blocked) {
      return res.status(409).json(blocked);
    }
  }

  const previousStatus =
    vehicle.status;

  if (req.body.status === 'Archived') {
    // Archived from the drop-down = the same soft delete as the Archive button.
    await archiveVehicle(vehicle);
  } else {
    await vehicle.update({
      status: req.body.status
    });
  }

  await logActivity(
    req,
    'vehicle.status_changed',
    'Vehicle',
    vehicle.vehicleId,
    `${vehicle.make} ${vehicle.model}: ${previousStatus} → ${vehicle.status}`
  );

  return ok(
    res,
    'Vehicle status updated',
    vehicle
  );
}

// VIVA CRUD DELETE – soft delete = Archived (row kept, deleted_at set) (DELETE /api/v1/vehicles/:id)
export async function remove(
  req,
  res
) {
  const vehicle =
    await Vehicle.findByPk(
      req.params.id
    );

  if (!vehicle) {
    return res.status(404).json({
      success: false,
      message: 'Vehicle not found',
      errors: []
    });
  }

  // VIVA – Amri – business rule (see archiveBlockedResponse above).
  const blocked = await archiveBlockedResponse(vehicle.vehicleId);

  if (blocked) {
    return res.status(409).json(blocked);
  }

  await archiveVehicle(vehicle);

  await logActivity(
    req,
    'vehicle.archived',
    'Vehicle',
    vehicle.vehicleId,
    `${vehicle.year} ${vehicle.make} ${vehicle.model} archived`
  );

  return ok(
    res,
    'Vehicle archived'
  );
}

/*
 * "Unarchive": brings an archived (soft-deleted) vehicle back with the
 * status it had before it was archived (Draft / Available / Sold).
 * A vehicle archived before October 2026 has no saved status and comes
 * back as a Draft; an "Available" vehicle that has no image any more
 * also comes back as a Draft (publishing needs an image).
 */
// VIVA CRUD UPDATE – Unarchive (PATCH /api/v1/vehicles/:id/restore)
export async function restore(
  req,
  res
) {
  const vehicle =
    await Vehicle.findByPk(
      req.params.id,
      {
        paranoid: false
      }
    );

  if (!vehicle) {
    return res.status(404).json({
      success: false,
      message: 'Vehicle not found',
      errors: []
    });
  }

  if (!vehicle.isSoftDeleted() && vehicle.status !== 'Archived') {
    return res.status(409).json({
      success: false,
      message: 'This vehicle is not archived',
      errors: []
    });
  }

  let nextStatus = ['Draft', 'Available', 'Sold'].includes(vehicle.statusBeforeArchive)
    ? vehicle.statusBeforeArchive
    : 'Draft';

  if (
    nextStatus === 'Available' &&
    !await VehicleImage.count({ where: { vehicleId: vehicle.vehicleId } })
  ) {
    nextStatus = 'Draft';
  }

  if (vehicle.isSoftDeleted()) {
    await vehicle.restore();
  }

  await vehicle.update({
    status: nextStatus,
    statusBeforeArchive: null
  });

  await logActivity(
    req,
    'vehicle.restored',
    'Vehicle',
    vehicle.vehicleId,
    `${vehicle.year} ${vehicle.make} ${vehicle.model} unarchived as ${nextStatus}`
  );

  return ok(
    res,
    `Vehicle unarchived as ${nextStatus}`,
    vehicle
  );
}