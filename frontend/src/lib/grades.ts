/**
 * Grading for the web app — the single place the UI turns a percentage into a
 * letter and picks a grade's colour. Every class follows a board, each with
 * its own scale: Cambridge IGCSE (A* to G, U below G), Tamil Nadu
 * Matriculation (A1 to E2) or CBSE (A1 to E).
 *
 * A board's scale comes from GET /grading/scale?board= (editable boundaries);
 * the defaults below mirror backend/src/services/grading-shared.ts and are
 * only used until the scale has loaded or if it cannot be fetched.
 */
import { useApiQuery } from '@/hooks/useApi';

export type Tier = 'Core' | 'Extended';
export type Board = 'igcse' | 'matriculation' | 'cbse';

export interface BoardInfo {
  id: Board;
  label: string;
  short: string;
  /** Prefix of the board's menu entries ("Matric Syllabus"). */
  menu: string;
  /** Letters of its scale, best to worst. */
  range: string;
  /** Pass mark in percent (IGCSE has none: below the lowest grade is U). */
  passMark: number | null;
  /** How the board names a year group: Grade 9, Std IX, Class IX. */
  level: 'Grade' | 'Std' | 'Class';
  stage: string;
  awardingBody: string;
  /** Textbooks a syllabus follows (non-IGCSE boards). */
  textbook: string;
  /** Example learning-outcome code. */
  outcomeCode: string;
  routes: { outcomes: string; syllabus: string; grading: string; assessments: string };
}

/** Every board the school can run, with the wording and screens each one uses. */
export const BOARD_INFO: Record<Board, BoardInfo> = {
  igcse: {
    id: 'igcse', label: 'Cambridge IGCSE', short: 'IGCSE', menu: 'IGCSE', range: 'A*–G, U', passMark: null, level: 'Grade',
    stage: 'IGCSE', awardingBody: 'Cambridge International', textbook: 'Cambridge', outcomeCode: '5Nf.09',
    routes: { outcomes: '/objectives', syllabus: '/syllabus', grading: '/grading', assessments: '/igcse-assessments' },
  },
  matriculation: {
    id: 'matriculation', label: 'Tamil Nadu Matriculation', short: 'Matriculation', menu: 'Matric', range: 'A1–E2', passMark: 35, level: 'Std',
    stage: 'Matriculation', awardingBody: 'Tamil Nadu State Board (Samacheer Kalvi)', textbook: 'State Board (Samacheer Kalvi)', outcomeCode: 'M9MA.04',
    routes: { outcomes: '/matric-outcomes', syllabus: '/matric-syllabus', grading: '/matriculation', assessments: '/matriculation-assessments' },
  },
  cbse: {
    id: 'cbse', label: 'CBSE', short: 'CBSE', menu: 'CBSE', range: 'A1–E', passMark: 33, level: 'Class',
    stage: 'CBSE', awardingBody: 'Central Board of Secondary Education (NCERT textbooks)', textbook: 'NCERT', outcomeCode: 'C9MA.04',
    routes: { outcomes: '/cbse-outcomes', syllabus: '/cbse-syllabus', grading: '/cbse', assessments: '/cbse-assessments' },
  },
};

export const BOARDS: BoardInfo[] = [BOARD_INFO.igcse, BOARD_INFO.matriculation, BOARD_INFO.cbse];

export function isBoard(v: unknown): v is Board {
  return typeof v === 'string' && v in BOARD_INFO;
}

/** A board's details (unknown → Cambridge IGCSE). */
export function boardInfo(board?: string | null): BoardInfo {
  return isBoard(board) ? BOARD_INFO[board] : BOARD_INFO.igcse;
}

/** Display name of a board (unknown → Cambridge IGCSE). */
export function boardLabel(board?: string | null, short = false) {
  const b = boardInfo(board);
  return short ? b.short : b.label;
}

/** One-line description of a board's letters, e.g. "Cambridge IGCSE A*–G, U". */
export function scaleRange(board?: string | null) {
  const b = boardInfo(board);
  return `${b.label} ${b.range}`;
}

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
/** A year group in the board's own words: Grade 9, Std IX, Class IX. */
export function levelLabel(board: string | null | undefined, grade: number) {
  const b = boardInfo(board);
  return b.level === 'Grade' ? `Grade ${grade}` : `${b.level} ${ROMAN[grade] ?? grade}`;
}

