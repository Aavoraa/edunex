-- =============================================================================
-- 006 WORKFORCE — staff attendance, shifts, leave, overtime, allowances,
-- CPD, payroll runs and payslips
-- Payroll chain: Employee Master → Attendance → Leave → Overtime → Allowance
--                → Approval → Payroll → Payslip
-- =============================================================================

CREATE TABLE shifts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,                   -- General 08:00–16:00
  starts_at   time NOT NULL,
  ends_at     time NOT NULL,
  split_starts_at time,
  split_ends_at   time,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('shifts');

CREATE TABLE shift_rosters (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  shift_id     uuid NOT NULL REFERENCES shifts(id),
  roster_date  date NOT NULL,
  post         text,                                  -- Main Gate, Route 12 …
  status       text NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'Cover needed', 'Covered', 'Completed')),
  covered_by   uuid REFERENCES employees(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, roster_date)
);
SELECT attach_updated_at('shift_rosters');

CREATE TABLE staff_attendance (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  attendance_date date NOT NULL,
  status          text NOT NULL CHECK (status IN ('Present', 'Absent', 'Late', 'On Leave', 'Half Day')),
  check_in        time,
  check_out       time,
  source          text NOT NULL DEFAULT 'biometric' CHECK (source IN ('biometric', 'mobile', 'manual')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, attendance_date)
);
SELECT attach_updated_at('staff_attendance');
CREATE INDEX ix_staff_attendance_date ON staff_attendance (attendance_date);

CREATE TABLE leave_types (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL UNIQUE,               -- Casual leave, Sick leave, Earned leave
  annual_quota    int NOT NULL DEFAULT 12,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE leave_balances (
  employee_id       uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type_id     uuid NOT NULL REFERENCES leave_types(id),
  academic_year_id  uuid NOT NULL REFERENCES academic_years(id),
  entitled          numeric(5,1) NOT NULL,
  used              numeric(5,1) NOT NULL DEFAULT 0,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (employee_id, leave_type_id, academic_year_id)
);

CREATE TABLE leave_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL UNIQUE,               -- LV-882
  employee_id     uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type_id   uuid NOT NULL REFERENCES leave_types(id),
  from_date       date NOT NULL,
  to_date         date NOT NULL,
  days            numeric(4,1) NOT NULL CHECK (days > 0),
  reason          text,
  cover_arrangement text,
  status          text NOT NULL DEFAULT 'Submitted' CHECK (status IN ('Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected', 'Cancelled')),
  decided_by      uuid REFERENCES users(id),
  decided_at      timestamptz,
  decision_note   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (to_date >= from_date)
);
SELECT attach_updated_at('leave_requests');
CREATE INDEX ix_leave_requests_status ON leave_requests (status);

CREATE TABLE overtime_entries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  work_date     date NOT NULL,
  hours         numeric(4,1) NOT NULL CHECK (hours > 0),
  reason        text NOT NULL,
  rate_per_hour numeric(10,2) NOT NULL DEFAULT 0,
  status        text NOT NULL DEFAULT 'Submitted' CHECK (status IN ('Submitted', 'Under Review', 'Approved', 'Rejected', 'Paid')),
  approved_by   uuid REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('overtime_entries');

CREATE TABLE allowances (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  allowance_type text NOT NULL,                       -- House rent, Conveyance, Special, Transport duty …
  amount        numeric(12,2) NOT NULL CHECK (amount >= 0),
  frequency     text NOT NULL DEFAULT 'Monthly' CHECK (frequency IN ('Monthly', 'One-time')),
  effective_month date NOT NULL,
  status        text NOT NULL DEFAULT 'Approved' CHECK (status IN ('Submitted', 'Approved', 'Rejected', 'Stopped')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('allowances');

CREATE TABLE cpd_records (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  programme     text NOT NULL,
  provider      text,
  hours         int NOT NULL CHECK (hours > 0),
  completed_on  date,
  status        text NOT NULL DEFAULT 'Completed' CHECK (status IN ('Planned', 'In Progress', 'Completed')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('cpd_records');

-- Seven-stage run: Draft → Inputs → Calculated → Under Review → Approved → Released → Paid
CREATE TABLE payroll_runs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id      uuid REFERENCES campuses(id),
  pay_month      date NOT NULL,                       -- first day of month
  status         text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Inputs', 'Calculated', 'Under Review', 'Approved', 'Released', 'Paid')),
  employee_count int NOT NULL DEFAULT 0,
  gross_total    numeric(14,2) NOT NULL DEFAULT 0,
  deductions_total numeric(14,2) NOT NULL DEFAULT 0,
  overtime_total numeric(14,2) NOT NULL DEFAULT 0,
  allowances_total numeric(14,2) NOT NULL DEFAULT 0,
  net_total      numeric(14,2) NOT NULL DEFAULT 0,
  approved_by    uuid REFERENCES users(id),
  approved_at    timestamptz,
  released_at    timestamptz,
  created_by     uuid REFERENCES users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campus_id, pay_month)
);
SELECT attach_updated_at('payroll_runs');

ALTER TABLE reimbursements
  ADD CONSTRAINT fk_reimbursements_run FOREIGN KEY (paid_in_run_id) REFERENCES payroll_runs(id);

CREATE TABLE payslips (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id  uuid NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id     uuid NOT NULL REFERENCES employees(id),
  earnings        jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{label, amount}]
  deductions      jsonb NOT NULL DEFAULT '[]'::jsonb,
  gross           numeric(12,2) NOT NULL,
  total_deductions numeric(12,2) NOT NULL,
  net             numeric(12,2) NOT NULL,
  days_worked     numeric(4,1),
  status          text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Released')),
  released_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payroll_run_id, employee_id)
);
SELECT attach_updated_at('payslips');
CREATE INDEX ix_payslips_employee ON payslips (employee_id);
