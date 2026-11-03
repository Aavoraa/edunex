import type { Request } from 'express';
import { many, one, query, tx, type Queryable } from '../config/db.js';
import { Where } from '../utils/sql.js';
import { likeTerm, limitOffset, orderBy, type Pagination } from '../utils/pagination.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/errors.js';
import { nextCode } from '../utils/codes.js';
import { audit } from './audit.service.js';
import { notifyRoles, notifyUsers } from './notification.service.js';
import { ACTIVE, MONTH_START, TODAY, todayKolkata } from './workforce.service.js';
import { plusDays } from './workforce-roster.service.js';
import { dateRange, defaultOvertimeRate, leaveDays } from './workforce-paycalc.js';

const OPEN = `('Submitted', 'Under Review')`;

// ---------------------------------------------------------------------------
// Leave
// ---------------------------------------------------------------------------
export const LEAVE_ROW_SQL = `
  SELECT l.id, l.code, l.employee_id AS "employeeId", e.full_name AS "employeeName", e.employee_code AS "employeeCode",
         e.designation, e.department, e.employee_type AS "employeeType", cp.short_name AS "campusName",
         lt.id AS "leaveTypeId", lt.name AS "leaveType", l.from_date AS "fromDate", l.to_date AS "toDate",
         l.days::float AS days, l.reason, l.cover_arrangement AS "coverArrangement", l.status,
         d.full_name AS "decidedBy", l.decided_at AS "decidedAt", l.decision_note AS "decisionNote", l.created_at AS "createdAt",
         (COALESCE(b.entitled, lt.annual_quota) - COALESCE(b.used, 0))::float AS balance
    FROM leave_requests l
    JOIN employees e ON e.id = l.employee_id
    JOIN campuses cp ON cp.id = e.campus_id
    JOIN leave_types lt ON lt.id = l.leave_type_id
    LEFT JOIN users d ON d.id = l.decided_by
    LEFT JOIN leave_balances b ON b.employee_id = l.employee_id AND b.leave_type_id = l.leave_type_id
     AND b.academic_year_id = (SELECT id FROM academic_years WHERE is_current)`;

const LEAVE_SORTS: Record<string, string> = {
  code: `substring(l.code FROM 4)::int`, name: 'e.full_name', from: 'l.from_date', to: 'l.to_date', days: 'l.days',
  status: `array_position(ARRAY['Submitted','Under Review','Approved','Rejected','Cancelled','Draft'], l.status)`, created: 'l.created_at',
};

export async function listLeave(f: Pagination & { campusId?: string; status?: string; employeeType?: string; leaveTypeId?: string }) {
  const w = new Where().add('e.deleted_at IS NULL');
  w.addIf(f.campusId, 'e.campus_id = ?');
  if (f.status === 'open') w.add(`l.status IN ${OPEN}`);
  else w.addIf(f.status, 'l.status = ?');
  w.addIf(f.employeeType, 'e.employee_type = ?');
  w.addIf(f.leaveTypeId, 'l.leave_type_id = ?');
  if (f.q) w.add('(e.full_name ILIKE ? OR l.code ILIKE ?)', likeTerm(f.q), likeTerm(f.q));
  const { limit, offset } = limitOffset(f);
  const rows = await many(
    `${LEAVE_ROW_SQL.replace('SELECT l.id,', 'SELECT count(*) OVER() AS total, l.id,')} ${w.sql}
      ORDER BY ${orderBy(f.sort, f.sort ? f.dir : 'desc', LEAVE_SORTS, 'code')}, l.created_at DESC
      LIMIT ${w.param(limit)} OFFSET ${w.param(offset)}`,
    w.params,
  );
  return { rows: rows.map(({ total: _t, ...r }) => r), total: rows[0]?.total ?? 0 };
}

