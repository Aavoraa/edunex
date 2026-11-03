import type { Request } from 'express';
import { many, one, query, tx } from '../config/db.js';
import { badRequest, forbidden, notFound } from '../utils/errors.js';
import { nextCode } from '../utils/codes.js';
import { likeTerm, limitOffset, orderBy, type Pagination } from '../utils/pagination.js';
import { Where } from '../utils/sql.js';
import { audit } from './audit.service.js';
import { notifyGuardians, notifyRoles, notifyUsers, type Channel } from './notification.service.js';
import {
  assertEmployee, authorizeSafetyStudent, localDate, PARENT_ROUTE, resolveCampus, safetyStudentScope,
  safetyStudentScopeNullable, studentBrief, TODAY,
} from './safety-common.service.js';
import type { AuthUser } from '../types.js';

const sensitive = (u: AuthUser) => u.permissions.has('students.sensitive');
const yearStart = `(SELECT starts_on FROM academic_years WHERE is_current LIMIT 1)`;

// =============================================================================
// Incidents & safeguarding
// =============================================================================
const INCIDENT_SELECT = `
  SELECT i.id, i.code, i.campus_id AS "campusId", cp.short_name AS "campusName", i.incident_type AS "incidentType",
         i.summary, i.details, i.severity, i.status, i.occurred_on AS "occurredOn", i.is_confidential AS "isConfidential",
         i.student_id AS "studentId", s.full_name AS "studentName", s.admission_no AS "admissionNo",
         i.owner_id AS "ownerId", e.full_name AS "ownerName", u.full_name AS "createdByName",
         i.created_at AS "createdAt", i.updated_at AS "updatedAt"
    FROM incidents i
    JOIN campuses cp ON cp.id = i.campus_id
    LEFT JOIN students s ON s.id = i.student_id
    LEFT JOIN employees e ON e.id = i.owner_id
    LEFT JOIN users u ON u.id = i.created_by`;

const INCIDENT_SORTS: Record<string, string> = {
  code: 'x.code', date: 'x."occurredOn"', type: 'x."incidentType"', severity: 'x.severity', status: 'x.status', owner: 'x."ownerName"',
};

export interface IncidentFilters extends Pagination {
  campusId?: string; type?: string; status?: string; severity?: string; studentId?: string; from?: string; to?: string;
}

function incidentWhere(user: AuthUser, f: Partial<IncidentFilters>) {
  const w = new Where();
  if (!sensitive(user)) w.add('NOT i.is_confidential');
  safetyStudentScopeNullable(user, w, 'i.student_id');
  w.addIf(f.campusId, 'i.campus_id = ?');
  w.addIf(f.type, 'i.incident_type = ?');
  w.addIf(f.status, 'i.status = ?');
  w.addIf(f.severity, 'i.severity = ?');
  w.addIf(f.from, 'i.occurred_on >= ?::date');
  w.addIf(f.to, 'i.occurred_on <= ?::date');
  if (f.q) w.add('(i.code ILIKE ? OR i.summary ILIKE ?)', likeTerm(f.q), likeTerm(f.q));
  return w;
}

/** Details of confidential incidents are only returned to users with students.sensitive. */
export async function listIncidents(req: Request, f: IncidentFilters) {
  const user = req.user!;
  const w = incidentWhere(user, f);
  if (f.studentId) w.add('i.student_id = ?', await authorizeSafetyStudent(req, f.studentId));
  const { limit, offset } = limitOffset(f);
  const rows = await many(
    `SELECT x.*, count(*) OVER() AS total FROM (${INCIDENT_SELECT} ${w.sql}) x
      ORDER BY ${orderBy(f.sort, f.dir, INCIDENT_SORTS, 'date')}, x.code DESC
      LIMIT ${w.param(limit)} OFFSET ${w.param(offset)}`,
    w.params,
  );
  if (rows.some((r) => r.isConfidential)) {
    await audit(req, { action: 'view', module: 'safety', description: 'Viewed confidential safeguarding records (list)', metadata: { filters: f } });
  }
  return { rows: rows.map(({ total: _t, ...r }) => r), total: rows[0]?.total ?? 0 };
}

