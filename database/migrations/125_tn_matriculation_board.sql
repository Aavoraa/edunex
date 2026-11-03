-- =============================================================================
-- 125 TAMIL NADU MATRICULATION BOARD — a board per class, and a second grade
-- scale so a class can follow either Cambridge IGCSE or the Tamil Nadu
-- Matriculation (State Board) scheme.
--
-- Each grade scale now belongs to one board (grade_scales.board). Every class
-- (campus + grade level) follows one board; assessment marks, term results,
-- report cards, Student 360 and the performance bands use that board's scale.
-- Existing classes stay on Cambridge IGCSE, so existing grades do not change.
--
-- Matriculation scale: the nine-point A1–E2 bands of the Continuous and
-- Comprehensive Evaluation (CCE) style used by Tamil Nadu State Board /
-- Matriculation schools for classes 1–9, with D starting at 35% — the Tamil
-- Nadu pass mark (SSLC and HSC public exams pass at 35 out of 100). These are
-- INDICATIVE school defaults and are editable like the IGCSE boundaries
-- (permission grading.manage). Defaults must match
-- backend/src/services/grading-shared.ts.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Boards on grade scales
-- ---------------------------------------------------------------------------
ALTER TABLE grade_scales
  ADD COLUMN board        text,                                  -- igcse | matriculation
  ADD COLUMN board_name   text,                                  -- Cambridge IGCSE
  -- Academic performance bands: {"above":"B","at":"C"} = above expectation is B or better, at expectation is C.
  ADD COLUMN expectation  jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE grade_scales ADD CONSTRAINT ux_grade_scales_board UNIQUE (board);
ALTER TABLE grade_scales ADD CONSTRAINT ck_grade_scales_board CHECK (board IS NULL OR board ~ '^[a-z_]+$');

UPDATE grade_scales
   SET board = 'igcse', board_name = 'Cambridge IGCSE', expectation = '{"above":"B","at":"C"}'::jsonb
 WHERE key = 'cambridge_igcse_a_star_g' AND board IS NULL;

INSERT INTO grade_scales (key, name, description, is_default, tier_rules, board, board_name, expectation)
VALUES ('tn_matriculation_a1_e2', 'Tamil Nadu Matriculation (A1 to E2)',
        'Nine-point A1–E2 grades in the CCE style used by Tamil Nadu State Board and Matriculation schools. D starts at 35%, the Tamil Nadu pass mark; E1 and E2 are below the pass mark. Indicative school boundaries.',
        false, '{}'::jsonb, 'matriculation', 'Tamil Nadu Matriculation', '{"above":"B1","at":"B2"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO grade_boundaries (scale_id, grade, min_percent, points, description, tone, sort_order)
SELECT gs.id, b.grade, b.min_percent, b.points, b.description, b.tone, b.sort_order
  FROM grade_scales gs
 CROSS JOIN (VALUES
   ('A1', 91, 10, 'Outstanding',          'success',  1),
   ('A2', 81,  9, 'Excellent',            'success',  2),
   ('B1', 71,  8, 'Very good',            'info',     3),
   ('B2', 61,  7, 'Good',                 'info',     4),
   ('C1', 51,  6, 'Above average',        'neutral',  5),
   ('C2', 41,  5, 'Average',              'neutral',  6),
   ('D',  35,  4, 'Pass',                 'warning',  7),
   ('E1', 21,  0, 'Below pass — needs improvement', 'critical', 8),
   ('E2',  0,  0, 'Below pass — needs support',     'critical', 9)
 ) AS b(grade, min_percent, points, description, tone, sort_order)
 WHERE gs.key = 'tn_matriculation_a1_e2'
ON CONFLICT (scale_id, grade) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Board per class (campus + grade level). Existing classes stay on IGCSE.
-- ---------------------------------------------------------------------------
ALTER TABLE classes ADD COLUMN board text NOT NULL DEFAULT 'igcse'
  REFERENCES grade_scales(board) ON UPDATE CASCADE;
CREATE INDEX ix_classes_board ON classes (board);

-- Grading needs the class (and so the board) for every student's term results.
CREATE INDEX IF NOT EXISTS ix_sections_class ON sections (class_id);
