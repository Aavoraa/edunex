# Module development guide

How every domain module in Edunex Smart School 360 is built. Follow these
patterns exactly so the product stays one coherent system.

- **Wireframe (UI source of truth):** `wireframe/` — open `wireframe/assets/js/views/<domain>.js`
  for the screen you are building, and `wireframe/assets/js/data.js` for its data shapes.
  Preserve layout, labels, hierarchy and workflows. Replace every `demo` / `not-built`
  action with a real API call. Never render hard-coded statistics; compute from the database.
- **Schema:** `database/migrations/*.sql` (read `001`–`008` before adding anything).
- **Reference implementation:** students + tracking (backend `src/routes/students.routes.ts`,
  `src/services/students.service.ts`, `src/services/tracking.service.ts`; frontend
  `src/pages/students/*`, `src/pages/tracking/*`).

---

## 1. Ownership (parallel work)

Each module owns only its files. **Do not edit shared files** (anything under
`backend/src/config`, `backend/src/middleware`, `backend/src/utils`,
`backend/src/routes/index.ts`, `frontend/src/components/ui`, `frontend/src/layouts`,
`frontend/src/hooks`, `frontend/src/api`, `frontend/src/App.tsx`, `database/migrations/00*`,
`database/seed/core-*`). If a shared change is truly needed, describe it in your final report.

| Module | Backend routes file | Services / controllers / validators | Frontend | Seed | Migration slot | OpenAPI |
|---|---|---|---|---|---|---|
| academics | `routes/academics.routes.ts` | `*academics*` | `pages/academics/` | `seed/academics.ts` | `101_academics.sql` | `docs/openapi/paths/academics.yaml` |
| admissions | `routes/admissions.routes.ts` | `*admissions*` | `pages/admissions/` | `seed/admissions.ts` | `102_admissions.sql` | `…/admissions.yaml` |
| finance | `routes/finance.routes.ts` | `*finance*` | `pages/finance/` | `seed/finance.ts` | `103_finance.sql` | `…/finance.yaml` |
| workforce | `routes/workforce.routes.ts` | `*workforce*` | `pages/workforce/` | `seed/workforce.ts` | `104_workforce.sql` | `…/workforce.yaml` |
| safety | `routes/safety.routes.ts` | `*safety*` | `pages/safety/` | `seed/safety.ts` | `105_safety.sql` | `…/safety.yaml` |
| parents-experience | `routes/parents_experience.routes.ts` | `*parents-experience*` | `pages/parents-experience/` | `seed/parents-experience.ts` | `106_parents_experience.sql` | `…/parents-experience.yaml` |
| operations / innovation / group | `routes/{operations,innovation,group}.routes.ts` | `*operations*`, `*innovation*`, `*group*` | `pages/{operations,innovation,group}/` | `seed/{operations,innovation,group}.ts` | `107_…`, `108_…`, `109_…` | one file each |
| intelligence | `routes/intelligence.routes.ts` | `*intelligence*` | `pages/intelligence/` | `seed/intelligence.ts` | `110_intelligence.sql` | `…/intelligence.yaml` |

Name new backend files `<module>.service.ts`, `<module>.controller.ts` (optional — small
handlers may live in the routes file), `<module>.validators.ts`. Split large modules
(`finance-fees.service.ts`, `finance-expenses.service.ts`).

Only add a migration when the existing schema genuinely cannot hold the data. Use your
numbered slot, `CREATE TABLE` with uuid PK, timestamps, `SELECT attach_updated_at('table')`.

---

## 2. Backend

Express 5 (async errors propagate automatically), TypeScript ESM (import with `.js`
suffix), PostgreSQL via `pg`. Domain routers are mounted at `/api` **after**
authentication, so declare absolute paths:

