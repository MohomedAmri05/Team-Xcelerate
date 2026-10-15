/*
|--------------------------------------------------------------------------
| VIVA-HEADER – M.R. Ahamed – Admin Dashboard & Authentication
| Admin dashboard overview (READ-only)
|--------------------------------------------------------------------------
|   READ    summary              GET /api/v1/dashboard/summary
|   READ    myNotifications      GET /api/v1/my/notifications
| Every write goes through Sequelize to MySQL/MariaDB and is recorded in
| activity_logs (services/activity.service.js) where it changes data.
*/

import { Op, fn, col } from 'sequelize';

import {
  ActivityLog,
  Complaint,
  ComplaintMessage,
  ComplaintStatusHistory,
  Document,
  EmailLog,
  Enquiry,
  FinanceApplication,
  ReplyTemplate,
  Response,
  Session,
  TestDriveBooking,
  User,
  Vehicle
} from '../models/index.js';

import { ok } from '../middleware/core.js';

/*
|--------------------------------------------------------------------------
| Dashboard Overview and Customer Notifications
|--------------------------------------------------------------------------
|
| All figures are live database counts. Staff only receive the sections
| their permissions allow, scoped to records assigned to them.
|
*/

async function countBy(model, where, attribute, options = {}) {
  const rows = await model.findAll({
    where,
    attributes: [attribute, [fn('COUNT', col('*')), 'total']],
    group: [attribute],
    raw: true,
    paranoid: options.paranoid ?? true
  });

  return Object.fromEntries(rows.map((row) => [row[attribute], Number(row.total)]));
}

const has = (req, permission) => req.user.role === 'Admin' || Boolean(req.permissions?.[permission]);

