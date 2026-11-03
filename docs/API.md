# API usage and mobile integration

The web app and the mobile apps use **the same REST API**. Nothing is web-only.
Interactive documentation: `/api/docs` (Swagger UI) · JSON: `/api/docs/openapi.json`.

## Conventions

| Topic | Convention |
|---|---|
| Base URL | `http://localhost:4000/api` |
| Format | JSON, camelCase keys, UTF-8 |
| Dates | `YYYY-MM-DD` for dates; ISO-8601 UTC for timestamps; school timezone is Asia/Kolkata |
| Money | Numbers in INR |
| Ids | UUIDs. Student routes also accept the admission number (`HS-2026-1041`). |
| Lists | `?page=1&pageSize=25&q=&sort=&dir=asc` → `meta: { page, pageSize, total, totalPages }` |
| Campus | `?campusId=<uuid>`; omit for all campuses (where the role allows) |
| Success | `{ "success": true, "data": …, "message": "…", "meta"?: … }` |
| Error | `{ "success": false, "message": "Student not found", "error": "STUDENT_NOT_FOUND", "details"?: [{ "field", "message" }] }` |
| Status codes | 200, 201, 400 validation, 401 auth, 403 permission, 404 not found / out of scope, 409 conflict, 413, 429 rate limit, 500 |
| Client type | Send `X-Client-Type: mobile` from the apps (recorded in the audit trail) |
| Request id | Send `X-Request-Id` to correlate logs; it is echoed back |

## Mobile authentication flow

```http
POST /api/auth/login
Content-Type: application/json
X-Client-Type: mobile

{ "identifier": "+919840722110", "password": "…", "clientType": "mobile" }
```

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ…",
    "tokenType": "Bearer",
    "expiresIn": "15m",
    "refreshToken": "q3…",
    "refreshExpiresAt": "2026-09-24T06:00:00.000Z",
    "user": { "id": "…", "fullName": "Ranjith Kumar", "role": { "key": "parent", "scope": "family", "homeRoute": "/parent-360" }, "permissions": ["fees.pay_own", "parent_portal.use", "tracking.read_own_children"], "parentId": "…" }
  },
  "message": "Signed in successfully"
}
```

1. Store `refreshToken` in secure storage (Keychain / Android Keystore); keep `accessToken` in memory.
2. Call APIs with `Authorization: Bearer <accessToken>`.
3. On `401` with `error: "TOKEN_EXPIRED"`, call `POST /api/auth/refresh` with `{ "refreshToken": "…" }`,
   **replace both tokens**, and retry once. Serialise refreshes (one at a time).
4. On `REFRESH_REUSED` / `REFRESH_EXPIRED` / `REFRESH_INVALID`, clear storage and show sign-in.
5. Sign out with `POST /api/auth/logout { "refreshToken": "…" }`.
6. Register for push with `POST /api/device-tokens { "platform": "android", "token": "…" }`.

Use `user.permissions` to decide which screens to show; the API enforces the same rules.

## Parent app — typical calls

| Screen | Call |
|---|---|
| Home / child switcher | `GET /api/parents/me` |
| Child overview | `GET /api/parents/{parentId}/children/{studentId}/overview` |
| Track child | `GET /api/parents/{parentId}/children/{studentId}/location` (poll every 30–60 s) |
| Movement history | `GET /api/parents/{parentId}/children/{studentId}/location/history?date=2026-09-17&from=07:00&to=10:00` |
| Academics | `GET /api/students/{studentId}/profile` (family view) |
| Safety | `GET /api/family/children/{studentId}/safety` |
| Fees / pay | `GET /api/family/children/{studentId}/fees`, `POST …/fees/pay` |
| PTM, circulars, events, messages | `/api/family/ptm`, `/api/family/circulars`, `/api/family/events`, `/api/family/messages` |
| Notifications | `GET /api/notifications`, `GET /api/notifications/counts`, `PATCH /api/notifications/{id}/read` |
| Tasks | `GET /api/tasks` |

## Staff app — typical calls

| Screen | Call |
|---|---|
| Student list | `GET /api/students?q=&page=` |
| Student 360 | `GET /api/students/{id}/profile` |
| Tracking map | `GET /api/tracking/map?campusId=&classId=&status=` |
| Tracking list | `GET /api/tracking/students?status=offline` |
| Attendance | see the Academics section in `/api/docs` |
| Search | `GET /api/search?q=` |
| Reference data | `GET /api/lookups` (cache for the session) |

## GPS devices and integrations

Every GPS device (Android tracker app or hardware) posts to **one** endpoint with its own device
token — not a user session. The student is resolved from the device's active assignment:

```http
POST /api/v1/location
Authorization: Bearer hsd_…

{ "device_id": "GPS000123", "latitude": 11.0168, "longitude": 76.9558, "accuracy": 7.4, "battery_level": 87, "recorded_at": "2026-09-22T06:00:00Z" }
```

Devices are registered and assigned through `/api/devices` and `/api/device-assignments`
(`tracking.manage`). Full contract, status codes and firmware notes: [GPS-DEVICES.md](GPS-DEVICES.md).

Integrations that already know the student (manual entry, a bus unit posting for its riders) can
still use a service user holding only `tracking.write`, signed in with `clientType: "integration"`:

```http
POST /api/students/HS-2026-1041/location
Authorization: Bearer <token>
X-Client-Type: integration

{ "latitude": 12.8458, "longitude": 80.0625, "accuracy": 9, "batteryPct": 64, "source": "device", "recordedAt": "2026-09-17T03:01:12Z" }
```

## Example (curl)

```bash
curl -s -X POST http://localhost:4000/api/auth/login -H "Content-Type: application/json" -d "{\"identifier\":\"meera.krishnan.demo@edunex.edu\",\"password\":\"$SEED_DEMO_PASSWORD\",\"clientType\":\"mobile\"}"
```

```bash
curl -s http://localhost:4000/api/students/HS-2026-1091/location -H "Authorization: Bearer $TOKEN"
```
