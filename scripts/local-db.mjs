#!/usr/bin/env node
/**
 * Starts/stops a private PostgreSQL cluster for development in ./.pgdata
 * (port 5544 by default). Useful when you do not want to touch a system-wide
 * PostgreSQL install. Requires PostgreSQL binaries (initdb, pg_ctl) on PATH or
 * PG_BIN pointing at their folder.
 *
 *   node scripts/local-db.mjs init   # first time: creates the cluster and database
 *   node scripts/local-db.mjs start
 *   node scripts/local-db.mjs stop
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const data = path.join(root, '.pgdata');
const port = process.env.LOCAL_PG_PORT ?? '5544';
const bin = (name) => (process.env.PG_BIN ? path.join(process.env.PG_BIN, name) : name);
const run = (cmd, args, opts = {}) => {
  const r = spawnSync(bin(cmd), args, { stdio: 'inherit', shell: false, ...opts });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

const cmd = process.argv[2];
if (cmd === 'init') {
  if (existsSync(data)) {
    console.log('.pgdata already exists.');
    process.exit(0);
  }
  const password = process.env.LOCAL_PG_PASSWORD;
  if (!password) {
    console.error('Set LOCAL_PG_PASSWORD to the password for the local postgres superuser.');
    process.exit(1);
  }
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'hs-pg-'));
  const pwfile = path.join(tmp, 'pw');
  writeFileSync(pwfile, password, { mode: 0o600 });
  try {
    run('initdb', ['-D', data, '-U', 'postgres', `--pwfile=${pwfile}`, '-A', 'scram-sha-256', '-E', 'UTF8', '--locale=C']);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  run('pg_ctl', ['-D', data, '-o', `-p ${port}`, '-l', path.join(data, 'server.log'), 'start']);
  run('createdb', ['-h', 'localhost', '-p', port, '-U', 'postgres', 'edunex'], { env: { ...process.env, PGPASSWORD: password } });
  console.log(`Cluster ready. DATABASE_URL=postgres://postgres:<password>@localhost:${port}/edunex`);
} else if (cmd === 'start') {
  run('pg_ctl', ['-D', data, '-o', `-p ${port}`, '-l', path.join(data, 'server.log'), 'start']);
} else if (cmd === 'stop') {
  run('pg_ctl', ['-D', data, 'stop']);
} else {
  console.log('Usage: node scripts/local-db.mjs <init|start|stop>');
}
