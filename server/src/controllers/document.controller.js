/*
|--------------------------------------------------------------------------
| VIVA-HEADER – S.N. Herathge – Financing & Company
| CRUD resource 4: Customer Documents (table `documents` + private files in server/storage/documents)
|--------------------------------------------------------------------------
|   CREATE  uploadDocument       POST /api/v1/documents
|   READ    listDocuments        GET /api/v1/documents
|   READ    getDocument          GET /api/v1/documents/:id
|   READ    downloadDocument     GET /api/v1/documents/:id/download
|   UPDATE  updateDocument       PATCH /api/v1/documents/:id
|   DELETE  deleteDocument       DELETE /api/v1/documents/:id
| Every write goes through Sequelize to MySQL/MariaDB and is recorded in
| activity_logs (services/activity.service.js) where it changes data.
*/

import fs from 'fs';
import { Op } from 'sequelize';

import {
  Complaint,
  Document,
  FinanceApplication,
  TestDriveBooking,
  User,
  Vehicle,
  sequelize
} from '../models/index.js';

import { DOCUMENT_CATEGORIES } from '../models/extended.js';
import { ok } from '../middleware/core.js';
import { logActivity } from '../services/activity.service.js';
import {
  DOCUMENT_TYPES,
  MAX_DOCUMENT_BYTES,
  detectFileType,
  removeStoredDocument,
  sanitizeFilename,
  sha256,
  storagePath,
  storeDocument
} from '../services/file.service.js';

/*
|--------------------------------------------------------------------------
| Secure Document Management
|--------------------------------------------------------------------------
|
| Files are written to server/storage/documents, which is NOT served by
| Express. Every download goes through `downloadDocument`, which checks the
| caller's right to the file first.
|
| Access rules
| - Customer: own uploads, plus documents marked visibility "Owner" that
|   are attached to the customer's own complaint or booking.
| - Staff: documents on complaints/bookings assigned to them (with the
|   matching module permission) and vehicle documents (inventory
|   permission), plus their own uploads.
| - Admin: every document.
|
*/

const MAX_PER_RECORD = 15;
const MAX_PER_CUSTOMER = 60;

const httpError = (status, message) => Object.assign(new Error(message), { status });

function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, (character) => `\\${character}`);
}

const documentIncludes = [
  { model: User, as: 'uploader', attributes: ['userId', 'name', 'role'], required: false },
  {
    model: Complaint,
    as: 'complaint',
    attributes: ['complaintId', 'reference', 'customerId', 'assignedTo', 'status'],
    required: false
  },
  {
    model: TestDriveBooking,
    as: 'booking',
    attributes: ['bookingId', 'vehicleReference', 'customerId', 'assignedTo', 'status'],
    required: false
  },
  {
    model: Vehicle,
    as: 'vehicle',
    attributes: ['vehicleId', 'make', 'model', 'year'],
    required: false,
    paranoid: false
  },
  // Herathge – documents attached to a finance application
  {
    model: FinanceApplication,
    as: 'financeApplication',
    attributes: ['applicationId', 'reference', 'customerId', 'status', 'vehicleReference'],
    required: false
  }
];

const perm = (req, name) => req.user.role === 'Admin' || Boolean(req.permissions?.[name]);

function canView(req, document) {
  const { user } = req;

  if (user.role === 'Admin' || document.uploadedBy === user.userId) {
    return true;
  }

  if (user.role === 'Customer') {
    if (document.visibility !== 'Owner') {
      return false;
    }

    return (
      (document.complaint && document.complaint.customerId === user.userId) ||
      (document.booking && document.booking.customerId === user.userId) ||
      (document.financeApplication && document.financeApplication.customerId === user.userId)
    );
  }

  if (user.role === 'Staff') {
    if (document.complaint) {
      return perm(req, 'canManageComplaints') && document.complaint.assignedTo === user.userId;
    }

    if (document.booking) {
      return perm(req, 'canManageBookings') && document.booking.assignedTo === user.userId;
    }

    if (document.vehicleId) {
      return perm(req, 'canManageInventory');
    }
  }

  return false;
}

