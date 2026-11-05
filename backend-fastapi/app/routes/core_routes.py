"""Notifications, tasks, search, lookups, audit trail, users & roles, settings, documents
(routes/core.routes.ts)."""
from __future__ import annotations

import json

import psycopg
from starlette.responses import StreamingResponse

from ..db import many, one, query
from ..errors import bad_request, forbidden, not_found
from ..http import Req, Router, v, validate
from ..middleware.auth import clear_permission_cache, require_any, require_permission
from ..rbac import ALL_PERMISSIONS, SUPER_ADMIN_ONLY
from ..response import created, ok, paged
from ..services.access_service import authorize_student, student_scope
from ..services.audit_service import audit
from ..services.auth_service import hash_password
from ..services.documents_service import open_stored_file, safe_filename, upload, verify_uploaded_file
from ..services.notification_service import notify_roles, notify_users
from ..services.token_service import revoke_all_for_user
from ..utils.pagination import like_term, limit_offset, pagination_schema
from ..utils.sql import Where
from ..z import z

r = Router()
uuid_param = z.object({'id': z.uuid()})
any_ = require_any(*ALL_PERMISSIONS)  # any signed-in user with at least one permission

CATEGORIES = ['Critical', 'Attention', 'Information', 'Completed']


def _strip_total(rows: list[dict]) -> list[dict]:
    return [{k: val for k, val in x.items() if k != 'total'} for x in rows]


def _total(rows: list[dict]) -> int:
    return rows[0]['total'] if rows else 0


# =============================================================================
# Notifications (every role; always scoped to the signed-in user)
# =============================================================================
def list_notifications(req: Req):
    f = v(req, 'query')
    w = Where().add('n.user_id = ?', req.user.id)
    w.add_if(f.get('category'), 'n.category = ?')
    if f.get('unread'):
        w.add('n.read_at IS NULL')
    if f.get('q'):
        w.add('(n.title ILIKE ? OR n.body ILIKE ?)', like_term(f['q']), like_term(f['q']))
    lo = limit_offset(f)
    rows = many(
        f"""SELECT n.id, n.category, n.tone, n.icon, n.topic, n.title, n.body, n.route, n.entity_type AS "entityType",
                   n.entity_id AS "entityId", n.read_at AS "readAt", n.created_at AS "createdAt", count(*) OVER() AS total
              FROM notifications n {w.sql} ORDER BY n.created_at DESC LIMIT {w.param(lo['limit'])} OFFSET {w.param(lo['offset'])}""",
        w.params,
    )
    return paged(_strip_total(rows), _total(rows), f['page'], f['pageSize'], 'Notifications retrieved')


r.get('/notifications', any_,
      validate(pagination_schema.extend({'category': z.enum(CATEGORIES).optional(), 'unread': z.stringbool().optional()}), 'query'),
      list_notifications)


def notification_counts(req: Req):
    c = one(
        """SELECT count(*) FILTER (WHERE read_at IS NULL)::int AS unread,
                  count(*) FILTER (WHERE read_at IS NULL AND category IN ('Critical', 'Attention'))::int AS alerts,
                  count(*) FILTER (WHERE category = 'Critical')::int AS critical,
                  count(*) FILTER (WHERE category = 'Attention')::int AS attention,
                  count(*) FILTER (WHERE category = 'Information')::int AS information,
                  count(*) FILTER (WHERE category = 'Completed')::int AS completed,
                  count(*)::int AS total
             FROM notifications WHERE user_id = $1""", [req.user.id])
    tasks = one(
        """SELECT count(*)::int AS open FROM tasks
            WHERE status IN ('Pending', 'Under Review') AND (assignee_user_id = $1 OR assignee_role_key = $2)""",
        [req.user.id, req.user.roleKey])
    return ok({**(c or {}), 'openTasks': (tasks or {}).get('open') or 0}, 'Notification counts')


r.get('/notifications/counts', any_, notification_counts)


