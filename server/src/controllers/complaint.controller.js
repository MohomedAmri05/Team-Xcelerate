/*
|--------------------------------------------------------------------------
| VIVA-HEADER – H.F. Naaziq – Customer Enquiry
| CRUD resource 3: Complaints (tables `complaints`, `complaint_messages`, `complaint_status_history`)
|--------------------------------------------------------------------------
|   CREATE  createComplaint      POST /api/v1/complaints
|   READ    listMyComplaints     GET /api/v1/my/complaints
|   READ    getMyComplaint       GET /api/v1/my/complaints/:id
|   CREATE  addMyMessage         POST /api/v1/my/complaints/:id/messages
|   UPDATE  reopenMyComplaint    PATCH /api/v1/my/complaints/:id/reopen
|   UPDATE  closeMyComplaint     PATCH /api/v1/my/complaints/:id/close
|   READ    listComplaints       GET /api/v1/complaints
|   READ    getComplaint         GET /api/v1/complaints/:id
|   UPDATE  updateComplaint      PATCH /api/v1/complaints/:id
|   UPDATE  assignComplaint      PATCH /api/v1/complaints/:id/assign
|   CREATE  addComplaintMessage  POST /api/v1/complaints/:id/messages
|   DELETE  deleteComplaint      DELETE /api/v1/complaints/:id
| Every write goes through Sequelize to MySQL/MariaDB and is recorded in
| activity_logs (services/activity.service.js) where it changes data.
*/

import { Op } from 'sequelize';

import {
  Complaint,
  ComplaintMessage,
  ComplaintStatusHistory,
  Document,
  Enquiry,
  StaffPermission,
  TestDriveBooking,
  User,
  Vehicle,
  sequelize
} from '../models/index.js';

import { COMPLAINT_STATUSES } from '../models/extended.js';
import { ok } from '../middleware/core.js';
import { logActivity } from '../services/activity.service.js';
import { getAdminRecipient, queueMail, withTag } from '../services/mail.service.js';
import { removeStoredDocument } from '../services/file.service.js';

/*
|--------------------------------------------------------------------------
| Complaint Management
|--------------------------------------------------------------------------
|
| Lifecycle:  Submitted → Under Review → In Progress → Resolved → Closed
|
| - Customers submit complaints, follow the conversation, reply, confirm a
|   resolution (Resolved → Closed) or reopen a Resolved / Closed complaint.
| - Admin, and Staff with the canManageComplaints permission, manage
|   complaints. Staff only see complaints assigned to them.
| - Internal notes (is_internal = true) are never returned to customers.
|
*/

const OPEN_STATUSES = ['Submitted', 'Under Review', 'In Progress'];

const TRANSITIONS = {
  Submitted: ['Under Review', 'In Progress', 'Resolved', 'Closed'],
  'Under Review': ['In Progress', 'Resolved', 'Closed'],
  'In Progress': ['Under Review', 'Resolved', 'Closed'],
  Resolved: ['In Progress', 'Closed'],
  Closed: ['Under Review']
};

const REOPEN_WINDOW_DAYS = 30;

const httpError = (status, message) => Object.assign(new Error(message), { status });

export const complaintTag = (reference) => `[${reference}]`;

function buildReference(complaintId, date = new Date()) {
  return `HS-CMP-${date.getFullYear()}-${String(complaintId).padStart(5, '0')}`;
}

function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, (character) => `\\${character}`);
}

const customerIncludes = [
  {
    model: Vehicle,
    as: 'vehicle',
    attributes: ['vehicleId', 'make', 'model', 'year', 'status'],
    required: false,
    paranoid: false
  },
  {
    model: TestDriveBooking,
    as: 'booking',
    attributes: ['bookingId', 'vehicleReference', 'preferredDate', 'status'],
    required: false
  },
  {
    model: Enquiry,
    as: 'enquiry',
    attributes: ['enquiryId', 'vehicleReference', 'status'],
    required: false
  },
  {
    model: User,
    as: 'assignedStaff',
    attributes: ['userId', 'name'],
    required: false
  }
];

