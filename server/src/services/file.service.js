import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

/*
|--------------------------------------------------------------------------
| File Validation and Private Storage
|--------------------------------------------------------------------------
|
| Uploaded content is identified from its leading bytes ("magic numbers"),
| not from the filename or the browser-supplied MIME type. Only the types
| listed here are accepted, and the stored file name is always a random
| UUID with the extension of the detected type.
|
*/

export const DOCUMENT_STORAGE_DIR = path.resolve(
  process.env.DOCUMENT_STORAGE_DIR || 'storage/documents'
);

export const MAX_DOCUMENT_BYTES = Number(process.env.MAX_DOCUMENT_MB || 8) * 1024 * 1024;

export const DOCUMENT_TYPES = {
  pdf: { mime: 'application/pdf', label: 'PDF' },
  jpg: { mime: 'image/jpeg', label: 'JPEG image' },
  png: { mime: 'image/png', label: 'PNG image' },
  webp: { mime: 'image/webp', label: 'WebP image' },
  docx: {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    label: 'Word document'
  }
};

export const IMAGE_TYPES = ['jpg', 'png', 'webp'];

const startsWith = (buffer, bytes, offset = 0) =>
  buffer.length >= offset + bytes.length &&
  bytes.every((byte, index) => buffer[offset + index] === byte);

/**
 * Returns one of the keys of DOCUMENT_TYPES, or null when the content is
 * not an accepted type.
 */
export function detectFileType(buffer) {
  if (!buffer || buffer.length < 8) {
    return null;
  }

  if (startsWith(buffer, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return 'pdf';
  }

  if (startsWith(buffer, [0xff, 0xd8, 0xff])) {
    return 'jpg';
  }

  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'png';
  }

  if (
    startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(buffer, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return 'webp';
  }

  if (startsWith(buffer, [0x50, 0x4b, 0x03, 0x04])) {
    const head = buffer.subarray(0, Math.min(buffer.length, 200000)).toString('latin1');

    if (head.includes('[Content_Types].xml') && head.includes('word/')) {
      return 'docx';
    }
  }

  return null;
}

/**
 * Removes directory components, control characters and characters that
 * are unsafe in a Content-Disposition header.
 */
export function sanitizeFilename(name, fallbackExtension = '') {
  const base = path
    .basename(String(name || ''))
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/^\.+/, '')
    .trim()
    .slice(0, 200);

  if (base) {
    return base;
  }

  return `document${fallbackExtension ? `.${fallbackExtension}` : ''}`;
}

export function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

const STORAGE_KEY_PATTERN = /^[0-9a-f-]{36}\.(pdf|jpg|png|webp|docx)$/;

export function isSafeStorageKey(key) {
  return STORAGE_KEY_PATTERN.test(String(key || ''));
}

export function storagePath(key) {
  if (!isSafeStorageKey(key)) {
    throw Object.assign(new Error('Invalid storage key'), { status: 400 });
  }

  const resolved = path.resolve(DOCUMENT_STORAGE_DIR, key);

  if (!resolved.startsWith(DOCUMENT_STORAGE_DIR + path.sep)) {
    throw Object.assign(new Error('Invalid storage path'), { status: 400 });
  }

  return resolved;
}

export async function storeDocument(buffer, extension) {
  await fs.mkdir(DOCUMENT_STORAGE_DIR, { recursive: true });

  const storageKey = `${crypto.randomUUID()}.${extension}`;

  await fs.writeFile(storagePath(storageKey), buffer, {
    flag: 'wx',
    mode: 0o640
  });

  return storageKey;
}

export async function removeStoredDocument(storageKey) {
  try {
    await fs.unlink(storagePath(storageKey));
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

/**
 * Reads the first bytes of a file already written to disk by multer.
 */
export async function readFileHead(filePath, length = 64) {
  const handle = await fs.open(filePath, 'r');

  try {
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buffer, 0, length, 0);

    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}
