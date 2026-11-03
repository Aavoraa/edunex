/**
 * Small helpers shared by the operations, innovation and group services.
 */
import { query, type Queryable } from '../config/db.js';
import { badRequest } from '../utils/errors.js';

/**
 * Builds `SET col = $n, …` from an allow-listed map of camelCase input keys to
 * column names. Undefined values are skipped; null clears the column.
 * Returns the changed keys (for audit metadata).
 */
export function setClause(input: Record<string, unknown>, columns: Record<string, string>, params: unknown[]) {
  const sets: string[] = [];
  const keys: string[] = [];
  for (const [k, val] of Object.entries(input)) {
    const col = columns[k];
    if (!col || val === undefined) continue;
    params.push(val === '' ? null : val);
    sets.push(`${col} = $${params.length}`);
    keys.push(k);
  }
  return { sql: sets.join(', '), keys };
}

/** UPDATE <table> SET … WHERE id = $n RETURNING <returning>. Table/column names are trusted constants. */
export async function updateById<T extends Record<string, any> = any>(
  table: string, id: string, input: Record<string, unknown>, columns: Record<string, string>,
  opts: { extraSet?: string; where?: string; returning?: string; db?: Queryable } = {},
) {
  const params: unknown[] = [];
  const { sql, keys } = setClause(input, columns, params);
  if (!sql && !opts.extraSet) throw badRequest('Nothing to update');
  params.push(id);
  const set = [sql, opts.extraSet].filter(Boolean).join(', ');
  const r = await query<T>(
    `UPDATE ${table} SET ${set} WHERE id = $${params.length} ${opts.where ?? ''} RETURNING ${opts.returning ?? 'id'}`,
    params, opts.db,
  );
  return { row: r.rows[0] ?? null, keys };
}

/** Splits `count(*) OVER() AS total` out of a page of rows. */
export function splitTotal<T extends Record<string, any>>(rows: T[]) {
  const total = Number(rows[0]?.total ?? 0);
  return { rows: rows.map(({ total: _t, ...r }) => r) as Omit<T, 'total'>[], total };
}

/** Validates that an optional campus id exists (friendly 400 instead of a FK error). */
export async function assertCampus(campusId: string, db?: Queryable) {
  const r = await query('SELECT 1 FROM campuses WHERE id = $1', [campusId], db);
  if (!r.rowCount) throw badRequest('Campus not found', 'CAMPUS_NOT_FOUND');
}
