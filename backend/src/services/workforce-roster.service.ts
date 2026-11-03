import type { Request } from 'express';
import { many, one, query, tx } from '../config/db.js';
import { Where } from '../utils/sql.js';
import { likeTerm, limitOffset, orderBy, type Pagination } from '../utils/pagination.js';
import { badRequest, notFound } from '../utils/errors.js';
import { audit } from './audit.service.js';
import { notifyRoles, notifyUsers } from './notification.service.js';
import { ACTIVE, TODAY, guardUnique, todayKolkata } from './workforce.service.js';

export function mondayOf(date: string) {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + (dow === 0 ? -6 : 1 - dow));
  return d.toISOString().slice(0, 10);
}
export const plusDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Shifts
// ---------------------------------------------------------------------------
export async function listShifts(campusId?: string) {
  return many(
    `SELECT s.id, s.name, to_char(s.starts_at, 'HH24:MI') AS "startsAt", to_char(s.ends_at, 'HH24:MI') AS "endsAt",
            to_char(s.split_starts_at, 'HH24:MI') AS "splitStartsAt", to_char(s.split_ends_at, 'HH24:MI') AS "splitEndsAt",
            (SELECT count(*) FROM employees e WHERE e.shift_name = s.name AND ${ACTIVE} AND ($1::uuid IS NULL OR e.campus_id = $1))::int AS employees,
            (SELECT count(*) FROM shift_rosters r JOIN employees e ON e.id = r.employee_id
              WHERE r.shift_id = s.id AND r.roster_date = ${TODAY} AND ($1::uuid IS NULL OR e.campus_id = $1))::int AS "rosteredToday"
       FROM shifts s ORDER BY s.starts_at, s.name`,
    [campusId ?? null],
  );
}

export async function saveShift(req: Request, id: string | null, b: { name: string; startsAt: string; endsAt: string; splitStartsAt?: string | null; splitEndsAt?: string | null }) {
  return guardUnique(() => tx(async (db) => {
    let row;
    if (id) {
      const before = await one<{ name: string }>('SELECT name FROM shifts WHERE id = $1 FOR UPDATE', [id], db);
      if (!before) throw notFound('Shift not found', 'SHIFT_NOT_FOUND');
      row = await one(
        `UPDATE shifts SET name = $2, starts_at = $3, ends_at = $4, split_starts_at = $5, split_ends_at = $6 WHERE id = $1 RETURNING id, name`,
        [id, b.name, b.startsAt, b.endsAt, b.splitStartsAt ?? null, b.splitEndsAt ?? null], db,
      );
      if (before.name !== b.name) await query('UPDATE employees SET shift_name = $1 WHERE shift_name = $2', [b.name, before.name], db);
    } else {
      row = await one(
        `INSERT INTO shifts (name, starts_at, ends_at, split_starts_at, split_ends_at) VALUES ($1,$2,$3,$4,$5) RETURNING id, name`,
        [b.name, b.startsAt, b.endsAt, b.splitStartsAt ?? null, b.splitEndsAt ?? null], db,
      );
    }
    await audit(req, { action: id ? 'update' : 'create', module: 'workforce', description: `${id ? 'Updated' : 'Created'} shift ${b.name}`, entityType: 'shift', entityId: row!.id }, db);
    return row;
  }), 'A shift with this name already exists');
}

// ---------------------------------------------------------------------------
// Roster
// ---------------------------------------------------------------------------
export const ROSTER_ROW_SQL = `
  SELECT r.id, r.roster_date AS date, r.post, split_part(r.post, ' · ', 1) AS "group",
         NULLIF(split_part(r.post, ' · ', 2), '') AS duty, r.status,
         e.id AS "employeeId", e.full_name AS "employeeName", e.designation, e.campus_id AS "campusId",
         s.id AS "shiftId", s.name AS "shiftName",
         c.id AS "coveredById", c.full_name AS "coveredByName",
         sa.status AS attendance
    FROM shift_rosters r
    JOIN employees e ON e.id = r.employee_id
    JOIN shifts s ON s.id = r.shift_id
    LEFT JOIN employees c ON c.id = r.covered_by
    LEFT JOIN staff_attendance sa ON sa.employee_id = r.employee_id AND sa.attendance_date = r.roster_date`;