function canModify(req, document) {
  if (req.user.role === 'Admin') {
    return true;
  }

  if (document.uploadedBy !== req.user.userId) {
    return false;
  }

  // Customers cannot remove evidence from a closed complaint.
  if (req.user.role === 'Customer' && document.complaint?.status === 'Closed') {
    return false;
  }

  return true;
}

function present(document) {
  const plain = document.get ? document.get({ plain: true }) : document;
  delete plain.storageKey;

  plain.linkedTo = plain.complaint
    ? { type: 'Complaint', id: plain.complaint.complaintId, label: plain.complaint.reference }
    : plain.financeApplication
      ? { type: 'Finance application', id: plain.financeApplication.applicationId, label: `${plain.financeApplication.reference} · ${plain.financeApplication.vehicleReference}` }
      : plain.booking
      ? { type: 'Booking', id: plain.booking.bookingId, label: `Booking #${plain.booking.bookingId} · ${plain.booking.vehicleReference}` }
      : plain.vehicle
        ? { type: 'Vehicle', id: plain.vehicle.vehicleId, label: `${plain.vehicle.year} ${plain.vehicle.make} ${plain.vehicle.model}` }
        : null;

  return plain;
}

async function loadDocument(id, { withKey = false } = {}) {
  const model = withKey ? Document.unscoped() : Document;

  const document = await model.findByPk(id, {
    include: documentIncludes
  });

  if (!document) {
    throw httpError(404, 'Document not found');
  }

  return document;
}

/*
|--------------------------------------------------------------------------
| Upload
|--------------------------------------------------------------------------
*/

async function resolveTarget(req, body) {
  const { user } = req;
  const complaintId = Number(body.complaintId) || null;
  const bookingId = Number(body.bookingId) || null;
  const vehicleId = Number(body.vehicleId) || null;
  const financeApplicationId = Number(body.financeApplicationId) || null;

  if ([complaintId, bookingId, vehicleId, financeApplicationId].filter(Boolean).length > 1) {
    throw httpError(422, 'A document can be linked to only one record');
  }

  if (complaintId) {
    const complaint = await Complaint.findByPk(complaintId);

    if (!complaint) {
      throw httpError(404, 'Complaint not found');
    }

    const allowed =
      user.role === 'Admin' ||
      (user.role === 'Customer' && complaint.customerId === user.userId) ||
      (user.role === 'Staff' && perm(req, 'canManageComplaints') && complaint.assignedTo === user.userId);

    if (!allowed) {
      throw httpError(403, 'You cannot attach documents to this complaint');
    }

    if (user.role === 'Customer' && complaint.status === 'Closed') {
      throw httpError(409, 'Documents cannot be added to a closed complaint');
    }

    return { complaintId, defaultCategory: 'Complaint Evidence', record: complaint };
  }

  if (bookingId) {
    const booking = await TestDriveBooking.findByPk(bookingId);

    if (!booking) {
      throw httpError(404, 'Booking not found');
    }

    const allowed =
      user.role === 'Admin' ||
      (user.role === 'Customer' && booking.customerId === user.userId) ||
      (user.role === 'Staff' && perm(req, 'canManageBookings') && booking.assignedTo === user.userId);

    if (!allowed) {
      throw httpError(403, 'You cannot attach documents to this booking');
    }

    return { bookingId, defaultCategory: 'Booking Document', record: booking };
  }

  /*
   * VIVA – Herathge – Customer Documents linked to a Finance Application.
   * The customer who owns the application (or an Admin) may attach
   * payslips, bank statements, NIC copies, etc.
   */
  if (financeApplicationId) {
    const application = await FinanceApplication.findByPk(financeApplicationId);

    if (!application) {
      throw httpError(404, 'Finance application not found');
    }

    const allowed = user.role === 'Admin' || (user.role === 'Customer' && application.customerId === user.userId);

    if (!allowed) {
      throw httpError(403, 'You cannot attach documents to this finance application');
    }

    if (user.role === 'Customer' && ['Withdrawn', 'Declined'].includes(application.status)) {
      throw httpError(409, `Documents cannot be added to a ${application.status.toLowerCase()} application`);
    }

    return { financeApplicationId, defaultCategory: 'Finance Document', record: application };
  }

  if (vehicleId) {
    if (!(user.role === 'Admin' || (user.role === 'Staff' && perm(req, 'canManageInventory')))) {
      throw httpError(403, 'Only inventory managers can attach vehicle documents');
    }

    const vehicle = await Vehicle.findByPk(vehicleId, { paranoid: false });

    if (!vehicle) {
      throw httpError(404, 'Vehicle not found');
    }

    return { vehicleId, defaultCategory: 'Vehicle Document', record: vehicle };
  }

  if (user.role !== 'Customer' && user.role !== 'Admin') {
    throw httpError(422, 'Select the complaint, booking or vehicle this document belongs to');
  }

  return { defaultCategory: 'Other', record: null };
}

