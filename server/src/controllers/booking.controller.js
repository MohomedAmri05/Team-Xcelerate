/*
|--------------------------------------------------------------------------
| VIVA-HEADER – M.R.M. Amri – Vehicle Inventory
| CRUD resource 4: Test-Drive Bookings (table `test_drive_bookings`)
|--------------------------------------------------------------------------
|   CREATE  createBooking        POST /api/v1/bookings
|   READ    listMyBookings       GET /api/v1/my/bookings
|   READ    getMyBooking         GET /api/v1/my/bookings/:id
|   UPDATE  rescheduleMyBooking  PATCH /api/v1/my/bookings/:id
|   UPDATE  cancelMyBooking      PATCH /api/v1/my/bookings/:id/cancel
|   READ    listBookings         GET /api/v1/bookings
|   READ    getBooking           GET /api/v1/bookings/:id
|   UPDATE  updateBooking        PATCH /api/v1/bookings/:id
|   UPDATE  assignBooking        PATCH /api/v1/bookings/:id/assign
|           (only a Staff member who is available at that date and time –
|            services/availability.service.js)
|   DELETE  deleteBooking        DELETE /api/v1/bookings/:id
| Staff availability (Admin, October 2026):
|   READ    bookingStaffAvailability GET /api/v1/bookings/staff-availability?ids=
|   READ    staffDayAvailability     GET /api/v1/staff-availability?date=
|   CREATE  createStaffLeave         POST /api/v1/staff-leave
|   READ    listStaffLeave           GET /api/v1/staff-leave
|   DELETE  deleteStaffLeave         DELETE /api/v1/staff-leave/:id
| Every write goes through Sequelize to MySQL/MariaDB and is recorded in
| activity_logs (services/activity.service.js) where it changes data.
*/

import {
  Op
} from 'sequelize';

import {
  TestDriveBooking,
  User,
  Vehicle,
  VehicleImage
} from '../models/index.js';

import {
  ok
} from '../middleware/core.js';

import {
  Document
} from '../models/index.js';

import {
  getAdminRecipient,
  queueMail
} from '../services/mail.service.js';

import {
  logActivity
} from '../services/activity.service.js';

import {
  removeStoredDocument
} from '../services/file.service.js';

import {
  availabilityForBookings,
  checkAssignable,
  dayStatus,
  isDate
} from '../services/availability.service.js';

import { StaffLeave } from '../models/index.js';

const formatSlot = (booking) =>
  `${booking.preferredDate} at ${String(booking.preferredTime || '').slice(0, 5)}`;

async function emailCustomer(booking, customer, template, key, subject, text, req) {
  if (!customer?.email) {
    return null;
  }

  return queueMail(
    {
      to: customer.email,
      subject: `${subject} [HS-TD-${booking.bookingId}]`,
      heading: subject,
      text
    },
    {
      messageKey: key,
      template,
      relatedType: 'Booking',
      relatedId: booking.bookingId,
      createdBy: req.user?.userId || null
    }
  );
}

async function emailAdmin(booking, key, subject, text, req, replyTo) {
  const recipient = getAdminRecipient();

  if (!recipient) {
    return null;
  }

  return queueMail(
    {
      to: recipient,
      replyTo,
      subject: `${subject} [HS-TD-${booking.bookingId}]`,
      heading: subject,
      text
    },
    {
      messageKey: key,
      template: 'booking-admin',
      relatedType: 'Booking',
      relatedId: booking.bookingId,
      createdBy: req.user?.userId || null
    }
  );
}

const bookingIncludes = [
  {
    model: Vehicle,
    as: 'vehicle',
    required: false,
    paranoid: false,

    include: [
      {
        model: VehicleImage,
        as: 'images',
        required: false
      }
    ]
  },

  {
    model: User,
    as: 'customer',
    required: false,
    attributes: [
      'userId',
      'name',
      'email',
      'phone'
    ]
  },

  {
    model: User,
    as: 'assignedStaff',
    required: false,
    attributes: [
      'userId',
      'name',
      'email'
    ]
  }
];

