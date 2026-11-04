-- =============================================================================
-- 129 SUBJECT CATEGORIES — a general category on every school subject
-- (Languages, Mathematics, Science …), common to all boards.
--
-- Adding a Matriculation / CBSE subject from a board catalogue (migration 128)
-- picks a general category; the school subject itself is reused when one with
-- the same name exists, or created (e.g. "Tamil & English" under Languages).
-- The list must match SUBJECT_CATEGORIES in backend/src/services/grading-shared.ts.
-- =============================================================================
ALTER TABLE subjects ADD COLUMN category text CHECK (category IN (
  'Languages', 'Mathematics', 'Science', 'Social Science', 'Environmental & Integrated Studies',
  'Commerce & Accounts', 'Computer Science', 'Arts & Music', 'Physical Education & Health', 'Vocational', 'Other'));

UPDATE subjects SET category = CASE
  WHEN code IN ('ENG', 'TAM', 'HIN') OR name ~* '(english|tamil|hindi|sanskrit|french|german|urdu|arabic|telugu|kannada|malayalam|language)' THEN 'Languages'
  WHEN code = 'MAT' OR name ~* '(math|statistic)' THEN 'Mathematics'
  WHEN code IN ('SCI', 'PHY') OR name ~* '(science|physics|chemistry|biology|botany|zoology)' AND name !~* 'social|computer' THEN 'Science'
  WHEN code = 'SST' OR name ~* '(social|history|geography|civics|economics|political)' THEN 'Social Science'
  WHEN code = 'CMP' OR name ~* '(computer|computing|informatics|ict)' THEN 'Computer Science'
  WHEN code = 'ART' OR name ~* '(art|music|dance|drama|painting)' THEN 'Arts & Music'
  WHEN name ~* '(physical education|sport|health|yoga)' THEN 'Physical Education & Health'
  WHEN name ~* '(accountancy|commerce|business)' THEN 'Commerce & Accounts'
  ELSE 'Other'
END
WHERE category IS NULL;