export async function getIncident(req: Request, id: string) {
  const w = incidentWhere(req.user!, {});
  w.add('i.id = ?', id);
  const r = await one(`${INCIDENT_SELECT} ${w.sql}`, w.params);
  if (!r) throw notFound('Incident not found', 'INCIDENT_NOT_FOUND');
  if (r.isConfidential) {
    await audit(req, { action: 'view', module: 'safety', description: `Viewed confidential incident ${r.code}`, entityType: 'incident', entityId: id });
  }
  return r;
}

export async function incidentSummary(user: AuthUser, campusId?: string) {
  const w = incidentWhere(user, { campusId });
  const r = await one(
    `SELECT count(*) FILTER (WHERE i.incident_type = 'Safeguarding' AND i.status <> 'Closed')::int AS "openConcerns",
            count(*) FILTER (WHERE i.incident_type = 'Safeguarding' AND i.status = 'Under Review')::int AS "underReview",
            count(*) FILTER (WHERE i.incident_type = 'Safeguarding' AND i.status = 'Closed' AND i.occurred_on >= ${yearStart})::int AS "closedThisYear",
            count(*) FILTER (WHERE i.incident_type = 'Safeguarding' AND i.status = 'Closed' AND i.occurred_on >= ${yearStart}
                             AND i.updated_at - i.created_at <= interval '24 hours')::int AS "closedWithin24h",
            count(*) FILTER (WHERE i.status = 'Escalated')::int AS escalated,
            count(*) FILTER (WHERE i.status <> 'Closed')::int AS "openAll",
            count(*) FILTER (WHERE i.is_confidential)::int AS confidential,
            count(*) FILTER (WHERE i.occurred_on >= ${TODAY} - 30)::int AS "last30Days"
       FROM incidents i ${w.sql}`,
    w.params,
  );
  const byType = await many(
    `SELECT i.incident_type AS type, count(*)::int AS n FROM incidents i ${w.sql} ${w.sql ? 'AND' : 'WHERE'} i.occurred_on >= ${yearStart}
      GROUP BY 1 ORDER BY 2 DESC`,
    w.params,
  );
  const cw = new Where();
  cw.add(`(c.item ~* '(child|safeguard|background|fire|first aid|posh|cctv)')`);
  cw.addIf(campusId, 'c.campus_id = ?');
  const compliance = await many(
    `SELECT c.id, c.item, c.authority, c.owner_name AS owner, c.due_on AS "dueOn", c.status FROM compliance_items c ${cw.sql} ORDER BY c.due_on LIMIT 12`,
    cw.params,
  );
  return { ...r, byType, compliance, canViewConfidential: sensitive(user) };
}

export interface IncidentInput {
  incidentType: string; summary: string; details?: string; severity: string; studentId?: string;
  ownerId?: string; occurredOn?: string; isConfidential: boolean; campusId?: string;
}

