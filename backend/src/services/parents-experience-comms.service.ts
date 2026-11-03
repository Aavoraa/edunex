/**
 * Parent experience — directory (engagement view), unified communication
 * history, unanswered queue, outbound messages and parent ↔ staff threads.
 */
import type { Request } from 'express';
import type { AuthUser } from '../types.js';
import { many, one, query, tx, type Queryable } from '../config/db.js';
import { Where } from '../utils/sql.js';
import { likeTerm, limitOffset, orderBy, type Pagination } from '../utils/pagination.js';
import { badRequest, conflict, notFound } from '../utils/errors.js';
import { audit } from './audit.service.js';
import { notifyUsers } from './notification.service.js';
import { authorizeStudent, isGuardianOf, resolveStudentId } from './access.service.js';
import {
  addParentScope, channelsFor, GRADE_SQL, isClassScoped, scopeFragment, selfParentId, visibleParent,
} from './parents-experience.service.js';

const total = <T extends { total?: unknown }>(rows: T[]) => Number(rows[0]?.total ?? 0);
const strip = <T extends { total?: unknown }>(rows: T[]) => rows.map(({ total: _t, ...r }) => r);

// =============================================================================
// Parent directory — engagement view
// =============================================================================
const DIR_SORTS: Record<string, string> = {
  name: 'p.full_name', engagement: 'p.engagement_score', lastContact: 'p.last_contact_at', openQueries: '"openQueries"',
};

export interface DirectoryFilters extends Pagination {
  campusId?: string; engagement?: 'high' | 'medium' | 'low'; ptm?: 'booked' | 'not_booked'; app?: 'yes' | 'no'; gradeLevel?: number;
}

const PTM_BOOKED_SQL = `EXISTS (SELECT 1 FROM ptm_bookings b JOIN ptm_sessions ps ON ps.id = b.ptm_session_id
                                 WHERE b.parent_id = p.id AND b.status = 'Booked' AND ps.session_date >= current_date)`;

function directoryWhere(user: AuthUser, f: Partial<DirectoryFilters>) {
  const w = new Where().add('p.deleted_at IS NULL');
  addParentScope(user, w);
  if (f.q) w.add('(p.full_name ILIKE ? OR p.phone ILIKE ? OR p.email::text ILIKE ? OR p.parent_code ILIKE ?)', likeTerm(f.q), likeTerm(f.q), likeTerm(f.q), likeTerm(f.q));
  if (f.campusId) w.add('EXISTS (SELECT 1 FROM student_guardians sg JOIN students s ON s.id = sg.student_id WHERE sg.parent_id = p.id AND s.campus_id = ?)', f.campusId);
  if (f.gradeLevel) {
    w.add(`EXISTS (SELECT 1 FROM student_guardians sg JOIN students s ON s.id = sg.student_id AND s.deleted_at IS NULL
                     JOIN sections sec ON sec.id = s.section_id JOIN classes c ON c.id = sec.class_id
                    WHERE sg.parent_id = p.id AND c.grade_level = ?)`, f.gradeLevel);
  }
  if (f.engagement === 'high') w.add('p.engagement_score >= 70');
  if (f.engagement === 'medium') w.add('p.engagement_score BETWEEN 50 AND 69');
  if (f.engagement === 'low') w.add('p.engagement_score < 50');
  if (f.ptm === 'booked') w.add(PTM_BOOKED_SQL);
  if (f.ptm === 'not_booked') w.add(`NOT ${PTM_BOOKED_SQL}`);
  if (f.app === 'yes') w.add('p.user_id IS NOT NULL');
  if (f.app === 'no') w.add('p.user_id IS NULL');
  return w;
}

