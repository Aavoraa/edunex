-- =============================================================================
-- 001 CORE — identity, RBAC, organisation, people, academic structure
-- Conventions
--   * uuid primary keys (non-enumerable, safe to expose to web + mobile clients)
--   * human-readable business codes (admission_no, employee_code …) are UNIQUE
--   * created_at / updated_at on every table, updated_at maintained by trigger
--   * created_by / updated_by on business records
--   * deleted_at soft delete on master records (students, parents, employees …)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attaches the updated_at trigger to a table. Called after every CREATE TABLE.
CREATE OR REPLACE FUNCTION attach_updated_at(tbl regclass) RETURNS void AS $$
BEGIN
  EXECUTE format('CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
                 replace(tbl::text, '.', '_'), tbl);
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Organisation
-- ---------------------------------------------------------------------------
CREATE TABLE campuses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text NOT NULL UNIQUE,                 -- gdv, vdv, plc
  name          text NOT NULL,
  place         text NOT NULL,
  short_name    text NOT NULL,
  curriculum    text,
  established   int,
  latitude      numeric(9,6),
  longitude     numeric(9,6),
  address       text,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('campuses');

CREATE TABLE academic_years (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label       text NOT NULL UNIQUE,                   -- 2026–27
  starts_on   date NOT NULL,
  ends_on     date NOT NULL,
  is_current  boolean NOT NULL DEFAULT false,
  is_locked   boolean NOT NULL DEFAULT false,         -- archived years are read-only
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on > starts_on)
);
SELECT attach_updated_at('academic_years');
CREATE UNIQUE INDEX ux_academic_years_current ON academic_years (is_current) WHERE is_current;

-- ---------------------------------------------------------------------------
-- RBAC
-- ---------------------------------------------------------------------------
CREATE TABLE roles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key          text NOT NULL UNIQUE,                  -- super_admin, principal, parent …
  name         text NOT NULL,
  description  text,
  home_route   text NOT NULL DEFAULT '/dashboard',
  scope        text NOT NULL DEFAULT 'school'         -- school | self | family | class
               CHECK (scope IN ('school', 'self', 'family', 'class')),
  is_system    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('roles');

CREATE TABLE permissions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key          text NOT NULL UNIQUE,                  -- students.read, tracking.read_all …
  module       text NOT NULL,
  description  text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE role_permissions (
  role_id        uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id  uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE users (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email               citext NOT NULL UNIQUE,
  phone               text UNIQUE,
  password_hash       text NOT NULL,
  full_name           text NOT NULL,
  title               text,
  role_id             uuid NOT NULL REFERENCES roles(id),
  campus_id           uuid REFERENCES campuses(id),
  avatar_url          text,
  preferred_language  text NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('en', 'ta', 'hi')),
  status              text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'invited')),
  failed_login_count  int NOT NULL DEFAULT 0,
  locked_until        timestamptz,
  last_login_at       timestamptz,
  password_changed_at timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);
SELECT attach_updated_at('users');
CREATE INDEX ix_users_role ON users (role_id) WHERE deleted_at IS NULL;

-- Refresh-token rotation with reuse detection (token family).
CREATE TABLE refresh_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id    uuid NOT NULL,
  token_hash   text NOT NULL UNIQUE,
  expires_at   timestamptz NOT NULL,
  revoked_at   timestamptz,
  replaced_by  uuid REFERENCES refresh_tokens(id),
  client_type  text NOT NULL DEFAULT 'web' CHECK (client_type IN ('web', 'mobile', 'integration')),
  user_agent   text,
  ip_address   inet,
  last_used_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_refresh_tokens_user ON refresh_tokens (user_id) WHERE revoked_at IS NULL;
CREATE INDEX ix_refresh_tokens_family ON refresh_tokens (family_id);

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------
CREATE TABLE employees (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  employee_code   text NOT NULL UNIQUE,               -- EMP-1021
  full_name       text NOT NULL,
  gender          text CHECK (gender IN ('M', 'F', 'O')),
  date_of_birth   date,
  phone           text,
  email           citext,
  campus_id       uuid NOT NULL REFERENCES campuses(id),
  department      text NOT NULL,
  designation     text NOT NULL,
  employee_type   text NOT NULL CHECK (employee_type IN ('teaching', 'non_teaching')),
  category        text NOT NULL,                      -- Teachers, Security, Drivers & Attendants …
  shift_name      text,
  join_date       date,
  employment_status text NOT NULL DEFAULT 'active' CHECK (employment_status IN ('active', 'on_notice', 'exited')),
  basic_salary    numeric(12,2) NOT NULL DEFAULT 0,
  bank_account_masked text,
  workload_periods int NOT NULL DEFAULT 0,
  cpd_hours       int NOT NULL DEFAULT 0,
  background_verified boolean NOT NULL DEFAULT false,
  created_by      uuid REFERENCES users(id),
  updated_by      uuid REFERENCES users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
SELECT attach_updated_at('employees');
CREATE INDEX ix_employees_campus ON employees (campus_id) WHERE deleted_at IS NULL;
CREATE INDEX ix_employees_type ON employees (employee_type) WHERE deleted_at IS NULL;

-- Teaching-specific attributes (1:1 with employees)
CREATE TABLE teachers (
  employee_id       uuid PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,
  qualification     text,
  specialisation    text,
  is_mentor         boolean NOT NULL DEFAULT false,
  max_periods_week  int NOT NULL DEFAULT 30,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('teachers');

-- Non-teaching-specific attributes (1:1 with employees)
CREATE TABLE non_teaching_staff (
  employee_id        uuid PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,
  staff_category     text NOT NULL,                  -- Security, Transport, Housekeeping …
  licence_no_masked  text,
  licence_expiry     date,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('non_teaching_staff');

CREATE TABLE parents (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  parent_code      text NOT NULL UNIQUE,              -- PAR-0001
  full_name        text NOT NULL,
  phone            text NOT NULL,
  alt_phone        text,
  email            citext,
  occupation       text,
  address          text,
  preferred_channel text NOT NULL DEFAULT 'whatsapp' CHECK (preferred_channel IN ('whatsapp', 'sms', 'email', 'push', 'call')),
  engagement_score int NOT NULL DEFAULT 0 CHECK (engagement_score BETWEEN 0 AND 100),
  last_contact_at  timestamptz,
  last_contact_channel text,
  created_by       uuid REFERENCES users(id),
  updated_by       uuid REFERENCES users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);
SELECT attach_updated_at('parents');

-- ---------------------------------------------------------------------------
-- Academic structure
-- ---------------------------------------------------------------------------
CREATE TABLE classes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id    uuid NOT NULL REFERENCES campuses(id),
  name         text NOT NULL,                         -- Grade 5
  grade_level  int NOT NULL,
  stage        text,                                  -- Cambridge Primary …
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campus_id, grade_level)
);
SELECT attach_updated_at('classes');

CREATE TABLE sections (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id           uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  academic_year_id   uuid NOT NULL REFERENCES academic_years(id),
  name               text NOT NULL,                   -- A, B, C
  class_teacher_id   uuid REFERENCES employees(id),
  room               text,
  capacity           int NOT NULL DEFAULT 35,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, academic_year_id, name)
);
SELECT attach_updated_at('sections');

