/**
 * Blob storage for uploaded documents: files under UPLOAD_DIR.
 *
 * Keys look like "2026-09/<uuid>.pdf" and are generated server-side — they
 * never contain user input. The guards here are defence in depth.
 */

import { createReadStream, existsSync, mkdirSync } from 'node:fs';
import { writeFile, unlink, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { env } from '../config/env.js';

export const UPLOAD_ROOT = path.resolve(env.UPLOAD_DIR);
mkdirSync(UPLOAD_ROOT, { recursive: true });

/** Keys are "<segment>/<segment>" with no traversal, no absolute paths. */
function assertSafeKey(key: string) {
  if (!/^[\w.-]+(\/[\w.-]+)*$/.test(key) || key.split('/').some((s) => s === '.' || s === '..')) {
    throw new Error(`Unsafe storage key: ${key}`);
  }
}

function localPath(key: string) {
  const full = path.resolve(UPLOAD_ROOT, key);
  // Second guard: resolve() must not have escaped the root.
  if (full !== UPLOAD_ROOT && !full.startsWith(UPLOAD_ROOT + path.sep)) throw new Error(`Unsafe storage key: ${key}`);
  return full;
}

export async function putObject(key: string, body: Buffer, _contentType: string) {
  assertSafeKey(key);
  const full = localPath(key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, body);
}

/** Resolves to a readable stream, or null when the object no longer exists. */
export async function getObject(key: string): Promise<Readable | null> {
  try {
    assertSafeKey(key);
  } catch {
    return null;
  }
  const full = localPath(key);
  return existsSync(full) ? createReadStream(full) : null;
}

export async function deleteObject(key: string) {
  assertSafeKey(key);
  await unlink(localPath(key)).catch(() => undefined);
}
