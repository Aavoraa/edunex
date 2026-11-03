/**
 * Security & permission tests against a seeded database (run `npm run db:reset` first).
 * They exercise the rules the brief calls out: authentication, RBAC enforced on the
 * API, parent isolation, teacher scoping, token rotation, validation and audit.
 */
import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, as, login, ACCOUNTS, PASSWORD } from './helpers.js';
import { one, pool } from '../src/config/db.js';

afterAll(() => pool.end());

describe('authentication', () => {
  it('rejects requests without a token', async () => {
    const r = await request(app).get('/api/students');
    expect(r.status).toBe(401);
    expect(r.body).toMatchObject({ success: false, error: 'UNAUTHORIZED' });
  });

  it('rejects a tampered token', async () => {
    const { token } = await login('principal');
    const r = await request(app).get('/api/students').set('Authorization', `Bearer ${token.slice(0, -2)}xx`);
    expect(r.status).toBe(401);
    expect(r.body.error).toBe('TOKEN_INVALID');
  });

  it('does not reveal whether an account exists', async () => {
    const a = await request(app).post('/api/auth/login').send({ identifier: 'nobody@example.com', password: 'x' });
    const b = await request(app).post('/api/auth/login').send({ identifier: ACCOUNTS.office, password: 'wrong-password' });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body.message).toBe(b.body.message);
  });

  it('web login sets an httpOnly refresh cookie and no token in the body', async () => {
    const r = await request(app).post('/api/auth/login').send({ identifier: ACCOUNTS.office, password: PASSWORD, clientType: 'web' });
    expect(r.status).toBe(200);
    expect(r.body.data.refreshToken).toBeUndefined();
    const cookie = String(r.headers['set-cookie']);
    expect(cookie).toMatch(/hs_refresh=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
  });

  it('rotates refresh tokens and revokes the family on reuse', async () => {
    const r = await request(app).post('/api/auth/login').send({ identifier: ACCOUNTS.hr, password: PASSWORD, clientType: 'mobile' });
    const first = r.body.data.refreshToken;
    const r1 = await request(app).post('/api/auth/refresh').send({ refreshToken: first });
    expect(r1.status).toBe(200);
    const second = r1.body.data.refreshToken;
    expect(second).not.toBe(first);
    const reuse = await request(app).post('/api/auth/refresh').send({ refreshToken: first });
    expect(reuse.status).toBe(401);
    expect(reuse.body.error).toBe('REFRESH_REUSED');
    const afterRevoke = await request(app).post('/api/auth/refresh').send({ refreshToken: second });
    expect(afterRevoke.status).toBe(401);
  });

  it('never returns password hashes', async () => {
    const api = await as('superadmin');
    const r = await api.get('/api/users?pageSize=5');
    expect(r.status).toBe(200);
    expect(JSON.stringify(r.body)).not.toMatch(/password|\$2[aby]\$/i);
  });
});

describe('role-based access (enforced by the API)', () => {
  const cases: [string, Parameters<typeof as>[0], number][] = [
    ['/api/students', 'parent', 403],
    ['/api/tracking/map', 'parent', 403],
    ['/api/dashboard/command-center', 'teacher', 403],
    ['/api/audit-logs', 'teacher', 403],
    ['/api/users', 'principal', 403],
    ['/api/tracking/map', 'staff', 403],
    ['/api/students', 'student', 403],
    ['/api/students', 'principal', 200],
    ['/api/tracking/map', 'office', 200],
  ];
  it.each(cases)('GET %s as %s → %i', async (path, who, status) => {
    const api = await as(who);
    const r = await api.get(path);
    expect(r.status).toBe(status);
  });

  it('only tracking.write may record locations', async () => {
    const principal = await as('principal');
    expect((await principal.post('/api/students/HS-2026-1041/location', { latitude: 12.8, longitude: 80.06 })).status).toBe(403);
    const admin = await as('superadmin');
    const ok = await admin.post('/api/students/HS-2026-1041/location', { latitude: 12.8458, longitude: 80.0625, accuracy: 9 });
    expect(ok.status).toBe(201);
    expect(ok.body.data.locationStatus).toBe('at_school');
  });

  it('validates location input', async () => {
    const admin = await as('superadmin');
    const r = await admin.post('/api/students/HS-2026-1041/location', { latitude: 123, longitude: 'east' });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('VALIDATION_ERROR');
    expect(r.body.details.map((d: any) => d.field)).toEqual(expect.arrayContaining(['latitude', 'longitude']));
  });
});

