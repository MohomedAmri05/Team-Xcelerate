import nodemailer from 'nodemailer';
import { z } from 'zod';
import { Op } from 'sequelize';

import { EmailLog } from '../models/index.js';

/*
|--------------------------------------------------------------------------
| Email Service
|--------------------------------------------------------------------------
|
| Every outbound message is recorded in `email_logs` with one of these
| delivery states:
|
|   Queued    stored and waiting for the background sender
|   Sending   an SMTP attempt is in progress
|   Accepted  the SMTP server accepted the message (this is the strongest
|             confirmation SMTP provides; final inbox delivery cannot be
|             observed from the application)
|   Failed    the attempt failed; it is retried automatically until
|             `max_attempts` is reached
|   Preview   SMTP is not configured, so the message was NOT sent. The
|             content is printed to the server terminal for development.
|
| `message_key` is unique, so the same notification is never sent twice
| (for example after a double-click or a retried HTTP request).
|
| Credentials are read from environment variables only. Passwords are never
| logged. The message body is kept only while a retry may still be needed
| and is cleared once the message has been accepted.
|
*/

const emailSchema = z.string().trim().toLowerCase().email().max(150);

const RETRY_DELAYS_MINUTES = [1, 5, 15, 60];

let transporter = null;
let transporterSignature = null;
let workerTimer = null;

export function isValidEmail(value) {
  return emailSchema.safeParse(value).success;
}

export function smtpIsConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) ||
    Boolean(process.env.SMTP_HOST && process.env.SMTP_ALLOW_NO_AUTH === 'true');
}

function parseAddress(value) {
  if (!value) {
    return null;
  }

  const match = String(value).match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);

  if (match) {
    return {
      name: match[1].trim() || null,
      address: match[2].trim()
    };
  }

  return {
    name: null,
    address: String(value).trim()
  };
}

/**
 * Sender identity. MAIL_FROM_NAME + MAIL_FROM_ADDRESS take priority; the
 * older MAIL_FROM ("Name <address>") and SMTP_USER are still supported.
 */
export function getSender() {
  const legacy = parseAddress(process.env.MAIL_FROM);

  const address =
    process.env.MAIL_FROM_ADDRESS ||
    legacy?.address ||
    process.env.SMTP_USER ||
    'no-reply@highstreet.lk';

  const name =
    process.env.MAIL_FROM_NAME ||
    legacy?.name ||
    'High Street';

  return {
    name,
    address
  };
}

/**
 * Monitored mailbox that receives customer replies.
 */
export function getReplyTo() {
  return (
    process.env.MAIL_REPLY_TO ||
    process.env.ADMIN_NOTIFICATION_EMAIL ||
    getSender().address
  );
}

export function getAdminRecipient() {
  const value = process.env.ADMIN_NOTIFICATION_EMAIL;

  return value && isValidEmail(value) ? value.trim() : null;
}

export function getMailConfigurationSummary() {
  const sender = getSender();

  return {
    smtpConfigured: smtpIsConfigured(),
    host: process.env.SMTP_HOST || null,
    port: Number(process.env.SMTP_PORT || 587),
    secure: isSecure(),
    fromName: sender.name,
    fromAddress: sender.address,
    replyTo: getReplyTo(),
    adminNotificationEmail: getAdminRecipient(),
    inboundWebhookEnabled: Boolean(process.env.INBOUND_EMAIL_SECRET)
  };
}

function isSecure() {
  const port = Number(process.env.SMTP_PORT || 587);

  return process.env.SMTP_SECURE === 'true' || port === 465;
}

function getTransporter() {
  const signature = [
    process.env.SMTP_HOST,
    process.env.SMTP_PORT,
    process.env.SMTP_USER,
    process.env.SMTP_SECURE
  ].join('|');

  if (transporter && signature === transporterSignature) {
    return transporter;
  }

  const port = Number(process.env.SMTP_PORT || 587);

  const auth =
    process.env.SMTP_USER && process.env.SMTP_PASS
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      : undefined;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: isSecure(),
    auth,
    requireTLS: process.env.SMTP_REQUIRE_TLS === 'true',
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    tls:
      process.env.SMTP_TLS_REJECT_UNAUTHORIZED === 'false'
        ? { rejectUnauthorized: false }
        : undefined
  });

  transporterSignature = signature;

  return transporter;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Converts plain text into a simple branded HTML version. All content is
 * escaped, so customer-supplied text cannot inject markup.
 */