export async function getRoster(weekStart: string | undefined, campusId?: string) {
  const start = mondayOf(weekStart ?? todayKolkata());
  const days = Array.from({ length: 6 }, (_, i) => plusDays(start, i) as string);
  const w = new Where().add('e.deleted_at IS NULL');
  w.add('r.roster_date BETWEEN ? AND ?', days[0], days[5]);
  w.addIf(campusId, 'e.campus_id = ?');
  const entries = await many(`${ROSTER_ROW_SQL} ${w.sql} ORDER BY r.post, e.full_name`, w.params);
  const groups = [...new Set(entries.map((x) => x.group as string))].sort();
  const gaps = entries.filter((x) => x.status === 'Cover needed');
  // Rostered but absent / on leave, and not yet flagged or covered.
  const attention = entries.filter((x) => x.status === 'Scheduled' && ['Absent', 'On Leave'].includes(x.attendance));
  return { weekStart: start, days, groups, entries, gaps, attention, today: todayKolkata() };
}

export async function upsertRosterEntry(req: Request, b: { employeeId: string; shiftId: string; date: string; post: string }) {
  return tx(async (db) => {
    const e = await one<{ full_name: string }>(`SELECT full_name FROM employees e WHERE e.id = $1 AND ${ACTIVE}`, [b.employeeId], db);
    if (!e) throw notFound('Employee not found', 'EMPLOYEE_NOT_FOUND');
    const s = await one('SELECT 1 FROM shifts WHERE id = $1', [b.shiftId], db);
    if (!s) throw badRequest('Shift not found', 'SHIFT_NOT_FOUND');
    const row = await one(
      `INSERT INTO shift_rosters (employee_id, shift_id, roster_date, post, status)
       VALUES ($1, $2, $3, $4, CASE WHEN $3::date < ${TODAY} THEN 'Completed' ELSE 'Scheduled' END)
       ON CONFLICT (employee_id, roster_date) DO UPDATE
         SET shift_id = EXCLUDED.shift_id, post = EXCLUDED.post, status = EXCLUDED.status, covered_by = NULL
       RETURNING id`,
      [b.employeeId, b.shiftId, b.date, b.post], db,
    );
    await audit(req, { action: 'update', module: 'workforce', description: `Rostered ${e.full_name} on ${b.date} — ${b.post}`, entityType: 'shift_roster', entityId: row!.id }, db);
    return row;
  });
}

export async function deleteRosterEntry(req: Request, id: string) {
  const r = await one<{ post: string; roster_date: string }>('DELETE FROM shift_rosters WHERE id = $1 RETURNING post, roster_date', [id]);
  if (!r) throw notFound('Roster entry not found', 'ROSTER_NOT_FOUND');
  await audit(req, { action: 'delete', module: 'workforce', description: `Removed roster line ${r.post} on ${r.roster_date}`, entityType: 'shift_roster', entityId: id });
}

