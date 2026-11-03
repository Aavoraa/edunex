/**
 * SAMPLE DATA — academics domain (curriculum, objectives, periods, timetable,
 * assessments + marks, lesson plans, homework + submissions, question bank,
 * report-card batches + AI-drafted comments). Owned by the academics module.
 * Records follow the approved wireframe (data.js → D.academics / D.teacher);
 * every date is relative to ctx.today.
 */
import { addDays, bulkInsert, type Db, type SeedContext, type SeedStudent } from './context.js';
import { draftReportComment, gradeFor } from '../../backend/src/services/academics-shared.js';
import { boardFor } from './core-org.js';

const STAGES: [string, string, number][] = [
  ['Cambridge Primary', 'Grade 1–6', 74],
  ['Cambridge Lower Secondary', 'Grade 7–9', 68],
  ['Cambridge IGCSE', 'Grade 9–10', 61],
  ['Cambridge AS Level', 'Grade 11', 52],
  ['Cambridge A Level', 'Grade 12', 47],
];

/** [code, description, subject, stage label, coverage, mastery] */
const OBJECTIVES: [string, string, string, string, number, number][] = [
  ['5Nf.03', 'Understand and use equivalence of fractions', 'MAT', 'Primary 5', 92, 78],
  ['5Nf.04', 'Add and subtract fractions with the same denominator', 'MAT', 'Primary 5', 84, 71],
  ['5Nf.06', 'Compare and order fractions', 'MAT', 'Primary 5', 60, 54],
  ['5Sc.02', 'Describe the states of matter and changes between them', 'SCI', 'Primary 5', 100, 82],
  ['5Er.01', 'Read and respond to a range of texts with understanding', 'ENG', 'Primary 5', 88, 80],
  ['5Nm.02', 'Estimate and measure length, mass and capacity using standard units', 'MAT', 'Primary 5', 70, 62],
  ['5Ew.03', 'Plan and write a short narrative with a clear structure', 'ENG', 'Primary 5', 76, 69],
  ['5Sc.05', 'Investigate how the rate of evaporation can be changed', 'SCI', 'Primary 5', 64, 55],
  ['5Tm.01', 'Recite and explain a Tamil poem with correct pronunciation', 'TAM', 'Primary 5', 82, 77],
  ['5Ss.02', 'Describe the physical features of Tamil Nadu on a map', 'SST', 'Primary 5', 58, 51],
  ['5Cp.01', 'Follow and create simple algorithms using sequences and loops', 'CMP', 'Primary 5', 72, 70],
  ['6Nf.05', 'Compare and order fractions, including those with unlike denominators', 'MAT', 'Primary 6', 81, 69],
  ['6Nf.02', 'Recognise and use improper fractions and mixed numbers', 'MAT', 'Primary 6', 74, 63],
  ['6Er.04', 'Explain how a writer uses language to create effects', 'ENG', 'Primary 6', 66, 58],
  ['6Sc.03', 'Describe how forces act on objects in everyday situations', 'SCI', 'Primary 6', 70, 61],
  ['7Ni.03', 'Use ratio and proportion to solve problems', 'MAT', 'Lower Secondary 7', 62, 52],
  ['7Sc.04', 'Describe the structure and function of plant and animal cells', 'SCI', 'Lower Secondary 7', 71, 60],
  ['7Ss.01', 'Explain the causes and consequences of historical events', 'SST', 'Lower Secondary 7', 49, 41],
  ['8Ew.02', 'Write persuasive texts adapted to audience and purpose', 'ENG', 'Lower Secondary 8', 68, 59],
  ['8Cp.02', 'Design and test programs that use selection and iteration', 'CMP', 'Lower Secondary 8', 63, 60],
  ['9Tm.03', 'Analyse a prose passage in Tamil and summarise its argument', 'TAM', 'Lower Secondary 9', 77, 71],
  ['P1.3', 'Describe the motion of objects using distance–time and speed–time graphs', 'PHY', 'IGCSE', 72, 61],
  ['P2.1', 'Apply the principle of moments and describe the effects of forces', 'PHY', 'IGCSE', 58, 47],
  ['0500.R2', 'Demonstrate understanding of explicit and implicit meanings', 'ENG', 'IGCSE', 64, 57],
  ['0580.A3', 'Solve linear and quadratic equations and inequalities', 'MAT', 'IGCSE', 60, 50],
  ['9702.4', 'Understand work, energy and power in mechanical systems', 'PHY', 'AS Level', 52, 44],
  ['9709.P1', 'Use the rules of differentiation for standard functions', 'MAT', 'AS Level', 55, 46],
  ['9702.17', 'Describe simple harmonic motion and its energy changes', 'PHY', 'A Level', 47, 38],
];

