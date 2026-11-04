"""
ICSE (CISCE) catalogue — subjects of "Regulations and Syllabuses - ICSE 2027"
(https://cisce.org/regulations-and-syllabus-icse-2027/), read 2026-11-04.
CISCE serves the subject PDFs through a reCAPTCHA-protected download, so each
entry links to CISCE's official syllabus page for that examination year.
Writes database/data/icse-2027-regulations-syllabuses.csv and
database/migrations/130_icse_board.sql.
"""
import csv, json, sys
REPO = sys.argv[1]
P2027 = 'https://cisce.org/regulations-and-syllabus-icse-2027/'
INDEX = 'https://cisce.org/regulations-and-syllabuses-icse-2/'

# (group, subject) in CISCE's order. Groups follow the ICSE scheme of studies.
SUBJECTS = [
    ('Group I (compulsory)', 'English'),
    ('Group I (compulsory)', 'Second Language – Indian Languages'),
    ('Group I (compulsory)', 'Modern Foreign Languages – Group I'),
    ('Group I (compulsory)', 'History & Civics'),
    ('Group I (compulsory)', 'Geography'),
    ('Group I (compulsory)', 'History & Civics – Thailand'),
    ('Group I (compulsory)', 'Geography – Thailand'),
    ('Group II', 'Mathematics'),
    ('Group II', 'Physics'),
    ('Group II', 'Chemistry'),
    ('Group II', 'Biology'),
    ('Group II', 'Economics'),
    ('Group II', 'Commercial Studies'),
    ('Group II', 'Modern Foreign Languages – Group II'),
    ('Group II', 'Classical Languages'),
    ('Group II', 'Environmental Science'),
    ('Group III', 'Computer Applications'),
    ('Group III', 'Economic Applications'),
    ('Group III', 'Commercial Applications'),
    ('Group III', 'Art'),
    ('Group III', 'Performing Arts'),
    ('Group III', 'Home Science'),
    ('Group III', 'Cookery'),
    ('Group III', 'Fashion Designing'),
    ('Group III', 'Physical Education'),
    ('Group III', 'Yoga'),
    ('Group III', 'Technical Drawing Applications'),
    ('Group III', 'Environmental Applications'),
    ('Group III', 'Modern Foreign Languages – Group III'),
    ('Group III', 'Mass Media & Communication'),
    ('Group III', 'Hospitality Management'),
    ('Internal assessment', 'SUPW & Community Service'),
]

rows = []
for group, subject in SUBJECTS:
    rows.append((group, subject, 10, 'ICSE 2027 Regulations & Syllabus (CISCE)', P2027))
    rows.append((group, subject, 9, 'ICSE 2028 — listed on CISCE’s Regulations & Syllabuses page', INDEX))

with open(f'{REPO}/database/data/icse-2027-regulations-syllabuses.csv', 'w', encoding='utf-8', newline='') as f:
    w = csv.writer(f, lineterminator='\r\n')
    w.writerow(['category', 'subject', 'grade', 'label', 'url'])
    w.writerows(rows)

q = lambda s: "'" + s.replace("'", "''") + "'"
values = []
for i, (group, subject) in enumerate(SUBJECTS):
    docs = [{'grade': 9, 'label': 'ICSE 2028 — listed on CISCE’s Regulations & Syllabuses page', 'url': INDEX},
            {'grade': 10, 'label': 'ICSE 2027 Regulations & Syllabus (CISCE)', 'url': P2027}]
    values.append(f"  ('icse', {q(group)}, {q(subject)}, ARRAY[9, 10], {q(json.dumps(docs, ensure_ascii=False))}::jsonb, {q(P2027)}, {i + 1})")

sql = f"""-- =============================================================================
-- 130 ICSE BOARD — a fourth board (CISCE's Indian Certificate of Secondary
-- Education) alongside Cambridge IGCSE, Tamil Nadu Matriculation and CBSE: its
-- own editable grade scale, and its subjects in the board catalogue
-- (migration 128) so a school can add an ICSE syllabus.
--
-- Grade scale: CISCE reports ICSE results as marks; a candidate needs 33% in each
-- subject and in aggregate to pass. The letters below are an INDICATIVE school
-- scale for internal assessments — A+ 90, A 80, B+ 70, B 60, C+ 50, C 40,
-- D 33 (the CISCE pass mark), E below 33 — editable (permission grading.manage).
-- Defaults must match backend/src/services/grading-shared.ts.
--
-- Catalogue: the subjects of "Regulations and Syllabuses – ICSE 2027"
-- ({P2027}), read 2026-11-04, in
-- the ICSE groups (Group I compulsory, Group II, Group III, internal assessment).
-- Class X (examined 2027) links to that page; Class IX (examined 2028) links to
-- CISCE's Regulations & Syllabuses index, where ICSE 2028 is listed. CISCE serves
-- the subject PDFs through a protected download, so entries link to the official
-- pages rather than to the PDFs. Source: database/data/icse-2027-regulations-syllabuses.csv.
-- =============================================================================
INSERT INTO grade_scales (key, name, description, is_default, tier_rules, board, board_name, expectation)
VALUES ('icse_a_plus_e', 'ICSE (A+ to E)',
        'Indicative school grades for ICSE classes. CISCE reports ICSE results as marks with a 33% pass mark in each subject and in aggregate; D starts at 33% and E is below the pass mark.',
        false, '{{}}'::jsonb, 'icse', 'ICSE', '{{"above":"B+","at":"B"}}'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO grade_boundaries (scale_id, grade, min_percent, points, description, tone, sort_order)
SELECT gs.id, b.grade, b.min_percent, b.points, b.description, b.tone, b.sort_order
  FROM grade_scales gs
 CROSS JOIN (VALUES
   ('A+', 90, 10, 'Outstanding',                     'success',  1),
   ('A',  80,  9, 'Excellent',                       'success',  2),
   ('B+', 70,  8, 'Very good',                       'info',     3),
   ('B',  60,  7, 'Good',                            'info',     4),
   ('C+', 50,  6, 'Above average',                   'neutral',  5),
   ('C',  40,  5, 'Average',                         'neutral',  6),
   ('D',  33,  4, 'Pass',                            'warning',  7),
   ('E',   0,  0, 'Below pass — needs improvement',  'critical', 8)
 ) AS b(grade, min_percent, points, description, tone, sort_order)
 WHERE gs.key = 'icse_a_plus_e'
ON CONFLICT (scale_id, grade) DO NOTHING;

INSERT INTO board_catalogue (board, category, subject, grade_levels, documents, source_page, sort_order) VALUES
{(',' + chr(10)).join(values)}
ON CONFLICT (board, category, subject) DO UPDATE SET grade_levels = EXCLUDED.grade_levels, documents = EXCLUDED.documents,
  source_page = EXCLUDED.source_page, sort_order = EXCLUDED.sort_order, updated_at = now();
"""
with open(f'{REPO}/database/migrations/130_icse_board.sql', 'w', encoding='utf-8', newline='') as f:
    f.write(sql.replace('\r\n', '\n').replace('\n', '\r\n'))
print('ICSE subjects', len(SUBJECTS))
