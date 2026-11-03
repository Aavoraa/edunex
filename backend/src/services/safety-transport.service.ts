import type { Request } from 'express';
import { many, one, query, tx, type Queryable } from '../config/db.js';
import { badRequest, conflict, notFound } from '../utils/errors.js';
import { likeTerm } from '../utils/pagination.js';
import { Where } from '../utils/sql.js';
import { audit } from './audit.service.js';
import { notifyGuardians } from './notification.service.js';
import { haversineMetres } from './tracking.service.js';
import {
  assertEmployee, authorizeSafetyStudent, hhmm, localDate, mapPgError, NOW_TIME, PARENT_ROUTE,
  safetyStudentScope, studentBrief, TODAY,
} from './safety-common.service.js';
import type { AuthUser } from '../types.js';

/** A bus further than this from its route is flagged as deviating. */
export const DEVIATION_METRES = 600;
/** A moving bus that has not reported for this long is flagged. */
export const GPS_STALE_MINUTES = 10;

const ACTIVE_STUDENT = `s.deleted_at IS NULL AND s.status = 'active'`;

// =============================================================================
// Routes list (bus tracking, routes, boarding)
// =============================================================================
const ROUTE_SELECT = `
  SELECT tr.id, tr.code, tr.name, tr.area, tr.campus_id AS "campusId", cp.short_name AS "campusName",
         tr.run_status AS "runStatus", tr.delay_minutes AS "delayMinutes", tr.eta_text AS eta, tr.updated_at AS "updatedAt",
         v.id AS "vehicleId", v.bus_no AS "busNo", v.registration_no AS "registrationNo", v.capacity, v.status AS "vehicleStatus",
         v.fitness_expiry AS "fitnessExpiry", v.insurance_expiry AS "insuranceExpiry",
         d.id AS "driverId", d.full_name AS "driverName", d.phone AS "driverPhone",
         a.id AS "attendantId", a.full_name AS "attendantName", a.phone AS "attendantPhone",
         (SELECT count(*) FROM student_transport st JOIN students s ON s.id = st.student_id AND ${ACTIVE_STUDENT}
           WHERE st.route_id = tr.id)::int AS students,
         (SELECT count(*) FROM route_stops rs WHERE rs.route_id = tr.id)::int AS stops,
         (SELECT count(*) FROM route_stops rs WHERE rs.route_id = tr.id AND rs.pickup_time <= ${NOW_TIME})::int AS "stopsPassed",
         (SELECT count(DISTINCT be.student_id) FROM boarding_events be
           WHERE be.route_id = tr.id AND be.event_type = 'boarded' AND ${localDate('be.occurred_at')} = ${TODAY})::int AS "boardedToday",
         (SELECT count(DISTINCT be.student_id) FROM boarding_events be
           WHERE be.route_id = tr.id AND be.event_type = 'deboarded' AND ${localDate('be.occurred_at')} = ${TODAY})::int AS "deboardedToday",
         (SELECT count(*) FROM (
            SELECT DISTINCT ON (be.student_id) be.event_type FROM boarding_events be
             WHERE be.route_id = tr.id AND ${localDate('be.occurred_at')} = ${TODAY}
             ORDER BY be.student_id, be.occurred_at DESC) z WHERE z.event_type = 'boarded')::int AS "onboardNow",
         loc.latitude, loc.longitude, loc.speed_kmph AS "speedKmph", loc.heading, loc.recorded_at AS "locationAt"
    FROM transport_routes tr
    JOIN campuses cp ON cp.id = tr.campus_id
    LEFT JOIN vehicles v ON v.id = tr.vehicle_id
    LEFT JOIN employees d ON d.id = tr.driver_id
    LEFT JOIN employees a ON a.id = tr.attendant_id
    LEFT JOIN LATERAL (
      SELECT vl.latitude, vl.longitude, vl.speed_kmph, vl.heading, vl.recorded_at
        FROM vehicle_locations vl WHERE vl.vehicle_id = tr.vehicle_id ORDER BY vl.recorded_at DESC, vl.id DESC LIMIT 1
    ) loc ON true`;

interface StopRow { id: string; routeId: string; sequence: number; name: string; latitude: number; longitude: number; pickupTime: string; dropTime: string | null }

async function stopsFor(routeIds: string[], db?: Queryable) {
  if (!routeIds.length) return [] as StopRow[];
  return many<StopRow>(
    `SELECT rs.id, rs.route_id AS "routeId", rs.sequence, rs.name, rs.latitude, rs.longitude,
            to_char(rs.pickup_time, 'HH24:MI') AS "pickupTime", to_char(rs.drop_time, 'HH24:MI') AS "dropTime"
       FROM route_stops rs WHERE rs.route_id = ANY($1) ORDER BY rs.route_id, rs.sequence`,
    [routeIds], db,
  );
}