const PERIODS: [string, string][] = [
  ['08:20', '09:00'], ['09:00', '09:40'], ['09:40', '10:20'], ['10:40', '11:20'],
  ['11:20', '12:00'], ['13:00', '13:40'], ['13:40', '14:20'], ['14:20', '15:00'],
];

type Cell = [subject: string | null, activity: string | null, employee: string | null, room: string];
const T = (s: string, e: string, room = 'R-204'): Cell => [s, null, e, room];
const A = (activity: string, e: string | null, room: string): Cell => [null, activity, e, room];

/** Grade 5A, exactly as the approved wireframe (Mon–Fri × 8 periods). */
const GRADE_5A: Cell[][] = [
  [T('MAT', 'EMP-1021'), T('ENG', 'EMP-1092'), T('SCI', 'EMP-1044', 'Lab-1'), T('TAM', 'EMP-1103'), T('SST', 'EMP-1088'), T('CMP', 'EMP-6003', 'Lab-2'), A('Games', 'EMP-1096', 'Field'), A('Library', 'EMP-1092', 'Library')],
  [T('ENG', 'EMP-1092'), T('MAT', 'EMP-1021'), T('TAM', 'EMP-1103'), T('SCI', 'EMP-1044', 'Lab-1'), T('ART', 'EMP-1098', 'Art Room'), T('MAT', 'EMP-1021'), T('SST', 'EMP-1088'), A('Club', null, 'Various')],
  [T('SCI', 'EMP-1044', 'Lab-1'), T('MAT', 'EMP-1021'), T('ENG', 'EMP-1092'), T('CMP', 'EMP-6003', 'Lab-2'), T('TAM', 'EMP-1103'), T('SST', 'EMP-1088'), A('Music', null, 'Music Room'), A('Games', 'EMP-1096', 'Field')],
  [T('MAT', 'EMP-1021'), T('SST', 'EMP-1088'), T('SCI', 'EMP-1044', 'Lab-1'), T('ENG', 'EMP-1092'), T('CMP', 'EMP-6003', 'Lab-2'), T('TAM', 'EMP-1103'), A('Library', 'EMP-1092', 'Library'), A('Assembly', null, 'Hall')],
  [T('ENG', 'EMP-1092'), T('SCI', 'EMP-1044', 'Lab-1'), T('MAT', 'EMP-1021'), T('TAM', 'EMP-1103'), T('ART', 'EMP-1098', 'Art Room'), T('SST', 'EMP-1088'), A('Games', 'EMP-1096', 'Field'), A('Club', null, 'Various')],
];
/** Thursday Period 2 (Social Studies) needs cover — Ms. Anitha Devi is on leave today. */
const SUBSTITUTE_SLOT = { day: 4, period: 2 };

/** Ms. Priya Raghavan's other Mathematics sections: [section key, day, period]. */
const PRIYA_SLOTS: [string, number, number][] = [
  ['gdv:6:B', 1, 3], ['gdv:6:B', 2, 4], ['gdv:6:B', 3, 6], ['gdv:6:B', 4, 3], ['gdv:6:B', 4, 4], ['gdv:6:B', 5, 1],
  ['gdv:6:C', 1, 5], ['gdv:6:C', 2, 8], ['gdv:6:C', 3, 1], ['gdv:6:C', 3, 7], ['gdv:6:C', 4, 6], ['gdv:6:C', 5, 5],
  ['gdv:7:A', 1, 7], ['gdv:7:A', 1, 8], ['gdv:7:A', 2, 1], ['gdv:7:A', 3, 4], ['gdv:7:A', 5, 2], ['gdv:7:A', 5, 6],
];

