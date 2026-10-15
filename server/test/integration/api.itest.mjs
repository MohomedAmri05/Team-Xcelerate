/*
|--------------------------------------------------------------------------
| High Street API — integration tests
|--------------------------------------------------------------------------
|
| Run:  npm --prefix server run test:integration
|
| Requires a running MySQL/MariaDB server (same credentials as .env). The
| suite creates and migrates "<DB_NAME>_test" from scratch, so it never
| touches the development database. Uses Node's built-in test runner.
|
*/

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

import { SERVER_DIR, files, prepareEnvironment, rawQuery, resetTestDatabase, startSmtpServer } from './helpers.mjs';

const require = createRequire(path.join(SERVER_DIR, 'package.json'));
const request = require('supertest');
const bcrypt = require('bcrypt');

const smtp = await startSmtpServer();
prepareEnvironment(smtp.port);
await resetTestDatabase();

const { app } = await import('../../src/app.js');
const models = await import('../../src/models/index.js');
const mail = await import('../../src/services/mail.service.js');
const { calculateLoan } = await import('../../src/utils/finance.js');

const { sequelize, User, StaffPermission, Vehicle, Finance, EmailLog } = models;

const api = () => request(app);
const auth = (token) => ({ Authorization: `Bearer ${token}` });
const tokens = {};
const ids = {};

// Each test login comes from a distinct simulated client IP (the app trusts
// one proxy hop), so the real per-IP login rate limit stays enabled.
let clientIp = 0;
const nextIp = () => `10.10.${Math.floor(++clientIp / 250)}.${(clientIp % 250) + 1}`;

async function login(email, password) {
  const response = await api().post('/api/v1/auth/login').set('X-Forwarded-For', nextIp()).send({ email, password });
  assert.equal(response.status, 200, `login ${email}: ${response.body.message}`);
  return response.body.data;
}

async function createUser({ name, email, role, password = 'Password!2026x', permissions = null, phone = '0771234567' }) {
  const user = await User.create({
    name,
    email,
    role,
    phone,
    isActive: true,
    passwordHash: await bcrypt.hash(password, 4)
  });

  if (permissions) {
    await StaffPermission.create({ userId: user.userId, ...permissions });
  }

  return user;
}

before(async () => {
  await createUser({ name: 'Admin One', email: 'admin@test.lk', role: 'Admin' });
  await createUser({
    name: 'Staff Plain',
    email: 'staff.plain@test.lk',
    role: 'Staff',
    permissions: { canManageInventory: true, canManageEnquiries: false, canViewAssignedContacts: false, canArchiveRecords: false, canManageComplaints: false, canViewLimitedAnalytics: false }
  });
  await createUser({
    name: 'Staff Care',
    email: 'staff.care@test.lk',
    role: 'Staff',
    permissions: { canManageInventory: false, canManageEnquiries: true, canViewAssignedContacts: false, canArchiveRecords: false, canManageComplaints: false, canViewLimitedAnalytics: true }
  });
  await createUser({ name: 'Customer Alpha', email: 'alpha@customer.lk', role: 'Customer' });
  await createUser({ name: 'Customer Beta', email: 'beta@customer.lk', role: 'Customer' });

  await Finance.create({ name: 'Test plan', annualInterestRate: 12, minDownPaymentPct: 20, maxLoanTermMonths: 60, isActive: true });

  for (const key of ['admin@test.lk', 'staff.plain@test.lk', 'staff.care@test.lk', 'alpha@customer.lk', 'beta@customer.lk']) {
    const data = await login(key, 'Password!2026x');
    tokens[key.split('@')[0]] = data.accessToken;
    tokens[`${key.split('@')[0]}Refresh`] = data.refreshToken;
  }
});

after(async () => {
  mail.stopEmailWorker();
  await sequelize.close();
  await smtp.close();
  fs.rmSync(process.env.DOCUMENT_STORAGE_DIR, { recursive: true, force: true });
});

/*
|--------------------------------------------------------------------------
*/

describe('platform', () => {
  it('reports health', async () => {
    const response = await api().get('/api/v1/health');
    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
  });

  it('returns JSON 404 for unknown routes', async () => {
    const response = await api().get('/api/v1/does-not-exist');
    assert.equal(response.status, 404);
    assert.equal(response.body.success, false);
  });

  it('rejects protected routes without a token', async () => {
    assert.equal((await api().get('/api/v1/users')).status, 401);
    assert.equal((await api().get('/api/v1/complaints')).status, 401);
    assert.equal((await api().get('/api/v1/reports/vehicles')).status, 401);
  });

  it('rejects malformed JSON with 400 (not 500)', async () => {
    const response = await api().post('/api/v1/auth/login').set('Content-Type', 'application/json').send('{"email":');
    assert.equal(response.status, 400);
  });

  it('calculates amortised and zero-interest loans', () => {
    assert.ok(Math.abs(calculateLoan(1000000, 200000, 12, 12).monthlyPayment - 71079.03) < 0.01);
    assert.ok(Math.abs(calculateLoan(120000, 20000, 12, 0).monthlyPayment - 8333.33) < 0.01);
  });
});

describe('authentication and sessions', () => {
  it('rejects weak registration passwords', async () => {
    const response = await api()
      .post('/api/v1/auth/register')
      .send({ name: 'Weak', email: 'weak@customer.lk', phone: '0771234567', password: 'short' });
    assert.equal(response.status, 422);
  });

  it('registers a customer and sends a welcome email', async () => {
    const response = await api()
      .post('/api/v1/auth/register')
      .send({ name: 'Gamma Customer', email: 'gamma@customer.lk', phone: '+94 77 123 4567', password: 'Gamma!Pass2026' });
    assert.equal(response.status, 201);
    assert.equal(response.body.data.user.role, 'Customer');
    const welcome = smtp.find((message) => message.envelopeTo.includes('gamma@customer.lk'));
    assert.equal(welcome.length, 1);
    assert.match(welcome[0].subject, /Welcome to High Street/);
  });

  it('rotates refresh tokens and rejects the old one', async () => {
    const original = tokens.alphaRefresh;
    const first = await api().post('/api/v1/auth/refresh').send({ refreshToken: original });
    assert.equal(first.status, 200);
    assert.notEqual(first.body.data.refreshToken, original);
    const reuse = await api().post('/api/v1/auth/refresh').send({ refreshToken: original });
    assert.equal(reuse.status, 401);
    tokens.alpha = first.body.data.accessToken;
    tokens.alphaRefresh = first.body.data.refreshToken;
  });

  it('revokes the session on logout', async () => {
    const data = await login('beta@customer.lk', 'Password!2026x');
    assert.equal((await api().post('/api/v1/auth/logout').set(auth(data.accessToken))).status, 200);
    assert.equal((await api().get('/api/v1/auth/me').set(auth(data.accessToken))).status, 401);
  });

  it('lets an Admin list sessions for all users', async () => {
    const mine = await api().get('/api/v1/sessions').set(auth(tokens.admin));
    const all = await api().get('/api/v1/sessions?scope=all').set(auth(tokens.admin));
    assert.equal(all.status, 200);
    assert.ok(all.body.data.length > mine.body.data.length);
    assert.ok(all.body.data.every((session) => !('refreshTokenHash' in session)));
  });

  it('prevents customers from using the Admin session scope', async () => {
    const response = await api().get('/api/v1/sessions?scope=all').set(auth(tokens.alpha));
    assert.ok(response.body.data.every((session) => session.userId === response.body.data[0].userId));
  });
});

describe('vehicles and images (CRUD)', () => {
  it('creates a vehicle as Draft even if Available is requested', async () => {
    const response = await api()
      .post('/api/v1/vehicles')
      .set(auth(tokens.admin))
      .send({ make: 'Toyota', model: 'Aqua 100% Hybrid', year: 2021, price: 8950000, mileage: 30000, condition: 'Used', type: 'Hatchback', fuelType: 'Hybrid', transmission: 'Automatic', status: 'Available' });
    assert.equal(response.status, 201);
    assert.equal(response.body.data.status, 'Draft');
    ids.vehicle = response.body.data.vehicleId;
  });

  it('refuses to publish a vehicle without an image', async () => {
    const response = await api().patch(`/api/v1/vehicles/${ids.vehicle}/status`).set(auth(tokens.admin)).send({ status: 'Available' });
    assert.equal(response.status, 422);
  });

  it('rejects a non-image disguised as PNG', async () => {
    const response = await api()
      .post(`/api/v1/vehicles/${ids.vehicle}/images`)
      .set(auth(tokens.admin))
      .attach('images', files.exe, { filename: 'photo.png', contentType: 'image/png' });
    assert.equal(response.status, 415);
  });

  it('uploads a real image and publishes', async () => {
    const upload = await api()
      .post(`/api/v1/vehicles/${ids.vehicle}/images`)
      .set(auth(tokens['staff.plain']))
      .attach('images', files.png, { filename: 'front.png', contentType: 'image/png' });
    assert.equal(upload.status, 201);
    assert.equal(upload.body.data[0].isPrimary, true);
    const publish = await api().patch(`/api/v1/vehicles/${ids.vehicle}/status`).set(auth(tokens.admin)).send({ status: 'Available' });
    assert.equal(publish.status, 200);
  });

  it('treats % and _ in search literally', async () => {
    const literal = await api().get('/api/v1/vehicles').query({ search: '100%' });
    assert.equal(literal.status, 200);
    assert.equal(literal.body.meta.total, 1);
    const wildcard = await api().get('/api/v1/vehicles').query({ search: '_' });
    assert.equal(wildcard.body.meta.total, 0);
  });

  it('supports combined make + model search', async () => {
    const response = await api().get('/api/v1/vehicles').query({ search: 'toyota aqua' });
    assert.equal(response.body.meta.total, 1);
  });

  it('updates a vehicle', async () => {
    const response = await api()
      .put(`/api/v1/vehicles/${ids.vehicle}`)
      .set(auth(tokens.admin))
      .send({ make: 'Toyota', model: 'Aqua 100% Hybrid', year: 2021, price: 8750000, mileage: 31000, condition: 'Used', type: 'Hatchback', fuelType: 'Hybrid', transmission: 'Automatic', status: 'Available' });
    assert.equal(response.status, 200);
    assert.equal(Number(response.body.data.price), 8750000);
  });

  it('stops staff without archive permission from archiving', async () => {
    assert.equal((await api().delete(`/api/v1/vehicles/${ids.vehicle}`).set(auth(tokens['staff.plain']))).status, 403);
  });

  it('archives (soft delete) and restores a vehicle', async () => {
    assert.equal((await api().delete(`/api/v1/vehicles/${ids.vehicle}`).set(auth(tokens.admin))).status, 200);
    assert.equal((await api().get(`/api/v1/vehicles/${ids.vehicle}`)).status, 404);
    const [row] = await rawQuery('SELECT status, deleted_at, status_before_archive FROM vehicles WHERE vehicle_id = ?', [ids.vehicle]);
    assert.equal(row.status, 'Archived');
    assert.ok(row.deleted_at);
    const previous = row.status_before_archive;
    assert.ok(['Draft', 'Available'].includes(previous), 'the status before archiving is remembered');
    const restore = await api().patch(`/api/v1/vehicles/${ids.vehicle}/restore`).set(auth(tokens.admin));
    assert.equal(restore.status, 200);
    // Unarchive returns the vehicle to its previous status (Draft when it has no image).
    const images = await rawQuery('SELECT COUNT(*) AS n FROM vehicle_images WHERE vehicle_id = ?', [ids.vehicle]);
    assert.equal(restore.body.data.status, previous === 'Available' && !Number(images[0].n) ? 'Draft' : previous);
    await api().patch(`/api/v1/vehicles/${ids.vehicle}/status`).set(auth(tokens.admin)).send({ status: 'Available' });
    assert.equal((await api().get(`/api/v1/vehicles/${ids.vehicle}`)).status, 200);
  });
});

describe('enquiries and email workflow', () => {
  it('submits an enquiry and emails the admin (Reply-To customer) and the customer (Reply-To support)', async () => {
    const before = smtp.messages.length;
    const response = await api()
      .post('/api/v1/enquiries')
      .set(auth(tokens.alpha))
      .send({ vehicleId: ids.vehicle, message: 'Is this vehicle still available for viewing?' });
    assert.equal(response.status, 201);
    ids.enquiry = response.body.data.enquiryId;
    assert.equal(response.body.meta.emailStatus, 'Accepted');

    const sent = smtp.messages.slice(before);
    const adminMail = sent.find((message) => message.envelopeTo.includes('admin-inbox@highstreet.test'));
    const customerMail = sent.find((message) => message.envelopeTo.includes('alpha@customer.lk'));

    assert.ok(adminMail, 'admin notification sent');
    assert.ok(customerMail, 'customer acknowledgement sent');
    assert.match(adminMail.headers['reply-to'], /alpha@customer\.lk/);
    assert.match(customerMail.headers['reply-to'], /support@highstreet\.test/);
    assert.match(customerMail.headers.from, /High Street Test.*no-reply@highstreet\.test/);
    assert.equal(customerMail.envelopeFrom, 'no-reply@highstreet.test');
    assert.match(customerMail.subject, new RegExp(`\\[HS-ENQ-${ids.enquiry}\\]`));
  });

  it('does not let one customer read another customer enquiry', async () => {
    assert.equal((await api().get(`/api/v1/my/enquiries/${ids.enquiry}`).set(auth(tokens.beta))).status, 404);
    assert.equal((await api().get(`/api/v1/my/enquiries/${ids.enquiry}`).set(auth(tokens.alpha))).status, 200);
  });

  it('sends a response once and marks it Sent only after SMTP accepts', async () => {
    const draft = await api()
      .post(`/api/v1/enquiries/${ids.enquiry}/responses`)
      .set(auth(tokens.admin))
      .send({ subject: 'Viewing available', responseBody: 'Yes, you can view it on Saturday.' });
    assert.equal(draft.status, 201);
    ids.response = draft.body.data.responseId;

    const sent = await api().post(`/api/v1/enquiry-responses/${ids.response}/send`).set(auth(tokens.admin));
    assert.equal(sent.status, 200);
    assert.equal(sent.body.data.status, 'Sent');

    const again = await api().post(`/api/v1/enquiry-responses/${ids.response}/send`).set(auth(tokens.admin));
    assert.equal(again.status, 422);

    const logs = await rawQuery("SELECT status FROM email_logs WHERE message_key = ?", [`enquiry-response-${ids.response}`]);
    assert.deepEqual(logs.map((row) => row.status), ['Accepted']);

    const [enquiry] = await rawQuery('SELECT status FROM enquiries WHERE enquiry_id = ?', [ids.enquiry]);
    assert.equal(enquiry.status, 'Responded');
  });

  it('keeps a response as Draft when the mail server rejects the recipient', async () => {
    const enquiry = await models.Enquiry.create({
      vehicleId: ids.vehicle,
      customerId: null,
      vehicleReference: 'Test',
      customerName: 'Bounce',
      customerEmail: 'bounce@customer.lk',
      customerPhone: '0770000000',
      message: 'This address will be rejected by the test SMTP server.',
      status: 'New'
    });
    const draft = await api()
      .post(`/api/v1/enquiries/${enquiry.enquiryId}/responses`)
      .set(auth(tokens.admin))
      .send({ subject: 'Hello', responseBody: 'This should bounce.' });
    const send = await api().post(`/api/v1/enquiry-responses/${draft.body.data.responseId}/send`).set(auth(tokens.admin));
    assert.equal(send.status, 503);
    const [response] = await rawQuery('SELECT status FROM enquiry_responses WHERE response_id = ?', [draft.body.data.responseId]);
    assert.equal(response.status, 'Draft');
    const [log] = await rawQuery('SELECT status, next_attempt_at FROM email_logs WHERE message_key = ?', [`enquiry-response-${draft.body.data.responseId}`]);
    assert.equal(log.status, 'Failed');
    assert.ok(log.next_attempt_at, 'retry scheduled');
  });

  it('records the test-drive lifecycle with emails', async () => {
    const date = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
    const created = await api()
      .post('/api/v1/bookings')
      .set(auth(tokens.alpha))
      .send({ vehicleId: ids.vehicle, preferredDate: date, preferredTime: '10:00' });
    assert.equal(created.status, 201);
    ids.booking = created.body.data.bookingId;

    const duplicate = await api().post('/api/v1/bookings').set(auth(tokens.alpha)).send({ vehicleId: ids.vehicle, preferredDate: date, preferredTime: '11:00' });
    assert.equal(duplicate.status, 409);

    const reschedule = await api().patch(`/api/v1/my/bookings/${ids.booking}`).set(auth(tokens.alpha)).send({ preferredDate: date, preferredTime: '15:30' });
    assert.equal(reschedule.status, 200);
    assert.match(reschedule.body.data.preferredTime, /^15:30/);

    const past = await api().patch(`/api/v1/my/bookings/${ids.booking}`).set(auth(tokens.alpha)).send({ preferredDate: '2020-01-01', preferredTime: '10:00' });
    assert.equal(past.status, 422);

    const before = smtp.messages.length;
    const confirm = await api().patch(`/api/v1/bookings/${ids.booking}`).set(auth(tokens.admin)).send({ status: 'Confirmed', staffNote: 'See you then.' });
    assert.equal(confirm.status, 200);
    assert.equal(confirm.body.meta.emailStatus, 'Accepted');
    const confirmation = smtp.messages.slice(before).find((message) => message.envelopeTo.includes('alpha@customer.lk'));
    assert.match(confirmation.subject, /confirmed/i);

    const blocked = await api().patch(`/api/v1/my/bookings/${ids.booking}`).set(auth(tokens.alpha)).send({ preferredDate: date, preferredTime: '16:00' });
    assert.equal(blocked.status, 409);
  });
});

