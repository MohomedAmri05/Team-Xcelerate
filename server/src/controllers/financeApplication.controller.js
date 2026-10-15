/*
|--------------------------------------------------------------------------
| VIVA – S.N. Herathge – Financing & Company module
| CRUD resource 3: Finance Applications (table `finance_applications`)
|--------------------------------------------------------------------------
| Customer (own applications only):
|   CREATE  createApplication       POST   /api/v1/finance-applications
|   READ    listMyApplications      GET    /api/v1/my/finance-applications
|           getMyApplication        GET    /api/v1/my/finance-applications/:id
|   UPDATE  updateMyApplication     PUT    /api/v1/my/finance-applications/:id   (while "Submitted")
|           withdrawMyApplication   PATCH  /api/v1/my/finance-applications/:id/withdraw
|   DELETE  deleteMyApplication     DELETE /api/v1/my/finance-applications/:id   (not while under review/approved)
|
| Admin (dashboard › Finance applications):
|   READ    listApplications        GET    /api/v1/finance-applications
|           getApplication          GET    /api/v1/finance-applications/:id
|   UPDATE  reviewApplication       PATCH  /api/v1/finance-applications/:id    (status, decision, notes)
|   DELETE  deleteApplication       DELETE /api/v1/finance-applications/:id
|
| The monthly payment is ALWAYS calculated on the server with the active
| financing configuration OF THAT VEHICLE (its own plan if the Admin made
| one for it, otherwise the general plan – services/finance.service.js),
| using utils/finance.js calculateLoan – the browser's
| number is never trusted. An approval here is "in principle" only and is
| not a loan offer.
*/

import { Op } from 'sequelize';

import {
  sequelize,
  FinanceApplication,
  Vehicle,
  VehicleImage,
  User,
  Document
} from '../models/index.js';

import { ok } from '../middleware/core.js';
import { calculateLoan } from '../utils/finance.js';
import { getAdminRecipient, queueMail } from '../services/mail.service.js';
import { logActivity } from '../services/activity.service.js';
import { removeStoredDocument } from '../services/file.service.js';
import { FINANCE_STATUSES } from '../models/extended.js';
import { activePlanFor } from '../services/finance.service.js';

const httpError = (status, message) => Object.assign(new Error(message), { status });

const OPEN_STATUSES = ['Submitted', 'Under Review'];
// A customer may permanently delete an application only in these states.
const CUSTOMER_DELETABLE = ['Submitted', 'Withdrawn', 'Declined'];

const money = (value) => `LKR ${Number(value || 0).toLocaleString('en-LK', { maximumFractionDigits: 2 })}`;
const round2 = (value) => Math.round(Number(value) * 100) / 100;

export function buildFinanceReference(applicationId, date = new Date()) {
  return `HS-FIN-${date.getFullYear()}-${String(applicationId).padStart(5, '0')}`;
}

function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, (character) => `\\${character}`);
}

const vehicleLabel = (vehicle) => `${vehicle.year} ${vehicle.make} ${vehicle.model}`;

const includes = (forStaff) => [
  {
    model: Vehicle,
    as: 'vehicle',
    required: false,
    paranoid: false,
    attributes: ['vehicleId', 'make', 'model', 'year', 'price', 'status'],
    include: [{ model: VehicleImage, as: 'images', required: false, attributes: ['imageId', 'url', 'isPrimary', 'altText', 'sortOrder'] }]
  },
  ...(forStaff
    ? [
        { model: User, as: 'customer', required: false, attributes: ['userId', 'name', 'email', 'phone'] },
        { model: User, as: 'reviewer', required: false, attributes: ['userId', 'name'] }
      ]
    : [])
];

// Customers never see internal staff notes.
function presentForCustomer(application) {
  const plain = application.get ? application.get({ plain: true }) : { ...application };
  delete plain.staffNotes;
  delete plain.reviewedBy;
  return plain;
}

async function activeConfiguration(vehicleId) {
  // The vehicle's own plan, or the general plan.
  const configuration = await activePlanFor(vehicleId);

  if (!configuration) {
    throw httpError(503, 'Vehicle financing is not available right now. Please contact High Street.');
  }

  return configuration;
}

/*
 * Server-side calculation shared by CREATE and UPDATE.
 * Applies the active configuration's business rules:
 *   - minimum down payment (% of vehicle price)
 *   - maximum loan term (months)
 */