const QUESTION_TOPICS: { topic: string; subject: string; stage: string; items: number; used: number; difficulty: string[]; stems: string[] }[] = [
  { topic: 'Fractions — equivalence', subject: 'MAT', stage: 'Primary 5', items: 48, used: 22, difficulty: ['Foundation', 'Core', 'Higher'],
    stems: ['Write two fractions equivalent to {a}/{b}.', 'Shade {a}/{b} of the shape and write an equivalent fraction.', 'Is {a}/{b} equal to {c}/{d}? Explain.', 'Simplify {c}/{d} to its lowest terms.', 'Find the missing numerator: {a}/{b} = ?/{d}.'] },
  { topic: 'States of matter', subject: 'SCI', stage: 'Primary 5', items: 36, used: 18, difficulty: ['Foundation'],
    stems: ['Name the process when a liquid turns into a gas.', 'Give one example of a solid that melts at room temperature.', 'Why do puddles dry faster on a sunny day?', 'Sort these into solids, liquids and gases: ice, steam, juice, stone.', 'Describe what happens to particles when water freezes.'] },
  { topic: 'Comprehension — narrative', subject: 'ENG', stage: 'Primary 5', items: 61, used: 31, difficulty: ['Foundation', 'Core', 'Higher'],
    stems: ['What does the main character want at the start of the story?', 'Find a word in paragraph {a} that shows the character is nervous.', 'How does the setting change the mood of the story?', 'Predict what will happen next and give a reason.', 'Why does the author end the chapter with a question?'] },
  { topic: 'Forces and motion', subject: 'PHY', stage: 'IGCSE', items: 124, used: 88, difficulty: ['Higher'],
    stems: ['A car accelerates from rest to {a} m/s in {b} s. Calculate its acceleration.', 'State the principle of moments.', 'Sketch a distance–time graph for an object moving at constant speed.', 'Explain why a parachutist reaches terminal velocity.', 'A {a} N force acts {b} cm from a pivot. Calculate the moment.'] },
];