/** Shortest distance (m) from a point to a polyline, using a local flat projection. */
function distanceToPath(lat: number, lng: number, path: { latitude: number; longitude: number }[]) {
  if (!path.length) return 0;
  if (path.length === 1) return haversineMetres(lat, lng, path[0].latitude, path[0].longitude);
  const kx = 111_320 * Math.cos((lat * Math.PI) / 180);
  const ky = 110_540;
  let best = Infinity;
  for (let i = 1; i < path.length; i++) {
    const ax = (path[i - 1].longitude - lng) * kx, ay = (path[i - 1].latitude - lat) * ky;
    const bx = (path[i].longitude - lng) * kx, by = (path[i].latitude - lat) * ky;
    const dx = bx - ax, dy = by - ay;
    const len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len)) : 0;
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}

const MOVING = new Set(['En route', 'Delayed']);

function decorate(r: any, stops: StopRow[]) {
  const moving = MOVING.has(r.runStatus);
  const stopsDone = ['At campus', 'Completed'].includes(r.runStatus) ? r.stops
    : moving ? Math.min(r.stopsPassed, Math.max(0, r.stops - 1)) : 0;
  const alerts: { type: string; tone: string; message: string }[] = [];
  let deviationMetres: number | null = null;
  if (moving && r.latitude != null) {
    deviationMetres = Math.round(distanceToPath(Number(r.latitude), Number(r.longitude), stops));
    if (deviationMetres > DEVIATION_METRES) {
      alerts.push({ type: 'deviation', tone: 'critical', message: `Deviation alert — ${(deviationMetres / 1000).toFixed(1)} km off the planned route` });
    }
    const ageMin = (Date.now() - new Date(r.locationAt).getTime()) / 60_000;
    if (ageMin > GPS_STALE_MINUTES) alerts.push({ type: 'gps', tone: 'warning', message: `No GPS update for ${Math.round(ageMin)} min` });
  }
  if (moving && r.latitude == null) alerts.push({ type: 'gps', tone: 'warning', message: 'No GPS position received today' });
  if (r.runStatus === 'Delayed' || r.delayMinutes > 0) {
    alerts.push({ type: 'delay', tone: 'warning', message: `Running ${r.delayMinutes} minute${r.delayMinutes === 1 ? '' : 's'} late` });
  }
  if (['At campus', 'Completed'].includes(r.runStatus) && r.onboardNow > 0) {
    alerts.push({ type: 'reconcile', tone: 'critical', message: `${r.onboardNow} student${r.onboardNow === 1 ? '' : 's'} not yet confirmed off the bus` });
  }
  const { stopsPassed: _p, ...rest } = r;
  return {
    ...rest,
    stopsDone,
    deviationMetres,
    alerts,
    location: r.latitude != null ? { latitude: Number(r.latitude), longitude: Number(r.longitude), speedKmph: r.speedKmph, heading: r.heading, recordedAt: r.locationAt } : null,
    path: stops.map((s) => ({ name: s.name, latitude: Number(s.latitude), longitude: Number(s.longitude), pickupTime: s.pickupTime })),
  };
}

export async function listRoutes(f: { campusId?: string; q?: string }) {
  const w = new Where();
  w.addIf(f.campusId, 'tr.campus_id = ?');
  if (f.q) w.add('(tr.code ILIKE ? OR tr.name ILIKE ? OR tr.area ILIKE ?)', likeTerm(f.q), likeTerm(f.q), likeTerm(f.q));
  const rows = await many(`${ROUTE_SELECT} ${w.sql} ORDER BY tr.campus_id, tr.code`, w.params);
  const stops = await stopsFor(rows.map((r) => r.id));
  const routes = rows.map((r) => decorate(r, stops.filter((s) => s.routeId === r.id)));
  const cw = new Where();
  cw.add('c.is_active');
  cw.addIf(f.campusId, 'c.id = ?');
  const campuses = await many(
    `SELECT c.id, c.name, c.short_name AS "shortName", c.latitude, c.longitude, g.radius_m AS "radiusM"
       FROM campuses c LEFT JOIN geofences g ON g.campus_id = c.id AND g.zone_type = 'campus' ${cw.sql} ORDER BY c.name`,
    cw.params,
  );
  return {
    routes,
    campuses,
    summary: {
      buses: routes.length,
      students: routes.reduce((a, r) => a + r.students, 0),
      onboardNow: routes.reduce((a, r) => a + r.onboardNow, 0),
      atCampus: routes.filter((r) => ['At campus', 'Completed'].includes(r.runStatus)).length,
      moving: routes.filter((r) => MOVING.has(r.runStatus)).length,
      delayed: routes.filter((r) => r.runStatus === 'Delayed').length,
      maintenance: routes.filter((r) => r.runStatus === 'Maintenance').length,
      alerts: routes.reduce((a, r) => a + r.alerts.length, 0),
    },
    generatedAt: new Date().toISOString(),
  };
}

