/* ==========================================================================
   VIEWS — Teacher Dashboard, One-Tap Attendance, AI Teacher Co-Pilot,
           Staff Self-Service
   ========================================================================== */
(function (HS) {
  'use strict';
  var U = HS.ui, D = HS.data, C = HS.charts, esc = HS.esc;

  /* ============================================== TEACHER DASHBOARD ====== */
  HS.route('teacher', function () {
    var T = D.teacher;
    var hour = new Date().getHours();
    var greet = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

    return U.page(
      '<div class="pagehead"><div class="grow">' +
      '<h1 class="display">' + esc(greet) + ', ' + esc(T.name.split(' ').slice(0, 2).join(' ')) + '</h1>' +
      '<p class="lede mt-2">Four classes today. One is waiting on attendance.</p></div>' +
      '<div class="pagehead__actions">' +
      U.btn('Mark attendance', { variant: 'primary', icon: 'checkSquare', route: '#/attendance' }) +
      U.btn('AI Co-Pilot', { variant: 'amber', icon: 'sparkle', route: '#/copilot' }) +
      '</div></div>' +

      U.grid('g-4col', [
        U.kpi({ label: 'My classes', value: T.classes.length, tone: '', foot: '126 students in total', route: '#/classes' }),
        U.kpi({ label: 'Attendance to mark', value: 2, tone: 'critical', foot: 'Grade 5A and 6C', route: '#/attendance' }),
        U.kpi({ label: 'Marks pending', value: 32, tone: 'amber', foot: 'Science Term 3', route: '#/assessments' }),
        U.kpi({ label: 'Students to watch', value: T.watchlist.length, tone: 'info', foot: 'Flagged this week', route: '#/early-warning' })
      ]) +

      '<div class="grid g-main mt-5">' +
      '<div class="col g-4">' +
      U.card({
        title: 'My classes', flush: true,
        body: '<div class="rule-list">' + T.classes.map(function (c) {
          var tone = c.attendance === 'Marked' ? 'success' : c.attendance === 'Pending' ? 'warning' : c.attendance === 'Not marked' ? 'critical' : 'neutral';
          return '<button class="row g-4 hoverable" style="width:100%;padding:14px 20px;text-align:left" data-route="#/attendance?class=' + encodeURIComponent(c.name) + '">' +
            '<span class="avatar avatar--lg none" style="border-radius:var(--r-md)">' + esc(c.name.replace('Grade ', 'G')) + '</span>' +
            '<span class="col grow"><span class="t-sm t-bold">' + esc(c.name) + ' · ' + esc(c.subject) + '</span>' +
            '<span class="t-micro t-muted">' + c.students + ' students · next ' + esc(c.next) + '</span></span>' +
            U.badge(c.attendance, tone, { dot: true }) + HS.icon('chevronRight', 15) + '</button>';
        }).join('') + '</div>'
      }) +
      U.card({
        title: 'Today\'s timetable', sub: 'Thursday 16 September',
        flush: true,
        body: '<div class="rule-list">' + T.today.map(function (p) {
          return '<div class="row g-4' + (p.state === 'now' ? '' : ' hoverable') + '" style="padding:12px 20px;' + (p.state === 'now' ? 'background:var(--info-tint)' : '') + '">' +
            '<span class="t-xs t-num t-muted none" style="width:76px">' + esc(p.period) + '</span>' +
            '<span class="col grow"><span class="t-sm' + (p.state === 'now' ? ' t-bold' : '') + '">' + esc(p.what) + '</span>' +
            '<span class="t-micro t-muted">' + esc(p.where) + '</span></span>' +
            (p.state === 'now' ? U.badge('Now', 'info', { dot: true }) : '') + '</div>';
        }).join('') + '</div>'
      }) +
      '</div>' +
      '<div class="col g-4">' +
      U.card({
        title: 'Students requiring attention', sub: 'Click any name to open Student 360',
        flush: true,
        body: '<div>' + T.watchlist.map(function (w) {
          return U.alertItem({ tone: w.tone, icon: 'user', title: w.name, meta: w.reason, action: 'open-student', arg: w.id });
        }).join('') + '</div>',
        foot: 'Signals are advisory. You decide whether they need action.'
      }) +
      U.card({
        title: 'Pending tasks', flush: true,
        body: '<div class="rule-list">' + T.tasks.map(function (t) {
          return '<button class="row g-3 hoverable" style="width:100%;padding:12px 20px;text-align:left" data-route="' + esc(t.route) + '">' +
            HS.icon('checkSquare', 16, 't-muted') +
            '<span class="col grow"><span class="t-sm">' + esc(t.title) + '</span>' +
            '<span class="t-micro t-muted">' + esc(t.module) + '</span></span>' +
            U.badge(t.due, t.due === 'Today' ? 'warning' : 'neutral') + '</button>';
        }).join('') + '</div>'
      }) +
      U.card({
        title: 'Homework status', sub: 'Grade 5A', flush: true,
        body: '<div class="card__body">' + D.academics.homework.map(function (h) {
          return '<div class="mb-4">' + U.meter({
            label: h.subject + ' — due ' + h.due, value: Math.round(h.submitted / h.of * 100),
            right: h.submitted + '/' + h.of, tone: h.submitted / h.of > .8 ? 'teal' : h.submitted / h.of > .5 ? 'amber' : 'critical'
          }) + '</div>';
        }).join('') + '</div>'
      }) +
      '</div></div>'
    );
  });

  /* ================================================ ONE-TAP ATTENDANCE === */
  HS.route('attendance', function (params) {
    var v = HS.vs('att', { cls: params['class'] || 'Grade 5A', marks: null, saved: false, view: 'mark' });
    if (!v.marks) {
      v.marks = {};
      D.attendance.classRoster.forEach(function (s) { v.marks[s.id] = s.status; });
    }
    var counts = { present: 0, absent: 0, late: 0 };
    Object.keys(v.marks).forEach(function (k) { counts[v.marks[k]]++; });
    var total = D.attendance.classRoster.length;

    if (v.view === 'analytics') return attendanceAnalytics(v);

    var roster = D.attendance.classRoster.map(function (s) {
      var m = v.marks[s.id];
      return '<div class="row g-3" style="padding:10px 16px;border-bottom:1px solid var(--border-soft)">' +
        '<span class="t-micro t-muted t-num none" style="width:22px">' + s.roll + '</span>' +
        '<button class="person person--link grow" data-action="open-student" data-arg="' + esc(s.id) + '" style="min-width:0">' +
        U.avatar(s.name, { size: 'sm' }) + '<span class="col" style="min-width:0"><span class="person__name t-clip">' + esc(s.name) + '</span>' +
        '<span class="person__meta">' + esc(s.id) + '</span></span></button>' +
        '<div class="btn-group none">' +
        ['present', 'late', 'absent'].map(function (st) {
          return '<button aria-pressed="' + (m === st) + '" data-action="att-mark" data-arg="' + s.id + '|' + st + '" ' +
            'style="' + (m === st ? 'background:' + (st === 'present' ? 'var(--teal)' : st === 'late' ? 'var(--amber)' : 'var(--critical)') + ';color:#fff' : '') + '">' +
            HS.t(st.charAt(0).toUpperCase() + st.slice(1)) + '</button>';
        }).join('') + '</div></div>';
    }).join('');

    return U.page(
      U.pageHead({
        title: 'Attendance',
        sub: 'One tap per student, offline-capable. Absences notify parents automatically and feed the Early Warning check.',
        actions: U.segment([{ id: 'mark', label: 'Mark attendance' }, { id: 'analytics', label: 'Analytics' }], v.view, 'att-view') +
          U.btn('Attendance automation', { icon: 'zap', action: 'att-automation' })
      }) +
      (v.saved ? '<div class="mb-4">' + U.banner('<strong>' + HS.t('Attendance saved') + ' ✓</strong> ' + counts.absent + ' absence alerts and ' + counts.late +
        ' late notices were sent to parents on WhatsApp. Patterns have been checked against Early Warning thresholds.', 'success', 'check') + '</div>' : '') +

      '<div class="grid g-main">' +
      U.card({
        title: v.cls + ' · Mathematics',
        sub: 'Period 1 · 08:20–09:00 · Room R-204 · ' + total + ' students',
        actions: U.field({ type: 'select', value: v.cls, options: D.teacher.classes.map(function (c) { return c.name; }), action: 'att-class' }),
        flush: true,
        body: '<div class="toolbar">' +
          U.btn('Mark all present', { size: 'sm', variant: 'teal', icon: 'check', action: 'att-all', arg: 'present' }) +
          U.btn('Reset', { size: 'sm', action: 'att-all', arg: 'reset' }) +
          '<div class="spacer"></div>' +
          '<span class="row g-3 t-xs t-num">' +
          '<span class="row g-1"><span class="dot dot--success"></span>' + counts.present + '</span>' +
          '<span class="row g-1"><span class="dot dot--warning"></span>' + counts.late + '</span>' +
          '<span class="row g-1"><span class="dot dot--critical"></span>' + counts.absent + '</span>' +
          '</span></div>' +
          '<div>' + roster + '</div>' +
          '<div class="card__foot row between wrap g-3">' +
          '<span class="row g-2">' + HS.icon('refresh', 14) + 'Works offline — syncs when the connection returns.</span>' +
          U.btn(HS.t('Mark Attendance') + ' (' + total + ')', { variant: 'primary', icon: 'check', action: 'att-save' }) +
          '</div>'
      }) +
      '<div class="col g-4">' +
      U.card({
        title: 'What happens on submit',
        body: U.timeline([
          { time: 'Immediately', title: 'Attendance saved', body: 'Recorded against the period, the class and each student profile.', tone: 'teal' },
          { time: '+ seconds', title: 'Absent students identified', body: counts.absent + ' students marked absent, ' + counts.late + ' late.', tone: 'critical' },
          { time: '+ 1 minute', title: 'WhatsApp parent alert', body: 'Sent in the parent\'s preferred language. Delivery is tracked.', tone: 'amber' },
          { time: '+ 5 minutes', title: 'Pattern analysed', body: 'Consecutive absences and day-of-week patterns checked.', tone: 'info' },
          { time: 'If threshold met', title: 'Early Warning signal raised', body: 'Sent to you for review. Never applied to the student automatically.', tone: 'critical' },
          { time: 'After your action', title: 'Recorded in Student 360', body: 'The intervention and its outcome live on the student profile.', tone: 'muted' }
        ])
      }) +
      U.card({
        title: 'Today across the school', sub: 'Live figures',
        body: '<div class="col g-3">' +
          U.meter({ label: 'Sections marked', value: 92, right: '35 of 38', tone: 'teal' }) +
          U.meter({ label: 'Present', value: 91.7, right: HS.fmt.n(D.attendance.today.present), tone: 'teal' }) +
          U.meter({ label: 'Absent', value: 5.5, right: String(D.attendance.today.absent), tone: 'critical' }) +
          U.meter({ label: 'Late', value: 2.8, right: String(D.attendance.today.late), tone: 'amber' }) +
          '</div>' +
          '<div class="mt-4">' + U.btn('Open attendance analytics', { block: true, action: 'att-view', arg: 'analytics', iconRight: 'arrowRight' }) + '</div>'
      }) +
      '</div></div>'
    );
  });

  function attendanceAnalytics(v) {
    var a = D.attendance;
    return U.page(
      U.pageHead({
        title: 'Attendance analytics',
        sub: 'Campus, class, trend, late arrivals and absence patterns.',
        actions: U.segment([{ id: 'mark', label: 'Mark attendance' }, { id: 'analytics', label: 'Analytics' }], v.view, 'att-view')
      }) +
      U.grid('g-4col', [
        U.kpi({ label: 'Campus attendance', value: '91.7%', tone: 'teal', delta: -1.4, foot: 'Against 93% expectation' }),
        U.kpi({ label: 'Absent today', value: a.today.absent, tone: 'critical', foot: 'All parents notified' }),
        U.kpi({ label: 'Late today', value: a.today.late, tone: 'amber', foot: '19 linked to Route 4' }),
        U.kpi({ label: 'Repeat absentees', value: 12, tone: 'critical', foot: '3+ consecutive days', route: '#/early-warning' })
      ]) +
      '<div class="grid g-2col g-4 mt-4">' +
      U.card({ title: 'Attendance trend', sub: 'Last ten school days', body: C.line({ labels: a.trend.labels, series: [{ name: 'Attendance', values: a.trend.values, color: 'var(--teal)' }], yMin: 85, yMax: 100, unit: '%', height: 220 }) }) +
      U.card({ title: 'Class-wise attendance', sub: 'Below 90% needs a conversation', body: C.bar({ labels: a.byGrade.labels, series: [{ name: 'Present %', values: a.byGrade.present, colors: a.byGrade.present.map(function (p) { return p < 90 ? 'var(--critical)' : p < 93 ? 'var(--amber)' : 'var(--teal)'; }) }], yMax: 100, target: 93, targetLabel: 'Target', height: 220 }) }) +
      U.card({ title: 'Late arrivals by time', sub: 'Gate scans, this week', body: C.bar({ labels: a.lateByHour.labels, series: [{ name: 'Students', values: a.lateByHour.values, color: 'var(--navy)' }], height: 220 }) }) +
      U.card({ title: 'Absence patterns', sub: 'What the pattern check found', body: C.hbar({ rows: a.patterns.map(function (p) { return { label: p.label, value: p.value, display: p.value + ' · ' + p.note }; }), labelW: 180, rowH: 36 }) }) +
      '</div>'
    );
  }

  HS.on('att-view', function (arg) { HS.vs('att').view = arg; HS.render(); });
  HS.on('att-class', function (a, el) { var v = HS.vs('att'); v.cls = el.value; v.saved = false; HS.render(); });
  HS.on('att-mark', function (arg) {
    var p = arg.split('|'), v = HS.vs('att');
    v.marks[p[0]] = p[1]; v.saved = false;
    HS.render();
  });
  HS.on('att-all', function (arg) {
    var v = HS.vs('att');
    D.attendance.classRoster.forEach(function (s) { v.marks[s.id] = arg === 'reset' ? s.status : arg; });
    v.saved = false; HS.render();
  });
  HS.on('att-save', function () {
    var v = HS.vs('att');
    v.saved = true; HS.render();
    U.toast(HS.t('Attendance saved') + ' ✓', 'success', 'check');
  });
  HS.on('att-automation', function () {
    var f = D.automations[0];
    U.modal({
      title: f.title, size: 'wide',
      body: U.stepperFlowHTML ? '' : '<div class="col g-2">' + f.steps.map(function (s, i) {
        return '<div class="row g-3"><span class="stepper__num" style="background:var(--navy);color:#fff">' + (i + 1) + '</span>' +
          '<span class="t-sm t-bold grow">' + esc(s) + '</span>' + (i < f.steps.length - 1 ? HS.icon('arrowDown', 14, 't-faint') : HS.icon('check', 14)) + '</div>';
      }).join('') + '</div>',
      foot: (HS.state.role === 'management'
        ? U.btn('See all automations', { route: '#/automations', action: 'close-overlay' }) : '') +
        U.btn('Close', { variant: 'primary', action: 'close-overlay' })
    });
  });

  /* ================================================ AI TEACHER CO-PILOT == */
  HS.route('copilot', function () {
    var v = HS.vs('copilot', { action: null, generated: false, grade: 'Grade 6', subject: 'Mathematics', topic: 'Fractions', approved: false });
    var L = D.ai.lessonDraft;

    var picker = U.card({
      title: 'What do you need?',
      sub: 'Pick a task. The Co-Pilot drafts it from your class data and the approved curriculum.',
      body: '<div class="grid g-3col">' + D.ai.copilotActions.map(function (a) {
        var on = v.action === a.id;
        return '<button class="card card--link ' + (on ? '' : '') + '" style="padding:16px;text-align:left;' + (on ? 'border-color:var(--navy);box-shadow:inset 0 0 0 1px var(--navy)' : '') + '" data-action="copilot-pick" data-arg="' + a.id + '">' +
          '<span class="row g-3"><span class="avatar avatar--amber none">' + HS.icon(a.icon, 17) + '</span>' +
          '<span class="col grow"><span class="t-sm t-bold">' + esc(a.label) + '</span>' +
          '<span class="t-micro t-muted">' + esc(a.desc) + '</span></span></span></button>';
      }).join('') + '</div>'
    });

    var setup = v.action ? U.card({
      title: 'Context',
      sub: 'The Co-Pilot only uses this class, this curriculum and the approved question bank.',
      actions: U.btn(v.generated ? 'Regenerate' : 'Generate draft', { variant: 'amber', icon: 'sparkle', action: 'copilot-generate' }),
      body: '<div class="grid g-4col g-3">' +
        U.field({ type: 'select', label: 'Grade', value: v.grade, options: ['Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'], action: 'copilot-grade' }) +
        U.field({ type: 'select', label: 'Subject', value: v.subject, options: ['Mathematics', 'English', 'Science', 'Social Studies'], action: 'copilot-subject' }) +
        U.field({ type: 'select', label: 'Topic', value: v.topic, options: ['Fractions', 'Decimals', 'Area and perimeter', 'Data handling'], action: 'copilot-topic' }) +
        U.field({ type: 'select', label: 'Lesson length', value: '40 minutes', options: ['40 minutes', '60 minutes', 'Double period'] }) +
        '</div>' +
        '<div class="mt-3">' + U.banner('Cambridge objective <strong>6Nf.05</strong> will be used. Class average on the last fractions assessment was 69, with 11 students below 60.', 'neutral', 'target') + '</div>'
    }) : '';

    var output = '';
    if (v.generated) {
      output = '<section class="ai-card mt-4">' +
        '<div class="ai-card__head"><span class="ai-badge">' + HS.icon('sparkle', 12) + 'AI draft</span>' +
        '<span class="t-sm t-bold grow">' + esc(L.title) + '</span>' +
        (v.approved ? U.badge('Approved and published', 'success', { icon: 'check' }) : U.badge('Draft — not published', 'warning')) + '</div>' +
        '<div class="card__body">' +
        U.aiNotice('<strong>Nothing is published automatically.</strong> Read it, edit anything, then approve. Your name is recorded as the approver.') +

        '<div class="mt-5"><div class="eyebrow mb-2">Learning objective</div><p class="t-sm">' + esc(L.objective) + '</p></div>' +

        '<div class="mt-5"><div class="eyebrow mb-3">Lesson plan</div>' +
        U.table({
          compact: true,
          cols: [{ key: 'time', label: 'Time', width: '92px' }, { key: 'step', label: 'Step', render: function (r) { return '<span class="t-bold">' + esc(r.step) + '</span>'; } }, { key: 'detail', label: 'Detail' }],
          rows: L.plan
        }) + '</div>' +

        '<div class="grid g-2col g-5 mt-5">' +
        '<div><div class="eyebrow mb-2">Activities</div><ul class="col g-2">' + L.activities.map(function (a) {
          return '<li class="row g-2 t-sm">' + HS.icon('check', 14, 't-success') + esc(a) + '</li>';
        }).join('') + '</ul></div>' +
        '<div><div class="eyebrow mb-2">Differentiated exercises</div><div class="col g-2">' + L.differentiated.map(function (d) {
          return '<div class="row-top g-3">' + U.badge(d.level, d.level === 'Foundation' ? 'info' : d.level === 'Core' ? 'neutral' : 'success') +
            '<span class="t-sm grow">' + esc(d.detail) + '</span></div>';
        }).join('') + '</div></div></div>' +

        '<div class="mt-5"><div class="eyebrow mb-3">Quiz</div>' +
        '<div class="col g-2">' + L.quiz.map(function (q, i) {
          return '<div class="card card--tint row g-3" style="padding:12px 14px"><span class="t-bold t-muted none">' + (i + 1) + '.</span>' +
            '<span class="t-sm grow">' + esc(q.q) + '</span>' + U.badge(q.marks + ' marks', 'neutral') + '</div>';
        }).join('') + '</div></div>' +

        '<div class="mt-5"><div class="eyebrow mb-2">Homework</div><p class="t-sm">' + esc(L.homework) + '</p></div>' +

        '<div class="divider"></div>' +
        '<div class="row between wrap g-3">' +
        U.stepper(['Review', 'Edit', 'Approve'], v.approved ? 3 : 0) +
        '<div class="row g-2">' +
        U.btn('Edit', { icon: 'edit', action: 'not-built', arg: 'Inline editor' }) +
        U.btn('Discard', { action: 'copilot-discard' }) +
        U.btn(v.approved ? 'Approved' : 'Approve and publish', { variant: v.approved ? 'teal' : 'primary', icon: 'check', action: 'copilot-approve', disabled: v.approved }) +
        '</div></div>' +
        '</div></section>';
    }

    return U.page(
      U.pageHead({
        title: 'AI Teacher Co-Pilot',
        sub: 'Drafts the routine work so teaching time goes to teaching. Every output is reviewed, edited and approved by a named teacher before it reaches a student or a parent.',
        actions: U.btn('Approval policy', { icon: 'shield', action: 'show-approval-flow' }) +
          U.btn('History', { icon: 'clock', action: 'not-built', arg: 'Co-Pilot history' })
      }) +
      picker +
      (setup ? '<div class="mt-4">' + setup + '</div>' : '') +
      output +
      (!v.action ? '<div class="mt-4">' + U.card({
        title: 'Recent drafts', flush: true,
        body: U.table({
          cols: [
            { key: 'what', label: 'Draft' }, { key: 'cls', label: 'Class' },
            { key: 'by', label: 'Approved by' }, { key: 'when', label: 'When' },
            { key: 'status', label: 'Status', render: function (r) { return U.status(r.status); } }
          ],
          rows: [
            { what: 'Lesson plan — Fractions, equivalence', cls: 'Grade 6B', by: 'Ms. Priya Raghavan', when: 'Yesterday 16:12', status: 'Approved' },
            { what: 'Worksheet — States of matter', cls: 'Grade 5A', by: 'Mr. Ganesh Venkat', when: '14 Sep', status: 'Approved' },
            { what: 'Report comments — 32 students', cls: 'Grade 5A', by: '—', when: '13 Sep', status: 'Under Review' },
            { what: 'Parent message — homework reminder', cls: 'Grade 6C', by: '—', when: '12 Sep', status: 'Draft' },
            { what: 'Quiz — Forces and motion', cls: 'Grade 10A', by: 'Mr. Sathish Kumar', when: '10 Sep', status: 'Approved' }
          ]
        })
      }) + '</div>' : '')
    );
  });
  HS.on('copilot-pick', function (arg) { var v = HS.vs('copilot'); v.action = arg; v.generated = false; v.approved = false; HS.render(); });
  HS.on('copilot-grade', function (a, el) { HS.vs('copilot').grade = el.value; HS.render(); });
  HS.on('copilot-subject', function (a, el) { HS.vs('copilot').subject = el.value; HS.render(); });
  HS.on('copilot-topic', function (a, el) { HS.vs('copilot').topic = el.value; HS.render(); });
  HS.on('copilot-generate', function () {
    var v = HS.vs('copilot'); v.generated = true; v.approved = false; HS.render();
    U.toast('Draft generated — review before publishing', 'warning', 'sparkle');
  });
  HS.on('copilot-discard', function () { var v = HS.vs('copilot'); v.generated = false; HS.render(); U.toast('Draft discarded', 'warning'); });
  HS.on('copilot-approve', function () {
    var v = HS.vs('copilot'); v.approved = true; HS.render();
    U.toast('Approved by Ms. Priya Raghavan — published to Grade 6', 'success', 'check');
  });

  /* ============================================== STAFF SELF-SERVICE ===== */
  HS.route('staff-self', function () {
    var e = D.workforce.employees.filter(function (x) { return x.id === 'EMP-2015'; })[0];
    return U.page(
      '<div class="pagehead"><div class="grow"><h1 class="display">Good Morning, Murugan</h1>' +
      '<p class="lede mt-2">Split shift today. Two buses need a fitness check before Friday.</p></div>' +
      '<div class="pagehead__actions">' + U.btn('Apply for leave', { variant: 'primary', icon: 'calendar', action: 'staff-leave' }) + '</div></div>' +
      U.grid('g-4col', [
        U.kpi({ label: 'Shift today', value: 'Split', unit: '06:00–10:00 / 14:00–18:00', tone: '', foot: 'Clocked in at 05:52' }),
        U.kpi({ label: 'Leave balance', value: e.leaveBal, unit: 'days', tone: 'teal', foot: 'Of 18 days this year' }),
        U.kpi({ label: 'Overtime this month', value: e.overtime, unit: 'hours', tone: 'amber', foot: 'Pending approval' }),
        U.kpi({ label: 'Last payslip', value: '₹38,420', tone: 'info', foot: 'August 2026 — see below' })
      ]) +
      '<div class="grid g-main mt-4">' +
      U.card({
        title: 'My roster this week', flush: true,
        body: U.table({
          cols: [{ key: 'day', label: 'Day' }, { key: 'shift', label: 'Shift' }, { key: 'duty', label: 'Duty' },
                 { key: 'status', label: 'Status', render: function (r) { return U.status(r.status); } }],
          rows: [
            { day: 'Monday', shift: '06:00–10:00 / 14:00–18:00', duty: 'Route supervision', status: 'Completed' },
            { day: 'Tuesday', shift: '06:00–10:00 / 14:00–18:00', duty: 'Route supervision', status: 'Completed' },
            { day: 'Wednesday', shift: '06:00–10:00 / 14:00–18:00', duty: 'Depot inspection', status: 'Completed' },
            { day: 'Thursday', shift: '06:00–10:00 / 14:00–18:00', duty: 'Route supervision', status: 'Present' },
            { day: 'Friday', shift: '06:00–10:00 / 14:00–18:00', duty: 'Vehicle fitness — Bus 4, Bus 15', status: 'Scheduled' },
            { day: 'Saturday', shift: 'Off', duty: '—', status: 'Leave' }
          ]
        })
      }) +
      '<div class="col g-4">' +
      U.card({
        title: 'My requests', flush: true,
        body: '<div>' + [
          { t: 'Casual leave — 19 Sep', s: 'Approved', tone: 'success' },
          { t: 'Overtime claim — 14 hours', s: 'Under Review', tone: 'warning' },
          { t: 'Expense EXP-2211 — AC servicing', s: 'Under Review', tone: 'warning' },
          { t: 'Uniform allowance', s: 'Approved', tone: 'success' }
        ].map(function (r) {
          return U.alertItem({ tone: r.tone, icon: 'fileText', title: r.t, meta: r.s, right: U.status(r.s), action: 'demo', arg: 'Request opened' });
        }).join('') + '</div>'
      }) +
      U.card({
        title: 'Payslips', flush: true,
        body: U.table({ compact: true, cols: [
          { key: 'm', label: 'Month' }, { key: 'net', label: 'Net pay', cls: 'num' },
          { key: 'a', label: '', sortable: false, cls: 'num', render: function () { return U.btn('Download', { size: 'sm', icon: 'download', action: 'demo', arg: 'Payslip downloaded' }); } }
        ], rows: [{ m: 'August 2026', net: '₹38,420' }, { m: 'July 2026', net: '₹37,980' }, { m: 'June 2026', net: '₹37,980' }] })
      }) +
      '</div></div>'
    );
  });
  HS.on('staff-leave', function () {
    U.modal({
      title: 'Apply for leave',
      body: '<div class="grid g-2col g-3">' +
        U.field({ type: 'select', label: 'Leave type', options: ['Casual leave', 'Sick leave', 'Earned leave', 'Compensatory off'] }) +
        U.field({ type: 'select', label: 'Cover arrangement', options: ['Team rota', 'Named colleague', 'Not required'] }) +
        U.field({ label: 'From', type: 'date', value: '2026-09-21' }) +
        U.field({ label: 'To', type: 'date', value: '2026-09-21' }) +
        '</div>' + '<div class="mt-3">' + U.field({ type: 'textarea', label: 'Reason', rows: 3 }) + '</div>' +
        '<div class="mt-3">' + U.flow([{ label: 'Draft', state: 'active' }, { label: 'Submitted' }, { label: 'Under Review' }, { label: 'Approved / Rejected' }]) + '</div>',
      foot: U.btn('Cancel', { action: 'close-overlay' }) + U.btn('Submit request', { variant: 'primary', action: 'demo-close' })
    });
  });
  HS.on('demo-close', function () { U.closeOverlay(); U.toast('Request submitted — awaiting review', 'success', 'check'); });
})(window.HS = window.HS || {});
