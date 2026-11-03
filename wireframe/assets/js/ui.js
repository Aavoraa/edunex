/* ==========================================================================
   UI — formatting helpers, component builders, overlays (modal/drawer/toast)
   Every screen composes these; nothing is hand-rolled per page.
   ========================================================================== */
(function (HS) {
  'use strict';

  /* ---- Formatting -------------------------------------------------------- */
  HS.fmt = {
    n: function (v) { return (v == null ? '' : Number(v).toLocaleString('en-IN')); },
    compact: function (v) {
      var a = Math.abs(v);
      if (a >= 10000000) return (v / 10000000).toFixed(a % 10000000 === 0 ? 0 : 1) + 'Cr';
      if (a >= 100000) return (v / 100000).toFixed(a % 100000 === 0 ? 0 : 1) + 'L';
      if (a >= 1000) return (v / 1000).toFixed(a % 1000 === 0 ? 0 : 1) + 'k';
      return String(Math.round(v * 10) / 10);
    },
    money: function (v, opts) {
      opts = opts || {};
      if (opts.compact) return '₹' + HS.fmt.compact(v);
      return '₹' + Number(v).toLocaleString('en-IN');
    },
    pct: function (v, d) { return (d != null ? Number(v).toFixed(d) : Math.round(v)) + '%'; },
    initials: function (name) {
      return String(name).split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase();
    },
    date: function (d) {
      var dt = (d instanceof Date) ? d : new Date(d);
      return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    },
    dateShort: function (d) {
      var dt = (d instanceof Date) ? d : new Date(d);
      return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    }
  };

  var esc = HS.esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };
  HS.attr = function (o) {
    return Object.keys(o || {}).filter(function (k) { return o[k] != null && o[k] !== false; })
      .map(function (k) { return k + '="' + esc(o[k]) + '"'; }).join(' ');
  };
  HS.cx = function () {
    return Array.prototype.slice.call(arguments).filter(Boolean).join(' ');
  };

  /* ---- Colour helpers ---------------------------------------------------- */
  var AVATAR_TONES = ['', 'avatar--teal', 'avatar--amber', 'avatar--slate'];
  HS.toneFor = function (key) {
    var s = String(key || ''), h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 997;
    return AVATAR_TONES[h % AVATAR_TONES.length];
  };
  HS.riskTone = function (risk) {
    return { 'At Risk': 'critical', 'Developing Risk': 'warning', 'On Track': 'success', 'Watch': 'caution' }[risk] || 'neutral';
  };
  HS.statusTone = function (s) {
    var m = {
      Approved: 'success', Paid: 'success', Present: 'success', Completed: 'success', Enrolled: 'success', Closed: 'success', Active: 'success', Verified: 'success', Released: 'success', Cleared: 'success', 'On Track': 'success', Resolved: 'success', Onboard: 'success',
      Pending: 'warning', 'Under Review': 'warning', Submitted: 'warning', Partial: 'warning', Late: 'warning', 'In Progress': 'warning', Draft: 'neutral', Scheduled: 'info', 'Follow-up': 'warning', 'Due Soon': 'warning',
      Rejected: 'critical', Overdue: 'critical', Absent: 'critical', 'At Risk': 'critical', Breach: 'critical', Expired: 'critical', Escalated: 'critical',
      Leave: 'info', 'On Leave': 'info', New: 'info', Open: 'info', Contacted: 'info', Qualified: 'info'
    };
    return m[s] || 'neutral';
  };

  /* ---- Small builders ---------------------------------------------------- */
  var U = HS.ui = {};

  U.icon = function (n, s, c) { return HS.icon(n, s, c); };

  U.badge = function (text, tone, opts) {
    opts = opts || {};
    return '<span class="badge badge--' + (tone || 'neutral') + (opts.lg ? ' badge--lg' : '') + '">' +
      (opts.dot ? '<span class="dot dot--' + (tone || 'neutral') + '"></span>' : '') +
      (opts.icon ? HS.icon(opts.icon, 12) : '') + esc(text) + '</span>';
  };

  U.status = function (text, opts) { return U.badge(text, HS.statusTone(text), opts); };

  U.avatar = function (name, opts) {
    opts = opts || {};
    return '<span class="avatar ' + (opts.size ? 'avatar--' + opts.size + ' ' : '') + (opts.tone || HS.toneFor(name)) + '" aria-hidden="true">' +
      esc(HS.fmt.initials(name)) + '</span>';
  };

  U.person = function (name, meta, opts) {
    opts = opts || {};
    return '<span class="person' + (opts.link ? ' person--link' : '') + '"' + (opts.action ? ' data-action="' + esc(opts.action) + '"' : '') +
      (opts.id ? ' data-id="' + esc(opts.id) + '"' : '') + '>' +
      U.avatar(name, { size: opts.size || 'sm', tone: opts.tone }) +
      '<span class="col" style="min-width:0"><span class="person__name t-clip">' + esc(name) + '</span>' +
      (meta ? '<span class="person__meta t-clip">' + esc(meta) + '</span>' : '') + '</span></span>';
  };

  U.btn = function (label, opts) {
    opts = opts || {};
    return '<button class="btn btn--' + (opts.variant || 'ghost') + (opts.size ? ' btn--' + opts.size : '') +
      (opts.block ? ' btn--block' : '') + (opts.icon && !label ? ' btn--icon' : '') + '"' +
      (opts.action ? ' data-action="' + esc(opts.action) + '"' : '') +
      (opts.arg != null ? ' data-arg="' + esc(opts.arg) + '"' : '') +
      (opts.route ? ' data-route="' + esc(opts.route) + '"' : '') +
      (opts.disabled ? ' disabled' : '') +
      (!label && opts.icon ? ' aria-label="' + esc(opts.label || opts.icon) + '"' : '') +
      (opts.title ? ' title="' + esc(opts.title) + '"' : '') + '>' +
      (opts.icon ? HS.icon(opts.icon, opts.size === 'sm' ? 14 : 16) : '') +
      (label ? esc(label) : '') +
      (opts.iconRight ? HS.icon(opts.iconRight, 15) : '') + '</button>';
  };

  U.iconbtn = function (name, opts) {
    opts = opts || {};
    return '<button class="iconbtn ' + (opts.cls || '') + '" aria-label="' + esc(opts.label || name) + '"' +
      (opts.action ? ' data-action="' + esc(opts.action) + '"' : '') +
      (opts.arg != null ? ' data-arg="' + esc(opts.arg) + '"' : '') +
      (opts.route ? ' data-route="' + esc(opts.route) + '"' : '') +
      (opts.title ? ' title="' + esc(opts.title) + '"' : '') + '>' +
      HS.icon(name, opts.size || 18) +
      (opts.count ? '<span class="iconbtn__dot">' + esc(opts.count) + '</span>' : '') + '</button>';
  };

  U.card = function (o) {
    var head = '';
    if (o.title || o.actions) {
      head = '<div class="card__head"><div class="grow"><div class="card__title">' + esc(o.title || '') + '</div>' +
        (o.sub ? '<div class="card__sub">' + esc(o.sub) + '</div>' : '') + '</div>' +
        (o.actions ? '<div class="row g-2 none">' + o.actions + '</div>' : '') + '</div>';
    }
    return '<section class="card ' + (o.cls || '') + '">' + head +
      '<div class="' + (o.flush ? '' : 'card__body' + (o.tight ? ' card__body--tight' : '')) + '">' + (o.body || '') + '</div>' +
      (o.foot ? '<div class="card__foot">' + o.foot + '</div>' : '') + '</section>';
  };

  U.kpi = function (o) {
    var delta = '';
    if (o.delta != null) {
      var up = o.delta >= 0, good = o.inverse ? !up : up;
      delta = '<span class="kpi__delta kpi__delta--' + (good ? 'up' : 'down') + '">' +
        HS.icon(up ? 'arrowUp' : 'arrowDown', 12) + Math.abs(o.delta) + (o.deltaUnit || '%') + '</span>';
    }
    return '<' + (o.route || o.action ? 'button' : 'div') + ' class="kpi ' + (o.tone ? 'kpi--' + o.tone : '') + (o.route || o.action ? ' kpi--link' : '') + '" ' +
      (o.route ? 'data-route="' + esc(o.route) + '"' : '') + (o.action ? ' data-action="' + esc(o.action) + '"' : '') +
      (o.arg != null ? ' data-arg="' + esc(o.arg) + '"' : '') + ' style="text-align:left;width:100%">' +
      '<div class="kpi__label">' + esc(o.label) + '</div>' +
      '<div class="kpi__value">' + o.value + (o.unit ? '<small> ' + esc(o.unit) + '</small>' : '') + '</div>' +
      (o.foot || delta ? '<div class="kpi__foot">' + delta + (o.foot ? '<span>' + esc(o.foot) + '</span>' : '') + '</div>' : '') +
      (o.spark ? '<span class="kpi__spark">' + HS.charts.spark(o.spark, { color: o.sparkColor || 'var(--teal)' }) + '</span>' : '') +
      '</' + (o.route || o.action ? 'button' : 'div') + '>';
  };

  U.meter = function (o) {
    return '<div class="meter"><div class="meter__top"><span class="t-muted t-clip">' + esc(o.label) + '</span>' +
      '<span class="t-bold t-num none">' + esc(o.right != null ? o.right : o.value + '%') + '</span></div>' +
      '<div class="bar' + (o.lg ? ' bar--lg' : '') + '"><div class="bar__fill' + (o.tone ? ' bar__fill--' + o.tone : '') +
      '" style="width:' + Math.max(0, Math.min(100, o.value)) + '%"></div></div>' +
      (o.hint ? '<div class="t-micro t-muted">' + esc(o.hint) + '</div>' : '') + '</div>';
  };

  U.dl = function (pairs) {
    return '<dl class="dl">' + pairs.map(function (p) {
      return '<dt>' + esc(p[0]) + '</dt><dd>' + (p[2] === 'raw' ? p[1] : esc(p[1])) + '</dd>';
    }).join('') + '</dl>';
  };

  U.empty = function (title, sub, icon) {
    return '<div class="empty"><div class="empty__ico">' + HS.icon(icon || 'search', 22) + '</div>' +
      '<div class="h3">' + esc(title) + '</div>' + (sub ? '<p class="t-sm t-muted mt-2">' + esc(sub) + '</p>' : '') + '</div>';
  };

  U.banner = function (text, tone, icon) {
    return '<div class="banner' + (tone ? ' banner--' + tone : '') + '">' + HS.icon(icon || 'info', 17) +
      '<div class="grow">' + text + '</div></div>';
  };

  U.aiNotice = function (text) {
    return '<div class="ai-advisory">' + HS.icon('info', 13) + '<span>' +
      (text || '<strong>Advisory only.</strong> AI output is a suggestion. An authorised teacher or manager must review and approve before anything is published or acted on.') +
      '</span></div>';
  };

  U.sectionHead = function (title, sub, right) {
    return '<div class="section-head"><div class="grow"><div class="section-head__title">' + esc(title) + '</div>' +
      (sub ? '<div class="section-head__sub">' + esc(sub) + '</div>' : '') + '</div>' +
      (right ? '<div class="row g-2 none">' + right + '</div>' : '') + '</div>';
  };

  U.pageHead = function (o) {
    return '<div class="pagehead"><div class="grow">' +
      (o.crumbs ? '<div class="breadcrumb">' + o.crumbs.map(function (c, i) {
        return (i ? HS.icon('chevronRight', 12) : '') + (c.route
          ? '<button data-route="' + esc(c.route) + '">' + esc(c.label) + '</button>'
          : '<span>' + esc(c.label) + '</span>');
      }).join('') + '</div>' : '') +
      '<h1 class="pagehead__title">' + esc(o.title) + '</h1>' +
      (o.sub ? '<p class="pagehead__sub">' + esc(o.sub) + '</p>' : '') + '</div>' +
      (o.actions ? '<div class="pagehead__actions">' + o.actions + '</div>' : '') + '</div>';
  };

  U.tabs = function (items, active, action, opts) {
    opts = opts || {};
    return '<div class="tabs' + (opts.pills ? ' tabs--pills' : '') + '" role="tablist">' + items.map(function (t) {
      var id = t.id || t, label = t.label || t;
      return '<button class="tabs__item" role="tab" aria-selected="' + (id === active) + '" data-action="' + esc(action) + '" data-arg="' + esc(id) + '">' +
        esc(label) + (t.count != null ? ' <span class="tag" style="margin-left:6px">' + t.count + '</span>' : '') + '</button>';
    }).join('') + '</div>';
  };

  U.segment = function (items, active, action) {
    return '<div class="segment">' + items.map(function (s) {
      var id = s.id || s, label = s.label || s;
      return '<button aria-pressed="' + (id === active) + '" data-action="' + esc(action) + '" data-arg="' + esc(id) + '">' + esc(label) + '</button>';
    }).join('') + '</div>';
  };

  U.chips = function (items, active, action) {
    return '<div class="row g-2 wrap">' + items.map(function (s) {
      var id = s.id || s, label = s.label || s;
      return '<button class="chip" aria-pressed="' + (id === active) + '" data-action="' + esc(action) + '" data-arg="' + esc(id) + '">' +
        (s.tone ? '<span class="dot dot--' + s.tone + '"></span>' : '') + esc(label) +
        (s.count != null ? ' <span class="t-bold">' + s.count + '</span>' : '') + '</button>';
    }).join('') + '</div>';
  };

  U.field = function (o) {
    var ctl;
    if (o.type === 'select') {
      ctl = '<select class="select" ' + (o.action ? 'data-action="' + esc(o.action) + '"' : '') + (o.id ? ' id="' + esc(o.id) + '"' : '') + '>' +
        o.options.map(function (op) {
          var v = op.value != null ? op.value : op, l = op.label != null ? op.label : op;
          return '<option value="' + esc(v) + '"' + (String(v) === String(o.value) ? ' selected' : '') + '>' + esc(l) + '</option>';
        }).join('') + '</select>';
    } else if (o.type === 'textarea') {
      ctl = '<textarea class="textarea" rows="' + (o.rows || 4) + '" placeholder="' + esc(o.placeholder || '') + '"' + (o.id ? ' id="' + esc(o.id) + '"' : '') + '>' + esc(o.value || '') + '</textarea>';
    } else {
      ctl = '<input class="input" type="' + (o.type || 'text') + '" placeholder="' + esc(o.placeholder || '') + '" value="' + esc(o.value || '') + '"' +
        (o.id ? ' id="' + esc(o.id) + '"' : '') + (o.action ? ' data-action="' + esc(o.action) + '"' : '') + '>';
    }
    return '<label class="field">' + (o.label ? '<span class="label">' + esc(o.label) + (o.required ? ' <span class="req">*</span>' : '') + '</span>' : '') +
      ctl + (o.hint ? '<span class="hint">' + esc(o.hint) + '</span>' : '') + '</label>';
  };

  U.search = function (placeholder, action, value) {
    return '<div class="input-icon grow" style="max-width:320px">' + HS.icon('search', 15) +
      '<input class="input" type="search" placeholder="' + esc(placeholder) + '" value="' + esc(value || '') + '" data-action="' + esc(action) + '">' +
      '</div>';
  };

  /* ---- Table ------------------------------------------------------------- */
  /* cols: [{key,label,cls,width,sortable,render(row)}]  */
  U.table = function (o) {
    var cols = o.cols, rows = o.rows || [];
    var head = '<thead><tr>' +
      (o.select ? '<th style="width:38px"><input type="checkbox" data-action="' + esc(o.select) + '" data-arg="all" aria-label="Select all"></th>' : '') +
      cols.map(function (c) {
        var sorted = o.sort && o.sort.key === c.key;
        return '<th class="' + HS.cx(c.cls, c.sortable !== false && o.sortAction ? 'sortable' : '') + '"' +
          (c.width ? ' style="width:' + c.width + '"' : '') +
          (sorted ? ' aria-sort="' + (o.sort.dir === 'asc' ? 'ascending' : 'descending') + '"' : '') +
          (c.sortable !== false && o.sortAction ? ' data-action="' + esc(o.sortAction) + '" data-arg="' + esc(c.key) + '"' : '') + '>' +
          esc(c.label) + (c.sortable !== false && o.sortAction ? '<span class="sort-ind">' + HS.icon(sorted && o.sort.dir === 'asc' ? 'chevronUp' : 'chevronDown', 11) + '</span>' : '') +
          '</th>';
      }).join('') + '</tr></thead>';
    var body = rows.length ? '<tbody>' + rows.map(function (r, i) {
      return '<tr class="' + HS.cx(o.rowAction ? 'row--link' : '', o.isSelected && o.isSelected(r) ? 'is-selected' : '') + '"' +
        (o.rowAction ? ' data-action="' + esc(o.rowAction) + '" data-arg="' + esc(o.rowId ? o.rowId(r) : i) + '"' : '') + '>' +
        (o.select ? '<td><input type="checkbox" data-action="' + esc(o.select) + '" data-arg="' + esc(o.rowId ? o.rowId(r) : i) + '" aria-label="Select row"' +
          (o.isSelected && o.isSelected(r) ? ' checked' : '') + '></td>' : '') +
        cols.map(function (c) {
          return '<td class="' + (c.cls || '') + '" data-label="' + esc(c.label) + '">' + (c.render ? c.render(r, i) : esc(r[c.key])) + '</td>';
        }).join('') + '</tr>';
    }).join('') + '</tbody>' : '';
    return '<div class="table-wrap"><table class="table' + (o.compact ? ' table--compact' : '') + (o.stack !== false ? ' table--stack' : '') + '">' +
      head + body + '</table>' + (rows.length ? '' : '<div class="table__empty">' + esc(o.emptyText || 'No records match the current filters.') + '</div>') + '</div>';
  };

  /* ---- Timeline / feed --------------------------------------------------- */
  U.timeline = function (items) {
    return '<div class="timeline">' + items.map(function (i) {
      return '<div class="timeline__item"><span class="timeline__dot' + (i.tone ? ' timeline__dot--' + i.tone : '') + '"></span>' +
        '<div class="timeline__time">' + esc(i.time) + '</div>' +
        '<div class="timeline__title">' + esc(i.title) + '</div>' +
        (i.body ? '<div class="timeline__body">' + (i.raw ? i.body : esc(i.body)) + '</div>' : '') + '</div>';
    }).join('') + '</div>';
  };

  U.feed = function (items) {
    return '<div>' + items.map(function (i) {
      return '<div class="feed__item"><span class="feed__time">' + esc(i.time) + '</span>' +
        '<span class="none" style="padding-top:1px">' + HS.icon(i.icon || 'activity', 15, 't-muted') + '</span>' +
        '<div class="grow"><div class="t-sm">' + (i.raw ? i.text : esc(i.text)) + '</div>' +
        (i.meta ? '<div class="t-micro t-muted">' + esc(i.meta) + '</div>' : '') + '</div>' +
        (i.badge ? '<span class="none">' + i.badge + '</span>' : '') + '</div>';
    }).join('') + '</div>';
  };

  U.alertItem = function (o) {
    return '<button class="alert-item alert-item--' + o.tone + '"' +
      (o.route ? ' data-route="' + esc(o.route) + '"' : '') +
      (o.action ? ' data-action="' + esc(o.action) + '"' : '') +
      (o.arg != null ? ' data-arg="' + esc(o.arg) + '"' : '') + '>' +
      '<span class="alert-item__ico alert-item__ico--' + o.tone + '">' + HS.icon(o.icon || 'alertCircle', 16) + '</span>' +
      '<span class="grow" style="min-width:0"><span class="alert-item__title" style="display:block">' + esc(o.title) + '</span>' +
      '<span class="alert-item__meta" style="display:block">' + esc(o.meta) + '</span></span>' +
      (o.right ? '<span class="none row g-2">' + o.right + '</span>' : HS.icon('chevronRight', 15, 't-faint')) + '</button>';
  };

  /* ---- Flow / stepper ---------------------------------------------------- */
  U.flow = function (steps) {
    return '<div class="flow">' + steps.map(function (s) {
      return '<div class="flow__step' + (s.state ? ' flow__step--' + s.state : '') + '">' +
        '<span class="flow__label">' + esc(s.label) + '</span>' +
        (s.meta ? '<span class="flow__meta">' + esc(s.meta) + '</span>' : '') + '</div>';
    }).join('') + '</div>';
  };

  U.stepper = function (steps, activeIndex) {
    return '<div class="stepper">' + steps.map(function (s, i) {
      var state = i < activeIndex ? 'done' : i === activeIndex ? 'active' : '';
      return (i ? '<span class="stepper__line"></span>' : '') +
        '<span class="stepper__node' + (state ? ' stepper__node--' + state : '') + '">' +
        '<span class="stepper__num">' + (i < activeIndex ? HS.icon('check', 12) : (i + 1)) + '</span>' + esc(s) + '</span>';
    }).join('') + '</div>';
  };

  U.funnel = function (rows, action) {
    var top = rows[0].value || 1;
    return '<div class="funnel">' + rows.map(function (r, i) {
      var pctTop = (r.value / top) * 100;
      var conv = i ? Math.round((r.value / rows[i - 1].value) * 100) : 100;
      return '<button class="funnel__row"' + (action ? ' data-action="' + esc(action) + '" data-arg="' + esc(r.label) + '"' : '') + '>' +
        '<span class="funnel__label">' + esc(r.label) + '</span>' +
        '<span class="funnel__track"><span class="funnel__bar" style="width:' + Math.max(10, pctTop) + '%;background:' +
        (r.color || HS.charts.SERIES[i % 8]) + '">' + HS.fmt.n(r.value) + '</span></span>' +
        '<span class="funnel__conv">' + (i ? conv + '%' : '&nbsp;') + '</span></button>';
    }).join('') + '</div>';
  };

  /* ---- Overlays ---------------------------------------------------------- */
  var openOverlay = null;

  U.modal = function (o) {
    U.closeOverlay();
    var root = document.getElementById('overlay-root');
    root.innerHTML = '<div class="modal-backdrop" data-close="1">' +
      '<div class="modal ' + (o.size ? 'modal--' + o.size : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(o.title || 'Dialog') + '">' +
      '<div class="modal__head"><div class="grow"><div class="modal__title">' + esc(o.title || '') + '</div>' +
      (o.sub ? '<div class="card__sub">' + esc(o.sub) + '</div>' : '') + '</div>' +
      '<button class="iconbtn" data-close="1" aria-label="Close dialog">' + HS.icon('x', 18) + '</button></div>' +
      '<div class="modal__body">' + (o.body || '') + '</div>' +
      (o.foot ? '<div class="modal__foot">' + o.foot + '</div>' : '') +
      '</div></div>';
    openOverlay = root;
    var first = root.querySelector('.modal');
    if (first) first.focus();
    document.body.style.overflow = 'hidden';
  };

  /* Anchored dropdown. Flips above the anchor when there is no room below,
     and stays inside the viewport horizontally. */
  U.dropdown = function (anchor, html, opts) {
    opts = opts || {};
    U.closeOverlay();
    var root = document.getElementById('overlay-root');
    root.innerHTML = '<div class="dropdown-backdrop" data-close="1"></div>' +
      '<div class="menu menu--panel" role="menu" aria-label="' + esc(opts.label || 'Menu') + '">' + html + '</div>';
    openOverlay = root;

    var el = root.querySelector('.menu--panel');
    var r = anchor.getBoundingClientRect();
    var w = el.offsetWidth, h = el.offsetHeight, gap = 8, edge = 12;

    var left = opts.align === 'left' ? r.left : r.right - w;
    left = Math.max(edge, Math.min(left, window.innerWidth - w - edge));

    var top = r.bottom + gap;
    if (top + h > window.innerHeight - edge) {
      var above = r.top - gap - h;
      top = above >= edge ? above : Math.max(edge, window.innerHeight - h - edge);
    }
    el.style.left = Math.round(left) + 'px';
    el.style.top = Math.round(top) + 'px';
    var first = el.querySelector('button:not([disabled])');
    if (first) first.focus();
  };

  U.closeOverlay = function () {
    var root = document.getElementById('overlay-root');
    if (root) root.innerHTML = '';
    document.body.style.overflow = '';
    openOverlay = null;
  };
  U.isOverlayOpen = function () { return !!openOverlay; };

  U.toast = function (msg, tone, icon) {
    var root = document.getElementById('toast-root');
    var el = document.createElement('div');
    el.className = 'toast' + (tone ? ' toast--' + tone : '');
    el.setAttribute('role', 'status');
    el.innerHTML = HS.icon(icon || (tone === 'success' ? 'check' : tone === 'critical' ? 'alert' : 'info'), 17) + '<span>' + esc(msg) + '</span>';
    root.appendChild(el);
    setTimeout(function () {
      el.style.transition = 'opacity .3s, transform .3s';
      el.style.opacity = '0'; el.style.transform = 'translateY(6px)';
      setTimeout(function () { el.remove(); }, 320);
    }, 3200);
  };

  /* ---- Layout helpers ---------------------------------------------------- */
  U.grid = function (cls, items) { return '<div class="grid ' + cls + '">' + items.join('') + '</div>'; };
  U.page = function (inner, cls) { return '<div class="page ' + (cls || '') + '">' + inner + '</div>'; };
  U.illustrative = function (text) {
    return '<span class="illustrative">' + HS.icon('info', 12) + esc(text || 'Illustrative data') + '</span>';
  };
})(window.HS = window.HS || {});
