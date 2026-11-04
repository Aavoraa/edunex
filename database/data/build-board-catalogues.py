"""
Builds the Tamil Nadu State Board (Matriculation) and CBSE catalogues from the
official sources downloaded on 2026-11-04:
  - web/scert.json  : https://emis3.tnschools.gov.in/api/get_scert_books
                      (the list behind https://tnschools.gov.in/scert-textbook)
  - web/c2027.html  : https://cbseacademic.nic.in/curriculum_2027.html
                      (CBSE Curriculum for the Academic Year 2026-27)
Writes database/data/*.csv and database/migrations/128_board_catalogues.sql.
"""
import csv, html, io, json, re, sys
from collections import OrderedDict

WEB, REPO = sys.argv[1], sys.argv[2]
ROMAN = {'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6, 'VII': 7, 'VIII': 8, 'IX': 9, 'X': 10, 'XI': 11, 'XII': 12}

# ----------------------------------------------------------------------------- Tamil Nadu
LANGS = {'tamil', 'english', 'general tamil', 'general english', 'advanced tamil', 'communicative english', 'tamil & english'}
VOCATIONAL = re.compile(r'engineering|nursing|textile|employability|office management|auditing|food service|agricultur', re.I)

def tn_subject(raw):
    s = re.sub(r'\s+', ' ', raw).strip()
    vol = None
    m = re.match(r'^VOL\s*-?\s*(I{1,3})\s*\((.*)\)$', s, re.I)
    if m:
        vol, s = 'Vol ' + m.group(1).upper(), m.group(2)
    m = re.match(r'^(.*?)\s*(?:VOL\s*-\s*|\(Vol\s+)(I{1,3})\)?$', s, re.I)
    if m:
        s, vol = m.group(1), 'Vol ' + m.group(2).upper()
    s = re.sub(r'\s*&\s*', ' & ', s).strip(' ()')
    if re.match(r'^TAMIL\s*\(CBSE', s, re.I):
        return 'Tamil (Tamil Nadu SCERT, for CBSE schools)', vol
    if not re.search('[a-z]', s):
        s = s.title().replace(' And ', ' and ').replace('Evs', 'EVS')
    s = re.sub(r'^Bio - ', 'Bio-', s, flags=re.I).replace('Mangement', 'Management').replace('Dietics', 'Dietetics')
    if s.lower() == 'maths':
        s = 'Mathematics'
    return s, vol

tn_rows = []          # (category, subject, grade, label, url)
cbse_tamil = []       # TN SCERT Tamil textbooks prescribed for CBSE schools in Tamil Nadu
data = json.load(open(f'{WEB}/scert.json', encoding='utf-8'))['result']
for cls, subjects in data.items():
    grade = ROMAN[cls.split('Class-')[1]]
    for raw, terms in subjects.items():
        subject, vol = tn_subject(raw)
        for term, by_medium in terms.items():
            for b in by_medium.values():
                medium = b['medium_name']
                reader = subject.lower().endswith('reader')
                if not reader and medium not in ('Tamil', 'English'):
                    continue
                # The page lists the Std III Vol I (Tamil & English) term books under the Vol II heading.
                subj = 'Tamil & English' if b['file_name'].upper().startswith('TAMIL & ENGLISH') else subject
                parts = [vol, term.replace('Term-', 'Term ') if term and term != 'Term-Full' else None, None if reader else f'{medium} medium']
                label = ' · '.join(p for p in parts if p) or 'Textbook'
                row = (subj, grade, label, b['book_path'])
                if subj.startswith('Tamil (Tamil Nadu SCERT'):
                    cbse_tamil.append(('Tamil Nadu SCERT textbooks', *row))
                    continue
                low = subj.lower()
                cat = 'Languages' if low in LANGS or reader else 'Vocational' if VOCATIONAL.search(subj) else 'Academic'
                tn_rows.append((cat, *row))

# ----------------------------------------------------------------------------- CBSE
CBSE_BASE = 'https://cbseacademic.nic.in/'
page = open(f'{WEB}/c2027.html', encoding='utf-8', errors='replace').read()
cbse_rows = []
grade_set, cat = None, None
last = None
SKIP_CATS = {'Initial Pages', 'Vocational Education', 'Vocational Education (Skill Education)'}
for m in re.finditer(r'<(h\d|th|strong|b)[^>]*>(.*?)</\1>|<a [^>]*href="([^"]+)"[^>]*>(.*?)</a>', page, re.S | re.I):
    if m.group(3) is None:
        t = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '', m.group(2)))).replace('�', '').strip()
        if not t:
            continue
        if 'Part - 1 (Class IX)' in t: grade_set = [9]
        elif 'Part - 1 (Class X)' in t: grade_set = [10]
        elif 'Part - 2 (XI-XII)' in t: grade_set = [11, 12]
        elif t.startswith('Curriculum for the Academic Year'): pass
        else:
            c = t.split(' - (')[0].split(' -(')[0].strip()
            cat = {'Main Subjects': 'Main subjects', 'Optional Subjects': 'Academic electives', 'Other Academic Electives': 'Academic electives',
                   'Academic Electives': 'Academic electives', 'Subjects of Internal Assessment': 'Internal assessment'}.get(c, c)
            if t.startswith('Initial Pages'): cat = 'Initial Pages'
        continue
    href, text = m.group(3), re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '', m.group(4)))).strip()
    if not grade_set or cat in SKIP_CATS or not href.lower().endswith('.pdf') or href.startswith('http'):
        continue
    url = CBSE_BASE + href
    if text == 'Reading Material' and last:
        for g in grade_set:
            cbse_rows.append((last[0], last[1], g, 'Reading material (PDF)', url))
        continue
    subject = {'Course A': 'Urdu Course A', 'Course B': 'Urdu Course B', 'Infomatics Practices': 'Informatics Practices',
               'Sanskrit Communiucative': 'Sanskrit Communicative', 'Dance': 'Dance (Indian Classical)'}.get(text, text)
    if subject == 'English' and grade_set == [9]: subject = 'English - Language and Literature'
    if subject == 'Hindi' and grade_set == [9]: subject = 'Hindi'
    last = (cat, subject)
    for g in grade_set:
        cbse_rows.append((cat, subject, g, '2026-27 Curriculum (PDF)', url))

