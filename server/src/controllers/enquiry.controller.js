import {
  Op
} from 'sequelize';

import {
  Enquiry,
  StaffPermission,
  User,
  Vehicle,
  sequelize
} from '../models/index.js';

import {
  ok
} from '../middleware/core.js';

import {
  sendMail
} from '../services/mail.service.js';

/*
|--------------------------------------------------------------------------
| Shared Helpers
|--------------------------------------------------------------------------
*/

const enquiryIncludes = [
  {
    model: Vehicle,
    as: 'vehicle',
    attributes: [
      'vehicleId',
      'make',
      'model',
      'year',
      'status'
    ],
    required: false
  },

  {
    model: User,
    as: 'assignedStaff',
    attributes: [
      'userId',
      'name',
      'email'
    ],
    required: false
  }
];

const parsePagination = (query) => {
  const page = Math.max(
    Number(query.page) || 1,
    1
  );

  const limit = Math.min(
    Math.max(Number(query.limit) || 20, 1),
    100
  );

  return {
    page,
    limit,
    offset: (page - 1) * limit
  };
};

const createFilters = (query) => {
  const where = {};

  if (query.status) {
    where.status = query.status;
  }

  if (query.vehicleId) {
    where.vehicleId = Number(
      query.vehicleId
    );
  }

  if (query.assignedTo) {
    where.assignedTo = Number(
      query.assignedTo
    );
  }

  if (
    query.startDate ||
    query.endDate
  ) {
    where.createdAt = {};

    if (query.startDate) {
      where.createdAt[Op.gte] =
        new Date(query.startDate);
    }

    if (query.endDate) {
      const endDate =
        new Date(query.endDate);

      endDate.setHours(
        23,
        59,
        59,
        999
      );

      where.createdAt[Op.lte] =
        endDate;
    }
  }

  return where;
};

const findEnquiry = async (enquiryId) => {
  const enquiry = await Enquiry.findByPk(
    enquiryId,
    {
      include: enquiryIncludes
    }
  );

  if (!enquiry) {
    throw Object.assign(
      new Error('Enquiry not found'),
      {
        status: 404
      }
    );
  }

  return enquiry;
};

const verifyStaffAccess = (
  enquiry,
  user
) => {
  if (
    user.role === 'Staff' &&
    enquiry.assignedTo !== user.userId
  ) {
    throw Object.assign(
      new Error(
        'This enquiry is not assigned to you'
      ),
      {
        status: 403
      }
    );
  }
};

/*
|--------------------------------------------------------------------------
| Customer Creates an Enquiry
|--------------------------------------------------------------------------
*/

export async function createEnquiry(
  req,
  res
) {
  const {
    vehicleId,
    message
  } = req.validated.body;

  let vehicle = null;

  if (vehicleId) {
    vehicle = await Vehicle.findOne({
      where: {
        vehicleId,
        status: 'Available'
      }
    });

    if (!vehicle) {
      return res.status(422).json({
        success: false,
        message:
          'This vehicle is not available for enquiries',
        errors: []
      });
    }
  }

  const customer = req.user;

  if (
    !customer.phone ||
    customer.phone.trim() === ''
  ) {
    return res.status(422).json({
      success: false,
      message:
        'Add a phone number to your profile before submitting an enquiry',
      errors: []
    });
  }

  const enquiry = await Enquiry.create({
    vehicleId:
      vehicle?.vehicleId || null,

    vehicleReference: vehicle
      ? `${vehicle.year} ${vehicle.make} ${vehicle.model}`
      : 'General enquiry',

    customerId:
      customer.userId,

    customerName:
      customer.name,

    customerEmail:
      customer.email,

    customerPhone:
      customer.phone,

    message,

    status: 'New'
  });

  if (
    process.env.ADMIN_NOTIFICATION_EMAIL
  ) {
    await sendMail({
      to:
        process.env.ADMIN_NOTIFICATION_EMAIL,

      subject:
        `New enquiry: ${enquiry.vehicleReference}`,

      text:
        [
          `Customer: ${enquiry.customerName}`,
          `Email: ${enquiry.customerEmail}`,
          `Phone: ${enquiry.customerPhone}`,
          `Vehicle: ${enquiry.vehicleReference}`,
          '',
          enquiry.message
        ].join('\n')
    });
  }

  return res.status(201).json({
    success: true,
    message:
      'Your enquiry has been submitted successfully',

    data: enquiry,
    meta: {}
  });
}

/*
|--------------------------------------------------------------------------
| Admin and Staff Enquiry List
|--------------------------------------------------------------------------
*/

