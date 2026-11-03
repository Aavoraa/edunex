/**
 * Tamil Nadu Matriculation syllabuses and learning outcomes — SAMPLE data for
 * the classes on the Matriculation board (Vadavalli Grades 6–9, see
 * BOARD_CLASSES in core-org.ts).
 *
 * Topics follow the general shape of the Tamil Nadu State Board (Samacheer
 * Kalvi) textbook units for each standard; papers are school examination
 * defaults (theory, plus practical for Science). Everything here is EDITABLE —
 * check units and marks against the textbooks and the school's scheme.
 * The Matriculation grade scale (A1–E2) is inserted by migration 125.
 */
import type { Db, SeedContext } from './context.js';
import { seedBoardSyllabuses, type BoardSyllabusDef, type Comp, type Outcome } from './board-syllabus.js';

const THEORY_100: Comp[] = [['1', 'Theory paper', 180, 100, 100, 'written']];
const SCIENCE: Comp[] = [['1', 'Theory paper', 150, 75, 75, 'written'], ['2', 'Practical', 60, 25, 25, 'practical']];
const TAMIL: Comp[] = [['1', 'Theory paper', 180, 100, 100, 'written']];

const DEFS: BoardSyllabusDef[] = [
  {
    key: 'MAT8', subject: 'MAT', grade: 8, title: 'Matriculation Mathematics — Std VIII', components: THEORY_100,
    topics: [
      [1, '1', 'Numbers', 'Rational numbers, operations and properties; square and cube roots.', 16],
      [2, '2', 'Measurements', 'Area and perimeter of combined shapes; surface area and volume of cubes and cuboids.', 14],
      [3, '3', 'Algebra', 'Algebraic expressions, identities, factorisation and linear equations in one variable.', 18],
      [4, '4', 'Life Mathematics', 'Percentage, profit and loss, simple and compound interest, direct and inverse proportion.', 16],
      [5, '5', 'Geometry', 'Congruent and similar triangles, construction of quadrilaterals.', 14],
      [6, '6', 'Statistics', 'Collection and organisation of data, frequency tables, bar graphs and pie charts.', 10],
      [7, '7', 'Information Processing', 'Patterns, puzzles and logical reasoning.', 8],
    ],
  },
  {
    key: 'SCI8', subject: 'SCI', grade: 8, title: 'Matriculation Science — Std VIII', components: SCIENCE,
    topics: [
      [1, '1', 'Measurement', 'SI units, derived quantities and accuracy in measurement.', 8],
      [2, '2', 'Force and Pressure', 'Pressure in solids, liquids and gases; friction.', 10],
      [3, '3', 'Light', 'Reflection, mirrors and the formation of images.', 10],
      [4, '4', 'Heat', 'Temperature, expansion and transfer of heat.', 8],
      [5, '5', 'Electricity', 'Electric charge, current and simple circuits.', 10],
      [6, '6', 'Matter', 'Elements, compounds and mixtures; separation of substances.', 10],
      [7, '7', 'Micro-organisms', 'Bacteria, fungi and viruses; useful and harmful micro-organisms.', 8],
    ],
  },
  {
    key: 'MAT9', subject: 'MAT', grade: 9, title: 'Matriculation Mathematics — Std IX', components: THEORY_100,
    topics: [
      [1, '1', 'Set Language', 'Sets, operations on sets and Venn diagrams.', 12],
      [2, '2', 'Real Number System', 'Rational and irrational numbers, surds and scientific notation.', 14],
      [3, '3', 'Algebra', 'Polynomials, factorisation and linear equations in two variables.', 20],
      [4, '4', 'Geometry', 'Quadrilaterals, circles and their properties.', 16],
      [5, '5', 'Coordinate Geometry', 'Distance formula, section formula and the cartesian plane.', 12],
      [6, '6', 'Trigonometry', 'Trigonometric ratios and their values for standard angles.', 12],
      [7, '7', 'Mensuration', 'Heron’s formula, surface area and volume of solids.', 12],
      [8, '8', 'Statistics', 'Mean, median and mode of grouped and ungrouped data.', 10],
      [9, '9', 'Probability', 'Experimental probability and simple events.', 8],
    ],
  },
  {
    key: 'SCI9', subject: 'SCI', grade: 9, title: 'Matriculation Science — Std IX', components: SCIENCE,
    topics: [
      [1, '1', 'Measurement', 'Units, measuring instruments and errors.', 8],
      [2, '2', 'Motion', 'Distance, displacement, speed, velocity and acceleration; equations of motion.', 12],
      [3, '3', 'Fluids', 'Pressure, buoyancy and Archimedes’ principle.', 10],
      [4, '4', 'Electric Charge and Electric Current', 'Charges, potential difference, Ohm’s law and circuits.', 12],
      [5, '5', 'Matter Around Us', 'States of matter, solutions and colloids.', 10],
      [6, '6', 'Atomic Structure', 'Atomic models, electrons, protons and neutrons.', 10],
      [7, '7', 'Organisation of Tissues', 'Plant and animal tissues.', 10],
      [8, '8', 'Plant Physiology', 'Transpiration, photosynthesis and respiration in plants.', 10],
    ],
  },
  {
    key: 'TAM9', subject: 'TAM', grade: 9, title: 'Matriculation Tamil — Std IX', components: TAMIL,
    topics: [
      [1, '1', 'இயல் 1 (Iyal 1) — Language (Mozhi)', 'Prose, poetry and grammar on the Tamil language.', 12],
      [2, '2', 'இயல் 2 (Iyal 2) — Nature (Iyarkai)', 'Prose, poetry and supplementary reading.', 12],
      [3, '3', 'இயல் 3 (Iyal 3) — Culture (Panpaadu)', 'Prose, poetry and grammar.', 12],
      [4, '4', 'இயல் 4 (Iyal 4) — Science and Technology', 'Prose, poetry and composition.', 12],
      [5, '5', 'இயல் 5 (Iyal 5) — Education (Kalvi)', 'Prose, poetry and letter writing.', 12],
      [6, '6', 'இயல் 6 (Iyal 6) — Arts (Kalai)', 'Prose, poetry and grammar.', 12],
    ],
  },
];

