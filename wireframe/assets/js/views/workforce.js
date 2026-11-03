/* ==========================================================================
   VIEWS — Workforce 360 (teaching and non-teaching), attendance, shifts,
           leave, overtime, workload, CPD, payroll, payslips
   ========================================================================== */
(function (HS) {
  'use strict';
  var U = HS.ui, D = HS.data, C = HS.charts, esc = HS.esc;
  var W = D.workforce, P = W.payroll;

  function empLink(e) {
    return '<button class="person person--link" data-action="open-employee" data-arg="' + esc(e.id) + '">' +
      U.avatar(e.name, { size: 'sm' }) +
      '<span class="col" style="min-width:0"><span class="person__name t-clip">' + esc(e.name) + '</span>' +
      '<span class="person__meta t-clip">' + esc(e.role) + '</span></span></button>';
  }

  /* ==================================================== WORKFORCE 360 ==== */
  HS.route('workforce', function () {
    var v = HS.vs('wf', { type: 'All', dept: 'All', q: '' });
    var rows = W.employees.filter(function (e) {
      if (v.type !== 'All' && e.type !== v.type) return false;
      if (v.dept !== 'All' && e.dept !== v.dept) return false;
      if (v.q && (e.name + e.id + e.role).toLowerCase().indexOf(v.q.toLowerCase()) === -1) return false;
      return true;
    });
    var depts = ['All'].concat(W.employees.map(function (e) { return e.dept; }).filter(function (d, i, a) { return a.indexOf(d) === i; }));

    return U.page(
      U.pageHead({
        title: 'Workforce 360',
        sub: 'One ecosystem for teaching and non-teaching staff — reception, security, drivers, housekeeping, lab and library included.',
        actions: U.btn('Add employee', { variant: 'primary', icon: 'plus', action: 'not-built', arg: 'Add employee' }) +
          U.btn('Payroll', { icon: 'wallet', route: '#/payroll' })
      }) +
      U.grid('g-4col', [
        U.kpi({ label: 'Total employees', value: W.kpis.total, tone: '', foot: '118 teaching · 125 non-teaching' }),
        U.kpi({ label: 'Present', value: W.kpis.present, unit: HS.fmt.pct(W.kpis.present / W.kpis.total * 100), tone: 'teal' }),
        U.kpi({ label: 'Absent', value: W.kpis.absent, tone: 'critical', foot: '1 gate post uncovered' }),
        U.kpi({ label: 'On leave', value: W.kpis.leave, tone: 'info', foot: '1 request awaiting approval' }),
        U.kpi({ label: 'Late', value: W.kpis.late, tone: 'amber' }),
        U.kpi({ label: 'Overtime hours', value: W.kpis.overtime, unit: 'this month', tone: 'amber', route: '#/overtime' }),
        U.kpi({ label: 'Payroll inputs pending', value: W.kpis.payrollPending, tone: 'critical', route: '#/payroll' }),
        U.kpi({ label: 'CPD hours logged', value: 1284, tone: 'teal', route: '#/cpd' })
      ]) +
      '<div class="grid g-main mt-5">' +
      U.card({
        title: 'Employee journey', sub: 'One record from recruitment through to the payslip',
        body: U.flow([
          { label: 'Recruitment', meta: '4 open roles', state: 'done' },
          { label: 'Employee profile', meta: '243 active', state: 'done' },
          { label: 'Attendance', meta: 'Daily, by shift', state: 'done' },
          { label: 'Leave', meta: '4 requests open', state: 'done' },
          { label: 'Overtime', meta: '34 hours', state: 'done' },
          { label: 'Approval', meta: '12 pending', state: 'active' },
          { label: 'Payroll', meta: 'September run' },
          { label: 'Payslip', meta: 'Released to the staff app' }
        ])
      }) +
      U.card({ title: 'Workforce composition', body: C.donut({ size: 186, thickness: 26, center: String(W.kpis.total), centerSub: 'employees', data: W.categories }) +
        '<div class="mt-4">' + C.legend(W.categories) + '</div>' }) +
      '</div>' +
      '<div class="filterbar mt-5">' +
        U.search('Search name, ID or role', 'wf-q', v.q) +
        U.field({ type: 'select', label: 'Category', value: v.type, options: ['All', 'Teaching', 'Non-Teaching'], action: 'wf-type' }) +
        U.field({ type: 'select', label: 'Department', value: v.dept, options: depts, action: 'wf-dept' }) +
        '<div class="spacer"></div><span class="t-sm t-muted t-num">' + rows.length + ' employees</span>' +
      '</div>' +
      U.card({ flush: true, body: U.table({
        rowAction: 'open-employee', rowId: function (r) { return r.id; },
        cols: [
          { key: 'name', label: 'Employee', render: empLink },
          { key: 'id', label: 'ID' },
          { key: 'type', label: 'Category', render: function (r) { return U.badge(r.type, r.type === 'Teaching' ? 'info' : 'neutral'); } },
          { key: 'dept', label: 'Department' },
          { key: 'shift', label: 'Shift', render: function (r) { return '<span class="t-xs t-muted">' + esc(r.shift) + '</span>'; } },
          { key: 'status', label: 'Today', render: function (r) { return U.badge(r.status, HS.statusTone(r.status), { dot: true }); } },
          { key: 'leaveBal', label: 'Leave', cls: 'num', render: function (r) { return '<span class="t-num">' + r.leaveBal + ' d</span>'; } },
          { key: 'overtime', label: 'OT', cls: 'num', render: function (r) { return r.overtime ? '<span class="t-num t-warning">' + r.overtime + ' h</span>' : '<span class="t-faint">—</span>'; } },
          { key: 'workload', label: 'Workload', render: function (r) {
            return r.workload ? U.meter({ label: '', value: r.workload / 30 * 100, right: r.workload + ' periods', tone: r.workload > 27 ? 'critical' : 'teal' }) : '<span class="t-faint">n/a</span>';
          } }
        ],
        rows: rows
      }) })
    );
  });
  HS.on('wf-q', function (a, el) { HS.vs('wf').q = el.value; HS.render(); });
  HS.on('wf-type', function (a, el) { HS.vs('wf').type = el.value; HS.render(); });
  HS.on('wf-dept', function (a, el) { HS.vs('wf').dept = el.value; HS.render(); });

  HS.on('open-employee', function (id) {
    var e = W.employees.filter(function (x) { return x.id === id; })[0] || W.employees[0];
    U.modal({
      title: e.name, sub: e.id + ' · ' + e.role + ' · ' + e.dept, size: 'full',
      body: '<div class="mb-5">' + U.flow([
        { label: 'Recruitment', meta: 'Joined Jun 2019', state: 'done' },
        { label: 'Profile', meta: 'Complete', state: 'done' },
        { label: 'Attendance', meta: e.status, state: 'done' },
        { label: 'Leave', meta: e.leaveBal + ' days left', state: 'done' },
        { label: 'Overtime', meta: e.overtime + ' hours', state: 'done' },
        { label: 'Approval', meta: 'Pending', state: 'active' },
        { label: 'Payroll', meta: 'September run' },
        { label: 'Payslip', meta: 'Not released' }
      ]) + '</div>' +
      '<div class="grid g-3col g-4">' +
      U.card({ title: 'Employment', tight: true, body: U.dl([
        ['Category', e.type], ['Department', e.dept], ['Designation', e.role],
        ['Campus', (D.campuses.filter(function (c) { return c.id === e.campus; })[0] || {}).name || ''],
        ['Shift', e.shift], ['Status today', e.status]
      ]) }) +
      U.card({ title: 'Time and leave', tight: true, body:
        '<div class="col g-3">' +
        U.meter({ label: 'Attendance this month', value: 94, right: '94%', tone: 'teal' }) +
        U.meter({ label: 'Leave used', value: (18 - e.leaveBal) / 18 * 100, right: (18 - e.leaveBal) + ' of 18 days', tone: 'info' }) +
        U.meter({ label: 'Overtime', value: Math.min(100, e.overtime * 4), right: e.overtime + ' hours', tone: e.overtime > 15 ? 'critical' : 'amber' }) +
        (e.workload ? U.meter({ label: 'Teaching load', value: e.workload / 30 * 100, right: e.workload + ' of 30 periods', tone: e.workload > 27 ? 'critical' : 'teal' }) : '') +
        U.meter({ label: 'CPD hours', value: Math.min(100, e.cpd * 3), right: e.cpd + ' hours', tone: 'teal' }) +
        '</div>' }) +
      U.card({ title: 'Documents', tight: true, flush: true, body: U.table({ compact: true, stack: false, cols: [
        { key: 'n', label: 'Document' }, { key: 's', label: 'Status', render: function (r) { return U.status(r.s); } }
      ], rows: [
        { n: 'Employment contract', s: 'Verified' }, { n: 'Identity proof', s: 'Verified' },
        { n: 'Qualification certificates', s: 'Verified' }, { n: 'Background verification', s: e.id === 'EMP-3018' ? 'Pending' : 'Verified' },
        { n: 'Child-protection training', s: 'Verified' }
      ] }) }) +
      '</div>',
      foot: U.btn('Close', { action: 'close-overlay' }) +
        U.btn('View payslip', { icon: 'receipt', action: 'open-payslip' }) +
        U.btn('Edit profile', { variant: 'primary', icon: 'edit', action: 'not-built', arg: 'Edit employee' })
    });
  });

  HS.route('teaching-staff', function () { return staffList('Teaching Staff', 'Teaching', 'Teachers, counsellors and academic specialists.'); });
  HS.route('non-teaching-staff', function () { return staffList('Non-Teaching Staff', 'Non-Teaching', 'Reception, security, drivers and attendants, housekeeping, lab and library.'); });

  function staffList(title, type, sub) {
    var rows = W.employees.filter(function (e) { return e.type === type; });
    return U.page(
      U.pageHead({ title: title, sub: sub }) +
      U.grid('g-4col', [
        U.kpi({ label: 'Employees', value: type === 'Teaching' ? 118 : 125, tone: '' }),
        U.kpi({ label: 'Present today', value: type === 'Teaching' ? 111 : 110, tone: 'teal' }),
        U.kpi({ label: 'On leave', value: type === 'Teaching' ? 5 : 6, tone: 'info' }),
        U.kpi({ label: type === 'Teaching' ? 'Average load' : 'Overtime hours', value: type === 'Teaching' ? '25 periods' : '34 h', tone: 'amber' })
      ]) +
      '<div class="mt-4">' + U.card({ flush: true, body: U.table({
        rowAction: 'open-employee', rowId: function (r) { return r.id; },
        cols: [
          { key: 'name', label: 'Employee', render: empLink },
          { key: 'dept', label: 'Department' }, { key: 'shift', label: 'Shift' },
          { key: 'status', label: 'Today', render: function (r) { return U.badge(r.status, HS.statusTone(r.status), { dot: true }); } },
          { key: 'cpd', label: 'CPD hours', cls: 'num' },
          { key: 'overtime', label: 'Overtime', cls: 'num', render: function (r) { return r.overtime + ' h'; } }
        ], rows: rows
      }) }) + '</div>'
    );
  }

  /* ==================================================== STAFF ATTENDANCE = */
  HS.route('staff-attendance', function () {
    return U.page(
      U.pageHead({ title: 'Staff Attendance', sub: 'Biometric and app-based, by shift. Feeds payroll directly.',
        actions: U.btn('Export', { icon: 'download', action: 'demo', arg: 'Staff attendance exported' }) }) +
      U.grid('g-4col', [
        U.kpi({ label: 'Present', value: W.kpis.present, tone: 'teal' }),
        U.kpi({ label: 'Absent', value: W.kpis.absent, tone: 'critical' }),
        U.kpi({ label: 'On leave', value: W.kpis.leave, tone: 'info' }),
        U.kpi({ label: 'Late', value: W.kpis.late, tone: 'amber' })
      ]) +
      '<div class="grid g-2col g-4 mt-4">' +
      U.card({ title: 'Attendance by department', body: C.bar({
        labels: ['Academic', 'Transport', 'Security', 'Office', 'Housekp.', 'Lab/Lib'],
        series: [{ name: 'Present %', values: [96, 92, 88, 95, 96, 100],
          colors: [96, 92, 88, 95, 96, 100].map(function (p) { return p < 90 ? 'var(--critical)' : p < 95 ? 'var(--amber)' : 'var(--teal)'; }) }],
        yMax: 100, height: 230 }) }) +
      U.card({ title: 'Today by shift', flush: true, body: U.table({
        cols: [{ key: 'shift', label: 'Shift' }, { key: 'expected', label: 'Expected', cls: 'num' },
               { key: 'present', label: 'Present', cls: 'num' },
               { key: 'gap', label: 'Cover needed', render: function (r) {
                 return r.expected - r.present ? U.badge((r.expected - r.present) + ' uncovered', 'critical') : U.badge('Full', 'success', { icon: 'check' });
               } }],
        rows: [
          { shift: 'General 08:00–16:00', expected: 139, present: 133 },
          { shift: 'Day 06:00–14:00', expected: 34, present: 33 },
          { shift: 'Split 06:00–10:00 / 14:00–18:00', expected: 38, present: 38 },
          { shift: 'Night 20:00–06:00', expected: 9, present: 9 },
          { shift: 'Office 08:30–17:00', expected: 23, present: 22 }
        ]
      }) }) + '</div>' +
      '<div class="mt-4">' + U.card({ title: 'Today\'s register', flush: true, body: U.table({
        rowAction: 'open-employee', rowId: function (r) { return r.id; },
        cols: [
          { key: 'name', label: 'Employee', render: empLink },
          { key: 'shift', label: 'Shift' },
          { key: 'in', label: 'Clock in', sortable: false, render: function (r) { return r.status === 'Absent' ? '<span class="t-faint">—</span>' : '<span class="t-num">' + (r.status === 'Late' ? '09:14' : '07:52') + '</span>'; } },
          { key: 'status', label: 'Status', render: function (r) { return U.badge(r.status, HS.statusTone(r.status), { dot: true }); } },
          { key: 'a', label: '', sortable: false, cls: 'num', render: function (r) {
            return r.status === 'Absent' ? U.btn('Arrange cover', { size: 'sm', variant: 'primary', action: 'demo', arg: 'Cover request sent' }) : '';
          } }
        ],
        rows: W.employees
      }) }) + '</div>'
    );
  });

  /* =========================================================== SHIFTS === */
  HS.route('shifts', function () {
    var days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var shifts = [
      { name: 'Gate security — day', pattern: ['Devendran M.', 'Devendran M.', 'Saravanan R.', 'Saravanan R.', 'Devendran M.', 'Rotation'] },
      { name: 'Gate security — night', pattern: ['Saravanan R.', 'Saravanan R.', 'Devendran M.', 'Devendran M.', 'Saravanan R.', 'Rotation'] },
      { name: 'Transport — morning', pattern: ['Selvaraj K.', 'Selvaraj K.', 'Selvaraj K.', 'Selvaraj K.', 'Selvaraj K.', 'Off'] },
      { name: 'Housekeeping — early', pattern: ['Rekha J.', 'Rekha J.', 'Rekha J.', 'Rekha J.', 'Rekha J.', 'Rekha J.'] },
      { name: 'Front office', pattern: ['Kavitha S.', 'Ravi T.', 'Kavitha S.', 'Ravi T.', 'Kavitha S.', 'Kavitha S.'] }
    ];
    return U.page(
      U.pageHead({ title: 'Shifts & Rosters', sub: 'Who is on which post, which day. Gaps are visible before they become a problem.',
        actions: U.btn('Publish roster', { variant: 'primary', icon: 'check', action: 'demo', arg: 'Roster published to the staff app' }) }) +
      U.banner('<strong>1 gap this week.</strong> Rear gate day shift on Thursday has no named cover — Saravanan R. is absent.', 'warning', 'alert') +
      '<div class="mt-4">' + U.card({ flush: true, body:
        '<div class="table-wrap"><table class="table table--compact" style="min-width:760px"><thead><tr><th>Post</th>' +
        days.map(function (d) { return '<th>' + d + '</th>'; }).join('') + '</tr></thead><tbody>' +
        shifts.map(function (s) {
          return '<tr><td class="t-bold">' + esc(s.name) + '</td>' + s.pattern.map(function (p, i) {
            var gap = s.name.indexOf('day') > -1 && i === 3;
            return '<td>' + (gap ? U.badge('No cover', 'critical') : p === 'Off' || p === 'Rotation' ? '<span class="t-faint">' + p + '</span>' : '<span class="t-xs">' + esc(p) + '</span>') + '</td>';
          }).join('') + '</tr>';
        }).join('') + '</tbody></table></div>'
      }) + '</div>'
    );
  });

  /* ============================================================ LEAVE === */
  HS.route('leave', function () {
    return U.page(
      U.pageHead({ title: 'Leave', sub: 'Requests, approvals and the cover arrangement for each one.',
        actions: U.btn('Apply for leave', { variant: 'primary', icon: 'plus', action: 'staff-leave' }) }) +
      U.card({ body: U.flow([
        { label: 'Draft', meta: 'Written by the employee', state: 'done' },
        { label: 'Submitted', meta: '1 waiting', state: 'done' },
        { label: 'Under Review', meta: '1 with a line manager', state: 'active' },
        { label: 'Approved', meta: '2 this week' },
        { label: 'Rejected', meta: 'Returned with a reason' }
      ]) }) +
      '<div class="mt-4">' + U.card({ flush: true, body: U.table({
        cols: [
          { key: 'id', label: 'Reference' },
          { key: 'name', label: 'Employee', render: function (r) { return U.person(r.name, r.type); } },
          { key: 'from', label: 'From' }, { key: 'to', label: 'To' },
          { key: 'days', label: 'Days', cls: 'num' },
          { key: 'cover', label: 'Cover', render: function (r) { return r.cover === 'Not assigned' ? U.badge('Not assigned', 'critical') : esc(r.cover); } },
          { key: 'status', label: 'Status', render: function (r) { return U.status(r.status); } },
          { key: 'a', label: '', sortable: false, cls: 'num', render: function (r) {
            return ['Submitted', 'Under Review'].indexOf(r.status) > -1
              ? '<div class="row g-2 end">' + U.btn('Approve', { size: 'sm', variant: 'teal', action: 'demo', arg: r.id + ' approved — cover confirmed' }) +
                U.btn('Reject', { size: 'sm', action: 'demo', arg: r.id + ' rejected' }) + '</div>' : '';
          } }
        ],
        rows: W.leaveRequests
      }) }) + '</div>' +
      '<div class="grid g-2col g-4 mt-4">' +
      U.card({ title: 'Leave taken by month', body: C.bar({ labels: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
        series: [{ name: 'Days', values: [64, 38, 91, 72, 88, 41], color: 'var(--navy)' }], height: 210 }) }) +
      U.card({ title: 'Leave type mix', body: C.donut({ size: 170, thickness: 24, center: '394', centerSub: 'days this year',
        data: [{ label: 'Casual', value: 148, color: 'var(--navy)' }, { label: 'Sick', value: 112, color: 'var(--amber)' },
               { label: 'Earned', value: 98, color: 'var(--teal)' }, { label: 'Compensatory', value: 36, color: 'var(--viz-4)' }] }) +
        '<div class="mt-4">' + C.legend([{ label: 'Casual', color: 'var(--navy)' }, { label: 'Sick', color: 'var(--amber)' },
          { label: 'Earned', color: 'var(--teal)' }, { label: 'Compensatory', color: 'var(--viz-4)' }]) + '</div>' }) +
      '</div>'
    );
  });

  HS.route('overtime', function () {
    return U.page(
      U.pageHead({ title: 'Overtime', sub: 'Claimed, approved and passed to payroll. Mostly transport and security cover.' }) +
      U.grid('g-4col', [
        U.kpi({ label: 'Hours this month', value: W.kpis.overtime, tone: 'amber' }),
        U.kpi({ label: 'Approved', value: 22, tone: 'teal' }),
        U.kpi({ label: 'Pending approval', value: 12, tone: 'critical', route: '#/payroll' }),
        U.kpi({ label: 'Cost this month', value: HS.fmt.money(214000, { compact: true }), tone: '' })
      ]) +
      '<div class="mt-4">' + U.card({ flush: true, body: U.table({
        rowAction: 'open-employee', rowId: function (r) { return r.id; },
        cols: [
          { key: 'name', label: 'Employee', render: empLink },
          { key: 'dept', label: 'Department' },
          { key: 'overtime', label: 'Hours', cls: 'num', render: function (r) { return '<span class="t-num t-bold">' + r.overtime + ' h</span>'; } },
          { key: 'reason', label: 'Reason', sortable: false, render: function (r) {
            return '<span class="t-xs t-muted">' + esc(r.dept === 'Transport' ? 'Extra route cover' : r.dept === 'Security' ? 'Gate cover for absence' : 'Event support') + '</span>';
          } },
          { key: 'cost', label: 'Cost', cls: 'num', sortable: false, render: function (r) { return HS.fmt.money(r.overtime * 620); } },
          { key: 'status', label: 'Approval', sortable: false, render: function (r) { return U.status(r.overtime > 10 ? 'Under Review' : 'Approved'); } }
        ],
        rows: W.employees.filter(function (e) { return e.overtime > 0; }).sort(function (a, b) { return b.overtime - a.overtime; })
      }) }) + '</div>'
    );
  });

  HS.route('workload', function () {
    var teaching = W.employees.filter(function (e) { return e.workload > 0; });
    return U.page(
      U.pageHead({ title: 'Workload', sub: 'Teaching periods per week against the agreed maximum of 27.' }) +
      U.card({ body: C.hbar({ rows: teaching.map(function (e) {
        return { label: e.name.replace('Ms. ', '').replace('Mr. ', ''), value: e.workload, display: e.workload + ' periods',
          color: e.workload > 27 ? 'var(--critical)' : e.workload > 24 ? 'var(--amber)' : 'var(--teal)' };
      }), labelW: 150, rowH: 32 }) +
        '<div class="mt-4">' + U.banner('Mr. Ganesh Venkat is at 28 periods, one above the agreed maximum. Two Grade 7 sections could move to Ms. Kalaiselvi M., who is at 25.', 'warning', 'alert') + '</div>' })
    );
  });

  HS.route('cpd', function () {
    return U.page(
      U.pageHead({ title: 'Continuing Professional Development', sub: 'Training completed, hours logged and what is still required this year.',
        actions: U.btn('Schedule training', { variant: 'primary', icon: 'plus', action: 'not-built', arg: 'Schedule CPD' }) }) +
      U.grid('g-4col', [
        U.kpi({ label: 'Hours logged', value: 1284, tone: 'teal', delta: 18 }),
        U.kpi({ label: 'Average per teacher', value: 18.6, unit: 'hours', tone: '', foot: 'Target 24 hours' }),
        U.kpi({ label: 'Below target', value: 34, unit: 'staff', tone: 'amber' }),
        U.kpi({ label: 'Mandatory training complete', value: '96%', tone: 'teal', foot: 'Child protection refresher due 15 Oct' })
      ]) +
      '<div class="mt-4">' + U.card({ flush: true, body: U.table({
        rowAction: 'open-employee', rowId: function (r) { return r.id; },
        cols: [
          { key: 'name', label: 'Employee', render: empLink },
          { key: 'dept', label: 'Department' },
          { key: 'cpd', label: 'Hours', cls: 'num' },
          { key: 'progress', label: 'Against target', sortable: false, render: function (r) {
            return U.meter({ label: '', value: Math.min(100, r.cpd / 24 * 100), right: r.cpd + ' / 24 h', tone: r.cpd >= 24 ? 'teal' : r.cpd >= 15 ? 'amber' : 'critical' });
          } },
          { key: 'mandatory', label: 'Mandatory', sortable: false, render: function (r) { return U.badge(r.id === 'EMP-3018' ? 'Outstanding' : 'Complete', r.id === 'EMP-3018' ? 'critical' : 'success'); } }
        ],
        rows: W.employees
      }) }) + '</div>'
    );
  });

  /* ========================================================== PAYROLL === */
  HS.route('payroll', function () {
    var v = HS.vs('payroll', { approved: false });
    return U.page(
      U.pageHead({
        title: 'Payroll',
        sub: P.month + ' run. Attendance, leave, overtime and allowances flow in automatically — approval is the only manual gate.',
        actions: U.btn('Payroll history', { icon: 'clock', action: 'not-built', arg: 'Payroll history' }) +
          U.btn(v.approved ? 'Payroll approved' : 'Approve ' + P.pendingApprovals + ' inputs', { variant: v.approved ? 'teal' : 'primary', icon: v.approved ? 'check' : 'checkSquare', action: 'payroll-approve', disabled: v.approved })
      }) +
      (v.approved ? '<div class="mb-4">' + U.banner('<strong>September payroll approved.</strong> Processing has started. Payslips will be released to the staff app once the run completes.', 'success', 'check') + '</div>' : '') +
      U.grid('g-4col', [
        U.kpi({ label: 'Payroll month', value: 'Sep', unit: '2026', tone: '' }),
        U.kpi({ label: 'Employees', value: P.employees, tone: '' }),
        U.kpi({ label: 'Gross salary', value: HS.fmt.money(P.gross, { compact: true }), tone: '' }),
        U.kpi({ label: 'Deductions', value: HS.fmt.money(P.deductions, { compact: true }), tone: 'critical' }),
        U.kpi({ label: 'Overtime', value: HS.fmt.money(P.overtime, { compact: true }), tone: 'amber', route: '#/overtime' }),
        U.kpi({ label: 'Allowances', value: HS.fmt.money(P.allowances, { compact: true }), tone: 'info', route: '#/staff-allowances' }),
        U.kpi({ label: 'Net payroll', value: HS.fmt.money(P.net, { compact: true }), tone: 'teal' }),
        U.kpi({ label: 'Pending approvals', value: v.approved ? 0 : P.pendingApprovals, tone: v.approved ? 'teal' : 'critical' })
      ]) +
      '<div class="mt-5">' + U.card({
        title: 'Payroll workflow', sub: 'Attendance → Leave → Overtime → Allowances → Approval → Payroll processing → Payslip',
        body: U.flow([
          { label: 'Attendance', meta: 'Locked 15 Sep', state: 'done' },
          { label: 'Leave', meta: '394 days applied', state: 'done' },
          { label: 'Overtime', meta: '34 hours claimed', state: 'done' },
          { label: 'Allowances', meta: 'Applied by rule', state: 'done' },
          { label: 'Approval', meta: v.approved ? 'Approved' : P.pendingApprovals + ' pending', state: v.approved ? 'done' : 'active' },
          { label: 'Payroll processing', meta: v.approved ? 'Running' : 'Blocked', state: v.approved ? 'active' : '' },
          { label: 'Payslip', meta: 'Released to staff app' }
        ])
      }) + '</div>' +
      '<div class="grid g-main mt-4">' +
      U.card({ title: 'Payroll preview by category', flush: true, body: U.table({
        cols: [
          { key: 'label', label: 'Category' },
          { key: 'count', label: 'Employees', cls: 'num' },
          { key: 'gross', label: 'Gross', cls: 'num', render: function (r) { return HS.fmt.money(r.gross, { compact: true }); } },
          { key: 'share', label: 'Share of payroll', sortable: false, render: function (r) {
            return U.meter({ label: '', value: r.gross / P.gross * 100, right: HS.fmt.pct(r.gross / P.gross * 100), tone: 'info' });
          } }
        ],
        rows: P.byCategory
      }) }) +
      '<div class="col g-4">' +
      U.card({ title: 'Recent runs', flush: true, body: U.table({ compact: true, cols: [
        { key: 'month', label: 'Month' },
        { key: 'net', label: 'Net', cls: 'num', render: function (r) { return HS.fmt.money(r.net, { compact: true }); } },
        { key: 'status', label: 'Status', render: function (r) { return U.status(r.status); } }
      ], rows: P.runs }) }) +
      U.card({ title: 'Sample payslip', sub: P.payslip.name, body:
        '<div class="row g-3">' + U.btn('Open payslip', { variant: 'primary', block: true, icon: 'receipt', action: 'open-payslip' }) + '</div>' +
        '<p class="t-xs t-muted mt-3">Payslips are released to the staff app and downloadable as PDF. Non-teaching staff receive them the same way.</p>' }) +
      '</div></div>'
    );
  });
  HS.on('payroll-approve', function () {
    U.modal({
      title: 'Approve payroll inputs', sub: P.month + ' · ' + P.pendingApprovals + ' items',
      body: U.table({ compact: true, stack: false, cols: [
        { key: 'what', label: 'Input' }, { key: 'count', label: 'Items', cls: 'num' }, { key: 'value', label: 'Value', cls: 'num' }
      ], rows: [
        { what: 'Overtime — transport', count: 6, value: '₹86,800' },
        { what: 'Overtime — security', count: 4, value: '₹94,240' },
        { what: 'Event support allowance', count: 2, value: '₹12,000' }
      ] }) +
      '<div class="mt-4">' + U.banner('Approving releases the run for processing. Payslips are only visible to staff after processing completes.', 'neutral', 'info') + '</div>',
      foot: U.btn('Cancel', { action: 'close-overlay' }) + U.btn('Approve all', { variant: 'primary', icon: 'check', action: 'payroll-confirm' })
    });
  });
  HS.on('payroll-confirm', function () {
    HS.vs('payroll').approved = true;
    U.closeOverlay(); HS.render();
    U.toast('Payroll approved — processing started', 'success', 'check');
  });

  HS.route('payslips', function () {
    return U.page(
      U.pageHead({ title: 'Payslips', sub: 'Released to every employee through the staff app, teaching and non-teaching alike.',
        actions: U.btn('Release September', { variant: 'primary', icon: 'send', action: 'demo', arg: 'Payslips released to 243 employees' }) }) +
      U.grid('g-4col', [
        U.kpi({ label: 'Released this year', value: '1,458', tone: 'teal' }),
        U.kpi({ label: 'September status', value: 'Pending', tone: 'amber', foot: 'Awaiting payroll approval' }),
        U.kpi({ label: 'Downloaded', value: '92%', tone: '', foot: 'August run' }),
        U.kpi({ label: 'Queries raised', value: 3, tone: 'info' })
      ]) +
      '<div class="mt-4">' + U.card({ flush: true, body: U.table({
        cols: [
          { key: 'name', label: 'Employee', render: empLink },
          { key: 'type', label: 'Category', render: function (r) { return U.badge(r.type, r.type === 'Teaching' ? 'info' : 'neutral'); } },
          { key: 'aug', label: 'August', sortable: false, render: function () { return U.badge('Released', 'success', { icon: 'check' }); } },
          { key: 'sep', label: 'September', sortable: false, render: function () { return U.badge('Pending', 'warning'); } },
          { key: 'a', label: '', sortable: false, cls: 'num', render: function () { return U.btn('View', { size: 'sm', icon: 'receipt', action: 'open-payslip' }); } }
        ],
        rows: W.employees
      }) }) + '</div>'
    );
  });

  HS.on('open-payslip', function () {
    var ps = P.payslip;
    var grossTotal = ps.earnings.reduce(function (a, e) { return a + e[1]; }, 0);
    var dedTotal = ps.deductions.reduce(function (a, e) { return a + e[1]; }, 0);
    U.modal({
      title: 'Payslip — ' + ps.month, sub: ps.name + ' · ' + ps.id + ' · ' + ps.designation, size: 'wide',
      body: '<div class="grid g-2col g-5">' +
        '<div><div class="eyebrow mb-3">Earnings</div>' +
        ps.earnings.map(function (e) {
          return '<div class="row between" style="padding:7px 0;border-bottom:1px solid var(--border-soft)"><span class="t-sm">' + esc(e[0]) + '</span>' +
            '<span class="t-num">' + HS.fmt.money(e[1]) + '</span></div>';
        }).join('') +
        '<div class="row between mt-3"><span class="t-bold">Gross</span><span class="t-bold t-num">' + HS.fmt.money(grossTotal) + '</span></div></div>' +
        '<div><div class="eyebrow mb-3">Deductions</div>' +
        ps.deductions.map(function (e) {
          return '<div class="row between" style="padding:7px 0;border-bottom:1px solid var(--border-soft)"><span class="t-sm">' + esc(e[0]) + '</span>' +
            '<span class="t-num">' + HS.fmt.money(e[1]) + '</span></div>';
        }).join('') +
        '<div class="row between mt-3"><span class="t-bold">Total deductions</span><span class="t-bold t-num">' + HS.fmt.money(dedTotal) + '</span></div></div>' +
        '</div>' +
        '<div class="card card--tint mt-5 row between" style="padding:16px 20px">' +
        '<span class="t-bold">Net pay</span><span class="serif" style="font-size:24px;font-weight:600">' + HS.fmt.money(grossTotal - dedTotal) + '</span></div>' +
        '<div class="mt-4">' + U.dl([['Days worked', '22 of 22'], ['Leave taken', '0 days'], ['Overtime', '0 hours'], ['Payment date', '30 Sep 2026'], ['Bank account', 'XXXX XXXX 4417']]) + '</div>',
      foot: U.btn('Print', { icon: 'printer', action: 'demo', arg: 'Payslip sent to printer' }) +
        U.btn('Download PDF', { variant: 'primary', icon: 'download', action: 'demo-close' })
    });
  });
})(window.HS = window.HS || {});