export async function seed(db: Db, ctx: SeedContext): Promise<void> {
  const E = ctx.employees;
  const S = ctx.subjects;

  // ---- Curriculum stages & objectives ---------------------------------------
  await bulkInsert(db, 'curriculum_stages', ['name', 'grades', 'sort_order', 'coverage_pct'],
    STAGES.map(([name, grades, cov], i) => [name, grades, i + 1, cov]));
  const objRows = await bulkInsert(db, 'learning_objectives', ['code', 'description', 'subject_id', 'stage_label', 'coverage_pct', 'mastery_pct'],
    OBJECTIVES.map(([code, d, sub, stage, cov, mas]) => [code, d, S[sub], stage, cov, mas]), 'RETURNING id, code, coverage_pct, mastery_pct');
  const objectiveId: Record<string, string> = Object.fromEntries(objRows.map((o) => [o.code, o.id]));

  // Term-by-term history: coverage builds through the year, mastery trails it.
  const TERM_SNAP: [string, number, number][] = [['Term 1', 0.3, 0.3], ['Term 2', 0.52, 0.5], ['Term 3', 0.68, 0.66], ['Mid Yr', 0.8, 0.79], ['Term 4', 0.91, 0.9]];
  const snaps: unknown[][] = [];
  for (const o of objRows) {
    TERM_SNAP.forEach(([term, cf, mf], i) => {
      const cov = Math.min(100, Math.round(o.coverage_pct * cf + (ctx.rand() - 0.5) * 4));
      snaps.push([o.id, ctx.yearId, term, i + 1, Math.max(0, cov), Math.max(0, Math.min(cov, Math.round(o.mastery_pct * mf + (ctx.rand() - 0.5) * 4)))]);
    });
  }
  await bulkInsert(db, 'learning_objective_snapshots', ['objective_id', 'academic_year_id', 'term', 'term_order', 'coverage_pct', 'mastery_pct'], snaps);

  // ---- Periods (8 per campus) ------------------------------------------------
  const periodId: Record<string, string[]> = {};
  for (const [code, campus] of Object.entries(ctx.campuses)) {
    const rows = await bulkInsert(db, 'periods', ['campus_id', 'period_no', 'starts_at', 'ends_at'],
      PERIODS.map(([s, e], i) => [campus.id, i + 1, s, e]), 'RETURNING id, period_no');
    periodId[code] = rows.sort((a, b) => a.period_no - b.period_no).map((r) => r.id);
  }

  // ---- Timetable ---------------------------------------------------------------
  const sectionRoom: Record<string, string> = Object.fromEntries(
    (await db.query('SELECT id, room FROM sections')).rows.map((r) => [r.id, r.room]),
  );
  const teacherBusy = new Set<string>();
  const sectionBusy = new Set<string>();
  const tt: unknown[][] = [];
  const place = (secKey: string, day: number, period: number, cell: Cell, needsSub = false) => {
    const sectionId = ctx.sections[secKey];
    const campus = secKey.split(':')[0];
    const [sub, activity, emp, room] = cell;
    if (emp) teacherBusy.add(`${emp}:${day}:${period}`);
    sectionBusy.add(`${sectionId}:${day}:${period}`);
    tt.push([sectionId, day, periodId[campus][period - 1], sub ? S[sub] : null, activity, emp ? E[emp] : null, null, room, needsSub]);
  };
  GRADE_5A.forEach((dayCells, di) => dayCells.forEach((cell, pi) => {
    place('gdv:5:A', di + 1, pi + 1, cell, di + 1 === SUBSTITUTE_SLOT.day && pi + 1 === SUBSTITUTE_SLOT.period);
  }));
  for (const [key, day, period] of PRIYA_SLOTS) place(key, day, period, ['MAT', null, 'EMP-1021', sectionRoom[ctx.sections[key]] ?? 'R-211']);

  // Every other section with teacher assignments gets a clash-free timetable.
  const assignments = (await db.query(
    `SELECT ta.section_id, ta.periods_per_week, e.employee_code, sub.code AS subject
       FROM teacher_assignments ta JOIN employees e ON e.id = ta.employee_id JOIN subjects sub ON sub.id = ta.subject_id
      ORDER BY ta.section_id, sub.code`,
  )).rows;
  const keyBySection = Object.fromEntries(Object.entries(ctx.sections).map(([k, id]) => [id, k]));
  const slots: [number, number][] = [];
  for (let d = 1; d <= 5; d++) for (let p = 1; p <= 8; p++) slots.push([d, p]);
  let salt = 0;
  for (const a of assignments) {
    const key = keyBySection[a.section_id];
    if (key === 'gdv:5:A' || (a.employee_code === 'EMP-1021')) continue;
    const perDay: Record<number, number> = {};
    let placed = 0;
    salt += 7;
    const order = [...slots].sort((x, y) => ((x[0] * 13 + x[1] * 5 + salt) % 17) - ((y[0] * 13 + y[1] * 5 + salt) % 17));
    for (const [d, p] of order) {
      if (placed >= a.periods_per_week) break;
      if (sectionBusy.has(`${a.section_id}:${d}:${p}`) || teacherBusy.has(`${a.employee_code}:${d}:${p}`) || (perDay[d] ?? 0) >= 2) continue;
      const room = ['SCI', 'PHY'].includes(a.subject) ? 'Lab-1' : a.subject === 'CMP' ? 'Lab-2' : a.subject === 'ART' ? 'Art Room' : sectionRoom[a.section_id];
      place(key, d, p, [a.subject, null, a.employee_code, room]);
      perDay[d] = (perDay[d] ?? 0) + 1;
      placed++;
    }
  }
  await bulkInsert(db, 'timetable_entries',
    ['section_id', 'day_of_week', 'period_id', 'subject_id', 'activity', 'employee_id', 'substitute_id', 'room', 'needs_substitute'], tt);

  // ---- Assessments & marks -----------------------------------------------------
  const inClass = (campus: string, grade: number, section?: string) =>
    ctx.students.filter((s) => s.campusCode === campus && s.gradeLevel === grade && (!section || s.section === section));
  const markers = [ctx.users.teacher, ctx.users.teacher2, ctx.users.principal];
  // [code, name, grade, section, subject, type, dayOffset, max, status, share entered, campus (default gdv)]
  const ASSESS: [string, string, number, string | null, string, string, number, number, string, number, string?][] = [
    ['AS-3312', 'Term 3 Mathematics — Fractions', 5, null, 'MAT', 'test', 5, 50, 'Scheduled', 0],
    ['AS-3308', 'Term 3 Science — States of Matter', 5, null, 'SCI', 'test', -2, 50, 'In Progress', 0.67],
    ['AS-3301', 'Mid-term English Reading', 5, null, 'ENG', 'exam', -15, 40, 'Completed', 1],
    ['AS-3290', 'IGCSE Mock — Physics Paper 1', 10, null, 'PHY', 'mock', -9, 40, 'Moderation', 1],
    ['AS-3288', 'IGCSE Mock — Physics Paper 2', 10, null, 'PHY', 'mock', -20, 80, 'Completed', 1],
    ['AS-3295', 'Unit Test — Comparing Fractions', 6, 'B', 'MAT', 'unit_test', -6, 30, 'Completed', 1],
    ['AS-3297', 'Class Test — Ratio and Proportion', 6, 'C', 'MAT', 'test', -1, 25, 'In Progress', 0.5],
    ['AS-3299', 'Quiz — Negative Numbers', 7, 'A', 'MAT', 'quiz', 3, 20, 'Scheduled', 0],
    ['AS-3274', 'Unit Test — Social Studies', 5, null, 'SST', 'unit_test', -29, 25, 'Completed', 1],
    ['AS-3281', 'Unit Test — Cells and Organisms', 7, 'B', 'SCI', 'unit_test', -24, 30, 'Completed', 1],
    ['AS-3284', 'Tamil Grammar Test', 6, 'C', 'TAM', 'test', -18, 40, 'Completed', 1],
    ['AS-3286', 'Persuasive Writing Task', 8, 'B', 'ENG', 'project', -12, 20, 'Completed', 1],
    // Vadavalli Grades 6–9 follow the Tamil Nadu Matriculation board — graded A1–E2.
    ['AS-3302', 'Quarterly Exam — Mathematics', 8, null, 'MAT', 'exam', -16, 100, 'Completed', 1, 'vdv'],
    ['AS-3303', 'Quarterly Exam — Tamil', 9, 'A', 'TAM', 'exam', -14, 100, 'Completed', 1, 'vdv'],
    ['AS-3306', 'Unit Test — Science', 7, 'B', 'SCI', 'unit_test', -4, 25, 'In Progress', 0.6, 'vdv'],
    // Pollachi Grades 6–9 follow CBSE — graded A1–E.
    ['AS-3304', 'Periodic Test 1 — Mathematics', 9, null, 'MAT', 'test', -12, 40, 'Completed', 1, 'plc'],
    ['AS-3305', 'Periodic Test 1 — Science', 8, 'A', 'SCI', 'test', -9, 40, 'Completed', 1, 'plc'],
  ];
  const marks: unknown[][] = [];
  for (const [code, name, grade, section, sub, type, off, max, status, share, campus = 'gdv'] of ASSESS) {
    const r = await db.query(
      `INSERT INTO assessments (code, name, class_id, section_id, subject_id, academic_year_id, assessment_type, held_on, max_marks, status, created_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [code, name, ctx.classes[`${campus}:${grade}`], section ? ctx.sections[`${campus}:${grade}:${section}`] : null, S[sub], ctx.yearId, type,
        ctx.day(off), max, status, sub === 'MAT' ? ctx.users.teacher : sub === 'SCI' ? ctx.users.teacher2 : ctx.users.principal, ctx.at(ctx.day(Math.min(off, 0) - 10), '10:00')],
    );
    const roster = inClass(campus, grade, section ?? undefined);
    const count = Math.round(roster.length * share);
    roster.slice(0, count).forEach((s, i) => {
      const absent = status === 'Completed' && ctx.rand() < 0.03;
      const multi = code === 'AS-3301' || code === 'AS-3290';
      const markerBias = multi ? [0, -1, -6][i % 3] : 0;
      const pct = Math.max(20, Math.min(100, s.targetAverage + markerBias + Math.round((ctx.rand() - 0.5) * 16)));
      const m = absent ? null : Math.round((pct / 100) * max * 2) / 2;
      marks.push([r.rows[0].id, s.id, m, absent, m == null ? null : gradeFor((m / max) * 100, null, boardFor(campus, grade)),
        multi ? markers[i % 3] : sub === 'SCI' ? ctx.users.teacher2 : sub === 'MAT' ? ctx.users.teacher : ctx.users.principal]);
    });
  }
  await bulkInsert(db, 'assessment_marks', ['assessment_id', 'student_id', 'marks', 'is_absent', 'grade', 'entered_by'], marks);

  // ---- Lesson plans -------------------------------------------------------------
  const L = {
    objective: 'Students compare and order fractions with unlike denominators, and explain their reasoning using a common denominator or a benchmark of one half. (Cambridge 6Nf.05)',
    plan: [
      { time: '0–5 min', step: 'Recall starter', detail: 'Quick fire: name three fractions equivalent to one half. Collect on the board.' },
      { time: '5–15 min', step: 'Guided instruction', detail: 'Model comparison of 3/5 and 5/8 using a common denominator. Then model the benchmark method.' },
      { time: '15–30 min', step: 'Paired practice', detail: 'Ordering cards activity. Pairs justify placement to each other before recording.' },
      { time: '30–38 min', step: 'Differentiated task', detail: 'Foundation, core and extension sets issued from the worksheet.' },
      { time: '38–40 min', step: 'Exit ticket', detail: 'Two comparison questions with a one-line explanation each.' },
    ],
    activities: ['Ordering cards (physical manipulative)', 'Number line placement on the board', 'Think-pair-share justification'],
    differentiation: [
      { level: 'Foundation', detail: '6 comparisons with denominators from the same family (halves, quarters, eighths).' },
      { level: 'Core', detail: '8 comparisons with unlike denominators, 2 requiring ordering of three fractions.' },
      { level: 'Extension', detail: '4 problems in context plus one "explain the error" task.' },
    ],
    homework: 'Worksheet 3, questions 1–8. Extension students attempt question 9.',
  };
  // [title, objective, section, subject, author, dayOffset, ai, status]
  const PLANS: [string, string, string, string, string, number, boolean, string][] = [
    ['Comparing and ordering fractions', '6Nf.05', 'gdv:6:B', 'MAT', 'EMP-1021', 0, true, 'Approved'],
    ['States of matter — evaporation', '5Sc.02', 'gdv:5:A', 'SCI', 'EMP-1044', 0, false, 'Approved'],
    ['Narrative comprehension', '5Er.01', 'gdv:5:A', 'ENG', 'EMP-1092', 1, true, 'Under Review'],
    ['Forces and motion — practical', 'P2.1', 'gdv:10:A', 'PHY', 'EMP-1044', 1, false, 'Draft'],
    ['Equivalent fractions with fraction walls', '5Nf.03', 'gdv:5:A', 'MAT', 'EMP-1021', -3, true, 'Approved'],
    ['Adding fractions with the same denominator', '5Nf.04', 'gdv:5:A', 'MAT', 'EMP-1021', -1, false, 'Approved'],
    ['Improper fractions and mixed numbers', '6Nf.02', 'gdv:6:C', 'MAT', 'EMP-1021', 2, true, 'Submitted'],
    ['Ratio in recipes', '7Ni.03', 'gdv:7:A', 'MAT', 'EMP-1021', 1, false, 'Draft'],
    ['Plant and animal cells under the microscope', '7Sc.04', 'gdv:7:B', 'SCI', 'EMP-1044', -2, false, 'Approved'],
    ['Persuasive letters to the editor', '8Ew.02', 'gdv:8:B', 'ENG', 'EMP-1092', -2, true, 'Approved'],
    ['Map work — rivers of Tamil Nadu', '5Ss.02', 'gdv:5:A', 'SST', 'EMP-1088', -1, false, 'Approved'],
    ['Causes of the 1857 uprising', '7Ss.01', 'gdv:7:C', 'SST', 'EMP-1088', 2, true, 'Submitted'],
    ['Loops with Scratch', '5Cp.01', 'gdv:5:A', 'CMP', 'EMP-6003', -3, false, 'Approved'],
    ['Selection in Python', '8Cp.02', 'gdv:8:B', 'CMP', 'EMP-6003', 0, true, 'Approved'],
    ['Tamil poem recitation', '5Tm.01', 'gdv:5:A', 'TAM', 'EMP-1103', 0, false, 'Approved'],
    ['Prose analysis — summary writing', '9Tm.03', 'gdv:6:C', 'TAM', 'EMP-1103', 2, true, 'Under Review'],
    ['Writer’s craft — figurative language', '6Er.04', 'gdv:6:B', 'ENG', 'EMP-1092', -1, true, 'Rejected'],
    ['Distance–time graphs', 'P1.3', 'gdv:10:A', 'PHY', 'EMP-1044', -3, true, 'Approved'],
    ['Evaporation rate investigation', '5Sc.05', 'gdv:5:A', 'SCI', 'EMP-1044', 2, false, 'Submitted'],
    ['Measuring capacity in the kitchen', '5Nm.02', 'gdv:5:A', 'MAT', 'EMP-1021', 3, true, 'Draft'],
  ];
  const planRows = PLANS.map(([title, obj, sec, sub, author, off, ai, status]) => {
    const approved = status === 'Approved' || status === 'Rejected';
    const approver = title.startsWith('Comparing and ordering') ? ctx.users.teacher : ctx.users.principal;
    const content = title.startsWith('Comparing and ordering')
      ? L
      : { objective: OBJECTIVES.find((o) => o[0] === obj)?.[1] ?? title, plan: [{ time: '0–10 min', step: 'Starter', detail: `Recall prior learning on ${title.toLowerCase()}.` }, { time: '10–30 min', step: 'Main activity', detail: 'Guided practice in pairs, then independent work.' }, { time: '30–40 min', step: 'Plenary', detail: 'Exit ticket with two questions.' }], activities: [], differentiation: [], homework: '', reviewNote: status === 'Rejected' ? 'Please add a differentiated task for the support group.' : undefined };
    return [title, ctx.sections[sec], S[sub], objectiveId[obj], ctx.day(off), JSON.stringify(content), ai, status, E[author],
      approved ? approver : null, approved ? ctx.at(ctx.day(Math.min(off, 0) - 1), '16:12') : null];
  });
  await bulkInsert(db, 'lesson_plans', ['title', 'section_id', 'subject_id', 'objective_id', 'planned_for', 'content', 'ai_generated', 'status', 'author_id', 'approved_by', 'approved_at'], planRows);

  // ---- Homework & submissions ---------------------------------------------------
  // [section, subject, title, assignedOffset, dueOffset, status, target submission share, teacher]
  const HW: [string, string, string, number, number, string, number, string][] = [
    ['gdv:5:A', 'MAT', 'Fractions worksheet 3 — equivalence', -3, 1, 'Open', 0.75, 'EMP-1021'],
    ['gdv:5:A', 'ENG', 'Reading response — Chapter 6', -2, 2, 'Open', 0.34, 'EMP-1092'],
    ['gdv:5:A', 'SCI', 'Evaporation observation log', -6, 0, 'Open', 0.94, 'EMP-1044'],
    ['gdv:5:A', 'TAM', 'கவிதை மனப்பாடம்', -1, 4, 'Open', 0.13, 'EMP-1103'],
    ['gdv:6:B', 'ENG', 'Book review — first draft', -7, -2, 'Open', 0.5, 'EMP-1092'],
    ['gdv:6:C', 'TAM', 'Grammar exercise 4', -5, -1, 'Open', 0.45, 'EMP-1103'],
    ['gdv:7:B', 'SCI', 'Cell diagram with labels', -2, 3, 'Open', 0.6, 'EMP-1044'],
    ['gdv:6:B', 'MAT', 'Ordering fractions — practice set', -4, 2, 'Open', 0.7, 'EMP-1021'],
    ['gdv:5:A', 'MAT', 'Fractions worksheet 2', -17, -12, 'Closed', 0.85, 'EMP-1021'],
    ['gdv:5:A', 'ENG', 'Reading response — Chapter 5', -16, -11, 'Closed', 0.8, 'EMP-1092'],
    ['gdv:5:A', 'SST', 'Map of Tamil Nadu rivers', -14, -9, 'Closed', 0.8, 'EMP-1088'],
    ['gdv:5:A', 'SCI', 'Water cycle poster', -12, -7, 'Closed', 0.85, 'EMP-1044'],
    ['gdv:5:A', 'MAT', 'Fractions worksheet 1', -21, -16, 'Closed', 0.9, 'EMP-1021'],
    ['gdv:5:A', 'CMP', 'Algorithm for making tea', -10, -5, 'Closed', 0.8, 'EMP-6003'],
    ['gdv:6:C', 'MAT', 'Ratio word problems', -9, -4, 'Closed', 0.75, 'EMP-1021'],
    ['gdv:7:A', 'MAT', 'Integers on a number line', -8, -3, 'Closed', 0.7, 'EMP-1021'],
  ];
  const subs: unknown[][] = [];
  for (const [sec, sub, title, aOff, dOff, status, share, teacher] of HW) {
    const r = await db.query(
      `INSERT INTO homework (section_id, subject_id, title, instructions, assigned_on, due_on, status, assigned_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [ctx.sections[sec], S[sub], title, `Complete "${title}" and submit before the due date.`, ctx.day(aOff), ctx.day(dOff), status, E[teacher], ctx.at(ctx.day(aOff), '15:10')],
    );
    const roster = ctx.students.filter((s) => s.sectionId === ctx.sections[sec]);
    const target = Math.round(roster.length * share);
    let n = 0;
    for (const s of roster) {
      const isReshma = s.admissionNo === 'HS-2026-1082';
      const willSubmit = isReshma ? (status === 'Closed' ? ctx.rand() < 0.4 : false) : n < target;
      if (!willSubmit) continue;
      n++;
      const late = status === 'Closed' && ctx.rand() < 0.12;
      const hi = Math.min(dOff, 0);
      const day = late ? addDays(ctx.day(dOff), 1) : ctx.day(ctx.int(Math.min(aOff + 1, hi), hi));
      const at = day === ctx.today
        ? ctx.at(day, `07:${String(ctx.int(10, 50)).padStart(2, '0')}`)
        : ctx.at(day, `${ctx.int(16, 20)}:${String(ctx.int(0, 59)).padStart(2, '0')}`);
      if (at > ctx.now) continue;
      subs.push([r.rows[0].id, s.id, at, late ? 'Late' : status === 'Closed' ? 'Reviewed' : 'Submitted', status === 'Closed' && !late ? 'Good work.' : null]);
    }
  }
  await bulkInsert(db, 'homework_submissions', ['homework_id', 'student_id', 'submitted_at', 'status', 'feedback'], subs);

  // ---- Question bank ---------------------------------------------------------------
  const qb: unknown[][] = [];
  for (const t of QUESTION_TOPICS) {
    for (let i = 0; i < t.items; i++) {
      const stem = t.stems[i % t.stems.length]
        .replace('{a}', String(2 + (i % 7))).replace('{b}', String(3 + (i % 9) * 2))
        .replace('{c}', String(4 + (i % 5) * 2)).replace('{d}', String(6 + (i % 9) * 4));
      const diff = t.difficulty[i % t.difficulty.length];
      const type = t.subject === 'PHY' ? (i % 3 === 0 ? 'numeric' : 'long') : i % 4 === 0 ? 'mcq' : 'short';
      qb.push([S[t.subject], t.topic, t.stage, `${stem} (Q${i + 1})`, type, diff, type === 'long' ? 4 : type === 'numeric' ? 3 : 2,
        i < t.used ? ctx.int(1, 6) : 0, i >= t.items - 2 ? 'Draft' : 'Approved', ctx.users.teacher]);
    }
  }
  await bulkInsert(db, 'question_bank', ['subject_id', 'topic', 'stage_label', 'question', 'question_type', 'difficulty', 'marks', 'times_used', 'status', 'created_by'], qb);

  // ---- Report cards ------------------------------------------------------------------
  const BATCHES: [string, number, number][] = [['gdv:5:A', 3, 9], ['gdv:5:B', 2, 9], ['gdv:6:A', 4, 7], ['gdv:9:A', 5, 1], ['gdv:10:B', 1, 13]];
  const records = (await db.query(
    `SELECT r.student_id, sub.name AS subject, r.score, r.score - COALESCE(p.score, r.score) AS trend
       FROM student_academic_records r
       JOIN subjects sub ON sub.id = r.subject_id
       LEFT JOIN student_academic_records p ON p.student_id = r.student_id AND p.subject_id = r.subject_id
            AND p.academic_year_id = r.academic_year_id AND p.term_order = r.term_order - 1
      WHERE r.academic_year_id = $1 AND r.term = 'Current'`, [ctx.yearId],
  )).rows;
  const bySt: Record<string, { subject: string; score: number; trend: number }[]> = {};
  for (const r of records) (bySt[r.student_id] ??= []).push({ subject: r.subject, score: Math.round(r.score), trend: Math.round(r.trend) });
  const ADITYA = 'Aditya has had a strong term. He is most confident when a task has a practical, building element — the applied measurement work lifted his Mathematics by six marks. His Tamil remains his strongest subject. Social Studies has slipped slightly; the weekly reading support started in August is the right response and should be continued next term. He works well with others and took a visible lead in the house assembly.';
  for (const [sec, stage, dueOff] of BATCHES) {
    const b = await db.query(
      `INSERT INTO report_card_batches (section_id, academic_year_id, term, stage, due_on, released_at, approved_by)
       VALUES ($1,$2,'Term 3',$3,$4,$5,$6) RETURNING id`,
      [ctx.sections[sec], ctx.yearId, stage, ctx.day(dueOff), stage === 5 ? ctx.at(ctx.day(-1), '17:30') : null, stage === 5 ? ctx.users.principal : null],
    );
    if (stage < 2) continue;
    const roster: SeedStudent[] = ctx.students.filter((s) => s.sectionId === ctx.sections[sec]);
    // Grade 5A: three drafts await the teacher (Aditya first, as in the wireframe).
    const drafts = sec === 'gdv:5:A' ? new Set(['HS-2026-1041', 'HS-2026-1082', 'HS-2026-1058']) : null;
    const rows = roster.map((s) => {
      const text = s.admissionNo === 'HS-2026-1041' ? ADITYA : draftReportComment(s.firstName, bySt[s.id] ?? [], { attendance: s.targetAttendance });
      const status = stage === 2 ? 'Draft' : drafts ? (drafts.has(s.admissionNo) ? 'Draft' : 'Approved') : 'Approved';
      return [b.rows[0].id, s.id, text, true, status, status === 'Approved' ? (sec === 'gdv:5:A' ? ctx.users.teacher : ctx.users.principal) : null];
    });
    await bulkInsert(db, 'report_card_comments', ['batch_id', 'student_id', 'comment', 'ai_drafted', 'status', 'reviewed_by'], rows);
  }
}
