-- =============================================================================
-- 110 GPS DEVICES — device registry, student ↔ device assignments, device
-- authentication and a maintained latest-location table.
--
-- A device identifies itself with its device_code and a secret token; the API
-- resolves the student from the device's ACTIVE assignment. A student id sent
-- by a device is never trusted.
-- =============================================================================

CREATE TABLE gps_devices (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_code      text NOT NULL UNIQUE CHECK (device_code ~ '^[A-Z0-9][A-Z0-9-]{2,49}$'),  -- GPS000123 (printed on the QR label)
  imei             text UNIQUE,
  serial_number    text UNIQUE,
  device_type      text NOT NULL DEFAULT 'gps_tracker'
                   CHECK (device_type IN ('gps_tracker', 'id_card_tag', 'wearable', 'mobile_app')),
  firmware_version text,
  campus_id        uuid REFERENCES campuses(id),
  status           text NOT NULL DEFAULT 'available'
                   CHECK (status IN ('available', 'assigned', 'inactive', 'maintenance', 'lost')),
  -- SHA-256 of the device token. The token itself is shown once and never stored.
  token_hash       text UNIQUE,
  token_issued_at  timestamptz,
  last_seen_at     timestamptz,
  last_battery_pct int CHECK (last_battery_pct BETWEEN 0 AND 100),
  last_ip          text,
  notes            text,
  is_sample_data   boolean NOT NULL DEFAULT false,
  created_by       uuid REFERENCES users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('gps_devices');
CREATE INDEX ix_gps_devices_status ON gps_devices (status);

-- History of which student carried which device. Rows are never deleted.
CREATE TABLE device_assignments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id       uuid NOT NULL REFERENCES students(id),
  device_id        uuid NOT NULL REFERENCES gps_devices(id),
  status           text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  assigned_at      timestamptz NOT NULL DEFAULT now(),
  assigned_by      uuid REFERENCES users(id),
  unassigned_at    timestamptz,
  unassigned_by    uuid REFERENCES users(id),
  unassign_reason  text,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'active') = (unassigned_at IS NULL))
);
-- One active student per device, and one active device per student.
CREATE UNIQUE INDEX ux_device_assignments_active_device ON device_assignments (device_id) WHERE status = 'active';
CREATE UNIQUE INDEX ux_device_assignments_active_student ON device_assignments (student_id) WHERE status = 'active';
CREATE INDEX ix_device_assignments_student ON device_assignments (student_id, assigned_at DESC);
CREATE INDEX ix_device_assignments_device ON device_assignments (device_id, assigned_at DESC);

-- ---------------------------------------------------------------------------
-- Location history: which device sent each point, plus motion fields.
-- Coordinates widen to 7 decimal places (~1 cm), as devices report.
-- ---------------------------------------------------------------------------
DROP VIEW student_current_locations;

ALTER TABLE student_locations
  ALTER COLUMN latitude  TYPE numeric(10,7),
  ALTER COLUMN longitude TYPE numeric(10,7),
  ADD COLUMN device_id uuid REFERENCES gps_devices(id),
  ADD COLUMN altitude  numeric(10,2),
  ADD COLUMN speed     numeric(8,2) CHECK (speed >= 0),                  -- m/s
  ADD COLUMN heading   numeric(5,2) CHECK (heading >= 0 AND heading < 360);
CREATE INDEX ix_student_locations_device ON student_locations (device_id, recorded_at DESC) WHERE device_id IS NOT NULL;

