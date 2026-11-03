/* ==========================================================================
   VIEWS — Login, Management Command Center, Notifications, My Tasks
   ========================================================================== */
(function (HS) {
  'use strict';
  var U = HS.ui, D = HS.data, C = HS.charts, t = HS.t, esc = HS.esc;
  HS.views = HS.views || {};

  /* =========================================================== LOGIN ====== */
  /* The landing + sign-in screen lives in views/home.js */

  HS.on('pick-login-role', function (arg) { HS.vs('login').role = arg; HS.render(); });
  HS.on('login-lang', function (arg) { HS.i18n.set(arg); HS.render(); });
  HS.on('do-login', function () {
    HS.state.role = HS.vs('login', { role: 'management' }).role;
    HS.state.authed = true;
    HS.go(HS.roleObj().home);
    HS.render();
    U.toast('Signed in as ' + HS.roleObj().label + ' — ' + HS.roleObj().person, 'success', 'userCheck');
  });

  /* ================================================== COMMAND CENTER ====== */
  HS.route('command-center', function () {
    var a = D.attendance, adm = D.admissions, fin = D.finance;
    var group = HS.state.scope === 'group';
    var totalStudents = group ? 2080 : HS.campusObj().students;
    var present = group ? 1908 : a.today.present;
    var absent = group ? 112 : a.today.absent;
    var v = HS.vs('cc', { attTab: 'trend' });

    var kpis = U.grid('g-4col', [
      U.kpi({ label: t('Total Students'), value: HS.fmt.n(totalStudents), foot: group ? '3 campuses' : HS.campusObj().place, delta: 3.1, tone: '', route: '#/students', spark: [1180, 1204, 1231, 1244, 1262, totalStudents > 1500 ? 1272 : totalStudents], sparkColor: 'var(--navy)' }),
      U.kpi({ label: t('Present Today'), value: HS.fmt.n(present), unit: '· ' + HS.fmt.pct(present / totalStudents * 100, 1), tone: 'teal', foot: 'Marked across 38 sections', route: '#/attendance', spark: a.trend.values, sparkColor: 'var(--teal)' }),
      U.kpi({ label: t('Absent Today'), value: HS.fmt.n(absent), unit: '· ' + a.today.late + ' late', tone: 'critical', foot: 'Parents notified automatically', delta: 12, inverse: true, route: '#/attendance' }),
      U.kpi({ label: t('Staff Present'), value: a.today.staffPresent + ' / ' + a.today.staffTotal, tone: 'info', foot: '2 shortages to cover', route: '#/workforce' }),
      U.kpi({ label: t('Admissions Pipeline'), value: HS.fmt.n(adm.kpis.qualified), unit: 'qualified', tone: 'amber', foot: adm.kpis.admitted + ' admitted of ' + adm.kpis.target + ' target', route: '#/admissions', spark: adm.monthly.enquiries, sparkColor: 'var(--amber)' }),
      U.kpi({ label: t('Fees Collected'), value: HS.fmt.money(fin.kpis.collected, { compact: true }), unit: '· ' + HS.fmt.pct(fin.kpis.collectionPct, 1), tone: 'teal', foot: 'Of ' + HS.fmt.money(fin.kpis.billed, { compact: true }) + ' billed', route: '#/fees' }),
      U.kpi({ label: t('Outstanding Fees'), value: HS.fmt.money(fin.kpis.outstanding, { compact: true }), tone: 'critical', foot: HS.fmt.money(fin.kpis.overdue, { compact: true }) + ' overdue 30+ days', route: '#/fees' }),
      U.kpi({ label: t('Students Requiring Attention'), value: D.earlyWarning.summary.atRisk, unit: '+ ' + D.earlyWarning.summary.developing + ' developing', tone: 'critical', foot: 'Signals awaiting teacher review', route: '#/early-warning' })
    ]);

    var attention = U.card({
      title: t('Today\'s Attention'),
      sub: 'Ranked by urgency. Every row opens the screen where it is resolved.',
      actions: U.btn('My tasks', { size: 'sm', route: '#/my-tasks', icon: 'checkSquare' }),
      flush: true,
      body: '<div>' + D.attention.map(function (i) {
        return U.alertItem({
          tone: i.tone, icon: i.icon, title: i.title, meta: i.meta, route: i.route,
          right: U.badge(String(i.count), i.tone)
        });
      }).join('') + '</div>',
      foot: '<div class="row between wrap g-2"><span>Signals are advisory. Nothing is actioned automatically.</span>' + U.illustrative() + '</div>'
    });

    var attTabs = { trend: 'Attendance trend', grade: 'Class-wise', late: 'Late arrivals', pattern: 'Absence patterns' };
    var attBody =
      v.attTab === 'trend' ? C.line({ labels: a.trend.labels, series: [{ name: 'Attendance %', values: a.trend.values, color: 'var(--teal)' }], yMin: 85, yMax: 100, unit: '%', height: 232, label: 'Attendance trend over ten school days' })
        : v.attTab === 'grade' ? C.bar({ labels: a.byGrade.labels, series: [{ name: 'Present %', values: a.byGrade.present, colors: a.byGrade.present.map(function (p) { return p < 90 ? 'var(--critical)' : p < 93 ? 'var(--amber)' : 'var(--teal)'; }) }], yMax: 100, target: a.byGrade.target, targetLabel: 'Target 93%', height: 232, label: 'Attendance by grade' })
          : v.attTab === 'late' ? C.bar({ labels: a.lateByHour.labels, series: [{ name: 'Arrivals', values: a.lateByHour.values, color: 'var(--navy)' }], height: 232, label: 'Arrival time distribution' })
            : C.hbar({ rows: a.patterns.map(function (p) { return { label: p.label, value: p.value, display: p.value + ' · ' + p.note }; }), labelW: 190, rowH: 34, label: 'Absence patterns' });

    var attendanceCard = U.card({
      title: 'Attendance analytics',
      sub: HS.fmt.pct(present / totalStudents * 100, 1) + ' present · ' + a.today.late + ' late · campus average 93.2% over ten days',
      actions: U.segment(Object.keys(attTabs).map(function (k) { return { id: k, label: attTabs[k] }; }), v.attTab, 'cc-att-tab'),
      body: attBody
    });

    var si = D.earlyWarning.summary;
    var intel = U.card({
      title: 'Student intelligence',
      sub: 'Cohort standing today, from attendance, academic trend and participation',
      actions: U.btn('Open Early Warning', { size: 'sm', route: '#/early-warning', iconRight: 'arrowRight' }),
      body: '<div class="row g-5 wrap">' +
        '<div class="none">' + C.donut({
          size: 172, thickness: 24, center: HS.fmt.n(si.onTrack), centerSub: 'On Track',
          data: [{ label: 'On Track', value: si.onTrack, color: 'var(--teal)' },
          { label: 'Developing Risk', value: si.developing, color: 'var(--amber)' },
          { label: 'At Risk', value: si.atRisk, color: 'var(--critical)' }],
          label: 'Cohort risk distribution'
        }) + '</div>' +
        '<div class="grow col g-3" style="min-width:260px">' +
        [['On Track', si.onTrack, 'success', 'Attendance and academic trend within expected range'],
        ['Developing Risk', si.developing, 'warning', 'One indicator slipping — monitored, not labelled'],
        ['At Risk', si.atRisk, 'critical', 'Two or more indicators declining — teacher review required']
        ].map(function (r) {
          return '<div class="row g-3"><span class="dot dot--' + r[2] + '" style="margin-top:6px"></span>' +
            '<div class="grow"><div class="row between"><span class="t-sm t-bold">' + r[0] + '</span>' +
            '<span class="t-sm t-bold t-num">' + HS.fmt.n(r[1]) + '</span></div>' +
            '<div class="t-micro t-muted">' + r[3] + '</div></div></div>';
        }).join('') +
        '<div class="divider" style="margin:8px 0"></div>' +
        '<div class="grid g-2col g-3">' +
        U.meter({ label: 'Declining academic performance', value: 41, right: '41 students', tone: 'amber' }) +
        U.meter({ label: 'Attendance decline', value: 28, right: '28 students', tone: 'critical' }) +
        U.meter({ label: 'Participation change', value: 19, right: '19 students', tone: 'info' }) +
        U.meter({ label: 'Intervention active', value: 23, right: '23 open', tone: 'teal' }) +
        '</div></div></div>' +
        '<div class="mt-4">' + U.aiNotice('<strong>Students are never auto-labelled.</strong> These bands are decision support. A teacher confirms every signal before it becomes an intervention.') + '</div>'
    });

    var funnelCard = U.card({
      title: 'Admissions funnel',
      sub: adm.kpis.conversion + '% enquiry-to-admission · cost per admission ' + HS.fmt.money(adm.kpis.cpa),
      actions: U.btn('Open CRM', { size: 'sm', route: '#/admissions', iconRight: 'arrowRight' }),
      body: U.funnel(adm.funnel, 'cc-funnel') +
        '<div class="divider"></div>' +
        '<div class="grid g-2col g-5">' +
        '<div><div class="eyebrow mb-3">Enquiries by source</div>' +
        C.hbar({ rows: adm.sources.map(function (s) { return { label: s.label, value: s.value, color: s.color }; }), labelW: 104, rowH: 27, label: 'Enquiries by source' }) + '</div>' +
        '<div><div class="eyebrow mb-3">Admissions target progress</div>' +
        '<div class="row g-4"><div class="none">' + C.gauge({ percent: Math.round(adm.kpis.admitted / adm.kpis.target * 100), value: adm.kpis.admitted + '/' + adm.kpis.target, sub: 'Admissions YTD', color: 'var(--amber)' }) + '</div>' +
        '<div class="grow col g-3">' +
        U.meter({ label: 'Pending follow-ups', value: 64, right: '11 open', tone: 'amber' }) +
        U.meter({ label: 'Visit-to-application', value: 75, right: '75%', tone: 'teal' }) +
        U.meter({ label: 'Offer acceptance', value: 74, right: '38 of 51', tone: 'info' }) +
        '</div></div></div></div>'
    });

    var role = HS.roleObj();
    var hour = new Date().getHours();
    var greet = hour < 12 ? t('Good Morning') : hour < 17 ? 'Good Afternoon' : 'Good Evening';

    return U.page(
      '<div class="pagehead"><div class="grow">' +
      '<h1 class="display">' + esc(greet) + ', ' + esc(role.title) + '</h1>' +
      '<p class="lede mt-2">' + esc(t('Here\'s your live school pulse')) + ' — ' +
      esc(HS.state.scope === 'group' ? 'all campuses' : HS.campusObj().name) + ', ' + esc(HS.state.year) + '.</p>' +
      '</div><div class="pagehead__actions">' +
      U.illustrative('Live at 09:05 · illustrative data') +
      U.btn('Day in the life', { icon: 'play', route: '#/day-in-life' }) +
      U.btn('Emergency broadcast', { variant: 'danger', icon: 'megaphone', route: '#/emergency' }) +
      '</div></div>' +
      kpis +
      '<div class="grid g-main mt-5">' + attendanceCard + attention + '</div>' +
      '<div class="grid g-main mt-5">' + intel + U.card({
        title: 'Live activity',
        sub: 'Gate, transport and system events',
        actions: U.btn('Smart Gate', { size: 'sm', route: '#/smart-gate' }),
        body: U.feed(D.safety.feed.slice(0, 6))
      }) + '</div>' +
      '<div class="mt-5">' + funnelCard + '</div>'
    );
  });

  HS.on('cc-att-tab', function (arg) { HS.vs('cc').attTab = arg; HS.render(); });
  HS.on('cc-funnel', function (arg) { HS.go('#/admissions?stage=' + encodeURIComponent(arg)); });

  /* =================================================== NOTIFICATIONS ====== */
  HS.route('notifications', function () {
    var v = HS.vs('notif', { cat: 'All' });
    var cats = ['All', 'Critical', 'Attention', 'Information', 'Completed'];
    var role = HS.roleObj();
    var mine = D.notificationsFor(HS.state.role);
    var counts = {};
    mine.forEach(function (n) { counts[n.category] = (counts[n.category] || 0) + 1; });
    var list = mine.filter(function (n) { return v.cat === 'All' || n.category === v.cat; });
    var scope = {
      management: 'Everything across the campus that needs management attention.',
      teacher: 'Your classes and your students only.',
      parent: 'Aditya only. You never see another family\'s information.',
      office: 'Admissions, fees, documents and records handled by the front office.',
      staff: 'Your own shifts, leave, pay and the duties assigned to you.'
    }[HS.state.role];

    return U.page(
      U.pageHead({
        title: 'Notification Center',
        sub: 'Categories map to how quickly somebody must act. ' + scope,
        actions: U.btn('Mark all read', { icon: 'check', action: 'demo', arg: 'All notifications marked read' }) +
          U.btn('Notification settings', { icon: 'settings', action: 'not-built', arg: 'Notification settings' })
      }) +
      '<div class="mb-4">' + U.banner('Showing the <strong>' + esc(role.label) + '</strong> queue, signed in as ' + esc(role.person) +
        '. Notifications are filtered by role, so nothing outside your remit appears here.', 'neutral', 'lock') + '</div>' +
      '<div class="filterbar">' +
        U.chips(cats.map(function (c) {
          return { id: c, label: c, count: c === 'All' ? mine.length : (counts[c] || 0), tone: { Critical: 'critical', Attention: 'warning', Information: 'info', Completed: 'success' }[c] };
        }), v.cat, 'notif-cat') +
      '</div>' +
      U.card({
        flush: true,
        body: list.length ? '<div>' + list.map(function (n) {
          return U.alertItem({
            tone: n.tone, icon: n.icon, title: n.title, meta: n.meta + ' · ' + n.time, route: n.route,
            right: U.badge(n.category, n.tone)
          });
        }).join('') + '</div>' : U.empty('Nothing in this category', 'Switch category to see other notifications.')
      })
    );
  });
  HS.on('notif-cat', function (arg) { HS.vs('notif').cat = arg; HS.render(); });

  /* ======================================================== MY TASKS ====== */
  HS.route('my-tasks', function () {
    var v = HS.vs('tasks', { done: {} });
    var role = HS.roleObj();
    var mine = D.tasksFor(HS.state.role);
    var underReview = mine.filter(function (t) { return t.status === 'Under Review'; }).length;
    var isParent = HS.state.role === 'parent';

    return U.page(
      U.pageHead({
        title: 'My Tasks',
        sub: (isParent ? 'Things the school needs from you for Aditya.' : 'Approvals and actions assigned to ' + role.person + '.') +
          ' Each one carries the standard status states.',
        actions: U.btn(isParent ? 'How this works' : 'Approval policy', { icon: 'shield', action: 'show-approval-flow' })
      }) +
      (isParent
        ? U.card({ body: U.banner('These are your own actions as a parent. Approvals, payroll, compliance and staff matters belong to school administration and never appear here.', 'neutral', 'lock') })
        : U.card({
          body: U.flow([
            { label: 'Draft', meta: 'Created, not submitted', state: 'done' },
            { label: 'Submitted', meta: 'Waiting for reviewer', state: 'done' },
            { label: 'Under Review', meta: underReview + ' item' + (underReview === 1 ? '' : 's') + ' here now', state: 'active' },
            { label: 'Approved', meta: 'Actioned and logged' },
            { label: 'Rejected', meta: 'Returned with a reason' }
          ]) + '<p class="t-xs t-muted mt-3">Leave, payroll, expenses, reimbursements, certificates, admission offers, parent communication and AI-generated content all follow this same path.</p>'
        })) +
      '<div class="mt-4">' + U.card({
        title: 'Open items', sub: mine.length + ' assigned to ' + role.person, flush: true,
        body: U.table({
          rowAction: 'open-task-route',
          rowId: function (r) { return r.route; },
          cols: [
            { key: 'title', label: 'Task', render: function (r) {
              return '<div class="row g-3"><input type="checkbox" data-action="tick-task" data-arg="' + r.id + '"' + (v.done[r.id] ? ' checked' : '') + ' aria-label="Complete ' + esc(r.title) + '">' +
                '<span class="col"><span class="t-sm t-bold"' + (v.done[r.id] ? ' style="text-decoration:line-through;opacity:.55"' : '') + '>' + esc(r.title) + '</span>' +
                '<span class="t-micro t-muted">' + esc(r.id) + ' · ' + esc(r.module) + '</span></span></div>';
            } },
            { key: 'due', label: 'Due', render: function (r) { return r.due === 'Overdue' ? U.badge('Overdue', 'critical') : esc(r.due); } },
            { key: 'priority', label: 'Priority', render: function (r) { return U.badge(r.priority, r.priority === 'High' ? 'critical' : r.priority === 'Medium' ? 'warning' : 'neutral'); } },
            { key: 'status', label: 'Status', render: function (r) { return U.status(r.status); } },
            { key: 'go', label: '', sortable: false, cls: 'num', render: function (r) { return U.btn('Open', { size: 'sm', route: r.route, iconRight: 'chevronRight' }); } }
          ],
          rows: mine,
          emptyText: 'Nothing is assigned to you right now.'
        })
      }) + '</div>'
    );
  });
  HS.on('tick-task', function (arg, el) {
    var v = HS.vs('tasks', { done: {} });
    v.done[arg] = el.checked;
    U.toast(el.checked ? 'Task ' + arg + ' marked complete' : 'Task ' + arg + ' reopened', el.checked ? 'success' : 'warning');
  });
  HS.on('open-task-route', function (arg) { HS.go(arg); });
  HS.on('show-approval-flow', function () {
    U.modal({
      title: 'Approval and workflow design', size: 'wide',
      body: '<p class="t-sm t-muted">Anywhere an action needs authorisation, the same four states are used, with the same badges, so staff learn the pattern once.</p>' +
        '<div class="mt-4">' + U.flow([
          { label: 'Draft', meta: 'Editable by the author', state: 'done' },
          { label: 'Submitted', meta: 'Locked, queued for review', state: 'done' },
          { label: 'Under Review', meta: 'Reviewer can request changes', state: 'active' },
          { label: 'Approved / Rejected', meta: 'Outcome recorded in the audit trail' }
        ]) + '</div>' +
        '<div class="grid g-2col g-3 mt-5">' + [
          ['Leave', 'Line manager, then HR if over 3 days'], ['Payroll', 'Section head, then Principal'],
          ['Expense', 'Budget owner, then Finance'], ['Reimbursement', 'Line manager, then Finance'],
          ['Certificate', 'Front office, then Principal'], ['Admission offer', 'Counsellor, then Head of Admissions'],
          ['Parent communication', 'Class teacher, then Section head'], ['AI-generated content', 'Always a named human reviewer']
        ].map(function (r) {
          return '<div class="card card--tint" style="padding:12px 14px"><div class="t-sm t-bold">' + r[0] + '</div><div class="t-micro t-muted">' + r[1] + '</div></div>';
        }).join('') + '</div>',
      foot: U.btn('Close', { variant: 'primary', action: 'close-overlay' })
    });
  });
})(window.HS = window.HS || {});
