-- =============================================================================
-- 002 STUDENT 360 — attendance, academics, assessments, development record
-- =============================================================================

CREATE TABLE attendance_records (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id     uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  section_id     uuid NOT NULL REFERENCES sections(id),
  attendance_date date NOT NULL,
  status         text NOT NULL CHECK (status IN ('present', 'absent', 'late', 'leave')),
  arrival_time   time,
  remarks        text,
  source         text NOT NULL DEFAULT 'teacher' CHECK (source IN ('teacher', 'gate', 'import', 'system')),
  marked_by      uuid REFERENCES users(id),
  parent_notified_at timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, attendance_date)
);
SELECT attach_updated_at('attendance_records');
CREATE INDEX ix_attendance_date_section ON attendance_records (attendance_date, section_id);
CREATE INDEX ix_attendance_student_date ON attendance_records (student_id, attendance_date DESC);

-- Term-wise results per subject (the "Student Academic Records")
CREATE TABLE student_academic_records (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  academic_year_id  uuid NOT NULL REFERENCES academic_years(id),
  subject_id        uuid NOT NULL REFERENCES subjects(id),
  term              text NOT NULL,                    -- Term 1, Term 2, Mid Yr, Term 4, Current
  term_order        int NOT NULL,
  score             numeric(5,2) NOT NULL CHECK (score BETWEEN 0 AND 100),
  grade             text,
  target_score      numeric(5,2),
  teacher_id        uuid REFERENCES employees(id),
  remarks           text,
  created_by        uuid REFERENCES users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, academic_year_id, subject_id, term)
);
SELECT attach_updated_at('student_academic_records');
CREATE INDEX ix_academic_records_student ON student_academic_records (student_id, term_order);

CREATE TABLE assessments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code              text NOT NULL UNIQUE,             -- AS-3312
  name              text NOT NULL,
  class_id          uuid NOT NULL REFERENCES classes(id),
  section_id        uuid REFERENCES sections(id),     -- null = whole grade
  subject_id        uuid NOT NULL REFERENCES subjects(id),
  academic_year_id  uuid NOT NULL REFERENCES academic_years(id),
  assessment_type   text NOT NULL DEFAULT 'test' CHECK (assessment_type IN ('test', 'exam', 'mock', 'quiz', 'project', 'unit_test')),
  held_on           date NOT NULL,
  max_marks         numeric(6,2) NOT NULL CHECK (max_marks > 0),
  status            text NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'In Progress', 'Moderation', 'Completed')),
  created_by        uuid REFERENCES users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('assessments');

CREATE TABLE assessment_marks (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id  uuid NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  student_id     uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  marks          numeric(6,2),
  is_absent      boolean NOT NULL DEFAULT false,
  grade          text,
  remarks        text,
  entered_by     uuid REFERENCES users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assessment_id, student_id)
);
SELECT attach_updated_at('assessment_marks');
CREATE INDEX ix_assessment_marks_student ON assessment_marks (student_id);

CREATE TABLE activities (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL UNIQUE,
  category     text NOT NULL,                         -- Club, Sport, Competition, Service
  coordinator_id uuid REFERENCES employees(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('activities');

CREATE TABLE student_activities (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  activity_id   uuid NOT NULL REFERENCES activities(id),
  role          text NOT NULL DEFAULT 'Member',
  since         date NOT NULL,
  hours         int NOT NULL DEFAULT 0,
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'left')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, activity_id)
);
SELECT attach_updated_at('student_activities');

