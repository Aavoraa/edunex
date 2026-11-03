/**
 * SAMPLE DATA — finance domain. Owned by the finance module.
 *
 * Fee heads, per-class fee structures for the current year, a ledger for
 * every student consistent with their core `feeProfile`, payments and
 * allocations, concessions, scholarships, expenses, reimbursements,
 * allowances, budgets and bank statement lines. Everything is fictional and
 * dated relative to ctx.today; no "happened" timestamp is in the future.
 */
import { randomUUID } from 'node:crypto';
import { addDays, bulkInsert, type Db, type SeedContext, type SeedStudent } from './context.js';

type Charge = {
  id: string; studentId: string; head: string; structureId: string | null; desc: string;
  due: string; created: string; amount: number; concession: number; paid: number;
};
type Payment = {
  id: string; studentId: string; amount: number; method: string; at: Date; parentId: string | null;
  collectedBy: string | null; ref: string | null; status: string; alloc: { feeId: string; amount: number }[];
  receiptNo?: string; sent?: Date | null; reconciled?: boolean;
};

const HEADS: [code: string, name: string, optional: boolean][] = [
  ['TUITION', 'Tuition', false], ['TRANSPORT', 'Transport', true], ['ACTIVITIES', 'Activities', true],
  ['TRIPS', 'Trips', true], ['UNIFORM', 'Uniform', true], ['BOOKS', 'Books & Materials', true],
];

/** Annual amounts by campus and grade (wireframe fee structures). */
function annual(campus: string, g: number) {
  if (campus === 'plc') return { tuition: 164000, transport: 0, activities: 24000, terms: 2 };
  if (campus === 'vdv') {
    return { tuition: g <= 6 ? 98000 : g <= 8 ? 118000 : 150000, transport: 22000, activities: g <= 6 ? 7500 : g <= 8 ? 9000 : 12000, terms: 3 };
  }
  return {
    tuition: g <= 6 ? 126000 : g <= 8 ? 148000 : g <= 10 ? 186000 : 214000, transport: 28800,
    activities: g <= 6 ? 9000 : g <= 8 ? 12000 : g <= 10 ? 15000 : 18000, terms: 3,
  };
}