export interface GradeBoundary {
  grade: string;
  minPercent: number;
  points: number;
  description: string | null;
  tone: string | null;
  sortOrder: number;
}

export interface GradeScale {
  id: string | null;
  key: string;
  board: Board;
  boardName: string;
  name: string;
  description: string | null;
  boundaries: GradeBoundary[];
  /** Core / Extended rules; empty for an untiered board (Matriculation, CBSE). */
  tierRules: Partial<Record<Tier, { highest: string; lowest: string }>>;
  tiered?: boolean;
  tiers?: { tier: Tier; highest: string; lowest: string; summary: string }[];
  expectation?: { above: string; at: string };
  expectationBands?: { above: number; at: number; aboveGrade: string; atGrade: string };
  note?: string;
  updatedAt: string | null;
  updatedBy: string | null;
  isFallback?: boolean;
}

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

export const DEFAULT_SCALE: GradeScale = {
  id: null,
  key: 'cambridge_igcse_a_star_g',
  board: 'igcse',
  boardName: 'Cambridge IGCSE',
  name: 'Cambridge IGCSE (A* to G)',
  description: 'Classic Cambridge IGCSE letter grades A* to G, with U below G.',
  boundaries: DEFAULT_BOUNDARIES,
  tierRules: { Core: { highest: 'C', lowest: 'G' }, Extended: { highest: 'A*', lowest: 'E' } },
  tiered: true,
  expectation: { above: 'B', at: 'C' },
  updatedAt: null,
  updatedBy: null,
  isFallback: true,
};

export const MATRICULATION_SCALE: GradeScale = {
  id: null,
  key: 'tn_matriculation_a1_e2',
  board: 'matriculation',
  boardName: 'Tamil Nadu Matriculation',
  name: 'Tamil Nadu Matriculation (A1 to E2)',
  description: 'Nine-point A1–E2 grades in the CCE style used by Tamil Nadu State Board and Matriculation schools. D starts at 35%, the pass mark.',
  boundaries: [
    { grade: 'A1', minPercent: 91, points: 10, description: 'Outstanding', tone: 'success', sortOrder: 1 },
    { grade: 'A2', minPercent: 81, points: 9, description: 'Excellent', tone: 'success', sortOrder: 2 },
    { grade: 'B1', minPercent: 71, points: 8, description: 'Very good', tone: 'info', sortOrder: 3 },
    { grade: 'B2', minPercent: 61, points: 7, description: 'Good', tone: 'info', sortOrder: 4 },
    { grade: 'C1', minPercent: 51, points: 6, description: 'Above average', tone: 'neutral', sortOrder: 5 },
    { grade: 'C2', minPercent: 41, points: 5, description: 'Average', tone: 'neutral', sortOrder: 6 },
    { grade: 'D', minPercent: 35, points: 4, description: 'Pass', tone: 'warning', sortOrder: 7 },
    { grade: 'E1', minPercent: 21, points: 0, description: 'Below pass — needs improvement', tone: 'critical', sortOrder: 8 },
    { grade: 'E2', minPercent: 0, points: 0, description: 'Below pass — needs support', tone: 'critical', sortOrder: 9 },
  ],
  tierRules: {},
  tiered: false,
  expectation: { above: 'B1', at: 'B2' },
  updatedAt: null,
  updatedBy: null,
  isFallback: true,
};

export const CBSE_SCALE: GradeScale = {
  id: null,
  key: 'cbse_a1_e',
  board: 'cbse',
  boardName: 'CBSE',
  name: 'CBSE (A1 to E)',
  description: 'Eight-point A1–E grades in the CBSE style. D starts at 33%, the CBSE pass mark; E is below the pass mark.',
  boundaries: [
    { grade: 'A1', minPercent: 91, points: 10, description: 'Outstanding', tone: 'success', sortOrder: 1 },
    { grade: 'A2', minPercent: 81, points: 9, description: 'Excellent', tone: 'success', sortOrder: 2 },
    { grade: 'B1', minPercent: 71, points: 8, description: 'Very good', tone: 'info', sortOrder: 3 },
    { grade: 'B2', minPercent: 61, points: 7, description: 'Good', tone: 'info', sortOrder: 4 },
    { grade: 'C1', minPercent: 51, points: 6, description: 'Above average', tone: 'neutral', sortOrder: 5 },
    { grade: 'C2', minPercent: 41, points: 5, description: 'Average', tone: 'neutral', sortOrder: 6 },
    { grade: 'D', minPercent: 33, points: 4, description: 'Pass', tone: 'warning', sortOrder: 7 },
    { grade: 'E', minPercent: 0, points: 0, description: 'Below pass — needs improvement', tone: 'critical', sortOrder: 8 },
  ],
  tierRules: {},
  tiered: false,
  expectation: { above: 'B1', at: 'B2' },
  updatedAt: null,
  updatedBy: null,
  isFallback: true,
};