// VIVA CRUD CREATE – upload (finance application, booking, complaint, vehicle or personal) (POST /api/v1/documents)
export async function uploadDocument(req, res) {
  const file = req.file;

  if (!file) {
    throw httpError(422, 'Choose a file to upload');
  }

  if (!file.size) {
    throw httpError(422, 'The selected file is empty');
  }

  if (file.size > MAX_DOCUMENT_BYTES) {
    throw httpError(413, `Files must be ${Math.round(MAX_DOCUMENT_BYTES / 1048576)} MB or smaller`);
  }

  const detected = detectFileType(file.buffer);

  if (!detected) {
    throw httpError(
      415,
      `This file type is not allowed. Upload ${Object.values(DOCUMENT_TYPES)
        .map((type) => type.label)
        .join(', ')}.`
    );
  }

  const target = await resolveTarget(req, req.body);

  const category = DOCUMENT_CATEGORIES.includes(req.body.category)
    ? req.body.category
    : target.defaultCategory;

  // Customers may not upload staff-only documents; staff may.
  const visibility =
    req.user.role !== 'Customer' && req.body.visibility === 'Staff' ? 'Staff' : 'Owner';

  const description = req.body.description ? String(req.body.description).trim().slice(0, 500) : null;

  const linkWhere = target.complaintId
    ? { complaintId: target.complaintId }
    : target.financeApplicationId
      ? { financeApplicationId: target.financeApplicationId }
      : target.bookingId
      ? { bookingId: target.bookingId }
      : target.vehicleId
        ? { vehicleId: target.vehicleId }
        : null;

  if (linkWhere && (await Document.count({ where: linkWhere })) >= MAX_PER_RECORD) {
    throw httpError(409, `A record can hold at most ${MAX_PER_RECORD} documents`);
  }

  if (req.user.role === 'Customer' && (await Document.count({ where: { uploadedBy: req.user.userId } })) >= MAX_PER_CUSTOMER) {
    throw httpError(409, `You can store at most ${MAX_PER_CUSTOMER} documents. Remove an older document first.`);
  }

  const checksum = sha256(file.buffer);
  const storageKey = await storeDocument(file.buffer, detected);

  let document;

  try {
    document = await sequelize.transaction(async (transaction) => {
      const created = await Document.create(
        {
          uploadedBy: req.user.userId,
          category,
          complaintId: target.complaintId || null,
          bookingId: target.bookingId || null,
          vehicleId: target.vehicleId || null,
          financeApplicationId: target.financeApplicationId || null,
          originalName: sanitizeFilename(file.originalname, detected),
          storageKey,
          mimeType: DOCUMENT_TYPES[detected].mime,
          extension: detected,
          sizeBytes: file.size,
          checksumSha256: checksum,
          description,
          visibility
        },
        { transaction }
      );

      if (target.complaintId) {
        await Complaint.update(
          { lastActivityAt: new Date() },
          { where: { complaintId: target.complaintId }, transaction }
        );
      }

      await logActivity(
        req,
        'document.uploaded',
        'Document',
        created.documentId,
        `${created.originalName} uploaded${target.complaintId ? ` to ${target.record.reference}` : ''}`,
        transaction
      );

      return created;
    });
  } catch (error) {
    // Keep disk and database consistent if the insert fails.
    await removeStoredDocument(storageKey).catch(() => {});
    throw error;
  }

  const created = await loadDocument(document.documentId);

  return res.status(201).json({
    success: true,
    message: `${created.originalName} uploaded`,
    data: present(created),
    meta: {}
  });
}

