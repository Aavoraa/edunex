import { pool } from '../src/config/db.js';
import { runMigrations } from './migrate-lib.js';

const client = await pool.connect();
try {
  console.log('Running migrations…');
  await runMigrations(client);
} finally {
  client.release();
  await pool.end();
}