async function routeRow(id: string, db?: Queryable) {
  const r = await one(`${ROUTE_SELECT} WHERE tr.id = $1`, [id], db);
  if (!r) throw notFound('Route not found', 'ROUTE_NOT_FOUND');
  return r;
}

/** Route detail: stops, assigned students (scoped), today's boarding and GPS trail. */
export async function routeDetail(user: AuthUser, id: string) {
  const r = await routeRow(id);
  const stops = await stopsFor([id]);
  const w = new Where();
  w.add('st.route_id = ?', id);
  w.add(ACTIVE_STUDENT);
  safetyStudentScope(user, w);
  const students = await many(
    `SELECT s.id, s.admission_no AS "admissionNo", s.full_name AS "fullName", c.name AS grade, sec.name AS section,
            st.stop_id AS "stopId", rs.name AS "stopName", rs.sequence AS "stopSequence", st.mode,
            to_char(rs.pickup_time, 'HH24:MI') AS "pickupTime",
            b.boarded_at AS "boardedAt", b.deboarded_at AS "deboardedAt", b.last_type AS "lastEvent", b.method
       FROM student_transport st
       JOIN students s ON s.id = st.student_id
       LEFT JOIN sections sec ON sec.id = s.section_id
       LEFT JOIN classes c ON c.id = sec.class_id
       LEFT JOIN route_stops rs ON rs.id = st.stop_id
       LEFT JOIN LATERAL (
         SELECT min(be.occurred_at) FILTER (WHERE be.event_type = 'boarded') AS boarded_at,
                max(be.occurred_at) FILTER (WHERE be.event_type = 'deboarded') AS deboarded_at,
                (array_agg(be.event_type ORDER BY be.occurred_at DESC))[1] AS last_type,
                (array_agg(be.method ORDER BY be.occurred_at DESC))[1] AS method
           FROM boarding_events be
          WHERE be.student_id = s.id AND be.route_id = st.route_id AND ${localDate('be.occurred_at')} = ${TODAY}
       ) b ON true
      ${w.sql}
      ORDER BY rs.sequence NULLS LAST, s.full_name`,
    w.params,
  );
  const trail = r.vehicleId
    ? await many(
      `SELECT latitude, longitude, speed_kmph AS "speedKmph", recorded_at AS "recordedAt"
         FROM vehicle_locations WHERE vehicle_id = $1 AND ${localDate('recorded_at')} = ${TODAY}
        ORDER BY recorded_at, id LIMIT 500`, [r.vehicleId])
    : [];
  const decorated = decorate(r, stops);
  const doneAll = ['At campus', 'Completed'].includes(r.runStatus);
  const stopList = stops.map((s, i) => {
    const here = students.filter((x) => x.stopId === s.id);
    const boardedHere = here.filter((x) => x.boardedAt).length;
    return {
      ...s,
      latitude: Number(s.latitude), longitude: Number(s.longitude),
      students: here.length,
      boarded: boardedHere,
      done: doneAll || (MOVING.has(r.runStatus) && i < decorated.stopsDone),
    };
  });
  return { ...decorated, stopList, students, trail };
}

// =============================================================================
// Run status
// =============================================================================
async function routeStudentIds(routeId: string, db?: Queryable) {
  return (await many<{ id: string }>(
    `SELECT s.id FROM student_transport st JOIN students s ON s.id = st.student_id WHERE st.route_id = $1 AND ${ACTIVE_STUDENT}`,
    [routeId], db,
  )).map((x) => x.id);
}

