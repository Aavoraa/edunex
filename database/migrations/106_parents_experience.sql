-- =============================================================================
-- 106 PARENT EXPERIENCE — workflow and targeting columns
-- Adds what 007 cannot hold: who moved a circular through its workflow and when
-- reminders were sent, a structured audience for events, and the link between
-- an in-app message thread and the unified communication history.
-- =============================================================================

ALTER TABLE circulars
  ADD COLUMN submitted_by      uuid REFERENCES users(id),
  ADD COLUMN submitted_at      timestamptz,
  ADD COLUMN released_by       uuid REFERENCES users(id),
  ADD COLUMN channels          text[] NOT NULL DEFAULT ARRAY['whatsapp', 'push']::text[],
  ADD COLUMN last_reminded_at  timestamptz,
  ADD COLUMN reminder_count    int NOT NULL DEFAULT 0;
CREATE INDEX ix_circulars_status ON circulars (status, published_at DESC);

-- {kind: 'all' | 'grades' | 'transport', grades: [int]} — same shape as circulars.audience_filter
ALTER TABLE events
  ADD COLUMN audience_filter jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN starts_at       time,
  ADD COLUMN notified_at     timestamptz;

ALTER TABLE communications
  ADD COLUMN thread_id  uuid REFERENCES message_threads(id) ON DELETE SET NULL,
  ADD COLUMN replied_by uuid REFERENCES users(id);
CREATE INDEX ix_communications_needs_reply ON communications (occurred_at) WHERE needs_reply;
CREATE INDEX ix_communications_thread ON communications (thread_id) WHERE thread_id IS NOT NULL;

CREATE INDEX ix_ptm_sessions_date ON ptm_sessions (session_date);
CREATE INDEX ix_ptm_bookings_parent ON ptm_bookings (parent_id);
CREATE INDEX ix_circular_ack_parent ON circular_acknowledgements (parent_id);