describe('complaints', () => {
  it('validates complaint input', async () => {
    const response = await api().post('/api/v1/complaints').set(auth(tokens.alpha)).send({ category: 'Nope', subject: 'x', description: 'short' });
    assert.equal(response.status, 422);
    assert.ok(response.body.errors.length >= 2);
  });

  it('rejects linking another customer’s booking', async () => {
    const response = await api()
      .post('/api/v1/complaints')
      .set(auth(tokens.gamma || tokens.alpha))
      .send({ category: 'Test Drive', subject: 'Linked booking', description: 'This booking does not belong to me at all.', bookingId: 999999 });
    assert.equal(response.status, 422);
  });

  it('creates a complaint with a reference, history and emails', async () => {
    const before = smtp.messages.length;
    const response = await api()
      .post('/api/v1/complaints')
      .set(auth(tokens.alpha))
      .send({
        category: 'Test Drive',
        subject: 'Car was not ready <script>alert(1)</script>',
        description: 'The car was not ready at the confirmed time and I waited for 40 minutes.',
        priority: 'High',
        bookingId: ids.booking
      });
    assert.equal(response.status, 201);
    ids.complaint = response.body.data.complaintId;
    ids.reference = response.body.data.reference;
    assert.match(ids.reference, /^HS-CMP-\d{4}-\d{5}$/);

    const history = await rawQuery('SELECT to_status FROM complaint_status_history WHERE complaint_id = ?', [ids.complaint]);
    assert.deepEqual(history.map((row) => row.to_status), ['Submitted']);

    const sent = smtp.messages.slice(before);
    const ack = sent.find((message) => message.envelopeTo.includes('alpha@customer.lk'));
    assert.ok(ack.subject.includes(`[${ids.reference}]`));
    assert.match(ack.headers['reply-to'], /support@highstreet\.test/);
    assert.ok(!ack.raw.includes('<script>alert(1)</script>') || ack.raw.includes('&lt;script&gt;'), 'HTML part escapes customer input');
    assert.ok(sent.some((message) => message.envelopeTo.includes('admin-inbox@highstreet.test')));
  });

  it('blocks an immediate duplicate submission', async () => {
    const response = await api()
      .post('/api/v1/complaints')
      .set(auth(tokens.alpha))
      .send({ category: 'Test Drive', subject: 'Car was not ready <script>alert(1)</script>', description: 'The car was not ready at the confirmed time and I waited again.' });
    assert.equal(response.status, 409);
  });

  it('hides a complaint from other customers', async () => {
    const other = await login('beta@customer.lk', 'Password!2026x');
    tokens.beta = other.accessToken;
    assert.equal((await api().get(`/api/v1/my/complaints/${ids.complaint}`).set(auth(tokens.beta))).status, 404);
  });

  it('requires the complaints permission for staff', async () => {
    assert.equal((await api().get('/api/v1/complaints').set(auth(tokens['staff.care']))).status, 403);
  });

  it('refuses to assign to staff without the complaints permission, then assigns after it is granted', async () => {
    const staff = await User.findOne({ where: { email: 'staff.care@test.lk' } });
    const refused = await api().patch(`/api/v1/complaints/${ids.complaint}/assign`).set(auth(tokens.admin)).send({ staffId: staff.userId });
    assert.equal(refused.status, 422);

    const grant = await api()
      .put(`/api/v1/users/${staff.userId}/permissions`)
      .set(auth(tokens.admin))
      .send({ canManageInventory: false, canManageEnquiries: true, canViewAssignedContacts: false, canArchiveRecords: false, canManageComplaints: true, canViewLimitedAnalytics: true });
    assert.equal(grant.status, 200);

    const assigned = await api().patch(`/api/v1/complaints/${ids.complaint}/assign`).set(auth(tokens.admin)).send({ staffId: staff.userId });
    assert.equal(assigned.status, 200);
    assert.equal(assigned.body.data.status, 'Under Review');
    ids.careStaff = staff.userId;
  });

  it('shows staff only their assigned complaints and hides contacts without permission', async () => {
    const other = await api()
      .post('/api/v1/complaints')
      .set(auth(tokens.beta))
      .send({ category: 'Website', subject: 'Search page is slow', description: 'The inventory page took a long time to load yesterday evening.' });
    assert.equal(other.status, 201);
    ids.otherComplaint = other.body.data.complaintId;

    const list = await api().get('/api/v1/complaints').set(auth(tokens['staff.care']));
    assert.equal(list.status, 200);
    assert.deepEqual(list.body.data.map((complaint) => complaint.complaintId), [ids.complaint]);

    assert.equal((await api().get(`/api/v1/complaints/${ids.otherComplaint}`).set(auth(tokens['staff.care']))).status, 403);

    const detail = await api().get(`/api/v1/complaints/${ids.complaint}`).set(auth(tokens['staff.care']));
    assert.equal(detail.body.data.customer.email, null);
  });

  it('searches by reference prefix, customer name and filters by status/priority', async () => {
    const byReference = await api().get('/api/v1/complaints').query({ search: ids.reference.slice(0, 11) }).set(auth(tokens.admin));
    assert.ok(byReference.body.data.some((complaint) => complaint.reference === ids.reference));
    const byName = await api().get('/api/v1/complaints').query({ search: 'beta' }).set(auth(tokens.admin));
    assert.deepEqual(byName.body.data.map((complaint) => complaint.complaintId), [ids.otherComplaint]);
    const filtered = await api().get('/api/v1/complaints').query({ status: 'Under Review', priority: 'High' }).set(auth(tokens.admin));
    assert.deepEqual(filtered.body.data.map((complaint) => complaint.complaintId), [ids.complaint]);
    assert.equal(filtered.body.meta.statusCounts.Submitted, 1);
  });

  it('keeps internal notes away from the customer', async () => {
    const note = await api().post(`/api/v1/complaints/${ids.complaint}/messages`).set(auth(tokens['staff.care'])).send({ body: 'Internal: workshop was late.', isInternal: true });
    assert.equal(note.status, 201);
    assert.equal(note.body.meta.emailStatus, null);

    const before = smtp.messages.length;
    const reply = await api().post(`/api/v1/complaints/${ids.complaint}/messages`).set(auth(tokens['staff.care'])).send({ body: 'We apologise and will offer a free service.' });
    assert.equal(reply.status, 201);
    assert.equal(reply.body.meta.emailStatus, 'Accepted');
    assert.ok(smtp.messages.slice(before).some((message) => message.envelopeTo.includes('alpha@customer.lk') && message.subject.includes(ids.reference)));

    const customerView = await api().get(`/api/v1/my/complaints/${ids.complaint}`).set(auth(tokens.alpha));
    const bodies = customerView.body.data.messages.map((message) => message.body);
    assert.ok(bodies.includes('We apologise and will offer a free service.'));
    assert.ok(!bodies.some((body) => body.includes('Internal')));
    assert.equal(customerView.body.data.status, 'In Progress');
  });

  it('enforces the status workflow and resolution summary', async () => {
    const invalid = await api().patch(`/api/v1/complaints/${ids.otherComplaint}`).set(auth(tokens.admin)).send({ status: 'Submitted' });
    assert.equal(invalid.status, 422);
    const noSummary = await api().patch(`/api/v1/complaints/${ids.complaint}`).set(auth(tokens.admin)).send({ status: 'Resolved' });
    assert.equal(noSummary.status, 422);
    const resolved = await api()
      .patch(`/api/v1/complaints/${ids.complaint}`)
      .set(auth(tokens.admin))
      .send({ status: 'Resolved', resolutionSummary: 'Free service voucher issued.', note: 'Voucher emailed separately.' });
    assert.equal(resolved.status, 200);
    assert.equal(resolved.body.meta.emailStatus, 'Accepted');
    const [row] = await rawQuery('SELECT status, resolved_at FROM complaints WHERE complaint_id = ?', [ids.complaint]);
    assert.equal(row.status, 'Resolved');
    assert.ok(row.resolved_at);
  });

  it('lets the customer close and reopen', async () => {
    assert.equal((await api().patch(`/api/v1/my/complaints/${ids.complaint}/close`).set(auth(tokens.alpha))).status, 200);
    assert.equal((await api().post(`/api/v1/my/complaints/${ids.complaint}/messages`).set(auth(tokens.alpha)).send({ body: 'one more thing' })).status, 409);
    const shortReason = await api().patch(`/api/v1/my/complaints/${ids.complaint}/reopen`).set(auth(tokens.alpha)).send({ reason: 'no' });
    assert.equal(shortReason.status, 422);
    const reopen = await api().patch(`/api/v1/my/complaints/${ids.complaint}/reopen`).set(auth(tokens.alpha)).send({ reason: 'The voucher code does not work.' });
    assert.equal(reopen.status, 200);
    const history = await rawQuery('SELECT to_status FROM complaint_status_history WHERE complaint_id = ? ORDER BY history_id', [ids.complaint]);
    assert.deepEqual(history.map((entry) => entry.to_status), ['Submitted', 'Under Review', 'In Progress', 'Resolved', 'Closed', 'Under Review']);
  });

  it('shows status changes in the customer notification feed', async () => {
    const response = await api().get('/api/v1/my/notifications').set(auth(tokens.alpha));
    assert.equal(response.status, 200);
    assert.ok(response.body.data.some((item) => item.title.includes(ids.reference)));
    assert.ok(response.body.data.some((item) => item.type === 'booking'));
  });

  it('stops staff from deleting complaints', async () => {
    assert.equal((await api().delete(`/api/v1/complaints/${ids.otherComplaint}`).set(auth(tokens['staff.care']))).status, 403);
  });
});

describe('documents', () => {
  it('uploads complaint evidence and stores it privately with metadata', async () => {
    const response = await api()
      .post('/api/v1/documents')
      .set(auth(tokens.alpha))
      .field('complaintId', ids.complaint)
      .field('description', 'Receipt')
      .attach('file', files.pdf, { filename: '../../etc/receipt.pdf', contentType: 'application/pdf' });
    assert.equal(response.status, 201);
    ids.document = response.body.data.documentId;
    assert.equal(response.body.data.originalName, 'receipt.pdf');
    assert.equal(response.body.data.mimeType, 'application/pdf');
    assert.ok(!('storageKey' in response.body.data));

    const [row] = await rawQuery('SELECT storage_key, size_bytes, checksum_sha256, uploaded_by FROM documents WHERE document_id = ?', [ids.document]);
    assert.match(row.storage_key, /^[0-9a-f-]{36}\.pdf$/);
    assert.equal(row.size_bytes, files.pdf.length);
    assert.equal(row.checksum_sha256.length, 64);
    assert.ok(fs.existsSync(path.join(process.env.DOCUMENT_STORAGE_DIR, row.storage_key)));
    assert.ok(!process.env.DOCUMENT_STORAGE_DIR.includes(`${path.sep}uploads`), 'not in the public uploads folder');
    ids.storageKey = row.storage_key;
  });

  it('rejects disguised, HTML and oversized files', async () => {
    const fake = await api().post('/api/v1/documents').set(auth(tokens.alpha)).attach('file', files.exe, { filename: 'invoice.pdf', contentType: 'application/pdf' });
    assert.equal(fake.status, 415);
    const html = await api().post('/api/v1/documents').set(auth(tokens.alpha)).attach('file', files.html, { filename: 'page.html', contentType: 'text/html' });
    assert.equal(html.status, 415);
    const big = Buffer.concat([files.pdf, Buffer.alloc(3 * 1024 * 1024)]);
    const oversized = await api().post('/api/v1/documents').set(auth(tokens.alpha)).attach('file', big, { filename: 'big.pdf', contentType: 'application/pdf' });
    assert.equal(oversized.status, 413);
  });

  it('blocks attaching files to someone else’s complaint', async () => {
    const response = await api().post('/api/v1/documents').set(auth(tokens.beta)).field('complaintId', ids.complaint).attach('file', files.pdf, { filename: 'x.pdf', contentType: 'application/pdf' });
    assert.equal(response.status, 403);
  });

  it('serves downloads only to authorised users with safe headers', async () => {
    const owner = await api().get(`/api/v1/documents/${ids.document}/download`).set(auth(tokens.alpha));
    assert.equal(owner.status, 200);
    assert.equal(owner.headers['content-type'], 'application/pdf');
    assert.equal(owner.headers['x-content-type-options'], 'nosniff');
    assert.match(owner.headers['content-disposition'], /^attachment; filename="receipt\.pdf"/);
    assert.match(owner.headers['cache-control'], /no-store/);

    assert.equal((await api().get(`/api/v1/documents/${ids.document}/download`).set(auth(tokens.beta))).status, 404);
    assert.equal((await api().get(`/api/v1/documents/${ids.document}/download`).set(auth(tokens['staff.plain']))).status, 404);
    assert.equal((await api().get(`/api/v1/documents/${ids.document}/download`).set(auth(tokens['staff.care']))).status, 200);
    assert.equal((await api().get(`/api/v1/documents/${ids.document}/download`)).status, 401);
    assert.equal((await api().get(`/uploads/${ids.storageKey}`)).status, 404, 'not reachable through the public static folder');
  });

  it('keeps staff-only documents hidden from the customer', async () => {
    const internal = await api()
      .post('/api/v1/documents')
      .set(auth(tokens['staff.care']))
      .field('complaintId', ids.complaint)
      .field('visibility', 'Staff')
      .attach('file', files.png, { filename: 'internal.png', contentType: 'image/png' });
    assert.equal(internal.status, 201);
    const view = await api().get(`/api/v1/my/complaints/${ids.complaint}`).set(auth(tokens.alpha));
    assert.deepEqual(view.body.data.documents.map((document) => document.documentId), [ids.document]);
    assert.equal((await api().get(`/api/v1/documents/${internal.body.data.documentId}/download`).set(auth(tokens.alpha))).status, 404);
  });

  it('lists, filters and renames documents', async () => {
    const list = await api().get('/api/v1/documents').query({ linkedType: 'Complaint', fileType: 'pdf' }).set(auth(tokens.admin));
    assert.equal(list.body.meta.total, 1);
    const rename = await api().patch(`/api/v1/documents/${ids.document}`).set(auth(tokens.alpha)).send({ originalName: 'payment-receipt' });
    assert.equal(rename.status, 200);
    assert.equal(rename.body.data.originalName, 'payment-receipt.pdf');
  });

  it('deletes the database row and the stored file together', async () => {
    const response = await api().delete(`/api/v1/documents/${ids.document}`).set(auth(tokens.alpha));
    assert.equal(response.status, 200);
    assert.equal((await rawQuery('SELECT COUNT(*) AS total FROM documents WHERE document_id = ?', [ids.document]))[0].total, 0);
    assert.ok(!fs.existsSync(path.join(process.env.DOCUMENT_STORAGE_DIR, ids.storageKey)));
  });

  it('enforces database constraints on documents', async () => {
    await assert.rejects(
      rawQuery(
        "INSERT INTO documents (uploaded_by, complaint_id, booking_id, original_name, storage_key, mime_type, extension, size_bytes, checksum_sha256) VALUES (1, ?, ?, 'a', 'dup', 'x', 'pdf', 1, 'x')",
        [ids.complaint, ids.booking]
      ),
      /chk_documents_single_link|check constraint/i
    );
    await assert.rejects(
      rawQuery("INSERT INTO complaints (reference, customer_id, category, subject, description) VALUES ('X-1', 999999, 'Other', 's', 'd')"),
      /foreign key/i
    );
  });
});

describe('inbound email replies', () => {
  it('is disabled until a secret is configured', async () => {
    const response = await api().post('/api/v1/inbound/email').send({ from: 'alpha@customer.lk', subject: 'x', text: 'y' });
    assert.equal(response.status, 503);
  });

  it('requires the shared secret', async () => {
    process.env.INBOUND_EMAIL_SECRET = 'test-inbound-secret';
    const response = await api().post('/api/v1/inbound/email').set('X-Inbound-Secret', 'wrong').send({ from: 'alpha@customer.lk', subject: 'x', text: 'y' });
    assert.equal(response.status, 401);
  });

  it('adds a matching reply to the complaint conversation and strips quoted text', async () => {
    const response = await api()
      .post('/api/v1/inbound/email')
      .set('X-Inbound-Secret', 'test-inbound-secret')
      .send({
        from: 'Customer Alpha <ALPHA@customer.lk>',
        subject: `Re: Update on your complaint [${ids.reference}]`,
        text: 'The new voucher works, thank you.\n\nOn Mon, High Street wrote:\n> previous message',
        messageId: '<reply-1@mail.test>'
      });
    assert.equal(response.status, 201);
    assert.equal(response.body.data.status, 'Matched');
    const [message] = await rawQuery("SELECT body, source, author_role FROM complaint_messages WHERE complaint_id = ? AND source = 'Email'", [ids.complaint]);
    assert.equal(message.body, 'The new voucher works, thank you.');
    assert.equal(message.author_role, 'Email');
  });

  it('ignores duplicate deliveries and rejects mismatched senders', async () => {
    const duplicate = await api()
      .post('/api/v1/inbound/email')
      .set('X-Inbound-Secret', 'test-inbound-secret')
      .send({ from: 'alpha@customer.lk', subject: `Re: [${ids.reference}]`, text: 'again', messageId: '<reply-1@mail.test>' });
    assert.equal(duplicate.body.data.duplicate, true);
    const spoof = await api()
      .post('/api/v1/inbound/email')
      .set('X-Inbound-Secret', 'test-inbound-secret')
      .send({ from: 'attacker@evil.test', subject: `Re: [${ids.reference}]`, text: 'spoofed', messageId: '<spoof@mail.test>' });
    assert.equal(spoof.body.data.status, 'Rejected');
    const enquiryReply = await api()
      .post('/api/v1/inbound/email')
      .set('X-Inbound-Secret', 'test-inbound-secret')
      .send({ from: 'alpha@customer.lk', subject: `Re: Viewing available [HS-ENQ-${ids.enquiry}]`, text: 'Saturday works.', messageId: '<enq@mail.test>' });
    assert.equal(enquiryReply.body.data.status, 'Matched');
    const replies = await api().get(`/api/v1/enquiries/${ids.enquiry}/inbound`).set(auth(tokens.admin));
    assert.equal(replies.body.data.length, 1);
    process.env.INBOUND_EMAIL_SECRET = '';
  });
});

describe('email reliability', () => {
  it('retries failed messages from the queue', async () => {
    smtp.state.failAll = true;
    const result = await mail.queueMail({ to: 'retry@customer.lk', subject: 'Retry test', text: 'Hello' }, { messageKey: 'retry-test', template: 'smtp-test' });
    assert.equal(result.status, 'Failed');
    smtp.state.failAll = false;

    await rawQuery("UPDATE email_logs SET next_attempt_at = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 MINUTE) WHERE message_key = 'retry-test'");
    const processed = await mail.processEmailQueue();
    assert.ok(processed.some((entry) => entry.status === 'Accepted'));
    const [row] = await rawQuery("SELECT status, attempts, payload FROM email_logs WHERE message_key = 'retry-test'");
    assert.equal(row.status, 'Accepted');
    assert.equal(row.attempts, 2);
    assert.equal(row.payload, null, 'message content cleared after acceptance');
  });

  it('never sends the same message key twice', async () => {
    const before = smtp.messages.length;
    const first = await mail.queueMail({ to: 'once@customer.lk', subject: 'Once', text: 'x' }, { messageKey: 'only-once' });
    const second = await mail.queueMail({ to: 'once@customer.lk', subject: 'Once', text: 'x' }, { messageKey: 'only-once' });
    assert.equal(first.status, 'Accepted');
    assert.equal(second.duplicate, true);
    assert.equal(smtp.messages.length - before, 1);
  });

  it('rejects invalid recipient addresses without sending', async () => {
    const result = await mail.queueMail({ to: 'not-an-email', subject: 'x', text: 'y' });
    assert.equal(result.status, 'Failed');
  });

  it('limits the Admin test email to safe recipients', async () => {
    const blocked = await api().post('/api/v1/emails/test').set(auth(tokens.admin)).send({ to: 'stranger@example.com' });
    assert.equal(blocked.status, 403);
    const allowed = await api().post('/api/v1/emails/test').set(auth(tokens.admin)).send({ to: 'admin@test.lk' });
    assert.equal(allowed.status, 200);
  });

  it('verifies the SMTP connection', async () => {
    const response = await api().post('/api/v1/emails/verify').set(auth(tokens.admin));
    assert.equal(response.status, 200);
  });

  it('lists the outbox with configuration for Admin only', async () => {
    const response = await api().get('/api/v1/emails').set(auth(tokens.admin));
    assert.equal(response.status, 200);
    assert.equal(response.body.meta.configuration.replyTo, 'support@highstreet.test');
    assert.ok(response.body.data.every((email) => !('payload' in email)));
    assert.equal((await api().get('/api/v1/emails').set(auth(tokens['staff.care']))).status, 403);
  });
});

