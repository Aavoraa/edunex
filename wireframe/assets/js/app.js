/* ==========================================================================
   APP — state, hash router, shell rendering, global event delegation
   ========================================================================== */
(function (HS) {
  'use strict';

  var U = HS.ui, D = HS.data, t = HS.t;

  /* ---- State -------------------------------------------------------------- */
  var S = HS.state = {
    authed: false,
    role: 'management',
    campus: 'gdv',
    scope: 'campus',           /* campus | group */
    year: '2026–27',
    route: 'command-center',
    params: {},
    rail: false,
    drawer: false,
    searchOpen: false,
    searchQuery: '',
    mobileSearch: false,
    vs: {}                     /* per-view scratch state */
  };

  HS.roleObj = function () {
    return D.roles.filter(function (r) { return r.id === S.role; })[0];
  };
  HS.campusObj = function () {
    return D.campuses.filter(function (c) { return c.id === S.campus; })[0];
  };
  /* per-view state helper */
  HS.vs = function (key, init) {
    if (!S.vs[key]) S.vs[key] = Object.assign({}, init || {});
    else if (init) Object.keys(init).forEach(function (k) { if (!(k in S.vs[key])) S.vs[key][k] = init[k]; });
    return S.vs[key];
  };

  /* ---- Route registry ------------------------------------------------------ */
  var routes = HS.routes = {};
  HS.route = function (name, fn, meta) { routes[name] = { render: fn, meta: meta || {} }; };

  var actions = HS.actionRegistry = {};
  HS.on = function (name, fn) { actions[name] = fn; };

  /* ---- Navigation ---------------------------------------------------------- */
  HS.go = function (hash) {
    if (hash.charAt(0) !== '#') hash = '#' + hash;
    if (location.hash === hash) { render(); return; }
    location.hash = hash;
  };

  function parseHash() {
    var h = location.hash.replace(/^#\/?/, '') || 'command-center';
    var parts = h.split('?');
    S.route = parts[0] || 'command-center';
    S.params = {};
    if (parts[1]) {
      parts[1].split('&').forEach(function (kv) {
        var p = kv.split('=');
        S.params[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || '');
      });
    }
  }

  /* Routes a role may not reach */
  function allowedRoute(name) {
    /* 'search' has no sidebar entry; everything else must earn access through
       the navigation model, including the Management-only Prototype tools. */
    if (name === 'search') return true;
    var ok = false;
    HS.nav.forEach(function (g) {
      if ((g.roles || []).indexOf(S.role) === -1) return;
      g.items.forEach(function (i) {
        if ((i.roles || g.roles || []).indexOf(S.role) === -1) return;
        if (i.route.replace('#/', '').split('?')[0] === name) ok = true;
      });
    });
    return ok;
  }

  /* Can the signed-in role open this route? Views use this to avoid rendering a
     link into a screen the role cannot reach. Nav is the single source of truth. */
  HS.can = function (route) {
    return allowedRoute(String(route).replace('#/', '').split('?')[0]);
  };

  /* ---- Shell: sidebar ------------------------------------------------------ */
  /* Groups and items this role may see, with Overview de-duplicated: the
     Dashboard item already points at the role's home, so any other Overview
     item with the same destination is dropped. */
  function navModel() {
    var home = HS.roleObj().home.split('?')[0];
    return HS.nav.filter(function (g) { return (g.roles || []).indexOf(S.role) > -1; }).map(function (g) {
      var items = g.items.filter(function (i) { return (i.roles || g.roles).indexOf(S.role) > -1; });
      if (g.group === 'Overview') {
        items = items.filter(function (i) { return i.dynamicHome || i.route.split('?')[0] !== home; });
      }
      return { g: g, items: items, pinned: g.group === 'Overview' };
    }).filter(function (x) { return x.items.length; });
  }
  function routeOf(item) {
    return (item.dynamicHome ? HS.roleObj().home : item.route).replace('#/', '').split('?')[0];
  }
  /* Exactly one place owns the current page, so exactly one entry is marked.
     Overview wins if it lists the page; otherwise the first section that does.
     Pages that appear in two sections are only highlighted in the first. */
  var PINNED = '__pinned__';
  function pageOwner(model) {
    var hit = null;
    model.forEach(function (x) {
      if (hit) return;
      if (x.items.some(function (i) { return routeOf(i) === S.route; })) hit = x.pinned ? PINNED : x.g.group;
    });
    return hit;
  }
  /* Sidebar badges use the same numbers as the header */
  function badgeFor(route, item) {
    if (route === 'notifications') {
      return D.notificationsFor(S.role).filter(function (n) { return n.category === 'Critical' || n.category === 'Attention'; }).length;
    }
    if (route === 'my-tasks') return D.tasksFor(S.role).length;
    return item.count;
  }
  function navState() { return HS.vs('nav', { open: undefined, q: '', lastRoute: null }); }

  function navItemHTML(item, q, owns) {
    var target = item.dynamicHome ? HS.roleObj().home : item.route;
    var route = routeOf(item);
    var current = owns && route === S.route;
    var count = badgeFor(route, item);
    var raw = t(item.label);
    var label = HS.esc(raw);
    if (q) {
      var at = raw.toLowerCase().indexOf(q.toLowerCase());
      if (at > -1) {
        label = HS.esc(raw.slice(0, at)) + '<mark class="navmark">' + HS.esc(raw.slice(at, at + q.length)) + '</mark>' + HS.esc(raw.slice(at + q.length));
      }
    }
    return '<button class="navitem" data-route="' + HS.esc(target) + '"' + (current ? ' aria-current="page"' : '') +
      ' title="' + HS.esc(raw) + '">' +
      '<span class="navitem__ico">' + HS.icon(item.icon, 17) + '</span>' +
      '<span class="navitem__label">' + label + '</span>' +
      (count ? '<span class="navitem__count' + (item.tone ? ' navitem__count--' + item.tone : '') + '">' + count + '</span>' : '') +
      '</button>';
  }

  /* The scrolling list only. It is re-rendered on its own while the user
     types in the page finder, so the input keeps focus. */
  function navListHTML() {
    var nav = navState();
    var model = navModel();
    var owner = pageOwner(model);
    /* Follow the page: when the route changes, open the section that owns it */
    if (nav.lastRoute !== S.route) { nav.open = owner === PINNED ? null : owner; nav.lastRoute = S.route; }
    var q = (nav.q || '').trim();
    var ql = q.toLowerCase();

    var html = '', matches = 0;
    model.forEach(function (x) {
      var items = x.items;
      if (ql) {
        var groupHit = t(x.g.group).toLowerCase().indexOf(ql) > -1;
        if (!groupHit) items = items.filter(function (i) { return t(i.label).toLowerCase().indexOf(ql) > -1; });
        if (!items.length) return;
        matches += items.length;
      }
      var owns = x.pinned ? owner === PINNED : owner === x.g.group;
      var list = '<div class="navgroup__items">' + items.map(function (i) { return navItemHTML(i, q, owns); }).join('') + '</div>';

      if (x.pinned) {
        html += '<div class="navgroup navgroup--pinned" data-open="true">' + list + '</div>';
        return;
      }
      var open = ql ? true : nav.open === x.g.group;
      var isOwner = owner === x.g.group;
      var name = HS.esc(t(x.g.group));
      html += '<div class="navgroup" data-open="' + open + '"' + (isOwner ? ' data-current="true"' : '') + '>' +
        '<button class="navhead" data-action="toggle-navgroup" data-arg="' + HS.esc(x.g.group) + '" aria-expanded="' + open + '" title="' + name + '">' +
        '<span class="navhead__ico">' + HS.icon(x.g.icon, 17) + '</span>' +
        '<span class="navhead__label">' + name + '</span>' +
        '<span class="navhead__count">' + items.length + '</span>' +
        '<span class="navhead__chev">' + HS.icon('chevronDown', 14) + '</span>' +
        '</button>' + list + '</div>';
    });

    if (ql && !matches) {
      html += '<div class="navempty">' + HS.icon('search', 18) +
        '<div>No page matches \u201c' + HS.esc(q) + '\u201d</div>' +
        '<button class="navempty__btn" data-action="nav-search-clear">Clear search</button></div>';
    }
    return html;
  }

  function sidebarHTML() {
    var nav = navState();
    var role = HS.roleObj();
    return '<div class="sidebar__brand">' +
      HS.brandMark(36) +
      '<span class="col grow" style="min-width:0"><span class="sidebar__name">Edunex</span>' +
      '<span class="sidebar__tag">International School</span></span>' +
      '<button class="iconbtn iconbtn--onnavy none sidebar__railbtn" data-action="toggle-rail" aria-label="' + (S.rail ? 'Expand navigation' : 'Collapse navigation') + '">' +
      HS.icon(S.rail ? 'chevronRight' : 'chevronLeft', 17) + '</button>' +
      '</div>' +
      '<div class="sidebar__find">' +
      '<span class="sidebar__findico">' + HS.icon('search', 15) + '</span>' +
      '<input class="sidebar__findinput" type="search" placeholder="Find a page\u2026" aria-label="Find a page in the menu" ' +
      'value="' + HS.esc(nav.q || '') + '" data-action="nav-search" autocomplete="off">' +
      '</div>' +
      '<nav class="sidebar__scroll" aria-label="Main navigation">' + navListHTML() + '</nav>' +
      '<div class="sidebar__foot">' +
      '<div class="sidebar__footrow">' +
      '<button class="sidebar__role grow" data-action="open-profile" aria-haspopup="menu" title="' + HS.esc(role.person) + '">' +
      U.avatar(role.person, { size: 'sm', tone: 'avatar--amber' }) +
      '<span class="col grow" style="min-width:0">' +
      '<span class="t-xs t-bold t-clip" style="color:#fff">' + HS.esc(role.person) + '</span>' +
      '<span class="t-micro t-clip" style="color:var(--gold)">' + HS.esc(role.title) + '</span></span>' +
      HS.icon('more', 15) + '</button>' +
      '<button class="iconbtn iconbtn--onnavy none sidebar__logout" data-action="sign-out" ' +
      'aria-label="' + HS.esc(t('Sign out')) + '" title="' + HS.esc(t('Sign out')) + '">' + HS.icon('logout', 17) + '</button>' +
      '</div></div>';
  }

  /* ---- Shell: top header --------------------------------------------------- */
  function topbarHTML() {
    var c = HS.campusObj(), role = HS.roleObj();
    var mine = D.notificationsFor(S.role);
    var alertCount = mine.filter(function (n) { return n.category === 'Critical' || n.category === 'Attention'; }).length;
    /* A parent belongs to one campus and a staff member to one payroll; neither
       switches campus. Only roles that reach the Co-Pilot see its shortcut. */
    var showCampus = ['management', 'office'].indexOf(S.role) > -1;
    var showCopilot = ['management', 'teacher'].indexOf(S.role) > -1;
    return '<button class="iconbtn iconbtn--onnavy menubtn hidden" data-action="toggle-drawer" aria-label="Open navigation">' + HS.icon('menu', 20) + '</button>' +
      '<span class="topbar__brandSm hidden row g-2">' + HS.brandMark(28) +
      '<span class="serif" style="color:#fff;font-size:15px;font-weight:700;letter-spacing:.02em">Edunex</span></span>' +
      '<div class="topbar__ctx">' +
      (!showCampus ? '' :
      '<button class="ctxselect" data-action="open-campus-switcher">' + HS.icon('building', 16) +
      '<span class="col" style="min-width:0"><span class="ctxselect__label">' + HS.esc(t('Campus')) + '</span>' +
      '<span class="ctxselect__value">' + HS.esc(S.scope === 'group' ? 'All campuses — Group view' : c.name) + '</span></span>' +
      HS.icon('chevronDown', 14) + '</button>') +
      '<button class="ctxselect" data-action="open-year-switcher">' +
      '<span class="col"><span class="ctxselect__label">' + HS.esc(t('Academic Year')) + '</span>' +
      '<span class="ctxselect__value">' + HS.esc(S.year) + '</span></span>' + HS.icon('chevronDown', 14) + '</button>' +
      '</div>' +
      '<div class="globalsearch">' +
      '<span class="globalsearch__ico">' + HS.icon('search', 16) + '</span>' +
      '<input class="globalsearch__input" type="search" role="combobox" aria-expanded="' + S.searchOpen + '" aria-label="Global search" ' +
      'placeholder="' + HS.esc(t('Search students, parents, staff, fees…')) + '" value="' + HS.esc(S.searchQuery) + '" data-action="global-search">' +
      '<span class="globalsearch__kbd">Ctrl K</span>' +
      (S.searchOpen ? searchPanelHTML() : '') +
      '</div>' +
      '<div class="spacer"></div>' +
      '<button class="iconbtn iconbtn--onnavy searchbtn hidden" data-action="toggle-mobile-search" aria-label="' + (S.mobileSearch ? 'Close search' : 'Search') + '">' + HS.icon(S.mobileSearch ? 'x' : 'search', 19) + '</button>' +
      (showCopilot ? '<button class="btn btn--amber btn--sm topbar__hideSm" data-route="#/copilot">' + HS.icon('sparkle', 15) + HS.esc(t('AI Assistant')) + '</button>' : '') +
      U.iconbtn('bell', { cls: 'iconbtn--onnavy', label: t('Notifications'), route: '#/notifications', count: String(alertCount) }) +
      '<button class="iconbtn iconbtn--onnavy topbar__hideSm" data-action="open-lang" aria-haspopup="menu" ' +
      'aria-label="' + HS.esc(t('Language')) + '" title="' + HS.esc(t('Language')) + ' — ' + HS.esc(HS.i18n.label()) + '">' +
      '<span class="t-micro t-bold">' + HS.esc(HS.i18n.short()) + '</span></button>' +
      '<button class="topbar__user" data-action="open-profile" aria-haspopup="menu">' +
      U.avatar(role.person, { size: 'sm', tone: 'avatar--amber' }) +
      '<span class="col topbar__usertext" style="min-width:0"><span class="topbar__username">' + HS.esc(role.person) + '</span>' +
      '<span class="topbar__userrole">' + HS.esc(role.label) + '</span></span>' +
      HS.icon('chevronDown', 14) + '</button>';
  }

  function searchPanelHTML() {
    var q = S.searchQuery.trim().toLowerCase();
    var idx = D.searchIndex(S.role);
    var hits = q ? idx.filter(function (r) {
      return (r.label + ' ' + r.meta + ' ' + r.group).toLowerCase().indexOf(q) > -1;
    }).slice(0, 18) : idx.slice(0, 6);
    if (!hits.length) {
      return '<div class="searchpanel">' + U.empty('No matches for “' + q + '”', 'Try a student name, an employee ID, a lead reference or a module name.') + '</div>';
    }
    var groups = {};
    hits.forEach(function (h) { (groups[h.group] = groups[h.group] || []).push(h); });
    return '<div class="searchpanel" role="listbox">' +
      (q ? '' : '<div class="searchpanel__group">Suggested</div>') +
      Object.keys(groups).map(function (g) {
        return (q ? '<div class="searchpanel__group">' + HS.esc(g) + '</div>' : '') +
          groups[g].map(function (h) {
            return '<button class="searchpanel__item" data-route="' + HS.esc(h.route) + '" data-action="close-search">' +
              '<span class="none t-muted">' + HS.icon(h.icon, 16) + '</span>' +
              '<span class="col grow" style="min-width:0"><span class="t-sm t-bold t-clip">' + HS.esc(h.label) + '</span>' +
              '<span class="t-micro t-muted t-clip">' + HS.esc(h.meta) + '</span></span>' +
              HS.icon('arrowRight', 14) + '</button>';
          }).join('');
      }).join('') + '</div>';
  }

  function mobileNavHTML() {
    var items = HS.mobileNav[S.role] || HS.mobileNav.management;
    return items.map(function (i) {
      var current = i.route && i.route.replace('#/', '').split('?')[0] === S.route;
      return '<button class="mobilenav__item"' + (current ? ' aria-current="page"' : '') +
        (i.route ? ' data-route="' + HS.esc(i.route) + '"' : '') +
        (i.action ? ' data-action="' + HS.esc(i.action) + '"' : '') + '>' +
        HS.icon(i.icon, 20) + '<span>' + HS.esc(t(i.label)) + '</span></button>';
    }).join('');
  }

  /* ---- Render -------------------------------------------------------------- */
  function render() {
    var app = document.getElementById('app'),
      login = document.getElementById('login');

    if (!S.authed) {
      app.hidden = true; login.hidden = false;
      login.innerHTML = HS.views.login();
      return;
    }
    login.hidden = true; app.hidden = false;
    app.dataset.rail = String(S.rail);
    app.dataset.drawer = String(S.drawer);
    app.dataset.search = String(S.mobileSearch === true);

    /* Keep the menu where the user left it. Re-rendering must not throw the
       sidebar back to the top; only a page change scrolls its entry into view. */
    var oldList = document.querySelector('.sidebar__scroll');
    var keepTop = oldList ? oldList.scrollTop : 0;
    var pageChanged = navState().lastRoute !== S.route;
    document.getElementById('sidebar').innerHTML = sidebarHTML();
    var list = document.querySelector('.sidebar__scroll');
    if (list) {
      list.scrollTop = keepTop;
      var cur = pageChanged && list.querySelector('.navitem[aria-current="page"]');
      if (cur && cur.offsetParent) {
        var y = cur.offsetTop - list.offsetTop;
        if (y < list.scrollTop || y + cur.offsetHeight > list.scrollTop + list.clientHeight) {
          list.scrollTop = Math.max(0, y - list.clientHeight / 3);
        }
      }
    }
    document.getElementById('topbar').innerHTML = topbarHTML();
    document.getElementById('mobilenav').innerHTML = mobileNavHTML();

    var name = S.route, entry = routes[name];
    var host = document.getElementById('view');
    if (!entry) {
      host.innerHTML = U.page(U.pageHead({ title: 'Screen not found', sub: 'The route “' + name + '” is not part of this prototype.' }) +
        U.card({ body: U.empty('Nothing here yet', 'Use the navigation on the left, or return to the dashboard.', 'compass') +
          '<div class="row center">' + U.btn('Go to dashboard', { variant: 'primary', route: HS.roleObj().home }) + '</div>' }));
    } else if (!allowedRoute(name)) {
      host.innerHTML = U.page(U.pageHead({ title: 'Not available for this role', sub: 'Signed in as ' + HS.roleObj().label + '. This module is outside that role\'s access.' }) +
        U.card({
          body: U.banner('<strong>Role-based access.</strong> The interface adapts to the signed-in role. ' +
            HS.esc(HS.roleObj().label) + ' sees: ' + HS.esc(HS.roleObj().desc) + '.', 'warning', 'lock') +
          '<div class="row g-3 mt-4 wrap">' + U.btn('Open my dashboard', { variant: 'primary', route: HS.roleObj().home }) +
          U.btn('Sign out and use another account', { action: 'sign-out', icon: 'logout' }) + '</div>'
        }));
    } else {
      host.innerHTML = entry.render(S.params);
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
    if (window.innerWidth <= 1024) S.drawer = false;
  }
  HS.render = render;

  /* ---- Global actions ------------------------------------------------------ */
  var G = {
    'toggle-rail': function () { S.rail = !S.rail; render(); },
    'toggle-drawer': function () { S.drawer = !S.drawer; document.getElementById('app').dataset.drawer = String(S.drawer); },
    'close-drawer': function () { S.drawer = false; document.getElementById('app').dataset.drawer = 'false'; },
    /* Accordion: one section open at a time. In the collapsed rail a
       section icon expands the sidebar straight into that section. */
    'toggle-navgroup': function (arg) {
      var n = navState();
      if (S.rail) { S.rail = false; n.open = arg; render(); return; }
      n.open = n.open === arg ? null : arg;
      var list = document.querySelector('.sidebar__scroll');
      if (list) list.innerHTML = navListHTML(); else render();
    },
    'nav-search': function (arg, el) {
      navState().q = el.value;
      document.querySelector('.sidebar__scroll').innerHTML = navListHTML();
    },
    'nav-search-clear': function () {
      navState().q = '';
      var input = document.querySelector('.sidebar__findinput');
      if (input) { input.value = ''; input.focus(); }
      document.querySelector('.sidebar__scroll').innerHTML = navListHTML();
    },
    'toggle-lang': function () { G['set-lang'](HS.i18n.toggle()); },
    'open-lang': function (arg, el) {
      U.dropdown(el, '<div class="menu__label">' + HS.esc(t('Language')) + '</div>' +
        HS.i18n.langs.map(function (l) {
          var on = l.id === HS.i18n.lang;
          return '<button class="menu__item" role="menuitemradio" aria-checked="' + on + '" ' +
            'data-action="set-lang" data-arg="' + l.id + '"' + (on ? ' aria-selected="true"' : '') + '>' +
            '<span class="menu__code">' + HS.esc(l.short) + '</span>' +
            '<span class="grow">' + HS.esc(l.label) + '</span>' +
            (on ? HS.icon('check', 15) : '') + '</button>';
        }).join(''), { label: 'Language' });
    },
    'set-lang': function (arg) {
      HS.i18n.set(arg);
      U.closeOverlay();
      render();
      U.toast(HS.i18n.t('Language') + ': ' + HS.i18n.label(), 'success', 'globe');
    },
    'global-search': function (arg, el) {
      S.searchQuery = el.value;
      S.searchOpen = true;
      var panel = el.parentNode.querySelector('.searchpanel');
      var html = searchPanelHTML();
      if (panel) panel.outerHTML = html; else el.parentNode.insertAdjacentHTML('beforeend', html);
    },
    'close-search': function () { S.searchOpen = false; S.searchQuery = ''; S.mobileSearch = false; },
    'toggle-mobile-search': function () {
      S.mobileSearch = !S.mobileSearch;
      render();
      if (S.mobileSearch) {
        var i = document.querySelector('.globalsearch__input');
        if (i) i.focus();
      }
    },
    /* Profile menu, anchored to whichever control opened it. */
    'open-profile': function (arg, el) {
      var role = HS.roleObj();

      var head = '<div class="menu__head">' +
        U.avatar(role.person, { size: 'lg', tone: 'avatar--amber' }) +
        '<div class="grow" style="min-width:0">' +
        '<div class="t-sm t-bold t-clip">' + HS.esc(role.person) + '</div>' +
        '<div class="menu__meta t-clip">' + HS.esc(role.title) + '</div>' +
        '<div class="menu__meta t-clip">' + HS.esc(role.email) + '</div>' +
        '<div class="mt-2">' + U.badge(role.label, 'info') + '</div>' +
        '</div></div>';

      var items = [
        ['user', 'My profile', 'not-built', 'My profile'],
        ['settings', 'Account settings', 'not-built', 'Account settings'],
        ['bell', 'Notification preferences', 'not-built', 'Notification preferences'],
        ['shield', 'Privacy and access', 'not-built', 'Privacy and access']
      ].map(function (i) {
        return '<button class="menu__item" data-action="' + i[2] + '" data-arg="' + HS.esc(i[3]) + '">' +
          HS.icon(i[0], 16) + '<span class="grow">' + HS.esc(i[1]) + '</span></button>';
      }).join('');

      /* Language and help sit here rather than as loose header icons */
      items += '<button class="menu__item" data-action="open-help">' + HS.icon('helpCircle', 16) +
        '<span class="grow">' + HS.esc(t('Help')) + '</span></button>';

      var foot = '<div class="menu__sep"></div>' +
        '<button class="menu__item menu__item--danger" data-action="sign-out">' +
        HS.icon('logout', 16) + '<span class="grow">' + HS.esc(t('Sign out')) + '</span></button>';

      U.dropdown(el, head + '<div class="menu__body">' + items + '</div>' + foot, { label: 'Profile menu' });
    },
    'open-campus-switcher': function () {
      U.modal({
        title: 'Campus & scope', sub: 'Every figure in the application follows this selection.',
        body: '<div class="col g-3">' +
          '<button class="optioncard" data-action="set-scope" data-arg="group" aria-pressed="' + (S.scope === 'group') + '">' +
          '<span class="avatar avatar--teal">' + HS.icon('globe', 18) + '</span>' +
          '<span class="col grow"><span class="t-sm t-bold">Group view — all campuses</span>' +
          '<span class="t-xs t-muted">Consolidated KPIs across 3 campuses, 2,080 students</span></span>' +
          (S.scope === 'group' ? U.badge('Active', 'success') : HS.icon('chevronRight', 16)) + '</button>' +
          '<div class="divider"></div>' +
          D.campuses.map(function (c) {
            var on = S.scope === 'campus' && c.id === S.campus;
            return '<button class="optioncard" data-action="set-campus" data-arg="' + c.id + '" aria-pressed="' + on + '">' +
              '<span class="avatar ' + (on ? 'avatar--amber' : '') + '">' + HS.icon('building', 18) + '</span>' +
              '<span class="col grow"><span class="t-sm t-bold">' + HS.esc(c.name) + '</span>' +
              '<span class="t-xs t-muted">' + HS.esc(c.place) + ' · ' + HS.fmt.n(c.students) + ' students · ' + HS.esc(c.curriculum) + '</span></span>' +
              (on ? U.badge('Active', 'success') : HS.icon('chevronRight', 16)) + '</button>';
          }).join('') + '</div>',
        foot: U.btn('Close', { action: 'close-overlay' })
      });
    },
    'set-campus': function (arg) { S.campus = arg; S.scope = 'campus'; U.closeOverlay(); render(); U.toast('Campus: ' + HS.campusObj().name, 'success', 'building'); },
    'set-scope': function (arg) { S.scope = arg; U.closeOverlay(); render(); U.toast('Group view — all campuses', 'success', 'globe'); },
    'open-year-switcher': function () {
      U.modal({
        title: 'Academic year',
        body: '<div class="col g-2">' + D.academicYears.map(function (y) {
          return '<button class="optioncard" data-action="set-year" data-arg="' + y + '" aria-pressed="' + (y === S.year) + '">' +
            '<span class="avatar">' + HS.icon('calendar', 17) + '</span>' +
            '<span class="col grow"><span class="t-sm t-bold">' + y + '</span>' +
            '<span class="t-xs t-muted">' + (y === '2026–27' ? 'Current year — live data' : 'Archived year — read only') + '</span></span>' +
            (y === S.year ? U.badge('Active', 'success') : '') + '</button>';
        }).join('') + '</div>',
        foot: U.btn('Close', { action: 'close-overlay' })
      });
    },
    'set-year': function (arg) { S.year = arg; U.closeOverlay(); render(); U.toast('Academic year ' + arg, 'success', 'calendar'); },
    'open-help': function () {
      U.modal({
        title: 'About this prototype',
        body: '<p class="t-sm">This is a clickable, high-fidelity wireframe of Edunex Smart School 360. Every screen is built from one shared design system so the whole application reads as a single product rather than a set of modules.</p>' +
          '<div class="mt-4">' + U.dl([
            ['Try', 'Switch role in the header. The navigation, dashboard and permissions change.', 'raw'],
            ['Try', 'Click any student anywhere. It always opens their Student 360 profile.', 'raw'],
            ['Try', 'Switch the campus selector to Group view for consolidated figures.', 'raw'],
            ['Try', 'Use the language button for English / தமிழ்.', 'raw'],
            ['Data', 'All records are illustrative. No figure here is a real person or a real transaction.', 'raw']
          ]) + '</div>' +
          '<div class="mt-4">' + U.banner('Keyboard: <strong>Ctrl K</strong> focuses global search, <strong>Esc</strong> closes dialogs.', 'neutral', 'zap') + '</div>',
        foot: U.btn('Close', { variant: 'primary', action: 'close-overlay' })
      });
    },
    'close-overlay': function () { U.closeOverlay(); },
    'sign-out': function () {
      var role = HS.roleObj();
      U.modal({
        title: t('Sign out') + '?',
        body: '<div class="row-top g-4">' +
          '<span class="none">' + U.avatar(role.person, { size: 'lg', tone: 'avatar--amber' }) + '</span>' +
          '<div class="grow"><p class="t-sm">You are signed in as <strong>' + HS.esc(role.person) +
          '</strong>, ' + HS.esc(role.title) + '.</p>' +
          '<p class="t-sm t-muted mt-2">Signing out returns you to the sign-in screen and resets the prototype to its starting state. Nothing is stored between sessions.</p></div></div>',
        foot: U.btn('Cancel', { action: 'close-overlay' }) +
          U.btn(t('Sign out'), { variant: 'danger', icon: 'logout', action: 'confirm-sign-out' })
      });
    },
    'confirm-sign-out': function () {
      S.authed = false;
      S.vs = {};
      S.searchOpen = false; S.searchQuery = ''; S.mobileSearch = false; S.drawer = false;
      S.scope = 'campus'; S.campus = 'gdv';
      HS.vs('login', { role: S.role }).role = S.role;
      U.closeOverlay();
      render();
      U.toast(t('Sign out') + ' — session ended', 'success', 'logout');
    },
    'toast': function (arg) { U.toast(arg, 'success'); },
    'demo': function (arg) { U.toast(arg || 'Recorded in this prototype', 'success', 'check'); },
    'not-built': function (arg) {
      U.modal({
        title: arg || 'Prototype boundary',
        body: '<p class="t-sm">This control is intentionally non-functional in the wireframe. It is shown so the interaction, its placement and its states are agreed before development.</p>',
        foot: U.btn('Understood', { variant: 'primary', action: 'close-overlay' })
      });
    }
  };

  /* ---- Event delegation ---------------------------------------------------- */
  document.addEventListener('click', function (e) {
    /* Close only on an explicit close control, or on the backdrop itself.
       A click on anything inside the dialog must fall through to its action. */
    if (e.target.closest('button[data-close]')) { U.closeOverlay(); return; }
    if (e.target.matches && e.target.matches('[data-close]')) { U.closeOverlay(); return; }

    var el = e.target.closest('[data-action],[data-route]');
    if (!el) {
      if (S.searchOpen && !e.target.closest('.globalsearch')) { S.searchOpen = false; render(); }
      return;
    }
    var action = el.dataset.action, arg = el.dataset.arg, route = el.dataset.route;

    if (action && el.tagName !== 'INPUT' && el.tagName !== 'SELECT') {
      var fn = G[action] || actions[action];
      if (fn) { e.preventDefault(); fn(arg, el, e); }
    }
    if (route) {
      e.preventDefault();
      /* choosing a page from the finder clears it */
      if (el.classList.contains('navitem') && navState().q) navState().q = '';
      if (action === 'close-search') { S.searchOpen = false; S.searchQuery = ''; }
      HS.go(route);
    }
  });

  document.addEventListener('input', function (e) {
    var el = e.target.closest('[data-action]');
    if (!el) return;
    var fn = G[el.dataset.action] || actions[el.dataset.action];
    if (fn) fn(el.dataset.arg, el, e);
  });

  document.addEventListener('change', function (e) {
    var el = e.target.closest('select[data-action],input[type=checkbox][data-action],input[type=radio][data-action]');
    if (!el) return;
    var fn = G[el.dataset.action] || actions[el.dataset.action];
    if (fn) fn(el.dataset.arg, el, e);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && e.target.classList && e.target.classList.contains('sidebar__findinput') && navState().q) {
      G['nav-search-clear']();
      return;
    }
    if (e.key === 'Escape') {
      if (U.isOverlayOpen()) { U.closeOverlay(); return; }
      if (S.searchOpen) { S.searchOpen = false; S.searchQuery = ''; render(); }
      if (S.drawer) G['close-drawer']();
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      var input = document.querySelector('.globalsearch__input');
      if (input) { input.focus(); input.select(); }
    }
  });

  window.addEventListener('hashchange', function () { parseHash(); render(); });

  /* ---- Boot ---------------------------------------------------------------- */
  HS.boot = function () {
    parseHash();
    render();
  };
})(window.HS = window.HS || {});