export async function listDirectory(user: AuthUser, f: DirectoryFilters) {
  const w = directoryWhere(user, f);
  const { limit, offset } = limitOffset(f);
  const rows = await many(
    `SELECT p.id, p.parent_code AS "parentCode", p.full_name AS "fullName", p.phone, p.email, p.occupation,
            p.preferred_channel AS "preferredChannel", p.engagement_score AS engagement,
            p.last_contact_at AS "lastContactAt", p.last_contact_channel AS "lastContactChannel",
            (p.user_id IS NOT NULL) AS "hasAppAccount",
            COALESCE((SELECT json_agg(json_build_object('id', s.id, 'fullName', s.full_name, 'admissionNo', s.admission_no,
                                                        'grade', c.name, 'section', sec.name, 'relationship', sg.relationship) ORDER BY s.full_name)
                        FROM student_guardians sg JOIN students s ON s.id = sg.student_id AND s.deleted_at IS NULL
                        LEFT JOIN sections sec ON sec.id = s.section_id LEFT JOIN classes c ON c.id = sec.class_id
                       WHERE sg.parent_id = p.id), '[]') AS children,
            ${PTM_BOOKED_SQL} AS "ptmBooked",
            (SELECT count(*)::int FROM communications cm WHERE cm.parent_id = p.id AND cm.needs_reply) AS "openQueries",
            count(*) OVER() AS total
       FROM parents p ${w.sql}
      ORDER BY ${orderBy(f.sort, f.dir, DIR_SORTS, 'name')}, p.id
      LIMIT ${w.param(limit)} OFFSET ${w.param(offset)}`,
    w.params,
  );
  return { rows: strip(rows), total: total(rows) };
}

export async function directorySummary(user: AuthUser, campusId?: string) {
  const w = directoryWhere(user, { campusId });
  return one(
    `SELECT count(*)::int AS parents,
            count(*) FILTER (WHERE p.user_id IS NOT NULL)::int AS "appAccounts",
            count(*) FILTER (WHERE p.engagement_score >= 70)::int AS high,
            count(*) FILTER (WHERE p.engagement_score BETWEEN 50 AND 69)::int AS medium,
            count(*) FILTER (WHERE p.engagement_score < 50)::int AS low,
            COALESCE(round(avg(p.engagement_score)), 0)::int AS "averageEngagement",
            count(*) FILTER (WHERE ${PTM_BOOKED_SQL})::int AS "ptmBooked",
            count(*) FILTER (WHERE p.last_contact_at >= now() - interval '7 days')::int AS "contacted7d",
            count(*) FILTER (WHERE p.last_contact_at IS NULL OR p.last_contact_at < now() - interval '30 days')::int AS "noContact30d"
       FROM parents p ${w.sql}`,
    w.params,
  );
}

// =============================================================================
// Communication history
// =============================================================================
const COMM_SORTS: Record<string, string> = {
  occurredAt: 'q."occurredAt"', channel: 'q.channel', parent: 'q.counterpart', status: 'q.status', subject: 'q.subject',
};

/** Teachers see their own messages and anything about families in their classes. */
function addCommScope(user: AuthUser, w: Where) {
  const sc = scopeFragment(user, 'sx');
  if (!sc.sql) return w;
  const sc2 = scopeFragment(user, 'sy');
  return w.add(
    `(c.sent_by = ?
      OR (c.parent_id IS NOT NULL AND EXISTS (SELECT 1 FROM student_guardians sgx JOIN students sx ON sx.id = sgx.student_id
                                               WHERE sgx.parent_id = c.parent_id ${sc.sql}))
      OR (c.student_id IS NOT NULL AND EXISTS (SELECT 1 FROM students sy WHERE sy.id = c.student_id ${sc2.sql})))`,
    user.id, ...sc.params, ...sc2.params,
  );
}

export interface CommFilters extends Pagination {
  channel?: string; direction?: string; needsReply?: boolean; parentId?: string; studentId?: string; from?: string; to?: string; campusId?: string;
}

