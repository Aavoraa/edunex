/**
 * SAMPLE DATA — workforce domain. Owned by the workforce module.
 * Shifts, a two-week roster (with the Rear Gate cover gap), leave types,
 * balances and requests, overtime, allowances, CPD, employee documents and
 * payroll runs with payslips. Everything is fictional and relative to today.
 *
 * staff_attendance is seeded by core-students (45 days) and is not touched here.
 */
import { EMPLOYEES } from './core-org.js';
import { addDays, bulkInsert, kolkataTime, type Db, type SeedContext } from './context.js';
import { calculatePayslip, defaultOvertimeRate, leaveDays } from '../../backend/src/services/workforce-paycalc.js';

type EmpTuple = (typeof EMPLOYEES)[number];

const LEAVE_TYPES: [string, number][] = [['Casual leave', 7], ['Sick leave', 5], ['Earned leave', 4], ['Compensatory off', 2]];
const ENTITLED_TOTAL = LEAVE_TYPES.reduce((a, [, q]) => a + q, 0); // 18 days

/** Remaining leave (days) shown in the wireframe. */
const LEAVE_LEFT: Record<string, number> = {
  'EMP-1021': 8, 'EMP-1044': 5, 'EMP-1088': 2, 'EMP-2015': 11, 'EMP-2031': 7, 'EMP-2044': 9, 'EMP-3002': 6, 'EMP-3018': 4,
  'EMP-4007': 12, 'EMP-4019': 3, 'EMP-5005': 8, 'EMP-6003': 9, 'EMP-6011': 10, 'EMP-7002': 6, 'EMP-7014': 7,
};

/** Current-month overtime from the wireframe: [code, hours, status, reason]. */
const OVERTIME_NOW: [string, number, string, string][] = [
  ['EMP-4007', 22, 'Under Review', 'Gate cover for absence — rear gate'],
  ['EMP-4019', 16, 'Under Review', 'Gate cover for absence — main gate night'],
  ['EMP-2015', 14, 'Under Review', 'Extra route cover — Route 4 and Route 15'],
  ['EMP-5005', 11, 'Under Review', 'Event support — Founders Day set-up'],
  ['EMP-2031', 9, 'Approved', 'Extra route cover — Route 12 evening'],
  ['EMP-2044', 7, 'Approved', 'Extra route cover — Route 12 evening'],
  ['EMP-6003', 4, 'Approved', 'Event support — robotics open day'],
  ['EMP-3002', 3, 'Approved', 'Event support — admissions open house'],
  ['EMP-1044', 2, 'Approved', 'Event support — science fair'],
  ['EMP-7014', 2, 'Approved', 'Event support — sports day first aid'],
  ['EMP-3018', 1, 'Approved', 'Event support — admissions open house'],
];

const CPD_PROGRAMMES: [string, string][] = [
  ['Cambridge assessment for learning', 'Cambridge Partnership'],
  ['Differentiated instruction workshop', 'Edunex Academy'],
  ['Digital classroom tools', 'Google for Education'],
  ['Inclusive education and SEN awareness', 'Edunex Academy'],
  ['First aid and CPR', 'St John Ambulance'],
  ['Defensive driving and route safety', 'TN Road Safety Council'],
  ['Customer service at the front desk', 'Edunex Academy'],
  ['Fire safety and evacuation', 'TN Fire & Rescue Services'],
  ['Laboratory safety', 'Edunex Academy'],
  ['Leadership for learning', 'Cambridge Partnership'],
];