cbse_rows += cbse_tamil

# Leave out links that the official servers do not serve (checked 2026-11-04: 403 / 404).
import os, urllib.parse
dead = set()
check = os.path.join(os.path.dirname(WEB), 'urlcheck.txt')
if os.path.exists(check):
    for line in open(check, encoding='utf-8'):
        code, url = line.strip().split(' ', 1)
        if not code.startswith('20'):
            dead.add(urllib.parse.unquote(url))
DEAD_COUNT = sum(1 for r in tn_rows + cbse_rows if r[-1] in dead)
tn_rows = [r for r in tn_rows if r[-1] not in dead]
cbse_rows = [r for r in cbse_rows if r[-1] not in dead]
cbse_tamil = [r for r in cbse_tamil if r[-1] not in dead]

def write_csv(name, rows):
    path = f'{REPO}/database/data/{name}'
    with open(path, 'w', encoding='utf-8', newline='') as f:
        w = csv.writer(f, lineterminator='\r\n')
        w.writerow(['category', 'subject', 'grade', 'label', 'url'])
        w.writerows(rows)
    return path

write_csv('tn-state-board-textbooks.csv', tn_rows)
write_csv('cbse-curriculum-2026-27.csv', cbse_rows)

# ----------------------------------------------------------------------------- SQL
def group(rows):
    out = OrderedDict()
    for cat, subject, grade, label, url in rows:
        r = out.setdefault((cat, subject), {'grades': set(), 'docs': []})
        r['grades'].add(grade)
        d = {'grade': grade, 'label': label, 'url': url}
        if d not in r['docs']:
            r['docs'].append(d)
    return out

def q(s):
    return "'" + s.replace("'", "''") + "'"

def values(board, rows, source):
    lines = []
    for i, ((cat, subject), r) in enumerate(group(rows).items()):
        docs = sorted(r['docs'], key=lambda d: d['grade'])
        lines.append(f"  ({q(board)}, {q(cat)}, {q(subject)}, ARRAY[{', '.join(map(str, sorted(r['grades'])))}], {q(json.dumps(docs, ensure_ascii=False))}::jsonb, {q(source)}, {i + 1})")
    return lines