describe('reports', () => {
  it('lists report types according to permissions', async () => {
    const admin = await api().get('/api/v1/reports/types').set(auth(tokens.admin));
    assert.equal(admin.body.data.length, 11); // 10 original + finance-applications
    const staff = await api().get('/api/v1/reports/types').set(auth(tokens['staff.care']));
    const keys = staff.body.data.map((type) => type.key);
    assert.ok(keys.includes('bookings') && keys.includes('complaints'));
    assert.ok(!keys.includes('users') && !keys.includes('sessions') && !keys.includes('emails') && !keys.includes('finance-applications'));
    assert.equal((await api().get('/api/v1/reports/types').set(auth(tokens.alpha))).status, 403);
  });

  it('generates every report type for Admin', async () => {
    for (const type of ['vehicles', 'vehicle-demand', 'enquiries', 'bookings', 'complaints', 'users', 'sessions', 'documents', 'emails', 'activity']) {
      const response = await api().get(`/api/v1/reports/${type}`).set(auth(tokens.admin));
      assert.equal(response.status, 200, `${type}: ${response.body.message}`);
      assert.ok(Array.isArray(response.body.data.rows));
      assert.ok(response.body.data.summary.length > 0);
    }
  });

  it('matches report totals to the database', async () => {
    const users = await api().get('/api/v1/reports/users').set(auth(tokens.admin));
    const [userCount] = await rawQuery('SELECT COUNT(*) AS total FROM users');
    assert.equal(users.body.data.total, Number(userCount.total));

    const complaints = await api().get('/api/v1/reports/complaints').set(auth(tokens.admin));
    const statusRows = await rawQuery('SELECT status, COUNT(*) AS total FROM complaints GROUP BY status');
    const byStatus = Object.fromEntries(complaints.body.data.groups[0].items.map((item) => [item.label, item.value]));
    for (const row of statusRows) {
      assert.equal(byStatus[row.status], Number(row.total));
    }

    const vehicles = await api().get('/api/v1/reports/vehicles').query({ status: 'Available' }).set(auth(tokens.admin));
    const [available] = await rawQuery("SELECT COUNT(*) AS total, SUM(price) AS value FROM vehicles WHERE status = 'Available'");
    assert.equal(vehicles.body.data.total, Number(available.total));
    assert.ok(vehicles.body.data.rows.every((row) => row.status === 'Available'));
  });

  it('applies date ranges consistently', async () => {
    const today = new Date();
    const pad = (number) => String(number).padStart(2, '0');
    const iso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    const inRange = await api().get('/api/v1/reports/complaints').query({ dateFrom: iso, dateTo: iso }).set(auth(tokens.admin));
    assert.equal(inRange.body.data.total, 2);
    const outOfRange = await api().get('/api/v1/reports/complaints').query({ dateFrom: '2000-01-01', dateTo: '2000-12-31' }).set(auth(tokens.admin));
    assert.equal(outOfRange.body.data.total, 0);
    assert.equal(outOfRange.body.data.rows.length, 0);
  });

  it('rejects invalid filters', async () => {
    assert.equal((await api().get('/api/v1/reports/complaints').query({ dateFrom: '2026-12-31', dateTo: '2026-01-01' }).set(auth(tokens.admin))).status, 422);
    assert.equal((await api().get('/api/v1/reports/complaints').query({ status: 'Bogus' }).set(auth(tokens.admin))).status, 422);
    assert.equal((await api().get('/api/v1/reports/complaints').query({ dateFrom: '31/12/2026' }).set(auth(tokens.admin))).status, 422);
    assert.equal((await api().get('/api/v1/reports/unknown').set(auth(tokens.admin))).status, 404);
  });

  it('restricts sensitive reports and columns for Staff', async () => {
    assert.equal((await api().get('/api/v1/reports/users').set(auth(tokens['staff.care']))).status, 403);
    const enquiries = await api().get('/api/v1/reports/enquiries').set(auth(tokens['staff.care']));
    assert.equal(enquiries.status, 200);
    assert.ok(!enquiries.body.data.columns.some((column) => column.key === 'customerEmail'));
    assert.equal((await api().get('/api/v1/reports/vehicles').set(auth(tokens['staff.plain']))).status, 403);
  });

  it('exports CSV with correct headings and rows', async () => {
    const response = await api().get('/api/v1/reports/complaints/export/csv').set(auth(tokens.admin)).buffer(true).parse((res, done) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => done(null, Buffer.concat(chunks)));
    });
    assert.equal(response.status, 200);
    assert.match(response.headers['content-type'], /text\/csv/);
    assert.match(response.headers['content-disposition'], /high-street-complaints-report-\d{8}\.csv/);
    const text = response.body.toString('utf8');
    assert.ok(text.startsWith('﻿'));
    assert.ok(text.includes('Reference,Submitted,Customer,Email,Category,Priority,Subject,Status'));
    assert.ok(text.includes(ids.reference));
    assert.equal(response.headers['x-report-rows'], '2');
  });

  it('exports valid XLSX and PDF files', async () => {
    const binary = (res, done) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => done(null, Buffer.concat(chunks)));
    };
    const xlsx = await api().get('/api/v1/reports/vehicles/export/xlsx').set(auth(tokens.admin)).buffer(true).parse(binary);
    assert.equal(xlsx.status, 200);
    assert.equal(xlsx.body.subarray(0, 2).toString(), 'PK');
    assert.ok(xlsx.body.includes(Buffer.from('xl/worksheets/sheet1.xml')));
    const pdf = await api().get('/api/v1/reports/vehicles/export/pdf').set(auth(tokens.admin)).buffer(true).parse(binary);
    assert.equal(pdf.status, 200);
    assert.equal(pdf.body.subarray(0, 5).toString(), '%PDF-');
    assert.ok(pdf.body.subarray(-6).toString().includes('%%EOF'));
    assert.equal((await api().get('/api/v1/reports/vehicles/export/docx').set(auth(tokens.admin))).status, 422);
  });

  it('neutralises spreadsheet formula injection in CSV', async () => {
    await api()
      .post('/api/v1/complaints')
      .set(auth(tokens.beta))
      .send({ category: 'Other', subject: '=HYPERLINK("http://evil")', description: 'Testing that formulas are not executed in Excel exports.' });
    const response = await api().get('/api/v1/reports/complaints/export/csv').set(auth(tokens.admin));
    assert.ok(response.text.includes(`"'=HYPERLINK(""http://evil"")"`));
  });

  it('provides saved report CRUD scoped to the owner', async () => {
    const created = await api().post('/api/v1/saved-reports').set(auth(tokens.admin)).send({ name: 'Open complaints', reportType: 'complaints', filters: { status: 'Under Review' } });
    assert.equal(created.status, 201);
    const id = created.body.data.reportId;
    assert.equal((await api().post('/api/v1/saved-reports').set(auth(tokens.admin)).send({ name: 'Open complaints', reportType: 'complaints' })).status, 409);
    assert.equal((await api().post('/api/v1/saved-reports').set(auth(tokens.admin)).send({ name: 'Bad', reportType: 'complaints', filters: { status: 'Nope' } })).status, 422);
    const run = await api().get(`/api/v1/saved-reports/${id}/run`).set(auth(tokens.admin));
    assert.equal(run.status, 200);
    assert.ok(run.body.data.rows.every((row) => row.status === 'Under Review'));
    const updated = await api().put(`/api/v1/saved-reports/${id}`).set(auth(tokens.admin)).send({ name: 'All complaints', reportType: 'complaints', filters: {} });
    assert.equal(updated.body.data.name, 'All complaints');
    assert.equal((await api().get(`/api/v1/saved-reports/${id}/run`).set(auth(tokens['staff.care']))).status, 404);
    assert.equal((await api().post('/api/v1/saved-reports').set(auth(tokens['staff.care'])).send({ name: 'Users', reportType: 'users' })).status, 403);
    assert.equal((await api().delete(`/api/v1/saved-reports/${id}`).set(auth(tokens.admin))).status, 200);
  });
});

describe('dashboard and audit', () => {
  it('returns live counts for Admin and scoped sections for Staff', async () => {
    const admin = await api().get('/api/v1/dashboard/summary').set(auth(tokens.admin));
    assert.equal(admin.status, 200);
    const [open] = await rawQuery("SELECT COUNT(*) AS total FROM complaints WHERE status IN ('Submitted','Under Review','In Progress')");
    assert.equal(admin.body.data.complaints.open, Number(open.total));
    assert.ok(admin.body.data.sections.includes('emails'));

    const staff = await api().get('/api/v1/dashboard/summary').set(auth(tokens['staff.care']));
    assert.ok(!staff.body.data.users);
    assert.equal(staff.body.data.complaints.total, 1);
    assert.equal((await api().get('/api/v1/dashboard/summary').set(auth(tokens.alpha))).status, 403);
  });

  it('records an audit trail of changes', async () => {
    const rows = await rawQuery("SELECT action FROM activity_logs WHERE entity_type = 'Complaint' AND entity_id = ?", [ids.complaint]);
    const actions = rows.map((row) => row.action);
    for (const action of ['complaint.created', 'complaint.assigned', 'complaint.status_changed', 'complaint.internal_note', 'complaint.response']) {
      assert.ok(actions.includes(action), `missing ${action}`);
    }
  });

  it('hides draft company content from non-admins', async () => {
    await models.Content.create({ sectionSlug: 'draft-page', title: 'Draft', body: 'Hidden draft', isPublished: false });
    const customer = await api().get('/api/v1/content').set(auth(tokens.alpha));
    assert.ok(!customer.body.data.some((item) => item.sectionSlug === 'draft-page'));
    const admin = await api().get('/api/v1/content').set(auth(tokens.admin));
    assert.ok(admin.body.data.some((item) => item.sectionSlug === 'draft-page'));
  });

  it('persists data across a new database connection', async () => {
    const [row] = await rawQuery('SELECT reference, status FROM complaints WHERE complaint_id = ?', [ids.complaint]);
    assert.equal(row.reference, ids.reference);
    assert.equal(row.status, 'Under Review');
  });

  it('lets an Admin permanently delete a complaint with its documents', async () => {
    const upload = await api().post('/api/v1/documents').set(auth(tokens.beta)).field('complaintId', ids.otherComplaint).attach('file', files.pdf, { filename: 'a.pdf', contentType: 'application/pdf' });
    assert.equal(upload.status, 201);
    const [doc] = await rawQuery('SELECT storage_key FROM documents WHERE document_id = ?', [upload.body.data.documentId]);
    const response = await api().delete(`/api/v1/complaints/${ids.otherComplaint}`).set(auth(tokens.admin));
    assert.equal(response.status, 200);
    assert.equal((await rawQuery('SELECT COUNT(*) AS total FROM complaint_messages WHERE complaint_id = ?', [ids.otherComplaint]))[0].total, 0);
    assert.ok(!fs.existsSync(path.join(process.env.DOCUMENT_STORAGE_DIR, doc.storage_key)));
  });

  it('stops customers from reaching admin endpoints', async () => {
    assert.equal((await api().get('/api/v1/users').set(auth(tokens.alpha))).status, 403);
    assert.equal((await api().get('/api/v1/emails').set(auth(tokens.alpha))).status, 403);
    assert.equal((await api().get('/api/v1/documents').set(auth(tokens.alpha))).status, 200);
  });
});

/*
|--------------------------------------------------------------------------
| Admin dashboard and authentication module (Ahamed): Users, Sessions,
| Staff permissions, Profile/password.
|--------------------------------------------------------------------------
*/
describe('admin module: users CRUD', () => {
  it('Create: Admin creates a Staff account (password hashed, not returned)', async () => {
    const response = await api().post('/api/v1/users').set(auth(tokens.admin))
      .send({ name: 'New Staff', email: 'new.staff@test.lk', password: 'NewStaff!2026', role: 'Staff', phone: '0771112223' });
    assert.equal(response.status, 201, response.body.message);
    assert.ok(!('passwordHash' in response.body.data));
    ids.newStaff = response.body.data.userId;
    const [row] = await rawQuery('SELECT password_hash FROM users WHERE user_id = ?', [ids.newStaff]);
    assert.notEqual(row.password_hash, 'NewStaff!2026');
    assert.ok(await bcrypt.compare('NewStaff!2026', row.password_hash));
    await login('new.staff@test.lk', 'NewStaff!2026');
  });

  it('Create: rejects duplicate emails and weak passwords', async () => {
    const dup = await api().post('/api/v1/users').set(auth(tokens.admin))
      .send({ name: 'Dup', email: 'new.staff@test.lk', password: 'NewStaff!2026', role: 'Staff' });
    assert.ok([409, 422].includes(dup.status), `duplicate gave ${dup.status}`);
    const weak = await api().post('/api/v1/users').set(auth(tokens.admin))
      .send({ name: 'Weak', email: 'weak.staff@test.lk', password: 'weak', role: 'Staff' });
    assert.equal(weak.status, 422);
  });

  it('Read: lists, filters, searches and fetches one user', async () => {
    const all = await api().get('/api/v1/users').set(auth(tokens.admin));
    assert.equal(all.status, 200);
    assert.ok(all.body.data.every((user) => !('passwordHash' in user)));
    const staff = await api().get('/api/v1/users?role=Staff').set(auth(tokens.admin));
    assert.ok(staff.body.data.length >= 3 && staff.body.data.every((user) => user.role === 'Staff'));
    const search = await api().get('/api/v1/users?search=new.staff').set(auth(tokens.admin));
    assert.deepEqual(search.body.data.map((user) => user.email), ['new.staff@test.lk']);
    const one = await api().get(`/api/v1/users/${ids.newStaff}`).set(auth(tokens.admin));
    assert.equal(one.status, 200);
    assert.equal(one.body.data.email, 'new.staff@test.lk');
    assert.equal((await api().get('/api/v1/users/999999').set(auth(tokens.admin))).status, 404);
  });

  // October 2026: only the account owner can change a password.
  it('Update: Admin edits details but can never set another user\'s password', async () => {
    const refused = await api().put(`/api/v1/users/${ids.newStaff}`).set(auth(tokens.admin))
      .send({ name: 'Renamed Staff', email: 'new.staff@test.lk', role: 'Staff', phone: '0779998887', password: 'Changed!Pass2026' });
    assert.equal(refused.status, 422, 'a password in the edit form is refused');
    const [unchanged] = await rawQuery('SELECT password_hash FROM users WHERE user_id = ?', [ids.newStaff]);
    assert.ok(await bcrypt.compare('NewStaff!2026', unchanged.password_hash), 'password not changed by the Admin');

    const response = await api().put(`/api/v1/users/${ids.newStaff}`).set(auth(tokens.admin))
      .send({ name: 'Renamed Staff', email: 'new.staff@test.lk', role: 'Staff', phone: '0779998887' });
    assert.equal(response.status, 200, response.body.message);
    assert.equal(response.body.data.name, 'Renamed Staff');
    const [row] = await rawQuery('SELECT name, phone FROM users WHERE user_id = ?', [ids.newStaff]);
    assert.equal(row.name, 'Renamed Staff');
    assert.equal(row.phone, '0779998887');
  });

  it('First sign-in: the Staff member must replace the temporary password before doing anything else', async () => {
    const [flag] = await rawQuery('SELECT must_change_password FROM users WHERE user_id = ?', [ids.newStaff]);
    assert.equal(Number(flag.must_change_password), 1, 'Admin-created accounts start with a temporary password');
    const first = await login('new.staff@test.lk', 'NewStaff!2026');
    assert.equal(first.user.mustChangePassword, true);
    const blocked = await api().get('/api/v1/sessions').set(auth(first.accessToken));
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.code, 'PASSWORD_CHANGE_REQUIRED');
    assert.equal((await api().get('/api/v1/auth/me').set(auth(first.accessToken))).status, 200, '/auth/me still works');
    const changed = await api().put('/api/v1/auth/change-password').set(auth(first.accessToken))
      .send({ currentPassword: 'NewStaff!2026', newPassword: 'Changed!Pass2026' });
    assert.equal(changed.status, 200, changed.body.message);
    const [after] = await rawQuery('SELECT must_change_password, password_changed_at FROM users WHERE user_id = ?', [ids.newStaff]);
    assert.equal(Number(after.must_change_password), 0);
    assert.ok(after.password_changed_at);
    assert.equal((await api().get('/api/v1/sessions').set(auth(first.accessToken))).status, 200, 'access works after the change');
    await login('new.staff@test.lk', 'Changed!Pass2026');
    const old = await api().post('/api/v1/auth/login').set('X-Forwarded-For', nextIp()).send({ email: 'new.staff@test.lk', password: 'NewStaff!2026' });
    assert.equal(old.status, 401);
  });

  it('Delete: deactivates (soft delete), blocks login and revokes sessions, then reactivates', async () => {
    const session = await login('new.staff@test.lk', 'Changed!Pass2026');
    const response = await api().delete(`/api/v1/users/${ids.newStaff}`).set(auth(tokens.admin));
    assert.equal(response.status, 200, response.body.message);
    const [row] = await rawQuery('SELECT is_active FROM users WHERE user_id = ?', [ids.newStaff]);
    assert.equal(Number(row.is_active), 0);
    const [open] = await rawQuery('SELECT COUNT(*) AS total FROM admin_sessions WHERE user_id = ? AND revoked_at IS NULL', [ids.newStaff]);
    assert.equal(Number(open.total), 0);
    assert.equal((await api().get('/api/v1/auth/me').set(auth(session.accessToken))).status, 401);
    const blocked = await api().post('/api/v1/auth/login').set('X-Forwarded-For', nextIp()).send({ email: 'new.staff@test.lk', password: 'Changed!Pass2026' });
    assert.equal(blocked.status, 403);

    const reactivate = await api().patch(`/api/v1/users/${ids.newStaff}/status`).set(auth(tokens.admin)).send({ isActive: true });
    assert.equal(reactivate.status, 200);
    await login('new.staff@test.lk', 'Changed!Pass2026');
  });

  it('protects the final active Admin from deactivation or demotion', async () => {
    const [admin] = await rawQuery("SELECT user_id FROM users WHERE email = 'admin@test.lk'");
    assert.equal((await api().delete(`/api/v1/users/${admin.user_id}`).set(auth(tokens.admin))).status, 409);
    const demote = await api().put(`/api/v1/users/${admin.user_id}`).set(auth(tokens.admin))
      .send({ name: 'Admin One', email: 'admin@test.lk', role: 'Customer' });
    assert.equal(demote.status, 409);
  });

  it('allows only Admins to manage users', async () => {
    assert.equal((await api().get('/api/v1/users').set(auth(tokens['staff.plain']))).status, 403);
    assert.equal((await api().post('/api/v1/users').set(auth(tokens['staff.plain']))
      .send({ name: 'X', email: 'x@test.lk', password: 'Password!2026x', role: 'Admin' })).status, 403);
    assert.equal((await api().get('/api/v1/users')).status, 401);
  });
});

