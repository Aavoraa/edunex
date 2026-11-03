# Student GPS tracking

> In development every coordinate is **generated sample data** (`student_tracking_profiles.is_sample_data = true`,
> `student_locations.source = 'sample'`). No real child's location is stored.

## Data model

| Table / view | Purpose |
|---|---|
| `student_tracking_profiles` | One row per student: `tracking_enabled`, `tracking_status` (active / paused / offline / disabled), device type, who gave consent and when, sample flag. |
| `gps_devices` | Every tracker the school owns: `device_code` (GPS000123, printed on the QR label), IMEI, serial, type, firmware, `status` (available / assigned / inactive / maintenance / lost), SHA-256 `token_hash`, `last_seen_at`, last battery. |
| `device_assignments` | Which student carries which device, and when. Partial unique indexes allow **one active student per device and one active device per student**. Rows are never deleted; unassigning sets `status = 'inactive'` and `unassigned_at`. |
| `student_locations` | Append-only history: `student_id`, `device_id`, `latitude`, `longitude` (7 dp), `accuracy` (m), `altitude`, `speed` (m/s), `heading`, `location_status` (at_home / in_transit / at_school / on_trip / unknown), `place_label`, `source` (device / bus / gate / manual / sample), `battery_pct`, `recorded_at`, `created_at`. Indexed on `(student_id, recorded_at DESC)` and `(device_id, recorded_at DESC)`. |
| `student_latest_locations` | One row per student, maintained by triggers on `student_locations` (an older, buffered point never overwrites a newer one; deleting the latest point falls back to the next). Live maps read this, never the history. |
| `student_current_locations` (view) | Same columns as before, now reading `student_latest_locations`. |
| `geofences` | Campus boundaries (350 m radius in the sample data); used to classify incoming points. |
| `route_stops`, `student_transport` | The student's bus stop, used as the "home" reference until home geofences are registered. |

Two separate freshness rules:

- **Student location** — older than **30 minutes** is shown as *last known* and the student counts
  as **Offline** (`tracking.stale_after_minutes`).
- **Device connectivity (GPS status)** — from the device's last contact: **Online** under
  `ONLINE_THRESHOLD_SECONDS` (120), **Stale** up to `OFFLINE_THRESHOLD_SECONDS` (600), **Offline**
  after that, **Never** if it has not reported. Used on GPS Devices, map popups and device KPIs.

## Devices and the one location endpoint

Every device — the Android tracker app today, MCU + SIM7080G hardware later — posts to the same URL.
See [GPS-DEVICES.md](GPS-DEVICES.md) for the device side (firmware, Android setup, QR labels).

```
POST /api/v1/location
Authorization: Bearer <device token>

{ "device_id": "GPS000123", "latitude": 11.0168, "longitude": 76.9558, "accuracy": 7.4,
  "altitude": 412.5, "speed": 1.5, "heading": 120, "battery_level": 87, "recorded_at": "2026-09-22T06:00:00Z" }
→ 201 { "success": true, "device_id": "GPS000123", "student_id": "HS-2026-1041", "message": "Location received", … }
```

The API: checks the token (only its SHA-256 is stored) → finds the device → refuses devices that are
inactive / in maintenance / lost (403) → finds the **active assignment** → the student (409
`DEVICE_NOT_ASSIGNED` if none; 409 `TRACKING_DISABLED` if the student's tracking is off) → validates
coordinates and `recorded_at` (≤ 5 min ahead, ≤ 72 h old) → appends history → the trigger updates the
latest location → records `last_seen_at` and battery. A `student_id` sent by a device is ignored.
Unknown device and wrong token get the same 401, and every failure is written to the audit trail.
Accepted pings are **not** audited individually (they would swamp the audit log); the request log has them.

### Assigning devices

- **GPS Devices** (`/gps-devices`): register (token shown once), print QR labels, see online / stale /
  offline, battery and last contact, issue a new token, send for maintenance, mark lost, disable.
  Taking a device out of service ends its assignment.
- **Device Assignments** (`/device-assignments`): active and ended assignments.
- **Student 360 → Tracking** and the tracking detail: **Assign device (scan QR)** — scan the label on
  the device with the camera (or a photo of it, or type the ID/IMEI), then confirm. Moving a device
  from another student, or replacing a student's device, asks first (API: 409 `REASSIGN_REQUIRED`,
  repeat with `reassign: true`).
- Unassigning asks *“Are you sure you want to unassign GPS000123 from HS-2026-1041?”*, then ends the
  assignment and makes the device available. Locations already recorded stay with the old student.

Permissions: viewing devices needs `tracking.read_all` or `tracking.manage`; registering, assigning
and status changes need `tracking.manage` (Principal, School Admin, Super Admin).

## Recording locations without a device

