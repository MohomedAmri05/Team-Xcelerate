import crypto from 'crypto';
import { Op } from 'sequelize';

import {
  Complaint,
  ComplaintMessage,
  ComplaintStatusHistory,
  EmailLog,
  Enquiry,
  InboundEmail,
  User,
  sequelize
} from '../models/index.js';

import { EMAIL_STATUSES } from '../models/extended.js';
import { ok } from '../middleware/core.js';
import { logActivity } from '../services/activity.service.js';
import {
  getAdminRecipient,
  getMailConfigurationSummary,
  isValidEmail,
  processEmailQueue,
  queueMail,
  retryEmail,
  sendMail,
  verifySmtpConnection
} from '../services/mail.service.js';

const httpError = (status, message) => Object.assign(new Error(message), { status });

function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, (character) => `\\${character}`);
}

/*
|--------------------------------------------------------------------------
| Outbox (Admin)
|--------------------------------------------------------------------------
*/

export async function listEmails(req, res) {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
  const where = {};

  if (EMAIL_STATUSES.includes(req.query.status)) {
    where.status = req.query.status;
  }

  if (req.query.template) {
    where.template = String(req.query.template).slice(0, 60);
  }

  if (req.query.search) {
    const term = `%${escapeLike(String(req.query.search).trim().slice(0, 100))}%`;
    where[Op.or] = [{ recipient: { [Op.like]: term } }, { subject: { [Op.like]: term } }];
  }

  const result = await EmailLog.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    limit,
    offset: (page - 1) * limit
  });

  const counts = await EmailLog.findAll({
    attributes: ['status', [sequelize.fn('COUNT', sequelize.col('email_id')), 'total']],
    group: ['status'],
    raw: true
  });

  return ok(res, 'Email log retrieved', result.rows, {
    page,
    limit,
    total: result.count,
    pages: Math.ceil(result.count / limit),
    statusCounts: Object.fromEntries(counts.map((row) => [row.status, Number(row.total)])),
    configuration: getMailConfigurationSummary()
  });
}

export async function retry(req, res) {
  const result = await retryEmail(Number(req.params.id));

  await logActivity(req, 'email.retried', 'Email', Number(req.params.id), `Email #${req.params.id} retried: ${result.status}`);

  const messages = {
    Accepted: 'The mail server accepted the email',
    Failed: `Sending failed: ${result.error || 'unknown error'}`,
    Preview: 'SMTP is not configured, so the email was not sent'
  };

  return res.status(result.status === 'Accepted' ? 200 : 502).json({
    success: result.status === 'Accepted',
    message: messages[result.status] || `Email status: ${result.status}`,
    data: result,
    meta: {}
  });
}

export async function processQueueNow(req, res) {
  const results = await processEmailQueue();

  return ok(res, `${results.length} queued email(s) processed`, results);
}

export async function configuration(req, res) {
  return ok(res, 'Email configuration retrieved', getMailConfigurationSummary());
}

export async function verify(req, res) {
  const result = await verifySmtpConnection();

  return res.status(result.ok ? 200 : 502).json({
    success: result.ok,
    message: result.message,
    data: result,
    meta: {}
  });
}

/**
 * Sends a test message. To prevent the endpoint being used to email
 * arbitrary people, the recipient must be the signed-in Admin's own address
 * or the configured admin notification mailbox.
 */
