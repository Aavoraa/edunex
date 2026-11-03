-- =============================================================================
-- 003 TRACKING, TRANSPORT & SAFETY
-- Student GPS tracking stores SAMPLE coordinates in development. The table
-- design is production-shaped: a per-student tracking profile (consent,
-- device, status) plus an append-only location history.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Transport
-- ---------------------------------------------------------------------------
CREATE TABLE vehicles (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id        uuid NOT NULL REFERENCES campuses(id),
  bus_no           text NOT NULL,                     -- Bus 12
  registration_no  text NOT NULL UNIQUE,              -- TN 09 BX 4412
  capacity         int NOT NULL DEFAULT 40,
  gps_device_id    text UNIQUE,
  fitness_expiry   date,
  insurance_expiry date,
  status           text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'retired')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('vehicles');

CREATE TABLE transport_routes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id        uuid NOT NULL REFERENCES campuses(id),
  code             text NOT NULL UNIQUE,              -- R12
  name             text NOT NULL,                     -- Route 12
  area             text NOT NULL,
  vehicle_id       uuid REFERENCES vehicles(id),
  driver_id        uuid REFERENCES employees(id),
  attendant_id     uuid REFERENCES employees(id),
  run_status       text NOT NULL DEFAULT 'Scheduled'
                   CHECK (run_status IN ('Scheduled', 'En route', 'Delayed', 'At campus', 'Completed', 'Maintenance')),
  delay_minutes    int NOT NULL DEFAULT 0,
  eta_text         text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('transport_routes');

CREATE TABLE route_stops (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id        uuid NOT NULL REFERENCES transport_routes(id) ON DELETE CASCADE,
  sequence        int NOT NULL,
  name            text NOT NULL,
  latitude        numeric(9,6) NOT NULL,
  longitude       numeric(9,6) NOT NULL,
  pickup_time     time NOT NULL,
  drop_time       time,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (route_id, sequence)
);
SELECT attach_updated_at('route_stops');