export async function createIncident(req: Request, input: IncidentInput) {
  const user = req.user!;
  const studentId = input.studentId ? await authorizeSafetyStudent(req, input.studentId) : null;
  if (input.isConfidential && !sensitive(user) && input.incidentType !== 'Safeguarding') {
    throw forbidden('Only safeguarding leads can mark records confidential');
  }
  if (input.occurredOn && input.occurredOn > new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())) {
    throw badRequest('The date cannot be in the future', 'DATE_IN_FUTURE', [{ field: 'occurredOn', message: 'Cannot be in the future' }]);
  }
  const id = await tx(async (db) => {
    const campusId = studentId ? (await studentBrief(studentId, db)).campus_id : await resolveCampus(user, input.campusId, db);
    if (input.ownerId) await assertEmployee(input.ownerId, db);
    const code = await nextCode('incidents', 'code', 'INC-', db);
    const r = await one<{ id: string }>(
      `INSERT INTO incidents (code, campus_id, incident_type, summary, details, severity, status, student_id, owner_id, occurred_on, is_confidential, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,'Open',$7,$8, COALESCE($9::date, ${TODAY}), $10, $11) RETURNING id`,
      [code, campusId, input.incidentType, input.summary, input.details ?? null, input.severity, studentId,
        input.ownerId ?? user.employeeId, input.occurredOn ?? null, input.isConfidential, user.id], db,
    );
    // The Designated Safeguarding Lead (principal) reviews every concern within 24 hours.
    if (input.incidentType === 'Safeguarding' || input.severity === 'Critical') {
      await notifyRoles(['principal'], {
        category: input.severity === 'Critical' ? 'Critical' : 'Attention', icon: 'shield', topic: 'safety',
        title: input.isConfidential ? `Confidential concern logged (${code})` : `${input.incidentType} incident ${code}: ${input.summary}`,
        body: 'Review within 24 hours', route: '/safeguarding', entityType: 'incident', entityId: r!.id,
      }, db);
    }
    await audit(req, {
      action: 'create', module: 'safety',
      description: `Logged ${input.isConfidential ? 'confidential ' : ''}${input.incidentType.toLowerCase()} incident ${code}`,
      entityType: 'incident', entityId: r!.id, metadata: { severity: input.severity },
    }, db);
    return { id: r!.id, code };
  });
  // Staff may raise a confidential concern they are not allowed to read back.
  if (input.isConfidential && !sensitive(user)) {
    return { id: id.id, code: id.code, isConfidential: true, status: 'Open', message: 'Logged and sent to the Designated Safeguarding Lead' };
  }
  return getIncident(req, id.id);
}

export async function updateIncident(req: Request, id: string, input: { status?: string; severity?: string; ownerId?: string | null; details?: string }) {
  const cur = await getIncident(req, id); // enforces visibility
  await tx(async (db) => {
    if (input.ownerId) await assertEmployee(input.ownerId, db);
    await query(
      `UPDATE incidents SET status = COALESCE($2, status), severity = COALESCE($3, severity),
              owner_id = CASE WHEN $4::boolean THEN $5::uuid ELSE owner_id END, details = COALESCE($6, details)
        WHERE id = $1`,
      [id, input.status ?? null, input.severity ?? null, 'ownerId' in input, input.ownerId ?? null, input.details ?? null], db,
    );
    const approval = input.status === 'Closed' ? 'approve' : 'update';
    await audit(req, {
      action: approval, module: 'safety',
      description: `Updated incident ${cur.code}${input.status && input.status !== cur.status ? `: ${cur.status} → ${input.status}` : ''}`,
      entityType: 'incident', entityId: id, metadata: { ...input, details: input.details ? '[updated]' : undefined },
    }, db);
  });
  return getIncident(req, id);
}

// =============================================================================
// Emergency broadcasts
// =============================================================================
export const AUDIENCE_ROLES: Record<string, string[]> = {
  parents: ['parent'],
  teachers: ['teacher'],
  staff: ['staff', 'office', 'hr', 'finance'],
  management: ['principal', 'management', 'school_admin', 'super_admin'],
};
const AUDIENCE_LABEL: Record<string, string> = { parents: 'Parents', teachers: 'Teachers', staff: 'Staff', management: 'Management' };
const CHANNELS: Record<string, Channel[]> = {
  'App + WhatsApp + SMS': ['push', 'whatsapp', 'sms'],
  'App + WhatsApp': ['push', 'whatsapp'],
  'SMS only': ['sms'],
};

function audienceUsersSql(campusId?: string) {
  return `SELECT u.id, r.key FROM users u JOIN roles r ON r.id = u.role_id
           WHERE u.status = 'active' AND u.deleted_at IS NULL AND r.key = ANY($1)
           ${campusId ? 'AND (u.campus_id IS NULL OR u.campus_id = $2)' : ''}`;
}