export async function updateRun(req: Request, id: string, input: { runStatus: string; delayMinutes: number; etaText?: string; reason?: string; notifyParents: boolean }) {
  return tx(async (db) => {
    const prev = await one<{ run_status: string; delay_minutes: number; name: string; bus_no: string | null }>(
      `SELECT tr.run_status, tr.delay_minutes, tr.name, v.bus_no FROM transport_routes tr LEFT JOIN vehicles v ON v.id = tr.vehicle_id WHERE tr.id = $1 FOR UPDATE OF tr`,
      [id], db,
    );
    if (!prev) throw notFound('Route not found', 'ROUTE_NOT_FOUND');
    let delay = input.delayMinutes;
    if (['At campus', 'Completed', 'Scheduled', 'Maintenance'].includes(input.runStatus)) delay = 0;
    if (input.runStatus === 'Delayed' && delay < 1) {
      throw badRequest('Enter how many minutes the bus is delayed', 'DELAY_REQUIRED', [{ field: 'delayMinutes', message: 'Required for a delayed run' }]);
    }
    const nowText = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
    const eta = input.etaText
      ?? (input.runStatus === 'At campus' ? `Arrived ${nowText}` : input.runStatus === 'Maintenance' ? 'Depot'
        : input.runStatus === 'Completed' ? `Completed ${nowText}` : input.runStatus === 'Delayed' ? `${delay} min late` : null);
    await query(
      `UPDATE transport_routes SET run_status = $2, delay_minutes = $3, eta_text = COALESCE($4, eta_text) WHERE id = $1`,
      [id, input.runStatus, delay, eta], db,
    );
    const bus = prev.bus_no ?? prev.name;
    let notified = 0;
    const delayChanged = delay > 0 && (delay !== prev.delay_minutes || prev.run_status !== input.runStatus);
    if (input.notifyParents && (delayChanged || (input.runStatus === 'Maintenance' && prev.run_status !== 'Maintenance'))) {
      const title = input.runStatus === 'Maintenance'
        ? `${bus} (${prev.name}) is out of service today`
        : `${bus} (${prev.name}) is running ${delay} minutes late`;
      const body = [input.reason, input.runStatus === 'Maintenance' ? 'Please arrange alternative transport; the front office will call you.' : 'Pickup times at every stop move by the same amount.']
        .filter(Boolean).join(' · ');
      for (const sid of await routeStudentIds(id, db)) {
        const ids = await notifyGuardians(sid, {
          category: 'Attention', icon: 'bus', topic: 'transport', title, body, route: PARENT_ROUTE, entityType: 'transport_route', entityId: id,
        }, db);
        notified += ids.length;
      }
    }
    await audit(req, {
      action: 'update', module: 'transport',
      description: `${prev.name}: ${prev.run_status} → ${input.runStatus}${delay ? ` (+${delay} min)` : ''}${notified ? `, ${notified} parents notified` : ''}`,
      entityType: 'transport_route', entityId: id, metadata: { ...input, delay },
    }, db);
    return { id, runStatus: input.runStatus, delayMinutes: delay, eta, parentsNotified: notified };
  });
}

export async function notifyRouteParents(req: Request, id: string, message: string) {
  return tx(async (db) => {
    const r = await one<{ name: string; bus_no: string | null }>(
      'SELECT tr.name, v.bus_no FROM transport_routes tr LEFT JOIN vehicles v ON v.id = tr.vehicle_id WHERE tr.id = $1', [id], db,
    );
    if (!r) throw notFound('Route not found', 'ROUTE_NOT_FOUND');
    let notified = 0;
    const students = await routeStudentIds(id, db);
    for (const sid of students) {
      notified += (await notifyGuardians(sid, {
        category: 'Information', icon: 'bus', topic: 'transport', title: `${r.bus_no ?? r.name} · ${r.name}`, body: message,
        route: PARENT_ROUTE, entityType: 'transport_route', entityId: id,
      }, db)).length;
    }
    await audit(req, {
      action: 'notify', module: 'transport', description: `Messaged parents on ${r.name} (${notified} recipients)`,
      entityType: 'transport_route', entityId: id, metadata: { message },
    }, db);
    return { students: students.length, parentsNotified: notified };
  });
}

// =============================================================================
// Routes, stops and assignments (CRUD)
// =============================================================================
export interface RouteInput {
  code?: string; name?: string; area?: string; campusId?: string;
  vehicleId?: string | null; driverId?: string | null; attendantId?: string | null;
}

async function checkRefs(input: RouteInput, db: Queryable) {
  if (input.driverId) await assertEmployee(input.driverId, db);
  if (input.attendantId) await assertEmployee(input.attendantId, db);
  if (input.vehicleId) {
    const v = await one('SELECT 1 FROM vehicles WHERE id = $1', [input.vehicleId], db);
    if (!v) throw badRequest('Unknown vehicle', 'VEHICLE_NOT_FOUND');
  }
}

export async function createRoute(req: Request, input: Required<Pick<RouteInput, 'code' | 'name' | 'area' | 'campusId'>> & RouteInput) {
  try {
    const id = await tx(async (db) => {
      await checkRefs(input, db);
      const r = await one<{ id: string }>(
        `INSERT INTO transport_routes (campus_id, code, name, area, vehicle_id, driver_id, attendant_id, run_status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'Scheduled') RETURNING id`,
        [input.campusId, input.code, input.name, input.area, input.vehicleId ?? null, input.driverId ?? null, input.attendantId ?? null], db,
      );
      await audit(req, { action: 'create', module: 'transport', description: `Created route ${input.code} — ${input.name}`, entityType: 'transport_route', entityId: r!.id }, db);
      return r!.id;
    });
    return routeRow(id);
  } catch (err) {
    mapPgError(err, { unique: 'A route with this code already exists', foreign: 'Unknown campus, vehicle or staff member' });
  }
}