export async function sendTest(req, res) {
  const allowed = [req.user.email, getAdminRecipient()].filter(Boolean).map((value) => value.toLowerCase());
  const recipient = String(req.body?.to || req.user.email).trim().toLowerCase();

  if (!isValidEmail(recipient)) {
    throw httpError(422, 'Enter a valid email address');
  }

  if (!allowed.includes(recipient)) {
    throw httpError(403, 'Test emails can only be sent to your own address or the admin notification mailbox');
  }

  const result = await sendMail(
    {
      to: recipient,
      subject: 'High Street email configuration test',
      heading: 'Email configuration test',
      text: [
        'This is a test message from the High Street dashboard.',
        `Sent at ${new Date().toLocaleString('en-LK')} by ${req.user.name}.`,
        'If you can read this, outgoing email is working. Replying to this message should reach the configured reply-to mailbox.'
      ].join('\n\n')
    },
    {
      template: 'smtp-test',
      createdBy: req.user.userId
    }
  );

  return res.status(result.delivered ? 200 : 502).json({
    success: result.delivered,
    message: result.delivered
      ? `Test email accepted by the mail server for ${recipient}`
      : result.preview
        ? 'SMTP is not configured, so the test email was not sent'
        : `Test email failed: ${result.error || 'unknown error'}`,
    data: result,
    meta: {}
  });
}

/*
|--------------------------------------------------------------------------
| Inbound replies
|--------------------------------------------------------------------------
|
| POST /api/v1/inbound/email
|
| Intended to be called by an email provider's inbound-parse webhook
| (SendGrid Inbound Parse, Mailgun Routes, Postmark Inbound, Cloudflare
| Email Workers, etc.). The request must carry the shared secret from
| INBOUND_EMAIL_SECRET in the "X-Inbound-Secret" header (or ?secret=).
|
| Replies are matched using the reference tag in the subject:
|   [HS-CMP-2026-00012]  → complaint conversation
|   [HS-ENQ-45]          → enquiry
| and the sender must be the customer who owns that record.
|
*/

function secretMatches(provided) {
  const expected = process.env.INBOUND_EMAIL_SECRET || '';

  if (!expected || !provided) {
    return false;
  }

  const a = Buffer.from(String(provided));
  const b = Buffer.from(expected);

  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function extractAddress(value) {
  const text = String(value || '');
  const match = text.match(/<([^>]+)>/);

  return (match ? match[1] : text).trim().toLowerCase();
}

/**
 * Removes quoted history so only the new reply is stored.
 */
export function stripQuotedReply(text) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const kept = [];

  for (const line of lines) {
    if (/^On .+wrote:\s*$/i.test(line.trim()) || /^-{2,}\s*Original Message\s*-{2,}/i.test(line.trim()) || /^From: .+/i.test(line.trim())) {
      break;
    }

    if (/^>/.test(line.trim())) {
      continue;
    }

    kept.push(line);
  }

  return kept.join('\n').trim();
}

