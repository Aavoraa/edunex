import { pool } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { seedAll } from '../../database/seed/index.js';

if (env.isProd) {
  console.error('Refusing to seed SAMPLE data into a production database.');
  process.exit(1);
}
const password = env.SEED_DEMO_PASSWORD;
if (!password || password.length < 8) {
  console.error('Set SEED_DEMO_PASSWORD (8+ characters) in .env — it becomes the password for every demo account.');
  process.exit(1);
}

const client = await pool.connect();
try {
  const existing = await client.query('SELECT count(*)::int AS n FROM users');
  if (existing.rows[0].n > 0) {
    console.error('The database already has data. Use `npm run db:reset` to drop, migrate and reseed.');
    process.exitCode = 1;
  } else {
    console.log('Seeding SAMPLE data…');
    const ctx = await seedAll(client, password);
    console.log(`Done. ${ctx.students.length} students seeded for ${ctx.today}.`);
  }
} finally {
  client.release();
  await pool.end();
}
