/**
 * SAMPLE DATA — safety domain. Owned by the safety module.
 * Receives the shared context (ids of campuses, students, employees, sections …).
 *
 * The core seed already provides routes, stops, student_transport, today's
 * boarding and gate events, infirmary visits and counselling sessions; this
 * file adds pickup, visitors, incidents, broadcasts, a live bus trail and
 * more history for the charts. Nothing that "happened" is dated in the future.
 */
import { randomBytes } from 'node:crypto';
import { bulkInsert, type Db, type SeedContext } from './context.js';

export async function seed(db: Db, ctx: SeedContext): Promise<void> {
  const gdv = ctx.campuses.gdv.id;
  const now = ctx.now;
  const past = (d: Date) => d <= now;
  const S = (no: string) => ctx.studentByNo[no];
  const E = (code: string) => ctx.employees[code];
  /** Latest of: today at hh:mm if already past, else the same time on the previous school day. */
  const lastAt = (hhmm: string) => {
    const t = ctx.at(ctx.today, hhmm);
    if (past(t)) return t;
    const prev = ctx.schoolDays(ctx.day(-7), ctx.day(-1));
    return ctx.at(prev[prev.length - 1] ?? ctx.day(-1), hhmm);
  };

  // ---------------------------------------------------------------------------
  // Pickup authorisations (Aditya's four from the wireframe + a few others)
  // ---------------------------------------------------------------------------
  const aditya = S('HS-2026-1041');
  const surya = S('HS-2026-1085');
  const pickups: [string, string, string, string | null, string, string, Date | null, string | null][] = [
    [aditya.id, 'Ranjith Kumar', 'Father', '+91 98407 22110', 'QR + Face', 'Verified', lastAt('15:40'), aditya.parentId ?? null],
    [aditya.id, 'Sujatha Kumar', 'Mother', '+91 98407 22111', 'QR', 'Verified', ctx.at(ctx.day(-6), '15:38'), aditya.parentId ?? null],
    [aditya.id, 'Ramanathan S.', 'Grandfather', '+91 94441 30725', 'OTP', 'Verified', ctx.at(ctx.day(-1), '15:44'), aditya.parentId ?? null],
    [aditya.id, 'Driver — Vinoth', 'Authorised driver', '+91 90030 58812', 'OTP + ID', 'Pending', null, null],
    [surya.id, 'Ranjith Kumar', 'Father', '+91 98407 22110', 'QR + Face', 'Verified', lastAt('15:41'), surya.parentId ?? null],
    [S('HS-2026-1042').id, 'Sudha Raman', 'Mother', '+91 98410 55831', 'QR', 'Verified', ctx.at(ctx.day(-1), '16:02'), S('HS-2026-1042').parentId ?? null],
    [S('HS-2026-1064').id, 'Gayathri N.', 'Mother', '+91 97890 11234', 'OTP', 'Verified', ctx.at(ctx.day(-2), '15:36'), S('HS-2026-1064').parentId ?? null],
    [S('HS-2026-1089').id, 'Driver — Kumar', 'Authorised driver', '+91 98840 17720', 'OTP + ID', 'Revoked', ctx.at(ctx.day(-20), '15:50'), null],
  ];
  const auth = await bulkInsert(db, 'pickup_authorisations',
    ['student_id', 'person_name', 'relation', 'phone', 'method', 'status', 'last_pickup_at', 'approved_by_parent', 'created_at'],
    pickups.map((p, i) => [...p, ctx.at(ctx.day(-60 + i), '10:00')]), 'RETURNING id, person_name, student_id');
  const authId = (studentId: string, name: string) => auth.find((a) => a.student_id === studentId && a.person_name === name)?.id;

  // ---------------------------------------------------------------------------
  // Incidents (wireframe INC-0104 … INC-0112, plus older history)
  // ---------------------------------------------------------------------------
  type Inc = [code: string, type: string, summary: string, details: string, severity: string, status: string,
    dayOffset: number, time: string, owner: string, student: string | null, confidential: boolean, closeAfterHours: number | null];
  const incidents: Inc[] = [
    ['INC-0112', 'Safeguarding', 'Unrecognised pickup attempt — Rear Gate', 'Person not on the authorised list asked to collect Aditya Kumar. Collection held; the person was the grandfather, confirmed by OTP to the registered parent. Grandfather added to the list.', 'Attention', 'Closed', -1, '15:42', 'EMP-4007', 'HS-2026-1041', false, 2],
    ['INC-0111', 'Security', 'Rear Gate CCTV camera offline', 'Camera RG-2 stopped recording at 06:10. Vendor ticket raised; guard posted until repaired.', 'Attention', 'Under Review', -2, '07:05', 'EMP-4007', null, false, null],
    ['INC-0110', 'Safeguarding', 'Wellbeing concern raised by class teacher', 'Confidential. Reviewed by the Designated Safeguarding Lead; support plan agreed with the counsellor.', 'Attention', 'Closed', -9, '12:20', 'EMP-1001', 'HS-2026-1073', true, 20],
    ['INC-0109', 'Health', 'Grade 6 student — sports injury, ankle', 'Twisted ankle during football practice. Ice pack applied; parent collected for an X-ray (no fracture).', 'Information', 'Closed', -3, '14:10', 'EMP-7014', 'HS-2026-1061', false, 4],
    ['INC-0108', 'Transport', 'Bus 15 brake inspection failed', 'Vehicle withdrawn to the depot. Route 15 students re-routed via Route 2 and parent drop.', 'Attention', 'Escalated', -4, '06:50', 'EMP-2015', null, false, null],
    ['INC-0107', 'Transport', 'Route 4 deviation — road closure detour', 'Vallancheri Main Road closed for repairs. Bus 4 used the Nandivaram service road; parents notified automatically.', 'Attention', 'Closed', -5, '07:55', 'EMP-2015', null, false, 6],
    ['INC-0104', 'Facilities', 'Fire drill — evacuation 3 min 42 s', 'Full-school evacuation to the assembly ground. All classes accounted for within 3 min 42 s.', 'Information', 'Closed', -12, '11:20', 'EMP-2015', null, false, 1],
    ['INC-0101', 'Security', 'Unattended bag near the visitor gate', 'Bag belonged to a delivery agent; returned after verification.', 'Information', 'Closed', -19, '09:40', 'EMP-4007', null, false, 1],
    ['INC-0098', 'Health', 'Allergic reaction at lunch — Grade 4', 'Mild reaction; antihistamine given per the care plan. Parent informed.', 'Attention', 'Closed', -27, '12:45', 'EMP-7014', 'HS-2026-1064', false, 3],
    ['INC-0093', 'Emergency', 'Heavy rain — school closed', 'Broadcast sent to all parents and staff at 07:10.', 'Critical', 'Closed', -30, '07:10', 'EMP-1001', null, false, 10],
    ['INC-0089', 'Safeguarding', 'Online safety concern reported by a parent', 'Confidential. Closed after review with the family.', 'Attention', 'Closed', -41, '16:30', 'EMP-1001', 'HS-2026-1042', true, 22],
  ];
  const incRows = incidents
    .map(([code, type, summary, details, severity, status, off, time, owner, student, conf, closeAfter]) => {
      const at = ctx.at(ctx.day(off), time);
      const updated = closeAfter != null ? new Date(at.getTime() + closeAfter * 3_600_000) : at;
      return [code, gdv, type, summary, details, severity, status, student ? S(student).id : null, E(owner), ctx.day(off), conf, ctx.users.principal,
        at, updated > now ? now : updated];
    })
    .filter((r) => past(r[12] as Date));
  const inc = await bulkInsert(db, 'incidents',
    ['code', 'campus_id', 'incident_type', 'summary', 'details', 'severity', 'status', 'student_id', 'owner_id', 'occurred_on', 'is_confidential', 'created_by', 'created_at', 'updated_at'],
    incRows, 'RETURNING id, code');
  const incId = (code: string) => inc.find((x) => x.code === code)?.id ?? null;

  // ---------------------------------------------------------------------------
  // Pickup events + verified OTPs (the held attempt of INC-0112 and its resolution)
  // ---------------------------------------------------------------------------
  const staff = ctx.users.staff;
  const events: unknown[][] = [];
  const heldAt = ctx.at(ctx.day(-1), '15:42');
  events.push([aditya.id, gdv, null, 'Ramanathan S.', 'held', null, 'Rear Gate', incId('INC-0112'), 'Face and ID did not match the authorised list; parent called.', staff, heldAt]);
  events.push([aditya.id, gdv, authId(aditya.id, 'Ramanathan S.'), 'Ramanathan S.', 'collected', 'OTP', 'Rear Gate', null, 'Verified by OTP to the registered parent.', staff, ctx.at(ctx.day(-1), '15:44')]);
  for (const [sid, name] of [[aditya.id, 'Ranjith Kumar'], [surya.id, 'Ranjith Kumar'], [S('HS-2026-1042').id, 'Sudha Raman'], [S('HS-2026-1064').id, 'Gayathri N.'], [aditya.id, 'Sujatha Kumar']] as const) {
    const p = pickups.find((x) => x[0] === sid && x[1] === name)!;
    if (p[6]) events.push([sid, gdv, authId(sid, name), name, 'collected', p[4], 'Main Gate', null, null, staff, p[6]]);
  }
  await bulkInsert(db, 'pickup_events',
    ['student_id', 'campus_id', 'authorisation_id', 'person_name', 'outcome', 'method', 'gate', 'incident_id', 'notes', 'recorded_by', 'occurred_at'],
    events.filter((e) => past(e[10] as Date)));

  const otpRows: unknown[][] = [];
  const otpAt = [ctx.at(ctx.day(-1), '15:43'), ctx.at(ctx.today, '08:26'), ctx.at(ctx.today, '12:05')];
  otpAt.forEach((t, i) => {
    if (!past(t)) return;
    const who = i === 0 ? authId(aditya.id, 'Ramanathan S.') : i === 1 ? authId(S('HS-2026-1064').id, 'Gayathri N.') : authId(aditya.id, 'Ramanathan S.');
    // Random, never-issued hashes: these challenges are already consumed.
    otpRows.push([who, randomBytes(32).toString('hex'), new Date(t.getTime() + 10 * 60_000), 0, new Date(t.getTime() + 60_000), true, staff, t]);
  });
  await bulkInsert(db, 'pickup_otp_challenges',
    ['authorisation_id', 'code_hash', 'expires_at', 'attempts', 'consumed_at', 'verified', 'created_by', 'created_at'],
    otpRows.filter((r) => past(r[4] as Date)));

  // ---------------------------------------------------------------------------
  // Visitors (V-2291 … from the wireframe, plus recent history and one pre-approval)
  // ---------------------------------------------------------------------------
  const visitors: unknown[][] = [];
  const addVisit = (badge: string, name: string, phone: string | null, purpose: string, host: string, date: string, inT: string, outT: string | null) => {
    const inAt = ctx.at(date, inT);
    if (!past(inAt)) return;
    const outAt = outT ? ctx.at(date, outT) : null;
    const done = outAt && past(outAt);
    visitors.push([gdv, badge, name, phone, purpose, E(host), inAt, done ? outAt : null, done ? 'Completed' : 'Inside', ctx.users.office, inAt]);
  };
  const history: [string, string, string, string, number, string, string][] = [
    ['V-2280', 'Latha Srinivasan', 'Parent meeting — Grade 5', 'EMP-1001', -6, '09:10', '09:50'],
    ['V-2281', 'Kone Elevators engineer', 'Lift maintenance', 'EMP-2015', -6, '10:30', '12:15'],
    ['V-2282', 'Farook Ali', 'Admission enquiry', 'EMP-3002', -5, '11:05', '11:40'],
    ['V-2283', 'Dr. Saranya P.', 'Health camp — vision screening', 'EMP-7014', -4, '08:50', '13:30'],
    ['V-2284', 'Book depot delivery', 'Vendor / contractor', 'EMP-2015', -4, '14:10', '14:35'],
    ['V-2285', 'Priya Mohan', 'Parent meeting — Grade 7', 'EMP-6011', -3, '15:30', '16:05'],
    ['V-2286', 'Fire safety auditor', 'Audit or inspection', 'EMP-2015', -2, '10:00', '12:40'],
    ['V-2287', 'Ramesh Iyer', 'Admission enquiry — campus visit', 'EMP-3002', -1, '10:00', '10:55'],
  ];
  for (const [badge, name, purpose, host, off, inT, outT] of history) addVisit(badge, name, null, purpose, host, ctx.day(off), inT, outT);
  addVisit('V-2288', 'TNEB technician', '+91 94440 11873', 'Transformer check', 'EMP-2015', ctx.today, '07:40', '08:20');
  addVisit('V-2289', 'Cambridge assessor', null, 'Centre audit', 'EMP-1001', ctx.today, '07:58', null);
  addVisit('V-2290', 'Anitha Rao', '+91 98401 66320', 'Admission enquiry', 'EMP-3002', ctx.today, '08:12', '09:05');
  addVisit('V-2291', 'S. Ramanujam', '+91 97899 20417', 'Parent meeting — Grade 8', 'EMP-1088', ctx.today, '08:33', null);
  // Pre-approved for tomorrow morning (not yet happened, so it is 'Expected').
  visitors.push([gdv, 'V-2292', 'Ramesh Iyer', '+91 98844 21007', 'Campus visit — admissions', E('EMP-3002'), ctx.at(ctx.day(1), '10:00'), null, 'Expected', ctx.users.office, now]);
  await bulkInsert(db, 'visitors',
    ['campus_id', 'badge_no', 'full_name', 'phone', 'purpose', 'host_employee_id', 'checked_in_at', 'checked_out_at', 'status', 'created_by', 'created_at'],
    visitors);

  // ---------------------------------------------------------------------------
  // Emergency broadcasts (past only)
  // ---------------------------------------------------------------------------
  await bulkInsert(db, 'emergency_broadcasts', ['campus_id', 'alert_type', 'message', 'audience', 'recipients', 'sent_by', 'sent_at', 'created_at'], [
    [gdv, 'Drill', 'Fire drill — evacuate to the assembly ground now. This is a drill.', 'Parents, Teachers, Staff, Management · App + WhatsApp + SMS', 1354, ctx.users.principal, ctx.at(ctx.day(-12), '11:20'), ctx.at(ctx.day(-12), '11:20')],
    [gdv, 'Transport', 'Route 4 (Bus 4) is running about 15 minutes late because of a road closure at Vallancheri. Pickup times at every stop move by the same amount.', 'Parents on Route 4 · App + WhatsApp', 41, ctx.users.staff, ctx.at(ctx.day(-5), '07:50'), ctx.at(ctx.day(-5), '07:50')],
  ].filter((r) => past(r[6] as Date)));

  // ---------------------------------------------------------------------------
  // Live bus trail for buses currently moving (En route / Delayed)
  // ---------------------------------------------------------------------------
  const moving = (await db.query(
    `SELECT tr.code, tr.vehicle_id, c.latitude AS clat, c.longitude AS clng
       FROM transport_routes tr JOIN campuses c ON c.id = tr.campus_id
      WHERE tr.run_status IN ('En route', 'Delayed') AND tr.vehicle_id IS NOT NULL`,
  )).rows;
  const trail: unknown[][] = [];
  const dayStart = ctx.at(ctx.today, '00:00');
  for (const m of moving) {
    // A moving bus cannot already be parked at campus: drop the core seed's arrival ping.
    await db.query(
      `DELETE FROM vehicle_locations WHERE vehicle_id = $1 AND speed_kmph = 0 AND latitude = $2 AND longitude = $3`,
      [m.vehicle_id, m.clat, m.clng],
    );
    const stops = (await db.query('SELECT latitude, longitude FROM route_stops WHERE route_id = $1 ORDER BY sequence', [ctx.routes[m.code]])).rows
      .map((s) => ({ lat: Number(s.latitude), lng: Number(s.longitude) }));
    if (stops.length < 2) continue;
    const progressEnd = m.code === 'R04' ? 0.62 : 0.7; // fraction of the route covered
    const points = 18;
    for (let i = 0; i < points; i++) {
      const f = (progressEnd * i) / (points - 1);
      const seg = Math.min(stops.length - 2, Math.floor(f * (stops.length - 1)));
      const t = f * (stops.length - 1) - seg;
      let lat = stops[seg].lat + (stops[seg + 1].lat - stops[seg].lat) * t;
      let lng = stops[seg].lng + (stops[seg + 1].lng - stops[seg].lng) * t;
      // Route 4 is on a detour (road closure): the last pings sit ~900 m west of the planned road.
      if (m.code === 'R04' && i >= points - 5) lng -= 0.0085 * Math.min(1, (i - (points - 6)) / 3);
      const at = new Date(now.getTime() - (points - 1 - i) * 2 * 60_000 - 45_000);
      if (at < dayStart) continue;
      trail.push([m.vehicle_id, Math.round(lat * 1e6) / 1e6, Math.round(lng * 1e6) / 1e6, m.code === 'R04' ? ctx.int(8, 22) : ctx.int(22, 38), ctx.int(0, 359), at]);
    }
  }
  await bulkInsert(db, 'vehicle_locations', ['vehicle_id', 'latitude', 'longitude', 'speed_kmph', 'heading', 'recorded_at'], trail);

  // ---------------------------------------------------------------------------
  // Early departures today (Exited KPI) — only after the student arrived
  // ---------------------------------------------------------------------------
  for (const [no, time, gate] of [['HS-2026-1076', '11:50', 'Main Gate'], ['HS-2026-1067', '12:35', 'Rear Gate']] as const) {
    const at = ctx.at(ctx.today, time);
    if (!past(at)) continue;
    await db.query(
      `INSERT INTO gate_events (student_id, campus_id, gate, direction, method, occurred_at, parent_notified_at)
       SELECT $1, $2, $3, 'out', 'Manual', $4, $4
        WHERE EXISTS (SELECT 1 FROM gate_events g WHERE g.student_id = $1 AND g.direction = 'in'
                        AND (g.occurred_at AT TIME ZONE 'Asia/Kolkata')::date = $5::date AND g.occurred_at < $4)`,
      [S(no).id, S(no).campusId, gate, at, ctx.today],
    );
  }

  // ---------------------------------------------------------------------------
  // Infirmary history (term chart) and counselling sessions
  // ---------------------------------------------------------------------------
  const days = ctx.schoolDays(ctx.day(-90), ctx.day(-1));
  const reasons: [string, string, string, number][] = [
    ['Headache', 'Rest 30 min, water', 'Returned to class', 21],
    ['Minor injury — playground', 'Cleaned and dressed', 'Returned to class', 18],
    ['Fever', 'Temperature checked, parent asked to collect', 'Sent home', 12],
    ['Stomach ache', 'Rest and observation', 'Returned to class', 9],
    ['Allergy', 'Care plan followed', 'Returned to class', 4],
  ];
  const gdvStudents = ctx.students.filter((s) => s.campusCode === 'gdv');
  const visits: unknown[][] = [];
  for (const [reason, action, outcome, n] of reasons) {
    for (let i = 0; i < n; i++) {
      const s = ctx.pick(gdvStudents);
      visits.push([s.id, ctx.at(ctx.pick(days), `${String(ctx.int(9, 14)).padStart(2, '0')}:${String(ctx.int(0, 59)).padStart(2, '0')}`), reason, action, outcome, E('EMP-7014'), outcome !== 'Returned to class' || ctx.rand() > 0.5]);
    }
  }
  await bulkInsert(db, 'infirmary_visits', ['student_id', 'visited_at', 'reason', 'action_taken', 'outcome', 'attended_by', 'parent_informed'], visits);

  const sessionReasons = ['Exam anxiety', 'Friendship difficulties', 'Participation decline', 'Attendance and wellbeing', 'Family change', 'Early Warning signal'];
  const supported = ['HS-2026-1073', 'HS-2026-1042', 'HS-2026-1082', 'HS-2026-1058', 'HS-2026-1043', 'HS-2026-1061', 'HS-2026-1088', 'HS-2026-1070'];
  const sessions: unknown[][] = [];
  supported.forEach((no, i) => {
    const count = 1 + (i % 3);
    for (let k = 0; k < count; k++) {
      const d = days[Math.max(0, days.length - 1 - (i * 7 + k * 9)) % days.length];
      sessions.push([S(no).id, E('EMP-6011'), ctx.at(d, `${10 + (k % 4)}:00`), sessionReasons[(i + k) % sessionReasons.length],
        i === 4 && k === count - 1 ? 'Referred' : 'Completed',
        i === 4 && k === count - 1 ? 'Confidential. Referred to Wellbeing First Counselling with parental consent.' : 'Confidential session notes.']);
    }
  });
  sessions.push([S('HS-2026-1082').id, E('EMP-6011'), ctx.at(ctx.day(3), '10:30'), 'Follow-up', 'Scheduled', null]);
  sessions.push([S('HS-2026-1058').id, E('EMP-6011'), ctx.at(ctx.day(-8), '12:00'), 'Exam anxiety', 'Cancelled', null]);
  await bulkInsert(db, 'counselling_sessions', ['student_id', 'counsellor_id', 'session_on', 'reason', 'status', 'notes'], sessions);
}