export async function audience(campusId?: string) {
  const all = Object.values(AUDIENCE_ROLES).flat();
  const rows = await many<{ id: string; key: string }>(audienceUsersSql(campusId), campusId ? [all, campusId] : [all]);
  return Object.entries(AUDIENCE_ROLES).map(([k, roles]) => ({
    key: k, label: AUDIENCE_LABEL[k], count: rows.filter((r) => roles.includes(r.key)).length,
  }));
}

export async function listBroadcasts(f: Pagination & { campusId?: string }) {
  const w = new Where();
  if (f.campusId) w.add('(b.campus_id IS NULL OR b.campus_id = ?)', f.campusId);
  if (f.q) w.add('(b.message ILIKE ? OR b.alert_type ILIKE ?)', likeTerm(f.q), likeTerm(f.q));
  const { limit, offset } = limitOffset(f);
  const rows = await many(
    `SELECT b.id, b.alert_type AS "alertType", b.message, b.audience, b.recipients, b.sent_at AS "sentAt",
            u.full_name AS "sentByName", cp.short_name AS "campusName", count(*) OVER() AS total
       FROM emergency_broadcasts b LEFT JOIN users u ON u.id = b.sent_by LEFT JOIN campuses cp ON cp.id = b.campus_id
      ${w.sql} ORDER BY b.sent_at DESC LIMIT ${w.param(limit)} OFFSET ${w.param(offset)}`,
    w.params,
  );
  return { rows: rows.map(({ total: _t, ...r }) => r), total: rows[0]?.total ?? 0 };
}

export interface BroadcastInput { alertType: string; message: string; audiences: string[]; channels: string; campusId?: string }

/** Critical notifications bypass per-user preferences (see notifyUsers). */
export async function sendBroadcast(req: Request, input: BroadcastInput) {
  const user = req.user!;
  const roles = [...new Set(input.audiences.flatMap((a) => AUDIENCE_ROLES[a]))];
  const isDrill = input.alertType === 'Drill';
  const title = isDrill ? `DRILL — ${input.message.slice(0, 90)}` : `${input.alertType}: ${input.message.slice(0, 90)}`;
  const channels = CHANNELS[input.channels];
  return tx(async (db) => {
    if (input.campusId) await resolveCampus(user, input.campusId, db);
    const n = {
      category: 'Critical' as const, icon: 'megaphone', topic: 'emergency', title,
      body: isDrill ? `${input.message}\n\nThis is a drill.` : input.message,
      route: '/emergency', channels,
    };
    let ids: string[];
    if (input.campusId) {
      const users = await many<{ id: string }>(audienceUsersSql(input.campusId), [roles, input.campusId], db);
      ids = await notifyUsers(users.map((u) => u.id), n, db);
    } else {
      ids = await notifyRoles(roles, n, db);
    }
    const audienceText = `${input.audiences.map((a) => AUDIENCE_LABEL[a]).join(', ')} · ${input.channels}`;
    const b = await one<{ id: string; sent_at: Date }>(
      `INSERT INTO emergency_broadcasts (campus_id, alert_type, message, audience, recipients, sent_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, sent_at`,
      [input.campusId ?? null, input.alertType, input.message, audienceText, ids.length, user.id], db,
    );
    let incidentCode: string | null = null;
    if (['Emergency', 'Lockdown', 'Evacuation'].includes(input.alertType)) {
      incidentCode = await nextCode('incidents', 'code', 'INC-', db);
      await query(
        `INSERT INTO incidents (code, campus_id, incident_type, summary, details, severity, status, owner_id, occurred_on, created_by)
         VALUES ($1,$2,'Emergency',$3,$4,'Critical','Open',$5, ${TODAY}, $6)`,
        [incidentCode, await resolveCampus(user, input.campusId, db), `${input.alertType} broadcast — ${input.message.slice(0, 120)}`,
          `Broadcast to ${audienceText}; ${ids.length} recipients.`, user.employeeId, user.id], db,
      );
    }
    await audit(req, {
      action: 'broadcast', module: 'safety',
      description: `Sent ${input.alertType.toLowerCase()} broadcast to ${ids.length} recipients (${audienceText})`,
      entityType: 'emergency_broadcast', entityId: b!.id, metadata: { message: input.message, incidentCode },
    }, db);
    return { id: b!.id, sentAt: b!.sent_at, recipients: ids.length, audience: audienceText, incidentCode };
  });
}