function calculate(vehicle, configuration, body) {
  const price = Number(vehicle.price);
  const downPayment = Number(body.downPayment);
  const termMonths = Number(body.termMonths);
  const minimum = round2((price * Number(configuration.minDownPaymentPct)) / 100);

  if (downPayment < minimum) {
    throw httpError(422, `The minimum down payment for this vehicle is ${money(minimum)} (${Number(configuration.minDownPaymentPct)}%)`);
  }

  if (downPayment >= price) {
    throw httpError(422, 'The down payment must be less than the vehicle price');
  }

  if (termMonths > Number(configuration.maxLoanTermMonths)) {
    throw httpError(422, `The longest repayment term available is ${configuration.maxLoanTermMonths} months`);
  }

  const result = calculateLoan(price, downPayment, termMonths, Number(configuration.annualInterestRate));

  return {
    configId: configuration.configId,
    vehiclePrice: price,
    downPayment,
    loanAmount: round2(result.principal),
    termMonths,
    annualInterestRate: Number(configuration.annualInterestRate),
    monthlyPayment: round2(result.monthlyPayment)
  };
}

function summaryText(application) {
  return [
    `Vehicle: ${application.vehicleReference}`,
    `Vehicle price: ${money(application.vehiclePrice)}`,
    `Down payment: ${money(application.downPayment)}`,
    `Loan amount: ${money(application.loanAmount)} over ${application.termMonths} months at ${Number(application.annualInterestRate)}% a year`,
    `Estimated monthly payment: ${money(application.monthlyPayment)}`
  ].join('\n');
}

async function emailCustomer(application, customer, subject, intro, key, req) {
  if (!customer?.email) {
    return null;
  }

  return queueMail(
    {
      to: customer.email,
      subject: `${subject} [${application.reference}]`,
      heading: subject,
      text: [
        `Hello ${customer.name},`,
        intro,
        summaryText(application),
        'This estimate is not a loan offer. Final approval depends on the lender and your documents.',
        'You can follow this application under My finance applications in your High Street account.'
      ].join('\n\n')
    },
    {
      messageKey: key,
      template: 'finance-application',
      relatedType: 'FinanceApplication',
      relatedId: application.applicationId,
      createdBy: req.user?.userId || null
    }
  );
}

async function findOwn(req, id) {
  const application = await FinanceApplication.findOne({
    where: { applicationId: id, customerId: req.user.userId },
    include: includes(false)
  });

  if (!application) {
    throw httpError(404, 'Finance application not found');
  }

  return application;
}

async function findAny(id) {
  const application = await FinanceApplication.findByPk(id, { include: includes(true) });

  if (!application) {
    throw httpError(404, 'Finance application not found');
  }

  return application;
}

async function documentsFor(applicationId) {
  return Document.findAll({
    where: { financeApplicationId: applicationId },
    attributes: ['documentId', 'originalName', 'category', 'mimeType', 'extension', 'sizeBytes', 'visibility', 'createdAt', 'updatedAt', 'uploadedBy', 'description'],
    order: [['createdAt', 'DESC']]
  });
}

// Deletes the application's documents (database rows and stored files).
async function removeDocuments(applicationId, transaction) {
  const documents = await Document.unscoped().findAll({ where: { financeApplicationId: applicationId }, transaction });
  await Document.destroy({ where: { financeApplicationId: applicationId }, transaction });
  return documents.map((document) => document.storageKey);
}

/* ======================================================================
 * CUSTOMER
 * ==================================================================== */

