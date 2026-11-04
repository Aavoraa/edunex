/**
 * ICSE syllabuses and learning outcomes — SAMPLE data for the classes on the
 * ICSE board (Vadavalli Grades 1–5, see BOARD_CLASSES in core-org.ts).
 *
 * CISCE publishes syllabuses for the ICSE examination (Classes IX–X, migration
 * 130's catalogue); for Classes I–V schools follow their own scheme of work with
 * CISCE-recommended books, so these units are a school-defined sample. Papers are
 * school examination defaults (theory plus internal assessment). Everything here
 * is EDITABLE. The ICSE grade scale (A+–E) is inserted by migration 130.
 */
import type { Db, SeedContext } from './context.js';
import { seedBoardSyllabuses, type BoardSyllabusDef, type Comp, type Outcome } from './board-syllabus.js';

const TERM_EXAM: Comp[] = [['1', 'Written examination', 120, 80, 80, 'written'], ['2', 'Internal assessment', null, 20, 20, 'coursework']];

const DEFS: BoardSyllabusDef[] = [
  {
    key: 'MAT4', subject: 'MAT', grade: 4, title: 'ICSE Mathematics — Class IV', components: TERM_EXAM,
    topics: [
      [1, '1', 'Numbers up to 1,00,000', 'Place value, comparing and ordering, rounding.', 10],
      [2, '2', 'Addition and Subtraction', 'Word problems with carrying and borrowing.', 10],
      [3, '3', 'Multiplication and Division', 'Tables, long multiplication and division.', 14],
      [4, '4', 'Factors and Multiples', 'Tests of divisibility, HCF and LCM.', 8],
      [5, '5', 'Fractions', 'Equivalent fractions, adding and subtracting like fractions.', 10],
      [6, '6', 'Measurement', 'Length, mass, capacity and time.', 10],
      [7, '7', 'Geometry', 'Lines, angles and simple shapes.', 8],
    ],
  },
  {
    key: 'MAT5', subject: 'MAT', grade: 5, title: 'ICSE Mathematics — Class V', components: TERM_EXAM,
    topics: [
      [1, '1', 'Large Numbers', 'Indian and international place value systems.', 8],
      [2, '2', 'Operations on Numbers', 'BODMAS and word problems.', 10],
      [3, '3', 'Fractions and Decimals', 'Operations on fractions and decimals.', 14],
      [4, '4', 'Percentage', 'Converting between fractions, decimals and percentages.', 8],
      [5, '5', 'Perimeter and Area', 'Rectangles, squares and composite shapes.', 10],
      [6, '6', 'Angles and Triangles', 'Measuring angles, kinds of triangles.', 8],
      [7, '7', 'Data Handling', 'Pictographs and bar graphs.', 6],
    ],
  },
  {
    key: 'SCI5', subject: 'SCI', grade: 5, title: 'ICSE Science — Class V', components: TERM_EXAM,
    topics: [
      [1, '1', 'Plants and Their Parts', 'Roots, stems, leaves and photosynthesis.', 8],
      [2, '2', 'Animals and Their Habitats', 'Adaptations and food chains.', 8],
      [3, '3', 'The Human Body', 'Skeletal and muscular systems.', 8],
      [4, '4', 'Food and Health', 'Nutrients, balanced diet and hygiene.', 6],
      [5, '5', 'Matter and Materials', 'Solids, liquids, gases and changes of state.', 8],
      [6, '6', 'Force and Simple Machines', 'Levers, pulleys and inclined planes.', 8],
      [7, '7', 'Our Solar System', 'The Sun, the planets and the Moon.', 6],
    ],
  },
  {
    key: 'ENG5', subject: 'ENG', grade: 5, title: 'ICSE English — Class V', components: TERM_EXAM,
    topics: [
      [1, '1', 'Reading Comprehension', 'Prose and poetry from the class reader.', 12],
      [2, '2', 'Grammar — Parts of Speech', 'Nouns, pronouns, verbs, adjectives and adverbs.', 10],
      [3, '3', 'Tenses', 'Simple, continuous and perfect tenses.', 8],
      [4, '4', 'Composition', 'Paragraphs, stories and informal letters.', 10],
      [5, '5', 'Vocabulary', 'Synonyms, antonyms and word building.', 6],
    ],
  },
];

const OUTCOMES: Outcome[] = [
  ['I4MA.01', 'Reads, writes and compares numbers up to 1,00,000 using place value.', 'MAT', 'Class IV', 85, 74],
  ['I4MA.02', 'Finds the HCF and LCM of small numbers.', 'MAT', 'Class IV', 45, 32],
  ['I5MA.01', 'Adds, subtracts and multiplies decimals in real-life contexts.', 'MAT', 'Class V', 70, 56],
  ['I5MA.02', 'Calculates the perimeter and area of composite shapes.', 'MAT', 'Class V', 40, 28],
  ['I5SC.01', 'Explains how a lever, pulley or inclined plane makes work easier.', 'SCI', 'Class V', 55, 42],
  ['I5SC.02', 'Describes the planets of the solar system in order.', 'SCI', 'Class V', 30, 20],
  ['I5EN.01', 'Writes an informal letter with the correct format and tone.', 'ENG', 'Class V', 60, 47],
];

export async function seed(db: Db, ctx: SeedContext) {
  await seedBoardSyllabuses(db, ctx, {
    board: 'icse', stage: 'ICSE', awardingBody: 'Council for the Indian School Certificate Examinations (CISCE)', grading: 'A+-E',
    notes: 'School scheme of work for this class on the ICSE board. Editable — CISCE publishes the examination syllabuses for Classes IX–X.',
    defs: DEFS, outcomes: OUTCOMES,
    // The ICSE unit tests mirror their written papers.
    links: [['AS-3309', 'MAT5'], ['AS-3310', 'SCI5']],
  });
}
