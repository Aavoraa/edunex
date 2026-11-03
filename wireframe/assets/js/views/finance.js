/* ==========================================================================
   VIEWS — Fees & Finance (collection, structures, accounts, payments,
           receipts, concessions, scholarships, expenses, reimbursements,
           allowances, budgets, reconciliation, reports)
   ========================================================================== */
(function (HS) {
  'use strict';
  var U = HS.ui, D = HS.data, C = HS.charts, esc = HS.esc;
  var F = D.finance;

  /* ================================================== FEE COLLECTION ===== */
  HS.route('fees', function () {
    var k = F.kpis;
    return U.page(
      U.pageHead({
        title: 'Fee Collection',
        sub: 'Billing, collection, ageing and expected cash flow — with automated reminders behind every overdue figure.',
        actions: U.btn('Send reminders', { icon: 'message', action: 'fees-reminders' }) +
          U.btn('Record payment', { variant: 'primary', icon: 'plus', action: 'not-built', arg: 'Record offline payment' })
      }) +
      U.grid('g-3col', [
        U.kpi({ label: 'Total billed', value: HS.fmt.money(k.billed, { compact: true }), tone: '', foot: 'Academic year to date' }),
        U.kpi({ label: 'Collected', value: HS.fmt.money(k.collected, { compact: true }), tone: 'teal', delta: 4.2, foot: HS.fmt.pct(k.collectionPct, 1) + ' of billed' }),
        U.kpi({ label: 'Outstanding', value: HS.fmt.money(k.outstanding, { compact: true }), tone: 'amber', foot: '286 student accounts' }),
        U.kpi({ label: 'Overdue 30+ days', value: HS.fmt.money(k.overdue, { compact: true }), tone: 'critical', delta: 8, inverse: true, foot: '86 accounts' }),
        U.kpi({ label: 'Collection rate', value: HS.fmt.pct(k.collectionPct, 1), tone: 'teal', delta: 1.8 }),
        U.kpi({ label: 'Expected this month', value: HS.fmt.money(k.expected, { compact: true }), tone: 'info', foot: 'Instalments falling due' })
      ]) +
      '<div class="grid g-main mt-5">' +
      U.card({
        title: 'Collection trend', sub: 'Billed against collected, by month',
        body: C.bar({
          labels: F.collectionTrend.labels,
          series: [{ name: 'Billed', values: F.collectionTrend.billed, color: 'var(--border-strong)' },
                   { name: 'Collected', values: F.collectionTrend.collected, color: 'var(--teal)' }],
          height: 250
        }) + '<div class="mt-3">' + C.legend([{ label: 'Billed', color: 'var(--border-strong)' }, { label: 'Collected', color: 'var(--teal)' }]) + '</div>'
      }) +
      '<div class="col g-4">' +
      U.card({ title: 'Overdue ageing', body: C.hbar({ rows: F.ageing.map(function (a) {
        return { label: a.label, value: a.value, color: a.color, display: HS.fmt.money(a.value, { compact: true }) };
      }), labelW: 92, rowH: 32 }) }) +
      U.card({ title: 'Payment method', body: C.donut({ size: 168, thickness: 24, center: '58%', centerSub: 'by UPI',
        data: F.methods }) + '<div class="mt-4">' + C.legend(F.methods) + '</div>' }) +
      '</div></div>' +
      '<div class="grid g-2col g-4 mt-4">' +
      U.card({ title: 'Campus comparison', body: C.stacked({
        labels: F.byCampus.labels,
        series: [{ name: 'Collected', values: F.byCampus.collected, color: 'var(--teal)' },
                 { name: 'Outstanding', values: F.byCampus.outstanding, color: 'var(--amber)' }],
        height: 230
      }) + '<div class="mt-3">' + C.legend([{ label: 'Collected', color: 'var(--teal)' }, { label: 'Outstanding', color: 'var(--amber)' }]) + '</div>' }) +
      U.card({ title: 'By fee head', flush: true, body: U.table({
        compact: true,
        cols: [
          { key: 'head', label: 'Head' },
          { key: 'billed', label: 'Billed', cls: 'num', render: function (r) { return HS.fmt.money(r.billed, { compact: true }); } },
          { key: 'collected', label: 'Collected', cls: 'num', render: function (r) { return HS.fmt.money(r.collected, { compact: true }); } },
          { key: 'pct', label: 'Rate', render: function (r) {
            var p = Math.round(r.collected / r.billed * 100);
            return U.meter({ label: '', value: p, right: p + '%', tone: p > 85 ? 'teal' : p > 60 ? 'amber' : 'critical' });
          } }
        ],
        rows: F.heads
      }) }) +
      '</div>' +
      '<div class="mt-4">' + U.card({
        title: 'Accounts needing attention', sub: 'Overdue beyond 30 days, ranked by amount',
        actions: U.btn('Open student accounts', { size: 'sm', route: '#/student-accounts', iconRight: 'arrowRight' }),
        flush: true,
        body: U.table({
          rowAction: 'open-student', rowId: function (r) { return r.id; },
          cols: [
            { key: 'name', label: 'Student', render: function (r) { return HS.studentLink(r); } },
            { key: 'grade', label: 'Grade', render: function (r) { return esc(r.grade + ' ' + r.section); } },
            { key: 'due', label: 'Outstanding', cls: 'num', render: function (r) { return '<span class="t-num t-bold">' + HS.fmt.money(28000 + (r.name.length * 1100)) + '</span>'; } },
            { key: 'age', label: 'Ageing', sortable: false, render: function (r) { return U.badge((30 + r.name.length * 2) + ' days', 'critical'); } },
            { key: 'feeStatus', label: 'Status', render: function (r) { return U.status(r.feeStatus); } },
            { key: 'a', label: '', sortable: false, cls: 'num', render: function (r) {
              return '<div class="row g-2 end">' + U.btn('Remind', { size: 'sm', icon: 'message', action: 'demo', arg: 'Reminder sent to the parent of ' + r.name }) +
                U.btn('Plan', { size: 'sm', action: 'demo', arg: 'Instalment plan drafted' }) + '</div>';
            } }
          ],
          rows: D.students.filter(function (s) { return s.feeStatus === 'Overdue'; }).slice(0, 8)
        })
      }) + '</div>'
    );
  });
  HS.on('fees-reminders', function () {
    U.modal({
      title: 'Automated fee reminders', sub: '286 accounts outstanding · 86 overdue',
      body: '<div class="col g-3">' +
        U.field({ type: 'select', label: 'Send to', options: ['Overdue 30+ days (86 accounts)', 'All outstanding (286 accounts)', 'Due in the next 7 days (142 accounts)'] }) +
        U.field({ type: 'select', label: 'Channel', options: ['WhatsApp + app', 'WhatsApp only', 'SMS + app'] }) +
        U.field({ type: 'select', label: 'Language', options: ['Parent\'s preferred language', 'English', 'தமிழ்'] }) +
        U.field({ type: 'textarea', label: 'Message', rows: 3, value: 'Dear parent, the Term 3 instalment for {student} is outstanding. You can pay from the Edunex app. Please contact the front office if you would like to discuss an instalment plan.' }) +
        U.banner('Reminders include a payment link. A receipt is issued automatically on payment and sent to the same channel.', 'neutral', 'info') +
        '</div>',
      foot: U.btn('Cancel', { action: 'close-overlay' }) + U.btn('Send 86 reminders', { variant: 'primary', icon: 'send', action: 'demo-close' })
    });
  });

  /* ================================================= STUDENT ACCOUNTS ==== */
  HS.route('student-accounts', function () {
    var acc = F.studentAccount;
    var totalDue = acc.lines.reduce(function (a, l) { return a + l.due; }, 0);
    var totalPaid = acc.lines.reduce(function (a, l) { return a + l.paid; }, 0);
    return U.page(
      U.pageHead({ title: 'Student Accounts', sub: 'One ledger per student across tuition, transport, activities, trips, uniform, books and other charges.' }) +
      '<div class="grid g-main">' +
      U.card({
        title: acc.student + ' · ' + acc.grade, sub: acc.id,
        actions: U.btn('Open Student 360', { size: 'sm', icon: 'user', action: 'open-student', arg: acc.id }),
        flush: true,
        body: U.table({
          cols: [
            { key: 'head', label: 'Charge' },
            { key: 'due', label: 'Amount', cls: 'num', render: function (r) { return HS.fmt.money(r.due); } },
            { key: 'paid', label: 'Paid', cls: 'num', render: function (r) { return HS.fmt.money(r.paid); } },
            { key: 'bal', label: 'Balance', cls: 'num', sortable: false, render: function (r) {
              var b = r.due - r.paid;
              return '<span class="t-num t-bold ' + (b ? 't-critical' : 't-muted') + '">' + HS.fmt.money(b) + '</span>';
            } },
            { key: 'dueDate', label: 'Due date' },
            { key: 'status', label: 'Status', render: function (r) { return U.status(r.status); } }
          ],
          rows: acc.lines
        }) +
          '<div class="card__foot row between wrap g-3">' +
          '<span class="row g-4"><span>Billed <strong class="t-num">' + HS.fmt.money(totalDue) + '</strong></span>' +
          '<span>Paid <strong class="t-num">' + HS.fmt.money(totalPaid) + '</strong></span>' +
          '<span>Balance <strong class="t-num t-critical">' + HS.fmt.money(totalDue - totalPaid) + '</strong></span></span>' +
          U.btn('Take payment', { variant: 'teal', icon: 'creditCard', action: 'parent-pay' }) + '</div>'
      }) +
      '<div class="col g-4">' +
      U.card({ title: 'Concession applied', body: U.dl([
        ['Type', 'Sibling concession'], ['Value', '10% of tuition'], ['Approved by', 'Dr. Meera Krishnan'], ['Valid until', '31 Mar 2027']
      ]) }) +
      U.card({ title: 'Payment history', flush: true, body: U.table({ compact: true, cols: [
        { key: 'date', label: 'Date' }, { key: 'amount', label: 'Amount', cls: 'num' },
        { key: 'method', label: 'Method' },
        { key: 'a', label: '', sortable: false, cls: 'num', render: function () { return U.btn('Receipt', { size: 'sm', icon: 'download', action: 'demo', arg: 'Receipt downloaded' }); } }
      ], rows: [
        { date: '09 Jul 2026', amount: '₹51,600', method: 'UPI' },
        { date: '08 Apr 2026', amount: '₹51,600', method: 'Net banking' },
        { date: '12 Aug 2026', amount: '₹20,000', method: 'UPI' }
      ] }) }) +
      '</div></div>'
    );
  });

  /* =================================================== FEE STRUCTURES ==== */
  HS.route('fee-structures', function () {
    return U.page(
      U.pageHead({ title: 'Fee Structures', sub: 'Defined per stage and campus, then applied to student accounts automatically.',
        actions: U.btn('New structure', { variant: 'primary', icon: 'plus', action: 'not-built', arg: 'New fee structure' }) }) +
      U.card({ flush: true, body: U.table({
        cols: [
          { key: 'stage', label: 'Stage', render: function (r) { return '<span class="t-bold">' + esc(r.stage) + '</span><div class="t-micro t-muted">' + esc(r.campus) + '</div>'; } },
          { key: 'tuition', label: 'Tuition / year', cls: 'num', render: function (r) { return HS.fmt.money(r.tuition); } },
          { key: 'transport', label: 'Transport', cls: 'num', render: function (r) { return HS.fmt.money(r.transport); } },
          { key: 'activities', label: 'Activities', cls: 'num', render: function (r) { return HS.fmt.money(r.activities); } },
          { key: 'instalments', label: 'Instalments' },
          { key: 'students', label: 'Students', cls: 'num' },
          { key: 'status', label: 'Status', render: function (r) { return U.status(r.status); } }
        ],
        rows: [
          { stage: 'Cambridge Primary', campus: 'Guduvanchery', tuition: 126000, transport: 28800, activities: 9000, instalments: '3 terms', students: 486, status: 'Active' },
          { stage: 'Cambridge Lower Secondary', campus: 'Guduvanchery', tuition: 148000, transport: 28800, activities: 12000, instalments: '3 terms', students: 372, status: 'Active' },
          { stage: 'Cambridge IGCSE', campus: 'Guduvanchery', tuition: 186000, transport: 28800, activities: 15000, instalments: '3 terms', students: 248, status: 'Active' },
          { stage: 'Cambridge AS / A Level', campus: 'Guduvanchery', tuition: 214000, transport: 28800, activities: 18000, instalments: '3 terms', students: 178, status: 'Active' },
          { stage: 'Cambridge Primary', campus: 'Vadavalli', tuition: 98000, transport: 22000, activities: 7500, instalments: '3 terms', students: 412, status: 'Active' },
          { stage: 'Residential programme', campus: 'Pollachi', tuition: 164000, transport: 0, activities: 24000, instalments: '2 terms', students: 184, status: 'Under Review' }
        ]
      }) })
    );
  });

  /* ============================================ PAYMENTS AND RECEIPTS ==== */
  HS.route('payments', function () {
    var rows = [];
    for (var i = 0; i < 12; i++) {
      var m = ['UPI', 'Card', 'Net Banking', 'UPI', 'UPI', 'Cash'][i % 6];
      rows.push({ ref: 'PAY-2026-' + (8840 - i), student: D.students[i].name, id: D.students[i].id,
        amount: 12000 + i * 3400, method: m, date: '16 Sep 2026, ' + (9 + (i % 8)) + ':' + (10 + i * 3),
        status: i === 4 ? 'Pending' : i === 9 ? 'Rejected' : 'Paid' });
    }
    return U.page(
      U.pageHead({ title: 'Payments', sub: 'Every transaction across UPI, card, net banking and counter collection.',
        actions: U.btn('Reconcile', { icon: 'check', route: '#/reconciliation' }) + U.btn('Export', { icon: 'download', action: 'demo', arg: 'Payment register exported' }) }) +
      U.grid('g-4col', [
        U.kpi({ label: 'Collected today', value: HS.fmt.money(486000, { compact: true }), tone: 'teal' }),
        U.kpi({ label: 'Transactions today', value: 38, tone: '' }),
        U.kpi({ label: 'Failed or pending', value: 3, tone: 'amber' }),
        U.kpi({ label: 'Unreconciled', value: 2, tone: 'critical', route: '#/reconciliation' })
      ]) +
      '<div class="mt-4">' + U.card({ flush: true, body: U.table({
        cols: [
          { key: 'ref', label: 'Reference' },
          { key: 'student', label: 'Student', render: function (r) { return HS.studentLink({ id: r.id, name: r.student, grade: '', section: '' }, r.id); } },
          { key: 'amount', label: 'Amount', cls: 'num', render: function (r) { return '<span class="t-num t-bold">' + HS.fmt.money(r.amount) + '</span>'; } },
          { key: 'method', label: 'Method', render: function (r) { return U.badge(r.method, 'neutral'); } },
          { key: 'date', label: 'When' },
          { key: 'status', label: 'Status', render: function (r) { return U.status(r.status); } },
          { key: 'a', label: '', sortable: false, cls: 'num', render: function (r) {
            return r.status === 'Paid' ? U.btn('Receipt', { size: 'sm', icon: 'receipt', action: 'show-receipt', arg: r.ref }) : '';
          } }
        ],
        rows: rows
      }) }) + '</div>'
    );
  });
  HS.on('show-receipt', function (ref) {
    U.modal({
      title: 'Receipt ' + ref, sub: 'Issued automatically on payment',
      body: '<div class="card card--tint" style="padding:20px">' +
        '<div class="row between"><div><div class="serif" style="font-size:18px;font-weight:600">Edunex International</div>' +
        '<div class="t-micro t-muted">Guduvanchery · Academic Year 2026–27</div></div>' +
        U.badge('Paid', 'success', { icon: 'check', lg: true }) + '</div>' +
        '<div class="divider"></div>' +
        U.dl([['Receipt number', ref], ['Student', 'Aditya Kumar · HS-2026-1041'], ['Grade', 'Grade 5A'],
              ['Paid on', '16 Sep 2026, 13:41'], ['Method', 'UPI'], ['Reference', 'UPI/2026091613410088']]) +
        '<div class="divider"></div>' +
        '<div class="row between"><span class="t-sm">Tuition — Term 3 (part)</span><span class="t-num">₹22,000</span></div>' +
        '<div class="row between mt-2"><span class="t-sm">Activities — Robotics Lab</span><span class="t-num">₹4,500</span></div>' +
        '<div class="row between mt-2"><span class="t-sm">Residential trip</span><span class="t-num">₹6,800</span></div>' +
        '<div class="divider"></div>' +
        '<div class="row between"><span class="t-bold">Total paid</span><span class="t-bold t-num" style="font-size:18px">₹33,300</span></div>' +
        '</div>' +
        '<div class="mt-3">' + U.banner('A copy was sent to the parent on WhatsApp within seconds of the payment clearing.', 'success', 'message') + '</div>',
      foot: U.btn('Print', { icon: 'printer', action: 'demo', arg: 'Receipt sent to printer' }) +
        U.btn('Download PDF', { variant: 'primary', icon: 'download', action: 'demo-close' })
    });
  });

  HS.route('receipts', function () {
    return U.page(
      U.pageHead({ title: 'Receipts', sub: 'Issued automatically on payment, delivered to the parent on WhatsApp and stored against the student.' }) +
      U.card({ body: U.flow([
        { label: 'Pay Now', meta: 'Parent app or counter', state: 'done' },
        { label: 'Payment success', meta: 'Gateway confirms', state: 'done' },
        { label: 'Receipt issued', meta: 'Numbered and stored', state: 'done' },
        { label: 'WhatsApp receipt', meta: 'Delivered to the parent', state: 'active' }
      ]) }) +
      '<div class="mt-4">' + U.card({ flush: true, body: U.table({
        cols: [{ key: 'ref', label: 'Receipt' }, { key: 'student', label: 'Student' }, { key: 'amount', label: 'Amount', cls: 'num' },
               { key: 'date', label: 'Issued' },
               { key: 'delivery', label: 'Delivery', render: function (r) { return U.badge(r.delivery, r.delivery === 'Delivered' ? 'success' : 'warning'); } },
               { key: 'a', label: '', sortable: false, cls: 'num', render: function (r) { return U.btn('View', { size: 'sm', action: 'show-receipt', arg: r.ref }); } }],
        rows: [
          { ref: 'RCP-2026-08841', student: 'Aditya Kumar', amount: '₹33,300', date: '16 Sep 2026', delivery: 'Delivered' },
          { ref: 'RCP-2026-08840', student: 'Bhavana Iyer', amount: '₹42,000', date: '16 Sep 2026', delivery: 'Delivered' },
          { ref: 'RCP-2026-08839', student: 'Surya Kumar', amount: '₹18,600', date: '15 Sep 2026', delivery: 'Delivered' },
          { ref: 'RCP-2026-08838', student: 'Nithya Venkatesh', amount: '₹51,600', date: '15 Sep 2026', delivery: 'Pending' }
        ]
      }) }) + '</div>'
    );
  });

  /* ================================= CONCESSIONS / SCHOLARSHIPS ========== */
  HS.route('concessions', function () {
    return U.page(
      U.pageHead({ title: 'Concessions', sub: 'Approved reductions, their value and who authorised them.',
        actions: U.btn('New concession', { variant: 'primary', icon: 'plus', action: 'not-built', arg: 'New concession' }) }) +
      U.grid('g-4col', F.concessions.map(function (c) {
        return U.kpi({ label: c.type, value: c.students, unit: 'students', tone: 'info', foot: HS.fmt.money(c.value, { compact: true }) + ' this year' });
      })) +
      '<div class="mt-4">' + U.card({ title: 'Concession register', flush: true, body: U.table({
        cols: [
          { key: 'type', label: 'Concession type' },
          { key: 'students', label: 'Students', cls: 'num' },
          { key: 'value', label: 'Annual value', cls: 'num', render: function (r) { return HS.fmt.money(r.value); } },
          { key: 'share', label: 'Share of tuition', sortable: false, render: function (r) {
            return U.meter({ label: '', value: r.value / 15200000 * 100 * 3, right: HS.fmt.pct(r.value / 15200000 * 100, 1), tone: 'info' });
          } },
          { key: 'a', label: '', sortable: false, cls: 'num', render: function () { return U.btn('View students', { size: 'sm', route: '#/students' }); } }
        ],
        rows: F.concessions
      }) }) + '</div>'
    );
  });

  HS.route('scholarships', function () {
    return U.page(
      U.pageHead({ title: 'Scholarships', sub: 'Merit and need-based awards, with the evidence that supported each decision.',
        actions: U.btn('Open a scholarship round', { variant: 'primary', icon: 'award', action: 'not-built', arg: 'Scholarship round' }) }) +
      U.grid('g-3col', [
        U.kpi({ label: 'Awards this year', value: 29, tone: 'teal' }),
        U.kpi({ label: 'Total value', value: HS.fmt.money(1450000, { compact: true }), tone: 'amber' }),
        U.kpi({ label: 'Applications under review', value: 7, tone: 'info' })
      ]) +
      '<div class="mt-4">' + U.card({ flush: true, body: U.table({
        cols: [
          { key: 'student', label: 'Student', render: function (r) { return '<button class="t-bold t-info" data-action="open-student" data-arg="HS-2026-1041">' + esc(r.student) + '</button><div class="t-micro t-muted">' + esc(r.grade) + '</div>'; } },
          { key: 'type', label: 'Award' },
          { key: 'value', label: 'Value', cls: 'num' },
          { key: 'basis', label: 'Basis' },
          { key: 'status', label: 'Status', render: function (r) { return U.status(r.status); } }
        ],
        rows: [
          { student: 'Keerthi Pillai', grade: 'Grade 8B', type: 'Merit scholarship', value: '₹62,000', basis: 'Top 2% across three terms', status: 'Approved' },
          { student: 'Vishnu Murthy', grade: 'Grade 9A', type: 'Innovation award', value: '₹40,000', basis: 'State science expo selection', status: 'Approved' },
          { student: 'Manoj Natarajan', grade: 'Grade 7C', type: 'Need-based support', value: '₹48,000', basis: 'Family circumstances, verified', status: 'Under Review' },
          { student: 'Harini Prasad', grade: 'Grade 4C', type: 'Sports scholarship', value: '₹30,000', basis: 'District athletics representation', status: 'Submitted' }
        ]
      }) }) + '</div>'
    );
  });

  /* ================================= EXPENSES / REIMBURSEMENTS / ETC ===== */
  HS.route('expenses', function () {
    return U.page(
      U.pageHead({ title: 'Expenses', sub: 'Raised by staff, approved by a budget owner, then by Finance.',
        actions: U.btn('Raise an expense', { variant: 'primary', icon: 'plus', action: 'not-built', arg: 'Expense form' }) }) +
      U.card({ body: U.flow([
        { label: 'Draft', meta: 'Raised by staff', state: 'done' },
        { label: 'Submitted', meta: '1 waiting', state: 'done' },
        { label: 'Under Review', meta: '1 with a budget owner', state: 'active' },
        { label: 'Approved', meta: '2 this week' },
        { label: 'Rejected', meta: '1 — returned with a reason' }
      ]) }) +
      '<div class="mt-4">' + U.card({ flush: true, body: U.table({
        cols: [
          { key: 'id', label: 'Reference' },
          { key: 'head', label: 'Expense', render: function (r) { return '<span class="t-bold">' + esc(r.head) + '</span>'; } },
          { key: 'amount', label: 'Amount', cls: 'num', render: function (r) { return '<span class="t-num t-bold">' + HS.fmt.money(r.amount) + '</span>'; } },
          { key: 'by', label: 'Raised by' }, { key: 'date', label: 'Date' },
          { key: 'status', label: 'Status', render: function (r) { return U.status(r.status); } },
          { key: 'a', label: '', sortable: false, cls: 'num', render: function (r) {
            return ['Submitted', 'Under Review'].indexOf(r.status) > -1
              ? '<div class="row g-2 end">' + U.btn('Approve', { size: 'sm', variant: 'teal', action: 'demo', arg: r.id + ' approved' }) +
                U.btn('Reject', { size: 'sm', action: 'demo', arg: r.id + ' rejected — reason required' }) + '</div>' : '';
          } }
        ],
        rows: F.expenses
      }) }) + '</div>' +
      '<div class="mt-4">' + U.card({ title: 'Expense by category', sub: 'This academic year',
        body: C.hbar({ rows: [
          { label: 'Salaries & benefits', value: 9840000, color: 'var(--navy)', display: HS.fmt.money(9840000, { compact: true }) },
          { label: 'Transport', value: 2140000, color: 'var(--teal)', display: HS.fmt.money(2140000, { compact: true }) },
          { label: 'Facilities', value: 1620000, color: 'var(--amber)', display: HS.fmt.money(1620000, { compact: true }) },
          { label: 'Academic materials', value: 980000, color: 'var(--viz-4)', display: HS.fmt.money(980000, { compact: true }) },
          { label: 'Events & activities', value: 640000, color: 'var(--viz-5)', display: HS.fmt.money(640000, { compact: true }) },
          { label: 'Technology', value: 520000, color: 'var(--viz-7)', display: HS.fmt.money(520000, { compact: true }) }
        ], labelW: 160, rowH: 32 }) }) + '</div>'
    );
  });

  HS.route('reimbursements', function () {
    return U.page(
      U.pageHead({ title: 'Reimbursements', sub: 'Staff claims for money already spent, on the same approval path as expenses.' }) +
      U.card({ flush: true, body: U.table({
        cols: [
          { key: 'id', label: 'Reference' }, { key: 'who', label: 'Employee', render: function (r) { return U.person(r.who, r.dept); } },
          { key: 'what', label: 'Claim' }, { key: 'amount', label: 'Amount', cls: 'num' }, { key: 'date', label: 'Submitted' },
          { key: 'status', label: 'Status', render: function (r) { return U.status(r.status); } }
        ],
        rows: [
          { id: 'RMB-441', who: 'Ms. Deepa Venkat', dept: 'Student Support', what: 'Counselling conference — travel', amount: '₹6,400', date: '14 Sep 2026', status: 'Under Review' },
          { id: 'RMB-438', who: 'Mr. Sathish Kumar', dept: 'Academics', what: 'Robotics competition entry fee', amount: '₹3,000', date: '12 Sep 2026', status: 'Approved' },
          { id: 'RMB-434', who: 'Murugan P.', dept: 'Transport', what: 'Emergency tyre replacement', amount: '₹8,900', date: '09 Sep 2026', status: 'Approved' },
          { id: 'RMB-429', who: 'Rekha J.', dept: 'Housekeeping', what: 'Cleaning supplies — urgent', amount: '₹2,150', date: '05 Sep 2026', status: 'Rejected' }
        ]
      }) })
    );
  });

  HS.route('allowances', function () { return allowancesPage('Allowances', 'Recurring allowances that feed the payroll run each month.'); });
  HS.route('staff-allowances', function () { return allowancesPage('Allowances', 'Recurring allowances by employee category, applied automatically in payroll.'); });

  function allowancesPage(title, sub) {
    return U.page(
      U.pageHead({ title: title, sub: sub, actions: U.btn('Add allowance', { variant: 'primary', icon: 'plus', action: 'not-built', arg: 'Add allowance' }) }) +
      U.card({ flush: true, body: U.table({
        cols: [
          { key: 'name', label: 'Allowance' }, { key: 'applies', label: 'Applies to' },
          { key: 'amount', label: 'Monthly value', cls: 'num' }, { key: 'employees', label: 'Employees', cls: 'num' },
          { key: 'total', label: 'Monthly cost', cls: 'num' },
          { key: 'status', label: 'Status', render: function (r) { return U.status(r.status); } }
        ],
        rows: [
          { name: 'House rent allowance', applies: 'All permanent staff', amount: '40% of basic', employees: 218, total: '₹2,84,000', status: 'Active' },
          { name: 'Conveyance', applies: 'All staff', amount: '₹3,200', employees: 243, total: '₹77,760', status: 'Active' },
          { name: 'Transport duty allowance', applies: 'Drivers and attendants', amount: '₹2,400', employees: 38, total: '₹91,200', status: 'Active' },
          { name: 'Night shift allowance', applies: 'Security — night shift', amount: '₹3,800', employees: 9, total: '₹34,200', status: 'Active' },
          { name: 'Uniform allowance', applies: 'Non-teaching staff', amount: '₹800', employees: 125, total: '₹1,00,000', status: 'Active' },
          { name: 'CPD allowance', applies: 'Teaching staff', amount: '₹1,500', employees: 118, total: '₹1,77,000', status: 'Under Review' }
        ]
      }) })
    );
  }

  HS.route('budgets', function () {
    return U.page(
      U.pageHead({ title: 'Budgets', sub: 'Budget against actual, by department, with the year-end position projected.' }) +
      U.grid('g-4col', [
        U.kpi({ label: 'Annual budget', value: HS.fmt.money(24600000, { compact: true }), tone: '' }),
        U.kpi({ label: 'Spent to date', value: HS.fmt.money(15740000, { compact: true }), tone: 'teal', foot: '64% of budget, 50% of year' }),
        U.kpi({ label: 'Committed', value: HS.fmt.money(2180000, { compact: true }), tone: 'amber' }),
        U.kpi({ label: 'Projected variance', value: '+' + HS.fmt.money(640000, { compact: true }), tone: 'critical', foot: 'Over budget — transport fuel' })
      ]) +
      '<div class="mt-4">' + U.card({ title: 'Budget against actual by department', flush: true, body: U.table({
        cols: [
          { key: 'dept', label: 'Department' },
          { key: 'budget', label: 'Budget', cls: 'num', render: function (r) { return HS.fmt.money(r.budget, { compact: true }); } },
          { key: 'actual', label: 'Actual', cls: 'num', render: function (r) { return HS.fmt.money(r.actual, { compact: true }); } },
          { key: 'use', label: 'Utilisation', sortable: false, render: function (r) {
            var p = Math.round(r.actual / r.budget * 100);
            return U.meter({ label: '', value: Math.min(100, p), right: p + '%', tone: p > 95 ? 'critical' : p > 75 ? 'amber' : 'teal' });
          } },
          { key: 'owner', label: 'Owner' }
        ],
        rows: [
          { dept: 'Academics', budget: 3200000, actual: 1980000, owner: 'Dr. Meera Krishnan' },
          { dept: 'Transport', budget: 2400000, actual: 2340000, owner: 'Murugan P.' },
          { dept: 'Facilities', budget: 1800000, actual: 1180000, owner: 'Murugan P.' },
          { dept: 'Technology', budget: 900000, actual: 520000, owner: 'Mr. Sathish Kumar' },
          { dept: 'Student activities', budget: 1100000, actual: 640000, owner: 'Ms. Deepa Venkat' },
          { dept: 'Marketing & admissions', budget: 600000, actual: 183000, owner: 'Kavitha S.' }
        ]
      }) }) + '</div>'
    );
  });

  HS.route('reconciliation', function () {
    return U.page(
      U.pageHead({ title: 'Reconciliation', sub: 'Gateway settlements matched against the fee ledger, every day.',
        actions: U.btn('Run reconciliation', { variant: 'primary', icon: 'refresh', action: 'demo', arg: 'Reconciliation run — 2 exceptions found' }) }) +
      U.grid('g-4col', [
        U.kpi({ label: 'Matched today', value: 36, tone: 'teal' }),
        U.kpi({ label: 'Exceptions', value: 2, tone: 'critical' }),
        U.kpi({ label: 'Settlement received', value: HS.fmt.money(462800, { compact: true }), tone: '' }),
        U.kpi({ label: 'In transit', value: HS.fmt.money(23200, { compact: true }), tone: 'amber', foot: 'Expected tomorrow' })
      ]) +
      '<div class="mt-4">' + U.card({ title: 'Exceptions', sub: 'Items that did not match automatically', flush: true, body: U.table({
        cols: [{ key: 'ref', label: 'Reference' }, { key: 'issue', label: 'Issue' }, { key: 'amount', label: 'Amount', cls: 'num' },
               { key: 'a', label: '', sortable: false, cls: 'num', render: function (r) {
                 return '<div class="row g-2 end">' + U.btn('Match manually', { size: 'sm', action: 'demo', arg: r.ref + ' matched' }) +
                   U.btn('Raise with gateway', { size: 'sm', action: 'demo', arg: 'Query raised' }) + '</div>';
               } }],
        rows: [
          { ref: 'PAY-2026-8831', issue: 'Settlement amount differs by ₹200 (gateway fee posted separately)', amount: '₹18,400' },
          { ref: 'PAY-2026-8824', issue: 'Payment received, no matching invoice line', amount: '₹4,800' }
        ]
      }) }) + '</div>'
    );
  });

  HS.route('financial-reports', function () {
    return U.page(
      U.pageHead({ title: 'Financial Reports', sub: 'Standard reports, each exportable and scheduled.',
        actions: U.btn('Schedule a report', { icon: 'clock', action: 'not-built', arg: 'Report scheduling' }) }) +
      '<div class="grid g-3col g-4">' + [
        ['Fee collection summary', 'Billed, collected and outstanding by head and campus', 'wallet'],
        ['Ageing analysis', 'Outstanding by days overdue, by grade and by campus', 'clock'],
        ['Cash flow forecast', 'Expected receipts by instalment due date', 'trending'],
        ['Concession and scholarship report', 'Value awarded, by type and by approver', 'award'],
        ['Expense and budget report', 'Department spend against budget, with commitments', 'pieChart'],
        ['Payroll cost report', 'Gross, deductions, net and cost per category', 'briefcase'],
        ['Reconciliation log', 'Matched, unmatched and exception history', 'check'],
        ['Campus comparison', 'Every financial measure, campus by campus', 'building'],
        ['Audit pack', 'Everything an auditor asks for, in one export', 'folder']
      ].map(function (r) {
        return '<button class="card card--link" style="padding:18px;text-align:left" data-action="demo" data-arg="' + esc(r[0]) + ' generated">' +
          '<span class="row g-3"><span class="avatar none">' + HS.icon(r[2], 17) + '</span>' +
          '<span class="col grow"><span class="t-sm t-bold">' + esc(r[0]) + '</span>' +
          '<span class="t-micro t-muted">' + esc(r[1]) + '</span></span></span>' +
          '<span class="row g-2 mt-3 t-xs t-muted">' + HS.icon('download', 13) + 'PDF · Excel · scheduled email</span></button>';
      }).join('') + '</div>'
    );
  });
})(window.HS = window.HS || {});
