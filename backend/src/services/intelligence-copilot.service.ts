import type { Request } from 'express';
import { many, one, query, tx } from '../config/db.js';
import { Where } from '../utils/sql.js';
import { likeTerm, limitOffset, orderBy } from '../utils/pagination.js';
import { badRequest, conflict, notFound } from '../utils/errors.js';
import type { AuthUser } from '../types.js';
import type { DraftType } from '../validators/intelligence.validators.js';
import { audit } from './audit.service.js';
import { authorizeStudent, studentScope } from './access.service.js';
import { notifyUsers } from './notification.service.js';
import { STUDENT_ROW_SQL } from './students.service.js';
import { isSchoolScope, schoolToday } from './intelligence-common.service.js';
import {
  getProvider, providerInfo,
  type BriefFacts, type ClassStatsFact, type CommentFacts, type FactsFor, type LessonFacts,
  type MessageFacts, type ObjectiveFact, type QuestionFact, type QuizFacts, type WorksheetFacts,
} from './intelligence-provider.js';

/**
 * AI Teacher Co-Pilot. The service gathers facts from school records, hands them to the
 * configured provider (a deterministic template generator unless a model is plugged in),
 * and stores every result in ai_drafts. Nothing is published until a named person with
 * ai.use approves it (Review → Edit → Approve).
 */

export const ACTIONS: { id: DraftType; label: string; icon: string; desc: string }[] = [
  { id: 'lesson', label: 'Create Lesson Plan', icon: 'bookOpen', desc: 'Objective-aligned plan with activities and timings' },
  { id: 'worksheet', label: 'Create Worksheet', icon: 'fileText', desc: 'Differentiated practice at three levels' },
  { id: 'quiz', label: 'Create Quiz', icon: 'checkSquare', desc: 'Drawn from the approved question bank' },
  { id: 'comment', label: 'Draft Report Comment', icon: 'edit', desc: 'Evidence-based comment per student' },
  { id: 'message', label: 'Draft Parent Message', icon: 'message', desc: 'Tone-checked, bilingual if required' },
  { id: 'brief', label: 'Weekly Class Brief', icon: 'clipboard', desc: 'Coverage, gaps and students to watch' },
];

const DEFAULT_TOPICS = ['Fractions', 'Decimals', 'Area and perimeter', 'Data handling'];
const GRADE_DIGITS = `regexp_replace(COALESCE(%s, ''), '\\D', '', 'g')`;
const gradeMatch = (col: string) => GRADE_DIGITS.replace('%s', col);

async function loadSubject(subjectId: string) {
  const s = await one<{ id: string; code: string; name: string }>('SELECT id, code, name FROM subjects WHERE id = $1', [subjectId]);
  if (!s) throw badRequest('Subject not found', 'VALIDATION_ERROR', [{ field: 'subjectId', message: 'Choose a subject' }]);
  return s;
}

/** Loads a section and checks the user teaches it (or has school scope). */
async function loadSection(user: AuthUser, sectionId: string) {
  const sec = await one<{ id: string; name: string; grade: string; gradeLevel: number; campusId: string; classTeacherId: string | null }>(
    `SELECT sec.id, sec.name, c.name AS grade, c.grade_level AS "gradeLevel", c.campus_id AS "campusId", sec.class_teacher_id AS "classTeacherId"
       FROM sections sec JOIN classes c ON c.id = sec.class_id WHERE sec.id = $1`, [sectionId]);
  if (!sec) throw notFound('Section not found', 'SECTION_NOT_FOUND');
  if (!isSchoolScope(user)) {
    const mine = await one(
      `SELECT 1 FROM teacher_assignments WHERE employee_id = $1 AND section_id = $2
        UNION SELECT 1 FROM sections WHERE id = $2 AND class_teacher_id = $1`, [user.employeeId, sectionId]);
    if (!mine) throw notFound('Section not found', 'SECTION_NOT_FOUND');
  }
  return { ...sec, label: `${sec.grade}${sec.name}` };
}