```ts
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAny, requirePermission } from '../middleware/auth.js';
import { validate, v } from '../middleware/validate.js';
import { paginationSchema } from '../utils/pagination.js';
import { ok, created, paged } from '../utils/response.js';
import { notFound, badRequest } from '../utils/errors.js';
import * as svc from '../services/finance.service.js';

const r = Router();

r.get('/expenses', requirePermission('finance.read'),
  validate(paginationSchema.extend({ status: z.string().max(20).optional() }), 'query'),
  async (req: Request, res: Response) => {
    const f = v(req, 'query');
    const { rows, total } = await svc.listExpenses(f);
    return paged(res, rows, total, f.page, f.pageSize, 'Expenses retrieved');
  });

r.post('/expenses/:id/approve', requirePermission('finance.approve'),
  validate(z.object({ id: z.uuid() }), 'params'),
  async (req: Request, res: Response) => ok(res, await svc.approve(req, v(req, 'params').id), 'Expense approved'));

export default r;
```

Rules:

1. **Every route declares a permission** (`requirePermission` = all of, `requireAny` = any of).
   Permission keys live in `backend/src/config/rbac.ts` — use existing keys only.
2. **Validate every input** with Zod via `validate(schema, 'body' | 'query' | 'params')` and read
   it with `v(req, source)`. Never read `req.body`/`req.query` directly.
3. **Parameterised SQL only.** Use `query/one/many/tx` from `config/db.js` and the `Where`
   builder from `utils/sql.js`. Never interpolate user input. Sorting goes through
   `orderBy(sort, dir, ALLOWED_MAP, fallback)`; search terms through `likeTerm(q)`.
4. **Responses** use `ok / created / paged` (envelope `{ success, data, message, meta? }`).
   Errors: throw `badRequest / notFound / forbidden / conflict` from `utils/errors.js`
   (envelope `{ success:false, message, error }`). Return camelCase keys (`AS "fullName"`).
5. **Data scope.** Anything that returns student records must apply
   `studentScope(req.user!, where)` or `authorizeStudent(req, id)` from
   `services/access.service.js`. Parents/students must never see other families. Return 404
   (not 403) for records outside scope. Self-service endpoints use `req.user!.employeeId`
   / `parentId` / `studentId` — never an id from the request.
6. **Audit** every create/update/delete/approve (and reads of sensitive data) with
   `audit(req, { action, module, description, entityType, entityId })` — inside the
   transaction when there is one (`audit(req, entry, db)`).
7. **Workflows** use the shared approval vocabulary: Draft → Submitted → Under Review →
   Approved / Rejected. Record `approved_by`/`decided_by` and timestamps.
8. **Notifications:** `notifyUsers / notifyRoles / notifyGuardians` from
   `services/notification.service.js` (in-app + queued WhatsApp/SMS/Email/Push outbox; no
   external calls are made).
9. **Business codes** (`EXP-2212`, `LV-883`…): `nextCode(table, column, prefix, db)` from `utils/codes.js`.
10. Campus filter: list/summary endpoints accept optional `campusId` (uuid); absent = all campuses (group view).
11. `req.user` (type `AuthUser`, `src/types.ts`) has `id, fullName, roleKey, permissions (Set),
    employeeId, parentId, studentId, campusId`.
12. Money is `numeric(14,2)`; the pg driver returns numbers. Dates (`date`) come back as
    `'YYYY-MM-DD'` strings; `timestamptz` as `Date` → JSON ISO strings.

### OpenAPI

Document every endpoint you add in `docs/openapi/paths/<module>.yaml` — a YAML mapping of
path → operations (OpenAPI 3.0). Use `tags: [<Module>]`, `security: [{ bearerAuth: [] }]`,
and reference shared components: `$ref: '#/components/parameters/Page'`, `PageSize`, `Search`,
`Sort`, `Dir`, `CampusId`, `IdPath`; responses `'#/components/responses/Ok'`, `Paged`, `Created`,
`BadRequest`, `Unauthorized`, `Forbidden`, `NotFound`. Keep it concise:

```yaml
/expenses:
  get:
    tags: [Finance]
    summary: List expenses
    x-permission: finance.read
    parameters:
      - $ref: '#/components/parameters/Page'
      - $ref: '#/components/parameters/PageSize'
      - { name: status, in: query, schema: { type: string } }
    responses:
      '200': { $ref: '#/components/responses/Paged' }
      '403': { $ref: '#/components/responses/Forbidden' }
```

---

## 3. Seed data (sample only)