// =============================================================================
// Infirmary
// =============================================================================
export interface InfirmaryFilters extends Pagination { campusId?: string; date?: string; outcome?: string }

const VISIT_SELECT = `
  SELECT iv.id, iv.visited_at AS "visitedAt", iv.reason, iv.action_taken AS "actionTaken", iv.outcome,
         iv.parent_informed AS "parentInformed", iv.attended_by AS "attendedById", e.full_name AS "attendedBy",
         s.id AS "studentId", s.full_name AS "studentName", s.admission_no AS "admissionNo", c.name AS grade, sec.name AS section,
         iv.updated_at AS "updatedAt"
    FROM infirmary_visits iv
    JOIN students s ON s.id = iv.student_id
    LEFT JOIN sections sec ON sec.id = s.section_id
    LEFT JOIN classes c ON c.id = sec.class_id
    LEFT JOIN employees e ON e.id = iv.attended_by`;

const VISIT_SORTS: Record<string, string> = { time: 'x."visitedAt"', student: 'x."studentName"', reason: 'x.reason', outcome: 'x.outcome' };

export async function listVisits(user: AuthUser, f: InfirmaryFilters) {
  const w = new Where();
  w.add(`${localDate('iv.visited_at')} = COALESCE(?::date, ${TODAY})`, f.date ?? null);
  safetyStudentScope(user, w);
  w.addIf(f.campusId, 's.campus_id = ?');
  w.addIf(f.outcome, 'iv.outcome = ?');
  if (f.q) w.add('(s.full_name ILIKE ? OR s.admission_no ILIKE ? OR iv.reason ILIKE ?)', likeTerm(f.q), likeTerm(f.q), likeTerm(f.q));
  const { limit, offset } = limitOffset(f);
  const rows = await many(
    `SELECT x.*, count(*) OVER() AS total FROM (${VISIT_SELECT} ${w.sql}) x
      ORDER BY ${orderBy(f.sort, f.dir, VISIT_SORTS, 'time')} LIMIT ${w.param(limit)} OFFSET ${w.param(offset)}`,
    w.params,
  );
  return { rows: rows.map(({ total: _t, ...r }) => r), total: rows[0]?.total ?? 0 };
}

