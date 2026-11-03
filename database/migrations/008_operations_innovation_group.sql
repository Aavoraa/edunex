-- =============================================================================
-- 008 OPERATIONS, INNOVATION LAB, GROUP MANAGEMENT
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Operations
-- ---------------------------------------------------------------------------
CREATE TABLE facilities (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id    uuid NOT NULL REFERENCES campuses(id),
  name         text NOT NULL,
  facility_type text NOT NULL,                        -- Classroom, Lab, Hall, Field, Library
  capacity     int,
  status       text NOT NULL DEFAULT 'Available' CHECK (status IN ('Available', 'In use', 'Maintenance', 'Closed')),
  utilisation_pct int NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('facilities');

CREATE TABLE assets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL UNIQUE,               -- AST-2201
  campus_id       uuid NOT NULL REFERENCES campuses(id),
  name            text NOT NULL,
  category        text NOT NULL,                      -- IT, Lab, Vehicle, Facilities, Furniture
  location        text,
  facility_id     uuid REFERENCES facilities(id),
  assigned_to     uuid REFERENCES employees(id),
  purchased_on    date,
  purchase_value  numeric(14,2),
  next_service_on date,
  status          text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Maintenance due', 'In maintenance', 'Retired')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
SELECT attach_updated_at('assets');

CREATE TABLE maintenance_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text NOT NULL UNIQUE,                 -- MR-661
  campus_id     uuid NOT NULL REFERENCES campuses(id),
  asset_id      uuid REFERENCES assets(id),
  facility_id   uuid REFERENCES facilities(id),
  description   text NOT NULL,
  priority      text NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
  status        text NOT NULL DEFAULT 'Submitted' CHECK (status IN ('Submitted', 'Under Review', 'Approved', 'In Progress', 'Completed', 'Rejected')),
  raised_by     uuid REFERENCES employees(id),
  assigned_to   uuid REFERENCES employees(id),
  raised_on     date NOT NULL DEFAULT current_date,
  completed_at  timestamptz,
  cost          numeric(12,2),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('maintenance_requests');

CREATE TABLE inventory_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku           text NOT NULL UNIQUE,
  campus_id     uuid NOT NULL REFERENCES campuses(id),
  name          text NOT NULL,
  category      text NOT NULL,                        -- Stationery, Lab consumables, Uniform, Cleaning
  unit          text NOT NULL DEFAULT 'pcs',
  quantity      int NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  reorder_level int NOT NULL DEFAULT 0,
  unit_cost     numeric(10,2) NOT NULL DEFAULT 0,
  vendor_id     uuid REFERENCES vendors(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('inventory_items');

CREATE TABLE inventory_movements (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  item_id       uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN ('in', 'out', 'adjust')),
  quantity      int NOT NULL,
  note          text,
  moved_by      uuid REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE certificates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_type text NOT NULL CHECK (certificate_type IN ('Transfer certificate', 'Bonafide certificate', 'Conduct certificate', 'Study certificate', 'Achievement certificate')),
  student_id      uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  requested_on    date NOT NULL DEFAULT current_date,
  purpose         text,
  status          text NOT NULL DEFAULT 'Submitted' CHECK (status IN ('Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected', 'Issued')),
  verification_code text UNIQUE,                      -- QR payload, e.g. TC-2026-0341
  issued_at       timestamptz,
  approved_by     uuid REFERENCES users(id),
  requested_by    uuid REFERENCES users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('certificates');

CREATE TABLE compliance_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id    uuid NOT NULL REFERENCES campuses(id),
  item         text NOT NULL,
  authority    text NOT NULL,
  due_on       date NOT NULL,
  owner_name   text NOT NULL,
  owner_id     uuid REFERENCES employees(id),
  status       text NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'In Progress', 'Due Soon', 'Overdue', 'Completed')),
  completed_on date,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('compliance_items');

-- ---------------------------------------------------------------------------
-- Innovation lab: Idea → Review → Mentor → Project → Prototype → Competition → Achievement
-- ---------------------------------------------------------------------------
CREATE TABLE innovation_ideas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  problem       text,
  student_id    uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  category      text,
  status        text NOT NULL DEFAULT 'Submitted' CHECK (status IN ('Submitted', 'Under Review', 'Accepted', 'Declined', 'Converted')),
  reviewed_by   uuid REFERENCES employees(id),
  submitted_on  date NOT NULL DEFAULT current_date,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('innovation_ideas');

CREATE TABLE innovation_projects (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text NOT NULL UNIQUE,                 -- IP-091
  title         text NOT NULL,
  summary       text,
  idea_id       uuid REFERENCES innovation_ideas(id),
  lead_student_id uuid NOT NULL REFERENCES students(id),
  mentor_id     uuid REFERENCES employees(id),
  stage         int NOT NULL DEFAULT 0 CHECK (stage BETWEEN 0 AND 6),
  status        text NOT NULL,
  started_on    date,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('innovation_projects');

CREATE TABLE innovation_project_members (
  project_id   uuid NOT NULL REFERENCES innovation_projects(id) ON DELETE CASCADE,
  student_id   uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  role         text NOT NULL DEFAULT 'Member',
  PRIMARY KEY (project_id, student_id)
);

CREATE TABLE innovation_milestones (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid NOT NULL REFERENCES innovation_projects(id) ON DELETE CASCADE,
  sequence     int NOT NULL,
  title        text NOT NULL,
  due_on       date,
  completed_on date,
  evidence     text,
  feedback     text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, sequence)
);
SELECT attach_updated_at('innovation_milestones');

CREATE TABLE competitions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  level        text NOT NULL DEFAULT 'District',
  held_on      date NOT NULL,
  teams        int NOT NULL DEFAULT 0,
  result       text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('competitions');

CREATE TABLE competition_entries (
  competition_id uuid NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  project_id     uuid NOT NULL REFERENCES innovation_projects(id) ON DELETE CASCADE,
  result         text,
  PRIMARY KEY (competition_id, project_id)
);

-- ---------------------------------------------------------------------------
-- Group management
-- ---------------------------------------------------------------------------
CREATE TABLE student_transfers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  from_campus_id  uuid NOT NULL REFERENCES campuses(id),
  to_campus_id    uuid NOT NULL REFERENCES campuses(id),
  reason          text NOT NULL,
  status          text NOT NULL DEFAULT 'Submitted' CHECK (status IN ('Submitted', 'Under Review', 'Approved', 'Rejected', 'Completed')),
  requested_on    date NOT NULL DEFAULT current_date,
  decided_by      uuid REFERENCES users(id),
  decided_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (from_campus_id <> to_campus_id)
);
SELECT attach_updated_at('student_transfers');

CREATE TABLE group_policies (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  scope        text NOT NULL DEFAULT 'All campuses',
  version      text NOT NULL,
  body         text,
  status       text NOT NULL DEFAULT 'Active' CHECK (status IN ('Draft', 'Under review', 'Active', 'Retired')),
  effective_on date,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('group_policies');

-- Periodic campus metrics that cannot be derived from transactional tables (e.g. NPS surveys)
CREATE TABLE campus_survey_metrics (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id    uuid NOT NULL REFERENCES campuses(id),
  metric       text NOT NULL,                         -- parent_nps
  value        numeric(8,2) NOT NULL,
  measured_on  date NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campus_id, metric, measured_on)
);