def mark_read(req: Req):
    x = query('UPDATE notifications SET read_at = COALESCE(read_at, now()) WHERE id = $1 AND user_id = $2',
              [v(req, 'params')['id'], req.user.id])
    if not x.row_count:
        raise not_found('Notification not found')
    return ok(None, 'Marked as read')


r.patch('/notifications/:id/read', any_, validate(uuid_param, 'params'), mark_read)


def read_all(req: Req):
    x = query('UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL', [req.user.id])
    return ok({'updated': x.row_count}, 'All notifications marked as read')


r.post('/notifications/read-all', any_, read_all)


def broadcast(req: Req):
    b = v(req)
    ids = notify_roles(b['roles'], {'category': b['category'], 'title': b['title'], 'body': b.get('body'), 'route': b.get('route'),
                                    'topic': 'broadcast', 'icon': 'megaphone', 'channels': b['channels']})
    audit(req, {'action': 'create', 'module': 'notifications',
                'description': f"Broadcast \"{b['title']}\" to {', '.join(b['roles'])} ({len(ids)} recipients)"})
    return created({'recipients': len(ids)}, 'Notification sent')


r.post('/notifications/broadcast', require_permission('notifications.broadcast'),
       validate(z.object({
           'roles': z.array(z.string().max(40)).min(1).max(12),
           'category': z.enum(CATEGORIES),
           'title': z.string().min(3).max(160),
           'body': z.string().max(1000).optional(),
           'route': z.string().max(200).regex(r'^/[\w\-/?=&]*$').optional(),
           'channels': z.array(z.enum(['whatsapp', 'sms', 'email', 'push'])).default([]),
       })),
       broadcast)


r.get('/notification-preferences', any_, lambda req: ok(many(
    'SELECT topic, in_app AS "inApp", whatsapp, sms, email, push FROM notification_preferences WHERE user_id = $1 ORDER BY topic',
    [req.user.id])))


def save_preferences(req: Req):
    for p in v(req):
        query(
            """INSERT INTO notification_preferences (user_id, topic, in_app, whatsapp, sms, email, push) VALUES ($1,$2,$3,$4,$5,$6,$7)
               ON CONFLICT (user_id, topic) DO UPDATE SET in_app = $3, whatsapp = $4, sms = $5, email = $6, push = $7, updated_at = now()""",
            [req.user.id, p['topic'], p['inApp'], p['whatsapp'], p['sms'], p['email'], p['push']])
    return ok(None, 'Preferences saved')


r.put('/notification-preferences', any_,
      validate(z.array(z.object({'topic': z.string().max(40), 'inApp': z.boolean(), 'whatsapp': z.boolean(), 'sms': z.boolean(),
                                 'email': z.boolean(), 'push': z.boolean()})).max(30)),
      save_preferences)


def register_device_token(req: Req):
    b = v(req)
    query(
        """INSERT INTO device_tokens (user_id, platform, token) VALUES ($1,$2,$3)
           ON CONFLICT (token) DO UPDATE SET user_id = $1, platform = $2, last_seen_at = now()""",
        [req.user.id, b['platform'], b['token']])
    return created(None, 'Device registered for push notifications')


r.post('/device-tokens', any_, validate(z.object({'platform': z.enum(['ios', 'android', 'web']), 'token': z.string().min(10).max(4096)})),
       register_device_token)


# =============================================================================
# Tasks (assigned to me or to my role)
# =============================================================================
def list_tasks(req: Req):
    f = v(req, 'query')
    w = Where().add('(t.assignee_user_id = ? OR t.assignee_role_key = ?)', req.user.id, req.user.roleKey)
    if not f.get('status') or f['status'] == 'open':
        w.add("t.status IN ('Pending', 'Under Review')")
    else:
        w.add('t.status = ?', f['status'])
    if f.get('q'):
        w.add('t.title ILIKE ?', like_term(f['q']))
    lo = limit_offset(f)
    rows = many(
        f"""SELECT t.id, t.code, t.title, t.module, t.due_on AS "dueOn", t.priority, t.status, t.route,
                   (t.due_on < current_date) AS overdue, t.completed_at AS "completedAt", count(*) OVER() AS total
              FROM tasks t {w.sql}
             ORDER BY (t.status = 'Completed'), array_position(ARRAY['High','Medium','Low'], t.priority), t.due_on NULLS LAST
             LIMIT {w.param(lo['limit'])} OFFSET {w.param(lo['offset'])}""", w.params)
    return paged(_strip_total(rows), _total(rows), f['page'], f['pageSize'], 'Tasks retrieved')


