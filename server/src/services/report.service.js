import { Op, fn, col } from 'sequelize';
import { z } from 'zod';

import {
  ActivityLog,
  Complaint,
  Document,
  EmailLog,
  Enquiry,
  FinanceApplication,
  Response,
  Session,
  TestDriveBooking,
  User,
  Vehicle,
  VehicleImage,
  Wishlist
} from '../models/index.js';

import {
  COMPLAINT_CATEGORIES,
  COMPLAINT_PRIORITIES,
  COMPLAINT_STATUSES,
  DOCUMENT_CATEGORIES,
  EMAIL_STATUSES,
  FINANCE_STATUSES,
  FINANCE_EMPLOYMENT_TYPES
} from '../models/extended.js';

/*
|--------------------------------------------------------------------------
| Report Generation
|--------------------------------------------------------------------------
|
| Every report is generated from live database records. Totals and status
| breakdowns are calculated with aggregate queries over the complete
| filtered data set, so they remain accurate even when the detail rows are
| capped for very large reports.
|
*/

export const MAX_VIEW_ROWS = 2000;
export const MAX_EXPORT_ROWS = 20000;

const VEHICLE_STATUSES = ['Draft', 'Available', 'Sold', 'Archived'];
const ENQUIRY_STATUSES = ['New', 'In Progress', 'Responded', 'Archived'];
const BOOKING_STATUSES = ['Pending', 'Confirmed', 'Completed', 'Cancelled'];
const ROLES = ['Admin', 'Staff', 'Customer'];
const VEHICLE_TYPES = ['SUV', 'Sedan', 'Hatchback', 'Van', 'Luxury', 'Pickup', 'Coupe', 'Wagon'];

const money = (value) =>
  `LKR ${Number(value || 0).toLocaleString('en-LK', { maximumFractionDigits: 0 })}`;

const pct = (part, whole) => (whole ? `${((part / whole) * 100).toFixed(1)}%` : '0.0%');

const formatDateTime = (value) => {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const pad = (number) => String(number).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const formatDate = (value) => formatDateTime(value).slice(0, 10);

const hoursBetween = (start, end) =>
  start && end ? (new Date(end).getTime() - new Date(start).getTime()) / 3600000 : null;

function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, (character) => `\\${character}`);
}

function dateRange(filters, field = 'createdAt') {
  if (!filters.dateFrom && !filters.dateTo) {
    return {};
  }

  const range = {};

  if (filters.dateFrom) {
    range[Op.gte] = new Date(`${filters.dateFrom}T00:00:00`);
  }

  if (filters.dateTo) {
    range[Op.lte] = new Date(`${filters.dateTo}T23:59:59.999`);
  }

  return {
    [field]: range
  };
}

function dateOnlyRange(filters, field) {
  if (!filters.dateFrom && !filters.dateTo) {
    return {};
  }

  const range = {};

  if (filters.dateFrom) {
    range[Op.gte] = filters.dateFrom;
  }

  if (filters.dateTo) {
    range[Op.lte] = filters.dateTo;
  }

  return {
    [field]: range
  };
}

async function countBy(model, where, attribute, options = {}) {
  const rows = await model.findAll({
    where,
    attributes: [attribute, [fn('COUNT', col('*')), 'total']],
    group: [attribute],
    raw: true,
    paranoid: options.paranoid ?? true
  });

  const counts = {};

  for (const row of rows) {
    counts[row[attribute] ?? 'Unspecified'] = Number(row.total);
  }

  return counts;
}

function breakdown(counts, order = []) {
  const keys = [...order.filter((key) => key in counts), ...Object.keys(counts).filter((key) => !order.includes(key))];

  return keys.map((key) => ({
    label: key,
    value: counts[key]
  }));
}

function sumValues(counts) {
  return Object.values(counts).reduce((sum, value) => sum + value, 0);
}

const isAdmin = (ctx) => ctx.user.role === 'Admin';
const staffHas = (ctx, permission) =>
  isAdmin(ctx) || (ctx.user.role === 'Staff' && Boolean(ctx.permissions?.[permission]));
const canSeeContacts = (ctx) => isAdmin(ctx) || staffHas(ctx, 'canViewAssignedContacts');

/*
|--------------------------------------------------------------------------
| Filter definitions (shared by the API validator and the UI)
|--------------------------------------------------------------------------
*/

const dateFilters = [
  { key: 'dateFrom', label: 'From date', type: 'date' },
  { key: 'dateTo', label: 'To date', type: 'date' }
];

const searchFilter = { key: 'search', label: 'Search', type: 'text' };

const selectFilter = (key, label, options) => ({
  key,
  label,
  type: 'select',
  options
});

/*
|--------------------------------------------------------------------------
| Report definitions
|--------------------------------------------------------------------------
*/

