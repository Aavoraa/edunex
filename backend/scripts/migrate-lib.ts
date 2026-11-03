import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
// Works from backend/scripts (tsx) and backend/dist/scripts (compiled).
export const MIGRATIONS_DIR = [path.resolve(here, '../../database/migrations'), path.resolve(here, '../../../database/migrations')].find((p) => existsSync(p)) ?? path.resolve(here, '../../database/migrations');

/** Applies every *.sql file in database/migrations that has not run yet, in name order. */
export async function runMigrations(client: pg.PoolClient, log = console.log) {
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
  const done = new Set((await client.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
  let applied = 0;
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      log(`  ✓ ${file}`);
      applied++;
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
    }
  }
  log(applied ? `Applied ${applied} migration(s).` : 'Database is up to date.');
}

/** Drops and recreates the public schema. Refuses to run in production. */
export async function dropAll(client: pg.PoolClient) {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to reset a production database.');
  await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
}
