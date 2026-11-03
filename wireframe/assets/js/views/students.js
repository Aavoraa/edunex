/* ==========================================================================
   VIEWS — Students, Student 360, Early Warning, Talent, Wellbeing, Portfolio
   ========================================================================== */
(function (HS) {
  'use strict';
  var U = HS.ui, D = HS.data, C = HS.charts, esc = HS.esc;

  /* Universal rule: a student is always clickable and always opens Student 360 */
  HS.on('open-student', function (id) { HS.go('#/student-360?id=' + encodeURIComponent(id)); });

  function studentLink(s, meta) {
    return '<span class="person person--link" data-action="open-student" data-arg="' + esc(s.id) + '">' +
      U.avatar(s.name, { size: 'sm' }) +
      '<span class="col" style="min-width:0"><span class="person__name t-clip">' + esc(s.name) + '</span>' +
      '<span class="person__meta t-clip">' + esc(meta || (s.grade + s.section + ' · ' + s.id)) + '</span></span></span>';
  }
  HS.studentLink = studentLink;

  function trendCell(v) {
    var tone = v > 2 ? 'success' : v < -3 ? 'critical' : v < 0 ? 'warning' : 'neutral';
    return '<span class="row g-2"><span class="t-num t-bold t-' + (tone === 'neutral' ? 'muted' : tone) + '">' +
      (v > 0 ? '+' : '') + v + '</span>' + HS.icon(v >= 0 ? 'arrowUp' : 'arrowDown', 12) + '</span>';
  }

  /* ======================================================== STUDENTS ====== */
  HS.route('students', function (params) {
    var v = HS.vs('students', { q: '', grade: 'All', risk: params.risk || 'All', sort: { key: 'name', dir: 'asc' }, sel: {} });
    if (params.risk && params.risk !== v.risk) v.risk = params.risk;

    var rows = D.students.filter(function (s) {
      if (HS.state.scope === 'campus' && s.campus !== HS.state.campus) return false;
      if (v.grade !== 'All' && s.grade !== v.grade) return false;
      if (v.risk !== 'All' && s.risk !== v.risk) return false;
      if (v.q && (s.name + ' ' + s.id + ' ' + s.parent).toLowerCase().indexOf(v.q.toLowerCase()) === -1) return false;
      return true;
    }).sort(function (a, b) {
      var k = v.sort.key, d = v.sort.dir === 'asc' ? 1 : -1;
      return (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0) * d;
    });

    var selCount = Object.keys(v.sel).filter(function (k) { return v.sel[k]; }).length;
    var grades = ['All'].concat(D.students.map(function (s) { return s.grade; }).filter(function (g, i, a) { return a.indexOf(g) === i; }).sort());

    return U.page(
      U.pageHead({
        title: 'Students',
        sub: 'The student register. Every row opens the same Student 360 profile used everywhere else in the system.',
        actions: U.btn('Import', { icon: 'upload', action: 'not-built', arg: 'Bulk student import' }) +
          U.btn('Export', { icon: 'download', action: 'demo', arg: 'Export queued — CSV will download when ready' }) +
          U.btn('Add student', { variant: 'primary', icon: 'plus', action: 'not-built', arg: 'Add student' })
      }) +
      '<div class="filterbar">' +
        U.search('Search name, admission ID or parent', 'students-q', v.q) +
        U.field({ type: 'select', label: 'Grade', value: v.grade, options: grades, action: 'students-grade' }) +
        U.field({ type: 'select', label: 'Risk band', value: v.risk, options: ['All', 'On Track', 'Developing Risk', 'At Risk'], action: 'students-risk' }) +
        '<div class="spacer"></div>' +
        '<span class="t-sm t-muted t-num">' + rows.length + ' of ' + D.students.length + ' students</span>' +
      '</div>' +
      U.card({
        flush: true,
        body: (selCount ? '<div class="bulkbar">' + HS.icon('checkSquare', 16) +
          '<strong>' + selCount + ' selected</strong>' +
          '<div class="spacer"></div>' +
          U.btn('Message parents', { size: 'sm', icon: 'message', action: 'demo', arg: 'Message drafted for ' + selCount + ' parents — needs approval before sending' }) +
          U.btn('Add to intervention', { size: 'sm', icon: 'flag', action: 'demo', arg: 'Added to review queue' }) +
          U.btn('Clear', { size: 'sm', action: 'students-clear-sel' }) + '</div>' : '') +
          U.table({
            sortAction: 'students-sort', sort: v.sort, select: 'students-select',
            rowAction: 'open-student', rowId: function (r) { return r.id; },
            isSelected: function (r) { return !!v.sel[r.id]; },
            cols: [
              { key: 'name', label: 'Student', render: function (r) { return studentLink(r); } },
              { key: 'grade', label: 'Grade', render: function (r) { return esc(r.grade + ' ' + r.section); } },
              { key: 'house', label: 'House' },
              { key: 'today', label: 'Today', render: function (r) { return U.badge(r.today, HS.statusTone(r.today), { dot: true }); } },
              { key: 'attendance', label: 'Attendance', cls: 'num', render: function (r) {
                return '<span class="t-num t-bold ' + (r.attendance < 85 ? 't-critical' : r.attendance < 90 ? 't-warning' : '') + '">' + r.attendance + '%</span>';
              } },
              { key: 'average', label: 'Average', cls: 'num', render: function (r) { return '<span class="t-num">' + r.average + '</span>'; } },
              { key: 'trend', label: 'Trend', render: function (r) { return trendCell(r.trend); } },
              { key: 'risk', label: 'Risk', render: function (r) { return U.badge(r.risk, HS.riskTone(r.risk), { dot: true }); } },
              { key: 'feeStatus', label: 'Fees', render: function (r) { return U.status(r.feeStatus); } },
              { key: 'bus', label: 'Transport', render: function (r) { return '<span class="t-xs t-muted">' + esc(r.bus) + '</span>'; } }
            ],
            rows: rows
          })
      })
    );
  });
  HS.on('students-q', function (a, el) { HS.vs('students').q = el.value; HS.render(); });
  HS.on('students-grade', function (a, el) { HS.vs('students').grade = el.value; HS.render(); });
  HS.on('students-risk', function (a, el) { HS.vs('students').risk = el.value; HS.render(); });
  HS.on('students-sort', function (key) {
    var v = HS.vs('students');
    v.sort = { key: key, dir: v.sort.key === key && v.sort.dir === 'asc' ? 'desc' : 'asc' };
    HS.render();
  });
  HS.on('students-select', function (arg, el) {
    var v = HS.vs('students');
    if (arg === 'all') {
      var on = el.checked;
      D.students.forEach(function (s) { v.sel[s.id] = on; });
    } else v.sel[arg] = el.checked;
    HS.render();
  });
  HS.on('students-clear-sel', function () { HS.vs('students').sel = {}; HS.render(); });

  /* ===================================================== STUDENT 360 ====== */
  HS.route('student-360', function (params) {
    var s = D.studentById(params.id || 'HS-2026-1041');
    var d = D.student360['HS-2026-1041'];
    var v = HS.vs('s360', { tab: params.tab || 'overview' });
    var tabs = ['Overview', 'Academics', 'Attendance', 'Skills', 'Activities', 'Behaviour', 'Wellbeing', 'Achievements', 'Portfolio', 'Interventions', 'Documents'];

    var profile = '<section class="card card--pad">' +
      '<div class="row-top g-5 wrap">' +
      '<div class="row-top g-4 grow" style="min-width:300px">' +
      '<span class="avatar avatar--xl ' + HS.toneFor(s.name) + '">' + esc(HS.fmt.initials(s.name)) + '</span>' +
      '<div class="grow">' +
      '<div class="row g-3 wrap"><h1 class="h1">' + esc(s.name) + '</h1>' +
      U.badge(s.risk, HS.riskTone(s.risk), { dot: true, lg: true }) +
      U.badge(s.today, HS.statusTone(s.today), { lg: true }) + '</div>' +
      '<p class="t-sm t-muted mt-2">' + esc(s.id) + ' · ' + esc(s.grade + ' ' + s.section) + ' · ' + esc(s.house) + ' House · ' +
      esc((D.campuses.filter(function (c) { return c.id === s.campus; })[0] || {}).name || '') + '</p>' +
      '<div class="row g-2 wrap mt-3">' +
      U.btn('Message parent', { size: 'sm', icon: 'message', action: 'demo', arg: 'Message to ' + s.parent + ' drafted — needs approval before sending' }) +
      U.btn('Open intervention', { size: 'sm', icon: 'flag', action: 'open-intervention', arg: s.id }) +
      U.btn('Print profile', { size: 'sm', icon: 'printer', action: 'demo', arg: 'Profile sent to printer' }) +
      '</div></div></div>' +
      '<div class="none" style="min-width:300px;flex:1">' +
      U.dl([
        ['Parent', s.parent + ' · ' + s.parentPhone],
        ['Emergency', d.emergency],
        ['Class teacher', d.classTeacher],
        ['Transport', s.bus],
        ['Attendance', s.attendance + '% this term'],
        ['Academic standing', s.average + ' average · ' + (s.trend >= 0 ? '+' : '') + s.trend + ' trend'],
        ['Fees', s.feeStatus === 'Paid' ? 'Cleared for this term' : s.feeStatus + ' — ₹22,000 due 10 Oct']
      ]) + '</div></div></section>';

    var body;
    if (v.tab === 'overview') body = overview(s, d);
    else if (v.tab === 'academics') body = academicsTab(s, d);
    else if (v.tab === 'attendance') body = attendanceTab(s, d);
    else if (v.tab === 'skills') body = skillsTab(s, d);
    else if (v.tab === 'activities') body = activitiesTab(d);
    else if (v.tab === 'behaviour') body = behaviourTab(d);
    else if (v.tab === 'wellbeing') body = wellbeingTab(d);
    else if (v.tab === 'achievements') body = achievementsTab(d);
    else if (v.tab === 'portfolio') body = portfolioTab(s, d);
    else if (v.tab === 'interventions') body = interventionsTab(s, d);
    else body = documentsTab(d);

    return U.page(
      '<div class="breadcrumb"><button data-route="#/students">Students</button>' + HS.icon('chevronRight', 12) + '<span>Student 360</span></div>' +
      profile +
      '<div class="card mt-4" style="padding:0 var(--s-2)">' +
        U.tabs(tabs.map(function (x) { return { id: x.toLowerCase(), label: x }; }), v.tab, 's360-tab') + '</div>' +
      '<div class="mt-4">' + body + '</div>'
    );
  });
  HS.on('s360-tab', function (arg) { HS.vs('s360').tab = arg; HS.render(); });

  function overview(s, d) {
    return '<div class="grid g-main">' +
      '<div class="col g-4">' +
      U.grid('g-4col', [
        U.kpi({ label: 'Academic average', value: s.average, unit: '/100', tone: 'teal', delta: s.trend, foot: 'Across 6 subjects' }),
        U.kpi({ label: 'Attendance', value: s.attendance + '%', tone: '', foot: '4 absences this term' }),
        U.kpi({ label: 'Skills index', value: 79, unit: '/100', tone: 'amber', foot: 'Creativity strongest' }),
        U.kpi({ label: 'Achievements', value: d.achievements.length, tone: 'info', foot: '1 district-level' })
      ]) +
      U.card({
        title: 'Growth timeline',
        sub: 'Admission → assessments → activities → achievements → interventions → certifications → competitions',
        actions: U.btn('Add entry', { size: 'sm', icon: 'plus', action: 'not-built', arg: 'Add timeline entry' }),
        body: U.timeline(d.growth)
      }) +
      U.card({
        title: 'Teacher observations',
        sub: 'Qualitative evidence recorded alongside the numbers',
        body: d.observations.map(function (o) {
          return '<div class="row-top g-3 mb-4">' + U.avatar(o.by, { size: 'sm' }) +
            '<div class="grow"><div class="row between wrap"><span class="t-sm t-bold">' + esc(o.by) + '<span class="t-muted t-semi"> · ' + esc(o.role) + '</span></span>' +
            '<span class="t-micro t-muted">' + esc(o.date) + '</span></div>' +
            '<p class="t-sm mt-2">' + esc(o.text) + '</p></div></div>';
        }).join('')
      }) +
      '</div>' +
      '<div class="col g-4">' +
      talentCard(d) +
      U.card({
        title: 'At a glance',
        body: '<div class="col g-4">' +
          U.meter({ label: 'Academic performance', value: s.average, right: s.average + '/100', tone: 'teal' }) +
          U.meter({ label: 'Attendance', value: s.attendance, right: s.attendance + '%', tone: '' }) +
          U.meter({ label: 'Skills development', value: 79, right: '79/100', tone: 'amber' }) +
          U.meter({ label: 'Activity participation', value: 86, right: '4 activities', tone: 'info' }) +
          U.meter({ label: 'Behaviour', value: 92, right: 'Positive', tone: 'teal' }) +
          U.meter({ label: 'Wellbeing', value: 88, right: d.wellbeing.mood, tone: 'teal' }) +
          U.meter({ label: 'Parent engagement', value: 86, right: 'High', tone: 'teal' }) +
          '</div>'
      }) +
      U.card({
        title: 'Open intervention',
        actions: U.badge('1 active', 'warning'),
        body: d.interventions.map(function (i) {
          return '<div><div class="t-sm t-bold">' + esc(i.signal) + '</div>' +
            '<div class="t-micro t-muted mt-1">' + esc(i.id + ' · opened ' + i.opened + ' · owner ' + i.owner) + '</div>' +
            '<div class="mt-3">' + U.stepper(D.earlyWarning.stages, 4) + '</div>' +
            '<div class="mt-3 t-sm">' + esc(i.action) + '</div>' +
            '<div class="t-micro t-muted mt-1">Next review ' + esc(i.next) + '</div></div>';
        }).join('')
      }) +
      '</div></div>';
  }

  function talentCard(d) {
    var v = HS.vs('s360', { openStrength: 'Creativity' });
    return '<section class="ai-card">' +
      '<div class="ai-card__head"><span class="ai-badge">' + HS.icon('sparkle', 12) + 'AI Talent Discovery</span>' +
      '<span class="t-xs t-muted grow">Potential strengths, with the evidence behind each</span></div>' +
      '<div class="card__body">' +
      '<div class="col g-2">' + d.talent.strengths.map(function (st) {
        var open = v.openStrength === st.name;
        return '<div class="card" style="border-radius:var(--r-md)">' +
          '<button class="row g-3 hoverable" style="width:100%;padding:10px 12px;text-align:left;border-radius:var(--r-md)" data-action="s360-strength" data-arg="' + esc(st.name) + '" aria-expanded="' + open + '">' +
          '<span class="none">' + C.ring(st.score, { size: 38, stroke: 4, fontSize: 10, color: st.score >= 80 ? 'var(--teal)' : st.score >= 70 ? 'var(--amber)' : 'var(--neutral)' }) + '</span>' +
          '<span class="col grow"><span class="t-sm t-bold">' + esc(st.name) + '</span>' +
          '<span class="t-micro t-muted">' + esc(st.confidence) + ' confidence · ' + st.evidence.length + ' pieces of evidence</span></span>' +
          HS.icon(open ? 'chevronUp' : 'chevronDown', 15) + '</button>' +
          (open ? '<div style="padding:0 12px 12px 12px"><div class="evidence">' +
            st.evidence.map(function (e) { return '<div class="evidence__item">' + HS.icon('check', 12) + ' ' + esc(e) + '</div>'; }).join('') +
            '</div></div>' : '') + '</div>';
      }).join('') + '</div>' +
      '<div class="mt-4">' + U.banner('<strong>Suggested next step.</strong> ' + esc(d.talent.suggestion), 'neutral', 'lightbulb') + '</div>' +
      '<div class="mt-3">' + U.aiNotice() + '</div>' +
      '<div class="row g-2 mt-3">' +
      U.btn('Accept suggestion', { size: 'sm', variant: 'teal', icon: 'check', action: 'demo', arg: 'Suggestion accepted and logged against the profile' }) +
      U.btn('Dismiss', { size: 'sm', action: 'demo', arg: 'Suggestion dismissed — reason recorded' }) +
      '</div></div></section>';
  }
  HS.on('s360-strength', function (arg) {
    var v = HS.vs('s360');
    v.openStrength = v.openStrength === arg ? null : arg;
    HS.render();
  });

  function academicsTab(s, d) {
    return '<div class="grid g-main"><div class="col g-4">' +
      U.card({
        title: 'Subject performance', sub: 'Current scores against personal targets',
        flush: true,
        body: U.table({
          cols: [
            { key: 'name', label: 'Subject', render: function (r) { return '<span class="t-bold">' + esc(r.name) + '</span><div class="t-micro t-muted">' + esc(r.teacher) + '</div>'; } },
            { key: 'score', label: 'Score', cls: 'num', render: function (r) { return '<span class="t-num t-bold">' + r.score + '</span>'; } },
            { key: 'grade', label: 'Grade', render: function (r) { return U.badge(r.grade, r.score >= 80 ? 'success' : r.score >= 70 ? 'info' : 'warning'); } },
            { key: 'trend', label: 'Trend', render: function (r) { return trendCell(r.trend); } },
            { key: 'target', label: 'Against target', render: function (r) {
              return U.meter({ label: '', value: Math.min(100, r.score / r.target * 100), right: r.score + ' / ' + r.target, tone: r.score >= r.target ? 'teal' : 'amber' });
            } }
          ],
          rows: d.subjects
        })
      }) +
      U.card({
        title: 'Performance trend', sub: 'Weighted average across terms',
        body: C.line({ labels: d.termTrend.labels, series: [{ name: 'Average', values: d.termTrend.values, color: 'var(--navy)' }], yMin: 50, yMax: 100, height: 210, label: 'Average across terms' })
      }) +
      '</div><div class="col g-4">' +
      U.card({
        title: 'Predicted grade', sub: 'Model output — advisory',
        body: '<div class="row center">' + C.gauge({ percent: 78, value: 'A', sub: 'Predicted end of year', color: 'var(--teal)' }) + '</div>' +
          '<div class="mt-3">' + U.aiNotice('<strong>Prediction, not a decision.</strong> Based on six data points across three terms. The class teacher confirms predicted grades before they are shared with parents.') + '</div>'
      }) +
      U.card({
        title: 'Learning gaps', sub: 'Cambridge objectives below mastery',
        body: D.academics.objectives.slice(0, 3).map(function (o) {
          return '<div class="mb-4"><div class="row between"><span class="t-sm t-bold">' + esc(o.code) + '</span>' + U.badge(o.mastery + '% mastery', o.mastery >= 75 ? 'success' : 'warning') + '</div>' +
            '<div class="t-xs t-muted mt-1">' + esc(o.text) + '</div></div>';
        }).join('') +
          (HS.can('#/copilot') ? U.btn('Generate practice with Co-Pilot', { size: 'sm', variant: 'amber', icon: 'sparkle', block: true, route: '#/copilot' }) : '')
      }) +
      '</div></div>';
  }

  function attendanceTab(s, d) {
    var cal = [];
    for (var i = 1; i <= 30; i++) {
      var r = (i * 7) % 11;
      cal.push({ d: i, st: r === 3 ? 'absent' : r === 5 ? 'late' : (i % 7 === 0 || i % 7 === 6) ? 'off' : 'present' });
    }
    return '<div class="grid g-main"><div class="col g-4">' +
      U.card({
        title: 'Monthly attendance', sub: 'Percentage present per month this academic year',
        body: C.bar({ labels: d.attendanceMonths.labels, series: [{ name: 'Attendance %', values: d.attendanceMonths.values, color: 'var(--teal)' }], yMax: 100, target: 93, targetLabel: 'Expected 93%', height: 210 })
      }) +
      U.card({
        title: 'September 2026', sub: 'Daily record',
        body: '<div class="heat" style="grid-template-columns:repeat(15,1fr);max-width:520px">' + cal.map(function (c) {
          var col = { present: 'var(--teal)', late: 'var(--amber)', absent: 'var(--critical)', off: 'var(--border)' }[c.st];
          return '<div class="heat__cell" style="background:' + col + ';color:' + (c.st === 'off' ? 'var(--text-muted)' : '#fff') + '" title="' + c.d + ' Sep — ' + c.st + '">' + c.d + '</div>';
        }).join('') + '</div>' +
          '<div class="mt-4">' + C.legend([{ label: 'Present', color: 'var(--teal)' }, { label: 'Late', color: 'var(--amber)' }, { label: 'Absent', color: 'var(--critical)' }, { label: 'Non-school day', color: 'var(--border)' }]) + '</div>'
      }) +
      '</div><div class="col g-4">' +
      U.card({
        title: 'Absence record',
        flush: true,
        body: U.table({
          compact: true,
          cols: [{ key: 'date', label: 'Date' }, { key: 'type', label: 'Type', render: function (r) { return U.badge(r.type, r.type === 'Absent' ? 'critical' : 'warning'); } }, { key: 'reason', label: 'Reason' }],
          rows: [
            { date: '02 Sep 2026', type: 'Late', reason: 'Bus 12 delay — transport linked' },
            { date: '21 Aug 2026', type: 'Absent', reason: 'Medical — approved by parent request' },
            { date: '08 Aug 2026', type: 'Absent', reason: 'Family event — approved in advance' },
            { date: '17 Jul 2026', type: 'Late', reason: 'Not explained' }
          ]
        })
      }) +
      U.card({
        title: 'Automation record', sub: 'What the system did for each event',
        body: U.timeline([
          { time: '02 Sep 08:41', title: 'Late arrival recorded at gate', body: 'Parent notified on WhatsApp at 08:42.', tone: 'amber' },
          { time: '21 Aug 09:05', title: 'Absence marked by class teacher', body: 'Parent alert sent. Reason captured from the parent reply.', tone: 'critical' },
          { time: '21 Aug 09:20', title: 'Pattern check run', body: 'No Early Warning signal raised — isolated absence, attendance still 94%.', tone: 'muted' }
        ])
      }) +
      '</div></div>';
  }

  function skillsTab(s, d) {
    return '<div class="grid g-main"><div class="col g-4">' +
      U.card({
        title: 'Skills profile', sub: 'Built from assessments, activities, teacher observation and peer feedback',
        body: '<div class="row g-5 wrap center">' +
          '<div class="none">' + C.radar({ size: 262, axes: d.skills.map(function (k) { return k.name; }), series: [{ name: 'Current', values: d.skills.map(function (k) { return k.value; }), color: 'var(--teal)' }, { name: 'Cohort median', values: [72, 68, 70, 74, 76], color: 'var(--neutral)' }] }) + '</div>' +
          '<div class="grow col g-4" style="min-width:250px">' +
          d.skills.map(function (k) { return U.meter({ label: k.name, value: k.value, right: k.value + '/100', tone: k.value >= 80 ? 'teal' : k.value >= 70 ? 'info' : 'amber' }); }).join('') +
          '</div></div>' +
          '<div class="mt-4">' + C.legend([{ label: 'Aditya', color: 'var(--teal)' }, { label: 'Grade 5 median', color: 'var(--neutral)' }]) + '</div>'
      }) +
      '</div><div class="col g-4">' + talentCard(d) + '</div></div>';
  }

  function activitiesTab(d) {
    return U.card({
      title: 'Activities and participation', sub: 'Clubs, sport and elective engagement',
      flush: true,
      body: U.table({
        cols: [
          { key: 'name', label: 'Activity', render: function (r) { return '<span class="t-bold">' + esc(r.name) + '</span>'; } },
          { key: 'role', label: 'Role' }, { key: 'since', label: 'Since' },
          { key: 'hours', label: 'Logged hours', cls: 'num', render: function (r) { return '<span class="t-num">' + r.hours + ' h</span>'; } },
          { key: 'bar', label: 'Engagement', sortable: false, render: function (r) { return U.meter({ label: '', value: Math.min(100, r.hours * 1.4), right: r.hours > 40 ? 'High' : r.hours > 18 ? 'Steady' : 'Light', tone: 'teal' }); } }
        ],
        rows: d.activities
      })
    });
  }

  function behaviourTab(d) {
    return '<div class="grid g-main"><div>' +
      U.card({
        title: 'Behaviour record', sub: 'Positive notes and concerns, logged by staff',
        body: U.timeline(d.behaviour.map(function (b) {
          return { time: b.date + ' · ' + b.by, title: b.note, body: b.type, tone: b.tone === 'success' ? 'teal' : b.tone === 'caution' ? 'amber' : 'critical' };
        }))
      }) + '</div><div class="col g-4">' +
      U.card({
        title: 'Balance', body: '<div class="row center">' + C.donut({
          size: 150, thickness: 22, center: '2:1', centerSub: 'Positive to note',
          data: [{ label: 'Positive', value: 2, color: 'var(--teal)' }, { label: 'Note', value: 1, color: 'var(--amber)' }]
        }) + '</div>' + '<p class="t-xs t-muted mt-3">Behaviour is recorded as evidence, not as a score. No automatic labelling is applied.</p>'
      }) +
      U.card({ title: 'Record a note', body: U.field({ type: 'textarea', label: 'Observation', placeholder: 'What did you observe, and in what context?' }) + '<div class="row g-2 mt-3">' + U.btn('Save as positive', { variant: 'teal', size: 'sm', action: 'demo', arg: 'Positive note saved to the profile' }) + U.btn('Save as concern', { size: 'sm', action: 'demo', arg: 'Concern saved — section head notified' }) + '</div>' }) +
      '</div></div>';
  }

  function wellbeingTab(d) {
    var w = d.wellbeing;
    return '<div class="grid g-main"><div class="col g-4">' +
      U.grid('g-3col', [
        U.kpi({ label: 'Current state', value: w.mood, tone: 'teal', foot: 'Last check-in ' + w.lastCheckin }),
        U.kpi({ label: 'Infirmary visits', value: w.infirmary, tone: 'info', foot: 'This academic year' }),
        U.kpi({ label: 'Counselling sessions', value: w.counselling, tone: '', foot: 'None requested' })
      ]) +
      U.card({ title: 'Wellbeing notes', body: '<p class="t-sm">' + esc(w.notes) + '</p>' + '<div class="mt-4">' + U.banner('Wellbeing records are restricted. Only the class teacher, counsellor and Principal can open this tab.', 'neutral', 'lock') + '</div>' }) +
      U.card({
        title: 'Health record', flush: true,
        body: U.table({ compact: true, cols: [{ key: 'date', label: 'Date' }, { key: 'event', label: 'Event' }, { key: 'action', label: 'Action taken' }],
          rows: [{ date: '14 Aug 2026', event: 'Mild fever during games period', action: 'Rested, parent informed, returned next day' },
                 { date: '03 May 2026', event: 'Annual health screening', action: 'Vision and hearing normal. Height and weight in range.' }] })
      }) +
      '</div><div class="col g-4">' +
      U.card({ title: 'Safeguarding', body: U.banner('<strong>No safeguarding concerns recorded.</strong> Any concern would be logged the same day and reviewed by the Designated Safeguarding Lead within 24 hours.', 'success', 'shieldCheck') }) +
      U.card({ title: 'Request support', body: '<p class="t-sm t-muted">Staff can request a counsellor check-in without creating a formal record.</p>' + '<div class="mt-3">' + U.btn('Request counsellor check-in', { block: true, icon: 'heart', action: 'demo', arg: 'Check-in requested — counsellor notified' }) + '</div>' }) +
      '</div></div>';
  }

  function achievementsTab(d) {
    return U.card({
      title: 'Achievements', sub: 'Verified records that feed the portfolio and talent view',
      actions: U.btn('Add achievement', { size: 'sm', icon: 'plus', action: 'not-built', arg: 'Add achievement' }),
      body: '<div class="grid g-2col">' + d.achievements.map(function (a) {
        return '<div class="card card--tint" style="padding:16px">' +
          '<div class="row-top g-3"><span class="avatar avatar--amber none">' + HS.icon('award', 18) + '</span>' +
          '<div class="grow"><div class="t-sm t-bold">' + esc(a.title) + '</div>' +
          '<div class="t-micro t-muted mt-1">' + esc(a.date) + ' · ' + esc(a.type) + '</div>' +
          '<div class="mt-2">' + U.badge(a.verified ? 'Verified' : 'Unverified', a.verified ? 'success' : 'neutral', { icon: a.verified ? 'check' : null }) + '</div>' +
          '</div></div></div>';
      }).join('') + '</div>'
    });
  }

  function portfolioTab(s, d) {
    return '<div class="grid g-main"><div class="col g-4">' +
      U.card({
        title: 'Student portfolio', sub: 'A shareable record of work, projects and recognition',
        actions: U.btn('Export PDF', { size: 'sm', icon: 'download', action: 'demo', arg: 'Portfolio PDF generated' }) + U.btn('Share link', { size: 'sm', icon: 'link', action: 'not-built', arg: 'Portfolio sharing' }),
        body: '<div class="grid g-3col">' + [
          { t: 'Rainwater level sensor', m: 'Innovation Lab · prototype', i: 'rocket' },
          { t: 'Fractions investigation', m: 'Mathematics · Term 3', i: 'edit' },
          { t: 'Debate — Best Speaker', m: 'Co-curricular · Feb 2026', i: 'megaphone' },
          { t: 'Evaporation log', m: 'Science · Term 3', i: 'clipboard' },
          { t: 'House assembly script', m: 'English · Aug 2026', i: 'fileText' },
          { t: 'Football season record', m: 'Sport · 2 seasons', i: 'target' }
        ].map(function (x) {
          return '<div class="card card--link" style="padding:0;overflow:hidden" data-action="not-built" data-arg="Portfolio item">' +
            '<div style="height:96px;background:linear-gradient(135deg,#E8F0F6,#D9E7F1);display:grid;place-items:center;color:var(--navy-light)">' + HS.icon(x.i, 26) + '</div>' +
            '<div style="padding:12px"><div class="t-sm t-bold t-clip">' + esc(x.t) + '</div><div class="t-micro t-muted">' + esc(x.m) + '</div></div></div>';
        }).join('') + '</div>'
      }) +
      '</div><div class="col g-4">' +
      U.card({ title: 'Portfolio strength', body: '<div class="row center">' + C.gauge({ percent: 72, value: '72%', sub: 'Evidence completeness', color: 'var(--amber)' }) + '</div>' +
        '<div class="col g-3 mt-4">' + U.meter({ label: 'Academic work', value: 80, right: '4 items', tone: 'teal' }) +
        U.meter({ label: 'Projects', value: 65, right: '1 item', tone: 'amber' }) +
        U.meter({ label: 'Co-curricular', value: 90, right: '3 items', tone: 'teal' }) +
        U.meter({ label: 'Service and leadership', value: 40, right: '1 item', tone: 'critical' }) + '</div>' })
      + '</div></div>';
  }

  function interventionsTab(s, d) {
    return '<div class="col g-4">' +
      U.card({
        title: 'Intervention workflow', sub: 'Signal → Teacher Review → Intervention → Action → Follow-up → Closed',
        body: U.flow(D.earlyWarning.stages.map(function (st, i) {
          return { label: st, meta: i < 4 ? 'Completed' : i === 4 ? 'Current stage' : 'Pending', state: i < 4 ? 'done' : i === 4 ? 'active' : '' };
        }))
      }) +
      U.card({
        title: 'Open and past interventions', flush: true,
        body: U.table({
          cols: [
            { key: 'id', label: 'Reference' },
            { key: 'signal', label: 'Signal', render: function (r) { return '<span class="t-bold">' + esc(r.signal) + '</span>'; } },
            { key: 'action', label: 'Action taken' },
            { key: 'owner', label: 'Owner' },
            { key: 'stage', label: 'Stage', render: function (r) { return U.badge(r.stage, 'warning'); } },
            { key: 'next', label: 'Next review' }
          ],
          rows: d.interventions
        })
      }) +
      U.card({
        title: 'Record an action',
        body: '<div class="grid g-2col g-3">' +
          U.field({ type: 'select', label: 'Action type', options: ['Support session', 'Parent conversation', 'Seating or grouping change', 'Extra practice assigned', 'Referral to counsellor'] }) +
          U.field({ label: 'Next review date', type: 'date', value: '2026-09-20' }) +
          '</div>' + '<div class="mt-3">' + U.field({ type: 'textarea', label: 'What was done and what changed', placeholder: 'Keep it factual. This is visible to the section head and the Principal.' }) + '</div>' +
          '<div class="row g-2 mt-3">' + U.btn('Save action', { variant: 'primary', icon: 'save', action: 'demo', arg: 'Action recorded in Student 360' }) +
          U.btn('Close intervention', { variant: 'teal', icon: 'check', action: 'demo', arg: 'Intervention closed — outcome logged' }) + '</div>'
      }) + '</div>';
  }

  function documentsTab(d) {
    return U.card({
      title: 'Documents', sub: 'Student file — verification status is tracked per document',
      actions: U.btn('Upload', { size: 'sm', icon: 'upload', action: 'not-built', arg: 'Document upload' }),
      flush: true,
      body: U.table({
        cols: [
          { key: 'name', label: 'Document', render: function (r) { return '<span class="row g-3">' + HS.icon('fileText', 16, 't-muted') + '<span class="t-bold">' + esc(r.name) + '</span></span>'; } },
          { key: 'status', label: 'Status', render: function (r) { return U.status(r.status); } },
          { key: 'date', label: 'Recorded' },
          { key: 'a', label: '', sortable: false, cls: 'num', render: function () { return U.btn('View', { size: 'sm', action: 'not-built', arg: 'Document viewer' }); } }
        ],
        rows: d.documents
      })
    });
  }

  HS.on('open-intervention', function (id) {
    var s = D.studentById(id);
    U.modal({
      title: 'Open an intervention', sub: s.name + ' · ' + s.grade + s.section, size: 'wide',
      body: U.banner('An intervention is a supportive plan with a named owner and a review date. It is not a label on the student.', 'neutral', 'info') +
        '<div class="grid g-2col g-3 mt-4">' +
        U.field({ type: 'select', label: 'Signal', options: ['Attendance decline', 'Academic trend down', 'Participation change', 'Homework submission', 'Wellbeing concern'] }) +
        U.field({ type: 'select', label: 'Owner', options: ['Ms. Priya R.', 'Mr. Ganesh V.', 'Ms. Anitha D.', 'Ms. Deepa V. (Counsellor)'] }) +
        U.field({ type: 'select', label: 'Support type', options: ['Weekly check-in', 'Reading or maths support', 'Parent conversation', 'Counsellor referral'] }) +
        U.field({ label: 'First review date', type: 'date', value: '2026-09-30' }) +
        '</div>' +
        '<div class="mt-3">' + U.field({ type: 'textarea', label: 'Context', placeholder: 'What has been observed, and over what period?' }) + '</div>',
      foot: U.btn('Cancel', { action: 'close-overlay' }) +
        U.btn('Open intervention', { variant: 'primary', icon: 'flag', action: 'confirm-intervention' })
    });
  });
  HS.on('confirm-intervention', function () { U.closeOverlay(); U.toast('Intervention opened and assigned', 'success', 'flag'); });

  /* ==================================================== EARLY WARNING ===== */
  HS.route('early-warning', function () {
    var v = HS.vs('ew', { band: 'All', grade: 'All', intervention: 'All', sort: { key: 'attendance', dir: 'asc' } });
    var su = D.earlyWarning.summary;

    var rows = D.students.filter(function (s) {
      if (HS.state.scope === 'campus' && s.campus !== HS.state.campus) return false;
      if (s.risk === 'On Track' && v.band === 'All') return false;
      if (v.band !== 'All' && s.risk !== v.band) return false;
      if (v.grade !== 'All' && s.grade !== v.grade) return false;
      if (v.intervention !== 'All' && s.intervention !== v.intervention) return false;
      return true;
    }).sort(function (a, b) {
      var k = v.sort.key, d = v.sort.dir === 'asc' ? 1 : -1;
      return (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0) * d;
    });

    var grades = ['All'].concat(D.students.map(function (s) { return s.grade; }).filter(function (g, i, a) { return a.indexOf(g) === i; }).sort());

    return U.page(
      U.pageHead({
        title: 'Early Warning',
        sub: 'Early support, not automated labelling. A signal only becomes an intervention after a teacher reviews it.',
        actions: U.btn('Export review list', { icon: 'download', action: 'demo', arg: 'Review list exported' }) +
          U.btn('How this works', { icon: 'helpCircle', action: 'ew-explain' })
      }) +
      U.grid('g-3col', [
        U.kpi({ label: 'At Risk', value: su.atRisk, tone: 'critical', foot: 'Two or more indicators declining', action: 'ew-band', arg: 'At Risk' }),
        U.kpi({ label: 'Developing Risk', value: su.developing, tone: 'amber', foot: 'One indicator slipping', action: 'ew-band', arg: 'Developing Risk' }),
        U.kpi({ label: 'On Track', value: HS.fmt.n(su.onTrack), tone: 'teal', foot: 'No action needed', action: 'ew-band', arg: 'On Track' })
      ]) +
      '<div class="mt-4">' + U.card({
        title: 'Signal to closure',
        sub: su.open + ' interventions open · ' + su.closedThisTerm + ' closed this term · ' + su.reviewed + ' signals reviewed',
        body: U.flow(D.earlyWarning.stages.map(function (s, i) {
          var counts = [23, 18, 14, 11, 7, 58];
          return { label: s, meta: counts[i] + (i === 5 ? ' closed this term' : ' students'), state: i === 1 ? 'active' : i < 1 ? 'done' : '' };
        }))
      }) + '</div>' +
      '<div class="filterbar mt-4">' +
        U.field({ type: 'select', label: 'Campus', value: HS.state.scope === 'group' ? 'All campuses' : HS.campusObj().name, options: ['All campuses'].concat(D.campuses.map(function (c) { return c.name; })), action: 'not-built' }) +
        U.field({ type: 'select', label: 'Grade', value: v.grade, options: grades, action: 'ew-grade' }) +
        U.field({ type: 'select', label: 'Risk level', value: v.band, options: ['All', 'At Risk', 'Developing Risk', 'On Track'], action: 'ew-band-sel' }) +
        U.field({ type: 'select', label: 'Intervention', value: v.intervention, options: ['All', 'Active', 'Planned', 'Monitoring', '—'], action: 'ew-int' }) +
        '<div class="spacer"></div><span class="t-sm t-muted t-num">' + rows.length + ' students listed</span>' +
      '</div>' +
      U.card({
        flush: true,
        body: U.table({
          sortAction: 'ew-sort', sort: v.sort, rowAction: 'open-student', rowId: function (r) { return r.id; },
          cols: [
            { key: 'name', label: 'Student', render: function (r) { return studentLink(r); } },
            { key: 'grade', label: 'Grade', render: function (r) { return esc(r.grade + ' ' + r.section); } },
            { key: 'attendance', label: 'Attendance', cls: 'num', render: function (r) {
              return U.meter({ label: '', value: r.attendance, right: r.attendance + '%', tone: r.attendance < 85 ? 'critical' : r.attendance < 90 ? 'amber' : 'teal' });
            } },
            { key: 'trend', label: 'Academic trend', render: function (r) { return trendCell(r.trend) + '<div class="t-micro t-muted">avg ' + r.average + '</div>'; } },
            { key: 'risk', label: 'Risk', render: function (r) { return U.badge(r.risk, HS.riskTone(r.risk), { dot: true }); } },
            { key: 'intervention', label: 'Intervention', render: function (r) { return r.intervention === '—' ? '<span class="t-faint">—</span>' : U.badge(r.intervention, r.intervention === 'Active' ? 'info' : 'neutral'); } },
            { key: 'owner', label: 'Owner' },
            { key: 'act', label: '', sortable: false, cls: 'num', render: function (r) {
              return U.btn('Review', { size: 'sm', variant: 'ghost', action: 'ew-review', arg: r.id });
            } }
          ],
          rows: rows,
          emptyText: 'No students match these filters. Every student in this view is on track.'
        })
      }) +
      '<div class="mt-4">' + U.card({
        title: 'Signals awaiting review', sub: 'Raised by the system, not yet accepted by a teacher',
        flush: true,
        body: U.table({
          cols: [
            { key: 'student', label: 'Student', render: function (r) { return '<button class="t-bold t-info" data-action="open-student" data-arg="' + esc(r.sid) + '">' + esc(r.student) + '</button><div class="t-micro t-muted">' + esc(r.grade) + '</div>'; } },
            { key: 'signal', label: 'Signal' },
            { key: 'stage', label: 'Stage', render: function (r) { return U.stepper(['Signal', 'Review', 'Intervene', 'Act', 'Follow up', 'Close'], r.stage); } },
            { key: 'owner', label: 'Owner' },
            { key: 'raised', label: 'Raised' },
            { key: 'a', label: '', sortable: false, cls: 'num', render: function (r) {
              return '<div class="row g-2 end">' + U.btn('Accept', { size: 'sm', variant: 'teal', action: 'demo', arg: 'Signal ' + r.id + ' accepted — intervention opened' }) +
                U.btn('Dismiss', { size: 'sm', action: 'demo', arg: 'Signal ' + r.id + ' dismissed with a reason' }) + '</div>';
            } }
          ],
          rows: D.earlyWarning.signals
        })
      }) + '</div>'
    );
  });
  HS.on('ew-band', function (arg) { HS.vs('ew').band = arg; HS.render(); });
  HS.on('ew-band-sel', function (a, el) { HS.vs('ew').band = el.value; HS.render(); });
  HS.on('ew-grade', function (a, el) { HS.vs('ew').grade = el.value; HS.render(); });
  HS.on('ew-int', function (a, el) { HS.vs('ew').intervention = el.value; HS.render(); });
  HS.on('ew-sort', function (key) {
    var v = HS.vs('ew');
    v.sort = { key: key, dir: v.sort.key === key && v.sort.dir === 'asc' ? 'desc' : 'asc' };
    HS.render();
  });
  HS.on('ew-review', function (id) {
    var s = D.studentById(id);
    U.modal({
      title: 'Teacher review', sub: s.name + ' · ' + s.grade + s.section + ' · ' + s.id, size: 'wide',
      body: '<div class="grid g-2col g-4">' +
        '<div>' + U.card({ title: 'What the signal is', tight: true, body:
          U.dl([['Attendance', s.attendance + '% (threshold 90%)'], ['Academic trend', (s.trend >= 0 ? '+' : '') + s.trend + ' over two assessments'],
                ['Participation', s.trend < -5 ? 'Reduced in group work' : 'Unchanged'], ['Band', s.risk]]) }) + '</div>' +
        '<div>' + U.card({ title: 'What the teacher knows', tight: true, body:
          '<p class="t-sm t-muted">The system cannot see context. Record what you know before deciding.</p>' +
          '<div class="mt-3">' + U.field({ type: 'textarea', rows: 5, placeholder: 'For example: family travel in August, recovering from illness, settled again since.' }) + '</div>' }) + '</div>' +
        '</div>' +
        '<div class="mt-4">' + U.aiNotice('<strong>The system raised this, a person decides it.</strong> Accepting opens an intervention with an owner and a review date. Dismissing records your reason so the signal is not re-raised for the same cause.') + '</div>',
      foot: U.btn('Cancel', { action: 'close-overlay' }) +
        U.btn('Dismiss signal', { action: 'ew-dismiss' }) +
        U.btn('Accept and open intervention', { variant: 'primary', icon: 'flag', action: 'ew-accept' })
    });
  });
  HS.on('ew-accept', function () { U.closeOverlay(); U.toast('Intervention opened and owner notified', 'success', 'flag'); });
  HS.on('ew-dismiss', function () { U.closeOverlay(); U.toast('Signal dismissed — reason recorded in the audit trail', 'warning'); });
  HS.on('ew-explain', function () {
    U.modal({
      title: 'How Early Warning works', size: 'wide',
      body: '<p class="t-sm">Three things are watched continuously: attendance, academic trend and participation. When two or more move the wrong way over a sustained period, a signal is raised.</p>' +
        '<div class="mt-4">' + U.flow([
          { label: 'Signal', meta: 'System raises it', state: 'done' },
          { label: 'Teacher Review', meta: 'A person accepts or dismisses', state: 'active' },
          { label: 'Intervention', meta: 'Named owner, agreed support' },
          { label: 'Action', meta: 'What was actually done' },
          { label: 'Follow-up', meta: 'Did it change anything' },
          { label: 'Closed', meta: 'Outcome recorded' }
        ]) + '</div>' +
        '<div class="mt-4">' + U.banner('<strong>Students are not labelled.</strong> Risk bands are a working view for staff. They are never shown to students, never printed on reports, and never shared with other parents.', 'warning', 'shield') + '</div>',
      foot: U.btn('Close', { variant: 'primary', action: 'close-overlay' })
    });
  });

  /* ======================================================== TALENT ======== */
  HS.route('talent', function () {
    var d = D.student360['HS-2026-1041'];
    var cohort = [
      { skill: 'Communication', high: 148, emerging: 312 },
      { skill: 'Creativity', high: 206, emerging: 288 },
      { skill: 'Leadership', high: 94, emerging: 341 },
      { skill: 'Critical Thinking', high: 172, emerging: 302 },
      { skill: 'Collaboration', high: 231, emerging: 264 }
    ];
    return U.page(
      U.pageHead({
        title: 'Talent Discovery',
        sub: 'Where strengths are showing across the school, and which students have evidence that has not yet been acted on.',
        actions: U.btn('Methodology', { icon: 'helpCircle', action: 'ew-explain' })
      }) +
      U.card({ body: U.aiNotice('<strong>Advisory throughout.</strong> Talent signals surface evidence for a teacher to interpret. Nothing here selects, streams or excludes a student automatically.') }) +
      '<div class="grid g-main mt-4">' +
      U.card({
        title: 'Strength distribution', sub: 'Students with strong evidence, by skill',
        body: C.stacked({
          labels: cohort.map(function (c) { return c.skill.split(' ')[0]; }),
          series: [{ name: 'Strong evidence', values: cohort.map(function (c) { return c.high; }), color: 'var(--teal)' },
                   { name: 'Emerging', values: cohort.map(function (c) { return c.emerging; }), color: 'var(--border-strong)' }],
          height: 240
        }) + '<div class="mt-3">' + C.legend([{ label: 'Strong evidence', color: 'var(--teal)' }, { label: 'Emerging', color: 'var(--border-strong)' }]) + '</div>'
      }) +
      U.card({
        title: 'Unrecognised potential', sub: 'Strong evidence, no opportunity offered yet',
        flush: true,
        body: '<div>' + D.students.slice(3, 9).map(function (s) {
          return U.alertItem({
            tone: 'info', icon: 'sparkle', title: s.name + ' — ' + ['Creativity', 'Leadership', 'Critical Thinking', 'Communication', 'Collaboration', 'Creativity'][s.name.length % 6],
            meta: s.grade + s.section + ' · evidence from ' + (2 + (s.name.length % 3)) + ' sources', action: 'open-student', arg: s.id
          });
        }).join('') + '</div>'
      }) +
      '</div>' +
      '<div class="mt-4">' + U.card({
        title: 'Example: evidence behind a recommendation',
        sub: 'Aditya Kumar · Grade 5A — every strength links to the record that produced it',
        body: '<div class="grid g-2col g-4">' + d.talent.strengths.slice(0, 4).map(function (st) {
          return '<div class="card card--tint" style="padding:16px"><div class="row between"><span class="t-sm t-bold">' + esc(st.name) + '</span>' +
            U.badge(st.confidence + ' confidence', st.confidence === 'High' ? 'success' : st.confidence === 'Medium' ? 'info' : 'neutral') + '</div>' +
            '<div class="evidence mt-3">' + st.evidence.map(function (e) { return '<div class="evidence__item">' + esc(e) + '</div>'; }).join('') + '</div></div>';
        }).join('') + '</div>'
      }) + '</div>'
    );
  });

  /* ===================================== WELLBEING / PORTFOLIO / PERF ===== */
  HS.route('wellbeing', function () {
    return U.page(
      U.pageHead({ title: 'Behaviour & Wellbeing', sub: 'School-wide view. Individual records stay inside the restricted tab on each Student 360 profile.' }) +
      U.grid('g-4col', [
        U.kpi({ label: 'Positive notes this term', value: 1842, tone: 'teal', delta: 14 }),
        U.kpi({ label: 'Concerns logged', value: 63, tone: 'amber', delta: -8, inverse: true }),
        U.kpi({ label: 'Counselling sessions', value: 41, tone: 'info', foot: '11 students' }),
        U.kpi({ label: 'Safeguarding concerns', value: 2, tone: 'critical', foot: 'Both closed, reviewed within 24 h' })
      ]) +
      '<div class="grid g-main mt-4">' +
      U.card({
        title: 'Positive notes against concerns', sub: 'By grade, this term',
        body: C.stacked({
          labels: ['G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10'],
          series: [{ name: 'Positive', values: [268, 241, 254, 218, 196, 231, 212, 222], color: 'var(--teal)' },
                   { name: 'Concern', values: [4, 6, 7, 11, 14, 9, 7, 5], color: 'var(--amber)' }],
          height: 240
        })
      }) +
      U.card({
        title: 'Infirmary today', sub: HS.data.safety.infirmary.length + ' visits', flush: true,
        body: U.table({ compact: true, cols: [
          { key: 'student', label: 'Student', render: function (r) { return '<span class="t-bold">' + esc(r.student) + '</span><div class="t-micro t-muted">' + esc(r.grade) + '</div>'; } },
          { key: 'reason', label: 'Reason' },
          { key: 'status', label: 'Status', render: function (r) { return U.badge(r.status, r.status === 'Awaiting pickup' ? 'warning' : 'success'); } }
        ], rows: HS.data.safety.infirmary })
      }) + '</div>'
    );
  });

  HS.route('portfolio', function () {
    return U.page(
      U.pageHead({ title: 'Student Portfolio', sub: 'Portfolios are generated from verified achievements, project evidence and selected work.' }) +
      U.card({ body: '<div class="row g-4 wrap">' +
        U.btn('Open a sample portfolio', { variant: 'primary', icon: 'user', action: 'open-student', arg: 'HS-2026-1041' }) +
        U.btn('Portfolio template', { icon: 'layers', action: 'not-built', arg: 'Portfolio template editor' }) + '</div>' }) +
      '<div class="mt-4">' + U.card({
        title: 'Portfolio completeness by grade', sub: 'Share of students with evidence in all four categories',
        body: C.bar({ labels: ['G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10'], series: [{ name: 'Complete %', values: [42, 51, 58, 61, 55, 64, 71, 78], color: 'var(--amber)' }], yMax: 100, height: 230 })
      }) + '</div>'
    );
  });

  HS.route('academic-performance', function () {
    return U.page(
      U.pageHead({ title: 'Academic Performance', sub: 'Cohort performance, subject by subject, against Cambridge expectations.' }) +
      U.grid('g-4col', [
        U.kpi({ label: 'School average', value: 71.4, tone: 'teal', delta: 2.2 }),
        U.kpi({ label: 'Above expectation', value: '38%', tone: '', delta: 3 }),
        U.kpi({ label: 'At expectation', value: '44%', tone: 'info' }),
        U.kpi({ label: 'Below expectation', value: '18%', tone: 'critical', delta: -2, inverse: true })
      ]) +
      '<div class="grid g-main mt-4">' +
      U.card({
        title: 'Subject averages', sub: 'Current term against last term',
        body: C.bar({
          labels: ['English', 'Maths', 'Science', 'Tamil', 'Social', 'Computing'],
          series: [{ name: 'This term', values: [74, 69, 72, 79, 68, 77], color: 'var(--navy)' },
                   { name: 'Last term', values: [72, 66, 71, 78, 70, 73], color: 'var(--border-strong)' }],
          height: 250
        }) + '<div class="mt-3">' + C.legend([{ label: 'This term', color: 'var(--navy)' }, { label: 'Last term', color: 'var(--border-strong)' }]) + '</div>'
      }) +
      U.card({
        title: 'Biggest movers', sub: 'Grade-level shifts worth a conversation',
        flush: true,
        body: '<div>' +
          [['Grade 10 Physics', '+6.2', 'success', 'Mock paper 2 — new practice routine'],
           ['Grade 6 Mathematics', '+4.1', 'success', 'Fractions unit — applied approach'],
           ['Grade 7 Social Studies', '-5.4', 'critical', 'Coverage gap during teacher absence'],
           ['Grade 9 English', '-2.8', 'warning', 'Reading response scores slipping']
          ].map(function (r) {
            return U.alertItem({ tone: r[2], icon: r[2] === 'success' ? 'trending' : 'alert', title: r[0] + ' · ' + r[1], meta: r[3], route: '#/assessments' });
          }).join('') + '</div>'
      }) + '</div>'
    );
  });
})(window.HS = window.HS || {});
