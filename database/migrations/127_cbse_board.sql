-- =============================================================================
-- 127 CBSE BOARD — a third board alongside Cambridge IGCSE and Tamil Nadu
-- Matriculation, with its own editable grade scale. Classes, syllabuses and
-- learning outcomes pick it through their existing `board` columns
-- (migrations 125 and 126).
--
-- Scale: the CBSE eight-point A1–E grades used for school assessment — A1 91,
-- A2 81, B1 71, B2 61, C1 51, C2 41, D 33 (the CBSE pass mark is 33%), E below
-- 33 ("needs improvement"). Grade points run 10 (A1) to 4 (D). For Class X / XII
-- board examinations CBSE awards grades by rank among passed candidates, so
-- these mark bands are INDICATIVE school defaults and editable (grading.manage).
-- Defaults must match backend/src/services/grading-shared.ts.
-- =============================================================================
INSERT INTO grade_scales (key, name, description, is_default, tier_rules, board, board_name, expectation)
VALUES ('cbse_a1_e', 'CBSE (A1 to E)',
        'Eight-point A1–E grades in the CBSE style. D starts at 33%, the CBSE pass mark; E is below the pass mark (needs improvement). Indicative school boundaries.',
        false, '{}'::jsonb, 'cbse', 'CBSE', '{"above":"B1","at":"B2"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO grade_boundaries (scale_id, grade, min_percent, points, description, tone, sort_order)
SELECT gs.id, b.grade, b.min_percent, b.points, b.description, b.tone, b.sort_order
  FROM grade_scales gs
 CROSS JOIN (VALUES
   ('A1', 91, 10, 'Outstanding',                   'success',  1),
   ('A2', 81,  9, 'Excellent',                     'success',  2),
   ('B1', 71,  8, 'Very good',                     'info',     3),
   ('B2', 61,  7, 'Good',                          'info',     4),
   ('C1', 51,  6, 'Above average',                 'neutral',  5),
   ('C2', 41,  5, 'Average',                       'neutral',  6),
   ('D',  33,  4, 'Pass',                          'warning',  7),
   ('E',   0,  0, 'Below pass — needs improvement', 'critical', 8)
 ) AS b(grade, min_percent, points, description, tone, sort_order)
 WHERE gs.key = 'cbse_a1_e'
ON CONFLICT (scale_id, grade) DO NOTHING;