async function objectivesFor(subjectId: string, grade: number, topic?: string): Promise<ObjectiveFact[]> {
  const w = new Where().add('o.subject_id = ?', subjectId)
    .add(`(${gradeMatch('o.stage_label')} = ? OR o.code LIKE ?)`, String(grade), `${grade}%`);
  if (topic) w.add('(o.description ILIKE ? OR o.code ILIKE ?)', likeTerm(topic), likeTerm(topic));
  return many(
    `SELECT o.id, o.code, o.description, o.coverage_pct AS coverage, o.mastery_pct AS mastery
       FROM learning_objectives o ${w.sql} ORDER BY o.code`, w.params);
}

/** The objective a draft targets: the matching objective with the lowest mastery (the biggest gap). */
const pickObjective = (os: ObjectiveFact[]) => [...os].sort((a, b) => a.mastery - b.mastery || a.code.localeCompare(b.code))[0] ?? null;

async function questionsFor(subjectId: string, grade: number, topic: string): Promise<QuestionFact[]> {
  return many(
    `SELECT q.id, q.question, q.question_type AS type, q.difficulty, q.marks, q.topic
       FROM question_bank q
      WHERE q.subject_id = $1 AND q.status = 'Approved' AND q.topic ILIKE $2
        AND ${gradeMatch('q.stage_label')} IN ('', $3)
      ORDER BY array_position(ARRAY['Foundation','Core','Higher'], q.difficulty), q.times_used, q.created_at`,
    [subjectId, likeTerm(topic), String(grade)]);
}

/** Latest-term results for a subject across the grade (or one section) within the user's scope. */
async function classStats(user: AuthUser, subjectId: string, grade: number, section?: { id: string; label: string } | null): Promise<ClassStatsFact | null> {
  const w = new Where().add("s.deleted_at IS NULL AND s.status = 'active'").add('r.subject_id = ?', subjectId).add('c.grade_level = ?', grade);
  studentScope(user, w);
  if (section) w.add('s.section_id = ?', section.id);
  const r = await one(
    `WITH x AS (
       SELECT r.student_id, r.score, r.term, r.term_order, max(r.term_order) OVER () AS mx
         FROM student_academic_records r
         JOIN academic_years ay ON ay.id = r.academic_year_id AND ay.is_current
         JOIN students s ON s.id = r.student_id
         JOIN sections sec ON sec.id = s.section_id
         JOIN classes c ON c.id = sec.class_id
        ${w.sql})
     SELECT round(avg(score))::int AS average, count(*) FILTER (WHERE score < 60)::int AS below60,
            count(*)::int AS students, max(term) AS term
       FROM x WHERE term_order = mx`, w.params);
  if (!r || !r.students) return null;
  return { label: section ? section.label : `Grade ${grade}`, term: r.term, average: r.average, below60: r.below60, students: r.students };
}

/** Options and a factual banner for the Context card. */
export async function context(user: AuthUser, q: { grade?: number; subjectId?: string; topic?: string; sectionId?: string }) {
  const w = new Where().add('sec.academic_year_id = (SELECT id FROM academic_years WHERE is_current)');
  if (!isSchoolScope(user)) {
    w.add(`sec.id IN (SELECT section_id FROM teacher_assignments WHERE employee_id = ? UNION SELECT id FROM sections WHERE class_teacher_id = ?)`, user.employeeId, user.employeeId);
  } else if (user.campusId) {
    w.add('c.campus_id = ?', user.campusId);
  }
  const sections = await many(
    `SELECT sec.id, c.grade_level AS "gradeLevel", c.name || sec.name AS label, cp.short_name AS campus
       FROM sections sec JOIN classes c ON c.id = sec.class_id JOIN campuses cp ON cp.id = c.campus_id
       ${w.sql} ORDER BY c.grade_level, sec.name`, w.params);
  const subjects = await many(
    isSchoolScope(user)
      ? `SELECT id, code, name FROM subjects ORDER BY name`
      : `SELECT DISTINCT sub.id, sub.code, sub.name FROM teacher_assignments ta JOIN subjects sub ON sub.id = ta.subject_id WHERE ta.employee_id = $1 ORDER BY sub.name`,
    isSchoolScope(user) ? [] : [user.employeeId]);
  const grades = [...new Set(sections.map((s) => s.gradeLevel))];

  let topics = DEFAULT_TOPICS;
  let banner: Record<string, unknown> | null = null;
  if (q.subjectId && q.grade) {
    const bankTopics = await many<{ topic: string }>(
      `SELECT DISTINCT topic FROM question_bank WHERE subject_id = $1 AND status = 'Approved' AND ${gradeMatch('stage_label')} IN ('', $2) ORDER BY topic`,
      [q.subjectId, String(q.grade)]);
    topics = [...new Set([...bankTopics.map((t) => t.topic), ...DEFAULT_TOPICS])];
    if (q.topic) {
      const section = q.sectionId ? await loadSection(user, q.sectionId) : null;
      const [objectives, questions, stats] = await Promise.all([
        objectivesFor(q.subjectId, q.grade, q.topic),
        questionsFor(q.subjectId, q.grade, q.topic),
        classStats(user, q.subjectId, q.grade, section),
      ]);
      banner = { objective: pickObjective(objectives), objectiveCount: objectives.length, questionCount: questions.length, stats };
    }
  }
  return { actions: ACTIONS, sections, subjects, grades, topics, lessonLengths: [40, 60, 80], banner, provider: providerInfo() };
}