`POST /api/students/:id/location` (permission `tracking.write`) remains for manual entry and
integrations that already know the student (e.g. a bus unit posting for its riders). Devices must use
`/api/v1/location`:

```json
{ "latitude": 11.0168, "longitude": 76.9558, "accuracy": 8, "batteryPct": 71, "recordedAt": "2026-09-17T05:02:00Z" }
```

- Rejected when tracking is disabled for the student, or `recordedAt` is in the future.
- `locationStatus` is optional; when omitted the API classifies the point: inside a campus
  geofence → `at_school`; within 250 m of the student's stop → `at_home`; otherwise `in_transit`.
- When a student arrives on or leaves campus, guardians receive an in-app notification
  (and queued WhatsApp/push) — not on every ping.
- Every write is audited.

## Who can see what

| Viewer | Current location | History | Endpoint(s) |
|---|---|---|---|
| Super Admin, School Admin, Principal, Management | all students | yes | `/students/:id/location`, `/students/:id/location/history`, `/tracking/*` |
| Office | all students | no | same, minus history |
| Teacher | students in their assigned sections | no | `/students/:id/location`, `/tracking/*` (scoped) |
| Parent | own children with `can_view_tracking` | last 7 days | `/parents/:parentId/children/:studentId/location[/history]` (also `/students/:id/location`, scoped) |
| Anyone else | — | — | 403 / 404 |

Every view is written to the audit trail ("Parent viewed child tracking", "Viewed tracking history", …).
Enabling, pausing or disabling tracking requires `tracking.manage` (Principal, Admins).

## Screens

### Student 360 → Student Tracking tab
Student name and ID, tracking status (● Tracking Active / Paused / Offline / Disabled),
current location on an interactive map with accuracy circle and campus geofence, latitude,
longitude, accuracy, last updated, battery, a link to OpenStreetMap, the **History** view
(for users with history access) and tracking controls (for `tracking.manage`).

### Safety & Transport → Student Tracking (CRM/Admin)
- KPI strip: students tracked live, on campus, in transit, offline.
- Search, class, section, tracking-status and location filters (kept in the URL).
- Map of all matching students (colour by location status, grey when stale) with campus
  markers and geofences; click a marker for a popup with *Open Student 360*.
- Student list: Student | Class | Status | Last Updated | Action (Track / Student 360), sortable and paginated.
- Views: map + list, map only, list only. Auto-refresh every 60 s.
- `/student-tracking/:id`: the tracking panel with **location history**.

### Location history
Date picker (plus a list of days that have data), from/to time filter, the day's path on
the map (start, recorded points, last known), total distance, point count, last known
location and a clickable timeline of points.

### Parent portal → Track
Parent Dashboard → choose child (switcher) → **Track** tab (or *Open live location* on the
home screen, or `/parent-360/track/:studentId` from a notification): child name and photo,
tracking status, current location, map, latitude, longitude, last updated time, and the
last 7 days of history. The parent's own record id is part of every URL and is checked
against the signed-in account; other children return 404.

## Sample data

- Every enabled student has a daily pattern for the previous six school days and a full
  "today" (home → in transit → campus pings every 30 minutes → home), truncated at the
  current time. Absent students stay at home.
- Special states for demonstration: Keerthi Pillai (paused), Nithya Venkatesh (offline),
  Tanya Subramani (disabled), Rithvik Menon (offline).
- Every student carries a sample ID-card tag `GPS00` + admission suffix (e.g. `GPS001041` for
  HS-2026-1041), assigned at the start of the year; device points are linked to it. Spare tags
  `GPS009001`–`GPS009006` are available and `GPS009007` is in maintenance. Sample tags have no token,
  so nothing can post as them until one is issued.
- **Aarav Kumar (HS-2026-1091)** — the brief's example — is on a field visit in Coimbatore:
  10:00 `11.0168, 76.9558` · 10:15 `11.0171, 76.9562` · 10:30 `11.0178, 76.9571` ·
  10:32 `11.0168, 76.9558`, then pings at the venue every 15 minutes until 17:30.

## Using real devices

1. Register each device on GPS Devices, load its token (hardware firmware, or the Android setup QR),
   stick the printed QR label on it, and assign it from the student's page.
2. Record guardian consent (`consent_given_by`, `consent_given_at`) before enabling.
3. Set `system_settings.tracking.sample_data` to `false` and delete sample rows
   (`DELETE FROM student_locations WHERE source = 'sample'` — the latest-location table follows
   automatically). The seeded sample tags (`is_sample_data`) have no tokens; mark them inactive or
   delete them together with their assignments.
4. Add home geofences per student if at-home detection should not rely on bus stops.
5. Consider partitioning `student_locations` by month and a retention policy
   (e.g. 90 days) — the schema and indexes already support it.
6. Optionally switch the map tiles via `MAP_TILE_URL` (and `MAP_API_KEY`) to a commercial provider.
