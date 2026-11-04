"""
IB Diploma Programme catalogue — the DP subject groups and courses on the IB's
curriculum page (https://www.ibo.org/programmes/diploma-programme/curriculum/),
as listed 2026-11-04. ibo.org sits behind a bot check, so every entry links to
that official curriculum page (the subject pages and guides are not linked).
Writes database/data/ib-dp-curriculum.csv and database/migrations/132_ib_board.sql.
"""
import csv, json, sys
REPO = sys.argv[1]
CURRICULUM = 'https://www.ibo.org/programmes/diploma-programme/curriculum/'
PASSING = 'https://www.ibo.org/about-the-ib/what-it-means-to-be-an-ib-student/recognizing-student-achievement/about-assessment/dp-passing-criteria/'

SUBJECTS = [
    ('Group 1 — Studies in language and literature', ['Language A: literature', 'Language A: language and literature', 'Literature and performance']),
    ('Group 2 — Language acquisition', ['Language B', 'Language ab initio', 'Classical languages']),
    ('Group 3 — Individuals and societies', ['Business management', 'Digital society', 'Economics', 'Geography', 'Global politics', 'History',
                                             'Philosophy', 'Psychology', 'Social and cultural anthropology', 'World religions']),
    ('Group 4 — Sciences', ['Biology', 'Chemistry', 'Computer science', 'Design technology', 'Physics', 'Sports, exercise and health science']),
    ('Interdisciplinary (Groups 3 and 4)', ['Environmental systems and societies']),
    ('Group 5 — Mathematics', ['Mathematics: analysis and approaches', 'Mathematics: applications and interpretation']),
    ('Group 6 — The arts', ['Dance', 'Film', 'Music', 'Theatre', 'Visual arts']),
    ('DP core', ['Theory of knowledge', 'Extended essay', 'Creativity, activity, service']),
]
LABEL = 'IB Diploma Programme curriculum (ibo.org)'

rows, values = [], []
q = lambda v: "'" + v.replace("'", "''") + "'"
i = 0
for group, names in SUBJECTS:
    for name in names:
        i += 1
        docs = [{'grade': g, 'label': LABEL, 'url': CURRICULUM} for g in (11, 12)]
        if group == 'DP core':
            docs.append({'grade': 12, 'label': 'DP passing criteria (ibo.org)', 'url': PASSING})
        for d in docs:
            rows.append((group, name, d['grade'], d['label'], d['url']))
        values.append(f"  ('ib', {q(group)}, {q(name)}, ARRAY[11, 12], {q(json.dumps(docs, ensure_ascii=False))}::jsonb, {q(CURRICULUM)}, {i})")

with open(f'{REPO}/database/data/ib-dp-curriculum.csv', 'w', encoding='utf-8', newline='') as f:
    w = csv.writer(f, lineterminator='\r\n')
    w.writerow(['category', 'subject', 'grade', 'label', 'url'])
    w.writerows(rows)

sql = f"""-- =============================================================================
-- 132 IB BOARD — a sixth board (International Baccalaureate Diploma Programme)
-- alongside Cambridge IGCSE, Tamil Nadu Matriculation, CBSE, ICSE and NIOS: its
-- own editable grade scale, and the DP subjects in the board catalogue (migration 128).
--
-- Grade scale: every DP subject is graded 7 (highest) to 1. A diploma needs 24 of
-- the 45 points (six subjects × 7, plus up to 3 core points from theory of
-- knowledge and the extended essay, graded A–E), no subject below 2, at most two 2s
-- and at most three grades of 3 or below. The IB sets grade boundaries per subject
-- and session, so the percentages below are INDICATIVE school boundaries for
-- internal assessments — 7 from 80%, 6 70, 5 60, 4 50, 3 40, 2 30, 1 below —
-- editable (permission grading.manage). Defaults must match grading-shared.ts.
--
-- Catalogue: the DP subject groups and courses on the IB's curriculum page
-- ({CURRICULUM}), listed 2026-11-04, for Grades 11–12 (the
-- two-year Diploma Programme); environmental systems and societies counts for
-- groups 3 and 4, and the DP core (TOK, EE, CAS) is listed too. ibo.org is behind
-- a bot check, so entries link to the official curriculum page rather than to the
-- subject guides. Source: database/data/ib-dp-curriculum.csv.
-- =============================================================================
INSERT INTO grade_scales (key, name, description, is_default, tier_rules, board, board_name, expectation)
VALUES ('ib_dp_7_1', 'IB Diploma Programme (7 to 1)',
        'IB DP subject grades 7 (excellent) to 1 (very poor). A diploma needs 24 of 45 points and no grade below 2. The IB sets grade boundaries per subject and session; these percentages are indicative school boundaries.',
        false, '{{}}'::jsonb, 'ib', 'IB', '{{"above":"6","at":"5"}}'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO grade_boundaries (scale_id, grade, min_percent, points, description, tone, sort_order)
SELECT gs.id, b.grade, b.min_percent, b.points, b.description, b.tone, b.sort_order
  FROM grade_scales gs
 CROSS JOIN (VALUES
   ('7', 80, 7, 'Excellent',     'success',  1),
   ('6', 70, 6, 'Very good',     'success',  2),
   ('5', 60, 5, 'Good',          'info',     3),
   ('4', 50, 4, 'Satisfactory',  'info',     4),
   ('3', 40, 3, 'Mediocre',      'neutral',  5),
   ('2', 30, 2, 'Poor',          'warning',  6),
   ('1',  0, 1, 'Very poor',     'critical', 7)
 ) AS b(grade, min_percent, points, description, tone, sort_order)
 WHERE gs.key = 'ib_dp_7_1'
ON CONFLICT (scale_id, grade) DO NOTHING;

INSERT INTO board_catalogue (board, category, subject, grade_levels, documents, source_page, sort_order) VALUES
{(',' + chr(10)).join(values)}
ON CONFLICT (board, category, subject) DO UPDATE SET grade_levels = EXCLUDED.grade_levels, documents = EXCLUDED.documents,
  source_page = EXCLUDED.source_page, sort_order = EXCLUDED.sort_order, updated_at = now();
"""
with open(f'{REPO}/database/migrations/132_ib_board.sql', 'w', encoding='utf-8', newline='') as f:
    f.write(sql.replace('\r\n', '\n').replace('\n', '\r\n'))
print('IB subjects', i)