describe('admin module: staff permissions', () => {
  it('reads and updates a staff member\'s permissions', async () => {
    const read = await api().get(`/api/v1/users/${ids.newStaff}/permissions`).set(auth(tokens.admin));
    assert.equal(read.status, 200, read.body.message);
    const update = await api().put(`/api/v1/users/${ids.newStaff}/permissions`).set(auth(tokens.admin))
      .send({ canManageInventory: true, canManageEnquiries: false, canViewAssignedContacts: false, canArchiveRecords: false, canManageComplaints: false, canViewLimitedAnalytics: false });
    assert.equal(update.status, 200, update.body.message);
    const [row] = await rawQuery('SELECT can_manage_inventory FROM staff_permissions WHERE user_id = ?', [ids.newStaff]);
    assert.equal(Number(row.can_manage_inventory), 1);
  });

  it('applies permissions immediately', async () => {
    const staff = await login('new.staff@test.lk', 'Changed!Pass2026');
    const body = { make: 'Perm', model: 'Check', year: 2022, price: 1000000, mileage: 10, condition: 'Used', type: 'SUV', fuelType: 'Petrol', transmission: 'Manual', status: 'Draft' };
    const allowed = await api().post('/api/v1/vehicles').set(auth(staff.accessToken)).send(body);
    assert.equal(allowed.status, 201, allowed.body.message);
    await api().put(`/api/v1/users/${ids.newStaff}/permissions`).set(auth(tokens.admin))
      .send({ canManageInventory: false, canManageEnquiries: false, canViewAssignedContacts: false, canArchiveRecords: false, canManageComplaints: false, canViewLimitedAnalytics: false });
    const denied = await api().post('/api/v1/vehicles').set(auth(staff.accessToken)).send(body);
    assert.equal(denied.status, 403);
  });

  it('rejects permissions for non-staff accounts', async () => {
    const [customer] = await rawQuery("SELECT user_id FROM users WHERE email = 'alpha@customer.lk'");
    assert.equal((await api().get(`/api/v1/users/${customer.user_id}/permissions`).set(auth(tokens.admin))).status, 422);
  });
});

describe('admin module: sessions CRUD', () => {
  it('Create + Read: login creates a session that is listed as current', async () => {
    const data = await login('new.staff@test.lk', 'Changed!Pass2026');
    tokens.sessionTester = data.accessToken;
    const list = await api().get('/api/v1/sessions').set(auth(data.accessToken));
    assert.equal(list.status, 200);
    assert.ok(list.body.data.some((session) => session.isCurrent));
  });

  it('Delete: revokes one session, and a user cannot revoke someone else\'s', async () => {
    const other = await login('new.staff@test.lk', 'Changed!Pass2026');
    const list = await api().get('/api/v1/sessions').set(auth(tokens.sessionTester));
    const target = list.body.data.find((session) => !session.isCurrent && !session.revokedAt);
    assert.ok(target, 'second session present');
    const customerTry = await api().delete(`/api/v1/sessions/${target.sessionId}`).set(auth(tokens.alpha));
    assert.equal(customerTry.status, 404);
    const revoke = await api().delete(`/api/v1/sessions/${target.sessionId}`).set(auth(tokens.sessionTester));
    assert.equal(revoke.status, 200);
    void other;
  });

  it('Delete all: signs out every other device but keeps the current one', async () => {
    const extra = await login('new.staff@test.lk', 'Changed!Pass2026');
    const response = await api().delete('/api/v1/sessions').set(auth(tokens.sessionTester));
    assert.equal(response.status, 200);
    assert.equal((await api().get('/api/v1/auth/me').set(auth(extra.accessToken))).status, 401);
    assert.equal((await api().get('/api/v1/auth/me').set(auth(tokens.sessionTester))).status, 200);
  });

  it('lets an Admin revoke another user\'s session', async () => {
    const victim = await login('staff.plain@test.lk', 'Password!2026x');
    const all = await api().get('/api/v1/sessions?scope=all').set(auth(tokens.admin));
    const target = all.body.data.find((session) => session.user?.email === 'staff.plain@test.lk' && !session.revokedAt);
    assert.ok(target);
    assert.equal((await api().delete(`/api/v1/sessions/${target.sessionId}`).set(auth(tokens.admin))).status, 200);
    void victim;
    tokens['staff.plain'] = (await login('staff.plain@test.lk', 'Password!2026x')).accessToken;
  });
});

describe('authentication: profile and password', () => {
  it('logs in with the right password only, without revealing whether the account exists', async () => {
    const wrong = await api().post('/api/v1/auth/login').set('X-Forwarded-For', nextIp()).send({ email: 'alpha@customer.lk', password: 'Wrong!Pass2026' });
    const missing = await api().post('/api/v1/auth/login').set('X-Forwarded-For', nextIp()).send({ email: 'nobody@customer.lk', password: 'Wrong!Pass2026' });
    assert.equal(wrong.status, 401);
    assert.equal(missing.status, 401);
    assert.equal(wrong.body.message, missing.body.message);
  });

  it('rate-limits repeated login attempts from one client (429)', async () => {
    const ip = '10.99.99.99';
    const statuses = [];
    // An unknown email, so that the per-account lockout (tested below) is not involved.
    for (let attempt = 0; attempt < 11; attempt += 1) {
      const response = await api().post('/api/v1/auth/login').set('X-Forwarded-For', ip).send({ email: 'rate.limit@nobody.lk', password: 'Wrong!Pass2026' });
      statuses.push(response.status);
    }
    assert.ok(statuses.slice(0, 10).every((status) => status === 401));
    assert.equal(statuses[10], 429);
  });

  it('returns the signed-in user from /auth/me', async () => {
    const me = await api().get('/api/v1/auth/me').set(auth(tokens.alpha));
    assert.equal(me.status, 200);
    assert.equal(me.body.data.email ?? me.body.data.user?.email, 'alpha@customer.lk');
  });

  it('updates the profile', async () => {
    const response = await api().put('/api/v1/auth/profile').set(auth(tokens.alpha)).send({ name: 'Alpha Updated', phone: '0712345678' });
    assert.equal(response.status, 200, response.body.message);
    const [row] = await rawQuery("SELECT name FROM users WHERE email = 'alpha@customer.lk'");
    assert.equal(row.name, 'Alpha Updated');
  });

  it('changes the password: wrong current password rejected, other sessions revoked, email sent', async () => {
    const other = await login('alpha@customer.lk', 'Password!2026x');
    const bad = await api().put('/api/v1/auth/change-password').set(auth(tokens.alpha))
      .send({ currentPassword: 'Not!Right2026', newPassword: 'Alpha!NewPass2026', confirmPassword: 'Alpha!NewPass2026' });
    assert.equal(bad.status, 422);
    const before = smtp.messages.length;
    const good = await api().put('/api/v1/auth/change-password').set(auth(tokens.alpha))
      .send({ currentPassword: 'Password!2026x', newPassword: 'Alpha!NewPass2026', confirmPassword: 'Alpha!NewPass2026' });
    assert.equal(good.status, 200, good.body.message);
    assert.equal((await api().get('/api/v1/auth/me').set(auth(other.accessToken))).status, 401);
    assert.equal((await api().get('/api/v1/auth/me').set(auth(tokens.alpha))).status, 200);
    assert.ok(smtp.messages.slice(before).some((message) => message.envelopeTo.includes('alpha@customer.lk')));
    await login('alpha@customer.lk', 'Alpha!NewPass2026');
  });
});

/*
|--------------------------------------------------------------------------
| CRUD matrix: the 8 assigned CRUD resources of the four team members.
| Each test performs Create, Read, Update and Delete through the API and
| checks the result directly in the database with a separate SQL query.
|--------------------------------------------------------------------------
*/
const one = async (sql, params) => (await rawQuery(sql, params))[0];
const matrix = {};

describe('CRUD matrix — Amri: Vehicle Inventory', () => {
  it('Vehicles: create, read, update, delete (archive) — website API and database agree', async () => {
    const created = await api().post('/api/v1/vehicles').set(auth(tokens.admin))
      .send({ make: 'Honda', model: 'Fit GP5', year: 2019, price: 6500000, mileage: 45000, condition: 'Used', type: 'Hatchback', fuelType: 'Hybrid', transmission: 'Automatic', color: 'White' });
    assert.equal(created.status, 201, created.body.message);
    const id = created.body.data.vehicleId;
    matrix.vehicle = id;
    assert.equal((await one('SELECT model FROM vehicles WHERE vehicle_id = ?', [id])).model, 'Fit GP5');

    const read = await api().get(`/api/v1/vehicles/${id}`).set(auth(tokens.admin));
    assert.equal(read.status, 200);
    assert.equal(read.body.data.make, 'Honda');

    const updated = await api().put(`/api/v1/vehicles/${id}`).set(auth(tokens.admin))
      .send({ make: 'Honda', model: 'Fit GP5', year: 2019, price: 6250000, mileage: 46000, condition: 'Used', type: 'Hatchback', fuelType: 'Hybrid', transmission: 'Automatic', color: 'Pearl White' });
    assert.equal(updated.status, 200, updated.body.message);
    const row = await one('SELECT price, mileage, color FROM vehicles WHERE vehicle_id = ?', [id]);
    assert.equal(Number(row.price), 6250000);
    assert.equal(row.color, 'Pearl White');
    assert.equal(Number((await api().get(`/api/v1/vehicles/${id}`).set(auth(tokens.admin))).body.data.price), 6250000);

    // Upload an image and publish so the public site lists it.
    const image = await api().post(`/api/v1/vehicles/${id}/images`).set(auth(tokens.admin)).attach('images', files.png, { filename: 'fit.png', contentType: 'image/png' });
    assert.equal(image.status, 201);
    assert.equal((await api().patch(`/api/v1/vehicles/${id}/status`).set(auth(tokens.admin)).send({ status: 'Available' })).status, 200);
    assert.equal((await one('SELECT status FROM vehicles WHERE vehicle_id = ?', [id])).status, 'Available');
    const publicList = await api().get('/api/v1/vehicles').query({ search: 'Fit GP5' });
    assert.ok(publicList.body.data.some((vehicle) => vehicle.vehicleId === id), 'visible on the public inventory');

    const removed = await api().delete(`/api/v1/vehicles/${id}`).set(auth(tokens.admin));
    assert.equal(removed.status, 200);
    const archived = await one('SELECT status, deleted_at FROM vehicles WHERE vehicle_id = ?', [id]);
    assert.equal(archived.status, 'Archived');
    assert.ok(archived.deleted_at, 'soft-deleted (row kept, deleted_at set)');
    const after = await api().get('/api/v1/vehicles').query({ search: 'Fit GP5' });
    assert.ok(!after.body.data.some((vehicle) => vehicle.vehicleId === id), 'hidden from the public inventory');

    assert.equal((await api().patch(`/api/v1/vehicles/${id}/restore`).set(auth(tokens.admin))).status, 200);
    assert.equal((await one('SELECT deleted_at FROM vehicles WHERE vehicle_id = ?', [id])).deleted_at, null);
    // Publish again so the later enquiry/finance tests can use this vehicle.
    assert.equal((await api().patch(`/api/v1/vehicles/${id}/status`).set(auth(tokens.admin)).send({ status: 'Available' })).status, 200);
  });

  it('Vehicle images: create (upload), read, update, delete — file and database row', async () => {
    const id = matrix.vehicle;
    const upload = await api().post(`/api/v1/vehicles/${id}/images`).set(auth(tokens.admin))
      .attach('images', files.png, { filename: 'side.png', contentType: 'image/png' });
    assert.equal(upload.status, 201);
    const image = upload.body.data[0];
    const dbRow = await one('SELECT url, is_primary, sort_order FROM vehicle_images WHERE image_id = ?', [image.imageId]);
    assert.ok(dbRow, 'row stored');
    const filePath = path.join(SERVER_DIR, 'uploads', path.basename(dbRow.url));
    assert.ok(fs.existsSync(filePath), 'file stored on disk');

    const list = await api().get(`/api/v1/vehicles/${id}/images`);
    assert.ok(list.body.data.some((item) => item.imageId === image.imageId));

    const update = await api().patch(`/api/v1/vehicle-images/${image.imageId}`).set(auth(tokens.admin)).send({ altText: 'Honda Fit side view', sortOrder: 5, isPrimary: true });
    assert.equal(update.status, 200, update.body.message);
    const changed = await one('SELECT alt_text, sort_order, is_primary FROM vehicle_images WHERE image_id = ?', [image.imageId]);
    assert.equal(changed.alt_text, 'Honda Fit side view');
    assert.equal(Number(changed.sort_order), 5);
    assert.equal(Number(changed.is_primary), 1);
    const primaries = await one('SELECT COUNT(*) AS total FROM vehicle_images WHERE vehicle_id = ? AND is_primary = 1', [id]);
    assert.equal(Number(primaries.total), 1, 'only one primary image');

    assert.equal((await api().delete(`/api/v1/vehicle-images/${image.imageId}`).set(auth(tokens['staff.plain']))).status, 403, 'staff cannot delete');
    const removed = await api().delete(`/api/v1/vehicle-images/${image.imageId}`).set(auth(tokens.admin));
    assert.equal(removed.status, 200);
    assert.equal(await one('SELECT image_id FROM vehicle_images WHERE image_id = ?', [image.imageId]), undefined);
    assert.ok(!fs.existsSync(filePath), 'file removed from disk');
  });
});

describe('CRUD matrix — Naaziq: Customer Enquiries', () => {
  it('Enquiries: create, read, update (status), delete — website API and database agree', async () => {
    const created = await api().post('/api/v1/enquiries').set(auth(tokens.alpha))
      .send({ vehicleId: matrix.vehicle, message: 'Can I see the Fit this Saturday morning?' });
    assert.equal(created.status, 201, created.body.message);
    const id = created.body.data.enquiryId;
    matrix.enquiry = id;
    const row = await one('SELECT status, message, customer_email FROM enquiries WHERE enquiry_id = ?', [id]);
    assert.equal(row.status, 'New');
    assert.equal(row.customer_email, 'alpha@customer.lk');

    const mine = await api().get('/api/v1/my/enquiries').set(auth(tokens.alpha));
    assert.ok(mine.body.data.some((item) => item.enquiryId === id), 'customer sees it in My Enquiries');
    const staffView = await api().get(`/api/v1/enquiries/${id}`).set(auth(tokens.admin));
    assert.equal(staffView.status, 200);

    const updated = await api().patch(`/api/v1/enquiries/${id}`).set(auth(tokens.admin)).send({ status: 'In Progress' });
    assert.equal(updated.status, 200, updated.body.message);
    assert.equal((await one('SELECT status FROM enquiries WHERE enquiry_id = ?', [id])).status, 'In Progress');
    const customerView = await api().get(`/api/v1/my/enquiries/${id}`).set(auth(tokens.alpha));
    assert.equal(customerView.body.data.status, 'In Progress', 'customer sees the new status');

    const extra = await api().post('/api/v1/enquiries').set(auth(tokens.alpha)).send({ vehicleId: matrix.vehicle, message: 'Duplicate question, please ignore this one.' });
    assert.equal(extra.status, 201);
    assert.equal((await api().delete(`/api/v1/enquiries/${extra.body.data.enquiryId}`).set(auth(tokens['staff.care']))).status, 403, 'only Admin deletes');
    const removed = await api().delete(`/api/v1/enquiries/${extra.body.data.enquiryId}`).set(auth(tokens.admin));
    assert.equal(removed.status, 200);
    assert.equal(await one('SELECT enquiry_id FROM enquiries WHERE enquiry_id = ?', [extra.body.data.enquiryId]), undefined);
  });

  it('Enquiry responses: create (draft), read, update, send, delete — website API and database agree', async () => {
    const id = matrix.enquiry;
    const created = await api().post(`/api/v1/enquiries/${id}/responses`).set(auth(tokens.admin))
      .send({ subject: 'Viewing on Saturday', responseBody: 'Saturday 10am works. Please bring your licence.', status: 'Draft' });
    assert.equal(created.status, 201, created.body.message);
    const responseId = created.body.data.responseId;
    assert.equal((await one('SELECT status FROM enquiry_responses WHERE response_id = ?', [responseId])).status, 'Draft');

    const list = await api().get(`/api/v1/enquiries/${id}/responses`).set(auth(tokens.admin));
    assert.ok(list.body.data.some((item) => item.responseId === responseId));

    const updated = await api().put(`/api/v1/enquiry-responses/${responseId}`).set(auth(tokens.admin))
      .send({ subject: 'Viewing on Saturday 10am', responseBody: 'Saturday 10am is confirmed. Please bring your driving licence.', status: 'Draft' });
    assert.equal(updated.status, 200, updated.body.message);
    assert.equal((await one('SELECT subject FROM enquiry_responses WHERE response_id = ?', [responseId])).subject, 'Viewing on Saturday 10am');

    const sent = await api().post(`/api/v1/enquiry-responses/${responseId}/send`).set(auth(tokens.admin));
    assert.equal(sent.status, 200, sent.body.message);
    const sentRow = await one('SELECT status, sent_at FROM enquiry_responses WHERE response_id = ?', [responseId]);
    assert.equal(sentRow.status, 'Sent');
    assert.ok(sentRow.sent_at);
    assert.equal((await one('SELECT status FROM enquiries WHERE enquiry_id = ?', [id])).status, 'Responded');
    const customerView = await api().get(`/api/v1/my/enquiries/${id}`).set(auth(tokens.alpha));
    assert.ok(JSON.stringify(customerView.body.data).includes('Saturday 10am is confirmed'), 'customer sees the response');

    const draft = await api().post(`/api/v1/enquiries/${id}/responses`).set(auth(tokens.admin)).send({ subject: 'Draft to delete', responseBody: 'Not needed any more.', status: 'Draft' });
    const removed = await api().delete(`/api/v1/enquiry-responses/${draft.body.data.responseId}`).set(auth(tokens.admin));
    assert.equal(removed.status, 200, removed.body.message);
    assert.equal(await one('SELECT response_id FROM enquiry_responses WHERE response_id = ?', [draft.body.data.responseId]), undefined);
  });
});

describe('CRUD matrix — Ahamed: Admin Dashboard & Authentication', () => {
  it('Users and Sessions: full CRUD is covered by the "admin module" tests above', async () => {
    const [{ total }] = await rawQuery("SELECT COUNT(*) AS total FROM users WHERE email = 'new.staff@test.lk'");
    assert.equal(Number(total), 1);
    const [{ revoked }] = await rawQuery('SELECT COUNT(*) AS revoked FROM admin_sessions WHERE revoked_at IS NOT NULL');
    assert.ok(Number(revoked) > 0);
  });
});