r.get('/tasks', any_, validate(pagination_schema.extend({'status': z.enum(['open', 'Pending', 'Under Review', 'Completed', 'Cancelled']).optional()}), 'query'),
      list_tasks)


def update_task(req: Req):
    status = v(req)['status']
    tid = v(req, 'params')['id']
    t = one(
        """UPDATE tasks SET status = $3,
                  completed_at = CASE WHEN $3 = 'Completed' THEN now() ELSE NULL END,
                  completed_by = CASE WHEN $3 = 'Completed' THEN $4::uuid ELSE NULL END
            WHERE id = $1 AND (assignee_user_id = $4 OR assignee_role_key = $2) RETURNING code, title""",
        [tid, req.user.roleKey, status, req.user.id])
    if not t:
        raise not_found('Task not found')
    audit(req, {'action': 'update', 'module': 'tasks', 'description': f"Task {t['code']} marked {status}", 'entityType': 'task', 'entityId': tid})
    return ok(None, 'Task updated')


r.patch('/tasks/:id', any_, validate(uuid_param, 'params'),
        validate(z.object({'status': z.enum(['Pending', 'Under Review', 'Completed', 'Cancelled'])})), update_task)


# =============================================================================
# Global search — scoped to what the signed-in user may open
# =============================================================================
def search(req: Req):
    u = req.user
    term = like_term(v(req, 'query')['q'])
    results: list[dict] = []
    p = u.permissions

    if 'students.read' in p or 'students.read_assigned' in p or u.parentId or u.studentId:
        w = Where().add('s.deleted_at IS NULL')
        student_scope(u, w)
        w.add('(s.full_name ILIKE ? OR s.admission_no ILIKE ?)', term, term)
        students = many(
            f"""SELECT s.id, s.full_name AS label, c.name || sec.name || ' · ' || s.admission_no AS meta
                  FROM students s LEFT JOIN sections sec ON sec.id = s.section_id LEFT JOIN classes c ON c.id = sec.class_id
                  {w.sql} ORDER BY s.full_name LIMIT 8""", w.params)
        for s in students:
            results.append({'group': 'My children' if u.parentId else 'Students', 'label': s['label'], 'meta': s['meta'], 'icon': 'user',
                            'route': f"/parent-360?child={s['id']}" if u.parentId else f"/student-360/{s['id']}"})
    if 'parents.read' in p:
        for x in many("""SELECT id, full_name AS label, phone AS meta FROM parents WHERE deleted_at IS NULL AND (full_name ILIKE $1 OR phone ILIKE $1)
                          ORDER BY full_name LIMIT 6""", [term]):
            results.append({'group': 'Parents', 'label': x['label'], 'meta': x['meta'], 'icon': 'users', 'route': f"/parent-directory?parent={x['id']}"})
    if 'hr.read' in p:
        for e in many("""SELECT id, full_name AS label, designation || ' · ' || employee_code AS meta FROM employees
                          WHERE deleted_at IS NULL AND (full_name ILIKE $1 OR employee_code ILIKE $1) ORDER BY full_name LIMIT 6""", [term]):
            results.append({'group': 'Employees', 'label': e['label'], 'meta': e['meta'], 'icon': 'briefcase', 'route': f"/workforce?employee={e['id']}"})
    if 'admissions.read' in p:
        for lead in many("""SELECT id, student_name || ' (' || parent_name || ')' AS label, stage || ' · ' || code AS meta FROM enquiries
                             WHERE deleted_at IS NULL AND (student_name ILIKE $1 OR parent_name ILIKE $1 OR code ILIKE $1) ORDER BY created_at DESC LIMIT 6""", [term]):
            results.append({'group': 'Admissions', 'label': lead['label'], 'meta': lead['meta'], 'icon': 'target', 'route': f"/leads?lead={lead['id']}"})
    if 'finance.read' in p:
        for x in many("""SELECT p.id, p.receipt_no AS label, s.full_name || ' · ₹' || p.amount AS meta FROM fee_payments p JOIN students s ON s.id = p.student_id
                          WHERE p.receipt_no ILIKE $1 ORDER BY p.paid_at DESC LIMIT 4""", [term]):
            results.append({'group': 'Fees', 'label': x['label'], 'meta': x['meta'], 'icon': 'receipt', 'route': f"/receipts?receipt={x['id']}"})
    if 'documents.read' in p:
        for d in many("""SELECT id, name AS label, category AS meta FROM documents WHERE deleted_at IS NULL AND student_id IS NULL AND name ILIKE $1 LIMIT 4""", [term]):
            results.append({'group': 'Documents', 'label': d['label'], 'meta': d['meta'], 'icon': 'folder', 'route': f"/documents?doc={d['id']}"})
    return ok(results, 'Search results')


