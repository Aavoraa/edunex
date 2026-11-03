import type { Queryable } from '../config/db.js';
import { one } from '../config/db.js';

/**
 * Generates the next human-readable business code for a table, e.g.
 * nextCode('expenses', 'code', 'EXP-') → 'EXP-2212'. Uses the numeric suffix
 * of existing codes; the UNIQUE constraint guards against races.
 */
export async function nextCode(table: string, column: string, prefix: string, db?: Queryable, pad = 4) {
  if (!/^[a-z_]+$/.test(table) || !/^[a-z_]+$/.test(column)) throw new Error('Invalid identifier');
  const row = await one<{ max: number | null }>(
    `SELECT max(substring(${column} FROM char_length($1) + 1)::bigint) AS max
       FROM ${table}
      WHERE left(${column}, char_length($1)) = $1
        AND substring(${column} FROM char_length($1) + 1) ~ '^[0-9]+$'`,
    [prefix],
    db,
  );
  const next = (row?.max ?? 0) + 1;
  return prefix + String(next).padStart(pad, '0');
}
