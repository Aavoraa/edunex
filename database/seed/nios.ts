/**
 * NIOS syllabuses and learning outcomes — SAMPLE data for the NIOS board
 * (Senior Secondary). No demo class follows NIOS (see BOARD_CLASSES in core-org.ts),
 * so these have no sections until a class is moved to NIOS.
 *
 * Modules follow the general shape of the NIOS Senior Secondary self-learning
 * material for each subject; papers are the NIOS pattern of a theory paper plus
 * tutor-marked assignments (TMA, about 20%), with a practical for science. Everything
 * here is EDITABLE — check against the NIOS course material (migration 131's catalogue).
 * The NIOS grade scale (A–E) is inserted by migration 131.
 */
import type { Db, SeedContext } from './context.js';
import { seedBoardSyllabuses, type BoardSyllabusDef, type Comp, type Outcome } from './board-syllabus.js';

const THEORY_TMA: Comp[] = [['1', 'Theory paper', 180, 80, 80, 'written'], ['2', 'Tutor-marked assignment (TMA)', null, 20, 20, 'coursework']];
const SCIENCE: Comp[] = [['1', 'Theory paper', 180, 80, 64, 'written'], ['2', 'Practical', 120, 20, 16, 'practical'], ['3', 'Tutor-marked assignment (TMA)', null, 20, 20, 'coursework']];

const DEFS: BoardSyllabusDef[] = [
  {
    key: 'MAT11', subject: 'MAT', grade: 11, title: 'NIOS Mathematics (311) — Class XI', components: THEORY_TMA,
    topics: [
      [1, 'M1', 'Sets, Relations and Functions', 'Sets, relations, functions and trigonometric functions.', 24],
      [2, 'M2', 'Sequences and Series', 'Arithmetic and geometric progressions.', 12],
      [3, 'M3', 'Algebra I', 'Complex numbers, quadratic equations, permutations and combinations, binomial theorem.', 26],
      [4, 'M4', 'Coordinate Geometry', 'Straight lines, circles and conic sections.', 18],
      [5, 'M5', 'Statistics and Probability', 'Measures of dispersion and random experiments.', 14],
    ],
  },
  {
    key: 'MAT12', subject: 'MAT', grade: 12, title: 'NIOS Mathematics (311) — Class XII', components: THEORY_TMA,
    topics: [
      [1, 'M6', 'Algebra II', 'Matrices and determinants.', 16],
      [2, 'M7', 'Relations and Functions II', 'Inverse trigonometric functions.', 10],
      [3, 'M8', 'Calculus', 'Limits, differentiation, integration and differential equations.', 36],
      [4, 'M9', 'Vectors and Three-Dimensional Geometry', 'Vector algebra, lines and planes.', 16],
      [5, 'M10', 'Linear Programming', 'Formulating and solving LP problems graphically.', 8],
    ],
  },
  {
    key: 'PHY12', subject: 'PHY', grade: 12, title: 'NIOS Physics (312) — Class XII', components: SCIENCE,
    topics: [
      [1, 'M5', 'Electricity and Magnetism', 'Electrostatics, current electricity, magnetism and electromagnetic induction.', 30],
      [2, 'M6', 'Optics and Optical Instruments', 'Reflection, refraction, wave optics and instruments.', 20],
      [3, 'M7', 'Atoms and Nuclei', 'Structure of the atom, radioactivity and nuclear energy.', 14],
      [4, 'M8', 'Semiconductor Devices and Communication', 'Diodes, transistors and communication systems.', 14],
    ],
  },
];

const OUTCOMES: Outcome[] = [
  ['N11MA.01', 'Represents relations and functions and draws their graphs.', 'MAT', 'Class XI', 80, 64],
  ['N11MA.02', 'Solves problems on arithmetic and geometric progressions.', 'MAT', 'Class XI', 55, 40],
  ['N12MA.01', 'Differentiates and integrates standard functions.', 'MAT', 'Class XII', 50, 34],
  ['N12MA.02', 'Solves a linear programming problem graphically.', 'MAT', 'Class XII', 20, 10],
  ['N12PH.01', 'Applies Ohm’s and Kirchhoff’s laws to electric circuits.', 'PHY', 'Class XII', 65, 48],
  ['N12PH.02', 'Explains the working of a p–n junction diode.', 'PHY', 'Class XII', 30, 18],
];

export async function seed(db: Db, ctx: SeedContext) {
  await seedBoardSyllabuses(db, ctx, {
    board: 'nios', stage: 'NIOS', awardingBody: 'National Institute of Open Schooling (NIOS)', grading: 'A-E',
    notes: 'Modules follow the NIOS Senior Secondary self-learning material for this subject. Editable — check against the NIOS course material.',
    defs: DEFS, outcomes: OUTCOMES,
    links: [],
  });
}
