-- =============================================================================
-- 108 INNOVATION — project evidence, mentor feedback, recorded achievements
-- =============================================================================
CREATE TABLE innovation_evidence (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid NOT NULL REFERENCES innovation_projects(id) ON DELETE CASCADE,
  milestone_id  uuid REFERENCES innovation_milestones(id) ON DELETE SET NULL,
  title         text NOT NULL,
  kind          text NOT NULL DEFAULT 'Document' CHECK (kind IN ('Photo', 'Video', 'Document', 'Test log', 'Link', 'Judging sheet')),
  link          text,                                  -- optional external reference (never a storage path)
  note          text,
  added_by      uuid REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('innovation_evidence');
CREATE INDEX ix_innovation_evidence_project ON innovation_evidence (project_id, created_at DESC);

CREATE TABLE innovation_feedback (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid NOT NULL REFERENCES innovation_projects(id) ON DELETE CASCADE,
  author_id     uuid REFERENCES employees(id),
  author_name   text NOT NULL,
  body          text NOT NULL,
  created_by    uuid REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_innovation_feedback_project ON innovation_feedback (project_id, created_at DESC);

-- Achievements recorded when a project completes the Achievement stage
CREATE TABLE innovation_project_achievements (
  project_id     uuid NOT NULL REFERENCES innovation_projects(id) ON DELETE CASCADE,
  achievement_id uuid NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, achievement_id)
);
