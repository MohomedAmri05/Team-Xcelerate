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

  return res.status(201).json({
    success: true,
    message:
      'Your test-drive request was submitted successfully',
    data: createdBooking,
    meta: {}
  });
}

/*
|--------------------------------------------------------------------------
| Customer Views Their Own Bookings
|--------------------------------------------------------------------------
*/

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

  return ok(
    res,
    'Your test-drive booking was cancelled',
    booking
  );
}

/*
|--------------------------------------------------------------------------
| Admin and Assigned Staff View Bookings
|--------------------------------------------------------------------------
*/

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

  await booking.update({
    status,
    staffNote:
      staffNote || null,
    ...timestampChanges
  });

  return ok(
    res,
    'Test-drive booking updated',
    booking
  );
}

/*
|--------------------------------------------------------------------------
| Admin Assigns Booking to Staff
|--------------------------------------------------------------------------
*/

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
  }

  await booking.update({
    assignedTo
  });

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

  await booking.destroy();

  return ok(
    res,
    'Test-drive booking permanently deleted'
  );
}