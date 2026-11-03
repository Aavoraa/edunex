/* ==========================================================================
   VIEWS — Admissions CRM, pipeline, lead profile, conversion, school CRM
   ========================================================================== */
(function (HS) {
  'use strict';
  var U = HS.ui, D = HS.data, C = HS.charts, esc = HS.esc;
  var A = D.admissions;

  var SOURCE_TONE = { WhatsApp: 'success', Website: 'info', 'Meta Ads': 'info', Referral: 'warning', Google: 'neutral', 'Walk-in': 'neutral', Instagram: 'warning' };

  function leadRow(l) {
    return '<button class="pipecard" data-action="open-lead" data-arg="' + esc(l.id) + '">' +
      '<span class="row between"><span class="t-sm t-bold t-clip">' + esc(l.student) + '</span>' +
      '<span class="t-micro t-muted t-num">' + l.score + '</span></span>' +
      '<span class="t-micro t-muted" style="display:block">' + esc(l.grade) + ' · ' + esc(l.parent) + '</span>' +
      '<span class="row between mt-2">' + U.badge(l.source, SOURCE_TONE[l.source] || 'neutral') +
      '<span class="t-micro t-muted">' + esc(l.counsellor === 'Unassigned' ? '⚠ Unassigned' : l.counsellor.split(' ')[0]) + '</span></span>' +
      '</button>';
  }

  /* ================================================== ADMISSIONS DASH ==== */
  HS.route('admissions', function (params) {
    var v = HS.vs('adm', { view: 'dashboard' });
    var k = A.kpis;

    if (v.view === 'pipeline') return pipelineView(v);

    return U.page(
      U.pageHead({
        title: 'Admissions',
        sub: 'Omnichannel capture through to enrolment, with the cost of each admission visible throughout.',
        actions: U.segment([{ id: 'dashboard', label: 'Dashboard' }, { id: 'pipeline', label: 'Pipeline' }], v.view, 'adm-view') +
          U.btn('New enquiry', { variant: 'primary', icon: 'plus', action: 'not-built', arg: 'New enquiry form' })
      }) +
      U.grid('g-4col', [
        U.kpi({ label: 'New enquiries', value: k.enquiries, tone: '', delta: 8, foot: 'This academic year' }),
        U.kpi({ label: 'Qualified leads', value: k.qualified, tone: 'info', delta: 12, foot: '65% of enquiries' }),
        U.kpi({ label: 'Campus visits', value: k.visits, tone: 'amber', foot: '14 scheduled this week' }),
        U.kpi({ label: 'Applications', value: k.applications, tone: '', foot: '9 awaiting documents' }),
        U.kpi({ label: 'Offers', value: k.offers, tone: 'info', foot: '6 expiring within 7 days' }),
        U.kpi({ label: 'Admissions', value: k.admitted, tone: 'teal', delta: 15, foot: 'Target ' + k.target }),
        U.kpi({ label: 'Conversion', value: k.conversion + '%', tone: 'teal', delta: 1.4, foot: 'Enquiry to admission' }),
        U.kpi({ label: 'Cost per admission', value: HS.fmt.money(k.cpa), tone: 'amber', delta: -6, inverse: true, foot: 'Marketing spend ÷ admissions' })
      ]) +
      '<div class="grid g-main mt-5">' +
      U.card({
        title: 'Conversion funnel',
        sub: 'Enquiry → Qualified → Visit → Application → Assessment → Offer → Admission',
        actions: U.btn('Open pipeline', { size: 'sm', action: 'adm-view', arg: 'pipeline', iconRight: 'arrowRight' }),
        body: U.funnel(A.funnel, 'adm-funnel') +
          '<div class="divider"></div>' +
          '<div class="grid g-3col g-4">' +
          '<div class="card card--tint" style="padding:14px"><div class="eyebrow">Biggest drop</div>' +
          '<div class="t-sm t-bold mt-1">Qualified → Visit</div><div class="t-micro t-muted">45% of qualified leads never visit the campus</div></div>' +
          '<div class="card card--tint" style="padding:14px"><div class="eyebrow">Strongest step</div>' +
          '<div class="t-sm t-bold mt-1">Assessment → Offer</div><div class="t-micro t-muted">88% of assessed applicants receive an offer</div></div>' +
          '<div class="card card--tint" style="padding:14px"><div class="eyebrow">Time to admit</div>' +
          '<div class="t-sm t-bold mt-1">21 days median</div><div class="t-micro t-muted">From first enquiry to enrolment</div></div>' +
          '</div>'
      }) +
      '<div class="col g-4">' +
      U.card({
        title: 'Enquiries by source',
        sub: 'WhatsApp is now the largest single channel',
        body: C.hbar({ rows: A.sources.map(function (s) { return { label: s.label, value: s.value, color: s.color }; }), labelW: 100, rowH: 30 })
      }) +
      U.card({
        title: 'Follow-ups needing attention', flush: true,
        body: '<div>' +
          U.alertItem({ tone: 'critical', icon: 'alertCircle', title: 'LD-4380 — no counsellor assigned', meta: 'Created 12 Sep · first contact overdue', action: 'open-lead', arg: 'LD-4380' }) +
          U.alertItem({ tone: 'warning', icon: 'clock', title: 'LD-4388 — offer expires in 6 days', meta: 'Grade 11 AS Level · Ravi T.', action: 'open-lead', arg: 'LD-4388' }) +
          U.alertItem({ tone: 'warning', icon: 'fileText', title: 'LD-4405 — documents not uploaded', meta: 'Application stalled 8 days', action: 'open-lead', arg: 'LD-4405' }) +
          U.alertItem({ tone: 'info', icon: 'calendar', title: '14 campus visits this week', meta: '4 need a host confirmation', route: '#/visits' }) +
          '</div>'
      }) +
      '</div></div>' +
      '<div class="grid g-2col g-4 mt-5">' +
      U.card({
        title: 'Enquiries and admissions by month',
        body: C.bar({
          labels: A.monthly.labels,
          series: [{ name: 'Enquiries', values: A.monthly.enquiries, color: 'var(--navy)' },
                   { name: 'Admissions', values: A.monthly.admissions, color: 'var(--teal)' }],
          height: 230
        }) + '<div class="mt-3">' + C.legend([{ label: 'Enquiries', color: 'var(--navy)' }, { label: 'Admissions', color: 'var(--teal)' }]) + '</div>'
      }) +
      U.card({
        title: 'Admission automation',
        sub: 'What happens without anyone touching it',
        body: '<div class="col g-2">' + D.automations[2].steps.map(function (s, i, arr) {
          return '<div class="row g-3"><span class="stepper__num" style="background:' + (i < 4 ? 'var(--teal)' : 'var(--navy)') + ';color:#fff">' + (i + 1) + '</span>' +
            '<span class="t-sm grow">' + esc(s) + '</span>' + (i < arr.length - 1 ? HS.icon('arrowDown', 13, 't-faint') : HS.icon('check', 14, 't-success')) + '</div>';
        }).join('') + '</div>' +
          (HS.state.role === 'management'
            ? '<div class="mt-4">' + U.btn('See the WhatsApp AI that starts it', { block: true, icon: 'message', route: '#/whatsapp-ai' }) + '</div>'
            : '')
      }) +
      '</div>' +
      '<div class="mt-5">' + leadsTable() + '</div>'
    );
  });
  HS.on('adm-view', function (arg) { HS.vs('adm').view = arg; HS.render(); });
  HS.on('adm-funnel', function (arg) { HS.vs('adm').view = 'pipeline'; HS.render(); });

  function leadsTable(rows) {
    return U.card({
      title: 'Leads', sub: (rows || A.leads).length + ' active',
      actions: U.btn('Open full list', { size: 'sm', route: '#/leads', iconRight: 'arrowRight' }),
      flush: true,
      body: U.table({
        rowAction: 'open-lead', rowId: function (r) { return r.id; },
        cols: [
          { key: 'student', label: 'Student / Parent', render: function (r) {
            return '<span class="person"><span class="avatar avatar--sm ' + HS.toneFor(r.student) + '">' + esc(HS.fmt.initials(r.student)) + '</span>' +
              '<span class="col"><span class="person__name">' + esc(r.student) + '</span><span class="person__meta">' + esc(r.parent) + ' · ' + esc(r.id) + '</span></span></span>';
          } },
          { key: 'grade', label: 'Grade' },
          { key: 'curriculum', label: 'Curriculum', render: function (r) { return '<span class="t-xs t-muted">' + esc(r.curriculum) + '</span>'; } },
          { key: 'source', label: 'Source', render: function (r) { return U.badge(r.source, SOURCE_TONE[r.source] || 'neutral'); } },
          { key: 'stage', label: 'Stage', render: function (r) { return U.badge(r.stage, r.stage === 'Enrolled' ? 'success' : r.stage === 'New Lead' ? 'info' : 'neutral'); } },
          { key: 'score', label: 'Score', cls: 'num', render: function (r) {
            return '<span class="t-num t-bold ' + (r.score >= 80 ? 't-success' : r.score < 55 ? 't-critical' : '') + '">' + r.score + '</span>';
          } },
          { key: 'counsellor', label: 'Counsellor', render: function (r) { return r.counsellor === 'Unassigned' ? U.badge('Unassigned', 'critical') : esc(r.counsellor); } },
          { key: 'next', label: 'Next action', render: function (r) { return '<span class="t-xs">' + esc(r.next) + '</span>'; } }
        ],
        rows: rows || A.leads
      })
    });
  }

  function pipelineView(v) {
    var byStage = {};
    A.stages.forEach(function (s) { byStage[s] = []; });
    A.leads.forEach(function (l) { (byStage[l.stage] = byStage[l.stage] || []).push(l); });
    return U.page(
      U.pageHead({
        title: 'Counselling pipeline',
        sub: 'New Lead → Contacted → Qualified → Visit Scheduled → Visit Completed → Application → Assessment → Offer → Enrolled',
        actions: U.segment([{ id: 'dashboard', label: 'Dashboard' }, { id: 'pipeline', label: 'Pipeline' }], v.view, 'adm-view') +
          U.btn('Add lead', { variant: 'primary', icon: 'plus', action: 'not-built', arg: 'Add lead' })
      }) +
      '<div class="card card--pad">' +
      '<div class="pipeline">' + A.stages.map(function (s) {
        var items = byStage[s] || [];
        return '<div class="pipeline__col"><div class="pipeline__colhead">' +
          '<span class="pipeline__coltitle">' + esc(s) + '</span>' +
          '<span class="pipeline__count">' + items.length + '</span></div>' +
          (items.length ? items.map(leadRow).join('') : '<div class="t-micro t-muted t-center" style="padding:16px 0">No leads</div>') +
          '</div>';
      }).join('') + '</div>' +
      '<p class="t-xs t-muted mt-3">Drag-and-drop between stages is part of the build. In this prototype, open a lead and change the stage from the profile.</p>' +
      '</div>'
    );
  }

  HS.on('open-lead', function (id) {
    var l = A.leads.filter(function (x) { return x.id === id; })[0] || A.leads[0];
    var stageIndex = A.stages.indexOf(l.stage);
    U.modal({
      title: l.student + ' — ' + l.grade, sub: l.id + ' · created ' + l.created + ' · lead score ' + l.score, size: 'full',
      body: '<div class="mb-5">' + U.stepper(A.stages, stageIndex) + '</div>' +
        '<div class="grid g-2col g-5">' +
        '<div class="col g-4">' +
        U.card({ title: 'Lead detail', tight: true, body: U.dl([
          ['Parent', l.parent], ['Phone', l.phone], ['Student', l.student], ['Grade applied', l.grade],
          ['Curriculum', l.curriculum], ['Preferred campus', (D.campuses.filter(function (c) { return c.id === l.campus; })[0] || {}).name || ''],
          ['Transport', l.transport], ['Source', l.source], ['Campaign', l.campaign], ['Counsellor', l.counsellor]
        ]) }) +
        U.card({ title: 'Documents', tight: true, body: U.table({ compact: true, stack: false, cols: [
          { key: 'n', label: 'Document' }, { key: 's', label: 'Status', render: function (r) { return U.status(r.s); } }
        ], rows: [{ n: 'Birth certificate', s: 'Verified' }, { n: 'Previous report card', s: 'Pending' }, { n: 'Address proof', s: 'Verified' }, { n: 'Photograph', s: 'Pending' }] }) }) +
        '</div>' +
        '<div class="col g-4">' +
        U.card({ title: 'Communication history', tight: true, body: U.feed([
          { time: 'Today', text: 'WhatsApp — visit reminder sent', icon: 'message', meta: 'Delivered · read 09:22' },
          { time: '14 Sep', text: 'Call — discussed transport and fee structure', icon: 'phone', meta: 'Kavitha S. · 6 min' },
          { time: '12 Sep', text: 'WhatsApp AI answered the first enquiry', icon: 'sparkle', meta: 'Lead created automatically' },
          { time: '11 Sep', text: 'Meta ad click — Sep Admissions campaign', icon: 'target', meta: 'Source recorded' }
        ]) }) +
        U.card({ title: 'Follow-up tasks', tight: true, body: '<div class="col g-2">' + [
          ['Campus visit — 18 Sep, 10:00', 'Scheduled'], ['Send fee structure', 'Completed'], ['Collect previous report card', 'Pending']
        ].map(function (t) {
          return '<div class="row between"><span class="t-sm">' + esc(t[0]) + '</span>' + U.status(t[1]) + '</div>';
        }).join('') + '</div>' +
          '<div class="mt-3">' + U.field({ type: 'textarea', label: 'Add a note', rows: 2, placeholder: 'What did the parent say?' }) + '</div>' }) +
        '</div></div>',
      foot: U.btn('Close', { action: 'close-overlay' }) +
        U.btn('Open Student 360', { icon: 'user', action: 'open-student', arg: 'HS-2026-1041', disabled: l.stage !== 'Enrolled' }) +
        U.btn('Log a call', { icon: 'phone', action: 'demo', arg: 'Call logged against ' + l.id }) +
        U.btn('Move to next stage', { variant: 'primary', iconRight: 'arrowRight', action: 'demo-close' })
    });
  });

  /* ================================================ SUPPORTING SCREENS === */
  HS.route('leads', function () {
    var v = HS.vs('leads', { stage: 'All', source: 'All', q: '' });
    var rows = A.leads.filter(function (l) {
      if (v.stage !== 'All' && l.stage !== v.stage) return false;
      if (v.source !== 'All' && l.source !== v.source) return false;
      if (v.q && (l.student + l.parent + l.id).toLowerCase().indexOf(v.q.toLowerCase()) === -1) return false;
      return true;
    });
    return U.page(
      U.pageHead({ title: 'Leads', sub: 'Every enquiry becomes a lead, whatever channel it arrived through.',
        actions: U.btn('Assign counsellor', { icon: 'userCheck', action: 'demo', arg: 'Counsellor assigned to unassigned leads' }) +
          U.btn('Add lead', { variant: 'primary', icon: 'plus', action: 'not-built', arg: 'Add lead' }) }) +
      '<div class="filterbar">' + U.search('Search student, parent or reference', 'leads-q', v.q) +
        U.field({ type: 'select', label: 'Stage', value: v.stage, options: ['All'].concat(A.stages), action: 'leads-stage' }) +
        U.field({ type: 'select', label: 'Source', value: v.source, options: ['All'].concat(A.sources.map(function (s) { return s.label; })), action: 'leads-source' }) +
        '<div class="spacer"></div><span class="t-sm t-muted t-num">' + rows.length + ' leads</span></div>' +
      leadsTable(rows)
    );
  });
  HS.on('leads-q', function (a, el) { HS.vs('leads').q = el.value; HS.render(); });
  HS.on('leads-stage', function (a, el) { HS.vs('leads').stage = el.value; HS.render(); });
  HS.on('leads-source', function (a, el) { HS.vs('leads').source = el.value; HS.render(); });

  HS.route('pipeline', function () { return pipelineView(HS.vs('adm', { view: 'pipeline' })); });

  HS.route('enquiries', function () {
    return U.page(
      U.pageHead({ title: 'Enquiries', sub: 'Raw capture across every channel, before qualification.' }) +
      U.grid('g-4col', [
        U.kpi({ label: 'Enquiries this month', value: 32, tone: '', delta: -6, inverse: true }),
        U.kpi({ label: 'Answered by WhatsApp AI', value: 24, unit: '75%', tone: 'teal', foot: 'Median first reply 11 seconds' }),
        U.kpi({ label: 'Needing a human', value: 8, tone: 'amber', foot: 'Escalated to a counsellor' }),
        U.kpi({ label: 'Duplicate merged', value: 5, tone: 'info', foot: 'Same parent, multiple channels' })
      ]) +
      '<div class="grid g-main mt-4">' +
      U.card({ title: 'Channel mix this month', body: C.donut({ size: 200, thickness: 28, center: '32', centerSub: 'enquiries',
        data: A.sources.map(function (s) { return { label: s.label, value: Math.round(s.value / 268 * 32), color: s.color }; }) }) +
        '<div class="mt-4">' + C.legend(A.sources.map(function (s) { return { label: s.label, color: s.color }; })) + '</div>' }) +
      U.card({ title: 'Latest enquiries', flush: true, body: U.table({
        rowAction: 'open-lead', rowId: function (r) { return r.id; },
        cols: [{ key: 'student', label: 'Student' }, { key: 'source', label: 'Channel', render: function (r) { return U.badge(r.source, SOURCE_TONE[r.source] || 'neutral'); } },
               { key: 'created', label: 'Received' }, { key: 'stage', label: 'Stage' }],
        rows: A.leads.slice(0, 8) }) }) +
      '</div>'
    );
  });

  HS.route('applications', function () {
    var rows = A.leads.filter(function (l) { return ['Application', 'Assessment', 'Offer', 'Enrolled'].indexOf(l.stage) > -1; });
    return U.page(
      U.pageHead({ title: 'Applications', sub: 'Online applications, document checks, assessment and offer.' }) +
      U.card({ body: U.flow([
        { label: 'Application received', meta: rows.length + ' live', state: 'done' },
        { label: 'Documents verified', meta: '9 incomplete', state: 'active' },
        { label: 'Assessment', meta: '2 scheduled' },
        { label: 'Offer issued', meta: '51 this year' },
        { label: 'Enrolled', meta: '38 this year' }
      ]) }) +
      '<div class="mt-4">' + U.card({ flush: true, body: U.table({
        rowAction: 'open-lead', rowId: function (r) { return r.id; },
        cols: [
          { key: 'student', label: 'Applicant', render: function (r) { return '<span class="t-bold">' + esc(r.student) + '</span><div class="t-micro t-muted">' + esc(r.id + ' · ' + r.parent) + '</div>'; } },
          { key: 'grade', label: 'Grade' }, { key: 'curriculum', label: 'Curriculum' },
          { key: 'stage', label: 'Stage', render: function (r) { return U.badge(r.stage, r.stage === 'Enrolled' ? 'success' : 'neutral'); } },
          { key: 'next', label: 'Blocking item', render: function (r) { return '<span class="t-xs">' + esc(r.next) + '</span>'; } },
          { key: 'a', label: '', sortable: false, cls: 'num', render: function (r) { return U.btn('Open', { size: 'sm', action: 'open-lead', arg: r.id }); } }
        ], rows: rows }) }) + '</div>'
    );
  });

  HS.route('visits', function () {
    return U.page(
      U.pageHead({ title: 'Campus Visits', sub: 'Scheduling, hosting and the outcome of every visit.', actions: U.btn('Schedule visit', { variant: 'primary', icon: 'plus', action: 'not-built', arg: 'Schedule visit' }) }) +
      U.grid('g-4col', [
        U.kpi({ label: 'Visits this week', value: 14, tone: 'amber', foot: '4 need a host' }),
        U.kpi({ label: 'Completed this year', value: A.kpis.visits, tone: 'teal' }),
        U.kpi({ label: 'Visit → application', value: '75%', tone: 'teal', delta: 4 }),
        U.kpi({ label: 'No-show rate', value: '11%', tone: 'critical', delta: -3, inverse: true })
      ]) +
      '<div class="mt-4">' + U.card({ title: 'This week', flush: true, body: U.table({
        cols: [{ key: 'when', label: 'When' }, { key: 'family', label: 'Family' }, { key: 'grade', label: 'Grade' },
               { key: 'host', label: 'Host', render: function (r) { return r.host === 'Not assigned' ? U.badge('Not assigned', 'critical') : esc(r.host); } },
               { key: 'status', label: 'Status', render: function (r) { return U.status(r.status); } }],
        rows: [
          { when: 'Wed 17 Sep · 10:00', family: 'Ramesh Iyer', grade: 'Grade 4', host: 'Kavitha S.', status: 'Scheduled' },
          { when: 'Wed 17 Sep · 11:30', family: 'Preethi Balan', grade: 'Grade 7', host: 'Not assigned', status: 'Scheduled' },
          { when: 'Thu 18 Sep · 09:30', family: 'Sunitha Rao', grade: 'Grade 9', host: 'Ravi T.', status: 'Scheduled' },
          { when: 'Fri 19 Sep · 14:00', family: 'Lavanya Suresh', grade: 'Grade 1', host: 'Not assigned', status: 'Scheduled' },
          { when: 'Sat 20 Sep · 10:00', family: 'Sabari Nathan', grade: 'Grade 5', host: 'Kavitha S.', status: 'Scheduled' }
        ] }) }) + '</div>'
    );
  });

  HS.route('conversion', function () {
    return U.page(
      U.pageHead({ title: 'Conversion Analytics', sub: 'Where enquiries are won and lost, and what each admission costs.' }) +
      U.grid('g-4col', [
        U.kpi({ label: 'Enquiry → admission', value: A.kpis.conversion + '%', tone: 'teal', delta: 1.4 }),
        U.kpi({ label: 'Cost per admission', value: HS.fmt.money(A.kpis.cpa), tone: 'amber', delta: -6, inverse: true }),
        U.kpi({ label: 'Median days to admit', value: 21, unit: 'days', tone: '' }),
        U.kpi({ label: 'Marketing spend YTD', value: HS.fmt.money(183000, { compact: true }), tone: 'info' })
      ]) +
      '<div class="grid g-2col g-4 mt-4">' +
      U.card({ title: 'Conversion by source', sub: 'Referrals convert best, ads bring volume', body: C.hbar({ rows: [
        { label: 'Referral', value: 34, display: '34%', color: 'var(--teal)' },
        { label: 'Walk-in', value: 29, display: '29%', color: 'var(--teal)' },
        { label: 'WhatsApp', value: 18, display: '18%', color: 'var(--navy)' },
        { label: 'Website', value: 15, display: '15%', color: 'var(--navy)' },
        { label: 'Google', value: 11, display: '11%', color: 'var(--amber)' },
        { label: 'Meta Ads', value: 8, display: '8%', color: 'var(--amber)' },
        { label: 'Instagram', value: 5, display: '5%', color: 'var(--critical)' }
      ], labelW: 100, rowH: 30 }) }) +
      U.card({ title: 'Cost per admission by source', body: C.hbar({ rows: [
        { label: 'Referral', value: 900, display: '₹900', color: 'var(--teal)' },
        { label: 'Walk-in', value: 1200, display: '₹1,200', color: 'var(--teal)' },
        { label: 'WhatsApp', value: 3100, display: '₹3,100', color: 'var(--navy)' },
        { label: 'Website', value: 3800, display: '₹3,800', color: 'var(--navy)' },
        { label: 'Google', value: 7600, display: '₹7,600', color: 'var(--amber)' },
        { label: 'Meta Ads', value: 9400, display: '₹9,400', color: 'var(--critical)' }
      ], labelW: 100, rowH: 30 }) }) +
      '</div>' +
      '<div class="mt-4">' + U.card({ title: 'Funnel by month', body: C.line({
        labels: A.monthly.labels,
        series: [{ name: 'Enquiries', values: A.monthly.enquiries, color: 'var(--navy)' },
                 { name: 'Applications', values: [11, 16, 19, 12, 9, 5], color: 'var(--amber)' },
                 { name: 'Admissions', values: A.monthly.admissions, color: 'var(--teal)' }],
        height: 240 }) + '<div class="mt-3">' + C.legend([{ label: 'Enquiries', color: 'var(--navy)' }, { label: 'Applications', color: 'var(--amber)' }, { label: 'Admissions', color: 'var(--teal)' }]) + '</div>' }) + '</div>'
    );
  });

  HS.route('referrals', function () {
    return U.page(
      U.pageHead({ title: 'Parent Referrals', sub: 'The highest-converting and lowest-cost channel the school has.' }) +
      U.grid('g-4col', [
        U.kpi({ label: 'Referrals this year', value: 38, tone: 'teal', delta: 22 }),
        U.kpi({ label: 'Converted', value: 13, tone: 'teal', foot: '34% conversion' }),
        U.kpi({ label: 'Referring families', value: 29, tone: '', foot: '2.3% of parent base' }),
        U.kpi({ label: 'Cost per admission', value: '₹900', tone: 'teal', foot: 'Lowest of all sources' })
      ]) +
      '<div class="mt-4">' + U.card({ title: 'Referring families', flush: true, body: U.table({
        cols: [{ key: 'parent', label: 'Referring parent' }, { key: 'child', label: 'Their child' },
               { key: 'referred', label: 'Referred', cls: 'num' }, { key: 'converted', label: 'Enrolled', cls: 'num' },
               { key: 'status', label: 'Recognition', render: function (r) { return U.badge(r.status, r.status === 'Acknowledged' ? 'success' : 'warning'); } }],
        rows: [
          { parent: 'Gayathri N.', child: 'Harini Prasad (4C)', referred: 4, converted: 2, status: 'Acknowledged' },
          { parent: 'Ranjith Kumar', child: 'Aditya Kumar (5A)', referred: 3, converted: 2, status: 'Acknowledged' },
          { parent: 'Vimal Chandran', child: 'Karthik Subramani (9A)', referred: 2, converted: 1, status: 'Pending' },
          { parent: 'Prakash S.', child: 'Varsha Iyer (4A)', referred: 2, converted: 0, status: 'Pending' }
        ] }) }) + '</div>'
    );
  });

  /* ======================================================== SCHOOL CRM === */
  HS.route('alumni', function () {
    return U.page(
      U.pageHead({ title: 'Alumni', sub: 'Relationships continue after graduation. Alumni mentor Innovation Lab projects and refer families.' }) +
      U.grid('g-4col', [
        U.kpi({ label: 'Alumni on record', value: 612, tone: '' }),
        U.kpi({ label: 'Actively engaged', value: 184, unit: '30%', tone: 'teal' }),
        U.kpi({ label: 'Mentoring students', value: 11, tone: 'amber' }),
        U.kpi({ label: 'Referrals from alumni', value: 7, tone: 'info', foot: 'This year' })
      ]) +
      '<div class="grid g-main mt-4">' +
      U.card({ title: 'Alumni directory', flush: true, body: U.table({
        cols: [
          { key: 'name', label: 'Alumnus', render: function (r) { return U.person(r.name, 'Batch of ' + r.batch); } },
          { key: 'university', label: 'University' }, { key: 'career', label: 'Now' },
          { key: 'engagement', label: 'Engagement', render: function (r) { return U.badge(r.engagement, r.engagement === 'High' ? 'success' : r.engagement === 'Medium' ? 'info' : 'neutral'); } },
          { key: 'last', label: 'Last interaction' }
        ], rows: D.crm.alumni }) }) +
      U.card({ title: 'Destinations', sub: 'Where the last five batches went', body: C.hbar({ rows: [
        { label: 'Indian universities', value: 318, color: 'var(--navy)' },
        { label: 'Overseas', value: 141, color: 'var(--teal)' },
        { label: 'Professional courses', value: 96, color: 'var(--amber)' },
        { label: 'Gap year / other', value: 57, color: 'var(--viz-8)' }
      ], labelW: 140, rowH: 32 }) }) + '</div>'
    );
  });

  HS.route('vendors', function () {
    return U.page(
      U.pageHead({ title: 'Vendors & Partners', sub: 'Contracts, renewals and the relationships that keep the campus running.' }) +
      '<div class="grid g-2col g-4">' +
      U.card({ title: 'Vendors', flush: true, body: U.table({
        cols: [{ key: 'name', label: 'Vendor', render: function (r) { return '<span class="t-bold">' + esc(r.name) + '</span><div class="t-micro t-muted">' + esc(r.category) + '</div>'; } },
               { key: 'contract', label: 'Contract' },
               { key: 'value', label: 'Value', cls: 'num', render: function (r) { return HS.fmt.money(r.value, { compact: true }); } },
               { key: 'status', label: 'Status', render: function (r) { return U.badge(r.status, r.status === 'Active' ? 'success' : 'warning'); } }],
        rows: D.crm.vendors }) }) +
      U.card({ title: 'Partners & institutions', flush: true, body: U.table({
        cols: [{ key: 'name', label: 'Partner', render: function (r) { return '<span class="t-bold">' + esc(r.name) + '</span><div class="t-micro t-muted">' + esc(r.type) + '</div>'; } },
               { key: 'since', label: 'Since' }, { key: 'note', label: 'Current activity' }],
        rows: D.crm.partners }) }) +
      '</div>' +
      '<div class="mt-4">' + U.card({ title: 'Communication history', sub: 'One timeline across parents, alumni, vendors and partners — WhatsApp, email, SMS, calls and notes',
        flush: true, body: U.table({
          cols: [{ key: 'channel', label: 'Channel', render: function (r) {
                    var ic = { WhatsApp: 'message', Call: 'phone', Email: 'mail', SMS: 'message', Note: 'edit' }[r.channel];
                    return '<span class="row g-2">' + HS.icon(ic, 15, 't-muted') + esc(r.channel) + '</span>'; } },
                 { key: 'who', label: 'With' }, { key: 'subject', label: 'Subject' }, { key: 'when', label: 'When' },
                 { key: 'status', label: 'Outcome', render: function (r) { return U.badge(r.status, r.status === 'No answer' ? 'warning' : 'neutral'); } }],
          rows: D.crm.communications }) }) + '</div>'
    );
  });
})(window.HS = window.HS || {});