export async function leaveSummary(campusId?: string) {
  const w = new Where().add('e.deleted_at IS NULL');
  w.addIf(campusId, 'e.campus_id = ?');
  const p = w.params;
  const base = `FROM leave_requests l JOIN employees e ON e.id = l.employee_id JOIN leave_types lt ON lt.id = l.leave_type_id ${w.sql}`;
  const [counts, byMonth, typeMix] = await Promise.all([
    one(`SELECT count(*) FILTER (WHERE l.status = 'Submitted')::int AS submitted,
                count(*) FILTER (WHERE l.status = 'Under Review')::int AS "underReview",
                count(*) FILTER (WHERE l.status = 'Approved' AND l.decided_at >= now() - interval '7 days')::int AS "approvedThisWeek",
                count(*) FILTER (WHERE l.status = 'Rejected' AND l.decided_at >= now() - interval '30 days')::int AS "rejectedThisMonth",
                count(*) FILTER (WHERE l.status IN ${OPEN} AND (l.cover_arrangement IS NULL OR l.cover_arrangement = ''))::int AS "noCover",
                count(*) FILTER (WHERE l.status = 'Approved' AND ${TODAY} BETWEEN l.from_date AND l.to_date)::int AS "onLeaveToday"
           ${base}`, p),
    many(`SELECT to_char(m, 'Mon') AS label, COALESCE(sum(l.days) FILTER (WHERE l.id IS NOT NULL), 0)::float AS value
            FROM generate_series(date_trunc('month', ${TODAY}) - interval '5 months', date_trunc('month', ${TODAY}), interval '1 month') m
            LEFT JOIN (SELECT l.* ${base} AND l.status = 'Approved') l ON date_trunc('month', l.from_date) = m
           GROUP BY m ORDER BY m`, p),
    many(`SELECT lt.name AS label, COALESCE(sum(l.days), 0)::float AS value
           ${base} AND l.status = 'Approved'
             AND l.from_date >= (SELECT starts_on FROM academic_years WHERE is_current)
           GROUP BY lt.name ORDER BY sum(l.days) DESC`, p),
  ]);
  const types = await leaveTypes();
  return { counts, byMonth, typeMix, totalDays: typeMix.reduce((a, t) => a + t.value, 0), types };
}

export async function leaveTypes() {
  return many('SELECT id, name, annual_quota AS "annualQuota" FROM leave_types ORDER BY annual_quota DESC, name');
}

export async function getLeave(id: string, db?: Queryable) {
  return one(`${LEAVE_ROW_SQL} WHERE l.id = $1`, [id], db);
}

export interface LeaveInput {
  leaveTypeId: string; fromDate: string; toDate: string; halfDay?: boolean; reason: string; coverArrangement?: string | null;
}

export async function createLeave(req: Request, employeeId: string, b: LeaveInput) {
  const today = todayKolkata();
  if (b.fromDate < plusDays(today, -30)) throw badRequest('Leave can be recorded at most 30 days after it was taken', 'LEAVE_TOO_OLD');
  if (b.toDate > plusDays(today, 180)) throw badRequest('Leave can be requested at most six months ahead', 'LEAVE_TOO_FAR');
  const days = b.halfDay ? 0.5 : leaveDays(b.fromDate, b.toDate);
  if (days <= 0) throw badRequest('The selected dates fall on a Sunday — no leave is needed', 'NO_WORKING_DAYS');
  return tx(async (db) => {
    const e = await one<{ full_name: string; employee_code: string }>(
      `SELECT full_name, employee_code FROM employees e WHERE e.id = $1 AND ${ACTIVE}`, [employeeId], db);
    if (!e) throw notFound('Employee not found', 'EMPLOYEE_NOT_FOUND');
    const lt = await one<{ name: string }>('SELECT name FROM leave_types WHERE id = $1', [b.leaveTypeId], db);
    if (!lt) throw badRequest('Leave type not found', 'VALIDATION_ERROR', [{ field: 'leaveTypeId', message: 'Choose a leave type' }]);
    const overlap = await one<{ code: string }>(
      `SELECT code FROM leave_requests WHERE employee_id = $1 AND status IN ('Submitted', 'Under Review', 'Approved')
          AND from_date <= $3 AND to_date >= $2 LIMIT 1`,
      [employeeId, b.fromDate, b.toDate], db,
    );
    if (overlap) throw conflict(`These dates overlap with leave request ${overlap.code}`, 'LEAVE_OVERLAP');
    const bal = await one<{ balance: number }>(
      `SELECT (COALESCE(b.entitled, lt.annual_quota) - COALESCE(b.used, 0))::float
              - COALESCE((SELECT sum(days) FROM leave_requests WHERE employee_id = $1 AND leave_type_id = $2 AND status IN ${OPEN}), 0)::float AS balance
         FROM leave_types lt
         LEFT JOIN leave_balances b ON b.leave_type_id = lt.id AND b.employee_id = $1 AND b.academic_year_id = (SELECT id FROM academic_years WHERE is_current)
        WHERE lt.id = $2`,
      [employeeId, b.leaveTypeId], db,
    );
    if ((bal?.balance ?? 0) < days) {
      throw badRequest(`Not enough ${lt.name.toLowerCase()} — ${Math.max(0, bal?.balance ?? 0)} day(s) available after pending requests`, 'INSUFFICIENT_BALANCE');
    }
    const code = await nextCode('leave_requests', 'code', 'LV-', db, 3);
    const row = await one<{ id: string }>(
      `INSERT INTO leave_requests (code, employee_id, leave_type_id, from_date, to_date, days, reason, cover_arrangement, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Submitted') RETURNING id`,
      [code, employeeId, b.leaveTypeId, b.fromDate, b.toDate, days, b.reason, b.coverArrangement || null], db,
    );
    const self = req.user!.employeeId === employeeId;
    await audit(req, {
      action: 'create', module: 'workforce', entityType: 'leave_request', entityId: row!.id,
      description: `${self ? 'Applied for' : `Recorded for ${e.full_name}`} ${lt.name.toLowerCase()} ${code} (${b.fromDate} to ${b.toDate}, ${days} d)`,
    }, db);
    await notifyRoles(['hr'], {
      category: 'Attention', icon: 'calendar', topic: 'leave', route: '/leave', entityType: 'leave_request', entityId: row!.id,
      title: `Leave request ${code} from ${e.full_name}`, body: `${lt.name} · ${b.fromDate} to ${b.toDate} · ${days} day(s)`,
    }, db);
    return { id: row!.id, code, days };
  });
}