function commWhere(user: AuthUser, f: Partial<CommFilters>) {
  const w = new Where();
  addCommScope(user, w);
  w.addIf(f.channel, 'c.channel = ?');
  w.addIf(f.direction, 'c.direction = ?');
  if (f.needsReply !== undefined) w.add('c.needs_reply = ?', f.needsReply);
  w.addIf(f.parentId, 'c.parent_id = ?');
  w.addIf(f.studentId, 'c.student_id = ?');
  w.addIf(f.from, 'c.occurred_at >= ?::date');
  w.addIf(f.to, 'c.occurred_at < ?::date + 1');
  if (f.campusId) {
    w.add(`((c.student_id IS NULL AND c.parent_id IS NULL)
            OR EXISTS (SELECT 1 FROM students cs WHERE cs.id = c.student_id AND cs.campus_id = ?)
            OR (c.student_id IS NULL AND EXISTS (SELECT 1 FROM student_guardians cg JOIN students cs ON cs.id = cg.student_id
                                                  WHERE cg.parent_id = c.parent_id AND cs.campus_id = ?)))`, f.campusId, f.campusId);
  }
  if (f.q) w.add('(c.subject ILIKE ? OR c.counterpart ILIKE ? OR c.body ILIKE ?)', likeTerm(f.q), likeTerm(f.q), likeTerm(f.q));
  return w;
}

const COMM_SELECT = `
  SELECT c.id, c.channel, c.direction, c.counterpart, c.subject, c.body, c.status, c.recipients,
         c.needs_reply AS "needsReply", c.replied_at AS "repliedAt", c.occurred_at AS "occurredAt", c.thread_id AS "threadId",
         c.parent_id AS "parentId", p.full_name AS "parentName", p.phone AS "parentPhone", (p.user_id IS NOT NULL) AS "parentHasApp",
         c.student_id AS "studentId", s.full_name AS "studentName", s.admission_no AS "admissionNo", ${GRADE_SQL()} AS grade,
         u.full_name AS "sentBy", ru.full_name AS "repliedBy",
         CASE WHEN c.needs_reply THEN floor(extract(epoch FROM now() - c.occurred_at) / 3600)::int END AS "ageHours"
    FROM communications c
    LEFT JOIN parents p ON p.id = c.parent_id
    LEFT JOIN students s ON s.id = c.student_id
    LEFT JOIN sections sec ON sec.id = s.section_id LEFT JOIN classes cl ON cl.id = sec.class_id
    LEFT JOIN users u ON u.id = c.sent_by
    LEFT JOIN users ru ON ru.id = c.replied_by`;

export async function listCommunications(user: AuthUser, f: CommFilters) {
  const w = commWhere(user, f);
  const { limit, offset } = limitOffset(f);
  const rows = await many(
    `SELECT q.*, count(*) OVER() AS total FROM (${COMM_SELECT} ${w.sql}) q
      ORDER BY ${orderBy(f.sort, f.dir, COMM_SORTS, 'occurredAt')}, q.id
      LIMIT ${w.param(limit)} OFFSET ${w.param(offset)}`,
    w.params,
  );
  return { rows: strip(rows), total: total(rows) };
}

export async function communicationSummary(user: AuthUser, campusId?: string) {
  const w = commWhere(user, { campusId });
  const s = await one(
    `SELECT count(*) FILTER (WHERE c.occurred_at >= now() - interval '30 days')::int AS "last30Days",
            count(*) FILTER (WHERE c.occurred_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata')::int AS today,
            count(*) FILTER (WHERE c.needs_reply)::int AS unanswered,
            count(*) FILTER (WHERE c.needs_reply AND c.occurred_at < now() - interval '24 hours')::int AS "unansweredOver24h",
            COALESCE(floor(extract(epoch FROM now() - min(c.occurred_at) FILTER (WHERE c.needs_reply)) / 3600), 0)::int AS "oldestHours"
       FROM communications c ${w.sql}`,
    w.params,
  );
  const byChannel = await many<{ channel: string; n: number }>(
    `SELECT c.channel, count(*)::int AS n FROM communications c ${w.sql ? w.sql + ' AND' : 'WHERE'} c.occurred_at >= now() - interval '30 days'
      GROUP BY c.channel ORDER BY n DESC`,
    w.params,
  );
  const threads = await one<{ unread: number }>(
    `SELECT count(*)::int AS unread FROM message_thread_participants mp JOIN message_threads t ON t.id = mp.thread_id
      WHERE mp.user_id = $1 AND EXISTS (SELECT 1 FROM messages m WHERE m.thread_id = t.id AND m.sender_id <> $1
                                          AND m.created_at > COALESCE(mp.last_read_at, '-infinity'))`,
    [user.id],
  );
  return { ...s, byChannel: Object.fromEntries(byChannel.map((b) => [b.channel, b.n])), unreadThreads: threads?.unread ?? 0 };
}