CREATE TABLE achievements (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  title         text NOT NULL,
  achievement_type text NOT NULL,                     -- Competition, Academic, Co-curricular, Attendance
  level         text,                                 -- School, District, State, National
  achieved_on   date NOT NULL,
  is_verified   boolean NOT NULL DEFAULT false,
  verified_by   uuid REFERENCES users(id),
  verified_at   timestamptz,
  created_by    uuid REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('achievements');
CREATE INDEX ix_achievements_student ON achievements (student_id, achieved_on DESC);

CREATE TABLE behaviour_records (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  recorded_on   date NOT NULL,
  record_type   text NOT NULL CHECK (record_type IN ('Positive', 'Note', 'Concern', 'Incident')),
  note          text NOT NULL,
  recorded_by   uuid REFERENCES employees(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('behaviour_records');
CREATE INDEX ix_behaviour_student ON behaviour_records (student_id, recorded_on DESC);

CREATE TABLE student_skills (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  skill        text NOT NULL,                         -- Communication, Creativity …
  score        int NOT NULL CHECK (score BETWEEN 0 AND 100),
  confidence   text CHECK (confidence IN ('High', 'Medium', 'Emerging')),
  evidence     jsonb NOT NULL DEFAULT '[]'::jsonb,    -- list of evidence strings (Talent Discovery)
  assessed_on  date NOT NULL DEFAULT current_date,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, skill)
);
SELECT attach_updated_at('student_skills');

CREATE TABLE student_interests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  interest    text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, interest)
);

CREATE TABLE wellbeing_checkins (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  checked_on    date NOT NULL,
  mood          text NOT NULL,                        -- Settled, Anxious, Low …
  notes         text,
  is_confidential boolean NOT NULL DEFAULT false,
  recorded_by   uuid REFERENCES employees(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('wellbeing_checkins');

CREATE TABLE teacher_observations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  employee_id   uuid NOT NULL REFERENCES employees(id),
  observed_on   date NOT NULL,
  observation   text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('teacher_observations');

-- Early Warning: Signal → Teacher Review → Intervention → Action → Follow-up → Closed
CREATE TABLE early_warning_signals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text NOT NULL UNIQUE,                 -- SIG-341 / INT-118
  student_id    uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  signal        text NOT NULL,
  signal_type   text NOT NULL DEFAULT 'academic' CHECK (signal_type IN ('attendance', 'academic', 'behaviour', 'wellbeing', 'transport')),
  stage         int NOT NULL DEFAULT 0 CHECK (stage BETWEEN 0 AND 5),
  owner_id      uuid REFERENCES employees(id),
  raised_on     date NOT NULL DEFAULT current_date,
  action_plan   text,
  next_review_on date,
  review_decision text CHECK (review_decision IN ('accepted', 'dismissed')),
  reviewed_by   uuid REFERENCES users(id),
  reviewed_at   timestamptz,
  closed_at     timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('early_warning_signals');
CREATE INDEX ix_ews_student ON early_warning_signals (student_id);
CREATE INDEX ix_ews_open ON early_warning_signals (stage) WHERE closed_at IS NULL;

-- Documents (student, employee, school-level). Files live in object storage / uploads dir.
CREATE TABLE documents (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type     text NOT NULL CHECK (owner_type IN ('student', 'employee', 'school', 'admission', 'vehicle')),
  owner_id       uuid,
  student_id     uuid REFERENCES students(id) ON DELETE CASCADE,
  employee_id    uuid REFERENCES employees(id) ON DELETE CASCADE,
  name           text NOT NULL,
  category       text NOT NULL DEFAULT 'General',
  collection     text,                                -- folder name for school documents
  status         text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Submitted', 'Verified', 'Rejected', 'Expired')),
  storage_key    text,                                -- relative path in storage (never a public URL)
  original_name  text,
  mime_type      text,
  size_bytes     bigint,
  checksum_sha256 text,
  requested_on   date,
  verified_by    uuid REFERENCES users(id),
  verified_at    timestamptz,
  uploaded_by    uuid REFERENCES users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz
);
SELECT attach_updated_at('documents');
CREATE INDEX ix_documents_student ON documents (student_id) WHERE deleted_at IS NULL;
CREATE INDEX ix_documents_owner ON documents (owner_type, owner_id) WHERE deleted_at IS NULL;

-- Curated growth timeline entries (system events are merged in at query time)
CREATE TABLE student_timeline_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  occurred_on  date NOT NULL,
  title        text NOT NULL,
  body         text,
  category     text NOT NULL DEFAULT 'milestone',     -- admission, academic, activity, achievement, support
  tone         text NOT NULL DEFAULT 'neutral' CHECK (tone IN ('neutral', 'teal', 'amber', 'critical')),
  created_by   uuid REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_timeline_student ON student_timeline_events (student_id, occurred_on DESC);