// ---------------------------------------------------------------------------
// Fact gathering per draft type
// ---------------------------------------------------------------------------
interface DraftInput {
  type: DraftType; grade: number; subjectId: string; topic: string; sectionId?: string; studentId?: string;
  lessonMinutes: number; messagePurpose: 'attendance' | 'homework' | 'progress' | 'general'; plannedFor?: string;
}

async function gatherFacts(req: Request, input: DraftInput) {
  const user = req.user!;
  const subject = await loadSubject(input.subjectId);
  const section = input.sectionId ? await loadSection(user, input.sectionId) : null;
  const grade = section?.gradeLevel ?? input.grade;
  const base = { grade, subject: subject.name, topic: input.topic, classLabel: section?.label ?? null };
  const meta: Record<string, unknown> = { subjectId: subject.id, subjectCode: subject.code, sectionId: section?.id ?? null, classLabel: section?.label ?? `Grade ${grade}`, grade };

  switch (input.type) {
    case 'lesson': {
      const [objectives, questions, stats] = await Promise.all([
        objectivesFor(subject.id, grade, input.topic), questionsFor(subject.id, grade, input.topic), classStats(user, subject.id, grade, section),
      ]);
      const objective = pickObjective(objectives);
      meta.objectiveId = objective?.id ?? null;
      meta.plannedFor = input.plannedFor ?? null;
      const facts: LessonFacts = { ...base, minutes: input.lessonMinutes, objective, questions, stats };
      return { facts, meta };
    }
    case 'worksheet': {
      const [objectives, questions] = await Promise.all([objectivesFor(subject.id, grade, input.topic), questionsFor(subject.id, grade, input.topic)]);
      const facts: WorksheetFacts = { ...base, objective: pickObjective(objectives), questions };
      return { facts, meta };
    }
    case 'quiz': {
      const questions = await questionsFor(subject.id, grade, input.topic);
      if (!questions.length) {
        throw badRequest(`The approved question bank has no Grade ${grade} ${subject.name} items on "${input.topic}". Add or approve questions first — quizzes are only drawn from approved items.`, 'NO_APPROVED_QUESTIONS');
      }
      const facts: QuizFacts = { ...base, questions };
      return { facts, meta };
    }
    case 'comment': {
      const students = await many(
        `WITH r AS (
           SELECT r.student_id, r.score, r.term, r.term_order, max(r.term_order) OVER (PARTITION BY r.student_id) AS mx
             FROM student_academic_records r JOIN academic_years ay ON ay.id = r.academic_year_id AND ay.is_current
            WHERE r.subject_id = $2)
         SELECT q.id, q."fullName" AS name, q."firstName", q."admissionNo", q.average, q.attendance,
                cur.score::int AS "subjectScore", cur.term, (cur.score - prev.score)::int AS "subjectTrend",
                (SELECT sk.skill FROM student_skills sk WHERE sk.student_id = q.id AND sk.score >= 75 ORDER BY sk.score DESC LIMIT 1) AS strength,
                (SELECT count(*) FROM behaviour_records b WHERE b.student_id = q.id AND b.record_type = 'Positive' AND b.recorded_on > current_date - 90)::int AS positives
           FROM (${STUDENT_ROW_SQL} WHERE s.section_id = $1 AND s.deleted_at IS NULL AND s.status = 'active') q
           LEFT JOIN r cur ON cur.student_id = q.id AND cur.term_order = cur.mx
           LEFT JOIN r prev ON prev.student_id = q.id AND prev.term_order = cur.mx - 1
          ORDER BY q."fullName"`, [section!.id, subject.id]);
      const facts: CommentFacts = { ...base, term: students.find((s) => s.term)?.term ?? null, students };
      return { facts, meta };
    }
    case 'message': {
      const studentId = await authorizeStudent(req, input.studentId!);
      const s = await one(
        `SELECT s.id, s.full_name AS name, s.first_name AS "firstName", s.admission_no AS "admissionNo",
                p.full_name AS "parentName", p.preferred_channel AS channel, c.grade_level AS "gradeLevel", c.name || sec.name AS "classLabel",
                s.section_id AS "sectionId"
           FROM students s
           LEFT JOIN sections sec ON sec.id = s.section_id LEFT JOIN classes c ON c.id = sec.class_id
           LEFT JOIN LATERAL (SELECT p.* FROM student_guardians sg JOIN parents p ON p.id = sg.parent_id
                               WHERE sg.student_id = s.id ORDER BY sg.is_primary DESC LIMIT 1) p ON true
          WHERE s.id = $1`, [studentId]);
      const [att, perf, homework] = await Promise.all([
        one(`SELECT count(*) FILTER (WHERE status = 'absent' AND attendance_date > current_date - 30)::int AS "absent30",
                    count(*) FILTER (WHERE status = 'late' AND attendance_date > current_date - 30)::int AS "late30",
                    round(100.0 * count(*) FILTER (WHERE a.status IN ('present', 'late')) / NULLIF(count(*), 0))::int AS pct,
                    COALESCE((SELECT array_agg(to_char(d, 'DD Mon') ORDER BY d DESC) FROM (
                      SELECT attendance_date AS d FROM attendance_records WHERE student_id = $1 AND status = 'absent'
                       ORDER BY attendance_date DESC LIMIT 3) z), '{}') AS "lastAbsences"
               FROM attendance_records a JOIN academic_years ay ON ay.is_current AND a.attendance_date BETWEEN ay.starts_on AND ay.ends_on
              WHERE a.student_id = $1`, [studentId]),
        one(`WITH r AS (SELECT r.score, r.term_order, max(r.term_order) OVER () AS mx FROM student_academic_records r
                          JOIN academic_years ay ON ay.id = r.academic_year_id AND ay.is_current
                         WHERE r.student_id = $1 AND r.subject_id = $2)
             SELECT (SELECT score FROM r WHERE term_order = mx LIMIT 1)::int AS score,
                    ((SELECT score FROM r WHERE term_order = mx LIMIT 1) - (SELECT score FROM r WHERE term_order = mx - 1 LIMIT 1))::int AS trend`,
          [studentId, subject.id]),
        many(`SELECT h.title, h.due_on AS "dueOn", (hs.student_id IS NOT NULL) AS submitted
                FROM homework h LEFT JOIN homework_submissions hs ON hs.homework_id = h.id AND hs.student_id = $1
               WHERE h.section_id = $2 AND h.subject_id = $3 AND h.status <> 'Draft' AND h.due_on <= current_date
               ORDER BY h.due_on DESC LIMIT 5`, [studentId, s.sectionId, subject.id]),
      ]);
      meta.studentId = studentId;
      meta.classLabel = s.classLabel;
      const facts: MessageFacts = {
        ...base, grade: s.gradeLevel ?? grade, classLabel: s.classLabel,
        purpose: input.messagePurpose, teacherName: user.fullName,
        student: { id: s.id, name: s.name, firstName: s.firstName, admissionNo: s.admissionNo, parentName: s.parentName, channel: s.channel },
        attendance: { absent30: att?.absent30 ?? 0, late30: att?.late30 ?? 0, pct: att?.pct ?? null, lastAbsences: att?.lastAbsences ?? [] },
        subjectScore: perf?.score ?? null, subjectTrend: perf?.trend ?? null, homework,
      };
      return { facts, meta };
    }
    default: {
      const to = schoolToday();
      const fromDate = new Date(`${to}T00:00:00Z`);
      fromDate.setUTCDate(fromDate.getUTCDate() - 6);
      const from = fromDate.toISOString().slice(0, 10);
      const [objectives, att, watch, term, plans] = await Promise.all([
        objectivesFor(subject.id, grade),
        one(`SELECT round(100.0 * count(*) FILTER (WHERE status IN ('present', 'late')) / NULLIF(count(*), 0))::int AS pct,
                    count(*) FILTER (WHERE status = 'absent')::int AS absences, count(*) FILTER (WHERE status = 'late')::int AS lates,
                    count(*)::int AS marked
               FROM attendance_records WHERE section_id = $1 AND attendance_date BETWEEN $2 AND $3`, [section!.id, from, to]),
        many(`SELECT q.id, q."fullName" AS name,
                     CASE WHEN q."signalCode" IS NOT NULL THEN 'Open Early Warning signal ' || q."signalCode"
                          WHEN q.trend <= -5 THEN 'Average down ' || abs(q.trend) || ' points on last term'
                          ELSE 'Attendance ' || q.attendance || '%' END AS reason
                FROM (${STUDENT_ROW_SQL} WHERE s.section_id = $1 AND s.deleted_at IS NULL AND s.status = 'active') q
               WHERE q."signalCode" IS NOT NULL OR q.trend <= -5 OR q.attendance < 85
               ORDER BY q."signalCode" IS NULL, q.trend LIMIT 8`, [section!.id]),
        one(`WITH r AS (SELECT r.score, r.term_order, max(r.term_order) OVER () AS mx FROM student_academic_records r
                          JOIN academic_years ay ON ay.id = r.academic_year_id AND ay.is_current
                          JOIN students s ON s.id = r.student_id
                         WHERE s.section_id = $1 AND r.subject_id = $2)
             SELECT round(avg(score) FILTER (WHERE term_order = mx))::int AS average,
                    round(avg(score) FILTER (WHERE term_order = mx) - avg(score) FILTER (WHERE term_order = mx - 1))::int AS trend FROM r`,
          [section!.id, subject.id]),
        many(`SELECT title, planned_for AS "plannedFor", status FROM lesson_plans
               WHERE section_id = $1 AND subject_id = $2 ORDER BY COALESCE(planned_for, created_at::date) DESC LIMIT 10`, [section!.id, subject.id]),
      ]);
      meta.period = { from, to };
      const facts: BriefFacts = {
        ...base, weekFrom: from, weekTo: to, objectives,
        attendance: { pct: att?.pct ?? null, absences: att?.absences ?? 0, lates: att?.lates ?? 0, marked: att?.marked ?? 0 },
        watch, termAverage: term?.average ?? null, termTrend: term?.trend ?? null, lessonPlans: plans,
      };
      return { facts, meta };
    }
  }
}

