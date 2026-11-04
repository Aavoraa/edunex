"""
NIOS catalogue — the subjects of NIOS's official course-material pages, read 2026-11-04:
  Secondary:        https://www.nios.ac.in/online-course-material/secondary-courses.aspx
  Senior Secondary: https://www.nios.ac.in/online-course-material/sr-secondary-courses.aspx
Usage: build_nios.py <web dir with nios-sec.html, nios-sr.html> <repo> [urlcheck file]
Writes database/data/nios-courses.csv and database/migrations/131_nios_board.sql.
"""
import csv, html, json, os, re, sys
WEB, REPO = sys.argv[1], sys.argv[2]
CHECK = sys.argv[3] if len(sys.argv) > 3 else None
BASE = 'https://www.nios.ac.in'
PAGES = {
    'Secondary': (f'{BASE}/online-course-material/secondary-courses.aspx', 'nios-sec.html', [9, 10]),
    'Senior Secondary': (f'{BASE}/online-course-material/sr-secondary-courses.aspx', 'nios-sr.html', [11, 12]),
}
LANG = re.compile(r'^(hindi|english|sanskrit|urdu|arabic|persian|bengali)$', re.I)
SKILL = re.compile(r'data entry|artificial intelligence|tourism|library|early childhood|mass communication|military|physical education', re.I)

dead = set()
if CHECK and os.path.exists(CHECK):
    for line in open(CHECK, encoding='utf-8'):
        code, url = line.strip().split(' ', 1)
        if not code.startswith('20'):
            dead.add(url)

rows, subjects = [], []
for level, (page, fname, grades) in PAGES.items():
    s = open(os.path.join(WEB, fname), encoding='utf-8', errors='replace').read()
    for m in re.finditer(r'<a [^>]*href="([^"]+)"[^>]*>(.*?)</a>', s, re.S | re.I):
        href = m.group(1)
        text = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '', m.group(2)))).strip()
        if '/online-course-material/' not in href.lower() or not href.lower().endswith('.aspx') or not text or 'course material' in text.lower():
            continue
        url = href if href.startswith('http') else BASE + href
        if url in dead:
            continue
        mcode = re.match(r'^(.*?)\s*\((\d{3})\)$', text)
        name, code = (mcode.group(1), mcode.group(2)) if mcode else (text, None)
        name = name.strip()
        if name.isupper():
            name = name.title().replace(' And ', ' and ').replace(',', ',')
        name = {'Social science': 'Social Science', 'Enviornmental Science': 'Environmental Science',
                'Physical Education and Yog': 'Physical Education and Yoga'}.get(name, name)
        group = 'Languages' if LANG.match(name) else 'Skills & vocational' if SKILL.search(name) else 'Academic subjects'
        category = f'{level} — {group}'
        label = f'Course material & syllabus{f" — subject {code}" if code else ""}'
        subjects.append((category, name, grades, code, url, page))
        for g in grades:
            rows.append((category, name, g, label, url))

with open(f'{REPO}/database/data/nios-courses.csv', 'w', encoding='utf-8', newline='') as f:
    w = csv.writer(f, lineterminator='\r\n')
    w.writerow(['category', 'subject', 'grade', 'label', 'url'])
    w.writerows(rows)

q = lambda v: "'" + v.replace("'", "''") + "'"
values = []
for i, (category, name, grades, code, url, page) in enumerate(subjects):
    label = f'Course material & syllabus{f" — subject {code}" if code else ""}'
    docs = [{'grade': g, 'label': label, 'url': url} for g in grades]
    values.append(f"  ('nios', {q(category)}, {q(name)}, ARRAY[{', '.join(map(str, grades))}], {q(json.dumps(docs, ensure_ascii=False))}::jsonb, {q(page)}, {i + 1})")

sql = f"""-- =============================================================================
-- 131 NIOS BOARD — a fifth board (National Institute of Open Schooling) alongside
-- Cambridge IGCSE, Tamil Nadu Matriculation, CBSE and ICSE: its own editable
-- grade scale, and its courses in the board catalogue (migration 128).
--
-- Grade scale: NIOS reports results as marks — a learner passes a subject with 33%
-- (theory and practical where applicable), and needs five subjects including one or
-- two languages; tutor-marked assignments (TMAs) carry about 20%. The letters below
-- are an INDICATIVE school scale for internal assessments, in the usual Indian
-- division bands — A 75 (distinction), B 60 (first division), C 45 (second
-- division), D 33 (pass), E below 33 — editable (permission grading.manage).
-- Defaults must match backend/src/services/grading-shared.ts.
--
-- Catalogue: the subjects (with NIOS subject codes) on NIOS's official course-
-- material pages, read 2026-11-04 — Secondary (mapped to Classes IX–X) and Senior
-- Secondary (Classes XI–XII). Each links to its official NIOS course page; listed
-- pages that NIOS did not serve when checked (e.g. 404 for Physical Education and
-- Yog, 373) were left out.
-- Source: database/data/nios-courses.csv (generator: database/data/build-nios-catalogue.py).
-- =============================================================================
INSERT INTO grade_scales (key, name, description, is_default, tier_rules, board, board_name, expectation)
VALUES ('nios_a_e', 'NIOS (A to E)',
        'Indicative school grades for NIOS learners in division bands. NIOS reports results as marks; a subject is passed with 33%, so D starts at 33% and E is below the pass mark.',
        false, '{{}}'::jsonb, 'nios', 'NIOS', '{{"above":"B","at":"C"}}'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO grade_boundaries (scale_id, grade, min_percent, points, description, tone, sort_order)
SELECT gs.id, b.grade, b.min_percent, b.points, b.description, b.tone, b.sort_order
  FROM grade_scales gs
 CROSS JOIN (VALUES
   ('A', 75, 4, 'Distinction',                       'success',  1),
   ('B', 60, 3, 'First division',                    'info',     2),
   ('C', 45, 2, 'Second division',                   'neutral',  3),
   ('D', 33, 1, 'Pass',                              'warning',  4),
   ('E',  0, 0, 'Below pass — needs improvement',    'critical', 5)
 ) AS b(grade, min_percent, points, description, tone, sort_order)
 WHERE gs.key = 'nios_a_e'
ON CONFLICT (scale_id, grade) DO NOTHING;

INSERT INTO board_catalogue (board, category, subject, grade_levels, documents, source_page, sort_order) VALUES
{(',' + chr(10)).join(values)}
ON CONFLICT (board, category, subject) DO UPDATE SET grade_levels = EXCLUDED.grade_levels, documents = EXCLUDED.documents,
  source_page = EXCLUDED.source_page, sort_order = EXCLUDED.sort_order, updated_at = now();
"""
with open(f'{REPO}/database/migrations/131_nios_board.sql', 'w', encoding='utf-8', newline='') as f:
    f.write(sql.replace('\r\n', '\n').replace('\n', '\r\n'))
print('NIOS subjects', len(subjects), 'dead skipped', len(dead))
for c, n, g, code, u, p in subjects:
    print(' ', c, '|', n, code)
