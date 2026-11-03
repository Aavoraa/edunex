import type { Request } from 'express';
import { many, one, query, tx, type Queryable } from '../config/db.js';
import { badRequest, notFound } from '../utils/errors.js';
import { audit } from './audit.service.js';
import {
  BOARDS, DEFAULT_BOARD, DEFAULT_SCALES, DEFAULT_TIER_RULES, gradeFromScale, isBoard, minPercentFor, ordered,
  type Board, type GradeBoundary, type GradeScale, type Tier, type TierRule,
} from './grading-shared.js';

/**
 * The single grading service. Every class follows a board (classes.board), and
 * each board has its own grade scale: Cambridge IGCSE (A*–G, U) or Tamil Nadu
 * Matriculation (A1–E2). Loads the scales from the database, caches them, and
 * grades percentages with the scale of the right board. Every backend path
 * that turns a mark into a letter goes through here; the sync DEFAULT_SCALES
 * are used only when a database scale is unavailable.
 */

export type { Board, GradeScale, Tier } from './grading-shared.js';

const TTL_MS = 60_000; // short TTL so other API instances pick up edits too
let cache: { at: number; scales: Record<Board, GradeScale> } | null = null;

export function invalidateGradeScale() {
  cache = null;
}

/** The board a value names, else the default board (IGCSE). */
export function toBoard(v: unknown): Board {
  return isBoard(v) ? v : DEFAULT_BOARD;
}

async function loadScale(board: Board, db?: Queryable): Promise<GradeScale | null> {
  const s = await one<{ id: string; key: string; board: string; board_name: string | null; name: string; description: string | null; tier_rules: Record<string, TierRule> | null; expectation: { above?: string; at?: string } | null; updated_at: Date; updated_by: string | null }>(
    `SELECT gs.id, gs.key, gs.board, gs.board_name, gs.name, gs.description, gs.tier_rules, gs.expectation, gs.updated_at, u.full_name AS updated_by
       FROM grade_scales gs LEFT JOIN users u ON u.id = gs.updated_by
      WHERE gs.board = $1`,
    [board], db,
  );
  if (!s) return null;
  const rows = await many<GradeBoundary>(
    `SELECT grade, min_percent::float AS "minPercent", points, description, tone, sort_order AS "sortOrder"
       FROM grade_boundaries WHERE scale_id = $1 ORDER BY sort_order, min_percent DESC`,
    [s.id], db,
  );
  if (!rows.length) return null;
  const fallback = DEFAULT_SCALES[board];
  const rules = s.tier_rules ?? {};
  // IGCSE is tiered (Core / Extended); a missing rule falls back to the Cambridge default. Other boards are untiered.
  const tierRules: Partial<Record<Tier, TierRule>> = board === 'igcse'
    ? { Core: rules.Core ?? DEFAULT_TIER_RULES.Core, Extended: rules.Extended ?? DEFAULT_TIER_RULES.Extended }
    : Object.fromEntries((['Core', 'Extended'] as Tier[]).filter((t) => rules[t]).map((t) => [t, rules[t]]));
  return {
    id: s.id, key: s.key, board, boardName: s.board_name ?? fallback.boardName, name: s.name, description: s.description, boundaries: rows,
    tierRules,
    expectation: { above: s.expectation?.above ?? fallback.expectation.above, at: s.expectation?.at ?? fallback.expectation.at },
    updatedAt: s.updated_at ? new Date(s.updated_at).toISOString() : null,
    updatedBy: s.updated_by,
  };
}

/** Every board's grade scale (cached). A board whose scale cannot be loaded uses its built-in defaults. */
export async function getScales(): Promise<Record<Board, GradeScale>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.scales;
  const scales = { ...DEFAULT_SCALES };
  for (const b of BOARDS) {
    try {
      scales[b] = (await loadScale(b)) ?? DEFAULT_SCALES[b];
    } catch {
      scales[b] = DEFAULT_SCALES[b]; // e.g. migrations 115 / 125 not applied yet
    }
  }
  cache = { at: Date.now(), scales };
  return scales;
}

