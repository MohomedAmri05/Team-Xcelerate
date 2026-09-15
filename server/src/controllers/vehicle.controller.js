import {
  Op
} from 'sequelize';

import {
  Vehicle,
  VehicleImage
} from '../models/index.js';

import {
  ok
} from '../middleware/core.js';

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
    where[Op.or] = [
      'make',
      'model'
    ].map((field) => ({
      [field]: {
        [Op.like]:
          `%${search.trim()}%`
      }
    }));
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
    result.rows,
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
    vehicle
  );
}

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

  return res.status(201).json({
    success: true,

    message:
      'Vehicle created as draft',

    data: vehicle,
    meta: {}
  });
}

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

  await vehicle.update(
    req.validated.body
  );

  return ok(
    res,
    'Vehicle updated',
    vehicle
  );
}

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

  await vehicle.update({
    status: req.body.status
  });

  return ok(
    res,
    'Vehicle status updated',
    vehicle
  );
}

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

  await vehicle.update({
    status: 'Archived'
  });

  await vehicle.destroy();

  return ok(
    res,
    'Vehicle archived'
  );
}