export async function receiveInbound(req, res) {
  if (!process.env.INBOUND_EMAIL_SECRET) {
    throw httpError(503, 'Inbound email is not configured on this server');
  }

  if (!secretMatches(req.get('x-inbound-secret') || req.query.secret)) {
    throw httpError(401, 'Invalid inbound email secret');
  }

  const body = req.body || {};
  const from = extractAddress(body.from || body.sender || body.From || body.envelope?.from);
  const subject = String(body.subject || body.Subject || '').trim().slice(0, 250);
  const text = String(body['stripped-text'] || body.text || body['body-plain'] || body.TextBody || body.plain || '').slice(0, 20000);
  const providerMessageId =
    String(body.messageId || body['Message-Id'] || body['message-id'] || body.MessageID || '').trim().slice(0, 250) || null;

  if (!isValidEmail(from) || !subject) {
    throw httpError(422, 'A valid sender address and subject are required');
  }

  if (providerMessageId) {
    const existing = await InboundEmail.findOne({ where: { providerMessageId } });

    if (existing) {
      return ok(res, 'Duplicate message ignored', { inboundId: existing.inboundId, status: existing.status, duplicate: true });
    }
  }

  const reply = stripQuotedReply(text) || text.trim() || '(empty message)';
  const complaintMatch = subject.match(/\[(HS-CMP-\d{4}-\d{5})\]/i);
  const enquiryMatch = subject.match(/\[HS-ENQ-(\d+)\]/i);

  let status = 'Unmatched';
  let complaintId = null;
  let enquiryId = null;
  let complaintMessageId = null;

  await sequelize.transaction(async (transaction) => {
    if (complaintMatch) {
      const complaint = await Complaint.findOne({
        where: { reference: complaintMatch[1].toUpperCase() },
        include: [{ model: User, as: 'customer', attributes: ['userId', 'email'] }],
        transaction
      });

      if (complaint && complaint.customer?.email?.toLowerCase() === from) {
        const message = await ComplaintMessage.create(
          {
            complaintId: complaint.complaintId,
            authorId: complaint.customer.userId,
            authorRole: 'Email',
            body: reply,
            isInternal: false,
            source: 'Email'
          },
          { transaction }
        );

        const changes = { lastActivityAt: new Date() };

        if (complaint.status === 'Resolved') {
          changes.status = 'In Progress';
          changes.resolvedAt = null;
          changes.reopenedCount = complaint.reopenedCount + 1;

          await ComplaintStatusHistory.create(
            {
              complaintId: complaint.complaintId,
              fromStatus: 'Resolved',
              toStatus: 'In Progress',
              changedBy: null,
              note: 'Customer replied by email after resolution'
            },
            { transaction }
          );
        }

        await complaint.update(changes, { transaction });

        status = 'Matched';
        complaintId = complaint.complaintId;
        complaintMessageId = message.messageId;
      } else if (complaint) {
        status = 'Rejected';
        complaintId = complaint.complaintId;
      }
    } else if (enquiryMatch) {
      const enquiry = await Enquiry.findByPk(Number(enquiryMatch[1]), { transaction });

      if (enquiry && enquiry.customerEmail.toLowerCase() === from) {
        status = 'Matched';
        enquiryId = enquiry.enquiryId;

        if (enquiry.status === 'Responded') {
          await enquiry.update({ status: 'In Progress' }, { transaction });
        }
      } else if (enquiry) {
        status = 'Rejected';
        enquiryId = enquiry.enquiryId;
      }
    }
  });

  const inbound = await InboundEmail.create({
    providerMessageId,
    fromAddress: from,
    subject,
    body: reply,
    status,
    complaintId,
    enquiryId,
    complaintMessageId
  });

  await logActivity(
    { user: null, ip: req.ip },
    'email.inbound',
    'Email',
    inbound.inboundId,
    `Inbound reply from ${from}: ${status}${complaintMatch ? ` (${complaintMatch[1]})` : enquiryMatch ? ` (enquiry #${enquiryMatch[1]})` : ''}`
  );

  if (status === 'Matched' && getAdminRecipient()) {
    await queueMail(
      {
        to: getAdminRecipient(),
        subject: `Customer email reply: ${subject}`.slice(0, 250),
        text: `${from} replied by email:\n\n${reply}\n\nThe reply has been added to the record in the dashboard.`
      },
      {
        messageKey: `inbound-${inbound.inboundId}-notify`,
        template: 'inbound-notify',
        relatedType: complaintId ? 'Complaint' : 'Enquiry',
        relatedId: complaintId || enquiryId
      }
    );
  }

  return res.status(201).json({
    success: true,
    message: `Inbound email ${status.toLowerCase()}`,
    data: {
      inboundId: inbound.inboundId,
      status
    },
    meta: {}
  });
}

export async function listInbound(req, res) {
  const where = {};

  if (['Matched', 'Unmatched', 'Rejected'].includes(req.query.status)) {
    where.status = req.query.status;
  }

  if (Number(req.query.enquiryId) > 0) {
    where.enquiryId = Number(req.query.enquiryId);
  }

  const items = await InboundEmail.findAll({
    where,
    include: [
      { model: Complaint, as: 'complaint', attributes: ['complaintId', 'reference'], required: false },
      { model: Enquiry, as: 'enquiry', attributes: ['enquiryId', 'vehicleReference'], required: false }
    ],
    order: [['receivedAt', 'DESC']],
    limit: Math.min(Number(req.query.limit) || 50, 200)
  });

  return ok(res, 'Inbound email retrieved', items, {
    configured: Boolean(process.env.INBOUND_EMAIL_SECRET)
  });
}