const ROUTE_COLS: Record<string, string> = {
  code: 'code', name: 'name', area: 'area', campusId: 'campus_id', vehicleId: 'vehicle_id', driverId: 'driver_id', attendantId: 'attendant_id',
};

export async function updateRoute(req: Request, id: string, input: RouteInput) {
  try {
    await tx(async (db) => {
      await checkRefs(input, db);
      const sets: string[] = [];
      const params: unknown[] = [id];
      for (const [k, col] of Object.entries(ROUTE_COLS)) {
        if (k in input) {
          params.push((input as Record<string, unknown>)[k] ?? null);
          sets.push(`${col} = $${params.length}`);
        }
      }
      const r = await query(`UPDATE transport_routes SET ${sets.join(', ')} WHERE id = $1`, params, db);
      if (!r.rowCount) throw notFound('Route not found', 'ROUTE_NOT_FOUND');
      await audit(req, { action: 'update', module: 'transport', description: `Updated route ${input.code ?? ''}`.trim(), entityType: 'transport_route', entityId: id, metadata: { ...input } }, db);
    });
    return routeRow(id);
  } catch (err) {
    mapPgError(err, { unique: 'A route with this code already exists', foreign: 'Unknown campus, vehicle or staff member' });
  }
}

export async function deleteRoute(req: Request, id: string) {
  return tx(async (db) => {
    const r = await one<{ code: string; name: string }>('SELECT code, name FROM transport_routes WHERE id = $1', [id], db);
    if (!r) throw notFound('Route not found', 'ROUTE_NOT_FOUND');
    const use = await one<{ students: number; events: number }>(
      `SELECT (SELECT count(*) FROM student_transport WHERE route_id = $1)::int AS students,
              (SELECT count(*) FROM boarding_events WHERE route_id = $1)::int AS events`, [id], db,
    );
    if (use!.students) throw conflict(`${r.name} still has ${use!.students} students assigned. Move them to another route first.`, 'ROUTE_IN_USE');
    if (use!.events) throw conflict(`${r.name} has boarding history and cannot be deleted. Set it to Maintenance instead.`, 'ROUTE_HAS_HISTORY');
    await query('DELETE FROM transport_routes WHERE id = $1', [id], db);
    await audit(req, { action: 'delete', module: 'transport', description: `Deleted route ${r.code} — ${r.name}`, entityType: 'transport_route', entityId: id }, db);
    return { id, deleted: true };
  });
}

export async function listVehicles(campusId?: string) {
  const w = new Where();
  w.addIf(campusId, 'v.campus_id = ?');
  return many(
    `SELECT v.id, v.bus_no AS "busNo", v.registration_no AS "registrationNo", v.capacity, v.status, v.campus_id AS "campusId",
            v.fitness_expiry AS "fitnessExpiry", v.insurance_expiry AS "insuranceExpiry",
            (SELECT tr.code FROM transport_routes tr WHERE tr.vehicle_id = v.id LIMIT 1) AS "routeCode"
       FROM vehicles v ${w.sql} ORDER BY v.bus_no`,
    w.params,
  );
}

async function resequence(routeId: string, orderedIds: string[], db: Queryable) {
  await query('UPDATE route_stops SET sequence = -sequence - 1000 WHERE route_id = $1', [routeId], db);
  for (let i = 0; i < orderedIds.length; i++) {
    await query('UPDATE route_stops SET sequence = $3 WHERE id = $1 AND route_id = $2', [orderedIds[i], routeId, i + 1], db);
  }
}

export interface StopInput { name?: string; latitude?: number; longitude?: number; pickupTime?: string; dropTime?: string | null }

export async function addStop(req: Request, routeId: string, input: Required<Omit<StopInput, 'dropTime'>> & StopInput) {
  return tx(async (db) => {
    const r = await one<{ name: string }>('SELECT name FROM transport_routes WHERE id = $1 FOR UPDATE', [routeId], db);
    if (!r) throw notFound('Route not found', 'ROUTE_NOT_FOUND');
    const s = await one(
      `INSERT INTO route_stops (route_id, sequence, name, latitude, longitude, pickup_time, drop_time)
       VALUES ($1, (SELECT COALESCE(max(sequence), 0) + 1 FROM route_stops WHERE route_id = $1), $2, $3, $4, $5, $6)
       RETURNING id, sequence, name, latitude, longitude, to_char(pickup_time, 'HH24:MI') AS "pickupTime", to_char(drop_time, 'HH24:MI') AS "dropTime"`,
      [routeId, input.name, input.latitude, input.longitude, input.pickupTime, input.dropTime ?? null], db,
    );
    await audit(req, { action: 'create', module: 'transport', description: `Added stop ${input.name} to ${r.name}`, entityType: 'route_stop', entityId: s.id }, db);
    return s;
  });
}