describe('parent isolation', () => {
  it('sees own children only', async () => {
    const api = await as('parent');
    const me = await api.get('/api/parents/me');
    expect(me.status).toBe(200);
    const nos = me.body.data.children.map((c: any) => c.admissionNo).sort();
    expect(nos).toEqual(['HS-2026-1041', 'HS-2026-1085']);
  });

  it('can track own child, including history', async () => {
    const { user } = await login('parent');
    const api = await as('parent');
    const loc = await api.get(`/api/parents/${user.parentId}/children/HS-2026-1041/location`);
    expect(loc.status).toBe(200);
    expect(loc.body.data).toHaveProperty('latitude');
    expect((await api.get('/api/students/HS-2026-1041/location/history')).status).toBe(200);
  });

  it("cannot see another family's child by any route", async () => {
    const { user } = await login('parent');
    const other = await login('parent2');
    const api = await as('parent');
    const paths = [
      '/api/students/HS-2026-1042',
      '/api/students/HS-2026-1042/profile',
      '/api/students/HS-2026-1042/location',
      '/api/students/HS-2026-1042/location/history',
      `/api/parents/${user.parentId}/children/HS-2026-1042/location`,
      `/api/parents/${user.parentId}/children/HS-2026-1042/overview`,
    ];
    for (const p of paths) expect([p, (await api.get(p)).status]).toEqual([p, 404]);
    expect((await api.get(`/api/parents/${other.user.parentId}/children`)).status).toBe(403);
    expect((await api.get(`/api/parents/${other.user.parentId}`)).status).toBe(403);
  });

  it('does not expose internal staff notes in Student 360', async () => {
    const api = await as('parent');
    const r = await api.get('/api/students/HS-2026-1041/profile');
    expect(r.status).toBe(200);
    expect(r.body.data.observations).toBeUndefined();
    expect(r.body.data.interventions).toBeUndefined();
    expect(r.body.data.wellbeing.checkins).toBeUndefined();
  });

  it('search is scoped to own children', async () => {
    const api = await as('parent');
    const r = await api.get('/api/search?q=a');
    expect(r.status).toBe(200);
    const groups = new Set(r.body.data.map((h: any) => h.group));
    expect([...groups].every((g) => g === 'My children')).toBe(true);
  });
});

describe('teacher scope', () => {
  it('lists only students in assigned sections', async () => {
    const api = await as('teacher');
    const r = await api.get('/api/students?pageSize=200');
    expect(r.status).toBe(200);
    const grades = new Set(r.body.data.map((s: any) => `${s.grade}${s.section}`));
    expect([...grades].sort()).toEqual(['Grade 5A', 'Grade 6B', 'Grade 6C', 'Grade 7A'].filter((g) => grades.has(g)));
    expect(grades.has('Grade 7B')).toBe(false);
  });

  it("cannot open a student outside their classes, nor that student's location", async () => {
    const api = await as('teacher');
    expect((await api.get('/api/students/HS-2026-1042/profile')).status).toBe(404);
    expect((await api.get('/api/students/HS-2026-1042/location')).status).toBe(404);
    expect((await api.get('/api/students/HS-2026-1041/location')).status).toBe(200);
  });

  it('has no access to location history', async () => {
    const api = await as('teacher');
    expect((await api.get('/api/students/HS-2026-1041/location/history')).status).toBe(403);
  });
});

describe('audit trail', () => {
  it('records that a parent viewed child tracking', async () => {
    const { user } = await login('parent');
    const api = await as('parent');
    await api.get(`/api/parents/${user.parentId}/children/HS-2026-1041/location`);
    const row = await one(
      `SELECT description, device FROM audit_logs WHERE user_id = $1 AND module = 'tracking' ORDER BY id DESC LIMIT 1`,
      [user.id],
    );
    expect(row?.description).toMatch(/Parent viewed child tracking/);
    expect(row?.device).toBe('mobile');
  });
});

describe('error envelope', () => {
  it('404 for unknown routes', async () => {
    const api = await as('principal');
    const r = await api.get('/api/does-not-exist');
    expect(r.status).toBe(404);
    expect(r.body).toMatchObject({ success: false, error: 'ROUTE_NOT_FOUND' });
  });

  it('404 with a code for a missing student', async () => {
    const api = await as('principal');
    const r = await api.get('/api/students/HS-1999-0000');
    expect(r.status).toBe(404);
    expect(r.body).toEqual({ success: false, message: 'Student not found', error: 'STUDENT_NOT_FOUND' });
  });

  it('rejects malformed JSON', async () => {
    const r = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"identifier":');
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('INVALID_JSON');
  });

  it('sets secure headers and no-store on API responses', async () => {
    const api = await as('principal');
    const r = await api.get('/api/lookups');
    expect(r.headers['x-content-type-options']).toBe('nosniff');
    expect(r.headers['cache-control']).toBe('no-store');
    expect(r.headers['x-powered-by']).toBeUndefined();
  });
});