export function renderHtml(text, heading = null) {
  const paragraphs = String(text || '')
    .split(/\n{2,}/)
    .map((block) => `<p style="margin:0 0 14px">${escapeHtml(block).replaceAll('\n', '<br>')}</p>`)
    .join('');

  return [
    '<div style="background:#f4f1ea;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#1d232b">',
    '<div style="max-width:620px;margin:auto;background:#ffffff;border-top:4px solid #c9a15b;padding:28px">',
    '<p style="margin:0 0 4px;font-size:12px;letter-spacing:2px;color:#8a6a35;font-weight:bold">HIGH STREET (PVT) LTD.</p>',
    heading ? `<h2 style="margin:0 0 18px;font-size:20px">${escapeHtml(heading)}</h2>` : '',
    paragraphs,
    '<hr style="border:0;border-top:1px solid #e6e1d6;margin:22px 0">',
    '<p style="margin:0;font-size:12px;color:#6b7280">High Street (PVT) Ltd. · Katugastota, Kandy, Sri Lanka</p>',
    '</div></div>'
  ].join('');
}

function trimError(error) {
  const parts = [error?.code, error?.responseCode, error?.message].filter(Boolean);

  return parts.join(' ').slice(0, 480) || 'Unknown email error';
}

function buildMailOptions(payload) {
  const sender = getSender();

  return {
    from: {
      name: sender.name,
      address: sender.address
    },
    to: payload.to,
    replyTo: payload.replyTo || getReplyTo(),
    subject: payload.subject,
    text: payload.text,
    html: payload.html || renderHtml(payload.text, payload.heading),
    headers: payload.messageKey
      ? {
          'X-High-Street-Message-Key': payload.messageKey
        }
      : undefined
  };
}

function printPreview(payload) {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  console.info('[mail preview — SMTP not configured, message NOT sent]', {
    to: payload.to,
    replyTo: payload.replyTo || getReplyTo(),
    subject: payload.subject,
    text: String(payload.text || '').slice(0, 240)
  });
}

function resultFromLog(log, extra = {}) {
  return {
    emailId: log.emailId,
    status: log.status,
    delivered: log.status === 'Accepted',
    preview: log.status === 'Preview',
    attempts: log.attempts,
    error: log.status === 'Failed' ? log.lastError : null,
    ...extra
  };
}

/**
 * Performs one SMTP attempt for an email_logs row.
 */
async function attemptDelivery(log, payload) {
  if (!smtpIsConfigured()) {
    printPreview(payload);

    await log.update({
      status: 'Preview',
      lastError: 'SMTP is not configured. The message was not sent.',
      nextAttemptAt: null
    });

    return resultFromLog(log);
  }

  await log.update({
    status: 'Sending',
    attempts: log.attempts + 1
  });

  try {
    const info = await getTransporter().sendMail(buildMailOptions(payload));

    const accepted = Array.isArray(info.accepted) ? info.accepted : [];
    const rejected = Array.isArray(info.rejected) ? info.rejected : [];

    if (!accepted.length && rejected.length) {
      throw Object.assign(new Error('The SMTP server rejected the recipient'), {
        code: 'EENVELOPE'
      });
    }

    await log.update({
      status: 'Accepted',
      acceptedAt: new Date(),
      providerMessageId: info.messageId || null,
      lastError: null,
      nextAttemptAt: null,
      payload: null
    });

    return resultFromLog(log, {
      messageId: info.messageId || null
    });
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('[mail delivery failed]', {
        emailId: log.emailId,
        code: error.code || null,
        responseCode: error.responseCode || null,
        message: error.message
      });
    }

    const canRetry = log.attempts < log.maxAttempts;

    const delayMinutes =
      RETRY_DELAYS_MINUTES[Math.min(log.attempts - 1, RETRY_DELAYS_MINUTES.length - 1)];

    await log.update({
      status: 'Failed',
      lastError: trimError(error),
      nextAttemptAt: canRetry ? new Date(Date.now() + delayMinutes * 60000) : null
    });

    return resultFromLog(log);
  }
}