describe('CRUD matrix — Herathge: Financing & Company', () => {
  it('Company content: create, read, update, delete — public website and database agree', async () => {
    const created = await api().post('/api/v1/content').set(auth(tokens.admin))
      .send({ sectionSlug: 'warranty-policy', title: 'Warranty Policy', body: 'Six-month engine warranty on used vehicles.', displayOrder: 9, isPublished: true });
    assert.equal(created.status, 201, created.body.message);
    const id = created.body.data.contentId;
    assert.equal((await one('SELECT title FROM company_content WHERE content_id = ?', [id])).title, 'Warranty Policy');

    const publicRead = await api().get('/api/v1/content/warranty-policy');
    assert.equal(publicRead.status, 200);
    assert.equal(publicRead.body.data.title, 'Warranty Policy');

    const updated = await api().put(`/api/v1/content/${id}`).set(auth(tokens.admin))
      .send({ sectionSlug: 'warranty-policy', title: 'Warranty & Returns', body: 'Twelve-month engine warranty on used vehicles.', displayOrder: 9, isPublished: true });
    assert.equal(updated.status, 200, updated.body.message);
    assert.equal((await one('SELECT body FROM company_content WHERE content_id = ?', [id])).body, 'Twelve-month engine warranty on used vehicles.');
    assert.equal((await api().get('/api/v1/content/warranty-policy')).body.data.title, 'Warranty & Returns', 'website shows the update');

    assert.equal((await api().post('/api/v1/content').set(auth(tokens['staff.plain'])).send({ sectionSlug: 'x-page', title: 'X', body: 'Body text', isPublished: true })).status, 403);
    const removed = await api().delete(`/api/v1/content/${id}`).set(auth(tokens.admin));
    assert.equal(removed.status, 200);
    assert.equal(await one('SELECT content_id FROM company_content WHERE content_id = ?', [id]), undefined);
    assert.equal((await api().get('/api/v1/content/warranty-policy')).status, 404);
  });

  it('Financing configurations: create, read, update/activate, delete — calculator and database agree', async () => {
    const created = await api().post('/api/v1/financing-config').set(auth(tokens.admin))
      .send({ name: 'Festive plan', annualInterestRate: 9.5, minDownPaymentPct: 25, maxLoanTermMonths: 48, isActive: false });
    assert.equal(created.status, 201, created.body.message);
    const id = created.body.data.configId;
    assert.equal(Number((await one('SELECT annual_interest_rate FROM financing_configs WHERE config_id = ?', [id])).annual_interest_rate), 9.5);

    const list = await api().get('/api/v1/financing-config').set(auth(tokens.admin));
    assert.ok((list.body.data.rows || list.body.data).some((item) => item.configId === id));

    const updated = await api().put(`/api/v1/financing-config/${id}`).set(auth(tokens.admin))
      .send({ name: 'Festive plan', annualInterestRate: 8.75, minDownPaymentPct: 20, maxLoanTermMonths: 60, isActive: true });
    assert.equal(updated.status, 200, updated.body.message);
    const row = await one('SELECT annual_interest_rate, is_active FROM financing_configs WHERE config_id = ?', [id]);
    assert.equal(Number(row.annual_interest_rate), 8.75);
    assert.equal(Number(row.is_active), 1);
    assert.equal(Number((await one('SELECT COUNT(*) AS total FROM financing_configs WHERE is_active = 1')).total), 1, 'only one active plan');
    const active = await api().get('/api/v1/financing-config/active');
    assert.equal(active.body.data.configId, id, 'the calculator on the website uses the updated plan');
    assert.equal(Number(active.body.data.annualInterestRate), 8.75);

    assert.equal((await api().delete(`/api/v1/financing-config/${id}`).set(auth(tokens.admin))).status, 409, 'active plan protected');
    const spare = await api().post('/api/v1/financing-config').set(auth(tokens.admin)).send({ name: 'Old plan', annualInterestRate: 14, minDownPaymentPct: 30, maxLoanTermMonths: 36, isActive: false });
    const removed = await api().delete(`/api/v1/financing-config/${spare.body.data.configId}`).set(auth(tokens.admin));
    assert.equal(removed.status, 200);
    assert.equal(await one('SELECT config_id FROM financing_configs WHERE config_id = ?', [spare.body.data.configId]), undefined);
  });
});

/*
|--------------------------------------------------------------------------
| 16-CRUD matrix — the remaining resources (October 2026 completion).
| 4 resources per member; every operation is checked in the database with
| a separate SQL query, and in what the website API returns.
|--------------------------------------------------------------------------
|   Amri      Vehicles · Vehicle Images · Wishlists · Test-Drive Bookings
|   Naaziq    Enquiries · Enquiry Responses · Complaints · Reply Templates
|   Ahamed    Users · Sessions · Staff Permissions · Saved Reports
|   Herathge  Company Content · Financing Configurations ·
|             Finance Applications · Customer Documents
*/

describe('CRUD matrix — Amri: Wishlists and Test-Drive Bookings', () => {
  it('Wishlists: create, read, update (note), delete — website API and database agree', async () => {
    const id = matrix.vehicle;
    const created = await api().post(`/api/v1/wishlist/${id}`).set(auth(tokens.alpha)).send({ note: 'Check the spare key' });
    assert.equal(created.status, 201, created.body.message);
    assert.equal((await one('SELECT note FROM wishlists WHERE wishlist_id = ?', [created.body.data.wishlistId])).note, 'Check the spare key');
    assert.equal((await api().post(`/api/v1/wishlist/${id}`).set(auth(tokens.alpha))).status, 200, 'saving twice does not duplicate');

    const list = await api().get('/api/v1/wishlist').set(auth(tokens.alpha));
    assert.ok(list.body.data.some((item) => item.vehicleId === id && item.note === 'Check the spare key'));
    assert.equal((await api().get(`/api/v1/wishlist/${id}/check`).set(auth(tokens.alpha))).body.data.saved, true);

    const updated = await api().patch(`/api/v1/wishlist/${id}`).set(auth(tokens.alpha)).send({ note: 'Ask about the hybrid battery' });
    assert.equal(updated.status, 200, updated.body.message);
    assert.equal((await one('SELECT note FROM wishlists WHERE customer_id = (SELECT user_id FROM users WHERE email = ?) AND vehicle_id = ?', ['alpha@customer.lk', id])).note, 'Ask about the hybrid battery');
    assert.equal((await api().patch(`/api/v1/wishlist/${id}`).set(auth(tokens.alpha)).send({ note: 'x'.repeat(256) })).status, 422, 'note length validated');
    assert.equal((await api().patch(`/api/v1/wishlist/${id}`).set(auth(tokens.beta)).send({ note: 'not mine' })).status, 404, 'another customer cannot edit it');
    assert.equal((await api().patch(`/api/v1/wishlist/${id}`).set(auth(tokens.admin)).send({ note: 'x' })).status, 403, 'customers only');

    const cleared = await api().patch(`/api/v1/wishlist/${id}`).set(auth(tokens.alpha)).send({ note: '' });
    assert.equal(cleared.status, 200);
    assert.equal((await one('SELECT note FROM wishlists WHERE wishlist_id = ?', [created.body.data.wishlistId])).note, null, 'empty note stored as NULL');

    const removed = await api().delete(`/api/v1/wishlist/${id}`).set(auth(tokens.alpha));
    assert.equal(removed.status, 200);
    assert.equal(await one('SELECT wishlist_id FROM wishlists WHERE wishlist_id = ?', [created.body.data.wishlistId]), undefined);
  });

  it('Test-drive bookings: create, read, update (reschedule, confirm), delete — website API and database agree', async () => {
    const date = new Date(Date.now() + 9 * 86400000).toISOString().slice(0, 10);
    const later = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
    const created = await api().post('/api/v1/bookings').set(auth(tokens.alpha)).send({ vehicleId: matrix.vehicle, preferredDate: date, preferredTime: '14:00' });
    assert.equal(created.status, 201, created.body.message);
    const id = created.body.data.bookingId;
    assert.equal((await one('SELECT status FROM test_drive_bookings WHERE booking_id = ?', [id])).status, 'Pending');

    // Business rule: a vehicle with an active test drive cannot be archived.
    const blocked = await api().delete(`/api/v1/vehicles/${matrix.vehicle}`).set(auth(tokens.admin));
    assert.equal(blocked.status, 409, blocked.body.message);
    assert.match(blocked.body.message, /1 active test-drive booking/);
    const stillListed = await one('SELECT status, deleted_at FROM vehicles WHERE vehicle_id = ?', [matrix.vehicle]);
    assert.equal(stillListed.status, 'Available');
    assert.equal(stillListed.deleted_at, null, 'vehicle row untouched');
    const viaStatus = await api().patch(`/api/v1/vehicles/${matrix.vehicle}/status`).set(auth(tokens.admin)).send({ status: 'Archived' });
    assert.equal(viaStatus.status, 409, 'the status dropdown cannot bypass the rule');
    assert.equal((await one('SELECT status FROM vehicles WHERE vehicle_id = ?', [matrix.vehicle])).status, 'Available');

    assert.ok((await api().get('/api/v1/my/bookings').set(auth(tokens.alpha))).body.data.some((item) => item.bookingId === id));
    assert.equal((await api().get(`/api/v1/bookings/${id}`).set(auth(tokens.admin))).status, 200);

    const moved = await api().patch(`/api/v1/my/bookings/${id}`).set(auth(tokens.alpha)).send({ preferredDate: later, preferredTime: '15:00' });
    assert.equal(moved.status, 200, moved.body.message);
    const movedRow = await one('SELECT preferred_date, preferred_time FROM test_drive_bookings WHERE booking_id = ?', [id]);
    assert.equal(String(movedRow.preferred_time).slice(0, 5), '15:00');

    const confirmed = await api().patch(`/api/v1/bookings/${id}`).set(auth(tokens.admin)).send({ status: 'Confirmed', staffNote: 'Please bring your licence.' });
    assert.equal(confirmed.status, 200, confirmed.body.message);
    assert.equal((await one('SELECT status FROM test_drive_bookings WHERE booking_id = ?', [id])).status, 'Confirmed');

    const removed = await api().delete(`/api/v1/bookings/${id}`).set(auth(tokens.admin));
    assert.equal(removed.status, 200, removed.body.message);
    assert.equal(await one('SELECT booking_id FROM test_drive_bookings WHERE booking_id = ?', [id]), undefined);
  });
});

describe('CRUD matrix — Naaziq: Complaints and Reply Templates', () => {
  it('Complaints: create, read, update, delete — website API and database agree', async () => {
    // A distinct simulated client IP keeps the real complaint rate limit enabled.
    const created = await api().post('/api/v1/complaints').set(auth(tokens.alpha)).set('X-Forwarded-For', nextIp())
      .send({ category: 'Vehicle Condition', subject: 'Scratch on the bonnet', description: 'There is a deep scratch on the bonnet that was not in the photos.' });
    assert.equal(created.status, 201, created.body.message);
    const id = created.body.data.complaintId;
    const row = await one('SELECT reference, status FROM complaints WHERE complaint_id = ?', [id]);
    assert.match(row.reference, /^HS-CMP-\d{4}-\d{5}$/);
    assert.equal(row.status, 'Submitted');

    assert.ok((await api().get('/api/v1/my/complaints').set(auth(tokens.alpha))).body.data.some((item) => item.complaintId === id));
    assert.equal((await api().get(`/api/v1/complaints/${id}`).set(auth(tokens.admin))).status, 200);

    const updated = await api().patch(`/api/v1/complaints/${id}`).set(auth(tokens.admin)).send({ status: 'Under Review', priority: 'High' });
    assert.equal(updated.status, 200, updated.body.message);
    const after = await one('SELECT status, priority FROM complaints WHERE complaint_id = ?', [id]);
    assert.equal(after.status, 'Under Review');
    assert.equal(after.priority, 'High');
    assert.ok((await one('SELECT COUNT(*) AS total FROM complaint_status_history WHERE complaint_id = ?', [id])).total >= 2, 'history recorded');

    const removed = await api().delete(`/api/v1/complaints/${id}`).set(auth(tokens.admin));
    assert.equal(removed.status, 200);
    assert.equal(await one('SELECT complaint_id FROM complaints WHERE complaint_id = ?', [id]), undefined);
  });

  it('Reply templates: create, read, update, delete — website API and database agree', async () => {
    const body = { title: 'Viewing confirmed', category: 'Enquiry', subject: 'Your viewing of the {{vehicle}}', body: 'Hello {{customer_name}}, your viewing is confirmed.', isActive: true };
    const created = await api().post('/api/v1/reply-templates').set(auth(tokens['staff.care'])).send(body);
    assert.equal(created.status, 201, created.body.message);
    const id = created.body.data.templateId;
    const row = await one('SELECT title, category, is_active, created_by FROM reply_templates WHERE template_id = ?', [id]);
    assert.equal(row.title, 'Viewing confirmed');
    assert.equal(Number(row.is_active), 1);

    assert.equal((await api().post('/api/v1/reply-templates').set(auth(tokens.admin)).send(body)).status, 409, 'titles are unique');
    assert.equal((await api().post('/api/v1/reply-templates').set(auth(tokens.admin)).send({ ...body, title: 'ab', body: 'short' })).status, 422, 'validated');
    assert.equal((await api().post('/api/v1/reply-templates').set(auth(tokens['staff.plain'])).send({ ...body, title: 'No permission' })).status, 403, 'needs the enquiry/complaint permission');
    assert.equal((await api().get('/api/v1/reply-templates').set(auth(tokens.alpha))).status, 403, 'customers cannot read templates');

    const list = await api().get('/api/v1/reply-templates').query({ category: 'Enquiry', includeGeneral: 'true', active: 'true' }).set(auth(tokens.admin));
    assert.ok(list.body.data.some((item) => item.templateId === id));
    assert.ok(list.body.meta.placeholders.includes('{{customer_name}}'));
    assert.equal((await api().get(`/api/v1/reply-templates/${id}`).set(auth(tokens['staff.care']))).body.data.title, 'Viewing confirmed');

    const updated = await api().put(`/api/v1/reply-templates/${id}`).set(auth(tokens['staff.care'])).send({ ...body, title: 'Viewing confirmed (Saturday)', isActive: false });
    assert.equal(updated.status, 200, updated.body.message);
    const changed = await one('SELECT title, is_active FROM reply_templates WHERE template_id = ?', [id]);
    assert.equal(changed.title, 'Viewing confirmed (Saturday)');
    assert.equal(Number(changed.is_active), 0);
    const active = await api().get('/api/v1/reply-templates').query({ active: 'true' }).set(auth(tokens.admin));
    assert.ok(!active.body.data.some((item) => item.templateId === id), 'inactive templates are hidden from the picker');

    // Another staff member (not the author) cannot delete it; an Admin can.
    await api().put(`/api/v1/users/${(await one("SELECT user_id FROM users WHERE email = 'staff.plain@test.lk'")).user_id}/permissions`).set(auth(tokens.admin))
      .send({ canManageInventory: true, canManageEnquiries: true, canViewAssignedContacts: false, canArchiveRecords: false, canManageComplaints: false, canViewLimitedAnalytics: false });
    assert.equal((await api().delete(`/api/v1/reply-templates/${id}`).set(auth(tokens['staff.plain']))).status, 403);
    const removed = await api().delete(`/api/v1/reply-templates/${id}`).set(auth(tokens.admin));
    assert.equal(removed.status, 200);
    assert.equal(await one('SELECT template_id FROM reply_templates WHERE template_id = ?', [id]), undefined);
  });
});

describe('CRUD matrix — Ahamed: Staff Permissions and Saved Reports', () => {
  it('Staff permissions: create (auto + explicit), read, update, delete — database agrees and access changes', async () => {
    const created = await api().post('/api/v1/users').set(auth(tokens.admin))
      .send({ name: 'Perm Matrix', email: 'perm.matrix@test.lk', password: 'PermMatrix!2026', role: 'Staff' });
    assert.equal(created.status, 201, created.body.message);
    const userId = created.body.data.userId;
    const auto = await one('SELECT can_manage_inventory FROM staff_permissions WHERE user_id = ?', [userId]);
    assert.ok(auto, 'CREATE: a no-access record is made with the Staff account');
    assert.equal(Number(auto.can_manage_inventory), 0);

    const read = await api().get(`/api/v1/users/${userId}/permissions`).set(auth(tokens.admin));
    assert.equal(read.status, 200);
    assert.equal(read.body.data.exists, true);

    assert.equal((await api().post(`/api/v1/users/${userId}/permissions`).set(auth(tokens.admin)).send({})).status, 409, 'explicit CREATE refuses a duplicate');

    const removed = await api().delete(`/api/v1/users/${userId}/permissions`).set(auth(tokens.admin));
    assert.equal(removed.status, 200, removed.body.message);
    assert.equal(await one('SELECT permission_id FROM staff_permissions WHERE user_id = ?', [userId]), undefined, 'DELETE removed the row');
    const afterDelete = await api().get(`/api/v1/users/${userId}/permissions`).set(auth(tokens.admin));
    assert.equal(afterDelete.body.data.exists, false);
    assert.equal(await one('SELECT permission_id FROM staff_permissions WHERE user_id = ?', [userId]), undefined, 'READ does not recreate it');
    assert.equal((await api().delete(`/api/v1/users/${userId}/permissions`).set(auth(tokens.admin))).status, 404);

    const temporary = await login('perm.matrix@test.lk', 'PermMatrix!2026');
    // The Admin-set password is temporary: the Staff member replaces it first.
    assert.equal((await api().put('/api/v1/auth/change-password').set(auth(temporary.accessToken))
      .send({ currentPassword: 'PermMatrix!2026', newPassword: 'PermMatrix!Own2026' })).status, 200);
    const staff = temporary;
    assert.equal((await api().get('/api/v1/reports/types').set(auth(staff.accessToken))).body.data.length, 0, 'no record = no reports');
    assert.equal((await api().get('/api/v1/reports/vehicles').set(auth(staff.accessToken))).status, 403, 'no record = no access');

    const explicit = await api().post(`/api/v1/users/${userId}/permissions`).set(auth(tokens.admin)).send({ canViewLimitedAnalytics: true });
    assert.equal(explicit.status, 201, explicit.body.message);
    assert.equal(Number((await one('SELECT can_view_limited_analytics FROM staff_permissions WHERE user_id = ?', [userId])).can_view_limited_analytics), 1);
    assert.ok((await api().get('/api/v1/reports/types').set(auth(staff.accessToken))).body.data.length > 0, 'access granted immediately');
    assert.equal((await api().get('/api/v1/reports/vehicles').set(auth(staff.accessToken))).status, 200, 'report now allowed');

    const updated = await api().put(`/api/v1/users/${userId}/permissions`).set(auth(tokens.admin))
      .send({ canManageInventory: true, canManageEnquiries: false, canViewAssignedContacts: false, canArchiveRecords: false, canManageComplaints: false, canViewLimitedAnalytics: false });
    assert.equal(updated.status, 200);
    const row = await one('SELECT can_manage_inventory, can_view_limited_analytics FROM staff_permissions WHERE user_id = ?', [userId]);
    assert.equal(Number(row.can_manage_inventory), 1);
    assert.equal(Number(row.can_view_limited_analytics), 0);

    assert.equal((await api().post(`/api/v1/users/${userId}/permissions`).set(auth(tokens['staff.plain'])).send({})).status, 403, 'Admin only');
    const audit = await rawQuery("SELECT action FROM activity_logs WHERE entity_type = 'User' AND entity_id = ? AND action LIKE 'permissions.%'", [userId]);
    assert.deepEqual([...new Set(audit.map((item) => item.action))].sort(), ['permissions.created', 'permissions.deleted', 'permissions.updated']);
  });

  it('Saved reports: create, read (run), update, delete — database agrees', async () => {
    const created = await api().post('/api/v1/saved-reports').set(auth(tokens.admin)).send({ name: 'Matrix finance report', reportType: 'finance-applications', filters: {} });
    assert.equal(created.status, 201, created.body.message);
    const id = created.body.data.reportId;
    assert.equal((await one('SELECT report_type FROM saved_reports WHERE report_id = ?', [id])).report_type, 'finance-applications');
    assert.ok((await api().get('/api/v1/saved-reports').set(auth(tokens.admin))).body.data.some((item) => item.reportId === id));
    assert.equal((await api().get(`/api/v1/saved-reports/${id}/run`).set(auth(tokens.admin))).status, 200);

    const updated = await api().put(`/api/v1/saved-reports/${id}`).set(auth(tokens.admin)).send({ name: 'Matrix finance report (submitted)', reportType: 'finance-applications', filters: { status: 'Submitted' } });
    assert.equal(updated.status, 200, updated.body.message);
    const row = await one('SELECT name, filters FROM saved_reports WHERE report_id = ?', [id]);
    assert.equal(row.name, 'Matrix finance report (submitted)');
    assert.match(String(row.filters), /Submitted/);

    const removed = await api().delete(`/api/v1/saved-reports/${id}`).set(auth(tokens.admin));
    assert.equal(removed.status, 200);
    assert.equal(await one('SELECT report_id FROM saved_reports WHERE report_id = ?', [id]), undefined);
  });
});