export async function listEnquiries(
  req,
  res
) {
  const {
    page,
    limit,
    offset
  } = parsePagination(req.query);

  const where =
    createFilters(req.query);

  /*
   * Staff may see only enquiries assigned
   * directly to their account.
   */
  if (req.user.role === 'Staff') {
    where.assignedTo =
      req.user.userId;
  }

  const result =
    await Enquiry.findAndCountAll({
      where,
      include: enquiryIncludes,
      order: [
        ['createdAt', 'DESC']
      ],
      limit,
      offset,
      distinct: true
    });

  return ok(
    res,
    'Enquiries retrieved',
    result.rows,
    {
      page,
      limit,
      total: result.count,
      pages: Math.ceil(
        result.count / limit
      )
    }
  );
}

/*
|--------------------------------------------------------------------------
| Admin or Assigned Staff Reads One Enquiry
|--------------------------------------------------------------------------
*/

export async function getEnquiry(
  req,
  res
) {
  const enquiry = await findEnquiry(
    req.params.id
  );

  verifyStaffAccess(
    enquiry,
    req.user
  );

  return ok(
    res,
    'Enquiry retrieved',
    enquiry
  );
}

/*
|--------------------------------------------------------------------------
| Customer Reads Their Own Enquiries
|--------------------------------------------------------------------------
*/

export async function listMyEnquiries(
  req,
  res
) {
  const enquiries =
    await Enquiry.findAll({
      where: {
        customerId:
          req.user.userId
      },

      include: [
        {
          model: Vehicle,
          as: 'vehicle',
          attributes: [
            'vehicleId',
            'make',
            'model',
            'year',
            'status'
          ],
          required: false
        }
      ],

      order: [
        ['createdAt', 'DESC']
      ]
    });

  return ok(
    res,
    'Your enquiries were retrieved',
    enquiries
  );
}

export async function getMyEnquiry(
  req,
  res
) {
  const enquiry =
    await Enquiry.findOne({
      where: {
        enquiryId:
          req.params.id,

        customerId:
          req.user.userId
      },

      include: [
        {
          model: Vehicle,
          as: 'vehicle',
          attributes: [
            'vehicleId',
            'make',
            'model',
            'year',
            'status'
          ],
          required: false
        }
      ]
    });

  if (!enquiry) {
    return res.status(404).json({
      success: false,
      message: 'Enquiry not found',
      errors: []
    });
  }

  return ok(
    res,
    'Your enquiry was retrieved',
    enquiry
  );
}

/*
|--------------------------------------------------------------------------
| Admin or Assigned Staff Updates Status
|--------------------------------------------------------------------------
*/

export async function updateEnquiry(
  req,
  res
) {
  const enquiry = await findEnquiry(
    req.params.id
  );

  verifyStaffAccess(
    enquiry,
    req.user
  );

  const {
    status
  } = req.validated.body;

  const updateData = {
    status
  };

  if (status === 'Responded') {
    updateData.respondedAt =
      new Date();

    updateData.respondedBy =
      req.user.userId;
  }

  await enquiry.update(updateData);

  return ok(
    res,
    'Enquiry status updated',
    enquiry
  );
}

/*
|--------------------------------------------------------------------------
| Admin Assigns Enquiry to Staff
|--------------------------------------------------------------------------
*/

export async function assignEnquiry(
  req,
  res
) {
  const enquiry = await findEnquiry(
    req.params.id
  );

  const {
    staffId
  } = req.validated.body;

  const staff = await User.findOne({
    where: {
      userId: staffId,
      role: 'Staff',
      isActive: true
    }
  });

  if (!staff) {
    return res.status(422).json({
      success: false,
      message:
        'Select an active Staff account',
      errors: []
    });
  }

  const permissions =
    await StaffPermission.findOne({
      where: {
        userId: staff.userId,
        canManageEnquiries: true
      }
    });

  if (!permissions) {
    return res.status(422).json({
      success: false,
      message:
        'The selected Staff account does not have enquiry-management permission',
      errors: []
    });
  }

  await sequelize.transaction(
    async (transaction) => {
      await enquiry.update(
        {
          assignedTo:
            staff.userId,

          assignedAt:
            new Date(),

          assignedBy:
            req.user.userId,

          status:
            enquiry.status === 'New'
              ? 'In Progress'
              : enquiry.status
        },
        {
          transaction
        }
      );
    }
  );

  const assignedEnquiry =
    await findEnquiry(
      enquiry.enquiryId
    );

  return ok(
    res,
    `Enquiry assigned to ${staff.name}`,
    assignedEnquiry
  );
}

/*
|--------------------------------------------------------------------------
| Admin Permanently Deletes an Enquiry
|--------------------------------------------------------------------------
*/

export async function deleteEnquiry(
  req,
  res
) {
  const enquiry = await findEnquiry(
    req.params.id
  );

  await enquiry.destroy();

  return ok(
    res,
    'Enquiry permanently deleted'
  );
}