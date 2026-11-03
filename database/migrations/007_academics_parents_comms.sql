-- =============================================================================
-- 007 ACADEMICS (extended), PARENT EXPERIENCE, COMMUNICATION, NOTIFICATIONS
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Academics
-- ---------------------------------------------------------------------------
CREATE TABLE curriculum_stages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,                   -- Cambridge Primary …
  grades      text NOT NULL,                          -- Grade 1–6
  sort_order  int NOT NULL,
  coverage_pct int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('curriculum_stages');

CREATE TABLE learning_objectives (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code         text NOT NULL UNIQUE,                  -- 5Nf.03
  description  text NOT NULL,
  subject_id   uuid NOT NULL REFERENCES subjects(id),
  stage_label  text NOT NULL,                         -- Primary 5
  coverage_pct int NOT NULL DEFAULT 0,
  mastery_pct  int NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('learning_objectives');

CREATE TABLE periods (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id   uuid NOT NULL REFERENCES campuses(id),
  period_no   int NOT NULL,
  starts_at   time NOT NULL,
  ends_at     time NOT NULL,
  UNIQUE (campus_id, period_no)
);

CREATE TABLE timetable_entries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id    uuid NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  day_of_week   int NOT NULL CHECK (day_of_week BETWEEN 1 AND 6),
  period_id     uuid NOT NULL REFERENCES periods(id),
  subject_id    uuid REFERENCES subjects(id),
  activity      text,                                 -- Games, Library, Club, Assembly
  employee_id   uuid REFERENCES employees(id),
  substitute_id uuid REFERENCES employees(id),
  room          text,
  needs_substitute boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (section_id, day_of_week, period_id)
);
SELECT attach_updated_at('timetable_entries');
CREATE INDEX ix_timetable_teacher ON timetable_entries (employee_id, day_of_week);

