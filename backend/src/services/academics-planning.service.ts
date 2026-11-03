import type { Request } from 'express';
import { many, one, query, tx, type Queryable } from '../config/db.js';
import { Where } from '../utils/sql.js';
import { likeTerm, limitOffset, orderBy, type Pagination } from '../utils/pagination.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/errors.js';
import { audit } from './audit.service.js';
import { notifyGuardians, notifyUsers } from './notification.service.js';
import { authorizeSection, isRestricted, isoDow, requireSchoolScope, schoolToday, sectionScope } from './academics.service.js';
import type { AuthUser } from '../types.js';

function addDays(date: string, n: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function weekBounds(today: string) {
  const start = addDays(today, 1 - Math.min(isoDow(today), 7));
  return { start, end: addDays(start, 6) };
}

/** Restricted users see plans they wrote or plans for their sections. */
function planScope(user: AuthUser, w: Where) {
  if (!isRestricted(user)) return w;
  if (!user.employeeId) return w.add('false');
  const e = user.employeeId;
  return w.add(
    `(lp.author_id = ? OR lp.section_id IN (SELECT ta.section_id FROM teacher_assignments ta WHERE ta.employee_id = ? UNION SELECT id FROM sections WHERE class_teacher_id = ?))`,
    e, e, e,
  );
}

// =============================================================================
// Lesson plans
// =============================================================================
const PLAN_SORTS: Record<string, string> = {
  title: 'lp.title', date: 'lp.planned_for', plannedFor: 'lp.planned_for', status: 'lp.status', teacher: 'e.full_name', cls: 'c.grade_level',
};

const PLAN_SELECT = `
  SELECT lp.id, lp.title, lp.status, lp.planned_for AS "plannedFor", lp.ai_generated AS "aiGenerated",
         lp.section_id AS "sectionId", c.name || sec.name AS "sectionLabel", lp.subject_id AS "subjectId", sub.name AS subject,
         lp.objective_id AS "objectiveId", o.code AS "objectiveCode", o.description AS "objectiveText",
         lp.author_id AS "authorId", e.full_name AS teacher, lp.approved_at AS "approvedAt", au.full_name AS "approvedBy",
         lp.content->>'reviewNote' AS "reviewNote", lp.updated_at AS "updatedAt"
    FROM lesson_plans lp
    JOIN subjects sub ON sub.id = lp.subject_id
    JOIN employees e ON e.id = lp.author_id
    LEFT JOIN sections sec ON sec.id = lp.section_id
    LEFT JOIN classes c ON c.id = sec.class_id
    LEFT JOIN learning_objectives o ON o.id = lp.objective_id
    LEFT JOIN users au ON au.id = lp.approved_by`;

export async function listLessonPlans(user: AuthUser, f: Pagination & { campusId?: string; status?: string; subjectId?: string; sectionId?: string; mine?: string }) {
  const w = new Where();
  w.addIf(f.campusId, 'c.campus_id = ?');
  w.addIf(f.status, 'lp.status = ?');
  w.addIf(f.subjectId, 'lp.subject_id = ?');
  w.addIf(f.sectionId, 'lp.section_id = ?');
  if (f.mine === 'true') w.add('lp.author_id = ?', user.employeeId);
  if (f.q) w.add('(lp.title ILIKE ? OR o.code ILIKE ? OR e.full_name ILIKE ?)', likeTerm(f.q), likeTerm(f.q), likeTerm(f.q));
  planScope(user, w);
  const { limit, offset } = limitOffset(f);
  const rows = await many(
    `${PLAN_SELECT.replace('FROM lesson_plans lp', ', count(*) OVER() AS total FROM lesson_plans lp')} ${w.sql}
      ORDER BY ${orderBy(f.sort, f.dir, PLAN_SORTS, 'date')}, lp.title
     LIMIT ${w.param(limit)} OFFSET ${w.param(offset)}`,
    w.params,
  );
  return { rows: rows.map(({ total: _t, ...r }) => r), total: rows[0]?.total ?? 0 };
}

export async function lessonPlanSummary(user: AuthUser, campusId?: string) {
  const { start, end } = weekBounds(schoolToday());
  const w = new Where();
  w.addIf(campusId, 'c.campus_id = ?');
  planScope(user, w);
  const s = w.param(start);
  const e = w.param(end);
  return one(
    `SELECT count(*) FILTER (WHERE lp.planned_for BETWEEN ${s}::date AND ${e}::date)::int AS "thisWeek",
            count(*) FILTER (WHERE lp.planned_for BETWEEN ${s}::date AND ${e}::date AND lp.status = 'Approved')::int AS approved,
            count(*) FILTER (WHERE lp.status IN ('Submitted', 'Under Review'))::int AS "awaitingReview",
            count(*) FILTER (WHERE lp.status = 'Draft')::int AS drafts,
            round(100.0 * count(*) FILTER (WHERE lp.planned_for BETWEEN ${s}::date AND ${e}::date AND lp.ai_generated)
                  / NULLIF(count(*) FILTER (WHERE lp.planned_for BETWEEN ${s}::date AND ${e}::date), 0))::int AS "aiAssistedPct",
            ${s}::text AS "weekStart", ${e}::text AS "weekEnd"
       FROM lesson_plans lp
       JOIN employees e ON e.id = lp.author_id
       LEFT JOIN sections sec ON sec.id = lp.section_id
       LEFT JOIN classes c ON c.id = sec.class_id
       LEFT JOIN learning_objectives o ON o.id = lp.objective_id
       ${w.sql}`,
    w.params,
  );
}

export async function getLessonPlan(user: AuthUser, id: string, db?: Queryable) {
  const w = new Where().add('lp.id = ?', id);
  planScope(user, w);
  const p = await one(`SELECT q.*, lp2.content FROM (${PLAN_SELECT} ${w.sql}) q JOIN lesson_plans lp2 ON lp2.id = q.id`, w.params, db);
  if (!p) throw notFound('Lesson plan not found', 'LESSON_PLAN_NOT_FOUND');
  return p;
}

interface PlanInput {
  title: string; sectionId: string; subjectId: string; objectiveId?: string | null; plannedFor: string;
  content: Record<string, unknown>; aiGenerated: boolean; submit: boolean;
}

async function checkObjective(objectiveId: string | null | undefined, subjectId: string, db: Queryable) {
  if (!objectiveId) return;
  const o = await one<{ subject_id: string }>('SELECT subject_id FROM learning_objectives WHERE id = $1', [objectiveId], db);
  if (!o) throw badRequest('Objective not found', 'VALIDATION_ERROR', [{ field: 'objectiveId', message: 'Choose an objective' }]);
  if (o.subject_id !== subjectId) throw badRequest('The objective belongs to a different subject', 'VALIDATION_ERROR', [{ field: 'objectiveId', message: 'Objective is for another subject' }]);
}

export async function createLessonPlan(req: Request, input: PlanInput) {
  const user = req.user!;
  if (!user.employeeId) throw forbidden('Only staff with an employee record can write lesson plans', 'NO_EMPLOYEE_RECORD');
  return tx(async (db) => {
    const sec = await authorizeSection(user, input.sectionId, db);
    const sub = await one('SELECT 1 FROM subjects WHERE id = $1', [input.subjectId], db);
    if (!sub) throw badRequest('Subject not found', 'VALIDATION_ERROR', [{ field: 'subjectId', message: 'Choose a subject' }]);
    await checkObjective(input.objectiveId, input.subjectId, db);
    const status = input.submit ? 'Submitted' : 'Draft';
    const p = await one<{ id: string }>(
      `INSERT INTO lesson_plans (title, section_id, subject_id, objective_id, planned_for, content, ai_generated, status, author_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [input.title, sec.id, input.subjectId, input.objectiveId ?? null, input.plannedFor, JSON.stringify(input.content ?? {}), input.aiGenerated, status, user.employeeId], db,
    );
    await audit(req, { action: 'create', module: 'academics', description: `Created lesson plan "${input.title}" for ${sec.label} (${status})`, entityType: 'lesson_plan', entityId: p!.id }, db);
    return { id: p!.id, status };
  });
}

export async function updateLessonPlan(req: Request, id: string, input: { title?: string; objectiveId?: string | null; plannedFor?: string; content?: Record<string, unknown> }) {
  const user = req.user!;
  return tx(async (db) => {
    const p = await getLessonPlan(user, id, db);
    if (p.authorId !== user.employeeId) throw forbidden('Only the author can edit this lesson plan');
    if (!['Draft', 'Rejected'].includes(p.status)) throw conflict(`A plan that is ${p.status} cannot be edited`, 'PLAN_LOCKED');
    if (input.objectiveId !== undefined) await checkObjective(input.objectiveId, p.subjectId, db);
    const content = input.content ? { ...input.content } : p.content;
    await query(
      `UPDATE lesson_plans SET title = $2, objective_id = $3, planned_for = $4, content = $5, status = 'Draft' WHERE id = $1`,
      [id, input.title ?? p.title, input.objectiveId !== undefined ? input.objectiveId : p.objectiveId, input.plannedFor ?? p.plannedFor, JSON.stringify(content)], db,
    );
    await audit(req, { action: 'update', module: 'academics', description: `Edited lesson plan "${input.title ?? p.title}"`, entityType: 'lesson_plan', entityId: id }, db);
    return { id, status: 'Draft' };
  });
}

const TRANSITIONS: Record<string, { from: string[]; to: string }> = {
  submit: { from: ['Draft', 'Rejected'], to: 'Submitted' },
  review: { from: ['Submitted'], to: 'Under Review' },
  approve: { from: ['Submitted', 'Under Review'], to: 'Approved' },
  reject: { from: ['Submitted', 'Under Review'], to: 'Rejected' },
  reopen: { from: ['Rejected'], to: 'Draft' },
};

export async function transitionLessonPlan(req: Request, id: string, action: keyof typeof TRANSITIONS, note?: string | null) {
  const user = req.user!;
  return tx(async (db) => {
    const p = await getLessonPlan(user, id, db);
    const t = TRANSITIONS[action];
    const isAuthor = p.authorId === user.employeeId;
    if (action === 'submit' || action === 'reopen') {
      if (!isAuthor) throw forbidden('Only the author can do this');
    } else {
      requireSchoolScope(user, 'Reviewing lesson plans');
      if (isAuthor) throw forbidden('You cannot review your own lesson plan');
    }
    if (!t.from.includes(p.status)) throw conflict(`Cannot ${action} a plan that is ${p.status}`, 'INVALID_TRANSITION');
    const decided = action === 'approve' || action === 'reject';
    const content = { ...(p.content ?? {}) } as Record<string, unknown>;
    if (action === 'reject') content.reviewNote = note;
    if (action === 'approve') content.reviewNote = note ?? undefined;
    await query(
      `UPDATE lesson_plans SET status = $2, content = $3,
              approved_by = CASE WHEN $4 THEN $5::uuid WHEN $2 IN ('Draft', 'Submitted') THEN NULL ELSE approved_by END,
              approved_at = CASE WHEN $4 THEN now() WHEN $2 IN ('Draft', 'Submitted') THEN NULL ELSE approved_at END
        WHERE id = $1`,
      [id, t.to, JSON.stringify(content), decided, user.id], db,
    );
    if (!isAuthor) {
      const author = await one<{ user_id: string | null }>('SELECT user_id FROM employees WHERE id = $1', [p.authorId], db);
      if (author?.user_id) {
        await notifyUsers([author.user_id], {
          category: action === 'reject' ? 'Attention' : action === 'approve' ? 'Completed' : 'Information',
          topic: 'lesson_plans', icon: action === 'approve' ? 'check' : 'clipboard',
          title: `Lesson plan ${t.to.toLowerCase()}: ${p.title}`,
          body: note ?? `${p.sectionLabel ?? ''} · ${p.subject}`.trim(),
          route: '/lesson-plans', entityType: 'lesson_plan', entityId: id,
        }, db);
      }
    }
    await audit(req, {
      action: decided ? 'approve' : 'update', module: 'academics',
      description: `Lesson plan "${p.title}": ${p.status} → ${t.to}${note ? ` — ${note}` : ''}`,
      entityType: 'lesson_plan', entityId: id,
    }, db);
    return { id, status: t.to };
  });
}

export async function deleteLessonPlan(req: Request, id: string) {
  const user = req.user!;
  return tx(async (db) => {
    const p = await getLessonPlan(user, id, db);
    if (p.authorId !== user.employeeId) throw forbidden('Only the author can delete this lesson plan');
    if (p.status !== 'Draft') throw conflict('Only draft lesson plans can be deleted', 'PLAN_LOCKED');
    await query('DELETE FROM lesson_plans WHERE id = $1', [id], db);
    await audit(req, { action: 'delete', module: 'academics', description: `Deleted draft lesson plan "${p.title}"`, entityType: 'lesson_plan', entityId: id }, db);
    return { id };
  });
}

// =============================================================================
// Homework
// =============================================================================
const HW_SORTS: Record<string, string> = {
  due: 'q."dueOn"', dueOn: 'q."dueOn"', title: 'q.title', status: 'q."displayStatus"', cls: 'q."sectionLabel"', submitted: 'q.submitted',
};

const HW_SELECT = `
  SELECT h.id, h.title, h.instructions, h.status, h.assigned_on AS "assignedOn", h.due_on AS "dueOn",
         h.section_id AS "sectionId", c.name || sec.name AS "sectionLabel", h.subject_id AS "subjectId", sub.name AS subject,
         e.full_name AS "assignedBy", h.assigned_by AS "assignedById",
         (SELECT count(*)::int FROM homework_submissions hs JOIN students s ON s.id = hs.student_id AND s.deleted_at IS NULL AND s.section_id = h.section_id
           WHERE hs.homework_id = h.id) AS submitted,
         (SELECT count(*)::int FROM students s WHERE s.section_id = h.section_id AND s.deleted_at IS NULL AND s.status = 'active') AS "of",
         CASE WHEN h.status = 'Open' AND h.due_on < (now() AT TIME ZONE 'Asia/Kolkata')::date THEN 'Overdue'
              WHEN h.status = 'Open' AND h.due_on = (now() AT TIME ZONE 'Asia/Kolkata')::date THEN 'Closing today'
              ELSE h.status END AS "displayStatus"
    FROM homework h
    JOIN sections sec ON sec.id = h.section_id
    JOIN classes c ON c.id = sec.class_id
    JOIN subjects sub ON sub.id = h.subject_id
    LEFT JOIN employees e ON e.id = h.assigned_by`;

export async function listHomework(user: AuthUser, f: Pagination & { campusId?: string; sectionId?: string; subjectId?: string; status?: string }) {
  const w = new Where();
  w.addIf(f.campusId, 'c.campus_id = ?');
  w.addIf(f.sectionId, 'h.section_id = ?');
  w.addIf(f.subjectId, 'h.subject_id = ?');
  if (f.status === 'Overdue') w.add(`h.status = 'Open' AND h.due_on < (now() AT TIME ZONE 'Asia/Kolkata')::date`);
  else w.addIf(f.status, 'h.status = ?');
  if (f.q) w.add('(h.title ILIKE ? OR sub.name ILIKE ?)', likeTerm(f.q), likeTerm(f.q));
  sectionScope(user, w, 'h.section_id');
  const { limit, offset } = limitOffset(f);
  const rows = await many(
    `SELECT q.*, count(*) OVER() AS total FROM (${HW_SELECT} ${w.sql}) q
      ORDER BY ${orderBy(f.sort, f.dir, HW_SORTS, 'due')},
               (q.status = 'Open') DESC, q.title
     LIMIT ${w.param(limit)} OFFSET ${w.param(offset)}`,
    w.params,
  );
  return { rows: rows.map(({ total: _t, ...r }) => r), total: rows[0]?.total ?? 0 };
}

export async function homeworkSummary(user: AuthUser, campusId?: string) {
  const w = new Where();
  w.addIf(campusId, 'c.campus_id = ?');
  sectionScope(user, w, 'h.section_id');
  const rows = await many(`${HW_SELECT} ${w.sql}`, w.params);
  const open = rows.filter((r) => r.status === 'Open');
  const overdue = open.filter((r) => r.displayStatus === 'Overdue');
  const avg = open.length ? Math.round(open.reduce((a, r) => a + (r.of ? (100 * r.submitted) / r.of : 0), 0) / open.length) : null;

  const sw = new Where().add(`s.deleted_at IS NULL AND s.status = 'active'`);
  sw.addIf(campusId, 's.campus_id = ?');
  sectionScope(user, sw, 's.section_id');
  const below = await one<{ n: number }>(
    `SELECT count(*)::int AS n FROM (
       SELECT s.id, count(h.id) AS due, count(hs.student_id) AS done
         FROM students s
         JOIN homework h ON h.section_id = s.section_id AND h.status <> 'Draft' AND h.due_on <= (now() AT TIME ZONE 'Asia/Kolkata')::date
         LEFT JOIN homework_submissions hs ON hs.homework_id = h.id AND hs.student_id = s.id
         ${sw.sql}
        GROUP BY s.id HAVING count(h.id) >= 2) x
      WHERE x.done * 2 < x.due`,
    sw.params,
  );
  return {
    open: open.length,
    averageSubmission: avg,
    overdue: overdue.length,
    overdueSubjects: [...new Set(overdue.map((r) => r.subject))],
    studentsBelow50: below?.n ?? 0,
  };
}

async function loadHomework(user: AuthUser, id: string, db?: Queryable) {
  const w = new Where().add('h.id = ?', id);
  sectionScope(user, w, 'h.section_id');
  const h = await one(`${HW_SELECT} ${w.sql}`, w.params, db);
  if (!h) throw notFound('Homework not found', 'HOMEWORK_NOT_FOUND');
  return h;
}

export async function createHomework(req: Request, input: { sectionId: string; subjectId: string; title: string; instructions?: string | null; dueOn: string; status: 'Draft' | 'Open' }) {
  const user = req.user!;
  const today = schoolToday();
  if (input.dueOn < today) throw badRequest('The due date cannot be in the past', 'VALIDATION_ERROR', [{ field: 'dueOn', message: 'Choose today or a later date' }]);
  return tx(async (db) => {
    const sec = await authorizeSection(user, input.sectionId, db);
    const sub = await one<{ name: string }>('SELECT name FROM subjects WHERE id = $1', [input.subjectId], db);
    if (!sub) throw badRequest('Subject not found', 'VALIDATION_ERROR', [{ field: 'subjectId', message: 'Choose a subject' }]);
    if (isRestricted(user) && sec.classTeacherId !== user.employeeId) {
      const teaches = await one('SELECT 1 FROM teacher_assignments WHERE employee_id = $1 AND section_id = $2 AND subject_id = $3', [user.employeeId, sec.id, input.subjectId], db);
      if (!teaches) throw badRequest(`You do not teach ${sub.name} in ${sec.label}`, 'VALIDATION_ERROR', [{ field: 'subjectId', message: 'Choose a subject you teach in this class' }]);
    }
    const h = await one<{ id: string }>(
      `INSERT INTO homework (section_id, subject_id, title, instructions, assigned_on, due_on, status, assigned_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [sec.id, input.subjectId, input.title, input.instructions ?? null, today, input.dueOn, input.status, user.employeeId], db,
    );
    let notified = 0;
    if (input.status === 'Open') {
      const students = await many<{ id: string }>(`SELECT id FROM students WHERE section_id = $1 AND deleted_at IS NULL AND status = 'active'`, [sec.id], db);
      for (const s of students) {
        notified += (await notifyGuardians(s.id, {
          category: 'Information', topic: 'homework', icon: 'edit', channels: ['push'],
          title: `New ${sub.name} homework: ${input.title}`, body: `Due ${input.dueOn}`, route: '/parent-360?tab=academics',
          entityType: 'homework', entityId: h!.id,
        }, db)).length;
      }
    }
    await audit(req, { action: 'create', module: 'academics', description: `Set homework "${input.title}" for ${sec.label} (due ${input.dueOn})`, entityType: 'homework', entityId: h!.id, metadata: { notified } }, db);
    return { id: h!.id, notified };
  });
}

export async function setHomeworkStatus(req: Request, id: string, status: 'Open' | 'Closed') {
  return tx(async (db) => {
    const h = await loadHomework(req.user!, id, db);
    if (h.status === status) throw conflict(`This homework is already ${status.toLowerCase()}`, 'NO_CHANGE');
    if (status === 'Open' && h.status === 'Closed') throw conflict('Closed homework cannot be reopened', 'INVALID_TRANSITION');
    await query('UPDATE homework SET status = $2 WHERE id = $1', [id, status], db);
    await audit(req, { action: 'update', module: 'academics', description: `Homework "${h.title}" (${h.sectionLabel}) ${status === 'Closed' ? 'closed' : 'published'} with ${h.submitted}/${h.of} submitted`, entityType: 'homework', entityId: id }, db);
    return { id, status };
  });
}

export async function homeworkSubmissions(user: AuthUser, id: string) {
  const h = await loadHomework(user, id);
  const students = await many(
    `SELECT s.id, s.admission_no AS "admissionNo", s.full_name AS "fullName", en.roll_no AS roll,
            hs.status, hs.submitted_at AS "submittedAt", hs.feedback
       FROM students s
       LEFT JOIN enrollments en ON en.student_id = s.id AND en.academic_year_id = (SELECT id FROM academic_years WHERE is_current)
       LEFT JOIN homework_submissions hs ON hs.homework_id = $1 AND hs.student_id = s.id
      WHERE s.section_id = $2 AND s.deleted_at IS NULL AND s.status = 'active'
      ORDER BY en.roll_no NULLS LAST, s.full_name`,
    [id, h.sectionId],
  );
  return { homework: h, students };
}

export async function saveSubmission(req: Request, id: string, input: { studentId: string; status: 'Submitted' | 'Late' | 'Reviewed' | 'Missing'; feedback?: string | null }) {
  return tx(async (db) => {
    const h = await loadHomework(req.user!, id, db);
    if (h.status === 'Draft') throw conflict('Publish the homework before recording submissions', 'INVALID_TRANSITION');
    const s = await one<{ full_name: string }>(`SELECT full_name FROM students WHERE id = $1 AND section_id = $2 AND deleted_at IS NULL`, [input.studentId, h.sectionId], db);
    if (!s) throw notFound('Student not found', 'STUDENT_NOT_FOUND');
    if (input.status === 'Missing') {
      await query('DELETE FROM homework_submissions WHERE homework_id = $1 AND student_id = $2', [id, input.studentId], db);
    } else {
      await query(
        `INSERT INTO homework_submissions (homework_id, student_id, status, feedback) VALUES ($1,$2,$3,$4)
         ON CONFLICT (homework_id, student_id) DO UPDATE SET status = EXCLUDED.status, feedback = COALESCE(EXCLUDED.feedback, homework_submissions.feedback)`,
        [id, input.studentId, input.status, input.feedback ?? null], db,
      );
    }
    await audit(req, { action: 'update', module: 'academics', description: `Homework "${h.title}": ${s.full_name} marked ${input.status}`, entityType: 'homework', entityId: id, metadata: input }, db);
    return { id, studentId: input.studentId, status: input.status };
  });
}

export async function remindHomework(req: Request, id: string) {
  return tx(async (db) => {
    const h = await loadHomework(req.user!, id, db);
    if (h.status !== 'Open') throw conflict('Reminders can only be sent for open homework', 'INVALID_TRANSITION');
    const pending = await many<{ id: string; first_name: string }>(
      `SELECT s.id, s.first_name FROM students s
        WHERE s.section_id = $1 AND s.deleted_at IS NULL AND s.status = 'active'
          AND NOT EXISTS (SELECT 1 FROM homework_submissions hs WHERE hs.homework_id = $2 AND hs.student_id = s.id)`,
      [h.sectionId, id], db,
    );
    let notified = 0;
    for (const s of pending) {
      notified += (await notifyGuardians(s.id, {
        category: 'Attention', topic: 'homework', icon: 'message',
        title: `Reminder: ${s.first_name}'s ${h.subject} homework is due ${h.dueOn}`,
        body: h.title, route: '/parent-360?tab=academics', entityType: 'homework', entityId: id,
      }, db)).length;
    }
    await audit(req, { action: 'notify', module: 'academics', description: `Sent homework reminder for "${h.title}" to parents of ${pending.length} student(s)`, entityType: 'homework', entityId: id, metadata: { students: pending.length, notified } }, db);
    return { students: pending.length, notified };
  });
}
