/**
 * SAMPLE DATA — operations domain (facilities, bookings, assets, maintenance,
 * inventory, certificates, compliance calendar, school document collections).
 * Names, codes and statuses follow the wireframe (D.operations); dates are
 * relative to today. All records are fictional.
 */
import { addDays, bulkInsert, type Db, type SeedContext, type SeedStudent } from './context.js';

function mondayOf(date: string) {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 Sun … 6 Sat
  return addDays(date, dow === 0 ? -6 : 1 - dow);
}

function hhmm(mins: number) {
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}

function monthStart(today: string, offset: number) {
  const d = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + offset);
  return d.toISOString().slice(0, 10);
}

export async function seed(db: Db, ctx: SeedContext): Promise<void> {
  const C = ctx.campuses;
  const E = ctx.employees;
  const past = (n: number, hh = '10:30') => ctx.at(ctx.day(-n), hh);

  // ---------------------------------------------------------------------------
  // Facilities + bookings (weekly utilisation is computed from bookings)
  // ---------------------------------------------------------------------------
  // [key, campus, name, type, capacity, status, weekly hours, today's bookings]
  const FAC: [string, string, string, string, number, string, number, string[]][] = [
    ['aud', 'gdv', 'Auditorium', 'Hall', 400, 'Available', 25, ['Innovation Day rehearsal']],
    ['lab1', 'gdv', 'Lab-1 (Science)', 'Lab', 36, 'In use', 34, ['Grade 5A P3', 'Grade 9A P6']],
    ['lab2', 'gdv', 'Lab-2 (Computing)', 'Lab', 32, 'Available', 31, ['Grade 6C P6', 'Robotics Club P8']],
    ['lib', 'gdv', 'Library', 'Library', 80, 'Available', 22, ['Open all day']],
    ['field', 'gdv', 'Sports field', 'Field', 200, 'Available', 28, ['Games P7', 'Athletics practice']],
    ['music', 'gdv', 'Music room', 'Studio', 24, 'Available', 16, ['Grade 5 music P7']],
    ['r204', 'gdv', 'R-204 (Grade 5A)', 'Classroom', 35, 'In use', 36, ['Grade 5A timetable']],
    ['r108', 'gdv', 'R-108', 'Classroom', 35, 'Maintenance', 0, []],
    ['vhall', 'vdv', 'Assembly hall', 'Hall', 250, 'Available', 12, ['Primary assembly']],
    ['vlab', 'vdv', 'Science & STEM lab', 'Lab', 30, 'Available', 24, ['Grade 6A practical']],
    ['pdine', 'plc', 'Dining hall', 'Hall', 120, 'Available', 30, ['Residential lunch service']],
    ['pwall', 'plc', 'Climbing wall', 'Field', 16, 'Available', 18, ['Outdoor skills block']],
  ];
  const facId: Record<string, string> = {};
  for (const [key, campus, name, type, cap, status] of FAC) {
    const r = await db.query(
      `INSERT INTO facilities (campus_id, name, facility_type, capacity, status) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [C[campus].id, name, type, cap, status]);
    facId[key] = r.rows[0].id;
  }
  const monday = mondayOf(ctx.today);
  const week = [0, 1, 2, 3, 4].map((i) => addDays(monday, i));
  const bookings: unknown[][] = [];
  const bookers = [ctx.users.office, ctx.users.teacher, ctx.users.principal, ctx.users.teacher2 ?? ctx.users.teacher];
  const GENERIC = ['Timetabled lesson', 'Club session', 'Assessment', 'Staff training', 'Practice session'];
  for (const [key, , , , , , weekly, todays] of FAC) {
    if (!weekly) continue;
    const perDay = Math.round((weekly * 60) / 5 / 15) * 15; // minutes
    const days = new Set([...week, ctx.today]);
    for (const d of days) {
      const purposes = d === ctx.today && todays.length ? todays : [ctx.pick(GENERIC), ctx.pick(GENERIC)];
      const inWeek = week.includes(d);
      const total = inWeek ? perDay : Math.min(perDay, 180);
      const block = Math.max(30, Math.floor(total / purposes.length / 15) * 15);
      let start = 8 * 60 + 30;
      purposes.forEach((p, i) => {
        const len = i === purposes.length - 1 ? Math.max(30, total - block * (purposes.length - 1)) : block;
        const end = Math.min(start + len, 17 * 60 + 30);
        bookings.push([facId[key], d, hhmm(start), hhmm(end), p, 'Booked', ctx.pick(bookers)]);
        start = end + 15;
      });
    }
    // A couple of bookings next week so the booking calendar is not empty
    bookings.push([facId[key], addDays(monday, 7 + ctx.int(0, 4)), '10:00', '11:30', ctx.pick(GENERIC), 'Booked', ctx.pick(bookers)]);
  }
  bookings.push([facId.aud, addDays(monday, 8), '09:00', '13:00', 'Innovation Day showcase', 'Booked', ctx.users.principal]);
  bookings.push([facId.lab2, addDays(monday, 9), '14:00', '15:00', 'Parent coding workshop', 'Cancelled', ctx.users.office]);
  await bulkInsert(db, 'facility_bookings', ['facility_id', 'booked_on', 'starts_at', 'ends_at', 'purpose', 'status', 'booked_by'], bookings);

  // ---------------------------------------------------------------------------
  // Assets (wireframe AST-2201 … plus a fuller register)
  // ---------------------------------------------------------------------------
  // [code, campus, name, category, location, facility, employee, purchased, value, nextService offset, status]
  const ASSETS: [string, string, string, string, string, string | null, string | null, string, number, number | null, string][] = [
    ['AST-2201', 'gdv', 'Interactive panel — R-204', 'IT', 'Academic Block A', 'r204', 'EMP-1021', '2024-06-12', 185000, 33, 'Active'],
    ['AST-1188', 'gdv', 'Science lab fume hood', 'Lab', 'Lab-1', 'lab1', 'EMP-1044', '2023-03-03', 240000, 1, 'Maintenance due'],
    ['AST-3310', 'gdv', 'Bus 15 — TN 09 BX 6607', 'Vehicle', 'Depot', null, 'EMP-2036', '2022-01-21', 2800000, 0, 'In maintenance'],
    ['AST-2044', 'gdv', 'Library RFID gate', 'IT', 'Library', 'lib', 'EMP-1092', '2025-09-09', 320000, 173, 'Active'],
    ['AST-5017', 'gdv', 'Generator 125 kVA', 'Facilities', 'Utility yard', null, 'EMP-2015', '2021-11-30', 1450000, 11, 'Active'],
    ['AST-3304', 'gdv', 'Bus 4 — TN 09 BK 2231', 'Vehicle', 'Depot', null, 'EMP-2032', '2021-07-14', 2650000, 5, 'Active'],
    ['AST-3312', 'gdv', 'Bus 12 — TN 11 AZ 4410', 'Vehicle', 'Depot', null, 'EMP-2031', '2023-02-02', 2950000, 48, 'Active'],
    ['AST-2210', 'gdv', 'Projector — R-108', 'IT', 'Academic Block B', 'r108', 'EMP-1088', '2022-08-19', 68000, -4, 'Active'],
    ['AST-2215', 'gdv', 'Laptop cart (30 units)', 'IT', 'Lab-2', 'lab2', 'EMP-6003', '2024-11-05', 1260000, 64, 'Active'],
    ['AST-2218', 'gdv', '3D printer — Innovation Lab', 'IT', 'Lab-2', 'lab2', 'EMP-6003', '2025-01-17', 145000, 21, 'Active'],
    ['AST-2230', 'gdv', 'CCTV network recorder', 'IT', 'Security office', null, 'EMP-4022', '2023-06-30', 210000, 27, 'Active'],
    ['AST-1190', 'gdv', 'Compound microscopes (12)', 'Lab', 'Lab-1', 'lab1', 'EMP-5104', '2022-04-11', 180000, 92, 'Active'],
    ['AST-1195', 'gdv', 'Robotics kits (15)', 'Lab', 'Lab-2', 'lab2', 'EMP-6003', '2024-07-01', 225000, 120, 'Active'],
    ['AST-5020', 'gdv', 'Water purification plant', 'Facilities', 'Utility yard', null, 'EMP-2015', '2020-12-04', 540000, -9, 'Active'],
    ['AST-5024', 'gdv', 'Auditorium sound system', 'Facilities', 'Auditorium', 'aud', 'EMP-3040', '2023-01-20', 690000, 16, 'Active'],
    ['AST-5031', 'gdv', 'Elevator — Academic Block A', 'Facilities', 'Academic Block A', null, 'EMP-3040', '2019-06-15', 1850000, 40, 'Active'],
    ['AST-6002', 'gdv', 'Classroom furniture set — Grade 5', 'Furniture', 'Academic Block A', 'r204', null, '2021-05-10', 420000, null, 'Active'],
    ['AST-6007', 'gdv', 'Library shelving', 'Library', 'Library', 'lib', 'EMP-5120', '2018-03-22', 380000, null, 'Active'],
    ['AST-6011', 'gdv', 'Football goalposts (pair)', 'Sports', 'Sports field', 'field', 'EMP-1096', '2020-09-01', 85000, 25, 'Active'],
    ['AST-6015', 'gdv', 'Piano — Music room', 'Furniture', 'Music room', 'music', null, '2017-08-14', 260000, 140, 'Active'],
    ['AST-2099', 'gdv', 'Desktop computers (old lab)', 'IT', 'Store', null, null, '2016-06-01', 900000, null, 'Retired'],
    ['AST-7001', 'vdv', 'Bus V1 — TN 37 CQ 9012', 'Vehicle', 'Vadavalli depot', null, 'EMP-2061', '2022-10-10', 2700000, 12, 'Active'],
    ['AST-7004', 'vdv', 'Interactive panels (8)', 'IT', 'Primary block', 'vhall', 'EMP-7005', '2025-04-02', 1360000, 80, 'Active'],
    ['AST-7010', 'vdv', 'STEM lab equipment', 'Lab', 'Science & STEM lab', 'vlab', 'EMP-7005', '2024-06-20', 410000, 29, 'Active'],
    ['AST-8001', 'plc', 'Climbing wall harness set', 'Sports', 'Climbing wall', 'pwall', 'EMP-8001', '2023-11-11', 150000, 3, 'Active'],
    ['AST-8005', 'plc', 'Kitchen equipment — dining hall', 'Facilities', 'Dining hall', 'pdine', 'EMP-8001', '2021-12-01', 720000, 45, 'Active'],
  ];
  const assetId: Record<string, string> = {};
  for (const [code, campus, name, cat, loc, fac, emp, bought, value, svc, status] of ASSETS) {
    const r = await db.query(
      `INSERT INTO assets (code, campus_id, name, category, location, facility_id, assigned_to, purchased_on, purchase_value, next_service_on, status, deleted_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [code, C[campus].id, name, cat, loc, fac ? facId[fac] : null, emp ? E[emp] : null, bought, value,
        svc == null ? null : ctx.day(svc), status, status === 'Retired' ? past(40) : null]);
    assetId[code] = r.rows[0].id;
  }

  // ---------------------------------------------------------------------------
  // Maintenance requests
  // ---------------------------------------------------------------------------
  // [code, campus, description, priority, status, raisedBy, raised offset, asset, facility, assignee, cost, closed after days]
  type MR = [string, string, string, string, string, string, number, string | null, string | null, string | null, number | null, number | null];
  const MRS: MR[] = [
    ['MR-661', 'gdv', 'Leaking tap — Block B washroom', 'Low', 'In Progress', 'EMP-5005', -2, null, null, 'EMP-5011', null, null],
    ['MR-658', 'gdv', 'Projector bulb replacement — R-108', 'Medium', 'Approved', 'EMP-1088', -3, 'AST-2210', 'r108', null, null, null],
    ['MR-655', 'gdv', 'Fume hood airflow below spec', 'High', 'Under Review', 'EMP-1044', -5, 'AST-1188', 'lab1', null, null, null],
    ['MR-650', 'gdv', 'Playground swing bolt loose', 'High', 'Completed', 'EMP-1096', -7, null, 'field', 'EMP-5005', 450, 1],
    ['MR-659', 'gdv', 'Bus 15 brake pads replacement', 'Urgent', 'Completed', 'EMP-2015', -4, 'AST-3310', null, 'EMP-2036', 8600, 2],
    ['MR-657', 'vdv', 'Ceiling fan noise — Grade 3 room', 'Low', 'Rejected', 'EMP-7002', -6, null, null, null, null, null],
  ];
  const ISSUES = [
    'Replace tube lights — corridor', 'Door closer repair — staff room', 'Water cooler filter change', 'Repaint lane markings — field',
    'Classroom AC not cooling', 'Broken window latch — R-112', 'Library RFID reader error', 'Wi-Fi access point offline — Block A',
    'Blocked drain — canteen', 'Loose handrail — stairwell B', 'Printer jam — front office', 'Bench repair — assembly area',
    'Smart board calibration — R-204', 'Bus 4 seat belt replacement', 'Lab gas tap leak check', 'Generator oil change',
    'Replace whiteboard — R-110', 'Toilet flush repair — Block A', 'CCTV camera realignment — rear gate', 'Sound system mic fault',
  ];
  const raisers = ['EMP-5005', 'EMP-1021', 'EMP-1044', 'EMP-3002', 'EMP-2015', 'EMP-1092', 'EMP-5120', 'EMP-3040'];
  for (let n = 620; n < 650; n++) {
    const raised = -ctx.int(4, 58);
    const closeAfter = Math.min(-raised - 1, ctx.pick([1, 1, 2, 2, 2, 3, 3, 4, 5, 7]));
    const rejected = n % 13 === 0;
    MRS.push([`MR-${n}`, n % 9 === 0 ? 'vdv' : 'gdv', ISSUES[n % ISSUES.length], ctx.pick(['Low', 'Medium', 'Medium', 'High']),
      rejected ? 'Rejected' : 'Completed', ctx.pick(raisers), raised, n % 7 === 0 ? 'AST-5017' : null, null, rejected ? null : 'EMP-5005',
      rejected ? null : ctx.int(0, 12) * 250, rejected ? null : closeAfter]);
  }
  for (const n of [651, 652, 653, 654, 656, 660]) {
    const raised = -ctx.int(3, 12);
    MRS.push([`MR-${n}`, 'gdv', ISSUES[n % ISSUES.length], ctx.pick(['Low', 'Medium']), 'Completed', ctx.pick(raisers), raised,
      null, null, 'EMP-5011', ctx.int(1, 8) * 200, Math.min(-raised - 1, ctx.int(1, 3))]);
  }
  await bulkInsert(db, 'maintenance_requests',
    ['code', 'campus_id', 'description', 'priority', 'status', 'raised_by', 'raised_on', 'asset_id', 'facility_id', 'assigned_to', 'cost', 'completed_at', 'created_at'],
    MRS.map(([code, campus, desc, pri, status, by, raised, asset, fac, asg, cost, after]) => [
      code, C[campus].id, desc, pri, status, E[by], ctx.day(raised), asset ? assetId[asset] : null, fac ? facId[fac] : null,
      asg ? E[asg] : null, cost, status === 'Completed' && after != null ? ctx.at(ctx.day(raised + Math.max(1, after)), '15:30') : null,
      ctx.at(ctx.day(raised), '09:15'),
    ]));

  // ---------------------------------------------------------------------------
  // Inventory + stock movements (final quantity = the wireframe figure)
  // ---------------------------------------------------------------------------
  // [sku, campus, name, category, unit, final qty, reorder, unit cost]
  const ITEMS: [string, string, string, string, string, number, number, number][] = [
    ['INV-0001', 'gdv', 'Science lab consumables', 'Lab', 'kits', 42, 30, 850],
    ['INV-0002', 'gdv', 'Exercise books', 'Stationery', 'units', 1840, 1000, 38],
    ['INV-0003', 'gdv', 'First-aid supplies', 'Health', 'kits', 8, 15, 1200],
    ['INV-0004', 'gdv', 'Bus first-aid kits', 'Transport', 'kits', 6, 6, 950],
    ['INV-0005', 'gdv', 'Printer toner', 'Office', 'cartridges', 3, 6, 3400],
    ['INV-0006', 'gdv', 'Cleaning supplies', 'Housekeeping', 'units', 96, 40, 180],
    ['INV-0007', 'gdv', 'A4 paper', 'Stationery', 'reams', 140, 80, 290],
    ['INV-0008', 'gdv', 'Whiteboard markers', 'Stationery', 'boxes', 26, 20, 420],
    ['INV-0009', 'gdv', 'School ties', 'Uniform', 'pcs', 210, 100, 160],
    ['INV-0010', 'gdv', 'Footballs', 'Sports', 'pcs', 14, 10, 1350],
    ['INV-0011', 'gdv', 'Arduino starter kits', 'Lab', 'kits', 11, 8, 2600],
    ['INV-0012', 'vdv', 'Exercise books', 'Stationery', 'units', 760, 500, 38],
    ['INV-0013', 'vdv', 'Hand sanitiser', 'Health', 'bottles', 34, 25, 140],
    ['INV-0014', 'plc', 'Camping mats', 'Sports', 'pcs', 42, 30, 900],
    ['INV-0015', 'plc', 'Kitchen gas cylinders', 'Housekeeping', 'cylinders', 3, 4, 1100],
  ];
  const movementRows: unknown[][] = [];
  const movers = [ctx.users.office, ctx.users.principal, ctx.users.staff];
  for (const [sku, campus, name, cat, unit, qty, reorder, cost] of ITEMS) {
    const r = await db.query(
      `INSERT INTO inventory_items (sku, campus_id, name, category, unit, quantity, reorder_level, unit_cost)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`, [sku, C[campus].id, name, cat, unit, qty, reorder, cost]);
    const itemId = r.rows[0].id;
    // Later movements (oldest first), then an opening balance that makes the totals reconcile.
    const later: { d: number; type: 'in' | 'out'; q: number; note: string }[] = [];
    const scale = Math.max(1, Math.round(reorder / 3));
    for (let k = 0; k < ctx.int(4, 7); k++) {
      const isIn = k % 3 === 2;
      later.push({ d: -ctx.int(2, 80), type: isIn ? 'in' : 'out', q: ctx.int(1, 3) * scale, note: isIn ? 'Supplier delivery' : ctx.pick(['Issued to classrooms', 'Issued to lab', 'Issued to transport', 'Weekly issue']) });
    }
    later.sort((a, b) => a.d - b.d);
    const net = later.reduce((a, m) => a + (m.type === 'in' ? m.q : -m.q), 0);
    let opening = qty - net;
    // keep the running balance non-negative
    let run = opening, low = opening;
    for (const m of later) { run += m.type === 'in' ? m.q : -m.q; low = Math.min(low, run); }
    if (low < 0) opening -= low;
    const adjust = qty - (opening + net);
    movementRows.push([itemId, 'in', opening, 'Opening stock', ctx.users.office, past(90, '09:00')]);
    for (const m of later) movementRows.push([itemId, m.type, m.type === 'in' ? m.q : -m.q, m.note, ctx.pick(movers), past(-m.d, '11:00')]);
    if (adjust) movementRows.push([itemId, 'adjust', adjust, 'Stock count correction', ctx.users.office, past(1, '16:00')]);
  }
  await bulkInsert(db, 'inventory_movements', ['item_id', 'movement_type', 'quantity', 'note', 'moved_by', 'created_at'], movementRows);

  // ---------------------------------------------------------------------------
  // Certificates (wireframe four, attached to existing students)
  // ---------------------------------------------------------------------------
  const named = new Set(['HS-2026-1041', 'HS-2026-1042', 'HS-2026-1043', 'HS-2026-1085', 'HS-2026-1090', 'HS-2026-1079', 'HS-2026-1070']);
  const byGrade = (g: number, not: Set<string>) => {
    const pool = ctx.students.filter((s) => s.campusCode === 'gdv' && !named.has(s.admissionNo) && !not.has(s.id));
    const exact = pool.filter((s) => s.gradeLevel === g);
    const pickFrom = exact.length ? exact : pool.sort((a, b) => Math.abs(a.gradeLevel - g) - Math.abs(b.gradeLevel - g));
    return pickFrom[0];
  };
  const used = new Set<string>();
  const take = (g: number): SeedStudent => { const s = byGrade(g, used); used.add(s.id); return s; };
  const year = ctx.today.slice(0, 4);
  // [type, student, requested offset, status, code, issued offset]
  const CERTS: [string, SeedStudent, number, string, string | null, number | null, string][] = [
    ['Transfer certificate', take(8), -6, 'Under Review', null, null, 'Relocating out of state'],
    ['Bonafide certificate', take(10), -5, 'Approved', `BC-${year}-1182`, null, 'Passport application'],
    ['Conduct certificate', take(12), -8, 'Approved', `CC-${year}-0217`, null, 'Scholarship application'],
    ['Bonafide certificate', take(6), -4, 'Submitted', null, null, 'Bank account for scholarship'],
    ['Study certificate', take(9), -40, 'Issued', `SC-${year}-0102`, -36, 'Sports quota application'],
    ['Bonafide certificate', take(7), -28, 'Issued', `BC-${year}-1180`, -26, 'Travel concession'],
    ['Achievement certificate', ctx.studentByNo['HS-2026-1041'], -30, 'Issued', `AC-${year}-0031`, -29, 'District Robotics Challenge record'],
    ['Bonafide certificate', take(5), -20, 'Rejected', null, null, 'Duplicate request'],
  ];
  await bulkInsert(db, 'certificates',
    ['certificate_type', 'student_id', 'requested_on', 'purpose', 'status', 'verification_code', 'issued_at', 'approved_by', 'requested_by', 'created_at'],
    CERTS.map(([type, s, req, status, code, issued, purpose]) => [
      type, s.id, ctx.day(req), purpose, status, code, issued == null ? null : past(-issued, '12:00'),
      ['Approved', 'Issued', 'Rejected'].includes(status) ? ctx.users.principal : null, ctx.users.office, past(-req, '10:00'),
    ]));

  // ---------------------------------------------------------------------------
  // Compliance calendar (wireframe items relative to today + a year of history)
  // ---------------------------------------------------------------------------
  const comp: unknown[][] = [];
  // [campus, item, authority, due offset, ownerName, ownerCode, stored status]
  const OPEN: [string, string, string, number, string, string | null, string][] = [
    ['gdv', 'Fire safety certificate renewal', 'TN Fire & Rescue', 14, 'Murugan P.', 'EMP-2015', 'Scheduled'],
    ['gdv', 'Vehicle fitness — Bus 4, Bus 15', 'RTO Chengalpattu', 6, 'Murugan P.', 'EMP-2015', 'Scheduled'],
    ['gdv', 'Child-protection training refresher', 'Internal / Safeguarding', 29, 'Ms. Deepa Venkat', 'EMP-6011', 'Scheduled'],
    ['gdv', 'Staff background verification — new joiners', 'Internal HR', 9, 'HR Office', 'EMP-3025', 'In Progress'],
    ['gdv', 'Cambridge centre affiliation review', 'Cambridge International', 57, 'Dr. Meera Krishnan', 'EMP-1001', 'Scheduled'],
    ['gdv', 'Water quality test — quarterly', 'Approved lab', -8, 'Murugan P.', 'EMP-2015', 'Scheduled'],
    ['vdv', 'Building stability certificate', 'District PWD', 44, 'Mr. Arul Prakash', 'EMP-7005', 'Scheduled'],
    ['vdv', 'Vehicle fitness — Bus V1', 'RTO Coimbatore', 21, 'Senthil V.', 'EMP-2061', 'Scheduled'],
    ['plc', 'Adventure activity safety audit', 'State Sports Authority', 18, 'Mr. Dinakaran S.', 'EMP-8001', 'In Progress'],
    ['plc', 'Food safety licence renewal', 'FSSAI', 73, 'Mr. Dinakaran S.', 'EMP-8001', 'Scheduled'],
  ];
  for (const [campus, item, auth, due, owner, code, status] of OPEN) {
    comp.push([C[campus].id, item, auth, ctx.day(due), owner, code ? E[code] : null, status, null, null]);
  }
  const HIST: [string, string, string, string | null][] = [
    ['Fire extinguisher inspection', 'TN Fire & Rescue', 'Murugan P.', 'EMP-2015'],
    ['Lift safety certificate', 'Chief Electrical Inspectorate', 'Anand Rao', 'EMP-3040'],
    ['Drinking water quality test', 'Approved lab', 'Murugan P.', 'EMP-2015'],
    ['CCTV storage audit', 'Internal / Safeguarding', 'Balu K.', 'EMP-4022'],
    ['Bus GPS and speed governor check', 'RTO Chengalpattu', 'Murugan P.', 'EMP-2015'],
    ['Fire drill — term evacuation', 'Internal / Safety', 'Anand Rao', 'EMP-3040'],
    ['POCSO committee meeting', 'Internal / Safeguarding', 'Ms. Deepa Venkat', 'EMP-6011'],
    ['Sanitation inspection', 'Municipal health office', 'Rekha J.', 'EMP-5005'],
    ['Staff first-aid certification', 'Red Cross', 'Nurse Shanthi R.', 'EMP-7014'],
    ['Fee regulation filing', 'State Fee Committee', 'Rajesh Iyer', 'EMP-3031'],
    ['Library stock audit', 'Internal', 'Uma Sundar', 'EMP-5120'],
    ['Lab chemical storage audit', 'Internal / Safety', 'Meenal R.', 'EMP-5104'],
  ];
  const DUE = [6, 4, 8, 5, 7];       // items due in each of the previous five months
  const ONTIME = [6, 4, 7, 5, 7];
  for (let m = 0; m < 5; m++) {
    const start = monthStart(ctx.today, m - 5);
    for (let k = 0; k < DUE[m]; k++) {
      const [item, auth, owner, code] = HIST[(m * 5 + k) % HIST.length];
      const due = addDays(start, 2 + Math.floor((k * 26) / DUE[m]));
      const done = k < ONTIME[m] ? addDays(due, -ctx.int(0, 5)) : addDays(due, ctx.int(3, 9));
      comp.push([C.gdv.id, item, auth, due, owner, code ? E[code] : null, 'Completed', done < ctx.today ? done : ctx.day(-1), 'Filed with evidence']);
    }
  }
  // This month so far: items already completed before today
  const thisMonth = monthStart(ctx.today, 0);
  const daysSoFar = Math.round((Date.parse(ctx.today) - Date.parse(thisMonth)) / 86400000);
  for (let k = 0; k < Math.min(4, Math.floor(daysSoFar / 3)); k++) {
    const [item, auth, owner, code] = HIST[(k + 3) % HIST.length];
    const due = addDays(thisMonth, 1 + k * 3);
    comp.push([C.gdv.id, item, auth, due, owner, code ? E[code] : null, 'Completed', k === 3 ? addDays(due, 2) : due, null]);
  }
  await bulkInsert(db, 'compliance_items', ['campus_id', 'item', 'authority', 'due_on', 'owner_name', 'owner_id', 'status', 'completed_on', 'notes'],
    comp.map((r) => (r[7] && (r[7] as string) >= ctx.today ? [...r.slice(0, 7), ctx.day(-1), r[8]] : r)));

  // ---------------------------------------------------------------------------
  // School document collections (metadata only — no stored files)
  // ---------------------------------------------------------------------------
  // [collection, count, category, uploader, updated offset, pending, expired]
  const SETS: [string, number, string, string, number, number, number][] = [
    ['Student records — Grade 5', 96, 'Student record', 'office', -3, 6, 0],
    ['Employee contracts — 2026 intake', 21, 'Contract', 'hr', -7, 2, 0],
    ['Safeguarding policy pack', 7, 'Policy', 'principal', -15, 0, 0],
    ['Cambridge centre handbook', 3, 'Handbook', 'principal', -20, 0, 0],
    ['Vehicle fitness records', 16, 'Vehicle', 'staff', -26, 1, 2],
    ['Fire and building safety', 9, 'Certificate', 'schooladmin', -41, 0, 1],
  ];
  const docs: unknown[][] = [];
  for (const [coll, count, cat, who, upd, pending, expired] of SETS) {
    for (let i = 1; i <= count; i++) {
      const status = i <= pending ? 'Submitted' : i <= pending + expired ? 'Expired' : 'Verified';
      const when = past(-upd + Math.floor((i * 40) / count), '11:00');
      docs.push(['school', null, null, `${coll.split(' — ')[0]} — item ${String(i).padStart(2, '0')}`, cat, coll, status,
        ctx.users[who] ?? ctx.users.office, status === 'Verified' ? ctx.users.principal : null, status === 'Verified' ? when : null,
        when, i === 1 ? past(-upd, '11:00') : when]);
    }
  }
  await bulkInsert(db, 'documents',
    ['owner_type', 'owner_id', 'student_id', 'name', 'category', 'collection', 'status', 'uploaded_by', 'verified_by', 'verified_at', 'created_at', 'updated_at'],
    docs);
}
