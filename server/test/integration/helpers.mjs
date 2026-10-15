/*
|--------------------------------------------------------------------------
| Integration test helpers
|--------------------------------------------------------------------------
|
| - Points the API at the dedicated test database (<DB_NAME>_test) and
|   recreates it from the migrations, so tests never touch real data.
| - Starts a local SMTP server that records every message, so email
|   recipients, sender, Reply-To and failure handling can be verified
|   without sending real email.
|
*/

import net from 'net';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const here = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_DIR = path.resolve(here, '../..');
const require = createRequire(path.join(SERVER_DIR, 'package.json'));

/*
| Local SMTP test server
*/

export function startSmtpServer() {
  const messages = [];
  const state = {
    rejectRecipients: /bounce|reject/i,
    failAll: false
  };

  const server = net.createServer((socket) => {
    let buffer = '';
    let inData = false;
    let current = { from: null, to: [], data: '' };

    socket.write('220 localhost High-Street-Test-SMTP\r\n');

    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');

      while (true) {
        if (inData) {
          const end = buffer.indexOf('\r\n.\r\n');

          if (end === -1) {
            return;
          }

          current.data = buffer.slice(0, end);
          buffer = buffer.slice(end + 5);
          inData = false;
          messages.push(parseMessage(current));
          current = { from: null, to: [], data: '' };
          socket.write(`250 OK queued as test-${messages.length}\r\n`);
          continue;
        }

        const lineEnd = buffer.indexOf('\r\n');

        if (lineEnd === -1) {
          return;
        }

        const line = buffer.slice(0, lineEnd);
        buffer = buffer.slice(lineEnd + 2);
        const command = line.slice(0, 4).toUpperCase();

        if (command === 'EHLO') {
          socket.write('250-localhost\r\n250-8BITMIME\r\n250 SMTPUTF8\r\n');
        } else if (command === 'HELO') {
          socket.write('250 localhost\r\n');
        } else if (command === 'MAIL') {
          if (state.failAll) {
            socket.write('451 4.3.0 Temporary test failure\r\n');
          } else {
            current.from = (line.match(/<([^>]*)>/) || [])[1];
            socket.write('250 OK\r\n');
          }
        } else if (command === 'RCPT') {
          const address = (line.match(/<([^>]*)>/) || [])[1] || '';

          if (state.rejectRecipients.test(address)) {
            socket.write('550 5.1.1 Mailbox unavailable\r\n');
          } else {
            current.to.push(address);
            socket.write('250 OK\r\n');
          }
        } else if (command === 'DATA') {
          inData = true;
          socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');
        } else if (command === 'RSET') {
          current = { from: null, to: [], data: '' };
          socket.write('250 OK\r\n');
        } else if (command === 'QUIT') {
          socket.end('221 Bye\r\n');
          return;
        } else if (command === 'NOOP') {
          socket.write('250 OK\r\n');
        } else {
          socket.write('502 Command not implemented\r\n');
        }
      }
    });

    socket.on('error', () => {});
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({
        port: server.address().port,
        messages,
        state,
        close: () => new Promise((done) => server.close(done)),
        find: (predicate) => messages.filter(predicate)
      });
    });
  });
}

function decodeHeader(value = '') {
  return value.replace(/=\?utf-8\?([BQ])\?([^?]*)\?=/gi, (match, encoding, text) =>
    encoding.toUpperCase() === 'B'
      ? Buffer.from(text, 'base64').toString('utf8')
      : text.replace(/_/g, ' ').replace(/=([0-9A-F]{2})/gi, (m, hex) => String.fromCharCode(parseInt(hex, 16)))
  );
}

function parseMessage({ from, to, data }) {
  const [rawHeaders] = data.split(/\r\n\r\n/);
  const headers = {};

  rawHeaders
    .replace(/\r\n[ \t]+/g, ' ')
    .split('\r\n')
    .forEach((line) => {
      const index = line.indexOf(':');

      if (index > 0) {
        headers[line.slice(0, index).toLowerCase()] = decodeHeader(line.slice(index + 1).trim());
      }
    });

  return {
    envelopeFrom: from,
    envelopeTo: to,
    headers,
    subject: headers.subject || '',
    raw: data
  };
}

/*
| Test database
*/

export function prepareEnvironment(smtpPort) {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DB_HOST: process.env.TEST_DB_HOST || process.env.DB_HOST || '127.0.0.1',
    DB_PORT: process.env.TEST_DB_PORT || process.env.DB_PORT || '3306',
    DB_USER: process.env.TEST_DB_USER || process.env.DB_USER || 'root',
    DB_PASSWORD: process.env.TEST_DB_PASSWORD ?? process.env.DB_PASSWORD ?? '',
    DB_NAME: process.env.TEST_DB_BASE_NAME || 'high_street_db',
    JWT_ACCESS_SECRET: 'integration-access-secret-0123456789',
    JWT_REFRESH_SECRET: 'integration-refresh-secret-0123456789',
    ACCESS_TOKEN_TTL: '15m',
    REFRESH_TOKEN_DAYS: '7',
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: String(smtpPort),
    SMTP_SECURE: 'false',
    SMTP_USER: '',
    SMTP_PASS: '',
    SMTP_ALLOW_NO_AUTH: 'true',
    MAIL_FROM_NAME: 'High Street Test',
    MAIL_FROM_ADDRESS: 'no-reply@highstreet.test',
    MAIL_REPLY_TO: 'support@highstreet.test',
    ADMIN_NOTIFICATION_EMAIL: 'admin-inbox@highstreet.test',
    INBOUND_EMAIL_SECRET: '',
    CLIENT_URL: 'http://localhost:5173',
    DOCUMENT_STORAGE_DIR: path.join(SERVER_DIR, 'storage', 'test-documents'),
    MAX_DOCUMENT_MB: '2'
  });
}

export async function resetTestDatabase() {
  const mysql = require('mysql2/promise');
  const database = `${process.env.DB_NAME}_test`;

  if (!database.endsWith('_test')) {
    throw new Error('Refusing to reset a non-test database');
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || undefined
  });

  await connection.query(`DROP DATABASE IF EXISTS \`${database}\``);
  await connection.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await connection.end();

  execFileSync(process.execPath, [require.resolve('sequelize-cli/lib/sequelize'), 'db:migrate'], {
    cwd: SERVER_DIR,
    env: process.env,
    stdio: 'pipe'
  });

  return database;
}

export async function rawQuery(sql, params = []) {
  const mysql = require('mysql2/promise');
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || undefined,
    database: `${process.env.DB_NAME}_test`
  });

  try {
    const [rows] = await connection.query(sql, params);
    return rows;
  } finally {
    await connection.end();
  }
}

/*
| Small valid files (built in memory)
*/

export const files = {
  pdf: Buffer.from(
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 100 100]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n'
  ),
  png: Buffer.from(
    '89504e470d0a1a0a0000000d4948445200000001000000010806000000' +
      '1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082',
    'hex'
  ),
  exe: Buffer.from('MZ\x90\x00\x03\x00\x00\x00 not really a pdf'),
  html: Buffer.from('<html><script>alert(1)</script></html>')
};