/*
|--------------------------------------------------------------------------
| List / read
|--------------------------------------------------------------------------
*/

// VIVA CRUD READ – list with access rules (GET /api/v1/documents)
export async function listDocuments(req, res) {
  const { user } = req;
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
  const where = {};
  const and = [];

  for (const key of ['complaintId', 'bookingId', 'vehicleId', 'financeApplicationId']) {
    if (Number(req.query[key]) > 0) {
      where[key] = Number(req.query[key]);
    }
  }

  if (req.query.category && DOCUMENT_CATEGORIES.includes(req.query.category)) {
    where.category = req.query.category;
  }

  if (req.query.linkedType === 'Complaint') {
    where.complaintId = { [Op.ne]: null };
  } else if (req.query.linkedType === 'Booking') {
    where.bookingId = { [Op.ne]: null };
  } else if (req.query.linkedType === 'Vehicle') {
    where.vehicleId = { [Op.ne]: null };
  } else if (req.query.linkedType === 'Finance') {
    where.financeApplicationId = { [Op.ne]: null };
  } else if (req.query.linkedType === 'None') {
    Object.assign(where, { complaintId: null, bookingId: null, vehicleId: null, financeApplicationId: null });
  }

  if (['pdf', 'jpg', 'png', 'webp', 'docx'].includes(req.query.fileType)) {
    where.extension = req.query.fileType;
  }

  if (req.query.search) {
    const raw = String(req.query.search).trim().slice(0, 100);
    and.push({
      [Op.or]: [
        { originalName: { [Op.like]: `%${escapeLike(raw)}%` } },
        { description: { [Op.like]: `%${escapeLike(raw)}%` } },
        ...(/^\d+$/.test(raw) ? [{ documentId: Number(raw) }] : [])
      ]
    });
  }

  if (req.query.dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(req.query.dateFrom)) {
    and.push({ createdAt: { [Op.gte]: new Date(`${req.query.dateFrom}T00:00:00`) } });
  }

  if (req.query.dateTo && /^\d{4}-\d{2}-\d{2}$/.test(req.query.dateTo)) {
    and.push({ createdAt: { [Op.lte]: new Date(`${req.query.dateTo}T23:59:59.999`) } });
  }

  // Access scope.
  if (user.role === 'Customer') {
    and.push({
      [Op.or]: [
        { uploadedBy: user.userId },
        { visibility: 'Owner', '$complaint.customer_id$': user.userId },
        { visibility: 'Owner', '$booking.customer_id$': user.userId },
        { visibility: 'Owner', '$financeApplication.customer_id$': user.userId }
      ]
    });
  } else if (user.role === 'Staff') {
    const scopes = [{ uploadedBy: user.userId }];

    if (perm(req, 'canManageComplaints')) {
      scopes.push({ '$complaint.assigned_to$': user.userId });
    }

    if (perm(req, 'canManageBookings')) {
      scopes.push({ '$booking.assigned_to$': user.userId });
    }

    if (perm(req, 'canManageInventory')) {
      scopes.push({ vehicleId: { [Op.ne]: null } });
    }

    and.push({ [Op.or]: scopes });
  }

  if (and.length) {
    where[Op.and] = and;
  }

  const sorts = {
    newest: [['createdAt', 'DESC']],
    oldest: [['createdAt', 'ASC']],
    name: [['originalName', 'ASC']],
    name_desc: [['originalName', 'DESC']],
    size: [['sizeBytes', 'DESC']],
    size_asc: [['sizeBytes', 'ASC']]
  };

  const result = await Document.findAndCountAll({
    where,
    include: documentIncludes,
    order: sorts[req.query.sort] || sorts.newest,
    limit,
    offset: (page - 1) * limit,
    distinct: true,
    subQuery: false
  });

  return ok(res, 'Documents retrieved', result.rows.map(present), {
    page,
    limit,
    total: result.count,
    pages: Math.ceil(result.count / limit),
    maxBytes: MAX_DOCUMENT_BYTES,
    allowedTypes: Object.values(DOCUMENT_TYPES).map((type) => type.label)
  });
}

