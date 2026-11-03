-- =============================================================================
-- 109 GROUP — policy version history, transfer completion details
-- (Per-campus staffing targets live in system_settings key 'staffing.target'.)
-- =============================================================================
CREATE TABLE group_policy_versions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id    uuid NOT NULL REFERENCES group_policies(id) ON DELETE CASCADE,
  version      text NOT NULL,
  name         text NOT NULL,
  scope        text NOT NULL,
  body         text,
  status       text NOT NULL,
  effective_on date,
  change_note  text,
  archived_by  uuid REFERENCES users(id),
  archived_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_group_policy_versions_policy ON group_policy_versions (policy_id, archived_at DESC);

ALTER TABLE group_policies ADD COLUMN updated_by uuid REFERENCES users(id);

ALTER TABLE student_transfers
  ADD COLUMN requested_by       uuid REFERENCES users(id),
  ADD COLUMN decision_note      text,
  ADD COLUMN to_section_id      uuid REFERENCES sections(id),
  ADD COLUMN from_section_id    uuid REFERENCES sections(id),
  ADD COLUMN completed_by       uuid REFERENCES users(id),
  ADD COLUMN completed_at       timestamptz;