describe('CRUD matrix — Herathge: Finance Applications and Customer Documents', () => {
  const plan = {};

  before(async () => {
    const [config] = await rawQuery('SELECT * FROM financing_configs WHERE is_active = 1 LIMIT 1');
    const [vehicle] = await rawQuery('SELECT price FROM vehicles WHERE vehicle_id = ?', [matrix.vehicle]);
    Object.assign(plan, {
      price: Number(vehicle.price),
      rate: Number(config.annual_interest_rate),
      minPct: Number(config.min_down_payment_pct),
      maxTerm: Number(config.max_loan_term_months)
    });
  });

  const application = (overrides = {}) => ({
    vehicleId: matrix.vehicle,
    downPayment: Math.ceil((plan.price * plan.minPct) / 100) + 100000,
    termMonths: Math.min(36, plan.maxTerm),
    employmentType: 'Salaried',
    monthlyIncome: 350000,
    contactPhone: '0771234567',
    customerNotes: 'I would like to trade in my current car.',
    ...overrides
  });

  it('Finance applications: create, read, update, withdraw, delete (customer) — server calculation stored in the database', async () => {
    const created = await api().post('/api/v1/finance-applications').set(auth(tokens.alpha)).send(application());
    assert.equal(created.status, 201, created.body.message);
    const id = created.body.data.applicationId;
    matrix.application = id;
    const row = await one('SELECT reference, status, loan_amount, monthly_payment, annual_interest_rate FROM finance_applications WHERE application_id = ?', [id]);
    assert.match(row.reference, /^HS-FIN-\d{4}-\d{5}$/);
    assert.equal(row.status, 'Submitted');
    const expected = calculateLoan(plan.price, application().downPayment, application().termMonths, plan.rate);
    assert.ok(Math.abs(Number(row.monthly_payment) - expected.monthlyPayment) < 0.01, 'monthly payment calculated on the server');
    assert.equal(Number(row.annual_interest_rate), plan.rate, 'rate snapshot from the active configuration');
    assert.ok(smtp.messages.some((message) => message.subject.includes(row.reference) && message.envelopeTo.includes('alpha@customer.lk')), 'customer acknowledgement email');

    // Business rules
    assert.equal((await api().post('/api/v1/finance-applications').set(auth(tokens.alpha)).send(application())).status, 409, 'one open application per vehicle');
    const archive = await api().delete(`/api/v1/vehicles/${matrix.vehicle}`).set(auth(tokens.admin));
    assert.equal(archive.status, 409, 'vehicle with an open finance application cannot be archived');
    assert.match(archive.body.message, /open finance application/);
    assert.equal((await api().post('/api/v1/finance-applications').set(auth(tokens.beta)).send(application({ downPayment: 1 }))).status, 422, 'minimum down payment');
    assert.equal((await api().post('/api/v1/finance-applications').set(auth(tokens.beta)).send(application({ termMonths: plan.maxTerm + 1 }))).status, 422, 'maximum term');
    assert.equal((await api().post('/api/v1/finance-applications').set(auth(tokens.beta)).send(application({ monthlyIncome: 0 }))).status, 422, 'income validated');
    assert.equal((await api().post('/api/v1/finance-applications').set(auth(tokens.admin)).send(application())).status, 403, 'customers only');

    // READ
    const mine = await api().get('/api/v1/my/finance-applications').set(auth(tokens.alpha));
    assert.ok(mine.body.data.some((item) => item.applicationId === id));
    assert.equal((await api().get(`/api/v1/my/finance-applications/${id}`).set(auth(tokens.beta))).status, 404, 'other customers cannot read it');

    // UPDATE (customer, while Submitted) – recalculated
    const updated = await api().put(`/api/v1/my/finance-applications/${id}`).set(auth(tokens.alpha)).send({ ...application(), termMonths: 12 });
    assert.equal(updated.status, 200, updated.body.message);
    const afterUpdate = await one('SELECT term_months, monthly_payment FROM finance_applications WHERE application_id = ?', [id]);
    assert.equal(afterUpdate.term_months, 12);
    assert.ok(Number(afterUpdate.monthly_payment) > Number(row.monthly_payment), 'shorter term → higher payment');

    // UPDATE withdraw, then DELETE
    const withdrawn = await api().patch(`/api/v1/my/finance-applications/${id}/withdraw`).set(auth(tokens.alpha));
    assert.equal(withdrawn.status, 200);
    assert.equal((await one('SELECT status FROM finance_applications WHERE application_id = ?', [id])).status, 'Withdrawn');
    assert.equal((await api().put(`/api/v1/my/finance-applications/${id}`).set(auth(tokens.alpha)).send(application())).status, 409, 'cannot edit after withdrawing');
    assert.equal((await api().patch(`/api/v1/finance-applications/${id}`).set(auth(tokens.admin)).send({ status: 'Under Review' })).status, 409, 'withdrawn cannot be reopened');
    const removed = await api().delete(`/api/v1/my/finance-applications/${id}`).set(auth(tokens.alpha));
    assert.equal(removed.status, 200);
    assert.equal(await one('SELECT application_id FROM finance_applications WHERE application_id = ?', [id]), undefined);
  });

  it('Finance applications: Admin read, review (update) and delete; customers never see internal notes', async () => {
    const created = await api().post('/api/v1/finance-applications').set(auth(tokens.alpha)).send(application());
    assert.equal(created.status, 201, created.body.message);
    const id = created.body.data.applicationId;
    matrix.application = id;

    const list = await api().get('/api/v1/finance-applications').query({ status: 'Submitted' }).set(auth(tokens.admin));
    assert.ok(list.body.data.some((item) => item.applicationId === id));
    assert.ok(list.body.meta.counts.Submitted >= 1);
    assert.equal((await api().get('/api/v1/finance-applications').set(auth(tokens['staff.care']))).status, 403, 'Admin only');
    const search = await api().get('/api/v1/finance-applications').query({ search: created.body.data.reference }).set(auth(tokens.admin));
    assert.deepEqual(search.body.data.map((item) => item.applicationId), [id]);

    assert.equal((await api().patch(`/api/v1/finance-applications/${id}`).set(auth(tokens.admin)).send({ status: 'Declined' })).status, 422, 'declining needs a note');
    const reviewed = await api().patch(`/api/v1/finance-applications/${id}`).set(auth(tokens.admin))
      .send({ status: 'Approved in Principle', decisionNote: 'Please bring three payslips.', staffNotes: 'Checked employer by phone.' });
    assert.equal(reviewed.status, 200, reviewed.body.message);
    const row = await one('SELECT status, decision_note, staff_notes, reviewed_by, reviewed_at FROM finance_applications WHERE application_id = ?', [id]);
    assert.equal(row.status, 'Approved in Principle');
    assert.ok(row.reviewed_by && row.reviewed_at);

    const customerView = await api().get(`/api/v1/my/finance-applications/${id}`).set(auth(tokens.alpha));
    assert.equal(customerView.body.data.decisionNote, 'Please bring three payslips.');
    assert.ok(!('staffNotes' in customerView.body.data), 'internal notes are hidden from the customer');
    assert.equal((await api().put(`/api/v1/my/finance-applications/${id}`).set(auth(tokens.alpha)).send(application())).status, 409, 'cannot edit once reviewed');
    assert.equal((await api().delete(`/api/v1/my/finance-applications/${id}`).set(auth(tokens.alpha))).status, 409, 'cannot delete an approved application');

    const notes = await api().get('/api/v1/my/notifications').set(auth(tokens.alpha));
    assert.ok(notes.body.data.some((item) => item.type === 'finance' && item.title.includes('Approved in Principle')), 'customer notification');
    const dashboard = await api().get('/api/v1/dashboard/summary').set(auth(tokens.admin));
    assert.ok(dashboard.body.data.financeApplications.byStatus['Approved in Principle'] >= 1);
    const report = await api().get('/api/v1/reports/finance-applications').set(auth(tokens.admin));
    assert.equal(report.status, 200);
    assert.ok(report.body.data.rows.some((item) => item.reference === created.body.data.reference));
  });

  it('Customer documents: create on a finance application, read, update, delete — files and database agree', async () => {
    const id = matrix.application;
    const uploaded = await api().post('/api/v1/documents').set(auth(tokens.alpha))
      .field('financeApplicationId', id).attach('file', files.pdf, { filename: 'payslip-september.pdf', contentType: 'application/pdf' });
    assert.equal(uploaded.status, 201, uploaded.body.message);
    const documentId = uploaded.body.data.documentId;
    const row = await one('SELECT category, finance_application_id, storage_key FROM documents WHERE document_id = ?', [documentId]);
    assert.equal(row.category, 'Finance Document');
    assert.equal(row.finance_application_id, id);
    assert.ok(fs.existsSync(path.join(process.env.DOCUMENT_STORAGE_DIR, row.storage_key)), 'file stored privately');

    assert.equal((await api().post('/api/v1/documents').set(auth(tokens.beta)).field('financeApplicationId', id).attach('file', files.pdf, { filename: 'x.pdf', contentType: 'application/pdf' })).status, 403, 'only the owner can attach');
    assert.ok([403, 404].includes((await api().get(`/api/v1/documents/${documentId}`).set(auth(tokens.beta))).status), 'other customers cannot read it');
    const listed = await api().get('/api/v1/documents').query({ financeApplicationId: id }).set(auth(tokens.alpha));
    assert.ok(listed.body.data.some((item) => item.documentId === documentId && item.linkedTo?.type === 'Finance application'));
    const adminView = await api().get(`/api/v1/finance-applications/${id}`).set(auth(tokens.admin));
    assert.ok(adminView.body.data.documents.some((item) => item.documentId === documentId), 'Admin sees it on the application');
    const download = await api().get(`/api/v1/documents/${documentId}/download`).set(auth(tokens.alpha));
    assert.equal(download.status, 200);
    assert.equal(download.headers['x-content-type-options'], 'nosniff');

    const updated = await api().patch(`/api/v1/documents/${documentId}`).set(auth(tokens.alpha)).send({ originalName: 'payslip-sept-2026.pdf', category: 'Finance Document', description: 'September payslip' });
    assert.equal(updated.status, 200, updated.body.message);
    assert.equal((await one('SELECT description FROM documents WHERE document_id = ?', [documentId])).description, 'September payslip');

    const removed = await api().delete(`/api/v1/documents/${documentId}`).set(auth(tokens.alpha));
    assert.equal(removed.status, 200);
    assert.equal(await one('SELECT document_id FROM documents WHERE document_id = ?', [documentId]), undefined);
    assert.ok(!fs.existsSync(path.join(process.env.DOCUMENT_STORAGE_DIR, row.storage_key)), 'file removed');

    // Admin DELETE of the application also removes its documents and files.
    const again = await api().post('/api/v1/documents').set(auth(tokens.alpha)).field('financeApplicationId', id).attach('file', files.png, { filename: 'nic.png', contentType: 'image/png' });
    assert.equal(again.status, 201);
    const key = (await one('SELECT storage_key FROM documents WHERE document_id = ?', [again.body.data.documentId])).storage_key;
    assert.equal((await api().delete(`/api/v1/finance-applications/${id}`).set(auth(tokens.admin))).status, 200);
    assert.equal(await one('SELECT application_id FROM finance_applications WHERE application_id = ?', [id]), undefined);
    assert.equal(await one('SELECT document_id FROM documents WHERE document_id = ?', [again.body.data.documentId]), undefined);
    assert.ok(!fs.existsSync(path.join(process.env.DOCUMENT_STORAGE_DIR, key)));
  });
});

describe('robustness', () => {
  it('answers non-numeric ids with 404 instead of a server error', async () => {
    for (const url of ['/api/v1/vehicles/undefined', '/api/v1/enquiries/abc/responses', '/api/v1/finance-applications/1;DROP']) {
      const response = await api().get(url).set(auth(tokens.admin));
      assert.equal(response.status, 404, url);
    }
  });

  it('handles requests with no body without a server error', async () => {
    assert.equal((await api().post('/api/v1/auth/refresh')).status, 401);
    assert.equal((await api().patch('/api/v1/users/999999/status').set(auth(tokens.admin))).status, 404);
  });
});

/*
|--------------------------------------------------------------------------
| October 2026 – Users, Sessions, Staff Permissions (Ahamed) and
| per-vehicle financing plans (Herathge). Every check is made both in the
| API answer and directly in the database.
|--------------------------------------------------------------------------
*/
const vehicleRow = { make: 'Plan', model: 'Car', year: 2023, price: 10000000, mileage: 5000, condition: 'Used', type: 'SUV', fuelType: 'Hybrid', transmission: 'Automatic', status: 'Available' };

describe('users: lockout, unlock, detail panel, filters and bulk actions', () => {
  it('locks an account after 5 wrong passwords, records the attempts, and an Admin can unlock it', async () => {
    const user = await createUser({ name: 'Lock Test', email: 'lock.test@test.lk', role: 'Customer' });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const wrong = await api().post('/api/v1/auth/login').set('X-Forwarded-For', nextIp()).send({ email: 'lock.test@test.lk', password: 'Wrong!Pass2026' });
      assert.equal(wrong.status, 401);
    }
    const [row] = await rawQuery('SELECT locked_until, failed_login_count FROM users WHERE user_id = ?', [user.userId]);
    assert.ok(row.locked_until, 'locked_until is set');

    const locked = await api().post('/api/v1/auth/login').set('X-Forwarded-For', nextIp()).send({ email: 'lock.test@test.lk', password: 'Password!2026x' });
    assert.equal(locked.status, 423, 'even the right password is refused while locked');
    assert.equal(locked.body.code, 'ACCOUNT_LOCKED');

    const [events] = await rawQuery("SELECT SUM(event_type = 'login_failed') AS failed, SUM(event_type = 'locked') AS locks FROM session_events WHERE user_id = ?", [user.userId]);
    assert.equal(Number(events.failed), 6);
    assert.equal(Number(events.locks), 1);

    const lockedList = await api().get('/api/v1/users?status=locked').set(auth(tokens.admin));
    assert.ok(lockedList.body.data.some((item) => item.email === 'lock.test@test.lk' && item.isLocked));
    assert.ok(lockedList.body.meta.counts.Locked >= 1);

    assert.equal((await api().patch(`/api/v1/users/${user.userId}/unlock`).set(auth(tokens['staff.plain']))).status, 403, 'Admin only');
    const unlock = await api().patch(`/api/v1/users/${user.userId}/unlock`).set(auth(tokens.admin));
    assert.equal(unlock.status, 200, unlock.body.message);
    const [after] = await rawQuery('SELECT locked_until, failed_login_count FROM users WHERE user_id = ?', [user.userId]);
    assert.equal(after.locked_until, null);
    assert.equal(Number(after.failed_login_count), 0);
    await login('lock.test@test.lk', 'Password!2026x');
  });

  it('gives the detail panel: profile, sessions, permissions and recent activity', async () => {
    const [staff] = await rawQuery("SELECT user_id FROM users WHERE email = 'staff.plain@test.lk'");
    const overview = await api().get(`/api/v1/users/${staff.user_id}/overview`).set(auth(tokens.admin));
    assert.equal(overview.status, 200, overview.body.message);
    assert.equal(overview.body.data.email, 'staff.plain@test.lk');
    assert.ok(!('passwordHash' in overview.body.data));
    assert.ok(overview.body.data.permissions, 'permissions included');
    assert.ok(Array.isArray(overview.body.data.sessions) && overview.body.data.sessions.length > 0);
    assert.ok(overview.body.data.sessions[0].device.label);
    assert.ok(Array.isArray(overview.body.data.activity));
  });

  it('sorts, pages and counts the user list', async () => {
    const paged = await api().get('/api/v1/users?page=1&limit=2&sort=name').set(auth(tokens.admin));
    assert.equal(paged.status, 200);
    assert.equal(paged.body.data.length, 2);
    assert.ok(paged.body.meta.pages >= 2);
    const [{ total }] = await rawQuery('SELECT COUNT(*) AS total FROM users');
    assert.equal(paged.body.meta.counts.__all, Number(total));
    const names = paged.body.data.map((item) => item.name);
    assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)));
  });

  it('bulk-deactivates and reactivates accounts, skipping the Admin\'s own account', async () => {
    const one = await createUser({ name: 'Bulk One', email: 'bulk.one@test.lk', role: 'Customer' });
    const two = await createUser({ name: 'Bulk Two', email: 'bulk.two@test.lk', role: 'Customer' });
    const bulkSession = await login('bulk.one@test.lk', 'Password!2026x');
    const [admin] = await rawQuery("SELECT user_id FROM users WHERE email = 'admin@test.lk'");

    const off = await api().post('/api/v1/users/bulk').set(auth(tokens.admin)).send({ action: 'deactivate', userIds: [one.userId, two.userId, admin.user_id] });
    assert.equal(off.status, 200, off.body.message);
    assert.deepEqual(off.body.data.updated.sort(), [one.userId, two.userId].sort());
    assert.ok(off.body.data.skipped.some((item) => item.userId === admin.user_id));
    const rows = await rawQuery('SELECT is_active FROM users WHERE user_id IN (?, ?)', [one.userId, two.userId]);
    assert.ok(rows.every((item) => Number(item.is_active) === 0));
    const [ended] = await rawQuery('SELECT ended_reason FROM admin_sessions WHERE user_id = ? ORDER BY session_id DESC LIMIT 1', [one.userId]);
    assert.equal(ended.ended_reason, 'deactivated');
    assert.equal((await api().get('/api/v1/auth/me').set(auth(bulkSession.accessToken))).status, 401);

    const on = await api().post('/api/v1/users/bulk').set(auth(tokens.admin)).send({ action: 'activate', userIds: [one.userId, two.userId] });
    assert.equal(on.body.data.updated.length, 2);
    assert.equal((await api().post('/api/v1/users/bulk').set(auth(tokens.admin)).send({ action: 'explode', userIds: [one.userId] })).status, 422);
  });
});