CREATE TABLE lesson_plans (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title          text NOT NULL,
  section_id     uuid REFERENCES sections(id),
  subject_id     uuid NOT NULL REFERENCES subjects(id),
  objective_id   uuid REFERENCES learning_objectives(id),
  planned_for    date,
  content        jsonb NOT NULL DEFAULT '{}'::jsonb,  -- objective, plan steps, activities, differentiation, quiz
  ai_generated   boolean NOT NULL DEFAULT false,
  status         text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected')),
  author_id      uuid NOT NULL REFERENCES employees(id),
  approved_by    uuid REFERENCES users(id),
  approved_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('lesson_plans');

CREATE TABLE homework (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id    uuid NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  subject_id    uuid NOT NULL REFERENCES subjects(id),
  title         text NOT NULL,
  instructions  text,
  assigned_on   date NOT NULL DEFAULT current_date,
  due_on        date NOT NULL,
  status        text NOT NULL DEFAULT 'Open' CHECK (status IN ('Draft', 'Open', 'Closed')),
  assigned_by   uuid REFERENCES employees(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('homework');

CREATE TABLE homework_submissions (
  homework_id   uuid NOT NULL REFERENCES homework(id) ON DELETE CASCADE,
  student_id    uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  submitted_at  timestamptz NOT NULL DEFAULT now(),
  status        text NOT NULL DEFAULT 'Submitted' CHECK (status IN ('Submitted', 'Late', 'Reviewed')),
  feedback      text,
  PRIMARY KEY (homework_id, student_id)
);

CREATE TABLE question_bank (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id    uuid NOT NULL REFERENCES subjects(id),
  topic         text NOT NULL,
  stage_label   text NOT NULL,
  question      text NOT NULL,
  question_type text NOT NULL DEFAULT 'short' CHECK (question_type IN ('mcq', 'short', 'long', 'numeric')),
  difficulty    text NOT NULL DEFAULT 'Core' CHECK (difficulty IN ('Foundation', 'Core', 'Higher')),
  marks         int NOT NULL DEFAULT 1,
  times_used    int NOT NULL DEFAULT 0,
  status        text NOT NULL DEFAULT 'Approved' CHECK (status IN ('Draft', 'Approved', 'Retired')),
  created_by    uuid REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('question_bank');

-- Report card workflow per section:
-- 0 Marks entry → 1 Moderation → 2 AI draft comments → 3 Teacher review → 4 Approval → 5 Parent release
CREATE TABLE report_card_batches (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id        uuid NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  academic_year_id  uuid NOT NULL REFERENCES academic_years(id),
  term              text NOT NULL,
  stage             int NOT NULL DEFAULT 0 CHECK (stage BETWEEN 0 AND 5),
  due_on            date NOT NULL,
  released_at       timestamptz,
  approved_by       uuid REFERENCES users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (section_id, academic_year_id, term)
);
SELECT attach_updated_at('report_card_batches');

CREATE TABLE report_card_comments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id      uuid NOT NULL REFERENCES report_card_batches(id) ON DELETE CASCADE,
  student_id    uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  comment       text NOT NULL,
  ai_drafted    boolean NOT NULL DEFAULT false,
  status        text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Approved', 'Rejected')),
  reviewed_by   uuid REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, student_id)
);
SELECT attach_updated_at('report_card_comments');

-- AI outputs always pass Review → Edit → Approve with a named human approver
CREATE TABLE ai_drafts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_type    text NOT NULL CHECK (draft_type IN ('lesson', 'worksheet', 'quiz', 'comment', 'message', 'brief')),
  prompt        jsonb NOT NULL DEFAULT '{}'::jsonb,
  output        jsonb NOT NULL DEFAULT '{}'::jsonb,
  status        text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Under Review', 'Approved', 'Rejected')),
  requested_by  uuid NOT NULL REFERENCES users(id),
  approved_by   uuid REFERENCES users(id),
  approved_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('ai_drafts');

CREATE TABLE knowledge_documents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  section      text,
  body         text NOT NULL,
  keywords     text[] NOT NULL DEFAULT '{}',
  audience     text[] NOT NULL DEFAULT '{}',          -- role keys allowed to see answers from it
  is_approved  boolean NOT NULL DEFAULT true,
  source_updated_on date,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('knowledge_documents');

-- ---------------------------------------------------------------------------
-- Parent experience
-- ---------------------------------------------------------------------------
CREATE TABLE events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id    uuid REFERENCES campuses(id),
  title        text NOT NULL,
  description  text,
  event_type   text NOT NULL DEFAULT 'School' CHECK (event_type IN ('School', 'Sports', 'Academic', 'PTM', 'Cultural', 'Holiday')),
  starts_on    date NOT NULL,
  ends_on      date,
  venue        text,
  audience     text NOT NULL DEFAULT 'All parents',
  status       text NOT NULL DEFAULT 'Published' CHECK (status IN ('Draft', 'Published', 'Cancelled')),
  created_by   uuid REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('events');
CREATE INDEX ix_events_starts ON events (starts_on);

CREATE TABLE circulars (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id      uuid REFERENCES campuses(id),
  title          text NOT NULL,
  body           text NOT NULL,
  audience       text NOT NULL,                       -- All parents, Grades 3–10 …
  audience_filter jsonb NOT NULL DEFAULT '{}'::jsonb, -- {grades:[...], routes:[...]}
  requires_ack   boolean NOT NULL DEFAULT true,
  status         text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Under Review', 'Released', 'Withdrawn')),
  published_at   timestamptz,
  target_count   int NOT NULL DEFAULT 0,
  created_by     uuid REFERENCES users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('circulars');

CREATE TABLE circular_acknowledgements (
  circular_id      uuid NOT NULL REFERENCES circulars(id) ON DELETE CASCADE,
  parent_id        uuid NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  acknowledged_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (circular_id, parent_id)
);

CREATE TABLE ptm_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   uuid NOT NULL REFERENCES employees(id),
  section_id    uuid REFERENCES sections(id),
  subject_label text NOT NULL,                        -- Mathematics · Grade 5A
  session_date  date NOT NULL,
  starts_at     time NOT NULL DEFAULT '09:00',
  slot_minutes  int NOT NULL DEFAULT 10,
  total_slots   int NOT NULL CHECK (total_slots > 0),
  venue         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('ptm_sessions');

CREATE TABLE ptm_bookings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ptm_session_id uuid NOT NULL REFERENCES ptm_sessions(id) ON DELETE CASCADE,
  slot_no        int NOT NULL,
  parent_id      uuid NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  student_id     uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status         text NOT NULL DEFAULT 'Booked' CHECK (status IN ('Booked', 'Attended', 'Cancelled', 'No-show')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ptm_session_id, slot_no)
);
SELECT attach_updated_at('ptm_bookings');

-- ---------------------------------------------------------------------------
-- Communication
-- ---------------------------------------------------------------------------
-- One communication history across WhatsApp, email, SMS, calls and notes (CRM)
CREATE TABLE communications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel         text NOT NULL CHECK (channel IN ('WhatsApp', 'Email', 'SMS', 'Call', 'Note', 'In-app')),
  direction       text NOT NULL DEFAULT 'outbound' CHECK (direction IN ('inbound', 'outbound', 'internal')),
  parent_id       uuid REFERENCES parents(id) ON DELETE SET NULL,
  enquiry_id      uuid REFERENCES enquiries(id) ON DELETE SET NULL,
  student_id      uuid REFERENCES students(id) ON DELETE SET NULL,
  counterpart     text NOT NULL,                      -- display name / group
  subject         text NOT NULL,
  body            text,
  status          text NOT NULL DEFAULT 'Queued',     -- Queued, Delivered, Opened, No answer, Internal, Failed
  recipients      int NOT NULL DEFAULT 1,
  needs_reply     boolean NOT NULL DEFAULT false,
  replied_at      timestamptz,
  sent_by         uuid REFERENCES users(id),
  occurred_at     timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('communications');
CREATE INDEX ix_communications_parent ON communications (parent_id, occurred_at DESC);
CREATE INDEX ix_communications_time ON communications (occurred_at DESC);

-- Direct in-app messages between users (parent ↔ teacher etc.)
CREATE TABLE message_threads (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject      text NOT NULL,
  student_id   uuid REFERENCES students(id) ON DELETE SET NULL,
  created_by   uuid NOT NULL REFERENCES users(id),
  last_message_at timestamptz NOT NULL DEFAULT now(),
  status       text NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Closed')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('message_threads');

CREATE TABLE message_thread_participants (
  thread_id     uuid NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_at  timestamptz,
  PRIMARY KEY (thread_id, user_id)
);
CREATE INDEX ix_thread_participants_user ON message_thread_participants (user_id);

CREATE TABLE messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id   uuid NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  sender_id   uuid NOT NULL REFERENCES users(id),
  body        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_messages_thread ON messages (thread_id, created_at);

-- ---------------------------------------------------------------------------
-- Notifications (in-app + outbox for WhatsApp / SMS / Email / Push)
-- ---------------------------------------------------------------------------
CREATE TABLE notifications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category      text NOT NULL CHECK (category IN ('Critical', 'Attention', 'Information', 'Completed')),
  tone          text NOT NULL DEFAULT 'info' CHECK (tone IN ('critical', 'warning', 'caution', 'info', 'success', 'neutral')),
  icon          text NOT NULL DEFAULT 'bell',
  topic         text NOT NULL DEFAULT 'system',       -- attendance, tracking, fees, admissions, system …
  title         text NOT NULL,
  body          text,
  route         text,                                 -- client route to open
  entity_type   text,
  entity_id     text,
  read_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_notifications_user ON notifications (user_id, created_at DESC);
CREATE INDEX ix_notifications_unread ON notifications (user_id) WHERE read_at IS NULL;

CREATE TABLE notification_deliveries (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id  uuid NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  channel          text NOT NULL CHECK (channel IN ('whatsapp', 'sms', 'email', 'push')),
  destination      text,
  status           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'skipped')),
  provider         text,
  provider_ref     text,
  attempts         int NOT NULL DEFAULT 0,
  last_error       text,
  next_attempt_at  timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('notification_deliveries');
CREATE INDEX ix_notification_deliveries_pending ON notification_deliveries (next_attempt_at) WHERE status = 'pending';

CREATE TABLE notification_preferences (
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic       text NOT NULL,
  in_app      boolean NOT NULL DEFAULT true,
  whatsapp    boolean NOT NULL DEFAULT true,
  sms         boolean NOT NULL DEFAULT false,
  email       boolean NOT NULL DEFAULT true,
  push        boolean NOT NULL DEFAULT true,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, topic)
);

CREATE TABLE device_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform    text NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  token       text NOT NULL UNIQUE,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Tasks & approvals
-- ---------------------------------------------------------------------------
CREATE TABLE tasks (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code           text NOT NULL UNIQUE,                -- T-551
  title          text NOT NULL,
  module         text NOT NULL,
  assignee_user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  assignee_role_key text,                             -- when assigned to everyone holding a role
  due_on         date,
  priority       text NOT NULL DEFAULT 'Medium' CHECK (priority IN ('High', 'Medium', 'Low')),
  status         text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Under Review', 'Completed', 'Cancelled')),
  route          text,
  entity_type    text,
  entity_id      text,
  completed_at   timestamptz,
  completed_by   uuid REFERENCES users(id),
  created_by     uuid REFERENCES users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (assignee_user_id IS NOT NULL OR assignee_role_key IS NOT NULL)
);
SELECT attach_updated_at('tasks');
CREATE INDEX ix_tasks_user ON tasks (assignee_user_id) WHERE status <> 'Completed';
CREATE INDEX ix_tasks_role ON tasks (assignee_role_key) WHERE status <> 'Completed';
