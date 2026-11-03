/* ==========================================================================
   HOME — public landing + sign-in.
   The left side is a live text hero (headline, summary and statistics)
   beside the sign-in card.
   ========================================================================== */
(function (HS) {
  'use strict';
  var U = HS.ui, D = HS.data, esc = HS.esc;

  /* ---- Robot mascot ------------------------------------------------------- */
  function mascot() {
    return '<svg width="58" height="58" viewBox="0 0 64 64" role="img" aria-label="AI campus assistant">' +
      '<ellipse cx="32" cy="59" rx="16" ry="3.4" fill="#0D2B45" opacity=".16"/>' +
      '<rect x="19" y="33" width="26" height="22" rx="9" fill="#F2F6FA" stroke="#C5D6E4" stroke-width="1.5"/>' +
      '<rect x="27" y="41" width="10" height="9" rx="3" fill="#E1ECF4"/>' +
      '<rect x="11" y="36" width="8" height="15" rx="4" fill="#E7EFF6" stroke="#C5D6E4" stroke-width="1.2"/>' +
      '<rect x="45" y="36" width="8" height="15" rx="4" fill="#E7EFF6" stroke="#C5D6E4" stroke-width="1.2"/>' +
      '<rect x="15" y="12" width="34" height="24" rx="11" fill="#FBFDFF" stroke="#C5D6E4" stroke-width="1.6"/>' +
      '<rect x="19" y="17" width="26" height="14" rx="7" fill="#0D2B45"/>' +
      '<circle cx="27" cy="24" r="3.4" fill="#4FD1E8"/><circle cx="37" cy="24" r="3.4" fill="#4FD1E8"/>' +
      '<circle cx="28.2" cy="22.8" r="1.1" fill="#fff"/><circle cx="38.2" cy="22.8" r="1.1" fill="#fff"/>' +
      '<rect x="30.4" y="5" width="3.2" height="7" rx="1.6" fill="#B87008"/><circle cx="32" cy="4" r="3" fill="#E8B765"/>' +
      '<circle cx="32" cy="46" r="2.2" fill="#4FD1E8" opacity=".8"/>' +
      '</svg>';
  }

  /* ---- The screen --------------------------------------------------------- */
  HS.views.login = function () {
    var picked = HS.vs('login', { role: 'management', showPw: false }).role;
    var v = HS.vs('login');
    var role = D.roles.filter(function (r) { return r.id === picked; })[0] || D.roles[0];
    var students = D.campuses.reduce(function (a, c) { return a + c.students; }, 0);


    var roleIcon = { management: 'user', teacher: 'users', parent: 'heart', office: 'building', staff: 'idCard' };

    return '' +
      /* ---- top bar ---- */
      '<header class="home__nav">' +
      '<div class="home__brand">' +
      HS.brandMark(46) +
      '<span class="col"><span class="home__brandname">Edunex</span>' +
      '<span class="home__brandtag">International School</span></span></div>' +
      '<nav class="home__links">' +
      ['Learn', 'Grow', 'Belong', 'Lead'].map(function (l, i) {
        return (i ? '<span class="navlink__sep">|</span>' : '') +
          '<button class="navlink" data-action="not-built" data-arg="' + esc(l) + ' — public website section">' + esc(l) + '</button>';
      }).join('') + '</nav>' +
      '<div class="spacer"></div>' +
      '<div class="langpill">' + HS.i18n.langs.map(function (l) {
        return '<button aria-pressed="' + (HS.i18n.lang === l.id) + '" data-action="login-lang" data-arg="' + l.id + '">' +
          esc(l.label) + '</button>';
      }).join('') + '</div>' +
      '</header>' +

      '<p class="script script--tr">A Brighter Tomorrow<br>Begins Here</p>' +
      '<p class="script script--br">Growing Minds.<br>Inspiring Futures.</p>' +

      '<div class="home__body">' +

      /* ---- left: the text hero ---- */
      '<div class="home__left">' +

      '<div class="herofallback">' +
      '<p class="hero__eyebrow">A Brighter Tomorrow Begins Here</p>' +
      '<h1 class="hero__title">Edunex International.<em>Growing Minds. Inspiring Futures.</em></h1>' +
      '<p class="hero__lede">Admissions, academics, parents, safety, finance, workforce and intelligence — connected around every student.</p>' +
      '<div class="statsbar">' +
      [['users', HS.fmt.n(D.campuses.reduce(function (a, c) { return a + c.students; }, 0)) + '+', 'Students'],
       ['graduation', D.workforce.kpis.total + '+', 'Staff'],
       ['building', String(D.campuses.length), 'Campuses'],
       ['globe', 'Cambridge', 'Primary to A Level']
      ].map(function (st) {
        return '<span class="stat"><span class="stat__ico">' + HS.icon(st[0], 20) + '</span>' +
          '<span class="col"><span class="stat__value">' + esc(st[1]) + '</span>' +
          '<span class="stat__label">' + esc(st[2]) + '</span></span></span>';
      }).join('') + '</div>' +
      '</div>' +

      /* Brand Mood Pill bar */
      '<div class="row wrap g-3 mt-4" style="padding:0 var(--s-2)">' +
      '<span class="t-micro t-bold" style="color:var(--gold);text-transform:uppercase;letter-spacing:.14em">Brand Values:</span>' +
      [['book', 'Educational'], ['brand', 'Elegant'], ['sparkle', 'Inspiring'], ['trending', 'Modern'], ['shieldCheck', 'Trustworthy']].map(function (b) {
        return '<span class="badge" style="background:rgba(255,255,255,.1);border-color:rgba(121, 243, 229,.3);color:#FFF">' +
          HS.icon(b[0], 13) + esc(b[1]) + '</span>';
      }).join('') +
      '<span class="script-font" style="color:var(--gold);font-size:18px;margin-left:auto">Learning Beyond Limits</span>' +
      '</div>' +

      '</div>' +

      /* ---- right: sign-in + assistant ---- */
      '<div class="home__right">' +
      '<div class="logincard">' +
      '<div class="row between">' +
      '<div><p class="logincard__welcome">Welcome to</p>' +
      '<h2 class="logincard__title">Edunex International</h2>' +
      '<p class="logincard__sub">Smart School 360 · Connected Digital Campus</p></div>' +
      HS.brandMark(42) +
      '</div>' +

      HS.brandDivider() +

      '<button class="ctxrow" data-action="not-built" data-arg="Campus and year are chosen after sign-in">' +
      HS.icon('building', 17) +
      '<span class="ctxrow__text grow">Academic Year 2026–27 &nbsp;|&nbsp; <b>Edunex International</b></span>' +
      HS.icon('chevronDown', 15) + '</button>' +

      '<div class="col g-3 mt-4">' +
      '<div class="ifield"><span class="ifield__ico">' + HS.icon('mail', 17) + '</span>' +
      '<input class="input" type="text" aria-label="Email or mobile number" placeholder="Email or mobile number" value="' + esc(role.email) + '"></div>' +

      '<div class="ifield"><span class="ifield__ico">' + HS.icon('lock', 17) + '</span>' +
      '<input class="input" type="' + (v.showPw ? 'text' : 'password') + '" aria-label="Password" placeholder="Password" value="Edunex2026">' +
      '<button class="iconbtn ifield__eye" data-action="toggle-password" aria-label="' + (v.showPw ? 'Hide password' : 'Show password') + '">' +
      HS.icon('eye', 17) + '</button></div>' +

      '<div class="row between wrap g-2">' +
      '<label class="check"><input type="checkbox" checked> Remember me</label>' +
      '<button class="t-sm t-info" data-action="not-built" data-arg="Password reset" style="color:var(--magenta)">Forgot password?</button></div>' +

      U.btn('Sign in to Campus', { variant: 'primary', block: true, action: 'do-login', iconRight: 'arrowRight' }).replace('class="btn ', 'class="btn logincard__btn ') +
      '</div>' +

      '<div class="orline mt-5">Or continue as</div>' +
      '<div class="roletiles mt-3">' + D.roles.map(function (r) {
        return '<button class="roletile" data-role="' + r.id + '" data-action="pick-login-role" data-arg="' + r.id + '" ' +
          'aria-pressed="' + (r.id === picked) + '" title="' + esc(r.person + ' · ' + r.title) + '">' +
          '<span class="roletile__ico">' + HS.icon(roleIcon[r.id], 16) + '</span>' +
          '<span class="roletile__label">' + esc(r.label.replace('Non-Teaching ', '')) + '</span></button>';
      }).join('') + '</div>' +
      '<p class="t-micro t-muted t-center mt-3">Signing in as <strong>' + esc(role.person) + '</strong> · ' + esc(role.title) + '</p>' +
      '</div>' +

      '<div class="aicard">' + mascot() +
      '<div class="grow"><div class="aicard__title">Need help entering the campus?</div>' +
      '<div class="aicard__text">Ask our AI Campus Assistant</div>' +
      '<div class="aicard__actions">' +
      U.btn('Ask AI', { variant: 'primary', size: 'sm', icon: 'sparkle', action: 'not-built', arg: 'AI campus assistant' }) +
      U.btn('Contact School', { size: 'sm', icon: 'phone', action: 'not-built', arg: 'Contact the school' }) +
      U.btn('Help', { size: 'sm', icon: 'helpCircle', action: 'open-help' }) +
      '</div></div></div>' +

      '<div class="row center"><span class="illustrative" style="background:rgba(255,255,255,.14);color:#E7E8F9">' +
      HS.icon('brand', 14) + 'Edunex International School · Growing Minds. Inspiring Futures.</span></div>' +
      '</div></div>';
  };

  HS.on('toggle-password', function () {
    var v = HS.vs('login', { showPw: false });
    v.showPw = !v.showPw;
    HS.render();
  });
})(window.HS = window.HS || {});