export async function infirmarySummary(user: AuthUser, campusId?: string) {
  const w = new Where();
  w.add('s.deleted_at IS NULL');
  safetyStudentScope(user, w);
  w.addIf(campusId, 's.campus_id = ?');
  const month = `date_trunc('month', now() AT TIME ZONE 'Asia/Kolkata')`;
  const r = await one(
    `SELECT count(*) FILTER (WHERE ${localDate('iv.visited_at')} = ${TODAY})::int AS today,
            count(*) FILTER (WHERE ${localDate('iv.visited_at')} = ${TODAY} AND iv.outcome IN ('Sent home', 'Awaiting pickup', 'Referred to hospital'))::int AS "sentHome",
            count(*) FILTER (WHERE ${localDate('iv.visited_at')} = ${TODAY} AND iv.outcome = 'Awaiting pickup')::int AS "awaitingPickup",
            count(*) FILTER (WHERE ${localDate('iv.visited_at')} = ${TODAY} AND NOT iv.parent_informed)::int AS "parentNotInformed",
            count(*) FILTER (WHERE (iv.visited_at AT TIME ZONE 'Asia/Kolkata') >= ${month})::int AS "thisMonth",
            count(*) FILTER (WHERE (iv.visited_at AT TIME ZONE 'Asia/Kolkata') >= ${month} - interval '1 month'
                               AND (iv.visited_at AT TIME ZONE 'Asia/Kolkata') < (now() AT TIME ZONE 'Asia/Kolkata') - interval '1 month')::int AS "lastMonthToDate"
       FROM infirmary_visits iv JOIN students s ON s.id = iv.student_id ${w.sql}`,
    w.params,
  );
  const med = await one<{ n: number }>(
    `SELECT count(*)::int AS n FROM students s ${w.sql} AND s.status = 'active' AND COALESCE(trim(s.medical_notes), '') <> ''`,
    w.params,
  );
  const reasons = await many(
    `SELECT iv.reason AS label, count(*)::int AS value FROM infirmary_visits iv JOIN students s ON s.id = iv.student_id
      ${w.sql} AND ${localDate('iv.visited_at')} >= ${yearStart}
      GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 6`,
    w.params,
  );
  const delta = r!.lastMonthToDate ? Math.round(((r!.thisMonth - r!.lastMonthToDate) / r!.lastMonthToDate) * 100) : null;
  return { ...r, monthDeltaPct: delta, medicalOnFile: med!.n, reasons };
}

async function getVisit(id: string) {
  const r = await one(`${VISIT_SELECT} WHERE iv.id = $1`, [id]);
  if (!r) throw notFound('Visit not found', 'VISIT_NOT_FOUND');
  return r;
}

async function informGuardians(studentId: string, name: string, reason: string, outcome: string, db: import('../config/db.js').Queryable) {
  await notifyGuardians(studentId, {
    category: ['Awaiting pickup', 'Sent home', 'Referred to hospital'].includes(outcome) ? 'Attention' : 'Information',
    icon: 'stethoscope', topic: 'health',
    title: outcome === 'Awaiting pickup' ? `Please collect ${name} from school` : `${name} visited the school infirmary`,
    body: `${reason} · ${outcome}`, route: PARENT_ROUTE, entityType: 'student', entityId: studentId,
  }, db);
}

export async function createVisit(req: Request, input: { studentId: string; reason: string; actionTaken?: string; outcome: string; parentInformed: boolean; visitedAt?: string }) {
  const studentId = await authorizeSafetyStudent(req, input.studentId);
  if (input.visitedAt && new Date(input.visitedAt).getTime() > Date.now() + 5 * 60_000) {
    throw badRequest('The visit time cannot be in the future', 'TIME_IN_FUTURE', [{ field: 'visitedAt', message: 'Cannot be in the future' }]);
  }
  const id = await tx(async (db) => {
    const s = await studentBrief(studentId, db);
    const r = await one<{ id: string }>(
      `INSERT INTO infirmary_visits (student_id, visited_at, reason, action_taken, outcome, attended_by, parent_informed)
       VALUES ($1, COALESCE($2::timestamptz, now()), $3, $4, $5, $6, $7) RETURNING id`,
      [studentId, input.visitedAt ?? null, input.reason, input.actionTaken ?? null, input.outcome, req.user!.employeeId, input.parentInformed], db,
    );
    if (input.parentInformed) await informGuardians(studentId, s.full_name, input.reason, input.outcome, db);
    await audit(req, {
      action: 'create', module: 'safety', description: `Logged infirmary visit for ${s.full_name}`,
      entityType: 'student', entityId: studentId, metadata: { visitId: r!.id, outcome: input.outcome },
    }, db);
    return r!.id;
  });
  return getVisit(id);
}

