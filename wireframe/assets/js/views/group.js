/* ==========================================================================
   VIEWS — Multi-campus group: campuses, group dashboard, comparison,
           transfers, group policies
   ========================================================================== */
(function (HS) {
  'use strict';
  var U = HS.ui, D = HS.data, C = HS.charts, esc = HS.esc;
  var G = D.group;

  function fmtMetric(m, key) {
    return m.format === 'pct' ? HS.fmt.pct(m[key], 1) : HS.fmt.n(m[key]);
  }

  HS.route('group-dashboard', function () {
    var v = HS.vs('group', { view: 'group' });
    var totalStudents = D.campuses.reduce(function (a, c) { return a + c.students; }, 0);
    var totalStaff = D.campuses.reduce(function (a, c) { return a + c.staff; }, 0);

    if (v.view === 'campus') return campusView(v);

    return U.page(
      U.pageHead({
        title: 'Group Dashboard',
        sub: 'Consolidated position across the Edunex group, with each campus visible beside the total.',
        actions: U.segment([{ id: 'group', label: 'Group View' }, { id: 'campus', label: 'Campus View' }], v.view, 'group-view') +
          U.btn('Board pack', { icon: 'fileText', action: 'demo', arg: 'Board pack generated' })
      }) +
      U.grid('g-4col', [
        U.kpi({ label: 'Students', value: HS.fmt.n(totalStudents), tone: '', delta: 4.1, foot: '3 campuses' }),
        U.kpi({ label: 'Staff', value: totalStaff, tone: 'info', foot: '94% of positions filled' }),
        U.kpi({ label: 'Admissions YTD', value: 69, tone: 'teal', delta: 11, foot: 'Group target 210' }),
        U.kpi({ label: 'Group attendance', value: '92.6%', tone: 'teal', delta: -0.8 }),
        U.kpi({ label: 'Fees collected', value: HS.fmt.money(17960000, { compact: true }), tone: 'teal', foot: '82.2% of billed' }),
        U.kpi({ label: 'Outstanding', value: HS.fmt.money(3880000, { compact: true }), tone: 'amber' }),
        U.kpi({ label: 'Parent NPS', value: 52, tone: 'teal', delta: 4 }),
        U.kpi({ label: 'Students needing attention', value: 21, tone: 'critical', route: '#/early-warning' })
      ]) +
      '<div class="mt-5">' + U.card({
        title: 'Campuses', sub: 'Click a campus to switch the whole application to it',
        flush: true,
        body: '<div class="grid g-3col g-4" style="padding:20px">' + D.campuses.map(function (c) {
          return '<button class="card card--link" style="padding:18px;text-align:left" data-action="set-campus" data-arg="' + c.id + '">' +
            '<span class="row between"><span class="avatar avatar--teal">' + HS.icon('building', 18) + '</span>' +
            (c.id === HS.state.campus && HS.state.scope === 'campus' ? U.badge('Current', 'success') : '') + '</span>' +
            '<span class="t-bold" style="display:block;margin-top:12px">' + esc(c.name) + '</span>' +
            '<span class="t-micro t-muted" style="display:block">' + esc(c.place) + ' · since ' + c.established + '</span>' +
            '<span class="t-xs t-muted" style="display:block;margin-top:6px">' + esc(c.curriculum) + '</span>' +
            '<span class="row between mt-4"><span class="col"><span class="t-micro t-muted">Students</span>' +
            '<span class="t-bold t-num">' + HS.fmt.n(c.students) + '</span></span>' +
            '<span class="col"><span class="t-micro t-muted">Staff</span><span class="t-bold t-num">' + c.staff + '</span></span>' +
            '<span class="col"><span class="t-micro t-muted">Attendance</span>' +
            '<span class="t-bold t-num">' + fmtMetric(G.metrics[2], c.id) + '</span></span></span>' +
            '</button>';
        }).join('') + '</div>'
      }) + '</div>' +
      '<div class="mt-4">' + comparisonCard() + '</div>' +
      '<div class="grid g-2col g-4 mt-4">' +
      U.card({ title: 'Students by campus', body: C.donut({ size: 200, thickness: 30, center: HS.fmt.n(totalStudents), centerSub: 'students',
        data: D.campuses.map(function (c, i) { return { label: c.short, value: c.students, color: ['var(--navy)', 'var(--teal)', 'var(--amber)'][i] }; }) }) +
        '<div class="mt-4">' + C.legend(D.campuses.map(function (c, i) { return { label: c.short, color: ['var(--navy)', 'var(--teal)', 'var(--amber)'][i] }; })) + '</div>' }) +
      U.card({ title: 'Inter-campus transfers', sub: 'Movement within the group this term', flush: true,
        body: U.table({ compact: true, cols: [
          { key: 'student', label: 'Student' }, { key: 'from', label: 'From' }, { key: 'to', label: 'To' },
          { key: 'status', label: 'Status', render: function (r) { return U.status(r.status); } }
        ], rows: G.transfers }) }) +
      '</div>'
    );
  });
  HS.on('group-view', function (arg) { HS.vs('group').view = arg; HS.render(); });

  function comparisonCard() {
    return U.card({
      title: 'Campus comparison', sub: 'Every measure, campus by campus. Best in each row is highlighted.',
      flush: true,
      body: '<div class="table-wrap"><table class="table"><thead><tr><th>Measure</th>' +
        D.campuses.map(function (c) { return '<th class="num">' + esc(c.short) + '</th>'; }).join('') +
        '<th class="num">Group</th></tr></thead><tbody>' +
        G.metrics.map(function (m) {
          var vals = D.campuses.map(function (c) { return m[c.id]; });
          var best = Math.max.apply(null, vals);
          var group = m.format === 'pct'
            ? (vals.reduce(function (a, b) { return a + b; }, 0) / vals.length)
            : vals.reduce(function (a, b) { return a + b; }, 0);
          return '<tr><td class="t-bold">' + esc(m.label) + '</td>' +
            D.campuses.map(function (c) {
              var val = m[c.id], isBest = val === best;
              return '<td class="num"><span class="t-num ' + (isBest ? 't-bold t-success' : '') + '">' +
                (m.format === 'pct' ? HS.fmt.pct(val, 1) : HS.fmt.n(val)) + '</span></td>';
            }).join('') +
            '<td class="num t-bold">' + (m.format === 'pct' ? HS.fmt.pct(group, 1) : HS.fmt.n(group)) + '</td></tr>';
        }).join('') + '</tbody></table></div>'
    });
  }

  function campusView(v) {
    var c = HS.campusObj();
    return U.page(
      U.pageHead({
        title: c.name,
        sub: c.place + ' · established ' + c.established + ' · ' + c.curriculum,
        actions: U.segment([{ id: 'group', label: 'Group View' }, { id: 'campus', label: 'Campus View' }], v.view, 'group-view') +
          U.btn('Switch campus', { icon: 'refresh', action: 'open-campus-switcher' })
      }) +
      U.grid('g-4col', G.metrics.map(function (m) {
        var val = m[c.id];
        var others = D.campuses.filter(function (x) { return x.id !== c.id; }).map(function (x) { return m[x.id]; });
        var avg = others.reduce(function (a, b) { return a + b; }, 0) / others.length;
        var delta = Math.round((val - avg) / (avg || 1) * 1000) / 10;
        return U.kpi({ label: m.label, value: m.format === 'pct' ? HS.fmt.pct(val, 1) : HS.fmt.n(val),
          tone: delta >= 0 ? 'teal' : 'amber', delta: delta, deltaUnit: '% vs other campuses' });
      })) +
      '<div class="mt-5">' + comparisonCard() + '</div>'
    );
  }

  HS.route('campuses', function () {
    return U.page(
      U.pageHead({ title: 'Campuses', sub: 'The three campuses in the Edunex group.',
        actions: U.btn('Group dashboard', { variant: 'primary', icon: 'globe', route: '#/group-dashboard' }) }) +
      '<div class="grid g-3col g-4">' + D.campuses.map(function (c, i) {
        return U.card({
          cls: 'card--link',
          body: '<div style="height:86px;margin:-20px -20px 16px;background:linear-gradient(135deg,' +
            ['#151984,#191D9A', '#111469,#151984', '#C27E0A,#D49308'][i] + ');display:grid;place-items:center;color:#fff;border-radius:var(--r-lg) var(--r-lg) 0 0">' +
            HS.icon('building', 28) + '</div>' +
            '<div class="row between"><span class="t-bold">' + esc(c.name) + '</span>' +
            (c.id === HS.state.campus ? U.badge('Current', 'success') : '') + '</div>' +
            '<div class="t-xs t-muted mt-1">' + esc(c.place) + ' · since ' + c.established + '</div>' +
            '<div class="mt-3">' + U.dl([
              ['Curriculum', c.curriculum], ['Students', HS.fmt.n(c.students)], ['Staff', String(c.staff)],
              ['Attendance', HS.fmt.pct(G.metrics[2][c.id], 1)], ['Fee collection', HS.fmt.pct(G.metrics[3][c.id], 1)]
            ]) + '</div>' +
            '<div class="mt-4">' + U.btn('Switch to this campus', { block: true, action: 'set-campus', arg: c.id }) + '</div>'
        });
      }).join('') + '</div>'
    );
  });

  HS.route('campus-comparison', function () {
    return U.page(
      U.pageHead({ title: 'Campus Comparison', sub: 'Benchmarking across the group. The best figure in each row is highlighted.',
        actions: U.btn('Export', { icon: 'download', action: 'demo', arg: 'Comparison exported' }) }) +
      comparisonCard() +
      '<div class="grid g-2col g-4 mt-4">' +
      U.card({ title: 'Attendance', body: C.bar({ labels: D.campuses.map(function (c) { return c.short; }),
        series: [{ name: 'Attendance %', values: D.campuses.map(function (c) { return G.metrics[2][c.id]; }),
          colors: ['var(--navy)', 'var(--teal)', 'var(--amber)'] }], yMax: 100, target: 93, targetLabel: 'Group target', height: 230 }) }) +
      U.card({ title: 'Fee collection', body: C.bar({ labels: D.campuses.map(function (c) { return c.short; }),
        series: [{ name: 'Collection %', values: D.campuses.map(function (c) { return G.metrics[3][c.id]; }),
          colors: ['var(--navy)', 'var(--teal)', 'var(--amber)'] }], yMax: 100, target: 85, targetLabel: 'Group target', height: 230 }) }) +
      U.card({ title: 'Parent engagement and NPS', body: C.bar({ labels: D.campuses.map(function (c) { return c.short; }),
        series: [{ name: 'Engagement', values: D.campuses.map(function (c) { return G.metrics[5][c.id]; }), color: 'var(--navy)' },
                 { name: 'NPS', values: D.campuses.map(function (c) { return G.metrics[6][c.id]; }), color: 'var(--teal)' }], height: 230 }) +
        '<div class="mt-3">' + C.legend([{ label: 'Engagement', color: 'var(--navy)' }, { label: 'NPS', color: 'var(--teal)' }]) + '</div>' }) +
      U.card({ title: 'Academic index', body: C.radar({ size: 250, axes: ['Attainment', 'Progress', 'Coverage', 'Attendance', 'Participation'],
        series: [{ name: 'Guduvanchery', values: [72, 68, 74, 92, 76], color: 'var(--navy)' },
                 { name: 'Vadavalli', values: [69, 71, 68, 93, 64], color: 'var(--teal)' },
                 { name: 'Pollachi', values: [74, 78, 62, 96, 88], color: 'var(--amber)' }] }) +
        '<div class="mt-3">' + C.legend([{ label: 'Guduvanchery', color: 'var(--navy)' }, { label: 'Vadavalli', color: 'var(--teal)' }, { label: 'Pollachi', color: 'var(--amber)' }]) + '</div>' }) +
      '</div>'
    );
  });

  HS.route('transfers', function () {
    return U.page(
      U.pageHead({ title: 'Transfers', sub: 'Students moving between campuses inside the group. The record moves with them.',
        actions: U.btn('New transfer request', { variant: 'primary', icon: 'plus', action: 'not-built', arg: 'Transfer request' }) }) +
      U.card({ body: U.flow([
        { label: 'Request raised', meta: 'By parent or campus', state: 'done' },
        { label: 'Records checked', meta: 'Fees, documents, clearance', state: 'done' },
        { label: 'Under Review', meta: '1 pending', state: 'active' },
        { label: 'Approved', meta: 'Both campus heads' },
        { label: 'Record moved', meta: 'Student 360 travels intact' }
      ]) }) +
      '<div class="mt-4">' + U.card({ flush: true, body: U.table({
        cols: [
          { key: 'student', label: 'Student', render: function (r) { return '<button class="t-bold t-info" data-action="open-student" data-arg="HS-2026-1041">' + esc(r.student) + '</button><div class="t-micro t-muted">' + esc(r.grade) + '</div>'; } },
          { key: 'from', label: 'From' }, { key: 'to', label: 'To' },
          { key: 'reason', label: 'Reason' }, { key: 'date', label: 'Raised' },
          { key: 'status', label: 'Status', render: function (r) { return U.status(r.status); } },
          { key: 'a', label: '', sortable: false, cls: 'num', render: function (r) {
            return r.status === 'Approved' ? '' : U.btn('Review', { size: 'sm', variant: 'primary', action: 'demo', arg: 'Transfer reviewed' });
          } }
        ],
        rows: G.transfers
      }) }) + '</div>'
    );
  });

  HS.route('group-policies', function () {
    return U.page(
      U.pageHead({ title: 'Group Policies', sub: 'Policies that apply across every campus, with version and review status.',
        actions: U.btn('Add policy', { variant: 'primary', icon: 'plus', action: 'not-built', arg: 'Add policy' }) }) +
      U.card({ flush: true, body: U.table({
        cols: [
          { key: 'name', label: 'Policy', render: function (r) { return '<span class="row g-3">' + HS.icon('shield', 16, 't-muted') + '<span class="t-bold">' + esc(r.name) + '</span></span>'; } },
          { key: 'scope', label: 'Scope' }, { key: 'version', label: 'Version' }, { key: 'updated', label: 'Last updated' },
          { key: 'status', label: 'Status', render: function (r) { return U.badge(r.status, r.status === 'Active' ? 'success' : 'warning'); } },
          { key: 'a', label: '', sortable: false, cls: 'num', render: function () { return U.btn('Open', { size: 'sm', action: 'not-built', arg: 'Policy document' }); } }
        ],
        rows: G.policies
      }) })
    );
  });
})(window.HS = window.HS || {});
