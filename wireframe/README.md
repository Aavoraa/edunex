# Edunex Smart School 360 — Clickable Wireframe

A high-fidelity, interactive wireframe for **Edunex Smart School 360**, an intelligent digital campus and student growth platform. It is built as a single connected product rather than a set of separate module mock-ups: one design system, one navigation shell, one student record that every screen links back to.

Everything is static HTML, CSS and JavaScript. There is no build step, no framework and no network dependency beyond the two web fonts.

---

## Opening it

Double-click `index.html`. That is enough for the whole prototype to work.

If you prefer to serve it (recommended when demoing, so the browser does not cache stale files):

```bash
python -m http.server 5573
```

Then open `http://localhost:5573`.

A VS Code / Claude Code launch configuration is included at `.claude/launch.json` under the name `edunex-wireframe`.

---

## What to try first

| Try this | Where | Why it matters |
|---|---|---|
| Sign in as each of the five roles | Welcome screen role tiles (sign out to change role) | Navigation, dashboard and permissions all change with the role |
| Find a page | **Find a page…** box at the top of the sidebar | Filters every section as you type; Esc clears it |
| Sign out | Profile menu, or the icon beside your name at the foot of the sidebar | Confirms first, then returns to the welcome screen and resets the prototype |
| Click any student name, anywhere | Tables, alerts, feeds, fee rows, gate logs | Every one opens the same Student 360 profile |
| Switch the campus selector to Group view | Header, left selector | Every figure in the application follows the selection |
| Walk the day | Prototype → Day in the Life (Management) | One day, followed through every role that touches it |
| Mark attendance and submit | Teacher → Attendance | Shows the automation chain that follows a single tap |
| Generate and approve an AI lesson plan | AI Teacher Co-Pilot | Shows the review → edit → approve gate on every AI output |
| Switch language | `EN` button in the header, or the pill on the welcome screen | English, தமிழ் and हिन्दी across navigation and interface chrome |
| Resize the window below 768px | Any screen | Bottom navigation, stacked cards, card-style tables |

Keyboard: **Ctrl K** focuses global search, **Esc** closes any dialog.

---

## The five roles

| Role | Signed in as | Lands on | Sees |
|---|---|---|---|
| Management | Dr. Meera Krishnan, Principal | Command Center | Everything, including the group dashboard |
| Teacher | Ms. Priya Raghavan | Teacher Dashboard | Attendance, classes, Student 360, academics, AI Co-Pilot |
| Parent | Ranjith Kumar | Parent 360 | Their child only: safety, academics, fees, communication |
| Office | Kavitha S. | Admissions | Admissions, fees, documents, HR records |
| Non-teaching staff | Murugan P. | Staff Self-Service | Their own attendance, shifts, leave and payslips |

Opening a route a role cannot reach shows an explicit access screen rather than a broken page.

The Prototype group — Day in the Life, Automation Flows, WhatsApp AI and Design System — is visible to Management only. These are demo and handoff tools that render school-wide administrative content, so they belong to whoever is presenting rather than to the role being presented.

Role scoping goes further than navigation. Notifications, My Tasks and global search are all filtered by role, so a parent sees their own child and their own fees and nothing else, and a member of staff sees their own employment and nothing else. Header controls a role cannot act on, such as the campus selector and the Co-Pilot shortcut, are not rendered for that role. Every notification, task and search result is guaranteed to point at a screen that role can actually open. Views call `HS.can(route)` before rendering a link, so the navigation model is the single source of truth and a role never sees a link it cannot follow.

### The sidebar

The sidebar is organised so that it fits on one laptop screen without scrolling:

- **Overview** is pinned at the top: the role's dashboard, the other role dashboards Management can open, Notifications and My Tasks.
- Every other module is a **collapsible section** with an icon and a page count. One section is open at a time, and the section that owns the current page opens by itself and keeps an amber marker while collapsed.
- **Find a page…** filters all sections at once and highlights the match. Typing a section name, such as *Finance*, lists that whole section.
- Each page is highlighted in exactly one place, and the current page is scrolled into view when you arrive on it. Re-rendering a page does not move the menu.
- The arrow beside the logo collapses the sidebar to a rail of section icons; clicking an icon opens the sidebar at that section. Below 1024px the sidebar becomes a drawer opened from the header.
- The Notifications and My Tasks badges show the same counts as the header bell.

A Management login shows 18 rows instead of the previous 109. Teachers see 9, Office 12, Parents 3 and non-teaching staff 4.

The avatar in the top right, and your name at the foot of the sidebar, both open the profile menu: identity, profile and account settings, notification preferences, privacy and access, help, and Sign out. There is no role switcher inside the application, which is how the real application behaves. To use a different role, sign out and pick another account on the welcome screen. It is an anchored dropdown that flips above its trigger when there is no room below and stays inside the viewport. Signing out asks for confirmation, then returns to the welcome screen and clears the session.

---

## File structure

```
index.html                  App shell, script and style loading
assets/
  css/
    tokens.css              Colour, type, space, radius, elevation, motion, z-index
    base.css                Reset, typography, layout utilities
    components.css          Cards, buttons, tables, badges, tabs, modals, charts, device frame
    layout.css              Sidebar, top header, page frame
    home.css                Public landing and sign-in screen
    responsive.css          Desktop / tablet / mobile behaviour, print
  js/
    icons.js                One stroke icon set (no emoji is used as an interface icon)
    ui.js                   Formatting, component builders, modal / drawer / toast
    charts.js               Dependency-free inline SVG charts
    i18n.js                 English / Tamil / Hindi strings
    data.js                 All illustrative sample data
    nav.js                  Sidebar model and per-role visibility
    app.js                  State, hash router, shell rendering, event delegation
    views/                  One file per domain, ~105 registered screens
      home.js               Landing page, artwork crop, sign-in
docs/
  screens.md                Screen inventory
  spec-coverage.md          Section-by-section mapping to the source brief
```