tn = values('matriculation', tn_rows, 'https://tnschools.gov.in/scert-textbook')
cb = values('cbse', [r for r in cbse_rows if r not in cbse_tamil], 'https://cbseacademic.nic.in/curriculum_2027.html') + \
     [l.replace("'https://cbseacademic.nic.in/curriculum_2027.html'", "'https://tnschools.gov.in/scert-textbook'") for l in values('cbse', cbse_tamil, 'x')]
# renumber CBSE sort order after the concatenation
cb = [re.sub(r', \d+\)$', f', {i + 1})', l) for i, l in enumerate(cb)]
cb = [l.replace(", 'x', ", ", 'https://tnschools.gov.in/scert-textbook', ") for l in cb]

sql = f"""-- =============================================================================
-- 128 BOARD CATALOGUES — the Tamil Nadu State Board (Matriculation) textbooks and
-- the CBSE curriculum, like the Cambridge IGCSE catalogue (migration 120), so a
-- school can add a Matriculation or CBSE syllabus from the official documents.
--
-- Sources (downloaded 2026-11-04; regenerate from the CSVs in a new migration):
--   database/data/tn-state-board-textbooks.csv — Department of School Education,
--     Government of Tamil Nadu, SCERT textbooks (https://tnschools.gov.in/scert-textbook):
--     every Std 1–12 State Board textbook in Tamil and English medium, plus the
--     language readers. Matriculation schools follow these State Board textbooks.
--   database/data/cbse-curriculum-2026-27.csv — CBSE Curriculum for the Academic
--     Year 2026-27 (https://cbseacademic.nic.in/curriculum_2027.html): Class IX,
--     Class X and Classes XI–XII subject curricula; plus the Tamil Nadu SCERT
--     Tamil textbooks for CBSE schools in Tamil Nadu (Classes I–VII).
--
-- Every link was checked on 2026-11-04; {DEAD_COUNT} document entries listed on the official pages that
-- their servers did not serve (403 / 404 — e.g. Std I–VII Term II/III books, CBSE Hindi-
-- medium XI–XII documents not yet published) were left out.
--
-- documents: [{{grade, label, url}}] — one entry per standard/class (and medium,
-- term or volume). A school syllabus added from the catalogue keeps a link to
-- its row (syllabuses.board_catalogue_id) and shows the documents for its grades.
-- =============================================================================
CREATE TABLE board_catalogue (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board         text NOT NULL REFERENCES grade_scales(board) ON UPDATE CASCADE,
  category      text NOT NULL,                       -- Languages, Academic, Main subjects …
  subject       text NOT NULL,
  grade_levels  int[] NOT NULL CHECK (cardinality(grade_levels) >= 1 AND grade_levels <@ ARRAY[1,2,3,4,5,6,7,8,9,10,11,12]),
  documents     jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{{grade, label, url}}]
  source_page   text,
  sort_order    int NOT NULL DEFAULT 0,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (board, category, subject)
);
CREATE INDEX ix_board_catalogue_board ON board_catalogue (board, sort_order);

INSERT INTO board_catalogue (board, category, subject, grade_levels, documents, source_page, sort_order) VALUES
{(',' + chr(10)).join(tn + cb)}
ON CONFLICT (board, category, subject) DO UPDATE SET grade_levels = EXCLUDED.grade_levels, documents = EXCLUDED.documents,
  source_page = EXCLUDED.source_page, sort_order = EXCLUDED.sort_order, updated_at = now();

-- A school syllabus added from a board catalogue keeps a link to it.
ALTER TABLE syllabuses ADD COLUMN board_catalogue_id uuid REFERENCES board_catalogue(id) ON DELETE SET NULL;
CREATE INDEX ix_syllabuses_board_catalogue ON syllabuses (board_catalogue_id);
"""
with open(f'{REPO}/database/migrations/128_board_catalogues.sql', 'w', encoding='utf-8', newline='') as f:
    f.write(sql.replace('\r\n', '\n').replace('\n', '\r\n'))
print('TN rows', len(tn_rows), '-> catalogue', len(tn), '| CBSE rows', len(cbse_rows), '-> catalogue', len(cb))
