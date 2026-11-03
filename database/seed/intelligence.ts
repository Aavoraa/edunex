/**
 * SAMPLE DATA — intelligence domain. Owned by the intelligence module.
 * Fictional school policy documents for School Knowledge AI, AI Co-Pilot drafts in
 * different workflow states, and a small curriculum fallback (only when the academics
 * seed has not already provided objectives / questions for these topics).
 * Dates are relative to ctx.today; nothing "happened" in the future.
 */
import { addDays, bulkInsert, type Db, type SeedContext } from './context.js';

const ALL = ['super_admin', 'school_admin', 'management', 'principal', 'teacher', 'hr', 'finance', 'office', 'staff', 'parent', 'student'];
const STAFF = ['super_admin', 'school_admin', 'management', 'principal', 'teacher', 'hr', 'finance', 'office', 'staff'];
const SAFEGUARDING = ['super_admin', 'school_admin', 'management', 'principal', 'teacher'];

function longDate(d: string) {
  return new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function knowledgeDocs(ctx: SeedContext) {
  const ptm1 = ctx.day(3);
  const ptm2 = ctx.day(4);
  const termEnd = ctx.day(68);
  const midterm = ctx.day(18);
  const diwali = '2026-10-20';
  return [
    {
      title: 'Student Handbook 2026–27', section: 'Section 4.2 — Attendance and leave', audience: ALL, updated: ctx.day(-97),
      keywords: ['leave', 'absence', 'attendance', 'procedure', 'medical', 'doctor', 'holiday', 'permission', 'apply'],
      body: [
        'Student leave procedure. A parent submits the leave request through the Parent app, or in writing to the class teacher, at least one working day in advance. The request states the dates, the reason and a contact number for the period of leave.',
        'Leave of more than three consecutive school days needs the approval of the Head of Section. Medical leave of more than three days also needs a doctor\'s note, which is uploaded in the Parent app or handed to the class teacher on the student\'s return.',
        'The class teacher records approved leave in the attendance register, so the days are not counted as unexplained absence. Unapproved absence is followed up by the class teacher on the same day through the parent\'s preferred channel.',
        'Emergency leave on the day (illness, family emergency) is accepted by phone before 9:00 am. The written request should follow within two working days.',
      ],
    },
    {
      title: 'Student Handbook 2026–27', section: 'Section 6 — Uniform and appearance', audience: ALL, updated: ctx.day(-97),
      keywords: ['uniform', 'shoes', 'dress', 'sports kit', 'house', 'appearance', 'hair', 'jewellery'],
      body: [
        'Uniform policy. Students wear the full school uniform from Monday to Friday: the house-coloured shirt, grey trousers or skirt, black leather shoes and the school tie. The sports uniform and white canvas shoes are worn only on the student\'s timetabled games days.',
        'Jewellery is limited to a wristwatch and plain stud earrings. Hair longer than the collar is tied back neatly with a black or house-coloured band.',
        'Uniform is available from the school store on the Guduvanchery campus every weekday between 8:00 am and 10:00 am. Parents may also order through the Parent app for collection.',
      ],
    },
    {
      title: 'Attendance Policy', section: 'Clause 7 — Leave, absence and follow-up', audience: ALL, updated: ctx.day(-138),
      keywords: ['attendance', 'absence', 'late', 'threshold', 'percentage', 'leave', 'early warning', 'punctuality'],
      body: [
        'The school expects every student to maintain attendance of at least 90% across the academic year. Attendance below 82% triggers an Early Warning signal, which a teacher reviews before any support plan is opened.',
        'A student arriving after 8:30 am is marked late. Three late arrivals in a calendar month are treated as one unexplained absence for follow-up purposes, and the parent is contacted by the class teacher.',
        'Absence alerts are sent to parents on WhatsApp within minutes of the register being submitted. A parent who has already applied for leave does not receive an absence alert for those dates.',
        'Repeated unexplained absence (three or more consecutive days) is escalated to the Head of Section and the School Counsellor, who agree next steps with the family.',
      ],
    },
    {
      title: 'Academic Calendar 2026–27', section: 'Term 3 events', audience: ALL, updated: ctx.day(-16),
      keywords: ['ptm', 'parent teacher meeting', 'calendar', 'exam', 'holiday', 'term', 'dates', 'mid-term', 'grade vi', 'grade 6'],
      body: [
        `Parent–teacher meetings for Grade 6 (Grade VI) are scheduled for ${longDate(ptm1)} and ${longDate(ptm2)} in the Academic Block, 9:00 am to 1:00 pm. Each meeting slot is 10 minutes. Booking is open in the Parent app.`,
        `Parent–teacher meetings for Grades 7 and 8 follow in the week after, and the schedule is published in the Parent app at least seven days before each meeting.`,
        `Mid-term assessments for Grades 3 to 10 begin on ${longDate(midterm)}. The timetable is shared with parents one week in advance.`,
        `The school is closed for Deepavali on ${longDate(diwali)} and the following day. Term 3 ends on ${longDate(termEnd)}.`,
      ],
    },
    {
      title: 'Safeguarding and Child Protection Policy v3.0', section: 'Section 6 — Escalation', audience: SAFEGUARDING, updated: ctx.day(-15),
      keywords: ['safeguarding', 'child protection', 'escalation', 'concern', 'dsl', 'designated', 'referral', 'disclosure'],
      body: [
        'Safeguarding escalation path. Any concern about a child\'s safety or welfare is logged the same day by the member of staff who observed it or received the disclosure. The record states what was seen or said, in the child\'s own words where possible, and is never shared with other parents.',
        'The Designated Safeguarding Lead (DSL) reviews every new concern within twenty-four hours and decides whether it is a record-only note, an internal support plan with the School Counsellor, or an external referral to the relevant child-protection authority.',
        'The Principal is informed of every external referral. Where a concern involves a member of staff, it is reported directly to the Principal, who follows the allegations procedure in Section 9.',
        'Staff must not promise confidentiality to a child, investigate on their own, or contact the alleged person. Safeguarding records are kept separately from the student file and are visible only to the DSL, the Counsellor and the Principal.',
      ],
    },
    {
      title: 'Transport Handbook', section: 'Bus routes, timings and safety', audience: ALL, updated: ctx.day(-61),
      keywords: ['transport', 'bus', 'route', 'pickup', 'drop', 'stop', 'tracking', 'late bus', 'change route'],
      body: [
        'Transport routes and pickup. Each bus follows a fixed route with published stop times. Students should be at their stop five minutes before the pickup time; the bus waits no longer than two minutes at any stop.',
        'Parents can track the bus live in the Parent app and receive a notification when their child boards and when the child enters the school gate.',
        'A request to change the pickup stop or route is made through the Parent app at least three working days in advance and takes effect once the transport office confirms seat availability.',
        'If a bus is delayed by more than ten minutes, the transport office informs all parents on the route. Students are never dropped at a stop other than their registered one without written permission from the parent.',
      ],
    },
    {
      title: 'Fee Policy 2026–27', section: 'Due dates, instalments and concessions', audience: ALL, updated: ctx.day(-169),
      keywords: ['fee', 'fees', 'due date', 'instalment', 'payment', 'late fee', 'concession', 'scholarship', 'receipt', 'refund'],
      body: [
        'Fee due dates. Tuition fees are paid in three term instalments, due on 10 June, 10 October and 10 January. Transport and activity fees are billed with the first instalment unless the parent opts for termly billing.',
        'Payments can be made through the Parent app by UPI, card or net banking, or at the accounts office by demand draft. A receipt is issued immediately and sent on WhatsApp and email.',
        'A late fee applies to any instalment unpaid fifteen days after its due date. Families facing difficulty should speak to the accounts office before the due date; concessions and scholarships are decided by the Principal and are never negotiated through the chat assistant.',
        'Refunds of the caution deposit are processed within thirty days of the transfer certificate being issued.',
      ],
    },
    {
      title: 'Staff Handbook', section: 'Section 3 — Staff leave and cover', audience: STAFF, updated: ctx.day(-38),
      keywords: ['staff leave', 'cover', 'substitute', 'casual leave', 'staff', 'duty', 'cpd'],
      body: [
        'Staff leave and cover. Planned leave is applied for in staff self-service at least three working days in advance and approved by the Head of Department. Casual leave on the day is reported to the Vice Principal before 7:30 am.',
        'The academic coordinator arranges substitute cover and publishes it on the timetable. Teachers leave cover work for every class they will miss.',
        'Every teacher completes at least 24 hours of continuing professional development (CPD) in the academic year, recorded in the workforce system.',
      ],
    },
  ];
}

const FRACTIONS_LESSON = {
  title: 'Grade 6 · Mathematics · Fractions',
  objective: 'Students compare and order fractions with unlike denominators, and explain their reasoning using a common denominator or a benchmark of one half. (Cambridge 6Nf.05)',
  objectiveCode: '6Nf.05',
  lessonMinutes: 40,
  plan: [
    { time: '0–5 min', step: 'Recall starter', detail: 'Quick fire: name three fractions equivalent to one half. Collect on the board.' },
    { time: '5–15 min', step: 'Guided instruction', detail: 'Model comparison of 3/5 and 5/8 using a common denominator. Then model the benchmark method.' },
    { time: '15–30 min', step: 'Paired practice', detail: 'Ordering cards activity. Pairs justify placement to each other before recording.' },
    { time: '30–38 min', step: 'Differentiated task', detail: 'Foundation, core and extension sets issued from the worksheet below.' },
    { time: '38–40 min', step: 'Exit ticket', detail: 'Two comparison questions with a one-line explanation each.' },
  ],
  activities: ['Ordering cards (physical manipulative)', 'Number line placement on the board', 'Think-pair-share justification'],
  differentiated: [
    { level: 'Foundation', detail: '6 comparisons with denominators from the same family (halves, quarters, eighths).' },
    { level: 'Core', detail: '8 comparisons with unlike denominators, 2 requiring ordering of three fractions.' },
    { level: 'Extension', detail: '4 problems in context plus one "explain the error" task.' },
  ],
  quiz: [
    { q: 'Which is larger, 3/5 or 5/8? Explain your method.', marks: 2 },
    { q: 'Order from smallest to largest: 2/3, 5/9, 7/12.', marks: 3 },
    { q: 'Priya says 4/7 is more than 1/2 because 4 is more than 2. Is she right? Explain.', marks: 2 },
    { q: 'Write a fraction between 1/3 and 1/2.', marks: 2 },
  ],
  homework: 'Worksheet 3, questions 1–8. Extension students attempt question 9 and bring one real-life example of comparing fractions.',
};

const GEN = { provider: 'template', kind: 'template', version: 'template-1.0' };

export async function seed(db: Db, ctx: SeedContext): Promise<void> {
  const MAT = ctx.subjects.MAT;
  const SCI = ctx.subjects.SCI;
  const PHY = ctx.subjects.PHY ?? SCI;

  // ---- Knowledge documents --------------------------------------------------
  const docs = knowledgeDocs(ctx);
  await bulkInsert(db, 'knowledge_documents', ['title', 'section', 'body', 'keywords', 'audience', 'is_approved', 'source_updated_on'],
    docs.map((d) => [d.title, d.section, d.body.join('\n\n'), d.keywords, d.audience, true, d.updated]));

  // ---- Curriculum fallback (skipped when academics already seeded these) -----
  const objectives: [string, string, string, string, number, number][] = [
    ['6Nf.03', 'Recognise and use equivalent fractions, including simplifying fractions', MAT, 'Primary 6', 92, 74],
    ['6Nf.05', 'Compare and order fractions with unlike denominators using a common denominator or a benchmark of one half', MAT, 'Primary 6', 64, 51],
    ['6Nf.07', 'Add and subtract fractions with different denominators', MAT, 'Primary 6', 38, 33],
    ['6Nf.09', 'Compare and order decimals with up to three decimal places', MAT, 'Primary 6', 70, 62],
    ['5Nf.03', 'Recognise equivalent fractions and use them to compare fractions with related denominators', MAT, 'Primary 5', 88, 71],
    ['5Nf.06', 'Understand decimals as tenths and hundredths and place them on a number line', MAT, 'Primary 5', 72, 58],
    ['5Gp.02', 'Calculate the perimeter and area of rectangles and compound rectilinear shapes', MAT, 'Primary 5', 55, 49],
    ['5Ss.02', 'Collect, organise and represent data in tables, tally charts and bar charts', MAT, 'Primary 5', 40, 36],
  ];
  for (const [code, description, subject, stage, coverage, mastery] of objectives) {
    await db.query(
      `INSERT INTO learning_objectives (code, description, subject_id, stage_label, coverage_pct, mastery_pct)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (code) DO NOTHING`,
      [code, description, subject, stage, coverage, mastery]);
  }
  const questions: [string, string, string, string, string, number][] = [
    // [subject, topic, stage, question, difficulty, marks]
    [MAT, 'Fractions', 'Primary 6', 'Write two fractions equivalent to 3/4.', 'Foundation', 1],
    [MAT, 'Fractions', 'Primary 6', 'Which is larger, 1/4 or 3/8? Use a diagram to show your answer.', 'Foundation', 2],
    [MAT, 'Fractions', 'Primary 6', 'Simplify 12/18.', 'Foundation', 1],
    [MAT, 'Fractions', 'Primary 6', 'Which is larger, 3/5 or 5/8? Explain your method.', 'Core', 2],
    [MAT, 'Fractions', 'Primary 6', 'Order from smallest to largest: 2/3, 5/9, 7/12.', 'Core', 3],
    [MAT, 'Fractions', 'Primary 6', 'Is 5/9 more or less than one half? Explain using a benchmark.', 'Core', 2],
    [MAT, 'Fractions', 'Primary 6', 'Priya says 4/7 is more than 1/2 because 4 is more than 2. Is she right? Explain.', 'Higher', 2],
    [MAT, 'Fractions', 'Primary 6', 'Write a fraction between 1/3 and 1/2.', 'Higher', 2],
    [MAT, 'Fractions', 'Primary 6', 'A recipe needs 2/3 cup of milk and Arun has 5/8 cup. Does he have enough? Show your working.', 'Higher', 3],
    [MAT, 'Decimals', 'Primary 6', 'Put these in order: 0.45, 0.5, 0.405.', 'Core', 2],
    [MAT, 'Decimals', 'Primary 6', 'Write 0.375 as a fraction in its simplest form.', 'Higher', 2],
    [MAT, 'Fractions', 'Primary 5', 'Shade 2/5 of a strip of ten squares.', 'Foundation', 1],
    [MAT, 'Fractions', 'Primary 5', 'Which is larger, 3/10 or 2/5? Explain.', 'Core', 2],
    [MAT, 'Area and perimeter', 'Primary 5', 'Find the perimeter of a rectangle 7 cm long and 4 cm wide.', 'Foundation', 1],
    [MAT, 'Area and perimeter', 'Primary 5', 'Draw two different rectangles with an area of 24 square centimetres.', 'Core', 2],
    [SCI, 'States of matter', 'Primary 5', 'Name the three states of matter and give one example of each.', 'Foundation', 3],
    [SCI, 'States of matter', 'Primary 5', 'Explain what happens to particles when ice melts.', 'Core', 2],
    [PHY, 'Forces and motion', 'IGCSE', 'A car travels 150 m in 12 s. Calculate its average speed.', 'Core', 2],
    [PHY, 'Forces and motion', 'IGCSE', 'State Newton\'s second law and give its equation.', 'Foundation', 2],
    [PHY, 'Forces and motion', 'IGCSE', 'A 2 kg trolley accelerates at 3 m/s². Calculate the resultant force.', 'Core', 2],
    [PHY, 'Forces and motion', 'IGCSE', 'Explain why a parachutist reaches terminal velocity.', 'Higher', 4],
  ];
  const creator = ctx.users.teacher;
  for (const [subject, topic, stage, question, difficulty, marks] of questions) {
    await db.query(
      `INSERT INTO question_bank (subject_id, topic, stage_label, question, question_type, difficulty, marks, status, created_by)
       SELECT $1, $2, $3, $4, 'short', $5, $6, 'Approved', $7
        WHERE NOT EXISTS (SELECT 1 FROM question_bank WHERE subject_id = $1 AND question = $4)`,
      [subject, topic, stage, question, difficulty, marks, creator]);
  }
  const objId = async (code: string) => (await db.query('SELECT id FROM learning_objectives WHERE code = $1', [code])).rows[0]?.id ?? null;

  // ---- AI Co-Pilot drafts ------------------------------------------------------
  const teacher = ctx.users.teacher;
  const principal = ctx.users.principal;
  const priya = ctx.employees['EMP-1021'];
  const sec6B = ctx.sections['gdv:6:B'];
  const sec5A = ctx.sections['gdv:5:A'];
  const sec6C = ctx.sections['gdv:6:C'];
  const sec10A = ctx.sections['gdv:10:A'];
  const now = ctx.now;
  const past = (d: Date) => (d > now ? new Date(now.getTime() - 60_000) : d);

  // 1. The wireframe's Grade 6 fractions lesson — awaiting review.
  const o605 = await objId('6Nf.05');
  await db.query(
    `INSERT INTO ai_drafts (draft_type, prompt, output, status, requested_by, created_at, updated_at)
     VALUES ('lesson', $1, $2, 'Under Review', $3, $4, $4)`,
    [JSON.stringify({ type: 'lesson', grade: 6, subjectId: MAT, subjectCode: 'MAT', sectionId: sec6B, classLabel: 'Grade 6B', topic: 'Fractions', lessonMinutes: 40, objectiveId: o605, plannedFor: ctx.day(1), provider: { name: 'template', kind: 'template' } }),
      JSON.stringify({
        ...FRACTIONS_LESSON, generator: GEN, warnings: [],
        sources: [
          { label: 'Learning objective 6Nf.05', detail: 'Coverage 64% · mastery 51%' },
          { label: 'Approved question bank', detail: '4 of 9 items on Fractions' },
          { label: 'Grade 6B results', detail: 'Latest term average 69, 11 of 33 students below 60' },
        ],
      }),
      teacher, past(ctx.at(ctx.today, '07:40'))]);

  // 2. Approved yesterday — equivalence lesson, with its published lesson plan.
  const o603 = await objId('6Nf.03');
  const approvedAt = ctx.at(ctx.day(-1), '16:12');
  const equivalence = {
    ...FRACTIONS_LESSON,
    title: 'Lesson plan — Fractions, equivalence',
    objective: 'Students recognise and generate equivalent fractions and simplify fractions using common factors. (Cambridge 6Nf.03)',
    objectiveCode: '6Nf.03',
    generator: GEN, warnings: [],
    sources: [{ label: 'Learning objective 6Nf.03', detail: 'Coverage 92% · mastery 74%' }],
    edited: { by: 'Ms. Priya Raghavan', at: ctx.at(ctx.day(-1), '16:05').toISOString(), count: 2 },
    approval: { by: 'Ms. Priya Raghavan', at: approvedAt.toISOString(), lessonPlanId: null as string | null },
  };
  const lp = await db.query(
    `INSERT INTO lesson_plans (title, section_id, subject_id, objective_id, planned_for, content, ai_generated, status, author_id, approved_by, approved_at, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,true,'Approved',$7,$8,$9,$9) RETURNING id`,
    [equivalence.title, sec6B, MAT, o603, ctx.today, JSON.stringify(equivalence), priya, teacher, approvedAt]);
  equivalence.approval.lessonPlanId = lp.rows[0].id;
  await db.query(
    `INSERT INTO ai_drafts (draft_type, prompt, output, status, requested_by, approved_by, approved_at, created_at, updated_at)
     VALUES ('lesson', $1, $2, 'Approved', $3, $3, $4, $5, $4)`,
    [JSON.stringify({ type: 'lesson', grade: 6, subjectId: MAT, sectionId: sec6B, classLabel: 'Grade 6B', topic: 'Fractions', objectiveId: o603, plannedFor: ctx.today }),
      JSON.stringify(equivalence), teacher, approvedAt, ctx.at(ctx.day(-1), '15:48')]);

  // 3. Worksheet — approved by the principal.
  await db.query(
    `INSERT INTO ai_drafts (draft_type, prompt, output, status, requested_by, approved_by, approved_at, created_at, updated_at)
     VALUES ('worksheet', $1, $2, 'Approved', $3, $4, $5, $6, $5)`,
    [JSON.stringify({ type: 'worksheet', grade: 5, subjectId: SCI, sectionId: sec5A, classLabel: 'Grade 5A', topic: 'States of matter' }),
      JSON.stringify({
        title: 'Worksheet — States of matter', generator: GEN, warnings: [],
        sections: [
          { level: 'Foundation', instructions: 'Work through each item.', items: [{ q: 'Name the three states of matter and give one example of each.', marks: 3 }] },
          { level: 'Core', instructions: 'Show your reasoning.', items: [{ q: 'Explain what happens to particles when ice melts.', marks: 2 }] },
          { level: 'Extension', instructions: 'Answer in full sentences.', items: [] },
        ],
        sources: [{ label: 'Approved question bank', detail: '2 items used on States of matter' }],
        approval: { by: 'Dr. Meera Krishnan', at: ctx.at(ctx.day(-3), '11:20').toISOString(), lessonPlanId: null },
      }),
      teacher, principal, ctx.at(ctx.day(-3), '11:20'), ctx.at(ctx.day(-3), '10:02')]);

  // 4. Report comments for Grade 5A — under review.
  const roster = ctx.students.filter((s) => s.sectionId === sec5A);
  await db.query(
    `INSERT INTO ai_drafts (draft_type, prompt, output, status, requested_by, created_at, updated_at)
     VALUES ('comment', $1, $2, 'Under Review', $3, $4, $4)`,
    [JSON.stringify({ type: 'comment', grade: 5, subjectId: MAT, sectionId: sec5A, classLabel: 'Grade 5A', topic: 'Fractions' }),
      JSON.stringify({
        title: `Report comments — Mathematics, Grade 5A (${roster.length} students)`, generator: GEN, warnings: [], term: 'Current',
        comments: roster.map((s) => ({
          studentId: s.id, studentName: s.fullName, admissionNo: s.admissionNo, subjectScore: s.targetAverage, trend: s.targetTrend, attendance: s.targetAttendance,
          comment: `${s.firstName} ${s.targetAverage >= 80 ? 'is working securely above the expected standard' : s.targetAverage >= 65 ? 'is working at the expected standard' : 'is still building confidence'} in Mathematics (${s.targetAverage}). Next step: ${s.targetAverage >= 80 ? 'take on extension problems that ask for explanation' : 'practise the core skills regularly and ask for help early'}.`,
        })),
        sources: [{ label: 'Mathematics term records', detail: 'Latest term score and change' }, { label: 'Attendance register', detail: 'Current academic year' }],
      }),
      teacher, ctx.at(ctx.day(-4), '15:30')]);

  // 5. Parent message — saved as a draft.
  const reshma = ctx.studentByNo['HS-2026-1082'];
  await db.query(
    `INSERT INTO ai_drafts (draft_type, prompt, output, status, requested_by, created_at, updated_at)
     VALUES ('message', $1, $2, 'Draft', $3, $4, $4)`,
    [JSON.stringify({ type: 'message', grade: 6, subjectId: MAT, sectionId: sec6C, classLabel: 'Grade 6C', topic: 'Fractions', messagePurpose: 'homework', studentId: reshma.id }),
      JSON.stringify({
        title: 'Parent message — homework reminder', generator: GEN, warnings: [], purpose: 'homework',
        subject: 'Mathematics homework reminder',
        body: 'Dear Parent,\n\nA reminder that Mathematics homework on fractions is due this Friday. A few minutes of practice at home each day will help.\n\nWarm regards,\nMs. Priya Raghavan\nEdunex International School',
        recipient: { parentName: null, channel: 'whatsapp', studentName: reshma.fullName, admissionNo: reshma.admissionNo },
        facts: [], sources: [{ label: 'Homework records', detail: 'Current week' }],
      }),
      teacher, ctx.at(ctx.day(-5), '14:10')]);

  // 6. Quiz — Forces and motion, approved by the principal.
  await db.query(
    `INSERT INTO ai_drafts (draft_type, prompt, output, status, requested_by, approved_by, approved_at, created_at, updated_at)
     VALUES ('quiz', $1, $2, 'Approved', $3, $3, $4, $5, $4)`,
    [JSON.stringify({ type: 'quiz', grade: 10, subjectId: PHY, sectionId: sec10A, classLabel: 'Grade 10A', topic: 'Forces and motion' }),
      JSON.stringify({
        title: 'Quiz — Forces and motion', generator: GEN, warnings: ['Fewer than five approved items exist for this topic; consider adding more before using this quiz.'],
        questions: [
          { n: 1, q: 'State Newton\'s second law and give its equation.', marks: 2, difficulty: 'Foundation', type: 'short' },
          { n: 2, q: 'A car travels 150 m in 12 s. Calculate its average speed.', marks: 2, difficulty: 'Core', type: 'short' },
          { n: 3, q: 'A 2 kg trolley accelerates at 3 m/s². Calculate the resultant force.', marks: 2, difficulty: 'Core', type: 'short' },
          { n: 4, q: 'Explain why a parachutist reaches terminal velocity.', marks: 4, difficulty: 'Higher', type: 'short' },
        ],
        totalMarks: 10, durationMinutes: 15,
        sources: [{ label: 'Approved question bank', detail: '4 items, easiest first, 10 marks' }],
        approval: { by: 'Dr. Meera Krishnan', at: ctx.at(ctx.day(-7), '12:40').toISOString(), lessonPlanId: null },
      }),
      principal, ctx.at(ctx.day(-7), '12:40'), ctx.at(ctx.day(-7), '12:05')]);

  // ---- Knowledge AI usage this month (sample audit entries feed "Most asked") --
  const monthStart = `${ctx.today.slice(0, 8)}01`;
  const span = Math.max(0, Math.round((new Date(`${ctx.today}T00:00:00Z`).getTime() - new Date(`${monthStart}T00:00:00Z`).getTime()) / 86_400_000));
  const asks: [string, string, number][] = [
    ['Fee Policy 2026–27', 'When is the next fee due date?', 9],
    ['Student Handbook 2026–27', 'What is the procedure for student leave?', 7],
    ['Academic Calendar 2026–27', 'When is the next Grade 6 PTM?', 6],
    ['Transport Handbook', 'How do I change my child\'s bus stop?', 4],
    ['Attendance Policy', 'What happens if a student is late three times?', 3],
  ];
  const rows: unknown[][] = [];
  const users = [[ctx.users.teacher, 'Ms. Priya Raghavan', 'teacher'], [ctx.users.principal, 'Dr. Meera Krishnan', 'principal']];
  for (const [topic, question, n] of asks) {
    for (let i = 0; i < n; i++) {
      const [uid, name, role] = users[i % users.length];
      const day = addDays(monthStart, span ? ctx.int(0, span) : 0);
      const at = past(ctx.at(day, `${String(ctx.int(8, 16)).padStart(2, '0')}:${String(ctx.int(0, 59)).padStart(2, '0')}`));
      rows.push([uid, name, role, 'ask', 'knowledge', 'knowledge_question', `Knowledge AI question answered from ${topic}`, 'web',
        JSON.stringify({ question, topic, found: true, confidence: 'High', kind: 'documents', sample: true }), at]);
    }
  }
  await bulkInsert(db, 'audit_logs', ['user_id', 'user_name', 'role_key', 'action', 'module', 'entity_type', 'description', 'device', 'metadata', 'created_at'], rows);
}