function parseBookingId(req) {
  const bookingId =
    Number(req.params.id);

  if (
    !Number.isInteger(bookingId) ||
    bookingId <= 0
  ) {
    return null;
  }

  return bookingId;
}

async function findOperationalBooking(
  req,
  bookingId
) {
  const where = {
    bookingId
  };

  if (req.user.role === 'Staff') {
    where.assignedTo =
      req.user.userId;
  }

  return TestDriveBooking.findOne({
    where,
    include: bookingIncludes
  });
}

/*
|--------------------------------------------------------------------------
| Customer Creates a Test-Drive Booking
|--------------------------------------------------------------------------
*/

// VIVA CRUD CREATE – customer requests a test drive (POST /api/v1/bookings)
export async function createBooking(
  req,
  res
) {
  const {
    vehicleId,
    preferredDate,
    preferredTime,
    customerNote
  } = req.validated.body;

  const vehicle =
    await Vehicle.findOne({
      where: {
        vehicleId,
        status: 'Available'
      }
    });

  if (!vehicle) {
    return res.status(404).json({
      success: false,
      message:
        'This vehicle is not available for a test drive',
      errors: []
    });
  }

  const existingBooking =
    await TestDriveBooking.findOne({
      where: {
        customerId:
          req.user.userId,

        vehicleId,

        status: {
          [Op.in]: [
            'Pending',
            'Confirmed'
          ]
        }
      }
    });

  if (existingBooking) {
    return res.status(409).json({
      success: false,
      message:
        'You already have an active test-drive booking for this vehicle',
      errors: []
    });
  }

  const booking =
    await TestDriveBooking.create({
      customerId:
        req.user.userId,

      vehicleId:
        vehicle.vehicleId,

      vehicleReference:
        `${vehicle.year} ${vehicle.make} ${vehicle.model}`,

      preferredDate,
      preferredTime,

      customerNote:
        customerNote || null,

      status: 'Pending'
    });

  const createdBooking =
    await TestDriveBooking.findByPk(
      booking.bookingId,
      {
        include: bookingIncludes
      }
    );

  await logActivity(
    req,
    'booking.created',
    'Booking',
    booking.bookingId,
    `Test drive requested for ${booking.vehicleReference} on ${formatSlot(booking)}`
  );

  const confirmation = await emailCustomer(
    booking,
    req.user,
    'booking-request',
    `booking-${booking.bookingId}-request`,
    'Your test-drive request was received',
    [
      `Dear ${req.user.name},`,
      `Thank you for requesting a test drive of the ${booking.vehicleReference}.`,
      `Requested slot: ${formatSlot(booking)}`,
      'This is a request only. A member of the High Street team will confirm the appointment by email. You can track it from "Test drives" in your account.',
      'High Street (PVT) Ltd.'
    ].join('\n\n'),
    req
  );

  await emailAdmin(
    booking,
    `booking-${booking.bookingId}-admin`,
    `New test-drive request: ${booking.vehicleReference}`,
    [
      `Customer: ${req.user.name} <${req.user.email}>${req.user.phone ? `, ${req.user.phone}` : ''}`,
      `Vehicle: ${booking.vehicleReference}`,
      `Requested slot: ${formatSlot(booking)}`,
      booking.customerNote ? `Note: ${booking.customerNote}` : ''
    ].filter(Boolean).join('\n'),
    req,
    req.user.email
  );

  return res.status(201).json({
    success: true,
    message:
      'Your test-drive request was submitted successfully',
    data: createdBooking,
    meta: {
      emailStatus: confirmation?.status || null
    }
  });
}

/*
|--------------------------------------------------------------------------
| Customer Views Their Own Bookings
|--------------------------------------------------------------------------
*/

// VIVA CRUD READ – customer: own bookings (GET /api/v1/my/bookings)
export async function listMyBookings(
  req,
  res
) {
  const bookings =
    await TestDriveBooking.findAll({
      where: {
        customerId:
          req.user.userId
      },

      include: bookingIncludes,

      order: [
        ['createdAt', 'DESC']
      ]
    });

  return ok(
    res,
    'Your test-drive bookings were retrieved',
    bookings
  );
}

