# Authentication, RBAC and security

## Authentication

| Item | Implementation |
|---|---|
| Passwords | bcrypt (cost 12). Minimum 10 characters with upper, lower case and a digit on change. Reuse of the current password is refused. |
| Login | `POST /api/auth/login` with email **or** mobile number. Identical message and similar timing whether or not the account exists. |
| Lockout | 5 consecutive failures lock the account for 15 minutes. Admins can unlock (`PATCH /api/users/:id {unlock:true}`). |
| Access token | JWT HS256, 15 minutes (`JWT_ACCESS_TTL`), issuer/audience checked, claims: `sub`, `role`, `ct` (client type). Kept in memory by the web app. |
| Refresh token | 64-byte random opaque value; only an HMAC-SHA256 is stored. 7 days (`JWT_REFRESH_TTL_DAYS`). Rotated on every use. |
| Theft detection | Presenting an already-rotated refresh token revokes the whole token family (all descendants). |
| Web delivery | Refresh token in an `httpOnly`, `SameSite=Strict`, `Path=/api/auth` cookie (`Secure` when `COOKIE_SECURE=true`). |
| Mobile delivery | Refresh token in the JSON body; store it in Keychain / Keystore. |
| Sessions | `GET /api/auth/sessions` lists devices; `POST /api/auth/sessions/revoke-all` signs out everywhere; password change and role change revoke all sessions. |
| Account state | Suspended or deleted accounts are rejected on every request (the user is re-loaded per request). |

## Role-based access control

Permissions (`backend/src/config/rbac.ts`) are stored in `permissions` and granted to roles
through `role_permissions`. The API checks **permissions**, never role names, on every
route (`requirePermission` / `requireAny`). The web app hides what the user cannot do, but
that is convenience only.

Each role also has a **data scope**, applied inside services (`access.service.ts`):

| Scope | Roles | Rule |
|---|---|---|
| school | Super Admin, School Admin, Management, Principal, HR, Finance, Office | All records (optionally one campus) |
| class | Teacher | Students in sections the teacher teaches (`teacher_assignments`) or is class teacher of |
| family | Parent | Only children linked through `student_guardians`; tracking additionally requires `can_view_tracking` |
| self | Non-teaching staff, Student | Only their own employee / student record |

Records outside scope return **404**, not 403, so their existence is not disclosed.

| Role | Summary of permissions |
|---|---|
| Super Admin | Everything |
| School Admin | Everything except the family/student portal permissions |
| Management | Read-only dashboards, reports, students, tracking (incl. history), finance, HR, operations, audit |
| Principal | Management + approvals (finance, HR, payroll), early warning, tracking management, broadcasts |
| Teacher | Assigned students, attendance marking, academics, assessments, early warning, AI co-pilot, tracking of assigned students (no history) |
| HR | Employees, attendance, leave, CPD, payroll preparation and approval of HR items |
| Finance | Fees, payments, concessions, expenses, approvals, reconciliation |
| Office | Admissions/CRM, student records, parents, fees, documents, front-office safety, current student locations (no history) |
| Non-Teaching Staff | Self-service; safety & transport duties |
| Parent | Parent portal, own children's tracking, own fee payments |
| Student | Own profile |

Administrators can change a role's permissions at **Administration → Users & Roles**; the
change applies within 30 seconds (permission cache) and is audited. Super Admin cannot be
edited; only a Super Admin can grant Super Admin.

## Protections

| Threat | Control |
|---|---|
| SQL injection | Every query is parameterised; dynamic `ORDER BY` uses allow-lists; identifiers in helpers are regex-checked. Tested with a malicious `sort` value. |
| Invalid input | Zod validation on body, query and params for every route; errors return field-level details. |
| XSS | React escapes output; API sanitiser strips control characters and prototype-pollution keys; strict CSP from helmet (API) and a narrow CSP when the API serves the SPA. |
| CSRF | The only cookie is the refresh cookie: `SameSite=Strict`, scoped to `/api/auth`, and API calls require a Bearer header that cookies cannot supply. |
| Brute force / abuse | Rate limits: 3,000 requests per 15 min per IP overall (configurable; schools often share one public IP), 20 per 15 min on credential endpoints; account lockout. |
| Transport / headers | helmet (HSTS, nosniff, frameguard, referrer policy, CSP), `x-powered-by` removed, `Cache-Control: no-store` on API responses. |
| CORS | Explicit origin allow-list (`CORS_ORIGINS`); requests without an Origin (mobile, server) are allowed and still require a token. |
| File uploads | Allow-listed types (PDF, PNG, JPEG, WebP) verified by magic bytes, 10 MB limit, random file names outside any web root, SHA-256 stored, downloads only through authorised, audited endpoints with `Content-Disposition: attachment`. |
| Secrets | Loaded from the environment and validated at start-up (JWT secrets must be ≥ 32 chars). `.env` is git-ignored; `.env.example` has no values. Logs redact authorization headers, cookies and passwords. |
| Sensitive data | Wellbeing/counselling notes require `students.sensitive`; internal staff notes are removed from family views; location history for parents is limited to 7 days. |
| Data changes | Soft delete for master records; production refuses `db:reset` and sample seeding. |

## Audit log

`audit_logs` records: user, name, role, action, module, entity, description, IP, user agent,
device (`web`/`mobile`/`integration`), metadata and timestamp. Examples written by the system:

- "Updated student profile HS-2026-1041 (house, riskLevel)"
- "Parent viewed child tracking (HS-2026-1041)"
- "Viewed tracking history"
- "Recorded student location"
- "Changed tracking settings (disabled, disabled)"
- "Failed sign-in attempt"

View it at **Operations → Audit Trail** (`audit.read`) or `GET /api/audit-logs`.

## Tests

`backend/tests/security.test.ts` covers missing/tampered tokens, account enumeration,
cookie flags, refresh rotation and reuse detection, permission denials per role, parent
isolation across every student route, teacher scoping, validation, error envelopes,
security headers and audit entries. Run `npm run test:db && npm test`.