const STOP_COLS: Record<string, string> = { name: 'name', latitude: 'latitude', longitude: 'longitude', pickupTime: 'pickup_time', dropTime: 'drop_time' };

export async function updateStop(req: Request, routeId: string, stopId: string, input: StopInput) {
  return tx(async (db) => {
    const sets: string[] = [];
    const params: unknown[] = [stopId, routeId];
    for (const [k, col] of Object.entries(STOP_COLS)) {
      if (k in input) {
        params.push((input as Record<string, unknown>)[k] ?? null);
        sets.push(`${col} = $${params.length}`);
      }
    }
    const s = await one(
      `UPDATE route_stops SET ${sets.join(', ')} WHERE id = $1 AND route_id = $2
       RETURNING id, sequence, name, latitude, longitude, to_char(pickup_time, 'HH24:MI') AS "pickupTime", to_char(drop_time, 'HH24:MI') AS "dropTime"`,
      params, db,
    );
    if (!s) throw notFound('Stop not found', 'STOP_NOT_FOUND');
    await audit(req, { action: 'update', module: 'transport', description: `Updated stop ${s.name}`, entityType: 'route_stop', entityId: stopId, metadata: { ...input } }, db);
    return s;
  });
}

export async function deleteStop(req: Request, routeId: string, stopId: string) {
  return tx(async (db) => {
    const s = await one<{ name: string }>('SELECT name FROM route_stops WHERE id = $1 AND route_id = $2', [stopId, routeId], db);
    if (!s) throw notFound('Stop not found', 'STOP_NOT_FOUND');
    const used = await one<{ n: number }>('SELECT count(*)::int AS n FROM student_transport WHERE stop_id = $1', [stopId], db);
    if (used!.n) throw conflict(`${used!.n} student${used!.n === 1 ? ' uses' : 's use'} ${s.name}. Move them to another stop first.`, 'STOP_IN_USE');
    await query('UPDATE boarding_events SET stop_id = NULL WHERE stop_id = $1', [stopId], db);
    await query('DELETE FROM route_stops WHERE id = $1', [stopId], db);
    const rest = await many<{ id: string }>('SELECT id FROM route_stops WHERE route_id = $1 ORDER BY sequence', [routeId], db);
    await resequence(routeId, rest.map((x) => x.id), db);
    await audit(req, { action: 'delete', module: 'transport', description: `Removed stop ${s.name}`, entityType: 'route_stop', entityId: stopId }, db);
    return { id: stopId, deleted: true };
  });
}

export async function reorderStops(req: Request, routeId: string, stopIds: string[]) {
  return tx(async (db) => {
    const current = await many<{ id: string }>('SELECT id FROM route_stops WHERE route_id = $1', [routeId], db);
    const set = new Set(current.map((x) => x.id));
    if (current.length !== stopIds.length || new Set(stopIds).size !== stopIds.length || !stopIds.every((x) => set.has(x))) {
      throw badRequest('Send every stop of this route exactly once', 'STOP_ORDER_INVALID');
    }
    await resequence(routeId, stopIds, db);
    await audit(req, { action: 'update', module: 'transport', description: 'Reordered route stops', entityType: 'transport_route', entityId: routeId }, db);
    return stopsFor([routeId], db);
  });
}

export async function assignStudent(req: Request, routeId: string, input: { studentId: string; stopId?: string | null; mode: string }) {
  const studentId = await authorizeSafetyStudent(req, input.studentId);
  return tx(async (db) => {
    const r = await one<{ name: string }>('SELECT name FROM transport_routes WHERE id = $1', [routeId], db);
    if (!r) throw notFound('Route not found', 'ROUTE_NOT_FOUND');
    if (input.stopId) {
      const st = await one('SELECT 1 FROM route_stops WHERE id = $1 AND route_id = $2', [input.stopId, routeId], db);
      if (!st) throw badRequest('The stop does not belong to this route', 'STOP_NOT_ON_ROUTE', [{ field: 'stopId', message: 'Choose a stop on this route' }]);
    }
    const s = await studentBrief(studentId, db);
    await query(
      `INSERT INTO student_transport (student_id, route_id, stop_id, mode, valid_from) VALUES ($1,$2,$3,$4, ${TODAY})
       ON CONFLICT (student_id) DO UPDATE SET route_id = EXCLUDED.route_id, stop_id = EXCLUDED.stop_id, mode = EXCLUDED.mode, valid_from = EXCLUDED.valid_from`,
      [studentId, routeId, input.stopId ?? null, input.mode], db,
    );
    await notifyGuardians(studentId, {
      category: 'Information', icon: 'bus', topic: 'transport', title: `${s.full_name} is now assigned to ${r.name}`,
      route: PARENT_ROUTE, entityType: 'student', entityId: studentId,
    }, db);
    await audit(req, { action: 'update', module: 'transport', description: `Assigned ${s.full_name} to ${r.name}`, entityType: 'student', entityId: studentId, metadata: { routeId, stopId: input.stopId } }, db);
    return { studentId, routeId, stopId: input.stopId ?? null, mode: input.mode };
  });
}