r.get('/search', any_, validate(z.object({'q': z.string().trim().min(1).max(80)}), 'query'), search)


# =============================================================================
# Lookups for forms and filters
# =============================================================================
def lookups(req: Req):
    u = req.user
    staff = not u.parentId and not u.studentId
    campuses = many('SELECT id, code, name, short_name AS "shortName", place, curriculum, latitude, longitude FROM campuses WHERE is_active ORDER BY established')
    academic_years = many('SELECT id, label, starts_on AS "startsOn", ends_on AS "endsOn", is_current AS "isCurrent", is_locked AS "isLocked" FROM academic_years ORDER BY starts_on DESC')
    classes = many("""SELECT c.id, c.name, c.grade_level AS "gradeLevel", c.stage, c.board, c.campus_id AS "campusId",
                             COALESCE(json_agg(json_build_object('id', s.id, 'name', s.name, 'room', s.room) ORDER BY s.name) FILTER (WHERE s.id IS NOT NULL), '[]') AS sections
                        FROM classes c
                        LEFT JOIN sections s ON s.class_id = c.id AND s.academic_year_id = (SELECT id FROM academic_years WHERE is_current)
                       GROUP BY c.id ORDER BY c.campus_id, c.grade_level""") if staff else []
    subjects = many('SELECT id, code, name, stage, category FROM subjects ORDER BY name') if staff else []
    houses = [h['house'] for h in many('SELECT DISTINCT house FROM students WHERE house IS NOT NULL ORDER BY house')] if staff else []
    data: dict = {'campuses': campuses, 'academicYears': academic_years, 'classes': classes, 'subjects': subjects, 'houses': houses}
    if 'transport.read' in u.permissions or 'students.create' in u.permissions:
        data['routes'] = many("""SELECT tr.id, tr.code, tr.name, tr.area, tr.campus_id AS "campusId",
                                        COALESCE(json_agg(json_build_object('id', rs.id, 'name', rs.name) ORDER BY rs.sequence) FILTER (WHERE rs.id IS NOT NULL), '[]') AS stops
                                   FROM transport_routes tr LEFT JOIN route_stops rs ON rs.route_id = tr.id
                                  GROUP BY tr.id ORDER BY tr.code""")
    if staff:
        data['staff'] = many("""SELECT id, full_name AS "fullName", designation, employee_type AS "employeeType", department
                                  FROM employees WHERE deleted_at IS NULL AND employment_status = 'active' ORDER BY full_name""")
    if 'users.manage' in u.permissions:
        data['roles'] = many('SELECT id, key, name, description, scope FROM roles ORDER BY name')
    return ok(data, 'Lookups')


r.get('/lookups', any_, lookups)


