/* ==========================================================================
   DATA — illustrative sample data only. Nothing here is a real person or
   a real record. Shapes mirror the intended production entities so this
   wireframe doubles as a data-model reference for development handoff.
   ========================================================================== */
(function (HS) {
  'use strict';

  var D = HS.data = {};

  /* ---- Campuses ---------------------------------------------------------- */
  D.campuses = [
    { id: 'gdv', name: 'Edunex International', place: 'Guduvanchery', short: 'Guduvanchery', students: 1284, staff: 146, curriculum: 'Cambridge Primary → A Level', established: 2011 },
    { id: 'vdv', name: 'Edunex Preparatory', place: 'Vadavalli', short: 'Vadavalli', students: 612, staff: 71, curriculum: 'Cambridge Primary → Lower Secondary', established: 2016 },
    { id: 'plc', name: 'Outdoor Learning Centre', place: 'Pollachi', short: 'Pollachi', students: 184, staff: 26, curriculum: 'Experiential / Residential programmes', established: 2021 }
  ];

  D.academicYears = ['2026–27', '2025–26', '2024–25'];

  /* ---- Roles ------------------------------------------------------------- */
  D.roles = [
    { id: 'management', label: 'Management', person: 'Dr. Meera Krishnan', title: 'Principal', email: 'meera.krishnan@edunex.edu', home: '#/command-center', desc: 'Full analytics, command centre and group dashboard' },
    { id: 'teacher', label: 'Teacher', person: 'Ms. Priya Raghavan', title: 'Grade 6 Mathematics', email: 'priya.raghavan@edunex.edu', home: '#/teacher', desc: 'Attendance, classes, Student 360, academics, AI Co-Pilot' },
    { id: 'parent', label: 'Parent', person: 'Ranjith Kumar', title: 'Parent of Aditya, Grade 5A', email: 'ranjith.kumar@example.com', home: '#/parent-360', desc: 'Child information, safety, academics, fees, communication' },
    { id: 'office', label: 'Office', person: 'Kavitha S.', title: 'Front Office & Admissions', email: 'kavitha.s@edunex.edu', home: '#/admissions', desc: 'Admissions, fees, documents, HR records' },
    { id: 'staff', label: 'Non-Teaching Staff', person: 'Murugan P.', title: 'Transport Supervisor', email: 'murugan.p@edunex.edu', home: '#/staff-self', desc: 'Attendance, shifts, leave, payslips' }
  ];

  /* ---- Students ---------------------------------------------------------- */
  var FIRST = ['Aditya', 'Sanjana', 'Karthik', 'Meenakshi', 'Rohan', 'Divya', 'Arjun', 'Lakshmi', 'Vikram', 'Ananya', 'Hari', 'Nithya', 'Surya', 'Pooja', 'Manoj', 'Keerthi', 'Rahul', 'Swetha', 'Vishnu', 'Anjali', 'Naveen', 'Ishita', 'Aravind', 'Shreya', 'Gokul', 'Bhavana', 'Dinesh', 'Varsha', 'Praveen', 'Nandhini', 'Sathish', 'Tanya', 'Mohan', 'Reshma', 'Balaji', 'Harini'];
  var LAST = ['Kumar', 'Raman', 'Subramani', 'Natarajan', 'Venkatesh', 'Iyer', 'Pillai', 'Chandran', 'Selvam', 'Murthy', 'Anand', 'Prasad'];
  var HOUSES = ['Emerald', 'Sapphire', 'Amber', 'Coral'];
  var GRADES = ['Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10'];
  var SECTIONS = ['A', 'B', 'C'];

  function seeded(i) { var x = Math.sin(i * 12.9898) * 43758.5453; return x - Math.floor(x); }

  var students = [];
  for (var i = 0; i < 48; i++) {
    var r1 = seeded(i + 1), r2 = seeded(i + 40), r3 = seeded(i + 90), r4 = seeded(i + 130);
    var att = Math.round(74 + r1 * 25);
    var avg = Math.round(46 + r2 * 48);
    var trendVal = Math.round((r3 - .5) * 16);
    var risk = att < 82 || avg < 58 ? 'At Risk' : (att < 89 || avg < 68 || trendVal < -5 ? 'Developing Risk' : 'On Track');
    students.push({
      id: 'HS-2026-' + String(1041 + i),
      name: FIRST[i % FIRST.length] + ' ' + LAST[(i * 5) % LAST.length],
      grade: GRADES[Math.floor(r1 * GRADES.length)],
      section: SECTIONS[Math.floor(r2 * 3)],
      house: HOUSES[Math.floor(r3 * 4)],
      campus: r4 > .82 ? 'vdv' : 'gdv',
      gender: r2 > .5 ? 'M' : 'F',
      attendance: att,
      average: avg,
      trend: trendVal,
      risk: risk,
      intervention: risk === 'At Risk' ? (r4 > .5 ? 'Active' : 'Planned') : (risk === 'Developing Risk' ? (r4 > .6 ? 'Monitoring' : '—') : '—'),
      owner: ['Ms. Priya R.', 'Mr. Ganesh V.', 'Ms. Anitha D.', 'Mr. Sathish K.'][Math.floor(r1 * 4)],
      parent: ['Ranjith Kumar', 'Sudha Raman', 'Vimal Chandran', 'Gayathri N.', 'Prakash S.'][Math.floor(r2 * 5)],
      parentPhone: '+91 9' + String(Math.floor(r3 * 900000000) + 100000000),
      bus: r4 > .3 ? 'Route ' + (Math.floor(r1 * 12) + 1) : 'Own transport',
      feeStatus: r4 > .78 ? 'Overdue' : (r4 > .58 ? 'Partial' : 'Paid'),
      today: att > 90 ? 'Present' : (r4 > .86 ? 'Absent' : (r4 > .78 ? 'Late' : 'Present'))
    });
  }
  /* Named anchor records used throughout the demo */
  students[0] = Object.assign(students[0], {
    id: 'HS-2026-1041', name: 'Aditya Kumar', grade: 'Grade 5', section: 'A', house: 'Emerald', campus: 'gdv',
    attendance: 94, average: 78, trend: 4, risk: 'On Track', intervention: '—', owner: 'Ms. Priya R.',
    parent: 'Ranjith Kumar', parentPhone: '+91 98407 22110', bus: 'Route 12', feeStatus: 'Partial', today: 'Present'
  });
  students[1] = Object.assign(students[1], {
    id: 'HS-2026-1042', name: 'Sanjana Raman', grade: 'Grade 7', section: 'B', house: 'Sapphire', campus: 'gdv',
    attendance: 79, average: 54, trend: -11, risk: 'At Risk', intervention: 'Active', owner: 'Mr. Ganesh V.',
    parent: 'Sudha Raman', parentPhone: '+91 98410 55831', bus: 'Route 4', feeStatus: 'Overdue', today: 'Absent'
  });
  students[2] = Object.assign(students[2], {
    id: 'HS-2026-1043', name: 'Karthik Subramani', grade: 'Grade 9', section: 'A', house: 'Amber', campus: 'gdv',
    attendance: 86, average: 63, trend: -7, risk: 'Developing Risk', intervention: 'Monitoring', owner: 'Ms. Anitha D.',
    parent: 'Vimal Chandran', parentPhone: '+91 90031 44902', bus: 'Own transport', feeStatus: 'Paid', today: 'Late'
  });
  D.students = students;
  D.studentById = function (id) { return students.filter(function (s) { return s.id === id; })[0] || students[0]; };

  /* ---- Student 360 detail (anchor record) -------------------------------- */
  D.student360 = {
    'HS-2026-1041': {
      dob: '14 Mar 2015', admitted: '08 Jun 2021', bloodGroup: 'B+', emergency: 'Ranjith Kumar · +91 98407 22110',
      address: 'No. 18, Lake View Avenue, Guduvanchery',
      classTeacher: 'Ms. Priya Raghavan', counsellor: 'Ms. Deepa Venkat',
      subjects: [
        { name: 'English', score: 82, grade: 'A', trend: 3, target: 85, teacher: 'Ms. Lalitha R.' },
        { name: 'Mathematics', score: 74, grade: 'B+', trend: 6, target: 80, teacher: 'Ms. Priya Raghavan' },
        { name: 'Science', score: 80, grade: 'A', trend: 2, target: 82, teacher: 'Mr. Ganesh V.' },
        { name: 'Tamil', score: 88, grade: 'A+', trend: 1, target: 88, teacher: 'Ms. Kalaiselvi M.' },
        { name: 'Social Studies', score: 71, grade: 'B', trend: -3, target: 78, teacher: 'Ms. Anitha D.' },
        { name: 'Computing', score: 86, grade: 'A', trend: 8, target: 85, teacher: 'Mr. Sathish K.' }
      ],
      termTrend: { labels: ['Term 1', 'Term 2', 'Term 3', 'Mid Yr', 'Term 4', 'Current'], values: [68, 71, 70, 75, 76, 78] },
      attendanceMonths: { labels: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'], values: [96, 93, 95, 92, 94, 94] },
      skills: [
        { name: 'Communication', value: 82 }, { name: 'Creativity', value: 88 }, { name: 'Leadership', value: 64 },
        { name: 'Critical Thinking', value: 76 }, { name: 'Collaboration', value: 84 }
      ],
      activities: [
        { name: 'Robotics Club', role: 'Member', since: 'Jun 2025', hours: 46 },
        { name: 'Inter-house Debate', role: 'Speaker', since: 'Aug 2025', hours: 12 },
        { name: 'Junior Football', role: 'Midfielder', since: 'Jul 2024', hours: 68 },
        { name: 'Eco Club', role: 'Volunteer', since: 'Jan 2026', hours: 20 }
      ],
      achievements: [
        { title: 'District Robotics Challenge — 2nd place', date: '12 Aug 2026', type: 'Competition', verified: true },
        { title: 'Cambridge Science Quiz — School finalist', date: '04 Jul 2026', type: 'Academic', verified: true },
        { title: 'Best Speaker, Junior Debate', date: '22 Feb 2026', type: 'Co-curricular', verified: true },
        { title: 'Perfect attendance — Term 2', date: '30 Nov 2025', type: 'Attendance', verified: true }
      ],
      behaviour: [
        { date: '09 Sep 2026', note: 'Helped a new classmate settle into the group project.', tone: 'success', by: 'Ms. Priya R.', type: 'Positive' },
        { date: '28 Aug 2026', note: 'Late submission of Social Studies assignment.', tone: 'caution', by: 'Ms. Anitha D.', type: 'Note' },
        { date: '15 Aug 2026', note: 'Led the house assembly presentation confidently.', tone: 'success', by: 'Ms. Deepa V.', type: 'Positive' }
      ],
      wellbeing: { mood: 'Settled', lastCheckin: '05 Sep 2026', infirmary: 2, counselling: 0, notes: 'No concerns flagged this term. Sleep and appetite reported normal at the last review.' },
      observations: [
        { by: 'Ms. Priya Raghavan', role: 'Class Teacher', date: '06 Sep 2026', text: 'Aditya is strongest when a task has a making or building element. Fractions clicked once we used the workshop measuring activity.' },
        { by: 'Mr. Sathish K.', role: 'Computing', date: '29 Aug 2026', text: 'Picks up block-based logic faster than the class median. Ready for an extension track next term.' }
      ],
      interventions: [
        { id: 'INT-118', signal: 'Social Studies trend -3 over two assessments', stage: 'Follow-up', owner: 'Ms. Anitha D.', opened: '25 Aug 2026', action: 'Weekly reading support, 2 sessions', next: '20 Sep 2026' }
      ],
      documents: [
        { name: 'Birth certificate', status: 'Verified', date: '08 Jun 2021' },
        { name: 'Previous school transfer certificate', status: 'Verified', date: '08 Jun 2021' },
        { name: 'Immunisation record', status: 'Verified', date: '11 Jun 2021' },
        { name: 'Address proof (renewal)', status: 'Pending', date: 'Requested 01 Sep 2026' }
      ],
      growth: [
        { time: 'Jun 2021', title: 'Admitted to Grade 1', body: 'Enrolled through a parent referral from the Guduvanchery campus open day.', tone: 'teal' },
        { time: 'Mar 2023', title: 'Cambridge Primary checkpoint', body: 'Above expectation in Science and Mathematics.', tone: '' },
        { time: 'Jul 2024', title: 'Joined Junior Football', body: 'Selected for the inter-house squad as midfielder.', tone: 'amber' },
        { time: 'Jun 2025', title: 'Joined Robotics Club', body: 'Mentor: Mr. Sathish K. Completed 46 lab hours to date.', tone: 'amber' },
        { time: 'Feb 2026', title: 'Best Speaker — Junior Debate', body: 'First competitive recognition in communication.', tone: 'teal' },
        { time: 'Aug 2026', title: 'District Robotics Challenge — 2nd place', body: 'Team of three. Prototype: rainwater sensor.', tone: 'teal' },
        { time: 'Aug 2026', title: 'Support plan opened — Social Studies', body: 'Signal reviewed and accepted by class teacher. Weekly reading support.', tone: 'critical' }
      ],
      talent: {
        strengths: [
          {
            name: 'Creativity', confidence: 'High', score: 88,
            evidence: ['Robotics prototype scored 2nd of 34 teams at district level (Aug 2026)', 'Two teacher observations cite original problem framing in Science', 'Highest elective engagement: 46 lab hours in Robotics Club']
          },
          {
            name: 'Collaboration', confidence: 'High', score: 84,
            evidence: ['Peer feedback in 3 group projects rated "shares work fairly"', 'Behaviour note 09 Sep: supported a new classmate', 'Football squad attendance 96% across two seasons']
          },
          {
            name: 'Communication', confidence: 'Medium', score: 82,
            evidence: ['Best Speaker, Junior Debate (Feb 2026)', 'English score 82 with an upward trend of +3', 'Led house assembly presentation (Aug 2026)']
          },
          {
            name: 'Critical Thinking', confidence: 'Medium', score: 76,
            evidence: ['Computing score 86 with +8 trend', 'Mathematics improved 6 points after applied-measurement approach']
          },
          {
            name: 'Leadership', confidence: 'Emerging', score: 64,
            evidence: ['One assembly lead role recorded', 'No formal captaincy or mentoring role yet — suggest a structured opportunity']
          }
        ],
        suggestion: 'Consider the Innovation Lab mentoring track next term. It pairs a confirmed strength (creativity) with the development area (leadership).'
      }
    }
  };

  /* ---- Attendance -------------------------------------------------------- */
  D.attendance = {
    today: { present: 1178, absent: 71, late: 35, total: 1284, staffPresent: 138, staffTotal: 146 },
    trend: { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Mon', 'Tue', 'Wed', 'Thu', 'Today'], values: [93.4, 94.1, 92.8, 93.9, 91.6, 94.6, 95.1, 93.2, 92.4, 91.7] },
    byGrade: {
      labels: ['G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10'],
      present: [96, 94, 95, 92, 88, 93, 90, 94],
      target: 93
    },
    lateByHour: { labels: ['7:30', '7:45', '8:00', '8:15', '8:30', '8:45', '9:00'], values: [2, 6, 14, 41, 118, 26, 9] },
    patterns: [
      { label: 'Monday absence', value: 34, note: 'highest weekday' },
      { label: 'Post-holiday dip', value: 28, note: 'after long weekend' },
      { label: 'Route 4 late arrivals', value: 19, note: 'transport linked' },
      { label: 'Repeat absentees (3+ days)', value: 12, note: 'escalated to Early Warning' }
    ],
    classRoster: [
      { id: 'HS-2026-1041', name: 'Aditya Kumar', roll: 5, status: 'present' },
      { id: 'HS-2026-1055', name: 'Bhavana Iyer', roll: 6, status: 'present' },
      { id: 'HS-2026-1058', name: 'Dinesh Selvam', roll: 7, status: 'late' },
      { id: 'HS-2026-1042', name: 'Sanjana Raman', roll: 8, status: 'absent' },
      { id: 'HS-2026-1061', name: 'Gokul Anand', roll: 9, status: 'present' },
      { id: 'HS-2026-1064', name: 'Harini Prasad', roll: 10, status: 'present' },
      { id: 'HS-2026-1067', name: 'Ishita Murthy', roll: 11, status: 'present' },
      { id: 'HS-2026-1070', name: 'Keerthi Pillai', roll: 12, status: 'present' },
      { id: 'HS-2026-1073', name: 'Manoj Natarajan', roll: 13, status: 'absent' },
      { id: 'HS-2026-1076', name: 'Nithya Venkatesh', roll: 14, status: 'present' },
      { id: 'HS-2026-1079', name: 'Praveen Raman', roll: 15, status: 'present' },
      { id: 'HS-2026-1082', name: 'Reshma Chandran', roll: 16, status: 'late' },
      { id: 'HS-2026-1085', name: 'Surya Kumar', roll: 17, status: 'present' },
      { id: 'HS-2026-1088', name: 'Tanya Subramani', roll: 18, status: 'present' },
      { id: 'HS-2026-1091', name: 'Varsha Iyer', roll: 19, status: 'present' },
      { id: 'HS-2026-1094', name: 'Vishnu Murthy', roll: 20, status: 'present' }
    ]
  };

  /* ---- Admissions -------------------------------------------------------- */
  D.admissions = {
    kpis: { enquiries: 268, qualified: 174, visits: 96, applications: 72, offers: 51, admitted: 38, conversion: 14.2, cpa: 4820, target: 120 },
    funnel: [
      { label: 'Enquiry', value: 268 }, { label: 'Qualified', value: 174 }, { label: 'Visit', value: 96 },
      { label: 'Application', value: 72 }, { label: 'Assessment', value: 58 }, { label: 'Offer', value: 51 }, { label: 'Admission', value: 38 }
    ],
    sources: [
      { label: 'WhatsApp', value: 78, color: 'var(--teal)' },
      { label: 'Website', value: 61, color: 'var(--navy)' },
      { label: 'Meta Ads', value: 44, color: 'var(--viz-4)' },
      { label: 'Referral', value: 38, color: 'var(--amber)' },
      { label: 'Google', value: 27, color: 'var(--viz-5)' },
      { label: 'Walk-in', value: 14, color: 'var(--viz-7)' },
      { label: 'Instagram', value: 6, color: 'var(--viz-6)' }
    ],
    monthly: { labels: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'], enquiries: [38, 52, 61, 44, 41, 32], admissions: [4, 7, 11, 6, 6, 4] },
    stages: ['New Lead', 'Contacted', 'Qualified', 'Visit Scheduled', 'Visit Completed', 'Application', 'Assessment', 'Offer', 'Enrolled'],
    leads: [
      { id: 'LD-4412', parent: 'Ramesh Iyer', student: 'Nila Iyer', grade: 'Grade 4', source: 'WhatsApp', campaign: 'Sep Admissions', campus: 'gdv', stage: 'Visit Scheduled', counsellor: 'Kavitha S.', created: '11 Sep 2026', next: 'Campus visit 18 Sep, 10:00', score: 82, transport: 'Required', curriculum: 'Cambridge Primary', phone: '+91 98844 21007' },
      { id: 'LD-4409', parent: 'Fatima Basheer', student: 'Zoya Basheer', grade: 'Grade 6', source: 'Meta Ads', campaign: 'IGCSE Awareness', campus: 'gdv', stage: 'Qualified', counsellor: 'Ravi T.', created: '10 Sep 2026', next: 'Call back 17 Sep', score: 71, transport: 'Not required', curriculum: 'Cambridge Lower Secondary', phone: '+91 90420 33518' },
      { id: 'LD-4405', parent: 'Gowtham Pillai', student: 'Advik Pillai', grade: 'Grade 1', source: 'Referral', campaign: 'Parent referral', campus: 'vdv', stage: 'Application', counsellor: 'Kavitha S.', created: '08 Sep 2026', next: 'Document upload pending', score: 88, transport: 'Required', curriculum: 'Cambridge Primary', phone: '+91 97910 88245' },
      { id: 'LD-4398', parent: 'Sunitha Rao', student: 'Meghna Rao', grade: 'Grade 9', source: 'Website', campaign: 'Organic', campus: 'gdv', stage: 'Assessment', counsellor: 'Ravi T.', created: '05 Sep 2026', next: 'Assessment 19 Sep, 09:30', score: 76, transport: 'Required', curriculum: 'IGCSE', phone: '+91 98650 41192' },
      { id: 'LD-4391', parent: 'Arun Venkat', student: 'Ira Venkat', grade: 'Grade 2', source: 'Google', campaign: 'Search — CBSE alt', campus: 'gdv', stage: 'Contacted', counsellor: 'Kavitha S.', created: '04 Sep 2026', next: 'Share fee structure', score: 54, transport: 'Not required', curriculum: 'Cambridge Primary', phone: '+91 96770 12063' },
      { id: 'LD-4388', parent: 'Divya Menon', student: 'Kabir Menon', grade: 'Grade 11', source: 'Walk-in', campaign: 'Walk-in', campus: 'gdv', stage: 'Offer', counsellor: 'Ravi T.', created: '02 Sep 2026', next: 'Offer expires 22 Sep', score: 91, transport: 'Required', curriculum: 'AS Level', phone: '+91 94440 77310' },
      { id: 'LD-4380', parent: 'Sabari Nathan', student: 'Tara Nathan', grade: 'Grade 5', source: 'WhatsApp', campaign: 'Sep Admissions', campus: 'vdv', stage: 'New Lead', counsellor: 'Unassigned', created: '12 Sep 2026', next: 'First contact overdue', score: 44, transport: 'Required', curriculum: 'Cambridge Primary', phone: '+91 99620 55841' },
      { id: 'LD-4376', parent: 'Nandini Gupta', student: 'Reyansh Gupta', grade: 'Grade 3', source: 'Instagram', campaign: 'Campus reel', campus: 'gdv', stage: 'Visit Completed', counsellor: 'Kavitha S.', created: '01 Sep 2026', next: 'Send application link', score: 79, transport: 'Not required', curriculum: 'Cambridge Primary', phone: '+91 98408 66124' },
      { id: 'LD-4371', parent: 'Hari Shankar', student: 'Vedh Shankar', grade: 'Grade 8', source: 'Referral', campaign: 'Alumni referral', campus: 'gdv', stage: 'Enrolled', counsellor: 'Ravi T.', created: '22 Aug 2026', next: 'Onboarding complete', score: 95, transport: 'Required', curriculum: 'Cambridge Lower Secondary', phone: '+91 90031 22987' },
      { id: 'LD-4366', parent: 'Preethi Balan', student: 'Anvi Balan', grade: 'Grade 7', source: 'Website', campaign: 'Organic', campus: 'gdv', stage: 'Qualified', counsellor: 'Kavitha S.', created: '30 Aug 2026', next: 'Schedule visit', score: 68, transport: 'Required', curriculum: 'Cambridge Lower Secondary', phone: '+91 97890 44120' },
      { id: 'LD-4362', parent: 'Mohammed Anis', student: 'Ayaan Anis', grade: 'Grade 10', source: 'Meta Ads', campaign: 'IGCSE Awareness', campus: 'gdv', stage: 'Application', counsellor: 'Ravi T.', created: '28 Aug 2026', next: 'Transcript pending', score: 73, transport: 'Not required', curriculum: 'IGCSE', phone: '+91 95000 71263' },
      { id: 'LD-4355', parent: 'Lavanya Suresh', student: 'Mihika Suresh', grade: 'Grade 1', source: 'WhatsApp', campaign: 'Sep Admissions', campus: 'vdv', stage: 'Contacted', counsellor: 'Kavitha S.', created: '26 Aug 2026', next: 'Awaiting parent reply', score: 51, transport: 'Required', curriculum: 'Cambridge Primary', phone: '+91 99400 38851' }
    ]
  };

  /* ---- Finance ----------------------------------------------------------- */
  D.finance = {
    kpis: { billed: 21840000, collected: 17960000, outstanding: 3880000, overdue: 1240000, collectionPct: 82.2, expected: 2650000 },
    collectionTrend: { labels: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'], collected: [2960000, 3120000, 4180000, 2740000, 2810000, 2150000], billed: [3200000, 3400000, 4600000, 3400000, 3600000, 3640000] },
    ageing: [
      { label: '0–30 days', value: 1840000, color: 'var(--teal)' },
      { label: '31–60 days', value: 980000, color: 'var(--viz-4)' },
      { label: '61–90 days', value: 640000, color: 'var(--amber)' },
      { label: '90+ days', value: 420000, color: 'var(--critical)' }
    ],
    methods: [
      { label: 'UPI', value: 58, color: 'var(--teal)' },
      { label: 'Net Banking', value: 21, color: 'var(--navy)' },
      { label: 'Card', value: 14, color: 'var(--amber)' },
      { label: 'Cash / DD', value: 7, color: 'var(--viz-8)' }
    ],
    byCampus: { labels: ['Guduvanchery', 'Vadavalli', 'Pollachi'], collected: [13200000, 3960000, 800000], outstanding: [2610000, 1040000, 230000] },
    heads: [
      { head: 'Tuition', billed: 15200000, collected: 12880000 },
      { head: 'Transport', billed: 3240000, collected: 2610000 },
      { head: 'Activities', billed: 1180000, collected: 1010000 },
      { head: 'Trips', billed: 720000, collected: 590000 },
      { head: 'Uniform', billed: 640000, collected: 601000 },
      { head: 'Books & Materials', billed: 860000, collected: 269000 }
    ],
    studentAccount: {
      student: 'Aditya Kumar', id: 'HS-2026-1041', grade: 'Grade 5A',
      lines: [
        { head: 'Tuition — Term 2', due: 42000, paid: 42000, dueDate: '10 Jul 2026', status: 'Paid' },
        { head: 'Transport — Route 12, Term 2', due: 9600, paid: 9600, dueDate: '10 Jul 2026', status: 'Paid' },
        { head: 'Tuition — Term 3', due: 42000, paid: 20000, dueDate: '10 Oct 2026', status: 'Partial' },
        { head: 'Activities — Robotics Lab', due: 4500, paid: 0, dueDate: '25 Sep 2026', status: 'Pending' },
        { head: 'Residential trip — Pollachi', due: 6800, paid: 0, dueDate: '30 Sep 2026', status: 'Pending' }
      ]
    },
    expenses: [
      { id: 'EXP-2211', head: 'Facilities — AC servicing', amount: 68400, by: 'Murugan P.', date: '12 Sep 2026', status: 'Under Review' },
      { id: 'EXP-2208', head: 'Lab consumables', amount: 24150, by: 'Mr. Sathish K.', date: '11 Sep 2026', status: 'Approved' },
      { id: 'EXP-2204', head: 'Transport — diesel top-up', amount: 132000, by: 'Murugan P.', date: '09 Sep 2026', status: 'Approved' },
      { id: 'EXP-2199', head: 'Event — Innovation Day', amount: 41800, by: 'Ms. Deepa V.', date: '06 Sep 2026', status: 'Submitted' },
      { id: 'EXP-2190', head: 'Library acquisitions', amount: 56300, by: 'Ms. Lalitha R.', date: '02 Sep 2026', status: 'Rejected' }
    ],
    concessions: [
      { type: 'Sibling concession', students: 86, value: 1420000 },
      { type: 'Staff ward concession', students: 24, value: 620000 },
      { type: 'Merit scholarship', students: 18, value: 940000 },
      { type: 'Need-based support', students: 11, value: 510000 }
    ]
  };

  /* ---- Workforce & payroll ------------------------------------------------ */
  D.workforce = {
    kpis: { total: 243, present: 221, absent: 9, leave: 11, late: 6, overtime: 34, payrollPending: 12 },
    categories: [
      { label: 'Teachers', value: 118, color: 'var(--navy)' },
      { label: 'Reception & Admin', value: 21, color: 'var(--viz-4)' },
      { label: 'Security', value: 26, color: 'var(--viz-5)' },
      { label: 'Drivers & Attendants', value: 38, color: 'var(--amber)' },
      { label: 'Housekeeping', value: 24, color: 'var(--viz-7)' },
      { label: 'Lab Staff', value: 9, color: 'var(--teal)' },
      { label: 'Library Staff', value: 7, color: 'var(--viz-8)' }
    ],
    employees: [
      { id: 'EMP-1021', name: 'Ms. Priya Raghavan', dept: 'Academics', role: 'Teacher — Mathematics', type: 'Teaching', campus: 'gdv', shift: 'General 08:00–16:00', status: 'Present', leaveBal: 8, workload: 26, overtime: 0, cpd: 18 },
      { id: 'EMP-1044', name: 'Mr. Ganesh Venkat', dept: 'Academics', role: 'Teacher — Science', type: 'Teaching', campus: 'gdv', shift: 'General 08:00–16:00', status: 'Present', leaveBal: 5, workload: 28, overtime: 2, cpd: 22 },
      { id: 'EMP-1088', name: 'Ms. Anitha Devi', dept: 'Academics', role: 'Teacher — Social Studies', type: 'Teaching', campus: 'gdv', shift: 'General 08:00–16:00', status: 'On Leave', leaveBal: 2, workload: 24, overtime: 0, cpd: 14 },
      { id: 'EMP-2015', name: 'Murugan P.', dept: 'Transport', role: 'Transport Supervisor', type: 'Non-Teaching', campus: 'gdv', shift: 'Split 06:00–10:00 / 14:00–18:00', status: 'Present', leaveBal: 11, workload: 0, overtime: 14, cpd: 6 },
      { id: 'EMP-2031', name: 'Selvaraj K.', dept: 'Transport', role: 'Driver — Route 12', type: 'Non-Teaching', campus: 'gdv', shift: 'Split 06:00–10:00 / 14:00–18:00', status: 'Present', leaveBal: 7, workload: 0, overtime: 9, cpd: 4 },
      { id: 'EMP-2044', name: 'Lakshmi A.', dept: 'Transport', role: 'Bus Attendant — Route 12', type: 'Non-Teaching', campus: 'gdv', shift: 'Split 06:00–10:00 / 14:00–18:00', status: 'Present', leaveBal: 9, workload: 0, overtime: 7, cpd: 3 },
      { id: 'EMP-3002', name: 'Kavitha S.', dept: 'Front Office', role: 'Admissions Counsellor', type: 'Non-Teaching', campus: 'gdv', shift: 'General 08:30–17:00', status: 'Present', leaveBal: 6, workload: 0, overtime: 3, cpd: 9 },
      { id: 'EMP-3018', name: 'Ravi Thangaraj', dept: 'Front Office', role: 'Admissions Counsellor', type: 'Non-Teaching', campus: 'gdv', shift: 'General 08:30–17:00', status: 'Late', leaveBal: 4, workload: 0, overtime: 1, cpd: 7 },
      { id: 'EMP-4007', name: 'Devendran M.', dept: 'Security', role: 'Gate Security — Main', type: 'Non-Teaching', campus: 'gdv', shift: 'Night 20:00–06:00', status: 'Present', leaveBal: 12, workload: 0, overtime: 22, cpd: 5 },
      { id: 'EMP-4019', name: 'Saravanan R.', dept: 'Security', role: 'Gate Security — Rear', type: 'Non-Teaching', campus: 'gdv', shift: 'Day 06:00–14:00', status: 'Absent', leaveBal: 3, workload: 0, overtime: 16, cpd: 5 },
      { id: 'EMP-5005', name: 'Rekha J.', dept: 'Housekeeping', role: 'Housekeeping Lead', type: 'Non-Teaching', campus: 'gdv', shift: 'Day 07:00–15:00', status: 'Present', leaveBal: 8, workload: 0, overtime: 11, cpd: 2 },
      { id: 'EMP-6003', name: 'Mr. Sathish Kumar', dept: 'Academics', role: 'Computing & Lab', type: 'Teaching', campus: 'gdv', shift: 'General 08:00–16:00', status: 'Present', leaveBal: 9, workload: 22, overtime: 4, cpd: 26 },
      { id: 'EMP-6011', name: 'Ms. Deepa Venkat', dept: 'Student Support', role: 'School Counsellor', type: 'Teaching', campus: 'gdv', shift: 'General 08:00–16:00', status: 'Present', leaveBal: 10, workload: 12, overtime: 0, cpd: 31 },
      { id: 'EMP-7002', name: 'Ms. Kalaiselvi M.', dept: 'Academics', role: 'Teacher — Tamil', type: 'Teaching', campus: 'vdv', shift: 'General 08:00–16:00', status: 'Present', leaveBal: 6, workload: 25, overtime: 0, cpd: 12 },
      { id: 'EMP-7014', name: 'Nurse Shanthi R.', dept: 'Health', role: 'School Nurse', type: 'Non-Teaching', campus: 'gdv', shift: 'Day 07:30–16:30', status: 'Present', leaveBal: 7, workload: 0, overtime: 2, cpd: 15 }
    ],
    leaveRequests: [
      { id: 'LV-882', name: 'Ms. Anitha Devi', type: 'Casual leave', from: '16 Sep', to: '17 Sep', days: 2, status: 'Under Review', cover: 'Ms. Lalitha R.' },
      { id: 'LV-879', name: 'Saravanan R.', type: 'Sick leave', from: '16 Sep', to: '16 Sep', days: 1, status: 'Approved', cover: 'Devendran M. (OT)' },
      { id: 'LV-874', name: 'Mr. Ganesh Venkat', type: 'Earned leave', from: '24 Sep', to: '27 Sep', days: 4, status: 'Submitted', cover: 'Not assigned' },
      { id: 'LV-870', name: 'Rekha J.', type: 'Casual leave', from: '19 Sep', to: '19 Sep', days: 1, status: 'Approved', cover: 'Team rota' }
    ],
    payroll: {
      month: 'September 2026', employees: 243, gross: 9840000, deductions: 1268000, overtime: 214000, allowances: 486000, net: 9272000, pendingApprovals: 12,
      byCategory: [
        { label: 'Teaching', gross: 6120000, count: 118 },
        { label: 'Transport', gross: 1340000, count: 38 },
        { label: 'Security', gross: 812000, count: 26 },
        { label: 'Admin & Office', gross: 738000, count: 21 },
        { label: 'Housekeeping', gross: 492000, count: 24 },
        { label: 'Lab & Library', gross: 338000, count: 16 }
      ],
      runs: [
        { month: 'August 2026', net: 9184000, status: 'Paid', released: '31 Aug 2026' },
        { month: 'July 2026', net: 9096000, status: 'Paid', released: '31 Jul 2026' },
        { month: 'June 2026', net: 9012000, status: 'Paid', released: '30 Jun 2026' }
      ],
      payslip: {
        name: 'Ms. Priya Raghavan', id: 'EMP-1021', month: 'September 2026', designation: 'Teacher — Mathematics',
        earnings: [['Basic', 42000], ['House rent allowance', 16800], ['Conveyance', 3200], ['Special allowance', 6400], ['Overtime (0 hrs)', 0]],
        deductions: [['Provident fund', 5040], ['Professional tax', 200], ['Income tax (TDS)', 3800], ['Loan recovery', 0]]
      }
    }
  };

  /* ---- Safety, gate, transport -------------------------------------------- */
  D.safety = {
    gate: { arrived: 1178, inside: 1143, exited: 35, visitors: 14, pendingPickup: 6 },
    feed: [
      { time: '08:34', text: '<strong>Reshma Chandran</strong> entered — Main Gate (RFID)', icon: 'door', raw: true, meta: 'Parent notified on WhatsApp · 08:34' },
      { time: '08:33', text: 'Visitor <strong>S. Ramanujam</strong> checked in — badge V-2291', icon: 'idCard', raw: true, meta: 'Purpose: Grade 8 parent meeting · Host: Ms. Anitha D.' },
      { time: '08:32', text: 'Parent notified — <strong>Aditya Kumar</strong> safe arrival', icon: 'message', raw: true, meta: 'Delivered · WhatsApp' },
      { time: '08:31', text: '<strong>Aditya Kumar</strong> entered — Main Gate (RFID)', icon: 'door', raw: true, meta: 'Bus 12 · Boarded 07:52' },
      { time: '08:29', text: 'Bus 12 arrived at campus — 34 students de-boarded', icon: 'bus', raw: true, meta: 'On time · Attendant: Lakshmi A.' },
      { time: '08:26', text: 'Unrecognised pickup attempt flagged at Rear Gate', icon: 'alert', raw: true, meta: 'Resolved — person was an authorised grandparent, OTP verified' },
      { time: '08:18', text: 'Bus 4 running 9 minutes late — 3 stops remaining', icon: 'clock', raw: true, meta: 'Parents on Route 4 notified automatically' }
    ],
    pickupPersons: [
      { name: 'Ranjith Kumar', relation: 'Father', method: 'QR + Face', status: 'Verified', last: 'Today 15:40' },
      { name: 'Sujatha Kumar', relation: 'Mother', method: 'QR', status: 'Verified', last: '11 Sep 15:38' },
      { name: 'Ramanathan S.', relation: 'Grandfather', method: 'OTP', status: 'Verified', last: '02 Sep 15:44' },
      { name: 'Driver — Vinoth', relation: 'Authorised driver', method: 'OTP + ID', status: 'Pending', last: 'Awaiting parent confirmation' }
    ],
    visitors: [
      { id: 'V-2291', name: 'S. Ramanujam', purpose: 'Parent meeting — Grade 8', host: 'Ms. Anitha D.', inTime: '08:33', outTime: '—', status: 'Inside' },
      { id: 'V-2290', name: 'Anitha Rao', purpose: 'Admission enquiry', host: 'Kavitha S.', inTime: '08:12', outTime: '09:05', status: 'Completed' },
      { id: 'V-2289', name: 'Cambridge assessor', purpose: 'Centre audit', host: 'Dr. Meera Krishnan', inTime: '07:58', outTime: '—', status: 'Inside' },
      { id: 'V-2288', name: 'TNEB technician', purpose: 'Transformer check', host: 'Murugan P.', inTime: '07:40', outTime: '08:20', status: 'Completed' }
    ],
    incidents: [
      { id: 'INC-0112', type: 'Safeguarding', summary: 'Unrecognised pickup attempt — Rear Gate', severity: 'Attention', status: 'Closed', date: '16 Sep 2026', owner: 'Devendran M.' },
      { id: 'INC-0109', type: 'Health', summary: 'Grade 6 student — sports injury, ankle', severity: 'Information', status: 'Closed', date: '14 Sep 2026', owner: 'Nurse Shanthi R.' },
      { id: 'INC-0107', type: 'Transport', summary: 'Route 4 deviation — road closure detour', severity: 'Attention', status: 'Closed', date: '12 Sep 2026', owner: 'Murugan P.' },
      { id: 'INC-0104', type: 'Facilities', summary: 'Fire drill — evacuation 3 min 42 s', severity: 'Information', status: 'Closed', date: '05 Sep 2026', owner: 'Murugan P.' }
    ],
    infirmary: [
      { student: 'Gokul Anand', grade: 'Grade 6B', reason: 'Headache', time: '10:15', action: 'Rest 30 min, parent informed', status: 'Returned to class' },
      { student: 'Varsha Iyer', grade: 'Grade 4A', reason: 'Minor cut — playground', time: '11:02', action: 'Dressing applied', status: 'Returned to class' },
      { student: 'Manoj Natarajan', grade: 'Grade 7C', reason: 'Fever 100.4°F', time: '11:40', action: 'Parent asked to collect', status: 'Awaiting pickup' }
    ]
  };

  D.transport = {
    routes: [
      { id: 'R12', bus: 'Bus 12 · TN 09 BX 4412', driver: 'Selvaraj K.', attendant: 'Lakshmi A.', students: 34, onboard: 34, eta: 'Arrived 08:29', status: 'At campus', stops: 9, area: 'Guduvanchery East', delay: 0 },
      { id: 'R04', bus: 'Bus 4 · TN 09 BX 2208', driver: 'Ilango M.', attendant: 'Vasanthi P.', students: 41, onboard: 29, eta: '9 min', status: 'Delayed', stops: 12, area: 'Urapakkam', delay: 9 },
      { id: 'R07', bus: 'Bus 7 · TN 09 BX 3310', driver: 'Ravi S.', attendant: 'Meena K.', students: 28, onboard: 28, eta: 'Arrived 08:24', status: 'At campus', stops: 8, area: 'Vandalur', delay: 0 },
      { id: 'R09', bus: 'Bus 9 · TN 09 BX 5521', driver: 'Kannan T.', attendant: 'Jothi R.', students: 36, onboard: 31, eta: '4 min', status: 'En route', stops: 10, area: 'Maraimalai Nagar', delay: 0 },
      { id: 'R02', bus: 'Bus 2 · TN 09 BX 1104', driver: 'Prakash D.', attendant: 'Suganya M.', students: 30, onboard: 30, eta: 'Arrived 08:21', status: 'At campus', stops: 7, area: 'Singaperumal Koil', delay: 0 },
      { id: 'R15', bus: 'Bus 15 · TN 09 BX 6607', driver: 'Manikandan V.', attendant: 'Revathi S.', students: 25, onboard: 0, eta: 'Depot', status: 'Maintenance', stops: 6, area: 'Chengalpattu', delay: 0 }
    ],
    stops: [
      { name: 'Depot', time: '06:40', done: true },
      { name: 'Lake View Avenue', time: '07:52', done: true, note: 'Aditya Kumar boarded' },
      { name: 'Temple Road Junction', time: '07:58', done: true },
      { name: 'Anna Nagar Gate', time: '08:06', done: true },
      { name: 'Bypass Signal', time: '08:14', done: true },
      { name: 'Edunex Campus', time: '08:29', done: true, note: '34 students de-boarded' }
    ]
  };

  /* ---- Academics ---------------------------------------------------------- */
  D.academics = {
    stages: [
      { stage: 'Cambridge Primary', grades: 'Grade 1–6', students: 486, subjects: 8, coverage: 74 },
      { stage: 'Cambridge Lower Secondary', grades: 'Grade 7–9', students: 372, subjects: 10, coverage: 68 },
      { stage: 'Cambridge IGCSE', grades: 'Grade 9–10', students: 248, subjects: 12, coverage: 61 },
      { stage: 'Cambridge AS Level', grades: 'Grade 11', students: 108, subjects: 9, coverage: 52 },
      { stage: 'Cambridge A Level', grades: 'Grade 12', students: 70, subjects: 9, coverage: 47 }
    ],
    objectives: [
      { code: '5Nf.03', text: 'Understand and use equivalence of fractions', subject: 'Mathematics', stage: 'Primary 5', coverage: 92, mastery: 78 },
      { code: '5Nf.04', text: 'Add and subtract fractions with the same denominator', subject: 'Mathematics', stage: 'Primary 5', coverage: 84, mastery: 71 },
      { code: '5Nf.06', text: 'Compare and order fractions', subject: 'Mathematics', stage: 'Primary 5', coverage: 60, mastery: 54 },
      { code: '5Sc.02', text: 'Describe the states of matter and changes between them', subject: 'Science', stage: 'Primary 5', coverage: 100, mastery: 82 },
      { code: '5Er.01', text: 'Read and respond to a range of texts with understanding', subject: 'English', stage: 'Primary 5', coverage: 88, mastery: 80 }
    ],
    periods: ['08:20–09:00', '09:00–09:40', '09:40–10:20', '10:40–11:20', '11:20–12:00', '13:00–13:40', '13:40–14:20', '14:20–15:00'],
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    timetable: {
      Monday: ['Mathematics · P.Raghavan · R-204', 'English · L.Ramesh · R-204', 'Science · G.Venkat · Lab-1', 'Tamil · K.Murugan · R-204', 'Social · A.Devi · R-204', 'Computing · S.Kumar · Lab-2', 'Games · Coach Ravi · Field', 'Library · L.Ramesh · Library'],
      Tuesday: ['English · L.Ramesh · R-204', 'Mathematics · P.Raghavan · R-204', 'Tamil · K.Murugan · R-204', 'Science · G.Venkat · Lab-1', 'Art · N.Priya · Art Room', 'Mathematics · P.Raghavan · R-204', 'Social · A.Devi · R-204', 'Club · Various · Various'],
      Wednesday: ['Science · G.Venkat · Lab-1', 'Mathematics · P.Raghavan · R-204', 'English · L.Ramesh · R-204', 'Computing · S.Kumar · Lab-2', 'Tamil · K.Murugan · R-204', 'Social · A.Devi · R-204', 'Music · R.Sekar · Music Room', 'Games · Coach Ravi · Field'],
      Thursday: ['Mathematics · SUBSTITUTE NEEDED · R-204', 'Social · A.Devi · R-204', 'Science · G.Venkat · Lab-1', 'English · L.Ramesh · R-204', 'Computing · S.Kumar · Lab-2', 'Tamil · K.Murugan · R-204', 'Library · L.Ramesh · Library', 'Assembly · House heads · Hall'],
      Friday: ['English · L.Ramesh · R-204', 'Science · G.Venkat · Lab-1', 'Mathematics · P.Raghavan · R-204', 'Tamil · K.Murugan · R-204', 'Art · N.Priya · Art Room', 'Social · A.Devi · R-204', 'Games · Coach Ravi · Field', 'Club · Various · Various']
    },
    assessments: [
      { id: 'AS-3312', name: 'Term 3 Mathematics — Fractions', grade: 'Grade 5', subject: 'Mathematics', date: '22 Sep 2026', max: 50, status: 'Scheduled', entered: 0, of: 96 },
      { id: 'AS-3308', name: 'Term 3 Science — States of Matter', grade: 'Grade 5', subject: 'Science', date: '15 Sep 2026', max: 50, status: 'In Progress', entered: 64, of: 96 },
      { id: 'AS-3301', name: 'Mid-term English Reading', grade: 'Grade 5', subject: 'English', date: '02 Sep 2026', max: 40, status: 'Completed', entered: 96, of: 96 },
      { id: 'AS-3288', name: 'IGCSE Mock — Physics Paper 2', grade: 'Grade 10', subject: 'Physics', date: '28 Aug 2026', max: 80, status: 'Completed', entered: 124, of: 124 },
      { id: 'AS-3274', name: 'Unit Test — Social Studies', grade: 'Grade 5', subject: 'Social Studies', date: '19 Aug 2026', max: 25, status: 'Completed', entered: 96, of: 96 }
    ],
    reportCardStages: ['Marks entry', 'Moderation', 'AI draft comments', 'Teacher review', 'Approval', 'Parent release'],
    reportCards: [
      { grade: 'Grade 5A', students: 32, stage: 3, status: 'Teacher review', due: '26 Sep 2026' },
      { grade: 'Grade 5B', students: 31, stage: 2, status: 'AI draft comments', due: '26 Sep 2026' },
      { grade: 'Grade 6A', students: 33, stage: 4, status: 'Approval', due: '24 Sep 2026' },
      { grade: 'Grade 9A', students: 29, stage: 5, status: 'Released to parents', due: '18 Sep 2026' },
      { grade: 'Grade 10B', students: 30, stage: 1, status: 'Moderation', due: '30 Sep 2026' }
    ],
    homework: [
      { subject: 'Mathematics', title: 'Fractions worksheet 3 — equivalence', grade: 'Grade 5A', due: '17 Sep', submitted: 24, of: 32, status: 'Open' },
      { subject: 'English', title: 'Reading response — Chapter 6', grade: 'Grade 5A', due: '18 Sep', submitted: 11, of: 32, status: 'Open' },
      { subject: 'Science', title: 'Evaporation observation log', grade: 'Grade 5A', due: '16 Sep', submitted: 30, of: 32, status: 'Closing today' },
      { subject: 'Tamil', title: 'கவிதை மனப்பாடம்', grade: 'Grade 5A', due: '20 Sep', submitted: 4, of: 32, status: 'Open' }
    ],
    questionBank: [
      { topic: 'Fractions — equivalence', subject: 'Mathematics', stage: 'Primary 5', items: 48, used: 22, difficulty: 'Mixed' },
      { topic: 'States of matter', subject: 'Science', stage: 'Primary 5', items: 36, used: 18, difficulty: 'Foundation' },
      { topic: 'Comprehension — narrative', subject: 'English', stage: 'Primary 5', items: 61, used: 31, difficulty: 'Mixed' },
      { topic: 'Forces and motion', subject: 'Physics', stage: 'IGCSE', items: 124, used: 88, difficulty: 'Higher' }
    ]
  };

  /* ---- Parent experience --------------------------------------------------- */
  D.parents = {
    directory: [
      { name: 'Ranjith Kumar', children: 'Aditya Kumar (5A)', phone: '+91 98407 22110', email: 'ranjith.k@example.com', engagement: 86, lastContact: 'WhatsApp · 2 days ago', ptm: 'Booked' },
      { name: 'Sudha Raman', children: 'Sanjana Raman (7B)', phone: '+91 98410 55831', email: 'sudha.r@example.com', engagement: 42, lastContact: 'Call · 9 days ago', ptm: 'Not booked' },
      { name: 'Vimal Chandran', children: 'Karthik Subramani (9A)', phone: '+91 90031 44902', email: 'vimal.c@example.com', engagement: 68, lastContact: 'Email · 4 days ago', ptm: 'Booked' },
      { name: 'Gayathri N.', children: 'Harini Prasad (4C), Gokul Anand (6B)', phone: '+91 97890 11234', email: 'gayathri.n@example.com', engagement: 91, lastContact: 'WhatsApp · today', ptm: 'Booked' },
      { name: 'Prakash S.', children: 'Varsha Iyer (4A)', phone: '+91 94440 76521', email: 'prakash.s@example.com', engagement: 55, lastContact: 'SMS · 6 days ago', ptm: 'Not booked' }
    ],
    circulars: [
      { title: 'Term 3 examination schedule', date: '12 Sep 2026', audience: 'Grades 3–10', ack: 842, of: 1102, status: 'Released' },
      { title: 'Annual Innovation Day — 04 Oct', date: '09 Sep 2026', audience: 'All parents', ack: 1004, of: 1284, status: 'Released' },
      { title: 'Transport fee — Term 3 instalment', date: '05 Sep 2026', audience: 'Transport users', ack: 611, of: 742, status: 'Released' },
      { title: 'Revised pickup authorisation policy', date: '01 Sep 2026', audience: 'All parents', ack: 1190, of: 1284, status: 'Released' },
      { title: 'Grade 10 board preparation briefing', date: 'Draft', audience: 'Grade 10 parents', ack: 0, of: 124, status: 'Draft' }
    ],
    ptm: [
      { teacher: 'Ms. Priya Raghavan', subject: 'Mathematics · Grade 5A', date: '20 Sep 2026', slots: 18, booked: 14 },
      { teacher: 'Mr. Ganesh Venkat', subject: 'Science · Grade 5A', date: '20 Sep 2026', slots: 18, booked: 11 },
      { teacher: 'Ms. Lalitha Ramesh', subject: 'English · Grade 5A', date: '21 Sep 2026', slots: 16, booked: 16 },
      { teacher: 'Ms. Anitha Devi', subject: 'Social Studies · Grade 5A', date: '21 Sep 2026', slots: 16, booked: 7 }
    ],
    events: [
      { title: 'Inter-house Athletics Meet', date: '24 Sep 2026', place: 'Main Field', audience: 'Grades 3–10' },
      { title: 'Parent–Teacher Meeting — Grade 5', date: '20–21 Sep 2026', place: 'Academic Block', audience: 'Grade 5 parents' },
      { title: 'Innovation Day exhibition', date: '04 Oct 2026', place: 'Auditorium', audience: 'All parents' },
      { title: 'Cambridge curriculum briefing', date: '11 Oct 2026', place: 'Auditorium', audience: 'Grade 8–9 parents' }
    ]
  };

  /* ---- Innovation lab ------------------------------------------------------ */
  D.innovation = {
    kpis: { ideas: 84, projects: 31, mentors: 14, students: 126, competitions: 9, achievements: 22 },
    stages: ['Idea', 'Review', 'Mentor', 'Project', 'Prototype', 'Competition', 'Achievement'],
    projects: [
      { id: 'IP-091', title: 'Rainwater level sensor for school tanks', student: 'Aditya Kumar', grade: 'Grade 5A', mentor: 'Mr. Sathish K.', stage: 5, status: 'Competition', milestones: 5, done: 4, updated: '12 Sep 2026' },
      { id: 'IP-088', title: 'Tamil handwriting practice app', student: 'Keerthi Pillai', grade: 'Grade 8B', mentor: 'Ms. Kalaiselvi M.', stage: 4, status: 'Prototype', milestones: 6, done: 4, updated: '10 Sep 2026' },
      { id: 'IP-084', title: 'Low-cost air quality monitor', student: 'Vishnu Murthy', grade: 'Grade 9A', mentor: 'Mr. Ganesh V.', stage: 3, status: 'Project', milestones: 5, done: 2, updated: '08 Sep 2026' },
      { id: 'IP-079', title: 'Campus waste segregation game', student: 'Ishita Murthy', grade: 'Grade 6C', mentor: 'Ms. Deepa V.', stage: 2, status: 'Mentor assigned', milestones: 4, done: 1, updated: '05 Sep 2026' },
      { id: 'IP-076', title: 'Bus seat occupancy counter', student: 'Praveen Raman', grade: 'Grade 10A', mentor: 'Mr. Sathish K.', stage: 6, status: 'Achievement', milestones: 6, done: 6, updated: '30 Aug 2026' },
      { id: 'IP-072', title: 'Library recommendation board', student: 'Tanya Subramani', grade: 'Grade 7B', mentor: 'Ms. Lalitha R.', stage: 1, status: 'Under review', milestones: 4, done: 0, updated: '02 Sep 2026' }
    ],
    competitions: [
      { name: 'District Robotics Challenge', date: '12 Aug 2026', teams: 4, result: '2nd place — Rainwater sensor' },
      { name: 'State Science Expo', date: '18 Oct 2026', teams: 3, result: 'Registered' },
      { name: 'Young Innovators Summit', date: '06 Dec 2026', teams: 2, result: 'Shortlisting in progress' }
    ]
  };

  /* ---- Operations ---------------------------------------------------------- */
  D.operations = {
    assets: [
      { id: 'AST-2201', name: 'Interactive panel — R-204', category: 'IT', location: 'Academic Block A', assigned: 'Ms. Priya Raghavan', purchased: '12 Jun 2024', status: 'Active', nextService: '20 Oct 2026' },
      { id: 'AST-1188', name: 'Science lab fume hood', category: 'Lab', location: 'Lab-1', assigned: 'Mr. Ganesh Venkat', purchased: '03 Mar 2023', status: 'Maintenance due', nextService: '18 Sep 2026' },
      { id: 'AST-3310', name: 'Bus 15 — TN 09 BX 6607', category: 'Vehicle', location: 'Depot', assigned: 'Manikandan V.', purchased: '21 Jan 2022', status: 'In maintenance', nextService: '17 Sep 2026' },
      { id: 'AST-2044', name: 'Library RFID gate', category: 'IT', location: 'Library', assigned: 'Ms. Lalitha Ramesh', purchased: '09 Sep 2025', status: 'Active', nextService: '09 Mar 2027' },
      { id: 'AST-5017', name: 'Generator 125 kVA', category: 'Facilities', location: 'Utility yard', assigned: 'Murugan P.', purchased: '30 Nov 2021', status: 'Active', nextService: '28 Sep 2026' }
    ],
    maintenance: [
      { id: 'MR-661', item: 'Leaking tap — Block B washroom', raised: 'Rekha J.', date: '15 Sep 2026', priority: 'Low', status: 'In Progress' },
      { id: 'MR-658', item: 'Projector bulb replacement — R-108', raised: 'Ms. Anitha Devi', date: '14 Sep 2026', priority: 'Medium', status: 'Approved' },
      { id: 'MR-655', item: 'Fume hood airflow below spec', raised: 'Mr. Ganesh Venkat', date: '12 Sep 2026', priority: 'High', status: 'Under Review' },
      { id: 'MR-650', item: 'Playground swing bolt loose', raised: 'Coach Ravi', date: '10 Sep 2026', priority: 'High', status: 'Completed' }
    ],
    certificates: [
      { type: 'Transfer certificate', student: 'Rahul Venkatesh', grade: 'Grade 8', requested: '11 Sep 2026', status: 'Under Review', qr: 'TC-2026-0341' },
      { type: 'Bonafide certificate', student: 'Anjali Selvam', grade: 'Grade 10', requested: '12 Sep 2026', status: 'Approved', qr: 'BC-2026-1182' },
      { type: 'Conduct certificate', student: 'Naveen Anand', grade: 'Grade 12', requested: '09 Sep 2026', status: 'Approved', qr: 'CC-2026-0217' },
      { type: 'Bonafide certificate', student: 'Shreya Pillai', grade: 'Grade 6', requested: '13 Sep 2026', status: 'Submitted', qr: '—' }
    ],
    compliance: [
      { item: 'Fire safety certificate renewal', authority: 'TN Fire & Rescue', due: '30 Sep 2026', owner: 'Murugan P.', status: 'Due Soon', days: 14 },
      { item: 'Vehicle fitness — Bus 4, Bus 15', authority: 'RTO Chengalpattu', due: '22 Sep 2026', owner: 'Murugan P.', status: 'Due Soon', days: 6 },
      { item: 'Child-protection training refresher', authority: 'Internal / Safeguarding', due: '15 Oct 2026', owner: 'Ms. Deepa Venkat', status: 'Scheduled', days: 29 },
      { item: 'Staff background verification — new joiners', authority: 'Internal HR', due: '25 Sep 2026', owner: 'HR Office', status: 'In Progress', days: 9 },
      { item: 'Cambridge centre affiliation review', authority: 'Cambridge International', due: '12 Nov 2026', owner: 'Dr. Meera Krishnan', status: 'Scheduled', days: 57 },
      { item: 'Water quality test — quarterly', authority: 'Approved lab', due: '08 Sep 2026', owner: 'Murugan P.', status: 'Overdue', days: -8 }
    ],
    audit: [
      { time: '16 Sep 09:12', user: 'Ms. Priya Raghavan', action: 'Marked attendance — Grade 5A', entity: 'Attendance / 2026-09-16 / 5A', ip: '10.2.14.88' },
      { time: '16 Sep 09:05', user: 'Kavitha S.', action: 'Changed lead stage LD-4412 to Visit Scheduled', entity: 'Admissions / LD-4412', ip: '10.2.11.20' },
      { time: '16 Sep 08:41', user: 'Dr. Meera Krishnan', action: 'Approved payroll input — Transport overtime', entity: 'Payroll / Sep 2026', ip: '10.2.10.4' },
      { time: '16 Sep 08:34', user: 'System', action: 'Parent notified — safe arrival (Aditya Kumar)', entity: 'Smart Gate / HS-2026-1041', ip: 'service' },
      { time: '15 Sep 17:22', user: 'Murugan P.', action: 'Submitted expense EXP-2211', entity: 'Finance / EXP-2211', ip: '10.2.19.61' }
    ],
    documents: [
      { name: 'Student records — Grade 5', count: 96, updated: '14 Sep 2026', owner: 'Front Office' },
      { name: 'Employee contracts — 2026 intake', count: 21, updated: '10 Sep 2026', owner: 'HR Office' },
      { name: 'Safeguarding policy pack', count: 7, updated: '02 Sep 2026', owner: 'Ms. Deepa Venkat' },
      { name: 'Cambridge centre handbook', count: 3, updated: '28 Aug 2026', owner: 'Academic Office' },
      { name: 'Vehicle fitness records', count: 16, updated: '22 Aug 2026', owner: 'Transport' }
    ]
  };

  /* ---- CRM (beyond admissions) --------------------------------------------- */
  D.crm = {
    alumni: [
      { name: 'Divya Sundaram', batch: 2019, university: 'NIT Trichy', career: 'Product engineer, Bengaluru', engagement: 'High', last: 'Career talk — Aug 2026' },
      { name: 'Aravind Krishnan', batch: 2018, university: 'University of Melbourne', career: 'Architect, Melbourne', engagement: 'Medium', last: 'Alumni meet — Jan 2026' },
      { name: 'Nithya Balan', batch: 2020, university: 'CMC Vellore', career: 'Medical intern', engagement: 'High', last: 'Mentoring 2 students' },
      { name: 'Sanjay Rao', batch: 2017, university: 'IIT Madras', career: 'Founder, climate-tech', engagement: 'High', last: 'Innovation Lab mentor' },
      { name: 'Meera Joseph', batch: 2021, university: 'Ashoka University', career: 'Undergraduate — Economics', engagement: 'Low', last: 'Newsletter only' }
    ],
    vendors: [
      { name: 'Sri Lakshmi Transport Services', category: 'Transport maintenance', contract: 'Apr 2026 – Mar 2027', value: 1840000, status: 'Active', contact: 'K. Rajendran' },
      { name: 'BrightLearn Educational Supplies', category: 'Books & materials', contract: 'Jun 2026 – May 2027', value: 960000, status: 'Active', contact: 'Asha M.' },
      { name: 'CleanSpace Facility Management', category: 'Housekeeping', contract: 'Jan 2026 – Dec 2026', value: 2240000, status: 'Renewal due', contact: 'Vinoth B.' },
      { name: 'SecureGate Systems', category: 'Access control & CCTV', contract: 'Sep 2025 – Aug 2027', value: 1420000, status: 'Active', contact: 'Praveen N.' }
    ],
    partners: [
      { name: 'Cambridge International', type: 'Curriculum authority', since: 2011, status: 'Active', note: 'Centre affiliation review Nov 2026' },
      { name: 'Anna University Innovation Cell', type: 'Institution', since: 2023, status: 'Active', note: 'Mentors 3 Innovation Lab projects' },
      { name: 'District Sports Academy', type: 'Partner', since: 2022, status: 'Active', note: 'Athletics coaching, 2 days a week' },
      { name: 'Wellbeing First Counselling', type: 'Partner', since: 2024, status: 'Active', note: 'External counselling referrals' }
    ],
    communications: [
      { channel: 'WhatsApp', who: 'Ranjith Kumar', subject: 'Term 3 fee instalment reminder', when: 'Today 09:20', status: 'Delivered' },
      { channel: 'Call', who: 'Sudha Raman', subject: 'Attendance follow-up — Sanjana', when: 'Today 08:50', status: 'No answer' },
      { channel: 'Email', who: 'Vimal Chandran', subject: 'Grade 9 subject selection', when: 'Yesterday', status: 'Opened' },
      { channel: 'SMS', who: 'Route 4 parents', subject: 'Bus running 9 minutes late', when: 'Today 08:18', status: 'Delivered · 41 recipients' },
      { channel: 'Note', who: 'Kavitha S.', subject: 'Lead LD-4412 prefers weekend campus visit', when: 'Yesterday', status: 'Internal' }
    ]
  };

  /* ---- Notifications -------------------------------------------------------
     Every notification declares the roles that may receive it. A parent must
     never see an administration alert, and a member of staff must never see
     another person's record. Routes are always reachable by the roles listed.
     -------------------------------------------------------------------------- */
  D.notifications = [
    /* Management and office — running the school */
    { id: 'N-901', roles: ['management', 'office'], tone: 'critical', icon: 'alert', title: 'Water quality test overdue by 8 days', meta: 'Compliance · Owner: Murugan P.', time: '08:05', route: '#/compliance', category: 'Critical' },
    { id: 'N-900', roles: ['management', 'teacher'], tone: 'critical', icon: 'userCheck', title: '12 students absent 3+ consecutive days', meta: 'Early Warning · Requires teacher review', time: '08:02', route: '#/early-warning', category: 'Critical' },
    { id: 'N-899', roles: ['management', 'office', 'staff'], tone: 'warning', icon: 'bus', title: 'Bus 4 running 9 minutes late', meta: 'Transport · 41 parents notified automatically', time: '08:18', route: '#/bus-tracking', category: 'Attention' },
    { id: 'N-898', roles: ['management', 'office'], tone: 'warning', icon: 'wallet', title: '₹12.4L fees overdue beyond 30 days', meta: 'Finance · 86 student accounts', time: '07:40', route: '#/fees', category: 'Attention' },
    { id: 'N-897', roles: ['management', 'office'], tone: 'warning', icon: 'users', title: '3 admissions follow-ups overdue', meta: 'Admissions · Counsellor unassigned on LD-4380', time: '07:35', route: '#/admissions', category: 'Attention' },
    { id: 'N-896', roles: ['management', 'office'], tone: 'caution', icon: 'briefcase', title: 'Substitute needed — Grade 5A Mathematics, Thursday P1', meta: 'Workforce · Ms. Anitha Devi on leave', time: '07:30', route: '#/timetable', category: 'Attention' },
    { id: 'N-895', roles: ['management', 'office'], tone: 'caution', icon: 'clipboard', title: '12 payroll inputs await approval', meta: 'Payroll · September 2026 run', time: '07:15', route: '#/payroll', category: 'Attention' },
    { id: 'N-894', roles: ['management', 'teacher'], tone: 'info', icon: 'message', title: '9 parent queries unanswered over 24 h', meta: 'Parent Communication', time: 'Yesterday', route: '#/parent-communication', category: 'Information' },
    { id: 'N-893', roles: ['management', 'office', 'teacher'], tone: 'info', icon: 'calendar', title: 'PTM booking opens for Grade 5 parents', meta: 'Parent Experience · 20–21 Sep', time: 'Yesterday', route: '#/ptm', category: 'Information' },
    { id: 'N-892', roles: ['management'], tone: 'success', icon: 'check', title: 'Attendance marked for all 38 sections', meta: 'Operations · Completed 09:14', time: '09:14', route: '#/attendance', category: 'Completed' },
    { id: 'N-891', roles: ['management', 'office', 'staff'], tone: 'success', icon: 'shieldCheck', title: 'Fire drill completed — 3 min 42 s evacuation', meta: 'Safety · Report filed', time: '05 Sep', route: '#/safeguarding', category: 'Completed' },

    /* Teacher — their own classes only */
    { id: 'N-881', roles: ['teacher'], tone: 'critical', icon: 'checkSquare', title: 'Grade 5A attendance not yet marked', meta: 'Period 1 started at 08:20', time: '08:25', route: '#/attendance', category: 'Critical' },
    { id: 'N-880', roles: ['teacher'], tone: 'warning', icon: 'clipboard', title: '32 Science marks pending entry', meta: 'Term 3 States of Matter · closes 18 Sep', time: '08:10', route: '#/assessments', category: 'Attention' },
    { id: 'N-879', roles: ['teacher'], tone: 'warning', icon: 'sparkle', title: '3 AI-drafted report comments awaiting your review', meta: 'Grade 5A · nothing publishes until you approve', time: '07:55', route: '#/report-cards', category: 'Attention' },
    { id: 'N-878', roles: ['teacher'], tone: 'caution', icon: 'user', title: 'Reshma Chandran — homework submission at 40%', meta: 'Three weeks running · your watchlist', time: 'Yesterday', route: '#/early-warning', category: 'Attention' },
    { id: 'N-877', roles: ['teacher'], tone: 'info', icon: 'calendar', title: 'Your Thursday Period 1 needs substitute cover', meta: 'Timetable · suggestion ready', time: 'Yesterday', route: '#/timetable', category: 'Information' },
    { id: 'N-876', roles: ['teacher'], tone: 'success', icon: 'check', title: 'Grade 6B lesson plan approved and published', meta: 'Fractions — equivalence · approved by you', time: 'Yesterday', route: '#/lesson-plans', category: 'Completed' },

    /* Parent — their own child only */
    { id: 'N-871', roles: ['parent'], tone: 'warning', icon: 'wallet', title: 'Term 3 instalment of ₹22,000 is due', meta: 'Due 10 Oct · pay from the app', time: '09:20', route: '#/parent-360?tab=fees', category: 'Attention' },
    { id: 'N-870', roles: ['parent'], tone: 'warning', icon: 'edit', title: 'English reading response due tomorrow', meta: 'Aditya has not submitted yet', time: '08:40', route: '#/parent-360?tab=academics', category: 'Attention' },
    { id: 'N-869', roles: ['parent'], tone: 'caution', icon: 'megaphone', title: 'Circular needs your acknowledgement', meta: 'Term 3 examination schedule', time: 'Yesterday', route: '#/parent-360?tab=more', category: 'Attention' },
    { id: 'N-868', roles: ['parent'], tone: 'info', icon: 'bus', title: 'Bus 12 arriving at your stop in 12 minutes', meta: 'Afternoon run · driver Selvaraj K.', time: '15:28', route: '#/parent-360?tab=safety', category: 'Information' },
    { id: 'N-867', roles: ['parent'], tone: 'info', icon: 'calendar', title: 'PTM booking is open for Grade 5', meta: '20–21 Sep · 4 slots left with Ms. Priya Raghavan', time: 'Yesterday', route: '#/parent-360?tab=more', category: 'Information' },
    { id: 'N-866', roles: ['parent'], tone: 'success', icon: 'shieldCheck', title: 'Aditya arrived safely at 08:31', meta: 'Main Gate · verified entry', time: '08:32', route: '#/parent-360?tab=safety', category: 'Completed' },
    { id: 'N-865', roles: ['parent'], tone: 'success', icon: 'award', title: 'Achievement recorded — District Robotics, 2nd place', meta: 'Verified by the school · added to the portfolio', time: '12 Aug', route: '#/parent-360', category: 'Completed' },

    /* Non-teaching staff — their own employment only */
    { id: 'N-861', roles: ['staff'], tone: 'critical', icon: 'truck', title: 'Vehicle fitness due — Bus 4 and Bus 15', meta: 'RTO Chengalpattu · due 22 Sep · you are the owner', time: '07:45', route: '#/staff-self', category: 'Critical' },
    { id: 'N-860', roles: ['staff'], tone: 'warning', icon: 'clock', title: 'Your overtime claim of 14 hours is under review', meta: 'September run · with the section head', time: '08:00', route: '#/staff-self', category: 'Attention' },
    { id: 'N-859', roles: ['staff'], tone: 'caution', icon: 'shield', title: 'Rear gate cover needed on Thursday', meta: 'Saravanan R. absent · roster gap', time: 'Yesterday', route: '#/staff-self', category: 'Attention' },
    { id: 'N-858', roles: ['staff'], tone: 'info', icon: 'receipt', title: 'Your August payslip is available', meta: 'Net ₹38,420 · released 31 Aug', time: '31 Aug', route: '#/staff-self', category: 'Information' },
    { id: 'N-857', roles: ['staff'], tone: 'success', icon: 'check', title: 'Your leave on 19 Sep was approved', meta: 'LV-879 · cover arranged from the team rota', time: 'Yesterday', route: '#/staff-self', category: 'Completed' }
  ];

  /* Notifications this role is allowed to receive */
  D.notificationsFor = function (role) {
    return D.notifications.filter(function (n) { return n.roles.indexOf(role) > -1; });
  };

  /* ---- Command centre attention items -------------------------------------- */
  D.attention = [
    { tone: 'critical', icon: 'userCheck', title: '14 students require intervention', meta: 'Attendance or academic decline confirmed by teachers', route: '#/early-warning', count: 14 },
    { tone: 'warning', icon: 'activity', title: '3 attendance anomalies today', meta: 'Grade 7 at 88%, Route 4 late arrivals, Monday pattern', route: '#/attendance', count: 3 },
    { tone: 'warning', icon: 'users', title: '11 admissions follow-ups pending', meta: '3 overdue beyond 48 hours · 1 lead unassigned', route: '#/admissions', count: 11 },
    { tone: 'caution', icon: 'briefcase', title: '2 staff shortages to cover', meta: 'Grade 5A Mathematics (Thu), Rear Gate security (today)', route: '#/workforce', count: 2 },
    { tone: 'caution', icon: 'checkSquare', title: '19 approvals waiting on you', meta: '12 payroll inputs, 4 expenses, 3 certificates', route: '#/my-tasks', count: 19 },
    { tone: 'info', icon: 'message', title: '9 parent queries unanswered', meta: 'Oldest open 31 hours — Grade 8 transport query', route: '#/parent-communication', count: 9 },
    { tone: 'success', icon: 'check', title: '5 operational tasks completed', meta: 'Attendance closed, bus runs logged, infirmary reconciled', route: '#/notifications', count: 5 }
  ];

  /* ---- Tasks ---------------------------------------------------------------
     Assigned work, scoped to the signed-in role. A parent is asked to do parent
     things; approvals never appear outside the roles that hold them.
     -------------------------------------------------------------------------- */
  D.tasks = [
    /* Management */
    { id: 'T-551', roles: ['management'], title: 'Approve September payroll inputs', module: 'Payroll', due: 'Today', priority: 'High', status: 'Pending', route: '#/payroll' },
    { id: 'T-549', roles: ['management', 'teacher'], title: 'Review Early Warning signals (14 students)', module: 'Early Warning', due: 'Today', priority: 'High', status: 'Pending', route: '#/early-warning' },
    { id: 'T-546', roles: ['management'], title: 'Sign off Grade 6A report cards', module: 'Report Cards', due: '24 Sep', priority: 'Medium', status: 'Pending', route: '#/report-cards' },
    { id: 'T-544', roles: ['management'], title: 'Approve expense EXP-2211 (AC servicing)', module: 'Finance', due: '18 Sep', priority: 'Medium', status: 'Under Review', route: '#/expenses' },
    { id: 'T-540', roles: ['management', 'office'], title: 'Renew water quality test — overdue', module: 'Compliance', due: 'Overdue', priority: 'High', status: 'Pending', route: '#/compliance' },
    { id: 'T-538', roles: ['management'], title: 'Confirm Grade 5 PTM slot plan', module: 'Parent Experience', due: '19 Sep', priority: 'Low', status: 'Pending', route: '#/ptm' },

    /* Teacher */
    { id: 'T-533', roles: ['teacher'], title: 'Mark attendance — Grade 5A', module: 'Attendance', due: 'Today', priority: 'High', status: 'Pending', route: '#/attendance' },
    { id: 'T-532', roles: ['teacher'], title: 'Enter Science marks — 32 pending', module: 'Assessments', due: 'Today', priority: 'High', status: 'Pending', route: '#/assessments' },
    { id: 'T-531', roles: ['teacher'], title: 'Review 3 AI-drafted report comments', module: 'Report Cards', due: 'Today', priority: 'Medium', status: 'Under Review', route: '#/report-cards' },
    { id: 'T-530', roles: ['teacher'], title: 'Reply to 2 parent messages', module: 'Communication', due: 'Today', priority: 'Medium', status: 'Pending', route: '#/parent-communication' },
    { id: 'T-529', roles: ['teacher'], title: 'Confirm Thursday substitute cover', module: 'Timetable', due: '18 Sep', priority: 'Low', status: 'Pending', route: '#/timetable' },

    /* Parent */
    { id: 'T-521', roles: ['parent'], title: 'Pay Term 3 instalment — ₹22,000', module: 'Fees', due: '10 Oct', priority: 'High', status: 'Pending', route: '#/parent-360?tab=fees' },
    { id: 'T-520', roles: ['parent'], title: 'Acknowledge circular — Term 3 examination schedule', module: 'Circulars', due: '18 Sep', priority: 'Medium', status: 'Pending', route: '#/parent-360?tab=more' },
    { id: 'T-519', roles: ['parent'], title: 'Book your PTM slot for Grade 5', module: 'PTM', due: '19 Sep', priority: 'Medium', status: 'Pending', route: '#/parent-360?tab=more' },
    { id: 'T-518', roles: ['parent'], title: 'Confirm the new authorised pickup person', module: 'Safety', due: '20 Sep', priority: 'High', status: 'Pending', route: '#/parent-360?tab=safety' },
    { id: 'T-517', roles: ['parent'], title: 'Upload renewed address proof', module: 'Documents', due: '25 Sep', priority: 'Low', status: 'Pending', route: '#/parent-360?tab=more' },

    /* Office */
    { id: 'T-511', roles: ['office'], title: 'Assign a counsellor to lead LD-4380', module: 'Admissions', due: 'Today', priority: 'High', status: 'Pending', route: '#/leads' },
    { id: 'T-510', roles: ['office'], title: 'Chase documents for application LD-4405', module: 'Applications', due: 'Today', priority: 'Medium', status: 'Pending', route: '#/applications' },
    { id: 'T-509', roles: ['office'], title: 'Issue transfer certificate — Rahul Venkatesh', module: 'Certificates', due: '18 Sep', priority: 'Medium', status: 'Under Review', route: '#/certificates' },
    { id: 'T-508', roles: ['office'], title: 'Clear 2 payment reconciliation exceptions', module: 'Finance', due: '18 Sep', priority: 'Medium', status: 'Pending', route: '#/reconciliation' },
    { id: 'T-507', roles: ['office'], title: 'Send fee reminders to 86 overdue accounts', module: 'Fees', due: '19 Sep', priority: 'Low', status: 'Pending', route: '#/fees' },

    /* Non-teaching staff */
    { id: 'T-501', roles: ['staff'], title: 'Book vehicle fitness — Bus 4 and Bus 15', module: 'Compliance', due: '22 Sep', priority: 'High', status: 'Pending', route: '#/staff-self' },
    { id: 'T-500', roles: ['staff'], title: 'Submit your September overtime claim', module: 'Overtime', due: '25 Sep', priority: 'Medium', status: 'Pending', route: '#/staff-self' },
    { id: 'T-499', roles: ['staff'], title: 'Arrange rear gate cover for Thursday', module: 'Shifts', due: '18 Sep', priority: 'High', status: 'Pending', route: '#/staff-self' },
    { id: 'T-498', roles: ['staff'], title: 'Complete child-protection refresher', module: 'Training', due: '15 Oct', priority: 'Low', status: 'Pending', route: '#/staff-self' }
  ];

  /* Tasks assigned to this role */
  D.tasksFor = function (role) {
    return D.tasks.filter(function (t) { return t.roles.indexOf(role) > -1; });
  };

  /* ---- Group / multi-campus ------------------------------------------------ */
  D.group = {
    metrics: [
      { key: 'students', label: 'Students', gdv: 1284, vdv: 612, plc: 184, format: 'n' },
      { key: 'admissions', label: 'Admissions YTD', gdv: 38, vdv: 22, plc: 9, format: 'n' },
      { key: 'attendance', label: 'Attendance', gdv: 91.7, vdv: 93.4, plc: 96.1, format: 'pct' },
      { key: 'collection', label: 'Fee collection', gdv: 83.5, vdv: 79.2, plc: 77.7, format: 'pct' },
      { key: 'staffing', label: 'Staff filled', gdv: 96, vdv: 92, plc: 88, format: 'pct' },
      { key: 'engagement', label: 'Parent engagement', gdv: 74, vdv: 68, plc: 81, format: 'pct' },
      { key: 'nps', label: 'Parent NPS', gdv: 52, vdv: 44, plc: 61, format: 'n' },
      { key: 'academic', label: 'Academic index', gdv: 72, vdv: 69, plc: 74, format: 'n' }
    ],
    transfers: [
      { student: 'Meenakshi Iyer', from: 'Vadavalli', to: 'Guduvanchery', grade: 'Grade 7', reason: 'Family relocation', status: 'Approved', date: '10 Sep 2026' },
      { student: 'Rohan Pillai', from: 'Guduvanchery', to: 'Pollachi', grade: 'Grade 9', reason: 'Residential programme', status: 'Under Review', date: '13 Sep 2026' },
      { student: 'Swetha Anand', from: 'Guduvanchery', to: 'Vadavalli', grade: 'Grade 4', reason: 'Proximity to home', status: 'Submitted', date: '15 Sep 2026' }
    ],
    policies: [
      { name: 'Group fee structure framework', scope: 'All campuses', version: 'v4.2', updated: '01 Jul 2026', status: 'Active' },
      { name: 'Safeguarding and child protection', scope: 'All campuses', version: 'v3.0', updated: '02 Sep 2026', status: 'Active' },
      { name: 'Staff recruitment and verification', scope: 'All campuses', version: 'v2.6', updated: '15 Aug 2026', status: 'Active' },
      { name: 'Inter-campus transfer policy', scope: 'All campuses', version: 'v1.9', updated: '20 Jun 2026', status: 'Under review' }
    ]
  };

  /* ---- AI ------------------------------------------------------------------ */
  D.ai = {
    copilotActions: [
      { id: 'lesson', label: 'Create Lesson Plan', icon: 'bookOpen', desc: 'Objective-aligned plan with activities and timings' },
      { id: 'worksheet', label: 'Create Worksheet', icon: 'fileText', desc: 'Differentiated practice at three levels' },
      { id: 'quiz', label: 'Create Quiz', icon: 'checkSquare', desc: 'Drawn from the approved question bank' },
      { id: 'comment', label: 'Draft Report Comment', icon: 'edit', desc: 'Evidence-based comment per student' },
      { id: 'message', label: 'Draft Parent Message', icon: 'message', desc: 'Tone-checked, bilingual if required' },
      { id: 'brief', label: 'Weekly Class Brief', icon: 'clipboard', desc: 'Coverage, gaps and students to watch' }
    ],
    lessonDraft: {
      title: 'Grade 6 · Mathematics · Fractions',
      objective: 'Students compare and order fractions with unlike denominators, and explain their reasoning using a common denominator or a benchmark of one half. (Cambridge 6Nf.05)',
      plan: [
        { time: '0–5 min', step: 'Recall starter', detail: 'Quick fire: name three fractions equivalent to one half. Collect on the board.' },
        { time: '5–15 min', step: 'Guided instruction', detail: 'Model comparison of 3/5 and 5/8 using a common denominator. Then model the benchmark method.' },
        { time: '15–30 min', step: 'Paired practice', detail: 'Ordering cards activity. Pairs justify placement to each other before recording.' },
        { time: '30–38 min', step: 'Differentiated task', detail: 'Foundation, core and extension sets issued from the worksheet below.' },
        { time: '38–40 min', step: 'Exit ticket', detail: 'Two comparison questions with a one-line explanation each.' }
      ],
      activities: ['Ordering cards (physical manipulative)', 'Number line placement on the board', 'Think-pair-share justification'],
      differentiated: [
        { level: 'Foundation', detail: '6 comparisons with denominators from the same family (halves, quarters, eighths).' },
        { level: 'Core', detail: '8 comparisons with unlike denominators, 2 requiring ordering of three fractions.' },
        { level: 'Extension', detail: '4 problems in context plus one "explain the error" task.' }
      ],
      quiz: [
        { q: 'Which is larger, 3/5 or 5/8? Explain your method.', marks: 2 },
        { q: 'Order from smallest to largest: 2/3, 5/9, 7/12.', marks: 3 },
        { q: 'Priya says 4/7 is more than 1/2 because 4 is more than 2. Is she right? Explain.', marks: 2 },
        { q: 'Write a fraction between 1/3 and 1/2.', marks: 2 }
      ],
      homework: 'Worksheet 3, questions 1–8. Extension students attempt question 9 and bring one real-life example of comparing fractions.'
    },
    knowledgeQA: [
      {
        q: 'What is the procedure for student leave?',
        a: 'A parent submits the leave request through the Parent app or in writing to the class teacher at least one working day in advance. Leave beyond three consecutive days needs the Head of Section to approve it, and medical leave beyond three days needs a doctor\'s note. The class teacher records the approved leave so attendance is not counted as unexplained absence.',
        sources: [{ doc: 'Student Handbook 2026–27', section: 'Section 4.2 — Attendance and leave', updated: '12 Jun 2026' }, { doc: 'Attendance Policy', section: 'Clause 7', updated: '02 May 2026' }],
        confidence: 'High'
      },
      {
        q: 'When is the next Grade VI PTM?',
        a: 'Grade 6 parent–teacher meetings are scheduled for 20 and 21 September 2026 in the Academic Block. Booking is open in the Parent app. Forty-eight of sixty-eight slots are booked at the time of asking.',
        sources: [{ doc: 'Academic Calendar 2026–27', section: 'Term 3 events', updated: '01 Sep 2026' }, { doc: 'PTM Scheduler', section: 'Live record', updated: 'Today' }],
        confidence: 'High'
      },
      {
        q: 'Show this month\'s admissions by source.',
        a: 'September 2026 to date: 32 enquiries. WhatsApp 11, Website 8, Meta Ads 6, Referral 4, Google 2, Walk-in 1. Four admissions confirmed so far this month, two of them from referrals.',
        sources: [{ doc: 'Admissions CRM', section: 'Live record', updated: 'Today 09:10' }],
        confidence: 'High', chart: true
      },
      {
        q: 'What is our safeguarding escalation path?',
        a: 'Any concern is logged the same day by the staff member who observed it. The Designated Safeguarding Lead reviews it within twenty-four hours and decides whether it is a record-only note, an internal support plan, or an external referral. The Principal is informed of every external referral.',
        sources: [{ doc: 'Safeguarding and Child Protection Policy v3.0', section: 'Section 6 — Escalation', updated: '02 Sep 2026' }],
        confidence: 'High'
      }
    ],
    whatsapp: [
      { from: 'parent', text: 'Hi, does Edunex offer Cambridge IGCSE?', time: '09:12' },
      { from: 'ai', text: 'Yes. Edunex offers Cambridge IGCSE at the Guduvanchery campus, along with Cambridge Primary, Lower Secondary, AS and A Level. Would you like to know about subjects, transport, or schedule a campus visit?', time: '09:12', quick: ['View Curriculum', 'Transport', 'Book Visit', 'Talk to Counsellor'] },
      { from: 'parent', text: 'What subjects are available for Grade 9?', time: '09:14' },
      { from: 'ai', text: 'At Grade 9 the IGCSE core is English, Mathematics and Combined or Separate Sciences. Options include Computer Science, Business Studies, Economics, Art and Design, and a second language. I can send the full subject sheet, or book a counsellor call.', time: '09:14', quick: ['Send subject sheet', 'Book counsellor call'] },
      { from: 'parent', text: 'Book a visit please, weekend if possible.', time: '09:16' },
      { from: 'ai', text: 'Saturday 20 September at 10:00 or 11:30 are open. Which suits you? I have noted your preference for weekends on the enquiry.', time: '09:16', quick: ['10:00 Saturday', '11:30 Saturday'] }
    ]
  };

  /* ---- Early warning ------------------------------------------------------- */
  D.earlyWarning = {
    stages: ['Signal', 'Teacher Review', 'Intervention', 'Action', 'Follow-up', 'Closed'],
    summary: { atRisk: 14, developing: 37, onTrack: 1233, reviewed: 41, open: 23, closedThisTerm: 58 },
    signals: [
      { id: 'SIG-341', student: 'Sanjana Raman', sid: 'HS-2026-1042', grade: 'Grade 7B', signal: 'Attendance fell to 79% with 4 unexplained absences', stage: 1, owner: 'Mr. Ganesh V.', raised: '14 Sep 2026' },
      { id: 'SIG-338', student: 'Karthik Subramani', sid: 'HS-2026-1043', grade: 'Grade 9A', signal: 'Mathematics down 7 points across two assessments', stage: 2, owner: 'Ms. Anitha D.', raised: '11 Sep 2026' },
      { id: 'SIG-334', student: 'Manoj Natarajan', sid: 'HS-2026-1073', grade: 'Grade 7C', signal: 'Participation in class activities declined markedly', stage: 3, owner: 'Ms. Deepa V.', raised: '08 Sep 2026' },
      { id: 'SIG-329', student: 'Dinesh Selvam', sid: 'HS-2026-1058', grade: 'Grade 5A', signal: 'Repeated late arrivals linked to Route 4 delays', stage: 4, owner: 'Murugan P.', raised: '05 Sep 2026' },
      { id: 'SIG-321', student: 'Reshma Chandran', sid: 'HS-2026-1082', grade: 'Grade 5A', signal: 'Homework submission rate 40% over three weeks', stage: 2, owner: 'Ms. Priya R.', raised: '02 Sep 2026' }
    ]
  };

  /* ---- Day in the life ----------------------------------------------------- */
  D.dayInLife = [
    { time: '07:45', title: 'Bus tracking and parent notification', role: 'Parent', icon: 'bus', route: '#/bus-tracking',
      body: 'Bus 12 departs the depot. GPS begins streaming. Ranjith opens the Parent app and sees an ETA of 7 minutes for the Lake View Avenue stop.',
      chain: ['Bus starts', 'GPS tracking', 'Parent sees ETA'] },
    { time: '07:52', title: 'Boarding confirmation', role: 'Transport', icon: 'scan', route: '#/bus-tracking',
      body: 'Aditya taps in at the door. The attendant confirms 34 of 34 students onboard. The parent receives "Aditya boarded".',
      chain: ['Student boards', 'Boarding confirmation'] },
    { time: '08:31', title: 'Safe arrival at the gate', role: 'Safety', icon: 'door', route: '#/smart-gate',
      body: 'RFID at the Main Gate registers entry at 08:31. At 08:32 the parent is notified that Aditya has arrived safely.',
      chain: ['Student reaches school', 'Safe-arrival notification'] },
    { time: '09:00', title: 'Teacher marks attendance in one tap', role: 'Teacher', icon: 'checkSquare', route: '#/attendance',
      body: 'Ms. Priya opens Grade 5A, marks 2 absent and 2 late, and submits. Absence alerts go to those parents on WhatsApp within the minute.',
      chain: ['Teacher marks attendance', 'Attendance saved', 'Absent student identified', 'WhatsApp parent alert'] },
    { time: '09:05', title: 'Command Center reflects the live pulse', role: 'Management', icon: 'pulse', route: '#/command-center',
      body: 'The Principal sees 1,178 present, 138 of 146 staff in, 11 admissions follow-ups pending and 14 students needing attention.',
      chain: ['Pattern analysed', 'Early Warning if required'] },
    { time: '10:20', title: 'Classroom activity and learning evidence', role: 'Teacher', icon: 'bookOpen', route: '#/copilot',
      body: 'The fractions lesson drafted with the AI Co-Pilot runs in R-204. The teacher edited two activities before approving it yesterday.',
      chain: ['Teacher intervention'] },
    { time: '11:30', title: 'Assessment marks feed the profile', role: 'Academics', icon: 'clipboard', route: '#/assessments',
      body: 'Science marks for 64 of 96 students are entered. Each score lands in the student profile and updates the learning-gap view.',
      chain: ['Assessment', 'Performance data', 'Learning gap'] },
    { time: '12:15', title: 'Parent communication', role: 'Parent', icon: 'message', route: '#/parent-communication',
      body: 'Sanjana\'s absence triggers an automated note. The counsellor follows up by phone and records the outcome against the signal.',
      chain: ['Action recorded in Student 360'] },
    { time: '13:40', title: 'Fee payment and receipt', role: 'Finance', icon: 'wallet', route: '#/fees',
      body: 'A Term 3 instalment is paid by UPI from the Parent app. The receipt is issued instantly and sent on WhatsApp.',
      chain: ['Pay Now', 'Payment success', 'Receipt', 'WhatsApp receipt'] },
    { time: '15:45', title: 'Staff attendance and overtime', role: 'Workforce', icon: 'briefcase', route: '#/workforce',
      body: 'Transport staff close their split shift. Overtime hours for the Rear Gate cover flow straight into the payroll input queue.',
      chain: ['Attendance', 'Overtime', 'Approval'] },
    { time: '16:30', title: 'Management review', role: 'Management', icon: 'chart', route: '#/early-warning',
      body: 'The Principal reviews the day: two new Early Warning signals accepted, one closed, and the Route 4 delay assigned to transport.',
      chain: ['Teacher action', 'Intervention'] },
    { time: '17:30', title: 'End-of-day reporting', role: 'Management', icon: 'fileText', route: '#/reports',
      body: 'The daily brief is generated: attendance, safety events, admissions movement, collections and open approvals for tomorrow.',
      chain: ['Progress measurement'] }
  ];

  /* ---- Automation flows ---------------------------------------------------- */
  D.automations = [
    { id: 'attendance', title: 'Attendance automation', icon: 'checkSquare', tone: 'navy', route: '#/attendance',
      steps: ['Teacher marks attendance', 'Attendance saved', 'Absent student identified', 'WhatsApp parent alert', 'Pattern analysed', 'Early Warning if required', 'Teacher intervention', 'Action recorded in Student 360'] },
    { id: 'bus', title: 'Bus automation', icon: 'bus', tone: 'teal', route: '#/bus-tracking',
      steps: ['Bus starts', 'GPS tracking', 'Parent sees ETA', 'Student boards', 'Boarding confirmation', 'Student reaches school', 'Safe-arrival notification'] },
    { id: 'admission', title: 'Admission automation', icon: 'users', tone: 'amber', route: '#/admissions',
      steps: ['Enquiry', 'WhatsApp AI', 'Lead created', 'Counsellor assigned', 'Visit scheduled', 'Application', 'Assessment', 'Offer', 'Admission', 'Student Master created'] },
    { id: 'payroll', title: 'Payroll automation', icon: 'wallet', tone: 'navy', route: '#/payroll',
      steps: ['Employee Master', 'Attendance', 'Leave', 'Overtime', 'Allowance', 'Approval', 'Payroll', 'Payslip'] },
    { id: 'academic', title: 'Academic intelligence', icon: 'brain', tone: 'teal', route: '#/early-warning',
      steps: ['Assessment', 'Performance data', 'Learning gap', 'Student 360', 'Early Warning / Talent Discovery', 'Teacher action', 'Intervention', 'Progress measurement'] }
  ];

  /* ---- Teacher day --------------------------------------------------------- */
  D.teacher = {
    name: 'Ms. Priya Raghavan',
    classes: [
      { name: 'Grade 5A', subject: 'Mathematics', students: 32, next: 'Period 1 · 08:20', attendance: 'Not marked' },
      { name: 'Grade 6B', subject: 'Mathematics', students: 33, next: 'Period 3 · 09:40', attendance: 'Marked' },
      { name: 'Grade 6C', subject: 'Mathematics', students: 31, next: 'Period 6 · 13:00', attendance: 'Pending' },
      { name: 'Grade 7A', subject: 'Mathematics', students: 30, next: 'Tomorrow', attendance: '—' }
    ],
    today: [
      { period: 'P1 · 08:20', what: 'Grade 5A Mathematics', where: 'R-204', state: 'now' },
      { period: 'P2 · 09:00', what: 'Free — marking', where: 'Staff room', state: '' },
      { period: 'P3 · 09:40', what: 'Grade 6B Mathematics', where: 'R-211', state: '' },
      { period: 'P4 · 10:40', what: 'Grade 6B Mathematics', where: 'R-211', state: '' },
      { period: 'P6 · 13:00', what: 'Grade 6C Mathematics', where: 'R-208', state: '' },
      { period: 'P8 · 14:20', what: 'Robotics Club support', where: 'Lab-2', state: '' }
    ],
    tasks: [
      { title: 'Enter Science marks — 32 pending', due: 'Today', module: 'Assessments', route: '#/assessments' },
      { title: 'Review 3 AI-drafted report comments', due: 'Today', module: 'Report Cards', route: '#/report-cards' },
      { title: 'Respond to 2 parent messages', due: 'Today', module: 'Communication', route: '#/parent-communication' },
      { title: 'Confirm Thursday substitute cover', due: '18 Sep', module: 'Timetable', route: '#/timetable' }
    ],
    watchlist: [
      { id: 'HS-2026-1082', name: 'Reshma Chandran', reason: 'Homework submission 40% over three weeks', tone: 'warning' },
      { id: 'HS-2026-1058', name: 'Dinesh Selvam', reason: 'Late 6 times this month — transport linked', tone: 'caution' },
      { id: 'HS-2026-1073', name: 'Manoj Natarajan', reason: 'Absent today, second day running', tone: 'critical' }
    ]
  };

  /* ---- Search index --------------------------------------------------------
     Scoped to the signed-in role. A parent searches their own child and their
     own records; a member of staff searches their own employment. Nobody can
     reach another family's or another employee's record through search.
     -------------------------------------------------------------------------- */
  D.searchIndex = function (role) {
    role = role || 'management';
    var out = [];

    if (role === 'parent') {
      var child = D.students[0];
      out.push({ group: 'My child', label: child.name, meta: child.grade + child.section + ' · ' + child.id, icon: 'user', route: '#/parent-360' });
      [['Academic progress', '#/parent-360?tab=academics', 'trending'],
       ['Homework', '#/parent-360?tab=academics', 'edit'],
       ['Attendance', '#/parent-360?tab=academics', 'checkSquare'],
       ['Safe arrival and gate entry', '#/parent-360?tab=safety', 'shieldCheck'],
       ['Bus 12 tracking', '#/parent-360?tab=safety', 'bus'],
       ['Pickup authorisation', '#/parent-360?tab=safety', 'key'],
       ['Fees and instalments', '#/parent-360?tab=fees', 'wallet'],
       ['Receipts', '#/parent-360?tab=fees', 'receipt'],
       ['PTM booking', '#/parent-360?tab=more', 'calendar'],
       ['Circulars', '#/parent-360?tab=more', 'megaphone'],
       ['My tasks', '#/my-tasks', 'checkSquare'],
       ['Notifications', '#/notifications', 'bell']
      ].forEach(function (r) {
        out.push({ group: 'My records', label: r[0], meta: 'Open', icon: r[2], route: r[1] });
      });
      return out;
    }

    if (role === 'staff') {
      out.push({ group: 'Me', label: 'Murugan P.', meta: 'Transport Supervisor · EMP-2015', icon: 'idCard', route: '#/staff-self' });
      [['My roster and shifts', '#/staff-self', 'clock'],
       ['My leave', '#/staff-self', 'calendar'],
       ['My overtime', '#/staff-self', 'clock'],
       ['My payslips', '#/staff-self', 'receipt'],
       ['Bus routes', '#/routes', 'bus'],
       ['Bus tracking', '#/bus-tracking', 'mapPin'],
       ['Gate entry and exit', '#/gate-log', 'scan'],
       ['Visitor management', '#/visitors', 'idCard'],
       ['My tasks', '#/my-tasks', 'checkSquare']
      ].forEach(function (r) {
        out.push({ group: 'My work', label: r[0], meta: 'Open', icon: r[2], route: r[1] });
      });
      return out;
    }

    /* Management, teacher and office reach student records */
    D.students.slice(0, 20).forEach(function (s) {
      out.push({ group: 'Students', label: s.name, meta: s.grade + s.section + ' · ' + s.id, icon: 'user', route: '#/student-360?id=' + s.id });
    });
    D.parents.directory.forEach(function (p) {
      out.push({ group: 'Parents', label: p.name, meta: p.children, icon: 'users', route: '#/parent-directory' });
    });

    if (role === 'management' || role === 'office') {
      D.workforce.employees.forEach(function (e) {
        out.push({ group: 'Employees', label: e.name, meta: e.role + ' · ' + e.id, icon: 'briefcase', route: '#/workforce' });
      });
      D.admissions.leads.forEach(function (l) {
        out.push({ group: 'Admissions', label: l.student + ' (' + l.parent + ')', meta: l.stage + ' · ' + l.id, icon: 'target', route: '#/admissions' });
      });
    }

    var pages = [['Grade 5A timetable', '#/timetable', 'calendar'], ['Report cards', '#/report-cards', 'fileText'],
                 ['Assessments', '#/assessments', 'clipboard'], ['Attendance', '#/attendance', 'checkSquare'],
                 ['Homework', '#/homework', 'edit'], ['Curriculum', '#/curriculum', 'bookOpen']];
    if (role === 'management' || role === 'office') {
      pages = pages.concat([['Fee collection', '#/fees', 'wallet'], ['Student accounts', '#/student-accounts', 'receipt'],
                            ['Payroll — September 2026', '#/payroll', 'wallet'], ['Compliance calendar', '#/compliance', 'shield'],
                            ['Audit trail', '#/audit', 'list'], ['Bus routes', '#/routes', 'bus'], ['Safeguarding', '#/safeguarding', 'shieldCheck']]);
    }
    if (role === 'management') {
      pages = pages.concat([['Day in the life', '#/day-in-life', 'clock'], ['Design system', '#/design-system', 'layers'],
                            ['Automation flows', '#/automations', 'zap'], ['WhatsApp AI', '#/whatsapp-ai', 'message']]);
    }
    pages.forEach(function (r) {
      out.push({ group: 'Pages & reports', label: r[0], meta: 'Open module', icon: r[2], route: r[1] });
    });
    return out;
  };
})(window.HS = window.HS || {});