CREATE TABLE subjects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,
  name        text NOT NULL,
  stage       text,
  is_core     boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('subjects');

-- Which teacher teaches which subject to which section (drives teacher scoping)
CREATE TABLE teacher_assignments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id       uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  section_id        uuid NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  subject_id        uuid NOT NULL REFERENCES subjects(id),
  academic_year_id  uuid NOT NULL REFERENCES academic_years(id),
  periods_per_week  int NOT NULL DEFAULT 5,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, section_id, subject_id, academic_year_id)
);
SELECT attach_updated_at('teacher_assignments');
CREATE INDEX ix_teacher_assignments_section ON teacher_assignments (section_id);

-- ---------------------------------------------------------------------------
-- Students
-- ---------------------------------------------------------------------------
CREATE TABLE students (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_no      text NOT NULL UNIQUE,             -- HS-2026-1041
  first_name        text NOT NULL,
  last_name         text NOT NULL,
  full_name         text GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
  photo_url         text,
  date_of_birth     date NOT NULL,
  gender            text NOT NULL CHECK (gender IN ('M', 'F', 'O')),
  blood_group       text,
  campus_id         uuid NOT NULL REFERENCES campuses(id),
  section_id        uuid REFERENCES sections(id),     -- current section (denormalised from enrollments)
  academic_year_id  uuid REFERENCES academic_years(id),
  house             text,
  address           text,
  city              text,
  pincode           text,
  email             citext,
  phone             text,
  admitted_on       date,
  status            text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'alumni', 'transferred', 'withdrawn')),
  risk_level        text NOT NULL DEFAULT 'On Track' CHECK (risk_level IN ('On Track', 'Watch', 'Developing Risk', 'At Risk')),
  class_teacher_note text,
  counsellor_id     uuid REFERENCES employees(id),
  medical_notes     text,
  user_id           uuid UNIQUE REFERENCES users(id) ON DELETE SET NULL,  -- student login (optional)
  created_by        uuid REFERENCES users(id),
  updated_by        uuid REFERENCES users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);
SELECT attach_updated_at('students');
CREATE INDEX ix_students_section ON students (section_id) WHERE deleted_at IS NULL;
CREATE INDEX ix_students_campus ON students (campus_id) WHERE deleted_at IS NULL;
CREATE INDEX ix_students_name_lower ON students (lower(full_name));

CREATE TABLE enrollments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  section_id        uuid NOT NULL REFERENCES sections(id),
  academic_year_id  uuid NOT NULL REFERENCES academic_years(id),
  roll_no           int,
  status            text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'promoted', 'transferred', 'withdrawn')),
  enrolled_on       date NOT NULL DEFAULT current_date,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, academic_year_id)
);
SELECT attach_updated_at('enrollments');
CREATE INDEX ix_enrollments_section ON enrollments (section_id);

CREATE TABLE student_guardians (
  student_id    uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  parent_id     uuid NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  relationship  text NOT NULL,                        -- Father, Mother, Guardian
  is_primary    boolean NOT NULL DEFAULT false,
  can_pickup    boolean NOT NULL DEFAULT true,
  can_view_tracking boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, parent_id)
);
CREATE INDEX ix_student_guardians_parent ON student_guardians (parent_id);

-- ---------------------------------------------------------------------------
-- System
-- ---------------------------------------------------------------------------
CREATE TABLE system_settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  description text,
  is_public   boolean NOT NULL DEFAULT false,         -- safe to expose to unauthenticated clients
  updated_by  uuid REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('system_settings');

CREATE TABLE audit_logs (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      uuid REFERENCES users(id) ON DELETE SET NULL,
  user_name    text,
  role_key     text,
  action       text NOT NULL,                         -- create, update, delete, view, login …
  module       text NOT NULL,                         -- students, tracking, auth …
  entity_type  text,
  entity_id    text,
  description  text NOT NULL,
  ip_address   inet,
  user_agent   text,
  device       text,                                  -- web | mobile | integration
  metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_audit_logs_created ON audit_logs (created_at DESC);
CREATE INDEX ix_audit_logs_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX ix_audit_logs_user ON audit_logs (user_id, created_at DESC);
CREATE INDEX ix_audit_logs_module ON audit_logs (module, created_at DESC);
