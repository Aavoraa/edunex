# Porting the Edunex API from Express to FastAPI — progress

Branch `feature/fastapi-api`. Source of truth for behaviour: `backend/src` (Express) and `backend/tests` (vitest).
Schema, migrations and seed stay in `database/` and are still run by `npm run db:migrate` / `db:seed` / `db:reset`.

## Status

**Routes ported: 7 of ~620 (auth). Tests ported: 24 pytest (auth + Vercel) of 163 vitest.**

| # | Module (Express files) | Routes | vitest suites to port | Status |
|---|---|---:|---|---|
| 0 | Core runtime: config/env, db, errors, response, validate, security, request id, helmet, CORS, health, cron, 404 | – | vercel.test.ts | ✅ done |
| 1 | **auth** — auth.routes, auth.controller, auth.service, token.service, audit.service, middleware/auth, rbac checks | 7 | security.test.ts › authentication, error envelope (part); api-core › authentication | ✅ done (`tests/test_auth.py`) |
| 2 | core.routes (notifications, tasks, search, lookups, audit, users, settings, documents) + documents/storage/access services, utils (pagination, sql Where, codes, csv) | 23 | api-core (admin guards, upload 400), admin-user-edit, security › “never returns password hashes”, error envelope (lookups) | ⏳ next |
| 3 | public.routes | 3 | – | ⏳ |
| 4 | students (+controller, students.service), tracking, devices (+ /v1 ingest), parents | 13+4+13+9 | students-tracking, devices, student-transport-edit, achievement-certificate, security › RBAC/parent isolation/teacher scope/audit, api-core › students, tracking consent | ⏳ |
| 5 | dashboard (+ owner-overview, dashboard.service) | 2 | – | ⏳ |
| 6 | academics (academics-*.service), syllabus, grading | 62+19 | academics-parents, grading-boards, syllabus-catalogue | ⏳ |
| 7 | admissions (admissions-*.service) | 52 | finance-hr-admissions (part) | ⏳ |
| 8 | finance (finance-fees, finance-ops) | 63 | finance-hr-admissions (part), reimbursement-receipt | ⏳ |
| 9 | workforce (workforce-*.service, paycalc, biometric /v1 ingest) | 86 | hr-letters, loss-of-pay, salary-dashboard, set-salary, finance-hr-admissions (part) | ⏳ |
| 10 | safety (safety-*.service) | 59 | safety-ops-intelligence (part) | ⏳ |
| 11 | parents_experience (circulars, comms, ptm) | 55 | circular-attachments, academics-parents (part) | ⏳ |
| 12 | operations (operations*, approvals, approvals-guard) | 41 | safety-ops-intelligence (part), school-requests | ⏳ |
| 13 | innovation, group | 34+15 | – | ⏳ |
| 14 | intelligence (intelligence-*.service, provider) | 36 | safety-ops-intelligence (part) | ⏳ |
| 15 | exam-correction, planning, jobcards, parentlog | 3+15+12+7 | exam-correction, school-requests (part) | ⏳ |
| 16 | docs.routes (Swagger UI at /api/docs from docs/openapi) | 1 | – | ⏳ |
| 17 | Cut-over: remove EXPRESS_FALLBACK_URL + `api-express` service from vercel.json, `npm run dev`/`test`/`start` → FastAPI only | – | full suite green | ⏳ |

Order rationale: auth first (everything depends on it), then core (lookups/users are used by most other tests), then
the student/tracking cluster (security tests), then the larger business modules, cut-over last.

## How it runs during the port (strangler)

- `npm run dev` starts FastAPI on :4000 (what Vite proxies `/api` to) and Express on :4001. FastAPI answers the routes it
  has; any other `/api` route is forwarded to Express (`EXPRESS_FALLBACK_URL`), so the website works at every step.
- Vercel (`vercel.json`): the `api` service is FastAPI (`backend-fastapi`, framework `fastapi`, bound to `exam-vision`);
  Express runs as `api-express`, bound into `api` as `EXPRESS_FALLBACK_URL`. **Not yet verified on a Vercel deployment.**
  Caveat: requests forwarded to Express all come from the FastAPI function, so Express's per-IP rate limit is shared.

## Conventions (keep the port mechanical)

- `app/http.py` — Express-style `Router` (`r.get(path, *middleware, handler)`, `api.use(prefix, router)`), `:param` paths,
  `validate(schema, 'body'|'query'|'params')`, `v(req, source)`. Middleware/handlers are sync `fn(req)`; a handler returns
  `ok(...)`/`created(...)`/`paged(...)` from `app/response.py`; raise `AppError` helpers from `app/errors.py`.
  `req.res.set(...)` / `req.res.cookie(...)` / `req.res.clear_cookie(...)` reach the response, error responses included.
  Uploads: multipart is parsed up front; `req.files` (list of `UploadedFile`), set `req.file` in the multer-equivalent step.
- `app/z.py` — zod-compatible validators: same chain names (`z.string().trim().min(3, 'msg')`, `z.coerce.number()`,
  `z.iso.date()`, `.optional()`, `.default()`, `.refine()`, `.extend()` …); `or`→`or_`. Missing keys stay absent in output
  (use `.get()`); `UNDEFINED` from `app/response.py` is JS `undefined`.
- `app/db.py` — `query/one/many(sql, params, db=None)`, `with tx() as db:`. SQL is copied verbatim (`$1` placeholders,
  psycopg RawCursor); params are sent untyped like node-pg; DATE→'YYYY-MM-DD', NUMERIC/INT8→numbers, UUID/INET/TIME→str,
  timestamptz→datetime (serialised like JS `toISOString()`).
- File layout mirrors `backend/src` with snake_case: `routes/<x>_routes.py`, `services/<x>_service.py`,
  `validators/<x>_validators.py`, `controllers/<x>_controller.py`. Register each router in `routes/index.py` in the
  same order as `backend/src/routes/index.ts`.
- Response keys keep their exact TS spelling (camelCase or snake_case as the SQL/TS produced them) — the frontend reads them.

## Tests

```
cd backend-fastapi
.venv\Scripts\python -m pytest            # uses TEST_DATABASE_URL (or <db>_test), like vitest.config.ts
```
Setup: `python -m venv .venv && .venv\Scripts\pip install -r requirements.txt`. The test DB must be migrated and seeded
the same way as for `npm test`.

## Log

- 2026-11-05 — Session 1: runtime core, zod-compatible validation, Express-style router, auth module, pytest suite
  (24 passing), dev script + vercel.json wiring with Express fallback. Website sign-in and page reload verified in the
  browser through FastAPI.
