import { many } from '../config/db.js';
import { Where } from '../utils/sql.js';
import { col, schoolToday, type ReportDef } from './intelligence-common.service.js';

/**
 * Platform reports for Super Admin: who holds which access, how people sign in,
 * what the audit trail records and where records are incomplete. These read the
 * identity and audit tables rather than a teaching domain, so they are restricted
 * by role key as well as by permission — a School Admin holds `users.manage` but
 * does not see security or cross-campus platform data here.
 */

const SUPER_ONLY = ['super_admin'];

/** Clamps a report range to a sane window and defaults it to the last 30 days. */
function range(from?: string, to?: string) {
  const end = to ?? schoolToday();
  const start = from ?? new Date(Date.parse(`${end}T00:00:00Z`) - 29 * 86_400_000).toISOString().slice(0, 10);
  return { start, end };
}

export const SYSTEM_REPORTS: ReportDef[] = [
  {
    key: 'user-access', group: 'System', title: 'User access review',
    description: 'Every account with its role, campus, sign-in recency and open sessions',
    perms: ['users.manage'], roles: SUPER_ONLY, filters: ['campus'],
    summary: [
      { key: 'accessFlag', label: 'Never signed in', agg: 'count', equals: 'Never signed in', tone: 'amber' },
      { key: 'accessFlag', label: 'Dormant 60+ days', agg: 'count', equals: 'Dormant', tone: 'amber' },
      { key: 'accessFlag', label: 'Locked out', agg: 'count', equals: 'Locked', tone: 'critical' },
      { key: 'activeSessions', label: 'Open sessions', agg: 'sum', tone: 'info' },
    ],
    chart: { mode: 'count', labelKey: 'role', label: 'Accounts by role' },
    build: async (_user, p) => {
      const w = new Where().add('u.deleted_at IS NULL');
      w.addIf(p.campusId, 'u.campus_id = ?');
      const rows = await many(
        `SELECT u.full_name AS "fullName", u.email::text AS email, r.name AS role,
                COALESCE(cp.short_name, 'All campuses') AS campus, u.status,
                to_char(u.last_login_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS "lastLogin",
                ((now() AT TIME ZONE 'Asia/Kolkata')::date
                 - (u.last_login_at AT TIME ZONE 'Asia/Kolkata')::date)::int AS "daysSinceLogin",
                (SELECT count(*) FROM refresh_tokens t
                  WHERE t.user_id = u.id AND t.revoked_at IS NULL AND t.expires_at > now())::int AS "activeSessions",
                u.failed_login_count AS "failedLogins",
                CASE WHEN u.locked_until > now() THEN 'Locked'
                     WHEN u.last_login_at IS NULL THEN 'Never signed in'
                     WHEN u.last_login_at < now() - interval '60 days' THEN 'Dormant'
                     ELSE 'Active' END AS "accessFlag",
                to_char(u.created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS created
           FROM users u
           JOIN roles r ON r.id = u.role_id
           LEFT JOIN campuses cp ON cp.id = u.campus_id
          ${w.sql}
          ORDER BY r.name, u.full_name`, w.params);
      return {
        columns: [col('fullName', 'Name'), col('email', 'Email'), col('role', 'Role'), col('campus', 'Campus'),
          col('status', 'Status'), col('accessFlag', 'Access'), col('lastLogin', 'Last sign-in'),
          col('daysSinceLogin', 'Days since'), col('activeSessions', 'Open sessions'),
          col('failedLogins', 'Failed attempts'), col('created', 'Created')],
        rows,
      };
    },
  },
  {
    key: 'login-activity', group: 'System', title: 'Sign-in activity',
    description: 'Successful and failed sign-ins per person per day, from the audit trail',
    perms: ['audit.read'], roles: SUPER_ONLY, filters: ['range'],
    summary: [
      { key: 'signIns', label: 'Sign-ins', agg: 'sum', tone: 'teal' },
      { key: 'failed', label: 'Failed attempts', agg: 'sum', tone: 'critical' },
      { key: 'devices', label: 'Distinct devices', agg: 'max', tone: 'info' },
    ],
    chart: { mode: 'value', labelKey: 'day', valueKey: 'signIns', label: 'Sign-ins per day' },
    build: async (_user, p) => {
      const { start, end } = range(p.from, p.to);
      const rows = await many(
        `SELECT to_char(a.created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS day,
                COALESCE(a.user_name, 'Anonymous') AS "user",
                COALESCE(a.role_key, '-') AS role,
                count(*) FILTER (WHERE a.action = 'login')::int AS "signIns",
                count(*) FILTER (WHERE a.action = 'login_failed')::int AS failed,
                count(*) FILTER (WHERE a.action = 'logout')::int AS "signOuts",
                count(DISTINCT a.device)::int AS devices,
                count(DISTINCT a.ip_address)::int AS "ipAddresses",
                to_char(max(a.created_at) AT TIME ZONE 'Asia/Kolkata', 'HH24:MI') AS "lastAt"
           FROM audit_logs a
          WHERE a.module = 'auth'
            AND a.created_at >= ($1::date::timestamp AT TIME ZONE 'Asia/Kolkata')
            AND a.created_at < (($2::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata')
          GROUP BY 1, 2, 3
          ORDER BY 1 DESC, 2`, [start, end]);
      return {
        columns: [col('day', 'Date'), col('user', 'User'), col('role', 'Role'), col('signIns', 'Sign-ins'),
          col('failed', 'Failed'), col('signOuts', 'Sign-outs'), col('devices', 'Devices'),
          col('ipAddresses', 'IP addresses'), col('lastAt', 'Last activity')],
        rows,
      };
    },
  },
  {
    key: 'role-permissions', group: 'System', title: 'Role and permission matrix',
    description: 'Every permission granted to every role, with the number of accounts holding it',
    perms: ['users.manage'], roles: SUPER_ONLY,
    summary: [{ key: 'accounts', label: 'Accounts covered', agg: 'max', tone: 'info' }],
    chart: { mode: 'count', labelKey: 'role', label: 'Permissions granted per role' },
    build: async () => {
      const rows = await many(
        `SELECT r.name AS role, r.key AS "roleKey", r.scope, r.home_route AS "homeRoute",
                p.module, p.key AS permission, COALESCE(p.description, '') AS description,
                (SELECT count(*) FROM users u WHERE u.role_id = r.id AND u.deleted_at IS NULL)::int AS accounts
           FROM roles r
           JOIN role_permissions rp ON rp.role_id = r.id
           JOIN permissions p ON p.id = rp.permission_id
          ORDER BY r.name, p.module, p.key`);
      return {
        columns: [col('role', 'Role'), col('roleKey', 'Role key'), col('scope', 'Data scope'),
          col('accounts', 'Accounts'), col('module', 'Module'), col('permission', 'Permission'),
          col('description', 'What it allows'), col('homeRoute', 'Home route')],
        rows,
      };
    },
  },
  {
    key: 'audit-trail', group: 'System', title: 'Audit trail extract',
    description: 'Recorded actions by user, module and entity over a date range',
    perms: ['audit.read'], roles: SUPER_ONLY, filters: ['range'],
    chart: { mode: 'count', labelKey: 'module', label: 'Entries by module' },
    build: async (_user, p) => {
      const { start, end } = range(p.from, p.to);
      const rows = await many(
        `SELECT to_char(a.created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI') AS "when",
                COALESCE(a.user_name, 'System') AS "user", COALESCE(a.role_key, '-') AS role,
                a.module, a.action, COALESCE(a.entity_type, '') AS "entityType",
                COALESCE(a.entity_id, '') AS "entityId", a.description,
                COALESCE(host(a.ip_address), '') AS ip, COALESCE(a.device, '') AS device
           FROM audit_logs a
          WHERE a.created_at >= ($1::date::timestamp AT TIME ZONE 'Asia/Kolkata')
            AND a.created_at < (($2::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata')
          ORDER BY a.created_at DESC
          LIMIT 5000`, [start, end]);
      return {
        columns: [col('when', 'When'), col('user', 'User'), col('role', 'Role'), col('module', 'Module'),
          col('action', 'Action'), col('entityType', 'Entity'), col('entityId', 'Entity id'),
          col('description', 'Description'), col('ip', 'IP address'), col('device', 'Device')],
        rows,
      };
    },
  },
  {
    key: 'data-quality', group: 'System', title: 'Data quality gaps',
    description: 'Records missing details that other modules depend on',
    perms: ['users.manage'], roles: SUPER_ONLY, filters: ['campus'],
    summary: [{ key: 'records', label: 'Records to fix', agg: 'sum', tone: 'amber' }],
    chart: { mode: 'value', labelKey: 'issue', valueKey: 'records', label: 'Records affected' },
    build: async (_user, p) => {
      // One row per check: how many records are missing the field, out of how many.
      const check = (area: string, issue: string, table: string, missing: string, scope: string) =>
        `SELECT '${area}' AS area, '${issue}' AS issue,
                count(*) FILTER (WHERE ${missing})::int AS records, count(*)::int AS total
           FROM ${table} WHERE ${scope}`;
      const s = `deleted_at IS NULL AND status = 'active'${p.campusId ? ' AND campus_id = $1' : ''}`;
      const e = `deleted_at IS NULL AND employment_status = 'active'${p.campusId ? ' AND campus_id = $1' : ''}`;
      const rows = await many(
        `${[
          check('Students', 'Contact email missing', 'students', 'email IS NULL', s),
          check('Students', 'Contact phone missing', 'students', 'phone IS NULL', s),
          check('Students', 'Home address missing', 'students', 'address IS NULL', s),
          check('Students', 'Photo missing', 'students', 'photo_url IS NULL', s),
          check('Students', 'Not placed in a section', 'students', 'section_id IS NULL', s),
          check('Students', 'Admission date missing', 'students', 'admitted_on IS NULL', s),
          check('Staff', 'Contact email missing', 'employees', 'email IS NULL', e),
          check('Staff', 'Contact phone missing', 'employees', 'phone IS NULL', e),
          check('Staff', 'Join date missing', 'employees', 'join_date IS NULL', e),
          check('Staff', 'Background check not verified', 'employees', 'NOT background_verified', e),
          check('Staff', 'No linked login', 'employees', 'user_id IS NULL', e),
        ].join('\nUNION ALL\n')}
         ORDER BY 3 DESC`, p.campusId ? [p.campusId] : []);
      return {
        columns: [col('area', 'Area'), col('issue', 'Gap'), col('records', 'Records'),
          col('total', 'Checked'), col('pct', 'Share %')],
        rows: rows.map((r) => ({ ...r, pct: r.total ? Math.round((r.records / r.total) * 1000) / 10 : 0 })),
      };
    },
  },
];