// ---------------------------------------------------------------------------
// Drafts
// ---------------------------------------------------------------------------
const DRAFT_SELECT = `
  SELECT d.id, d.draft_type AS type, d.status, d.prompt, d.output, d.created_at AS "createdAt", d.updated_at AS "updatedAt",
         d.approved_at AS "approvedAt", d.requested_by AS "requestedById", ru.full_name AS "requestedBy",
         au.full_name AS "approvedBy", d.output->>'title' AS title, d.prompt->>'classLabel' AS "classLabel"
    FROM ai_drafts d
    JOIN users ru ON ru.id = d.requested_by
    LEFT JOIN users au ON au.id = d.approved_by`;

function visibility(user: AuthUser, w: Where) {
  // School-level staff (principal, admin) oversee every draft; everyone else sees their own.
  if (!isSchoolScope(user)) w.add('d.requested_by = ?', user.id);
  return w;
}

export async function createDraft(req: Request, input: DraftInput) {
  const provider = getProvider();
  const { facts, meta } = await gatherFacts(req, input);
  const output = await provider.generate(input.type, facts as FactsFor[typeof input.type]);
  const prompt = {
    ...meta,
    type: input.type, topic: input.topic, lessonMinutes: input.type === 'lesson' ? input.lessonMinutes : undefined,
    messagePurpose: input.type === 'message' ? input.messagePurpose : undefined,
    provider: { name: provider.name, kind: provider.kind },
  };
  const row = await one<{ id: string }>(
    `INSERT INTO ai_drafts (draft_type, prompt, output, status, requested_by) VALUES ($1, $2, $3, 'Under Review', $4) RETURNING id`,
    [input.type, JSON.stringify(prompt), JSON.stringify(output), req.user!.id]);
  await audit(req, {
    action: 'create', module: 'ai', entityType: 'ai_draft', entityId: row!.id,
    description: `Generated ${input.type} draft "${output.title}" with the ${provider.name} provider (awaiting review)`,
    metadata: { type: input.type, provider: provider.name, classLabel: meta.classLabel, warnings: output.warnings.length },
  });
  return getDraft(req.user!, row!.id);
}

