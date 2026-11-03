-- =============================================================================
-- 101 ACADEMICS — term-by-term history of objective coverage and mastery.
-- learning_objectives holds only the current figures; the curriculum screen
-- plots "mastery against coverage" over the year, which needs snapshots.
-- =============================================================================

CREATE TABLE learning_objective_snapshots (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id      uuid NOT NULL REFERENCES learning_objectives(id) ON DELETE CASCADE,
  academic_year_id  uuid NOT NULL REFERENCES academic_years(id),
  term              text NOT NULL,                    -- Term 1, Term 2, Term 3, Mid Yr, Term 4
  term_order        int NOT NULL,
  coverage_pct      int NOT NULL CHECK (coverage_pct BETWEEN 0 AND 100),
  mastery_pct       int NOT NULL CHECK (mastery_pct BETWEEN 0 AND 100),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (objective_id, academic_year_id, term)
);
SELECT attach_updated_at('learning_objective_snapshots');
CREATE INDEX ix_objective_snapshots_year ON learning_objective_snapshots (academic_year_id, term_order);