// VIVA CRUD READ – customer: one booking (GET /api/v1/my/bookings/:id)
export async function getMyBooking(
  req,
  res
) {
  const bookingId =
    parseBookingId(req);

  if (!bookingId) {
    return res.status(422).json({
      success: false,
      message: 'Invalid booking ID',
      errors: []
    });
  }

  const booking =
    await TestDriveBooking.findOne({
      where: {
        bookingId,
        customerId:
          req.user.userId
      },

      include: bookingIncludes
    });

  if (!booking) {
    return res.status(404).json({
      success: false,
      message: 'Booking not found',
      errors: []
    });
  }

  return ok(
    res,
    'Booking retrieved',
    booking
  );
}

/*
|--------------------------------------------------------------------------
| Customer Cancels Their Own Booking
|--------------------------------------------------------------------------
*/

// VIVA CRUD UPDATE – customer cancels (PATCH /api/v1/my/bookings/:id/cancel)
export async function cancelMyBooking(
  req,
  res
) {
  const bookingId =
    parseBookingId(req);

  if (!bookingId) {
    return res.status(422).json({
      success: false,
      message: 'Invalid booking ID',
      errors: []
    });
  }

  const booking =
    await TestDriveBooking.findOne({
      where: {
        bookingId,
        customerId:
          req.user.userId
      }
    });

  if (!booking) {
    return res.status(404).json({
      success: false,
      message: 'Booking not found',
      errors: []
    });
  }

  if (
    ![
      'Pending',
      'Confirmed'
    ].includes(booking.status)
  ) {
    return res.status(409).json({
      success: false,
      message:
        'Only pending or confirmed bookings can be cancelled',
      errors: []
    });
  }

  await booking.update({
    status: 'Cancelled',
    cancelledAt: new Date()
  });

  await logActivity(
    req,
    'booking.cancelled',
    'Booking',
    booking.bookingId,
    `Customer cancelled test drive #${booking.bookingId}`
  );

  await emailAdmin(
    booking,
    `booking-${booking.bookingId}-customer-cancel`,
    `Test drive cancelled by customer: ${booking.vehicleReference}`,
    `${req.user.name} cancelled the test drive planned for ${formatSlot(booking)}.`,
    req,
    req.user.email
  );

  return ok(
    res,
    'Your test-drive booking was cancelled',
    booking
  );
}

/*
|--------------------------------------------------------------------------
| Customer reschedules a pending booking
|--------------------------------------------------------------------------
*/

// VIVA CRUD UPDATE – customer changes date/time while Pending (PATCH /api/v1/my/bookings/:id)
export async function rescheduleMyBooking(
  req,
  res
) {
  const bookingId =
    parseBookingId(req);

  if (!bookingId) {
    return res.status(422).json({
      success: false,
      message: 'Invalid booking ID',
      errors: []
    });
  }

  const booking =
    await TestDriveBooking.findOne({
      where: {
        bookingId,
        customerId:
          req.user.userId
      }
    });

  if (!booking) {
    return res.status(404).json({
      success: false,
      message: 'Booking not found',
      errors: []
    });
  }

  if (booking.status !== 'Pending') {
    return res.status(409).json({
      success: false,
      message:
        'Only pending requests can be changed. Please contact the showroom about confirmed appointments.',
      errors: []
    });
  }

  const {
    preferredDate,
    preferredTime,
    customerNote
  } = req.validated.body;

  await booking.update({
    preferredDate,
    preferredTime,
    customerNote:
      customerNote || null
  });

  await logActivity(
    req,
    'booking.rescheduled',
    'Booking',
    booking.bookingId,
    `Test drive #${booking.bookingId} moved to ${formatSlot(booking)}`
  );

  await emailAdmin(
    booking,
    `booking-${booking.bookingId}-reschedule-${Date.now()}`,
    `Test-drive request changed: ${booking.vehicleReference}`,
    `${req.user.name} changed the requested slot to ${formatSlot(booking)}.`,
    req,
    req.user.email
  );

  const updated =
    await TestDriveBooking.findByPk(
      booking.bookingId,
      {
        include: bookingIncludes
      }
    );

  return ok(
    res,
    'Your test-drive request was updated',
    updated
  );
}