const DRAFT_SORTS: Record<string, string> = { created: 'd.created_at', status: 'd.status', type: 'd.draft_type', title: "d.output->>'title'" };

export async function listDrafts(user: AuthUser, f: { page: number; pageSize: number; q?: string; sort?: string; dir: 'asc' | 'desc'; type?: string; status?: string; mine?: boolean }) {
  const w = visibility(user, new Where());
  if (f.mine) w.add('d.requested_by = ?', user.id);
  w.addIf(f.type, 'd.draft_type = ?');
  w.addIf(f.status, 'd.status = ?');
  if (f.q) w.add("(d.output->>'title' ILIKE ? OR d.prompt->>'classLabel' ILIKE ?)", likeTerm(f.q), likeTerm(f.q));
  const { limit, offset } = limitOffset(f);
  const rows = await many(
    `SELECT d.id, d.draft_type AS type, d.status, d.created_at AS "createdAt", d.approved_at AS "approvedAt",
            ru.full_name AS "requestedBy", au.full_name AS "approvedBy", d.output->>'title' AS title,
            d.prompt->>'classLabel' AS "classLabel", jsonb_array_length(COALESCE(d.output->'warnings', '[]')) AS warnings,
            count(*) OVER() AS total
       FROM ai_drafts d JOIN users ru ON ru.id = d.requested_by LEFT JOIN users au ON au.id = d.approved_by
       ${w.sql}
      ORDER BY ${orderBy(f.sort, f.dir, DRAFT_SORTS, 'created')}
      LIMIT ${w.param(limit)} OFFSET ${w.param(offset)}`, w.params);
  return { rows: rows.map(({ total: _t, ...r }) => r), total: rows[0]?.total ?? 0 };
}