const monthStart = (date: string, offset = 0) => {
  const d = new Date(`${date.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + offset);
  return d.toISOString().slice(0, 10);
};
const monthEnd = (first: string) => addDays(monthStart(first, 1), -1);
const mondayOf = (date: string) => {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDays(date, dow === 0 ? -6 : 1 - dow);
};

function parseShift(name: string) {
  const t = name.match(/\d{2}:\d{2}/g) ?? ['08:00', '16:00'];
  return { starts: t[0], ends: t[1], splitStarts: t[2] ?? null, splitEnds: t[3] ?? null };
}

export async function seed(db: Db, ctx: SeedContext): Promise<void> {
  const emp = (code: string) => ctx.employees[code];
  const byCode = new Map<string, EmpTuple>(EMPLOYEES.map((e) => [e[0], e]));
  const hr = ctx.users.hr;
  const principal = ctx.users.principal;
  const today = ctx.today;
  const clampPast = (d: Date) => (d > ctx.now ? new Date(ctx.now.getTime() - 60_000) : d);

  // Agreed teaching maximum (27 periods) for classroom teachers.
  await db.query(
    `UPDATE teachers t SET max_periods_week = 27 FROM employees e WHERE e.id = t.employee_id AND e.category = 'Teachers'`,
  );

  // ---- Shifts ----------------------------------------------------------------
  const shiftId: Record<string, string> = {};
  for (const name of [...new Set(EMPLOYEES.map((e) => e[7]))]) {
    const s = parseShift(name);
    const r = await db.query(
      `INSERT INTO shifts (name, starts_at, ends_at, split_starts_at, split_ends_at) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [name, s.starts, s.ends, s.splitStarts, s.splitEnds],
    );
    shiftId[name] = r.rows[0].id;
  }
  const DAY = 'Day 06:00–14:00', NIGHT = 'Night 20:00–06:00';

  // ---- Roster: this week and next (Mon–Sat) ------------------------------------
  const monday = mondayOf(today);
  const roster: unknown[][] = [];
  const statusFor = (d: string) => (d < today ? 'Completed' : 'Scheduled');
  const put = (code: string, shift: string, d: string, post: string, status?: string, coveredBy?: string) =>
    roster.push([emp(code), shiftId[shift], d, post, status ?? statusFor(d), coveredBy ? emp(coveredBy) : null]);
  const rekhaLeave = addDays(today, 2);
  for (let w = 0; w < 2; w++) {
    const days = Array.from({ length: 6 }, (_, i) => addDays(monday, w * 7 + i));
    const gateDay = ['EMP-4007', 'EMP-4007', 'EMP-4019', 'EMP-4019', 'EMP-4007', null];
    const gateNight = ['EMP-4019', 'EMP-4019', 'EMP-4007', 'EMP-4007', 'EMP-4019', null];
    days.forEach((d, i) => {
      const gap = w === 0 && i === 3; // Thursday this week: rear gate day shift uncovered
      if (gateDay[i]) put(gateDay[i]!, DAY, d, 'Gate security — day · Rear Gate', gap ? 'Cover needed' : undefined);
      if (gateNight[i]) put(gateNight[i]!, NIGHT, d, 'Gate security — night · Main Gate');
      put('EMP-4022', DAY, d, 'Gate security — day · Main Gate');
      if (i < 5) {
        for (const [code, route] of [['EMP-2031', '12'], ['EMP-2032', '4'], ['EMP-2033', '7'], ['EMP-2034', '9'], ['EMP-2035', '2'], ['EMP-2036', '15']]) {
          put(code, byCode.get(code)![7], d, `Transport — morning · Route ${route}`);
        }
        const duty = i === 2 ? 'Depot inspection' : i === 4 ? 'Vehicle fitness — Bus 4, Bus 15' : 'Route supervision';
        if (d !== ctx.day(2)) put('EMP-2015', byCode.get('EMP-2015')![7], d, `Transport — supervision · ${duty}`);
        put('EMP-5011', 'Day 07:00–15:00', d, 'Housekeeping — early · Main block');
        put('EMP-7014', 'Day 07:30–16:30', d, 'Health room · Infirmary');
      }
      if (d === rekhaLeave) put('EMP-5005', 'Day 07:00–15:00', d, 'Housekeeping — early · Main block', 'Covered', 'EMP-5011');
      else put('EMP-5005', 'Day 07:00–15:00', d, 'Housekeeping — early · Main block');
      put([1, 3].includes(i) ? 'EMP-3018' : 'EMP-3002', 'General 08:30–17:00', d, 'Front office · Reception');
    });
  }
  // A person can only hold one roster line per day; keep the first.
  const seen = new Set<string>();
  const uniqueRoster = roster.filter((r) => {
    const k = `${r[0]}|${r[2]}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  await bulkInsert(db, 'shift_rosters', ['employee_id', 'shift_id', 'roster_date', 'post', 'status', 'covered_by'], uniqueRoster);

  // ---- Leave types and balances --------------------------------------------------
  const leaveType: Record<string, string> = {};
  for (const [name, quota] of LEAVE_TYPES) {
    const r = await db.query('INSERT INTO leave_types (name, annual_quota) VALUES ($1,$2) RETURNING id', [name, quota]);
    leaveType[name] = r.rows[0].id;
  }
  const balances: unknown[][] = [];
  for (const [code] of EMPLOYEES) {
    // Spread the used days across casual / sick / compensatory one at a time;
    // earned leave is only drawn once those are exhausted.
    let used = ENTITLED_TOTAL - (LEAVE_LEFT[code] ?? ctx.int(4, 14));
    const u = LEAVE_TYPES.map(() => 0);
    const earnedIdx = LEAVE_TYPES.findIndex(([n]) => n === 'Earned leave');
    while (used > 0) {
      let moved = false;
      for (let i = 0; i < LEAVE_TYPES.length && used > 0; i++) {
        if (i !== earnedIdx && u[i] < LEAVE_TYPES[i][1]) { u[i]++; used--; moved = true; }
      }
      if (!moved) { u[earnedIdx] += used; used = 0; }
    }
    LEAVE_TYPES.forEach(([name, quota], i) => balances.push([emp(code), leaveType[name], ctx.yearId, quota, u[i]]));
  }
  await bulkInsert(db, 'leave_balances', ['employee_id', 'leave_type_id', 'academic_year_id', 'entitled', 'used'], balances);

  // ---- Leave requests: wireframe four (+ Murugan) and history ----------------------
  const leaveRows: unknown[][] = [];
  const decided = (d: string) => clampPast(kolkataTime(d, '11:30'));
  const lv = (code: string, e: string, type: string, from: string, to: string, status: string, cover: string | null, reason: string, created: string, note?: string) => {
    const days = Math.max(1, leaveDays(from, to));
    const isDecided = ['Approved', 'Rejected'].includes(status);
    leaveRows.push([code, emp(e), leaveType[type], from, to, days, reason, cover, status,
      isDecided ? hr : null, isDecided ? decided(addDays(created, 1) > today ? today : addDays(created, 1)) : null, note ?? null,
      clampPast(kolkataTime(created, '09:15'))]);
  };
  lv('LV-882', 'EMP-1088', 'Casual leave', ctx.day(-1), today, 'Under Review', 'Ms. Lalitha R.', 'Family function in Madurai', ctx.day(-4));
  lv('LV-879', 'EMP-4019', 'Sick leave', ctx.day(-1), ctx.day(-1), 'Approved', 'Devendran M. (OT)', 'Fever — medical certificate attached', ctx.day(-2));
  lv('LV-874', 'EMP-1044', 'Earned leave', ctx.day(7), ctx.day(10), 'Submitted', null, 'Travel to a family wedding', ctx.day(-1));
  lv('LV-871', 'EMP-2015', 'Casual leave', ctx.day(2), ctx.day(2), 'Approved', 'Team rota', 'Personal work at the RTO', ctx.day(-5));
  lv('LV-870', 'EMP-5005', 'Casual leave', ctx.day(2), ctx.day(2), 'Approved', 'Team rota', 'Personal work', ctx.day(-6));
  const historyPeople = EMPLOYEES.map((e) => e[0]).filter((c) => !['EMP-1001'].includes(c));
  const types = ['Casual leave', 'Casual leave', 'Sick leave', 'Sick leave', 'Earned leave', 'Compensatory off'];
  for (let n = 800; n < 868; n++) {
    const from = ctx.day(-ctx.int(8, 170));
    const span = ctx.rand() < 0.7 ? 0 : ctx.int(1, 3);
    const status = ctx.rand() < 0.1 ? 'Rejected' : 'Approved';
    lv(`LV-${n}`, ctx.pick(historyPeople), ctx.pick(types), from, addDays(from, span), status,
      ctx.pick(['Team rota', 'Substitute teacher', 'Named colleague', 'Not required']),
      ctx.pick(['Personal work', 'Medical appointment', 'Family function', 'Fever', 'Travel']), addDays(from, -ctx.int(2, 6)),
      status === 'Rejected' ? 'Clashes with term examinations — please choose other dates' : undefined);
  }
  await bulkInsert(db, 'leave_requests',
    ['code', 'employee_id', 'leave_type_id', 'from_date', 'to_date', 'days', 'reason', 'cover_arrangement', 'status', 'decided_by', 'decided_at', 'decision_note', 'created_at'],
    leaveRows);

  // ---- Overtime ---------------------------------------------------------------------
  const curMonth = monthStart(today);
  const otRows: unknown[][] = [];
  const basicOf = (code: string) => byCode.get(code)![9];
  for (const [code, hours, status, reason] of OVERTIME_NOW) {
    let d = ctx.day(-ctx.int(1, 12));
    if (d < curMonth) d = curMonth > ctx.day(-1) ? today : curMonth;
    otRows.push([emp(code), d, hours, reason, defaultOvertimeRate(basicOf(code)), status, status === 'Approved' ? hr : null]);
  }
  const otPeople = EMPLOYEES.filter((e) => ['Transport', 'Security', 'Housekeeping'].includes(e[2])).map((e) => e[0]);
  for (let m = -3; m <= -1; m++) {
    const first = monthStart(today, m);
    for (const code of otPeople) {
      if (ctx.rand() < 0.4) continue;
      otRows.push([emp(code), addDays(first, ctx.int(2, 26)), ctx.int(2, 12), ctx.pick(['Extra route cover', 'Gate cover for absence', 'Event support']),
        defaultOvertimeRate(basicOf(code)), 'Paid', principal]);
    }
  }
  await bulkInsert(db, 'overtime_entries', ['employee_id', 'work_date', 'hours', 'reason', 'rate_per_hour', 'status', 'approved_by'], otRows);

  // ---- Allowances -------------------------------------------------------------------
  const effective = monthStart(today, -3);
  const allowanceRows: unknown[][] = [];
  for (const [code, , , , type, category, , , , basic] of EMPLOYEES) {
    const teaching = type === 'teaching';
    allowanceRows.push([emp(code), 'House rent allowance', Math.round(basic * (teaching ? 0.4 : 0.3)), 'Monthly', effective, 'Approved']);
    allowanceRows.push([emp(code), 'Conveyance', teaching ? 3200 : 1600, 'Monthly', effective, 'Approved']);
    allowanceRows.push([emp(code), 'Special allowance', code === 'EMP-1021' ? 6400 : Math.round((basic * 0.15) / 100) * 100, 'Monthly', effective, 'Approved']);
    if (category === 'Drivers & Attendants') allowanceRows.push([emp(code), 'Transport duty', 1500, 'Monthly', effective, 'Approved']);
  }
  allowanceRows.push([emp('EMP-2015'), 'Uniform allowance', 2500, 'One-time', curMonth, 'Approved']);
  allowanceRows.push([emp('EMP-1096'), 'Event support allowance', 6000, 'One-time', curMonth, 'Submitted']);
  allowanceRows.push([emp('EMP-1098'), 'Event support allowance', 6000, 'One-time', curMonth, 'Submitted']);
  await bulkInsert(db, 'allowances', ['employee_id', 'allowance_type', 'amount', 'frequency', 'effective_month', 'status'], allowanceRows);

  // ---- CPD records (completed hours add up to employees.cpd_hours) ---------------------
  const cpdRows: unknown[][] = [];
  for (const [code, , dept, , type, , , , , , , cpd] of EMPLOYEES) {
    const outstanding = code === 'EMP-3018';
    const mandatory = Math.min(2, cpd);
    cpdRows.push([emp(code), 'Child protection refresher', 'Edunex Safeguarding Team', outstanding ? 2 : mandatory,
      outstanding ? null : ctx.day(-ctx.int(20, 90)), outstanding ? 'Planned' : 'Completed']);
    let left = cpd - (outstanding ? 0 : mandatory);
    const pool = CPD_PROGRAMMES.filter(([p]) =>
      type === 'teaching' ? !/driving|front desk/i.test(p) : dept === 'Transport' ? /driving|First aid|Fire/.test(p) : /First aid|Fire|front desk|Laboratory|Inclusive/.test(p));
    let i = 0;
    while (left > 0) {
      const h = Math.min(left, ctx.int(3, 8));
      const [programme, provider] = pool[i++ % pool.length];
      cpdRows.push([emp(code), programme, provider, h, ctx.day(-ctx.int(10, 330)), 'Completed']);
      left -= h;
    }
    if (type === 'teaching' && ctx.rand() < 0.5) {
      cpdRows.push([emp(code), 'Cambridge assessment for learning — level 2', 'Cambridge Partnership', 6, null, ctx.rand() < 0.5 ? 'Planned' : 'In Progress']);
    }
  }
  await bulkInsert(db, 'cpd_records', ['employee_id', 'programme', 'provider', 'hours', 'completed_on', 'status'], cpdRows);

  // ---- Employee documents ---------------------------------------------------------------
  const verifiedRes = await db.query(`SELECT id, background_verified FROM employees`);
  const verified = new Map<string, boolean>(verifiedRes.rows.map((r) => [r.id, r.background_verified]));
  const docRows: unknown[][] = [];
  for (const [code] of EMPLOYEES) {
    const id = emp(code);
    const bgOk = verified.get(id) && code !== 'EMP-3018';
    for (const [name, category, ok] of [
      ['Employment contract', 'Contract', true], ['Identity proof', 'Identity', true], ['Qualification certificates', 'Qualification', true],
      ['Background verification', 'Compliance', bgOk], ['Child-protection training', 'Compliance', code !== 'EMP-3018'],
    ] as [string, string, boolean][]) {
      docRows.push(['employee', id, id, name, category, ok ? 'Verified' : 'Pending', ok ? hr : null, ok ? clampPast(kolkataTime(ctx.day(-ctx.int(30, 300)), '12:00')) : null, ok ? null : ctx.day(-5)]);
    }
  }
  await bulkInsert(db, 'documents', ['owner_type', 'owner_id', 'employee_id', 'name', 'category', 'status', 'verified_by', 'verified_at', 'requested_on'], docRows);

  // ---- Payroll: three paid months + current month under review --------------------------
  const attendance = await db.query(
    `SELECT employee_id, sum(CASE WHEN status IN ('Present', 'Late', 'On Leave') THEN 1 WHEN status = 'Half Day' THEN 0.5 ELSE 0 END)::float AS days
       FROM staff_attendance WHERE attendance_date >= $1 AND attendance_date <= $2 GROUP BY employee_id`,
    [curMonth, today],
  );
  const curDays = new Map<string, number>(attendance.rows.map((r) => [r.employee_id, Number(r.days)]));
  const otByMonth = new Map<string, { hours: number; amount: number }>();
  for (const r of otRows) {
    const [eid, d, hours, , rate, status] = r as [string, string, number, string, number, string];
    if (!['Approved', 'Paid'].includes(status)) continue;
    const k = `${eid}|${monthStart(d)}`;
    const cur = otByMonth.get(k) ?? { hours: 0, amount: 0 };
    cur.hours += hours;
    cur.amount += hours * rate;
    otByMonth.set(k, cur);
  }
  const allowancesFor = (eid: string, month: string) =>
    (allowanceRows as [string, string, number, string, string, string][])
      .filter(([id, , , freq, eff, status]) => id === eid && status === 'Approved' && (freq === 'Monthly' ? eff <= month : eff === month))
      .map(([, label, amount]) => ({ label, amount }));

  for (const campus of ['gdv', 'vdv', 'plc']) {
    const people = EMPLOYEES.filter((e) => e[6] === campus);
    for (let m = -3; m <= 0; m++) {
      const month = monthStart(today, m);
      const current = m === 0;
      const last = monthEnd(month);
      const workingDays = ctx.schoolDays(month, current ? today : last, true).length;
      const slips: unknown[][] = [];
      const totals = { gross: 0, ded: 0, ot: 0, allow: 0, net: 0 };
      for (const e of people) {
        const eid = emp(e[0]);
        const ot = otByMonth.get(`${eid}|${month}`) ?? { hours: 0, amount: 0 };
        const p = calculatePayslip({ basic: e[9], allowances: allowancesFor(eid, month), overtimeHours: ot.hours, overtimeAmount: ot.amount, reimbursements: 0 });
        const days = current ? curDays.get(eid) ?? workingDays : Math.max(0, workingDays - (ctx.rand() < 0.3 ? 1 : 0));
        slips.push([eid, JSON.stringify(p.earnings), JSON.stringify(p.deductions), p.gross, p.totalDeductions, p.net, days,
          current ? 'Draft' : 'Released', current ? null : kolkataTime(last, '18:00')]);
        totals.gross += p.gross; totals.ded += p.totalDeductions; totals.ot += p.overtimeTotal; totals.allow += p.allowancesTotal; totals.net += p.net;
      }
      const calcAt = current ? clampPast(kolkataTime(ctx.day(-1), '17:00')) : kolkataTime(addDays(last, -3), '16:00');
      const run = await db.query(
        `INSERT INTO payroll_runs (campus_id, pay_month, status, employee_count, gross_total, deductions_total, overtime_total,
                                   allowances_total, net_total, approved_by, approved_at, released_at, released_by, paid_at,
                                   created_by, created_at, calculated_by, calculated_at, submitted_by, submitted_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$10,$13,$14,$15,$14,$16,$14,$16) RETURNING id`,
        [ctx.campuses[campus].id, month, current ? 'Under Review' : 'Paid', people.length,
          ...[totals.gross, totals.ded, totals.ot, totals.allow, totals.net].map((x) => Math.round(x * 100) / 100),
          current ? null : principal, current ? null : kolkataTime(addDays(last, -1), '10:00'),
          current ? null : kolkataTime(last, '18:00'), current ? null : kolkataTime(last, '18:30'),
          hr, current ? clampPast(kolkataTime(ctx.day(-3), '10:00')) : kolkataTime(addDays(last, -8), '10:00'), calcAt],
      );
      await db.query(
        `UPDATE overtime_entries o SET payroll_run_id = $1 FROM employees e
          WHERE e.id = o.employee_id AND e.campus_id = $2 AND date_trunc('month', o.work_date) = $3::date AND o.status IN ('Approved', 'Paid')`,
        [run.rows[0].id, ctx.campuses[campus].id, month],
      );
      await bulkInsert(db, 'payslips',
        ['employee_id', 'earnings', 'deductions', 'gross', 'total_deductions', 'net', 'days_worked', 'status', 'released_at', 'payroll_run_id'],
        slips.map((s) => [...s, run.rows[0].id]));
    }
  }
}
