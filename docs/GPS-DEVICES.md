# GPS devices — setup and integration

How a tracker gets from the box to sending locations, for the Android prototype and for dedicated
hardware (MCU + SIM7080G + GPS). The server side is described in [TRACKING.md](TRACKING.md).

```
Device ──HTTPS──► POST /api/v1/location ──► token → device → ACTIVE assignment → student ──► PostgreSQL
                       (one URL for all)                                                     ├ student_locations (history)
                                                                                             └ student_latest_locations (live map)
```

## What a device holds

| Item | Example | Where it comes from | Secret? |
|---|---|---|---|
| Endpoint | `<server-address>/api/v1/location` | Same for every device | No |
| Device ID | `GPS000123` | GPS Devices → Register device | No — printed on the QR label |
| Device token | `hsd_4k9…` (47 chars) | Shown **once** at registration (or *Issue new token*) | **Yes** |

## 1. Register and label

1. **Safety & Transport → GPS Devices → Register device.** Leave *Device ID* blank to get the next
   `GPSnnnnnn`, or type the manufacturer's ID. IMEI and serial are optional but let staff find the
   device by scanning the manufacturer's own sticker.
2. The token window opens once. Load the token into the device now (below). If it is lost, use
   *Issue new token* on the device — the old one stops working immediately.
3. **Print labels** (whole list, or one device from its detail). Each label carries a QR of the
   **device ID only** plus the ID in text. The token is never printed.

## 2. Assign to a student

Student 360 → Tracking (or the tracking detail) → **Assign device (scan QR)**, or **Device
Assignments → Assign device**:

- Scan the label with the camera (phone or laptop; needs https). No camera or a Windows browser
  without a barcode detector? Use **Photo of label**, or type the ID / IMEI.
- The QR may contain the plain ID, `HSDEV:GPS000123`, a URL ending in the ID, the IMEI or the serial.
- If the device is with another student, or the student already has one, you are asked before the
  old assignment is ended. Only devices that are *available* or *assigned* can be assigned.

## 3a. Android phone (prototype)

The Edunex app has a **GPS Tracker mode** — no user sign-in needed on the phone.

1. Register the device with type **Android phone**. In the token window choose **Android phone setup**.
2. On the phone: open the app → **Use this phone as a GPS tracker** → **Scan setup QR**, and scan the
   code on the admin's screen. (The phone's own camera app works too: the QR is a
   `edunex-tracker:setup?…` link that opens the app.) *Enter details manually* is the fallback.
3. **Show device QR** on the phone displays its device ID — scan it on the student's page to assign.
4. **START TRACKING.** Allow location and notifications. A foreground service (ongoing notification
   with a *Stop* action) sends the newest fix every 30 s (15 s – 2 min selectable; the server's
   `next_interval_seconds` overrides it).
5. Settings → Apps → Edunex 360 → Battery → **Unrestricted**, or the OS may pause tracking.

Behaviour: points that cannot be sent (no signal) wait in an encrypted queue (up to ~2,000) and are
sent oldest-first later; the server keeps them in history without moving the live marker backwards.
A 401 (token revoked) stops tracking and asks for a new setup QR. 409 / 403 answers (not assigned,
tracking off, device disabled) are shown on screen and the point is dropped. Tracking resumes when the
app is reopened; it does not restart by itself after a reboot.

**Tracker app v2 — scan the label to connect:** in the stand-alone tracker app, *Scan device QR* on
the device label, an administrator signs in once on the phone (the token is issued directly to the
phone; the admin is signed out afterwards), then picks the student. The app's dashboard reads
`GET /api/v1/device/status` (device token) for the assigned student, today's points and distance and
the server's view of the device.