export async function flagCover(req: Request, id: string, reason?: string | null) {
  return tx(async (db) => {
    const r = await one(`${ROSTER_ROW_SQL} WHERE r.id = $1 FOR UPDATE OF r`, [id], db);
    if (!r) throw notFound('Roster entry not found', 'ROSTER_NOT_FOUND');
    if (r.date < todayKolkata()) throw badRequest('Past roster lines cannot be changed', 'ROSTER_PAST');
    if (r.status === 'Cover needed') throw badRequest('Cover is already requested for this line', 'ALREADY_FLAGGED');
    await query(`UPDATE shift_rosters SET status = 'Cover needed', covered_by = NULL WHERE id = $1`, [id], db);
    await audit(req, { action: 'update', module: 'workforce', description: `Flagged cover needed: ${r.post} on ${r.date} (${r.employeeName})${reason ? ` — ${reason}` : ''}`, entityType: 'shift_roster', entityId: id }, db);
    await notifyRoles(['hr'], {
      category: 'Attention', icon: 'shield', topic: 'shifts', route: '/shifts', entityType: 'shift_roster', entityId: id,
      title: `Cover needed — ${r.group} on ${r.date}`, body: `${r.employeeName} is unavailable${reason ? `: ${reason}` : ''}`,
    }, db);
  });
}

export async function assignCover(req: Request, id: string, coverEmployeeId: string) {
  return tx(async (db) => {
    const r = await one(`${ROSTER_ROW_SQL} WHERE r.id = $1 FOR UPDATE OF r`, [id], db);
    if (!r) throw notFound('Roster entry not found', 'ROSTER_NOT_FOUND');
    if (r.date < todayKolkata()) throw badRequest('Past roster lines cannot be changed', 'ROSTER_PAST');
    if (coverEmployeeId === r.employeeId) throw badRequest('Choose a different colleague to cover', 'VALIDATION_ERROR', [{ field: 'coverEmployeeId', message: 'Cannot cover their own shift' }]);
    const c = await one<{ full_name: string; user_id: string | null; status: string | null }>(
      `SELECT e.full_name, e.user_id, sa.status FROM employees e
         LEFT JOIN staff_attendance sa ON sa.employee_id = e.id AND sa.attendance_date = $2
        WHERE e.id = $1 AND ${ACTIVE}`,
      [coverEmployeeId, r.date], db,
    );
    if (!c) throw notFound('Cover employee not found', 'EMPLOYEE_NOT_FOUND');
    if (c.status && ['Absent', 'On Leave'].includes(c.status)) {
      throw badRequest(`${c.full_name} is ${c.status.toLowerCase()} on that date`, 'COVER_UNAVAILABLE');
    }
    const onLeave = await one(
      `SELECT 1 FROM leave_requests WHERE employee_id = $1 AND status = 'Approved' AND $2::date BETWEEN from_date AND to_date`,
      [coverEmployeeId, r.date], db,
    );
    if (onLeave) throw badRequest(`${c.full_name} has approved leave on that date`, 'COVER_UNAVAILABLE');
    await query(`UPDATE shift_rosters SET status = 'Covered', covered_by = $2 WHERE id = $1`, [id, coverEmployeeId], db);
    await audit(req, { action: 'update', module: 'workforce', description: `Assigned ${c.full_name} to cover ${r.post} on ${r.date} for ${r.employeeName}`, entityType: 'shift_roster', entityId: id }, db);
    if (c.user_id) {
      await notifyUsers([c.user_id], {
        category: 'Attention', icon: 'shield', topic: 'shifts', route: '/staff-self', entityType: 'shift_roster', entityId: id,
        title: `You are covering ${r.group} on ${r.date}`, body: `${r.shiftName} · in place of ${r.employeeName}`, channels: ['push'],
      }, db);
    }
    return { coveredBy: c.full_name };
  });
}