export async function unassignStudent(req: Request, routeId: string, studentRef: string) {
  const studentId = await authorizeSafetyStudent(req, studentRef);
  return tx(async (db) => {
    const r = await query('DELETE FROM student_transport WHERE student_id = $1 AND route_id = $2', [studentId, routeId], db);
    if (!r.rowCount) throw notFound('The student is not assigned to this route', 'NOT_ON_ROUTE');
    const s = await studentBrief(studentId, db);
    await audit(req, { action: 'delete', module: 'transport', description: `Removed ${s.full_name} from route`, entityType: 'student', entityId: studentId, metadata: { routeId } }, db);
    return { studentId, routeId, removed: true };
  });
}

// =============================================================================
// Boarding
// =============================================================================
export async function boardingSummary(campusId?: string) {
  const w = new Where();
  w.addIf(campusId, 'tr.campus_id = ?');
  const rows = await many(`${ROUTE_SELECT} ${w.sql} ORDER BY tr.code`, w.params);
  const running = rows.filter((r) => r.runStatus !== 'Maintenance');
  const recon = rows.map((r) => {
    const notBoarded = r.runStatus === 'Maintenance' ? 0 : Math.max(0, r.students - r.boardedToday);
    const stillOnboard = r.onboardNow;
    return {
      id: r.id, code: r.code, name: r.name, area: r.area, busNo: r.busNo, runStatus: r.runStatus, attendantName: r.attendantName,
      expected: r.students, boarded: r.boardedToday, deboarded: r.deboardedToday, notBoarded, stillOnboard,
      state: r.runStatus === 'Maintenance' ? 'Not running' : notBoarded === 0 && stillOnboard === 0 ? 'Matched' : stillOnboard > 0 && ['At campus', 'Completed'].includes(r.runStatus) ? 'Exception' : notBoarded > 0 ? 'Not boarded' : 'In progress',
    };
  });
  const cw = new Where();
  cw.addIf(campusId, 'tr.campus_id = ?');
  const afternoon = await one<{ t: string | null }>(
    `SELECT to_char(min(rs.drop_time), 'HH24:MI') AS t FROM route_stops rs JOIN transport_routes tr ON tr.id = rs.route_id
      ${cw.sql} ${cw.sql ? 'AND' : 'WHERE'} tr.run_status <> 'Maintenance'`,
    cw.params,
  );
  const maintStudents = rows.filter((r) => r.runStatus === 'Maintenance').reduce((a, r) => a + r.students, 0);
  return {
    boarded: running.reduce((a, r) => a + r.boardedToday, 0),
    deboarded: running.reduce((a, r) => a + r.deboardedToday, 0),
    stillOnboard: running.reduce((a, r) => a + r.onboardNow, 0),
    notBoarded: recon.reduce((a, r) => a + r.notBoarded, 0),
    expected: running.reduce((a, r) => a + r.students, 0),
    maintenanceStudents: maintStudents,
    afternoonRun: afternoon?.t ?? null,
    routes: recon,
  };
}