export const DEFAULT_SCALES: Record<Board, GradeScale> = { igcse: DEFAULT_SCALE, matriculation: MATRICULATION_SCALE, cbse: CBSE_SCALE };

/** Cambridge IGCSE grade letters best → worst. */
export const GRADE_ORDER = DEFAULT_BOUNDARIES.map((b) => b.grade);

export function orderedBoundaries(scale: Pick<GradeScale, 'boundaries'> = DEFAULT_SCALE) {
  return [...scale.boundaries].sort((a, b) => a.sortOrder - b.sortOrder || b.minPercent - a.minPercent);
}

/**
 * Letter for a percentage. With a tier on a tiered scale, Cambridge tier rules
 * apply: Extended → A*–E (below E is U); Core → C–G, capped at C (below G is U).
 */
export function gradeFor(percent: number, opts: { tier?: Tier | null; scale?: GradeScale } = {}): string {
  const scale = opts.scale ?? DEFAULT_SCALE;
  const list = orderedBoundaries(scale);
  if (!list.length) return 'U';
  const pct = Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0;
  let idx = list.findIndex((b) => pct + 1e-9 >= Number(b.minPercent));
  if (idx < 0) idx = list.length - 1;
  const rule = opts.tier ? scale.tierRules?.[opts.tier] : undefined;
  if (rule) {
    const hi = list.findIndex((b) => b.grade === rule.highest);
    const lo = list.findIndex((b) => b.grade === rule.lowest);
    if (hi >= 0 && idx < hi) idx = hi;
    if (lo >= 0 && idx > lo) return list[list.length - 1].grade;
  }
  return list[idx].grade;
}

// IGCSE and Matriculation letters (D is on both: "Satisfactory" on IGCSE, the pass band on Matriculation).
const TONE: Record<string, string> = {
  'A*': 'success', A: 'success', B: 'info', C: 'info', D: 'neutral', E: 'warning', F: 'warning', G: 'critical', U: 'critical',
  A1: 'success', A2: 'success', B1: 'info', B2: 'info', C1: 'neutral', C2: 'neutral', E1: 'critical', E2: 'critical',
};
const COLOR: Record<string, string> = {
  'A*': 'var(--teal)', A: 'var(--teal)', B: 'var(--navy)', C: 'var(--navy)', D: 'var(--viz-3)',
  E: 'var(--amber)', F: 'var(--amber)', G: 'var(--critical)', U: 'var(--critical)',
  A1: 'var(--teal)', A2: 'var(--teal)', B1: 'var(--navy)', B2: 'var(--navy)', C1: 'var(--viz-3)', C2: 'var(--viz-3)',
  E1: 'var(--critical)', E2: 'var(--critical)',
};

/** Badge tone for a grade letter (unknown / legacy letters → neutral). */
export function gradeTone(grade?: string | null, scale?: GradeScale) {
  if (!grade) return 'neutral';
  return scale?.boundaries.find((b) => b.grade === grade)?.tone ?? TONE[grade] ?? 'neutral';
}

/** Chart colour for a grade letter. */
export function gradeColor(grade?: string | null) {
  return COLOR[grade ?? ''] ?? 'var(--viz-6)';
}

/** Meter tone (teal / default / amber / critical) for a grade letter. */
export function gradeMeterTone(grade?: string | null) {
  const t = gradeTone(grade);
  return t === 'success' ? 'teal' : t === 'info' ? 'info' : t === 'critical' ? 'critical' : 'amber';
}

/** A board's grade scale (default: Cambridge IGCSE), with the defaults while it loads. */
export function useGradeScale(board?: string | null) {
  const b: Board = isBoard(board) ? board : 'igcse';
  const q = useApiQuery<GradeScale>('/grading/scale', { board: b }, { staleTime: 5 * 60_000 });
  return { scale: q.data ?? DEFAULT_SCALES[b], query: q };
}