const definitions = {
  vehicles: {
    label: 'Vehicle inventory',
    description: 'Stock levels, pricing and listing status for every vehicle.',
    access: (ctx) => isAdmin(ctx) || staffHas(ctx, 'canViewLimitedAnalytics'),
    filters: [
      ...dateFilters,
      searchFilter,
      selectFilter('status', 'Status', VEHICLE_STATUSES),
      selectFilter('type', 'Type', VEHICLE_TYPES),
      selectFilter('condition', 'Condition', ['New', 'Used', 'Reconditioned']),
      selectFilter('fuelType', 'Fuel', ['Petrol', 'Diesel', 'Hybrid', 'Electric'])
    ],
    async build(filters, ctx, limit) {
      const where = {
        ...dateRange(filters)
      };

      for (const key of ['status', 'type', 'condition', 'fuelType']) {
        if (filters[key]) {
          where[key] = filters[key];
        }
      }

      if (filters.search) {
        const term = `%${escapeLike(filters.search)}%`;
        where[Op.or] = [{ make: { [Op.like]: term } }, { model: { [Op.like]: term } }];
      }

      const paranoid = false;

      const vehicles = await Vehicle.findAll({
        where,
        paranoid,
        order: [['createdAt', 'DESC']],
        limit: limit + 1
      });

      const ids = vehicles.map((vehicle) => vehicle.vehicleId);
      const [imageCounts, enquiryCounts] = await Promise.all([
        countBy(VehicleImage, { vehicleId: ids }, 'vehicleId'),
        countBy(Enquiry, { vehicleId: ids }, 'vehicleId')
      ]);

      const statusCounts = await countBy(Vehicle, where, 'status', { paranoid });
      const typeCounts = await countBy(Vehicle, where, 'type', { paranoid });

      const availableValue = await Vehicle.sum('price', {
        where: {
          ...where,
          status: filters.status && filters.status !== 'Available' ? '__none__' : 'Available'
        }
      });

      const averagePrice = await Vehicle.findOne({
        where,
        paranoid,
        attributes: [[fn('AVG', col('price')), 'average']],
        raw: true
      });

      const total = sumValues(statusCounts);

      return {
        columns: [
          { key: 'vehicleId', label: 'ID', type: 'number' },
          { key: 'make', label: 'Make' },
          { key: 'model', label: 'Model' },
          { key: 'year', label: 'Year', type: 'number' },
          { key: 'type', label: 'Type' },
          { key: 'condition', label: 'Condition' },
          { key: 'fuelType', label: 'Fuel' },
          { key: 'transmission', label: 'Transmission' },
          { key: 'mileage', label: 'Mileage (km)', type: 'number' },
          { key: 'price', label: 'Price (LKR)', type: 'currency' },
          { key: 'status', label: 'Status', type: 'status' },
          { key: 'images', label: 'Images', type: 'number' },
          { key: 'enquiries', label: 'Enquiries', type: 'number' },
          { key: 'createdAt', label: 'Listed', type: 'date' }
        ],
        rows: vehicles.slice(0, limit).map((vehicle) => ({
          vehicleId: vehicle.vehicleId,
          make: vehicle.make,
          model: vehicle.model,
          year: vehicle.year,
          type: vehicle.type,
          condition: vehicle.condition,
          fuelType: vehicle.fuelType,
          transmission: vehicle.transmission,
          mileage: vehicle.mileage,
          price: Number(vehicle.price),
          status: vehicle.status,
          images: imageCounts[vehicle.vehicleId] || 0,
          enquiries: enquiryCounts[vehicle.vehicleId] || 0,
          createdAt: formatDate(vehicle.createdAt)
        })),
        truncated: vehicles.length > limit,
        total,
        summary: [
          { label: 'Vehicles in report', value: total },
          { label: 'Available', value: statusCounts.Available || 0 },
          { label: 'Sold', value: statusCounts.Sold || 0 },
          { label: 'Draft', value: statusCounts.Draft || 0 },
          { label: 'Archived', value: statusCounts.Archived || 0 },
          { label: 'Available stock value', value: money(availableValue) },
          { label: 'Average listed price', value: money(averagePrice?.average) }
        ],
        groups: [
          { label: 'By status', items: breakdown(statusCounts, VEHICLE_STATUSES) },
          { label: 'By type', items: breakdown(typeCounts) }
        ]
      };
    }
  },

  'vehicle-demand': {
    label: 'Vehicle demand',
    description: 'Enquiries, test drives, wishlist saves and complaints per vehicle.',
    access: (ctx) => isAdmin(ctx) || staffHas(ctx, 'canViewLimitedAnalytics'),
    filters: [...dateFilters, searchFilter, selectFilter('status', 'Vehicle status', VEHICLE_STATUSES)],
    async build(filters, ctx, limit) {
      const vehicleWhere = {};

      if (filters.status) {
        vehicleWhere.status = filters.status;
      }

      if (filters.search) {
        const term = `%${escapeLike(filters.search)}%`;
        vehicleWhere[Op.or] = [{ make: { [Op.like]: term } }, { model: { [Op.like]: term } }];
      }

      const vehicles = await Vehicle.findAll({
        where: vehicleWhere,
        paranoid: false,
        attributes: ['vehicleId', 'make', 'model', 'year', 'status', 'price']
      });

      const ids = vehicles.map((vehicle) => vehicle.vehicleId);
      const range = dateRange(filters);

      const [enquiries, bookings, wishlists, complaints] = await Promise.all([
        countBy(Enquiry, { vehicleId: ids, ...range }, 'vehicleId'),
        countBy(TestDriveBooking, { vehicleId: ids, ...range }, 'vehicleId'),
        countBy(Wishlist, { vehicleId: ids, ...range }, 'vehicleId'),
        countBy(Complaint, { vehicleId: ids, ...range }, 'vehicleId')
      ]);

      const rows = vehicles
        .map((vehicle) => {
          const id = vehicle.vehicleId;
          const row = {
            vehicleId: id,
            vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
            status: vehicle.status,
            price: Number(vehicle.price),
            enquiries: enquiries[id] || 0,
            bookings: bookings[id] || 0,
            wishlists: wishlists[id] || 0,
            complaints: complaints[id] || 0
          };

          row.interest = row.enquiries * 3 + row.bookings * 4 + row.wishlists * 2;

          return row;
        })
        .sort((a, b) => b.interest - a.interest || b.enquiries - a.enquiries);

      const totals = rows.reduce(
        (sum, row) => ({
          enquiries: sum.enquiries + row.enquiries,
          bookings: sum.bookings + row.bookings,
          wishlists: sum.wishlists + row.wishlists,
          complaints: sum.complaints + row.complaints
        }),
        { enquiries: 0, bookings: 0, wishlists: 0, complaints: 0 }
      );

      const top = rows.filter((row) => row.interest > 0).slice(0, 8);

      return {
        columns: [
          { key: 'vehicleId', label: 'ID', type: 'number' },
          { key: 'vehicle', label: 'Vehicle' },
          { key: 'status', label: 'Status', type: 'status' },
          { key: 'price', label: 'Price (LKR)', type: 'currency' },
          { key: 'enquiries', label: 'Enquiries', type: 'number' },
          { key: 'bookings', label: 'Test drives', type: 'number' },
          { key: 'wishlists', label: 'Wishlist saves', type: 'number' },
          { key: 'complaints', label: 'Complaints', type: 'number' },
          { key: 'interest', label: 'Interest score', type: 'number' }
        ],
        rows: rows.slice(0, limit),
        truncated: rows.length > limit,
        total: rows.length,
        summary: [
          { label: 'Vehicles analysed', value: rows.length },
          { label: 'Enquiries', value: totals.enquiries },
          { label: 'Test-drive requests', value: totals.bookings },
          { label: 'Wishlist saves', value: totals.wishlists },
          { label: 'Complaints', value: totals.complaints },
          { label: 'Most requested', value: top[0]?.vehicle || 'None yet' }
        ],
        groups: [
          {
            label: 'Highest interest',
            items: top.map((row) => ({ label: row.vehicle, value: row.interest }))
          }
        ],
        notes: 'Interest score = enquiries × 3 + test drives × 4 + wishlist saves × 2.'
      };
    }
  },

  enquiries: {
    label: 'Customer enquiries',
    description: 'Enquiry volume, status and response performance.',
    access: (ctx) => isAdmin(ctx) || (staffHas(ctx, 'canViewLimitedAnalytics') && staffHas(ctx, 'canManageEnquiries')),
    filters: [...dateFilters, searchFilter, selectFilter('status', 'Status', ENQUIRY_STATUSES)],
    async build(filters, ctx, limit) {
      const where = {
        ...dateRange(filters)
      };

      if (filters.status) {
        where.status = filters.status;
      }

      if (ctx.user.role === 'Staff') {
        where.assignedTo = ctx.user.userId;
      }

      if (filters.search) {
        const term = `%${escapeLike(filters.search)}%`;
        where[Op.or] = [
          { customerName: { [Op.like]: term } },
          { vehicleReference: { [Op.like]: term } },
          ...(canSeeContacts(ctx) ? [{ customerEmail: { [Op.like]: term } }] : [])
        ];
      }

      const enquiries = await Enquiry.findAll({
        where,
        include: [{ model: User, as: 'assignedStaff', attributes: ['name'], required: false }],
        order: [['createdAt', 'DESC']],
        limit: limit + 1
      });

      const ids = enquiries.map((enquiry) => enquiry.enquiryId);
      const responseCounts = await countBy(Response, { enquiryId: ids, status: 'Sent' }, 'enquiryId');
      const statusCounts = await countBy(Enquiry, where, 'status');
      const total = sumValues(statusCounts);

      const responded = await Enquiry.findAll({
        where: { ...where, respondedAt: { [Op.ne]: null } },
        attributes: ['createdAt', 'respondedAt'],
        raw: true
      });

      const averageHours = responded.length
        ? responded.reduce((sum, row) => sum + hoursBetween(row.createdAt, row.respondedAt), 0) / responded.length
        : null;

      const contacts = canSeeContacts(ctx);

      return {
        columns: [
          { key: 'enquiryId', label: 'ID', type: 'number' },
          { key: 'createdAt', label: 'Received', type: 'date' },
          { key: 'customerName', label: 'Customer' },
          ...(contacts
            ? [
                { key: 'customerEmail', label: 'Email' },
                { key: 'customerPhone', label: 'Phone' }
              ]
            : []),
          { key: 'vehicleReference', label: 'Vehicle' },
          { key: 'status', label: 'Status', type: 'status' },
          { key: 'assignedTo', label: 'Assigned to' },
          { key: 'respondedAt', label: 'Responded', type: 'date' },
          { key: 'responses', label: 'Sent replies', type: 'number' }
        ],
        rows: enquiries.slice(0, limit).map((enquiry) => ({
          enquiryId: enquiry.enquiryId,
          createdAt: formatDateTime(enquiry.createdAt),
          customerName: enquiry.customerName,
          customerEmail: enquiry.customerEmail,
          customerPhone: enquiry.customerPhone,
          vehicleReference: enquiry.vehicleReference,
          status: enquiry.status,
          assignedTo: enquiry.assignedStaff?.name || 'Unassigned',
          respondedAt: formatDateTime(enquiry.respondedAt),
          responses: responseCounts[enquiry.enquiryId] || 0
        })),
        truncated: enquiries.length > limit,
        total,
        summary: [
          { label: 'Enquiries', value: total },
          { label: 'New', value: statusCounts.New || 0 },
          { label: 'In progress', value: statusCounts['In Progress'] || 0 },
          { label: 'Responded', value: statusCounts.Responded || 0 },
          { label: 'Response rate', value: pct(responded.length, total) },
          {
            label: 'Average first response',
            value: averageHours === null ? 'No responses yet' : `${averageHours.toFixed(1)} hours`
          }
        ],
        groups: [{ label: 'By status', items: breakdown(statusCounts, ENQUIRY_STATUSES) }]
      };
    }
  },

  bookings: {
    label: 'Test-drive bookings',
    description: 'Test-drive requests by appointment date, status and staff.',
    access: (ctx) => isAdmin(ctx) || staffHas(ctx, 'canViewLimitedAnalytics'),
    filters: [
      ...dateFilters,
      selectFilter('dateField', 'Date applies to', ['preferredDate', 'createdAt']),
      searchFilter,
      selectFilter('status', 'Status', BOOKING_STATUSES)
    ],
    async build(filters, ctx, limit) {
      const where =
        filters.dateField === 'createdAt'
          ? dateRange(filters, 'createdAt')
          : dateOnlyRange(filters, 'preferredDate');

      if (filters.status) {
        where.status = filters.status;
      }

      if (ctx.user.role === 'Staff') {
        where.assignedTo = ctx.user.userId;
      }

      if (filters.search) {
        where.vehicleReference = { [Op.like]: `%${escapeLike(filters.search)}%` };
      }

      const bookings = await TestDriveBooking.findAll({
        where,
        include: [
          { model: User, as: 'customer', attributes: ['name', 'email', 'phone'], required: false },
          { model: User, as: 'assignedStaff', attributes: ['name'], required: false }
        ],
        order: [
          ['preferredDate', 'DESC'],
          ['preferredTime', 'DESC']
        ],
        limit: limit + 1
      });

      const statusCounts = await countBy(TestDriveBooking, where, 'status');
      const total = sumValues(statusCounts);
      const contacts = canSeeContacts(ctx);
      const decided = (statusCounts.Completed || 0) + (statusCounts.Cancelled || 0);

      return {
        columns: [
          { key: 'bookingId', label: 'ID', type: 'number' },
          { key: 'createdAt', label: 'Requested', type: 'date' },
          { key: 'preferredDate', label: 'Preferred date', type: 'date' },
          { key: 'preferredTime', label: 'Time' },
          { key: 'customer', label: 'Customer' },
          ...(contacts ? [{ key: 'contact', label: 'Contact' }] : []),
          { key: 'vehicleReference', label: 'Vehicle' },
          { key: 'status', label: 'Status', type: 'status' },
          { key: 'assignedTo', label: 'Assigned to' }
        ],
        rows: bookings.slice(0, limit).map((booking) => ({
          bookingId: booking.bookingId,
          createdAt: formatDateTime(booking.createdAt),
          preferredDate: booking.preferredDate,
          preferredTime: String(booking.preferredTime || '').slice(0, 5),
          customer: booking.customer?.name || 'Unknown',
          contact: [booking.customer?.email, booking.customer?.phone].filter(Boolean).join(' / '),
          vehicleReference: booking.vehicleReference,
          status: booking.status,
          assignedTo: booking.assignedStaff?.name || 'Unassigned'
        })),
        truncated: bookings.length > limit,
        total,
        summary: [
          { label: 'Bookings', value: total },
          { label: 'Pending', value: statusCounts.Pending || 0 },
          { label: 'Confirmed', value: statusCounts.Confirmed || 0 },
          { label: 'Completed', value: statusCounts.Completed || 0 },
          { label: 'Cancelled', value: statusCounts.Cancelled || 0 },
          { label: 'Completion rate', value: pct(statusCounts.Completed || 0, decided) }
        ],
        groups: [{ label: 'By status', items: breakdown(statusCounts, BOOKING_STATUSES) }]
      };
    }
  },

  complaints: {
    label: 'Complaints',
    description: 'Complaint volume, categories, priorities and resolution times.',
    access: (ctx) => isAdmin(ctx) || (staffHas(ctx, 'canViewLimitedAnalytics') && staffHas(ctx, 'canManageComplaints')),
    filters: [
      ...dateFilters,
      searchFilter,
      selectFilter('status', 'Status', COMPLAINT_STATUSES),
      selectFilter('category', 'Category', COMPLAINT_CATEGORIES),
      selectFilter('priority', 'Priority', COMPLAINT_PRIORITIES)
    ],
    async build(filters, ctx, limit) {
      const where = {
        ...dateRange(filters)
      };

      for (const key of ['status', 'category', 'priority']) {
        if (filters[key]) {
          where[key] = filters[key];
        }
      }

      if (ctx.user.role === 'Staff') {
        where.assignedTo = ctx.user.userId;
      }

      if (filters.search) {
        const term = `%${escapeLike(filters.search)}%`;
        where[Op.or] = [{ reference: { [Op.like]: term } }, { subject: { [Op.like]: term } }];
      }

      const complaints = await Complaint.findAll({
        where,
        include: [
          { model: User, as: 'customer', attributes: ['name', 'email'], required: false },
          { model: User, as: 'assignedStaff', attributes: ['name'], required: false }
        ],
        order: [['createdAt', 'DESC']],
        limit: limit + 1
      });

      const [statusCounts, categoryCounts, priorityCounts] = await Promise.all([
        countBy(Complaint, where, 'status'),
        countBy(Complaint, where, 'category'),
        countBy(Complaint, where, 'priority')
      ]);

      const total = sumValues(statusCounts);

      const resolved = await Complaint.findAll({
        where: { ...where, resolvedAt: { [Op.ne]: null } },
        attributes: ['createdAt', 'resolvedAt'],
        raw: true
      });

      const averageDays = resolved.length
        ? resolved.reduce((sum, row) => sum + hoursBetween(row.createdAt, row.resolvedAt), 0) / resolved.length / 24
        : null;

      const open = (statusCounts.Submitted || 0) + (statusCounts['Under Review'] || 0) + (statusCounts['In Progress'] || 0);
      const contacts = canSeeContacts(ctx);
      const now = Date.now();

      return {
        columns: [
          { key: 'reference', label: 'Reference' },
          { key: 'createdAt', label: 'Submitted', type: 'date' },
          { key: 'customer', label: 'Customer' },
          ...(contacts ? [{ key: 'email', label: 'Email' }] : []),
          { key: 'category', label: 'Category' },
          { key: 'priority', label: 'Priority', type: 'status' },
          { key: 'subject', label: 'Subject' },
          { key: 'status', label: 'Status', type: 'status' },
          { key: 'assignedTo', label: 'Assigned to' },
          { key: 'resolvedAt', label: 'Resolved', type: 'date' },
          { key: 'daysOpen', label: 'Days open', type: 'number' }
        ],
        rows: complaints.slice(0, limit).map((complaint) => ({
          reference: complaint.reference,
          createdAt: formatDateTime(complaint.createdAt),
          customer: complaint.customer?.name || 'Unknown',
          email: complaint.customer?.email || '',
          category: complaint.category,
          priority: complaint.priority,
          subject: complaint.subject,
          status: complaint.status,
          assignedTo: complaint.assignedStaff?.name || 'Unassigned',
          resolvedAt: formatDateTime(complaint.resolvedAt),
          daysOpen: Math.max(
            0,
            Math.round(
              ((complaint.resolvedAt || complaint.closedAt ? new Date(complaint.resolvedAt || complaint.closedAt).getTime() : now) -
                new Date(complaint.createdAt).getTime()) /
                86400000
            )
          )
        })),
        truncated: complaints.length > limit,
        total,
        summary: [
          { label: 'Complaints', value: total },
          { label: 'Open', value: open },
          { label: 'Resolved', value: statusCounts.Resolved || 0 },
          { label: 'Closed', value: statusCounts.Closed || 0 },
          { label: 'High / urgent', value: (priorityCounts.High || 0) + (priorityCounts.Urgent || 0) },
          {
            label: 'Average resolution time',
            value:
              averageDays === null
                ? 'None resolved yet'
                : averageDays < 1
                  ? `${Math.max(averageDays * 24, 0.1).toFixed(1)} hours`
                  : `${averageDays.toFixed(1)} days`
          }
        ],
        groups: [
          { label: 'By status', items: breakdown(statusCounts, COMPLAINT_STATUSES) },
          { label: 'By category', items: breakdown(categoryCounts, COMPLAINT_CATEGORIES) },
          { label: 'By priority', items: breakdown(priorityCounts, COMPLAINT_PRIORITIES) }
        ]
      };
    }
  },

  users: {
    label: 'User accounts',
    description: 'Customers, staff and administrators with account status.',
    access: isAdmin,
    filters: [
      ...dateFilters,
      searchFilter,
      selectFilter('role', 'Role', ROLES),
      selectFilter('isActive', 'Account status', ['true', 'false'])
    ],
    async build(filters, ctx, limit) {
      const where = {
        ...dateRange(filters)
      };

      if (filters.role) {
        where.role = filters.role;
      }

      if (filters.isActive) {
        where.isActive = filters.isActive === 'true';
      }

      if (filters.search) {
        const term = `%${escapeLike(filters.search)}%`;
        where[Op.or] = [{ name: { [Op.like]: term } }, { email: { [Op.like]: term } }];
      }

      const users = await User.findAll({
        where,
        order: [['createdAt', 'DESC']],
        limit: limit + 1
      });

      const roleCounts = await countBy(User, where, 'role');
      const activeCounts = await countBy(User, where, 'isActive');
      const total = sumValues(roleCounts);
      const active = (activeCounts['1'] || 0) + (activeCounts.true || 0);

      return {
        columns: [
          { key: 'userId', label: 'ID', type: 'number' },
          { key: 'name', label: 'Name' },
          { key: 'email', label: 'Email' },
          { key: 'phone', label: 'Phone' },
          { key: 'role', label: 'Role' },
          { key: 'status', label: 'Status', type: 'status' },
          { key: 'lastLoginAt', label: 'Last login', type: 'date' },
          { key: 'createdAt', label: 'Joined', type: 'date' }
        ],
        rows: users.slice(0, limit).map((user) => ({
          userId: user.userId,
          name: user.name,
          email: user.email,
          phone: user.phone || '',
          role: user.role,
          status: user.isActive ? 'Active' : 'Inactive',
          lastLoginAt: formatDateTime(user.lastLoginAt),
          createdAt: formatDate(user.createdAt)
        })),
        truncated: users.length > limit,
        total,
        summary: [
          { label: 'Accounts', value: total },
          { label: 'Active', value: active },
          { label: 'Inactive', value: total - active },
          { label: 'Customers', value: roleCounts.Customer || 0 },
          { label: 'Staff', value: roleCounts.Staff || 0 },
          { label: 'Admins', value: roleCounts.Admin || 0 }
        ],
        groups: [
          { label: 'By role', items: breakdown(roleCounts, ROLES) },
          {
            label: 'By status',
            items: [
              { label: 'Active', value: active },
              { label: 'Inactive', value: total - active }
            ]
          }
        ]
      };
    }
  },

  sessions: {
    label: 'Login sessions',
    description: 'Sign-in activity with active, revoked and expired sessions.',
    access: isAdmin,
    filters: [
      ...dateFilters,
      searchFilter,
      selectFilter('sessionStatus', 'Session status', ['Active', 'Revoked', 'Expired']),
      selectFilter('role', 'Role', ROLES)
    ],
    async build(filters, ctx, limit) {
      const now = new Date();
      const where = {
        ...dateRange(filters)
      };

      if (filters.sessionStatus === 'Active') {
        where.revokedAt = null;
        where.expiresAt = { [Op.gt]: now };
      } else if (filters.sessionStatus === 'Revoked') {
        where.revokedAt = { [Op.ne]: null };
      } else if (filters.sessionStatus === 'Expired') {
        where.revokedAt = null;
        where.expiresAt = { [Op.lte]: now };
      }

      const userWhere = {};

      if (filters.role) {
        userWhere.role = filters.role;
      }

      if (filters.search) {
        const term = `%${escapeLike(filters.search)}%`;
        userWhere[Op.or] = [{ name: { [Op.like]: term } }, { email: { [Op.like]: term } }];
      }

      const include = [
        {
          model: User,
          as: 'user',
          attributes: ['name', 'email', 'role'],
          where: Object.keys(userWhere).length || Object.getOwnPropertySymbols(userWhere).length ? userWhere : undefined,
          required: Boolean(Object.keys(userWhere).length || Object.getOwnPropertySymbols(userWhere).length)
        }
      ];

      const sessions = await Session.findAll({
        where,
        include,
        attributes: { exclude: ['refreshTokenHash'] },
        order: [['createdAt', 'DESC']],
        limit: limit + 1
      });

      const all = await Session.findAll({
        where,
        include,
        attributes: ['sessionId', 'userId', 'revokedAt', 'expiresAt']
      });

      const statusOf = (session) =>
        session.revokedAt ? 'Revoked' : new Date(session.expiresAt) <= now ? 'Expired' : 'Active';

      const counts = { Active: 0, Revoked: 0, Expired: 0 };
      const users = new Set();

      for (const session of all) {
        counts[statusOf(session)] += 1;
        users.add(session.userId);
      }

      const device = (agent) => {
        if (!agent) {
          return 'Unknown';
        }

        const browser = /Edg\//.test(agent)
          ? 'Edge'
          : /Chrome\//.test(agent)
            ? 'Chrome'
            : /Firefox\//.test(agent)
              ? 'Firefox'
              : /Safari\//.test(agent)
                ? 'Safari'
                : 'Other';
        const os = /Windows/.test(agent)
          ? 'Windows'
          : /Android/.test(agent)
            ? 'Android'
            : /iPhone|iPad/.test(agent)
              ? 'iOS'
              : /Mac OS/.test(agent)
                ? 'macOS'
                : /Linux/.test(agent)
                  ? 'Linux'
                  : 'Other';

        return `${browser} on ${os}`;
      };

      return {
        columns: [
          { key: 'sessionId', label: 'Session', type: 'number' },
          { key: 'user', label: 'User' },
          { key: 'role', label: 'Role' },
          { key: 'createdAt', label: 'Signed in', type: 'date' },
          { key: 'expiresAt', label: 'Expires', type: 'date' },
          { key: 'revokedAt', label: 'Revoked', type: 'date' },
          { key: 'status', label: 'Status', type: 'status' },
          { key: 'ipAddress', label: 'IP address' },
          { key: 'device', label: 'Device' }
        ],
        rows: sessions.slice(0, limit).map((session) => ({
          sessionId: session.sessionId,
          user: session.user ? `${session.user.name} (${session.user.email})` : `User #${session.userId}`,
          role: session.user?.role || '',
          createdAt: formatDateTime(session.createdAt),
          expiresAt: formatDateTime(session.expiresAt),
          revokedAt: formatDateTime(session.revokedAt),
          status: statusOf(session),
          ipAddress: session.ipAddress || '',
          device: device(session.userAgent)
        })),
        truncated: sessions.length > limit,
        total: all.length,
        summary: [
          { label: 'Sessions', value: all.length },
          { label: 'Active', value: counts.Active },
          { label: 'Revoked', value: counts.Revoked },
          { label: 'Expired', value: counts.Expired },
          { label: 'Distinct users', value: users.size }
        ],
        groups: [
          {
            label: 'By status',
            items: breakdown(counts, ['Active', 'Revoked', 'Expired'])
          }
        ]
      };
    }
  },

  documents: {
    label: 'Documents',
    description: 'Uploaded documents by category, linked record and size.',
    access: isAdmin,
    filters: [
      ...dateFilters,
      searchFilter,
      selectFilter('category', 'Category', DOCUMENT_CATEGORIES),
      selectFilter('linkedType', 'Linked to', ['Complaint', 'Booking', 'Vehicle', 'None'])
    ],
    async build(filters, ctx, limit) {
      const where = {
        ...dateRange(filters)
      };

      if (filters.category) {
        where.category = filters.category;
      }

      if (filters.linkedType === 'Complaint') {
        where.complaintId = { [Op.ne]: null };
      } else if (filters.linkedType === 'Booking') {
        where.bookingId = { [Op.ne]: null };
      } else if (filters.linkedType === 'Vehicle') {
        where.vehicleId = { [Op.ne]: null };
      } else if (filters.linkedType === 'None') {
        where.complaintId = null;
        where.bookingId = null;
        where.vehicleId = null;
      }

      if (filters.search) {
        where.originalName = { [Op.like]: `%${escapeLike(filters.search)}%` };
      }

      const documents = await Document.findAll({
        where,
        include: [{ model: User, as: 'uploader', attributes: ['name', 'role'], required: false }],
        order: [['createdAt', 'DESC']],
        limit: limit + 1
      });

      const categoryCounts = await countBy(Document, where, 'category');
      const totalBytes = await Document.sum('sizeBytes', { where });
      const total = sumValues(categoryCounts);

      const linked = (document) =>
        document.complaintId
          ? `Complaint #${document.complaintId}`
          : document.bookingId
            ? `Booking #${document.bookingId}`
            : document.vehicleId
              ? `Vehicle #${document.vehicleId}`
              : 'Not linked';

      return {
        columns: [
          { key: 'documentId', label: 'ID', type: 'number' },
          { key: 'originalName', label: 'File name' },
          { key: 'category', label: 'Category' },
          { key: 'linked', label: 'Linked to' },
          { key: 'type', label: 'Type' },
          { key: 'sizeKb', label: 'Size (KB)', type: 'number' },
          { key: 'visibility', label: 'Visibility' },
          { key: 'uploader', label: 'Uploaded by' },
          { key: 'createdAt', label: 'Uploaded', type: 'date' }
        ],
        rows: documents.slice(0, limit).map((document) => ({
          documentId: document.documentId,
          originalName: document.originalName,
          category: document.category,
          linked: linked(document),
          type: document.extension.toUpperCase(),
          sizeKb: Math.round((document.sizeBytes / 1024) * 10) / 10,
          visibility: document.visibility === 'Staff' ? 'Staff only' : 'Owner and staff',
          uploader: document.uploader ? `${document.uploader.name} (${document.uploader.role})` : '',
          createdAt: formatDateTime(document.createdAt)
        })),
        truncated: documents.length > limit,
        total,
        summary: [
          { label: 'Documents', value: total },
          { label: 'Total size', value: `${((totalBytes || 0) / 1048576).toFixed(2)} MB` },
          { label: 'Complaint evidence', value: categoryCounts['Complaint Evidence'] || 0 },
          { label: 'Booking documents', value: categoryCounts['Booking Document'] || 0 },
          { label: 'Vehicle documents', value: categoryCounts['Vehicle Document'] || 0 }
        ],
        groups: [{ label: 'By category', items: breakdown(categoryCounts, DOCUMENT_CATEGORIES) }]
      };
    }
  },

  emails: {
    label: 'Email delivery',
    description: 'Outbound email status, retries and failures.',
    access: isAdmin,
    filters: [
      ...dateFilters,
      searchFilter,
      selectFilter('status', 'Delivery status', EMAIL_STATUSES),
      selectFilter('template', 'Message type', [
        'enquiry-admin',
        'enquiry-ack',
        'enquiry-response',
        'booking-request',
        'booking-admin',
        'booking-status',
        'complaint-ack',
        'complaint-admin',
        'complaint-status',
        'complaint-message',
        'account-welcome',
        'account-password',
        'smtp-test'
      ])
    ],
    async build(filters, ctx, limit) {
      const where = {
        ...dateRange(filters)
      };

      if (filters.status) {
        where.status = filters.status;
      }

      if (filters.template) {
        where.template = filters.template;
      }

      if (filters.search) {
        const term = `%${escapeLike(filters.search)}%`;
        where[Op.or] = [{ recipient: { [Op.like]: term } }, { subject: { [Op.like]: term } }];
      }

      const emails = await EmailLog.findAll({
        where,
        order: [['createdAt', 'DESC']],
        limit: limit + 1
      });

      const statusCounts = await countBy(EmailLog, where, 'status');
      const total = sumValues(statusCounts);

      return {
        columns: [
          { key: 'emailId', label: 'ID', type: 'number' },
          { key: 'createdAt', label: 'Created', type: 'date' },
          { key: 'recipient', label: 'Recipient' },
          { key: 'subject', label: 'Subject' },
          { key: 'template', label: 'Type' },
          { key: 'status', label: 'Status', type: 'status' },
          { key: 'attempts', label: 'Attempts', type: 'number' },
          { key: 'acceptedAt', label: 'Accepted', type: 'date' },
          { key: 'lastError', label: 'Last error' }
        ],
        rows: emails.slice(0, limit).map((email) => ({
          emailId: email.emailId,
          createdAt: formatDateTime(email.createdAt),
          recipient: email.recipient,
          subject: email.subject,
          template: email.template,
          status: email.status,
          attempts: email.attempts,
          acceptedAt: formatDateTime(email.acceptedAt),
          lastError: email.status === 'Accepted' ? '' : email.lastError || ''
        })),
        truncated: emails.length > limit,
        total,
        summary: [
          { label: 'Emails', value: total },
          { label: 'Accepted by mail server', value: statusCounts.Accepted || 0 },
          { label: 'Failed', value: statusCounts.Failed || 0 },
          { label: 'Not sent (SMTP off)', value: statusCounts.Preview || 0 },
          { label: 'Waiting', value: (statusCounts.Queued || 0) + (statusCounts.Sending || 0) },
          { label: 'Acceptance rate', value: pct(statusCounts.Accepted || 0, total) }
        ],
        groups: [{ label: 'By status', items: breakdown(statusCounts, EMAIL_STATUSES) }]
      };
    }
  },

  activity: {
    label: 'Activity audit',
    description: 'Who changed what, and when, across the system.',
    access: isAdmin,
    filters: [
      ...dateFilters,
      searchFilter,
      selectFilter('entityType', 'Record type', [
        'Vehicle',
        'Enquiry',
        'Booking',
        'Complaint',
        'Document',
        'User',
        'Content',
        'Finance',
        'Email',
        'Report'
      ])
    ],
    async build(filters, ctx, limit) {
      const where = {
        ...dateRange(filters)
      };

      if (filters.entityType) {
        where.entityType = filters.entityType;
      }

      if (filters.search) {
        const term = `%${escapeLike(filters.search)}%`;
        where[Op.or] = [{ summary: { [Op.like]: term } }, { action: { [Op.like]: term } }];
      }

      const activities = await ActivityLog.findAll({
        where,
        include: [{ model: User, as: 'actor', attributes: ['name'], required: false }],
        order: [['createdAt', 'DESC']],
        limit: limit + 1
      });

      const typeCounts = await countBy(ActivityLog, where, 'entityType');
      const actorCounts = await countBy(ActivityLog, where, 'actorRole');
      const total = sumValues(typeCounts);

      return {
        columns: [
          { key: 'createdAt', label: 'When', type: 'date' },
          { key: 'actor', label: 'User' },
          { key: 'actorRole', label: 'Role' },
          { key: 'action', label: 'Action' },
          { key: 'entity', label: 'Record' },
          { key: 'summary', label: 'Details' }
        ],
        rows: activities.slice(0, limit).map((activity) => ({
          createdAt: formatDateTime(activity.createdAt),
          actor: activity.actor?.name || 'System',
          actorRole: activity.actorRole || '',
          action: activity.action,
          entity: `${activity.entityType}${activity.entityId ? ` #${activity.entityId}` : ''}`,
          summary: activity.summary
        })),
        truncated: activities.length > limit,
        total,
        summary: [
          { label: 'Recorded actions', value: total },
          { label: 'By customers', value: actorCounts.Customer || 0 },
          { label: 'By staff', value: actorCounts.Staff || 0 },
          { label: 'By admins', value: actorCounts.Admin || 0 }
        ],
        groups: [{ label: 'By record type', items: breakdown(typeCounts) }]
      };
    }
  },

  /*
  | VIVA – Herathge – Finance Applications report (Admin only).
  | Can be saved as a Saved Report (Ahamed) like every other report.
  */
  'finance-applications': {
    label: 'Finance applications',
    description: 'Customer finance applications by status, amount and employment type.',
    access: (ctx) => isAdmin(ctx),
    filters: [
      ...dateFilters,
      searchFilter,
      selectFilter('status', 'Status', FINANCE_STATUSES),
      selectFilter('employmentType', 'Employment', FINANCE_EMPLOYMENT_TYPES)
    ],
    async build(filters, ctx, limit) {
      const where = dateRange(filters, 'createdAt');

      if (filters.status) {
        where.status = filters.status;
      }

      if (filters.employmentType) {
        where.employmentType = filters.employmentType;
      }

      if (filters.search) {
        const term = `%${escapeLike(filters.search)}%`;
        where[Op.or] = [{ reference: { [Op.like]: term } }, { vehicleReference: { [Op.like]: term } }];
      }

      const applications = await FinanceApplication.findAll({
        where,
        include: [
          { model: User, as: 'customer', attributes: ['name', 'email', 'phone'], required: false },
          { model: User, as: 'reviewer', attributes: ['name'], required: false }
        ],
        order: [['createdAt', 'DESC']],
        limit: limit + 1
      });

      const statusCounts = await countBy(FinanceApplication, where, 'status');
      const total = sumValues(statusCounts);
      const requested = (await FinanceApplication.sum('loanAmount', { where })) || 0;
      const approved = statusCounts['Approved in Principle'] || 0;
      const decided = approved + (statusCounts.Declined || 0);

      return {
        columns: [
          { key: 'reference', label: 'Reference' },
          { key: 'createdAt', label: 'Submitted', type: 'date' },
          { key: 'customer', label: 'Customer' },
          { key: 'contact', label: 'Contact' },
          { key: 'vehicleReference', label: 'Vehicle' },
          { key: 'vehiclePrice', label: 'Price (LKR)', type: 'currency' },
          { key: 'downPayment', label: 'Down payment (LKR)', type: 'currency' },
          { key: 'loanAmount', label: 'Loan (LKR)', type: 'currency' },
          { key: 'termMonths', label: 'Term (months)', type: 'number' },
          { key: 'monthlyPayment', label: 'Monthly (LKR)', type: 'currency' },
          { key: 'employmentType', label: 'Employment' },
          { key: 'status', label: 'Status', type: 'status' },
          { key: 'reviewedBy', label: 'Reviewed by' }
        ],
        rows: applications.slice(0, limit).map((application) => ({
          reference: application.reference,
          createdAt: formatDateTime(application.createdAt),
          customer: application.customer?.name || 'Unknown',
          contact: [application.customer?.email, application.contactPhone].filter(Boolean).join(' / '),
          vehicleReference: application.vehicleReference,
          vehiclePrice: Number(application.vehiclePrice),
          downPayment: Number(application.downPayment),
          loanAmount: Number(application.loanAmount),
          termMonths: application.termMonths,
          monthlyPayment: Number(application.monthlyPayment),
          employmentType: application.employmentType,
          status: application.status,
          reviewedBy: application.reviewer?.name || '—'
        })),
        truncated: applications.length > limit,
        total,
        summary: [
          { label: 'Applications', value: total },
          { label: 'Awaiting review', value: (statusCounts.Submitted || 0) + (statusCounts['Under Review'] || 0) },
          { label: 'Approved in principle', value: approved },
          { label: 'Declined', value: statusCounts.Declined || 0 },
          { label: 'Approval rate', value: pct(approved, decided) },
          { label: 'Loan amount requested', value: money(requested) }
        ],
        groups: [{ label: 'By status', items: breakdown(statusCounts, FINANCE_STATUSES) }]
      };
    }
  }
};