async function lockLeave(id: string, db: Queryable) {
  const l = await one(
    `SELECT l.*, e.full_name, e.user_id, lt.name AS type_name FROM leave_requests l
       JOIN employees e ON e.id = l.employee_id JOIN leave_types lt ON lt.id = l.leave_type_id
      WHERE l.id = $1 FOR UPDATE OF l`, [id], db);
  if (!l) throw notFound('Leave request not found', 'LEAVE_NOT_FOUND');
  return l;
}

function assertNotSelf(req: Request, employeeId: string) {
  if (req.user!.employeeId === employeeId) throw forbidden('You cannot decide on your own request', 'SELF_APPROVAL');
}

export async function reviewLeave(req: Request, id: string) {
  return tx(async (db) => {
    const l = await lockLeave(id, db);
    assertNotSelf(req, l.employee_id);
    if (l.status !== 'Submitted') throw badRequest(`Only submitted requests can move to review (currently ${l.status})`, 'INVALID_STATUS');
    await query(`UPDATE leave_requests SET status = 'Under Review' WHERE id = $1`, [id], db);
    await audit(req, { action: 'update', module: 'workforce', description: `Leave ${l.code} moved to review`, entityType: 'leave_request', entityId: id }, db);
  });
}

export async function approveLeave(req: Request, id: string, note?: string | null) {
  return tx(async (db) => {
    const l = await lockLeave(id, db);
    assertNotSelf(req, l.employee_id);
    if (!['Submitted', 'Under Review'].includes(l.status)) throw badRequest(`This request is already ${l.status.toLowerCase()}`, 'INVALID_STATUS');
    const year = await one<{ id: string }>('SELECT id FROM academic_years WHERE is_current', [], db);
    if (!year) throw badRequest('No current academic year is configured', 'NO_CURRENT_YEAR');
    const bal = await one<{ entitled: number; used: number }>(
      `INSERT INTO leave_balances (employee_id, leave_type_id, academic_year_id, entitled)
       SELECT $1, lt.id, $3, lt.annual_quota FROM leave_types lt WHERE lt.id = $2
       ON CONFLICT (employee_id, leave_type_id, academic_year_id) DO UPDATE SET updated_at = now()
       RETURNING entitled::float, used::float`,
      [l.employee_id, l.leave_type_id, year.id], db,
    );
    if (bal!.entitled - bal!.used < Number(l.days)) {
      throw badRequest(`Not enough ${l.type_name.toLowerCase()} left (${bal!.entitled - bal!.used} day(s))`, 'INSUFFICIENT_BALANCE');
    }
    await query(
      `UPDATE leave_balances SET used = used + $4, updated_at = now() WHERE employee_id = $1 AND leave_type_id = $2 AND academic_year_id = $3`,
      [l.employee_id, l.leave_type_id, year.id, l.days], db,
    );
    await query(
      `UPDATE leave_requests SET status = 'Approved', decided_by = $2, decided_at = now(), decision_note = $3 WHERE id = $1`,
      [id, req.user!.id, note ?? null], db,
    );
    // Attendance: the leave dates (Sundays excluded) become 'On Leave' (a half day stays 'Half Day').
    const dates = dateRange(l.from_date, l.to_date).filter((d) => new Date(`${d}T00:00:00Z`).getUTCDay() !== 0);
    const status = Number(l.days) === 0.5 ? 'Half Day' : 'On Leave';
    for (const d of dates) {
      await query(
        `INSERT INTO staff_attendance (employee_id, attendance_date, status, source) VALUES ($1, $2, $3, 'manual')
         ON CONFLICT (employee_id, attendance_date) DO UPDATE
           SET status = EXCLUDED.status, source = 'manual',
               check_in = CASE WHEN EXCLUDED.status = 'On Leave' THEN NULL ELSE staff_attendance.check_in END,
               check_out = CASE WHEN EXCLUDED.status = 'On Leave' THEN NULL ELSE staff_attendance.check_out END`,
        [l.employee_id, d, status], db,
      );
    }
    // Roster lines on those dates now need cover.
    const flagged = await query(
      `UPDATE shift_rosters SET status = 'Cover needed'
        WHERE employee_id = $1 AND roster_date BETWEEN GREATEST($2::date, ${TODAY}) AND $3 AND status = 'Scheduled' AND $4`,
      [l.employee_id, l.from_date, l.to_date, status === 'On Leave'], db,
    );
    await audit(req, {
      action: 'approve', module: 'workforce', entityType: 'leave_request', entityId: id,
      description: `Approved leave ${l.code} for ${l.full_name} (${l.days} d)${flagged.rowCount ? `; ${flagged.rowCount} roster line(s) need cover` : ''}`,
    }, db);
    if (l.user_id) {
      await notifyUsers([l.user_id], {
        category: 'Completed', icon: 'check', topic: 'leave', route: '/staff-self', entityType: 'leave_request', entityId: id,
        title: `Your leave request ${l.code} was approved`, body: `${l.type_name} · ${l.from_date} to ${l.to_date}${note ? ` · ${note}` : ''}`,
        channels: ['push'],
      }, db);
    }
    return { rosterLinesFlagged: flagged.rowCount ?? 0 };
  });
}