/** The grade scale of a board (default: Cambridge IGCSE). */
export async function getScale(board?: string | null): Promise<GradeScale> {
  return (await getScales())[toBoard(board)];
}

/** The board a class follows (IGCSE when unknown). */
export async function boardOfClass(classId: string, db?: Queryable): Promise<Board> {
  try {
    const r = await one<{ board: string }>('SELECT board FROM classes WHERE id = $1', [classId], db);
    return toBoard(r?.board);
  } catch {
    return DEFAULT_BOARD;
  }
}

/** Letter grade for a percentage on a board's scale, with optional Core/Extended tier rules (IGCSE). */
export async function gradeFor(percent: number, opts: { tier?: Tier | null; board?: Board | null } = {}) {
  return gradeFromScale(await getScale(opts.board), percent, opts.tier);
}

/** Grade letters best → worst on a board's scale. */
export async function gradeOrder(board?: Board | null) {
  return ordered(await getScale(board)).map((b) => b.grade);
}

export interface ExpectationBand { above: number; at: number; aboveGrade: string; atGrade: string }

function bandsOf(s: GradeScale): ExpectationBand {
  const d = DEFAULT_SCALES[s.board];
  return {
    above: minPercentFor(s, s.expectation.above) ?? minPercentFor(d, d.expectation.above) ?? 70,
    at: minPercentFor(s, s.expectation.at) ?? minPercentFor(d, d.expectation.at) ?? 60,
    aboveGrade: s.expectation.above,
    atGrade: s.expectation.at,
  };
}

/**
 * Expectation bands for academic performance, derived from a board's scale:
 * IGCSE — above expectation = grade B or better, at expectation = grade C;
 * Matriculation and CBSE — above = B1 or better, at = B2; below expectation is under that.
 */
export async function expectationBands(board?: Board | null) {
  return bandsOf(await getScale(board));
}

/** Expectation bands for every board, keyed by board. */
export async function expectationsByBoard(): Promise<Record<Board, ExpectationBand>> {
  const scales = await getScales();
  return Object.fromEntries(BOARDS.map((b) => [b, bandsOf(scales[b])])) as Record<Board, ExpectationBand>;
}

const NOTES: Record<Board, string> = {
  igcse: 'Indicative school boundaries. Cambridge International publishes component grade thresholds for each exam series; update these boundaries to match the thresholds for the series you are preparing for.',
  matriculation: 'Indicative school boundaries in the CCE style used by Tamil Nadu State Board and Matriculation schools; the pass mark is 35%. Update them if the school follows a different internal scheme. Class 10 SSLC public examination results are reported as marks by the Directorate of Government Examinations.',
  cbse: 'Indicative school boundaries in the CBSE A1–E style; the pass mark is 33%. For Class X and XII board examinations CBSE awards grades by rank among passed candidates, so use these bands for school assessments and update them to the school’s scheme.',
};

/** Public shape for GET /grading/scale. */
export async function scaleForApi(board?: string | null) {
  const s = await getScale(board);
  const { Core, Extended } = s.tierRules;
  return {
    ...s,
    boundaries: ordered(s),
    isFallback: s.id == null,
    tiered: !!(Core && Extended),
    tiers: Core && Extended ? [
      { tier: 'Extended', ...Extended, summary: `Extended entries are graded ${Extended.highest}–${Extended.lowest}; below ${Extended.lowest} is U.` },
      { tier: 'Core', ...Core, summary: `Core entries are graded ${Core.highest}–${Core.lowest} (capped at ${Core.highest}); below ${Core.lowest} is U.` },
    ] : [],
    expectationBands: bandsOf(s),
    note: NOTES[s.board],
  };
}