export async function recordBoarding(req: Request, input: { studentId: string; routeId: string; eventType: 'boarded' | 'deboarded'; stopId?: string | null; method: string }) {
  const studentId = await authorizeSafetyStudent(req, input.studentId);
  return tx(async (db) => {
    const assign = await one<{ stop_id: string | null; route_name: string; bus_no: string | null; stop_name: string | null }>(
      `SELECT st.stop_id, tr.name AS route_name, v.bus_no, rs.name AS stop_name
         FROM student_transport st JOIN transport_routes tr ON tr.id = st.route_id
         LEFT JOIN vehicles v ON v.id = tr.vehicle_id LEFT JOIN route_stops rs ON rs.id = st.stop_id
        WHERE st.student_id = $1 AND st.route_id = $2`,
      [studentId, input.routeId], db,
    );
    if (!assign) throw badRequest('The student is not assigned to this route', 'NOT_ON_ROUTE');
    if (input.stopId) {
      const st = await one('SELECT 1 FROM route_stops WHERE id = $1 AND route_id = $2', [input.stopId, input.routeId], db);
      if (!st) throw badRequest('The stop does not belong to this route', 'STOP_NOT_ON_ROUTE');
    }
    const s = await studentBrief(studentId, db);
    // Serialise confirmations for the same child.
    await query('SELECT pg_advisory_xact_lock(hashtext($1))', [`boarding:${studentId}`], db);
    const last = await one<{ event_type: string }>(
      `SELECT event_type FROM boarding_events WHERE student_id = $1 AND route_id = $2 AND ${localDate('occurred_at')} = ${TODAY}
        ORDER BY occurred_at DESC LIMIT 1`,
      [studentId, input.routeId], db,
    );
    if (last?.event_type === input.eventType) {
      throw conflict(`${s.full_name} is already marked as ${input.eventType === 'boarded' ? 'on the bus' : 'off the bus'}`, 'BOARDING_DUPLICATE');
    }
    if (input.eventType === 'deboarded' && !last) {
      throw conflict(`${s.full_name} has not been marked as boarded today`, 'BOARDING_NOT_BOARDED');
    }
    const stopId = input.stopId !== undefined ? input.stopId : input.eventType === 'boarded' ? assign.stop_id : null;
    const stopName = stopId ? (await one<{ name: string }>('SELECT name FROM route_stops WHERE id = $1', [stopId], db))?.name : null;
    const ev = await one(
      `INSERT INTO boarding_events (student_id, route_id, stop_id, event_type, occurred_at, confirmed_by, method, parent_notified_at)
       VALUES ($1,$2,$3,$4, now(), $5, $6, now())
       RETURNING id, event_type AS "eventType", occurred_at AS "occurredAt", method`,
      [studentId, input.routeId, stopId, input.eventType, req.user!.employeeId, input.method], db,
    );
    const bus = assign.bus_no ?? assign.route_name;
    const where = stopName ?? (input.eventType === 'deboarded' ? 'campus' : assign.route_name);
    await notifyGuardians(studentId, {
      category: input.eventType === 'boarded' ? 'Information' : 'Completed', icon: 'bus', topic: 'transport',
      title: input.eventType === 'boarded' ? `${s.full_name} boarded ${bus}` : `${s.full_name} got off ${bus}`,
      body: `${where} · ${hhmm(ev.occurredAt)} · confirmed by the attendant`,
      route: PARENT_ROUTE, entityType: 'student', entityId: studentId,
    }, db);
    await audit(req, {
      action: 'create', module: 'transport', description: `${s.full_name} ${input.eventType} ${bus} (${input.method})`,
      entityType: 'student', entityId: studentId, metadata: { routeId: input.routeId, stopId },
    }, db);
    return { ...ev, studentId, stopId, stopName };
  });
}

// =============================================================================
// Family view
// =============================================================================
export async function familyBus(studentId: string) {
  const r = await one(
    `SELECT tr.id, tr.name AS "routeName", tr.run_status AS "runStatus", tr.delay_minutes AS "delayMinutes", tr.eta_text AS eta,
            v.id AS "vehicleId", v.bus_no AS "busNo", d.full_name AS driver, a.full_name AS attendant,
            rs.name AS "stopName", to_char(rs.pickup_time, 'HH24:MI') AS "pickupTime", to_char(rs.drop_time, 'HH24:MI') AS "dropTime"
       FROM student_transport st
       JOIN transport_routes tr ON tr.id = st.route_id
       LEFT JOIN vehicles v ON v.id = tr.vehicle_id
       LEFT JOIN employees d ON d.id = tr.driver_id
       LEFT JOIN employees a ON a.id = tr.attendant_id
       LEFT JOIN route_stops rs ON rs.id = st.stop_id
      WHERE st.student_id = $1`,
    [studentId],
  );
  if (!r) return null;
  const [boardingToday, loc, stops] = await Promise.all([
    many(
      `SELECT be.id, be.event_type AS "eventType", be.occurred_at AS "occurredAt", be.method, rs.name AS "stopName"
         FROM boarding_events be LEFT JOIN route_stops rs ON rs.id = be.stop_id
        WHERE be.student_id = $1 AND ${localDate('be.occurred_at')} = ${TODAY} ORDER BY be.occurred_at`,
      [studentId],
    ),
    r.vehicleId
      ? one(`SELECT latitude, longitude, recorded_at AS "recordedAt" FROM vehicle_locations WHERE vehicle_id = $1 ORDER BY recorded_at DESC, id DESC LIMIT 1`, [r.vehicleId])
      : null,
    many(
      `SELECT name, latitude, longitude, to_char(pickup_time, 'HH24:MI') AS "pickupTime" FROM route_stops WHERE route_id = $1 ORDER BY sequence`,
      [r.id],
    ),
  ]);
  const { id: _id, vehicleId: _v, ...rest } = r;
  return {
    ...rest,
    boardingToday,
    busLocation: loc ? { latitude: Number(loc.latitude), longitude: Number(loc.longitude), recordedAt: loc.recordedAt } : null,
    stops: stops.map((s) => ({ ...s, latitude: Number(s.latitude), longitude: Number(s.longitude) })),
  };
}