function publicMessage(message) {
  const plain = message.get({ plain: true });

  return {
    messageId: plain.messageId,
    authorRole: plain.authorRole,
    authorName:
      plain.authorRole === 'Customer' || plain.authorRole === 'Email'
        ? plain.author?.name || 'You'
        : plain.authorRole === 'System'
          ? 'High Street'
          : plain.author?.name
            ? `${plain.author.name} · High Street`
            : 'High Street team',
    body: plain.body,
    source: plain.source,
    createdAt: plain.createdAt
  };
}

function canManage(user, permissions) {
  return user.role === 'Admin' || (user.role === 'Staff' && Boolean(permissions?.canManageComplaints));
}

function assertManagerAccess(complaint, req) {
  if (req.user.role === 'Staff' && complaint.assignedTo !== req.user.userId) {
    throw httpError(403, 'This complaint is not assigned to you');
  }
}

async function recordStatus(complaint, fromStatus, toStatus, req, note, transaction) {
  return ComplaintStatusHistory.create(
    {
      complaintId: complaint.complaintId,
      fromStatus,
      toStatus,
      changedBy: req.user?.userId || null,
      note: note ? String(note).slice(0, 500) : null
    },
    { transaction }
  );
}

async function notifyCustomer(complaint, customer, template, key, subject, text, req) {
  if (!customer?.email) {
    return { status: 'Failed', delivered: false, error: 'Customer has no email address' };
  }

  return queueMail(
    {
      to: customer.email,
      subject: withTag(subject, complaintTag(complaint.reference)),
      heading: subject,
      text
    },
    {
      messageKey: key,
      template,
      relatedType: 'Complaint',
      relatedId: complaint.complaintId,
      createdBy: req.user?.userId || null
    }
  );
}

async function notifyAdmin(complaint, template, key, subject, text, req, replyTo = null) {
  const recipient = getAdminRecipient();

  if (!recipient) {
    return null;
  }

  return queueMail(
    {
      to: recipient,
      subject: withTag(subject, complaintTag(complaint.reference)),
      heading: subject,
      text,
      replyTo
    },
    {
      messageKey: key,
      template,
      relatedType: 'Complaint',
      relatedId: complaint.complaintId,
      createdBy: req.user?.userId || null
    }
  );
}

const portalLine = () =>
  `You can follow this complaint at any time from "My complaints" in your High Street account${
    process.env.CLIENT_URL ? ` (${process.env.CLIENT_URL.split(',')[0]}/my-complaints)` : ''
  }.`;

/*
|--------------------------------------------------------------------------
| Customer: submit a complaint
|--------------------------------------------------------------------------
*/

