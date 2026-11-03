/**
 * Shared seed context. Every seeded record is SAMPLE DATA for development and
 * demonstration — no record is a real person, transaction or location.
 *
 * Dates are generated relative to "today" (Asia/Kolkata) so the data always
 * looks current. A seeded PRNG keeps every run identical for a given day.
 */
import type pg from 'pg';

export type Db = pg.PoolClient;

export interface SeedStudent {
  id: string;
  admissionNo: string;
  fullName: string;
  firstName: string;
  lastName: string;
  gender: 'M' | 'F';
  campusCode: string;
  campusId: string;
  classId: string;
  sectionId: string;
  gradeLevel: number;
  grade: string;          // "Grade 5"
  section: string;        // "A"
  house: string;
  targetAttendance: number;
  targetAverage: number;
  targetTrend: number;
  risk: string;
  feeProfile: 'Paid' | 'Partial' | 'Overdue';
  routeCode: string | null;
  home: { lat: number; lng: number };
  parentId?: string;
}

export interface SeedContext {
  today: string;                     // YYYY-MM-DD in Asia/Kolkata
  now: Date;
  yearId: string;
  yearStart: string;
  campuses: Record<string, { id: string; lat: number; lng: number; name: string }>;
  roles: Record<string, string>;     // role key → id
  users: Record<string, string>;     // demo handle → user id
  employees: Record<string, string>; // employee code → id
  employeeByName: Record<string, string>;
  classes: Record<string, string>;   // "gdv:5" → class id
  sections: Record<string, string>;  // "gdv:5:A" → section id
  subjects: Record<string, string>;  // code → id
  routes: Record<string, string>;    // route code → id
  stops: Record<string, string[]>;   // route code → stop ids (in order)
  students: SeedStudent[];
  studentByNo: Record<string, SeedStudent>;
  parents: Record<string, string>;   // parent code → id
  rand: () => number;
  pick: <T>(arr: readonly T[]) => T;
  int: (min: number, max: number) => number;
  /** Date string offset from today by n days (negative = past). */
  day: (offset: number) => string;
  /** Timestamp for a given date string at HH:MM Asia/Kolkata. */
  at: (date: string, hhmm: string) => Date;
  /** School days (Mon–Fri, plus Saturdays when requested; holidays excluded) between two dates inclusive. */
  schoolDays: (from: string, to: string, includeSaturday?: boolean) => string[];
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function todayInKolkata(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function addDays(date: string, n: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function kolkataTime(date: string, hhmm: string) {
  return new Date(`${date}T${hhmm.length === 5 ? hhmm + ':00' : hhmm}+05:30`);
}

const HOLIDAYS = new Set(['2026-08-15', '2026-08-27', '2026-10-02', '2026-10-20', '2026-10-21', '2026-12-25']);

export function listSchoolDays(from: string, to: string, includeSaturday = false) {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
    if (dow === 0 || (!includeSaturday && dow === 6) || HOLIDAYS.has(d)) continue;
    out.push(d);
  }
  return out;
}

/** Inserts many rows with one statement per chunk. Column names are trusted constants. */
export async function bulkInsert(db: Db, table: string, columns: string[], rows: unknown[][], suffix = '', chunk = 500) {
  const ids: any[] = [];
  for (let i = 0; i < rows.length; i += chunk) {
    const part = rows.slice(i, i + chunk);
    const params: unknown[] = [];
    const values = part.map((r) => `(${r.map((v) => { params.push(v); return `$${params.length}`; }).join(',')})`).join(',');
    const res = await db.query(`INSERT INTO ${table} (${columns.join(',')}) VALUES ${values} ${suffix}`, params);
    ids.push(...res.rows);
  }
  return ids;
}
