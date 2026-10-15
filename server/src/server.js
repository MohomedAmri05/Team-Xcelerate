import fs from 'fs';

import { app } from './app.js';
import { sequelize } from './models/index.js';
import { DOCUMENT_STORAGE_DIR } from './services/file.service.js';
import { getMailConfigurationSummary, startEmailWorker } from './services/mail.service.js';

const port = process.env.PORT || 5000;

sequelize
  .authenticate()
  .then(() => {
    fs.mkdirSync(DOCUMENT_STORAGE_DIR, { recursive: true });

    app.listen(port, () => {
      const mail = getMailConfigurationSummary();

      console.log(`High Street API listening on ${port}`);
      console.log(
        mail.smtpConfigured
          ? `Email: SMTP ${mail.host}:${mail.port} as ${mail.fromAddress} (reply-to ${mail.replyTo})`
          : 'Email: SMTP not configured — messages are logged as Preview and NOT sent'
      );
    });

    // Retries failed emails and recovers queued ones after a restart.
    startEmailWorker();
  })
  .catch((error) => {
    console.error('Database connection failed:', error.message);
    process.exit(1);
  });
