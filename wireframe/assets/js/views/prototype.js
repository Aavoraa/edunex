/* ==========================================================================
   VIEWS — Day in the Life, Automation Flows, WhatsApp AI, Design System
   ========================================================================== */
(function (HS) {
  'use strict';
  var U = HS.ui, D = HS.data, C = HS.charts, esc = HS.esc;

  /* ==================================================== DAY IN THE LIFE == */
  HS.route('day-in-life', function () {
    var v = HS.vs('dayin', { step: 0 });
    var steps = D.dayInLife;
    var s = steps[v.step];
    var roleTone = { Parent: 'teal', Transport: 'amber', Safety: 'critical', Teacher: 'info', Management: 'navy', Academics: 'info', Finance: 'teal', Workforce: 'amber' };

    return U.page(
      U.pageHead({
        title: 'A day in the life',
        sub: 'One day at Edunex, following the same event through every role that touches it. This is the connected story, not twelve separate screens.',
        actions: U.btn('Automation flows', { icon: 'zap', route: '#/automations' }) +
          U.btn(v.step >= steps.length - 1 ? 'Start again' : 'Play next', { variant: 'primary', icon: v.step >= steps.length - 1 ? 'refresh' : 'play', action: 'day-next' })
      }) +

      /* Horizontal timeline */
      U.card({ flush: true, body:
        '<div style="overflow-x:auto;padding:20px">' +
        '<div class="row" style="min-width:920px;position:relative">' +
        '<div style="position:absolute;left:24px;right:24px;top:21px;height:2px;background:var(--border)"></div>' +
        '<div style="position:absolute;left:24px;top:21px;height:2px;background:var(--teal);width:calc((100% - 48px) * ' + (v.step / (steps.length - 1)) + ')"></div>' +
        steps.map(function (x, i) {
          var done = i <= v.step;
          return '<button class="col center" style="flex:1;align-items:center;gap:8px;position:relative;z-index:1" data-action="day-step" data-arg="' + i + '">' +
            '<span style="width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:' +
            (done ? 'var(--navy)' : 'var(--surface)') + ';border:2px solid ' + (done ? 'var(--navy)' : 'var(--border-strong)') +
            ';color:' + (done ? '#fff' : 'var(--text-muted)') + (i === v.step ? ';box-shadow:0 0 0 5px rgba(21, 25, 132,.18)' : '') + '">' +
            HS.icon(x.icon, 19) + '</span>' +
            '<span class="t-micro t-num ' + (i === v.step ? 't-bold t-strong' : 't-muted') + '">' + esc(x.time) + '</span></button>';
        }).join('') + '</div></div>'
      }) +

      '<div class="grid g-main mt-4">' +
      U.card({
        title: s.time + ' — ' + s.title,
        sub: s.role,
        actions: U.badge(s.role, roleTone[s.role] === 'navy' ? 'info' : (roleTone[s.role] || 'neutral')) +
          U.btn('Open the screen', { size: 'sm', variant: 'primary', route: s.route, iconRight: 'arrowRight' }),
        body: '<p style="font-size:16px;line-height:1.65">' + esc(s.body) + '</p>' +
          '<div class="divider"></div>' +
          '<div class="eyebrow mb-3">What the system does, without anyone asking</div>' +
          U.flow(s.chain.map(function (c, i) { return { label: c, meta: i === s.chain.length - 1 ? 'Recorded' : 'Automatic', state: 'done' }; })) +
          '<div class="row g-2 mt-5 wrap">' +
          U.btn('Previous', { icon: 'arrowLeft', action: 'day-prev', disabled: v.step === 0 }) +
          U.btn('Next moment', { variant: 'primary', iconRight: 'arrowRight', action: 'day-next' }) +
          '</div>'
      }) +
      '<div class="col g-4">' +
      U.card({
        title: 'The whole day', flush: true,
        body: '<div>' + steps.map(function (x, i) {
          return '<button class="alert-item ' + (i === v.step ? 'alert-item--info' : '') + '" data-action="day-step" data-arg="' + i + '"' +
            (i === v.step ? ' style="background:var(--surface-alt)"' : '') + '>' +
            '<span class="t-micro t-num t-muted none" style="width:42px;padding-top:3px">' + esc(x.time) + '</span>' +
            '<span class="grow" style="min-width:0"><span class="alert-item__title" style="display:block">' + esc(x.title) + '</span>' +
            '<span class="alert-item__meta" style="display:block">' + esc(x.role) + '</span></span>' +
            (i <= v.step ? HS.icon('check', 15, 't-success') : HS.icon('chevronRight', 15, 't-faint')) + '</button>';
        }).join('') + '</div>'
      }) +
      U.card({
        title: 'What this demonstrates',
        body: '<div class="col g-3">' + [
          ['One event, many audiences', 'A single gate scan informs the parent, the register, the attendance analytics and the Command Center.'],
          ['Nothing is re-keyed', 'Boarding, attendance, marks, payments and overtime are each entered once and used everywhere.'],
          ['People stay in charge', 'Signals and AI drafts stop at a person. The system proposes; a teacher or manager decides.'],
          ['Evidence accumulates', 'By the end of the day the Student 360 profile is richer without anyone filling in a form for it.']
        ].map(function (r) {
          return '<div class="row-top g-3">' + HS.icon('check', 15, 't-success') +
            '<span class="col"><span class="t-sm t-bold">' + esc(r[0]) + '</span>' +
            '<span class="t-xs t-muted">' + esc(r[1]) + '</span></span></div>';
        }).join('') + '</div>'
      }) +
      '</div></div>'
    );
  });
  HS.on('day-step', function (i) { HS.vs('dayin').step = Number(i); HS.render(); });
  HS.on('day-next', function () {
    var v = HS.vs('dayin');
    v.step = v.step >= D.dayInLife.length - 1 ? 0 : v.step + 1;
    HS.render();
  });
  HS.on('day-prev', function () {
    var v = HS.vs('dayin');
    if (v.step > 0) { v.step--; HS.render(); }
  });

  /* ==================================================== AUTOMATION FLOWS = */
  HS.route('automations', function () {
    return U.page(
      U.pageHead({
        title: 'Automation Flows',
        sub: 'The chains that run without anyone asking. Each one ends at a person or at a record, never at an unreviewed decision.',
        actions: U.btn('See it as a day', { icon: 'play', route: '#/day-in-life' })
      }) +
      '<div class="col g-4">' + D.automations.map(function (f) {
        return U.card({
          title: f.title,
          actions: U.btn('Open the module', { size: 'sm', route: f.route, iconRight: 'arrowRight' }),
          body: '<div class="row wrap g-2" style="align-items:stretch">' + f.steps.map(function (s, i) {
            var last = i === f.steps.length - 1;
            return '<div class="row g-2" style="align-items:center">' +
              '<div class="card card--tint" style="padding:10px 14px;border-radius:var(--r-sm);' +
              (last ? 'background:var(--success-tint);border-color:var(--success-line)' : i === 0 ? 'background:var(--navy);border-color:var(--navy)' : '') + '">' +
              '<span class="t-xs t-bold" style="' + (i === 0 ? 'color:#fff' : '') + '">' + esc(s) + '</span></div>' +
              (last ? '' : '<span class="t-faint">' + HS.icon('arrowRight', 14) + '</span>') + '</div>';
          }).join('') + '</div>' +
            '<div class="mt-4 t-xs t-muted">' + esc(automationNote(f.id)) + '</div>'
        });
      }).join('') + '</div>' +
      '<div class="mt-4">' + U.card({
        title: 'Where a person always intervenes',
        body: '<div class="grid g-2col g-3">' + [
          ['Early Warning signal', 'A teacher accepts or dismisses before an intervention exists.'],
          ['AI-generated content', 'Reviewed, edited and approved by a named teacher before publishing.'],
          ['Report card comments', 'Drafted by AI, rewritten freely, approved by the teacher and the section head.'],
          ['Payroll', 'Inputs flow in automatically; the run only starts after approval.'],
          ['Emergency broadcast', 'Never automatic. Always a named person, always audited.'],
          ['Certificates', 'Automatic checks, human approval.']
        ].map(function (r) {
          return '<div class="card card--tint" style="padding:14px"><div class="row g-2">' + HS.icon('user', 15) +
            '<span class="t-sm t-bold">' + esc(r[0]) + '</span></div>' +
            '<div class="t-micro t-muted mt-1">' + esc(r[1]) + '</div></div>';
        }).join('') + '</div>'
      }) + '</div>'
    );
  });
  function automationNote(id) {
    return {
      attendance: 'One tap by the teacher produces the parent alert, the pattern check and, only if the threshold is met, a signal for teacher review.',
      bus: 'GPS, boarding scans and gate entry combine so a parent knows their child is safe without having to ask.',
      admission: 'The WhatsApp assistant answers the first question and creates the lead. Every later stage is a person, supported by the record.',
      payroll: 'Attendance, leave, overtime and allowances arrive without re-keying. Approval is the only manual step before processing.',
      academic: 'Assessment data becomes a learning gap, then a profile entry, then a teacher action, then a measured outcome.'
    }[id] || '';
  }

  /* ======================================================= WHATSAPP AI === */
  HS.route('whatsapp-ai', function () {
    var v = HS.vs('wa', { shown: 2 });
    var msgs = D.ai.whatsapp.slice(0, v.shown);
    return U.page(
      U.pageHead({
        title: 'WhatsApp AI Assistant',
        sub: 'The first thing a prospective parent meets. It answers from approved information, and every conversation creates or updates a CRM lead.',
        actions: U.btn('Open the CRM', { icon: 'target', route: '#/admissions' }) +
          U.btn(v.shown >= D.ai.whatsapp.length ? 'Replay' : 'Continue conversation', { variant: 'primary', icon: 'play', action: 'wa-next' })
      }) +
      '<div class="row g-6 wrap" style="align-items:flex-start">' +
      '<div class="none"><div class="device"><div class="device__screen">' +
      '<div class="device__status"><span>9:41</span><span class="row g-2">' + HS.icon('activity', 12) + HS.icon('zap', 12) + '</span></div>' +
      '<div class="appbar" style="background:#075E54">' + HS.icon('chevronLeft', 18) +
      '<span class="avatar avatar--sm none" style="background:#128C7E">HS</span>' +
      '<span class="col grow"><span class="t-sm t-bold" style="color:#fff">Edunex International</span>' +
      '<span class="t-micro" style="color:#B7D4CE">Business account · replies instantly</span></span>' + HS.icon('phone', 17) + '</div>' +
      '<div class="device__scroll" style="background:#DDE0EC;padding:14px 12px">' +
      '<div class="chat">' + msgs.map(function (m) {
        if (m.from === 'parent') {
          return '<div class="bubble bubble--out" style="background:#DCF8C6;color:var(--text);align-self:flex-end;max-width:84%">' +
            esc(m.text) + '<div class="bubble__meta t-right">' + esc(m.time) + ' ✓✓</div></div>';
        }
        return '<div class="bubble bubble--in" style="background:#fff;border-color:#fff;max-width:88%">' +
          esc(m.text) +
          (m.quick ? '<div class="quick-replies mt-3">' + m.quick.map(function (q) {
            return '<button class="btn btn--sm btn--ghost" style="border-color:#128C7E;color:#128C7E" data-action="wa-next">' + esc(q) + '</button>';
          }).join('') + '</div>' : '') +
          '<div class="bubble__meta">' + esc(m.time) + '</div></div>';
      }).join('') + '</div></div>' +
      '<div class="row g-2" style="padding:10px 12px;background:#F0F0F0">' +
      '<div class="input grow" style="border-radius:99px;display:flex;align-items:center;color:var(--text-faint)">Message</div>' +
      '<span class="avatar avatar--sm none" style="background:#128C7E">' + HS.icon('send', 15) + '</span></div>' +
      '</div></div><div class="device__label">Parent view · WhatsApp</div></div>' +

      '<div class="grow col g-4" style="min-width:320px">' +
      U.card({
        title: 'What happened in the CRM',
        sub: 'Every message updates the record behind the scenes',
        body: U.timeline([
          { time: '09:12', title: 'Lead created automatically', body: 'Source: WhatsApp. Campaign: Sep Admissions. Contact number captured.', tone: 'teal' },
          { time: '09:12', title: 'Interest recorded — Cambridge IGCSE', body: 'Curriculum preference set on the lead.', tone: '' },
          { time: '09:14', title: 'Grade interest recorded — Grade 9', body: 'Subject sheet request logged as a follow-up task.', tone: '' },
          { time: '09:16', title: 'Visit request captured', body: 'Weekend preference noted. Counsellor Kavitha S. assigned by rota.', tone: 'amber' },
          { time: '09:17', title: 'Lead score 68 — qualified', body: 'Moved to Qualified. A counsellor now owns the conversation.', tone: 'teal' }
        ])
      }) +
      U.card({
        title: 'Guardrails',
        body: '<div class="col g-3">' + [
          ['Answers from approved information only', 'Curriculum, fees, transport and timings come from school records, not from general knowledge.'],
          ['Hands over cleanly', 'Anything it cannot answer goes to a named counsellor, with the conversation attached.'],
          ['Never quotes a discount', 'Fee concessions are a human conversation. The assistant will not negotiate.'],
          ['Never promises admission', 'It can book a visit or an assessment. It cannot offer a place.']
        ].map(function (r) {
          return '<div class="row-top g-3">' + HS.icon('shield', 15, 't-success') +
            '<span class="col"><span class="t-sm t-bold">' + esc(r[0]) + '</span>' +
            '<span class="t-xs t-muted">' + esc(r[1]) + '</span></span></div>';
        }).join('') + '</div>'
      }) +
      '</div></div>'
    );
  });
  HS.on('wa-next', function () {
    var v = HS.vs('wa');
    v.shown = v.shown >= D.ai.whatsapp.length ? 2 : v.shown + 2;
    HS.render();
  });

  /* ==================================================== DESIGN SYSTEM ==== */
  HS.route('design-system', function () {
    var swatches = [
      ['Edunex Indigo', '#3B3FD9', 'Primary brand color, primary actions, core brand identity'],
      ['Deep Indigo', '#2F32B8', 'Hover highlights and pressed states'],
      ['Edunex Teal', '#2DD4BF', 'Secondary accent, badges, active indicators & borders'],
      ['Charcoal Black', '#171717', 'Headings, primary typography, high-contrast surfaces'],
      ['White Surface', '#FFFFFF', 'Cards, tables, panels and pristine containers'],
      ['Midnight', '#1E1B4B', 'Sidebar and dark application shell surfaces'],
      ['Cool Ground', '#F6F7FB', 'Application ground and background canvas'],
      ['Muted Charcoal', '#666666', 'Body text labels, secondary metadata and subtitles'],
      ['Border', '#E5E8F0', 'Dividers, subtle lines and card borders']
    ];
    var statuses = [['Critical', 'critical'], ['Attention', 'warning'], ['Caution', 'caution'], ['Information', 'info'], ['Completed', 'success'], ['Neutral', 'neutral']];

    return U.page(
      U.pageHead({
        title: 'Brand Guidelines & Design System',
        sub: 'Edunex brand guidelines: Edunex Indigo, Deep Indigo, Edunex Teal, Midnight, Charcoal Black, Cinzel Display and Montserrat UI.'
      }) +

      /* Brand Banner */
      U.card({
        flush: true,
        body: '<div class="row between wrap g-4" style="padding:24px;background:linear-gradient(135deg, #090A35, #101363);color:#fff;border-radius:var(--r-lg)">' +
          '<div class="row g-4">' + HS.brandMark(60) +
          '<div><div class="serif" style="font-size:24px;font-weight:700;letter-spacing:.02em;color:#fff">Edunex International School</div>' +
          '<div style="font-size:12px;color:var(--gold);text-transform:uppercase;letter-spacing:.14em;margin-top:2px">Brand Identity & Digital System</div></div></div>' +
          '<div class="col end">' +
          '<div class="script-font" style="font-size:22px;color:var(--gold)">Growing Minds. Inspiring Futures.</div>' +
          '<div class="t-micro" style="color:#D9DAF5;letter-spacing:.1em;text-transform:uppercase">A Brighter Tomorrow Begins Here</div>' +
          '</div></div>'
      }) +

      '<div class="mt-4">' +
      U.card({ title: 'Brand Color Palette', sub: 'The official 5-color palette reflecting confidence, positivity and excellence',
        body: '<div class="grid g-3col g-4">' + swatches.map(function (s) {
          return '<div class="card card--tint" style="padding:12px">' +
            '<div class="swatch-tile" style="background:' + s[1] + ';' + (s[1] === '#FFFFFF' ? 'border:1px solid #ddd' : '') + '"></div>' +
            '<div class="t-sm t-bold mt-2">' + esc(s[0]) + '</div>' +
            '<div class="t-micro t-muted t-num">' + esc(s[1]) + '</div>' +
            '<div class="t-micro t-muted mt-1">' + esc(s[2]) + '</div></div>';
        }).join('') + '</div>' }) + '</div>' +

      '<div class="grid g-2col g-4 mt-4">' +
      U.card({ title: 'Typography System', sub: 'Cinzel for Headings & Display, Montserrat for Body & Supporting UI',
        body: '<div class="col g-4">' +
          '<div><div class="eyebrow">Primary Typeface · Cinzel Display 32</div><div class="display mt-1">Edunex International</div></div>' +
          '<div><div class="eyebrow">Heading 1 · Cinzel 24</div><div class="h1 mt-1">Student Intelligence 360</div></div>' +
          '<div><div class="eyebrow">Heading 2 · Cinzel 19</div><div class="h2 mt-1">Academic & Campus Analytics</div></div>' +
          '<div><div class="eyebrow">Secondary Typeface · Montserrat 14</div><p class="mt-1">Our typography combines elegance with modern clarity. Built for readability, scalability and cross-platform harmony.</p></div>' +
          '<div><div class="eyebrow">Script Accent · Caveat</div><div class="script-font mt-1" style="font-size:24px;color:var(--magenta)">Learning Beyond Limits · Growing Minds. Inspiring Futures.</div></div>' +
          '<div><div class="eyebrow">Data Figures · Montserrat Tabular</div><div class="t-num mt-1" style="font-size:22px;font-weight:700;color:var(--magenta)">1,284 Students · ₹17.96L · 98.4%</div></div>' +
          '</div>' }) +

      U.card({ title: 'Brand Mood & Values', sub: 'The feeling we create in everything we do',
        body: '<div class="col g-4">' +
          '<div class="grid g-2col g-3">' +
          [['book', 'Educational', 'Academic rigour and lifelong learning'],
           ['brand', 'Elegant', 'Refined, timeless aesthetic & dignity'],
           ['sparkle', 'Inspiring', 'Encouraging students to reach higher'],
           ['trending', 'Modern', 'Connected, forward-looking digital campus'],
           ['shieldCheck', 'Trustworthy', 'Transparent, reliable and safe']
          ].map(function (b) {
            return '<div class="card card--tint" style="padding:14px"><div class="row g-2">' +
              '<span class="avatar avatar--sm" style="background:var(--magenta);color:#fff">' + HS.icon(b[0], 15) + '</span>' +
              '<span class="t-sm t-bold" style="color:var(--magenta)">' + esc(b[1]) + '</span></div>' +
              '<div class="t-micro t-muted mt-2">' + esc(b[2]) + '</div></div>';
          }).join('') + '</div>' +
          '<div class="divider"></div>' +
          '<div class="eyebrow mb-2">Semantic Status System</div>' +
          '<div class="col g-2">' + statuses.map(function (s) {
            return '<div class="row g-3">' + U.badge(s[0], s[1], { dot: true, lg: true }) +
              '<span class="t-xs t-muted grow">' + esc({
                Critical: 'Immediate attention required.',
                Attention: 'Act today before escalating.',
                Caution: 'Monitor closely.',
                Information: 'Contextual update.',
                Completed: 'Finished and logged.',
                Neutral: 'Standard state.'
              }[s[0]]) + '</span></div>';
          }).join('') + '</div>' +
          '</div>' }) +
      '</div>' +

      '<div class="mt-4">' + U.card({ title: 'Buttons and controls',
        body: '<div class="col g-5">' +
          '<div><div class="eyebrow mb-3">Buttons</div><div class="row g-3 wrap">' +
          U.btn('Primary', { variant: 'primary' }) + U.btn('Amber', { variant: 'amber' }) + U.btn('Teal', { variant: 'teal' }) +
          U.btn('Ghost') + U.btn('Quiet', { variant: 'quiet' }) + U.btn('Danger', { variant: 'danger' }) +
          U.btn('With icon', { icon: 'download' }) + U.btn('', { icon: 'more', label: 'More' }) + U.btn('Disabled', { disabled: true }) +
          '</div></div>' +
          '<div><div class="eyebrow mb-3">Inputs</div><div class="grid g-4col g-3">' +
          U.field({ label: 'Text input', placeholder: 'Placeholder' }) +
          U.field({ label: 'Select', type: 'select', options: ['Option one', 'Option two'] }) +
          '<div class="field"><span class="label">Toggle and checkbox</span><div class="row g-4" style="height:38px">' +
          '<label class="switch"><input type="checkbox" checked><span class="switch__track"></span></label>' +
          '<label class="check"><input type="checkbox" checked> Enabled</label></div></div>' +
          '<div class="field"><span class="label">Segmented</span><div style="height:38px;display:flex;align-items:center">' +
          U.segment([{ id: 'a', label: 'Day' }, { id: 'b', label: 'Week' }, { id: 'c', label: 'Term' }], 'a', 'demo') + '</div></div>' +
          '</div></div>' +
          '<div><div class="eyebrow mb-3">Progress and meters</div><div class="grid g-3col g-4">' +
          U.meter({ label: 'Attendance', value: 94, right: '94%', tone: 'teal' }) +
          U.meter({ label: 'Collection', value: 82, right: '82.2%', tone: 'amber' }) +
          U.meter({ label: 'Coverage', value: 41, right: '41%', tone: 'critical' }) +
          '</div></div>' +
          '<div><div class="eyebrow mb-3">Workflow</div>' + U.flow([
            { label: 'Draft', state: 'done' }, { label: 'Submitted', state: 'done' },
            { label: 'Under Review', state: 'active' }, { label: 'Approved' }, { label: 'Rejected' }
          ]) + '</div>' +
          '<div><div class="eyebrow mb-3">Stepper</div>' + U.stepper(['Signal', 'Review', 'Intervention', 'Action', 'Follow-up', 'Closed'], 2) + '</div>' +
          '</div>' }) + '</div>' +

      '<div class="grid g-2col g-4 mt-4">' +
      U.card({ title: 'Data visualisation', sub: 'Every chart is inline SVG — no library, works offline, scales to any container',
        body: '<div class="col g-5">' +
          C.line({ labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], series: [{ name: 'Attendance', values: [93, 94, 92, 94, 91], color: 'var(--teal)' }], yMin: 85, yMax: 100, height: 160 }) +
          C.bar({ labels: ['G3', 'G4', 'G5', 'G6'], series: [{ name: 'Students', values: [96, 98, 96, 99], color: 'var(--navy)' }], height: 150 }) +
          '<div class="row g-5 wrap center">' + C.donut({ size: 130, thickness: 20, center: '82%', data: [{ label: 'a', value: 82, color: 'var(--teal)' }, { label: 'b', value: 18, color: 'var(--bg-sunken)' }] }) +
          C.gauge({ percent: 68, value: '68%', sub: 'Gauge', color: 'var(--amber)' }) +
          C.radar({ size: 170, axes: ['A', 'B', 'C', 'D', 'E'], series: [{ name: 's', values: [82, 74, 88, 64, 79], color: 'var(--navy)' }] }) + '</div>' +
          '</div>' }) +
      U.card({ title: 'Cards, lists and feedback',
        body: '<div class="col g-4">' +
          U.kpi({ label: 'KPI card', value: '1,284', unit: 'students', tone: 'teal', delta: 3.1, foot: 'With sparkline', spark: [8, 11, 9, 14, 12, 16] }) +
          U.alertItem({ tone: 'critical', icon: 'alert', title: 'Attention row', meta: 'Used in Command Center and notifications', action: 'demo', arg: 'Attention row' }) +
          U.banner('Banner — context that applies to the whole screen.', 'warning', 'info') +
          U.aiNotice() +
          '<div class="row g-3 wrap">' + U.btn('Show a toast', { action: 'demo', arg: 'This is a toast message' }) +
          U.btn('Open a modal', { action: 'show-approval-flow' }) + '</div>' +
          '</div>' }) +
      '</div>' +

      '<div class="mt-4">' + U.card({ title: 'Responsive behaviour',
        body: '<div class="grid g-3col g-4">' + [
          ['Desktop', '1200px and above', 'Fixed left sidebar, top header, multi-column dashboards, wide data tables.', 'grid'],
          ['Tablet', '768 to 1199px', 'Sidebar collapses to an overlay drawer, cards drop to two columns, tables scroll.', 'layers'],
          ['Mobile', 'Below 768px', 'Bottom navigation, single-column cards, swipeable sections, 44px touch targets, tables become card lists.', 'home']
        ].map(function (r) {
          return '<div class="card card--tint" style="padding:16px"><div class="row g-2">' + HS.icon(r[3], 16) +
            '<span class="t-sm t-bold">' + esc(r[0]) + '</span></div>' +
            '<div class="t-micro t-muted mt-1">' + esc(r[1]) + '</div>' +
            '<div class="t-xs mt-2">' + esc(r[2]) + '</div></div>';
        }).join('') + '</div>' +
          '<p class="t-xs t-muted mt-4">Parent and staff experiences are mobile-first: they are designed at 390px and expand, rather than the other way round.</p>' }) + '</div>' +

      '<div class="mt-4">' + U.card({ title: 'Icon set', sub: 'One stroke-based family at 24px. No emoji is used as an interface icon anywhere.',
        body: '<div class="row g-4 wrap">' + HS.iconNames.slice(0, 64).map(function (n) {
          return '<span class="col center" style="width:62px;align-items:center;gap:5px" title="' + esc(n) + '">' +
            '<span class="avatar none" style="background:var(--surface-alt);color:var(--navy)">' + HS.icon(n, 18) + '</span>' +
            '<span class="t-micro t-faint t-clip" style="max-width:60px">' + esc(n) + '</span></span>';
        }).join('') + '</div>' }) + '</div>'
    );
  });
})(window.HS = window.HS || {});
