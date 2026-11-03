/**
 * SAMPLE DATA — parents-experience domain. Owned by the parents-experience module.
 * Circulars + acknowledgements, PTM sessions + bookings, events, the unified
 * communication history (with an unanswered queue) and parent ↔ staff
 * conversations. Everything is fictional and dated relative to ctx.today.
 */
import { bulkInsert, type Db, type SeedContext } from './context.js';

type Aud = { kind: 'all' | 'grades' | 'transport' | 'staff'; grades?: number[] };

interface Link { parentId: string; studentId: string; isPrimary: boolean; sectionId: string; campusId: string; grade: number; transport: boolean }

const HOUR = 3_600_000;

export async function seed(db: Db, ctx: SeedContext): Promise<void> {
  const now = ctx.now.getTime();
  const ago = (hours: number) => new Date(now - hours * HOUR);
  /** A time today that is never in the future. */
  const todayAt = (hhmm: string, fallbackMinutesAgo = 10) => {
    const t = ctx.at(ctx.today, hhmm);
    return t.getTime() < now ? t : new Date(now - fallbackMinutesAgo * 60_000);
  };

  // ---- Families ------------------------------------------------------------------
  const parents = (await db.query<{ id: string; full_name: string; user_id: string | null; engagement_score: number }>(
    'SELECT id, full_name, user_id, engagement_score FROM parents WHERE deleted_at IS NULL ORDER BY parent_code')).rows;
  const parentByName = Object.fromEntries(parents.map((p) => [p.full_name, p]));
  const links = (await db.query<Link>(
    `SELECT sg.parent_id AS "parentId", sg.student_id AS "studentId", sg.is_primary AS "isPrimary", s.section_id AS "sectionId",
            s.campus_id AS "campusId", c.grade_level AS grade, (st.student_id IS NOT NULL) AS transport
       FROM student_guardians sg JOIN students s ON s.id = sg.student_id AND s.deleted_at IS NULL AND s.status = 'active'
       JOIN sections sec ON sec.id = s.section_id JOIN classes c ON c.id = sec.class_id
       LEFT JOIN student_transport st ON st.student_id = s.id`)).rows;
  const ranjith = parentByName['Ranjith Kumar'];
  const sudha = parentByName['Sudha Raman'];
  const gayathri = parentByName['Gayathri N.'];
  const vimal = parentByName['Vimal Chandran'];
  const prakash = parentByName['Prakash S.'];
  const U = ctx.users;
  const stu = ctx.studentByNo;

  const inAudience = (a: Aud, campusId: string | null) => {
    const ids = new Set<string>();
    if (a.kind === 'staff') return ids;
    for (const l of links) {
      if (campusId && l.campusId !== campusId) continue;
      if (a.kind === 'grades' && !a.grades!.includes(l.grade)) continue;
      if (a.kind === 'transport' && !l.transport) continue;
      ids.add(l.parentId);
    }
    return ids;
  };
  const label = (a: Aud) => a.kind === 'all' ? 'All parents' : a.kind === 'transport' ? 'Transport users' : a.kind === 'staff' ? 'All staff'
    : a.grades!.length === 1 ? `Grade ${a.grades![0]} parents` : `Grades ${a.grades![0]}–${a.grades![a.grades!.length - 1]}`;
  const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  const staffCount = Number((await db.query(
    `SELECT count(*) AS n FROM users u JOIN roles r ON r.id = u.role_id WHERE r.key NOT IN ('parent', 'student')`)).rows[0].n);

  // ---- Circulars & acknowledgements ------------------------------------------------
  const circulars: { title: string; body: string; aud: Aud; days: number | null; status: string; ackShare: number; channels: string[]; requiresAck?: boolean; exclude?: string[] }[] = [
    {
      title: 'Term 3 examination schedule', aud: { kind: 'grades', grades: range(3, 10) }, days: -5, status: 'Released', ackShare: 0.76,
      channels: ['whatsapp', 'push', 'email'], exclude: [ranjith?.id, sudha?.id].filter(Boolean) as string[],
      body: 'Dear parents,\n\nTerm 3 assessments for Grades 3 to 10 begin on Monday 28 September. The subject-wise timetable, syllabus coverage and reporting times are attached in the app. Students should arrive by 08:15 on assessment days.\n\nPlease acknowledge that you have read this circular.\n\nDr. Meera Krishnan, Principal',
    },
    {
      title: 'Annual Innovation Day — 04 Oct', aud: { kind: 'all' }, days: -8, status: 'Released', ackShare: 0.78, channels: ['whatsapp', 'push'],
      body: 'Our Annual Innovation Day exhibition opens at 10:00 on Saturday 04 October in the Auditorium. Students from every grade will present their Innovation Lab projects. Families are warmly invited; please register the number of visitors in the app by 30 September.',
    },
    {
      title: 'Transport fee — Term 3 instalment', aud: { kind: 'transport' }, days: -12, status: 'Released', ackShare: 0.82, channels: ['whatsapp', 'push', 'sms'],
      body: 'The Term 3 transport fee instalment is due on 25 September. You can pay from the Fees tab of the parent app by UPI, card or net banking. A late fee applies after the due date.',
    },
    {
      title: 'Revised pickup authorisation policy', aud: { kind: 'all' }, days: -16, status: 'Released', ackShare: 0.93, channels: ['whatsapp', 'push', 'email'],
      body: 'From 1 September, only persons registered in the app as authorised pickup contacts may collect a child during school hours. Each pickup is verified at the gate by OTP or photo ID. Please review your list under Safety → Pickup authorisation.',
    },
    {
      title: 'Staff briefing — Term 3 invigilation duties', aud: { kind: 'staff' }, days: -3, status: 'Released', ackShare: 0, channels: ['push', 'email'], requiresAck: false,
      body: 'The invigilation roster for Term 3 assessments is now available. Please check your duties and inform the Academic Office of any clash by Friday.',
    },
    {
      title: 'Diwali holiday schedule', aud: { kind: 'all' }, days: null, status: 'Under Review', ackShare: 0, channels: ['whatsapp', 'push'],
      body: 'The school will remain closed on 20 and 21 October for Diwali. Transport will not operate on these days. Classes resume on Thursday 22 October at the usual time.',
    },
    {
      title: 'Grade 10 board preparation briefing', aud: { kind: 'grades', grades: [10] }, days: null, status: 'Draft', ackShare: 0, channels: ['whatsapp', 'push', 'email'],
      body: 'A briefing for Grade 10 parents on the Cambridge IGCSE preparation plan, mock examination dates and study support will be held in the Auditorium. Details to follow.',
    },
  ];
  const ackRows: unknown[][] = [];
  for (const c of circulars) {
    const targets = inAudience(c.aud, null);
    const released = c.status === 'Released';
    const publishedAt = c.days !== null ? ctx.at(ctx.day(c.days), '10:30') : null;
    const r = await db.query<{ id: string }>(
      `INSERT INTO circulars (title, body, audience, audience_filter, requires_ack, status, published_at, target_count, channels,
                              created_by, submitted_by, submitted_at, released_by, last_reminded_at, reminder_count, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`,
      [c.title, c.body, label(c.aud), JSON.stringify(c.aud), c.requiresAck ?? true, c.status, publishedAt,
        c.aud.kind === 'staff' ? staffCount : targets.size, c.channels,
        U.office, c.status === 'Draft' ? null : U.office,
        c.status === 'Draft' ? null : publishedAt ? new Date(publishedAt.getTime() - 20 * HOUR) : ago(20),
        released ? U.principal : null,
        released && c.days! <= -8 ? ctx.at(ctx.day(c.days! + 4), '17:00') : null,
        released && c.days! <= -8 ? 1 : 0,
        publishedAt ? new Date(publishedAt.getTime() - 26 * HOUR) : ago(c.status === 'Draft' ? 3 : 28)],
    );
    if (!released || !(c.requiresAck ?? true)) continue;
    for (const pid of targets) {
      if (c.exclude?.includes(pid) && c.title.startsWith('Term 3')) continue;
      const eng = parents.find((p) => p.id === pid)?.engagement_score ?? 60;
      const share = Math.min(0.98, c.ackShare + (eng - 65) / 250);
      if (pid !== ranjith?.id && (eng < 45 || ctx.rand() > share)) continue; // low-engagement families have not acknowledged anything
      const lag = Math.min(ctx.int(1, 6 * 24) * HOUR, now - publishedAt!.getTime() - HOUR);
      ackRows.push([r.rows[0].id, pid, new Date(publishedAt!.getTime() + Math.max(lag, 10 * 60_000))]);
    }
  }
  await bulkInsert(db, 'circular_acknowledgements', ['circular_id', 'parent_id', 'acknowledged_at'], ackRows);

  // ---- PTM sessions & bookings ---------------------------------------------------------
  const E = ctx.employeeByName;
  const sec5A = ctx.sections['gdv:5:A'];
  const sec7B = ctx.sections['gdv:7:B'];
  const kids = (sectionId: string, excludeParents: string[]) =>
    ctx.students.filter((s) => s.sectionId === sectionId && s.parentId && !excludeParents.includes(s.parentId));
  const sessions: { teacher: string; label: string; sectionId: string; day: number; start: string; share: number; free: number; venue: string; past?: boolean; extra?: { studentNo: string; slot: number }[] }[] = [
    { teacher: 'Ms. Priya Raghavan', label: 'Mathematics · Grade 5A', sectionId: sec5A, day: 3, start: '09:00', share: 1, free: 4, venue: 'Academic Block · R-204' },
    { teacher: 'Mr. Ganesh Venkat', label: 'Science · Grade 5A', sectionId: sec5A, day: 3, start: '09:00', share: 0.65, free: 5, venue: 'Academic Block · Lab-1', extra: [{ studentNo: 'HS-2026-1085', slot: 2 }] },
    { teacher: 'Ms. Lalitha Ramesh', label: 'English · Grade 5A', sectionId: sec5A, day: 4, start: '09:30', share: 1, free: 0, venue: 'Academic Block · R-206', extra: [{ studentNo: 'HS-2026-1085', slot: 1 }, { studentNo: 'HS-2026-1041', slot: 0 }] },
    { teacher: 'Ms. Anitha Devi', label: 'Social Studies · Grade 5A', sectionId: sec5A, day: 4, start: '10:30', share: 0.4, free: 7, venue: 'Academic Block · R-208' },
    { teacher: 'Mr. Ganesh Venkat', label: 'Science · Grade 7B', sectionId: sec7B, day: 4, start: '11:00', share: 0.8, free: 6, venue: 'Academic Block · Lab-1' },
    { teacher: 'Ms. Priya Raghavan', label: 'Mathematics · Grade 5A (Term 2)', sectionId: sec5A, day: -62, start: '09:00', share: 0.9, free: 2, venue: 'Academic Block · R-204', past: true },
  ];
  const bookingRows: unknown[][] = [];
  for (const s of sessions) {
    const exclude = [ranjith?.id, sudha?.id].filter(Boolean) as string[];
    const pool = kids(s.sectionId, s.past ? [] : exclude);
    const chosen = pool.filter(() => s.share >= 1 || ctx.rand() < s.share);
    const extra = (s.extra ?? []).map((x) => stu[x.studentNo]).filter(Boolean);
    const all = [...chosen, ...extra];
    const total = all.length + s.free;
    const order = Array.from({ length: total }, (_, i) => i + 1).sort(() => ctx.rand() - 0.5);
    const r = await db.query<{ id: string }>(
      `INSERT INTO ptm_sessions (employee_id, section_id, subject_label, session_date, starts_at, slot_minutes, total_slots, venue, created_at)
       VALUES ($1,$2,$3,$4,$5,10,$6,$7,$8) RETURNING id`,
      [E[s.teacher], s.sectionId, s.label, ctx.day(s.day), s.start, total, s.venue, ctx.at(ctx.day(Math.min(s.day, 0) - 6), '11:00')]);
    all.forEach((st, i) => {
      const status = s.past ? (ctx.rand() > 0.12 ? 'Attended' : 'No-show') : 'Booked';
      const bookedAt = s.past ? ctx.at(ctx.day(s.day - ctx.int(1, 5)), '19:00') : ago(ctx.int(2, 90));
      bookingRows.push([r.rows[0].id, order[i], st.parentId, st.id, status, bookedAt]);
    });
  }
  await bulkInsert(db, 'ptm_bookings', ['ptm_session_id', 'slot_no', 'parent_id', 'student_id', 'status', 'created_at'], bookingRows);

  // ---- Events ------------------------------------------------------------------------------
  const gdv = ctx.campuses.gdv.id;
  const vdv = ctx.campuses.vdv.id;
  const events: [string, string, string, number, number | null, string | null, string, Aud, string | null, string, string][] = [
    ['Inter-house Athletics Meet', 'Track and field events across the four houses. Parents are welcome in the stands from 08:30.', 'Sports', 7, null, '08:30', 'Main Field', { kind: 'grades', grades: range(3, 10) }, gdv, 'Published', ''],
    ['Parent–Teacher Meeting — Grade 5', 'Ten-minute conversations with each subject teacher. Book your slots in the parent app.', 'PTM', 3, 4, '09:00', 'Academic Block', { kind: 'grades', grades: [5] }, gdv, 'Published', 'notified'],
    ['Innovation Day exhibition', 'Students present their Innovation Lab projects to families and guests.', 'Academic', 17, null, '10:00', 'Auditorium', { kind: 'all' }, null, 'Published', 'notified'],
    ['Cambridge curriculum briefing', 'The Academic Office explains the Lower Secondary to IGCSE pathway and subject choices.', 'Academic', 24, null, '17:30', 'Auditorium', { kind: 'grades', grades: [8, 9] }, gdv, 'Published', ''],
    ['Gandhi Jayanti — school closed', 'The school and transport services will be closed.', 'Holiday', 15, null, null, 'All campuses', { kind: 'all' }, null, 'Published', ''],
    ['Diwali break', 'School closed for Diwali. Classes resume on the following day.', 'Holiday', 33, 34, null, 'All campuses', { kind: 'all' }, null, 'Published', ''],
    ['Grade 3 storytelling week', 'Daily storytelling sessions in English and Tamil; parents may volunteer as guest readers.', 'Cultural', 10, 14, '11:00', 'Library', { kind: 'grades', grades: [3] }, gdv, 'Published', ''],
    ['Vadavalli Science Fair', 'Primary and Lower Secondary science projects at the Vadavalli campus.', 'Academic', 12, null, '10:00', 'Vadavalli Hall', { kind: 'all' }, vdv, 'Published', ''],
    ['Inter-school quiz — postponed', 'Postponed by the host school; a new date will be shared.', 'School', 6, null, '14:00', 'Auditorium', { kind: 'grades', grades: range(6, 10) }, gdv, 'Cancelled', ''],
    ['Annual Sports Day', 'Draft plan — venue and timings to be confirmed.', 'Sports', 45, null, '08:00', 'Main Field', { kind: 'all' }, gdv, 'Draft', ''],
    ['Transport safety orientation', 'A short session for transport users on boarding, the live bus tracker and pickup rules.', 'School', 9, null, '16:00', 'Auditorium', { kind: 'transport' }, gdv, 'Published', ''],
    ["Teachers' Day celebration", 'Student-led assembly and performances.', 'Cultural', -12, null, '09:00', 'Auditorium', { kind: 'all' }, gdv, 'Published', 'notified'],
    ['Independence Day assembly', 'Flag hoisting and cultural programme.', 'School', -33, null, '08:00', 'Main Field', { kind: 'all' }, null, 'Published', 'notified'],
    ['Grade 5 Science field trip', 'Visit to the Birla Planetarium, Chennai.', 'Academic', -9, null, '08:00', 'Birla Planetarium', { kind: 'grades', grades: [5] }, gdv, 'Published', 'notified'],
  ];
  await bulkInsert(db, 'events',
    ['campus_id', 'title', 'description', 'event_type', 'starts_on', 'ends_on', 'starts_at', 'venue', 'audience', 'audience_filter', 'status', 'notified_at', 'created_by', 'created_at'],
    events.map(([title, desc, type, d, end, time, venue, aud, campus, status, notified]) => [
      campus, title, desc, type, ctx.day(d), end === null ? null : ctx.day(end), time, venue, label(aud), JSON.stringify(aud), status,
      notified ? (d < 0 ? ctx.at(ctx.day(d - 3), '18:00') : ago(30)) : null, ctx.pick([U.office, U.principal]),
      d < 0 ? ctx.at(ctx.day(d - 20), '10:00') : ago(ctx.int(48, 400)),
    ]));

  // ---- Message threads -------------------------------------------------------------------------
  async function thread(subject: string, studentNo: string, parentUser: string, staffUser: string, status: string,
    msgs: [who: 'p' | 's', hoursAgo: number, body: string][], parentReadAll = true) {
    const first = msgs[0];
    const last = msgs[msgs.length - 1];
    const t = await db.query<{ id: string }>(
      `INSERT INTO message_threads (subject, student_id, created_by, last_message_at, status, created_at) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [subject, stu[studentNo].id, first[0] === 'p' ? parentUser : staffUser, ago(last[1]), status, ago(first[1])]);
    const id = t.rows[0].id;
    const lastFrom = (w: 'p' | 's') => [...msgs].reverse().find((m) => m[0] === w)?.[1];
    const staffRead = last[0] === 's' ? ago(last[1]) : lastFrom('s') !== undefined ? ago(lastFrom('s')!) : null;
    await db.query(
      `INSERT INTO message_thread_participants (thread_id, user_id, last_read_at) VALUES ($1,$2,$3), ($1,$4,$5)`,
      [id, parentUser, parentReadAll ? ago(Math.max(0.1, last[1] - 0.2)) : ago(lastFrom('p') ?? last[1]), staffUser, staffRead]);
    await bulkInsert(db, 'messages', ['thread_id', 'sender_id', 'body', 'created_at'],
      msgs.map(([w, h, body]) => [id, w === 'p' ? parentUser : staffUser, body, ago(h)]));
    return id;
  }

  const t1 = await thread('Sanjana — attendance and Science support', 'HS-2026-1042', U.parent2, U.teacher2, 'Open', [
    ['p', 52, 'Good evening sir. Sanjana says she did not understand the States of Matter lesson and is worried about the test.'],
    ['s', 50, 'Thank you for telling me. I will run a short recap with her group on Thursday during the support period.'],
    ['p', 49.5, 'Thank you. She has missed a few days this month because of fever. Is she falling behind?'],
    ['s', 27, 'She has missed four days and her Science average has dropped. Could you meet me on Friday after school so we can agree a plan together?'],
  ], false);
  const t2 = await thread('Fractions homework — Aditya', 'HS-2026-1041', U.parent, U.teacher, 'Open', [
    ['s', 30, 'Aditya did very well in today’s fractions quiz. Please encourage him to finish worksheet 4 at home.'],
    ['p', 6, 'Thank you, Ms. Priya. He is stuck on question 7 (adding mixed fractions). Could you share an example?'],
  ]);
  const t3 = await thread('Pickup point change — Surya', 'HS-2026-1085', U.parent, U.office, 'Closed', [
    ['p', 140, 'We have moved house for two weeks. Can Surya be dropped at Lake View Avenue stop instead?'],
    ['s', 138, 'Done — the transport team has updated the drop point until the end of the month.'],
    ['p', 137.5, 'Thank you!'],
  ]);

  // ---- Communications ------------------------------------------------------------------------------
  type Row = [channel: string, direction: string, parentId: string | null, studentId: string | null, counterpart: string, subject: string,
    body: string | null, status: string, recipients: number, needsReply: boolean, repliedAt: Date | null, sentBy: string | null, at: Date, threadId: string | null, repliedBy: string | null];
  const rows: Row[] = [];
  const add = (r: Row) => rows.push(r);
  const S = (no: string) => stu[no]?.id ?? null;

  // From the wireframe
  add(['WhatsApp', 'outbound', ranjith.id, S('HS-2026-1041'), ranjith.full_name, 'Term 3 fee instalment reminder', 'A gentle reminder that the Term 3 instalment of ₹22,000 is due on 25 September.', 'Delivered', 1, false, null, U.office, todayAt('09:20', 25), null, null]);
  add(['Call', 'outbound', sudha.id, S('HS-2026-1042'), sudha.full_name, 'Attendance follow-up — Sanjana', 'Called to discuss Sanjana’s attendance. No answer; will try again after 16:00.', 'No answer', 1, false, null, U.teacher2, todayAt('08:50', 40), null, null]);
  add(['Email', 'outbound', vimal.id, S('HS-2026-1043'), vimal.full_name, 'Grade 9 subject selection', 'Subject selection form for the IGCSE options, due on 30 September.', 'Opened', 1, false, null, U.office, ago(26), null, null]);
  add(['SMS', 'outbound', null, null, 'Route 4 parents', 'Bus running 9 minutes late', 'Bus 4 is running 9 minutes late this morning due to traffic at Potheri.', 'Delivered', 41, false, null, U.staff, todayAt('08:18', 55), null, null]);
  add(['Note', 'internal', null, null, 'Kavitha S.', 'Lead LD-4412 prefers weekend campus visit', 'Parent works weekdays; offer Saturday 10:00.', 'Internal', 1, false, null, U.office, ago(22), null, null]);

  // Sudha — WhatsApp conversation (oldest unanswered, ~31 h)
  add(['WhatsApp', 'inbound', sudha.id, S('HS-2026-1042'), sudha.full_name, 'Absence today — Sanjana', 'Good morning. Sanjana is unwell today so she will not attend. I have a doctor’s note if needed.', 'Delivered', 1, false, ago(32), null, ago(32.6), null, U.teacher2]);
  add(['WhatsApp', 'outbound', sudha.id, S('HS-2026-1042'), sudha.full_name, 'Re: Absence today — Sanjana', 'Thank you for letting us know. I have recorded today as an approved absence.', 'Delivered', 1, false, null, U.teacher2, ago(32), null, null]);
  add(['WhatsApp', 'inbound', sudha.id, S('HS-2026-1042'), sudha.full_name, 'Absence today — Sanjana', 'Thank you. She has missed a few days this month, I know. Is she falling behind?', 'Delivered', 1, true, null, null, ago(31.2), null, null]);

  // Unanswered queue (9 in total, oldest ~31 h)
  add(['WhatsApp', 'inbound', gayathri.id, S('HS-2026-1061'), gayathri.full_name, 'Transport route change — Gokul', 'We are moving to Urapakkam next month. Is there a bus route that covers Karanai?', 'Delivered', 1, true, null, null, ago(18.4), null, null]);
  add(['WhatsApp', 'inbound', ranjith.id, S('HS-2026-1041'), ranjith.full_name, 'Robotics club timing', 'Will the Robotics club on Wednesday finish at 16:30 or 17:00? I need to plan the pickup.', 'Delivered', 1, true, null, null, ago(4.2), null, null]);
  add(['In-app', 'inbound', ranjith.id, S('HS-2026-1041'), ranjith.full_name, 'Re: Fractions homework — Aditya', 'Thank you, Ms. Priya. He is stuck on question 7 (adding mixed fractions). Could you share an example?', 'Delivered', 1, true, null, U.parent, ago(6), t2, null]);
  add(['In-app', 'outbound', ranjith.id, S('HS-2026-1041'), ranjith.full_name, 'Fractions homework — Aditya', 'Aditya did very well in today’s fractions quiz. Please encourage him to finish worksheet 4 at home.', 'Delivered', 1, false, null, U.teacher, ago(30), t2, null]);
  add(['In-app', 'inbound', sudha.id, S('HS-2026-1042'), sudha.full_name, 'Sanjana — attendance and Science support', 'Good evening sir. Sanjana says she did not understand the States of Matter lesson and is worried about the test.', 'Delivered', 1, false, ago(50), U.parent2, ago(52), t1, U.teacher2]);
  add(['In-app', 'outbound', sudha.id, S('HS-2026-1042'), sudha.full_name, 'Re: Sanjana — attendance and Science support', 'She has missed four days and her Science average has dropped. Could you meet me on Friday after school?', 'Delivered', 1, false, null, U.teacher2, ago(27), t1, null]);
  add(['In-app', 'inbound', ranjith.id, S('HS-2026-1085'), ranjith.full_name, 'Pickup point change — Surya', 'We have moved house for two weeks. Can Surya be dropped at Lake View Avenue stop instead?', 'Delivered', 1, false, ago(138), U.parent, ago(140), t3, U.office]);
  add(['WhatsApp', 'inbound', prakash.id, S('HS-2026-1089'), prakash.full_name, 'PTM slot request — Varsha', 'Could we have a slot after 11:00 with Varsha’s class teacher? I work mornings.', 'Delivered', 1, false, ago(46), null, ago(48), null, U.office]);
  add(['WhatsApp', 'outbound', prakash.id, S('HS-2026-1089'), prakash.full_name, 'Re: PTM slot request — Varsha', 'We have noted your request. Grade 4 PTM slots after 11:00 open next week.', 'Delivered', 1, false, null, U.office, ago(46), null, null]);

  // Other families: 5 more unanswered + ~40 routine interactions over the last month
  const others = parents.filter((p) => ![ranjith.id, sudha.id, gayathri.id, vimal.id, prakash.id].includes(p.id));
  const childOf = (pid: string) => links.find((l) => l.parentId === pid && l.isPrimary)?.studentId ?? links.find((l) => l.parentId === pid)?.studentId ?? null;
  const queue: [string, string, string, number][] = [
    ['Email', 'Request for bonafide certificate', 'Could you issue a bonafide certificate for a passport application?', 26.5],
    ['WhatsApp', 'Lunch box left at home', 'My son forgot his lunch box; I will drop it at the gate at 12:00. Please let him know.', 2.6],
    ['SMS', 'Change of mobile number', 'Please update my number for school alerts to the one I am messaging from.', 22.3],
    ['Email', 'Clarification on Term 3 portions', 'Is chapter 6 included in the Term 3 Science assessment?', 12.1],
    ['WhatsApp', 'Early pickup on Friday', 'I need to pick up my daughter at 13:00 on Friday for a family function.', 7.4],
  ];
  queue.forEach(([channel, subject, body, h], i) => {
    const p = others[(i * 7 + 3) % others.length];
    add([channel, 'inbound', p.id, childOf(p.id), p.full_name, subject, body, 'Delivered', 1, true, null, null, ago(h), null, null]);
  });
  const routine: [string, string, string, string][] = [
    ['WhatsApp', 'outbound', 'Homework reminder', 'Delivered'], ['WhatsApp', 'outbound', 'Absence alert', 'Delivered'],
    ['WhatsApp', 'inbound', 'Thank you note', 'Delivered'], ['WhatsApp', 'outbound', 'Fee receipt shared', 'Delivered'],
    ['Email', 'outbound', 'Monthly progress summary', 'Opened'], ['Email', 'outbound', 'Report card released', 'Opened'],
    ['Email', 'inbound', 'Leave request', 'Delivered'], ['Email', 'outbound', 'Club enrolment confirmation', 'Delivered'],
    ['SMS', 'outbound', 'Bus arrival alert', 'Delivered'], ['SMS', 'outbound', 'Fee due reminder', 'Delivered'],
    ['Call', 'outbound', 'Attendance follow-up', 'Connected'], ['Call', 'outbound', 'Wellbeing check-in', 'Connected'],
    ['Call', 'inbound', 'Transport query', 'Connected'], ['Call', 'outbound', 'Fee follow-up', 'No answer'],
    ['Note', 'internal', 'Parent prefers Tamil for calls', 'Internal'], ['Note', 'internal', 'Discussed support plan with counsellor', 'Internal'],
  ];
  const senders = [U.office, U.teacher, U.teacher2, U.principal, U.office, U.finance];
  for (let i = 0; i < 42; i++) {
    const [channel, direction, subject, status] = routine[i % routine.length];
    const p = others[(i * 11 + 5) % others.length];
    const at = ago(ctx.int(8, 29 * 24) + ctx.rand());
    const sid = childOf(p.id);
    add([channel, direction, p.id, sid, p.full_name, subject, `${subject} — ${p.full_name.split(' ')[0]}.`, status, 1,
      false, direction === 'inbound' ? new Date(at.getTime() + ctx.int(1, 6) * HOUR) : null,
      direction === 'inbound' ? null : ctx.pick(senders), at, null,
      direction === 'inbound' ? ctx.pick(senders) : null]);
  }
  // Broadcast-style outbound rows
  add(['WhatsApp', 'outbound', null, null, 'Grade 5 parents', 'PTM booking is open', 'Book your 10-minute slots in the parent app.', 'Delivered', inAudience({ kind: 'grades', grades: [5] }, null).size, false, null, U.office, ago(30), null, null]);
  add(['In-app', 'outbound', null, null, 'Grades 3–10', 'Circular: Term 3 examination schedule', null, 'Delivered', 0, false, null, U.principal, ctx.at(ctx.day(-5), '10:30'), null, null]);

  await bulkInsert(db, 'communications',
    ['channel', 'direction', 'parent_id', 'student_id', 'counterpart', 'subject', 'body', 'status', 'recipients', 'needs_reply', 'replied_at', 'sent_by', 'occurred_at', 'thread_id', 'replied_by', 'created_at'],
    rows.map((r) => [...r.slice(0, 13), r[13], r[14], r[12]]));

  // Last contact follows the latest real interaction
  await db.query(
    `UPDATE parents p SET last_contact_at = x.at, last_contact_channel = x.channel
       FROM (SELECT DISTINCT ON (parent_id) parent_id, occurred_at AS at, channel FROM communications
              WHERE parent_id IS NOT NULL AND channel <> 'Note' ORDER BY parent_id, occurred_at DESC) x
      WHERE x.parent_id = p.id`);
  // Keep the audience target counts of broadcast rows honest
  await db.query(
    `UPDATE communications c SET recipients = ci.target_count FROM circulars ci
      WHERE c.subject = 'Circular: ' || ci.title AND c.recipients = 0`);
}
