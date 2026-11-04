/**
 * Grading — pure helpers shared by the API, the seed and the migration
 * defaults (no database access here).
 *
 * Every class follows one board, and each board has its own grade scale:
 *   - Cambridge IGCSE (igcse): the classic letters A* to G, with U (ungraded)
 *     below G. Grades 9–10 follow IGCSE syllabuses; lower grades follow
 *     Cambridge Primary / Lower Secondary but report on the same letters.
 *   - Tamil Nadu Matriculation (matriculation): nine-point A1–E2 grades in the
 *     CCE style of Tamil Nadu State Board / Matriculation schools; D starts at
 *     35%, the Tamil Nadu pass mark.
 *   - CBSE (cbse): eight-point A1–E grades; D starts at 33%, the CBSE pass mark.
 *   - ICSE (icse): CISCE reports marks; an indicative A+–E school scale with D
 *     from 33%, the CISCE pass mark.
 *   - NIOS (nios): NIOS reports marks; an indicative A–E scale in division bands
 *     with D from 33%, the NIOS pass mark.
 *   - IB Diploma Programme (ib): subject grades 7 to 1; a diploma needs 24 of 45
 *     points. Indicative percentage boundaries (the IB sets them per session).
 *
 * The percentage boundaries are indicative school defaults. They live in the
 * database (grade_boundaries, migrations 115 and 125) and can be edited by
 * grading.manage users; the constants below are only the fallback when the
 * database scale is unavailable.
 */

export type Tier = 'Core' | 'Extended';

export const BOARDS = ['igcse', 'matriculation', 'cbse', 'icse', 'nios', 'ib'] as const;
/** Boards whose syllabuses come from a board catalogue (migrations 128, 130). */
export const CATALOGUE_BOARDS = ['matriculation', 'cbse', 'icse', 'nios', 'ib'] as const;
export type Board = (typeof BOARDS)[number];
export const DEFAULT_BOARD: Board = 'igcse';

export function isBoard(v: unknown): v is Board {
  return typeof v === 'string' && (BOARDS as readonly string[]).includes(v);
}

export interface GradeBoundary {
  grade: string;
  minPercent: number;
  points: number;
  description: string | null;
  tone: string | null;
  sortOrder: number;
}

export interface TierRule {
  /** Best grade available on this tier (Core is capped at C). */
  highest: string;
  /** Lowest grade awarded on this tier; anything below is U. */
  lowest: string;
}

export interface GradeScale {
  id: string | null;
  key: string;
  board: Board;
  boardName: string;
  name: string;
  description: string | null;
  boundaries: GradeBoundary[];
  /** Core / Extended rules; empty for an untiered board (Matriculation). */
  tierRules: Partial<Record<Tier, TierRule>>;
  /** Performance bands: above expectation = this grade or better; at expectation = `at`. */
  expectation: { above: string; at: string };
  updatedAt: string | null;
  updatedBy: string | null;
}

export const DEFAULT_SCALE_KEY = 'cambridge_igcse_a_star_g';

/** Defaults — must match the rows inserted by database/migrations/115_cambridge_igcse.sql. */
export const DEFAULT_BOUNDARIES: GradeBoundary[] = [
  { grade: 'A*', minPercent: 90, points: 8, description: 'Exceptional', tone: 'success', sortOrder: 1 },
  { grade: 'A', minPercent: 80, points: 7, description: 'Excellent', tone: 'success', sortOrder: 2 },
  { grade: 'B', minPercent: 70, points: 6, description: 'Very good', tone: 'info', sortOrder: 3 },
  { grade: 'C', minPercent: 60, points: 5, description: 'Good', tone: 'info', sortOrder: 4 },
  { grade: 'D', minPercent: 50, points: 4, description: 'Satisfactory', tone: 'neutral', sortOrder: 5 },
  { grade: 'E', minPercent: 40, points: 3, description: 'Pass', tone: 'warning', sortOrder: 6 },
  { grade: 'F', minPercent: 30, points: 2, description: 'Weak pass', tone: 'warning', sortOrder: 7 },
  { grade: 'G', minPercent: 20, points: 1, description: 'Minimal pass', tone: 'critical', sortOrder: 8 },
  { grade: 'U', minPercent: 0, points: 0, description: 'Ungraded', tone: 'critical', sortOrder: 9 },
];

export const DEFAULT_TIER_RULES: Record<Tier, TierRule> = {
  Core: { highest: 'C', lowest: 'G' },
  Extended: { highest: 'A*', lowest: 'E' },
};