export async function getDraft(user: AuthUser, id: string) {
  const w = visibility(user, new Where().add('d.id = ?', id));
  const d = await one(`${DRAFT_SELECT} ${w.sql}`, w.params);
  if (!d) throw notFound('Draft not found', 'DRAFT_NOT_FOUND');
  return d;
}

const OPEN = ['Draft', 'Under Review'];

export async function updateDraft(req: Request, id: string, output: Record<string, unknown>) {
  const user = req.user!;
  return tx(async (db) => {
    const d = await one(`SELECT * FROM ai_drafts WHERE id = $1 FOR UPDATE`, [id], db);
    if (!d || (!isSchoolScope(user) && d.requested_by !== user.id)) throw notFound('Draft not found', 'DRAFT_NOT_FOUND');
    if (!OPEN.includes(d.status)) throw conflict(`This draft is ${d.status.toLowerCase()} and can no longer be edited`, 'DRAFT_CLOSED');
    const prev = d.output ?? {};
    const title = typeof output.title === 'string' && output.title.trim() ? output.title.trim().slice(0, 200) : prev.title;
    // Provenance (generator and sources) cannot be edited by the client.
    const next = {
      ...output, title, generator: prev.generator, sources: prev.sources, warnings: prev.warnings ?? [],
      edited: { by: user.fullName, at: new Date().toISOString(), count: Number(prev.edited?.count ?? 0) + 1 },
    };
    await query(`UPDATE ai_drafts SET output = $1, status = 'Under Review' WHERE id = $2`, [JSON.stringify(next), id], db);
    await audit(req, { action: 'update', module: 'ai', entityType: 'ai_draft', entityId: id, description: `Edited AI draft "${title}"` }, db);
  }).then(() => getDraft(user, id));
}

