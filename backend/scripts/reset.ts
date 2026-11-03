import { pool } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { dropAll, runMigrations } from './migrate-lib.js';
import { seedAll } from '../../database/seed/index.js';

if (env.isProd) {
  console.error('Refusing to reset a production database.');
  process.exit(1);
}
const password = env.SEED_DEMO_PASSWORD;
if (!password || password.length < 8) {
  console.error('Set SEED_DEMO_PASSWORD (8+ characters) in .env first.');
  process.exit(1);
}

const client = await pool.connect();
try {
  const skipSeed = process.argv.includes('--no-seed');
  console.log('Dropping schema…');
  await dropAll(client);
  console.log('Running migrations…');
  await runMigrations(client);
  if (!skipSeed) {
    console.log('Seeding SAMPLE data…');
    const ctx = await seedAll(client, password);
    console.log(`Done. ${ctx.students.length} students seeded for ${ctx.today}.`);
  }
} finally {
  client.release();
  await pool.end();
}
