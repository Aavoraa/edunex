import type { NextFunction, Request, Response } from 'express';
import type { z } from 'zod';
import { badRequest } from '../utils/errors.js';

type Source = 'body' | 'query' | 'params';

/**
 * Validates and coerces a request part with a Zod schema. The parsed value is
 * stored on req.valid[source]; handlers read from there, never from raw input.
 */
export function validate<S extends z.ZodType>(schema: S, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
      return next(badRequest('Validation failed', 'VALIDATION_ERROR', details));
    }
    req.valid = req.valid || {};
    req.valid[source] = result.data;
    next();
  };
}

export function v<T = any>(req: Request, source: Source = 'body'): T {
  return (req.valid?.[source] ?? {}) as T;
}
