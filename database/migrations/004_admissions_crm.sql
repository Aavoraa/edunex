-- =============================================================================
-- 004 ADMISSIONS & CRM — enquiries (leads), follow-ups, applications,
-- referrals, alumni, vendors, partners
-- Pipeline: New Lead → Contacted → Qualified → Visit Scheduled → Visit Completed
--           → Application → Assessment → Offer → Enrolled (or Lost)
-- =============================================================================

CREATE TABLE enquiries (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code               text NOT NULL UNIQUE,            -- LD-4412
  campus_id          uuid NOT NULL REFERENCES campuses(id),
  academic_year_id   uuid REFERENCES academic_years(id),
  parent_name        text NOT NULL,
  phone              text NOT NULL,
  email              citext,
  student_name       text NOT NULL,
  student_dob        date,
  grade_applied      text NOT NULL,
  curriculum         text,
  source             text NOT NULL CHECK (source IN ('WhatsApp', 'Website', 'Meta Ads', 'Referral', 'Google', 'Walk-in', 'Instagram', 'Phone')),
  campaign           text,
  stage              text NOT NULL DEFAULT 'New Lead' CHECK (stage IN (
                       'New Lead', 'Contacted', 'Qualified', 'Visit Scheduled', 'Visit Completed',
                       'Application', 'Assessment', 'Offer', 'Enrolled', 'Lost')),
  lead_score         int NOT NULL DEFAULT 50 CHECK (lead_score BETWEEN 0 AND 100),
  counsellor_id      uuid REFERENCES employees(id),
  transport_required boolean NOT NULL DEFAULT false,
  next_action        text,
  next_action_at     timestamptz,
  lost_reason        text,
  referred_by_parent_id uuid REFERENCES parents(id),
  acquisition_cost   numeric(10,2) NOT NULL DEFAULT 0,
  notes              text,
  created_by         uuid REFERENCES users(id),
  updated_by         uuid REFERENCES users(id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz
);
SELECT attach_updated_at('enquiries');
CREATE INDEX ix_enquiries_stage ON enquiries (stage) WHERE deleted_at IS NULL;
CREATE INDEX ix_enquiries_created ON enquiries (created_at DESC);

CREATE TABLE enquiry_stage_history (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  enquiry_id   uuid NOT NULL REFERENCES enquiries(id) ON DELETE CASCADE,
  from_stage   text,
  to_stage     text NOT NULL,
  changed_by   uuid REFERENCES users(id),
  note         text,
  changed_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_enquiry_stage_history ON enquiry_stage_history (enquiry_id, changed_at DESC);

CREATE TABLE follow_ups (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_id      uuid NOT NULL REFERENCES enquiries(id) ON DELETE CASCADE,
  follow_up_type  text NOT NULL CHECK (follow_up_type IN ('Call', 'WhatsApp', 'Email', 'SMS', 'Campus Visit', 'Meeting', 'Note')),
  scheduled_at    timestamptz NOT NULL,
  completed_at    timestamptz,
  outcome         text,
  notes           text,
  status          text NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'Completed', 'Missed', 'Cancelled')),
  assigned_to     uuid REFERENCES employees(id),
  created_by      uuid REFERENCES users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('follow_ups');
CREATE INDEX ix_follow_ups_due ON follow_ups (scheduled_at) WHERE completed_at IS NULL;
CREATE INDEX ix_follow_ups_enquiry ON follow_ups (enquiry_id);

CREATE TABLE admissions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_no    text NOT NULL UNIQUE,             -- APP-2026-0101
  enquiry_id        uuid REFERENCES enquiries(id),
  campus_id         uuid NOT NULL REFERENCES campuses(id),
  academic_year_id  uuid NOT NULL REFERENCES academic_years(id),
  student_name      text NOT NULL,
  date_of_birth     date,
  gender            text CHECK (gender IN ('M', 'F', 'O')),
  grade_applied     text NOT NULL,
  previous_school   text,
  status            text NOT NULL DEFAULT 'Submitted' CHECK (status IN (
                      'Draft', 'Submitted', 'Under Review', 'Assessment Scheduled', 'Offer Made',
                      'Accepted', 'Enrolled', 'Rejected', 'Withdrawn')),
  documents_complete boolean NOT NULL DEFAULT false,
  assessment_at     timestamptz,
  assessment_score  numeric(5,2),
  offer_expires_on  date,
  fee_paid          boolean NOT NULL DEFAULT false,
  student_id        uuid REFERENCES students(id),     -- set when enrolled → Student Master created
  decided_by        uuid REFERENCES users(id),
  decided_at        timestamptz,
  created_by        uuid REFERENCES users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('admissions');

CREATE TABLE referrals (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_parent_id uuid NOT NULL REFERENCES parents(id),
  enquiry_id         uuid REFERENCES enquiries(id),
  referred_name      text NOT NULL,
  status             text NOT NULL DEFAULT 'Submitted' CHECK (status IN ('Submitted', 'Contacted', 'Enrolled', 'Lost')),
  reward_status      text NOT NULL DEFAULT 'Not eligible' CHECK (reward_status IN ('Not eligible', 'Pending', 'Credited')),
  reward_amount      numeric(10,2) NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('referrals');

CREATE TABLE alumni (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name     text NOT NULL,
  batch_year    int NOT NULL,
  university    text,
  career        text,
  email         citext,
  phone         text,
  engagement    text NOT NULL DEFAULT 'Low' CHECK (engagement IN ('High', 'Medium', 'Low')),
  last_engagement text,
  student_id    uuid REFERENCES students(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('alumni');

CREATE TABLE vendors (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  category        text NOT NULL,
  contact_person  text,
  phone           text,
  email           citext,
  contract_start  date,
  contract_end    date,
  contract_value  numeric(14,2) NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Renewal due', 'Expired', 'Suspended')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('vendors');

CREATE TABLE partners (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  partner_type  text NOT NULL,                        -- Curriculum authority, Institution, Partner
  since_year    int,
  status        text NOT NULL DEFAULT 'Active',
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('partners');