export async function publishRoster(req: Request, weekStart: string, campusId?: string) {
  const start = mondayOf(weekStart);
  const end = plusDays(start, 6) as string;
  const users = await many<{ user_id: string }>(
    `SELECT DISTINCT e.user_id FROM shift_rosters r JOIN employees e ON e.id = r.employee_id
      WHERE r.roster_date BETWEEN $1 AND $2 AND e.user_id IS NOT NULL AND ($3::uuid IS NULL OR e.campus_id = $3)`,
    [start, end, campusId ?? null],
  );
  const lines = await one<{ n: number }>(
    `SELECT count(*)::int AS n FROM shift_rosters r JOIN employees e ON e.id = r.employee_id
      WHERE r.roster_date BETWEEN $1 AND $2 AND ($3::uuid IS NULL OR e.campus_id = $3)`,
    [start, end, campusId ?? null],
  );
  if (!lines!.n) throw badRequest('There is nothing on the roster for that week', 'ROSTER_EMPTY');
  await notifyUsers(users.map((u) => u.user_id), {
    category: 'Information', icon: 'clock', topic: 'shifts', route: '/staff-self',
    title: `Roster published for the week of ${start}`, body: 'Open Staff Self-Service to see your shifts', channels: ['push'],
  });
  await audit(req, { action: 'update', module: 'workforce', description: `Published roster for week of ${start} (${lines!.n} lines)`, entityType: 'shift_roster', metadata: { weekStart: start, campusId } });
  return { lines: lines!.n, notified: users.length };
}

// ---------------------------------------------------------------------------
// Workload
// ---------------------------------------------------------------------------
export async function workload(campusId?: string) {
  const rows = await many(
    `SELECT e.id, e.employee_code AS code, e.full_name AS "fullName", e.designation, e.department, e.category,
            cp.short_name AS "campusName", e.campus_id AS "campusId",
            COALESCE(t.max_periods_week, 30) AS max, e.workload_periods AS recorded,
            COALESCE(ta.periods, 0)::int AS assigned, COALESCE(ta.sections, 0)::int AS sections, COALESCE(tt.periods, 0)::int AS timetabled,
            GREATEST(e.workload_periods, COALESCE(ta.periods, 0), COALESCE(tt.periods, 0))::int AS periods
       FROM employees e
       JOIN campuses cp ON cp.id = e.campus_id
       LEFT JOIN teachers t ON t.employee_id = e.id
       LEFT JOIN LATERAL (
         SELECT sum(a.periods_per_week) AS periods, count(*) AS sections
           FROM teacher_assignments a JOIN academic_years ay ON ay.id = a.academic_year_id AND ay.is_current
          WHERE a.employee_id = e.id) ta ON true
       LEFT JOIN LATERAL (SELECT count(*) AS periods FROM timetable_entries x WHERE x.employee_id = e.id) tt ON true
      WHERE ${ACTIVE} AND e.employee_type = 'teaching' AND ($1::uuid IS NULL OR e.campus_id = $1)
      ORDER BY periods DESC, e.full_name`,
    [campusId ?? null],
  );
  const withBand = rows.filter((r) => r.periods > 0).map((r) => ({
    ...r,
    band: r.periods > r.max ? 'over' : r.periods >= r.max - 3 ? 'near' : 'ok',
  }));
  const teachers = withBand.filter((r) => r.category === 'Teachers');
  const avg = teachers.length ? Math.round(teachers.reduce((a, r) => a + r.periods, 0) / teachers.length) : 0;
  const suggestions = withBand.filter((r) => r.band === 'over').map((o) => {
    const candidate = teachers.filter((t) => t.id !== o.id && t.band === 'ok').sort((a, b) => a.periods - b.periods)[0]
      ?? teachers.filter((t) => t.id !== o.id && t.periods < t.max).sort((a, b) => a.periods - b.periods)[0];
    return {
      employeeId: o.id,
      text: `${o.fullName} is at ${o.periods} periods, ${o.periods - o.max} above the agreed maximum of ${o.max}.` +
        (candidate ? ` Sections could move to ${candidate.fullName}, who is at ${candidate.periods}.` : ' No colleague currently has spare capacity.'),
    };
  });
  return {
    rows: withBand,
    kpis: {
      teachers: teachers.length,
      average: avg,
      over: withBand.filter((r) => r.band === 'over').length,
      near: withBand.filter((r) => r.band === 'near').length,
    },
    suggestions,
  };
}

// ---------------------------------------------------------------------------
// CPD
// ---------------------------------------------------------------------------
export const CPD_TARGET_TEACHING = 24;
export const CPD_TARGET_NON_TEACHING = 12;
export const MANDATORY_CPD = 'Child protection refresher';