export async function rejectLeave(req: Request, id: string, note: string) {
  return tx(async (db) => {
    const l = await lockLeave(id, db);
    assertNotSelf(req, l.employee_id);
    if (!['Submitted', 'Under Review'].includes(l.status)) throw badRequest(`This request is already ${l.status.toLowerCase()}`, 'INVALID_STATUS');
    await query(
      `UPDATE leave_requests SET status = 'Rejected', decided_by = $2, decided_at = now(), decision_note = $3 WHERE id = $1`,
      [id, req.user!.id, note], db,
    );
    await audit(req, { action: 'reject', module: 'workforce', description: `Rejected leave ${l.code} for ${l.full_name}: ${note}`, entityType: 'leave_request', entityId: id }, db);
    if (l.user_id) {
      await notifyUsers([l.user_id], {
        category: 'Attention', icon: 'x', topic: 'leave', route: '/staff-self', entityType: 'leave_request', entityId: id,
        title: `Your leave request ${l.code} was not approved`, body: note, channels: ['push'],
      }, db);
    }
  });
}

export async function updateLeaveCover(req: Request, id: string, cover: string | null | undefined) {
  return tx(async (db) => {
    const l = await lockLeave(id, db);
    if (['Rejected', 'Cancelled'].includes(l.status)) throw badRequest('This request is closed', 'INVALID_STATUS');
    await query('UPDATE leave_requests SET cover_arrangement = $2 WHERE id = $1', [id, cover || null], db);
    await audit(req, { action: 'update', module: 'workforce', description: `Cover for ${l.code} set to ${cover || 'not assigned'}`, entityType: 'leave_request', entityId: id }, db);
  });
}

/** Employee withdraws their own open request. */
export async function cancelOwnLeave(req: Request, employeeId: string, id: string) {
  return tx(async (db) => {
    const l = await one(`SELECT code, status FROM leave_requests WHERE id = $1 AND employee_id = $2 FOR UPDATE`, [id, employeeId], db);
    if (!l) throw notFound('Leave request not found', 'LEAVE_NOT_FOUND');
    if (!['Submitted', 'Under Review'].includes(l.status)) throw badRequest(`A ${l.status.toLowerCase()} request cannot be withdrawn`, 'INVALID_STATUS');
    await query(`UPDATE leave_requests SET status = 'Cancelled' WHERE id = $1`, [id], db);
    await audit(req, { action: 'update', module: 'workforce', description: `Withdrew leave request ${l.code}`, entityType: 'leave_request', entityId: id }, db);
  });
}

