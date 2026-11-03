# Spec coverage

Section-by-section mapping from the master brief to what exists in the prototype.

| # | Brief section | Where it lives | Notes |
|---|---|---|---|
| 1 | Design direction | `assets/css/*`, `#/design-system` | Navy / amber / teal on a cool neutral ground, Playfair + DM Sans, rounded cards, subtle borders, spacious enterprise layout |
| 2 | Application structure | `assets/js/nav.js` | All twelve sidebar groups and every listed item, plus a Prototype group |
| 3 | Top header | `assets/js/app.js` | Logo, campus selector, academic year, global search, AI Assistant, notifications, help, EN/தமிழ், profile, role indicator |
| 4 | Management Command Center | `#/command-center` | Eight KPI cards, Today's Attention panel, four attendance analytics views, student intelligence bands, admissions funnel, live activity feed |
| 5 | Student 360 | `#/student-360` | Profile card, eleven tabs, growth timeline, AI Talent Discovery with per-strength evidence |
| 6 | Early Warning | `#/early-warning` | Filters, three risk cards, student table, signal-to-closure workflow, teacher review dialog |
| 7 | Teacher dashboard | `#/teacher` | Classes, timetable, watchlist, tasks, homework status |
| 7 | One-tap attendance | `#/attendance` | Present / Late / Absent per student, bulk mark, save confirmation, automation chain, offline note |
| 8 | AI Teacher Co-Pilot | `#/copilot` | Six quick actions, Grade 6 → Mathematics → Fractions worked example, Review → Edit → Approve gate |
| 9 | Academics | `#/curriculum` `#/timetable` `#/assessments` `#/report-cards` `#/objectives` `#/subjects` `#/classes` `#/lesson-plans` `#/homework` `#/question-bank` | Cambridge stages, day × period grid with conflicts and substitute suggestions, marks entry, moderation, predicted grades, six-stage report card workflow |
| 10 | Admissions CRM | `#/admissions` `#/leads` `#/pipeline` `#/applications` `#/visits` `#/conversion` | Nine-stage pipeline, lead profile with communication history, all seven sources, cost per admission |
| 11 | WhatsApp AI assistant | `#/whatsapp-ai` | The IGCSE conversation from the brief with quick-reply buttons, and the CRM record it creates alongside |
| 12 | Parent 360 app | `#/parent-360` | Mobile-first app with Home / Academics / Safety / Fees / More, child selector, safe arrival, bus tracking, Pay Now, PTM booking |
| 13 | Smart Gate & child safety | `#/smart-gate` `#/gate-log` `#/pickup` `#/visitors` `#/emergency` `#/safeguarding` | Arrived / Inside / Exited, live feed, OTP and QR pickup verification, unauthorised alert, visitor badges, emergency broadcast with audit trail |
| 14 | Bus GPS / transport | `#/bus-tracking` `#/routes` `#/boarding` | Route list with driver, attendant, onboard count and ETA; live map with deviation alert; boarding and de-boarding confirmations |
| 15 | Fees & finance | `#/fees` and eleven further finance screens | KPIs, four chart views, student ledger across all charge heads, UPI / Card / Net Banking, Pay Now → success → receipt → WhatsApp receipt, concessions, scholarships, expenses, reimbursements, allowances, budgets, reconciliation |
| 16 | Workforce 360 | `#/workforce` and eleven further workforce screens | Teaching and non-teaching in one ecosystem, all seven employee categories, full employee journey through to payslip |
| 17 | Payroll | `#/payroll` `#/payslips` | Dashboard, seven-stage workflow, preview by category, approval gate, payslip with earnings and deductions |
| 18 | School CRM | `#/parent-directory` `#/alumni` `#/vendors` | Parents, alumni, vendors, partners and institutions with one communication history across WhatsApp, email, SMS, calls and notes |
| 19 | Operations & compliance | `#/assets` `#/facilities` `#/maintenance` `#/inventory` `#/documents` `#/certificates` `#/compliance` `#/audit` | Asset register, maintenance requests, QR-verified certificates, compliance calendar with owners, audit trail that logs reads as well as writes |
| 20 | Student Innovation Lab | `#/innovation` and six further screens | Idea → Review → Mentor → Project → Prototype → Competition → Achievement, project page with milestones, evidence, feedback and judging |
| 21 | School Knowledge AI | `#/knowledge-ai` | All three example questions answered, with named sources, confidence and permission-aware behaviour |
| 22 | Multi-campus group dashboard | `#/group-dashboard` `#/campuses` `#/campus-comparison` `#/transfers` `#/group-policies` | All three campuses, eight comparison measures, Group View / Campus View toggle |
| 23 | Notification center | `#/notifications` | Critical / Attention / Information / Completed, every example category from the brief |
| 24 | Global search | Header, every screen | Students, parents, employees, admissions, documents, fees, classes and reports, grouped by type |
| 25 | Role-based access | `assets/js/nav.js`, `app.js`, `data.js` | Five roles, each with its own navigation, dashboard and explicit access boundaries. Notifications, My Tasks and global search are filtered per role; header controls a role cannot use are not rendered |
| 26 | Automation flows | `#/automations` | All five chains rendered as sequences, plus a panel naming exactly where a person always intervenes |
| 27 | Day in the life | `#/day-in-life` | The four brief moments plus eight more through to end-of-day reporting, on an interactive timeline |
| 28 | Approval & workflow | Everywhere, `#/my-tasks` | Draft → Submitted → Under Review → Approved / Rejected, used identically across all eight listed cases |
| 29 | Responsive design | `assets/css/responsive.css` | Desktop, tablet and mobile layouts; parent and staff experiences are mobile-first |
| 30 | Prototype interactions | Throughout | Navigation, dropdowns, search, filters, tabs, modals, drill-down, table sorting, bulk selection, approvals, toasts, AI chat, role switching, campus switching, EN/தமிழ், mobile navigation. Clicking any student anywhere opens Student 360 |
| 31 | Design priority | All twenty screens built | See `docs/screens.md` |
| 32 | Login screen | Login | Branding and tagline on the left, role picker and credentials on the right, language selector, role-specific routing after sign-in |
| 33 | Final product experience | `#/design-system`, `#/day-in-life`, `#/automations` | One design system, one component kit, and two screens that exist specifically to show the connections between modules |

## Deliberate boundaries

These are intentionally not built, and are marked in the interface when a user reaches them:

- Drag-and-drop between admissions pipeline stages. Stage changes are made from the lead profile instead.
- Free-text editing of AI drafts. The editor is shown with its states agreed; the text area is not wired to a model.
- Real payment processing, file upload and document viewing.
- Persistence. Reloading the page resets to the starting state, which is the right behaviour for repeated demonstrations.

Nothing outside the supplied requirements has been added.