// VIVA CRUD READ – live counts for the Overview tab (GET /api/v1/dashboard/summary)
export async function summary(req, res) {
  const isAdmin = req.user.role === 'Admin';
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 86400000);
  const weekAhead = new Date(now.getTime() + 7 * 86400000);
  const today = now.toISOString().slice(0, 10);
  const data = {
    generatedAt: now,
    sections: []
  };

  if (has(req, 'canManageInventory') || has(req, 'canViewLimitedAnalytics')) {
    const vehicles = await countBy(Vehicle, {}, 'status', { paranoid: false });
    const stockValue = await Vehicle.sum('price', { where: { status: 'Available' } });

    data.vehicles = {
      byStatus: vehicles,
      total: Object.values(vehicles).reduce((sum, value) => sum + value, 0),
      availableStockValue: Number(stockValue || 0)
    };
    data.sections.push('vehicles');
  }

  if (has(req, 'canManageEnquiries')) {
    const scope = isAdmin ? {} : { assignedTo: req.user.userId };
    const enquiries = await countBy(Enquiry, scope, 'status');

    data.enquiries = {
      byStatus: enquiries,
      total: Object.values(enquiries).reduce((sum, value) => sum + value, 0),
      newToday: await Enquiry.count({ where: { ...scope, createdAt: { [Op.gte]: dayAgo } } }),
      unassigned: isAdmin ? await Enquiry.count({ where: { assignedTo: null, status: ['New', 'In Progress'] } }) : 0
    };

    data.sections.push('enquiries');
  }

  // VIVA – Ahamed – test drives follow the new "Manage bookings" permission.
  if (has(req, 'canManageBookings')) {
    const scope = isAdmin ? {} : { assignedTo: req.user.userId };
    const bookings = await countBy(TestDriveBooking, scope, 'status');

    data.bookings = {
      byStatus: bookings,
      total: Object.values(bookings).reduce((sum, value) => sum + value, 0),
      upcoming: await TestDriveBooking.findAll({
        where: {
          ...scope,
          status: ['Pending', 'Confirmed'],
          preferredDate: {
            [Op.gte]: today,
            [Op.lte]: weekAhead.toISOString().slice(0, 10)
          }
        },
        include: [{ model: User, as: 'customer', attributes: ['name'] }],
        order: [
          ['preferredDate', 'ASC'],
          ['preferredTime', 'ASC']
        ],
        limit: 6
      })
    };

    data.sections.push('bookings');
  }

  if (has(req, 'canManageComplaints')) {
    const scope = isAdmin ? {} : { assignedTo: req.user.userId };
    const complaints = await countBy(Complaint, scope, 'status');
    const open = { ...scope, status: ['Submitted', 'Under Review', 'In Progress'] };

    data.complaints = {
      byStatus: complaints,
      total: Object.values(complaints).reduce((sum, value) => sum + value, 0),
      open: await Complaint.count({ where: open }),
      urgentOpen: await Complaint.count({ where: { ...open, priority: ['High', 'Urgent'] } }),
      unassigned: isAdmin ? await Complaint.count({ where: { ...open, assignedTo: null } }) : 0,
      newToday: await Complaint.count({ where: { ...scope, createdAt: { [Op.gte]: dayAgo } } })
    };

    data.sections.push('complaints');
  }

  if (isAdmin) {
    const users = await countBy(User, {}, 'role');

    data.users = {
      byRole: users,
      total: Object.values(users).reduce((sum, value) => sum + value, 0),
      inactive: await User.count({ where: { isActive: false } }),
      newThisWeek: await User.count({ where: { createdAt: { [Op.gte]: new Date(now.getTime() - 7 * 86400000) } } })
    };

    data.sessions = {
      active: await Session.count({ where: { revokedAt: null, expiresAt: { [Op.gt]: now } } }),
      signInsToday: await Session.count({ where: { createdAt: { [Op.gte]: dayAgo } } })
    };

    data.documents = {
      total: await Document.count(),
      totalBytes: Number((await Document.sum('sizeBytes')) || 0),
      byCategory: await countBy(Document, {}, 'category')
    };

    data.emails = {
      byStatus: await countBy(EmailLog, { createdAt: { [Op.gte]: new Date(now.getTime() - 30 * 86400000) } }, 'status'),
      failed: await EmailLog.count({ where: { status: 'Failed' } })
    };

    data.recentActivity = await ActivityLog.findAll({
      include: [{ model: User, as: 'actor', attributes: ['name'] }],
      order: [['createdAt', 'DESC']],
      limit: 12
    });

    // VIVA – Herathge – Finance Applications on the overview
    data.financeApplications = {
      byStatus: await countBy(FinanceApplication, {}, 'status'),
      awaiting: await FinanceApplication.count({ where: { status: ['Submitted', 'Under Review'] } })
    };

    // VIVA – Naaziq – Reply Templates on the overview
    data.replyTemplates = {
      active: await ReplyTemplate.count({ where: { isActive: true } }),
      total: await ReplyTemplate.count()
    };

    data.sections.push('users', 'sessions', 'documents', 'emails', 'activity', 'finance', 'templates');
  } else {
    data.recentActivity = await ActivityLog.findAll({
      where: { actorId: req.user.userId },
      order: [['createdAt', 'DESC']],
      limit: 8
    });
  }

  // Badges for the dashboard top bar.
  data.attention = {
    newEnquiries: data.enquiries?.byStatus?.New || 0,
    pendingBookings: data.bookings?.byStatus?.Pending || 0,
    openComplaints: data.complaints?.open || 0,
    urgentComplaints: data.complaints?.urgentOpen || 0,
    failedEmails: data.emails?.failed || 0,
    awaitingFinance: data.financeApplications?.awaiting || 0
  };

  return ok(res, 'Dashboard summary retrieved', data);
}

/*
|--------------------------------------------------------------------------
| Customer notification feed
|--------------------------------------------------------------------------
|
| Returns updates for the signed-in customer since the given timestamp:
| complaint status changes and staff replies, sent enquiry responses and
| test-drive booking decisions. The client polls this to show popups.
|
*/