---

## How it is put together

**Routing** is hash-based. `#/student-360?id=HS-2026-1041` is a complete address. Views register themselves:

```js
HS.route('students', function (params) { return HS.ui.page(/* html */); });
```

**Interactions** are declarative. No view attaches its own listeners; one delegated handler reads `data-action` and `data-route`:

```html
<button data-action="open-student" data-arg="HS-2026-1041">Aditya Kumar</button>
```

```js
HS.on('open-student', function (id) { HS.go('#/student-360?id=' + id); });
```

**State** lives in `HS.state`, with per-screen scratch state via `HS.vs('key', defaults)`. Any change calls `HS.render()`.

**Components** come from `HS.ui`: `card`, `kpi`, `table`, `badge`, `meter`, `flow`, `stepper`, `timeline`, `funnel`, `modal`, `toast` and the rest. Screens compose these; they do not hand-roll markup. That is what keeps the product feeling like one system.

**Charts** are inline SVG generated in `charts.js`: line, bar, stacked bar, horizontal bar, donut, gauge, radar, sparkline and progress ring. No chart library, so it works offline and prints cleanly.

---

## The landing screen

`#/` before sign-in is a public landing page rather than a bare form: a hero, an illustrated campus scene with four feature cards, a stats bar, a campus-tour strip, the sign-in card and an AI assistant prompt. It is sized to fit a 1440 by 900 window without scrolling, and compresses rather than overflows on shorter windows.

**The left side is a live text hero**: the headline, a one-line summary and the statistics bar, drawn as markup so it translates with the language toggle and reflows at every width.

Selecting a role tile fills the credentials above it and relabels the caption, so the demo accounts and the form stay connected.

## Languages

Three languages ship: English, தமிழ் and हिन्दी. The header shows the active one as a two-character code and opens a menu to change it; the welcome screen offers all three as a pill.

Translation covers navigation, the twelve sidebar groups and recurring interface labels. Sample records stay in English because they are illustrative data rather than product copy. Anything without an entry falls back to English rather than showing a blank.

Adding a fourth language is one dictionary and one entry in the `LANGS` array in `assets/js/i18n.js`. Nothing else needs to change. Noto Sans Devanagari and Noto Sans Tamil are loaded alongside DM Sans so the non-Latin scripts render properly rather than relying on a system fallback.

## Design system

**Colour** — the Edunex palette, shared with the web app.

| Token | Value | Use |
|---|---|---|
| Edunex Indigo | `#3B3FD9` | Primary actions, links, focus |
| Deep Indigo | `#2F32B8` | Hover on primary actions |
| Midnight | `#1E1B4B` | Sidebar and dark shell |
| Edunex Teal | `#2DD4BF` | Accents, the active menu item |
| Teal text | `#0F766E` | Teal text on light surfaces |
| Background | `#F6F7FB` | Application ground |
| White surface | `#FFFFFF` | Cards, tables, panels |
| Charcoal | `#171717` | Headings |
| Border | `#E5E8F0` | Dividers and card edges |

Amber, red and green stay as the warning, critical and success colours.

**Type** — Playfair Display for headings and display numbers, DM Sans for interface and data. Tabular figures are used wherever numbers are compared in a column.

**Status** — six states, used identically in notifications, approvals, risk bands, compliance and transport: Critical, Attention, Caution, Information, Completed, Neutral. Colour is never the only signal; every state also carries a label.

**Approval** — anywhere authorisation is required, the same path appears: Draft → Submitted → Under Review → Approved / Rejected.

---

## Responsive behaviour

| Breakpoint | Layout |
|---|---|
| 1320px and above | Fixed 276px sidebar, four-column KPI rows, multi-column dashboards, wide tables |
| 1025–1320px | Three-column KPI rows (two below 1100px), dashboards begin to stack |
| 768–1024px | Sidebar becomes an overlay drawer opened from the header, two-column cards |
| Below 768px | Bottom navigation, single-column cards, 44px touch targets, tables become card lists, search collapses to an icon |

Parent and staff experiences are designed at 390px first and expand from there. No screen scrolls horizontally at 360px.

---

## How AI is presented

This is a deliberate position, not a visual detail:

- AI is **advisory**. It drafts, suggests and flags. It never publishes, never decides and never labels a student.
- Every AI output carries a **Review → Edit → Approve** gate with a named human approver.
- Early Warning raises a **signal**; a teacher accepts or dismisses it before an intervention exists.
- Talent Discovery shows the **evidence** behind every suggested strength, with a confidence level.
- The Knowledge assistant answers only from **approved school documents**, names its sources, and is permission-aware.

---

## Sample data

Everything is illustrative. No record is a real person, a real transaction or a real incident. Data shapes in `data.js` deliberately mirror the intended production entities, so the file doubles as a working data-model reference for development.

---

## Extending it

Add a screen:

1. Write a render function in the right `assets/js/views/*.js` file and register it with `HS.route('name', fn)`.
2. Add a nav entry in `assets/js/nav.js` with an icon and the roles that may see it.
3. Compose the screen from `HS.ui` components. If you need something that does not exist yet, add it to `components.css` and `ui.js` so the next screen can use it too.

Add a chart: extend `charts.js` and use the `--viz-1` through `--viz-8` series tokens so it stays consistent with everything else.