/** Matriculation learning outcomes — [code, outcome, subject, standard label, coverage %, mastery %]. */
const OUTCOMES: Outcome[] = [
  ['M8MA.01', 'Represents rational numbers on the number line and performs operations on them.', 'MAT', 'Std VIII', 85, 72],
  ['M8MA.02', 'Uses identities to expand and factorise algebraic expressions.', 'MAT', 'Std VIII', 60, 48],
  ['M8MA.03', 'Solves problems on simple and compound interest in daily-life situations.', 'MAT', 'Std VIII', 40, 30],
  ['M8SC.01', 'Explains how pressure in liquids and gases depends on depth and area.', 'SCI', 'Std VIII', 70, 58],
  ['M8SC.02', 'Identifies useful and harmful micro-organisms with examples.', 'SCI', 'Std VIII', 35, 25],
  ['M9MA.01', 'Uses set notation and Venn diagrams to represent relations between sets.', 'MAT', 'Std IX', 90, 76],
  ['M9MA.02', 'Classifies real numbers and simplifies surds.', 'MAT', 'Std IX', 75, 61],
  ['M9MA.03', 'Finds the distance between points and the coordinates of a dividing point.', 'MAT', 'Std IX', 30, 18],
  ['M9SC.01', 'Applies the equations of motion to solve numerical problems.', 'SCI', 'Std IX', 65, 50],
  ['M9SC.02', 'Uses Ohm’s law to calculate current, voltage and resistance in simple circuits.', 'SCI', 'Std IX', 45, 32],
  ['M9TA.01', 'Reads Tamil prose and poetry aloud with correct pronunciation and expression.', 'TAM', 'Std IX', 80, 70],
  ['M9TA.02', 'Writes a formal letter in Tamil using the correct format.', 'TAM', 'Std IX', 50, 38],
];

export async function seed(db: Db, ctx: SeedContext) {
  await seedBoardSyllabuses(db, ctx, {
    board: 'matriculation', stage: 'Matriculation', awardingBody: 'Tamil Nadu State Board (Samacheer Kalvi)', grading: 'A1-E2',
    notes: 'Units follow the Tamil Nadu State Board textbook for this standard. Editable — check against the current textbook.',
    defs: DEFS, outcomes: OUTCOMES,
    // The Matriculation quarterly exams mirror their theory papers.
    links: [['AS-3302', 'MAT8'], ['AS-3303', 'TAM9']],
  });
}
