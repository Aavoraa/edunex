-- =============================================================================
-- 105 SAFETY (module slot)
-- Pickup verification: one-time codes (hash only, 10-minute expiry) and the
-- collection log (collected / held). Everything else lives in 003.
-- =============================================================================

-- One-time codes sent to the registered parent to verify an authorised person.
-- Only a salted SHA-256 hash of the code is stored.
CREATE TABLE pickup_otp_challenges (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  authorisation_id  uuid NOT NULL REFERENCES pickup_authorisations(id) ON DELETE CASCADE,
  code_hash         text NOT NULL,
  expires_at        timestamptz NOT NULL,
  attempts          int NOT NULL DEFAULT 0,
  consumed_at       timestamptz,                      -- set when verified (or superseded)
  verified          boolean NOT NULL DEFAULT false,
  created_by        uuid REFERENCES users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('pickup_otp_challenges');
CREATE INDEX ix_pickup_otp_auth ON pickup_otp_challenges (authorisation_id, created_at DESC);

-- Every collection attempt at the gate: released to an authorised person, or held.
CREATE TABLE pickup_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  campus_id         uuid NOT NULL REFERENCES campuses(id),
  authorisation_id  uuid REFERENCES pickup_authorisations(id) ON DELETE SET NULL,
  person_name       text NOT NULL,
  outcome           text NOT NULL CHECK (outcome IN ('collected', 'held')),
  method            text,
  gate              text NOT NULL DEFAULT 'Main Gate',
  incident_id       uuid REFERENCES incidents(id) ON DELETE SET NULL,
  notes             text,
  recorded_by       uuid REFERENCES users(id),
  occurred_at       timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('pickup_events');
CREATE INDEX ix_pickup_events_time ON pickup_events (occurred_at DESC);
CREATE INDEX ix_pickup_events_student ON pickup_events (student_id, occurred_at DESC);
