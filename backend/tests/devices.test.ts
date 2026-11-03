/**
 * GPS devices: registration, assignment, device authentication and the one
 * common location endpoint. Includes the mandatory reassignment scenario.
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app, as } from './helpers.js';
import { one, pool, query } from '../src/config/db.js';

const CODE = 'GPS000123';
const STU1 = 'HS-2026-1041';   // plays STU001 (Aditya Kumar)
const STU2 = 'HS-2026-1055';   // plays STU002
let token = '';

const send = (body: object, bearer = token) =>
  request(app).post('/api/v1/location').set('Authorization', `Bearer ${bearer}`).send(body);

async function cleanup() {
  const d = await one<{ id: string }>('SELECT id FROM gps_devices WHERE device_code = ANY($1)', [[CODE]]);
  if (d) {
    await query('DELETE FROM student_locations WHERE device_id = $1', [d.id]);
    await query('DELETE FROM device_assignments WHERE device_id = $1', [d.id]);
    await query('DELETE FROM gps_devices WHERE id = $1', [d.id]);
  }
  await query(`DELETE FROM gps_devices WHERE notes = 'devices.test'`);
}

beforeAll(async () => {
  await cleanup();
  // Both students start without a device so the scenario is self-contained.
  await query(`UPDATE device_assignments SET status = 'inactive', unassigned_at = now(), unassign_reason = 'devices.test setup'
                WHERE status = 'active' AND student_id IN (SELECT id FROM students WHERE admission_no = ANY($1))`, [[STU1, STU2]]);
  await query(`UPDATE student_tracking_profiles SET tracking_enabled = true, tracking_status = 'active'
                WHERE student_id IN (SELECT id FROM students WHERE admission_no = ANY($1))`, [[STU1, STU2]]);
});

afterAll(async () => {
  await cleanup();
  await pool.end();
});

describe('mandatory scenario: assign → send → reassign → send', () => {
  let firstLocationId = 0;
  let firstAssignmentId = '';

  it('registers GPS000123 and shows its token once', async () => {
    const admin = await as('principal');
    const r = await admin.post('/api/devices', { deviceCode: CODE, deviceType: 'gps_tracker', imei: '864521000000123' });
    expect(r.status).toBe(201);
    expect(r.body.data.device).toMatchObject({ deviceCode: CODE, status: 'available', hasToken: true });
    expect(r.body.data.token).toMatch(/^hsd_[A-Za-z0-9_-]{43}$/);
    token = r.body.data.token;
    // Never returned again, and only a hash is stored.
    const again = await admin.get(`/api/devices/${CODE}`);
    expect(JSON.stringify(again.body)).not.toContain(token);
    const row = await one('SELECT token_hash FROM gps_devices WHERE device_code = $1', [CODE]);
    expect(row.token_hash).not.toContain(token);
  });

  it('assigns GPS000123 → STU001', async () => {
    const admin = await as('principal');
    const r = await admin.post('/api/device-assignments', { studentId: STU1, deviceId: CODE, notes: 'Issued with ID card' });
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({ deviceCode: CODE, admissionNo: STU1, status: 'active' });
    firstAssignmentId = r.body.data.id;
  });

  it('a location from the device is stored against STU001', async () => {
    const r = await send({ device_id: CODE, latitude: 11.0168, longitude: 76.9558, accuracy: 7.4 });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ success: true, device_id: CODE, student_id: STU1, message: 'Location received' });
    firstLocationId = r.body.location_id;
    const row = await one(
      `SELECT s.admission_no, d.device_code, l.latitude, l.longitude, l.accuracy FROM student_locations l
         JOIN students s ON s.id = l.student_id JOIN gps_devices d ON d.id = l.device_id WHERE l.id = $1`, [firstLocationId]);
    expect(row).toMatchObject({ admission_no: STU1, device_code: CODE, latitude: 11.0168, longitude: 76.9558, accuracy: 7.4 });
  });

  it('unassigns GPS000123 from STU001 and assigns it to STU002', async () => {
    const admin = await as('principal');
    const un = await admin.post(`/api/device-assignments/${firstAssignmentId}/unassign`, { reason: 'Returned to office' });
    expect(un.status).toBe(200);
    expect(un.body.data).toMatchObject({ status: 'inactive', deviceStatus: 'available' });
    expect(un.body.data.unassignedAt).toBeTruthy();

    // While unassigned the device is refused.
    const refused = await send({ device_id: CODE, latitude: 11.02, longitude: 76.96 });
    expect(refused.status).toBe(409);
    expect(refused.body).toMatchObject({ success: false, message: 'Device is not assigned to a student', error: 'DEVICE_NOT_ASSIGNED' });

    const re = await admin.post('/api/device-assignments', { studentId: STU2, deviceId: CODE });
    expect(re.status).toBe(201);
    expect(re.body.data).toMatchObject({ admissionNo: STU2, status: 'active' });
  });

  it('the next location belongs to STU002 and STU001 history is unchanged', async () => {
    const r = await send({ device_id: CODE, latitude: 11.0201, longitude: 76.9602, accuracy: 5 });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ device_id: CODE, student_id: STU2 });

    const rows = await query(
      `SELECT l.id, s.admission_no, l.latitude, l.longitude FROM student_locations l JOIN students s ON s.id = l.student_id
        WHERE l.device_id = (SELECT id FROM gps_devices WHERE device_code = $1) ORDER BY l.id`, [CODE]);
    expect(rows.rows.map((x) => [x.admission_no, x.latitude, x.longitude])).toEqual([
      [STU1, 11.0168, 76.9558],
      [STU2, 11.0201, 76.9602],
    ]);
    expect(rows.rows[0].id).toBe(firstLocationId);

    // Assignment history keeps both rows.
    const admin = await as('principal');
    const hist = await admin.get(`/api/devices/${CODE}`);
    expect(hist.body.data.assignments.map((a: any) => [a.admissionNo, a.status])).toEqual([[STU2, 'active'], [STU1, 'inactive']]);

    // Latest location per student follows the assignment.
    const l1 = await admin.get(`/api/students/${STU1}/location`);
    const l2 = await admin.get(`/api/students/${STU2}/location`);
    expect(l1.body.data).toMatchObject({ latitude: 11.0168, longitude: 76.9558, deviceCode: null });
    expect(l2.body.data).toMatchObject({ latitude: 11.0201, longitude: 76.9602, deviceCode: CODE, gpsStatus: 'online' });
  });
});

describe('device authentication and validation', () => {
  it('rejects a missing, wrong or another device’s token with the same 401', async () => {
    const admin = await as('principal');
    const other = await admin.post('/api/devices', { deviceType: 'gps_tracker', notes: 'devices.test' });
    expect(other.status).toBe(201);
    expect(other.body.data.device.deviceCode).toMatch(/^GPS\d{6}$/);

    const body = { device_id: CODE, latitude: 11, longitude: 76 };
    for (const r of [
      await request(app).post('/api/v1/location').send(body),
      await send(body, 'hsd_wrong'),
      await send(body, other.body.data.token),
      await send({ ...body, device_id: 'GPS999999' }),
    ]) {
      expect(r.status).toBe(401);
      expect(r.body.error).toBe('DEVICE_AUTH_FAILED');
    }
  });

  it('ignores a student_id sent by the device', async () => {
    const r = await send({ device_id: CODE, latitude: 11.03, longitude: 76.97, student_id: STU1 });
    expect(r.status).toBe(201);
    expect(r.body.student_id).toBe(STU2);
  });

  it('rejects bad coordinates and implausible timestamps', async () => {
    expect((await send({ device_id: CODE, latitude: 91, longitude: 76 })).status).toBe(400);
    expect((await send({ device_id: CODE, latitude: 11, longitude: -181 })).status).toBe(400);
    expect((await send({ device_id: CODE, latitude: '11', longitude: 76 })).status).toBe(400);
    const future = await send({ device_id: CODE, latitude: 11, longitude: 76, recorded_at: new Date(Date.now() + 3_600_000).toISOString() });
    expect(future.body.error).toBe('INVALID_TIMESTAMP');
    const old = await send({ device_id: CODE, latitude: 11, longitude: 76, recorded_at: '2020-01-01T00:00:00Z' });
    expect(old.body.error).toBe('TIMESTAMP_TOO_OLD');
  });

  it('an older buffered point is stored but does not replace the latest location', async () => {
    const earlier = new Date(Date.now() - 10 * 60_000).toISOString();
    const r = await send({ device_id: CODE, latitude: 11.1, longitude: 77.1, recorded_at: earlier });
    expect(r.status).toBe(201);
    const admin = await as('principal');
    const cur = await admin.get(`/api/students/${STU2}/location`);
    expect(cur.body.data.latitude).not.toBe(11.1);
  });

  it('refuses a device taken out of service, and a new token replaces the old one', async () => {
    const admin = await as('principal');
    const m = await admin.put(`/api/devices/${CODE}`, { status: 'maintenance', reason: 'Cracked case' });
    expect(m.status).toBe(200);
    expect(m.body.data).toMatchObject({ status: 'maintenance', studentId: null });
    const r = await send({ device_id: CODE, latitude: 11, longitude: 76 });
    expect(r.status).toBe(403);
    expect(r.body.error).toBe('DEVICE_INACTIVE');

    await admin.put(`/api/devices/${CODE}`, { status: 'available' });
    const t = await admin.post(`/api/devices/${CODE}/token`);
    expect(t.status).toBe(200);
    expect((await send({ device_id: CODE, latitude: 11, longitude: 76 })).status).toBe(401);
    token = t.body.data.token;
    expect((await send({ device_id: CODE, latitude: 11, longitude: 76 })).status).toBe(409); // valid token, but not assigned
  });
});

describe('assignment rules', () => {
  it('asks before moving a device that is with another student', async () => {
    const admin = await as('principal');
    await admin.post('/api/device-assignments', { studentId: STU1, deviceId: CODE });
    const r = await admin.post('/api/device-assignments', { studentId: STU2, deviceId: CODE });
    expect(r.status).toBe(409);
    expect(r.body.error).toBe('REASSIGN_REQUIRED');
    expect(r.body.details.device.admissionNo).toBe(STU1);
    const ok = await admin.post('/api/device-assignments', { studentId: STU2, deviceId: CODE, reassign: true });
    expect(ok.status).toBe(201);
    const active = await query(
      `SELECT count(*)::int AS n FROM device_assignments WHERE status = 'active' AND device_id = (SELECT id FROM gps_devices WHERE device_code = $1)`, [CODE]);
    expect(active.rows[0].n).toBe(1);
  });

  it('finds a device from a scanned QR, IMEI or URL', async () => {
    const admin = await as('principal');
    for (const code of [CODE, 'gps000123', 'HSDEV:GPS000123', '864521000000123', 'http://localhost:4000/d/GPS000123']) {
      const r = await admin.get(`/api/devices/lookup?code=${encodeURIComponent(code)}`);
      expect(r.status, code).toBe(200);
      expect(r.body.data.deviceCode).toBe(CODE);
    }
    expect((await admin.get('/api/devices/lookup?code=NOPE-000')).status).toBe(404);
  });

  it('is limited to staff with tracking permissions', async () => {
    expect((await (await as('teacher')).get('/api/devices')).status).toBe(403);
    expect((await (await as('parent')).get('/api/device-assignments')).status).toBe(403);
    expect((await (await as('office')).post('/api/devices', { deviceType: 'gps_tracker' })).status).toBe(403);
    expect((await (await as('office')).get('/api/devices')).status).toBe(200);
  });

  it('deleting history falls back to the newest remaining point', async () => {
    const latestId = async () =>
      (await one(`SELECT location_id FROM student_latest_locations WHERE student_id = (SELECT id FROM students WHERE admission_no = $1)`, [STU2])).location_id;
    const before = await latestId();
    await query('DELETE FROM student_locations WHERE id = $1', [before]);
    const after = await latestId();
    expect(after).not.toBe(before);
    const newest = await one(
      `SELECT id FROM student_locations WHERE student_id = (SELECT id FROM students WHERE admission_no = $1) ORDER BY recorded_at DESC, id DESC LIMIT 1`, [STU2]);
    expect(after).toBe(newest.id);
  });

  it('the tracker app sees its own student and today’s figures', async () => {
    const r = await request(app).get('/api/v1/device/status').set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(200);
    expect(r.body.data.device).toMatchObject({ deviceCode: CODE, status: 'assigned', gpsStatus: 'online' });
    expect(r.body.data.student).toMatchObject({ admissionNo: STU2, trackingEnabled: true });
    expect(r.body.data.today.points).toBeGreaterThanOrEqual(1);
    expect(r.body.data.intervalSeconds).toBe(30);
    // No token, or someone else's, gets nothing.
    expect((await request(app).get('/api/v1/device/status')).status).toBe(401);
    expect((await request(app).get('/api/v1/device/status').set('Authorization', 'Bearer hsd_nope')).status).toBe(401);
  });

  it('phone connect flow: admin signs in on the phone, issues a token for a scanned label, assigns it', async () => {
    const admin = await as('principal');
    const spare = (await admin.get('/api/devices/lookup?code=GPS009001')).body.data;
    expect(spare.status).toBe('available');
    const t = await admin.post(`/api/devices/${spare.deviceCode}/token`);
    expect(t.status).toBe(200);
    const s1 = await request(app).get('/api/v1/device/status').set('Authorization', `Bearer ${t.body.data.token}`);
    expect(s1.body.data.student).toBeNull();
    const a = await admin.post('/api/device-assignments', { studentId: STU1, deviceId: spare.deviceCode, reassign: true });
    expect(a.status).toBe(201);
    const s2 = await request(app).get('/api/v1/device/status').set('Authorization', `Bearer ${t.body.data.token}`);
    expect(s2.body.data.student.admissionNo).toBe(STU1);
    await admin.post(`/api/device-assignments/${a.body.data.id}/unassign`, {});
  });

  it('reports inventory and connectivity', async () => {
    const r = await (await as('principal')).get('/api/devices/summary');
    expect(r.status).toBe(200);
    const s = r.body.data;
    expect(s.total).toBeGreaterThanOrEqual(s.assigned + s.available);
    expect(s.online + s.stale + s.offline).toBe(s.assigned);
    expect(s.thresholds).toEqual({ onlineSeconds: 120, offlineSeconds: 600 });
  });
});