export const DEFAULT_SCALE: GradeScale = {
  id: null,
  key: DEFAULT_SCALE_KEY,
  board: 'igcse',
  boardName: 'Cambridge IGCSE',
  name: 'Cambridge IGCSE (A* to G)',
  description: 'Classic Cambridge IGCSE letter grades A* to G, with U below G. Indicative percentage boundaries — Cambridge sets component thresholds for each exam series.',
  boundaries: DEFAULT_BOUNDARIES,
  tierRules: DEFAULT_TIER_RULES,
  expectation: { above: 'B', at: 'C' },
  updatedAt: null,
  updatedBy: null,
};

export const MATRICULATION_SCALE_KEY = 'tn_matriculation_a1_e2';

/** Matriculation defaults — must match the rows inserted by database/migrations/125_tn_matriculation_board.sql. */
export const MATRICULATION_BOUNDARIES: GradeBoundary[] = [
  { grade: 'A1', minPercent: 91, points: 10, description: 'Outstanding', tone: 'success', sortOrder: 1 },
  { grade: 'A2', minPercent: 81, points: 9, description: 'Excellent', tone: 'success', sortOrder: 2 },
  { grade: 'B1', minPercent: 71, points: 8, description: 'Very good', tone: 'info', sortOrder: 3 },
  { grade: 'B2', minPercent: 61, points: 7, description: 'Good', tone: 'info', sortOrder: 4 },
  { grade: 'C1', minPercent: 51, points: 6, description: 'Above average', tone: 'neutral', sortOrder: 5 },
  { grade: 'C2', minPercent: 41, points: 5, description: 'Average', tone: 'neutral', sortOrder: 6 },
  { grade: 'D', minPercent: 35, points: 4, description: 'Pass', tone: 'warning', sortOrder: 7 },
  { grade: 'E1', minPercent: 21, points: 0, description: 'Below pass — needs improvement', tone: 'critical', sortOrder: 8 },
  { grade: 'E2', minPercent: 0, points: 0, description: 'Below pass — needs support', tone: 'critical', sortOrder: 9 },
];

export const MATRICULATION_SCALE: GradeScale = {
  id: null,
  key: MATRICULATION_SCALE_KEY,
  board: 'matriculation',
  boardName: 'Tamil Nadu Matriculation',
  name: 'Tamil Nadu Matriculation (A1 to E2)',
  description: 'Nine-point A1–E2 grades in the CCE style used by Tamil Nadu State Board and Matriculation schools. D starts at 35%, the Tamil Nadu pass mark; E1 and E2 are below the pass mark. Indicative school boundaries.',
  boundaries: MATRICULATION_BOUNDARIES,
  tierRules: {},
  expectation: { above: 'B1', at: 'B2' },
  updatedAt: null,
  updatedBy: null,
};

export const CBSE_SCALE_KEY = 'cbse_a1_e';

/** CBSE defaults — must match the rows inserted by database/migrations/127_cbse_board.sql. */
export const CBSE_BOUNDARIES: GradeBoundary[] = [
  { grade: 'A1', minPercent: 91, points: 10, description: 'Outstanding', tone: 'success', sortOrder: 1 },
  { grade: 'A2', minPercent: 81, points: 9, description: 'Excellent', tone: 'success', sortOrder: 2 },
  { grade: 'B1', minPercent: 71, points: 8, description: 'Very good', tone: 'info', sortOrder: 3 },
  { grade: 'B2', minPercent: 61, points: 7, description: 'Good', tone: 'info', sortOrder: 4 },
  { grade: 'C1', minPercent: 51, points: 6, description: 'Above average', tone: 'neutral', sortOrder: 5 },
  { grade: 'C2', minPercent: 41, points: 5, description: 'Average', tone: 'neutral', sortOrder: 6 },
  { grade: 'D', minPercent: 33, points: 4, description: 'Pass', tone: 'warning', sortOrder: 7 },
  { grade: 'E', minPercent: 0, points: 0, description: 'Below pass — needs improvement', tone: 'critical', sortOrder: 8 },
];

export const CBSE_SCALE: GradeScale = {
  id: null,
  key: CBSE_SCALE_KEY,
  board: 'cbse',
  boardName: 'CBSE',
  name: 'CBSE (A1 to E)',
  description: 'Eight-point A1–E grades in the CBSE style. D starts at 33%, the CBSE pass mark; E is below the pass mark (needs improvement). Indicative school boundaries.',
  boundaries: CBSE_BOUNDARIES,
  tierRules: {},
  expectation: { above: 'B1', at: 'B2' },
  updatedAt: null,
  updatedBy: null,
};

export const ICSE_SCALE_KEY = 'icse_a_plus_e';

