/**
 * Blob storage for uploaded documents: files under UPLOAD_DIR (STORAGE_DRIVER=local), or objects in
 * a private S3-compatible bucket (STORAGE_DRIVER=s3: AWS S3, Cloudflare R2, Supabase Storage, MinIO).
 * Either way the API streams files to signed-in users; nothing is publicly readable.
 *
 * Keys look like "2026-09/<uuid>.pdf" and are generated server-side — they
 * never contain user input. The guards here are defence in depth.
 */

import { createReadStream, existsSync, mkdirSync } from 'node:fs';
import { writeFile, unlink, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export const UPLOAD_ROOT = path.resolve(env.UPLOAD_DIR);

const s3 = env.STORAGE_DRIVER === 's3'
  ? new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID!, secretAccessKey: env.S3_SECRET_ACCESS_KEY! },
  })
  : null;

if (!s3) {
  mkdirSync(UPLOAD_ROOT, { recursive: true });
  if (env.onVercel) logger.warn('STORAGE_DRIVER=local on Vercel: uploaded files are lost when the function instance ends. Use STORAGE_DRIVER=s3.');
}

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

export async function putObject(key: string, body: Buffer, contentType: string) {
  assertSafeKey(key);
  if (s3) {
    await s3.send(new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Body: body, ContentType: contentType }));
    return;
  }
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
  if (s3) {
    try {
      const res = await s3.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
      return (res.Body as Readable | undefined) ?? null;
    } catch (err) {
      const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (e.name === 'NoSuchKey' || e.$metadata?.httpStatusCode === 404) return null;
      throw err;
    }
  }
  const full = localPath(key);
  return existsSync(full) ? createReadStream(full) : null;
}

export async function deleteObject(key: string) {
  assertSafeKey(key);
  if (s3) {
    await s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key })).catch(() => undefined);
    return;
  }
  await unlink(localPath(key)).catch(() => undefined);
}