/*
| CREATE – customer applies for financing on an Available vehicle
*/
export async function createApplication(req, res) {
  const body = req.validated.body;

  const vehicle = await Vehicle.findOne({ where: { vehicleId: body.vehicleId, status: 'Available' } });

  if (!vehicle) {
    throw httpError(404, 'This vehicle is not available for financing');
  }

  const configuration = await activeConfiguration(vehicle.vehicleId);

  const duplicate = await FinanceApplication.findOne({
    where: { customerId: req.user.userId, vehicleId: vehicle.vehicleId, status: { [Op.in]: OPEN_STATUSES } }
  });

  if (duplicate) {
    throw httpError(409, `You already have an open finance application for this vehicle (${duplicate.reference})`);
  }

  const figures = calculate(vehicle, configuration, body);

  const application = await sequelize.transaction(async (transaction) => {
    const created = await FinanceApplication.create(
      {
        customerId: req.user.userId,
        vehicleId: vehicle.vehicleId,
        vehicleReference: vehicleLabel(vehicle),
        ...figures,
        employmentType: body.employmentType,
        monthlyIncome: body.monthlyIncome,
        contactPhone: body.contactPhone,
        customerNotes: body.customerNotes,
        status: 'Submitted'
      },
      { transaction }
    );

    await created.update({ reference: buildFinanceReference(created.applicationId) }, { transaction });
    await logActivity(req, 'finance_application.created', 'FinanceApplication', created.applicationId, `${created.reference} submitted for ${created.vehicleReference}`, transaction);

    return created;
  });

  const customer = await User.findByPk(req.user.userId);

  await emailCustomer(
    application,
    customer,
    'We received your finance application',
    `Thank you. We received your finance application ${application.reference}. Our team will review it and contact you.`,
    `finance-${application.applicationId}-received`,
    req
  );

  const admin = getAdminRecipient();

  if (admin) {
    await queueMail(
      {
        to: admin,
        replyTo: customer?.email,
        subject: `New finance application ${application.reference} [${application.reference}]`,
        heading: 'New finance application',
        text: [
          `${customer?.name} (${customer?.email}, ${application.contactPhone}) applied for financing.`,
          summaryText(application),
          `Employment: ${application.employmentType} · Monthly income: ${money(application.monthlyIncome)}`
        ].join('\n\n')
      },
      {
        messageKey: `finance-${application.applicationId}-admin`,
        template: 'finance-application-admin',
        relatedType: 'FinanceApplication',
        relatedId: application.applicationId,
        createdBy: req.user.userId
      }
    );
  }

  return res.status(201).json({
    success: true,
    message: `Finance application ${application.reference} submitted`,
    data: presentForCustomer(await findOwn(req, application.applicationId)),
    meta: {}
  });
}

/*
| READ – the signed-in customer's applications
*/
export async function listMyApplications(req, res) {
  const applications = await FinanceApplication.findAll({
    where: { customerId: req.user.userId },
    include: includes(false),
    order: [['createdAt', 'DESC']]
  });

  return ok(res, 'Finance applications retrieved', applications.map(presentForCustomer));
}

/*
| READ – one of the customer's applications, with its documents
*/
export async function getMyApplication(req, res) {
  const application = await findOwn(req, req.params.id);
  const data = presentForCustomer(application);
  data.documents = await documentsFor(application.applicationId);

  return ok(res, 'Finance application retrieved', data);
}

/*
| UPDATE – customer edits the figures while the status is still "Submitted".
| The payment is recalculated with the current active configuration.
*/
export async function updateMyApplication(req, res) {
  const application = await findOwn(req, req.params.id);

  if (application.status !== 'Submitted') {
    throw httpError(409, `This application is ${application.status.toLowerCase()} and can no longer be changed`);
  }

  const vehicle = await Vehicle.findByPk(application.vehicleId);

  if (!vehicle || vehicle.status !== 'Available') {
    throw httpError(409, 'This vehicle is no longer available. Withdraw the application instead.');
  }

  const body = req.validated.body;
  const figures = calculate(vehicle, await activeConfiguration(vehicle.vehicleId), body);

  await application.update({
    ...figures,
    vehicleReference: vehicleLabel(vehicle),
    employmentType: body.employmentType,
    monthlyIncome: body.monthlyIncome,
    contactPhone: body.contactPhone,
    customerNotes: body.customerNotes
  });

  await logActivity(req, 'finance_application.updated', 'FinanceApplication', application.applicationId, `${application.reference} updated by the customer`);

  return ok(res, 'Finance application updated', presentForCustomer(await findOwn(req, application.applicationId)));
}

/*
| UPDATE – customer withdraws an open application (record is kept)
*/
export async function withdrawMyApplication(req, res) {
  const application = await findOwn(req, req.params.id);

  if (!OPEN_STATUSES.includes(application.status)) {
    throw httpError(409, `Only submitted or under-review applications can be withdrawn (this one is ${application.status})`);
  }

  await application.update({ status: 'Withdrawn' });
  await logActivity(req, 'finance_application.withdrawn', 'FinanceApplication', application.applicationId, `${application.reference} withdrawn by the customer`);

  return ok(res, 'Finance application withdrawn', presentForCustomer(application));
}

/*
| DELETE – customer permanently deletes an application that is not being
| processed (Submitted, Withdrawn or Declined). Its documents are deleted too.
*/
export async function deleteMyApplication(req, res) {
  const application = await findOwn(req, req.params.id);

  if (!CUSTOMER_DELETABLE.includes(application.status)) {
    throw httpError(409, `An application that is ${application.status.toLowerCase()} cannot be deleted. Please contact High Street.`);
  }

  const reference = application.reference;
  const keys = await sequelize.transaction(async (transaction) => {
    const storageKeys = await removeDocuments(application.applicationId, transaction);
    await application.destroy({ transaction });
    await logActivity(req, 'finance_application.deleted', 'FinanceApplication', application.applicationId, `${reference} deleted by the customer`, transaction);
    return storageKeys;
  });

  await Promise.all(keys.map((key) => removeStoredDocument(key)));

  return ok(res, `Finance application ${reference} deleted`);
}