**Dedicated tracker phones:** the stand-alone *Edunex GPS Tracker* app (`mobile/android/tracker`)
uses the same setup QR and also resumes after a reboot (with location allowed *all the time*),
keeps sending with the screen off, and shows satellites, a *Send now* button and a send log for testing.
See [mobile/README.md](../mobile/README.md#stand-alone-gps-tracker-app-tracker-module).

## 3b. Dedicated hardware (MCU + SIM7080G + GPS)

The device does exactly what the phone does: HTTPS POST, JSON body, bearer token.

```http
POST /api/v1/location HTTP/1.1
Host: <server-address>
Authorization: Bearer hsd_…
Content-Type: application/json

{"device_id":"GPS000123","latitude":11.0168000,"longitude":76.9558000,"accuracy":7.4,
 "speed":1.5,"heading":120,"battery_level":87,"recorded_at":"2026-09-22T06:00:00Z"}
```

| Field | Required | Notes |
|---|---|---|
| `device_id` | yes | As registered (capitals, digits, hyphens) |
| `latitude`, `longitude` | yes | Decimal degrees, JSON numbers (not strings) |
| `accuracy` | recommended | Metres (HDOP × ~5 if the module gives no accuracy) |
| `altitude`, `speed`, `heading` | optional | m, **m/s** (convert from km/h ÷ 3.6 or knots × 0.514), degrees 0–360 |
| `battery_level` | recommended | 0–100 |
| `recorded_at` | recommended | UTC ISO-8601 from the GNSS fix time. Omit → server time. |

Unknown extra fields (`satellites`, `hdop`, …) are ignored.

**Responses to handle in firmware**

| Status | Meaning | Firmware action |
|---|---|---|
| 201 | Stored. Body has `next_interval_seconds` | Drop the point; adopt the interval |
| 400 | Bad value or timestamp too old/future | Drop the point; check the clock |
| 401 | Token wrong or revoked | Stop sending; needs re-provisioning |
| 403 | Device disabled / maintenance / lost | Send rarely (e.g. hourly) |
| 409 | Not assigned, or tracking off | Drop the point; retry slowly |
| 429 | More than 30 requests/min | Back off |
| 5xx / no network | Server or network problem | Keep the point, retry with backoff |

**SIM7080G outline (AT commands, HTTPS)** — adapt APN, timeouts and error handling to your firmware:

```
AT+CNACT=0,1                          // open PDP context (APN set via AT+CGDCONT beforehand)
AT+CSSLCFG="sslversion",1,3           // TLS 1.2
AT+SHSSL=1,""                         // use TLS on the HTTP session (load a CA with AT+CSSLCFG="convert" to verify)
AT+SHCONF="URL","<server-address>"
AT+SHCONF="BODYLEN",1024
AT+SHCONF="HEADERLEN",350
AT+SHCONN
AT+SHCHEAD
AT+SHAHEAD="Content-Type","application/json"
AT+SHAHEAD="Authorization","Bearer hsd_…"
AT+SHBOD=<len>,10000                  // then send the JSON body
AT+SHREQ="/api/v1/location",3         // 3 = POST → +SHREQ: "POST",201,<len>
AT+SHREAD=0,<len>                     // read the JSON reply
AT+SHDISC
```

GNSS on the SIM7080G shares the RF path with LTE-M/NB-IoT: take the fix (`AT+CGNSPWR=1`,
`AT+CGNSINF`), power GNSS down, then bring up the data session. Keep the token in protected flash;
never log it.

## Testing a device without hardware

```bash
curl -i https://<server>/api/v1/location \
  -H "Authorization: Bearer hsd_…" -H "Content-Type: application/json" \
  -d '{"device_id":"GPS000123","latitude":11.0168,"longitude":76.9558,"accuracy":7.4}'
```

The automated scenario in `backend/tests/devices.test.ts` covers the brief's mandatory test:
register GPS000123 → assign to student 1 → send → unassign → assign to student 2 → send → the new
point belongs to student 2 and student 1's point is unchanged; plus authentication, validation,
buffered points, reassignment confirmation, QR lookup and permissions.

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `LOCATION_INTERVAL_SECONDS` | 30 | Returned to devices as `next_interval_seconds` |
| `ONLINE_THRESHOLD_SECONDS` | 120 | Last contact newer than this → Online |
| `OFFLINE_THRESHOLD_SECONDS` | 600 | Older than this → Offline (between the two → Stale) |
| `LOCATION_MAX_FUTURE_SECONDS` | 300 | Allowed device clock drift |
| `LOCATION_MAX_AGE_HOURS` | 72 | Oldest buffered point accepted |
| `DEVICE_RATE_LIMIT_PER_MINUTE` | 30 | Per device on `/api/v1/location` |

No extra secret is needed for device tokens: each is 256 random bits, and only its SHA-256 is stored.
