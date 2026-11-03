/**
 * SAMPLE DATA — Student Innovation Lab: ideas, the six wireframe projects
 * (IP-091 …), members, milestones, evidence, mentor feedback, competitions,
 * entries and innovation achievements. Dates are relative to today.
 */
import { bulkInsert, type Db, type SeedContext } from './context.js';

const STATUS = ['Idea', 'Under review', 'Mentor assigned', 'Project', 'Prototype', 'Competition', 'Achievement'];

export async function seed(db: Db, ctx: SeedContext): Promise<void> {
  const S = (no: string) => {
    const s = ctx.studentByNo[no];
    if (!s) throw new Error(`innovation seed: student ${no} missing`);
    return s;
  };
  const E = ctx.employees;
  const past = (n: number, hh = '10:00') => ctx.at(ctx.day(-n), hh);

  // ---------------------------------------------------------------------------
  // Ideas
  // ---------------------------------------------------------------------------
  // [key, title, problem, student, category, status, submitted offset, reviewer]
  const IDEAS: [string, string, string, string, string, string, number, string | null][] = [
    ['rain', 'Rainwater level sensor for school tanks', 'Staff climb onto the roof to check tank levels. A sensor could show the level on a phone and warn before tanks run dry.', 'HS-2026-1041', 'Environment & sustainability', 'Converted', -107, 'EMP-6003'],
    ['tamil', 'Tamil handwriting practice app', 'Younger students need more guided practice forming Tamil letters than class time allows.', 'HS-2026-1070', 'Software & apps', 'Converted', -95, 'EMP-7002'],
    ['air', 'Low-cost air quality monitor', 'Classrooms near the road feel stuffy in the afternoon; we do not know how bad the air is.', 'HS-2026-1090', 'Environment & sustainability', 'Converted', -80, 'EMP-1044'],
    ['waste', 'Campus waste segregation game', 'Bins are mixed up every day. A game could teach juniors which bin to use.', 'HS-2026-1067', 'Community & social', 'Converted', -40, 'EMP-6011'],
    ['bus', 'Bus seat occupancy counter', 'Transport staff count seats by hand; a counter could report free seats per route.', 'HS-2026-1079', 'Robotics & electronics', 'Converted', -240, 'EMP-6003'],
    ['lib', 'Library recommendation board', 'Students do not know what their friends are reading; a board could show popular books by grade.', 'HS-2026-1088', 'Community & social', 'Converted', -20, 'EMP-1092'],
    ['solar', 'Solar phone charger for the bus bay', 'Parents waiting at the bus bay often have flat phones; a solar charger could help.', 'HS-2026-1061', 'Environment & sustainability', 'Submitted', -12, null],
    ['lost', 'Lost property tracker', 'Lost items pile up at the front office and are hard to match with owners.', 'HS-2026-1089', 'Community & social', 'Submitted', -9, null],
    ['noise', 'Noise level display for the canteen', 'The canteen gets very loud; a display could nudge everyone to lower their voices.', 'HS-2026-1079', 'Health & wellbeing', 'Under Review', -7, 'EMP-6003'],
    ['plant', 'Automatic plant watering for the garden club', 'Plants dry out over long weekends.', 'HS-2026-1055', 'Robotics & electronics', 'Accepted', -15, 'EMP-1044'],
    ['queue', 'Canteen pre-order kiosk', 'Queues at break are long; pre-ordering could cut waiting time.', 'HS-2026-1076', 'Software & apps', 'Declined', -30, 'EMP-6003'],
    ['braille', 'Braille label maker for the library', 'Labels would help a visually impaired visitor programme.', 'HS-2026-1082', 'Health & wellbeing', 'Submitted', -3, null],
    ['wind', 'Mini wind turbine for the science park', 'Show how wind power works with a real model.', 'HS-2026-1058', 'Environment & sustainability', 'Submitted', -1, null],
  ];
  const ideaId: Record<string, string> = {};
  for (const [key, title, problem, no, cat, status, sub, reviewer] of IDEAS) {
    const r = await db.query(
      `INSERT INTO innovation_ideas (title, problem, student_id, category, status, reviewed_by, submitted_on, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [title, problem, S(no).id, cat, status, reviewer ? E[reviewer] : null, ctx.day(sub), past(-sub, '09:30')]);
    ideaId[key] = r.rows[0].id;
  }

  // ---------------------------------------------------------------------------
  // Projects (wireframe six)
  // ---------------------------------------------------------------------------
  // [code, idea, title, summary, lead, mentor, stage, started offset, updated offset, members]
  const PROJECTS: [string, string, string, string, string, string, number, number, number, [string, string][]][] = [
    ['IP-091', 'rain', 'Rainwater level sensor for school tanks', 'Ultrasonic sensor, microcontroller and a waterproof housing that reports tank levels to the maintenance team.', 'HS-2026-1041', 'EMP-6003', 5, -100, -5, [['HS-2026-1085', 'Member']]],
    ['IP-088', 'tamil', 'Tamil handwriting practice app', 'A tablet app with stroke-order guidance and progress tracking for Grades 1–3.', 'HS-2026-1070', 'EMP-7002', 4, -88, -7, [['HS-2026-1073', 'Designer']]],
    ['IP-084', 'air', 'Low-cost air quality monitor', 'PM2.5 and CO2 sensors in three classrooms with a daily summary on the notice board.', 'HS-2026-1090', 'EMP-1044', 3, -72, -9, [['HS-2026-1043', 'Member']]],
    ['IP-079', 'waste', 'Campus waste segregation game', 'A playground game and poster series that teaches juniors how to sort waste.', 'HS-2026-1067', 'EMP-6011', 2, -33, -12, [['HS-2026-1064', 'Member']]],
    ['IP-076', 'bus', 'Bus seat occupancy counter', 'IR beam counters at the bus door that report free seats per route to Transport.', 'HS-2026-1079', 'EMP-6003', 6, -230, -18, []],
    ['IP-072', 'lib', 'Library recommendation board', 'A digital board in the library showing the most borrowed books by grade.', 'HS-2026-1088', 'EMP-1092', 1, -15, -15, []],
  ];
  const projectId: Record<string, string> = {};
  for (const [code, idea, title, summary, lead, mentor, stage, started, updated, members] of PROJECTS) {
    const r = await db.query(
      `INSERT INTO innovation_projects (code, title, summary, idea_id, lead_student_id, mentor_id, stage, status, started_on, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [code, title, summary, ideaId[idea], S(lead).id, E[mentor], stage, STATUS[stage], ctx.day(started), past(-started), past(-updated, '16:00')]);
    const id = r.rows[0].id;
    projectId[code] = id;
    await bulkInsert(db, 'innovation_project_members', ['project_id', 'student_id', 'role'],
      [[id, S(lead).id, 'Lead'], ...members.map(([no, role]) => [id, S(no).id, role])]);
  }

  // ---------------------------------------------------------------------------
  // Milestones — [title, due offset, completed offset | null, evidence, feedback]
  // ---------------------------------------------------------------------------
  type M = [string, number, number | null, string | null, string | null];
  const MS: Record<string, M[]> = {
    'IP-091': [
      ['Idea submitted and reviewed', -95, -97, 'Accepted into the lab with a mentor assigned.', null],
      ['Design and first build', -70, -72, 'Ultrasonic sensor, microcontroller, waterproof housing.', 'Good choice of low-cost parts.'],
      ['Test in the school tank', -55, -56, 'Readings within 3 cm of the manual measurement.', null],
      ['District Robotics Challenge', -36, -36, 'Second of 34 teams. Judges noted the low-cost housing.', 'Excellent presentation.'],
      ['Two-week reliability test', 9, null, null, 'Log drift twice a day.'],
    ],
    'IP-088': [
      ['Problem interviews with Grade 2 teachers', -80, -82, 'Notes from 4 teachers.', null],
      ['Paper prototype', -65, -66, 'Stroke-order cards tested with 6 students.', null],
      ['First app build', -40, -41, 'Letters அ to ஔ implemented.', null],
      ['Progress tracking screen', -20, -22, null, null],
      ['User testing with Grade 3', 3, null, null, null],
      ['Accessibility review', 25, null, null, null],
    ],
    'IP-084': [
      ['Sensor selection', -60, -61, 'Compared three PM2.5 sensors on cost and accuracy.', null],
      ['Enclosure and wiring', -35, -37, null, null],
      ['Sensor calibration', -5, null, null, 'Calibrate against the reference reading from the district station.'],
      ['Classroom pilot (3 rooms)', 14, null, null, null],
      ['Findings poster', 35, null, null, null],
    ],
    'IP-079': [
      ['Mentor assignment and plan', -30, -31, 'Plan agreed with Ms. Deepa Venkat.', null],
      ['Game design document', -7, null, null, null],
      ['Playtest with Grade 3', 12, null, null, null],
      ['Poster series', 30, null, null, null],
    ],
    'IP-076': [
      ['Idea review', -225, -226, null, null],
      ['Beam counter prototype', -190, -192, null, null],
      ['Bus trial — Route 12', -150, -152, 'Counted within 1 seat on 18 of 20 runs.', null],
      ['Transport dashboard link', -110, -111, null, null],
      ['Regional round submission', -40, -42, null, null],
      ['Young Innovators Regional Round', -18, -18, 'Finalist.', 'Outstanding persistence.'],
    ],
    'IP-072': [
      ['Survey students on reading habits', 6, null, null, null],
      ['Board layout design', 20, null, null, null],
      ['Library data export', 34, null, null, null],
      ['Install and launch', 50, null, null, null],
    ],
  };
  const msRows: unknown[][] = [];
  for (const [code, list] of Object.entries(MS)) {
    list.forEach(([title, due, done, ev, fb], i) => msRows.push([projectId[code], i + 1, title, ctx.day(due), done == null ? null : ctx.day(done), ev, fb]));
  }
  await bulkInsert(db, 'innovation_milestones', ['project_id', 'sequence', 'title', 'due_on', 'completed_on', 'evidence', 'feedback'], msRows);

  // ---------------------------------------------------------------------------
  // Evidence & mentor feedback
  // ---------------------------------------------------------------------------
  const ev: unknown[][] = [];
  const EV: [string, string, string, number][] = [
    ['IP-091', 'Prototype photo', 'Photo', 60], ['IP-091', 'Test log', 'Test log', 55], ['IP-091', 'Judging sheet', 'Judging sheet', 36],
    ['IP-091', 'Design sketch', 'Document', 72], ['IP-091', 'Demo video', 'Video', 40], ['IP-091', 'Cost sheet', 'Document', 30],
    ['IP-088', 'App screenshots', 'Photo', 22], ['IP-088', 'Teacher interview notes', 'Document', 80],
    ['IP-084', 'Sensor comparison table', 'Document', 61], ['IP-076', 'Regional round certificate', 'Document', 18],
  ];
  for (const [code, title, kind, ago] of EV) ev.push([projectId[code], title, kind, null, ctx.users.teacher, past(ago)]);
  await bulkInsert(db, 'innovation_evidence', ['project_id', 'title', 'kind', 'note', 'added_by', 'created_at'], ev);

  const FB: [string, string, string, string, number][] = [
    ['IP-091', 'EMP-6003', 'Mr. Sathish Kumar', 'The housing design is the strongest part of this project. Next step is reliability: run the sensor continuously for two weeks and log the drift before the expo.', 5],
    ['IP-091', 'EMP-6003', 'Mr. Sathish Kumar', 'Well presented at the district round. Keep the cost sheet updated for the state entry.', 35],
    ['IP-088', 'EMP-7002', 'Ms. Kalaiselvi M.', 'Stroke animations are clear. Test with at least ten Grade 3 students before adding more letters.', 7],
    ['IP-084', 'EMP-1044', 'Mr. Ganesh Venkat', 'Calibration is now overdue — book Lab-1 this week and compare against the reference readings.', 9],
    ['IP-076', 'EMP-6003', 'Mr. Sathish Kumar', 'Finalist at the regional round — a great result. Document the build so juniors can extend it.', 18],
  ];
  await bulkInsert(db, 'innovation_feedback', ['project_id', 'author_id', 'author_name', 'body', 'created_at'],
    FB.map(([code, emp, name, body, ago]) => [projectId[code], E[emp], name, body, past(ago, '15:00')]));

  // ---------------------------------------------------------------------------
  // Competitions + entries
  // ---------------------------------------------------------------------------
  // [key, name, level, held offset, result, entries[[code, result]]]
  const COMPS: [string, string, string, number, string, [string, string][]][] = [
    ['drc', 'District Robotics Challenge', 'District', -36, '2nd place — Rainwater sensor',
      [['IP-091', '2nd place'], ['IP-076', 'Participation'], ['IP-088', 'Participation'], ['IP-084', 'Participation']]],
    ['sse', 'State Science Expo', 'State', 31, 'Registered', [['IP-091', 'Registered'], ['IP-088', 'Registered'], ['IP-084', 'Registered']]],
    ['yis', 'Young Innovators Summit', 'National', 80, 'Shortlisting in progress', [['IP-091', 'Shortlisting'], ['IP-088', 'Shortlisting']]],
    ['yir', 'Young Innovators Regional Round', 'State', -18, 'Finalist — Bus seat counter', [['IP-076', 'Finalist']]],
    ['hack', 'Inter-school Hackathon', 'District', -130, 'Participation', [['IP-076', 'Participation']]],
  ];
  const entries: unknown[][] = [];
  for (const [, name, level, held, result, list] of COMPS) {
    const r = await db.query('INSERT INTO competitions (name, level, held_on, teams, result) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [name, level, ctx.day(held), list.length, result]);
    for (const [code, res] of list) entries.push([r.rows[0].id, projectId[code], res]);
  }
  await bulkInsert(db, 'competition_entries', ['competition_id', 'project_id', 'result'], entries);

  // ---------------------------------------------------------------------------
  // Achievements of lab participants (verified) + links to projects
  // ---------------------------------------------------------------------------
  const ACH: [string, string, string, string, number, string | null][] = [
    ['HS-2026-1079', 'Young Innovators Regional Round — finalist', 'Innovation', 'State', -18, 'IP-076'],
    ['HS-2026-1070', 'State Tamil essay competition — 1st', 'Academic', 'State', -61, null],
    ['HS-2026-1064', 'District athletics — 200m bronze', 'Sports', 'District', -87, null],
    ['HS-2026-1090', 'Science expo selection', 'Competition', 'State', -3, null],
    ['HS-2026-1070', 'District Robotics Challenge — participation', 'Competition', 'District', -36, null],
  ];
  for (const [no, title, type, level, ago, code] of ACH) {
    const r = await db.query(
      `INSERT INTO achievements (student_id, title, achievement_type, level, achieved_on, is_verified, verified_by, verified_at, created_by)
       VALUES ($1,$2,$3,$4,$5,true,$6,$7,$6) RETURNING id`,
      [S(no).id, title, type, level, ctx.day(ago), ctx.users.principal, past(Math.max(1, -ago - 1), '12:00')]);
    if (code) await db.query('INSERT INTO innovation_project_achievements (project_id, achievement_id) VALUES ($1,$2)', [projectId[code], r.rows[0].id]);
  }
  // Aditya's district result (created by the core seed) is linked to IP-091.
  await db.query(
    `INSERT INTO innovation_project_achievements (project_id, achievement_id)
     SELECT $1, a.id FROM achievements a WHERE a.student_id = $2 AND a.title LIKE 'District Robotics Challenge%'`,
    [projectId['IP-091'], S('HS-2026-1041').id]);
}