// ---------------------------------------------------------------------------
// Overtime
// ---------------------------------------------------------------------------
export const OT_ROW_SQL = `
  SELECT o.id, o.employee_id AS "employeeId", e.full_name AS "employeeName", e.employee_code AS "employeeCode",
         e.designation, e.department, cp.short_name AS "campusName",
         o.work_date AS "workDate", o.hours::float AS hours, o.reason, o.rate_per_hour::float AS rate,
         (o.hours * o.rate_per_hour)::float AS cost, o.status, a.full_name AS "approvedBy", o.created_at AS "createdAt"
    FROM overtime_entries o
    JOIN employees e ON e.id = o.employee_id
    JOIN campuses cp ON cp.id = e.campus_id
    LEFT JOIN users a ON a.id = o.approved_by`;

const OT_SORTS: Record<string, string> = {
  name: 'e.full_name', department: 'e.department', date: 'o.work_date', hours: 'o.hours', cost: '(o.hours * o.rate_per_hour)',
  status: `array_position(ARRAY['Submitted','Under Review','Approved','Paid','Rejected'], o.status)`,
};

export async function listOvertime(f: Pagination & { campusId?: string; status?: string; month?: string; department?: string }) {
  const w = new Where().add('e.deleted_at IS NULL');
  w.addIf(f.campusId, 'e.campus_id = ?');
  if (f.status === 'open') w.add(`o.status IN ${OPEN}`);
  else w.addIf(f.status, 'o.status = ?');
  if (f.month) w.add(`date_trunc('month', o.work_date) = ?::date`, `${f.month}-01`);
  w.addIf(f.department, 'e.department = ?');
  if (f.q) w.add('(e.full_name ILIKE ? OR o.reason ILIKE ?)', likeTerm(f.q), likeTerm(f.q));
  const { limit, offset } = limitOffset(f);
  const rows = await many(
    `${OT_ROW_SQL.replace('SELECT o.id,', 'SELECT count(*) OVER() AS total, o.id,')} ${w.sql}
      ORDER BY ${orderBy(f.sort, f.sort ? f.dir : 'desc', OT_SORTS, 'date')}, o.created_at DESC
      LIMIT ${w.param(limit)} OFFSET ${w.param(offset)}`,
    w.params,
  );
  return { rows: rows.map(({ total: _t, ...r }) => r), total: rows[0]?.total ?? 0 };
}

export async function overtimeSummary(campusId?: string) {
  const w = new Where().add('e.deleted_at IS NULL').add(`o.work_date >= ${MONTH_START}`).add(`o.status <> 'Rejected'`);
  w.addIf(campusId, 'e.campus_id = ?');
  const base = `FROM overtime_entries o JOIN employees e ON e.id = o.employee_id ${w.sql}`;
  const [k, byDepartment, trend] = await Promise.all([
    one(`SELECT COALESCE(sum(o.hours), 0)::float AS hours,
                COALESCE(sum(o.hours) FILTER (WHERE o.status IN ('Approved', 'Paid')), 0)::float AS "approvedHours",
                COALESCE(sum(o.hours) FILTER (WHERE o.status IN ${OPEN}), 0)::float AS "pendingHours",
                count(*) FILTER (WHERE o.status IN ${OPEN})::int AS "pendingCount",
                COALESCE(sum(o.hours * o.rate_per_hour), 0)::float AS cost,
                count(DISTINCT o.employee_id)::int AS employees
           ${base}`, w.params),
    many(`SELECT e.department AS label, sum(o.hours)::float AS value ${base} GROUP BY e.department ORDER BY sum(o.hours) DESC`, w.params),
    many(`SELECT to_char(m, 'Mon') AS label, COALESCE(sum(o.hours), 0)::float AS value
            FROM generate_series(date_trunc('month', ${TODAY}) - interval '5 months', date_trunc('month', ${TODAY}), interval '1 month') m
            LEFT JOIN (SELECT o.work_date, o.hours FROM overtime_entries o JOIN employees e ON e.id = o.employee_id
                        WHERE o.status <> 'Rejected' AND e.deleted_at IS NULL AND ($1::uuid IS NULL OR e.campus_id = $1)) o
              ON date_trunc('month', o.work_date) = m
           GROUP BY m ORDER BY m`, [campusId ?? null]),
  ]);
  return { kpis: k, byDepartment, trend };
}

