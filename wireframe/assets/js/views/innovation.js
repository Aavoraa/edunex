/* ==========================================================================
   VIEWS — Student Innovation Lab: ideas, projects, mentors, milestones,
           competitions, achievements
   ========================================================================== */
(function (HS) {
  'use strict';
  var U = HS.ui, D = HS.data, C = HS.charts, esc = HS.esc;
  var I = D.innovation;

  function stageBadge(stage) {
    var name = I.stages[stage] || 'Idea';
    var tone = stage >= 6 ? 'success' : stage >= 4 ? 'info' : stage >= 2 ? 'warning' : 'neutral';
    return U.badge(name, tone);
  }

  HS.route('innovation', function () {
    return U.page(
      U.pageHead({
        title: 'Student Innovation Lab',
        sub: 'Idea → Review → Mentor → Project → Prototype → Competition → Achievement. Every project has a student, a mentor and evidence.',
        actions: U.btn('Submit an idea', { icon: 'lightbulb', action: 'idea-submit' }) +
          U.btn('New project', { variant: 'primary', icon: 'plus', action: 'not-built', arg: 'New project' })
      }) +
      U.grid('g-4col', [
        U.kpi({ label: 'Ideas submitted', value: I.kpis.ideas, tone: '', delta: 24, route: '#/ideas' }),
        U.kpi({ label: 'Active projects', value: I.kpis.projects, tone: 'amber', route: '#/projects' }),
        U.kpi({ label: 'Mentors', value: I.kpis.mentors, tone: 'info', route: '#/mentors' }),
        U.kpi({ label: 'Students involved', value: I.kpis.students, tone: 'teal', foot: '10% of the school' }),
        U.kpi({ label: 'Competitions entered', value: I.kpis.competitions, tone: '', route: '#/competitions' }),
        U.kpi({ label: 'Achievements', value: I.kpis.achievements, tone: 'teal', route: '#/achievements' }),
        U.kpi({ label: 'Prototypes built', value: 14, tone: 'amber' }),
        U.kpi({ label: 'Alumni mentoring', value: 3, tone: 'info', route: HS.can('#/alumni') ? '#/alumni' : null, foot: '3 alumni mentors' })
      ]) +
      '<div class="mt-5">' + U.card({
        title: 'Pipeline', sub: 'Where the 31 active projects sit today',
        body: U.flow(I.stages.map(function (s, i) {
          var counts = [18, 11, 9, 8, 6, 4, 22];
          return { label: s, meta: counts[i] + (i === 6 ? ' recorded' : ' projects'), state: i === 3 ? 'active' : i < 3 ? 'done' : '' };
        }))
      }) + '</div>' +
      '<div class="grid g-main mt-4">' +
      U.card({ title: 'Projects', flush: true, body: U.table({
        rowAction: 'project-open', rowId: function (r) { return r.id; },
        cols: [
          { key: 'title', label: 'Project', render: function (r) { return '<span class="t-bold">' + esc(r.title) + '</span><div class="t-micro t-muted">' + esc(r.id) + '</div>'; } },
          { key: 'student', label: 'Student', render: function (r) {
            return '<button class="t-sm t-info" data-action="open-student" data-arg="HS-2026-1041">' + esc(r.student) + '</button><div class="t-micro t-muted">' + esc(r.grade) + '</div>';
          } },
          { key: 'mentor', label: 'Mentor' },
          { key: 'stage', label: 'Stage', render: function (r) { return stageBadge(r.stage); } },
          { key: 'done', label: 'Milestones', render: function (r) { return U.meter({ label: '', value: r.done / r.milestones * 100, right: r.done + '/' + r.milestones, tone: r.done === r.milestones ? 'teal' : 'amber' }); } },
          { key: 'updated', label: 'Updated' }
        ],
        rows: I.projects
      }) }) +
      '<div class="col g-4">' +
      U.card({ title: 'Competitions', flush: true, body: '<div>' + I.competitions.map(function (c) {
        return U.alertItem({ tone: /place/.test(c.result) ? 'success' : 'info', icon: 'award', title: c.name,
          meta: c.date + ' · ' + c.teams + ' teams · ' + c.result, action: 'demo', arg: c.name });
      }).join('') + '</div>' }) +
      U.card({ title: 'Skills developed', sub: 'Across Innovation Lab participants',
        body: C.radar({ size: 240, axes: ['Creativity', 'Critical Thinking', 'Collaboration', 'Communication', 'Leadership'],
          series: [{ name: 'Lab participants', values: [88, 82, 79, 74, 71], color: 'var(--amber)' },
                   { name: 'School median', values: [68, 70, 72, 69, 62], color: 'var(--neutral)' }] }) +
          '<div class="mt-3">' + C.legend([{ label: 'Lab participants', color: 'var(--amber)' }, { label: 'School median', color: 'var(--neutral)' }]) + '</div>' }) +
      '</div></div>'
    );
  });

  HS.on('project-open', function (id) {
    var p = I.projects.filter(function (x) { return x.id === id; })[0] || I.projects[0];
    U.modal({
      title: p.title, sub: p.id + ' · ' + p.student + ' (' + p.grade + ') · mentor ' + p.mentor, size: 'full',
      body: '<div class="mb-5">' + U.stepper(I.stages, p.stage) + '</div>' +
        '<div class="grid g-2col g-5">' +
        '<div class="col g-4">' +
        U.card({ title: 'Milestones', tight: true, body: U.timeline([
          { time: 'Jun 2026', title: 'Idea submitted and reviewed', body: 'Accepted into the lab with a mentor assigned.', tone: 'teal' },
          { time: 'Jul 2026', title: 'Design and first build', body: 'Ultrasonic sensor, microcontroller, waterproof housing.', tone: 'teal' },
          { time: 'Jul 2026', title: 'Test in the school tank', body: 'Readings within 3 cm of the manual measurement.', tone: 'teal' },
          { time: 'Aug 2026', title: 'District Robotics Challenge', body: 'Second of 34 teams. Judges noted the low-cost housing.', tone: 'amber' },
          { time: 'Sep 2026', title: 'Refinement for the state expo', body: 'In progress — adding a low-water alert to the maintenance app.', tone: 'muted' }
        ]) }) +
        U.card({ title: 'Evidence', tight: true, body: '<div class="grid g-3col g-3">' +
          ['Prototype photo', 'Test log', 'Judging sheet', 'Design sketch', 'Demo video', 'Cost sheet'].map(function (x) {
            return '<div class="card card--tint" style="padding:0;overflow:hidden"><div style="height:66px;background:linear-gradient(135deg,#E8F0F6,#D9E7F1);display:grid;place-items:center;color:var(--navy-light)">' +
              HS.icon(/video/.test(x) ? 'play' : /photo|sketch/.test(x) ? 'camera' : 'fileText', 20) + '</div>' +
              '<div style="padding:8px"><span class="t-micro t-bold">' + esc(x) + '</span></div></div>';
          }).join('') + '</div>' }) +
        '</div>' +
        '<div class="col g-4">' +
        U.card({ title: 'Mentor feedback', tight: true, body:
          '<div class="row-top g-3">' + U.avatar(p.mentor, { size: 'sm' }) +
          '<div><div class="t-sm t-bold">' + esc(p.mentor) + '</div>' +
          '<p class="t-sm mt-2">The housing design is the strongest part of this project. Next step is reliability: run the sensor for two weeks continuously and log the drift before the expo.</p>' +
          '<div class="t-micro t-muted mt-2">12 Sep 2026</div></div></div>' }) +
        U.card({ title: 'Judging record', tight: true, flush: true, body: U.table({ compact: true, stack: false, cols: [
          { key: 'c', label: 'Criterion' }, { key: 's', label: 'Score', cls: 'num' }
        ], rows: [
          { c: 'Originality', s: '9 / 10' }, { c: 'Technical execution', s: '8 / 10' },
          { c: 'Practical value', s: '9 / 10' }, { c: 'Presentation', s: '7 / 10' }
        ] }) }) +
        U.card({ title: 'Achievement', tight: true, body:
          '<div class="row g-3">' + '<span class="avatar avatar--amber none">' + HS.icon('award', 18) + '</span>' +
          '<div><div class="t-sm t-bold">District Robotics Challenge — 2nd place</div>' +
          '<div class="t-micro t-muted">12 Aug 2026 · verified · recorded on the Student 360 profile</div></div></div>' }) +
        '</div></div>',
      foot: U.btn('Close', { action: 'close-overlay' }) +
        U.btn('Open Student 360', { icon: 'user', action: 'open-student', arg: 'HS-2026-1041' }) +
        U.btn('Add milestone', { variant: 'primary', icon: 'plus', action: 'demo-close' })
    });
  });

  HS.on('idea-submit', function () {
    U.modal({
      title: 'Submit an idea', sub: 'Any student can submit. A teacher reviews within a week.',
      body: '<div class="col g-3">' +
        U.field({ label: 'Idea title', placeholder: 'What are you trying to make or solve?' }) +
        U.field({ type: 'textarea', label: 'Describe it', rows: 4, placeholder: 'What problem does it solve, and how might it work?' }) +
        U.field({ type: 'select', label: 'Area', options: ['Robotics & electronics', 'Software & apps', 'Environment & sustainability', 'Health & wellbeing', 'Community & social', 'Other'] }) +
        U.field({ type: 'select', label: 'Would you like a mentor?', options: ['Yes, please assign one', 'I already have one in mind', 'Not yet'] }) +
        '</div>' +
        '<div class="mt-4">' + U.flow([{ label: 'Idea', state: 'active' }, { label: 'Review' }, { label: 'Mentor' }, { label: 'Project' }]) + '</div>',
      foot: U.btn('Cancel', { action: 'close-overlay' }) + U.btn('Submit idea', { variant: 'primary', action: 'demo-close' })
    });
  });

  HS.route('ideas', function () {
    var ideas = [
      { title: 'Rainwater level sensor for school tanks', by: 'Aditya Kumar', grade: 'Grade 5A', area: 'Environment', date: '02 Jun 2026', status: 'Approved' },
      { title: 'Tamil handwriting practice app', by: 'Keerthi Pillai', grade: 'Grade 8B', area: 'Software', date: '14 Jun 2026', status: 'Approved' },
      { title: 'Library recommendation board', by: 'Tanya Subramani', grade: 'Grade 7B', area: 'Community', date: '28 Aug 2026', status: 'Under Review' },
      { title: 'Solar phone charger for the bus bay', by: 'Gokul Anand', grade: 'Grade 6B', area: 'Environment', date: '05 Sep 2026', status: 'Submitted' },
      { title: 'Lost property tracker', by: 'Varsha Iyer', grade: 'Grade 4A', area: 'Community', date: '08 Sep 2026', status: 'Submitted' },
      { title: 'Noise level display for the canteen', by: 'Praveen Raman', grade: 'Grade 10A', area: 'Health', date: '10 Sep 2026', status: 'Under Review' }
    ];
    return U.page(
      U.pageHead({ title: 'Ideas', sub: 'Where every project starts. Reviewed by a teacher within a week of submission.',
        actions: U.btn('Submit an idea', { variant: 'primary', icon: 'lightbulb', action: 'idea-submit' }) }) +
      U.card({ flush: true, body: U.table({
        cols: [
          { key: 'title', label: 'Idea', render: function (r) { return '<span class="t-bold">' + esc(r.title) + '</span>'; } },
          { key: 'by', label: 'Student', render: function (r) { return '<button class="t-info" data-action="open-student" data-arg="HS-2026-1041">' + esc(r.by) + '</button><div class="t-micro t-muted">' + esc(r.grade) + '</div>'; } },
          { key: 'area', label: 'Area' }, { key: 'date', label: 'Submitted' },
          { key: 'status', label: 'Status', render: function (r) { return U.status(r.status); } },
          { key: 'a', label: '', sortable: false, cls: 'num', render: function (r) {
            return r.status === 'Approved' ? U.btn('Open project', { size: 'sm', action: 'project-open', arg: 'IP-091' })
              : U.btn('Review', { size: 'sm', variant: 'primary', action: 'demo', arg: 'Idea reviewed and mentor suggested' });
          } }
        ],
        rows: ideas
      }) })
    );
  });

  HS.route('projects', function () {
    return U.page(
      U.pageHead({ title: 'Projects', sub: 'All active and completed Innovation Lab projects.' }) +
      '<div class="grid g-3col g-4">' + I.projects.map(function (p) {
        return '<button class="card card--link" style="padding:0;overflow:hidden;text-align:left" data-action="project-open" data-arg="' + esc(p.id) + '">' +
          '<div style="height:92px;background:linear-gradient(135deg,var(--magenta),var(--magenta-light));display:grid;place-items:center;color:var(--gold)">' + HS.icon('rocket', 26) + '</div>' +
          '<div style="padding:16px"><div class="row between"><span class="t-micro t-muted">' + esc(p.id) + '</span>' + stageBadge(p.stage) + '</div>' +
          '<div class="t-sm t-bold mt-2">' + esc(p.title) + '</div>' +
          '<div class="t-micro t-muted mt-1">' + esc(p.student + ' · ' + p.grade) + '</div>' +
          '<div class="mt-3">' + U.meter({ label: 'Milestones', value: p.done / p.milestones * 100, right: p.done + '/' + p.milestones, tone: 'amber' }) + '</div>' +
          '</div></button>';
      }).join('') + '</div>'
    );
  });

  HS.route('mentors', function () {
    var mentors = [
      { name: 'Mr. Sathish Kumar', role: 'Computing & Lab', projects: 3, students: 7, type: 'Staff' },
      { name: 'Mr. Ganesh Venkat', role: 'Science', projects: 2, students: 5, type: 'Staff' },
      { name: 'Ms. Kalaiselvi M.', role: 'Tamil', projects: 1, students: 2, type: 'Staff' },
      { name: 'Ms. Deepa Venkat', role: 'Student Support', projects: 1, students: 3, type: 'Staff' },
      { name: 'Sanjay Rao', role: 'Founder, climate-tech · Batch of 2017', projects: 2, students: 4, type: 'Alumni' },
      { name: 'Nithya Balan', role: 'Medical intern · Batch of 2020', projects: 1, students: 2, type: 'Alumni' },
      { name: 'Anna University Innovation Cell', role: 'Partner institution', projects: 3, students: 9, type: 'Partner' }
    ];
    return U.page(
      U.pageHead({ title: 'Mentors', sub: 'Staff, alumni and partner institutions supporting student projects.',
        actions: U.btn('Invite a mentor', { variant: 'primary', icon: 'plus', action: 'not-built', arg: 'Invite mentor' }) }) +
      U.card({ flush: true, body: U.table({
        cols: [
          { key: 'name', label: 'Mentor', render: function (r) { return U.person(r.name, r.role); } },
          { key: 'type', label: 'Type', render: function (r) { return U.badge(r.type, r.type === 'Alumni' ? 'info' : r.type === 'Partner' ? 'warning' : 'neutral'); } },
          { key: 'projects', label: 'Projects', cls: 'num' },
          { key: 'students', label: 'Students', cls: 'num' },
          { key: 'a', label: '', sortable: false, cls: 'num', render: function () { return U.btn('View', { size: 'sm', action: 'not-built', arg: 'Mentor profile' }); } }
        ],
        rows: mentors
      }) })
    );
  });

  HS.route('milestones', function () {
    return U.page(
      U.pageHead({ title: 'Milestones', sub: 'Project checkpoints across the lab, and what is running late.' }) +
      U.grid('g-4col', [
        U.kpi({ label: 'Milestones this term', value: 62, tone: '' }),
        U.kpi({ label: 'Completed', value: 41, tone: 'teal' }),
        U.kpi({ label: 'Due this week', value: 8, tone: 'amber' }),
        U.kpi({ label: 'Overdue', value: 5, tone: 'critical' })
      ]) +
      '<div class="mt-4">' + U.card({ flush: true, body: U.table({
        cols: [
          { key: 'milestone', label: 'Milestone', render: function (r) { return '<span class="t-bold">' + esc(r.milestone) + '</span><div class="t-micro t-muted">' + esc(r.project) + '</div>'; } },
          { key: 'student', label: 'Student' }, { key: 'due', label: 'Due' },
          { key: 'status', label: 'Status', render: function (r) { return U.status(r.status); } }
        ],
        rows: [
          { milestone: 'Two-week reliability test', project: 'Rainwater level sensor', student: 'Aditya Kumar', due: '26 Sep', status: 'In Progress' },
          { milestone: 'User testing with Grade 3', project: 'Tamil handwriting app', student: 'Keerthi Pillai', due: '20 Sep', status: 'In Progress' },
          { milestone: 'Sensor calibration', project: 'Air quality monitor', student: 'Vishnu Murthy', due: '12 Sep', status: 'Overdue' },
          { milestone: 'Mentor assignment', project: 'Waste segregation game', student: 'Ishita Murthy', due: '10 Sep', status: 'Overdue' },
          { milestone: 'Expo submission pack', project: 'Rainwater level sensor', student: 'Aditya Kumar', due: '02 Oct', status: 'Pending' }
        ]
      }) }) + '</div>'
    );
  });

  HS.route('competitions', function () {
    return U.page(
      U.pageHead({ title: 'Competitions', sub: 'External events entered, teams sent and results recorded.',
        actions: U.btn('Register for a competition', { variant: 'primary', icon: 'plus', action: 'not-built', arg: 'Competition registration' }) }) +
      U.card({ flush: true, body: U.table({
        cols: [
          { key: 'name', label: 'Competition', render: function (r) { return '<span class="t-bold">' + esc(r.name) + '</span>'; } },
          { key: 'date', label: 'Date' }, { key: 'teams', label: 'Teams', cls: 'num' },
          { key: 'result', label: 'Result', render: function (r) { return /place/.test(r.result) ? U.badge(r.result, 'success', { icon: 'award' }) : esc(r.result); } }
        ],
        rows: I.competitions
      }) })
    );
  });

  HS.route('achievements', function () {
    var rows = [];
    D.student360['HS-2026-1041'].achievements.forEach(function (a) {
      rows.push({ student: 'Aditya Kumar', grade: 'Grade 5A', title: a.title, date: a.date, type: a.type, verified: a.verified });
    });
    [['Praveen Raman', 'Grade 10A', 'Young Innovators Summit — finalist', '30 Aug 2026', 'Competition'],
     ['Keerthi Pillai', 'Grade 8B', 'State Tamil essay competition — 1st', '18 Jul 2026', 'Academic'],
     ['Harini Prasad', 'Grade 4C', 'District athletics — 200m bronze', '22 Jun 2026', 'Sport'],
     ['Vishnu Murthy', 'Grade 9A', 'Science expo selection', '14 Sep 2026', 'Competition']
    ].forEach(function (r) { rows.push({ student: r[0], grade: r[1], title: r[2], date: r[3], type: r[4], verified: true }); });

    return U.page(
      U.pageHead({ title: 'Achievements', sub: 'Verified recognition, recorded on the student profile and in the portfolio.' }) +
      U.grid('g-4col', [
        U.kpi({ label: 'Achievements this year', value: I.kpis.achievements, tone: 'teal', delta: 31 }),
        U.kpi({ label: 'Competition results', value: 9, tone: 'amber' }),
        U.kpi({ label: 'Academic honours', value: 7, tone: 'info' }),
        U.kpi({ label: 'Sport and arts', value: 6, tone: '' })
      ]) +
      '<div class="mt-4">' + U.card({ flush: true, body: U.table({
        rowAction: 'open-student', rowId: function () { return 'HS-2026-1041'; },
        cols: [
          { key: 'title', label: 'Achievement', render: function (r) { return '<span class="row g-3">' + HS.icon('award', 16, 't-warning') + '<span class="t-bold">' + esc(r.title) + '</span></span>'; } },
          { key: 'student', label: 'Student', render: function (r) { return '<span class="t-sm">' + esc(r.student) + '</span><div class="t-micro t-muted">' + esc(r.grade) + '</div>'; } },
          { key: 'type', label: 'Type' }, { key: 'date', label: 'Date' },
          { key: 'verified', label: 'Verification', render: function (r) { return U.badge(r.verified ? 'Verified' : 'Unverified', r.verified ? 'success' : 'neutral', { icon: r.verified ? 'check' : null }); } }
        ],
        rows: rows
      }) }) + '</div>'
    );
  });
})(window.HS = window.HS || {});