export async function approveDraft(req: Request, id: string) {
  const user = req.user!;
  const result = await tx(async (db) => {
    const d = await one(`SELECT * FROM ai_drafts WHERE id = $1 FOR UPDATE`, [id], db);
    if (!d || (!isSchoolScope(user) && d.requested_by !== user.id)) throw notFound('Draft not found', 'DRAFT_NOT_FOUND');
    if (!OPEN.includes(d.status)) throw conflict(`This draft is already ${d.status.toLowerCase()}`, 'DRAFT_CLOSED');
    const out = d.output ?? {};
    let lessonPlanId: string | null = null;
    if (d.draft_type === 'lesson') {
      const author = await one<{ id: string }>(
        `SELECT id FROM employees WHERE user_id = ANY($1) AND deleted_at IS NULL ORDER BY (user_id = $2) DESC LIMIT 1`,
        [[d.requested_by, user.id], d.requested_by], db);
      if (!author) throw badRequest('A lesson plan needs a staff author; neither the requester nor the approver has a staff record', 'NO_STAFF_AUTHOR');
      const p = d.prompt ?? {};
      const lp = await one<{ id: string }>(
        `INSERT INTO lesson_plans (title, section_id, subject_id, objective_id, planned_for, content, ai_generated, status, author_id, approved_by, approved_at)
         VALUES ($1, $2, $3, $4, $5, $6, true, 'Approved', $7, $8, now()) RETURNING id`,
        [String(out.title ?? 'AI lesson plan').slice(0, 200), p.sectionId ?? null, p.subjectId, p.objectiveId ?? null, p.plannedFor ?? null,
          JSON.stringify(out), author.id, user.id], db);
      lessonPlanId = lp!.id;
    }
    const approvedOutput = { ...out, approval: { by: user.fullName, at: new Date().toISOString(), lessonPlanId } };
    await query(`UPDATE ai_drafts SET status = 'Approved', approved_by = $1, approved_at = now(), output = $2 WHERE id = $3`,
      [user.id, JSON.stringify(approvedOutput), id], db);
    await audit(req, {
      action: 'approve', module: 'ai', entityType: 'ai_draft', entityId: id,
      description: `Approved AI ${d.draft_type} draft "${out.title}"${lessonPlanId ? ' — lesson plan created' : ''}`,
      metadata: { lessonPlanId, requestedBy: d.requested_by },
    }, db);
    if (lessonPlanId) {
      await audit(req, { action: 'create', module: 'academics', entityType: 'lesson_plan', entityId: lessonPlanId, description: `Lesson plan "${out.title}" created from an approved AI draft` }, db);
    }
    if (d.requested_by !== user.id) {
      await notifyUsers([d.requested_by], {
        category: 'Completed', topic: 'ai', icon: 'check', title: `Your draft was approved by ${user.fullName}`,
        body: String(out.title ?? ''), route: '/copilot', entityType: 'ai_draft', entityId: id,
      }, db);
    }
    return { lessonPlanId };
  });
  return { ...(await getDraft(user, id)), lessonPlanId: result.lessonPlanId };
}

export async function discardDraft(req: Request, id: string, reason?: string) {
  const user = req.user!;
  await tx(async (db) => {
    const d = await one(`SELECT * FROM ai_drafts WHERE id = $1 FOR UPDATE`, [id], db);
    if (!d || (!isSchoolScope(user) && d.requested_by !== user.id)) throw notFound('Draft not found', 'DRAFT_NOT_FOUND');
    if (!OPEN.includes(d.status)) throw conflict(`This draft is already ${d.status.toLowerCase()}`, 'DRAFT_CLOSED');
    await query(`UPDATE ai_drafts SET status = 'Rejected', output = output || $1 WHERE id = $2`,
      [JSON.stringify({ rejection: { by: user.fullName, at: new Date().toISOString(), reason: reason ?? null } }), id], db);
    await audit(req, {
      action: 'reject', module: 'ai', entityType: 'ai_draft', entityId: id,
      description: `Discarded AI ${d.draft_type} draft "${d.output?.title ?? ''}"${reason ? `: ${reason}` : ''}`,
    }, db);
  });
  return getDraft(user, id);
}