// VIVA CRUD READ – customer notification bell (GET /api/v1/my/notifications)
export async function myNotifications(req, res) {
  const parsed = req.query.since ? new Date(String(req.query.since)) : null;
  const since =
    parsed && !Number.isNaN(parsed.getTime())
      ? parsed
      : new Date(Date.now() - 7 * 86400000);

  const customerId = req.user.userId;
  const items = [];

  const complaints = await Complaint.findAll({
    where: { customerId },
    attributes: ['complaintId', 'reference', 'subject']
  });

  const complaintIds = complaints.map((complaint) => complaint.complaintId);
  const complaintById = Object.fromEntries(complaints.map((complaint) => [complaint.complaintId, complaint]));

  if (complaintIds.length) {
    const history = await ComplaintStatusHistory.findAll({
      where: {
        complaintId: complaintIds,
        createdAt: { [Op.gt]: since },
        [Op.or]: [{ changedBy: { [Op.ne]: customerId } }, { changedBy: null }]
      },
      order: [['createdAt', 'DESC']],
      limit: 20
    });

    for (const entry of history) {
      const complaint = complaintById[entry.complaintId];

      items.push({
        id: `complaint-status-${entry.historyId}`,
        type: 'complaint',
        title: `${complaint.reference} is now ${entry.toStatus}`,
        body: complaint.subject,
        link: `/my-complaints/${entry.complaintId}`,
        createdAt: entry.createdAt
      });
    }

    const messages = await ComplaintMessage.findAll({
      where: {
        complaintId: complaintIds,
        isInternal: false,
        authorRole: ['Staff', 'Admin', 'System'],
        createdAt: { [Op.gt]: since }
      },
      order: [['createdAt', 'DESC']],
      limit: 20
    });

    for (const message of messages) {
      const complaint = complaintById[message.complaintId];

      items.push({
        id: `complaint-message-${message.messageId}`,
        type: 'complaint',
        title: `New reply on ${complaint.reference}`,
        body: message.body.slice(0, 140),
        link: `/my-complaints/${message.complaintId}`,
        createdAt: message.createdAt
      });
    }
  }

  const responses = await Response.findAll({
    where: {
      status: 'Sent',
      sentAt: { [Op.gt]: since }
    },
    include: [
      {
        model: Enquiry,
        as: 'enquiry',
        where: { customerId },
        attributes: ['enquiryId', 'vehicleReference']
      }
    ],
    order: [['sentAt', 'DESC']],
    limit: 20
  });

  for (const response of responses) {
    items.push({
      id: `enquiry-response-${response.responseId}`,
      type: 'enquiry',
      title: `High Street replied to your enquiry #${response.enquiryId}`,
      body: response.subject,
      link: '/my-enquiries',
      createdAt: response.sentAt
    });
  }

  const bookings = await TestDriveBooking.findAll({
    where: {
      customerId,
      status: ['Confirmed', 'Completed', 'Cancelled'],
      updatedAt: { [Op.gt]: since }
    },
    order: [['updatedAt', 'DESC']],
    limit: 20
  });

  for (const booking of bookings) {
    const changedAt = booking.cancelledAt || booking.completedAt || booking.confirmedAt || booking.updatedAt;

    if (new Date(changedAt) <= since) {
      continue;
    }

    items.push({
      id: `booking-${booking.bookingId}-${booking.status}`,
      type: 'booking',
      title: `Test drive ${booking.status.toLowerCase()}: ${booking.vehicleReference}`,
      body: booking.staffNote || `Booking #${booking.bookingId} for ${booking.preferredDate}`,
      link: '/my-bookings',
      createdAt: changedAt
    });
  }

  // VIVA – Herathge – finance application decisions for the customer
  const applications = await FinanceApplication.findAll({
    where: {
      customerId,
      status: ['Under Review', 'Approved in Principle', 'Declined'],
      reviewedAt: { [Op.gt]: since }
    },
    order: [['reviewedAt', 'DESC']],
    limit: 20
  });

  for (const application of applications) {
    items.push({
      id: `finance-${application.applicationId}-${application.status}-${new Date(application.reviewedAt).getTime()}`,
      type: 'finance',
      title: `${application.reference} is now ${application.status}`,
      body: application.decisionNote || application.vehicleReference,
      link: '/my-finance',
      createdAt: application.reviewedAt
    });
  }

  items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return ok(res, 'Notifications retrieved', items.slice(0, 30), {
    since,
    serverTime: new Date()
  });
}
