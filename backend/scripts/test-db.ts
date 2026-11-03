/**
 * Drops, migrates and seeds the TEST database (TEST_DATABASE_URL, or the dev
 * database name with a `_test` suffix). Run before `npm test`.
 */
const base = process.env.DATABASE_URL ?? '';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || base.replace(/\/([^/?]+)(\?|$)/, '/$1_test$2');
if (process.env.DATABASE_URL === base) {
  console.error('Could not derive a separate test database URL; set TEST_DATABASE_URL.');
  process.exit(1);
}
process.argv.push('--quiet');
await import('./reset.js');