/** Boards with their scales and the classes that follow each (GET /grading/boards). */
export async function listBoards(campusId?: string) {
  const scales = await getScales();
  const classes = await many<{ id: string; campusId: string; campus: string; name: string; gradeLevel: number; stage: string | null; board: string; sections: number; students: number }>(
    `SELECT c.id, c.campus_id AS "campusId", cp.short_name AS campus, c.name, c.grade_level AS "gradeLevel", c.stage, c.board,
            count(DISTINCT sec.id)::int AS sections,
            count(DISTINCT s.id) FILTER (WHERE s.deleted_at IS NULL AND s.status = 'active')::int AS students
       FROM classes c JOIN campuses cp ON cp.id = c.campus_id
       LEFT JOIN sections sec ON sec.class_id = c.id AND sec.academic_year_id = (SELECT id FROM academic_years WHERE is_current)
       LEFT JOIN students s ON s.section_id = sec.id
      WHERE ($1::uuid IS NULL OR c.campus_id = $1::uuid)
      GROUP BY c.id, cp.short_name, cp.name
      ORDER BY cp.name, c.grade_level`,
    [campusId ?? null],
  );
  return {
    boards: BOARDS.map((b) => {
      const list = ordered(scales[b]);
      const mine = classes.filter((c) => c.board === b);
      return {
        board: b, boardName: scales[b].boardName, scaleName: scales[b].name,
        range: list.length ? `${list[0].grade}–${list[list.length - 1].grade}` : '',
        classes: mine.length, students: mine.reduce((a, c) => a + c.students, 0),
      };
    }),
    classes,
  };
}

/**
 * SQL for the tier that applies to a mark: a Core/Extended paper fixes the tier;
 * an "All" component of a tiered syllabus uses the student's entry tier.
 * Expects aliases a (assessments) and m (assessment_marks).
 */
export const EFFECTIVE_TIER_JOINS = `
  LEFT JOIN syllabus_components scx ON scx.id = a.syllabus_component_id
  LEFT JOIN syllabuses syx ON syx.id = scx.syllabus_id
  LEFT JOIN student_syllabus_entries sex ON sex.syllabus_id = syx.id AND sex.student_id = m.student_id`;
export const EFFECTIVE_TIER_SQL = `CASE WHEN scx.tier IN ('Core', 'Extended') THEN scx.tier WHEN syx.tiered THEN sex.tier END`;

/**
 * Re-grades this academic year's stored marks and term results of the classes
 * on a scale's board (optionally only some classes) with that scale.
 */
async function regradeCurrentYear(scale: GradeScale, db: Queryable, classIds: string[] | null = null) {
  const marks = await many<{ id: string; pct: number; tier: Tier | null; grade: string | null }>(
    `SELECT m.id, (100.0 * m.marks / a.max_marks)::float AS pct, ${EFFECTIVE_TIER_SQL} AS tier, m.grade
       FROM assessment_marks m JOIN assessments a ON a.id = m.assessment_id JOIN classes c ON c.id = a.class_id ${EFFECTIVE_TIER_JOINS}
      WHERE m.marks IS NOT NULL AND a.academic_year_id = (SELECT id FROM academic_years WHERE is_current)
        AND c.board = $1 AND ($2::uuid[] IS NULL OR c.id = ANY($2::uuid[]))`,
    [scale.board, classIds], db,
  );
  const mChanged = marks.map((m) => ({ id: m.id, g: gradeFromScale(scale, m.pct, m.tier) })).filter((x, i) => x.g !== marks[i].grade);
  if (mChanged.length) {
    await query(`UPDATE assessment_marks m SET grade = x.g FROM unnest($1::uuid[], $2::text[]) AS x(id, g) WHERE m.id = x.id`,
      [mChanged.map((x) => x.id), mChanged.map((x) => x.g)], db);
  }
  const recs = await many<{ id: string; score: number; grade: string | null }>(
    `SELECT r.id, r.score::float AS score, r.grade
       FROM student_academic_records r JOIN students s ON s.id = r.student_id
       JOIN sections sec ON sec.id = s.section_id JOIN classes c ON c.id = sec.class_id
      WHERE r.academic_year_id = (SELECT id FROM academic_years WHERE is_current)
        AND c.board = $1 AND ($2::uuid[] IS NULL OR c.id = ANY($2::uuid[]))`,
    [scale.board, classIds], db,
  );
  const rChanged = recs.map((r) => ({ id: r.id, g: gradeFromScale(scale, r.score) })).filter((x, i) => x.g !== recs[i].grade);
  if (rChanged.length) {
    await query(`UPDATE student_academic_records r SET grade = x.g FROM unnest($1::uuid[], $2::text[]) AS x(id, g) WHERE r.id = x.id`,
      [rChanged.map((x) => x.id), rChanged.map((x) => x.g)], db);
  }
  return { marks: mChanged.length, records: rChanged.length };
}