describe('forgot password (the owner resets it by email)', () => {
  it('emails a one-time link, resets the password, signs out every device and refuses reuse', async () => {
    const user = await createUser({ name: 'Reset User', email: 'reset.user@test.lk', role: 'Customer' });
    const before = await login('reset.user@test.lk', 'Password!2026x');

    const unknown = await api().post('/api/v1/auth/forgot-password').set('X-Forwarded-For', nextIp()).send({ email: 'nobody.here@test.lk' });
    const known = await api().post('/api/v1/auth/forgot-password').set('X-Forwarded-For', nextIp()).send({ email: 'reset.user@test.lk' });
    assert.equal(unknown.status, 200);
    assert.equal(known.status, 200);
    assert.equal(unknown.body.message, known.body.message, 'the answer never reveals whether an account exists');

    const [mail] = await rawQuery("SELECT payload, recipient, status FROM email_logs WHERE template = 'account-password-reset' ORDER BY email_id DESC LIMIT 1");
    assert.equal(mail.recipient, 'reset.user@test.lk');
    assert.equal(mail.status, 'Accepted');
    assert.equal(mail.payload, null, 'the link is not kept in the outbox after sending');
    const sent = smtp.messages.filter((message) => message.envelopeTo.includes('reset.user@test.lk') && /Reset your High Street password/.test(message.subject)).at(-1);
    assert.ok(sent, 'reset email delivered');
    const body = sent.raw.replace(/=\r\n/g, '').replace(/=3D/gi, '=');
    const decoded = body + (body.match(/^[A-Za-z0-9+/=\r\n]{200,}$/m) ? Buffer.from(body.match(/^[A-Za-z0-9+/=\r\n]{200,}$/m)[0], 'base64').toString('utf8') : '');
    const token = (decoded.match(/reset-password\?token=([a-f0-9]{64})/) || [])[1];
    assert.ok(token, 'the email contains the reset link');
    const [stored] = await rawQuery('SELECT token_hash FROM password_reset_tokens WHERE user_id = ? AND used_at IS NULL', [user.userId]);
    assert.notEqual(stored.token_hash, token, 'only a hash of the token is stored');

    assert.equal((await api().post('/api/v1/auth/reset-password').set('X-Forwarded-For', nextIp()).send({ token, newPassword: 'weak' })).status, 422);
    const reset = await api().post('/api/v1/auth/reset-password').set('X-Forwarded-For', nextIp()).send({ token, newPassword: 'Reset!NewPass2026' });
    assert.equal(reset.status, 200, reset.body.message);

    assert.equal((await api().get('/api/v1/auth/me').set(auth(before.accessToken))).status, 401, 'old sessions signed out');
    const [ended] = await rawQuery('SELECT ended_reason FROM admin_sessions WHERE session_id = (SELECT MAX(session_id) FROM admin_sessions WHERE user_id = ?)', [user.userId]);
    assert.equal(ended.ended_reason, 'password_reset');
    const again = await api().post('/api/v1/auth/reset-password').set('X-Forwarded-For', nextIp()).send({ token, newPassword: 'Reset!Other2026' });
    assert.equal(again.status, 400, 'a link works only once');
    await login('reset.user@test.lk', 'Reset!NewPass2026');
    assert.equal((await api().post('/api/v1/auth/login').set('X-Forwarded-For', nextIp()).send({ email: 'reset.user@test.lk', password: 'Password!2026x' })).status, 401);
  });
});

describe('sessions: check activity, filters and login history', () => {
  it('records the login, refreshes and how the session ended, and shows it in "Check activity"', async () => {
    await createUser({ name: 'Activity User', email: 'activity.user@test.lk', role: 'Customer' });
    const session = await api().post('/api/v1/auth/login').set('X-Forwarded-For', '10.77.0.1')
      .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36')
      .send({ email: 'activity.user@test.lk', password: 'Password!2026x' });
    assert.equal(session.status, 200, session.body.message);
    const refreshed = await api().post('/api/v1/auth/refresh').send({ refreshToken: session.body.data.refreshToken });
    assert.equal(refreshed.status, 200);

    const mine = await api().get('/api/v1/sessions').set(auth(refreshed.body.data.accessToken));
    const current = mine.body.data.find((item) => item.isCurrent);
    assert.equal(current.device.label, 'Chrome 129 on Windows 10/11');
    assert.equal(current.refreshCount, 1);

    const activity = await api().get(`/api/v1/sessions/${current.sessionId}/activity`).set(auth(refreshed.body.data.accessToken));
    assert.equal(activity.status, 200, activity.body.message);
    assert.deepEqual(activity.body.data.timeline.map((event) => event.eventType), ['login', 'refresh']);
    assert.equal((await api().get(`/api/v1/sessions/${current.sessionId}/activity`).set(auth(tokens.beta))).status, 404, 'other users cannot see it');

    assert.equal((await api().delete(`/api/v1/sessions/${current.sessionId}`).set(auth(tokens.admin))).status, 200);
    const [row] = await rawQuery('SELECT ended_reason, ended_by, last_seen_at, device_label FROM admin_sessions WHERE session_id = ?', [current.sessionId]);
    const [admin] = await rawQuery("SELECT user_id FROM users WHERE email = 'admin@test.lk'");
    assert.equal(row.ended_reason, 'revoked');
    assert.equal(row.ended_by, admin.user_id);
    assert.ok(row.last_seen_at);

    const adminView = await api().get(`/api/v1/sessions/${current.sessionId}/activity`).set(auth(tokens.admin));
    assert.equal(adminView.body.data.session.status, 'Revoked');
    assert.equal(adminView.body.data.session.endedByUser.name, 'Admin One');
    const last = adminView.body.data.timeline.at(-1);
    assert.equal(last.eventType, 'revoked');
    assert.equal(last.actor.name, 'Admin One');
  });

  it('filters every session by status, search, role and device, with counts', async () => {
    const revoked = await api().get('/api/v1/sessions?scope=all&status=revoked&search=activity.user').set(auth(tokens.admin));
    assert.equal(revoked.status, 200);
    assert.ok(revoked.body.data.length >= 1 && revoked.body.data.every((item) => item.status === 'Revoked' && item.user.email === 'activity.user@test.lk'));
    await api().post('/api/v1/auth/login').set('X-Forwarded-For', '10.77.0.9').send({ email: 'activity.user@test.lk', password: 'Password!2026x' });
    const byIp = await api().get('/api/v1/sessions?scope=all&status=all&search=10.77.0.9').set(auth(tokens.admin));
    assert.ok(byIp.body.data.length >= 1 && byIp.body.data.every((item) => item.ipAddress === '10.77.0.9'));
    const staffOnly = await api().get('/api/v1/sessions?scope=all&status=all&role=Staff').set(auth(tokens.admin));
    assert.ok(staffOnly.body.data.every((item) => item.user.role === 'Staff'));
    const mobile = await api().get('/api/v1/sessions?scope=all&status=all&device=mobile').set(auth(tokens.admin));
    assert.ok(mobile.body.data.every((item) => item.device.type !== 'desktop'));
    const paged = await api().get('/api/v1/sessions?scope=all&status=all&page=1&limit=3').set(auth(tokens.admin));
    assert.equal(paged.body.data.length, 3);
    const [{ total }] = await rawQuery('SELECT COUNT(*) AS total FROM admin_sessions');
    assert.equal(paged.body.meta.counts.__all, Number(total), 'chip counts cover every session');
    const loggedOut = await api().get('/api/v1/sessions?scope=all&status=logged_out').set(auth(tokens.admin));
    assert.ok(loggedOut.body.data.every((item) => item.endedReason === 'logout'));
    const plain = await api().get('/api/v1/sessions?status=all').set(auth(tokens.beta));
    assert.ok(plain.body.data.every((item) => !item.user), 'own sessions only, without the owner block');
  });

  it('shows the login history with failed attempts to Admins only', async () => {
    const failed = await api().get('/api/v1/sessions/login-history?type=failed&search=lock.test').set(auth(tokens.admin));
    assert.equal(failed.status, 200, failed.body.message);
    assert.ok(failed.body.data.length >= 6 && failed.body.data.every((event) => event.eventType === 'login_failed'));
    assert.ok(failed.body.meta.failed24h >= 6);
    const locks = await api().get('/api/v1/sessions/login-history?type=locked').set(auth(tokens.admin));
    assert.deepEqual([...new Set(locks.body.data.map((event) => event.eventType))].sort(), ['locked', 'unlocked']);
    assert.equal((await api().get('/api/v1/sessions/login-history').set(auth(tokens['staff.plain']))).status, 403);
  });
});

describe('staff permissions: 8 permissions, list with filters, undo', () => {
  it('lists every Staff member with counts and filters by permission', async () => {
    const list = await api().get('/api/v1/staff-permissions').set(auth(tokens.admin));
    assert.equal(list.status, 200, list.body.message);
    assert.equal(list.body.meta.fields.length, 8);
    const [{ total }] = await rawQuery("SELECT COUNT(*) AS total FROM users WHERE role = 'Staff'");
    assert.equal(list.body.meta.counts.__all, Number(total));
    const inventory = await api().get('/api/v1/staff-permissions?has=canManageInventory').set(auth(tokens.admin));
    assert.ok(inventory.body.data.length >= 1 && inventory.body.data.every((row) => row.permissions.canManageInventory));
    const search = await api().get('/api/v1/staff-permissions?search=staff.care').set(auth(tokens.admin));
    assert.deepEqual(search.body.data.map((row) => row.user.email), ['staff.care@test.lk']);
    assert.equal((await api().get('/api/v1/staff-permissions').set(auth(tokens['staff.care']))).status, 403);
  });

  it('"Manage bookings" controls test drives and "Export reports" controls downloads', async () => {
    const staff = await createUser({
      name: 'Perm Eight',
      email: 'perm.eight@test.lk',
      role: 'Staff',
      permissions: { canManageEnquiries: true, canViewAssignedContacts: true, canViewLimitedAnalytics: true }
    });
    const session = await login('perm.eight@test.lk', 'Password!2026x');
    assert.equal((await api().get('/api/v1/bookings').set(auth(session.accessToken))).status, 403, 'no Manage bookings');
    assert.equal((await api().get('/api/v1/reports/vehicles').set(auth(session.accessToken))).status, 200, 'can view reports');
    assert.equal((await api().get('/api/v1/reports/vehicles/export/csv').set(auth(session.accessToken))).status, 403, 'cannot export');

    const grant = await api().put(`/api/v1/users/${staff.userId}/permissions`).set(auth(tokens.admin))
      .send({ canManageInventory: false, canManageEnquiries: true, canViewAssignedContacts: true, canArchiveRecords: false, canManageComplaints: false, canViewLimitedAnalytics: true, canManageBookings: true, canExportReports: true });
    assert.equal(grant.status, 200, grant.body.message);
    const [row] = await rawQuery('SELECT can_manage_bookings, can_export_reports FROM staff_permissions WHERE user_id = ?', [staff.userId]);
    assert.equal(Number(row.can_manage_bookings), 1);
    assert.equal(Number(row.can_export_reports), 1);
    assert.equal((await api().get('/api/v1/bookings').set(auth(session.accessToken))).status, 200);
    assert.equal((await api().get('/api/v1/reports/vehicles/export/csv').set(auth(session.accessToken))).status, 200);

    // An older client that sends only the original 6 flags leaves the new ones unchanged.
    await api().put(`/api/v1/users/${staff.userId}/permissions`).set(auth(tokens.admin))
      .send({ canManageInventory: true, canManageEnquiries: true, canViewAssignedContacts: true, canArchiveRecords: false, canManageComplaints: false, canViewLimitedAnalytics: true });
    const [kept] = await rawQuery('SELECT can_manage_bookings, can_manage_inventory FROM staff_permissions WHERE user_id = ?', [staff.userId]);
    assert.equal(Number(kept.can_manage_bookings), 1);
    assert.equal(Number(kept.can_manage_inventory), 1);
  });

  it('undo puts the previous permissions back and is recorded in the audit log', async () => {
    const [staff] = await rawQuery("SELECT user_id FROM users WHERE email = 'perm.eight@test.lk'");
    const previous = (await api().get(`/api/v1/users/${staff.user_id}/permissions`).set(auth(tokens.admin))).body.data.permissions;
    await api().delete(`/api/v1/users/${staff.user_id}/permissions`).set(auth(tokens.admin));
    const fields = ['canManageInventory', 'canManageEnquiries', 'canViewAssignedContacts', 'canArchiveRecords', 'canManageComplaints', 'canViewLimitedAnalytics', 'canManageBookings', 'canExportReports'];
    const restore = await api().post(`/api/v1/users/${staff.user_id}/permissions`).set(auth(tokens.admin))
      .send({ ...Object.fromEntries(fields.map((field) => [field, Boolean(previous[field])])), undo: true });
    assert.equal(restore.status, 201, restore.body.message);
    const [row] = await rawQuery('SELECT can_manage_bookings, can_manage_inventory FROM staff_permissions WHERE user_id = ?', [staff.user_id]);
    assert.equal(Number(row.can_manage_bookings), 1);
    assert.equal(Number(row.can_manage_inventory), 1);
    const [audit] = await rawQuery("SELECT summary FROM activity_logs WHERE action = 'permissions.restored' AND entity_id = ? ORDER BY activity_id DESC LIMIT 1", [staff.user_id]);
    assert.match(audit.summary, /undo/);
  });
});

describe('financing configurations for one chosen vehicle', () => {
  it('creates a plan for one vehicle, which the calculator, vehicle pages and applications use', async () => {
    const vehicle = await Vehicle.create({ ...vehicleRow, model: 'Plan Car A' });
    const other = await Vehicle.create({ ...vehicleRow, model: 'Plan Car B' });
    const general = (await api().get('/api/v1/financing-config/active')).body.data;
    assert.equal(general.vehicleId, null);

    const created = await api().post('/api/v1/financing-config').set(auth(tokens.admin))
      .send({ name: 'Plan A special', annualInterestRate: 5, minDownPaymentPct: 10, maxLoanTermMonths: 72, isActive: true, vehicleId: vehicle.vehicleId });
    assert.equal(created.status, 201, created.body.message);
    assert.equal(created.body.data.vehicle.model, 'Plan Car A', 'the record shows the vehicle name');
    assert.ok(created.body.data.example.fromMonthly > 0);
    const id = created.body.data.configId;
    const [row] = await rawQuery('SELECT vehicle_id, is_active FROM financing_configs WHERE config_id = ?', [id]);
    assert.equal(row.vehicle_id, vehicle.vehicleId);
    assert.equal(Number(row.is_active), 1);
    const [{ generalActive }] = await rawQuery('SELECT COUNT(*) AS generalActive FROM financing_configs WHERE is_active = 1 AND vehicle_id IS NULL');
    assert.equal(Number(generalActive), 1, 'the general plan stays active for every other vehicle');

    const forVehicle = await api().get(`/api/v1/financing-config/active?vehicleId=${vehicle.vehicleId}`);
    assert.equal(forVehicle.body.data.configId, id);
    assert.equal(forVehicle.body.data.vehicleSpecific, true);
    assert.equal((await api().get(`/api/v1/financing-config/active?vehicleId=${other.vehicleId}`)).body.data.configId, general.configId);

    const page = await api().get(`/api/v1/vehicles/${vehicle.vehicleId}`);
    assert.equal(page.body.data.financePlan.configId, id);
    assert.equal(page.body.data.financePlan.vehicleSpecific, true);
    const expected = Math.round(calculateLoan(10000000, 1000000, 72, 5).monthlyPayment);
    assert.equal(page.body.data.financePlan.fromMonthly, expected, 'the "Finance from" amount is calculated with the vehicle plan');
    const inventory = await api().get('/api/v1/vehicles?search=Plan Car&limit=50');
    const cards = Object.fromEntries(inventory.body.data.map((item) => [item.model, item.financePlan]));
    assert.equal(cards['Plan Car A'].configId, id);
    assert.equal(cards['Plan Car B'].configId, general.configId);

    await createUser({ name: 'Customer Plan', email: 'plan.buyer@customer.lk', role: 'Customer' });
    const gamma = await login('plan.buyer@customer.lk', 'Password!2026x');
    const applied = await api().post('/api/v1/finance-applications').set(auth(gamma.accessToken))
      .send({ vehicleId: vehicle.vehicleId, downPayment: 1500000, termMonths: 72, employmentType: 'Salaried', monthlyIncome: 450000, contactPhone: '0771234567' });
    assert.equal(applied.status, 201, applied.body.message);
    const [application] = await rawQuery('SELECT config_id, annual_interest_rate, monthly_payment FROM finance_applications WHERE application_id = ?', [applied.body.data.applicationId]);
    assert.equal(application.config_id, id);
    assert.equal(Number(application.annual_interest_rate), 5);
    assert.equal(Number(application.monthly_payment), Math.round(calculateLoan(10000000, 1500000, 72, 5).monthlyPayment * 100) / 100);
    matrix.planVehicle = vehicle.vehicleId;
    matrix.plan = id;
  });

  it('keeps one active plan per vehicle, edits the vehicle, protects active plans and refuses sold vehicles', async () => {
    const second = await api().post('/api/v1/financing-config').set(auth(tokens.admin))
      .send({ name: 'Plan A newer', annualInterestRate: 6, minDownPaymentPct: 15, maxLoanTermMonths: 60, isActive: true, vehicleId: matrix.planVehicle });
    assert.equal(second.status, 201);
    const active = await rawQuery('SELECT config_id FROM financing_configs WHERE vehicle_id = ? AND is_active = 1', [matrix.planVehicle]);
    assert.deepEqual(active.map((item) => item.config_id), [second.body.data.configId], 'the older plan of that vehicle was switched off');

    assert.equal((await api().delete(`/api/v1/financing-config/${second.body.data.configId}`).set(auth(tokens.admin))).status, 409, 'active plan protected');
    const list = await api().get('/api/v1/financing-config').set(auth(tokens.admin));
    const listed = list.body.data.rows.find((item) => item.configId === second.body.data.configId);
    assert.equal(listed.scope, 'vehicle');
    assert.equal(listed.vehicle.vehicleId, matrix.planVehicle);

    const sold = await Vehicle.create({ ...vehicleRow, model: 'Sold Car', status: 'Sold' });
    const refused = await api().post('/api/v1/financing-config').set(auth(tokens.admin))
      .send({ name: 'Sold plan', annualInterestRate: 5, minDownPaymentPct: 10, maxLoanTermMonths: 48, isActive: false, vehicleId: sold.vehicleId });
    assert.equal(refused.status, 422);
    assert.equal((await api().post('/api/v1/financing-config').set(auth(tokens.admin))
      .send({ name: 'Ghost plan', annualInterestRate: 5, minDownPaymentPct: 10, maxLoanTermMonths: 48, vehicleId: 999999 })).status, 422);

    // Edit: move the first plan to the general plan list (vehicleId null), inactive.
    const moved = await api().put(`/api/v1/financing-config/${matrix.plan}`).set(auth(tokens.admin))
      .send({ name: 'Plan A special', annualInterestRate: 5, minDownPaymentPct: 10, maxLoanTermMonths: 72, isActive: false, vehicleId: null });
    assert.equal(moved.status, 200, moved.body.message);
    const [movedRow] = await rawQuery('SELECT vehicle_id FROM financing_configs WHERE config_id = ?', [matrix.plan]);
    assert.equal(movedRow.vehicle_id, null);

    // Switching the vehicle plan off makes the vehicle use the general plan again.
    await api().put(`/api/v1/financing-config/${second.body.data.configId}`).set(auth(tokens.admin))
      .send({ name: 'Plan A newer', annualInterestRate: 6, minDownPaymentPct: 15, maxLoanTermMonths: 60, isActive: false, vehicleId: matrix.planVehicle });
    const back = await api().get(`/api/v1/financing-config/active?vehicleId=${matrix.planVehicle}`);
    assert.equal(back.body.data.vehicleSpecific, false);
    assert.equal((await api().delete(`/api/v1/financing-config/${second.body.data.configId}`).set(auth(tokens.admin))).status, 200);
    assert.equal((await rawQuery('SELECT config_id FROM financing_configs WHERE config_id = ?', [second.body.data.configId])).length, 0);
  });
});

