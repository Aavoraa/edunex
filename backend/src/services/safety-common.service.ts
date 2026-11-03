import type { Request } from 'express';
import { many, one, type Queryable } from '../config/db.js';
import { AppError, badRequest, conflict, notFound } from '../utils/errors.js';
import { likeTerm } from '../utils/pagination.js';
import { Where } from '../utils/sql.js';
import { canAccessStudent, resolveStudentId, studentScope } from './access.service.js';
import type { AuthUser } from '../types.js';

/** School day in the school's timezone. */
export const TZ = 'Asia/Kolkata';
export const TODAY = `(now() AT TIME ZONE '${TZ}')::date`;
export const NOW_TIME = `(now() AT TIME ZONE '${TZ}')::time`;
export const localDate = (col: string) => `(${col} AT TIME ZONE '${TZ}')::date`;

export const hhmm = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: TZ }) : '';

/** Parent 360 route used in guardian notifications. */
export const PARENT_ROUTE = '/parent-360';

/**
 * Gate, transport and front-office staff hold safety/transport permissions
 * without general student-record access. Their duties cover every child on
 * campus, so they see all students; teachers stay limited to their classes.
 */
export function isSchoolWide(user: AuthUser) {
  const p = user.permissions;
  if (p.has('students.read')) return true;
  if (p.has('students.read_assigned') || user.parentId || user.studentId) return false;
  return p.has('safety.read') || p.has('transport.read');
}

/** Restricts alias `s` (students) to what the user may see in safety screens. */
export function safetyStudentScope(user: AuthUser, w: Where, alias = 's') {
  if (isSchoolWide(user)) return w;
  return studentScope(user, w, alias);
}

/** Like safetyStudentScope, for a nullable student column (rows without a student stay visible). */
export function safetyStudentScopeNullable(user: AuthUser, w: Where, column: string) {
  if (isSchoolWide(user)) return w;
  if (user.permissions.has('students.read_assigned') && user.employeeId) {
    return w.add(
      `(${column} IS NULL OR ${column} IN (
          SELECT st.id FROM students st WHERE st.section_id IN (
            SELECT ta.section_id FROM teacher_assignments ta WHERE ta.employee_id = ?
            UNION SELECT sec.id FROM sections sec WHERE sec.class_teacher_id = ?)))`,
      user.employeeId, user.employeeId,
    );
  }
  return w.add(`${column} IS NULL`);
}

/** Resolves a student (uuid or admission number) the user may act on; 404 otherwise. */
export async function authorizeSafetyStudent(req: Request, ref: string): Promise<string> {
  const id = await resolveStudentId(ref);
  if (isSchoolWide(req.user!)) return id;
  if (!(await canAccessStudent(req.user!, id))) throw notFound('Student not found', 'STUDENT_NOT_FOUND');
  return id;
}

export interface StudentBrief {
  id: string;
  admission_no: string;
  full_name: string;
  campus_id: string;
  grade: string | null;
  section: string | null;
}

export async function studentBrief(id: string, db?: Queryable) {
  const s = await one<StudentBrief>(
    `SELECT s.id, s.admission_no, s.full_name, s.campus_id, c.name AS grade, sec.name AS section
       FROM students s LEFT JOIN sections sec ON sec.id = s.section_id LEFT JOIN classes c ON c.id = sec.class_id
      WHERE s.id = $1`, [id], db);
  if (!s) throw notFound('Student not found', 'STUDENT_NOT_FOUND');
  return s;
}

/** Campus for a new record: explicit → user's campus → first active campus. */
export async function resolveCampus(user: AuthUser, campusId?: string | null, db?: Queryable) {
  if (campusId) {
    const c = await one<{ id: string }>('SELECT id FROM campuses WHERE id = $1 AND is_active', [campusId], db);
    if (!c) throw badRequest('Unknown campus', 'CAMPUS_NOT_FOUND');
    return c.id;
  }
  if (user.campusId) return user.campusId;
  const c = await one<{ id: string }>('SELECT id FROM campuses WHERE is_active ORDER BY established LIMIT 1', [], db);
  return c!.id;
}

export async function employeeUserId(employeeId: string | null | undefined, db?: Queryable) {
  if (!employeeId) return null;
  const r = await one<{ user_id: string | null }>('SELECT user_id FROM employees WHERE id = $1', [employeeId], db);
  return r?.user_id ?? null;
}

export async function assertEmployee(employeeId: string, db?: Queryable) {
  const r = await one('SELECT 1 FROM employees WHERE id = $1 AND deleted_at IS NULL', [employeeId], db);
  if (!r) throw badRequest('Unknown staff member', 'EMPLOYEE_NOT_FOUND');
}

/** Translates common PostgreSQL constraint errors into API errors. */
export function mapPgError(err: unknown, messages: { unique?: string; foreign?: string } = {}): never {
  const code = (err as { code?: string })?.code;
  if (code === '23505') throw conflict(messages.unique ?? 'A record with these details already exists', 'DUPLICATE');
  if (code === '23503') throw badRequest(messages.foreign ?? 'A referenced record does not exist or is still in use', 'REFERENCE_ERROR');
  if (code === '23514') throw badRequest('A value is not allowed', 'CHECK_VIOLATION');
  throw err;
}

export const tooMany = (message: string) => new AppError(429, 'TOO_MANY_REQUESTS', message);

/** Student picker for safety/transport forms (scoped). */
export async function searchStudents(user: AuthUser, f: { q?: string; campusId?: string; routeId?: string; limit: number }) {
  const w = new Where();
  w.add(`s.deleted_at IS NULL AND s.status = 'active'`);
  safetyStudentScope(user, w);
  w.addIf(f.campusId, 's.campus_id = ?');
  w.addIf(f.routeId, 'st.route_id = ?');
  if (f.q) w.add('(s.full_name ILIKE ? OR s.admission_no ILIKE ?)', likeTerm(f.q), likeTerm(f.q));
  return many(
    `SELECT s.id, s.admission_no AS "admissionNo", s.full_name AS "fullName", c.name AS grade, sec.name AS section,
            s.campus_id AS "campusId", tr.id AS "routeId", tr.code AS "routeCode", st.stop_id AS "stopId", rs.name AS "stopName"
       FROM students s
       LEFT JOIN sections sec ON sec.id = s.section_id LEFT JOIN classes c ON c.id = sec.class_id
       LEFT JOIN student_transport st ON st.student_id = s.id
       LEFT JOIN transport_routes tr ON tr.id = st.route_id
       LEFT JOIN route_stops rs ON rs.id = st.stop_id
       ${w.sql}
      ORDER BY s.full_name LIMIT ${w.param(f.limit)}`,
    w.params,
  );
}

export function pct(n: number, d: number) {
  return d ? Math.round((n / d) * 1000) / 10 : 0;
}