# =============================================================================
# Audit trail
# =============================================================================
def audit_logs(req: Req):
    f = v(req, 'query')
    w = Where()
    w.add_if(f.get('module'), 'a.module = ?')
    w.add_if(f.get('action'), 'a.action = ?')
    w.add_if(f.get('userId'), 'a.user_id = ?')
    w.add_if(f.get('entityId'), 'a.entity_id = ?')
    # School days (Asia/Kolkata), whatever the database server's own timezone is.
    w.add_if(f.get('from'), "a.created_at >= (?::date::timestamp AT TIME ZONE 'Asia/Kolkata')")
    w.add_if(f.get('to'), "a.created_at < ((?::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata')")
    if f.get('q'):
        w.add('(a.description ILIKE ? OR a.user_name ILIKE ?)', like_term(f['q']), like_term(f['q']))
    lo = limit_offset(f)
    rows = many(
        f"""SELECT a.id, a.created_at AS "createdAt", a.user_name AS "userName", a.role_key AS role, a.action, a.module,
                   a.entity_type AS "entityType", a.entity_id AS "entityId", a.description, host(a.ip_address) AS ip,
                   a.device, a.user_agent AS "userAgent", count(*) OVER() AS total
              FROM audit_logs a {w.sql} ORDER BY a.created_at DESC, a.id DESC
              LIMIT {w.param(lo['limit'])} OFFSET {w.param(lo['offset'])}""", w.params)
    audit(req, {'action': 'view', 'module': 'audit', 'description': 'Viewed audit trail', 'metadata': {'filters': f}})
    return paged(_strip_total(rows), _total(rows), f['page'], f['pageSize'], 'Audit trail retrieved')


r.get('/audit-logs', require_permission('audit.read'),
      validate(pagination_schema.extend({
          'module': z.string().max(40).optional(), 'action': z.string().max(30).optional(),
          'userId': z.uuid().optional(), 'entityId': z.string().max(64).optional(),
          'from': z.iso.date().optional(), 'to': z.iso.date().optional(),
      }), 'query'),
      audit_logs)


# =============================================================================
# Users & roles
# =============================================================================
def list_users(req: Req):
    f = v(req, 'query')
    w = Where().add('u.deleted_at IS NULL')
    w.add_if(f.get('role'), 'r.key = ?')
    if f.get('q'):
        w.add('(u.full_name ILIKE ? OR u.email::text ILIKE ?)', like_term(f['q']), like_term(f['q']))
    lo = limit_offset(f)
    rows = many(
        f"""SELECT u.id, u.email, u.phone, u.full_name AS "fullName", u.title, u.status, r.key AS role, r.name AS "roleName",
                   u.last_login_at AS "lastLoginAt", u.locked_until AS "lockedUntil", count(*) OVER() AS total
              FROM users u JOIN roles r ON r.id = u.role_id {w.sql} ORDER BY u.full_name
              LIMIT {w.param(lo['limit'])} OFFSET {w.param(lo['offset'])}""", w.params)
    return paged(_strip_total(rows), _total(rows), f['page'], f['pageSize'], 'Users retrieved')


r.get('/users', require_permission('users.manage'), validate(pagination_schema.extend({'role': z.string().max(40).optional()}), 'query'), list_users)

password_rule = z.string().min(10).max(128).regex(r'[a-z]').regex(r'[A-Z]').regex(r'[0-9]')


def create_user(req: Req):
    b = v(req)
    role = one('SELECT id FROM roles WHERE key = $1', [b['roleKey']])
    if not role:
        raise bad_request('Unknown role', 'UNKNOWN_ROLE')
    if b['roleKey'] == 'super_admin' and req.user.roleKey != 'super_admin':
        raise forbidden('Only a Super Admin can create Super Admins')
    u = one(
        'INSERT INTO users (email, phone, password_hash, full_name, title, role_id, campus_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
        [b['email'].lower(), b.get('phone'), hash_password(b['password']), b['fullName'], b.get('title'), role['id'], b.get('campusId')])
    audit(req, {'action': 'create', 'module': 'users', 'description': f"Created user {b['email']} with role {b['roleKey']}",
                'entityType': 'user', 'entityId': u['id']})
    return created({'id': u['id']}, 'User created')