async function getCommunication(user: AuthUser, id: string, db?: Queryable) {
  const w = commWhere(user, {});
  w.add('c.id = ?', id);
  const row = await one(`${COMM_SELECT} ${w.sql}`, w.params, db);
  if (!row) throw notFound('Communication not found', 'COMMUNICATION_NOT_FOUND');
  return row;
}

async function touchParent(parentId: string, channel: string, db: Queryable) {
  await query(
    `UPDATE parents SET last_contact_at = now(), last_contact_channel = $2,
            engagement_score = LEAST(100, engagement_score + 1) WHERE id = $1`,
    [parentId, channel], db);
}

export async function logCommunication(req: Request, b: {
  channel: 'Call' | 'Note'; parentId?: string; studentId?: string; counterpart?: string; subject: string; body?: string;
  status?: string; direction?: 'inbound' | 'outbound' | 'internal'; needsReply: boolean;
}) {
  const user = req.user!;
  const parent = b.parentId ? await visibleParent(user, b.parentId) : null;
  const studentId = b.studentId ? await authorizeStudent(req, b.studentId) : null;
  if (parent && studentId && !(await isGuardianOf(parent.id, studentId))) throw badRequest('This student is not linked to the selected parent', 'STUDENT_NOT_LINKED');
  const isNote = b.channel === 'Note';
  const id = await tx(async (db) => {
    const r = await one<{ id: string }>(
      `INSERT INTO communications (channel, direction, parent_id, student_id, counterpart, subject, body, status, needs_reply, sent_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [b.channel, isNote ? 'internal' : b.direction ?? 'outbound', parent?.id ?? null, studentId, parent?.fullName ?? b.counterpart,
        b.subject, b.body ?? null, isNote ? 'Internal' : b.status ?? 'Connected', b.needsReply, user.id], db);
    if (parent && !isNote) await touchParent(parent.id, 'Call', db);
    await audit(req, {
      action: 'create', module: 'communication', entityType: 'communication', entityId: r!.id,
      description: `Logged ${b.channel.toLowerCase()} — ${b.subject}${parent ? ` (${parent.fullName})` : ''}`,
    }, db);
    return r!.id;
  });
  return getCommunication(user, id);
}

export async function sendMessage(req: Request, b: {
  parentId: string; studentId?: string; channel: 'WhatsApp' | 'Email' | 'SMS' | 'In-app'; subject: string; body: string; replyTo?: string;
}) {
  const user = req.user!;
  const parent = await visibleParent(user, b.parentId);
  let studentId: string | null = null;
  if (b.studentId) {
    studentId = await authorizeStudent(req, b.studentId);
    if (!(await isGuardianOf(parent.id, studentId))) throw badRequest('This student is not linked to the selected parent', 'STUDENT_NOT_LINKED');
  }
  if (b.replyTo) {
    const orig = await getCommunication(user, b.replyTo);
    if (orig.parentId !== parent.id) throw badRequest('The message you are replying to belongs to another family', 'REPLY_MISMATCH');
  }
  const result = await tx(async (db) => {
    const r = await one<{ id: string }>(
      `INSERT INTO communications (channel, direction, parent_id, student_id, counterpart, subject, body, status, sent_by)
       VALUES ($1,'outbound',$2,$3,$4,$5,$6,'Queued',$7) RETURNING id`,
      [b.channel, parent.id, studentId, parent.fullName, b.subject, b.body, user.id], db);
    const id = r!.id;
    let queued = false;
    if (parent.userId) {
      const ids = await notifyUsers([parent.userId], {
        category: 'Information', topic: 'messages', icon: 'message', title: b.subject, body: b.body.slice(0, 500),
        route: '/parent-360?tab=more', entityType: 'communication', entityId: id, channels: channelsFor(b.channel),
      }, db);
      queued = ids.length > 0;
    }
    const status = !queued ? 'No app account' : b.channel === 'In-app' ? 'Delivered' : 'Queued';
    await query('UPDATE communications SET status = $2 WHERE id = $1', [id, status], db);
    await touchParent(parent.id, b.channel, db);
    if (b.replyTo) {
      await query(
        `UPDATE communications SET needs_reply = false, replied_at = now(), replied_by = $2 WHERE id = $1 AND needs_reply`,
        [b.replyTo, user.id], db);
    }
    await audit(req, {
      action: 'create', module: 'communication', entityType: 'communication', entityId: id,
      description: `Sent ${b.channel} message "${b.subject}" to ${parent.fullName}`, metadata: { replyTo: b.replyTo ?? null, queued },
    }, db);
    return { id, queued };
  });
  return { ...(await getCommunication(user, result.id)), queued: result.queued };
}

export async function markReplied(req: Request, id: string) {
  const c = await getCommunication(req.user!, id);
  if (!c.needsReply) throw conflict('This message is already marked as replied', 'ALREADY_REPLIED');
  await query('UPDATE communications SET needs_reply = false, replied_at = now(), replied_by = $2 WHERE id = $1', [id, req.user!.id]);
  await audit(req, { action: 'update', module: 'communication', entityType: 'communication', entityId: id, description: `Marked "${c.subject}" as replied` });
  return getCommunication(req.user!, id);
}

// =============================================================================
// Message threads (shared by staff and family endpoints)
// =============================================================================
const THREAD_SELECT = (me: string) => `
  SELECT t.id, t.subject, t.status, t.last_message_at AS "lastMessageAt", t.created_at AS "createdAt",
         t.student_id AS "studentId", s.full_name AS "studentName", s.admission_no AS "admissionNo", ${GRADE_SQL()} AS grade,
         fp.id AS "parentId", fp.full_name AS "parentName",
         COALESCE((SELECT json_agg(json_build_object('userId', u.id, 'name', u.full_name, 'role', r.key, 'title', u.title) ORDER BY u.full_name)
                     FROM message_thread_participants mp JOIN users u ON u.id = mp.user_id JOIN roles r ON r.id = u.role_id
                    WHERE mp.thread_id = t.id), '[]') AS participants,
         lm.body AS "lastMessage", lm.sender_name AS "lastSender", lm.sender_is_parent AS "awaitingReply",
         (SELECT count(*)::int FROM messages m WHERE m.thread_id = t.id) AS "messageCount",
         EXISTS (SELECT 1 FROM messages m WHERE m.thread_id = t.id AND m.sender_id <> ${me}
                   AND m.created_at > COALESCE((SELECT mp.last_read_at FROM message_thread_participants mp
                                                 WHERE mp.thread_id = t.id AND mp.user_id = ${me}), '-infinity')) AS unread
    FROM message_threads t
    LEFT JOIN students s ON s.id = t.student_id
    LEFT JOIN sections sec ON sec.id = s.section_id LEFT JOIN classes cl ON cl.id = sec.class_id
    LEFT JOIN LATERAL (SELECT p.id, p.full_name FROM message_thread_participants mp JOIN parents p ON p.user_id = mp.user_id
                        WHERE mp.thread_id = t.id ORDER BY p.full_name LIMIT 1) fp ON true
    LEFT JOIN LATERAL (SELECT m.body, u.full_name AS sender_name, EXISTS (SELECT 1 FROM parents pp WHERE pp.user_id = m.sender_id) AS sender_is_parent
                         FROM messages m JOIN users u ON u.id = m.sender_id
                        WHERE m.thread_id = t.id ORDER BY m.created_at DESC LIMIT 1) lm ON true`;

/** Staff visibility: participant, or (school-wide) any thread, or (teacher) threads about their students. */
function staffThreadWhere(user: AuthUser) {
  const w = new Where();
  if (isClassScoped(user)) {
    const sc = scopeFragment(user, 'sx');
    w.add(`(EXISTS (SELECT 1 FROM message_thread_participants mp WHERE mp.thread_id = t.id AND mp.user_id = ?)
            OR (t.student_id IS NOT NULL AND EXISTS (SELECT 1 FROM students sx WHERE sx.id = t.student_id ${sc.sql})))`,
    user.id, ...sc.params);
  }
  return w;
}

function familyThreadWhere(user: AuthUser) {
  return new Where().add('EXISTS (SELECT 1 FROM message_thread_participants mp WHERE mp.thread_id = t.id AND mp.user_id = ?)', user.id);
}

async function listThreadsWhere(user: AuthUser, w: Where, f: Pagination & { status?: string; unread?: boolean }) {
  w.addIf(f.status, 't.status = ?');
  if (f.q) w.add('(t.subject ILIKE ? OR s.full_name ILIKE ? OR fp.full_name ILIKE ?)', likeTerm(f.q), likeTerm(f.q), likeTerm(f.q));
  const me = w.param(user.id);
  const { limit, offset } = limitOffset(f);
  const rows = await many(
    `SELECT q.*, count(*) OVER() AS total FROM (${THREAD_SELECT(`${me}::uuid`)} ${w.sql}) q
      ${f.unread ? 'WHERE q.unread' : ''}
      ORDER BY q."lastMessageAt" DESC, q.id
      LIMIT ${w.param(limit)} OFFSET ${w.param(offset)}`,
    w.params,
  );
  return { rows: strip(rows), total: total(rows) };
}

async function loadThread(user: AuthUser, id: string, w: Where) {
  w.add('t.id = ?', id);
  const me = w.param(user.id);
  const t = await one(`${THREAD_SELECT(`${me}::uuid`)} ${w.sql}`, w.params);
  if (!t) throw notFound('Conversation not found', 'THREAD_NOT_FOUND');
  const messages = await many(
    `SELECT m.id, m.body, m.created_at AS "createdAt", m.sender_id AS "senderId", u.full_name AS "senderName", r.key AS "senderRole",
            u.title AS "senderTitle", (m.sender_id = $2) AS mine
       FROM messages m JOIN users u ON u.id = m.sender_id JOIN roles r ON r.id = u.role_id
      WHERE m.thread_id = $1 ORDER BY m.created_at, m.id`,
    [id, user.id]);
  await query('UPDATE message_thread_participants SET last_read_at = now() WHERE thread_id = $1 AND user_id = $2', [id, user.id]);
  return { ...t, unread: false, messages };
}

export const listStaffThreads = (user: AuthUser, f: Pagination & { status?: string; unread?: boolean }) => listThreadsWhere(user, staffThreadWhere(user), f);
export const getStaffThread = (user: AuthUser, id: string) => loadThread(user, id, staffThreadWhere(user));
export const listFamilyThreads = (user: AuthUser, f: Pagination & { status?: string }) => listThreadsWhere(user, familyThreadWhere(user), f);
export const getFamilyThread = (user: AuthUser, id: string) => loadThread(user, id, familyThreadWhere(user));

async function otherParticipants(threadId: string, me: string, db: Queryable) {
  return many<{ userId: string; isParent: boolean }>(
    `SELECT mp.user_id AS "userId", EXISTS (SELECT 1 FROM parents p WHERE p.user_id = mp.user_id) AS "isParent"
       FROM message_thread_participants mp WHERE mp.thread_id = $1 AND mp.user_id <> $2`,
    [threadId, me], db);
}

async function notifyThread(threadId: string, sender: AuthUser, subject: string, body: string, db: Queryable) {
  const others = await otherParticipants(threadId, sender.id, db);
  const parents = others.filter((o) => o.isParent).map((o) => o.userId);
  const staff = others.filter((o) => !o.isParent).map((o) => o.userId);
  const n = { category: 'Information' as const, topic: 'messages', icon: 'message', title: `${sender.fullName}: ${subject}`, body: body.slice(0, 300), entityType: 'message_thread', entityId: threadId };
  await notifyUsers(parents, { ...n, route: '/parent-360?tab=more', channels: ['push'] }, db);
  await notifyUsers(staff, { ...n, category: 'Attention', route: `/parent-communication?thread=${threadId}` }, db);
}

export async function startStaffThread(req: Request, b: { parentId: string; studentId: string; subject: string; body: string }) {
  const user = req.user!;
  const parent = await visibleParent(user, b.parentId);
  if (!parent.userId) throw badRequest('This parent does not use the app yet. Send a WhatsApp or SMS message instead.', 'PARENT_NO_APP');
  const studentId = await authorizeStudent(req, b.studentId);
  if (!(await isGuardianOf(parent.id, studentId))) throw badRequest('This student is not linked to the selected parent', 'STUDENT_NOT_LINKED');
  const id = await tx(async (db) => {
    const t = await one<{ id: string }>(
      `INSERT INTO message_threads (subject, student_id, created_by) VALUES ($1,$2,$3) RETURNING id`, [b.subject, studentId, user.id], db);
    const tid = t!.id;
    await query(`INSERT INTO message_thread_participants (thread_id, user_id, last_read_at) VALUES ($1,$2,now()), ($1,$3,NULL)`, [tid, user.id, parent.userId], db);
    await query('INSERT INTO messages (thread_id, sender_id, body) VALUES ($1,$2,$3)', [tid, user.id, b.body], db);
    await query(
      `INSERT INTO communications (channel, direction, parent_id, student_id, counterpart, subject, body, status, sent_by, thread_id)
       VALUES ('In-app','outbound',$1,$2,$3,$4,$5,'Delivered',$6,$7)`,
      [parent.id, studentId, parent.fullName, b.subject, b.body, user.id, tid], db);
    await touchParent(parent.id, 'In-app', db);
    await notifyThread(tid, user, b.subject, b.body, db);
    await audit(req, { action: 'create', module: 'communication', entityType: 'message_thread', entityId: tid, description: `Started conversation "${b.subject}" with ${parent.fullName}` }, db);
    return tid;
  });
  return getStaffThread(user, id);
}

export async function replyStaffThread(req: Request, id: string, body: string) {
  const user = req.user!;
  const t = await getStaffThread(user, id);
  await tx(async (db) => {
    await query(
      `INSERT INTO message_thread_participants (thread_id, user_id, last_read_at) VALUES ($1,$2,now())
       ON CONFLICT (thread_id, user_id) DO UPDATE SET last_read_at = now()`, [id, user.id], db);
    await query('INSERT INTO messages (thread_id, sender_id, body) VALUES ($1,$2,$3)', [id, user.id, body], db);
    await query(`UPDATE message_threads SET last_message_at = now(), status = 'Open' WHERE id = $1`, [id], db);
    await query(
      `UPDATE communications SET needs_reply = false, replied_at = now(), replied_by = $2 WHERE thread_id = $1 AND needs_reply`,
      [id, user.id], db);
    if (t.parentId) {
      await query(
        `INSERT INTO communications (channel, direction, parent_id, student_id, counterpart, subject, body, status, sent_by, thread_id)
         VALUES ('In-app','outbound',$1,$2,$3,$4,$5,'Delivered',$6,$7)`,
        [t.parentId, t.studentId, t.parentName, `Re: ${t.subject}`, body, user.id, id], db);
      await touchParent(t.parentId, 'In-app', db);
    }
    await notifyThread(id, user, t.subject, body, db);
    await audit(req, { action: 'create', module: 'communication', entityType: 'message_thread', entityId: id, description: `Replied in conversation "${t.subject}"` }, db);
  });
  return getStaffThread(user, id);
}

export async function setThreadStatus(req: Request, id: string, status: 'Open' | 'Closed') {
  const t = await getStaffThread(req.user!, id);
  await query('UPDATE message_threads SET status = $2 WHERE id = $1', [id, status]);
  if (status === 'Closed') {
    await query(`UPDATE communications SET needs_reply = false, replied_at = now(), replied_by = $2 WHERE thread_id = $1 AND needs_reply`, [id, req.user!.id]);
  }
  await audit(req, { action: 'update', module: 'communication', entityType: 'message_thread', entityId: id, description: `Conversation "${t.subject}" ${status === 'Closed' ? 'closed' : 'reopened'}` });
  return getStaffThread(req.user!, id);
}

// ---- Family side -------------------------------------------------------------
async function familyInbound(user: AuthUser, parentId: string, studentId: string | null, subject: string, body: string, threadId: string, db: Queryable) {
  const open = await one('SELECT 1 FROM communications WHERE thread_id = $1 AND needs_reply', [threadId], db);
  const p = await one<{ full_name: string }>('SELECT full_name FROM parents WHERE id = $1', [parentId], db);
  await query(
    `INSERT INTO communications (channel, direction, parent_id, student_id, counterpart, subject, body, status, needs_reply, sent_by, thread_id)
     VALUES ('In-app','inbound',$1,$2,$3,$4,$5,'Delivered',$6,$7,$8)`,
    [parentId, studentId, p?.full_name ?? user.fullName, subject, body, !open, user.id, threadId], db);
  await touchParent(parentId, 'In-app', db);
}

export async function startFamilyThread(req: Request, b: { studentId: string; subject: string; body: string }) {
  const user = req.user!;
  const parentId = selfParentId(user);
  const studentId = await resolveStudentId(b.studentId);
  if (!(await isGuardianOf(parentId, studentId))) throw notFound('Student not found', 'STUDENT_NOT_FOUND');
  const teacher = await one<{ userId: string | null; name: string | null }>(
    `SELECT e.user_id AS "userId", e.full_name AS name FROM students s
       JOIN sections sec ON sec.id = s.section_id
       LEFT JOIN employees e ON e.id = sec.class_teacher_id AND e.deleted_at IS NULL
      WHERE s.id = $1`, [studentId]);
  if (!teacher?.userId) throw conflict('Your child’s class teacher cannot receive app messages yet. Please contact the front office.', 'NO_CLASS_TEACHER');
  const id = await tx(async (db) => {
    const t = await one<{ id: string }>(
      'INSERT INTO message_threads (subject, student_id, created_by) VALUES ($1,$2,$3) RETURNING id', [b.subject, studentId, user.id], db);
    const tid = t!.id;
    await query(`INSERT INTO message_thread_participants (thread_id, user_id, last_read_at) VALUES ($1,$2,now()), ($1,$3,NULL)`, [tid, user.id, teacher.userId], db);
    await query('INSERT INTO messages (thread_id, sender_id, body) VALUES ($1,$2,$3)', [tid, user.id, b.body], db);
    await familyInbound(user, parentId, studentId, b.subject, b.body, tid, db);
    await notifyThread(tid, user, b.subject, b.body, db);
    await audit(req, { action: 'create', module: 'communication', entityType: 'message_thread', entityId: tid, description: `Parent started conversation "${b.subject}" with ${teacher.name}` }, db);
    return tid;
  });
  return getFamilyThread(user, id);
}

export async function replyFamilyThread(req: Request, id: string, body: string) {
  const user = req.user!;
  const parentId = selfParentId(user);
  const t = await getFamilyThread(user, id);
  if (t.status === 'Closed') throw conflict('This conversation has been closed by the school. Start a new message instead.', 'THREAD_CLOSED');
  await tx(async (db) => {
    await query('INSERT INTO messages (thread_id, sender_id, body) VALUES ($1,$2,$3)', [id, user.id, body], db);
    await query('UPDATE message_threads SET last_message_at = now() WHERE id = $1', [id], db);
    await query('UPDATE message_thread_participants SET last_read_at = now() WHERE thread_id = $1 AND user_id = $2', [id, user.id], db);
    await familyInbound(user, parentId, t.studentId, `Re: ${t.subject}`, body, id, db);
    await notifyThread(id, user, t.subject, body, db);
    await audit(req, { action: 'create', module: 'communication', entityType: 'message_thread', entityId: id, description: `Parent replied in conversation "${t.subject}"` }, db);
  });
  return getFamilyThread(user, id);
}
