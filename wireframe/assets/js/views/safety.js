/* ==========================================================================
   VIEWS — Smart Gate, Gate log, Pickup, Visitors, Bus tracking, Routes,
           Boarding, Emergency, Safeguarding, Infirmary, Counselling
   ========================================================================== */
(function (HS) {
  'use strict';
  var U = HS.ui, D = HS.data, C = HS.charts, esc = HS.esc;
  var S = D.safety, T = D.transport;

  /* ======================================================= SMART GATE ==== */
  HS.route('smart-gate', function () {
    return U.page(
      U.pageHead({
        title: 'Smart Gate',
        sub: 'Live child safety: who has arrived, who is inside, who has left, and who is authorised to collect them.',
        actions: U.btn('Visitor check-in', { icon: 'idCard', route: '#/visitors' }) +
          U.btn('Emergency broadcast', { variant: 'danger', icon: 'megaphone', route: '#/emergency' })
      }) +
      U.grid('g-4col', [
        U.kpi({ label: 'Arrived', value: HS.fmt.n(S.gate.arrived), tone: 'teal', foot: 'Parents notified automatically' }),
        U.kpi({ label: 'Inside campus', value: HS.fmt.n(S.gate.inside), tone: '', foot: 'Live headcount' }),
        U.kpi({ label: 'Exited', value: S.gate.exited, tone: 'amber', foot: 'Early departures, all verified' }),
        U.kpi({ label: 'Visitors on site', value: S.gate.visitors, tone: 'info', foot: '2 awaiting host confirmation' })
      ]) +
      '<div class="grid g-main mt-4">' +
      U.card({
        title: 'Live activity feed', sub: 'Every entry, exit and notification, as it happens',
        actions: U.badge('Live', 'critical', { dot: true }),
        body: U.feed(S.feed)
      }) +
      '<div class="col g-4">' +
      U.card({
        title: 'Gate status', sub: 'Main and rear gates',
        body: '<div class="col g-3">' +
          [['Main Gate', 'Open · staffed by Devendran M.', 'success'],
           ['Rear Gate', 'Cover needed — Saravanan R. absent', 'critical'],
           ['Visitor Gate', 'Open · badge printer online', 'success'],
           ['Bus Bay', 'Open · 5 of 6 buses arrived', 'warning']
          ].map(function (g) {
            return '<div class="row g-3"><span class="dot dot--' + g[2] + '" style="margin-top:6px"></span>' +
              '<span class="col grow"><span class="t-sm t-bold">' + esc(g[0]) + '</span>' +
              '<span class="t-micro t-muted">' + esc(g[1]) + '</span></span></div>';
          }).join('') + '</div>'
      }) +
      U.card({
        title: 'Pickup verification', sub: 'Aditya Kumar · afternoon collection',
        flush: true,
        body: '<div class="card__body">' +
          '<div class="col g-2">' + S.pickupPersons.map(function (p) {
            return '<div class="row g-3 card card--tint" style="padding:10px 12px">' + U.avatar(p.name, { size: 'sm' }) +
              '<span class="col grow" style="min-width:0"><span class="t-sm t-bold t-clip">' + esc(p.name) + '</span>' +
              '<span class="t-micro t-muted">' + esc(p.relation + ' · ' + p.method) + '</span></span>' +
              U.status(p.status) + '</div>';
          }).join('') + '</div>' +
          '<div class="mt-4">' + U.btn('Simulate unauthorised pickup', { block: true, variant: 'danger', icon: 'alert', action: 'gate-unauthorised' }) + '</div>' +
          '</div>'
      }) +
      '</div></div>' +
      '<div class="grid g-2col g-4 mt-4">' +
      U.card({ title: 'Arrivals through the morning', body: C.line({
        labels: ['7:30', '7:45', '8:00', '8:15', '8:30', '8:45', '9:00'],
        series: [{ name: 'Cumulative arrivals', values: [38, 142, 396, 812, 1094, 1156, 1178], color: 'var(--teal)' }], height: 210 }) }) +
      U.card({ title: 'Incidents and audit trail', sub: 'Every safety event is logged and closed with an owner', flush: true,
        body: U.table({ cols: [
          { key: 'id', label: 'Ref' }, { key: 'type', label: 'Type' }, { key: 'summary', label: 'Summary' },
          { key: 'severity', label: 'Severity', render: function (r) { return U.badge(r.severity, r.severity === 'Attention' ? 'warning' : 'info'); } },
          { key: 'status', label: 'Status', render: function (r) { return U.status(r.status); } },
          { key: 'owner', label: 'Owner' }
        ], rows: S.incidents }) }) +
      '</div>'
    );
  });
  HS.on('gate-unauthorised', function () {
    U.modal({
      title: 'Unauthorised pickup attempt', sub: 'Rear Gate · 15:42',
      body: U.banner('<strong>Person not on the authorised list.</strong> The gate device has held the collection and alerted the front office. The child has not been released.', 'critical', 'alert') +
        '<div class="mt-4">' + U.timeline([
          { time: '15:42', title: 'Face and ID do not match any authorised person', tone: 'critical' },
          { time: '15:42', title: 'Collection held, front office alerted', tone: 'critical' },
          { time: '15:43', title: 'Parent called for verbal confirmation', tone: 'amber' },
          { time: '15:45', title: 'Awaiting parent OTP confirmation', tone: 'muted' }
        ]) + '</div>',
      foot: U.btn('Close', { action: 'close-overlay' }) +
        U.btn('Send OTP to parent', { variant: 'primary', icon: 'key', action: 'demo-close' })
    });
  });

  HS.route('gate-log', function () {
    var rows = D.attendance.classRoster.map(function (s, i) {
      return { name: s.name, id: s.id, grade: 'Grade 5A', inTime: ['08:31', '08:12', '08:44', '—', '08:09', '08:22', '08:17', '08:28', '—', '08:19', '08:33', '08:41', '08:14', '08:26', '08:07', '08:36'][i],
        method: i % 3 === 0 ? 'RFID' : i % 3 === 1 ? 'Face' : 'Bus scan', outTime: i === 8 ? '11:50' : '—',
        status: ['—'].indexOf(['08:31', '08:12', '08:44', '—', '08:09', '08:22', '08:17', '08:28', '—', '08:19', '08:33', '08:41', '08:14', '08:26', '08:07', '08:36'][i]) > -1 ? 'Absent' : 'Inside Campus' };
    });
    return U.page(
      U.pageHead({ title: 'Gate Entry / Exit', sub: 'The raw log behind the Smart Gate dashboard. Every scan, with the method used.',
        actions: U.btn('Export log', { icon: 'download', action: 'demo', arg: 'Gate log exported' }) }) +
      U.card({ flush: true, body: U.table({
        rowAction: 'open-student', rowId: function (r) { return r.id; },
        cols: [
          { key: 'name', label: 'Student', render: function (r) { return HS.studentLink({ id: r.id, name: r.name, grade: 'Grade 5', section: 'A' }); } },
          { key: 'inTime', label: 'Entry', render: function (r) { return r.inTime === '—' ? '<span class="t-faint">—</span>' : '<span class="t-num">' + esc(r.inTime) + '</span>'; } },
          { key: 'method', label: 'Method', render: function (r) { return U.badge(r.method, 'neutral'); } },
          { key: 'outTime', label: 'Exit', render: function (r) { return r.outTime === '—' ? '<span class="t-faint">—</span>' : '<span class="t-num">' + esc(r.outTime) + '</span>'; } },
          { key: 'status', label: 'Status', render: function (r) { return U.badge(r.status, r.status === 'Absent' ? 'critical' : 'success', { dot: true }); } },
          { key: 'notify', label: 'Parent notified', sortable: false, render: function (r) { return r.inTime === '—' ? U.badge('Absence alert sent', 'critical') : U.badge('Arrival sent', 'success', { icon: 'check' }); } }
        ],
        rows: rows
      }) })
    );
  });

  HS.route('pickup', function () {
    return U.page(
      U.pageHead({ title: 'Pickup Authorisation', sub: 'Who may collect each child, how they are verified, and what happens when someone is not on the list.',
        actions: U.btn('Add authorised person', { variant: 'primary', icon: 'plus', action: 'not-built', arg: 'Add pickup person' }) }) +
      U.grid('g-4col', [
        U.kpi({ label: 'Authorised persons', value: 2840, tone: '', foot: 'Average 2.2 per family' }),
        U.kpi({ label: 'Verified by QR', value: '68%', tone: 'teal' }),
        U.kpi({ label: 'OTP verifications today', value: 41, tone: 'amber' }),
        U.kpi({ label: 'Held collections today', value: 1, tone: 'critical', foot: 'Resolved — grandparent, OTP verified' })
      ]) +
      '<div class="grid g-main mt-4">' +
      U.card({ title: 'Authorised persons — Aditya Kumar', flush: true, body: U.table({
        cols: [
          { key: 'name', label: 'Person', render: function (r) { return U.person(r.name, r.relation); } },
          { key: 'method', label: 'Verification', render: function (r) { return U.badge(r.method, 'neutral'); } },
          { key: 'status', label: 'Status', render: function (r) { return U.status(r.status); } },
          { key: 'last', label: 'Last collection' }
        ], rows: S.pickupPersons }) }) +
      U.card({ title: 'Verification methods', body: '<div class="col g-4">' +
        [['QR code', 'Parent app shows a rotating code. Scanned at the gate.', 'qr'],
         ['One-time password', 'For anyone without the app. Sent to the registered parent number.', 'key'],
         ['Photo ID capture', 'Stored against the collection record for the audit trail.', 'camera'],
         ['Unauthorised alert', 'Collection is held, front office and parent alerted immediately.', 'alert']
        ].map(function (m) {
          return '<div class="row-top g-3"><span class="avatar none">' + HS.icon(m[2], 17) + '</span>' +
            '<span class="col"><span class="t-sm t-bold">' + esc(m[0]) + '</span>' +
            '<span class="t-xs t-muted">' + esc(m[1]) + '</span></span></div>';
        }).join('') + '</div>' }) +
      '</div>'
    );
  });

  HS.route('visitors', function () {
    return U.page(
      U.pageHead({ title: 'Visitor Management', sub: 'Pre-approval, ID capture, badge printing and check-out — nobody is on campus unaccounted for.',
        actions: U.btn('Check in a visitor', { variant: 'primary', icon: 'plus', action: 'visitor-checkin' }) }) +
      U.grid('g-4col', [
        U.kpi({ label: 'On site now', value: 2, tone: 'info' }),
        U.kpi({ label: 'Today', value: S.visitors.length, tone: '' }),
        U.kpi({ label: 'Pre-approved', value: 3, tone: 'teal' }),
        U.kpi({ label: 'Not checked out', value: 0, tone: 'success', foot: 'Reconciled at 17:30 daily' })
      ]) +
      '<div class="mt-4">' + U.card({ flush: true, body: U.table({
        cols: [
          { key: 'id', label: 'Badge' },
          { key: 'name', label: 'Visitor', render: function (r) { return U.person(r.name, r.purpose); } },
          { key: 'host', label: 'Host' }, { key: 'inTime', label: 'In' }, { key: 'outTime', label: 'Out' },
          { key: 'status', label: 'Status', render: function (r) { return U.badge(r.status, r.status === 'Inside' ? 'info' : 'success', { dot: r.status === 'Inside' }); } },
          { key: 'a', label: '', sortable: false, cls: 'num', render: function (r) {
            return r.status === 'Inside' ? U.btn('Check out', { size: 'sm', action: 'demo', arg: r.name + ' checked out' }) : '';
          } }
        ], rows: S.visitors
      }) }) + '</div>'
    );
  });
  HS.on('visitor-checkin', function () {
    U.modal({
      title: 'Visitor check-in',
      body: '<div class="grid g-2col g-3">' +
        U.field({ label: 'Visitor name' }) +
        U.field({ label: 'Phone', type: 'tel' }) +
        U.field({ type: 'select', label: 'Purpose', options: ['Parent meeting', 'Admission enquiry', 'Vendor / contractor', 'Audit or inspection', 'Other'] }) +
        U.field({ type: 'select', label: 'Host', options: ['Kavitha S.', 'Ms. Priya Raghavan', 'Dr. Meera Krishnan', 'Murugan P.'] }) +
        '</div>' +
        '<div class="mt-4 card card--tint row g-3" style="padding:14px">' + HS.icon('camera', 20) +
        '<span class="col"><span class="t-sm t-bold">ID capture</span><span class="t-micro t-muted">Photograph of the ID is stored against this visit and deleted after 90 days.</span></span></div>',
      foot: U.btn('Cancel', { action: 'close-overlay' }) + U.btn('Print badge and check in', { variant: 'primary', icon: 'printer', action: 'demo-close' })
    });
  });

  /* ==================================================== BUS TRACKING ===== */
  HS.route('bus-tracking', function () {
    var v = HS.vs('bus', { route: 'R12' });
    var r = T.routes.filter(function (x) { return x.id === v.route; })[0] || T.routes[0];
    return U.page(
      U.pageHead({
        title: 'Bus Tracking',
        sub: 'Live location, ETA, onboard count and deviation alerts. Parents see the same position for their own child\'s bus.',
        actions: U.btn('Route planner', { icon: 'route', route: '#/routes' }) +
          U.btn('Notify route parents', { variant: 'primary', icon: 'megaphone', action: 'demo', arg: 'Notification drafted for parents on this route' })
      }) +
      '<div class="grid g-side">' +
      U.card({
        title: 'Routes', sub: T.routes.length + ' buses · ' + T.routes.reduce(function (a, x) { return a + x.students; }, 0) + ' students', flush: true,
        body: '<div>' + T.routes.map(function (x) {
          var tone = x.status === 'Delayed' ? 'warning' : x.status === 'Maintenance' ? 'critical' : x.status === 'At campus' ? 'success' : 'info';
          return '<button class="alert-item alert-item--' + tone + '" data-action="bus-route" data-arg="' + x.id + '"' +
            (x.id === v.route ? ' style="background:var(--surface-alt)"' : '') + '>' +
            '<span class="alert-item__ico alert-item__ico--' + tone + '">' + HS.icon('bus', 16) + '</span>' +
            '<span class="grow" style="min-width:0"><span class="alert-item__title" style="display:block">' + esc(x.bus.split(' · ')[0]) + ' · ' + esc(x.area) + '</span>' +
            '<span class="alert-item__meta" style="display:block">' + x.onboard + '/' + x.students + ' onboard · ' + esc(x.eta) + '</span></span>' +
            U.badge(x.status, tone) + '</button>';
        }).join('') + '</div>'
      }) +
      '<div class="col g-4">' +
      U.card({
        title: r.bus, sub: r.area + ' · ' + r.stops + ' stops · driver ' + r.driver + ' · attendant ' + r.attendant,
        actions: U.badge(r.status, r.status === 'Delayed' ? 'warning' : r.status === 'Maintenance' ? 'critical' : 'success', { dot: true }),
        body: '<div class="map" style="height:300px">' +
          '<svg viewBox="0 0 800 300" style="position:absolute;inset:0;width:100%;height:100%">' +
          '<path d="M60 250 L180 235 L260 180 L380 165 L470 120 L600 95 L700 60" fill="none" stroke="var(--navy)" stroke-width="3" stroke-dasharray="7 5" opacity=".5"/>' +
          '<path d="M60 250 L180 235 L260 180 L380 165" fill="none" stroke="var(--teal)" stroke-width="4"/>' +
          [[60, 250], [180, 235], [260, 180], [380, 165], [470, 120], [600, 95]].map(function (p, i) {
            return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="6" fill="' + (i < 4 ? 'var(--teal)' : '#fff') + '" stroke="' + (i < 4 ? 'var(--teal)' : 'var(--navy)') + '" stroke-width="2.5"/>';
          }).join('') +
          '</svg>' +
          '<span class="map__pin" style="left:47.5%;top:55%">' + HS.mapPins.bus() + '</span>' +
          '<span class="map__label" style="left:47.5%;top:57%">' + esc(r.bus.split(' · ')[0]) + ' · ' + esc(r.eta) + '</span>' +
          '<span class="map__pin" style="left:87.5%;top:20%">' + HS.mapPins.school() + '</span>' +
          '<span class="map__label" style="left:87.5%;top:22%">Edunex Campus</span>' +
          (r.status === 'Delayed' ? '<div style="position:absolute;left:16px;top:16px">' + U.badge('Deviation alert — road closure detour', 'critical', { dot: true, lg: true }) + '</div>' : '') +
          '</div>' +
          '<div class="grid g-4col g-3 mt-4">' +
          '<div class="statstrip__item" style="border:0;padding:0"><div class="statstrip__label">Onboard</div><div class="statstrip__value">' + r.onboard + '/' + r.students + '</div></div>' +
          '<div class="statstrip__item" style="border:0;padding:0"><div class="statstrip__label">ETA</div><div class="statstrip__value">' + esc(r.eta) + '</div></div>' +
          '<div class="statstrip__item" style="border:0;padding:0"><div class="statstrip__label">Stops done</div><div class="statstrip__value">' + (r.status === 'At campus' ? r.stops : Math.round(r.stops * .6)) + '/' + r.stops + '</div></div>' +
          '<div class="statstrip__item" style="border:0;padding:0"><div class="statstrip__label">Delay</div><div class="statstrip__value ' + (r.delay ? 't-critical' : '') + '">' + (r.delay ? '+' + r.delay + ' min' : 'On time') + '</div></div>' +
          '</div>'
      }) +
      '<div class="grid g-2col g-4">' +
      U.card({ title: 'Stop sequence', sub: 'Morning run', flush: true, body:
        '<div class="card__body">' + U.timeline(T.stops.map(function (s) {
          return { time: s.time, title: s.name, body: s.note || '', tone: s.done ? 'teal' : 'muted' };
        })) + '</div>' }) +
      U.card({ title: 'Boarding and de-boarding', sub: 'Confirmed by the attendant device', flush: true, body: U.table({
        compact: true,
        cols: [
          { key: 'student', label: 'Student', render: function (r2) { return '<button class="t-bold t-info" data-action="open-student" data-arg="HS-2026-1041">' + esc(r2.student) + '</button>'; } },
          { key: 'board', label: 'Boarded', render: function (r2) { return U.badge(r2.board, 'success', { icon: 'check' }); } },
          { key: 'off', label: 'De-boarded', render: function (r2) { return r2.off === '—' ? '<span class="t-faint">—</span>' : U.badge(r2.off, 'success', { icon: 'check' }); } }
        ],
        rows: [
          { student: 'Aditya Kumar', board: '07:52', off: '08:29' },
          { student: 'Bhavana Iyer', board: '07:56', off: '08:29' },
          { student: 'Surya Kumar', board: '08:03', off: '08:29' },
          { student: 'Harini Prasad', board: '08:09', off: '08:29' },
          { student: 'Keerthi Pillai', board: '08:14', off: '08:29' }
        ]
      }) }) +
      '</div></div></div>'
    );
  });
  HS.on('bus-route', function (arg) { HS.vs('bus').route = arg; HS.render(); });

  HS.route('routes', function () {
    return U.page(
      U.pageHead({ title: 'Routes', sub: 'Route configuration, vehicle assignment and staffing.',
        actions: U.btn('Add route', { variant: 'primary', icon: 'plus', action: 'not-built', arg: 'Add route' }) }) +
      U.card({ flush: true, body: U.table({
        rowAction: 'bus-route-go', rowId: function (r) { return r.id; },
        cols: [
          { key: 'id', label: 'Route' },
          { key: 'bus', label: 'Vehicle', render: function (r) { return '<span class="t-bold">' + esc(r.bus) + '</span><div class="t-micro t-muted">' + esc(r.area) + '</div>'; } },
          { key: 'driver', label: 'Driver' }, { key: 'attendant', label: 'Attendant' },
          { key: 'students', label: 'Students', cls: 'num' }, { key: 'stops', label: 'Stops', cls: 'num' },
          { key: 'status', label: 'Status', render: function (r) { return U.badge(r.status, r.status === 'Delayed' ? 'warning' : r.status === 'Maintenance' ? 'critical' : 'success'); } }
        ], rows: T.routes
      }) })
    );
  });
  HS.on('bus-route-go', function (id) { HS.vs('bus').route = id; HS.go('#/bus-tracking'); });

  HS.route('boarding', function () {
    return U.page(
      U.pageHead({ title: 'Boarding / De-boarding', sub: 'Every child is accounted for at both ends of every journey.' }) +
      U.grid('g-4col', [
        U.kpi({ label: 'Boarded this morning', value: 152, tone: 'teal' }),
        U.kpi({ label: 'De-boarded at campus', value: 152, tone: 'teal', foot: 'Reconciled — no discrepancy' }),
        U.kpi({ label: 'Did not board', value: 12, tone: 'amber', foot: 'Parents notified' }),
        U.kpi({ label: 'Afternoon run', value: '15:40', tone: 'info', foot: 'Starts in 6 hours' })
      ]) +
      '<div class="mt-4">' + U.card({ title: 'Reconciliation by route', flush: true, body: U.table({
        cols: [
          { key: 'id', label: 'Route' }, { key: 'area', label: 'Area' },
          { key: 'students', label: 'Expected', cls: 'num' }, { key: 'onboard', label: 'Boarded', cls: 'num' },
          { key: 'diff', label: 'Difference', render: function (r) {
            var d = r.students - r.onboard;
            return d === 0 ? U.badge('Matched', 'success', { icon: 'check' }) : U.badge(d + ' not boarded', 'warning');
          } },
          { key: 'status', label: 'Status', render: function (r) { return U.badge(r.status, r.status === 'Maintenance' ? 'critical' : 'neutral'); } }
        ], rows: T.routes
      }) }) + '</div>'
    );
  });

  /* ========================================================= EMERGENCY === */
  HS.route('emergency', function () {
    return U.page(
      U.pageHead({ title: 'Emergency Alerts', sub: 'One action reaches every audience at once. Every broadcast is logged with who sent it and why.' }) +
      U.card({ cls: 'card--navy', body:
        '<div class="row-top g-5 wrap">' +
        '<div class="grow" style="min-width:260px"><div class="eyebrow" style="color:#E0A94F">Immediate broadcast</div>' +
        '<h2 class="h1 mt-2" style="color:#fff">Emergency broadcast</h2>' +
        '<p class="t-sm mt-2" style="color:#A9C2D6;max-width:52ch">Reaches parents, teachers, staff and management simultaneously across the app, WhatsApp and SMS. Use only for genuine emergencies. Every use is audited.</p>' +
        '<div class="row g-3 mt-4 wrap">' +
        U.btn('Compose broadcast', { variant: 'danger', size: 'lg', icon: 'megaphone', action: 'emergency-compose' }) +
        U.btn('Run a drill instead', { variant: 'onnavy', size: 'lg', icon: 'shield', action: 'demo', arg: 'Drill scheduled — marked clearly as a drill in every message' }) +
        '</div></div>' +
        '<div class="none col g-2" style="min-width:220px">' +
        [['Parents', '1,102 accounts'], ['Teachers', '118 staff'], ['Non-teaching staff', '125 staff'], ['Management', '9 people']].map(function (a) {
          return '<div class="row between" style="background:rgba(255,255,255,.07);border-radius:8px;padding:9px 12px">' +
            '<span class="t-sm" style="color:#fff">' + esc(a[0]) + '</span><span class="t-micro" style="color:#86A5BC">' + esc(a[1]) + '</span></div>';
        }).join('') + '</div></div>' }) +
      '<div class="grid g-2col g-4 mt-4">' +
      U.card({ title: 'Broadcast history', flush: true, body: U.table({
        cols: [{ key: 'when', label: 'When' }, { key: 'what', label: 'Message' },
               { key: 'reach', label: 'Reach', cls: 'num' },
               { key: 'type', label: 'Type', render: function (r) { return U.badge(r.type, r.type === 'Drill' ? 'info' : r.type === 'Emergency' ? 'critical' : 'neutral'); } }],
        rows: [
          { when: '05 Sep 11:20', what: 'Fire drill — evacuate to the assembly ground', reach: 1354, type: 'Drill' },
          { when: '18 Aug 07:10', what: 'Heavy rain — school closed today', reach: 1354, type: 'Emergency' },
          { when: '02 Jul 14:45', what: 'Power outage — early dismissal for Primary', reach: 486, type: 'Emergency' },
          { when: '12 Jun 09:00', what: 'Lockdown drill — Secondary block', reach: 620, type: 'Drill' }
        ]
      }) }) +
      U.card({ title: 'Incident and audit trail', sub: 'Every safety event, open or closed', flush: true, body: U.table({
        cols: [{ key: 'date', label: 'Date' }, { key: 'summary', label: 'Incident' },
               { key: 'status', label: 'Status', render: function (r) { return U.status(r.status); } },
               { key: 'owner', label: 'Owner' }],
        rows: S.incidents
      }) }) +
      '</div>'
    );
  });
  HS.on('emergency-compose', function () {
    U.modal({
      title: 'Emergency broadcast', sub: 'This reaches 1,354 people immediately',
      body: U.banner('<strong>Confirm before sending.</strong> Emergency broadcasts bypass quiet hours and per-user notification settings.', 'critical', 'alert') +
        '<div class="mt-4 col g-3">' +
        U.field({ type: 'select', label: 'Type', options: ['Emergency', 'Drill (clearly labelled)', 'Urgent operational notice'] }) +
        U.field({ type: 'textarea', label: 'Message', rows: 3, placeholder: 'Say what is happening and what people should do.' }) +
        '<div><div class="label mb-2">Send to</div><div class="row g-3 wrap">' +
        ['Parents', 'Teachers', 'Staff', 'Management'].map(function (a) {
          return '<label class="check"><input type="checkbox" checked> ' + a + '</label>';
        }).join('') + '</div></div>' +
        U.field({ type: 'select', label: 'Channels', options: ['App + WhatsApp + SMS', 'App + WhatsApp', 'SMS only'] }) +
        '</div>',
      foot: U.btn('Cancel', { action: 'close-overlay' }) +
        U.btn('Send broadcast now', { variant: 'danger', icon: 'megaphone', action: 'emergency-send' })
    });
  });
  HS.on('emergency-send', function () { U.closeOverlay(); U.toast('Broadcast sent to 1,354 recipients — logged in the audit trail', 'critical', 'megaphone'); });

  /* ====================================================== SAFEGUARDING === */
  HS.route('safeguarding', function () {
    return U.page(
      U.pageHead({ title: 'Safeguarding', sub: 'Restricted module. Concerns are logged the same day and reviewed by the Designated Safeguarding Lead within 24 hours.',
        actions: U.btn('Log a concern', { variant: 'primary', icon: 'shield', action: 'not-built', arg: 'Safeguarding concern form' }) }) +
      U.banner('<strong>Access is restricted.</strong> Only the Designated Safeguarding Lead, the Principal and the counsellor can open individual records. Every view is recorded in the audit trail.', 'warning', 'lock') +
      '<div class="grid g-4col g-4 mt-4">' +
      U.kpi({ label: 'Open concerns', value: 0, tone: 'teal' }) +
      U.kpi({ label: 'Closed this year', value: 2, tone: '', foot: 'Both within 24 h of being raised' }) +
      U.kpi({ label: 'Staff trained', value: '96%', tone: 'teal', foot: 'Refresher due 15 Oct' }) +
      U.kpi({ label: 'External referrals', value: 0, tone: 'info' }) +
      '</div>' +
      '<div class="mt-4">' + U.card({ title: 'Escalation path', body: U.flow([
        { label: 'Concern observed', meta: 'Any staff member', state: 'done' },
        { label: 'Logged same day', meta: 'Within the system, not on paper', state: 'done' },
        { label: 'DSL review', meta: 'Within 24 hours', state: 'active' },
        { label: 'Decision', meta: 'Record only, support plan, or referral' },
        { label: 'Principal informed', meta: 'For every external referral' }
      ]) }) + '</div>' +
      '<div class="mt-4">' + U.card({ title: 'Training and compliance', flush: true, body: U.table({
        cols: [{ key: 'item', label: 'Requirement' }, { key: 'owner', label: 'Owner' }, { key: 'due', label: 'Due' },
               { key: 'status', label: 'Status', render: function (r) { return U.status(r.status); } }],
        rows: D.operations.compliance.filter(function (c) { return /child|background|Fire/.test(c.item); })
      }) }) + '</div>'
    );
  });

  /* ========================================================= INFIRMARY === */
  HS.route('infirmary', function () {
    return U.page(
      U.pageHead({ title: 'Health & Infirmary', sub: 'Visits, actions taken and the parents informed. Health notes feed the restricted Wellbeing tab on each profile.',
        actions: U.btn('Log a visit', { variant: 'primary', icon: 'plus', action: 'not-built', arg: 'Infirmary visit form' }) }) +
      U.grid('g-4col', [
        U.kpi({ label: 'Visits today', value: S.infirmary.length, tone: '' }),
        U.kpi({ label: 'Sent home', value: 1, tone: 'amber' }),
        U.kpi({ label: 'Visits this month', value: 64, tone: 'info', delta: -9, inverse: true }),
        U.kpi({ label: 'Medication on file', value: 23, unit: 'students', tone: 'critical', foot: 'Allergy or condition flagged' })
      ]) +
      '<div class="grid g-main mt-4">' +
      U.card({ title: 'Today\'s visits', flush: true, body: U.table({
        cols: [
          { key: 'student', label: 'Student', render: function (r) { return '<button class="t-bold t-info" data-action="open-student" data-arg="HS-2026-1041">' + esc(r.student) + '</button><div class="t-micro t-muted">' + esc(r.grade) + '</div>'; } },
          { key: 'time', label: 'Time' }, { key: 'reason', label: 'Reason' }, { key: 'action', label: 'Action taken' },
          { key: 'status', label: 'Outcome', render: function (r) { return U.badge(r.status, r.status === 'Awaiting pickup' ? 'warning' : 'success'); } }
        ], rows: S.infirmary
      }) }) +
      U.card({ title: 'Reasons this term', body: C.hbar({ rows: [
        { label: 'Headache', value: 21, color: 'var(--navy)' }, { label: 'Minor injury', value: 18, color: 'var(--teal)' },
        { label: 'Fever', value: 12, color: 'var(--amber)' }, { label: 'Stomach ache', value: 9, color: 'var(--viz-4)' },
        { label: 'Allergy', value: 4, color: 'var(--critical)' }
      ], labelW: 110, rowH: 30 }) }) +
      '</div>'
    );
  });

  HS.route('counselling', function () {
    return U.page(
      U.pageHead({ title: 'Counselling', sub: 'Sessions, referrals and follow-up. Individual notes are restricted to the counsellor and the Principal.' }) +
      U.grid('g-4col', [
        U.kpi({ label: 'Students supported', value: 11, tone: '' }),
        U.kpi({ label: 'Sessions this term', value: 41, tone: 'info' }),
        U.kpi({ label: 'Open cases', value: 4, tone: 'amber' }),
        U.kpi({ label: 'External referrals', value: 1, tone: 'critical', foot: 'Wellbeing First Counselling' })
      ]) +
      '<div class="mt-4">' + U.card({ title: 'Referral sources', sub: 'Where support requests come from',
        body: C.donut({ size: 190, thickness: 28, center: '41', centerSub: 'sessions', data: [
          { label: 'Class teacher', value: 18, color: 'var(--navy)' },
          { label: 'Early Warning signal', value: 11, color: 'var(--amber)' },
          { label: 'Parent request', value: 8, color: 'var(--teal)' },
          { label: 'Student self-referral', value: 4, color: 'var(--viz-4)' }
        ] }) + '<div class="mt-4">' + C.legend([
          { label: 'Class teacher', color: 'var(--navy)' }, { label: 'Early Warning signal', color: 'var(--amber)' },
          { label: 'Parent request', color: 'var(--teal)' }, { label: 'Student self-referral', color: 'var(--viz-4)' }
        ]) + '</div>' }) + '</div>'
    );
  });
})(window.HS = window.HS || {});
