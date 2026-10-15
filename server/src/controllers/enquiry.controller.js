/*
|--------------------------------------------------------------------------
| VIVA-HEADER – H.F. Naaziq – Customer Enquiry
| CRUD resource 1: Enquiries (table `enquiries`)
|--------------------------------------------------------------------------
|   CREATE  createEnquiry        POST /api/v1/enquiries
|   READ    listMyEnquiries      GET /api/v1/my/enquiries
|   READ    getMyEnquiry         GET /api/v1/my/enquiries/:id
|   READ    listEnquiries        GET /api/v1/enquiries
|   READ    getEnquiry           GET /api/v1/enquiries/:id
|   READ    listEnquiryInbound   GET /api/v1/enquiries/:id/inbound
|   UPDATE  updateEnquiry        PATCH /api/v1/enquiries/:id
|   UPDATE  assignEnquiry        PATCH /api/v1/enquiries/:id/assign
|   DELETE  deleteEnquiry        DELETE /api/v1/enquiries/:id
| Every write goes through Sequelize to MySQL/MariaDB and is recorded in
| activity_logs (services/activity.service.js) where it changes data.
*/

import {
  Op
} from 'sequelize';

import {
  Enquiry,
  Response,
  StaffPermission,
  User,
  Vehicle,
  sequelize
} from '../models/index.js';

/*
 * VIVA – Naaziq – Enquiry Responses: customer READ.
 * Customers see only responses that were actually SENT (never drafts),
 * without internal fields.
 */
const sentResponsesInclude = {
  model: Response,
  as: 'responses',
  where: { status: 'Sent' },
  required: false,
  attributes: ['responseId', 'subject', 'responseBody', 'sentAt']
};

import {
  ok
} from '../middleware/core.js';

import {
  enquiryTag,
  getAdminRecipient,
  queueMail,
  withTag
} from '../services/mail.service.js';

import {
  logActivity
} from '../services/activity.service.js';

import {
  InboundEmail
} from '../models/index.js';

function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, (character) => `\\${character}`);
}

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

// VIVA CRUD CREATE – customer submits; admin + customer emails queued (POST /api/v1/enquiries)
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

  await logActivity(
    req,
    'enquiry.created',
    'Enquiry',
    enquiry.enquiryId,
    `Enquiry #${enquiry.enquiryId} received for ${enquiry.vehicleReference}`
  );

  const adminRecipient = getAdminRecipient();

  if (adminRecipient) {
    await queueMail(
      {
        to: adminRecipient,
        replyTo: enquiry.customerEmail,
        subject: withTag(
          `New enquiry: ${enquiry.vehicleReference}`,
          enquiryTag(enquiry.enquiryId)
        ),
        heading: 'New customer enquiry',
        text: [
          `Customer: ${enquiry.customerName}`,
          `Email: ${enquiry.customerEmail}`,
          `Phone: ${enquiry.customerPhone}`,
          `Vehicle: ${enquiry.vehicleReference}`,
          '',
          enquiry.message
        ].join('\n')
      },
      {
        messageKey: `enquiry-${enquiry.enquiryId}-admin`,
        template: 'enquiry-admin',
        relatedType: 'Enquiry',
        relatedId: enquiry.enquiryId,
        createdBy: customer.userId
      }
    );
  }

  const acknowledgement = await queueMail(
    {
      to: enquiry.customerEmail,
      subject: withTag(
        `We received your enquiry about ${enquiry.vehicleReference}`,
        enquiryTag(enquiry.enquiryId)
      ),
      heading: 'Thank you for your enquiry',
      text: [
        `Dear ${enquiry.customerName},`,
        `Thank you for contacting High Street about ${enquiry.vehicleReference}. Your enquiry reference is #${enquiry.enquiryId}.`,
        `Your message:\n${enquiry.message}`,
        'A member of our team will reply shortly. You can follow the progress from "My enquiries" in your account.',
        'High Street (PVT) Ltd.'
      ].join('\n\n')
    },
    {
      messageKey: `enquiry-${enquiry.enquiryId}-ack`,
      template: 'enquiry-ack',
      relatedType: 'Enquiry',
      relatedId: enquiry.enquiryId,
      createdBy: customer.userId
    }
  );

  return res.status(201).json({
    success: true,
    message:
      'Your enquiry has been submitted successfully',
    data: enquiry,
    meta: {
      emailStatus: acknowledgement?.status || null
    }
  });
}

/*
|--------------------------------------------------------------------------
| Admin and Staff Enquiry List
|--------------------------------------------------------------------------
*/

// VIVA CRUD READ – staff/admin list, search, filters (GET /api/v1/enquiries)
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

  if (req.query.search) {
    const raw = String(req.query.search).trim().slice(0, 100);
    const term = `%${escapeLike(raw)}%`;

    where[Op.or] = [
      { customerName: { [Op.like]: term } },
      { customerEmail: { [Op.like]: term } },
      { vehicleReference: { [Op.like]: term } },
      { message: { [Op.like]: term } },
      ...(/^\d+$/.test(raw) ? [{ enquiryId: Number(raw) }] : [])
    ];
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

// VIVA CRUD READ – staff/admin details (GET /api/v1/enquiries/:id)
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

// VIVA CRUD READ – customer: own enquiries with SENT replies (GET /api/v1/my/enquiries)
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
        },

        sentResponsesInclude
      ],

      order: [
        ['createdAt', 'DESC'],
        [{ model: Response, as: 'responses' }, 'sentAt', 'ASC']
      ]
    });

  return ok(
    res,
    'Your enquiries were retrieved',
    enquiries
  );
}

// VIVA CRUD READ – customer: one enquiry (GET /api/v1/my/enquiries/:id)
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
        },

        sentResponsesInclude
      ],

      order: [[{ model: Response, as: 'responses' }, 'sentAt', 'ASC']]
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

// VIVA CRUD UPDATE – status New / In Progress / Responded / Archived (PATCH /api/v1/enquiries/:id)
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

  await logActivity(
    req,
    'enquiry.status_changed',
    'Enquiry',
    enquiry.enquiryId,
    `Enquiry #${enquiry.enquiryId} marked ${status}`
  );

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

// VIVA CRUD UPDATE – assign to staff (PATCH /api/v1/enquiries/:id/assign)
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

  await logActivity(
    req,
    'enquiry.assigned',
    'Enquiry',
    enquiry.enquiryId,
    `Enquiry #${enquiry.enquiryId} assigned to ${staff.name}`
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

// VIVA CRUD DELETE – Admin permanently deletes (DELETE /api/v1/enquiries/:id)
export async function deleteEnquiry(
  req,
  res
) {
  const enquiry = await findEnquiry(
    req.params.id
  );

  await enquiry.destroy();

  await logActivity(
    req,
    'enquiry.deleted',
    'Enquiry',
    enquiry.enquiryId,
    `Enquiry #${enquiry.enquiryId} permanently deleted`
  );

  return ok(
    res,
    'Enquiry permanently deleted'
  );
}

/*
|--------------------------------------------------------------------------
| Customer email replies received for an enquiry
|--------------------------------------------------------------------------
*/

// VIVA CRUD READ – email replies received from the customer (GET /api/v1/enquiries/:id/inbound)
export async function listEnquiryInbound(
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

  const replies =
    await InboundEmail.findAll({
      where: {
        enquiryId:
          enquiry.enquiryId,
        status: 'Matched'
      },
      order: [
        ['receivedAt', 'DESC']
      ]
    });

  return ok(
    res,
    'Customer email replies retrieved',
    replies
  );
}
