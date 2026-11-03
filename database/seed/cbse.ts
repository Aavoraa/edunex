/**
 * CBSE syllabuses and learning outcomes — SAMPLE data for the classes on the
 * CBSE board (Pollachi Grades 6–9, see BOARD_CLASSES in core-org.ts).
 *
 * Units follow the general shape of the NCERT textbook chapters for each class;
 * papers are the usual CBSE split of a theory paper and internal assessment
 * (80 + 20). Everything here is EDITABLE — check chapters against the current
 * NCERT textbooks and the CBSE curriculum for the session.
 * The CBSE grade scale (A1–E) is inserted by migration 127.
 */
import type { Db, SeedContext } from './context.js';
import { seedBoardSyllabuses, type BoardSyllabusDef, type Comp, type Outcome } from './board-syllabus.js';

const THEORY_IA: Comp[] = [['1', 'Theory paper', 180, 80, 80, 'written'], ['2', 'Internal assessment', null, 20, 20, 'coursework']];

const DEFS: BoardSyllabusDef[] = [
  {
    key: 'MAT8', subject: 'MAT', grade: 8, title: 'CBSE Mathematics — Class VIII', components: THEORY_IA,
    topics: [
      [1, '1', 'Rational Numbers', 'Properties of rational numbers and their representation on the number line.', 10],
      [2, '2', 'Linear Equations in One Variable', 'Solving equations and word problems.', 12],
      [3, '3', 'Understanding Quadrilaterals', 'Polygons, angle sum property and kinds of quadrilaterals.', 10],
      [4, '4', 'Squares and Square Roots', 'Properties of square numbers, finding square roots.', 10],
      [5, '5', 'Comparing Quantities', 'Percentages, discounts, profit and loss, compound interest.', 12],
      [6, '6', 'Algebraic Expressions and Identities', 'Multiplication of expressions, standard identities.', 12],
      [7, '7', 'Mensuration', 'Area of polygons, surface area and volume of solids.', 12],
      [8, '8', 'Introduction to Graphs', 'Bar, pie and line graphs; plotting points.', 8],
    ],
  },
  {
    key: 'SCI8', subject: 'SCI', grade: 8, title: 'CBSE Science — Class VIII', components: THEORY_IA,
    topics: [
      [1, '1', 'Crop Production and Management', 'Agricultural practices, tools and storage.', 8],
      [2, '2', 'Microorganisms: Friend and Foe', 'Useful and harmful microorganisms, food preservation.', 8],
      [3, '3', 'Coal and Petroleum', 'Exhaustible resources and their conservation.', 6],
      [4, '4', 'Combustion and Flame', 'Conditions for combustion, structure of a flame, fuels.', 8],
      [5, '5', 'Force and Pressure', 'Contact and non-contact forces, pressure in fluids.', 10],
      [6, '6', 'Friction', 'Factors affecting friction, increasing and reducing it.', 8],
      [7, '7', 'Sound', 'Production and propagation of sound, noise pollution.', 8],
      [8, '8', 'Light', 'Laws of reflection, the human eye.', 10],
    ],
  },
  {
    key: 'MAT9', subject: 'MAT', grade: 9, title: 'CBSE Mathematics — Class IX', components: THEORY_IA,
    topics: [
      [1, '1', 'Number Systems', 'Real numbers, irrational numbers and laws of exponents.', 14],
      [2, '2', 'Polynomials', 'Zeroes, remainder and factor theorems, algebraic identities.', 14],
      [3, '3', 'Coordinate Geometry', 'The cartesian plane and plotting points.', 8],
      [4, '4', 'Linear Equations in Two Variables', 'Solutions and graphs of linear equations.', 10],
      [5, '5', 'Lines and Angles', 'Pairs of angles, parallel lines and a transversal.', 10],
      [6, '6', 'Triangles', 'Congruence of triangles and their properties.', 12],
      [7, '7', 'Quadrilaterals', 'Properties of parallelograms, mid-point theorem.', 10],
      [8, '8', 'Circles', 'Chords, angles subtended by arcs, cyclic quadrilaterals.', 12],
      [9, '9', 'Heron’s Formula', 'Area of a triangle from its sides.', 6],
      [10, '10', 'Surface Areas and Volumes', 'Cones, spheres and hemispheres.', 12],
      [11, '11', 'Statistics', 'Presentation of data, bar graphs, histograms and frequency polygons.', 8],
    ],
  },
  {
    key: 'SCI9', subject: 'SCI', grade: 9, title: 'CBSE Science — Class IX', components: THEORY_IA,
    topics: [
      [1, '1', 'Matter in Our Surroundings', 'States of matter and change of state.', 8],
      [2, '2', 'Is Matter Around Us Pure?', 'Mixtures, solutions, separation techniques.', 10],
      [3, '3', 'Atoms and Molecules', 'Laws of chemical combination, mole concept.', 10],
      [4, '4', 'Structure of the Atom', 'Atomic models, valency, isotopes.', 10],
      [5, '5', 'The Fundamental Unit of Life', 'Cell structure and organelles.', 10],
      [6, '6', 'Tissues', 'Plant and animal tissues.', 10],
      [7, '7', 'Motion', 'Distance, displacement, velocity, acceleration, graphs of motion.', 12],
      [8, '8', 'Force and Laws of Motion', 'Newton’s laws, momentum and its conservation.', 12],
      [9, '9', 'Gravitation', 'Universal law of gravitation, free fall, buoyancy.', 10],
      [10, '10', 'Work and Energy', 'Work, kinetic and potential energy, power.', 10],
    ],
  },
];

const OUTCOMES: Outcome[] = [
  ['C8MA.01', 'Solves word problems using linear equations in one variable.', 'MAT', 'Class VIII', 80, 66],
  ['C8MA.02', 'Calculates compound interest and discounts in daily-life contexts.', 'MAT', 'Class VIII', 55, 40],
  ['C8SC.01', 'Explains the conditions needed for combustion and the zones of a flame.', 'SCI', 'Class VIII', 70, 55],
  ['C8SC.02', 'Describes how friction can be increased or reduced, with examples.', 'SCI', 'Class VIII', 40, 28],
  ['C9MA.01', 'Represents irrational numbers on the number line and applies laws of exponents.', 'MAT', 'Class IX', 88, 74],
  ['C9MA.02', 'Uses the factor theorem to factorise polynomials.', 'MAT', 'Class IX', 65, 50],
  ['C9MA.03', 'Applies congruence criteria to prove properties of triangles.', 'MAT', 'Class IX', 35, 22],
  ['C9SC.01', 'Separates the components of a mixture using a suitable technique.', 'SCI', 'Class IX', 75, 60],
  ['C9SC.02', 'Uses Newton’s laws of motion to explain everyday situations.', 'SCI', 'Class IX', 50, 36],
  ['C9SC.03', 'Calculates work done and kinetic and potential energy.', 'SCI', 'Class IX', 20, 12],
];

export async function seed(db: Db, ctx: SeedContext) {
  await seedBoardSyllabuses(db, ctx, {
    board: 'cbse', stage: 'CBSE', awardingBody: 'Central Board of Secondary Education (NCERT textbooks)', grading: 'A1-E',
    notes: 'Units follow the NCERT textbook chapters for this class. Editable — check against the current NCERT textbook and CBSE curriculum.',
    defs: DEFS, outcomes: OUTCOMES,
    // The CBSE periodic tests mirror their theory papers.
    links: [['AS-3304', 'MAT9'], ['AS-3305', 'SCI8']],
  });
}
