/**
 * Staff self-service. Every function takes the employee id resolved from the
 * signed-in user (req.user.employeeId) — never an id from the request.
 */
import type { Request } from 'express';
import { many, one } from '../config/db.js';
import { notFound } from '../utils/errors.js';
import { audit } from './audit.service.js';
import { EMPLOYEE_ROW_SQL, MONTH_START, TODAY, leaveBalancesFor, todayKolkata } from './workforce.service.js';
import { ROSTER_ROW_SQL, mondayOf, plusDays } from './workforce-roster.service.js';
import { LEAVE_ROW_SQL, OT_ROW_SQL } from './workforce-leave.service.js';

/** Resolves the caller's employee record or fails with EMPLOYEE_NOT_LINKED. */
export function selfId(req: Request) {
  const id = req.user!.employeeId;
  if (!id) throw notFound('Your account is not linked to an employee record', 'EMPLOYEE_NOT_LINKED');
  return id;
}

export async function myEmployee(employeeId: string) {
  const e = await one(
    `${EMPLOYEE_ROW_SQL}
      WHERE e.id = $1 AND e.deleted_at IS NULL`,
    [employeeId],
  );
  if (!e) throw notFound('Your account is not linked to an employee record', 'EMPLOYEE_NOT_LINKED');
  const [shift, rosterToday, overtime, lastPayslip, month, openRequests] = await Promise.all([
    one(`SELECT s.name, to_char(s.starts_at, 'HH24:MI') AS "startsAt", to_char(s.ends_at, 'HH24:MI') AS "endsAt",
                to_char(s.split_starts_at, 'HH24:MI') AS "splitStartsAt", to_char(s.split_ends_at, 'HH24:MI') AS "splitEndsAt"
           FROM shifts s WHERE s.name = $1`, [e.shift]),
    one(`${ROSTER_ROW_SQL} WHERE r.employee_id = $1 AND r.roster_date = ${TODAY}`, [employeeId]),
    one(`SELECT COALESCE(sum(hours), 0)::float AS hours,
                COALESCE(sum(hours) FILTER (WHERE status IN ('Submitted', 'Under Review')), 0)::float AS pending,
                COALESCE(sum(hours) FILTER (WHERE status IN ('Approved', 'Paid')), 0)::float AS approved
           FROM overtime_entries WHERE employee_id = $1 AND work_date >= ${MONTH_START} AND status <> 'Rejected'`, [employeeId]),
    one(`SELECT p.id, to_char(r.pay_month, 'FMMonth YYYY') AS "monthLabel", p.net::float AS net, p.released_at AS "releasedAt"
           FROM payslips p JOIN payroll_runs r ON r.id = p.payroll_run_id
          WHERE p.employee_id = $1 AND p.status = 'Released' ORDER BY r.pay_month DESC LIMIT 1`, [employeeId]),
    one(`SELECT count(*) FILTER (WHERE status IN ('Present', 'Late', 'Half Day', 'On Leave'))::int AS attended,
                count(*)::int AS marked, count(*) FILTER (WHERE status = 'Late')::int AS late
           FROM staff_attendance WHERE employee_id = $1 AND attendance_date >= ${MONTH_START}`, [employeeId]),
    one(`SELECT ((SELECT count(*) FROM leave_requests WHERE employee_id = $1 AND status IN ('Submitted', 'Under Review'))
               + (SELECT count(*) FROM overtime_entries WHERE employee_id = $1 AND status IN ('Submitted', 'Under Review')))::int AS n`, [employeeId]),
  ]);
  return { employee: e, shift, rosterToday, overtime, lastPayslip, month, openRequests: openRequests!.n, today: todayKolkata() };
}

