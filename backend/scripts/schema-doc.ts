/**
 * Generates docs/DATABASE.md from the live schema (run after migrations):
 *   npx tsx --env-file=../.env scripts/schema-doc.ts
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { many, pool } from '../src/config/db.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const migDir = path.join(root, 'database/migrations');

const owner = new Map<string, string>();
for (const f of (await readdir(migDir)).filter((x) => x.endsWith('.sql')).sort()) {
  const sql = await readFile(path.join(migDir, f), 'utf8');
  for (const m of sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)/gi)) if (!owner.has(m[1])) owner.set(m[1], f);
}

const cols = await many(`
  SELECT c.table_name, c.column_name, c.data_type, c.is_nullable, c.column_default
    FROM information_schema.columns c JOIN information_schema.tables t
      ON t.table_name = c.table_name AND t.table_schema = c.table_schema AND t.table_type = 'BASE TABLE'
   WHERE c.table_schema = 'public' ORDER BY c.table_name, c.ordinal_position`);
const fks = await many(`
  SELECT tc.table_name, kcu.column_name, ccu.table_name AS ref
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
   WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'`);
const idx = await many(`SELECT tablename, count(*)::int AS n FROM pg_indexes WHERE schemaname = 'public' GROUP BY tablename`);
const rows = await many(`SELECT relname, n_live_tup::int AS n FROM pg_stat_user_tables`);

const fkBy = new Map<string, string>();
for (const f of fks) fkBy.set(`${f.table_name}.${f.column_name}`, f.ref);
const idxBy = new Map(idx.map((r) => [r.tablename, r.n]));
const rowsBy = new Map(rows.map((r) => [r.relname, r.n]));
const tables = new Map<string, typeof cols>();
for (const c of cols) (tables.get(c.table_name) ?? tables.set(c.table_name, []).get(c.table_name)!).push(c);

const groups = new Map<string, string[]>();
for (const t of [...tables.keys()].sort()) {
  const g = owner.get(t) ?? 'other';
  (groups.get(g) ?? groups.set(g, []).get(g)!).push(t);
}

let md = `# Database schema\n\nPostgreSQL. Generated from the live schema by \`backend/scripts/schema-doc.ts\` — ${tables.size} tables.\n\n`;
md += `Conventions: uuid primary keys (identity bigints for high-volume logs), business codes are UNIQUE, \`created_at\`/\`updated_at\` on every table (trigger-maintained), \`created_by\`/\`updated_by\` on business records, \`deleted_at\` soft delete on master records, foreign keys everywhere, indexes on every lookup path.\n\n`;
md += `Views: \`student_current_locations\` (latest GPS point per student).\n\nMigrations run in file-name order and are tracked in \`schema_migrations\`.\n\n`;
md += `## Tables by migration\n\n`;
for (const [g, ts] of [...groups].sort()) {
  md += `### ${g}\n\n| Table | Columns | Relations | Indexes | Sample rows |\n|---|---|---|---|---|\n`;
  for (const t of ts) {
    const cs = tables.get(t)!;
    const rel = [...new Set(cs.map((c) => fkBy.get(`${t}.${c.column_name}`)).filter(Boolean))].join(', ');
    md += `| \`${t}\` | ${cs.length} | ${rel || '—'} | ${idxBy.get(t) ?? 0} | ${rowsBy.get(t) ?? 0} |\n`;
  }
  md += '\n';
}
md += `## Columns\n\n`;
for (const [t, cs] of tables) {
  md += `<details><summary><code>${t}</code></summary>\n\n| Column | Type | Null | Default / FK |\n|---|---|---|---|\n`;
  for (const c of cs) {
    const fk = fkBy.get(`${t}.${c.column_name}`);
    const def = fk ? `→ ${fk}` : (c.column_default ?? '').replace(/\|/g, '\|').slice(0, 60);
    md += `| ${c.column_name} | ${c.data_type} | ${c.is_nullable === 'YES' ? 'yes' : ''} | ${def} |\n`;
  }
  md += `\n</details>\n\n`;
}
await writeFile(path.join(root, 'docs/DATABASE.md'), md);
console.log(`docs/DATABASE.md written (${tables.size} tables)`);
await pool.end();
