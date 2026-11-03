-- =============================================================================
-- 126 MATRICULATION SYLLABUS AND LEARNING OUTCOMES — the IGCSE syllabus and
-- Cambridge objectives features, per board.
--
-- syllabuses.board: a syllabus belongs to Cambridge IGCSE (Grades 8–10, as
-- before) or Tamil Nadu Matriculation (any standard 1–12, e.g. Mathematics —
-- Std IX, with its textbook units as topics and theory / practical papers as
-- components). Its topic coverage and assessments use classes on the same board.
--
-- learning_objectives.board: Cambridge objectives (igcse) and Matriculation
-- learning outcomes (matriculation) share one table and are tracked the same
-- way (coverage, mastery, lesson plans).
--
-- Existing rows stay on IGCSE.
-- =============================================================================
ALTER TABLE syllabuses ADD COLUMN board text NOT NULL DEFAULT 'igcse'
  REFERENCES grade_scales(board) ON UPDATE CASCADE;
CREATE INDEX ix_syllabuses_board ON syllabuses (board);

-- Grades a syllabus is taught in: IGCSE keeps Grades 8–10 (at most three);
-- a Matriculation syllabus may be for any standard 1–12.
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint
            WHERE conrelid = 'syllabuses'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%grade_levels%'
  LOOP
    EXECUTE format('ALTER TABLE syllabuses DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE syllabuses ADD CONSTRAINT ck_syllabuses_grade_levels CHECK (
  CASE WHEN board = 'igcse'
       THEN cardinality(grade_levels) BETWEEN 1 AND 3 AND grade_levels <@ ARRAY[8, 9, 10]
       ELSE cardinality(grade_levels) BETWEEN 1 AND 12 AND grade_levels <@ ARRAY[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
  END);

ALTER TABLE learning_objectives ADD COLUMN board text NOT NULL DEFAULT 'igcse'
  REFERENCES grade_scales(board) ON UPDATE CASCADE;
CREATE INDEX ix_learning_objectives_board ON learning_objectives (board);