// VIVA CRUD READ – details (GET /api/v1/documents/:id)
export async function getDocument(req, res) {
  const document = await loadDocument(req.params.id);

  if (!canView(req, document)) {
    throw httpError(404, 'Document not found');
  }

  return ok(res, 'Document retrieved', present(document));
}

/*
|--------------------------------------------------------------------------
| Download / preview
|--------------------------------------------------------------------------
*/

// VIVA CRUD READ – authorised download (nosniff, attachment) (GET /api/v1/documents/:id/download)
export async function downloadDocument(req, res) {
  const document = await loadDocument(req.params.id, { withKey: true });

  // 404 rather than 403 so the existence of other users' files is not revealed.
  if (!canView(req, document)) {
    throw httpError(404, 'Document not found');
  }

  const filePath = storagePath(document.storageKey);

  if (!fs.existsSync(filePath)) {
    throw httpError(410, 'The stored file is missing. Please upload it again.');
  }

  const inlineAllowed = ['pdf', 'jpg', 'png', 'webp'].includes(document.extension);
  const disposition = req.query.disposition === 'inline' && inlineAllowed ? 'inline' : 'attachment';
  const asciiName = document.originalName.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, "'");

  res.setHeader('Content-Type', document.mimeType);
  res.setHeader('Content-Length', document.sizeBytes);
  res.setHeader(
    'Content-Disposition',
    `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(document.originalName)}`
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");

  return res.sendFile(filePath, {
    dotfiles: 'deny',
    headers: {
      'Content-Type': document.mimeType
    }
  });
}

/*
|--------------------------------------------------------------------------
| Update / delete
|--------------------------------------------------------------------------
*/

// VIVA CRUD UPDATE – rename / category / description (PATCH /api/v1/documents/:id)
export async function updateDocument(req, res) {
  const document = await loadDocument(req.params.id);

  if (!canView(req, document)) {
    throw httpError(404, 'Document not found');
  }

  if (!canModify(req, document)) {
    throw httpError(403, 'You cannot change this document');
  }

  const { originalName, description, category, visibility } = req.validated.body;
  const changes = {};

  if (originalName !== undefined) {
    const extension = `.${document.extension}`;
    let name = sanitizeFilename(originalName, document.extension);

    if (!name.toLowerCase().endsWith(extension)) {
      name = `${name}${extension}`;
    }

    changes.originalName = name;
  }

  if (description !== undefined) {
    changes.description = description || null;
  }

  if (category !== undefined) {
    changes.category = category;
  }

  if (visibility !== undefined && req.user.role !== 'Customer') {
    changes.visibility = visibility;
  }

  await document.update(changes);
  await logActivity(req, 'document.updated', 'Document', document.documentId, `${document.originalName} details updated`);

  return ok(res, 'Document updated', present(await loadDocument(document.documentId)));
}

// VIVA CRUD DELETE – removes the row and the stored file (DELETE /api/v1/documents/:id)
export async function deleteDocument(req, res) {
  const document = await loadDocument(req.params.id, { withKey: true });

  if (!canView(req, document)) {
    throw httpError(404, 'Document not found');
  }

  if (!canModify(req, document)) {
    throw httpError(403, 'You cannot delete this document');
  }

  // Delete the row and the file together. If the file cannot be removed
  // (anything other than "already missing"), the transaction is rolled
  // back so the metadata still points at the existing file.
  await sequelize.transaction(async (transaction) => {
    await document.destroy({ transaction });
    await logActivity(req, 'document.deleted', 'Document', document.documentId, `${document.originalName} deleted`, transaction);
    await removeStoredDocument(document.storageKey);
  });

  return ok(res, 'Document deleted');
}
