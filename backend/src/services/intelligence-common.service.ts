import type { Response } from 'express';
import { one, type Queryable } from '../config/db.js';
import type { Permission } from '../config/rbac.js';
import type { AuthUser } from '../types.js';

/** Reads a numeric system setting, falling back to a default when it is missing or malformed. */
export async function numberSetting(key: string, fallback: number, db?: Queryable): Promise<number> {
  const row = await one<{ value: unknown }>('SELECT value FROM system_settings WHERE key = $1', [key], db);
  const n = Number(row?.value);
  return Number.isFinite(n) ? n : fallback;
}

export async function earlyWarningThresholds(db?: Queryable) {
  const [attendance, scoreDrop] = await Promise.all([
    numberSetting('early_warning.attendance_threshold', 82, db),
    numberSetting('early_warning.score_drop_threshold', 5, db),
  ]);
  return { attendance, scoreDrop };
}

export const RISK_ORDER = ['On Track', 'Watch', 'Developing Risk', 'At Risk'] as const;
export const riskRank = (r: string | null | undefined) => Math.max(0, RISK_ORDER.indexOf((r ?? 'On Track') as (typeof RISK_ORDER)[number]));

export const STAGES = ['Signal', 'Teacher Review', 'Intervention', 'Action', 'Follow-up', 'Closed'] as const;

/** Intervention label shown in the Early Warning table, derived from the open signal's stage. */
export const INTERVENTION_SQL = (stage: string, code: string) => `CASE
  WHEN ${code} IS NULL THEN 'None'
  WHEN ${stage} <= 1 THEN 'Review pending'
  WHEN ${stage} = 2 THEN 'Planned'
  WHEN ${stage} = 3 THEN 'Active'
  ELSE 'Monitoring' END`;

/** True when the user sees every student (school scope). */
export const isSchoolScope = (u: AuthUser) => u.permissions.has('students.read');

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------
function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s = v instanceof Date ? v.toISOString() : typeof v === 'object' ? JSON.stringify(v) : String(v);
  // Neutralise spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export interface CsvColumn { key: string; label: string }

export function toCsv(columns: CsvColumn[], rows: Record<string, unknown>[]) {
  const lines = [columns.map((c) => csvCell(c.label)).join(',')];
  for (const r of rows) lines.push(columns.map((c) => csvCell(r[c.key])).join(','));
  // BOM so spreadsheet apps detect UTF-8 (₹, Tamil names).
  return '﻿' + lines.join('\r\n') + '\r\n';
}

export function sendCsv(res: Response, filename: string, csv: string) {
  const safe = filename.replace(/[^A-Za-z0-9._-]/g, '_');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${safe}"`);
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).send(csv);
}

/** Today's date in the school's timezone (YYYY-MM-DD). */
export function schoolToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

// ---------------------------------------------------------------------------
// Standard report registry
// ---------------------------------------------------------------------------
// Shared by the report catalogue, the CSV export and the Report Centre preview,
// so a report is defined once and every surface stays in step.

export interface ReportParams { campusId?: string; date?: string; from?: string; to?: string }

/** The filters a report actually reads, so the UI only offers inputs that apply. */
export type ReportFilter = 'campus' | 'date' | 'range';

/** Aggregate shown as a KPI tile above a previewed report. */
export interface ReportSummaryDef {
  key: string;
  label: string;
  agg: 'sum' | 'avg' | 'max' | 'min' | 'count';
  /** With agg 'count', counts only rows whose `key` equals this value. */
  equals?: string;
  unit?: string;
  tone?: 'teal' | 'amber' | 'critical' | 'info';
}

/**
 * Chart shown above a previewed report. 'value' plots a numeric column by label;
 * 'count' plots how often each value of a categorical column occurs.
 */
export type ReportChartDef =
  | { mode: 'value'; labelKey: string; valueKey: string; label: string }
  | { mode: 'count'; labelKey: string; label: string };

export interface ReportDef {
  key: string;
  group: string;
  title: string;
  description: string;
  /** The caller needs any one of these. */
  perms: Permission[];
  /** …and all of these. */
  alsoRequires?: Permission[];
  /** When set, only these role keys may run the report, whatever their permissions. */
  roles?: string[];
  filters?: ReportFilter[];
  summary?: ReportSummaryDef[];
  chart?: ReportChartDef;
  build: (user: AuthUser, p: ReportParams) => Promise<{ columns: CsvColumn[]; rows: Record<string, unknown>[] }>;
}

export const col = (key: string, label: string): CsvColumn => ({ key, label });