r.post('/users', require_permission('users.manage'),
       validate(z.object({
           'email': z.email(), 'phone': z.string().regex(r'^\+?[0-9 ]{8,16}$').optional(), 'fullName': z.string().min(2).max(120),
           'title': z.string().max(80).optional(), 'roleKey': z.string().max(40), 'campusId': z.uuid().optional(), 'password': password_rule,
       })),
       create_user)


def update_user(req: Req):
    uid = v(req, 'params')['id']
    b = v(req)
    if uid == req.user.id and (b.get('roleKey') or b.get('status') == 'suspended'):
        raise bad_request('You cannot change your own role or suspend yourself', 'SELF_CHANGE')
    if uid == req.user.id and b.get('password'):
        raise bad_request('Change your own password from My account, which asks for the current one', 'SELF_PASSWORD')
    if req.user.roleKey != 'super_admin':
        target = one('SELECT r.key FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1', [uid])
        if target and target['key'] == 'super_admin':
            raise forbidden('Only a Super Admin can change a Super Admin account')
    role_id = None
    if b.get('roleKey'):
        if b['roleKey'] == 'super_admin' and req.user.roleKey != 'super_admin':
            raise forbidden('Only a Super Admin can grant Super Admin')
        row = one('SELECT id FROM roles WHERE key = $1', [b['roleKey']])
        role_id = row['id'] if row else None
        if not role_id:
            raise bad_request('Unknown role', 'UNKNOWN_ROLE')
    pw_hash = hash_password(b['password']) if b.get('password') else None
    try:
        # A password reset also clears any lockout and ends every session (password_changed_at).
        x = query(
            """UPDATE users SET role_id = COALESCE($2, role_id), status = COALESCE($3, status), title = COALESCE($4, title),
                      full_name = COALESCE($6, full_name), phone = CASE WHEN $7 THEN $8 ELSE phone END,
                      password_hash = COALESCE($9, password_hash),
                      password_changed_at = CASE WHEN $9::text IS NULL THEN password_changed_at ELSE now() END,
                      failed_login_count = CASE WHEN $5 OR $9::text IS NOT NULL THEN 0 ELSE failed_login_count END,
                      locked_until = CASE WHEN $5 OR $9::text IS NOT NULL THEN NULL ELSE locked_until END
                WHERE id = $1 AND deleted_at IS NULL""",
            [uid, role_id, b.get('status'), b.get('title'), bool(b.get('unlock')), b.get('fullName'), 'phone' in b, b.get('phone'), pw_hash])
    except psycopg.errors.UniqueViolation:
        raise bad_request('Another account already uses that phone number', 'PHONE_TAKEN',
                          [{'field': 'phone', 'message': 'Already used by another account'}])
    if not x.row_count:
        raise not_found('User not found')
    if b.get('status') == 'suspended' or b.get('roleKey') or pw_hash:
        revoke_all_for_user(uid)
    # Never log the password itself.
    logged = {k: val for k, val in b.items() if k != 'password'}
    fields = list(logged) + (['password reset'] if pw_hash else [])
    audit(req, {'action': 'update', 'module': 'users', 'description': f"Updated user ({', '.join(fields)})", 'entityType': 'user',
                'entityId': uid, 'metadata': {**logged, 'passwordReset': bool(pw_hash)}})
    return ok(None, 'Password changed — the user is signed out everywhere' if pw_hash else 'User updated')


r.patch('/users/:id', require_permission('users.manage'), validate(uuid_param, 'params'),
        validate(z.object({
            'roleKey': z.string().max(40).optional(), 'status': z.enum(['active', 'suspended']).optional(),
            'title': z.string().max(80).optional(), 'unlock': z.boolean().optional(),
            'fullName': z.string().trim().min(2).max(120).optional(), 'phone': z.string().regex(r'^\+?[0-9 ]{8,16}$').nullable().optional(),
            # Admin reset: sets a new password for the user (they are signed out everywhere).
            'password': password_rule.optional(),
        })),
        update_user)