`database/seed/<module>.ts` exports `seed(db, ctx)`. It runs inside the seeding transaction
after the core seed. `ctx` (see `database/seed/context.ts`) provides ids:
`ctx.campuses.gdv.id`, `ctx.students` (array with `id, admissionNo, fullName, sectionId,
classId, gradeLevel, feeProfile, routeCode, parentId…`), `ctx.studentByNo['HS-2026-1041']`,
`ctx.employees['EMP-1021']`, `ctx.employeeByName['Ms. Priya Raghavan']`, `ctx.sections['gdv:5:A']`,
`ctx.classes['gdv:5']`, `ctx.subjects.MAT`, `ctx.routes.R12`, `ctx.users.principal|teacher|parent|office|staff|hr|finance|superadmin`,
`ctx.yearId`, `ctx.today`, and helpers `ctx.day(-3)` (date string), `ctx.at(date,'08:30')`
(timestamp), `ctx.schoolDays(from,to)`, `ctx.rand()`, `ctx.pick(arr)`, `ctx.int(a,b)`.
Use `bulkInsert(db, table, columns, rows)` from `./context.js`.

- Base the records on the wireframe's `data.js` (same names, codes, amounts, statuses),
  with dates relative to today so the data always looks current.
- Generate enough volume for charts and KPIs to be meaningful, derived from real rows.
- Never insert timestamps in the future for events that "happened".
- Everything is fictional sample data.

**Core seed already provides:** campuses, academic years, roles/permissions, demo users, 40
employees (+ teachers/non_teaching_staff), classes/sections, subjects, teacher_assignments, 53
students + enrollments + guardians + parents (65), transport vehicles/routes/stops +
student_transport + vehicle_locations + boarding_events (today), attendance_records (whole
year; Grade 5A left unmarked today), student_academic_records (6 terms × 6 subjects),
activities/student_activities, achievements, behaviour_records, student_skills, interests,
wellbeing_checkins, teacher_observations, early_warning_signals, student documents,
timeline events, infirmary_visits, counselling_sessions, tracking profiles + student_locations,
gate_events (today + last 5 days), staff_attendance (45 days), geofences, notifications, tasks,
system_settings.

---

## 4. Frontend

React 19 + React Router 7 + TanStack Query. All wireframe CSS is loaded globally; use the
same class names. Import the kit from `@/components/ui`:

`Page, PageHead, Card, Grid, Kpi, Meter, Dl, Empty, Banner, AiNotice, SectionHead, StatStrip,
Badge, Status (status→tone), Risk, Avatar, Person, StudentLink, Button, IconButton, Icon, BrandMark,
Tabs, Segment, Chips, Switch, TextField, TextArea, SelectField, FilterSelect, Checkbox, SearchInput,
DataTable, Pagination, Toolbar, BulkBar, Timeline, Feed, AlertItem, Flow, Stepper, Funnel, Ring,
Chart + charts (charts.line/bar/hbar/stacked/donut/gauge/radar/spark — same options as the
wireframe's HS.charts), Legend, Modal, useConfirm, useToast, Dropdown, Skeleton, PageSkeleton,
ErrorState, QueryState, InlineError, Illustrative`.

Hooks: `useApiQuery(path, params)`, `usePagedQuery(path, params)` (returns `{ rows, meta }`),
`useApiMutation(method, path | (vars)=>path, { invalidate: ['/expenses'], success: 'Saved' })`,
`useListParams(defaults, filterKeys)` (URL-synced search/filter/sort/page),
`useLookups()` (campuses, classes+sections, subjects, routes, staff…), `useSchool()`
(`campusParam` to pass to APIs — follows the header campus/group selector),
`useAuth()` (`user`, `can('perm' | ['a','b'])`). Formatting: `fmt` from `@/lib/format`
(`fmt.money`, `fmt.date`, `fmt.time`, `fmt.relative`, `fmt.n`, `fmt.pct`); tones from `@/lib/tones`.

Register screens in `src/pages/<module>/routes.tsx` with lazy loading:

```tsx
import { lazy } from 'react';
import type { AppRoute } from '../registry';

const ExpensesPage = lazy(() => import('./ExpensesPage'));

export const routes: AppRoute[] = [
  { path: '/expenses', perm: ['finance.read'], element: <ExpensesPage /> },
];
```

The sidebar (`src/layouts/nav.ts`) already lists every wireframe route with its permission;
use exactly those paths. Student names must always link to Student 360 via `<StudentLink id name meta />`
(route `/student-360/:id`).

A typical list page:

```tsx
export default function ExpensesPage() {
  const list = useListParams({ sort: 'date', dir: 'desc' }, ['status']);
  const { campusParam } = useSchool();
  const { can } = useAuth();
  const q = usePagedQuery<Expense>('/expenses', { ...list.query, ...campusParam });
  const approve = useApiMutation<string>('post', (id) => `/expenses/${id}/approve`, { invalidate: ['/expenses'], success: 'Expense approved' });
  return (
    <Page>
      <PageHead title="Expenses" sub="…wireframe copy…" actions={can('finance.manage') && <Button variant="primary" icon="plus" onClick={…}>New expense</Button>} />
      <div className="filterbar">
        <SearchInput value={list.q} onSearch={list.setQ} placeholder="Search expenses" />
        <FilterSelect label="Status" value={list.filters.status} onChange={(v) => list.setFilter('status', v)} options={['Submitted', 'Approved']} />
      </div>
      <Card flush>
        {q.error ? <ErrorState error={q.error} onRetry={q.refetch} /> : (
          <DataTable rows={q.data?.rows} loading={q.isLoading} rowKey={(r) => r.id} sort={list.sort} onSort={list.setSort} columns={[…]} />
        )}
        <Pagination meta={q.data?.meta} onPage={list.setPage} onPageSize={list.setPageSize} />
      </Card>
    </Page>
  );
}
```

Rules:

1. Every page handles loading (skeleton), error (`ErrorState` with retry), empty (`Empty`)
   and success (`useApiMutation` toasts) states.
2. Forms validate on the client (required fields, formats) and show server validation errors
   (`err.fieldErrors` from `ApiError`). Destructive or irreversible actions go through `useConfirm()`.
3. Hide actions the user cannot perform (`can('finance.approve')`) — the API enforces it anyway.
4. Tables: server-side search, filters, sorting and pagination for anything that can grow.
5. Responsive: use the wireframe grid classes (`grid g-4col`, `g-3col`, `g-2col`, `g-main`, `g-side`);
   tables stack into cards below 768px automatically.
6. Accessibility: labelled controls, buttons (not divs) for actions, `aria-*` from the kit.
7. No emoji as icons — use `<Icon name>` (names from `wireframe/assets/js/icons.js`).
8. AI features are advisory: show `<AiNotice />` and a Review → Edit → Approve gate.

---

## 5. Local testing for a module

Use your **own database and port** so parallel work does not collide:

```bash
# from backend/
DATABASE_URL=postgres://postgres:edunex_dev_pw@localhost:5544/edunex_<module> npm run db:reset
DATABASE_URL=postgres://postgres:edunex_dev_pw@localhost:5544/edunex_<module> PORT=<port> npx tsx --env-file=../.env src/server.ts
```

(Values in the shell override `.env`.) Sign in with
`POST /api/auth/login {"identifier":"meera.krishnan.demo@edunex.edu","password":"Edunex@2026","clientType":"mobile"}`
and call your endpoints with `Authorization: Bearer <accessToken>`. Demo identities:
principal `meera.krishnan.demo@edunex.edu`, teacher `priya.raghavan.demo@edunex.edu`,
parent `ranjith.kumar.demo@parents.edunex.edu`, office `kavitha.s.demo@edunex.edu`,
staff `murugan.p.demo@edunex.edu`, hr `lakshmi.n.demo@edunex.edu`,
finance `rajesh.iyer.demo@edunex.edu`, super admin `admin.demo@edunex.edu`.

Before finishing: `npx tsc --noEmit` in `backend/` and `npx tsc -b --noEmit` in `frontend/`
must both pass, `db:reset` must succeed, and every endpoint you added must be exercised
(including a permission-denied case).
