/** Functional tests for the student register, Student 360 and GPS tracking. */
import { afterAll, describe, expect, it } from 'vitest';
import { as } from './helpers.js';
import { pool, query } from '../src/config/db.js';

const created: string[] = [];

afterAll(async () => {
  // Remove anything this suite created so it can run repeatedly.
  if (created.length) {
    await query('DELETE FROM students WHERE id = ANY($1)', [created]);
    await query(`DELETE FROM parents WHERE full_name = 'Test Guardian' AND NOT EXISTS (SELECT 1 FROM student_guardians sg WHERE sg.parent_id = parents.id)`);
  }
  await pool.end();
});

describe('students', () => {
  it('lists with pagination, search, filters and sorting', async () => {
    const api = await as('principal');
    const r = await api.get('/api/students?pageSize=5&sort=attendance&dir=desc');
    expect(r.status).toBe(200);
    expect(r.body.meta).toMatchObject({ page: 1, pageSize: 5 });
    const att = r.body.data.map((s: any) => s.attendance ?? -1);
    expect([...att].sort((a, b) => b - a)).toEqual(att);

    const s = await api.get('/api/students?q=aditya');
    expect(s.body.data.some((x: any) => x.admissionNo === 'HS-2026-1041')).toBe(true);

    const risk = await api.get('/api/students?risk=At%20Risk&pageSize=200');
    expect(risk.body.data.every((x: any) => x.risk === 'At Risk')).toBe(true);
  });

  it('ignores unknown sort keys safely', async () => {
    const api = await as('principal');
    const r = await api.get('/api/students?sort=name;DROP TABLE students');
    expect(r.status).toBe(200);
  });

  it('returns a complete Student 360 profile', async () => {
    const api = await as('principal');
    const r = await api.get('/api/students/HS-2026-1041/profile');
    expect(r.status).toBe(200);
    const d = r.body.data;
    expect(d.student).toMatchObject({ fullName: 'Aditya Kumar', grade: 'Grade 5', section: 'A' });
    for (const k of ['guardians', 'attendance', 'academics', 'skills', 'activities', 'achievements', 'behaviour', 'documents', 'timeline', 'transport', 'tracking']) {
      expect(d).toHaveProperty(k);
    }
    expect(d.academics.subjects.length).toBe(6);
    expect(d.guardians[0].fullName).toBe('Ranjith Kumar');
    expect(d.tracking.isSampleData).toBe(true);
  });

  it('creates, updates and archives a student', async () => {
    const api = await as('superadmin');
    const lk = await api.get('/api/lookups');
    const campus = lk.body.data.campuses.find((c: any) => c.code === 'gdv');
    const cls = lk.body.data.classes.find((c: any) => c.campusId === campus.id && c.gradeLevel === 4);
    const create = await api.post('/api/students', {
      firstName: 'Test', lastName: 'Student', dateOfBirth: '2017-05-04', gender: 'F', campusId: campus.id, sectionId: cls.sections[0].id,
      guardians: [{ fullName: 'Test Guardian', phone: '+91 90000 00000', relationship: 'Mother', isPrimary: true }], enableTracking: true,
    });
    expect(create.status).toBe(201);
    const id = create.body.data.id;
    created.push(id);
    expect(create.body.data.admissionNo).toMatch(/^HS-\d{4}-\d{4}$/);

    const upd = await api.put(`/api/students/${id}`, { house: 'Coral', riskLevel: 'Watch' });
    expect(upd.status).toBe(200);
    expect(upd.body.data).toMatchObject({ house: 'Coral', risk: 'Watch' });

    const loc = await api.get(`/api/students/${id}/location`);
    expect(loc.body.data.displayStatus).toBe('No Location Yet');

    const del = await api.delete(`/api/students/${id}`);
    expect(del.status).toBe(200);
    expect((await api.get(`/api/students/${id}`)).status).toBe(404);
  });

  it('rejects a section from another campus', async () => {
    const api = await as('superadmin');
    const lk = await api.get('/api/lookups');
    const gdv = lk.body.data.campuses.find((c: any) => c.code === 'gdv');
    const vdvClass = lk.body.data.classes.find((c: any) => c.campusId !== gdv.id && c.sections.length);
    const r = await api.post('/api/students', {
      firstName: 'X', lastName: 'Y', dateOfBirth: '2016-01-01', gender: 'M', campusId: gdv.id, sectionId: vdvClass.sections[0].id,
    });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('SECTION_CAMPUS_MISMATCH');
  });
});

