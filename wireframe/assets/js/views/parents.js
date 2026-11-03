/* ==========================================================================
   VIEWS — Parent 360 app, Parent directory, Communication, PTM, Circulars,
           Events, Acknowledgements
   ========================================================================== */
(function (HS) {
  'use strict';
  var U = HS.ui, D = HS.data, C = HS.charts, esc = HS.esc;

  /* ====================================================== PARENT 360 ===== */
  var PTABS = [
    { id: 'home', label: 'Home', icon: 'home' },
    { id: 'academics', label: 'Academics', icon: 'bookOpen' },
    { id: 'safety', label: 'Safety', icon: 'shield' },
    { id: 'fees', label: 'Fees', icon: 'wallet' },
    { id: 'more', label: 'More', icon: 'menu' }
  ];

  function mcard(inner, cls) { return '<div class="mcard ' + (cls || '') + '" style="margin:0 12px 12px">' + inner + '</div>'; }
  function msection(title, right) {
    return '<div class="row between" style="padding:16px 16px 8px"><span class="t-sm t-bold">' + esc(title) + '</span>' +
      (right || '') + '</div>';
  }

  function phoneHome() {
    return '<div style="background:linear-gradient(135deg,var(--magenta-dark),var(--magenta-deep));color:#fff;padding:4px 16px 20px">' +
      '<div class="row between"><div><div class="t-micro" style="color:var(--gold)">' + esc(HS.t('Good Morning')) + '</div>' +
      '<div class="serif" style="font-size:20px;font-weight:700">Ranjith</div></div>' +
      '<div class="row g-2">' + HS.icon('bell', 20) + HS.icon('message', 20) + '</div></div>' +
      '<button class="row g-3" style="width:100%;margin-top:14px;background:rgba(255,255,255,.1);border:1px solid rgba(121, 243, 229,.25);border-radius:10px;padding:10px 12px" data-action="demo" data-arg="Child switcher — a parent with more than one child switches here">' +
      '<span class="avatar avatar--amber">AK</span>' +
      '<span class="col grow" style="text-align:left"><span class="t-sm t-bold" style="color:#fff">Aditya — Grade 5A</span>' +
      '<span class="t-micro" style="color:var(--gold)">Edunex International · Emerald House</span></span>' +
      HS.icon('chevronDown', 16) + '</button></div>' +

      '<div style="margin-top:-10px">' +
      mcard('<div class="row g-3"><span class="avatar avatar--teal none">' + HS.icon('shieldCheck', 18) + '</span>' +
        '<div class="grow"><div class="t-sm t-bold">Arrived safely at 08:31</div>' +
        '<div class="t-micro t-muted">Main Gate · you were notified at 08:32</div></div>' +
        U.badge('Inside campus', 'success', { dot: true }) + '</div>') +

      mcard('<div class="row between"><div class="row g-3"><span class="avatar none" style="background:var(--navy)">' + HS.icon('bus', 18) + '</span>' +
        '<div><div class="t-sm t-bold">Bus 12 — afternoon run</div>' +
        '<div class="t-micro t-muted">Departs campus 15:40 · home stop 16:12</div></div></div></div>' +
        '<div class="mt-3">' + U.btn('Track bus', { size: 'sm', block: true, icon: 'mapPin', action: 'parent-tab', arg: 'safety' }) + '</div>') +

      msection('This week') +
      '<div style="padding:0 12px 12px"><div class="grid g-2col g-3">' +
      [['Attendance', '94%', 'teal', 'checkSquare'], ['Homework', '3 open', 'amber', 'edit'],
       ['Next test', '22 Sep', 'info', 'clipboard'], ['Fees due', '₹22,000', 'critical', 'wallet']
      ].map(function (k) {
        return '<div class="mcard"><div class="row g-2">' + HS.icon(k[3], 15) + '<span class="t-micro t-muted">' + esc(k[0]) + '</span></div>' +
          '<div class="t-bold t-' + (k[2] === 'teal' ? 'success' : k[2]) + '" style="font-size:17px;margin-top:4px">' + esc(k[1]) + '</div></div>';
      }).join('') + '</div></div>' +

      msection('Academic progress', '<button class="t-xs t-info" data-action="parent-tab" data-arg="academics">See all</button>') +
      mcard(D.student360['HS-2026-1041'].subjects.slice(0, 4).map(function (s) {
        return '<div style="margin-bottom:10px">' + U.meter({ label: s.name, value: s.score, right: s.score + ' · ' + s.grade, tone: s.score >= 80 ? 'teal' : s.score >= 70 ? 'info' : 'amber' }) + '</div>';
      }).join('')) +

      msection('Achievements') +
      mcard('<div class="row g-3"><span class="avatar avatar--amber none">' + HS.icon('award', 18) + '</span>' +
        '<div class="grow"><div class="t-sm t-bold">District Robotics Challenge — 2nd place</div>' +
        '<div class="t-micro t-muted">12 Aug 2026 · verified by the school</div></div></div>') +

      msection('School events') +
      '<div style="padding:0 12px 16px">' + D.parents.events.slice(0, 3).map(function (e) {
        return '<div class="mcard" style="margin-bottom:8px"><div class="row g-3">' +
          '<span class="col none t-center" style="width:44px"><span class="t-micro t-muted">' + esc(e.date.split(' ')[1] || 'Sep') + '</span>' +
          '<span class="t-bold" style="font-size:16px">' + esc(e.date.split(' ')[0]) + '</span></span>' +
          '<span class="col grow"><span class="t-sm t-bold">' + esc(e.title) + '</span>' +
          '<span class="t-micro t-muted">' + esc(e.place) + '</span></span></div></div>';
      }).join('') + '</div></div>';
  }

  function phoneAcademics() {
    var d = D.student360['HS-2026-1041'];
    return '<div class="appbar"><span class="t-bold">Academics</span><span class="spacer"></span>' + HS.icon('download', 18) + '</div>' +
      '<div style="padding-top:12px">' +
      mcard('<div class="row between mb-3"><span class="t-sm t-bold">Term 3 progress</span>' + U.badge('On Track', 'success') + '</div>' +
        C.line({ labels: d.termTrend.labels, series: [{ name: 'Average', values: d.termTrend.values, color: 'var(--teal)' }], yMin: 55, yMax: 90, height: 150, showDots: false })) +
      msection('Subject performance') +
      mcard(d.subjects.map(function (s) {
        return '<div class="mrow"><span class="grow"><span class="t-sm t-bold">' + esc(s.name) + '</span>' +
          '<div class="t-micro t-muted">' + esc(s.teacher) + '</div></span>' +
          '<span class="col t-right none"><span class="t-bold t-num">' + s.score + '</span>' +
          '<span class="t-micro ' + (s.trend >= 0 ? 't-success' : 't-critical') + '">' + (s.trend >= 0 ? '+' : '') + s.trend + '</span></span></div>';
      }).join('')) +
      msection('Teacher comment') +
      mcard('<p class="t-sm">' + esc(d.observations[0].text) + '</p>' +
        '<div class="t-micro t-muted mt-2">' + esc(d.observations[0].by + ' · ' + d.observations[0].date) + '</div>') +
      msection('Homework', '<span class="t-xs t-muted">3 open</span>') +
      mcard(D.academics.homework.slice(0, 3).map(function (h) {
        return '<div class="mrow"><span class="grow"><span class="t-sm">' + esc(h.title) + '</span>' +
          '<div class="t-micro t-muted">' + esc(h.subject) + ' · due ' + esc(h.due) + '</div></span>' +
          U.badge(h.status === 'Closing today' ? 'Due today' : 'Open', h.status === 'Closing today' ? 'warning' : 'info') + '</div>';
      }).join('')) +
      msection('Upcoming assessments') +
      mcard('<div class="mrow"><span class="grow"><span class="t-sm t-bold">Term 3 Mathematics — Fractions</span>' +
        '<div class="t-micro t-muted">22 Sep · 50 marks</div></span>' + HS.icon('calendar', 16) + '</div>' +
        '<div class="mrow"><span class="grow"><span class="t-sm t-bold">Term 3 Science — States of Matter</span>' +
        '<div class="t-micro t-muted">Completed 15 Sep · result pending</div></span>' + U.badge('Marking', 'warning') + '</div>') +
      '<div style="height:16px"></div></div>';
  }

  function phoneSafety() {
    return '<div class="appbar"><span class="t-bold">Safety</span></div>' +
      '<div style="padding-top:12px">' +
      mcard('<div class="row g-3"><span class="avatar avatar--teal none">' + HS.icon('shieldCheck', 18) + '</span>' +
        '<div class="grow"><div class="t-sm t-bold">Child arrived safely</div>' +
        '<div class="t-micro t-muted">Main Gate · 08:31 · RFID verified</div></div></div>' +
        '<div class="mt-3">' + U.timeline([
          { time: '08:31', title: 'Gate entry recorded', tone: 'teal' },
          { time: '08:29', title: 'Bus 12 arrived at campus', tone: '' },
          { time: '07:52', title: 'Boarded at Lake View Avenue', tone: 'amber' }
        ]) + '</div>') +
      msection('Bus 12 — live') +
      mcard('<div class="map" style="height:150px;margin:-4px -4px 10px">' +
        '<span class="map__pin" style="left:30%;top:64%">' + busPin() + '</span>' +
        '<span class="map__label" style="left:30%;top:66%">Bus 12</span>' +
        '<span class="map__pin" style="left:76%;top:30%">' + schoolPin() + '</span>' +
        '<span class="map__label" style="left:76%;top:32%">Campus</span>' +
        '</div>' +
        '<div class="row between"><span class="t-sm t-bold">Arriving in 12 minutes</span>' + U.badge('On time', 'success') + '</div>' +
        '<div class="t-micro t-muted mt-1">Driver Selvaraj K. · Attendant Lakshmi A.</div>') +
      msection('Boarding status') +
      mcard('<div class="mrow"><span class="grow t-sm">Aditya boarded</span>' + U.badge('07:52 ✓', 'success') + '</div>' +
        '<div class="mrow"><span class="grow t-sm">Aditya exited bus</span>' + U.badge('08:29 ✓', 'success') + '</div>' +
        '<div class="mrow"><span class="grow t-sm">Gate entry</span>' + U.badge('08:31 ✓', 'success') + '</div>') +
      msection('Pickup authorisation', '<button class="t-xs t-info" data-action="not-built" data-arg="Manage pickup persons">Manage</button>') +
      mcard(D.safety.pickupPersons.map(function (p) {
        return '<div class="mrow"><span class="avatar avatar--sm none">' + esc(HS.fmt.initials(p.name)) + '</span>' +
          '<span class="grow"><span class="t-sm">' + esc(p.name) + '</span>' +
          '<div class="t-micro t-muted">' + esc(p.relation + ' · ' + p.method) + '</div></span>' +
          U.status(p.status) + '</div>';
      }).join('')) +
      '<div style="height:16px"></div></div>';
  }

  function phoneFees() {
    var acc = D.finance.studentAccount;
    var due = acc.lines.reduce(function (a, l) { return a + (l.due - l.paid); }, 0);
    return '<div class="appbar"><span class="t-bold">Fees</span><span class="spacer"></span>' + HS.icon('receipt', 18) + '</div>' +
      '<div style="padding-top:12px">' +
      mcard('<div class="t-micro t-muted">Total outstanding</div>' +
        '<div class="serif" style="font-size:30px;font-weight:600;color:var(--critical)">' + HS.fmt.money(due) + '</div>' +
        '<div class="t-micro t-muted">Next instalment due 25 Sep 2026</div>' +
        '<div class="row g-2 mt-3">' + U.btn(HS.t('Pay Now'), { variant: 'teal', block: true, icon: 'creditCard', action: 'parent-pay' }) + '</div>') +
      msection('Account breakdown') +
      mcard(acc.lines.map(function (l) {
        return '<div class="mrow"><span class="grow"><span class="t-sm">' + esc(l.head) + '</span>' +
          '<div class="t-micro t-muted">Due ' + esc(l.dueDate) + '</div></span>' +
          '<span class="col t-right none"><span class="t-sm t-bold t-num">' + HS.fmt.money(l.due) + '</span>' +
          U.status(l.status) + '</span></div>';
      }).join('')) +
      msection('Receipts') +
      mcard('<div class="mrow"><span class="grow"><span class="t-sm">Term 2 tuition + transport</span>' +
        '<div class="t-micro t-muted">Paid 09 Jul 2026 · UPI</div></span>' +
        U.btn('PDF', { size: 'sm', icon: 'download', action: 'demo', arg: 'Receipt downloaded' }) + '</div>' +
        '<div class="mrow"><span class="grow"><span class="t-sm">Term 1 tuition + transport</span>' +
        '<div class="t-micro t-muted">Paid 08 Apr 2026 · Net banking</div></span>' +
        U.btn('PDF', { size: 'sm', icon: 'download', action: 'demo', arg: 'Receipt downloaded' }) + '</div>') +
      '<div style="height:16px"></div></div>';
  }

  function phoneMore() {
    return '<div class="appbar"><span class="t-bold">More</span></div>' +
      '<div style="padding-top:12px">' +
      msection('Parent–teacher meeting') +
      mcard(D.parents.ptm.slice(0, 3).map(function (p) {
        var full = p.booked >= p.slots;
        return '<div class="mrow"><span class="grow"><span class="t-sm t-bold">' + esc(p.teacher) + '</span>' +
          '<div class="t-micro t-muted">' + esc(p.subject + ' · ' + p.date) + '</div>' +
          '<div class="t-micro ' + (full ? 't-critical' : 't-muted') + '">' + (p.slots - p.booked) + ' of ' + p.slots + ' slots left</div></span>' +
          U.btn(full ? 'Full' : 'Book', { size: 'sm', variant: full ? 'ghost' : 'primary', disabled: full, action: 'parent-ptm', arg: p.teacher }) + '</div>';
      }).join('')) +
      msection('Circulars', '<span class="t-xs t-muted">2 need acknowledgement</span>') +
      mcard(D.parents.circulars.slice(0, 4).map(function (c) {
        return '<div class="mrow"><span class="grow"><span class="t-sm">' + esc(c.title) + '</span>' +
          '<div class="t-micro t-muted">' + esc(c.date) + '</div></span>' +
          (c.status === 'Draft' ? '' : U.btn('Acknowledge', { size: 'sm', action: 'demo', arg: 'Acknowledged — recorded against your child' })) + '</div>';
      }).join('')) +
      msection('Contact the school') +
      mcard('<div class="mrow"><span class="grow t-sm">Message class teacher</span>' + HS.icon('message', 16) + '</div>' +
        '<div class="mrow"><span class="grow t-sm">Report an absence</span>' + HS.icon('calendar', 16) + '</div>' +
        '<div class="mrow"><span class="grow t-sm">Update pickup persons</span>' + HS.icon('key', 16) + '</div>' +
        '<div class="mrow"><span class="grow t-sm">Language — English / தமிழ்</span>' + HS.icon('globe', 16) + '</div>') +
      '<div style="height:16px"></div></div>';
  }

  function busPin() {
    return '<svg width="28" height="34" viewBox="0 0 28 34"><path d="M14 0C6.3 0 0 6.3 0 14c0 9.8 14 20 14 20s14-10.2 14-20c0-7.7-6.3-14-14-14z" fill="var(--amber)"/><circle cx="14" cy="13" r="8" fill="#fff"/><text x="14" y="17" text-anchor="middle" font-size="9" font-weight="700" fill="var(--amber)">12</text></svg>';
  }
  function schoolPin() {
    return '<svg width="26" height="32" viewBox="0 0 28 34"><path d="M14 0C6.3 0 0 6.3 0 14c0 9.8 14 20 14 20s14-10.2 14-20c0-7.7-6.3-14-14-14z" fill="var(--navy)"/><circle cx="14" cy="13" r="7" fill="#fff"/></svg>';
  }
  HS.mapPins = { bus: busPin, school: schoolPin };

  function phoneScreen(tab) {
    var body = tab === 'academics' ? phoneAcademics() : tab === 'safety' ? phoneSafety() :
      tab === 'fees' ? phoneFees() : tab === 'more' ? phoneMore() : phoneHome();
    return '<div class="device__status"><span>9:41</span><span class="row g-2">' + HS.icon('activity', 12) + HS.icon('zap', 12) + '</span></div>' +
      '<div class="device__scroll">' + body + '</div>' +
      '<div class="tabbar">' + PTABS.map(function (t) {
        return '<button class="tabbar__item" aria-selected="' + (t.id === tab) + '" data-action="parent-tab" data-arg="' + t.id + '">' +
          HS.icon(t.icon, 19) + '<span>' + esc(HS.t(t.label)) + '</span></button>';
      }).join('') + '</div>';
  }

  HS.route('parent-360', function (params) {
    var v = HS.vs('p360', { tab: params.tab || 'home' });
    if (params.tab && params.tab !== v.tab) v.tab = params.tab;

    /* A signed-in parent gets the app itself, not a preview of it */
    if (HS.state.role === 'parent') {
      return '<div class="page page--flush" style="max-width:520px;margin:0 auto">' +
        '<div class="device" style="width:100%;max-width:none;background:transparent;padding:0;box-shadow:none">' +
        '<div class="device__screen" style="height:auto;min-height:calc(100vh - var(--topbar-h));border-radius:0">' +
        phoneScreen(v.tab) + '</div></div></div>';
    }

    return U.page(
      U.pageHead({
        title: 'Parent 360',
        sub: 'Mobile-first and low-bandwidth by design. A school companion rather than a notification feed: safety, transport, academics, homework, events, achievements, fees and PTM booking.',
        actions: U.btn('Sign out and open as a parent', { variant: 'primary', icon: 'logout', action: 'sign-out' })
      }) +
      '<div class="row g-6 wrap" style="align-items:flex-start">' +
      '<div class="none"><div class="device"><div class="device__screen">' + phoneScreen(v.tab) + '</div></div>' +
      '<div class="device__label">Parent app · ' + esc(PTABS.filter(function (t) { return t.id === v.tab; })[0].label) + '</div></div>' +
      '<div class="grow col g-4" style="min-width:300px">' +
      U.card({
        title: 'What the parent sees, and when',
        body: U.timeline([
          { time: '07:45', title: 'Bus departs the depot', body: 'Live ETA appears for the home stop. No action needed from the parent.', tone: 'amber' },
          { time: '07:52', title: 'Aditya boarded ✓', body: 'Boarding confirmed by the attendant device.', tone: 'teal' },
          { time: '08:31', title: 'Safe arrival at the gate', body: 'RFID entry. Push and WhatsApp notification sent at 08:32.', tone: 'teal' },
          { time: '09:00', title: 'Attendance marked', body: 'Present. Parents of absent children receive an alert within the minute.', tone: '' },
          { time: '13:40', title: 'Fee instalment paid', body: 'Paid from the app by UPI. Receipt issued instantly and sent on WhatsApp.', tone: 'teal' },
          { time: '15:40', title: 'Afternoon bus departs', body: 'Live tracking resumes until de-boarding is confirmed at the home stop.', tone: 'amber' }
        ])
      }) +
      U.card({
        title: 'Design constraints', sub: 'Decided for this audience',
        body: '<div class="col g-3">' +
          [['Mobile-first', 'Parents are on phones, often on mobile data. Every screen is built for a 390px width first.'],
           ['Low bandwidth', 'No heavy imagery on the default screens. The live map degrades to a text ETA on a slow connection.'],
           ['English and Tamil', 'Language is a per-parent setting, applied to notifications as well as the interface.'],
           ['Large touch targets', 'Every action is at least 44 by 44 pixels.'],
           ['One child or many', 'The child switcher sits in the header on every screen.']
          ].map(function (r) {
            return '<div class="row-top g-3">' + HS.icon('check', 15, 't-success') +
              '<span class="col"><span class="t-sm t-bold">' + esc(r[0]) + '</span>' +
              '<span class="t-xs t-muted">' + esc(r[1]) + '</span></span></div>';
          }).join('') + '</div>'
      }) +
      '</div></div>'
    );
  });
  HS.on('parent-tab', function (arg) { HS.vs('p360').tab = arg; HS.render(); });
  HS.on('parent-pay', function () {
    U.modal({
      title: 'Pay fees', sub: 'Aditya Kumar · Grade 5A',
      body: '<div class="col g-3">' +
        '<div class="card card--tint" style="padding:14px"><div class="row between"><span class="t-sm">Tuition — Term 3 (balance)</span><span class="t-bold t-num">₹22,000</span></div>' +
        '<div class="row between mt-2"><span class="t-sm">Activities — Robotics Lab</span><span class="t-bold t-num">₹4,500</span></div>' +
        '<div class="row between mt-2"><span class="t-sm">Residential trip — Pollachi</span><span class="t-bold t-num">₹6,800</span></div>' +
        '<div class="divider" style="margin:10px 0"></div>' +
        '<div class="row between"><span class="t-sm t-bold">Total</span><span class="t-bold t-num" style="font-size:17px">₹33,300</span></div></div>' +
        '<div class="eyebrow mt-2">Payment method</div>' +
        '<div class="col g-2">' + ['UPI', 'Card', 'Net Banking'].map(function (m, i) {
          return '<label class="check card" style="padding:12px 14px"><input type="radio" name="pm"' + (i === 0 ? ' checked' : '') + '> ' +
            HS.icon(m === 'UPI' ? 'zap' : m === 'Card' ? 'creditCard' : 'building', 15) + ' ' + m + '</label>';
        }).join('') + '</div>' +
        U.banner('This prototype does not process payments. The real flow is Pay Now → payment success → receipt → WhatsApp receipt.', 'neutral', 'info'),
      foot: U.btn('Cancel', { action: 'close-overlay' }) + U.btn('Pay ₹33,300', { variant: 'teal', icon: 'lock', action: 'parent-paid' })
    });
  });
  HS.on('parent-paid', function () {
    U.modal({
      title: 'Payment successful',
      body: '<div class="t-center" style="padding:16px 0">' +
        '<div class="avatar avatar--teal" style="width:62px;height:62px;margin:0 auto">' + HS.icon('check', 28) + '</div>' +
        '<div class="h2 mt-4">₹33,300 paid</div>' +
        '<p class="t-sm t-muted mt-2">Receipt RCP-2026-08841 issued. A copy has been sent to your WhatsApp number ending 2110.</p></div>' +
        U.dl([['Paid on', '16 Sep 2026, 13:41'], ['Method', 'UPI'], ['Reference', 'UPI/2026091613410088'], ['Student', 'Aditya Kumar · HS-2026-1041']]),
      foot: U.btn('Download receipt', { icon: 'download', action: 'demo', arg: 'Receipt downloaded' }) +
        U.btn('Done', { variant: 'primary', action: 'close-overlay' })
    });
  });
  HS.on('parent-ptm', function (teacher) {
    U.modal({
      title: 'Book a PTM slot', sub: teacher,
      body: '<div class="grid g-3col g-2">' + ['09:00', '09:15', '09:30', '09:45', '10:00', '10:15', '10:30', '10:45', '11:00'].map(function (t, i) {
        var taken = [1, 3, 4, 7].indexOf(i) > -1;
        return '<button class="btn ' + (taken ? 'btn--ghost' : 'btn--ghost') + '"' + (taken ? ' disabled' : '') + ' data-action="demo-close">' +
          t + (taken ? ' · taken' : '') + '</button>';
      }).join('') + '</div>' +
        '<div class="mt-4">' + U.banner('Slots are 15 minutes. You will receive a reminder the evening before and one hour before.', 'neutral', 'clock') + '</div>',
      foot: U.btn('Close', { action: 'close-overlay' })
    });
  });

  /* ================================================= PARENT DIRECTORY ==== */
  HS.route('parent-directory', function () {
    return U.page(
      U.pageHead({ title: 'Parent Directory', sub: 'Contact details, children, engagement and the last interaction — the parent side of the CRM.' }) +
      U.grid('g-4col', [
        U.kpi({ label: 'Parent accounts', value: 1102, tone: '', foot: '86% of families active on the app' }),
        U.kpi({ label: 'High engagement', value: '48%', tone: 'teal', delta: 6 }),
        U.kpi({ label: 'Low engagement', value: 174, tone: 'amber', foot: 'No app activity in 30 days' }),
        U.kpi({ label: 'Parent NPS', value: 52, tone: 'teal', delta: 4 })
      ]) +
      '<div class="mt-4">' + U.card({ flush: true, body: U.table({
        cols: [
          { key: 'name', label: 'Parent', render: function (r) { return U.person(r.name, r.phone); } },
          { key: 'children', label: 'Children', render: function (r) {
            return '<button class="t-sm t-info" data-action="open-student" data-arg="HS-2026-1041">' + esc(r.children) + '</button>';
          } },
          { key: 'engagement', label: 'Engagement', render: function (r) {
            return U.meter({ label: '', value: r.engagement, right: r.engagement + '%', tone: r.engagement >= 70 ? 'teal' : r.engagement >= 50 ? 'amber' : 'critical' });
          } },
          { key: 'lastContact', label: 'Last interaction' },
          { key: 'ptm', label: 'PTM', render: function (r) { return U.badge(r.ptm, r.ptm === 'Booked' ? 'success' : 'warning'); } },
          { key: 'a', label: '', sortable: false, cls: 'num', render: function () {
            return U.btn('Message', { size: 'sm', icon: 'message', action: 'demo', arg: 'Message drafted — needs approval before sending' });
          } }
        ],
        rows: D.parents.directory
      }) }) + '</div>'
    );
  });

  /* ============================================= PARENT COMMUNICATION ==== */
  HS.route('parent-communication', function () {
    var v = HS.vs('pcomm', { thread: 0 });
    var threads = [
      { who: 'Sudha Raman', child: 'Sanjana Raman (7B)', subject: 'Absence today', age: '31 h', tone: 'critical', unread: true },
      { who: 'Gayathri N.', child: 'Gokul Anand (6B)', subject: 'Transport route change', age: '18 h', tone: 'warning', unread: true },
      { who: 'Ranjith Kumar', child: 'Aditya Kumar (5A)', subject: 'Robotics club timing', age: '4 h', tone: 'info', unread: false },
      { who: 'Prakash S.', child: 'Varsha Iyer (4A)', subject: 'PTM slot request', age: '2 d', tone: 'neutral', unread: false }
    ];
    var t = threads[v.thread];
    return U.page(
      U.pageHead({
        title: 'Parent Communication',
        sub: 'Every channel in one thread per family. Outbound messages follow the same approval path as everything else.',
        actions: U.btn('Broadcast', { icon: 'megaphone', route: '#/circulars' }) +
          U.btn('New message', { variant: 'primary', icon: 'plus', action: 'not-built', arg: 'New message' })
      }) +
      '<div class="grid g-side">' +
      U.card({
        title: 'Open threads', sub: '9 unanswered over 24 hours', flush: true,
        body: '<div>' + threads.map(function (th, i) {
          return '<button class="alert-item alert-item--' + th.tone + '" data-action="pcomm-thread" data-arg="' + i + '" style="' + (i === v.thread ? 'background:var(--surface-alt)' : '') + '">' +
            U.avatar(th.who, { size: 'sm' }) +
            '<span class="grow" style="min-width:0"><span class="alert-item__title" style="display:block">' + esc(th.who) + (th.unread ? ' <span class="dot dot--critical" style="display:inline-block;vertical-align:middle"></span>' : '') + '</span>' +
            '<span class="alert-item__meta" style="display:block">' + esc(th.subject + ' · ' + th.child) + '</span></span>' +
            '<span class="t-micro t-muted none">' + esc(th.age) + '</span></button>';
        }).join('') + '</div>'
      }) +
      U.card({
        title: t.who, sub: t.child + ' · ' + t.subject,
        actions: U.btn('Open Student 360', { size: 'sm', icon: 'user', action: 'open-student', arg: 'HS-2026-1042' }),
        body: '<div class="chat">' +
          '<div class="bubble bubble--in">Good morning. Sanjana is unwell today so she will not attend. I have a doctor\'s note if needed.' +
          '<div class="bubble__meta">WhatsApp · yesterday 07:42</div></div>' +
          '<div class="bubble bubble--out">Thank you for letting us know. I have recorded today as an approved absence.' +
          '<div class="bubble__meta">Ms. Priya Raghavan · yesterday 08:10 · delivered</div></div>' +
          '<div class="bubble bubble--in">Thank you. She has missed a few days this month, I know. Is she falling behind?' +
          '<div class="bubble__meta">WhatsApp · yesterday 08:31</div></div>' +
          '<div class="bubble bubble--ai">' + HS.icon('sparkle', 13) + ' <strong>Suggested reply</strong><br>' +
          'Sanjana\'s attendance is at 79% this term, and her Mathematics has moved down over the last two assessments. Her teacher has already opened a support plan with a weekly check-in. Could we speak on Friday afternoon so we can agree the next steps together?' +
          '<div class="bubble__meta">Draft — review, edit and approve before sending. Attendance and academic figures were read from the live record.</div></div>' +
          '</div>' +
          '<div class="divider"></div>' +
          U.field({ type: 'textarea', rows: 3, placeholder: 'Write a reply, or edit the suggestion above.' }) +
          '<div class="row between wrap g-2 mt-3">' +
          '<div class="row g-2">' + U.btn('Use suggestion', { size: 'sm', icon: 'sparkle', action: 'demo', arg: 'Suggestion copied into the reply box for editing' }) +
          U.btn('Translate to Tamil', { size: 'sm', icon: 'globe', action: 'demo', arg: 'Tamil translation drafted' }) + '</div>' +
          '<div class="row g-2">' + U.btn('Save draft', { size: 'sm' }) +
          U.btn('Send', { size: 'sm', variant: 'primary', icon: 'send', action: 'demo', arg: 'Reply sent to Sudha Raman on WhatsApp' }) + '</div></div>'
      }) +
      '</div>'
    );
  });
  HS.on('pcomm-thread', function (i) { HS.vs('pcomm').thread = Number(i); HS.render(); });

  /* ============================================================== PTM ==== */
  HS.route('ptm', function () {
    var total = D.parents.ptm.reduce(function (a, p) { return a + p.slots; }, 0);
    var booked = D.parents.ptm.reduce(function (a, p) { return a + p.booked; }, 0);
    return U.page(
      U.pageHead({ title: 'Parent–Teacher Meetings', sub: 'Grade 5 · 20–21 September 2026 · Academic Block',
        actions: U.btn('Open booking', { variant: 'primary', icon: 'calendar', action: 'demo', arg: 'Booking opened to Grade 5 parents' }) }) +
      U.grid('g-4col', [
        U.kpi({ label: 'Slots available', value: total, tone: '' }),
        U.kpi({ label: 'Booked', value: booked, unit: HS.fmt.pct(booked / total * 100) + ' filled', tone: 'teal' }),
        U.kpi({ label: 'Unbooked families', value: 18, tone: 'amber', foot: 'Reminder scheduled for 18 Sep' }),
        U.kpi({ label: 'Families to prioritise', value: 5, tone: 'critical', foot: 'Children with an open intervention' })
      ]) +
      '<div class="mt-4">' + U.card({ flush: true, body: U.table({
        cols: [
          { key: 'teacher', label: 'Teacher', render: function (r) { return U.person(r.teacher, r.subject); } },
          { key: 'date', label: 'Date' },
          { key: 'booked', label: 'Bookings', render: function (r) {
            return U.meter({ label: '', value: r.booked / r.slots * 100, right: r.booked + '/' + r.slots, tone: r.booked === r.slots ? 'critical' : r.booked / r.slots > .7 ? 'teal' : 'amber' });
          } },
          { key: 'a', label: '', sortable: false, cls: 'num', render: function (r) {
            return U.btn(r.booked >= r.slots ? 'Add slots' : 'View slots', { size: 'sm', action: 'demo', arg: 'Slot list for ' + r.teacher });
          } }
        ],
        rows: D.parents.ptm
      }) }) + '</div>'
    );
  });

  /* ========================================================= CIRCULARS === */
  HS.route('circulars', function () { return circularsPage('Circulars', 'Broadcasts to parents, with acknowledgement tracked per family.'); });
  HS.route('op-circulars', function () { return circularsPage('Circulars', 'Internal and parent-facing circulars, with acknowledgement tracked.'); });

  function circularsPage(title, sub) {
    return U.page(
      U.pageHead({ title: title, sub: sub, actions: U.btn('New circular', { variant: 'primary', icon: 'plus', action: 'circular-new' }) }) +
      U.card({ flush: true, body: U.table({
        cols: [
          { key: 'title', label: 'Circular', render: function (r) { return '<span class="t-bold">' + esc(r.title) + '</span><div class="t-micro t-muted">' + esc(r.audience) + '</div>'; } },
          { key: 'date', label: 'Issued' },
          { key: 'ack', label: 'Acknowledged', render: function (r) {
            if (!r.of || r.status === 'Draft') return '<span class="t-faint">—</span>';
            return U.meter({ label: '', value: r.ack / r.of * 100, right: HS.fmt.n(r.ack) + '/' + HS.fmt.n(r.of), tone: r.ack / r.of > .85 ? 'teal' : 'amber' });
          } },
          { key: 'status', label: 'Status', render: function (r) { return U.status(r.status); } },
          { key: 'a', label: '', sortable: false, cls: 'num', render: function (r) {
            return r.status === 'Draft' ? U.btn('Send for approval', { size: 'sm', variant: 'primary', action: 'demo', arg: 'Circular submitted for approval' })
              : U.btn('Remind unacknowledged', { size: 'sm', action: 'demo', arg: 'Reminder queued' });
          } }
        ],
        rows: D.parents.circulars
      }) })
    );
  }
  HS.on('circular-new', function () {
    U.modal({
      title: 'New circular', size: 'wide',
      body: '<div class="grid g-2col g-3">' +
        U.field({ label: 'Title', placeholder: 'For example: Term 3 examination schedule' }) +
        U.field({ type: 'select', label: 'Audience', options: ['All parents', 'Grade 5 parents', 'Grade 10 parents', 'Transport users', 'All staff'] }) +
        '</div>' +
        '<div class="mt-3">' + U.field({ type: 'textarea', label: 'Message', rows: 5 }) + '</div>' +
        '<div class="grid g-2col g-3 mt-3">' +
        U.field({ type: 'select', label: 'Channels', options: ['App + WhatsApp', 'App only', 'App + WhatsApp + SMS', 'Email only'] }) +
        U.field({ type: 'select', label: 'Acknowledgement', options: ['Required', 'Not required'] }) +
        '</div>' +
        '<div class="mt-4">' + U.flow([{ label: 'Draft', state: 'active' }, { label: 'Submitted' }, { label: 'Under Review' }, { label: 'Approved' }, { label: 'Released' }]) + '</div>',
      foot: U.btn('Cancel', { action: 'close-overlay' }) + U.btn('Save draft', { action: 'demo-close' }) +
        U.btn('Send for approval', { variant: 'primary', action: 'demo-close' })
    });
  });

  /* ============================================================ EVENTS == */
  HS.route('events', function () {
    return U.page(
      U.pageHead({ title: 'Events', sub: 'The school calendar as parents see it.', actions: U.btn('Add event', { variant: 'primary', icon: 'plus', action: 'not-built', arg: 'Add event' }) }) +
      '<div class="grid g-2col g-4">' + D.parents.events.map(function (e) {
        return U.card({ body: '<div class="row-top g-4">' +
          '<span class="col none t-center card--tint" style="width:62px;padding:10px;border-radius:var(--r-md);background:var(--surface-alt)">' +
          '<span class="t-micro t-muted">' + esc((e.date.match(/[A-Z][a-z]{2}/) || ['Sep'])[0]) + '</span>' +
          '<span class="serif" style="font-size:22px;font-weight:600">' + esc(e.date.split(' ')[0]) + '</span></span>' +
          '<span class="col grow"><span class="t-bold">' + esc(e.title) + '</span>' +
          '<span class="t-xs t-muted mt-1">' + esc(e.place) + ' · ' + esc(e.audience) + '</span>' +
          '<span class="row g-2 mt-3">' + U.btn('Details', { size: 'sm', action: 'not-built', arg: 'Event detail' }) +
          U.btn('Notify parents', { size: 'sm', icon: 'megaphone', action: 'demo', arg: 'Event notification drafted' }) + '</span></span></div>' });
      }).join('') + '</div>'
    );
  });

  /* ================================================== ACKNOWLEDGEMENTS === */
  HS.route('acknowledgements', function () {
    return U.page(
      U.pageHead({ title: 'Acknowledgements', sub: 'Which families have confirmed they read each circular, and who still needs a reminder.' }) +
      U.grid('g-3col', [
        U.kpi({ label: 'Acknowledgement rate', value: '83%', tone: 'teal', delta: 5 }),
        U.kpi({ label: 'Outstanding', value: 187, tone: 'amber', foot: 'Across 4 released circulars' }),
        U.kpi({ label: 'Never acknowledged', value: 34, tone: 'critical', foot: 'Families to call' })
      ]) +
      '<div class="mt-4">' + U.card({ title: 'By circular', flush: true, body: U.table({
        cols: [
          { key: 'title', label: 'Circular' },
          { key: 'audience', label: 'Audience' },
          { key: 'ack', label: 'Acknowledged', render: function (r) {
            if (r.status === 'Draft') return '<span class="t-faint">Not released</span>';
            return U.meter({ label: '', value: r.ack / r.of * 100, right: HS.fmt.n(r.ack) + ' of ' + HS.fmt.n(r.of), tone: r.ack / r.of > .85 ? 'teal' : 'amber' });
          } },
          { key: 'a', label: '', sortable: false, cls: 'num', render: function (r) {
            return r.status === 'Draft' ? '' : U.btn('Chase ' + HS.fmt.n(r.of - r.ack), { size: 'sm', icon: 'message', action: 'demo', arg: 'Reminder queued for ' + (r.of - r.ack) + ' families' });
          } }
        ],
        rows: D.parents.circulars
      }) }) + '</div>'
    );
  });
})(window.HS = window.HS || {});
