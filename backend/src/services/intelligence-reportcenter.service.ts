import type { AuthUser } from '../types.js';
import { reportFor } from './intelligence-analytics.service.js';
import type { CsvColumn, ReportParams, ReportSummaryDef } from './intelligence-common.service.js';

/**
 * Report Centre preview. A report is built once by its own definition and then
 * searched, sorted, summarised and paged here, so what an administrator reads on
 * screen is exactly what the CSV export of the same report contains.
 */

/** Above this the preview stops paging and tells the caller to export instead. */
const MAX_ROWS = 20_000;

export interface ReportPreviewRequest extends ReportParams {
  page: number;
  pageSize: number;
  sort?: string;
  dir: 'asc' | 'desc';
  q?: string;
}

export interface ReportPreview {
  key: string;
  title: string;
  description: string;
  group: string;
  columns: CsvColumn[];
  /** Column keys holding numbers, so the table can right-align and format them. */
  numeric: string[];
  rows: Record<string, unknown>[];
  summary: { label: string; value: number; unit?: string; tone?: string }[];
  chart: { label: string; rows: { label: string; value: number }[] } | null;
  totalRows: number;
  matchedRows: number;
  truncated: boolean;
  generatedAt: string;
}

/** Postgres returns numeric/bigint as strings, so parse rather than trusting typeof. */
function num(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim())) return Number(v);
  return NaN;
}

const isBlank = (v: unknown) => v === null || v === undefined || v === '';

/** A column counts as numeric when it has values and every one of them parses. */
function numericColumns(columns: CsvColumn[], rows: Record<string, unknown>[]): string[] {
  const sample = rows.slice(0, 200);
  return columns
    .filter((c) => {
      const values = sample.map((r) => r[c.key]).filter((v) => !isBlank(v));
      return values.length > 0 && values.every((v) => !Number.isNaN(num(v)));
    })
    .map((c) => c.key);
}

function aggregate(def: ReportSummaryDef, rows: Record<string, unknown>[]): number {
  if (def.agg === 'count') {
    return def.equals === undefined
      ? rows.length
      : rows.filter((r) => String(r[def.key] ?? '') === def.equals).length;
  }
  const values = rows.map((r) => num(r[def.key])).filter((n) => !Number.isNaN(n));
  if (!values.length) return 0;
  switch (def.agg) {
    case 'sum': return values.reduce((a, b) => a + b, 0);
    case 'avg': return values.reduce((a, b) => a + b, 0) / values.length;
    case 'max': return Math.max(...values);
    case 'min': return Math.min(...values);
  }
}

/** Rounds to one decimal so averages read cleanly without losing meaning. */
const round1 = (n: number) => Math.round(n * 10) / 10;

export async function previewReport(user: AuthUser, key: string, req: ReportPreviewRequest): Promise<ReportPreview> {
  const def = reportFor(user, key);
  const { columns, rows: all } = await def.build(user, {
    campusId: req.campusId, date: req.date, from: req.from, to: req.to,
  });

  // Free-text search across every column, so one box covers the whole report.
  const term = req.q?.trim().toLowerCase();
  const matched = term
    ? all.filter((r) => columns.some((c) => String(r[c.key] ?? '').toLowerCase().includes(term)))
    : all;

  const numeric = numericColumns(columns, all);

  const sortKey = req.sort && columns.some((c) => c.key === req.sort) ? req.sort : undefined;
  const sorted = sortKey ? [...matched] : matched;
  if (sortKey) {
    const factor = req.dir === 'desc' ? -1 : 1;
    const asNumber = numeric.includes(sortKey);
    sorted.sort((a, b) => {
      const x = a[sortKey];
      const y = b[sortKey];
      // Blanks sort last in either direction, matching the table's NULLS LAST rule.
      if (isBlank(x) || isBlank(y)) return isBlank(x) && isBlank(y) ? 0 : isBlank(x) ? 1 : -1;
      if (asNumber) return (num(x) - num(y)) * factor;
      return String(x).localeCompare(String(y), 'en', { numeric: true }) * factor;
    });
  }

  // Tiles and the chart describe the whole matched set, not just the page on screen.
  const summary = (def.summary ?? [])
    .map((s) => ({ label: s.label, value: round1(aggregate(s, matched)), unit: s.unit, tone: s.tone }));

  let chart: ReportPreview['chart'] = null;
  if (def.chart && matched.length) {
    const totals = new Map<string, number>();
    for (const r of matched) {
      const label = String(r[def.chart.labelKey] ?? '').trim() || '—';
      const value = def.chart.mode === 'count' ? 1 : num(r[def.chart.valueKey]);
      if (Number.isNaN(value)) continue;
      totals.set(label, (totals.get(label) ?? 0) + value);
    }
    const bars = [...totals.entries()]
      .map(([label, value]) => ({ label, value: round1(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
    if (bars.length) chart = { label: def.chart.label, rows: bars };
  }

  // `__row` is the row's position in the sorted set: a stable table key for a
  // result that has no id of its own. It is not a report column, so it never renders.
  const start = (req.page - 1) * req.pageSize;
  const page = sorted.slice(start, start + req.pageSize).map((r, i) => ({ ...r, __row: start + i }));

  return {
    key: def.key,
    title: def.title,
    description: def.description,
    group: def.group,
    columns,
    numeric,
    rows: page,
    summary,
    chart,
    totalRows: all.length,
    matchedRows: matched.length,
    truncated: all.length > MAX_ROWS,
    generatedAt: new Date().toISOString(),
  };
}