/*
|--------------------------------------------------------------------------
| Admin and Assigned Staff View Bookings
|--------------------------------------------------------------------------
*/

// VIVA CRUD READ – staff/admin list (GET /api/v1/bookings)
export async function listBookings(
  req,
  res
) {
  const where = {};

  if (req.user.role === 'Staff') {
    where.assignedTo =
      req.user.userId;
  }

  if (req.query.status) {
    where.status =
      req.query.status;
  }

  if (req.query.date) {
    where.preferredDate =
      req.query.date;
  }

  const bookings =
    await TestDriveBooking.findAll({
      where,
      include: bookingIncludes,

      order: [
        ['createdAt', 'DESC']
      ]
    });

  return ok(
    res,
    'Test-drive bookings retrieved',
    bookings
  );
}

// VIVA CRUD READ – staff/admin details (GET /api/v1/bookings/:id)
export async function getBooking(
  req,
  res
) {
  const bookingId =
    parseBookingId(req);

  if (!bookingId) {
    return res.status(422).json({
      success: false,
      message: 'Invalid booking ID',
      errors: []
    });
  }

  const booking =
    await findOperationalBooking(
      req,
      bookingId
    );

  if (!booking) {
    return res.status(404).json({
      success: false,
      message:
        'Booking not found or not assigned to you',
      errors: []
    });
  }

  return ok(
    res,
    'Test-drive booking retrieved',
    booking
  );
}

/*
|--------------------------------------------------------------------------
| Admin or Assigned Staff Updates Booking
|--------------------------------------------------------------------------
*/

// VIVA CRUD UPDATE – confirm / complete / cancel + note (PATCH /api/v1/bookings/:id)
export async function updateBooking(
  req,
  res
) {
  const bookingId =
    parseBookingId(req);

  if (!bookingId) {
    return res.status(422).json({
      success: false,
      message: 'Invalid booking ID',
      errors: []
    });
  }

  const booking =
    await findOperationalBooking(
      req,
      bookingId
    );

  if (!booking) {
    return res.status(404).json({
      success: false,
      message:
        'Booking not found or not assigned to you',
      errors: []
    });
  }

  const {
    status,
    staffNote
  } = req.validated.body;

  const timestampChanges = {
    confirmedAt:
      status === 'Confirmed'
        ? new Date()
        : booking.confirmedAt,

    completedAt:
      status === 'Completed'
        ? new Date()
        : booking.completedAt,

    cancelledAt:
      status === 'Cancelled'
        ? new Date()
        : booking.cancelledAt
  };

  const previousStatus =
    booking.status;

  await booking.update({
    status,
    staffNote:
      staffNote || null,
    ...timestampChanges
  });

  await logActivity(
    req,
    previousStatus === status
      ? 'booking.updated'
      : 'booking.status_changed',
    'Booking',
    booking.bookingId,
    previousStatus === status
      ? `Test drive #${booking.bookingId} note updated`
      : `Test drive #${booking.bookingId}: ${previousStatus} → ${status}`
  );

  let emailResult = null;

  if (
    previousStatus !== status &&
    status !== 'Pending'
  ) {
    const wording = {
      Confirmed: `Good news — your test drive of the ${booking.vehicleReference} is confirmed for ${formatSlot(booking)}. Please bring your driving licence to the showroom.`,
      Completed: `Thank you for test-driving the ${booking.vehicleReference}. We hope you enjoyed it — reply to this email if you have any questions.`,
      Cancelled: `Your test drive of the ${booking.vehicleReference} planned for ${formatSlot(booking)} has been cancelled.`
    };

    emailResult = await emailCustomer(
      booking,
      booking.customer,
      'booking-status',
      `booking-${booking.bookingId}-status-${status}-${Date.now()}`,
      `Test drive ${status.toLowerCase()}: ${booking.vehicleReference}`,
      [
        `Dear ${booking.customer?.name || 'customer'},`,
        wording[status],
        staffNote ? `Message from High Street:\n${staffNote}` : '',
        'High Street (PVT) Ltd.'
      ].filter(Boolean).join('\n\n'),
      req
    );
  }

  return ok(
    res,
    'Test-drive booking updated',
    booking,
    {
      emailStatus:
        emailResult?.status || null
    }
  );
}

