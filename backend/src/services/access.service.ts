import type { Request } from 'express';
import { one } from '../config/db.js';
import { forbidden, notFound } from '../utils/errors.js';
import type { AuthUser } from '../types.js';
import type { Where } from '../utils/sql.js';

/**
 * Data-scope rules for student records. Every service that returns student
 * data calls one of these, so the rule lives in exactly one place.
 *
 *   school scope + students.read          → every student (optionally one campus)
 *   class scope  + students.read_assigned → students in sections the teacher
 *                                           teaches or is class teacher of
 *   family scope                          → the parent's own children
 *   self scope (student)                  → the student themself
 */

/** SQL predicate (on alias `s`) restricting students to those the user may see. */
export function studentScope(user: AuthUser, w: Where, alias = 's') {
  const perms = user.permissions;
  if (perms.has('students.read') || perms.has('tracking.read_all')) return w;
  if (perms.has('students.read_assigned') || perms.has('tracking.read_assigned')) {
    return w.add(
      `${alias}.section_id IN (
         SELECT ta.section_id FROM teacher_assignments ta WHERE ta.employee_id = ?
         UNION SELECT sec.id FROM sections sec WHERE sec.class_teacher_id = ?)`,
      user.employeeId, user.employeeId,
    );
  }
  if (user.parentId) {
    return w.add(`${alias}.id IN (SELECT sg.student_id FROM student_guardians sg WHERE sg.parent_id = ?)`, user.parentId);
  }
  if (user.studentId) return w.add(`${alias}.id = ?`, user.studentId);
  // No student visibility at all
  return w.add('false');
}

/** Resolves a UUID or admission number to a student id, or throws 404. */
export async function resolveStudentId(idOrCode: string): Promise<string> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrCode);
  const row = await one<{ id: string }>(
    `SELECT id FROM students WHERE ${isUuid ? 'id = $1' : 'admission_no = $1'} AND deleted_at IS NULL`,
    [idOrCode],
  );
  if (!row) throw notFound('Student not found', 'STUDENT_NOT_FOUND');
  return row.id;
}

/** True when the user may see this particular student's record. */
export async function canAccessStudent(user: AuthUser, studentId: string): Promise<boolean> {
  const p = user.permissions;
  if (p.has('students.read')) return true;
  if (p.has('students.read_assigned') && user.employeeId) {
    const r = await one(
      `SELECT 1 FROM students s
        WHERE s.id = $1 AND s.section_id IN (
          SELECT ta.section_id FROM teacher_assignments ta WHERE ta.employee_id = $2
          UNION SELECT sec.id FROM sections sec WHERE sec.class_teacher_id = $2)`,
      [studentId, user.employeeId],
    );
    return !!r;
  }
  if (user.parentId) return isGuardianOf(user.parentId, studentId);
  if (user.studentId) return user.studentId === studentId;
  return false;
}

export async function isGuardianOf(parentId: string, studentId: string, requireTracking = false) {
  const r = await one(
    `SELECT 1 FROM student_guardians WHERE parent_id = $1 AND student_id = $2 ${requireTracking ? 'AND can_view_tracking' : ''}`,
    [parentId, studentId],
  );
  return !!r;
}

/**
 * Resolves and authorises a student in one step. Returns 404 (not 403) for
 * records outside the user's scope so that record existence is not leaked.
 */
export async function authorizeStudent(req: Request, idOrCode: string): Promise<string> {
  const id = await resolveStudentId(idOrCode);
  if (!(await canAccessStudent(req.user!, id))) throw notFound('Student not found', 'STUDENT_NOT_FOUND');
  return id;
}

/** Tracking has its own, stricter rule than general profile access. */
export async function authorizeStudentTracking(req: Request, idOrCode: string): Promise<string> {
  const user = req.user!;
  const id = await resolveStudentId(idOrCode);
  const p = user.permissions;
  if (p.has('tracking.read_all')) return id;
  if (p.has('tracking.read_assigned') && (await canAccessStudent({ ...user, permissions: new Set(['students.read_assigned']) } as AuthUser, id))) return id;
  if (p.has('tracking.read_own_children') && user.parentId && (await isGuardianOf(user.parentId, id, true))) return id;
  throw notFound('Student not found', 'STUDENT_NOT_FOUND');
}

/** Parents may only address their own parent record through /parents/:id routes. */
export function assertSelfParent(req: Request, parentId: string) {
  const u = req.user!;
  if (u.permissions.has('parents.read')) return;
  if (u.parentId && u.parentId === parentId) return;
  throw forbidden('You can only access your own family record');
}