export const REPORT_TYPES = Object.keys(definitions);

/*
|--------------------------------------------------------------------------
| Validation
|--------------------------------------------------------------------------
*/

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Dates must use YYYY-MM-DD')
  .refine((value) => !Number.isNaN(new Date(`${value}T00:00:00`).getTime()), 'Enter a valid date');

export function validateFilters(type, input = {}) {
  const definition = definitions[type];

  if (!definition) {
    throw Object.assign(new Error('Unknown report type'), { status: 404 });
  }

  const shape = {};

  for (const filter of definition.filters) {
    if (filter.type === 'date') {
      shape[filter.key] = isoDate.optional();
    } else if (filter.type === 'select') {
      shape[filter.key] = z.enum(filter.options).optional();
    } else {
      shape[filter.key] = z.string().trim().max(100).optional();
    }
  }

  const cleaned = Object.fromEntries(
    Object.entries(input || {}).filter(
      ([key, value]) => key in shape && value !== '' && value !== null && value !== undefined
    )
  );

  const filters = z.object(shape).parse(cleaned);

  if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
    throw Object.assign(new Error('The start date must be on or before the end date'), {
      status: 422
    });
  }

  return filters;
}

function describeFilters(definition, filters) {
  return definition.filters
    .filter((filter) => filters[filter.key])
    .map((filter) => {
      let value = filters[filter.key];

      if (filter.key === 'isActive') {
        value = value === 'true' ? 'Active' : 'Inactive';
      }

      if (filter.key === 'dateField') {
        value = value === 'createdAt' ? 'request date' : 'appointment date';
      }

      return `${filter.label}: ${value}`;
    })
    .join('; ');
}