/*
|--------------------------------------------------------------------------
| Admin Assigns Booking to Staff
|--------------------------------------------------------------------------
*/

// VIVA CRUD UPDATE – assign to staff (PATCH /api/v1/bookings/:id/assign)
export async function assignBooking(
  req,
  res
) {
  const bookingId =
    parseBookingId(req);

  if (!bookingId) {
    return res.status(422).json({
      success: false,
      message: 'Invalid booking ID',
      errors: []
    });
  }

  const booking =
    await TestDriveBooking.findByPk(
      bookingId
    );

  if (!booking) {
    return res.status(404).json({
      success: false,
      message: 'Booking not found',
      errors: []
    });
  }

  const {
    assignedTo
  } = req.validated.body;

  if (assignedTo !== null) {
    const staff =
      await User.findOne({
        where: {
          userId: assignedTo,
          role: 'Staff',
          isActive: true
        }
      });

    if (!staff) {
      return res.status(422).json({
        success: false,
        message:
          'The selected staff account is invalid or inactive',
        errors: []
      });
    }

    // VIVA – Amri – availability rule: permission, leave day, time clash.
    const { result } = await checkAssignable(staff.userId, booking);

    if (!result.available) {
      return res.status(422).json({
        success: false,
        message: `${staff.name} is not available for this test drive: ${result.reason}.`,
        errors: [],
        meta: { code: result.code }
      });
    }
  }

  await booking.update({
    assignedTo
  });

  await logActivity(
    req,
    'booking.assigned',
    'Booking',
    booking.bookingId,
    assignedTo === null
      ? `Test drive #${booking.bookingId} unassigned`
      : `Test drive #${booking.bookingId} assigned to staff #${assignedTo}`
  );

  return ok(
    res,
    assignedTo === null
      ? 'Staff assignment removed'
      : 'Booking assigned to staff',
    booking
  );
}

/*
|--------------------------------------------------------------------------
| Admin Permanently Deletes Booking
|--------------------------------------------------------------------------
*/

// VIVA CRUD DELETE – Admin deletes the booking and its documents (DELETE /api/v1/bookings/:id)
export async function deleteBooking(
  req,
  res
) {
  const bookingId =
    parseBookingId(req);

  if (!bookingId) {
    return res.status(422).json({
      success: false,
      message: 'Invalid booking ID',
      errors: []
    });
  }

  const booking =
    await TestDriveBooking.findByPk(
      bookingId
    );

  if (!booking) {
    return res.status(404).json({
      success: false,
      message: 'Booking not found',
      errors: []
    });
  }

  const documents =
    await Document.unscoped().findAll({
      where: {
        bookingId:
          booking.bookingId
      }
    });

  await booking.destroy();

  for (const document of documents) {
    await removeStoredDocument(
      document.storageKey
    ).catch(() => {});
  }

  await logActivity(
    req,
    'booking.deleted',
    'Booking',
    booking.bookingId,
    `Test drive #${booking.bookingId} permanently deleted`
  );

  return ok(
    res,
    'Test-drive booking permanently deleted'
  );
}
/*
|--------------------------------------------------------------------------
| VIVA – Amri – Staff availability (Admin)
|--------------------------------------------------------------------------
*/

// VIVA CRUD READ – who can take each of these bookings (GET /api/v1/bookings/staff-availability?ids=1,2)
export async function bookingStaffAvailability(req, res) {
  const ids = String(req.query.ids || '')
    .split(',')
    .map(Number)
    .filter((value) => Number.isInteger(value) && value > 0)
    .slice(0, 200);

  const bookings = ids.length
    ? await TestDriveBooking.findAll({
        where: { bookingId: { [Op.in]: ids } },
        attributes: ['bookingId', 'preferredDate', 'preferredTime', 'assignedTo', 'status']
      })
    : [];

  return ok(res, 'Staff availability retrieved', await availabilityForBookings(bookings));
}

