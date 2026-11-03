/**
 * SAMPLE DATA — group management: staffing targets, admissions target,
 * parent NPS surveys (last 3 months), inter-campus transfers and versioned
 * group policies. Dates are relative to today.
 */
import { type Db, type SeedContext, type SeedStudent } from './context.js';

export async function seed(db: Db, ctx: SeedContext): Promise<void> {
  const C = ctx.campuses;
  const past = (n: number, hh = '10:00') => ctx.at(ctx.day(-n), hh);

  // ---- Staffing targets (wireframe: 96 / 92 / 88 % filled) --------------------
  const counts = await db.query<{ code: string; n: number }>(
    `SELECT cp.code, count(e.id)::int AS n FROM campuses cp
       LEFT JOIN employees e ON e.campus_id = cp.id AND e.deleted_at IS NULL AND e.employment_status = 'active'
      GROUP BY cp.code`);
  const FILL: Record<string, number> = { gdv: 0.96, vdv: 0.92, plc: 0.88 };
  const targets: Record<string, number> = {};
  for (const r of counts.rows) targets[r.code] = Math.max(r.n + 1, Math.round(r.n / (FILL[r.code] ?? 0.95)));
  await db.query(
    `INSERT INTO system_settings (key, value, description) VALUES ($1,$2,$3), ($4,$5,$6)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    ['staffing.target', JSON.stringify(targets), 'Approved staff positions per campus (by campus code)',
      'admissions.group_target', JSON.stringify(210), 'Group admissions target for the calendar year']);

  // ---- Parent NPS surveys (three monthly readings) ---------------------------
  const NPS: Record<string, number[]> = { gdv: [48, 50, 52], vdv: [41, 45, 44], plc: [58, 57, 61] };
  for (const [code, values] of Object.entries(NPS)) {
    const offsets = [62, 32, 3];
    for (let i = 0; i < 3; i++) {
      await db.query('INSERT INTO campus_survey_metrics (campus_id, metric, value, measured_on) VALUES ($1, $2, $3, $4)',
        [C[code].id, 'parent_nps', values[i], ctx.day(-offsets[i])]);
    }
  }

  // ---- Transfers (wireframe three, mapped to existing students) ----------------
  const reserved = new Set(['HS-2026-1041', 'HS-2026-1042', 'HS-2026-1043', 'HS-2026-1085', 'HS-2026-1064', 'HS-2026-1089',
    'HS-2026-1090', 'HS-2026-1079', 'HS-2026-1070', 'HS-2026-1067', 'HS-2026-1088', 'HS-2026-1091']);
  const used = new Set<string>();
  const pick = (campus: string, grade: number): SeedStudent => {
    const pool = ctx.students.filter((s) => s.campusCode === campus && !reserved.has(s.admissionNo) && !used.has(s.id));
    const s = pool.sort((a, b) => Math.abs(a.gradeLevel - grade) - Math.abs(b.gradeLevel - grade))[0];
    used.add(s.id);
    return s;
  };
  // [student, from, to, reason, status, requested offset, decided offset, note]
  const T: [SeedStudent, string, string, string, string, number, number | null, string | null][] = [
    [pick('vdv', 7), 'vdv', 'gdv', 'Family relocation', 'Approved', -7, -3, 'Seat available in Grade 7; records checked.'],
    [pick('gdv', 9), 'gdv', 'plc', 'Residential programme', 'Under Review', -4, null, null],
    [pick('gdv', 4), 'gdv', 'vdv', 'Proximity to home', 'Submitted', -2, null, null],
    [pick('gdv', 6), 'gdv', 'vdv', 'Parent job transfer', 'Rejected', -40, -35, 'No seat in Grade 6 at Vadavalli this term; waitlisted.'],
  ];
  for (const [s, from, to, reason, status, req, dec, note] of T) {
    await db.query(
      `INSERT INTO student_transfers (student_id, from_campus_id, to_campus_id, reason, status, requested_on, decided_by, decided_at,
                                      decision_note, requested_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [s.id, C[from].id, C[to].id, reason, status, ctx.day(req), dec == null ? null : ctx.users.principal, dec == null ? null : past(-dec, '12:00'),
        note, ctx.users.office, past(-req, '09:30')]);
  }
  // A completed historical move: the brief's example student now studying at Vadavalli.
  const aarav = ctx.studentByNo['HS-2026-1091'];
  if (aarav) {
    await db.query(
      `INSERT INTO student_transfers (student_id, from_campus_id, to_campus_id, reason, status, requested_on, decided_by, decided_at,
                                      decision_note, requested_by, to_section_id, completed_by, completed_at, created_at)
       VALUES ($1,$2,$3,'Family moved to Coimbatore','Completed',$4,$5,$6,'Approved by both campus heads',$7,$8,$5,$9,$10)`,
      [aarav.id, C.gdv.id, C.vdv.id, ctx.day(-160), ctx.users.principal, past(155, '12:00'), ctx.users.office, aarav.sectionId,
        past(150, '11:00'), past(160, '09:30')]);
  }

  // ---- Group policies (versioned) --------------------------------------------------
  // [name, scope, version, status, effective offset, updated offset, body, [previous versions]]
  const POL: [string, string, string, string, number, number, string, [string, number, string][]][] = [
    ['Group fee structure framework', 'All campuses', 'v4.2', 'Active', -78, -78,
      'Sets the common fee heads, instalment dates, late-fee rules and concession categories used by every campus. Campus fee schedules must stay within the bands published here.',
      [['v4.0', -440, 'Annual revision for 2025–26'], ['v4.1', -300, 'Added sibling concession band']]],
    ['Safeguarding and child protection', 'All campuses', 'v3.0', 'Active', -15, -15,
      'Defines the designated safeguarding leads, reporting routes, record keeping and training requirements for all staff and volunteers.',
      [['v2.4', -520, 'Aligned with POCSO guidance'], ['v2.8', -200, 'Added online safety section']]],
    ['Staff recruitment and verification', 'All campuses', 'v2.6', 'Active', -33, -33,
      'Background verification, reference checks and probation rules for all new joiners, including drivers and attendants.',
      [['v2.5', -250, 'Driver licence verification added']]],
    ['Inter-campus transfer policy', 'All campuses', 'v1.9', 'Under review', -89, -89,
      'A student may move between Edunex campuses once records are checked. Both campus heads approve, and the Student 360 record moves with the student.',
      [['v1.8', -380, 'Fee carry-over rules clarified']]],
    ['Residential programme code of conduct', 'Pollachi', 'v1.0', 'Draft', 0, -6,
      'Draft conduct rules for residential and outdoor programmes at the Outdoor Learning Centre.', []],
  ];
  for (const [name, scope, version, status, eff, upd, body, prev] of POL) {
    const r = await db.query(
      `INSERT INTO group_policies (name, scope, version, body, status, effective_on, updated_by, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [name, scope, version, body, status, status === 'Draft' ? null : ctx.day(eff), ctx.users.principal, past(600), past(-upd, '14:00')]);
    for (const [v, ago, note] of prev) {
      await db.query(
        `INSERT INTO group_policy_versions (policy_id, version, name, scope, body, status, effective_on, change_note, archived_by, archived_at)
         VALUES ($1,$2,$3,$4,$5,'Active',$6,$7,$8,$9)`,
        [r.rows[0].id, v, name, scope, body, ctx.day(ago), note, ctx.users.principal, past(-ago, '14:00')]);
    }
  }
}