const CPD_ROW = `
  SELECT e.id, e.employee_code AS code, e.full_name AS "fullName", e.designation, e.department, e.employee_type AS "employeeType",
         cp.short_name AS "campusName",
         COALESCE(c.hours, 0)::int AS hours,
         CASE WHEN e.employee_type = 'teaching' THEN ${CPD_TARGET_TEACHING} ELSE ${CPD_TARGET_NON_TEACHING} END AS target,
         COALESCE(c.planned, 0)::int AS planned,
         COALESCE(c.mandatory, false) AS "mandatoryComplete",
         c.last_completed AS "lastCompleted"
    FROM employees e
    JOIN campuses cp ON cp.id = e.campus_id
    LEFT JOIN LATERAL (
      SELECT sum(r.hours) FILTER (WHERE r.status = 'Completed') AS hours,
             count(*) FILTER (WHERE r.status <> 'Completed') AS planned,
             bool_or(r.programme = '${MANDATORY_CPD}' AND r.status = 'Completed') AS mandatory,
             max(r.completed_on) AS last_completed
        FROM cpd_records r WHERE r.employee_id = e.id) c ON true`;

const CPD_SORTS: Record<string, string> = {
  name: 'q."fullName"', department: 'q.department', hours: 'q.hours', progress: 'q.hours::float / q.target', mandatory: 'q."mandatoryComplete"',
};

export async function cpdList(f: Pagination & { campusId?: string; employeeType?: string; department?: string; band?: string }) {
  const w = new Where().add(ACTIVE);
  w.addIf(f.campusId, 'e.campus_id = ?');
  w.addIf(f.employeeType, 'e.employee_type = ?');
  w.addIf(f.department, 'e.department = ?');
  if (f.q) w.add('(e.full_name ILIKE ? OR e.employee_code ILIKE ?)', likeTerm(f.q), likeTerm(f.q));
  const band = f.band === 'met' ? 'q.hours >= q.target' : f.band === 'near' ? 'q.hours < q.target AND q.hours >= q.target * 0.6' : f.band === 'below' ? 'q.hours < q.target * 0.6' : 'true';
  const { limit, offset } = limitOffset(f);
  const rows = await many(
    `SELECT q.*, count(*) OVER() AS total FROM (${CPD_ROW} ${w.sql}) q WHERE ${band}
      ORDER BY ${orderBy(f.sort, f.dir, CPD_SORTS, 'name')}, q."fullName" LIMIT ${w.param(limit)} OFFSET ${w.param(offset)}`,
    w.params,
  );
  return { rows: rows.map(({ total: _t, ...r }) => r), total: rows[0]?.total ?? 0 };
}

export async function cpdSummary(campusId?: string) {
  const w = new Where().add(ACTIVE);
  w.addIf(campusId, 'e.campus_id = ?');
  const k = await one(
    `SELECT COALESCE(sum(q.hours), 0)::int AS "hoursLogged",
            round(avg(q.hours) FILTER (WHERE q."employeeType" = 'teaching'), 1)::float AS "avgPerTeacher",
            count(*) FILTER (WHERE q.hours < q.target)::int AS "belowTarget",
            round(100.0 * count(*) FILTER (WHERE q."mandatoryComplete") / NULLIF(count(*), 0))::int AS "mandatoryPct",
            count(*) FILTER (WHERE NOT q."mandatoryComplete")::int AS "mandatoryOutstanding",
            count(*)::int AS employees
       FROM (${CPD_ROW} ${w.sql}) q`,
    w.params,
  );
  const w2 = new Where().add(ACTIVE).add(`r.status <> 'Completed'`);
  w2.addIf(campusId, 'e.campus_id = ?');
  const upcoming = await many(
    `SELECT r.programme, r.status, count(*)::int AS staff, sum(r.hours)::int AS hours
       FROM cpd_records r JOIN employees e ON e.id = r.employee_id ${w2.sql}
      GROUP BY r.programme, r.status ORDER BY count(*) DESC LIMIT 6`,
    w2.params,
  );
  return { kpis: { ...k, targetTeaching: CPD_TARGET_TEACHING, targetNonTeaching: CPD_TARGET_NON_TEACHING }, upcoming };
}

