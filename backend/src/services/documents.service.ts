import crypto from 'node:crypto';
import multer from 'multer';
import { env } from '../config/env.js';
import { badRequest } from '../utils/errors.js';
import { putObject, getObject } from './storage.service.js';

/**
 * Secure upload handling:
 *  - files are held in memory, checked, and only then written to storage under
 *    a random key (no user-controlled paths, nothing persisted until valid)
 *  - only an allow-list of document/image types is accepted, verified by magic bytes
 *  - size is capped by UPLOAD_MAX_MB
 *  - downloads go through authorised API routes only
 */

const ALLOWED: Record<string, { ext: string; magic: (b: Buffer) => boolean }> = {
  'application/pdf': { ext: '.pdf', magic: (b) => b.subarray(0, 5).toString() === '%PDF-' },
  'image/png': { ext: '.png', magic: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  'image/jpeg': { ext: '.jpg', magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/webp': { ext: '.webp', magic: (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP' },
};

export const upload = multer({
  // Buffered, not spooled to disk: UPLOAD_MAX_MB caps each file well below any
  // memory concern, and it keeps the driver choice out of multer's hands.
  storage: multer.memoryStorage(),
  limits: { fileSize: env.UPLOAD_MAX_MB * 1024 * 1024, files: 1, fields: 10 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED[file.mimetype]) return cb(badRequest('Only PDF, PNG, JPEG or WebP files are accepted', 'UNSUPPORTED_FILE_TYPE'));
    cb(null, true);
  },
});

/** Confirms the bytes match the declared type, then stores them. */
export async function verifyUploadedFile(file: Express.Multer.File) {
  const rule = ALLOWED[file.mimetype];
  const buf = file.buffer;
  if (!rule || !rule.magic(buf)) throw badRequest('File content does not match its type', 'FILE_TYPE_MISMATCH');

  const storageKey = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}${rule.ext}`;
  await putObject(storageKey, buf, file.mimetype);
  return {
    storageKey,
    checksum: crypto.createHash('sha256').update(buf).digest('hex'),
    size: buf.length,
  };
}

/** Resolves to a readable stream, or null when the file is no longer available. */
export function openStoredFile(storageKey: string) {
  return getObject(storageKey);
}

export function safeFilename(name: string) {
  return name.replace(/[^\w.\- ]+/g, '_').slice(0, 120) || 'document';
}