CREATE TABLE student_transport (
  student_id   uuid PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
  route_id     uuid NOT NULL REFERENCES transport_routes(id),
  stop_id      uuid REFERENCES route_stops(id),
  mode         text NOT NULL DEFAULT 'both' CHECK (mode IN ('both', 'pickup_only', 'drop_only')),
  valid_from   date NOT NULL DEFAULT current_date,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('student_transport');
CREATE INDEX ix_student_transport_route ON student_transport (route_id);

CREATE TABLE vehicle_locations (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vehicle_id   uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  latitude     numeric(9,6) NOT NULL,
  longitude    numeric(9,6) NOT NULL,
  speed_kmph   numeric(5,1),
  heading      int,
  recorded_at  timestamptz NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_vehicle_locations_latest ON vehicle_locations (vehicle_id, recorded_at DESC);

CREATE TABLE boarding_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  route_id      uuid NOT NULL REFERENCES transport_routes(id),
  stop_id       uuid REFERENCES route_stops(id),
  event_type    text NOT NULL CHECK (event_type IN ('boarded', 'deboarded')),
  occurred_at   timestamptz NOT NULL,
  confirmed_by  uuid REFERENCES employees(id),
  method        text NOT NULL DEFAULT 'RFID' CHECK (method IN ('RFID', 'Manual', 'QR')),
  parent_notified_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_boarding_events_route_day ON boarding_events (route_id, occurred_at DESC);
CREATE INDEX ix_boarding_events_student ON boarding_events (student_id, occurred_at DESC);

-- ---------------------------------------------------------------------------
-- Student GPS tracking
-- ---------------------------------------------------------------------------
-- One row per student: consent, device and current tracking state.
CREATE TABLE student_tracking_profiles (
  student_id        uuid PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
  tracking_enabled  boolean NOT NULL DEFAULT true,
  tracking_status   text NOT NULL DEFAULT 'active'
                    CHECK (tracking_status IN ('active', 'paused', 'offline', 'disabled')),
  device_type       text NOT NULL DEFAULT 'id_card_tag' CHECK (device_type IN ('id_card_tag', 'wearable', 'bus_rfid', 'mobile_app')),
  device_id         text UNIQUE,
  consent_given_by  uuid REFERENCES parents(id),
  consent_given_at  timestamptz,
  is_sample_data    boolean NOT NULL DEFAULT false,   -- true for seeded demo coordinates
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('student_tracking_profiles');

-- Append-only location history. The latest row per student is the current location.
CREATE TABLE student_locations (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id       uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  latitude         numeric(9,6) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude        numeric(9,6) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  accuracy         numeric(7,2),                      -- metres
  location_status  text NOT NULL DEFAULT 'unknown'
                   CHECK (location_status IN ('at_home', 'in_transit', 'at_school', 'on_trip', 'unknown')),
  place_label      text,                              -- reverse-geocoded / known place name
  source           text NOT NULL DEFAULT 'device' CHECK (source IN ('device', 'bus', 'gate', 'manual', 'sample')),
  battery_pct      int CHECK (battery_pct BETWEEN 0 AND 100),
  recorded_at      timestamptz NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_student_locations_latest ON student_locations (student_id, recorded_at DESC);
CREATE INDEX ix_student_locations_recorded ON student_locations (recorded_at DESC);

-- Latest known location for every student (used by maps and dashboards)
CREATE VIEW student_current_locations AS
SELECT DISTINCT ON (l.student_id)
       l.student_id, l.id AS location_id, l.latitude, l.longitude, l.accuracy,
       l.location_status, l.place_label, l.source, l.battery_pct, l.recorded_at
  FROM student_locations l
 ORDER BY l.student_id, l.recorded_at DESC, l.id DESC;

-- Geofences (campus boundary, bus stops, safe zones) — powers tracking alerts
CREATE TABLE geofences (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id    uuid REFERENCES campuses(id),
  name         text NOT NULL,
  zone_type    text NOT NULL CHECK (zone_type IN ('campus', 'bus_stop', 'home', 'restricted')),
  latitude     numeric(9,6) NOT NULL,
  longitude    numeric(9,6) NOT NULL,
  radius_m     int NOT NULL CHECK (radius_m > 0),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('geofences');

-- ---------------------------------------------------------------------------
-- Campus safety
-- ---------------------------------------------------------------------------
CREATE TABLE gate_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  campus_id     uuid NOT NULL REFERENCES campuses(id),
  gate          text NOT NULL,                        -- Main Gate, Rear Gate
  direction     text NOT NULL CHECK (direction IN ('in', 'out')),
  method        text NOT NULL DEFAULT 'RFID' CHECK (method IN ('RFID', 'Face', 'QR', 'Manual')),
  occurred_at   timestamptz NOT NULL,
  parent_notified_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_gate_events_time ON gate_events (occurred_at DESC);
CREATE INDEX ix_gate_events_student ON gate_events (student_id, occurred_at DESC);

CREATE TABLE pickup_authorisations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id     uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  person_name    text NOT NULL,
  relation       text NOT NULL,
  phone          text,
  method         text NOT NULL,                       -- QR + Face, OTP, OTP + ID
  status         text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Verified', 'Revoked')),
  last_pickup_at timestamptz,
  approved_by_parent uuid REFERENCES parents(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('pickup_authorisations');

CREATE TABLE visitors (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id        uuid NOT NULL REFERENCES campuses(id),
  badge_no         text NOT NULL UNIQUE,              -- V-2291
  full_name        text NOT NULL,
  phone            text,
  purpose          text NOT NULL,
  host_employee_id uuid REFERENCES employees(id),
  checked_in_at    timestamptz NOT NULL,
  checked_out_at   timestamptz,
  status           text NOT NULL DEFAULT 'Inside' CHECK (status IN ('Expected', 'Inside', 'Completed', 'Denied')),
  created_by       uuid REFERENCES users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('visitors');

CREATE TABLE incidents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text NOT NULL UNIQUE,                 -- INC-0112
  campus_id     uuid NOT NULL REFERENCES campuses(id),
  incident_type text NOT NULL CHECK (incident_type IN ('Safeguarding', 'Health', 'Transport', 'Facilities', 'Security', 'Emergency')),
  summary       text NOT NULL,
  details       text,
  severity      text NOT NULL CHECK (severity IN ('Critical', 'Attention', 'Information')),
  status        text NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Under Review', 'Escalated', 'Closed')),
  student_id    uuid REFERENCES students(id),
  owner_id      uuid REFERENCES employees(id),
  occurred_on   date NOT NULL,
  is_confidential boolean NOT NULL DEFAULT false,
  created_by    uuid REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('incidents');

CREATE TABLE emergency_broadcasts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id     uuid REFERENCES campuses(id),
  alert_type    text NOT NULL,                        -- Lockdown, Evacuation, Weather, Transport
  message       text NOT NULL,
  audience      text NOT NULL,
  recipients    int NOT NULL DEFAULT 0,
  sent_by       uuid REFERENCES users(id),
  sent_at       timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE infirmary_visits (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  visited_at    timestamptz NOT NULL,
  reason        text NOT NULL,
  action_taken  text,
  outcome       text NOT NULL DEFAULT 'Under observation',
  attended_by   uuid REFERENCES employees(id),
  parent_informed boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('infirmary_visits');
CREATE INDEX ix_infirmary_student ON infirmary_visits (student_id, visited_at DESC);

CREATE TABLE counselling_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  counsellor_id uuid NOT NULL REFERENCES employees(id),
  session_on    timestamptz NOT NULL,
  reason        text NOT NULL,
  status        text NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'Completed', 'Cancelled', 'Referred')),
  notes         text,                                 -- confidential; only counsellors/principal read it
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('counselling_sessions');