export async function updateVisit(req: Request, id: string, input: { outcome?: string; actionTaken?: string; parentInformed?: boolean }) {
  const cur = await getVisit(id);
  await authorizeSafetyStudent(req, cur.studentId);
  await tx(async (db) => {
    await query(
      `UPDATE infirmary_visits SET outcome = COALESCE($2, outcome), action_taken = COALESCE($3, action_taken),
              parent_informed = COALESCE($4, parent_informed) WHERE id = $1`,
      [id, input.outcome ?? null, input.actionTaken ?? null, input.parentInformed ?? null], db,
    );
    const outcome = input.outcome ?? cur.outcome;
    if ((input.parentInformed && !cur.parentInformed) || (cur.parentInformed && input.outcome && input.outcome !== cur.outcome)) {
      await informGuardians(cur.studentId, cur.studentName, cur.reason, outcome, db);
    }
    await audit(req, {
      action: 'update', module: 'safety', description: `Updated infirmary visit for ${cur.studentName}${input.outcome ? ` — ${input.outcome}` : ''}`,
      entityType: 'student', entityId: cur.studentId, metadata: { visitId: id, ...input },
    }, db);
  });
  return getVisit(id);
}

// =============================================================================
// Counselling
// =============================================================================
export interface CounsellingFilters extends Pagination { campusId?: string; status?: string; when?: 'upcoming' | 'past' }

function sessionSelect(withNotes: boolean) {
  return `
  SELECT cs.id, cs.session_on AS "sessionOn", cs.reason, cs.status,
         ${withNotes ? 'cs.notes' : 'NULL::text AS notes'}, (cs.notes IS NOT NULL AND cs.notes <> '') AS "hasNotes",
         cs.counsellor_id AS "counsellorId", e.full_name AS "counsellorName",
         s.id AS "studentId", s.full_name AS "studentName", s.admission_no AS "admissionNo", c.name AS grade, sec.name AS section,
         cs.updated_at AS "updatedAt"
    FROM counselling_sessions cs
    JOIN students s ON s.id = cs.student_id
    JOIN employees e ON e.id = cs.counsellor_id
    LEFT JOIN sections sec ON sec.id = s.section_id
    LEFT JOIN classes c ON c.id = sec.class_id`;
}

const SESSION_SORTS: Record<string, string> = { date: 'x."sessionOn"', student: 'x."studentName"', status: 'x.status', counsellor: 'x."counsellorName"' };

export async function listSessions(req: Request, f: CounsellingFilters) {
  const user = req.user!;
  const w = new Where();
  w.add('s.deleted_at IS NULL');
  safetyStudentScope(user, w);
  w.addIf(f.campusId, 's.campus_id = ?');
  w.addIf(f.status, 'cs.status = ?');
  if (f.when === 'upcoming') w.add('cs.session_on >= now()');
  if (f.when === 'past') w.add('cs.session_on < now()');
  if (f.q) w.add('(s.full_name ILIKE ? OR s.admission_no ILIKE ? OR cs.reason ILIKE ?)', likeTerm(f.q), likeTerm(f.q), likeTerm(f.q));
  const { limit, offset } = limitOffset(f);
  const rows = await many(
    `SELECT x.*, count(*) OVER() AS total FROM (${sessionSelect(sensitive(user))} ${w.sql}) x
      ORDER BY ${orderBy(f.sort, f.dir, SESSION_SORTS, 'date')} LIMIT ${w.param(limit)} OFFSET ${w.param(offset)}`,
    w.params,
  );
  if (sensitive(user) && rows.some((r) => r.hasNotes)) {
    await audit(req, { action: 'view', module: 'safety', description: 'Viewed counselling session notes', metadata: { filters: f } });
  }
  return { rows: rows.map(({ total: _t, ...r }) => r), total: rows[0]?.total ?? 0 };
}