function normalisePayload(message) {
  const recipient = emailSchema.safeParse(message.to);

  if (!recipient.success) {
    throw Object.assign(new Error('A valid recipient email address is required'), {
      status: 422
    });
  }

  if (message.replyTo && !isValidEmail(message.replyTo)) {
    throw Object.assign(new Error('The reply-to address is not valid'), {
      status: 422
    });
  }

  const subject = String(message.subject || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 250);

  if (!subject) {
    throw Object.assign(new Error('An email subject is required'), {
      status: 422
    });
  }

  return {
    to: recipient.data,
    replyTo: message.replyTo || null,
    subject,
    text: String(message.text || ''),
    html: message.html || null,
    heading: message.heading || null
  };
}

async function findOrCreateLog(payload, meta, status) {
  const messageKey = String(
    meta.messageKey ||
      `${meta.template || 'message'}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  ).slice(0, 190);

  const existing = await EmailLog.unscoped().findOne({
    where: {
      messageKey
    }
  });

  if (existing) {
    return {
      log: existing,
      duplicate: true
    };
  }

  try {
    const log = await EmailLog.unscoped().create({
      messageKey,
      recipient: payload.to,
      replyTo: payload.replyTo || getReplyTo(),
      subject: payload.subject,
      template: meta.template || 'general',
      relatedType: meta.relatedType || null,
      relatedId: meta.relatedId || null,
      status,
      maxAttempts: meta.maxAttempts || 3,
      payload: JSON.stringify({
        ...payload,
        messageKey
      }),
      createdBy: meta.createdBy || null
    });

    return {
      log,
      duplicate: false
    };
  } catch (error) {
    // A concurrent request created the same message key first.
    if (error.name === 'SequelizeUniqueConstraintError') {
      const log = await EmailLog.unscoped().findOne({
        where: {
          messageKey
        }
      });

      return {
        log,
        duplicate: true
      };
    }

    throw error;
  }
}

function readPayload(log) {
  try {
    return log.payload ? JSON.parse(log.payload) : null;
  } catch {
    return null;
  }
}

/**
 * Sends immediately and waits for the SMTP result. Used when the caller
 * must know the outcome (for example an enquiry response is only marked
 * Sent after the SMTP server accepts it).
 *
 * @param message { to, subject, text, html?, replyTo?, heading? }
 * @param meta    { messageKey?, template?, relatedType?, relatedId?, createdBy? }
 */
export async function sendMail(message, meta = {}) {
  const payload = normalisePayload(message);
  const { log, duplicate } = await findOrCreateLog(payload, meta, 'Sending');

  if (duplicate) {
    if (log.status === 'Accepted' || log.status === 'Sending' || log.status === 'Queued') {
      return resultFromLog(log, {
        duplicate: true
      });
    }

    // A previous Failed / Preview attempt may be retried with fresh content.
    await log.update({
      subject: payload.subject,
      recipient: payload.to,
      payload: JSON.stringify({
        ...payload,
        messageKey: log.messageKey
      }),
      attempts: log.status === 'Preview' ? 0 : log.attempts,
      maxAttempts: Math.max(log.maxAttempts, log.attempts + 1)
    });
  }

  return attemptDelivery(log, {
    ...payload,
    messageKey: log.messageKey
  });
}

/**
 * Stores the message and sends it in the background so the HTTP request
 * is not delayed by SMTP. Returns the stored log entry immediately.
 * In the test environment the send is awaited so results are deterministic.
 */
export async function queueMail(message, meta = {}) {
  let payload;

  try {
    payload = normalisePayload(message);
  } catch (error) {
    return {
      status: 'Failed',
      delivered: false,
      preview: false,
      error: error.message
    };
  }

  const { log, duplicate } = await findOrCreateLog(payload, meta, 'Queued');

  if (duplicate) {
    return resultFromLog(log, {
      duplicate: true
    });
  }

  if (process.env.NODE_ENV === 'test' || process.env.MAIL_SEND_SYNC === 'true') {
    return attemptDelivery(log, readPayload(log));
  }

  setImmediate(() => {
    attemptDelivery(log, readPayload(log)).catch((error) => {
      console.error('[mail queue error]', error.message);
    });
  });

  return resultFromLog(log);
}

/**
 * Manually retries one stored message (Admin action).
 */
export async function retryEmail(emailId) {
  const log = await EmailLog.unscoped().findByPk(emailId);

  if (!log) {
    throw Object.assign(new Error('Email record not found'), {
      status: 404
    });
  }

  if (log.status === 'Accepted') {
    throw Object.assign(new Error('This email has already been accepted by the mail server'), {
      status: 409
    });
  }

  if (log.status === 'Sending') {
    throw Object.assign(new Error('This email is currently being sent'), {
      status: 409
    });
  }

  const payload = readPayload(log);

  if (!payload) {
    throw Object.assign(new Error('The message content is no longer stored, so it cannot be resent'), {
      status: 422
    });
  }

  await log.update({
    maxAttempts: Math.max(log.maxAttempts, log.attempts + 1),
    attempts: log.status === 'Preview' ? 0 : log.attempts
  });

  return attemptDelivery(log, payload);
}

/**
 * Background retry loop: resends Failed messages whose retry time has
 * arrived and recovers Queued messages left behind by a restart.
 */
export async function processEmailQueue() {
  const now = new Date();

  const due = await EmailLog.unscoped().findAll({
    where: {
      [Op.or]: [
        {
          status: 'Failed',
          nextAttemptAt: {
            [Op.ne]: null,
            [Op.lte]: now
          }
        },
        {
          status: 'Queued',
          createdAt: {
            [Op.lte]: new Date(now.getTime() - 60000)
          }
        },
        {
          status: 'Sending',
          updatedAt: {
            [Op.lte]: new Date(now.getTime() - 10 * 60000)
          }
        }
      ]
    },
    order: [['createdAt', 'ASC']],
    limit: 20
  });

  const results = [];

  for (const log of due) {
    if (log.attempts >= log.maxAttempts && log.status !== 'Queued') {
      await log.update({
        status: 'Failed',
        nextAttemptAt: null
      });
      continue;
    }

    const payload = readPayload(log);

    if (!payload) {
      await log.update({
        status: 'Failed',
        nextAttemptAt: null,
        lastError: 'Message content unavailable for retry'
      });
      continue;
    }

    results.push(await attemptDelivery(log, payload));
  }

  return results;
}

export function startEmailWorker(intervalMs = 60000) {
  if (workerTimer) {
    return;
  }

  workerTimer = setInterval(() => {
    processEmailQueue().catch((error) => {
      console.error('[mail worker]', error.message);
    });
  }, intervalMs);

  workerTimer.unref?.();
}

export function stopEmailWorker() {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
  }
}

/**
 * Verifies the SMTP connection and credentials without sending a message.
 */
export async function verifySmtpConnection() {
  if (!smtpIsConfigured()) {
    return {
      ok: false,
      message: 'SMTP is not configured'
    };
  }

  try {
    await getTransporter().verify();

    return {
      ok: true,
      message: 'The SMTP server accepted the connection and credentials'
    };
  } catch (error) {
    return {
      ok: false,
      message: trimError(error)
    };
  }
}

/*
|--------------------------------------------------------------------------
| Reference tags used for reply threading
|--------------------------------------------------------------------------
*/

export const enquiryTag = (enquiryId) => `[HS-ENQ-${enquiryId}]`;

export function withTag(subject, tag) {
  return subject.includes(tag) ? subject : `${subject} ${tag}`;
}