// VIVA CRUD CREATE – customer files a complaint (reference HS-CMP-YYYY-NNNNN) (POST /api/v1/complaints)
export async function createComplaint(req, res) {
  const { category, subject, description, priority, vehicleId, bookingId, enquiryId } = req.validated.body;

  const customer = req.user;

  if (vehicleId) {
    const vehicle = await Vehicle.findByPk(vehicleId, { paranoid: false });

    if (!vehicle) {
      throw httpError(422, 'The selected vehicle does not exist');
    }
  }

  if (bookingId) {
    const booking = await TestDriveBooking.findOne({
      where: { bookingId, customerId: customer.userId }
    });

    if (!booking) {
      throw httpError(422, 'The selected test-drive booking was not found in your account');
    }
  }

  if (enquiryId) {
    const enquiry = await Enquiry.findOne({
      where: { enquiryId, customerId: customer.userId }
    });

    if (!enquiry) {
      throw httpError(422, 'The selected enquiry was not found in your account');
    }
  }

  // Prevent accidental duplicate submissions (double-click / resubmit).
  const duplicate = await Complaint.findOne({
    where: {
      customerId: customer.userId,
      subject,
      createdAt: { [Op.gte]: new Date(Date.now() - 2 * 60000) }
    }
  });

  if (duplicate) {
    throw httpError(409, `You submitted this complaint a moment ago (reference ${duplicate.reference})`);
  }

  const complaint = await sequelize.transaction(async (transaction) => {
    const created = await Complaint.create(
      {
        reference: `PENDING-${customer.userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        customerId: customer.userId,
        category,
        subject,
        description,
        priority: priority || 'Medium',
        status: 'Submitted',
        vehicleId: vehicleId || null,
        bookingId: bookingId || null,
        enquiryId: enquiryId || null,
        lastActivityAt: new Date()
      },
      { transaction }
    );

    await created.update({ reference: buildReference(created.complaintId) }, { transaction });
    await recordStatus(created, null, 'Submitted', req, 'Complaint submitted by customer', transaction);
    await logActivity(req, 'complaint.created', 'Complaint', created.complaintId, `${created.reference} submitted: ${subject}`, transaction);

    return created;
  });

  const acknowledgement = await notifyCustomer(
    complaint,
    customer,
    'complaint-ack',
    `complaint-${complaint.complaintId}-ack`,
    `We received your complaint ${complaint.reference}`,
    [
      `Dear ${customer.name},`,
      `Thank you for contacting High Street. Your complaint has been recorded with the reference ${complaint.reference}.`,
      `Subject: ${subject}\nCategory: ${category}`,
      'A member of our team will review it and keep you updated by email. You can reply to this email to add more information.',
      portalLine(),
      'High Street (PVT) Ltd.'
    ].join('\n\n'),
    req
  );

  await notifyAdmin(
    complaint,
    'complaint-admin',
    `complaint-${complaint.complaintId}-admin`,
    `New complaint ${complaint.reference}: ${subject}`,
    [
      `Customer: ${customer.name} <${customer.email}>${customer.phone ? `, ${customer.phone}` : ''}`,
      `Category: ${category}\nPriority: ${priority || 'Medium'}`,
      `Subject: ${subject}`,
      description,
      'Open the High Street dashboard › Complaints to review and assign it.'
    ].join('\n\n'),
    req,
    customer.email
  );

  return res.status(201).json({
    success: true,
    message: `Complaint submitted. Your reference is ${complaint.reference}`,
    data: complaint,
    meta: {
      emailStatus: acknowledgement?.status || null
    }
  });
}

/*
|--------------------------------------------------------------------------
| Customer: own complaints
|--------------------------------------------------------------------------
*/

// VIVA CRUD READ – customer: own complaints (GET /api/v1/my/complaints)
export async function listMyComplaints(req, res) {
  const where = {
    customerId: req.user.userId
  };

  if (req.query.status && COMPLAINT_STATUSES.includes(req.query.status)) {
    where.status = req.query.status;
  }

  if (req.query.search) {
    const term = `%${escapeLike(String(req.query.search).trim().slice(0, 100))}%`;
    where[Op.or] = [{ reference: { [Op.like]: term } }, { subject: { [Op.like]: term } }];
  }

  const complaints = await Complaint.findAll({
    where,
    include: customerIncludes,
    order: [['lastActivityAt', 'DESC']]
  });

  return ok(res, 'Your complaints were retrieved', complaints);
}

// VIVA CRUD READ – customer: timeline (internal notes hidden) (GET /api/v1/my/complaints/:id)
export async function getMyComplaint(req, res) {
  const complaint = await Complaint.findOne({
    where: {
      complaintId: req.params.id,
      customerId: req.user.userId
    },
    include: [
      ...customerIncludes,
      {
        model: ComplaintMessage,
        as: 'messages',
        where: { isInternal: false },
        required: false,
        include: [{ model: User, as: 'author', attributes: ['name'] }]
      },
      {
        model: ComplaintStatusHistory,
        as: 'statusHistory',
        required: false
      },
      {
        model: Document,
        as: 'documents',
        where: { visibility: 'Owner' },
        required: false
      }
    ],
    order: [
      [{ model: ComplaintMessage, as: 'messages' }, 'createdAt', 'ASC'],
      [{ model: ComplaintStatusHistory, as: 'statusHistory' }, 'createdAt', 'ASC']
    ]
  });

  if (!complaint) {
    throw httpError(404, 'Complaint not found');
  }

  const plain = complaint.get({ plain: true });

  plain.messages = complaint.messages.map(publicMessage);
  plain.statusHistory = plain.statusHistory.map((entry) => ({
    historyId: entry.historyId,
    fromStatus: entry.fromStatus,
    toStatus: entry.toStatus,
    note: entry.note,
    createdAt: entry.createdAt
  }));

  return ok(res, 'Complaint retrieved', plain);
}

// VIVA CRUD CREATE – customer reply (POST /api/v1/my/complaints/:id/messages)
export async function addMyMessage(req, res) {
  const complaint = await Complaint.findOne({
    where: {
      complaintId: req.params.id,
      customerId: req.user.userId
    }
  });

  if (!complaint) {
    throw httpError(404, 'Complaint not found');
  }

  if (complaint.status === 'Closed') {
    throw httpError(409, 'This complaint is closed. Reopen it to add a new message.');
  }

  const message = await sequelize.transaction(async (transaction) => {
    const created = await ComplaintMessage.create(
      {
        complaintId: complaint.complaintId,
        authorId: req.user.userId,
        authorRole: 'Customer',
        body: req.validated.body.body,
        isInternal: false,
        source: 'Web'
      },
      { transaction }
    );

    await complaint.update({ lastActivityAt: new Date() }, { transaction });

    return created;
  });

  await logActivity(req, 'complaint.customer_message', 'Complaint', complaint.complaintId, `${complaint.reference}: customer added a message`);

  await notifyAdmin(
    complaint,
    'complaint-message',
    `complaint-${complaint.complaintId}-customer-msg-${message.messageId}`,
    `Customer reply on ${complaint.reference}`,
    [`${req.user.name} wrote:`, req.validated.body.body].join('\n\n'),
    req,
    req.user.email
  );

  message.setDataValue('author', { name: req.user.name });

  return res.status(201).json({
    success: true,
    message: 'Your message was added',
    data: publicMessage(message),
    meta: {}
  });
}

// VIVA CRUD UPDATE – reopen within 30 days (PATCH /api/v1/my/complaints/:id/reopen)
export async function reopenMyComplaint(req, res) {
  const complaint = await Complaint.findOne({
    where: {
      complaintId: req.params.id,
      customerId: req.user.userId
    }
  });

  if (!complaint) {
    throw httpError(404, 'Complaint not found');
  }

  if (!['Resolved', 'Closed'].includes(complaint.status)) {
    throw httpError(409, 'Only resolved or closed complaints can be reopened');
  }

  const finishedAt = complaint.closedAt || complaint.resolvedAt || complaint.updatedAt;

  if (Date.now() - new Date(finishedAt).getTime() > REOPEN_WINDOW_DAYS * 86400000) {
    throw httpError(409, `Complaints can be reopened within ${REOPEN_WINDOW_DAYS} days. Please submit a new complaint.`);
  }

  const reason = req.validated.body.reason;
  const previous = complaint.status;

  await sequelize.transaction(async (transaction) => {
    await complaint.update(
      {
        status: 'Under Review',
        closedAt: null,
        reopenedCount: complaint.reopenedCount + 1,
        lastActivityAt: new Date()
      },
      { transaction }
    );

    await ComplaintMessage.create(
      {
        complaintId: complaint.complaintId,
        authorId: req.user.userId,
        authorRole: 'Customer',
        body: `Reopened: ${reason}`,
        isInternal: false
      },
      { transaction }
    );

    await recordStatus(complaint, previous, 'Under Review', req, `Reopened by customer: ${reason}`, transaction);
  });

  await logActivity(req, 'complaint.reopened', 'Complaint', complaint.complaintId, `${complaint.reference} reopened by customer`);

  await notifyAdmin(
    complaint,
    'complaint-message',
    `complaint-${complaint.complaintId}-reopen-${complaint.reopenedCount}`,
    `Complaint reopened: ${complaint.reference}`,
    `${req.user.name} reopened this complaint.\n\nReason: ${reason}`,
    req,
    req.user.email
  );

  return ok(res, 'Your complaint was reopened', complaint);
}

// VIVA CRUD UPDATE – customer confirms the resolution (PATCH /api/v1/my/complaints/:id/close)
export async function closeMyComplaint(req, res) {
  const complaint = await Complaint.findOne({
    where: {
      complaintId: req.params.id,
      customerId: req.user.userId
    }
  });

  if (!complaint) {
    throw httpError(404, 'Complaint not found');
  }

  if (complaint.status !== 'Resolved') {
    throw httpError(409, 'Only a resolved complaint can be confirmed and closed');
  }

  await sequelize.transaction(async (transaction) => {
    await complaint.update(
      {
        status: 'Closed',
        closedAt: new Date(),
        lastActivityAt: new Date()
      },
      { transaction }
    );

    await recordStatus(complaint, 'Resolved', 'Closed', req, 'Resolution confirmed by customer', transaction);
  });

  await logActivity(req, 'complaint.closed', 'Complaint', complaint.complaintId, `${complaint.reference} closed by customer`);

  return ok(res, 'Thank you. The complaint is now closed.', complaint);
}

/*
|--------------------------------------------------------------------------
| Management: list and read
|--------------------------------------------------------------------------
*/

// VIVA CRUD READ – staff/admin list, search, filters (GET /api/v1/complaints)
export async function listComplaints(req, res) {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const where = {};

  if (req.query.status) {
    const statuses = String(req.query.status)
      .split(',')
      .filter((status) => COMPLAINT_STATUSES.includes(status));

    if (statuses.length) {
      where.status = statuses;
    }
  }

  if (req.query.open === 'true') {
    where.status = OPEN_STATUSES;
  }

  for (const key of ['category', 'priority']) {
    if (req.query[key]) {
      where[key] = String(req.query[key]);
    }
  }

  if (req.user.role === 'Staff') {
    where.assignedTo = req.user.userId;
  } else if (req.query.assignedTo === 'unassigned') {
    where.assignedTo = null;
  } else if (req.query.assignedTo === 'me') {
    where.assignedTo = req.user.userId;
  } else if (Number(req.query.assignedTo) > 0) {
    where.assignedTo = Number(req.query.assignedTo);
  }

  if (req.query.dateFrom || req.query.dateTo) {
    where.createdAt = {};

    if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.dateFrom || '')) {
      where.createdAt[Op.gte] = new Date(`${req.query.dateFrom}T00:00:00`);
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.dateTo || '')) {
      where.createdAt[Op.lte] = new Date(`${req.query.dateTo}T23:59:59.999`);
    }
  }

  const customerWhere = {};

  if (req.query.search) {
    const raw = String(req.query.search).trim().slice(0, 100);
    const term = `%${escapeLike(raw)}%`;
    const prefix = `${escapeLike(raw)}%`;

    where[Op.or] = [
      { reference: { [Op.like]: prefix } },
      { reference: { [Op.like]: `%${escapeLike(raw.toUpperCase())}` } },
      { subject: { [Op.like]: term } },
      { description: { [Op.like]: term } },
      { '$customer.name$': { [Op.like]: term } },
      { '$customer.email$': { [Op.like]: term } }
    ];

    if (/^\d+$/.test(raw)) {
      where[Op.or].push({ complaintId: Number(raw) });
    }
  }

  const sorts = {
    newest: [['createdAt', 'DESC']],
    oldest: [['createdAt', 'ASC']],
    activity: [['lastActivityAt', 'DESC']],
    priority: [
      [sequelize.literal("FIELD(`Complaint`.`priority`, 'Urgent', 'High', 'Medium', 'Low')"), 'ASC'],
      ['createdAt', 'DESC']
    ],
    status: [
      [sequelize.literal("FIELD(`Complaint`.`status`, 'Submitted', 'Under Review', 'In Progress', 'Resolved', 'Closed')"), 'ASC'],
      ['createdAt', 'DESC']
    ],
    reference: [['reference', 'ASC']]
  };

  const result = await Complaint.findAndCountAll({
    where,
    include: [
      {
        model: User,
        as: 'customer',
        attributes: ['userId', 'name', 'email'],
        where: Object.keys(customerWhere).length ? customerWhere : undefined,
        required: false
      },
      { model: User, as: 'assignedStaff', attributes: ['userId', 'name'], required: false },
      { model: Vehicle, as: 'vehicle', attributes: ['vehicleId', 'make', 'model', 'year'], required: false, paranoid: false }
    ],
    order: sorts[req.query.sort] || sorts.newest,
    limit,
    offset: (page - 1) * limit,
    distinct: true,
    subQuery: false
  });

  // Status counts for the filter chips (respecting staff scope).
  const scope = req.user.role === 'Staff' ? { assignedTo: req.user.userId } : {};
  const statusRows = await Complaint.findAll({
    where: scope,
    attributes: ['status', [sequelize.fn('COUNT', sequelize.col('complaint_id')), 'total']],
    group: ['status'],
    raw: true
  });

  const statusCounts = Object.fromEntries(COMPLAINT_STATUSES.map((status) => [status, 0]));

  for (const row of statusRows) {
    statusCounts[row.status] = Number(row.total);
  }

  return ok(res, 'Complaints retrieved', result.rows, {
    page,
    limit,
    total: result.count,
    pages: Math.ceil(result.count / limit),
    statusCounts
  });
}

// VIVA CRUD READ – staff/admin details (GET /api/v1/complaints/:id)
export async function getComplaint(req, res) {
  const complaint = await Complaint.findByPk(req.params.id, {
    include: [
      ...customerIncludes,
      { model: User, as: 'customer', attributes: ['userId', 'name', 'email', 'phone'] },
      {
        model: ComplaintMessage,
        as: 'messages',
        required: false,
        include: [{ model: User, as: 'author', attributes: ['userId', 'name', 'role'] }]
      },
      {
        model: ComplaintStatusHistory,
        as: 'statusHistory',
        required: false,
        include: [{ model: User, as: 'changedByUser', attributes: ['name'] }]
      },
      {
        model: Document,
        as: 'documents',
        required: false,
        include: [{ model: User, as: 'uploader', attributes: ['name', 'role'] }]
      }
    ],
    order: [
      [{ model: ComplaintMessage, as: 'messages' }, 'createdAt', 'ASC'],
      [{ model: ComplaintStatusHistory, as: 'statusHistory' }, 'createdAt', 'ASC']
    ]
  });

  if (!complaint) {
    throw httpError(404, 'Complaint not found');
  }

  assertManagerAccess(complaint, req);

  const plain = complaint.get({ plain: true });

  if (req.user.role === 'Staff' && !req.permissions?.canViewAssignedContacts && plain.customer) {
    plain.customer = {
      userId: plain.customer.userId,
      name: plain.customer.name,
      email: null,
      phone: null
    };
  }

  plain.allowedTransitions = (TRANSITIONS[complaint.status] || []).filter(
    (status) => !(complaint.status === 'Closed' && req.user.role !== 'Admin')
  );

  return ok(res, 'Complaint retrieved', plain);
}

/*
|--------------------------------------------------------------------------
| Management: update status / details
|--------------------------------------------------------------------------
*/

// VIVA CRUD UPDATE – status / priority / category / resolution (PATCH /api/v1/complaints/:id)
export async function updateComplaint(req, res) {
  const complaint = await Complaint.findByPk(req.params.id, {
    include: [{ model: User, as: 'customer', attributes: ['userId', 'name', 'email'] }]
  });

  if (!complaint) {
    throw httpError(404, 'Complaint not found');
  }

  assertManagerAccess(complaint, req);

  const { status, priority, category, resolutionSummary, note, notifyCustomer: shouldNotify = true } = req.validated.body;
  const previous = complaint.status;
  const changes = {};

  if (priority) {
    changes.priority = priority;
  }

  if (category) {
    changes.category = category;
  }

  if (resolutionSummary !== undefined) {
    changes.resolutionSummary = resolutionSummary || null;
  }

  let statusChanged = false;

  if (status && status !== previous) {
    const allowed = TRANSITIONS[previous] || [];

    if (!allowed.includes(status)) {
      throw httpError(422, `A complaint cannot move from ${previous} to ${status}`);
    }

    if (previous === 'Closed' && req.user.role !== 'Admin') {
      throw httpError(403, 'Only an Admin can reopen a closed complaint');
    }

    if (status === 'Resolved' && !(changes.resolutionSummary || complaint.resolutionSummary)) {
      throw httpError(422, 'Add a resolution summary before marking the complaint as Resolved');
    }

    changes.status = status;
    statusChanged = true;

    if (status === 'Resolved') {
      changes.resolvedAt = new Date();
      changes.closedAt = null;
    } else if (status === 'Closed') {
      changes.closedAt = new Date();
    } else {
      changes.closedAt = null;

      if (previous === 'Resolved' || previous === 'Closed') {
        changes.resolvedAt = null;
        changes.reopenedCount = complaint.reopenedCount + 1;
      }
    }
  }

  if (!Object.keys(changes).length) {
    throw httpError(422, 'No changes were provided');
  }

  changes.lastActivityAt = new Date();

  let history = null;

  await sequelize.transaction(async (transaction) => {
    await complaint.update(changes, { transaction });

    if (statusChanged) {
      history = await recordStatus(complaint, previous, status, req, note, transaction);
    }

    await logActivity(
      req,
      statusChanged ? 'complaint.status_changed' : 'complaint.updated',
      'Complaint',
      complaint.complaintId,
      statusChanged ? `${complaint.reference}: ${previous} → ${status}` : `${complaint.reference} details updated`,
      transaction
    );
  });

  let emailResult = null;

  if (statusChanged && shouldNotify) {
    const lines = [
      `Dear ${complaint.customer?.name || 'customer'},`,
      `The status of your complaint ${complaint.reference} ("${complaint.subject}") has changed from ${previous} to ${status}.`
    ];

    if (status === 'Resolved' && complaint.resolutionSummary) {
      lines.push(`Resolution:\n${complaint.resolutionSummary}`);
      lines.push('If you are satisfied, you can confirm and close the complaint from your account. If not, reply to this email or reopen it within 30 days.');
    }

    if (note) {
      lines.push(`Note from our team:\n${note}`);
    }

    lines.push(portalLine(), 'High Street (PVT) Ltd.');

    emailResult = await notifyCustomer(
      complaint,
      complaint.customer,
      'complaint-status',
      `complaint-${complaint.complaintId}-status-${history.historyId}`,
      `Complaint ${complaint.reference} is now ${status}`,
      lines.join('\n\n'),
      req
    );
  }

  return ok(res, statusChanged ? `Complaint moved to ${status}` : 'Complaint updated', complaint, {
    emailStatus: emailResult?.status || null
  });
}

// VIVA CRUD UPDATE – assign to staff (PATCH /api/v1/complaints/:id/assign)
export async function assignComplaint(req, res) {
  const complaint = await Complaint.findByPk(req.params.id);

  if (!complaint) {
    throw httpError(404, 'Complaint not found');
  }

  const { staffId } = req.validated.body;

  if (staffId === null) {
    await complaint.update({ assignedTo: null, assignedAt: null, lastActivityAt: new Date() });
    await logActivity(req, 'complaint.unassigned', 'Complaint', complaint.complaintId, `${complaint.reference} unassigned`);

    return ok(res, 'Assignment removed', complaint);
  }

  const assignee = await User.findOne({
    where: {
      userId: staffId,
      role: ['Staff', 'Admin'],
      isActive: true
    }
  });

  if (!assignee) {
    throw httpError(422, 'Select an active Staff or Admin account');
  }

  if (assignee.role === 'Staff') {
    const permissions = await StaffPermission.findOne({
      where: { userId: assignee.userId, canManageComplaints: true }
    });

    if (!permissions) {
      throw httpError(422, 'The selected Staff account does not have complaint-management permission');
    }
  }

  const previous = complaint.status;

  await sequelize.transaction(async (transaction) => {
    await complaint.update(
      {
        assignedTo: assignee.userId,
        assignedAt: new Date(),
        status: previous === 'Submitted' ? 'Under Review' : previous,
        lastActivityAt: new Date()
      },
      { transaction }
    );

    if (previous === 'Submitted') {
      await recordStatus(complaint, previous, 'Under Review', req, `Assigned to ${assignee.name}`, transaction);
    }

    await logActivity(req, 'complaint.assigned', 'Complaint', complaint.complaintId, `${complaint.reference} assigned to ${assignee.name}`, transaction);
  });

  return ok(res, `Complaint assigned to ${assignee.name}`, complaint);
}

/*
|--------------------------------------------------------------------------
| Management: responses and internal notes
|--------------------------------------------------------------------------
*/

// VIVA CRUD CREATE – staff reply or internal note (POST /api/v1/complaints/:id/messages)
export async function addComplaintMessage(req, res) {
  const complaint = await Complaint.findByPk(req.params.id, {
    include: [{ model: User, as: 'customer', attributes: ['userId', 'name', 'email'] }]
  });

  if (!complaint) {
    throw httpError(404, 'Complaint not found');
  }

  assertManagerAccess(complaint, req);

  const { body, isInternal } = req.validated.body;

  if (!isInternal && complaint.status === 'Closed') {
    throw httpError(409, 'Reopen the complaint before sending a response to the customer');
  }

  const message = await sequelize.transaction(async (transaction) => {
    const created = await ComplaintMessage.create(
      {
        complaintId: complaint.complaintId,
        authorId: req.user.userId,
        authorRole: req.user.role === 'Admin' ? 'Admin' : 'Staff',
        body,
        isInternal: Boolean(isInternal),
        source: 'Web'
      },
      { transaction }
    );

    const changes = { lastActivityAt: new Date() };

    // The first customer-facing response moves a new complaint forward.
    if (!isInternal && ['Submitted', 'Under Review'].includes(complaint.status)) {
      changes.status = 'In Progress';
      await recordStatus(complaint, complaint.status, 'In Progress', req, 'Response sent to customer', transaction);
    }

    await complaint.update(changes, { transaction });

    await logActivity(
      req,
      isInternal ? 'complaint.internal_note' : 'complaint.response',
      'Complaint',
      complaint.complaintId,
      `${complaint.reference}: ${isInternal ? 'internal note added' : 'response sent to customer'}`,
      transaction
    );

    return created;
  });

  let emailResult = null;

  if (!isInternal) {
    emailResult = await notifyCustomer(
      complaint,
      complaint.customer,
      'complaint-message',
      `complaint-${complaint.complaintId}-msg-${message.messageId}`,
      `Update on your complaint ${complaint.reference}`,
      [
        `Dear ${complaint.customer?.name || 'customer'},`,
        body,
        'You can reply directly to this email and your message will be added to the complaint.',
        portalLine(),
        `${req.user.name}\nHigh Street (PVT) Ltd.`
      ].join('\n\n'),
      req
    );
  }

  const created = await ComplaintMessage.findByPk(message.messageId, {
    include: [{ model: User, as: 'author', attributes: ['userId', 'name', 'role'] }]
  });

  return res.status(201).json({
    success: true,
    message: isInternal
      ? 'Internal note saved'
      : emailResult?.delivered
        ? 'Response saved and the email was accepted by the mail server'
        : emailResult?.status === 'Queued'
          ? 'Response saved and queued for email delivery'
          : emailResult?.status === 'Preview'
            ? 'Response saved. Email was not sent because SMTP is not configured'
            : 'Response saved, but the email could not be sent',
    data: created,
    meta: {
      emailStatus: emailResult?.status || null,
      emailError: emailResult?.error || null
    }
  });
}

/*
|--------------------------------------------------------------------------
| Admin: delete a complaint permanently
|--------------------------------------------------------------------------
*/

// VIVA CRUD DELETE – Admin deletes with messages, history and files (DELETE /api/v1/complaints/:id)
export async function deleteComplaint(req, res) {
  const complaint = await Complaint.findByPk(req.params.id);

  if (!complaint) {
    throw httpError(404, 'Complaint not found');
  }

  const documents = await Document.unscoped().findAll({
    where: { complaintId: complaint.complaintId }
  });

  await sequelize.transaction(async (transaction) => {
    await logActivity(req, 'complaint.deleted', 'Complaint', complaint.complaintId, `${complaint.reference} permanently deleted`, transaction);
    await complaint.destroy({ transaction });
  });

  // Database rows are gone (documents cascade); remove the stored files.
  for (const document of documents) {
    await removeStoredDocument(document.storageKey).catch((error) => {
      console.error('[document cleanup]', document.documentId, error.message);
    });
  }

  return ok(res, `Complaint ${complaint.reference} permanently deleted`);
}

export { canManage as canManageComplaints, TRANSITIONS as COMPLAINT_TRANSITIONS };