def list_roles(_req: Req):
    roles = many(
        """SELECT r.id, r.key, r.name, r.description, r.scope, r.home_route AS "homeRoute",
                  COALESCE(array_agg(p.key ORDER BY p.key) FILTER (WHERE p.key IS NOT NULL), '{}') AS permissions,
                  (SELECT count(*) FROM users u WHERE u.role_id = r.id AND u.deleted_at IS NULL)::int AS users
             FROM roles r LEFT JOIN role_permissions rp ON rp.role_id = r.id LEFT JOIN permissions p ON p.id = rp.permission_id
            GROUP BY r.id ORDER BY r.name""")
    permissions = many('SELECT key, module, description FROM permissions ORDER BY module, key')
    return ok({'roles': roles, 'permissions': permissions}, 'Roles and permissions')


r.get('/roles', require_any('users.manage', 'settings.manage'), list_roles)


def set_role_permissions(req: Req):
    rid = v(req, 'params')['id']
    role = one('SELECT key FROM roles WHERE id = $1', [rid])
    if not role:
        raise not_found('Role not found')
    if role['key'] == 'super_admin':
        raise forbidden('Super Admin permissions cannot be edited')
    perms: list[str] = v(req)['permissions']
    # Approve / reject rights belong to the Super Admin alone — nobody else can hand them out.
    if req.user.roleKey != 'super_admin' and any(p in SUPER_ADMIN_ONLY for p in perms):
        raise forbidden('Only a Super Admin can grant approval rights')
    query('DELETE FROM role_permissions WHERE role_id = $1', [rid])
    query('INSERT INTO role_permissions (role_id, permission_id) SELECT $1, id FROM permissions WHERE key = ANY($2)', [rid, perms])
    clear_permission_cache()
    audit(req, {'action': 'update', 'module': 'users', 'description': f"Changed permissions for role {role['key']}", 'entityType': 'role',
                'entityId': rid, 'metadata': {'permissions': perms}})
    return ok(None, 'Role permissions updated')


r.put('/roles/:id/permissions', require_permission('users.manage', 'settings.manage'), validate(uuid_param, 'params'),
      validate(z.object({'permissions': z.array(z.string().max(60)).max(200)})), set_role_permissions)


# =============================================================================
# System settings
# =============================================================================
r.get('/settings', require_permission('settings.manage'), lambda req: ok(many(
    'SELECT key, value, description, is_public AS "isPublic", updated_at AS "updatedAt" FROM system_settings ORDER BY key')))


def save_setting(req: Req):
    key = v(req, 'params')['key']
    x = query('UPDATE system_settings SET value = $2, updated_by = $3 WHERE key = $1', [key, json.dumps(v(req)['value']), req.user.id])
    if not x.row_count:
        raise not_found('Setting not found')
    audit(req, {'action': 'update', 'module': 'settings', 'description': f'Changed setting {key}'})
    return ok(None, 'Setting saved')


r.put('/settings/:key', require_permission('settings.manage'),
      validate(z.object({'key': z.string().regex(r'^[a-z0-9_.]{2,60}$')}), 'params'), validate(z.object({'value': z.json()})),
      save_setting)


# =============================================================================
# Documents — secure upload & download
# =============================================================================
_document_body = z.object({
    'name': z.string().min(2).max(160),
    'category': z.string().max(60).default('General'),
    'studentId': z.string().max(64).optional(),
    'documentId': z.uuid().optional(),  # fulfil an existing "Pending" request
    'collection': z.string().max(80).optional(),
})