/**
 * Moves classes to a board. Their current-year marks and term results are
 * re-graded on the new board's scale, since letters from another board's
 * scale mean nothing on it.
 */
export async function setClassBoard(req: Request, input: { classIds: string[]; board: Board }) {
  const result = await tx(async (db) => {
    const scale = await loadScale(input.board, db);
    if (!scale?.id) throw badRequest('That board has no grade scale configured — run the database migrations first', 'NO_GRADE_SCALE');
    const ids = [...new Set(input.classIds)];
    const found = await many<{ id: string; name: string; campus: string; board: string }>(
      `SELECT c.id, c.name, cp.short_name AS campus, c.board FROM classes c JOIN campuses cp ON cp.id = c.campus_id
        WHERE c.id = ANY($1::uuid[]) FOR UPDATE OF c`,
      [ids], db,
    );
    if (found.length !== ids.length) throw notFound('Class not found', 'CLASS_NOT_FOUND');
    const moving = found.filter((c) => c.board !== input.board);
    if (!moving.length) return { changed: 0, regraded: { marks: 0, records: 0 } };
    await query('UPDATE classes SET board = $2 WHERE id = ANY($1::uuid[])', [moving.map((c) => c.id), input.board], db);
    const regraded = await regradeCurrentYear(scale, db, moving.map((c) => c.id));
    await audit(req, {
      action: 'update', module: 'grading',
      description: `Moved ${moving.map((c) => `${c.name} (${c.campus})`).join(', ')} to ${scale.boardName}; re-graded ${regraded.marks} mark(s) and ${regraded.records} term result(s)`,
      entityType: 'grade_scale', entityId: scale.id,
      metadata: { board: input.board, classes: moving.map((c) => ({ id: c.id, from: c.board })), regraded },
    }, db);
    return { changed: moving.length, regraded };
  });
  return { ...result, ...(await listBoards()) };
}

export interface BoundaryInput { grade: string; minPercent: number; description?: string | null }

