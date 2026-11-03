-- =============================================================================
-- 107 OPERATIONS — room / facility bookings
-- Weekly utilisation on the Facilities screen is computed from these rows.
-- =============================================================================
CREATE TABLE facility_bookings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id  uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  booked_on    date NOT NULL,
  starts_at    time NOT NULL,
  ends_at      time NOT NULL,
  purpose      text NOT NULL,
  status       text NOT NULL DEFAULT 'Booked' CHECK (status IN ('Booked', 'Cancelled')),
  booked_by    uuid REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
SELECT attach_updated_at('facility_bookings');
CREATE INDEX ix_facility_bookings_day ON facility_bookings (facility_id, booked_on) WHERE status = 'Booked';
CREATE INDEX ix_inventory_movements_item ON inventory_movements (item_id, created_at DESC);