def upload_document(req: Req):
    success, parsed = _document_body.safeParse(req.body if isinstance(req.body, dict) else {})
    if not success:
        raise bad_request('Validation failed', 'VALIDATION_ERROR',
                          [{'field': '.'.join(map(str, i['path'])), 'message': i['message']} for i in parsed.issues])
    body = parsed
    if not req.file:
        raise bad_request('Attach a file in the "file" field', 'FILE_REQUIRED')
    u = req.user
    student_id = None
    if body.get('studentId'):
        student_id = authorize_student(req, body['studentId'])
    elif 'documents.manage' not in u.permissions:
        raise forbidden('Only document managers can upload school documents')
    stored = verify_uploaded_file(req.file)
    if body.get('documentId'):
        row = one(
            """UPDATE documents SET storage_key = $2, original_name = $3, mime_type = $4, size_bytes = $5, checksum_sha256 = $6,
                      status = 'Submitted', uploaded_by = $7
                WHERE id = $1 AND (student_id IS NOT DISTINCT FROM $8) AND deleted_at IS NULL RETURNING id""",
            [body['documentId'], stored['storageKey'], safe_filename(req.file.originalname), req.file.mimetype, stored['size'],
             stored['checksum'], u.id, student_id])
        if not row:
            raise not_found('Document request not found')
        doc_id = row['id']
    else:
        row = one(
            """INSERT INTO documents (owner_type, owner_id, student_id, name, category, collection, status, storage_key, original_name,
                                      mime_type, size_bytes, checksum_sha256, uploaded_by)
               VALUES ($1,$2,$3,$4,$5,$6,'Submitted',$7,$8,$9,$10,$11,$12) RETURNING id""",
            ['student' if student_id else 'school', student_id, student_id, body['name'], body['category'], body.get('collection'),
             stored['storageKey'], safe_filename(req.file.originalname), req.file.mimetype, stored['size'], stored['checksum'], u.id])
        doc_id = row['id']
    audit(req, {'action': 'create', 'module': 'documents', 'description': f"Uploaded document \"{body['name']}\"", 'entityType': 'document',
                'entityId': doc_id, 'metadata': {'studentId': student_id}})
    if u.parentId:
        notify_roles(['office'], {'category': 'Attention', 'topic': 'documents', 'icon': 'folder',
                                  'title': f"Parent uploaded \"{body['name']}\" for verification", 'route': '/documents'})
    return created({'id': doc_id}, 'Document uploaded')


r.post('/documents', require_any('documents.manage', 'students.update', 'parent_portal.use'), upload.single('file'), upload_document)


def download_document(req: Req):
    d = one('SELECT id, student_id, storage_key, original_name, mime_type, name FROM documents WHERE id = $1 AND deleted_at IS NULL',
            [v(req, 'params')['id']])
    if not d or not d['storage_key']:
        raise not_found('Document not found')
    if d['student_id']:
        authorize_student(req, d['student_id'])
    elif 'documents.read' not in req.user.permissions:
        raise not_found('Document not found')
    stream = open_stored_file(d['storage_key'])
    if stream is None:
        raise not_found('File is no longer available')
    audit(req, {'action': 'view', 'module': 'documents', 'description': f"Downloaded \"{d['name']}\"", 'entityType': 'document', 'entityId': d['id']})
    return StreamingResponse(stream, media_type=d['mime_type'] or 'application/octet-stream', headers={
        'Content-Disposition': f"attachment; filename=\"{safe_filename(d['original_name'] or d['name'])}\"",
        'X-Content-Type-Options': 'nosniff',
    })


r.get('/documents/:id/download', any_, validate(uuid_param, 'params'), download_document)


def verify_document(req: Req):
    b = v(req)
    did = v(req, 'params')['id']
    d = one("""UPDATE documents SET status = $2, verified_by = $3, verified_at = now() WHERE id = $1 AND deleted_at IS NULL
               RETURNING name, student_id, uploaded_by""", [did, b['status'], req.user.id])
    if not d:
        raise not_found('Document not found')
    if d['uploaded_by'] and d['uploaded_by'] != req.user.id:
        notify_users([d['uploaded_by']], {'category': 'Completed' if b['status'] == 'Verified' else 'Attention', 'topic': 'documents',
                                          'icon': 'folder', 'title': f"\"{d['name']}\" was {b['status'].lower()}", 'body': b.get('note')})
    audit(req, {'action': 'approve', 'module': 'documents', 'description': f"{b['status']} document \"{d['name']}\"", 'entityType': 'document',
                'entityId': did})
    return ok(None, f"Document {b['status'].lower()}")


# Verifying or rejecting a document is an approval decision: Super Admin only.
r.patch('/documents/:id/verify', require_permission('approvals.decide'), validate(uuid_param, 'params'),
        validate(z.object({'status': z.enum(['Verified', 'Rejected']), 'note': z.string().max(300).optional()})), verify_document)
