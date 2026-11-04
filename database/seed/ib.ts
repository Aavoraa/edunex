/**
 * IB Diploma Programme syllabuses and learning outcomes — SAMPLE data for the
 * classes on the IB board (Guduvanchery Grades 11–12, see BOARD_CLASSES in core-org.ts).
 *
 * DP courses run over two years (Grades 11–12), so each syllabus covers both.
 * Topics follow the general shape of each DP subject guide; components are the
 * usual SL pattern of external papers plus internal assessment. Everything here is
 * EDITABLE — check against the current IB subject guide. The IB grade scale (7–1)
 * is inserted by migration 132.
 */
import type { Db, SeedContext } from './context.js';
import { seedBoardSyllabuses, type BoardSyllabusDef, type Outcome } from './board-syllabus.js';

const DEFS: BoardSyllabusDef[] = [
  {
    key: 'MATAA', subject: 'MAT', grade: 11, grades: [11, 12], catalogueSubject: 'Mathematics: analysis and approaches',
    title: 'IB DP Mathematics: Analysis and Approaches SL — Grades 11–12',
    components: [['1', 'Paper 1 (no calculator)', 90, 80, 40, 'written'], ['2', 'Paper 2 (calculator)', 90, 80, 40, 'written'], ['IA', 'Internal assessment — mathematical exploration', null, 20, 20, 'coursework']],
    topics: [
      [1, '1', 'Number and algebra', 'Sequences and series, exponents and logarithms, binomial theorem.', 19],
      [2, '2', 'Functions', 'Graphs, transformations, quadratic, rational, exponential and logarithmic functions.', 21],
      [3, '3', 'Geometry and trigonometry', 'Volume and surface area, trigonometric ratios, identities and equations.', 25],
      [4, '4', 'Statistics and probability', 'Descriptive statistics, regression, probability and distributions.', 27],
      [5, '5', 'Calculus', 'Differentiation, integration and kinematics.', 28],
    ],
  },
  {
    key: 'PHY', subject: 'PHY', grade: 11, grades: [11, 12], catalogueSubject: 'Physics',
    title: 'IB DP Physics SL — Grades 11–12',
    components: [['1', 'Paper 1 (multiple choice and data)', 90, 45, 36, 'written'], ['2', 'Paper 2', 90, 50, 44, 'written'], ['IA', 'Internal assessment — scientific investigation', null, 24, 20, 'practical']],
    topics: [
      [1, 'A', 'Space, time and motion', 'Kinematics, forces and momentum, work, energy and power.', 27],
      [2, 'B', 'The particulate nature of matter', 'Thermal energy transfers, greenhouse effect, gas laws, current and circuits.', 24],
      [3, 'C', 'Wave behaviour', 'Simple harmonic motion, wave model, wave phenomena, standing waves.', 17],
      [4, 'D', 'Fields', 'Gravitational, electric and magnetic fields; motion in fields.', 19],
      [5, 'E', 'Nuclear and quantum physics', 'Structure of the atom, radioactive decay, fission and fusion.', 23],
    ],
  },
  {
    key: 'ENGA', subject: 'ENG', grade: 11, grades: [11, 12], catalogueSubject: 'Language A: language and literature',
    title: 'IB DP English A: Language and Literature SL — Grades 11–12',
    components: [['1', 'Paper 1 — guided textual analysis', 75, 20, 35, 'written'], ['2', 'Paper 2 — comparative essay', 105, 30, 35, 'written'], ['IO', 'Individual oral', 15, 40, 30, 'oral']],
    topics: [
      [1, '1', 'Readers, writers and texts', 'How texts are produced and received; non-literary text types.', 50],
      [2, '2', 'Time and space', 'Texts in their historical and cultural contexts.', 50],
      [3, '3', 'Intertextuality: connecting texts', 'Comparing texts across forms, genres and periods.', 50],
    ],
  },
];

const OUTCOMES: Outcome[] = [
  ['IB11MA.01', 'Uses arithmetic and geometric sequences and series in real-life contexts.', 'MAT', 'Grade 11', 85, 70],
  ['IB11MA.02', 'Models situations with exponential and logarithmic functions.', 'MAT', 'Grade 11', 60, 45],
  ['IB12MA.01', 'Applies differentiation to optimisation and kinematics problems.', 'MAT', 'Grade 12', 45, 30],
  ['IB11PH.01', 'Analyses motion with the equations of uniformly accelerated motion.', 'PHY', 'Grade 11', 80, 66],
  ['IB12PH.01', 'Describes gravitational, electric and magnetic fields with field lines and potentials.', 'PHY', 'Grade 12', 40, 26],
  ['IB11EN.01', 'Analyses how a non-literary text shapes its audience’s response.', 'ENG', 'Grade 11', 70, 54],
];

export async function seed(db: Db, ctx: SeedContext) {
  await seedBoardSyllabuses(db, ctx, {
    board: 'ib', stage: 'IB DP', awardingBody: 'International Baccalaureate (IB)', grading: '7-1',
    notes: 'Two-year Diploma Programme course. Topics and components are editable defaults — check them against the current IB subject guide.',
    defs: DEFS, outcomes: OUTCOMES,
    // The internal-assessment draft and Paper 1 practice mirror their components.
    links: [['AS-3313', 'MATAA'], ['AS-3314', 'PHY']],
  });
}
