/* ==========================================================================
   VIEWS — School Knowledge AI, Analytics, Reports
   ========================================================================== */
(function (HS) {
  'use strict';
  var U = HS.ui, D = HS.data, C = HS.charts, esc = HS.esc;

  /* ============================================== SCHOOL KNOWLEDGE AI ==== */
  HS.route('knowledge-ai', function () {
    var v = HS.vs('kai', { asked: 0 });
    var qa = D.ai.knowledgeQA[v.asked];

    return U.page(
      U.pageHead({
        title: 'School Knowledge AI',
        sub: 'Ask the school anything. Answers come only from approved school documents and live records, and always show their source.',
        actions: U.btn('Manage sources', { icon: 'folder', action: 'kai-sources' })
      }) +
      '<div class="grid g-main">' +
      '<div class="col g-4">' +
      U.card({
        title: 'Ask Edunex Knowledge',
        body: '<div class="input-icon" style="max-width:none">' + HS.icon('brain', 16) +
          '<input class="input" style="height:46px" placeholder="For example: what is the procedure for student leave?" value="' + esc(qa.q) + '">' +
          '</div>' +
          '<div class="row g-2 wrap mt-3">' + D.ai.knowledgeQA.map(function (x, i) {
            return '<button class="chip" aria-pressed="' + (i === v.asked) + '" data-action="kai-ask" data-arg="' + i + '">' + esc(x.q) + '</button>';
          }).join('') + '</div>'
      }) +
      '<section class="ai-card">' +
      '<div class="ai-card__head"><span class="ai-badge">' + HS.icon('brain', 12) + 'Answer</span>' +
      '<span class="t-xs t-muted grow">Sourced from approved school documents</span>' +
      U.badge(qa.confidence + ' confidence', qa.confidence === 'High' ? 'success' : 'warning') + '</div>' +
      '<div class="card__body">' +
      '<p class="t-sm" style="font-size:15px;line-height:1.65">' + esc(qa.a) + '</p>' +
      (qa.chart ? '<div class="mt-5">' + C.hbar({ rows: [
        { label: 'WhatsApp', value: 11, color: 'var(--teal)' }, { label: 'Website', value: 8, color: 'var(--navy)' },
        { label: 'Meta Ads', value: 6, color: 'var(--viz-4)' }, { label: 'Referral', value: 4, color: 'var(--amber)' },
        { label: 'Google', value: 2, color: 'var(--viz-5)' }, { label: 'Walk-in', value: 1, color: 'var(--viz-7)' }
      ], labelW: 96, rowH: 28 }) + '</div>' : '') +
      '<div class="divider"></div>' +
      '<div class="eyebrow mb-3">Sources</div>' +
      '<div class="col g-2">' + qa.sources.map(function (s) {
        return '<button class="card card--tint row g-3" style="padding:10px 12px;text-align:left" data-action="demo" data-arg="' + esc(s.doc) + ' opened">' +
          HS.icon('fileText', 16, 't-muted') +
          '<span class="col grow"><span class="t-sm t-bold">' + esc(s.doc) + '</span>' +
          '<span class="t-micro t-muted">' + esc(s.section) + ' · updated ' + esc(s.updated) + '</span></span>' +
          HS.icon('external', 14, 't-faint') + '</button>';
      }).join('') + '</div>' +
      '<div class="mt-4">' + U.aiNotice('<strong>Permission-aware.</strong> The answer is built only from documents and records the person asking is allowed to see. A teacher and a parent asking the same question can get different answers, and neither sees anything they should not.') + '</div>' +
      '<div class="row g-2 mt-3">' +
      U.btn('Helpful', { size: 'sm', icon: 'check', action: 'demo', arg: 'Feedback recorded — this improves source ranking' }) +
      U.btn('Not quite', { size: 'sm', icon: 'x', action: 'demo', arg: 'Feedback recorded — routed to the knowledge owner' }) +
      U.btn('Ask a person instead', { size: 'sm', icon: 'message', action: 'demo', arg: 'Question routed to the front office' }) +
      '</div></div></section>' +
      '</div>' +
      '<div class="col g-4">' +
      U.card({ title: 'Approved sources', sub: 'What the assistant is allowed to read', flush: true,
        body: '<div>' + [
          ['Student Handbook 2026–27', 'Policy', '12 Jun 2026'],
          ['Academic Calendar 2026–27', 'Calendar', '01 Sep 2026'],
          ['Safeguarding Policy v3.0', 'Policy · restricted', '02 Sep 2026'],
          ['Attendance Policy', 'Policy', '02 May 2026'],
          ['Fee Structure 2026–27', 'Finance', '01 Apr 2026'],
          ['Transport Handbook', 'Operations', '18 Jul 2026'],
          ['Staff Handbook', 'HR · staff only', '10 Aug 2026'],
          ['Live records', 'Admissions, attendance, fees, PTM', 'Continuous']
        ].map(function (s) {
          return '<div class="row g-3" style="padding:11px 20px;border-bottom:1px solid var(--border-soft)">' +
            HS.icon(s[1] === 'Continuous' ? 'zap' : 'fileText', 15, 't-muted') +
            '<span class="col grow" style="min-width:0"><span class="t-sm t-clip">' + esc(s[0]) + '</span>' +
            '<span class="t-micro t-muted">' + esc(s[1]) + '</span></span>' +
            '<span class="t-micro t-faint none">' + esc(s[2]) + '</span></div>';
        }).join('') + '</div>' }) +
      U.card({ title: 'Most asked this month', body: C.hbar({ rows: [
        { label: 'Fee due dates', value: 184, color: 'var(--navy)' },
        { label: 'Leave procedure', value: 142, color: 'var(--teal)' },
        { label: 'PTM timings', value: 118, color: 'var(--amber)' },
        { label: 'Transport routes', value: 96, color: 'var(--viz-4)' },
        { label: 'Uniform policy', value: 71, color: 'var(--viz-5)' }
      ], labelW: 120, rowH: 28 }) }) +
      '</div></div>'
    );
  });
  HS.on('kai-ask', function (i) { HS.vs('kai').asked = Number(i); HS.render(); });
  HS.on('kai-sources', function () {
    U.modal({
      title: 'Knowledge sources', sub: 'What the assistant may read, and who may see the answer',
      body: '<p class="t-sm t-muted">Documents are uploaded and approved by the school. Nothing outside this set is used to answer a question, and every answer names the document it came from.</p>' +
        '<div class="mt-4">' + U.flow([
          { label: 'Upload', meta: 'By an authorised owner', state: 'done' },
          { label: 'Approve', meta: 'Principal or section head', state: 'done' },
          { label: 'Set visibility', meta: 'Which roles may see it', state: 'active' },
          { label: 'Live', meta: 'Answers cite it by name' }
        ]) + '</div>' +
        '<div class="mt-4">' + U.banner('Restricted documents such as the safeguarding policy are readable by the assistant only when the person asking already has access to them.', 'warning', 'lock') + '</div>',
      foot: U.btn('Close', { variant: 'primary', action: 'close-overlay' })
    });
  });

  /* ========================================================= ANALYTICS === */
  HS.route('analytics', function () {
    var v = HS.vs('analytics', { area: 'Students' });
    var areas = ['Students', 'Academics', 'Admissions', 'Finance', 'Workforce', 'Safety'];
    var body;

    if (v.area === 'Students') {
      body = '<div class="grid g-2col g-4">' +
        U.card({ title: 'Enrolment by grade', body: C.bar({ labels: ['G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10'],
          series: [{ name: 'Students', values: [96, 98, 96, 99, 94, 92, 88, 84], color: 'var(--navy)' }], height: 230 }) }) +
        U.card({ title: 'Risk bands over the year', body: C.stacked({ labels: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
          series: [{ name: 'On Track', values: [1198, 1204, 1211, 1221, 1228, 1233], color: 'var(--teal)' },
                   { name: 'Developing', values: [52, 48, 44, 41, 39, 37], color: 'var(--amber)' },
                   { name: 'At Risk', values: [23, 21, 19, 17, 15, 14], color: 'var(--critical)' }], height: 230 }) }) +
        U.card({ title: 'Attendance against academic average', sub: 'Each band, this term', body: C.line({
          labels: ['<80%', '80–85%', '85–90%', '90–95%', '>95%'],
          series: [{ name: 'Academic average', values: [52, 58, 66, 74, 79], color: 'var(--teal)' }], height: 220 }) +
          '<p class="t-xs t-muted mt-3">The relationship between attendance and attainment is the single clearest pattern in the data, and the reason attendance drives the Early Warning check.</p>' }) +
        U.card({ title: 'Participation', sub: 'Students in at least one activity', body: C.gauge({ percent: 72, value: '72%', sub: '924 of 1,284 students', color: 'var(--amber)' }) }) +
        '</div>';
    } else if (v.area === 'Academics') {
      body = '<div class="grid g-2col g-4">' +
        U.card({ title: 'Subject averages', body: C.bar({ labels: ['English', 'Maths', 'Science', 'Tamil', 'Social', 'Computing'],
          series: [{ name: 'Average', values: [74, 69, 72, 79, 68, 77], color: 'var(--navy)' }], yMax: 100, target: 72, targetLabel: 'School average', height: 230 }) }) +
        U.card({ title: 'Coverage against mastery', body: C.line({ labels: ['T1', 'T2', 'T3', 'Mid', 'T4', 'Now'],
          series: [{ name: 'Coverage', values: [22, 39, 51, 60, 68, 74], color: 'var(--navy)' },
                   { name: 'Mastery', values: [19, 33, 43, 51, 58, 62], color: 'var(--teal)' }], yMax: 100, unit: '%', height: 230 }) }) +
        U.card({ title: 'Predicted grade distribution', sub: 'IGCSE cohort', body: C.bar({ labels: ['A*', 'A', 'B', 'C', 'D', 'E'],
          series: [{ name: 'Students', values: [18, 44, 61, 72, 38, 15], colors: ['var(--teal)', 'var(--teal)', 'var(--navy)', 'var(--navy)', 'var(--amber)', 'var(--critical)'] }], height: 220 }) }) +
        U.card({ title: 'Assessment completion', body: C.gauge({ percent: 84, value: '84%', sub: 'Marks entered on time', color: 'var(--teal)' }) }) +
        '</div>';
    } else if (v.area === 'Admissions') {
      body = '<div class="grid g-2col g-4">' +
        U.card({ title: 'Funnel', body: U.funnel(D.admissions.funnel) }) +
        U.card({ title: 'Source mix', body: C.donut({ size: 200, thickness: 28, center: '268', centerSub: 'enquiries', data: D.admissions.sources }) +
          '<div class="mt-4">' + C.legend(D.admissions.sources) + '</div>' }) +
        U.card({ title: 'Enquiries and admissions', body: C.bar({ labels: D.admissions.monthly.labels,
          series: [{ name: 'Enquiries', values: D.admissions.monthly.enquiries, color: 'var(--navy)' },
                   { name: 'Admissions', values: D.admissions.monthly.admissions, color: 'var(--teal)' }], height: 230 }) }) +
        U.card({ title: 'Target progress', body: C.gauge({ percent: 32, value: '38/120', sub: 'Admissions against target', color: 'var(--amber)' }) }) +
        '</div>';
    } else if (v.area === 'Finance') {
      body = '<div class="grid g-2col g-4">' +
        U.card({ title: 'Collection trend', body: C.bar({ labels: D.finance.collectionTrend.labels,
          series: [{ name: 'Billed', values: D.finance.collectionTrend.billed, color: 'var(--border-strong)' },
                   { name: 'Collected', values: D.finance.collectionTrend.collected, color: 'var(--teal)' }], height: 230 }) }) +
        U.card({ title: 'Overdue ageing', body: C.hbar({ rows: D.finance.ageing.map(function (a) {
          return { label: a.label, value: a.value, color: a.color, display: HS.fmt.money(a.value, { compact: true }) }; }), labelW: 92, rowH: 32 }) }) +
        U.card({ title: 'Payment method', body: C.donut({ size: 180, thickness: 26, center: '58%', centerSub: 'UPI', data: D.finance.methods }) +
          '<div class="mt-4">' + C.legend(D.finance.methods) + '</div>' }) +
        U.card({ title: 'Collection rate', body: C.gauge({ percent: 82, value: '82.2%', sub: 'Of billed, year to date', color: 'var(--teal)' }) }) +
        '</div>';
    } else if (v.area === 'Workforce') {
      body = '<div class="grid g-2col g-4">' +
        U.card({ title: 'Composition', body: C.donut({ size: 200, thickness: 28, center: '243', centerSub: 'employees', data: D.workforce.categories }) +
          '<div class="mt-4">' + C.legend(D.workforce.categories) + '</div>' }) +
        U.card({ title: 'Payroll by category', body: C.hbar({ rows: D.workforce.payroll.byCategory.map(function (c) {
          return { label: c.label, value: c.gross, display: HS.fmt.money(c.gross, { compact: true }) }; }), labelW: 140, rowH: 32 }) }) +
        U.card({ title: 'Attendance by department', body: C.bar({ labels: ['Acad.', 'Trans.', 'Sec.', 'Office', 'Housekp.', 'Lab'],
          series: [{ name: 'Present %', values: [96, 92, 88, 95, 96, 100], color: 'var(--teal)' }], yMax: 100, height: 220 }) }) +
        U.card({ title: 'CPD against target', body: C.gauge({ percent: 78, value: '18.6 h', sub: 'Average, target 24 hours', color: 'var(--amber)' }) }) +
        '</div>';
    } else {
      body = '<div class="grid g-2col g-4">' +
        U.card({ title: 'Arrivals through the morning', body: C.line({ labels: ['7:30', '7:45', '8:00', '8:15', '8:30', '8:45', '9:00'],
          series: [{ name: 'Cumulative', values: [38, 142, 396, 812, 1094, 1156, 1178], color: 'var(--teal)' }], height: 230 }) }) +
        U.card({ title: 'Safety events by type', body: C.hbar({ rows: [
          { label: 'Transport', value: 9, color: 'var(--amber)' }, { label: 'Health', value: 7, color: 'var(--viz-4)' },
          { label: 'Facilities', value: 5, color: 'var(--navy)' }, { label: 'Safeguarding', value: 2, color: 'var(--critical)' }
        ], labelW: 120, rowH: 30 }) }) +
        U.card({ title: 'Bus punctuality', body: C.bar({ labels: ['R2', 'R4', 'R7', 'R9', 'R12', 'R15'],
          series: [{ name: 'On-time %', values: [98, 74, 96, 92, 99, 88],
            colors: [98, 74, 96, 92, 99, 88].map(function (p) { return p < 85 ? 'var(--critical)' : p < 95 ? 'var(--amber)' : 'var(--teal)'; }) }], yMax: 100, height: 220 }) }) +
        U.card({ title: 'Parent notification delivery', body: C.gauge({ percent: 97, value: '97%', sub: 'Delivered within 60 seconds', color: 'var(--teal)' }) }) +
        '</div>';
    }

    return U.page(
      U.pageHead({
        title: 'Analytics',
        sub: 'The same figures the Command Center summarises, with room to explore them.',
        actions: U.btn('Ask in plain language', { variant: 'amber', icon: 'brain', route: '#/knowledge-ai' }) +
          U.btn('Export', { icon: 'download', action: 'demo', arg: 'Analytics pack exported' })
      }) +
      '<div class="filterbar">' + U.chips(areas, v.area, 'analytics-area') +
        '<div class="spacer"></div>' + U.illustrative() + '</div>' +
      body
    );
  });
  HS.on('analytics-area', function (arg) { HS.vs('analytics').area = arg; HS.render(); });

  /* =========================================================== REPORTS === */
  HS.route('reports', function () {
    var groups = [
      { group: 'Students', items: [
        ['Daily attendance summary', 'Present, absent and late by class and campus'],
        ['Early Warning review list', 'Open signals, interventions and owners'],
        ['Student progress report', 'Academic trend, attendance and participation per student'],
        ['Portfolio completeness', 'Evidence coverage by grade']
      ] },
      { group: 'Academics', items: [
        ['Assessment results pack', 'Distribution, moderation notes and predicted grades'],
        ['Curriculum coverage', 'Objectives taught against objectives planned'],
        ['Report card status', 'Where every class sits in the release workflow']
      ] },
      { group: 'Operations', items: [
        ['Admissions funnel report', 'Stage movement, source mix and cost per admission'],
        ['Fee collection and ageing', 'Collection, outstanding and overdue by head'],
        ['Payroll cost report', 'Gross, deductions and net by employee category'],
        ['Compliance status', 'Every requirement, owner and due date'],
        ['Safety and incident log', 'Gate, transport, health and safeguarding events']
      ] },
      { group: 'Management', items: [
        ['Daily brief', 'The end-of-day summary the Principal receives'],
        ['Board pack', 'Consolidated group performance for a governance meeting'],
        ['Campus comparison', 'Every measure, campus by campus']
      ] }
    ];
    return U.page(
      U.pageHead({ title: 'Reports', sub: 'Standard reports across every module. Each one can be scheduled to arrive by email.',
        actions: U.btn('Schedule a report', { icon: 'clock', action: 'not-built', arg: 'Report scheduling' }) }) +
      groups.map(function (g) {
        return '<div class="mt-5">' + U.sectionHead(g.group) +
          '<div class="grid g-3col">' + g.items.map(function (r) {
            return '<button class="card card--link" style="padding:18px;text-align:left" data-action="demo" data-arg="' + esc(r[0]) + ' generated">' +
              '<span class="row g-3"><span class="avatar none">' + HS.icon('fileText', 17) + '</span>' +
              '<span class="col grow"><span class="t-sm t-bold">' + esc(r[0]) + '</span>' +
              '<span class="t-micro t-muted">' + esc(r[1]) + '</span></span></span></button>';
          }).join('') + '</div></div>';
      }).join('')
    );
  });
})(window.HS = window.HS || {});