/** Replaces the percentages (and descriptions) of a board's scale boundaries. */
export async function updateBoundaries(req: Request, input: { board?: Board; boundaries: BoundaryInput[]; tierRules?: Partial<Record<Tier, TierRule>>; regrade?: boolean }) {
  const board = toBoard(input.board);
  const result = await tx(async (db) => {
    const scale = await loadScale(board, db);
    if (!scale?.id) throw badRequest('No grade scale is configured — run the database migrations first', 'NO_GRADE_SCALE');
    await query('SELECT 1 FROM grade_scales WHERE id = $1 FOR UPDATE', [scale.id], db);
    const current = ordered(scale);
    const byGrade = new Map(input.boundaries.map((b) => [b.grade, b]));
    const errors: { field: string; message: string }[] = [];
    if (byGrade.size !== input.boundaries.length) errors.push({ field: 'boundaries', message: 'Each grade can appear only once' });
    for (const g of byGrade.keys()) {
      if (!current.some((c) => c.grade === g)) errors.push({ field: 'boundaries', message: `Grade ${g} is not on the ${scale.name} scale` });
    }
    const next = current.map((c) => {
      const b = byGrade.get(c.grade);
      return { ...c, minPercent: b ? Number(b.minPercent) : c.minPercent, description: b && b.description !== undefined ? b.description : c.description };
    });
    // Monotonic: every grade needs a strictly lower minimum than the grade above it; the lowest grade (U, E2) starts at 0.
    next.forEach((b, i) => {
      const field = `boundaries.${input.boundaries.findIndex((x) => x.grade === b.grade)}.minPercent`;
      if (b.minPercent < 0 || b.minPercent > 100) errors.push({ field, message: `${b.grade}: must be between 0 and 100` });
      if (i > 0 && b.minPercent >= next[i - 1].minPercent) errors.push({ field, message: `${b.grade} must start below ${next[i - 1].grade} (${next[i - 1].minPercent}%)` });
    });
    const last = next[next.length - 1];
    if (last && last.minPercent !== 0) errors.push({ field: 'boundaries', message: `${last.grade} is the lowest band and must start at 0%` });

    const tiered = !!(scale.tierRules.Core && scale.tierRules.Extended);
    if (!tiered && input.tierRules && Object.keys(input.tierRules).length) {
      errors.push({ field: 'tierRules', message: `${scale.boardName} has no Core / Extended tiers` });
    }
    const rules: Partial<Record<Tier, TierRule>> = tiered ? { ...scale.tierRules, ...(input.tierRules ?? {}) } : {};
    for (const t of (tiered ? ['Core', 'Extended'] : []) as Tier[]) {
      const r = rules[t]!;
      const hi = next.findIndex((b) => b.grade === r.highest);
      const lo = next.findIndex((b) => b.grade === r.lowest);
      if (hi < 0 || lo < 0) errors.push({ field: `tierRules.${t}`, message: `${t}: choose grades from the scale` });
      else if (hi > lo) errors.push({ field: `tierRules.${t}`, message: `${t}: the highest grade must be above the lowest grade` });
      else if (lo === next.length - 1) errors.push({ field: `tierRules.${t}`, message: `${t}: the lowest awarded grade cannot be the ungraded band` });
    }
    if (errors.length) throw badRequest('The grade boundaries are not valid', 'VALIDATION_ERROR', errors);

    for (const b of next) {
      await query(
        `UPDATE grade_boundaries SET min_percent = $3, description = $4 WHERE scale_id = $1 AND grade = $2`,
        [scale.id, b.grade, b.minPercent, b.description ?? null], db,
      );
    }
    await query('UPDATE grade_scales SET tier_rules = $2, updated_by = $3 WHERE id = $1', [scale.id, JSON.stringify(rules), req.user!.id], db);
    const changed = next.filter((b, i) => b.minPercent !== current[i].minPercent).map((b) => `${b.grade} ${current.find((c) => c.grade === b.grade)!.minPercent}→${b.minPercent}%`);
    const regraded = input.regrade ? await regradeCurrentYear({ ...scale, boundaries: next, tierRules: rules }, db) : null;
    await audit(req, {
      action: 'update', module: 'grading',
      description: `Updated ${scale.name} grade boundaries${changed.length ? ` (${changed.join(', ')})` : ''}${regraded ? `; re-graded ${regraded.marks} mark(s) and ${regraded.records} term result(s)` : ''}`,
      entityType: 'grade_scale', entityId: scale.id,
      metadata: { board, before: current.map((b) => [b.grade, b.minPercent]), after: next.map((b) => [b.grade, b.minPercent]), tierRules: rules, regraded },
    }, db);
    return { id: scale.id, changed: changed.length, regraded };
  });
  invalidateGradeScale();
  return { ...result, scale: await scaleForApi(board) };
}
