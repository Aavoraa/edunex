/**
 * Boards and grade scales: Cambridge IGCSE (A*–G, U) and Tamil Nadu
 * Matriculation (A1–E2). Each class follows a board; marks, term results,
 * performance bands and analytics use that board's scale. The seed puts the
 * Vadavalli campus Grades 6–9 on Matriculation.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { as } from './helpers.js';
import { many, one, pool } from '../src/config/db.js';

afterAll(() => pool.end());

const MATRIC = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D', 'E1', 'E2'];
const IGCSE = ['A*', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'U'];
const CBSE = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D', 'E'];

async function vdvClass(grade: number) {
  const c = await one<{ id: string; board: string }>(
    `SELECT c.id, c.board FROM classes c JOIN campuses cp ON cp.id = c.campus_id WHERE cp.code = 'vdv' AND c.grade_level = $1`, [grade],
  );
  return c!;
}

describe('Grade scales per board', () => {
  it('serves the Matriculation scale with its A1–E2 bands, untiered', async () => {
    const api = await as('parent');
    const r = await api.get('/api/grading/scale?board=matriculation');
    expect(r.status).toBe(200);
    const s = r.body.data;
    expect(s).toMatchObject({ board: 'matriculation', boardName: 'Tamil Nadu Matriculation', tiered: false, tiers: [], isFallback: false });
    expect(s.boundaries.map((b: any) => b.grade)).toEqual(MATRIC);
    expect(s.boundaries.map((b: any) => b.minPercent)).toEqual([91, 81, 71, 61, 51, 41, 35, 21, 0]);
    expect(s.expectationBands).toMatchObject({ above: 71, at: 61, aboveGrade: 'B1', atGrade: 'B2' });

    const igcse = (await api.get('/api/grading/scale')).body.data;
    expect(igcse).toMatchObject({ board: 'igcse', tiered: true });
    expect(igcse.boundaries.map((b: any) => b.grade)).toEqual(IGCSE);

    expect((await api.get('/api/grading/scale?board=icse')).status).toBe(400);
  });

  it('lists the boards and the classes that follow each', async () => {
    const api = await as('principal');
    const r = await api.get('/api/grading/boards');
    expect(r.status).toBe(200);
    const { boards, classes } = r.body.data;
    expect(boards.map((b: any) => b.board)).toEqual(['igcse', 'matriculation', 'cbse']);
    const matric = classes.filter((c: any) => c.board === 'matriculation');
    expect(matric.map((c: any) => `${c.campus}:${c.gradeLevel}`).sort()).toEqual(['Vadavalli:6', 'Vadavalli:7', 'Vadavalli:8', 'Vadavalli:9']);
    expect(boards.find((b: any) => b.board === 'matriculation')).toMatchObject({ classes: 4, range: 'A1–E2' });
  });

  it('seeds Matriculation classes with A1–E2 marks and term results', async () => {
    const marks = await many<{ grade: string }>(
      `SELECT DISTINCT m.grade FROM assessment_marks m JOIN assessments a ON a.id = m.assessment_id JOIN classes c ON c.id = a.class_id
        WHERE c.board = 'matriculation' AND m.grade IS NOT NULL`,
    );
    expect(marks.length).toBeGreaterThan(0);
    expect(marks.every((m) => MATRIC.includes(m.grade))).toBe(true);
    const recs = await many<{ board: string; grade: string }>(
      `SELECT DISTINCT c.board, r.grade FROM student_academic_records r JOIN students s ON s.id = r.student_id
         JOIN sections sec ON sec.id = s.section_id JOIN classes c ON c.id = sec.class_id`,
    );
    expect(recs.filter((x) => x.board === 'matriculation').every((x) => MATRIC.includes(x.grade))).toBe(true);
    expect(recs.filter((x) => x.board === 'igcse').every((x) => IGCSE.includes(x.grade))).toBe(true);
    // No IGCSE syllabus coverage or tier entries for Matriculation students.
    const entries = await one<{ n: number }>(
      `SELECT count(*)::int AS n FROM student_syllabus_entries e JOIN students s ON s.id = e.student_id
         JOIN sections sec ON sec.id = s.section_id JOIN classes c ON c.id = sec.class_id WHERE c.board = 'matriculation'`,
    );
    expect(entries!.n).toBe(0);
  });

  it('grades marks on a Matriculation class with A1–E2 and refuses IGCSE papers there', async () => {
    const api = await as('principal');
    const cls = await vdvClass(8);
    const sub = await one<{ id: string }>(`SELECT id FROM subjects WHERE code = 'MAT'`);
    const day = await one<{ d: string }>(`SELECT GREATEST(starts_on, current_date - 1)::text AS d FROM academic_years WHERE is_current`);
    const paper = await one<{ id: string }>(
      `SELECT sc.id FROM syllabus_components sc JOIN syllabuses sy ON sy.id = sc.syllabus_id WHERE sy.subject_id = $1 LIMIT 1`, [sub!.id],
    );
    const body = { name: 'Matric board test — Algebra', classId: cls.id, subjectId: sub!.id, assessmentType: 'test', heldOn: day!.d, maxMarks: 100 };
    if (paper) {
      const bad = await api.post('/api/academics/assessments', { ...body, syllabusComponentId: paper.id });
      expect(bad.status).toBe(400);
      expect(bad.body.error).toBe('COMPONENT_BOARD_MISMATCH');
    }
    const created = await api.post('/api/academics/assessments', body);
    expect(created.status).toBe(201);
    const id = created.body.data.id;
    const detail = (await api.get(`/api/academics/assessments/${id}`)).body.data;
    expect(detail.board).toBe('matriculation');
    const [a, b, c, d] = detail.students;
    const saved = await api.put(`/api/academics/assessments/${id}/marks`, {
      action: 'save',
      marks: [
        { studentId: a.id, marks: 92, isAbsent: false },
        { studentId: b.id, marks: 35, isAbsent: false },
        { studentId: c.id, marks: 34.5, isAbsent: false },
        { studentId: d.id, marks: 20, isAbsent: false },
      ],
    });
    expect(saved.status).toBe(200);
    const after = (await api.get(`/api/academics/assessments/${id}`)).body.data.students;
    const g = (sid: string) => after.find((x: any) => x.id === sid).grade;
    expect([g(a.id), g(b.id), g(c.id), g(d.id)]).toEqual(['A1', 'D', 'E1', 'E2']);
  });

  it('lets the Principal edit Matriculation boundaries and re-grade, with validation', async () => {
    const principal = await as('principal');
    const teacher = await as('teacher');
    const body = { board: 'matriculation', boundaries: [{ grade: 'A1', minPercent: 90 }], regrade: true };
    expect((await teacher.put('/api/grading/scale/boundaries', body)).status).toBe(403);

    const notMonotonic = await principal.put('/api/grading/scale/boundaries', { board: 'matriculation', boundaries: [{ grade: 'B1', minPercent: 85 }] });
    expect(notMonotonic.status).toBe(400);
    const tiers = await principal.put('/api/grading/scale/boundaries', { board: 'matriculation', boundaries: [{ grade: 'A1', minPercent: 90 }], tierRules: { Core: { highest: 'B1', lowest: 'D' } } });
    expect(tiers.status).toBe(400);
    const igcseLetter = await principal.put('/api/grading/scale/boundaries', { board: 'matriculation', boundaries: [{ grade: 'A*', minPercent: 95 }] });
    expect(igcseLetter.status).toBe(400);

    try {
      const r = await principal.put('/api/grading/scale/boundaries', body);
      expect(r.status).toBe(200);
      expect(r.body.data.scale.boundaries[0]).toMatchObject({ grade: 'A1', minPercent: 90 });
      // A Matriculation term result of exactly 90 is now A1; IGCSE results are untouched.
      const x = await one<{ board: string; grade: string }>(
        `SELECT c.board, r.grade FROM student_academic_records r JOIN students s ON s.id = r.student_id
           JOIN sections sec ON sec.id = s.section_id JOIN classes c ON c.id = sec.class_id
          WHERE r.score = 90 AND c.board = 'matriculation' AND r.academic_year_id = (SELECT id FROM academic_years WHERE is_current) LIMIT 1`,
      );
      if (x) expect(x.grade).toBe('A1');
      const igcse = (await principal.get('/api/grading/scale?board=igcse')).body.data;
      expect(igcse.boundaries[0]).toMatchObject({ grade: 'A*', minPercent: 90 });
    } finally {
      await principal.put('/api/grading/scale/boundaries', { board: 'matriculation', boundaries: [{ grade: 'A1', minPercent: 91 }], regrade: true });
    }
  });

  it('moves a class between boards and re-grades its results on the new scale', async () => {
    const principal = await as('principal');
    const cls = await vdvClass(7);
    expect(cls.board).toBe('matriculation');
    expect((await (await as('teacher')).put('/api/grading/classes/board', { classIds: [cls.id], board: 'igcse' })).status).toBe(403);
    const grades = () => many<{ grade: string }>(
      `SELECT DISTINCT r.grade FROM student_academic_records r JOIN students s ON s.id = r.student_id JOIN sections sec ON sec.id = s.section_id
        WHERE sec.class_id = $1 AND r.academic_year_id = (SELECT id FROM academic_years WHERE is_current)`, [cls.id],
    );
    try {
      const r = await principal.put('/api/grading/classes/board', { classIds: [cls.id], board: 'igcse' });
      expect(r.status).toBe(200);
      expect(r.body.data.changed).toBe(1);
      expect(r.body.data.regraded.records).toBeGreaterThan(0);
      expect((await grades()).every((x) => IGCSE.includes(x.grade))).toBe(true);
    } finally {
      const back = await principal.put('/api/grading/classes/board', { classIds: [cls.id], board: 'matriculation' });
      expect(back.status).toBe(200);
    }
    expect((await grades()).every((x) => MATRIC.includes(x.grade))).toBe(true);
    expect((await principal.put('/api/grading/classes/board', { classIds: [cls.id], board: 'state' })).status).toBe(400);
  });

  it('filters assessments and their summary by board', async () => {
    const api = await as('principal');
    const matric = await api.get('/api/academics/assessments?board=matriculation&pageSize=100');
    expect(matric.status).toBe(200);
    expect(matric.body.data.length).toBeGreaterThan(0);
    expect(matric.body.data.every((a: any) => a.board === 'matriculation')).toBe(true);
    const igcse = await api.get('/api/academics/assessments?board=igcse&pageSize=100');
    expect(igcse.body.data.every((a: any) => a.board === 'igcse')).toBe(true);
    const summary = (await api.get('/api/academics/assessments/summary?board=matriculation')).body.data;
    expect(summary.distribution.board).toBe('matriculation');
    expect(summary.distribution.labels).toEqual(MATRIC);
    expect((await api.get('/api/academics/assessments?board=icse')).status).toBe(400);
  });

  it('keeps Matriculation syllabuses, papers and unit coverage apart from IGCSE', async () => {
    const api = await as('principal');
    const matric = (await api.get('/api/syllabuses?board=matriculation')).body.data;
    expect(matric.length).toBeGreaterThanOrEqual(5);
    expect(matric.every((s: any) => s.board === 'matriculation' && s.grading === 'A1-E2' && !s.tiered)).toBe(true);
    const igcse = (await api.get('/api/syllabuses')).body.data;
    expect(igcse.every((s: any) => s.board === 'igcse')).toBe(true);
    const mat9 = matric.find((s: any) => s.title === 'Matriculation Mathematics — Std IX');
    expect(mat9).toMatchObject({ gradeLevels: [9] });
    expect(mat9.sections).toBeGreaterThan(0);

    const detail = (await api.get(`/api/syllabuses/${mat9.id}`)).body.data;
    expect(detail.board).toBe('matriculation');
    expect(detail.topics.length).toBeGreaterThan(0);
    // Only Matriculation sections take part in its coverage.
    expect(detail.sections.every((x: any) => x.campus === 'Vadavalli')).toBe(true);

    // Coverage on an IGCSE section is refused for a Matriculation syllabus.
    const igcseSection = await one<{ id: string }>(
      `SELECT sec.id FROM sections sec JOIN classes c ON c.id = sec.class_id WHERE c.board = 'igcse' AND c.grade_level = 9
          AND sec.academic_year_id = (SELECT id FROM academic_years WHERE is_current) LIMIT 1`,
    );
    const bad = await api.post(`/api/syllabuses/${mat9.id}/topics/${detail.topics[0].id}/coverage`, { sectionId: igcseSection!.id, status: 'Covered' });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBe('NOT_BOARD_SECTION');

    // A new Matriculation syllabus takes any standard and board defaults; IGCSE stays within Grades 8–10.
    const sub = await one<{ id: string }>(`SELECT id FROM subjects WHERE code = 'ENG'`);
    const made = await api.post('/api/syllabuses', { board: 'matriculation', subjectId: sub!.id, title: 'Matriculation English — Std VI', gradeLevels: [6] });
    expect(made.status).toBe(201);
    const got = (await api.get(`/api/syllabuses/${made.body.data.id}`)).body.data;
    expect(got).toMatchObject({ board: 'matriculation', stage: 'Matriculation', grading: 'A1-E2', tiered: false, gradeLevels: [6] });
    expect((await api.put(`/api/syllabuses/${made.body.data.id}`, { tiered: true })).status).toBe(400);
    expect((await api.post('/api/syllabuses', { subjectId: sub!.id, title: 'Cambridge IGCSE English (Grade 6)', gradeLevels: [6] })).status).toBe(400);

    // Assessments link only to papers on their class's board.
    const paper = detail.components[0];
    const cls = await vdvClass(9);
    const day = await one<{ d: string }>(`SELECT GREATEST(starts_on, current_date - 1)::text AS d FROM academic_years WHERE is_current`);
    const ok = await api.post('/api/academics/assessments', { name: 'Matric paper link test', classId: cls.id, subjectId: detail.subjectId, heldOn: day!.d, maxMarks: 100, syllabusComponentId: paper.id });
    expect(ok.status).toBe(201);
    const gdv9 = await one<{ id: string }>(`SELECT c.id FROM classes c JOIN campuses cp ON cp.id = c.campus_id WHERE cp.code = 'gdv' AND c.grade_level = 9`);
    const wrong = await api.post('/api/academics/assessments', { name: 'Wrong board paper', classId: gdv9!.id, subjectId: detail.subjectId, heldOn: day!.d, maxMarks: 100, syllabusComponentId: paper.id });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error).toBe('COMPONENT_BOARD_MISMATCH');
  });

  it('lists Matriculation learning outcomes separately from Cambridge objectives', async () => {
    const api = await as('principal');
    const matric = await api.get('/api/academics/objectives?board=matriculation&pageSize=100');
    expect(matric.status).toBe(200);
    expect(matric.body.data.length).toBeGreaterThan(0);
    expect(matric.body.data.every((o: any) => o.board === 'matriculation')).toBe(true);
    const stages = (await api.get('/api/academics/objectives/stages?board=matriculation')).body.data;
    expect(stages).toEqual(expect.arrayContaining(['Std VIII', 'Std IX']));
    const cambridge = (await api.get('/api/academics/objectives?board=igcse&pageSize=100')).body.data;
    expect(cambridge.every((o: any) => o.board === 'igcse')).toBe(true);

    const sub = await one<{ id: string }>(`SELECT id FROM subjects WHERE code = 'MAT'`);
    const r = await api.post('/api/academics/objectives', { board: 'matriculation', code: 'M9MA.99', description: 'Test outcome', subjectId: sub!.id, stageLabel: 'Std IX' });
    expect(r.status).toBe(201);
    const row = await one<{ board: string }>(`SELECT board FROM learning_objectives WHERE code = 'M9MA.99'`);
    expect(row!.board).toBe('matriculation');
  });

  it('runs CBSE as a third board: scale, classes, marks, syllabuses and outcomes', async () => {
    const api = await as('principal');
    const scale = (await api.get('/api/grading/scale?board=cbse')).body.data;
    expect(scale).toMatchObject({ board: 'cbse', boardName: 'CBSE', tiered: false, isFallback: false });
    expect(scale.boundaries.map((b: any) => b.grade)).toEqual(CBSE);
    expect(scale.boundaries.map((b: any) => b.minPercent)).toEqual([91, 81, 71, 61, 51, 41, 33, 0]);

    const { classes } = (await api.get('/api/grading/boards')).body.data;
    expect(classes.filter((c: any) => c.board === 'cbse').map((c: any) => `${c.campus}:${c.gradeLevel}`).sort())
      .toEqual(['Pollachi:6', 'Pollachi:7', 'Pollachi:8', 'Pollachi:9']);

    const marks = await many<{ grade: string }>(
      `SELECT DISTINCT m.grade FROM assessment_marks m JOIN assessments a ON a.id = m.assessment_id JOIN classes c ON c.id = a.class_id
        WHERE c.board = 'cbse' AND m.grade IS NOT NULL`,
    );
    expect(marks.length).toBeGreaterThan(0);
    expect(marks.every((m) => CBSE.includes(m.grade))).toBe(true);

    const list = (await api.get('/api/academics/assessments?board=cbse&pageSize=100')).body.data;
    expect(list.map((a: any) => a.code).sort()).toEqual(['AS-3304', 'AS-3305']);
    expect((await api.get('/api/academics/assessments/summary?board=cbse')).body.data.distribution.labels).toEqual(CBSE);

    const syl = (await api.get('/api/syllabuses?board=cbse')).body.data;
    expect(syl.length).toBe(4);
    expect(syl.every((s: any) => s.board === 'cbse' && s.grading === 'A1-E' && s.sections > 0)).toBe(true);
    const outcomes = (await api.get('/api/academics/objectives?board=cbse&pageSize=100')).body.data;
    expect(outcomes.length).toBeGreaterThan(0);
    expect(outcomes.every((o: any) => o.board === 'cbse' && o.stage.startsWith('Class '))).toBe(true);

    // Boundaries are editable like the other boards; a Matriculation letter is not on the CBSE scale.
    expect((await api.put('/api/grading/scale/boundaries', { board: 'cbse', boundaries: [{ grade: 'E2', minPercent: 0 }] })).status).toBe(400);
    const r = await api.put('/api/grading/scale/boundaries', { board: 'cbse', boundaries: [{ grade: 'D', minPercent: 35 }] });
    expect(r.status).toBe(200);
    await api.put('/api/grading/scale/boundaries', { board: 'cbse', boundaries: [{ grade: 'D', minPercent: 33 }] });
  });

  it('uses each board’s bands in academic performance and analytics', async () => {
    const api = await as('principal');
    const perf = (await api.get('/api/academics/performance')).body.data;
    expect(perf.expectations.map((e: any) => e.board)).toEqual(['cbse', 'igcse', 'matriculation']);
    expect(perf.expectations.find((e: any) => e.board === 'matriculation')).toMatchObject({ aboveGrade: 'B1', atGrade: 'B2' });
    const students = await api.get('/api/academics/performance/students?pageSize=100&sort=average&dir=desc');
    expect(students.status).toBe(200);
    const m = students.body.data.find((x: any) => x.board === 'matriculation' && x.average >= 61 && x.average < 70);
    if (m) expect(m.band).toBe('at'); // 61–70 is "at expectation" on Matriculation (B2), "below" on IGCSE

    const a = (await api.get('/api/analytics/overview?area=academics')).body.data.data;
    const boards = new Set(a.distributions.map((x: any) => x.board));
    expect(boards).toEqual(new Set(['igcse', 'matriculation', 'cbse']));
    expect(a.distributions.filter((x: any) => x.board === 'matriculation').map((x: any) => x.label)).toEqual(MATRIC);
  });
});