export async function counsellingSummary(user: AuthUser, campusId?: string) {
  const w = new Where();
  w.add('s.deleted_at IS NULL');
  safetyStudentScope(user, w);
  w.addIf(campusId, 's.campus_id = ?');
  const r = await one(
    `SELECT count(DISTINCT cs.student_id) FILTER (WHERE cs.status <> 'Cancelled' AND cs.session_on >= ${yearStart})::int AS "studentsSupported",
            count(*) FILTER (WHERE cs.status = 'Completed' AND cs.session_on >= ${yearStart})::int AS "sessionsThisYear",
            count(DISTINCT cs.student_id) FILTER (WHERE cs.status = 'Scheduled' AND cs.session_on >= now())::int AS "openCases",
            count(*) FILTER (WHERE cs.status = 'Scheduled' AND cs.session_on >= now())::int AS upcoming,
            count(*) FILTER (WHERE cs.status = 'Referred')::int AS referrals
       FROM counselling_sessions cs JOIN students s ON s.id = cs.student_id ${w.sql}`,
    w.params,
  );
  const reasons = await many(
    `SELECT cs.reason AS label, count(*)::int AS value FROM counselling_sessions cs JOIN students s ON s.id = cs.student_id
      ${w.sql} AND cs.status <> 'Cancelled' AND cs.session_on >= ${yearStart}
      GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 5`,
    w.params,
  );
  return { ...r, reasons, canViewNotes: sensitive(user) };
}

async function getSession(user: AuthUser, id: string) {
  const r = await one(`${sessionSelect(sensitive(user))} WHERE cs.id = $1`, [id]);
  if (!r) throw notFound('Session not found', 'SESSION_NOT_FOUND');
  return r;
}

export async function createSession(req: Request, input: { studentId: string; counsellorId: string; sessionOn: string; reason: string; status: string; notes?: string }) {
  const user = req.user!;
  if (input.notes && !sensitive(user)) throw forbidden('Only counsellors and the Principal can record session notes');
  const studentId = await authorizeSafetyStudent(req, input.studentId);
  const id = await tx(async (db) => {
    await assertEmployee(input.counsellorId, db);
    const s = await studentBrief(studentId, db);
    const r = await one<{ id: string }>(
      `INSERT INTO counselling_sessions (student_id, counsellor_id, session_on, reason, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [studentId, input.counsellorId, input.sessionOn, input.reason, input.status, input.notes ?? null], db,
    );
    const counsellorUser = await one<{ user_id: string | null }>('SELECT user_id FROM employees WHERE id = $1', [input.counsellorId], db);
    if (counsellorUser?.user_id && counsellorUser.user_id !== user.id) {
      await notifyUsers([counsellorUser.user_id], {
        category: 'Information', icon: 'heart', topic: 'safety', title: `Counselling session booked for ${s.full_name}`,
        body: input.reason, route: '/counselling', entityType: 'counselling_session', entityId: r!.id,
      }, db);
    }
    await audit(req, {
      action: 'create', module: 'safety', description: `Booked counselling session for ${s.full_name}`,
      entityType: 'student', entityId: studentId, metadata: { sessionId: r!.id, status: input.status },
    }, db);
    return r!.id;
  });
  return getSession(user, id);
}

export async function updateSession(req: Request, id: string, input: { status?: string; sessionOn?: string; notes?: string }) {
  const user = req.user!;
  if (input.notes !== undefined && !sensitive(user)) throw forbidden('Only counsellors and the Principal can record session notes');
  const cur = await getSession(user, id);
  await authorizeSafetyStudent(req, cur.studentId);
  await tx(async (db) => {
    await query(
      `UPDATE counselling_sessions SET status = COALESCE($2, status), session_on = COALESCE($3::timestamptz, session_on),
              notes = COALESCE($4, notes) WHERE id = $1`,
      [id, input.status ?? null, input.sessionOn ?? null, input.notes ?? null], db,
    );
    await audit(req, {
      action: 'update', module: 'safety',
      description: `Updated counselling session for ${cur.studentName}${input.status ? ` — ${input.status}` : ''}${input.notes !== undefined ? ' (notes)' : ''}`,
      entityType: 'student', entityId: cur.studentId, metadata: { sessionId: id, status: input.status },
    }, db);
  });
  return getSession(user, id);
}
