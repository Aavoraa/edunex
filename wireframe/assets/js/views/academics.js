/* ==========================================================================
   VIEWS — Curriculum, Classes, Subjects, Timetable, Lesson Plans, Homework,
           Question Bank, Assessments, Report Cards, Cambridge Objectives
   ========================================================================== */
(function (HS) {
  'use strict';
  var U = HS.ui, D = HS.data, C = HS.charts, esc = HS.esc;
  var AC = D.academics;

  /* ===================================================== CURRICULUM ====== */
  HS.route('curriculum', function () {
    return U.page(
      U.pageHead({
        title: 'Curriculum',
        sub: 'Cambridge Primary, Lower Secondary, IGCSE, AS and A Level are configured as stages, each with its own objectives and coverage tracking.',
        actions: U.btn('Import objectives', { icon: 'upload', action: 'not-built', arg: 'Objective import' }) +
          U.btn('Map curriculum', { variant: 'primary', icon: 'layers', action: 'not-built', arg: 'Curriculum mapping' })
      }) +
      U.card({ flush: true, body: U.table({
        cols: [
          { key: 'stage', label: 'Stage', render: function (r) { return '<span class="t-bold">' + esc(r.stage) + '</span><div class="t-micro t-muted">' + esc(r.grades) + '</div>'; } },
          { key: 'students', label: 'Students', cls: 'num' },
          { key: 'subjects', label: 'Subjects', cls: 'num' },
          { key: 'coverage', label: 'Objective coverage this year', render: function (r) {
            return U.meter({ label: '', value: r.coverage, right: r.coverage + '%', tone: r.coverage >= 70 ? 'teal' : r.coverage >= 55 ? 'amber' : 'critical' });
          } },
          { key: 'a', label: '', sortable: false, cls: 'num', render: function () { return U.btn('Objectives', { size: 'sm', route: '#/objectives' }); } }
        ],
        rows: AC.stages
      }) }) +
      '<div class="grid g-2col g-4 mt-4">' +
      U.card({ title: 'Coverage by subject', sub: 'Objectives taught against objectives planned', body: C.bar({
        labels: ['English', 'Maths', 'Science', 'Tamil', 'Social', 'Computing'],
        series: [{ name: 'Coverage %', values: [78, 71, 74, 82, 64, 69], color: 'var(--navy)' }], yMax: 100, target: 75, targetLabel: 'Plan', height: 230
      }) }) +
      U.card({ title: 'Mastery against coverage', sub: 'Taught is not the same as learned', body: C.line({
        labels: ['Term 1', 'Term 2', 'Term 3', 'Mid Yr', 'Term 4', 'Now'],
        series: [{ name: 'Coverage', values: [22, 39, 51, 60, 68, 74], color: 'var(--navy)' },
                 { name: 'Mastery', values: [19, 33, 43, 51, 58, 62], color: 'var(--teal)' }],
        yMax: 100, unit: '%', height: 230
      }) + '<div class="mt-3">' + C.legend([{ label: 'Coverage', color: 'var(--navy)' }, { label: 'Mastery', color: 'var(--teal)' }]) + '</div>' }) +
      '</div>'
    );
  });

  HS.route('objectives', function () {
    return U.page(
      U.pageHead({ title: 'Cambridge Objectives', sub: 'Each objective is tracked for coverage and for mastery, so a gap is visible before the exam is.' }) +
      U.card({ flush: true, body: U.table({
        cols: [
          { key: 'code', label: 'Code', render: function (r) { return '<span class="t-bold t-num">' + esc(r.code) + '</span>'; } },
          { key: 'text', label: 'Objective' },
          { key: 'subject', label: 'Subject' }, { key: 'stage', label: 'Stage' },
          { key: 'coverage', label: 'Coverage', render: function (r) { return U.meter({ label: '', value: r.coverage, right: r.coverage + '%', tone: 'info' }); } },
          { key: 'mastery', label: 'Mastery', render: function (r) { return U.meter({ label: '', value: r.mastery, right: r.mastery + '%', tone: r.mastery >= 75 ? 'teal' : 'amber' }); } },
          { key: 'a', label: '', sortable: false, cls: 'num', render: function () { return HS.can('#/copilot') ? U.btn('Practice', { size: 'sm', variant: 'amber', icon: 'sparkle', route: '#/copilot' }) : ''; } }
        ],
        rows: AC.objectives
      }) })
    );
  });

  /* ======================================================== TIMETABLE ==== */
  HS.route('timetable', function () {
    var v = HS.vs('tt', { cls: 'Grade 5A' });
    var head = '<tr><th style="width:96px">Period</th>' + AC.days.map(function (d) { return '<th>' + esc(d) + '</th>'; }).join('') + '</tr>';
    var body = AC.periods.map(function (p, pi) {
      return '<tr><td class="t-micro t-muted t-num t-nowrap">' + esc(p) + '</td>' +
        AC.days.map(function (d) {
          var cell = AC.timetable[d][pi] || '';
          var parts = cell.split(' · ');
          var conflict = /SUBSTITUTE/.test(cell);
          var free = /Free/.test(cell);
          return '<td style="padding:6px">' +
            '<button class="card ' + (conflict ? '' : 'card--link') + '" style="width:100%;padding:8px 10px;text-align:left;border-radius:var(--r-sm);' +
            (conflict ? 'background:var(--critical-tint);border-color:var(--critical-line)' : free ? 'background:var(--surface-alt)' : '') + '" ' +
            'data-action="' + (conflict ? 'tt-conflict' : 'demo') + '" data-arg="' + esc(conflict ? d + '|' + pi : parts[0] + ' — ' + d) + '">' +
            '<span class="t-xs t-bold" style="display:block">' + esc(parts[0] || '—') + '</span>' +
            '<span class="t-micro t-muted" style="display:block">' + esc((parts[1] || '') + (parts[2] ? ' · ' + parts[2] : '')) + '</span>' +
            '</button></td>';
        }).join('') + '</tr>';
    }).join('');

    return U.page(
      U.pageHead({
        title: 'Timetable',
        sub: 'Days by periods, with teacher, room, conflicts and substitute suggestions.',
        actions: U.field({ type: 'select', value: v.cls, options: ['Grade 5A', 'Grade 5B', 'Grade 6A', 'Grade 6B', 'Grade 9A'], action: 'tt-class' }) +
          U.btn('Publish changes', { variant: 'primary', icon: 'check', action: 'demo', arg: 'Timetable changes published' })
      }) +
      U.banner('<strong>1 conflict.</strong> Thursday Period 1, Grade 5A Mathematics has no teacher — Ms. Anitha Devi is on approved leave. A substitute suggestion is ready.', 'warning', 'alert') +
      '<div class="mt-4">' + U.card({ flush: true, body:
        '<div class="table-wrap"><table class="table table--compact" style="min-width:860px"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>'
      }) + '</div>' +
      '<div class="grid g-3col g-4 mt-4">' +
      U.card({ title: 'Teacher load', sub: 'Periods per week', body: C.hbar({ rows: [
        { label: 'P. Raghavan', value: 26, color: 'var(--navy)' }, { label: 'G. Venkat', value: 28, color: 'var(--critical)' },
        { label: 'L. Ramesh', value: 24, color: 'var(--navy)' }, { label: 'A. Devi', value: 24, color: 'var(--navy)' },
        { label: 'S. Kumar', value: 22, color: 'var(--teal)' }
      ], labelW: 110, rowH: 28 }) + '<p class="t-micro t-muted mt-3">Above 27 periods is over the agreed load.</p>' }) +
      U.card({ title: 'Room utilisation', body: C.donut({ size: 160, thickness: 22, center: '78%', centerSub: 'Occupied', data: [
        { label: 'In use', value: 78, color: 'var(--teal)' }, { label: 'Free', value: 22, color: 'var(--bg-sunken)' }] }) }) +
      U.card({ title: 'Substitute suggestions', sub: 'For Thursday Period 1', body: '<div class="col g-2">' + [
        ['Ms. Lalitha Ramesh', 'Free P1 · teaches Grade 5 English · has covered Maths before', 'success'],
        ['Mr. Sathish Kumar', 'Free P1 · Computing · Maths-capable', 'info'],
        ['Ms. Kalaiselvi M.', 'Free P1 · Tamil · would need a plan', 'neutral']
      ].map(function (s) {
        return '<button class="card card--link row g-3" style="padding:10px 12px;text-align:left" data-action="demo" data-arg="' + esc(s[0]) + ' assigned to Thursday Period 1">' +
          U.avatar(s[0], { size: 'sm' }) + '<span class="col grow"><span class="t-sm t-bold">' + esc(s[0]) + '</span>' +
          '<span class="t-micro t-muted">' + esc(s[1]) + '</span></span>' + U.badge('Assign', s[2]) + '</button>';
      }).join('') + '</div>' }) +
      '</div>'
    );
  });
  HS.on('tt-class', function (a, el) { HS.vs('tt').cls = el.value; HS.render(); });
  HS.on('tt-conflict', function () {
    U.modal({
      title: 'Timetable conflict', sub: 'Thursday · Period 1 · Grade 5A Mathematics · Room R-204',
      body: U.banner('Ms. Anitha Devi is on approved leave (LV-882, 16–17 Sep). No teacher is assigned to this period.', 'critical', 'alert') +
        '<div class="mt-4"><div class="eyebrow mb-2">Suggested cover</div><div class="col g-2">' +
        ['Ms. Lalitha Ramesh — free, has covered Maths before', 'Mr. Sathish Kumar — free, Maths-capable', 'Merge with Grade 5B for this period'].map(function (s) {
          return '<label class="check card card--tint" style="padding:10px 12px"><input type="radio" name="sub"> ' + esc(s) + '</label>';
        }).join('') + '</div></div>',
      foot: U.btn('Cancel', { action: 'close-overlay' }) + U.btn('Assign cover', { variant: 'primary', action: 'demo-close' })
    });
  });

  /* ======================================================= ASSESSMENTS === */
  HS.route('assessments', function () {
    return U.page(
      U.pageHead({
        title: 'Assessments',
        sub: 'Creation, marks entry, moderation, grade calculation, predicted grades and performance trends.',
        actions: U.btn('Question bank', { icon: 'helpCircle', route: '#/question-bank' }) +
          U.btn('Create assessment', { variant: 'primary', icon: 'plus', action: 'assess-create' })
      }) +
      U.grid('g-4col', [
        U.kpi({ label: 'Active assessments', value: 2, tone: 'amber', foot: '1 scheduled, 1 in progress' }),
        U.kpi({ label: 'Marks pending entry', value: 32, tone: 'critical', foot: 'Science Term 3 · Grade 5' }),
        U.kpi({ label: 'Awaiting moderation', value: 3, tone: 'warning', foot: 'Grade 10 mocks' }),
        U.kpi({ label: 'Completed this term', value: 18, tone: 'teal' })
      ]) +
      '<div class="mt-4">' + U.card({
        title: 'Assessment register', flush: true,
        body: U.table({
          cols: [
            { key: 'name', label: 'Assessment', render: function (r) { return '<span class="t-bold">' + esc(r.name) + '</span><div class="t-micro t-muted">' + esc(r.id + ' · ' + r.subject) + '</div>'; } },
            { key: 'grade', label: 'Grade' }, { key: 'date', label: 'Date' },
            { key: 'max', label: 'Max', cls: 'num' },
            { key: 'entered', label: 'Marks entered', render: function (r) {
              return U.meter({ label: '', value: r.entered / r.of * 100, right: r.entered + '/' + r.of, tone: r.entered === r.of ? 'teal' : r.entered ? 'amber' : 'critical' });
            } },
            { key: 'status', label: 'Status', render: function (r) { return U.status(r.status); } },
            { key: 'a', label: '', sortable: false, cls: 'num', render: function (r) {
              return U.btn(r.entered === r.of ? 'View' : 'Enter marks', { size: 'sm', variant: r.entered === r.of ? 'ghost' : 'primary', action: 'assess-marks', arg: r.id });
            } }
          ],
          rows: AC.assessments
        })
      }) + '</div>' +
      '<div class="grid g-2col g-4 mt-4">' +
      U.card({ title: 'Grade distribution', sub: 'Grade 5 — Term 3 English Reading', body: C.bar({
        labels: ['A+', 'A', 'B+', 'B', 'C', 'D'], series: [{ name: 'Students', values: [8, 21, 27, 24, 12, 4],
        colors: ['var(--teal)', 'var(--teal)', 'var(--navy)', 'var(--navy)', 'var(--amber)', 'var(--critical)'] }], height: 220 }) }) +
      U.card({ title: 'Moderation', sub: 'Marker consistency check across three markers', body:
        '<div class="col g-4">' +
        U.meter({ label: 'Marker A — Ms. Lalitha R.', value: 74, right: 'mean 74.2', tone: 'teal' }) +
        U.meter({ label: 'Marker B — Ms. Priya R.', value: 71, right: 'mean 71.0', tone: 'teal' }) +
        U.meter({ label: 'Marker C — Mr. Ganesh V.', value: 66, right: 'mean 65.8', tone: 'amber' }) +
        '</div>' + '<div class="mt-4">' + U.banner('Marker C is 5.4 marks below the cohort mean. 12 scripts have been pulled for a second read before grades are calculated.', 'warning', 'alert') + '</div>' }) +
      '</div>'
    );
  });
  HS.on('assess-create', function () {
    U.modal({
      title: 'Create assessment', size: 'wide',
      body: '<div class="grid g-2col g-3">' +
        U.field({ label: 'Assessment name', value: 'Term 3 Mathematics — Fractions' }) +
        U.field({ type: 'select', label: 'Subject', options: ['Mathematics', 'English', 'Science', 'Tamil', 'Social Studies'] }) +
        U.field({ type: 'select', label: 'Grade', options: ['Grade 5', 'Grade 6', 'Grade 7', 'Grade 9', 'Grade 10'] }) +
        U.field({ label: 'Date', type: 'date', value: '2026-09-22' }) +
        U.field({ label: 'Maximum marks', type: 'number', value: '50' }) +
        U.field({ type: 'select', label: 'Weighting', options: ['Term assessment (40%)', 'Unit test (15%)', 'Formative (0%)'] }) +
        '</div>' +
        '<div class="mt-4">' + U.banner('Questions can be drawn from the approved question bank, or drafted by the AI Co-Pilot and reviewed before use.', 'neutral', 'sparkle') + '</div>',
      foot: U.btn('Cancel', { action: 'close-overlay' }) + U.btn('Create', { variant: 'primary', action: 'demo-close' })
    });
  });
  HS.on('assess-marks', function (id) {
    var a = AC.assessments.filter(function (x) { return x.id === id; })[0];
    U.modal({
      title: 'Marks entry', sub: a.name + ' · out of ' + a.max, size: 'wide',
      body: U.table({ compact: true, stack: false, cols: [
        { key: 'roll', label: 'Roll', width: '60px' },
        { key: 'name', label: 'Student' },
        { key: 'mark', label: 'Mark', cls: 'num', render: function (r) {
          return '<input class="input t-num" style="width:80px;text-align:right" type="number" max="' + a.max + '" value="' + (r.mark != null ? r.mark : '') + '" aria-label="Mark for ' + esc(r.name) + '">';
        } },
        { key: 'grade', label: 'Grade', render: function (r) { return r.mark == null ? '<span class="t-faint">—</span>' : U.badge(r.mark >= 45 ? 'A+' : r.mark >= 40 ? 'A' : r.mark >= 33 ? 'B' : 'C', r.mark >= 40 ? 'success' : 'neutral'); } }
      ], rows: D.attendance.classRoster.slice(0, 8).map(function (s, i) {
        return { roll: s.roll, name: s.name, mark: i < 5 ? [42, 38, 47, 31, 44][i] : null };
      }) }) +
      '<div class="mt-3">' + U.banner('Marks are saved as you type and locked once moderation begins.', 'neutral', 'save') + '</div>',
      foot: U.btn('Close', { action: 'close-overlay' }) +
        U.btn('Save and send for moderation', { variant: 'primary', action: 'demo-close' })
    });
  });

  /* ====================================================== REPORT CARDS === */
  HS.route('report-cards', function () {
    var v = HS.vs('rc', { open: null });
    return U.page(
      U.pageHead({
        title: 'Report Cards',
        sub: 'Marks → Moderation → AI draft comments → Teacher review → Approval → Parent release. Nothing reaches a parent without a named approval.',
        actions: U.btn('Report template', { icon: 'layers', action: 'not-built', arg: 'Report card template' }) +
          U.btn('Release approved', { variant: 'primary', icon: 'send', action: 'demo', arg: 'Approved report cards released to parents' })
      }) +
      U.card({ body: U.flow(AC.reportCardStages.map(function (s, i) {
        var counts = ['5 classes', '1 class', '1 class', '1 class', '1 class', '1 class'];
        return { label: s, meta: counts[i], state: i < 2 ? 'done' : i === 2 ? 'active' : '' };
      })) }) +
      '<div class="mt-4">' + U.card({ flush: true, body: U.table({
        cols: [
          { key: 'grade', label: 'Class', render: function (r) { return '<span class="t-bold">' + esc(r.grade) + '</span>'; } },
          { key: 'students', label: 'Students', cls: 'num' },
          { key: 'stage', label: 'Progress', render: function (r) { return U.stepper(['Marks', 'Mod.', 'AI', 'Review', 'Approve', 'Release'], r.stage); } },
          { key: 'status', label: 'Status', render: function (r) { return U.badge(r.status, r.stage >= 5 ? 'success' : r.stage >= 4 ? 'info' : 'warning'); } },
          { key: 'due', label: 'Due' },
          { key: 'a', label: '', sortable: false, cls: 'num', render: function (r) { return U.btn('Open', { size: 'sm', action: 'rc-open', arg: r.grade }); } }
        ],
        rows: AC.reportCards
      }) }) + '</div>'
    );
  });
  HS.on('rc-open', function (grade) {
    U.modal({
      title: 'Report card review — ' + grade, sub: 'Aditya Kumar · Grade 5A · Term 3', size: 'full',
      body: '<div class="grid g-2col g-5">' +
        '<div>' + U.card({ title: 'Marks and grades', tight: true, flush: true, body: U.table({ compact: true, stack: false, cols: [
          { key: 'name', label: 'Subject' }, { key: 'score', label: 'Mark', cls: 'num' },
          { key: 'grade', label: 'Grade', render: function (r) { return U.badge(r.grade, r.score >= 80 ? 'success' : 'neutral'); } },
          { key: 'target', label: 'Target', cls: 'num' }
        ], rows: D.student360['HS-2026-1041'].subjects }) }) + '</div>' +
        '<div class="col g-4">' +
        '<section class="ai-card"><div class="ai-card__head"><span class="ai-badge">' + HS.icon('sparkle', 12) + 'AI draft comment</span>' +
        U.badge('Not published', 'warning') + '</div><div class="card__body">' +
        '<p class="t-sm">Aditya has had a strong term. He is most confident when a task has a practical, building element — the applied measurement work lifted his Mathematics by six marks. His Tamil remains his strongest subject. Social Studies has slipped slightly; the weekly reading support started in August is the right response and should be continued next term. He works well with others and took a visible lead in the house assembly.</p>' +
        '<div class="mt-3">' + U.aiNotice('Generated from six assessments, four teacher observations and two behaviour notes. Edit freely — your version is what a parent sees.') + '</div>' +
        '<div class="mt-3">' + U.field({ type: 'textarea', label: 'Teacher edit', rows: 4, value: '' , placeholder: 'Adjust the wording, or write your own.' }) + '</div>' +
        '<div class="row g-2 mt-3">' + U.btn('Regenerate', { size: 'sm', icon: 'refresh', action: 'demo', arg: 'New draft generated' }) +
        U.btn('Approve comment', { size: 'sm', variant: 'teal', icon: 'check', action: 'demo', arg: 'Comment approved by Ms. Priya Raghavan' }) + '</div>' +
        '</div></section>' +
        U.card({ title: 'Release', tight: true, body: U.flow([
          { label: 'Teacher review', meta: 'You are here', state: 'active' },
          { label: 'Section head approval', meta: 'Next' },
          { label: 'Parent release', meta: 'Visible in Parent 360' }
        ]) }) +
        '</div></div>',
      foot: U.btn('Close', { action: 'close-overlay' }) +
        U.btn('Send for approval', { variant: 'primary', icon: 'send', action: 'demo-close' })
    });
  });

  /* ======================================================== HOMEWORK ===== */
  HS.route('homework', function () {
    return U.page(
      U.pageHead({ title: 'Homework', sub: 'Set, tracked and visible to parents in the same place the child sees it.',
        actions: U.btn('Set homework', { variant: 'primary', icon: 'plus', action: 'not-built', arg: 'Set homework' }) }) +
      U.grid('g-4col', [
        U.kpi({ label: 'Open assignments', value: 4, tone: '' }),
        U.kpi({ label: 'Average submission', value: '54%', tone: 'amber', foot: 'Across open assignments' }),
        U.kpi({ label: 'Overdue', value: 2, tone: 'critical', foot: 'Tamil and English' }),
        U.kpi({ label: 'Students below 50%', value: 7, tone: 'critical', route: '#/early-warning' })
      ]) +
      '<div class="mt-4">' + U.card({ flush: true, body: U.table({
        cols: [
          { key: 'title', label: 'Assignment', render: function (r) { return '<span class="t-bold">' + esc(r.title) + '</span><div class="t-micro t-muted">' + esc(r.subject + ' · ' + r.grade) + '</div>'; } },
          { key: 'due', label: 'Due' },
          { key: 'submitted', label: 'Submitted', render: function (r) {
            return U.meter({ label: '', value: r.submitted / r.of * 100, right: r.submitted + '/' + r.of, tone: r.submitted / r.of > .8 ? 'teal' : r.submitted / r.of > .5 ? 'amber' : 'critical' });
          } },
          { key: 'status', label: 'Status', render: function (r) { return U.badge(r.status, r.status === 'Open' ? 'info' : 'warning'); } },
          { key: 'a', label: '', sortable: false, cls: 'num', render: function () {
            return U.btn('Remind', { size: 'sm', icon: 'message', action: 'demo', arg: 'Reminder drafted for parents of students who have not submitted' });
          } }
        ],
        rows: AC.homework
      }) }) + '</div>'
    );
  });

  /* ==================================================== QUESTION BANK ==== */
  HS.route('question-bank', function () {
    return U.page(
      U.pageHead({ title: 'Question Bank', sub: 'Approved questions, tagged to Cambridge objectives and reused across assessments.',
        actions: U.btn('Add question', { variant: 'primary', icon: 'plus', action: 'not-built', arg: 'Add question' }) }) +
      U.card({ flush: true, body: U.table({
        cols: [
          { key: 'topic', label: 'Topic', render: function (r) { return '<span class="t-bold">' + esc(r.topic) + '</span>'; } },
          { key: 'subject', label: 'Subject' }, { key: 'stage', label: 'Stage' },
          { key: 'items', label: 'Questions', cls: 'num' },
          { key: 'used', label: 'Used in assessments', cls: 'num' },
          { key: 'difficulty', label: 'Difficulty', render: function (r) { return U.badge(r.difficulty, r.difficulty === 'Higher' ? 'warning' : 'neutral'); } },
          { key: 'a', label: '', sortable: false, cls: 'num', render: function () { return U.btn('Browse', { size: 'sm', action: 'not-built', arg: 'Question browser' }); } }
        ],
        rows: AC.questionBank
      }) })
    );
  });

  /* ================================================ CLASSES / SUBJECTS === */
  HS.route('classes', function () {
    var classes = [];
    ['Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10'].forEach(function (g, gi) {
      ['A', 'B', 'C'].forEach(function (s, si) {
        if (gi > 5 && si > 1) return;
        classes.push({
          name: g + s, students: 28 + ((gi * 3 + si * 5) % 7), teacher: ['Ms. Priya R.', 'Mr. Ganesh V.', 'Ms. Anitha D.', 'Ms. Lalitha R.', 'Mr. Sathish K.'][(gi + si) % 5],
          room: 'R-' + (100 + gi * 10 + si), attendance: 88 + ((gi * 2 + si) % 10), marked: (gi + si) % 5 !== 0
        });
      });
    });
    return U.page(
      U.pageHead({ title: 'Classes', sub: classes.length + ' sections across the campus, each with a class teacher and a home room.' }) +
      U.card({ flush: true, body: U.table({
        rowAction: 'demo', rowId: function (r) { return r.name + ' opened'; },
        cols: [
          { key: 'name', label: 'Class', render: function (r) { return '<span class="t-bold">' + esc(r.name) + '</span>'; } },
          { key: 'students', label: 'Students', cls: 'num' },
          { key: 'teacher', label: 'Class teacher', render: function (r) { return U.person(r.teacher, ''); } },
          { key: 'room', label: 'Room' },
          { key: 'attendance', label: 'Attendance today', render: function (r) { return U.meter({ label: '', value: r.attendance, right: r.attendance + '%', tone: r.attendance < 90 ? 'amber' : 'teal' }); } },
          { key: 'marked', label: 'Register', render: function (r) { return U.badge(r.marked ? 'Marked' : 'Not marked', r.marked ? 'success' : 'critical'); } }
        ],
        rows: classes
      }) })
    );
  });

  HS.route('subjects', function () {
    var rows = [
      { subject: 'English', stages: 'Primary → A Level', teachers: 14, classes: 38, avg: 74, coverage: 78 },
      { subject: 'Mathematics', stages: 'Primary → A Level', teachers: 16, classes: 38, avg: 69, coverage: 71 },
      { subject: 'Science / Combined', stages: 'Primary → IGCSE', teachers: 12, classes: 32, avg: 72, coverage: 74 },
      { subject: 'Physics', stages: 'IGCSE → A Level', teachers: 4, classes: 9, avg: 68, coverage: 66 },
      { subject: 'Chemistry', stages: 'IGCSE → A Level', teachers: 4, classes: 9, avg: 70, coverage: 64 },
      { subject: 'Biology', stages: 'IGCSE → A Level', teachers: 3, classes: 8, avg: 75, coverage: 69 },
      { subject: 'Tamil', stages: 'Primary → Lower Secondary', teachers: 8, classes: 26, avg: 79, coverage: 82 },
      { subject: 'Social Studies', stages: 'Primary → Lower Secondary', teachers: 7, classes: 26, avg: 68, coverage: 64 },
      { subject: 'Computing', stages: 'Primary → IGCSE', teachers: 5, classes: 22, avg: 77, coverage: 69 },
      { subject: 'Business Studies', stages: 'IGCSE → A Level', teachers: 3, classes: 6, avg: 71, coverage: 61 }
    ];
    return U.page(
      U.pageHead({ title: 'Subjects', sub: 'Subject configuration across stages, with staffing and performance in one view.' }) +
      U.card({ flush: true, body: U.table({
        cols: [
          { key: 'subject', label: 'Subject', render: function (r) { return '<span class="t-bold">' + esc(r.subject) + '</span><div class="t-micro t-muted">' + esc(r.stages) + '</div>'; } },
          { key: 'teachers', label: 'Teachers', cls: 'num' }, { key: 'classes', label: 'Classes', cls: 'num' },
          { key: 'avg', label: 'Average', cls: 'num', render: function (r) { return '<span class="t-num t-bold">' + r.avg + '</span>'; } },
          { key: 'coverage', label: 'Objective coverage', render: function (r) { return U.meter({ label: '', value: r.coverage, right: r.coverage + '%', tone: r.coverage >= 70 ? 'teal' : 'amber' }); } }
        ],
        rows: rows
      }) })
    );
  });

  HS.route('lesson-plans', function () {
    return U.page(
      U.pageHead({ title: 'Lesson Plans', sub: 'Planned, approved and delivered. Drafts from the Co-Pilot arrive here for review.',
        actions: (HS.can('#/copilot') ? U.btn('Draft with Co-Pilot', { variant: 'amber', icon: 'sparkle', route: '#/copilot' }) : '') }) +
      U.grid('g-4col', [
        U.kpi({ label: 'Plans this week', value: 186, tone: '' }),
        U.kpi({ label: 'Approved', value: 171, unit: '92%', tone: 'teal' }),
        U.kpi({ label: 'Awaiting review', value: 15, tone: 'amber' }),
        U.kpi({ label: 'AI-assisted', value: '64%', tone: 'info', foot: 'All reviewed by a teacher' })
      ]) +
      '<div class="mt-4">' + U.card({ flush: true, body: U.table({
        cols: [
          { key: 'title', label: 'Lesson', render: function (r) { return '<span class="t-bold">' + esc(r.title) + '</span><div class="t-micro t-muted">' + esc(r.objective) + '</div>'; } },
          { key: 'cls', label: 'Class' }, { key: 'teacher', label: 'Teacher' }, { key: 'date', label: 'Date' },
          { key: 'origin', label: 'Origin', render: function (r) { return U.badge(r.origin, r.origin === 'AI draft' ? 'warning' : 'neutral', { icon: r.origin === 'AI draft' ? 'sparkle' : null }); } },
          { key: 'status', label: 'Status', render: function (r) { return U.status(r.status); } }
        ],
        rows: [
          { title: 'Comparing and ordering fractions', objective: '6Nf.05', cls: 'Grade 6B', teacher: 'Ms. Priya R.', date: '17 Sep', origin: 'AI draft', status: 'Approved' },
          { title: 'States of matter — evaporation', objective: '5Sc.02', cls: 'Grade 5A', teacher: 'Mr. Ganesh V.', date: '17 Sep', origin: 'Teacher', status: 'Approved' },
          { title: 'Narrative comprehension', objective: '5Er.01', cls: 'Grade 5A', teacher: 'Ms. Lalitha R.', date: '18 Sep', origin: 'AI draft', status: 'Under Review' },
          { title: 'Forces and motion — practical', objective: 'P2.1', cls: 'Grade 10A', teacher: 'Mr. Sathish K.', date: '18 Sep', origin: 'Teacher', status: 'Draft' }
        ]
      }) }) + '</div>'
    );
  });
})(window.HS = window.HS || {});
