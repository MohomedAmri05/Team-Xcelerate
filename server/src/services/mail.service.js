import nodemailer
  from 'nodemailer';

function createPreview(message) {
  const preview = {
    to: message.to,
    subject: message.subject,

    text: String(
      message.text || ''
    ).slice(0, 240)
  };

  console.info(
    '[mail preview]',
    preview
  );

  return {
    delivered: false,
    preview: true,
    message: preview
  };
}

function smtpIsConfigured() {
  return Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );
}

function createTransporter() {
  const port = Number(
    process.env.SMTP_PORT || 587
  );

  return nodemailer.createTransport({
    host:
      process.env.SMTP_HOST,

    port,

    secure:
      process.env.SMTP_SECURE ===
        'true' ||
      port === 465,

    auth: {
      user:
        process.env.SMTP_USER,

      pass:
        process.env.SMTP_PASS
    }
  });
}

export async function sendMail(
  message
) {
  /*
   * When SMTP is not configured, development
   * continues using a terminal preview.
   */
  if (!smtpIsConfigured()) {
    return createPreview(
      message
    );
  }

  try {
    const transporter =
      createTransporter();

    const result =
      await transporter.sendMail({
        from:
          process.env.MAIL_FROM ||
          process.env.SMTP_USER,

        ...message
      });

    return {
      delivered: true,
      preview: false,

      messageId:
        result.messageId
    };
  } catch (error) {
    console.error(
      '[mail delivery failed]',
      {
        code:
          error.code || null,

        responseCode:
          error.responseCode ||
          null,

        message:
          error.message
      }
    );

    /*
     * During development, an unavailable SMTP
     * service must not break application CRUD.
     */
    if (
      process.env.NODE_ENV !==
      'production'
    ) {
      return createPreview(
        message
      );
    }

    /*
     * Production reports an email-service
     * failure instead of a generic 500 error.
     */
    throw Object.assign(
      new Error(
        'Email could not be delivered. Please try again later.'
      ),
      {
        status: 502,
        code:
          'MAIL_DELIVERY_FAILED'
      }
    );
  }
}