// VIVA CRUD READ – each Staff member's day: leave and test drives (GET /api/v1/staff-availability?date=YYYY-MM-DD)
export async function staffDayAvailability(req, res) {
  const date = isDate(req.query.date) ? req.query.date : new Date().toISOString().slice(0, 10);
  const staff = await User.findAll({ where: { role: 'Staff' }, attributes: ['userId'] });

  return ok(res, 'Staff day availability retrieved', await dayStatus(date, staff.map((member) => member.userId)), { date });
}

const leaveIncludes = [
  { model: User, as: 'staff', attributes: ['userId', 'name', 'email', 'isActive'] },
  { model: User, as: 'creator', attributes: ['userId', 'name'] }
];

// VIVA CRUD READ – leave days (GET /api/v1/staff-leave?staffId=&upcoming=true)
export async function listStaffLeave(req, res) {
  const where = {};
  const staffId = Number(req.query.staffId);

  if (Number.isInteger(staffId) && staffId > 0) {
    where.staffId = staffId;
  }

  if (req.query.upcoming !== 'false') {
    where.endDate = { [Op.gte]: isDate(req.query.from) ? req.query.from : new Date().toISOString().slice(0, 10) };
  }

  const leave = await StaffLeave.findAll({
    where,
    include: leaveIncludes,
    order: [['startDate', 'ASC'], ['leaveId', 'ASC']],
    limit: 200
  });

  return ok(res, 'Staff leave retrieved', leave);
}

// VIVA CRUD CREATE – mark a Staff member as off (POST /api/v1/staff-leave)
export async function createStaffLeave(req, res) {
  const { staffId, startDate, endDate, reason } = req.validated.body;
  const staff = await User.findOne({ where: { userId: staffId, role: 'Staff' } });

  if (!staff) {
    return res.status(422).json({ success: false, message: 'Leave can only be added for a Staff account', errors: [] });
  }

  const overlap = await StaffLeave.findOne({
    where: { staffId, startDate: { [Op.lte]: endDate }, endDate: { [Op.gte]: startDate } }
  });

  if (overlap) {
    return res.status(409).json({
      success: false,
      message: `${staff.name} already has leave from ${overlap.startDate} to ${overlap.endDate}. Remove it first or choose other dates.`,
      errors: []
    });
  }

  const leave = await StaffLeave.create({ staffId, startDate, endDate, reason: reason || null, createdBy: req.user.userId });

  // Test drives already given to this Staff member in those days need a new person.
  const affected = await TestDriveBooking.findAll({
    where: { assignedTo: staffId, status: { [Op.in]: ['Pending', 'Confirmed'] }, preferredDate: { [Op.between]: [startDate, endDate] } },
    attributes: ['bookingId', 'preferredDate', 'preferredTime', 'vehicleReference'],
    order: [['preferredDate', 'ASC'], ['preferredTime', 'ASC']]
  });

  await logActivity(req, 'staff.leave_added', 'User', staffId, `Leave for ${staff.email}: ${startDate} to ${endDate}${reason ? ` (${reason})` : ''}`);

  return res.status(201).json({
    success: true,
    message: affected.length
      ? `Leave saved. ${staff.name} still has ${affected.length} test drive${affected.length === 1 ? '' : 's'} in those days – reassign ${affected.length === 1 ? 'it' : 'them'}.`
      : 'Leave saved',
    data: await StaffLeave.findByPk(leave.leaveId, { include: leaveIncludes }),
    meta: { affectedBookings: affected }
  });
}

// VIVA CRUD DELETE – remove a leave entry (DELETE /api/v1/staff-leave/:id)
export async function deleteStaffLeave(req, res) {
  const leave = await StaffLeave.findByPk(req.params.id, { include: leaveIncludes });

  if (!leave) {
    return res.status(404).json({ success: false, message: 'Leave entry not found', errors: [] });
  }

  await leave.destroy();
  await logActivity(req, 'staff.leave_removed', 'User', leave.staffId, `Leave removed for ${leave.staff?.email || `staff #${leave.staffId}`}: ${leave.startDate} to ${leave.endDate}`);

  return ok(res, 'Leave removed', { leaveId: leave.leaveId });
}