// Keep EmailLog and Vehicle referenced so linters do not flag unused imports.
void EmailLog;
void Vehicle;

/*
|--------------------------------------------------------------------------
| October 2026 (v3): Unarchive, staff availability, Reset, Delete staff
|--------------------------------------------------------------------------
*/

const inDays = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const noAccess = { canManageInventory: false, canManageEnquiries: false, canViewAssignedContacts: false, canArchiveRecords: false, canManageComplaints: false, canViewLimitedAnalytics: false, canManageBookings: false, canExportReports: false };

describe('vehicles: archive from any control and Unarchive to the previous status', () => {
  it('archiving with the status drop-down is a real archive, and Unarchive brings back Sold, Available or Draft', async () => {
    const sold = await Vehicle.create({ ...vehicleRow, model: 'Unarchive Sold', status: 'Sold' });
    const viaStatus = await api().patch(`/api/v1/vehicles/${sold.vehicleId}/status`).set(auth(tokens.admin)).send({ status: 'Archived' });
    assert.equal(viaStatus.status, 200, viaStatus.body.message);
    let row = await one('SELECT status, deleted_at, status_before_archive FROM vehicles WHERE vehicle_id = ?', [sold.vehicleId]);
    assert.equal(row.status, 'Archived');
    assert.ok(row.deleted_at, 'soft-deleted like the Archive button');
    assert.equal(row.status_before_archive, 'Sold');

    // The dashboard list (Include archived) marks it as archived.
    const list = await api().get('/api/v1/vehicles').set(auth(tokens.admin)).query({ includeArchived: 'true', search: 'Unarchive Sold' });
    const listed = list.body.data.find((vehicle) => vehicle.vehicleId === sold.vehicleId);
    assert.ok(listed.deletedAt, 'deletedAt is returned so the card shows Unarchive');
    assert.equal(listed.statusBeforeArchive, 'Sold');

    const back = await api().patch(`/api/v1/vehicles/${sold.vehicleId}/restore`).set(auth(tokens.admin));
    assert.equal(back.status, 200);
    assert.equal(back.body.data.status, 'Sold', 'Sold comes back as Sold');
    row = await one('SELECT status, deleted_at, status_before_archive FROM vehicles WHERE vehicle_id = ?', [sold.vehicleId]);
    assert.deepEqual([row.status, row.deleted_at, row.status_before_archive], ['Sold', null, null]);

    // Available with an image comes back Available; without an image, Draft.
    const shown = await Vehicle.create({ ...vehicleRow, model: 'Unarchive Shown' });
    await models.VehicleImage.create({ vehicleId: shown.vehicleId, url: '/uploads/vehicles/x.png', isPrimary: true, sortOrder: 0 });
    assert.equal((await api().delete(`/api/v1/vehicles/${shown.vehicleId}`).set(auth(tokens.admin))).status, 200);
    assert.equal((await api().patch(`/api/v1/vehicles/${shown.vehicleId}/restore`).set(auth(tokens.admin))).body.data.status, 'Available');

    const bare = await Vehicle.create({ ...vehicleRow, model: 'Unarchive Bare' });
    assert.equal((await api().delete(`/api/v1/vehicles/${bare.vehicleId}`).set(auth(tokens.admin))).status, 200);
    const bareBack = await api().patch(`/api/v1/vehicles/${bare.vehicleId}/restore`).set(auth(tokens.admin));
    assert.equal(bareBack.body.data.status, 'Draft', 'no image any more → Draft');

    // Not archived → 409
    assert.equal((await api().patch(`/api/v1/vehicles/${bare.vehicleId}/restore`).set(auth(tokens.admin))).status, 409);
  });

  it('Staff need "Archive records" to archive through the drop-down too', async () => {
    const car = await Vehicle.create({ ...vehicleRow, model: 'Archive Perm Car' });
    const refused = await api().patch(`/api/v1/vehicles/${car.vehicleId}/status`).set(auth(tokens['staff.plain'])).send({ status: 'Archived' });
    assert.equal(refused.status, 403);
    assert.equal((await one('SELECT status, deleted_at FROM vehicles WHERE vehicle_id = ?', [car.vehicleId])).deleted_at, null);
  });
});

describe('test-drive assignment: staff availability (busy time + leave days)', () => {
  it('shows who is free, refuses busy / on-leave / no-permission Staff, and manages leave days', async () => {
    const free = await createUser({ name: 'Avail Free', email: 'avail.free@test.lk', role: 'Staff', permissions: { ...noAccess, canManageBookings: true, canViewAssignedContacts: true } });
    const leaveStaff = await createUser({ name: 'Avail Leave', email: 'avail.leave@test.lk', role: 'Staff', permissions: { ...noAccess, canManageBookings: true, canViewAssignedContacts: true } });
    const noPerm = await createUser({ name: 'Avail NoPerm', email: 'avail.noperm@test.lk', role: 'Staff', permissions: { ...noAccess, canManageInventory: true } });
    const carA = await Vehicle.create({ ...vehicleRow, model: 'Avail Car A' });
    const carB = await Vehicle.create({ ...vehicleRow, model: 'Avail Car B' });
    const day = inDays(9);

    const first = await api().post('/api/v1/bookings').set(auth(tokens.alpha)).send({ vehicleId: carA.vehicleId, preferredDate: day, preferredTime: '10:00' });
    const second = await api().post('/api/v1/bookings').set(auth(tokens.beta)).send({ vehicleId: carB.vehicleId, preferredDate: day, preferredTime: '10:30' });
    assert.equal(first.status, 201, first.body.message);
    assert.equal(second.status, 201, second.body.message);
    const firstId = first.body.data.bookingId;
    const secondId = second.body.data.bookingId;

    // The Admin is told about each new request by email.
    const adminMail = await rawQuery("SELECT COUNT(*) AS n FROM email_logs WHERE template = 'booking-admin' AND related_id IN (?, ?)", [firstId, secondId]);
    assert.equal(Number(adminMail[0].n), 2, 'Admin notified of both requests');

    assert.equal((await api().patch(`/api/v1/bookings/${firstId}/assign`).set(auth(tokens.admin)).send({ assignedTo: free.userId })).status, 200);

    const options = await api().get('/api/v1/bookings/staff-availability').set(auth(tokens.admin)).query({ ids: `${firstId},${secondId}` });
    assert.equal(options.status, 200, options.body.message);
    const forSecond = options.body.data.bookings[secondId];
    assert.equal(forSecond[free.userId].code, 'busy', 'test drive 30 minutes earlier');
    assert.match(forSecond[free.userId].reason, /10:00/);
    assert.equal(forSecond[noPerm.userId].code, 'no_permission');
    assert.equal(forSecond[leaveStaff.userId].available, true);
    assert.equal(options.body.data.bookings[firstId][free.userId].available, true, 'own booking is not a clash');
    assert.ok(options.body.data.staff.every((member) => member.userId !== undefined && member.name));

    const busy = await api().patch(`/api/v1/bookings/${secondId}/assign`).set(auth(tokens.admin)).send({ assignedTo: free.userId });
    assert.equal(busy.status, 422);
    assert.match(busy.body.message, /not available/);
    assert.equal((await api().patch(`/api/v1/bookings/${secondId}/assign`).set(auth(tokens.admin)).send({ assignedTo: noPerm.userId })).status, 422);

    // Leave day: CREATE, overlap refused, READ, assignment refused, DELETE.
    const leave = await api().post('/api/v1/staff-leave').set(auth(tokens.admin)).send({ staffId: leaveStaff.userId, startDate: day, endDate: inDays(10), reason: 'Annual leave' });
    assert.equal(leave.status, 201, leave.body.message);
    assert.equal((await one('SELECT COUNT(*) AS n FROM staff_leave WHERE staff_id = ?', [leaveStaff.userId])).n, 1);
    assert.equal((await api().post('/api/v1/staff-leave').set(auth(tokens.admin)).send({ staffId: leaveStaff.userId, startDate: inDays(10), endDate: inDays(11) })).status, 409);
    assert.equal((await api().post('/api/v1/staff-leave').set(auth(tokens.admin)).send({ staffId: leaveStaff.userId, startDate: inDays(12), endDate: inDays(11) })).status, 422, 'last day before first day');
    assert.equal((await api().post('/api/v1/staff-leave').set(auth(tokens.admin)).send({ staffId: free.userId - 1000000, startDate: day, endDate: day })).status, 422);

    const onLeave = await api().patch(`/api/v1/bookings/${secondId}/assign`).set(auth(tokens.admin)).send({ assignedTo: leaveStaff.userId });
    assert.equal(onLeave.status, 422);
    assert.match(onLeave.body.message, /On leave \(Annual leave\)/);

    const dayView = await api().get('/api/v1/staff-availability').set(auth(tokens.admin)).query({ date: day });
    assert.equal(dayView.body.data[leaveStaff.userId].state, 'On leave');
    assert.deepEqual(dayView.body.data[free.userId].testDrives, ['10:00']);

    const listed = await api().get('/api/v1/staff-leave').set(auth(tokens.admin)).query({ staffId: leaveStaff.userId });
    assert.equal(listed.body.data.length, 1);
    assert.equal(listed.body.data[0].staff.name, 'Avail Leave');

    // Leave over an assigned test drive warns the Admin to reassign it.
    const warn = await api().post('/api/v1/staff-leave').set(auth(tokens.admin)).send({ staffId: free.userId, startDate: day, endDate: day });
    assert.equal(warn.status, 201);
    assert.equal(warn.body.meta.affectedBookings.length, 1);
    assert.match(warn.body.message, /reassign/);

    assert.equal((await api().delete(`/api/v1/staff-leave/${leave.body.data.leaveId}`).set(auth(tokens.admin))).status, 200);
    assert.equal((await api().delete(`/api/v1/staff-leave/${leave.body.data.leaveId}`).set(auth(tokens.admin))).status, 404);
    const assigned = await api().patch(`/api/v1/bookings/${secondId}/assign`).set(auth(tokens.admin)).send({ assignedTo: leaveStaff.userId });
    assert.equal(assigned.status, 200, assigned.body.message);
    assert.equal((await one('SELECT assigned_to FROM test_drive_bookings WHERE booking_id = ?', [secondId])).assigned_to, leaveStaff.userId);

    // Admin only
    assert.equal((await api().get('/api/v1/staff-leave').set(auth(tokens['staff.care']))).status, 403);
    assert.equal((await api().get('/api/v1/bookings/staff-availability').set(auth(tokens['staff.care']))).status, 403);

    // Clean up so later tests are not affected by these bookings.
    await rawQuery("UPDATE test_drive_bookings SET status = 'Cancelled' WHERE booking_id IN (?, ?)", [firstId, secondId]);
  });
});

describe('staff permissions: Reset, account status and permanent Delete staff', () => {
  it('Reset clears every permission but keeps the record; cards show status and availability', async () => {
    const staff = await createUser({ name: 'Reset Me', email: 'reset.me@test.lk', role: 'Staff', permissions: { ...noAccess, canManageInventory: true, canExportReports: true } });
    await staff.update({ mustChangePassword: true });

    const reset = await api().patch(`/api/v1/users/${staff.userId}/permissions/reset`).set(auth(tokens.admin));
    assert.equal(reset.status, 200, reset.body.message);
    const row = await one('SELECT * FROM staff_permissions WHERE user_id = ?', [staff.userId]);
    assert.ok(row, 'record kept');
    assert.ok(Object.keys(row).filter((key) => key.startsWith('can_')).every((key) => !Number(row[key])), 'all false');
    const [audit] = await rawQuery("SELECT summary FROM activity_logs WHERE action = 'permissions.reset' AND entity_id = ? ORDER BY activity_id DESC LIMIT 1", [staff.userId]);
    assert.match(audit.summary, /was: canManageInventory, canExportReports/);

    const list = await api().get('/api/v1/staff-permissions').set(auth(tokens.admin)).query({ search: 'reset.me', date: inDays(1) });
    const card = list.body.data[0];
    assert.equal(card.user.accountState, 'Password change needed');
    assert.equal(card.availability.state, 'Available');
    assert.equal(card.grantedCount, 0);
    assert.ok('Locked' in list.body.meta.counts && 'On leave' in list.body.meta.counts);
    const filtered = await api().get('/api/v1/staff-permissions').set(auth(tokens.admin)).query({ status: 'password' });
    assert.ok(filtered.body.data.some((item) => item.user.userId === staff.userId));
    assert.ok(filtered.body.data.every((item) => item.user.accountState === 'Password change needed'));

    assert.equal((await api().patch(`/api/v1/users/${staff.userId}/permissions/reset`).set(auth(tokens['staff.care']))).status, 403);
    const adminRow = await one("SELECT user_id FROM users WHERE email = 'admin@test.lk'");
    assert.equal((await api().patch(`/api/v1/users/${adminRow.user_id}/permissions/reset`).set(auth(tokens.admin))).status, 422, 'Admin account is not Staff');
  });

  it('Delete staff removes the account for good, keeps their work and unassigns their tasks', async () => {
    const leaving = await createUser({ name: 'Leaving Staff', email: 'leaving.staff@test.lk', role: 'Staff', permissions: { ...noAccess, canManageEnquiries: true } });
    const enquiry = await api().post('/api/v1/enquiries').set(auth(tokens.alpha)).send({ message: 'Delete staff test enquiry message' });
    assert.equal(enquiry.status, 201, enquiry.body.message);
    const enquiryId = enquiry.body.data.enquiryId;
    await rawQuery('UPDATE enquiries SET assigned_to = ? WHERE enquiry_id = ?', [leaving.userId, enquiryId]);
    await rawQuery("INSERT INTO enquiry_responses (enquiry_id, admin_id, subject, response_body, status, created_at, updated_at) VALUES (?, ?, 'Reply', 'Kept after delete', 'Draft', NOW(), NOW())", [enquiryId, leaving.userId]);
    await rawQuery("INSERT INTO documents (uploaded_by, category, original_name, storage_key, mime_type, extension, size_bytes, checksum_sha256, created_at, updated_at) VALUES (?, 'Other', 'kept.pdf', 'kept-delete-test.pdf', 'application/pdf', 'pdf', 10, REPEAT('a', 64), NOW(), NOW())", [leaving.userId]);
    await rawQuery('INSERT INTO staff_leave (staff_id, start_date, end_date, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())', [leaving.userId, inDays(30), inDays(31)]);

    // Only Staff accounts can be deleted this way.
    assert.equal((await api().delete(`/api/v1/users/${(await one("SELECT user_id FROM users WHERE email = 'alpha@customer.lk'")).user_id}/permanent`).set(auth(tokens.admin))).status, 422);
    assert.equal((await api().delete(`/api/v1/users/${leaving.userId}/permanent`).set(auth(tokens['staff.care']))).status, 403);

    const removed = await api().delete(`/api/v1/users/${leaving.userId}/permanent`).set(auth(tokens.admin));
    assert.equal(removed.status, 200, removed.body.message);
    assert.equal(removed.body.data.unassigned.enquiries, 1);

    assert.equal(await one('SELECT user_id FROM users WHERE user_id = ?', [leaving.userId]), undefined, 'account row gone');
    assert.equal(await one('SELECT user_id FROM staff_permissions WHERE user_id = ?', [leaving.userId]), undefined, 'permissions gone');
    assert.equal(await one('SELECT staff_id FROM staff_leave WHERE staff_id = ?', [leaving.userId]), undefined, 'leave gone');
    assert.equal((await one('SELECT assigned_to FROM enquiries WHERE enquiry_id = ?', [enquiryId])).assigned_to, null, 'enquiry unassigned');
    assert.equal((await one("SELECT admin_id FROM enquiry_responses WHERE response_body = 'Kept after delete'")).admin_id, null, 'response kept');
    assert.equal((await one("SELECT uploaded_by FROM documents WHERE storage_key = 'kept-delete-test.pdf'")).uploaded_by, null, 'document kept');
    const [audit] = await rawQuery("SELECT summary FROM activity_logs WHERE action = 'user.deleted_permanently' AND entity_id = ?", [leaving.userId]);
    assert.match(audit.summary, /Leaving Staff <leaving\.staff@test\.lk>/);

    assert.equal((await api().delete(`/api/v1/users/${leaving.userId}/permanent`).set(auth(tokens.admin))).status, 404);
  });

  it('Delete selected removes several Staff accounts and skips anything that is not Staff', async () => {
    const one1 = await createUser({ name: 'Bulk Del One', email: 'bulk.del1@test.lk', role: 'Staff', permissions: noAccess });
    const one2 = await createUser({ name: 'Bulk Del Two', email: 'bulk.del2@test.lk', role: 'Staff' });
    const adminRow = await one("SELECT user_id FROM users WHERE email = 'admin@test.lk'");

    const response = await api().post('/api/v1/users/bulk-delete').set(auth(tokens.admin)).send({ userIds: [one1.userId, one2.userId, adminRow.user_id, 99999999] });
    assert.equal(response.status, 200, response.body.message);
    assert.deepEqual(response.body.data.deleted.map((item) => item.userId).sort(), [one1.userId, one2.userId].sort());
    assert.deepEqual(response.body.data.skipped.map((item) => item.reason).sort(), ['not found', 'only Staff accounts can be permanently deleted']);
    assert.equal(Number((await one('SELECT COUNT(*) AS n FROM users WHERE user_id IN (?, ?)', [one1.userId, one2.userId])).n), 0);
    assert.ok(await one('SELECT user_id FROM users WHERE user_id = ?', [adminRow.user_id]), 'Admin kept');
    assert.equal((await api().post('/api/v1/users/bulk-delete').set(auth(tokens.admin)).send({ userIds: [] })).status, 422);
  });
});
