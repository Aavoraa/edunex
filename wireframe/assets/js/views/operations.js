/* ==========================================================================
   VIEWS — Assets, Facilities, Maintenance, Inventory, Documents,
           Certificates, Compliance Calendar, Audit Trail
   ========================================================================== */
(function (HS) {
  'use strict';
  var U = HS.ui, D = HS.data, C = HS.charts, esc = HS.esc;
  var O = D.operations;

  HS.route('assets', function () {
    return U.page(
      U.pageHead({ title: 'Assets', sub: 'Asset register with location, assigned person and service schedule.',
        actions: U.btn('Add asset', { variant: 'primary', icon: 'plus', action: 'not-built', arg: 'Add asset' }) +
          U.btn('Export register', { icon: 'download', action: 'demo', arg: 'Asset register exported' }) }) +
      U.grid('g-4col', [
        U.kpi({ label: 'Assets on register', value: 1842, tone: '' }),
        U.kpi({ label: 'Service due in 30 days', value: 14, tone: 'amber' }),
        U.kpi({ label: 'In maintenance', value: 3, tone: 'critical' }),
        U.kpi({ label: 'Book value', value: HS.fmt.money(34200000, { compact: true }), tone: 'info' })
      ]) +
      '<div class="mt-4">' + U.card({ flush: true, body: U.table({
        cols: [
          { key: 'name', label: 'Asset', render: function (r) { return '<span class="t-bold">' + esc(r.name) + '</span><div class="t-micro t-muted">' + esc(r.id + ' · ' + r.category) + '</div>'; } },
          { key: 'location', label: 'Location' },
          { key: 'assigned', label: 'Assigned to', render: function (r) { return U.person(r.assigned, ''); } },
          { key: 'purchased', label: 'Purchased' },
          { key: 'nextService', label: 'Next service' },
          { key: 'status', label: 'Status', render: function (r) {
            return U.badge(r.status, r.status === 'Active' ? 'success' : r.status === 'Maintenance due' ? 'warning' : 'critical');
          } }
        ],
        rows: O.assets
      }) }) + '</div>'
    );
  });

  HS.route('facilities', function () {
    var rooms = [
      { name: 'Auditorium', capacity: 400, today: 'Innovation Day rehearsal', util: 62 },
      { name: 'Lab-1 (Science)', capacity: 36, today: 'Grade 5A P3, Grade 9A P6', util: 84 },
      { name: 'Lab-2 (Computing)', capacity: 32, today: 'Grade 6C P6, Robotics Club P8', util: 78 },
      { name: 'Library', capacity: 80, today: 'Open all day', util: 55 },
      { name: 'Sports field', capacity: 200, today: 'Games P7, athletics practice', util: 71 },
      { name: 'Music room', capacity: 24, today: 'Grade 5 music P7', util: 41 }
    ];
    return U.page(
      U.pageHead({ title: 'Facilities', sub: 'Rooms, capacity, bookings and how heavily each space is used.',
        actions: U.btn('Book a room', { variant: 'primary', icon: 'plus', action: 'not-built', arg: 'Room booking' }) }) +
      U.card({ flush: true, body: U.table({
        cols: [
          { key: 'name', label: 'Space', render: function (r) { return '<span class="t-bold">' + esc(r.name) + '</span>'; } },
          { key: 'capacity', label: 'Capacity', cls: 'num' },
          { key: 'today', label: 'Today' },
          { key: 'util', label: 'Weekly utilisation', render: function (r) { return U.meter({ label: '', value: r.util, right: r.util + '%', tone: r.util > 80 ? 'critical' : r.util > 60 ? 'amber' : 'teal' }); } },
          { key: 'a', label: '', sortable: false, cls: 'num', render: function (r) { return U.btn('Book', { size: 'sm', action: 'demo', arg: r.name + ' booking form opened' }); } }
        ],
        rows: rooms
      }) })
    );
  });

  HS.route('maintenance', function () {
    return U.page(
      U.pageHead({ title: 'Maintenance', sub: 'Requests raised by staff, prioritised, approved and closed.',
        actions: U.btn('Raise a request', { variant: 'primary', icon: 'plus', action: 'not-built', arg: 'Maintenance request' }) }) +
      U.grid('g-4col', [
        U.kpi({ label: 'Open requests', value: 3, tone: 'amber' }),
        U.kpi({ label: 'High priority', value: 1, tone: 'critical' }),
        U.kpi({ label: 'Closed this month', value: 27, tone: 'teal' }),
        U.kpi({ label: 'Median time to close', value: '2.4', unit: 'days', tone: '' })
      ]) +
      '<div class="mt-4">' + U.card({ flush: true, body: U.table({
        cols: [
          { key: 'id', label: 'Ref' },
          { key: 'item', label: 'Request', render: function (r) { return '<span class="t-bold">' + esc(r.item) + '</span>'; } },
          { key: 'raised', label: 'Raised by' }, { key: 'date', label: 'Date' },
          { key: 'priority', label: 'Priority', render: function (r) { return U.badge(r.priority, r.priority === 'High' ? 'critical' : r.priority === 'Medium' ? 'warning' : 'neutral'); } },
          { key: 'status', label: 'Status', render: function (r) { return U.status(r.status); } },
          { key: 'a', label: '', sortable: false, cls: 'num', render: function (r) {
            return r.status === 'Completed' ? '' : U.btn('Update', { size: 'sm', action: 'demo', arg: r.id + ' updated' });
          } }
        ],
        rows: O.maintenance
      }) }) + '</div>'
    );
  });

  HS.route('inventory', function () {
    var items = [
      { item: 'Science lab consumables', category: 'Lab', stock: 42, min: 30, unit: 'kits', status: 'In stock' },
      { item: 'Exercise books', category: 'Stationery', stock: 1840, min: 1000, unit: 'units', status: 'In stock' },
      { item: 'First-aid supplies', category: 'Health', stock: 8, min: 15, unit: 'kits', status: 'Reorder' },
      { item: 'Bus first-aid kits', category: 'Transport', stock: 6, min: 6, unit: 'kits', status: 'At minimum' },
      { item: 'Printer toner', category: 'Office', stock: 3, min: 6, unit: 'cartridges', status: 'Reorder' },
      { item: 'Cleaning supplies', category: 'Housekeeping', stock: 96, min: 40, unit: 'units', status: 'In stock' }
    ];
    return U.page(
      U.pageHead({ title: 'Inventory', sub: 'Stock levels against reorder points, by category.',
        actions: U.btn('Raise purchase request', { variant: 'primary', icon: 'plus', action: 'not-built', arg: 'Purchase request' }) }) +
      U.banner('<strong>2 items below the reorder point.</strong> First-aid supplies and printer toner need a purchase request this week.', 'warning', 'alert') +
      '<div class="mt-4">' + U.card({ flush: true, body: U.table({
        cols: [
          { key: 'item', label: 'Item', render: function (r) { return '<span class="t-bold">' + esc(r.item) + '</span><div class="t-micro t-muted">' + esc(r.category) + '</div>'; } },
          { key: 'stock', label: 'In stock', cls: 'num', render: function (r) { return '<span class="t-num">' + r.stock + ' ' + esc(r.unit) + '</span>'; } },
          { key: 'min', label: 'Reorder at', cls: 'num' },
          { key: 'level', label: 'Level', sortable: false, render: function (r) {
            return U.meter({ label: '', value: Math.min(100, r.stock / (r.min * 2) * 100), right: '', tone: r.stock < r.min ? 'critical' : r.stock === r.min ? 'amber' : 'teal' });
          } },
          { key: 'status', label: 'Status', render: function (r) { return U.badge(r.status, r.status === 'Reorder' ? 'critical' : r.status === 'At minimum' ? 'warning' : 'success'); } }
        ],
        rows: items
      }) }) + '</div>'
    );
  });

  HS.route('documents', function () {
    return U.page(
      U.pageHead({ title: 'Documents', sub: 'Student files, employee files, policies and certificates — with verification status tracked per document.',
        actions: U.btn('Upload', { variant: 'primary', icon: 'upload', action: 'not-built', arg: 'Document upload' }) }) +
      U.grid('g-4col', [
        U.kpi({ label: 'Documents on file', value: '14,286', tone: '' }),
        U.kpi({ label: 'Pending verification', value: 168, tone: 'amber' }),
        U.kpi({ label: 'Expiring in 60 days', value: 24, tone: 'critical' }),
        U.kpi({ label: 'Storage used', value: '41', unit: 'GB', tone: 'info' })
      ]) +
      '<div class="mt-4">' + U.card({ title: 'Document sets', flush: true, body: U.table({
        cols: [
          { key: 'name', label: 'Set', render: function (r) { return '<span class="row g-3">' + HS.icon('folder', 17, 't-muted') + '<span class="t-bold">' + esc(r.name) + '</span></span>'; } },
          { key: 'count', label: 'Documents', cls: 'num' },
          { key: 'owner', label: 'Owner' },
          { key: 'updated', label: 'Last updated' },
          { key: 'a', label: '', sortable: false, cls: 'num', render: function () { return U.btn('Open', { size: 'sm', action: 'not-built', arg: 'Document set' }); } }
        ],
        rows: O.documents
      }) }) + '</div>'
    );
  });

  HS.route('certificates', function () {
    return U.page(
      U.pageHead({ title: 'Certificates', sub: 'Transfer, bonafide and conduct certificates, each issued with a QR code that verifies it independently.',
        actions: U.btn('Issue a certificate', { variant: 'primary', icon: 'plus', action: 'cert-issue' }) }) +
      U.card({ body: U.flow([
        { label: 'Requested', meta: 'By parent or office', state: 'done' },
        { label: 'Records checked', meta: 'Fees, documents, clearance', state: 'done' },
        { label: 'Under Review', meta: '1 pending', state: 'active' },
        { label: 'Approved', meta: 'By the Principal' },
        { label: 'Issued with QR', meta: 'Verifiable by anyone' }
      ]) }) +
      '<div class="mt-4">' + U.card({ flush: true, body: U.table({
        cols: [
          { key: 'type', label: 'Certificate', render: function (r) { return '<span class="t-bold">' + esc(r.type) + '</span>'; } },
          { key: 'student', label: 'Student', render: function (r) { return '<button class="t-info" data-action="open-student" data-arg="HS-2026-1041">' + esc(r.student) + '</button><div class="t-micro t-muted">' + esc(r.grade) + '</div>'; } },
          { key: 'requested', label: 'Requested' },
          { key: 'status', label: 'Status', render: function (r) { return U.status(r.status); } },
          { key: 'qr', label: 'Verification code', render: function (r) { return r.qr === '—' ? '<span class="t-faint">—</span>' : '<span class="row g-2">' + HS.icon('qr', 15, 't-muted') + '<span class="t-num t-xs">' + esc(r.qr) + '</span></span>'; } },
          { key: 'a', label: '', sortable: false, cls: 'num', render: function (r) {
            return r.status === 'Approved' ? U.btn('Print', { size: 'sm', icon: 'printer', action: 'demo', arg: 'Certificate printed with QR verification' })
              : U.btn('Review', { size: 'sm', variant: 'primary', action: 'demo', arg: 'Certificate sent for approval' });
          } }
        ],
        rows: O.certificates
      }) }) + '</div>'
    );
  });
  HS.on('cert-issue', function () {
    U.modal({
      title: 'Issue a certificate',
      body: '<div class="grid g-2col g-3">' +
        U.field({ type: 'select', label: 'Certificate type', options: ['Transfer certificate', 'Bonafide certificate', 'Conduct certificate', 'Study certificate'] }) +
        U.field({ label: 'Student', value: 'Aditya Kumar · HS-2026-1041' }) +
        '</div>' +
        '<div class="mt-4"><div class="eyebrow mb-2">Automatic checks</div><div class="col g-2">' +
        [['Fees cleared', false], ['Library items returned', true], ['Documents complete', true], ['No open disciplinary matter', true]].map(function (c) {
          return '<div class="row between card card--tint" style="padding:9px 12px"><span class="t-sm">' + esc(c[0]) + '</span>' +
            U.badge(c[1] ? 'Passed' : 'Outstanding balance ₹22,000', c[1] ? 'success' : 'critical', { icon: c[1] ? 'check' : null }) + '</div>';
        }).join('') + '</div></div>' +
        '<div class="mt-4">' + U.banner('A certificate cannot be issued while a check is failing. Finance can waive a fee check with a recorded reason.', 'warning', 'lock') + '</div>',
      foot: U.btn('Cancel', { action: 'close-overlay' }) + U.btn('Send for approval', { variant: 'primary', disabled: true })
    });
  });

  /* ================================================= COMPLIANCE ========== */
  HS.route('compliance', function () {
    var rows = O.compliance.slice().sort(function (a, b) { return a.days - b.days; });
    return U.page(
      U.pageHead({ title: 'Compliance Calendar', sub: 'Fire safety, vehicle fitness, child-protection training, staff checks and affiliation requirements — with an owner on every line.',
        actions: U.btn('Add requirement', { variant: 'primary', icon: 'plus', action: 'not-built', arg: 'Add compliance item' }) }) +
      U.grid('g-4col', [
        U.kpi({ label: 'Overdue', value: 1, tone: 'critical', foot: 'Water quality test — 8 days' }),
        U.kpi({ label: 'Due within 14 days', value: 2, tone: 'warning' }),
        U.kpi({ label: 'On schedule', value: 3, tone: 'teal' }),
        U.kpi({ label: 'Compliance score', value: '92%', tone: 'teal', delta: -3, inverse: true })
      ]) +
      '<div class="mt-4">' + U.card({ flush: true, body: U.table({
        cols: [
          { key: 'item', label: 'Requirement', render: function (r) { return '<span class="t-bold">' + esc(r.item) + '</span><div class="t-micro t-muted">' + esc(r.authority) + '</div>'; } },
          { key: 'owner', label: 'Owner', render: function (r) { return U.person(r.owner, ''); } },
          { key: 'due', label: 'Due' },
          { key: 'days', label: 'Time remaining', render: function (r) {
            if (r.days < 0) return U.badge(Math.abs(r.days) + ' days overdue', 'critical', { dot: true });
            return U.meter({ label: '', value: Math.max(6, 100 - Math.min(100, r.days)), right: r.days + ' days', tone: r.days < 10 ? 'critical' : r.days < 30 ? 'amber' : 'teal' });
          } },
          { key: 'status', label: 'Status', render: function (r) { return U.status(r.status); } },
          { key: 'a', label: '', sortable: false, cls: 'num', render: function (r) {
            return U.btn(r.days < 0 ? 'Escalate' : 'Update', { size: 'sm', variant: r.days < 0 ? 'danger' : 'ghost', action: 'demo', arg: r.item + ' — action recorded' });
          } }
        ],
        rows: rows
      }) }) + '</div>' +
      '<div class="mt-4">' + U.card({ title: 'Compliance over the year', sub: 'Items completed on time against items due',
        body: C.bar({ labels: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
          series: [{ name: 'Due', values: [6, 4, 8, 5, 7, 6], color: 'var(--border-strong)' },
                   { name: 'Completed on time', values: [6, 4, 7, 5, 7, 5], color: 'var(--teal)' }], height: 220 }) +
          '<div class="mt-3">' + C.legend([{ label: 'Due', color: 'var(--border-strong)' }, { label: 'Completed on time', color: 'var(--teal)' }]) + '</div>' }) + '</div>'
    );
  });

  /* ==================================================== AUDIT TRAIL ====== */
  HS.route('audit', function () {
    var v = HS.vs('audit', { q: '' });
    var rows = O.audit.concat([
      { time: '15 Sep 16:40', user: 'Ms. Priya Raghavan', action: 'Approved AI-drafted lesson plan', entity: 'Co-Pilot / Grade 6B Fractions', ip: '10.2.14.88' },
      { time: '15 Sep 14:12', user: 'Ms. Deepa Venkat', action: 'Opened wellbeing record', entity: 'Student 360 / HS-2026-1042', ip: '10.2.16.31' },
      { time: '15 Sep 11:03', user: 'Devendran M.', action: 'Held collection — person not authorised', entity: 'Smart Gate / Rear Gate', ip: 'gate-device-02' },
      { time: '14 Sep 09:55', user: 'Dr. Meera Krishnan', action: 'Changed risk threshold for Early Warning', entity: 'Settings / Early Warning', ip: '10.2.10.4' }
    ]).filter(function (r) {
      return !v.q || (r.user + r.action + r.entity).toLowerCase().indexOf(v.q.toLowerCase()) > -1;
    });
    return U.page(
      U.pageHead({ title: 'Audit Trail', sub: 'Every consequential action, who took it and against what. Restricted records log reads as well as writes.',
        actions: U.btn('Export', { icon: 'download', action: 'demo', arg: 'Audit trail exported' }) }) +
      '<div class="filterbar">' + U.search('Search user, action or record', 'audit-q', v.q) +
        U.field({ type: 'select', label: 'Module', options: ['All modules', 'Attendance', 'Admissions', 'Finance', 'Payroll', 'Smart Gate', 'Student 360', 'Settings'] }) +
        U.field({ type: 'select', label: 'Period', options: ['Last 7 days', 'Last 30 days', 'This academic year'] }) +
        '<div class="spacer"></div><span class="t-sm t-muted t-num">' + rows.length + ' entries</span></div>' +
      U.card({ flush: true, body: U.table({
        cols: [
          { key: 'time', label: 'When' },
          { key: 'user', label: 'Who', render: function (r) { return r.user === 'System' ? U.badge('System', 'neutral', { icon: 'zap' }) : U.person(r.user, ''); } },
          { key: 'action', label: 'Action' },
          { key: 'entity', label: 'Record', render: function (r) { return '<span class="t-xs t-muted">' + esc(r.entity) + '</span>'; } },
          { key: 'ip', label: 'Source', render: function (r) { return '<span class="t-xs t-faint t-num">' + esc(r.ip) + '</span>'; } }
        ],
        rows: rows
      }) })
    );
  });
  HS.on('audit-q', function (a, el) { HS.vs('audit').q = el.value; HS.render(); });
})(window.HS = window.HS || {});