-- Latest point per student, kept up to date by a trigger so live maps never
-- scan the history table. An out-of-order (older) point never overwrites it.
CREATE TABLE student_latest_locations (
  student_id       uuid PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
  location_id      bigint NOT NULL,
  device_id        uuid REFERENCES gps_devices(id),
  latitude         numeric(10,7) NOT NULL,
  longitude        numeric(10,7) NOT NULL,
  accuracy         numeric(7,2),
  altitude         numeric(10,2),
  speed            numeric(8,2),
  heading          numeric(5,2),
  location_status  text NOT NULL,
  place_label      text,
  source           text NOT NULL,
  battery_pct      int,
  recorded_at      timestamptz NOT NULL,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION upsert_student_latest_location() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO student_latest_locations AS cur
    (student_id, location_id, device_id, latitude, longitude, accuracy, altitude, speed, heading,
     location_status, place_label, source, battery_pct, recorded_at, updated_at)
  VALUES
    (NEW.student_id, NEW.id, NEW.device_id, NEW.latitude, NEW.longitude, NEW.accuracy, NEW.altitude, NEW.speed, NEW.heading,
     NEW.location_status, NEW.place_label, NEW.source, NEW.battery_pct, NEW.recorded_at, now())
  ON CONFLICT (student_id) DO UPDATE SET
    location_id = EXCLUDED.location_id, device_id = EXCLUDED.device_id,
    latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, accuracy = EXCLUDED.accuracy,
    altitude = EXCLUDED.altitude, speed = EXCLUDED.speed, heading = EXCLUDED.heading,
    location_status = EXCLUDED.location_status, place_label = EXCLUDED.place_label, source = EXCLUDED.source,
    battery_pct = EXCLUDED.battery_pct, recorded_at = EXCLUDED.recorded_at, updated_at = now()
  WHERE (EXCLUDED.recorded_at, EXCLUDED.location_id) >= (cur.recorded_at, cur.location_id);
  RETURN NULL;
END $$;

CREATE TRIGGER trg_student_locations_latest
  AFTER INSERT ON student_locations
  FOR EACH ROW EXECUTE FUNCTION upsert_student_latest_location();

-- When the latest point is deleted (sample clean-up, retention), fall back to
-- the newest remaining one — or to nothing.
CREATE FUNCTION refresh_student_latest_location() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM student_latest_locations cur
   USING (SELECT DISTINCT student_id FROM deleted_rows) d
   WHERE cur.student_id = d.student_id
     AND NOT EXISTS (SELECT 1 FROM student_locations l WHERE l.id = cur.location_id);
  INSERT INTO student_latest_locations
    (student_id, location_id, device_id, latitude, longitude, accuracy, altitude, speed, heading,
     location_status, place_label, source, battery_pct, recorded_at)
  SELECT DISTINCT ON (l.student_id)
         l.student_id, l.id, l.device_id, l.latitude, l.longitude, l.accuracy, l.altitude, l.speed, l.heading,
         l.location_status, l.place_label, l.source, l.battery_pct, l.recorded_at
    FROM student_locations l
   WHERE l.student_id IN (SELECT DISTINCT student_id FROM deleted_rows)
     AND NOT EXISTS (SELECT 1 FROM student_latest_locations cur WHERE cur.student_id = l.student_id)
   ORDER BY l.student_id, l.recorded_at DESC, l.id DESC;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_student_locations_latest_delete
  AFTER DELETE ON student_locations
  REFERENCING OLD TABLE AS deleted_rows
  FOR EACH STATEMENT EXECUTE FUNCTION refresh_student_latest_location();

INSERT INTO student_latest_locations
  (student_id, location_id, device_id, latitude, longitude, accuracy, altitude, speed, heading,
   location_status, place_label, source, battery_pct, recorded_at)
SELECT DISTINCT ON (student_id)
       student_id, id, device_id, latitude, longitude, accuracy, altitude, speed, heading,
       location_status, place_label, source, battery_pct, recorded_at
  FROM student_locations
 ORDER BY student_id, recorded_at DESC, id DESC;

-- Same name and leading columns as before, so existing queries keep working.
CREATE VIEW student_current_locations AS
SELECT l.student_id, l.location_id, l.latitude, l.longitude, l.accuracy,
       l.location_status, l.place_label, l.source, l.battery_pct, l.recorded_at,
       l.device_id, l.altitude, l.speed, l.heading
  FROM student_latest_locations l;

-- ---------------------------------------------------------------------------
-- Move the free-text device id on tracking profiles into real device records
-- with an active assignment, then retire the column.
-- ---------------------------------------------------------------------------
ALTER TABLE student_tracking_profiles DROP CONSTRAINT IF EXISTS student_tracking_profiles_device_type_check;
ALTER TABLE student_tracking_profiles
  ADD CONSTRAINT student_tracking_profiles_device_type_check
  CHECK (device_type IN ('id_card_tag', 'wearable', 'bus_rfid', 'mobile_app', 'gps_tracker'));

INSERT INTO gps_devices (device_code, device_type, campus_id, status, is_sample_data, last_seen_at)
SELECT upper(regexp_replace(tp.device_id, '[^A-Za-z0-9-]', '', 'g')),
       CASE tp.device_type WHEN 'wearable' THEN 'wearable' WHEN 'mobile_app' THEN 'mobile_app' ELSE 'id_card_tag' END,
       s.campus_id, 'assigned', tp.is_sample_data, l.recorded_at
  FROM student_tracking_profiles tp
  JOIN students s ON s.id = tp.student_id
  LEFT JOIN student_latest_locations l ON l.student_id = tp.student_id
 WHERE tp.device_id IS NOT NULL
   AND upper(regexp_replace(tp.device_id, '[^A-Za-z0-9-]', '', 'g')) ~ '^[A-Z0-9][A-Z0-9-]{2,49}$'
ON CONFLICT (device_code) DO NOTHING;

INSERT INTO device_assignments (student_id, device_id, status, assigned_at, notes)
SELECT tp.student_id, d.id, 'active', COALESCE(tp.consent_given_at, tp.created_at), 'Migrated from tracking profile'
  FROM student_tracking_profiles tp
  JOIN gps_devices d ON d.device_code = upper(regexp_replace(tp.device_id, '[^A-Za-z0-9-]', '', 'g'))
 WHERE tp.device_id IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE student_tracking_profiles DROP COLUMN device_id;