/* ======================================================================
 * ADMIN
 * ==================================================================== */

/*
| READ – all applications with filters (status, search, from/to dates)
*/
export async function listApplications(req, res) {
  const where = {};

  if (FINANCE_STATUSES.includes(req.query.status)) {
    where.status = req.query.status;
  }

  if (req.query.from || req.query.to) {
    where.createdAt = {};

    if (req.query.from) {
      where.createdAt[Op.gte] = new Date(`${req.query.from}T00:00:00`);
    }

    if (req.query.to) {
      where.createdAt[Op.lte] = new Date(`${req.query.to}T23:59:59`);
    }
  }

  if (req.query.search) {
    const term = `%${escapeLike(String(req.query.search).trim().slice(0, 100))}%`;
    where[Op.or] = [
      { reference: { [Op.like]: term } },
      { vehicleReference: { [Op.like]: term } },
      { '$customer.name$': { [Op.like]: term } },
      { '$customer.email$': { [Op.like]: term } }
    ];
  }

  const applications = await FinanceApplication.findAll({
    where,
    include: includes(true),
    order: [['createdAt', 'DESC']],
    subQuery: false
  });

  const counts = Object.fromEntries(FINANCE_STATUSES.map((status) => [status, 0]));
  const grouped = await FinanceApplication.findAll({
    attributes: ['status', [sequelize.fn('COUNT', sequelize.col('application_id')), 'total']],
    group: ['status'],
    raw: true
  });
  grouped.forEach((row) => {
    counts[row.status] = Number(row.total);
  });

  return ok(res, 'Finance applications retrieved', applications, { counts });
}

/*
| READ – one application with customer, vehicle and documents
*/
export async function getApplication(req, res) {
  const application = await findAny(req.params.id);
  const data = application.get({ plain: true });
  data.documents = await documentsFor(application.applicationId);

  return ok(res, 'Finance application retrieved', data);
}

/*
| UPDATE – Admin review: status, decision note for the customer, internal notes.
| Declining requires a decision note so the customer is told why.
*/
export async function reviewApplication(req, res) {
  const application = await findAny(req.params.id);
  const body = req.validated.body;
  const previous = application.status;

  if (previous === 'Withdrawn' && body.status !== 'Withdrawn') {
    throw httpError(409, 'The customer withdrew this application, so it cannot be reopened');
  }

  if (body.status === 'Declined' && !body.decisionNote) {
    throw httpError(422, 'Add a decision note for the customer before declining the application');
  }

  const decisionChanged = body.status !== previous || (body.decisionNote || null) !== (application.decisionNote || null);

  await application.update({
    status: body.status,
    decisionNote: body.decisionNote,
    staffNotes: body.staffNotes,
    reviewedBy: req.user.userId,
    reviewedAt: new Date()
  });

  await logActivity(req, 'finance_application.reviewed', 'FinanceApplication', application.applicationId, `${application.reference}: ${previous} → ${body.status}`);

  if (decisionChanged && body.status !== 'Submitted') {
    const lines = {
      'Under Review': 'Our team is now reviewing your finance application.',
      'Approved in Principle': 'Good news: your finance application has been approved in principle. We will contact you about the next steps and documents.',
      Declined: 'We are sorry, we are not able to take your finance application forward.',
      Withdrawn: 'Your finance application has been marked as withdrawn.'
    };

    await emailCustomer(
      application,
      application.customer,
      `Finance application ${body.status.toLowerCase()}`,
      [lines[body.status], body.decisionNote ? `Note from High Street: ${body.decisionNote}` : null].filter(Boolean).join('\n\n'),
      `finance-${application.applicationId}-status-${body.status}-${Date.now()}`,
      req
    );
  }

  return ok(res, 'Finance application updated', await findAny(application.applicationId));
}

/*
| DELETE – Admin permanently deletes an application and its documents
*/
export async function deleteApplication(req, res) {
  const application = await findAny(req.params.id);
  const reference = application.reference;

  const keys = await sequelize.transaction(async (transaction) => {
    const storageKeys = await removeDocuments(application.applicationId, transaction);
    await application.destroy({ transaction });
    await logActivity(req, 'finance_application.deleted', 'FinanceApplication', application.applicationId, `${reference} deleted by an Admin`, transaction);
    return storageKeys;
  });

  await Promise.all(keys.map((key) => removeStoredDocument(key)));

  return ok(res, `Finance application ${reference} deleted`);
}
