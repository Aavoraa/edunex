"""Data-scope rules for student records (services/access.service.ts).

  school scope + students.read          → every student (optionally one campus)
  class scope  + students.read_assigned → students in sections the teacher teaches or is class teacher of
  family scope                          → the parent's own children
  self scope (student)                  → the student themself
"""
from __future__ import annotations

import dataclasses
import re

from ..db import one
from ..errors import forbidden, not_found
from ..http import Req
from ..middleware.auth import AuthUser
from ..utils.sql import Where

_UUID = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.I)


def student_scope(user: AuthUser, w: Where, alias: str = 's') -> Where:
    """SQL predicate (on alias `s`) restricting students to those the user may see."""
    perms = user.permissions
    if 'students.read' in perms or 'tracking.read_all' in perms:
        return w
    if 'students.read_assigned' in perms or 'tracking.read_assigned' in perms:
        return w.add(
            f"""{alias}.section_id IN (
                 SELECT ta.section_id FROM teacher_assignments ta WHERE ta.employee_id = ?
                 UNION SELECT sec.id FROM sections sec WHERE sec.class_teacher_id = ?)""",
            user.employeeId, user.employeeId,
        )
    if user.parentId:
        return w.add(f'{alias}.id IN (SELECT sg.student_id FROM student_guardians sg WHERE sg.parent_id = ?)', user.parentId)
    if user.studentId:
        return w.add(f'{alias}.id = ?', user.studentId)
    return w.add('false')


def resolve_student_id(id_or_code: str) -> str:
    """Resolves a UUID or admission number to a student id, or raises 404."""
    is_uuid = bool(_UUID.match(id_or_code))
    row = one(f"SELECT id FROM students WHERE {'id = $1' if is_uuid else 'admission_no = $1'} AND deleted_at IS NULL", [id_or_code])
    if not row:
        raise not_found('Student not found', 'STUDENT_NOT_FOUND')
    return row['id']


def can_access_student(user: AuthUser, student_id: str) -> bool:
    p = user.permissions
    if 'students.read' in p:
        return True
    if 'students.read_assigned' in p and user.employeeId:
        r = one(
            """SELECT 1 FROM students s
                WHERE s.id = $1 AND s.section_id IN (
                  SELECT ta.section_id FROM teacher_assignments ta WHERE ta.employee_id = $2
                  UNION SELECT sec.id FROM sections sec WHERE sec.class_teacher_id = $2)""",
            [student_id, user.employeeId],
        )
        return bool(r)
    if user.parentId:
        return is_guardian_of(user.parentId, student_id)
    if user.studentId:
        return user.studentId == student_id
    return False


def is_guardian_of(parent_id: str, student_id: str, require_tracking: bool = False) -> bool:
    r = one(f"SELECT 1 FROM student_guardians WHERE parent_id = $1 AND student_id = $2 {'AND can_view_tracking' if require_tracking else ''}",
            [parent_id, student_id])
    return bool(r)


def authorize_student(req: Req, id_or_code: str) -> str:
    """Resolves and authorises a student in one step. 404 (not 403) outside the user's scope."""
    sid = resolve_student_id(id_or_code)
    if not can_access_student(req.user, sid):
        raise not_found('Student not found', 'STUDENT_NOT_FOUND')
    return sid


def authorize_student_tracking(req: Req, id_or_code: str) -> str:
    """Tracking has its own, stricter rule than general profile access."""
    user = req.user
    sid = resolve_student_id(id_or_code)
    p = user.permissions
    if 'tracking.read_all' in p:
        return sid
    if 'tracking.read_assigned' in p and can_access_student(dataclasses.replace(user, permissions={'students.read_assigned'}), sid):
        return sid
    if 'tracking.read_own_children' in p and user.parentId and is_guardian_of(user.parentId, sid, True):
        return sid
    raise not_found('Student not found', 'STUDENT_NOT_FOUND')


def assert_self_parent(req: Req, parent_id: str) -> None:
    """Parents may only address their own parent record through /parents/:id routes."""
    u = req.user
    if 'parents.read' in u.permissions:
        return
    if u.parentId and u.parentId == parent_id:
        return
    raise forbidden('You can only access your own family record')


studentScope, resolveStudentId, canAccessStudent, isGuardianOf = student_scope, resolve_student_id, can_access_student, is_guardian_of  # noqa: N816
authorizeStudent, authorizeStudentTracking, assertSelfParent = authorize_student, authorize_student_tracking, assert_self_parent  # noqa: N816