/** ICSE defaults — must match the rows inserted by database/migrations/130_icse_board.sql. */
export const ICSE_BOUNDARIES: GradeBoundary[] = [
  { grade: 'A+', minPercent: 90, points: 10, description: 'Outstanding', tone: 'success', sortOrder: 1 },
  { grade: 'A', minPercent: 80, points: 9, description: 'Excellent', tone: 'success', sortOrder: 2 },
  { grade: 'B+', minPercent: 70, points: 8, description: 'Very good', tone: 'info', sortOrder: 3 },
  { grade: 'B', minPercent: 60, points: 7, description: 'Good', tone: 'info', sortOrder: 4 },
  { grade: 'C+', minPercent: 50, points: 6, description: 'Above average', tone: 'neutral', sortOrder: 5 },
  { grade: 'C', minPercent: 40, points: 5, description: 'Average', tone: 'neutral', sortOrder: 6 },
  { grade: 'D', minPercent: 33, points: 4, description: 'Pass', tone: 'warning', sortOrder: 7 },
  { grade: 'E', minPercent: 0, points: 0, description: 'Below pass — needs improvement', tone: 'critical', sortOrder: 8 },
];

export const ICSE_SCALE: GradeScale = {
  id: null,
  key: ICSE_SCALE_KEY,
  board: 'icse',
  boardName: 'ICSE',
  name: 'ICSE (A+ to E)',
  description: 'Indicative school grades for ICSE classes. CISCE reports ICSE results as marks with a 33% pass mark in each subject and in aggregate; D starts at 33% and E is below the pass mark.',
  boundaries: ICSE_BOUNDARIES,
  tierRules: {},
  expectation: { above: 'B+', at: 'B' },
  updatedAt: null,
  updatedBy: null,
};

export const NIOS_SCALE_KEY = 'nios_a_e';

/** NIOS defaults — must match the rows inserted by database/migrations/131_nios_board.sql. */
export const NIOS_BOUNDARIES: GradeBoundary[] = [
  { grade: 'A', minPercent: 75, points: 4, description: 'Distinction', tone: 'success', sortOrder: 1 },
  { grade: 'B', minPercent: 60, points: 3, description: 'First division', tone: 'info', sortOrder: 2 },
  { grade: 'C', minPercent: 45, points: 2, description: 'Second division', tone: 'neutral', sortOrder: 3 },
  { grade: 'D', minPercent: 33, points: 1, description: 'Pass', tone: 'warning', sortOrder: 4 },
  { grade: 'E', minPercent: 0, points: 0, description: 'Below pass — needs improvement', tone: 'critical', sortOrder: 5 },
];

export const NIOS_SCALE: GradeScale = {
  id: null,
  key: NIOS_SCALE_KEY,
  board: 'nios',
  boardName: 'NIOS',
  name: 'NIOS (A to E)',
  description: 'Indicative school grades for NIOS learners in division bands. NIOS reports results as marks; a subject is passed with 33%, so D starts at 33% and E is below the pass mark.',
  boundaries: NIOS_BOUNDARIES,
  tierRules: {},
  expectation: { above: 'B', at: 'C' },
  updatedAt: null,
  updatedBy: null,
};

export const IB_SCALE_KEY = 'ib_dp_7_1';

/** IB defaults — must match the rows inserted by database/migrations/132_ib_board.sql. */
export const IB_BOUNDARIES: GradeBoundary[] = [
  { grade: '7', minPercent: 80, points: 7, description: 'Excellent', tone: 'success', sortOrder: 1 },
  { grade: '6', minPercent: 70, points: 6, description: 'Very good', tone: 'success', sortOrder: 2 },
  { grade: '5', minPercent: 60, points: 5, description: 'Good', tone: 'info', sortOrder: 3 },
  { grade: '4', minPercent: 50, points: 4, description: 'Satisfactory', tone: 'info', sortOrder: 4 },
  { grade: '3', minPercent: 40, points: 3, description: 'Mediocre', tone: 'neutral', sortOrder: 5 },
  { grade: '2', minPercent: 30, points: 2, description: 'Poor', tone: 'warning', sortOrder: 6 },
  { grade: '1', minPercent: 0, points: 1, description: 'Very poor', tone: 'critical', sortOrder: 7 },
];

export const IB_SCALE: GradeScale = {
  id: null,
  key: IB_SCALE_KEY,
  board: 'ib',
  boardName: 'IB',
  name: 'IB Diploma Programme (7 to 1)',
  description: 'IB DP subject grades 7 (excellent) to 1 (very poor). A diploma needs 24 of 45 points and no grade below 2. The IB sets grade boundaries per subject and session; these percentages are indicative school boundaries.',
  boundaries: IB_BOUNDARIES,
  tierRules: {},
  expectation: { above: '6', at: '5' },
  updatedAt: null,
  updatedBy: null,
};

/** Built-in scale per board (fallback when the database scale is unavailable). */
export const DEFAULT_SCALES: Record<Board, GradeScale> = { igcse: DEFAULT_SCALE, matriculation: MATRICULATION_SCALE, cbse: CBSE_SCALE, icse: ICSE_SCALE, nios: NIOS_SCALE, ib: IB_SCALE };

