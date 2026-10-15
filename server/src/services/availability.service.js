/*
|--------------------------------------------------------------------------
| VIVA – M.R.M. Amri – Staff availability for test-drive bookings
|--------------------------------------------------------------------------
| A Staff member can be assigned to a test drive only when ALL of these
| are true:
|   1. the account is an active Staff account;
|   2. they have the "Manage bookings" permission (otherwise they could
|      not open the booking);
|   3. they are not on leave that day (staff_leave, marked by an Admin);
|   4. they have no other Pending/Confirmed test drive within
|      TEST_DRIVE_SLOT_MINUTES (default 60) of the booking time.
| The same check is used by the drop-down (to show "Not available" and
| the reason) and by PATCH /bookings/:id/assign (which refuses with 422),
| so the rule cannot be bypassed.
*/

import { Op } from 'sequelize';

import { StaffLeave, StaffPermission, TestDriveBooking, User } from '../models/index.js';

export const SLOT_MINUTES = Math.max(15, Number(process.env.TEST_DRIVE_SLOT_MINUTES) || 60);

const ACTIVE_BOOKING = ['Pending', 'Confirmed'];

export const toMinutes = (time) => {
  const [hours, minutes] = String(time || '').split(':').map(Number);
  return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
};

const shortTime = (time) => String(time || '').slice(0, 5);

export const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

/* Every Staff account with its permission record (one query). */
export async function loadStaff({ activeOnly = true, staffIds } = {}) {
  const where = { role: 'Staff' };

  if (activeOnly) where.isActive = true;
  if (staffIds) where.userId = { [Op.in]: staffIds };

  return User.findAll({
    where,
    attributes: ['userId', 'name', 'email', 'isActive', 'lockedUntil', 'mustChangePassword'],
    include: [{ model: StaffPermission, as: 'permissions', required: false }],
    order: [['name', 'ASC']]
  });
}

/* Leave and active bookings for these Staff members on these dates. */
export async function loadSchedule(staffIds, dates) {
  if (!staffIds.length || !dates.length) {
    return { leave: [], bookings: [] };
  }

  const sorted = [...dates].sort();

  const [leave, bookings] = await Promise.all([
    StaffLeave.findAll({
      where: {
        staffId: { [Op.in]: staffIds },
        startDate: { [Op.lte]: sorted[sorted.length - 1] },
        endDate: { [Op.gte]: sorted[0] }
      },
      order: [['startDate', 'ASC']]
    }),
    TestDriveBooking.findAll({
      where: {
        assignedTo: { [Op.in]: staffIds },
        preferredDate: { [Op.in]: dates },
        status: { [Op.in]: ACTIVE_BOOKING }
      },
      attributes: ['bookingId', 'assignedTo', 'preferredDate', 'preferredTime', 'vehicleReference', 'status'],
      order: [['preferredTime', 'ASC']]
    })
  ]);

  return { leave, bookings };
}

export const leaveOn = (leave, staffId, date) =>
  leave.find((entry) => entry.staffId === staffId && entry.startDate <= date && entry.endDate >= date) || null;

/*
| Is this Staff member free for this booking?
| → { available: true } or { available: false, code, reason }
*/
export function evaluate(staff, booking, schedule) {
  if (!staff.isActive) {
    return { available: false, code: 'inactive', reason: 'Account is inactive' };
  }

  if (!staff.permissions?.canManageBookings) {
    return { available: false, code: 'no_permission', reason: 'No "Manage bookings" permission' };
  }

  const leave = leaveOn(schedule.leave, staff.userId, booking.preferredDate);

  if (leave) {
    return { available: false, code: 'on_leave', reason: `On leave${leave.reason ? ` (${leave.reason})` : ''}` };
  }

  const start = toMinutes(booking.preferredTime);
  const clash = schedule.bookings.find(
    (other) =>
      other.assignedTo === staff.userId &&
      other.bookingId !== booking.bookingId &&
      other.preferredDate === booking.preferredDate &&
      Math.abs(toMinutes(other.preferredTime) - start) < SLOT_MINUTES
  );

  if (clash) {
    return {
      available: false,
      code: 'busy',
      reason: `Busy: test drive #${clash.bookingId} at ${shortTime(clash.preferredTime)}`,
      clashBookingId: clash.bookingId
    };
  }

  return { available: true, code: 'available', reason: 'Available' };
}

/* Availability of every active Staff member for each of these bookings. */
export async function availabilityForBookings(bookings) {
  const staff = await loadStaff();
  const schedule = await loadSchedule(
    staff.map((member) => member.userId),
    [...new Set(bookings.map((booking) => booking.preferredDate))]
  );

  return {
    staff: staff.map((member) => ({ userId: member.userId, name: member.name, email: member.email })),
    bookings: Object.fromEntries(
      bookings.map((booking) => [
        booking.bookingId,
        Object.fromEntries(staff.map((member) => [member.userId, evaluate(member, booking, schedule)]))
      ])
    ),
    slotMinutes: SLOT_MINUTES
  };
}

/* One Staff member for one booking (used by the assign endpoint). */
export async function checkAssignable(staffId, booking) {
  const [staff] = await loadStaff({ activeOnly: false, staffIds: [staffId] });

  if (!staff) {
    return { staff: null, result: { available: false, code: 'invalid', reason: 'The selected staff account is invalid or inactive' } };
  }

  const schedule = await loadSchedule([staffId], [booking.preferredDate]);

  return { staff, result: evaluate(staff, booking, schedule) };
}

/* "Today" line on the Staff Permissions cards: leave + test drives that day. */
export async function dayStatus(date, staffIds) {
  const schedule = await loadSchedule(staffIds, [date]);

  return Object.fromEntries(
    staffIds.map((staffId) => {
      const leave = leaveOn(schedule.leave, staffId, date);
      const times = schedule.bookings.filter((booking) => booking.assignedTo === staffId).map((booking) => shortTime(booking.preferredTime));

      return [
        staffId,
        {
          date,
          onLeave: Boolean(leave),
          leaveReason: leave?.reason || null,
          leaveUntil: leave?.endDate || null,
          testDrives: times,
          state: leave ? 'On leave' : times.length ? 'Busy' : 'Available'
        }
      ];
    })
  );
}