export async function myAttendance(employeeId: string, from?: string, to?: string) {
  const end = to ?? todayKolkata();
  const start = from ?? plusDays(end, -30);
  const [rows, summary] = await Promise.all([
    many(`SELECT attendance_date AS date, status, to_char(check_in, 'HH24:MI') AS "checkIn", to_char(check_out, 'HH24:MI') AS "checkOut", source
            FROM staff_attendance WHERE employee_id = $1 AND attendance_date BETWEEN $2 AND $3 ORDER BY attendance_date DESC`,
      [employeeId, start, end]),
    one(`SELECT count(*)::int AS marked,
                count(*) FILTER (WHERE status = 'Present')::int AS present,
                count(*) FILTER (WHERE status = 'Late')::int AS late,
                count(*) FILTER (WHERE status = 'Absent')::int AS absent,
                count(*) FILTER (WHERE status = 'On Leave')::int AS leave,
                count(*) FILTER (WHERE status = 'Half Day')::int AS "halfDay"
           FROM staff_attendance WHERE employee_id = $1 AND attendance_date BETWEEN $2 AND $3`, [employeeId, start, end]),
  ]);
  return { from: start, to: end, rows, summary };
}

/**
 * Mobile check-in / check-out for today. Arrival more than 15 minutes after the
 * shift start is recorded as Late.
 */
export async function checkIn(req: Request, employeeId: string) {
  const row = await one(
    `WITH now_k AS (SELECT (now() AT TIME ZONE 'Asia/Kolkata')::time(0) AS t)
     INSERT INTO staff_attendance (employee_id, attendance_date, status, check_in, source)
     SELECT e.id, ${TODAY},
            CASE WHEN s.starts_at IS NOT NULL AND (SELECT t FROM now_k) > s.starts_at + interval '15 minutes'
                  AND (SELECT t FROM now_k) < COALESCE(s.split_starts_at, '23:59'::time) THEN 'Late' ELSE 'Present' END,
            (SELECT t FROM now_k), 'mobile'
       FROM employees e LEFT JOIN shifts s ON s.name = e.shift_name
      WHERE e.id = $1
     ON CONFLICT (employee_id, attendance_date) DO UPDATE
       SET check_in = COALESCE(staff_attendance.check_in, EXCLUDED.check_in),
           status = CASE WHEN staff_attendance.status IN ('Absent') THEN EXCLUDED.status ELSE staff_attendance.status END
     WHERE staff_attendance.status <> 'On Leave'
     RETURNING attendance_date AS date, status, to_char(check_in, 'HH24:MI') AS "checkIn", to_char(check_out, 'HH24:MI') AS "checkOut"`,
    [employeeId],
  );
  if (!row) throw notFound('You are on approved leave today', 'ON_LEAVE');
  await audit(req, { action: 'create', module: 'workforce', description: `Checked in at ${row.checkIn} (${row.status})`, entityType: 'staff_attendance' });
  return row;
}

export async function checkOut(req: Request, employeeId: string) {
  const row = await one(
    `UPDATE staff_attendance SET check_out = (now() AT TIME ZONE 'Asia/Kolkata')::time(0)
      WHERE employee_id = $1 AND attendance_date = ${TODAY} AND check_in IS NOT NULL
      RETURNING attendance_date AS date, status, to_char(check_in, 'HH24:MI') AS "checkIn", to_char(check_out, 'HH24:MI') AS "checkOut"`,
    [employeeId],
  );
  if (!row) throw notFound('Check in first — there is no check-in for today', 'NOT_CHECKED_IN');
  await audit(req, { action: 'update', module: 'workforce', description: `Checked out at ${row.checkOut}`, entityType: 'staff_attendance' });
  return row;
}