export async function createOvertime(req: Request, employeeId: string, b: { workDate: string; hours: number; reason: string; ratePerHour?: number }) {
  const today = todayKolkata();
  if (b.workDate > today) throw badRequest('Overtime can only be claimed for work already done', 'FUTURE_DATE');
  if (b.workDate < plusDays(today, -60)) throw badRequest('Claims older than 60 days need a manual adjustment', 'CLAIM_TOO_OLD');
  return tx(async (db) => {
    const e = await one<{ full_name: string; basic_salary: number }>(
      `SELECT full_name, basic_salary::float FROM employees e WHERE e.id = $1 AND ${ACTIVE}`, [employeeId], db);
    if (!e) throw notFound('Employee not found', 'EMPLOYEE_NOT_FOUND');
    const sameDay = await one<{ hours: number }>(
      `SELECT COALESCE(sum(hours), 0)::float AS hours FROM overtime_entries WHERE employee_id = $1 AND work_date = $2 AND status <> 'Rejected'`,
      [employeeId, b.workDate], db);
    if (sameDay!.hours + b.hours > 16) throw badRequest('More than 16 overtime hours on one day is not allowed', 'OVERTIME_LIMIT');
    const rate = b.ratePerHour ?? defaultOvertimeRate(e.basic_salary);
    const row = await one<{ id: string }>(
      `INSERT INTO overtime_entries (employee_id, work_date, hours, reason, rate_per_hour, status)
       VALUES ($1,$2,$3,$4,$5,'Submitted') RETURNING id`,
      [employeeId, b.workDate, b.hours, b.reason, rate], db,
    );
    await audit(req, { action: 'create', module: 'workforce', description: `Overtime claim of ${b.hours} h on ${b.workDate} for ${e.full_name}`, entityType: 'overtime_entry', entityId: row!.id }, db);
    await notifyRoles(['hr'], {
      category: 'Attention', icon: 'clock', topic: 'overtime', route: '/overtime', entityType: 'overtime_entry', entityId: row!.id,
      title: `Overtime claim — ${e.full_name}, ${b.hours} h`, body: b.reason,
    }, db);
    return { id: row!.id, rate };
  });
}

async function decideOvertime(req: Request, id: string, to: 'Under Review' | 'Approved' | 'Rejected', note?: string | null) {
  return tx(async (db) => {
    const o = await one(
      `SELECT o.*, e.full_name, e.user_id FROM overtime_entries o JOIN employees e ON e.id = o.employee_id WHERE o.id = $1 FOR UPDATE OF o`,
      [id], db);
    if (!o) throw notFound('Overtime entry not found', 'OVERTIME_NOT_FOUND');
    assertNotSelf(req, o.employee_id);
    const allowed = to === 'Under Review' ? ['Submitted'] : ['Submitted', 'Under Review'];
    if (!allowed.includes(o.status)) throw badRequest(`This claim is ${o.status.toLowerCase()}`, 'INVALID_STATUS');
    await query(
      `UPDATE overtime_entries SET status = $2, approved_by = CASE WHEN $2 = 'Approved' THEN $3::uuid ELSE approved_by END WHERE id = $1`,
      [id, to, req.user!.id], db,
    );
    await audit(req, {
      action: to === 'Approved' ? 'approve' : to === 'Rejected' ? 'reject' : 'update', module: 'workforce', entityType: 'overtime_entry', entityId: id,
      description: `Overtime ${o.hours} h for ${o.full_name} → ${to}${note ? `: ${note}` : ''}`,
    }, db);
    if (o.user_id && to !== 'Under Review') {
      await notifyUsers([o.user_id], {
        category: to === 'Approved' ? 'Completed' : 'Attention', icon: 'clock', topic: 'overtime', route: '/staff-self',
        entityType: 'overtime_entry', entityId: id,
        title: `Your overtime claim of ${Number(o.hours)} hours was ${to === 'Approved' ? 'approved' : 'not approved'}`,
        body: note ?? (to === 'Approved' ? 'It will be paid in the next payroll run' : undefined), channels: ['push'],
      }, db);
    }
  });
}

export const reviewOvertime = (req: Request, id: string) => decideOvertime(req, id, 'Under Review');
export const approveOvertime = (req: Request, id: string, note?: string | null) => decideOvertime(req, id, 'Approved', note);
export const rejectOvertime = (req: Request, id: string, note: string) => decideOvertime(req, id, 'Rejected', note);
