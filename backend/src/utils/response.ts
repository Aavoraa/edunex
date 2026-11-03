import type { Response } from 'express';

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** Every successful response has the same envelope: { success, data, message, meta? }. */
export function ok<T>(res: Response, data: T, message = 'OK', meta?: PageMeta | Record<string, unknown>) {
  return res.status(200).json({ success: true, data, message, ...(meta ? { meta } : {}) });
}

export function created<T>(res: Response, data: T, message = 'Created') {
  return res.status(201).json({ success: true, data, message });
}

export function paged<T>(res: Response, rows: T[], total: number, page: number, pageSize: number, message = 'OK') {
  return ok(res, rows, message, { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
}