export async function myRoster(employeeId: string, weekStart?: string) {
  const start = mondayOf(weekStart ?? todayKolkata());
  const end = plusDays(start, 6);
  const [entries, leave, emp] = await Promise.all([
    many(`${ROSTER_ROW_SQL} WHERE r.employee_id = $1 AND r.roster_date BETWEEN $2 AND $3 ORDER BY r.roster_date`, [employeeId, start, end]),
    many(`SELECT from_date AS "fromDate", to_date AS "toDate", code FROM leave_requests
           WHERE employee_id = $1 AND status = 'Approved' AND from_date <= $3 AND to_date >= $2`, [employeeId, start, end]),
    one(`SELECT shift_name FROM employees WHERE id = $1`, [employeeId]),
  ]);
  const covering = await many(
    `${ROSTER_ROW_SQL} WHERE r.covered_by = $1 AND r.roster_date BETWEEN $2 AND $3 ORDER BY r.roster_date`, [employeeId, start, end]);
  const days = Array.from({ length: 6 }, (_, i) => {
    const date = plusDays(start, i);
    const entry = entries.find((x) => x.date === date);
    const cover = covering.find((x) => x.date === date);
    const onLeave = leave.some((l) => l.fromDate <= date && l.toDate >= date);
    return {
      date,
      shift: entry?.shiftName ?? cover?.shiftName ?? null,
      duty: entry ? entry.duty ?? entry.group : cover ? `Covering ${cover.group} for ${cover.employeeName}` : null,
      rosterStatus: entry?.status ?? (cover ? 'Covered' : null),
      attendance: entry?.attendance ?? null,
      onLeave,
    };
  });
  return { weekStart: start, defaultShift: emp?.shift_name ?? null, days };
}

export async function myLeaveRequests(employeeId: string) {
  return many(`${LEAVE_ROW_SQL} WHERE l.employee_id = $1 ORDER BY l.from_date DESC LIMIT 50`, [employeeId]);
}

export async function myLeaveBalances(employeeId: string) {
  return leaveBalancesFor(employeeId);
}

export async function myOvertime(employeeId: string) {
  return many(`${OT_ROW_SQL} WHERE o.employee_id = $1 ORDER BY o.work_date DESC LIMIT 50`, [employeeId]);
}

export async function myPayslips(employeeId: string) {
  return many(
    `SELECT p.id, r.pay_month AS "payMonth", to_char(r.pay_month, 'FMMonth YYYY') AS "monthLabel",
            p.gross::float AS gross, p.total_deductions::float AS deductions, p.net::float AS net, p.released_at AS "releasedAt"
       FROM payslips p JOIN payroll_runs r ON r.id = p.payroll_run_id
      WHERE p.employee_id = $1 AND p.status = 'Released'
      ORDER BY r.pay_month DESC LIMIT 24`,
    [employeeId],
  );
}

export async function myTasks(req: Request) {
  return many(
    `SELECT id, code, title, module, due_on AS "dueOn", priority, status, route,
            (due_on < ${TODAY} AND status IN ('Pending', 'Under Review')) AS overdue
       FROM tasks
      WHERE (assignee_user_id = $1 OR (assignee_user_id IS NULL AND assignee_role_key = $2))
        AND status IN ('Pending', 'Under Review')
      ORDER BY due_on NULLS LAST, priority LIMIT 30`,
    [req.user!.id, req.user!.roleKey],
  );
}

/** "My requests": leave, overtime, allowances and reimbursements in one list. */
export async function myRequests(employeeId: string) {
  return many(
    `SELECT * FROM (
       SELECT l.id, 'leave' AS kind, lt.name || ' — ' || to_char(l.from_date, 'DD Mon') ||
              CASE WHEN l.to_date > l.from_date THEN ' to ' || to_char(l.to_date, 'DD Mon') ELSE '' END AS title,
              l.status, l.created_at AS at
         FROM leave_requests l JOIN leave_types lt ON lt.id = l.leave_type_id WHERE l.employee_id = $1
       UNION ALL
       SELECT o.id, 'overtime', 'Overtime claim — ' || CASE WHEN o.hours = trunc(o.hours) THEN trunc(o.hours)::int::text ELSE o.hours::text END || ' hours', o.status, o.created_at
         FROM overtime_entries o WHERE o.employee_id = $1
       UNION ALL
       SELECT a.id, 'allowance', a.allowance_type, a.status, a.created_at
         FROM allowances a WHERE a.employee_id = $1 AND a.frequency = 'One-time'
       UNION ALL
       SELECT r.id, 'reimbursement', 'Claim ' || r.code || ' — ' || r.description, r.status, r.created_at
         FROM reimbursements r WHERE r.employee_id = $1
     ) x ORDER BY (x.status IN ('Submitted', 'Under Review')) DESC, x.at DESC LIMIT 8`,
    [employeeId],
  );
}