export async function cpdRecords(employeeId?: string, status?: string) {
  const w = new Where().add('e.deleted_at IS NULL');
  w.addIf(employeeId, 'r.employee_id = ?');
  w.addIf(status, 'r.status = ?');
  return many(
    `SELECT r.id, r.employee_id AS "employeeId", e.full_name AS "employeeName", r.programme, r.provider, r.hours,
            r.completed_on AS "completedOn", r.status, r.created_at AS "createdAt"
       FROM cpd_records r JOIN employees e ON e.id = r.employee_id ${w.sql}
      ORDER BY r.completed_on DESC NULLS FIRST, r.created_at DESC LIMIT 200`,
    w.params,
  );
}

export async function createCpd(req: Request, b: { employeeIds: string[]; programme: string; provider?: string | null; hours: number; completedOn?: string | null; status: string }) {
  if (b.completedOn && b.completedOn > todayKolkata()) throw badRequest('Completion date cannot be in the future', 'FUTURE_DATE');
  return tx(async (db) => {
    const ids = [...new Set(b.employeeIds)];
    const found = await many<{ id: string }>(`SELECT e.id FROM employees e WHERE e.id = ANY($1) AND ${ACTIVE}`, [ids], db);
    if (found.length !== ids.length) throw badRequest('One or more employees were not found', 'EMPLOYEE_NOT_FOUND');
    for (const id of ids) {
      await query(
        `INSERT INTO cpd_records (employee_id, programme, provider, hours, completed_on, status) VALUES ($1,$2,$3,$4,$5,$6)`,
        [id, b.programme, b.provider ?? null, b.hours, b.status === 'Completed' ? b.completedOn : null, b.status], db,
      );
      if (b.status === 'Completed') await query('UPDATE employees SET cpd_hours = cpd_hours + $2 WHERE id = $1', [id, b.hours], db);
    }
    await audit(req, { action: 'create', module: 'workforce', description: `${b.status === 'Completed' ? 'Logged' : 'Scheduled'} CPD "${b.programme}" for ${ids.length} employee(s)`, entityType: 'cpd_record', metadata: { employees: ids.length } }, db);
    return { created: ids.length };
  });
}

export async function updateCpd(req: Request, id: string, b: { status: string; completedOn?: string | null }) {
  if (b.status === 'Completed' && !b.completedOn) throw badRequest('Completion date is required', 'VALIDATION_ERROR', [{ field: 'completedOn', message: 'Required' }]);
  if (b.completedOn && b.completedOn > todayKolkata()) throw badRequest('Completion date cannot be in the future', 'FUTURE_DATE');
  return tx(async (db) => {
    const r = await one('SELECT * FROM cpd_records WHERE id = $1 FOR UPDATE', [id], db);
    if (!r) throw notFound('CPD record not found', 'CPD_NOT_FOUND');
    const wasDone = r.status === 'Completed';
    const isDone = b.status === 'Completed';
    await query('UPDATE cpd_records SET status = $2, completed_on = $3 WHERE id = $1', [id, b.status, isDone ? b.completedOn : null], db);
    if (wasDone !== isDone) {
      await query('UPDATE employees SET cpd_hours = GREATEST(0, cpd_hours + $2) WHERE id = $1', [r.employee_id, isDone ? r.hours : -r.hours], db);
    }
    await audit(req, { action: 'update', module: 'workforce', description: `CPD "${r.programme}" marked ${b.status}`, entityType: 'cpd_record', entityId: id }, db);
  });
}