/** Cambridge IGCSE grade letters best → worst (A*, A, … G, U). */
export const GRADE_ORDER = DEFAULT_BOUNDARIES.map((b) => b.grade);

/** Boundaries best → worst. */
export function ordered(scale: Pick<GradeScale, 'boundaries'>) {
  return [...scale.boundaries].sort((a, b) => a.sortOrder - b.sortOrder || b.minPercent - a.minPercent);
}

/**
 * Letter grade for a percentage on a scale. With a tier, Cambridge tier rules
 * apply: Extended entries are graded A*–E (below E is U); Core entries are
 * graded C–G and capped at C (below G is U).
 */
export function gradeFromScale(scale: Pick<GradeScale, 'boundaries' | 'tierRules'>, percent: number, tier?: Tier | null): string {
  const list = ordered(scale);
  if (!list.length) return 'U';
  const ungraded = list[list.length - 1];
  const pct = Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0;
  // A tiny tolerance so 59.9999999 (float noise from marks/max) is not pushed down a grade.
  let idx = list.findIndex((b) => pct + 1e-9 >= Number(b.minPercent));
  if (idx < 0) idx = list.length - 1;
  const rule = tier ? scale.tierRules?.[tier] : undefined;
  if (rule) {
    const hi = list.findIndex((b) => b.grade === rule.highest);
    const lo = list.findIndex((b) => b.grade === rule.lowest);
    if (hi >= 0 && idx < hi) idx = hi;
    if (lo >= 0 && idx > lo) return ungraded.grade;
  }
  return list[idx].grade;
}

/** Sync grade on a board's default scale — the fallback used by the seed and pure helpers. */
export function defaultGradeFor(percent: number, tier?: Tier | null, board: Board = DEFAULT_BOARD) {
  return gradeFromScale(DEFAULT_SCALES[board], percent, board === 'igcse' ? tier : null);
}

/** Minimum percent for a grade on a scale (null when the grade is not on it). */
export function minPercentFor(scale: Pick<GradeScale, 'boundaries'>, grade: string) {
  const b = scale.boundaries.find((x) => x.grade === grade);
  return b ? Number(b.minPercent) : null;
}

/**
 * General subject categories, common to every board — must match the CHECK in
 * database/migrations/129_subject_categories.sql.
 */
export const SUBJECT_CATEGORIES = [
  'Languages', 'Mathematics', 'Science', 'Social Science', 'Environmental & Integrated Studies',
  'Commerce & Accounts', 'Computer Science', 'Arts & Music', 'Physical Education & Health', 'Vocational', 'Other',
] as const;
export type SubjectCategory = (typeof SUBJECT_CATEGORIES)[number];

/**
 * Best general category for a subject name (e.g. a board-catalogue subject such as
 * "Tamil & English" → Languages, "Bio-Botany" → Science). `group` is the
 * catalogue's own grouping (Languages, Vocational …) when there is one.
 */
export function guessSubjectCategory(name: string, group?: string | null): SubjectCategory {
  const n = name.toLowerCase();
  const g = (group ?? '').toLowerCase();
  if (/evs|maths, science|science & social|maths & /.test(n)) return 'Environmental & Integrated Studies';
  if (g === 'languages' || /reader|english|tamil|hindi|sanskrit|urdu|arabic|french|german|telugu|kannada|malayalam|language/.test(n)) return 'Languages';
  if (/accountancy|commerce|business|book keeping|entrepreneur|auditing|office management|financial|banking/.test(n)) return 'Commerce & Accounts';
  if (/math|statistic/.test(n)) return 'Mathematics';
  if (/computer|computing|informatics|artificial intelligence|data science|information technology|\bict\b/.test(n)) return 'Computer Science';
  if (/physical education|health|well being|ncc|cadet|yoga|sport/.test(n)) return 'Physical Education & Health';
  if (/music|carnatic|hindustani|painting|dance|fine arts|art education|art and design|graphics|drawing/.test(n)) return 'Arts & Music';
  if (g === 'vocational' || /engineering|nursing|textile|food|agricultur|employability|nutrition|home science|work experience|dress/.test(n)) return 'Vocational';
  if (/theory of knowledge|extended essay|creativity, activity/.test(n)) return 'Other';
  if (/physics|chemistry|biology|botany|zoology|bio-|micro ?biology|biotechnology|science/.test(n)) return 'Science';
  if (/social|history|geography|political|politics|economics|sociology|psychology|anthropology|philosophy|religions|legal|law|ethics|knowledge tradition|civics|culture|heritage|military|digital society/.test(n)) return 'Social Science';
  if (/^language |literature|ab initio|classical languages/.test(n)) return 'Languages';
  if (/film|theatre|visual arts|design technology/.test(n)) return 'Arts & Music';
  return 'Other';
}
