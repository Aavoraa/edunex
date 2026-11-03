/**
 * Shared seeder for the syllabuses and learning outcomes of a non-IGCSE board
 * (Tamil Nadu Matriculation, CBSE): one syllabus per subject per standard/class,
 * its papers and textbook units, unit coverage for the board's sections, and
 * learning outcomes. Data lives in matriculation.ts and cbse.ts.
 */
import type { Db, SeedContext } from './context.js';
import { bulkInsert } from './context.js';

export type CType = 'written' | 'practical' | 'coursework' | 'oral' | 'listening';
// [paper, name, minutes, max marks, weighting %, type]
export type Comp = [string, string, number | null, number | null, number | null, CType];
// [unit, code, title, subtopics, planned hours]
export type Topic = [number, string, string, string, number];
export interface BoardSyllabusDef { key: string; subject: string; grade: number; title: string; components: Comp[]; topics: Topic[] }
/** [code, outcome, subject, standard/class label, coverage %, mastery %] */
export type Outcome = [string, string, string, string, number, number];

export interface BoardSeed {
  board: 'matriculation' | 'cbse';
  stage: string;
  awardingBody: string;
  grading: string;
  notes: string;
  defs: BoardSyllabusDef[];
  outcomes: Outcome[];
  /** Seeded assessments to link to a syllabus's paper 1: [assessment code, syllabus key]. */
  links: [string, string][];
}

export async function seedBoardSyllabuses(db: Db, ctx: SeedContext, b: BoardSeed) {
  const subjects: Record<string, string> = {};
  for (const r of (await db.query('SELECT id, code FROM subjects')).rows) subjects[r.code] = r.id;
  const admin = ctx.users.principal ?? null;

  // ---- Syllabuses, papers, textbook units -----------------------------------------
  const syl: { key: string; grade: number; subject: string; id: string; topics: string[] }[] = [];
  for (const d of b.defs) {
    if (!subjects[d.subject]) continue;
    const r = await db.query(
      `INSERT INTO syllabuses (board, subject_id, stage, awarding_body, syllabus_code, title, exam_series_years, tiered, grading, notes, is_active, created_by, grade_levels)
       VALUES ($1,$2,$3,$4,NULL,$5,NULL,false,$6,$7,true,$8,$9) RETURNING id`,
      [b.board, subjects[d.subject], b.stage, b.awardingBody, d.title, b.grading, b.notes, admin, [d.grade]],
    );
    const id = r.rows[0].id as string;
    await bulkInsert(db, 'syllabus_components',
      ['syllabus_id', 'paper_no', 'name', 'tier', 'duration_minutes', 'max_marks', 'weighting_percent', 'assessment_type', 'notes', 'sort_order'],
      d.components.map(([paper, name, mins, max, w, type], i) => [id, paper, name, 'All', mins, max, w, type, 'School examination default — editable.', i + 1]));
    const topics = await bulkInsert(db, 'syllabus_topics',
      ['syllabus_id', 'unit_no', 'code', 'title', 'subtopics', 'tier', 'planned_hours', 'planned_weeks', 'sort_order'],
      d.topics.map(([unit, code, title, subs, hours], i) => [id, unit, code, title, subs, 'All', hours, Math.round((hours / 4) * 2) / 2, i + 1]),
      'RETURNING id');
    syl.push({ key: d.key, grade: d.grade, subject: d.subject, id, topics: topics.map((t) => t.id as string) });
  }

  // ---- Unit coverage for the board's sections ----------------------------------------
  const sections = (await db.query(
    `SELECT sec.id, c.grade_level, sec.class_teacher_id
       FROM sections sec JOIN classes c ON c.id = sec.class_id
      WHERE sec.academic_year_id = $1 AND c.board = $2
      ORDER BY c.grade_level, sec.name`, [ctx.yearId, b.board],
  )).rows as { id: string; grade_level: number; class_teacher_id: string | null }[];
  const teachers: Record<string, string> = {};
  for (const t of (await db.query('SELECT section_id, subject_id, employee_id FROM teacher_assignments WHERE academic_year_id = $1', [ctx.yearId])).rows) {
    teachers[`${t.section_id}:${t.subject_id}`] = t.employee_id;
  }
  const yearStart = ctx.yearStart || ctx.day(-130);
  const daysIntoYear = Math.max(10, Math.round((Date.parse(ctx.today) - Date.parse(yearStart)) / 86400000));
  const coverage: unknown[][] = [];
  for (const sec of sections) {
    for (const s of syl.filter((x) => x.grade === sec.grade_level)) {
      const teacher = teachers[`${sec.id}:${subjects[s.subject]}`] ?? sec.class_teacher_id;
      // One-year course: about half the units are done by this point of the year.
      const done = Math.min(s.topics.length - 1, Math.round(s.topics.length * (0.35 + ctx.rand() * 0.25)));
      s.topics.forEach((t, i) => {
        if (i < done) {
          const back = Math.max(3, Math.round(daysIntoYear - ((i + 1) / (done + 1)) * daysIntoYear) + ctx.int(-4, 4));
          coverage.push([t, sec.id, 'Covered', ctx.day(-back), teacher, null, admin]);
        } else if (i === done) {
          coverage.push([t, sec.id, 'In progress', null, teacher, 'Teaching this fortnight.', admin]);
        }
      });
    }
  }
  if (coverage.length) {
    await bulkInsert(db, 'syllabus_topic_coverage', ['topic_id', 'section_id', 'status', 'covered_on', 'teacher_id', 'notes', 'updated_by'], coverage);
  }

  // ---- Link seeded exams to their theory papers --------------------------------------
  for (const [code, key] of b.links) {
    const s = syl.find((x) => x.key === key);
    if (!s) continue;
    const comp = (await db.query(`SELECT id FROM syllabus_components WHERE syllabus_id = $1 AND paper_no = '1'`, [s.id])).rows[0]?.id;
    if (comp) await db.query('UPDATE assessments SET syllabus_component_id = $2 WHERE code = $1', [code, comp]);
  }

  // ---- Learning outcomes -------------------------------------------------------------
  const rows = b.outcomes.filter(([, , sub]) => subjects[sub]).map(([code, text, sub, stage, cov, mas]) => [code, text, subjects[sub], stage, cov, mas, b.board]);
  if (rows.length) await bulkInsert(db, 'learning_objectives', ['code', 'description', 'subject_id', 'stage_label', 'coverage_pct', 'mastery_pct', 'board'], rows);
}