export async function seed(db: Db, ctx: SeedContext): Promise<void> {
  const Y = ctx.yearStart;
  const today = ctx.today;
  const D = (n: number) => addDays(Y, n);
  const minDate = (a: string, b: string) => (a < b ? a : b);
  const maxDate = (a: string, b: string) => (a > b ? a : b);
  const between = (a: string, b: string) => {
    if (b <= a) return a;
    const span = Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
    return addDays(a, ctx.int(0, span));
  };
  const hhmm = () => `${String(ctx.int(7, 21)).padStart(2, '0')}:${String(ctx.int(0, 59)).padStart(2, '0')}`;
  const stamp = (date: string, time = hhmm()) => {
    const t = ctx.at(date, time);
    return t > ctx.now ? new Date(ctx.now.getTime() - ctx.int(5, 180) * 60000) : t;
  };
  const created = (date: string) => stamp(minDate(date, today), '09:00');

  // Term calendar (relative to the academic year start: 1 Jun → 10 Jun / 10 Jul / 10 Oct)
  const TERM_DUE = { 'Term 1': D(9), 'Term 2': D(39), 'Term 3': D(131) } as Record<string, string>;
  const TERM_RAISED = { 'Term 1': D(-60), 'Term 2': D(9), 'Term 3': D(60) } as Record<string, string>;
  const PLC_DUE = { 'Term 1': D(9), 'Term 2': D(131) } as Record<string, string>;

  // ---- Fee heads ----------------------------------------------------------------
  const head: Record<string, string> = {};
  for (const [code, name, optional] of HEADS) {
    const r = await db.query('INSERT INTO fee_heads (code, name, is_optional) VALUES ($1,$2,$3) RETURNING id', [code, name, optional]);
    head[code] = r.rows[0].id;
  }

  // ---- Fee structures (every class of the current year) --------------------------------
  const classRows = (await db.query(
    `SELECT c.id, c.grade_level, cp.code AS campus FROM classes c JOIN campuses cp ON cp.id = c.campus_id`)).rows as { id: string; grade_level: number; campus: string }[];
  const structure: Record<string, string> = {}; // `${classId}:${HEAD}:${term}` → id
  const fsRows: unknown[][] = [];
  for (const c of classRows) {
    const a = annual(c.campus, c.grade_level);
    const terms = a.terms === 2 ? ['Term 1', 'Term 2'] : ['Term 1', 'Term 2', 'Term 3'];
    const dues = a.terms === 2 ? PLC_DUE : TERM_DUE;
    for (const t of terms) {
      const id = randomUUID();
      structure[`${c.id}:TUITION:${t}`] = id;
      fsRows.push([id, ctx.yearId, c.id, head.TUITION, t, Math.round(a.tuition / a.terms), dues[t], 'Active', ctx.users.finance]);
      if (a.transport) {
        const tid = randomUUID();
        structure[`${c.id}:TRANSPORT:${t}`] = tid;
        fsRows.push([tid, ctx.yearId, c.id, head.TRANSPORT, t, Math.round(a.transport / a.terms), dues[t], 'Active', ctx.users.finance]);
      }
    }
    const aid = randomUUID();
    structure[`${c.id}:ACTIVITIES:Annual`] = aid;
    // The Pollachi residential programme's structure is still being reviewed.
    fsRows.push([aid, ctx.yearId, c.id, head.ACTIVITIES, 'Annual', a.activities, D(75), c.campus === 'plc' ? 'Draft' : 'Active', ctx.users.finance]);
  }
  await bulkInsert(db, 'fee_structures', ['id', 'academic_year_id', 'class_id', 'fee_head_id', 'term', 'amount', 'due_date', 'status', 'created_by'], fsRows);

  const routeName: Record<string, string> = {};
  for (const r of (await db.query('SELECT code, name FROM transport_routes')).rows) routeName[r.code] = r.name;

  // ---- Charges per student ------------------------------------------------------------
  const charges: Charge[] = [];
  const byStudent = new Map<string, Charge[]>();
  const add = (s: SeedStudent, headCode: string, desc: string, amount: number, due: string, raised: string, structureId: string | null = null) => {
    if (raised > today) return null; // not invoiced yet
    const c: Charge = { id: randomUUID(), studentId: s.id, head: headCode, structureId, desc, due, created: raised, amount, concession: 0, paid: 0 };
    charges.push(c);
    if (!byStudent.has(s.id)) byStudent.set(s.id, []);
    byStudent.get(s.id)!.push(c);
    return c;
  };

  const ADITYA = 'HS-2026-1041';
  for (const s of ctx.students) {
    const a = annual(s.campusCode, s.gradeLevel);
    const terms = a.terms === 2 ? ['Term 1', 'Term 2'] : ['Term 1', 'Term 2', 'Term 3'];
    const dues = a.terms === 2 ? PLC_DUE : TERM_DUE;
    for (const t of terms) {
      const raised = a.terms === 2 && t === 'Term 2' ? D(60) : TERM_RAISED[t];
      add(s, 'TUITION', `Tuition — ${t}`, Math.round(a.tuition / a.terms), dues[t], raised, structure[`${s.classId}:TUITION:${t}`]);
      if (s.routeCode && a.transport) {
        add(s, 'TRANSPORT', `Transport — ${routeName[s.routeCode] ?? s.routeCode}, ${t}`, Math.round(a.transport / a.terms), dues[t], raised, structure[`${s.classId}:TRANSPORT:${t}`]);
      }
    }
    if (s.admissionNo === ADITYA) {
      add(s, 'ACTIVITIES', 'Activities — Robotics Lab', 4500, D(116), D(85));
      add(s, 'TRIPS', 'Residential trip — Pollachi', 6800, D(121), D(90));
      continue;
    }
    // Activities: annual package, a single club, or nothing
    const r = ctx.rand();
    if (r < 0.55) add(s, 'ACTIVITIES', 'Activities — Annual programme', a.activities, D(75), D(45), structure[`${s.classId}:ACTIVITIES:Annual`] && s.campusCode !== 'plc' ? structure[`${s.classId}:ACTIVITIES:Annual`] : null);
    else if (r < 0.8) add(s, 'ACTIVITIES', `Activities — ${ctx.pick(['Robotics Lab', 'Swimming', 'Music Academy', 'Chess Club', 'Theatre'])}`, ctx.pick([3500, 4500, 5000, 6000]), D(116), D(85));
    // Trips
    if (s.campusCode === 'gdv' && s.gradeLevel >= 5 && s.gradeLevel <= 8 && ctx.rand() < 0.45) add(s, 'TRIPS', 'Residential trip — Pollachi', 6800, D(121), D(90));
    else if (s.feeProfile === 'Overdue' || ctx.rand() < 0.35) add(s, 'TRIPS', 'Field trip — Science centre', 1800, D(100), D(70));
    // One-time purchases at re-enrolment
    if (ctx.rand() < 0.55) add(s, 'UNIFORM', 'Uniform set', s.gradeLevel <= 6 ? 4200 : 5200, D(9), D(-20));
    if (ctx.rand() < 0.6) add(s, 'BOOKS', 'Books & Materials', s.gradeLevel <= 6 ? 5400 : s.gradeLevel <= 10 ? 7800 : 9600, D(9), D(-20));
  }

  // ---- Concessions (applied to tuition before payments were taken) ----------------------
  const byNo = ctx.studentByNo;
  const annualTuition = (s: SeedStudent) => annual(s.campusCode, s.gradeLevel).tuition;
  const conRows: unknown[][] = [];
  const principal = ctx.users.principal;
  const applyConcession = (s: SeedStudent, amount: number) => {
    let left = amount;
    const tuition = (byStudent.get(s.id) ?? []).filter((c) => c.head === 'TUITION').sort((x, y) => (x.due < y.due ? 1 : -1));
    for (const c of tuition) {
      if (left <= 0) break;
      const take = Math.min(left, c.amount - c.concession);
      c.concession += take;
      left -= take;
    }
    return amount - left;
  };
  const concession = (s: SeedStudent | undefined, type: string, opts: { percent?: number; amount?: number; status: string; reason: string; daysAgo: number; approver?: string }) => {
    if (!s) return;
    const value = opts.amount ?? Math.round((annualTuition(s) * (opts.percent ?? 0)) / 100);
    const applied = opts.status === 'Approved' ? applyConcession(s, value) : value;
    const decided = ['Approved', 'Rejected'].includes(opts.status);
    conRows.push([s.id, type, opts.percent ?? null, applied, ctx.yearId, opts.status, opts.reason,
      decided ? (opts.approver ?? principal) : null, decided ? stamp(ctx.day(-opts.daysAgo + 2), '11:30') : null,
      ctx.users.finance, stamp(ctx.day(-opts.daysAgo), '10:15')]);
  };
  const pool = ctx.students.filter((s) => !['HS-2026-1041', 'HS-2026-1042', 'HS-2026-1070', 'HS-2026-1090', 'HS-2026-1073', 'HS-2026-1064'].includes(s.admissionNo));
  const pickFrom = (n: number) => {
    const out: SeedStudent[] = [];
    while (out.length < n && pool.length) out.push(pool.splice(Math.floor(ctx.rand() * pool.length), 1)[0]);
    return out;
  };
  const approvedAgo = () => ctx.int(95, 110); // decided before the year began
  for (const s of pickFrom(7)) concession(s, 'Sibling concession', { percent: 10, status: 'Approved', reason: 'Sibling enrolled at Edunex', daysAgo: approvedAgo() });
  for (const s of pickFrom(3)) concession(s, 'Staff ward concession', { percent: 25, status: 'Approved', reason: 'Ward of a permanent staff member', daysAgo: approvedAgo() });
  for (const s of pickFrom(2)) concession(s, 'Need-based support', { percent: 30, status: 'Approved', reason: 'Family circumstances, verified by the counsellor', daysAgo: approvedAgo() });
  for (const s of pickFrom(2)) concession(s, 'Merit scholarship', { amount: 30000, status: 'Approved', reason: 'Top 5% in the annual assessment', daysAgo: approvedAgo() });
  concession(byNo['HS-2026-1070'], 'Merit scholarship', { amount: 62000, status: 'Approved', reason: 'Top 2% across three terms', daysAgo: 104 });
  concession(byNo['HS-2026-1090'], 'Merit scholarship', { amount: 40000, status: 'Approved', reason: 'Innovation award — State science expo selection', daysAgo: 100 });
  concession(byNo['HS-2026-1073'], 'Need-based support', { amount: 48000, status: 'Under Review', reason: 'Family circumstances, verified', daysAgo: 6 });
  concession(byNo['HS-2026-1064'], 'Sports quota', { amount: 30000, status: 'Submitted', reason: 'District athletics representation', daysAgo: 2 });
  for (const s of pickFrom(2)) concession(s, 'Sibling concession', { percent: 10, status: 'Submitted', reason: 'Younger sibling joined this year', daysAgo: ctx.int(1, 4) });
  for (const s of pickFrom(1)) concession(s, 'Staff ward concession', { percent: 25, status: 'Rejected', reason: 'Parent is on a fixed-term contract — not eligible', daysAgo: 20 });

  // ---- Payments -------------------------------------------------------------------------
  const payments: Payment[] = [];
  const METHODS: [string, number][] = [['UPI', 58], ['Net Banking', 21], ['Card', 14], ['Cash', 4], ['DD', 3]];
  const pickMethod = () => {
    let x = ctx.rand() * 100;
    for (const [m, w] of METHODS) { if ((x -= w) < 0) return m; }
    return 'UPI';
  };
  const bal = (c: Charge) => c.amount - c.concession - c.paid;
  let seq = 0;
  const refFor = (m: string, at: Date) => {
    const d = at.toISOString().replace(/\D/g, '').slice(0, 12);
    seq++;
    if (m === 'UPI') return `UPI/${d}${String(1000 + seq).slice(-4)}`;
    if (m === 'Card') return `CARD-${d.slice(2)}-${String(seq).padStart(4, '0')}`;
    if (m === 'Net Banking') return `NB-${d.slice(2)}-${String(seq).padStart(4, '0')}`;
    if (m === 'DD') return `DD-${ctx.int(100000, 999999)}`;
    return null;
  };
  const pay = (s: SeedStudent, list: Charge[], date: string, opts: { amount?: number; method?: string; time?: string } = {}) => {
    const open = list.filter((c) => bal(c) > 0);
    if (!open.length) return;
    let amount = opts.amount ?? open.reduce((a, c) => a + bal(c), 0);
    const at = stamp(date, opts.time);
    const method = opts.method ?? pickMethod();
    const online = ['UPI', 'Card', 'Net Banking'].includes(method);
    const p: Payment = {
      id: randomUUID(), studentId: s.id, amount, method, at, status: 'Success', alloc: [],
      parentId: online && ctx.rand() < 0.8 ? s.parentId ?? null : null,
      collectedBy: online ? null : ctx.pick([ctx.users.office, ctx.users.finance]),
      ref: refFor(method, at),
    };
    for (const c of open.sort((x, y) => (x.due < y.due ? -1 : 1))) {
      if (amount <= 0) break;
      const take = Math.min(amount, bal(c));
      c.paid += take;
      amount -= take;
      p.alloc.push({ feeId: c.id, amount: take });
    }
    payments.push(p);
  };
  const groups = (list: Charge[]) => {
    const m = new Map<string, Charge[]>();
    for (const c of list) m.set(c.due, [...(m.get(c.due) ?? []), c]);
    return [...m.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
  };
  const payDate = (due: string, raised: string) => minDate(between(maxDate(raised, addDays(due, -20)), addDays(due, 2)), today);

  let todayPayers = 0;
  for (const s of ctx.students) {
    const list = byStudent.get(s.id) ?? [];
    if (s.admissionNo === ADITYA) {
      // Exactly the wireframe ledger.
      const t1 = list.filter((c) => c.desc.endsWith('Term 1'));
      const t2 = list.filter((c) => c.desc.endsWith('Term 2'));
      const t3 = list.find((c) => c.desc === 'Tuition — Term 3');
      pay(s, t1, D(-54), { method: 'Net Banking', time: '19:12' });
      pay(s, t2, D(38), { method: 'UPI', time: '08:47' });
      if (t3) pay(s, [t3], D(72), { method: 'UPI', amount: 20000, time: '21:05' });
      continue;
    }
    for (const [due, g] of groups(list)) {
      const raised = g.reduce((a, c) => minDate(a, c.created), g[0].created);
      const isPast = due < today;
      if (s.feeProfile === 'Paid') {
        let date = isPast ? payDate(due, raised) : between(addDays(raised, 1), today);
        if (!isPast && g.some((c) => c.head === 'TUITION') && todayPayers < 7) { date = today; todayPayers++; }
        pay(s, g, minDate(date, today));
      } else if (s.feeProfile === 'Partial') {
        if (isPast) pay(s, g, payDate(due, raised));
        else {
          const tuition = g.find((c) => c.head === 'TUITION');
          if (tuition) {
            const part = Math.min(Math.max(5000, Math.round((bal(tuition) * (0.3 + ctx.rand() * 0.3)) / 1000) * 1000), bal(tuition) - 1000);
            if (part > 0) pay(s, [tuition], minDate(between(addDays(raised, 3), today), today), { amount: part });
          }
        }
      } else {
        // Overdue: the first term was paid; the latest past-due term and some extras were not.
        const hasTerm1 = g.some((c) => c.desc.endsWith('Term 1'));
        if (isPast && hasTerm1) {
          const extras = g.filter((c) => c.head === 'UNIFORM' || c.head === 'BOOKS');
          const core = g.filter((c) => !extras.includes(c));
          pay(s, core, payDate(due, raised));
          if (extras.length && ctx.rand() < 0.5) pay(s, extras, payDate(due, raised));
        } else if (isPast && g.every((c) => c.head === 'ACTIVITIES') && ctx.rand() < 0.4) {
          pay(s, g, payDate(due, raised));
        }
      }
    }
  }

  // A few failed / abandoned gateway attempts in the last days (no allocations).
  const failed: Payment[] = [];
  for (let i = 0; i < 3; i++) {
    const s = ctx.pick(ctx.students.filter((x) => x.feeProfile !== 'Paid'));
    const at = stamp(ctx.day(-i), hhmm());
    const method = ctx.pick(['UPI', 'Card', 'Net Banking']);
    failed.push({ id: randomUUID(), studentId: s.id, amount: ctx.pick([12000, 18600, 42000]), method, at, parentId: s.parentId ?? null,
      collectedBy: null, ref: refFor(method, at), status: i === 1 ? 'Initiated' : 'Failed', alloc: [] });
  }

  // Receipt numbers in payment order; delivery and reconciliation flags.
  payments.sort((a, b) => a.at.getTime() - b.at.getTime());
  const counters: Record<string, number> = {};
  const recentCutoff = ctx.day(-14);
  const dateOf = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
  for (const p of payments) {
    const yr = dateOf(p.at).slice(0, 4);
    counters[yr] = (counters[yr] ?? 8200) + 1; // continues an existing ledger
    p.receiptNo = `RCT-${yr}-${String(counters[yr]).padStart(6, '0')}`;
    const sentAt = new Date(p.at.getTime() + 40000);
    p.sent = ctx.rand() < 0.93 && sentAt <= ctx.now ? sentAt : null;
    const online = ['UPI', 'Card', 'Net Banking'].includes(p.method);
    p.reconciled = !online || dateOf(p.at) < recentCutoff;
  }
  failed.forEach((p, i) => { p.receiptNo = `TXN-${dateOf(p.at).slice(0, 4)}-F${String(i + 1).padStart(4, '0')}`; p.sent = null; p.reconciled = false; });

  // ---- Bank / gateway statement lines (last 14 days) ---------------------------------------
  const lines: unknown[][] = [];
  // Gateways settle T+1; the last three days arrive in today's batch.
  const recentOnline = payments.filter((p) => !p.reconciled && dateOf(p.at) < today).sort((x, y) => y.at.getTime() - x.at.getTime());
  const batchFrom = ctx.day(-3);
  let unmatched = 0;
  let diffException = false;
  for (const p of recentOnline) {
    const paid = dateOf(p.at);
    const settle = paid >= batchFrom ? today : addDays(paid, 1);
    if (unmatched < 3) {
      // Settled in today's batch; not yet run through reconciliation.
      lines.push([settle, p.ref, p.amount, p.method, null, 'Unmatched', null]);
      unmatched++;
    } else if (!diffException && p.amount > 5000) {
      lines.push([settle, p.ref, p.amount - 200, p.method, null, 'Exception', 'Settlement amount differs by ₹200 (gateway fee posted separately)']);
      diffException = true;
    } else {
      lines.push([settle, p.ref, p.amount, p.method, p.id, 'Matched', 'Auto-matched on reference and amount']);
      p.reconciled = true;
    }
  }
  lines.push([ctx.day(-2), `UPI/${ctx.day(-3).replace(/-/g, '')}0931${ctx.int(1000, 9999)}`, 4800, 'UPI', null, 'Exception', 'Payment received, no matching invoice line']);
  lines.push([ctx.day(-9), `NB-${ctx.day(-10).replace(/-/g, '').slice(2)}-7781`, 9600, 'Net Banking', null, 'Resolved', 'Duplicate settlement — refunded by the bank']);

  // ---- Write ledger ----------------------------------------------------------------------------
  await bulkInsert(db, 'student_fees',
    ['id', 'student_id', 'academic_year_id', 'fee_head_id', 'fee_structure_id', 'description', 'amount_due', 'concession_amount', 'amount_paid', 'due_date', 'status', 'created_at'],
    charges.map((c) => {
      const b = bal(c);
      const status = b === 0 ? 'Paid' : c.due < today ? 'Overdue' : c.paid > 0 ? 'Partial' : 'Pending';
      return [c.id, c.studentId, ctx.yearId, head[c.head], c.structureId, c.desc, c.amount, c.concession, c.paid, c.due, status, created(c.created)];
    }));
  const allPayments = [...payments, ...failed];
  await bulkInsert(db, 'fee_payments',
    ['id', 'receipt_no', 'student_id', 'amount', 'method', 'gateway_ref', 'status', 'reconciled', 'reconciled_at', 'paid_at', 'paid_by_parent_id', 'collected_by', 'receipt_sent_at', 'created_at'],
    allPayments.map((p) => [p.id, p.receiptNo, p.studentId, p.amount, p.method, p.ref, p.status, p.reconciled,
      p.reconciled ? new Date(Math.min(ctx.now.getTime(), p.at.getTime() + 86400000)) : null, p.at, p.parentId, p.collectedBy, p.sent, p.at]));
  await bulkInsert(db, 'fee_payment_allocations', ['payment_id', 'student_fee_id', 'amount'],
    payments.flatMap((p) => p.alloc.map((a) => [p.id, a.feeId, a.amount])));
  await bulkInsert(db, 'bank_statement_lines', ['statement_date', 'reference', 'amount', 'channel', 'matched_payment_id', 'status', 'note'], lines);
  await bulkInsert(db, 'concessions',
    ['student_id', 'concession_type', 'percent', 'amount', 'academic_year_id', 'status', 'reason', 'approved_by', 'approved_at', 'created_by', 'created_at'], conRows);

  // ---- Scholarship schemes ------------------------------------------------------------------
  const merit = conRows.filter((r) => r[1] === 'Merit scholarship' && r[5] === 'Approved').length;
  const need = conRows.filter((r) => r[1] === 'Need-based support' && r[5] === 'Approved').length;
  await bulkInsert(db, 'scholarships', ['name', 'criteria', 'amount', 'seats', 'awarded', 'academic_year_id', 'status'], [
    ['Edunex Merit Scholarship', 'Top 5% across the previous three terms', 62000, 20, merit, ctx.yearId, 'Open'],
    ['Need-based Support Fund', 'Verified family circumstances; reviewed by the counsellor and principal', 48000, 12, need, ctx.yearId, 'Open'],
    ['Sports Excellence Award', 'District or state representation in the last 12 months', 30000, 8, 0, ctx.yearId, 'Open'],
    ['Innovation Award', 'Selection at a state or national science / innovation expo', 40000, 4, 1, ctx.yearId, 'Awarded'],
  ]);

  // ---- Budgets & expenses ------------------------------------------------------------------------
  // Spend to date = allocation × share of the year elapsed × a run-rate factor
  // (Transport runs hot on fuel, marketing runs light), so projections look realistic.
  const yr = (await db.query('SELECT ends_on FROM academic_years WHERE id = $1', [ctx.yearId])).rows[0];
  const yearEnd = String(yr.ends_on instanceof Date ? yr.ends_on.toISOString().slice(0, 10) : yr.ends_on);
  const spendDays = Math.max(0, (Date.parse(today) - Date.parse(Y)) / 86400000);
  const elapsed = Math.min(1, spendDays / ((Date.parse(yearEnd) - Date.parse(Y)) / 86400000));
  const BUDGET: [category: string, allocated: number, actualTarget: number, owner: string][] = ([
    ['Academics', 3200000, 0.95, 'Dr. Meera Krishnan'],
    ['Transport', 2400000, 1.12, 'Murugan P.'],
    ['Facilities', 1800000, 0.9, 'Murugan P.'],
    ['Technology', 900000, 0.85, 'Mr. Sathish Kumar'],
    ['Student activities', 1100000, 0.9, 'Ms. Deepa Venkat'],
    ['Marketing & admissions', 600000, 0.7, 'Kavitha S.'],
  ] as [string, number, number, string][]).map(([c, a, f, o]) => [c, a, Math.round(a * elapsed * f), o]);
  const SCALE: Record<string, number> = { gdv: 1, vdv: 0.35, plc: 0.15 };
  const budgetRows: unknown[][] = [];
  for (const [code, scale] of Object.entries(SCALE)) {
    for (const [cat, alloc, , owner] of BUDGET) {
      budgetRows.push([ctx.yearId, ctx.campuses[code].id, cat, Math.round((alloc * scale) / 1000) * 1000, owner]);
    }
  }
  await bulkInsert(db, 'budgets', ['academic_year_id', 'campus_id', 'category', 'allocated', 'owner'], budgetRows);

  const E = ctx.employees;
  const SPENDERS: Record<string, string[]> = {
    Academics: ['EMP-6003', 'EMP-1092', 'EMP-5104', 'EMP-5120'],
    Transport: ['EMP-2015'],
    Facilities: ['EMP-2015', 'EMP-5005'],
    Technology: ['EMP-6003'],
    'Student activities': ['EMP-6011', 'EMP-1096'],
    'Marketing & admissions': ['EMP-3002', 'EMP-3018'],
  };
  const WHAT: Record<string, [string, number, number][]> = {
    Academics: [['Lab consumables', 12000, 38000], ['Library acquisitions', 20000, 60000], ['Science kits — Grade 6–8', 30000, 90000], ['Cambridge exam registration fees', 80000, 160000], ['Maths manipulatives', 8000, 25000]],
    Transport: [['Transport — diesel top-up', 90000, 160000], ['Bus servicing', 25000, 70000], ['Tyre replacement', 18000, 45000], ['Insurance renewal — Bus 7', 60000, 90000]],
    Facilities: [['Facilities — AC servicing', 30000, 80000], ['Electrical maintenance', 15000, 50000], ['Housekeeping supplies', 10000, 30000], ['Water treatment plant service', 20000, 45000], ['Classroom furniture repairs', 18000, 60000]],
    Technology: [['Chromebook licences', 40000, 90000], ['Network switch replacement', 25000, 60000], ['Projector lamps', 8000, 20000]],
    'Student activities': [['Event — Sports Day', 40000, 90000], ['Inter-school debate travel', 12000, 30000], ['Music instruments', 15000, 45000], ['Event — Annual Day rehearsals', 20000, 60000]],
    'Marketing & admissions': [['Open house — printing', 8000, 25000], ['Admissions campaign — digital', 20000, 45000], ['Prospectus reprint', 10000, 30000]],
  };
  type Exp = [code: string, campus: string, category: string, desc: string, amount: number, date: string, status: string, by: string, reason: string | null];
  const exps: Exp[] = [];
  for (const [code, scale] of Object.entries(SCALE)) {
    for (const [cat, , target] of BUDGET) {
      let left = Math.round(target * scale);
      // Leave room for the wireframe's recent approved items at Guduvanchery
      if (code === 'gdv' && cat === 'Academics') left -= 24150;
      if (code === 'gdv' && cat === 'Transport') left -= 132000;
      if (code === 'gdv' && cat === 'Facilities') left -= 68400;
      let guard = 0;
      while (left > 5000 && guard++ < 60) {
        const [desc, lo, hi] = ctx.pick(WHAT[cat]);
        const amt = Math.min(left, Math.round((ctx.int(lo, hi) * Math.max(scale, 0.3)) / 50) * 50);
        left -= amt;
        const date = minDate(between(D(1), ctx.day(-16)), ctx.day(-16));
        exps.push(['', code, cat, desc, amt, date, date < ctx.day(-30) ? 'Paid' : 'Approved', ctx.pick(SPENDERS[cat]), null]);
      }
    }
  }
  // Rejected history and a draft
  exps.push(['', 'gdv', 'Technology', 'Smart board — Grade 3 (duplicate request)', 145000, ctx.day(-40), 'Rejected', 'EMP-6003', 'Already covered by the approved Grade 3 refurbishment']);
  exps.push(['', 'vdv', 'Facilities', 'Garden landscaping', 64000, ctx.day(-26), 'Rejected', 'EMP-2015', 'Not in this year\'s plan — resubmit for next year']);
  exps.sort((a, b) => (a[5] < b[5] ? -1 : 1));
  let n = 2190 - exps.length;
  for (const e of exps) e[0] = `EXP-${n++}`;
  const WF: Exp[] = [
    ['EXP-2211', 'gdv', 'Facilities', 'Facilities — AC servicing', 68400, ctx.day(-5), 'Under Review', 'EMP-2015', null],
    ['EXP-2208', 'gdv', 'Academics', 'Lab consumables', 24150, ctx.day(-6), 'Approved', 'EMP-6003', null],
    ['EXP-2204', 'gdv', 'Transport', 'Transport — diesel top-up', 132000, ctx.day(-8), 'Approved', 'EMP-2015', null],
    ['EXP-2199', 'gdv', 'Student activities', 'Event — Innovation Day', 41800, ctx.day(-11), 'Submitted', 'EMP-6011', null],
    ['EXP-2190', 'gdv', 'Academics', 'Library acquisitions', 56300, ctx.day(-15), 'Rejected', 'EMP-1092', 'Exceeds the library allocation for this term — split across two terms'],
    ['EXP-2212', 'vdv', 'Transport', 'Bus servicing — Vadavalli Route 1', 18400, ctx.day(-1), 'Draft', 'EMP-2061', null],
  ];
  const allExp = [...exps, ...WF];
  await bulkInsert(db, 'expenses',
    ['code', 'campus_id', 'category', 'description', 'amount', 'expense_date', 'status', 'submitted_by', 'approved_by', 'approved_at', 'rejection_reason', 'created_by', 'created_at'],
    allExp.map(([code, campus, cat, desc, amt, date, status, by, reason]) => {
      const decided = ['Approved', 'Rejected', 'Paid'].includes(status);
      return [code, ctx.campuses[campus].id, cat, desc, amt, date, status, E[by] ?? null,
        decided ? (amt > 100000 ? ctx.users.principal : ctx.users.finance) : null,
        decided ? stamp(minDate(addDays(date, ctx.int(1, 3)), today), '15:20') : null,
        reason, ctx.users.finance, stamp(date, '10:00')];
    }));

  // ---- Reimbursements ----------------------------------------------------------------------------------
  type Rmb = [code: string, emp: string, type: string, desc: string, amount: number, date: string, status: string];
  const rmb: Rmb[] = [
    ['RMB-441', 'EMP-6011', 'Travel', 'Counselling conference — travel', 6400, ctx.day(-3), 'Under Review'],
    ['RMB-438', 'EMP-6003', 'Training', 'Robotics competition entry fee', 3000, ctx.day(-5), 'Approved'],
    ['RMB-434', 'EMP-2015', 'Transport', 'Emergency tyre replacement', 8900, ctx.day(-8), 'Approved'],
    ['RMB-429', 'EMP-5005', 'Supplies', 'Cleaning supplies — urgent', 2150, ctx.day(-12), 'Rejected'],
    ['RMB-442', 'EMP-1096', 'Supplies', 'First-aid kit refill — sports field', 1850, ctx.day(-1), 'Submitted'],
  ];
  const RMB_POOL: [string, string, string, number, number][] = [
    ['EMP-1021', 'Training', 'Maths olympiad coaching workshop', 2500, 6000],
    ['EMP-1044', 'Supplies', 'Lab glassware replacement', 1200, 4000],
    ['EMP-2031', 'Transport', 'Toll and parking — field trip', 600, 1800],
    ['EMP-7014', 'Medical', 'Infirmary consumables', 900, 3500],
    ['EMP-3002', 'Travel', 'School fair travel — Chennai', 1800, 5200],
    ['EMP-7005', 'Training', 'Cambridge teacher training — materials', 2000, 5000],
    ['EMP-4007', 'Other', 'Torch and batteries — night patrol', 450, 1200],
  ];
  for (let i = 0; i < 24; i++) {
    const [emp, type, desc, lo, hi] = ctx.pick(RMB_POOL);
    const date = between(D(-45), ctx.day(-14));
    rmb.push(['', emp, type, desc, Math.round(ctx.int(lo, hi) / 50) * 50, date, ctx.rand() < 0.08 ? 'Rejected' : 'Paid']);
  }
  const hist = rmb.filter((r) => !r[0]).sort((a, b) => (a[5] < b[5] ? -1 : 1));
  hist.forEach((r, i) => { r[0] = `RMB-${404 + i}`; });
  await bulkInsert(db, 'reimbursements', ['code', 'employee_id', 'claim_type', 'description', 'amount', 'claim_date', 'status', 'approved_by', 'approved_at', 'created_at'],
    rmb.map(([code, emp, type, desc, amount, date, status]) => {
      const decided = ['Approved', 'Rejected', 'Paid'].includes(status);
      return [code, E[emp], type, desc, amount, date, status, decided ? ctx.users.finance : null,
        decided ? stamp(minDate(addDays(date, 2), today), '12:10') : null, stamp(date, '16:00')];
    }));

  // ---- Allowances ---------------------------------------------------------------------------------------
  // The workforce seed owns the approved allowances that its payslips are built from; finance adds only
  // a pending proposal (not yet in payroll) so the approval workflow has something to act on.
  const teachers = (await db.query(
    `SELECT id FROM employees WHERE deleted_at IS NULL AND employment_status = 'active' AND employee_type = 'teaching'`)).rows;
  const alw: unknown[][] = teachers.map((e) => [e.id, 'CPD allowance', 1500, 'Monthly', `${today.slice(0, 7)}-01`, 'Submitted']);
  await bulkInsert(db, 'allowances', ['employee_id', 'allowance_type', 'amount', 'frequency', 'effective_month', 'status'], alw);
}