/*
|--------------------------------------------------------------------------
| Public API
|--------------------------------------------------------------------------
*/

export function listReportTypes(ctx) {
  return Object.entries(definitions)
    .filter(([, definition]) => definition.access(ctx))
    .map(([key, definition]) => ({
      key,
      label: definition.label,
      description: definition.description,
      filters: definition.filters
    }));
}

export function canAccessReport(type, ctx) {
  return Boolean(definitions[type]?.access(ctx));
}

export async function generateReport(type, rawFilters, ctx, { limit = MAX_VIEW_ROWS } = {}) {
  const definition = definitions[type];

  if (!definition) {
    throw Object.assign(new Error('Unknown report type'), { status: 404 });
  }

  if (!definition.access(ctx)) {
    throw Object.assign(new Error('You do not have permission to view this report'), {
      status: 403
    });
  }

  const filters = validateFilters(type, rawFilters);
  const result = await definition.build(filters, ctx, limit);

  return {
    type,
    title: `${definition.label} report`,
    description: definition.description,
    generatedAt: formatDateTime(new Date()),
    generatedBy: ctx.user.name,
    filters,
    filtersText: describeFilters(definition, filters),
    columns: result.columns,
    rows: result.rows,
    rowCount: result.rows.length,
    total: result.total,
    truncated: Boolean(result.truncated),
    limit,
    summary: result.summary,
    groups: result.groups || [],
    notes: result.notes || null
  };
}