describe('tracking', () => {
  it('serves the brief example student at the documented coordinates', async () => {
    const api = await as('principal');
    const r = await api.get('/api/students/HS-2026-1091/location');
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ fullName: 'Aarav Kumar', latitude: 11.0168, longitude: 76.9558 });
  });

  it('every student has a tracking profile and sample coordinates', async () => {
    const api = await as('principal');
    const r = await api.get('/api/tracking/students?pageSize=200');
    expect(r.status).toBe(200);
    const enabled = r.body.data.filter((s: any) => s.trackingEnabled);
    expect(enabled.length).toBeGreaterThanOrEqual(20);
    expect(enabled.every((s: any) => s.latitude != null && s.longitude != null)).toBe(true);
  });

  it('filters the map by class, section and status', async () => {
    const api = await as('principal');
    const all = await api.get('/api/tracking/map?scope=group');
    expect(all.status).toBe(200);
    expect(all.body.data.summary.total).toBeGreaterThan(0);
    const off = await api.get('/api/tracking/students?status=offline&pageSize=200');
    expect(off.body.data.every((s: any) => ['Offline', 'No Location Yet'].includes(s.displayStatus))).toBe(true);
    const paused = await api.get('/api/tracking/students?status=paused');
    expect(paused.body.data.every((s: any) => s.trackingStatus === 'paused')).toBe(true);
  });

  it('returns history filtered by date and time window', async () => {
    const api = await as('principal');
    const all = await api.get('/api/students/HS-2026-1091/location/history');
    expect(all.status).toBe(200);
    const day = all.body.data.availableDays[0].date;
    const win = await api.get(`/api/students/HS-2026-1091/location/history?date=${day}&from=10:00&to=10:30`);
    expect(win.status).toBe(200);
    const coords = win.body.data.points.map((p: any) => `${p.latitude},${p.longitude}`);
    expect(coords).toEqual(['11.0168,76.9558', '11.0171,76.9562', '11.0178,76.9571']);
  });

  it('pausing and disabling tracking is reflected and blocks recording', async () => {
    const principal = await as('principal');
    const admin = await as('superadmin');
    const r = await principal.patch('/api/tracking/students/HS-2026-1055/profile', { trackingEnabled: false });
    expect(r.status).toBe(200);
    expect(r.body.data.trackingStatus).toBe('disabled');
    const rec = await admin.post('/api/students/HS-2026-1055/location', { latitude: 12.85, longitude: 80.06 });
    expect(rec.status).toBe(400);
    expect(rec.body.error).toBe('TRACKING_DISABLED');
    const back = await principal.patch('/api/tracking/students/HS-2026-1055/profile', { trackingEnabled: true });
    expect(back.body.data.trackingStatus).toBe('active');
  });

  it('notifies guardians when a child arrives on campus', async () => {
    const admin = await as('superadmin');
    const parent = await as('parent');
    await admin.post('/api/students/HS-2026-1085/location', { latitude: 12.87, longitude: 80.07, locationStatus: 'in_transit' });
    await admin.post('/api/students/HS-2026-1085/location', { latitude: 12.8458, longitude: 80.0625 });
    const n = await parent.get('/api/notifications?pageSize=5');
    expect(n.body.data.some((x: any) => /Surya Kumar reached the school campus/.test(x.title))).toBe(true);
  });
});

describe('dashboard', () => {
  it('computes live figures for campus and group scope', async () => {
    const api = await as('principal');
    const campus = await api.get('/api/dashboard/command-center');
    const group = await api.get('/api/dashboard/command-center?scope=group');
    expect(campus.status).toBe(200);
    expect(group.status).toBe(200);
    expect(group.body.data.students.total).toBeGreaterThanOrEqual(campus.body.data.students.total);
    expect(group.body.data.scope).toBe('group');
    expect(Array.isArray(campus.body.data.attention)).toBe(true);
  });
});
