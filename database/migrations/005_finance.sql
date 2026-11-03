-- =============================================================================
-- 005 FINANCE — fee structures, invoices, payments, receipts, concessions,
-- scholarships, expenses, reimbursements, budgets, reconciliation
-- Money is numeric(14,2) in INR.
-- =============================================================================

CREATE TABLE fee_heads (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,                   -- TUITION, TRANSPORT …
  name        text NOT NULL,                          -- Tuition, Transport, Activities …
  is_optional boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('fee_heads');

CREATE TABLE fee_structures (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id  uuid NOT NULL REFERENCES academic_years(id),
  class_id          uuid NOT NULL REFERENCES classes(id),
  fee_head_id       uuid NOT NULL REFERENCES fee_heads(id),
  term              text NOT NULL,                    -- Term 1 / Term 2 / Term 3 / Annual
  amount            numeric(14,2) NOT NULL CHECK (amount >= 0),
  due_date          date NOT NULL,
  status            text NOT NULL DEFAULT 'Active' CHECK (status IN ('Draft', 'Active', 'Archived')),
  created_by        uuid REFERENCES users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (academic_year_id, class_id, fee_head_id, term)
);
SELECT attach_updated_at('fee_structures');

-- Charges raised against a student ("Fees")
CREATE TABLE student_fees (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  academic_year_id  uuid NOT NULL REFERENCES academic_years(id),
  fee_head_id       uuid NOT NULL REFERENCES fee_heads(id),
  fee_structure_id  uuid REFERENCES fee_structures(id),
  description       text NOT NULL,                    -- Tuition — Term 3
  amount_due        numeric(14,2) NOT NULL CHECK (amount_due >= 0),
  concession_amount numeric(14,2) NOT NULL DEFAULT 0,
  amount_paid       numeric(14,2) NOT NULL DEFAULT 0,
  due_date          date NOT NULL,
  status            text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Partial', 'Paid', 'Overdue', 'Waived')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CHECK (amount_paid >= 0 AND amount_paid <= amount_due - concession_amount)
);
SELECT attach_updated_at('student_fees');
CREATE INDEX ix_student_fees_student ON student_fees (student_id);
CREATE INDEX ix_student_fees_status_due ON student_fees (status, due_date);

CREATE TABLE fee_payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_no      text NOT NULL UNIQUE,               -- RCT-2026-000123
  student_id      uuid NOT NULL REFERENCES students(id),
  amount          numeric(14,2) NOT NULL CHECK (amount > 0),
  method          text NOT NULL CHECK (method IN ('UPI', 'Card', 'Net Banking', 'Cash', 'DD', 'Cheque')),
  gateway_ref     text,
  status          text NOT NULL DEFAULT 'Success' CHECK (status IN ('Initiated', 'Success', 'Failed', 'Refunded')),
  reconciled      boolean NOT NULL DEFAULT false,
  reconciled_at   timestamptz,
  paid_at         timestamptz NOT NULL DEFAULT now(),
  paid_by_parent_id uuid REFERENCES parents(id),
  collected_by    uuid REFERENCES users(id),
  receipt_sent_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('fee_payments');
CREATE INDEX ix_fee_payments_student ON fee_payments (student_id, paid_at DESC);
CREATE INDEX ix_fee_payments_paid_at ON fee_payments (paid_at DESC);

-- How a payment was split across charges
CREATE TABLE fee_payment_allocations (
  payment_id     uuid NOT NULL REFERENCES fee_payments(id) ON DELETE CASCADE,
  student_fee_id uuid NOT NULL REFERENCES student_fees(id) ON DELETE CASCADE,
  amount         numeric(14,2) NOT NULL CHECK (amount > 0),
  PRIMARY KEY (payment_id, student_fee_id)
);

CREATE TABLE concessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  concession_type text NOT NULL CHECK (concession_type IN ('Sibling concession', 'Staff ward concession', 'Merit scholarship', 'Need-based support', 'Sports quota')),
  percent         numeric(5,2),
  amount          numeric(14,2) NOT NULL DEFAULT 0,
  academic_year_id uuid NOT NULL REFERENCES academic_years(id),
  status          text NOT NULL DEFAULT 'Submitted' CHECK (status IN ('Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected')),
  reason          text,
  approved_by     uuid REFERENCES users(id),
  approved_at     timestamptz,
  created_by      uuid REFERENCES users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('concessions');

CREATE TABLE scholarships (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  criteria        text,
  amount          numeric(14,2) NOT NULL DEFAULT 0,
  seats           int NOT NULL DEFAULT 0,
  awarded         int NOT NULL DEFAULT 0,
  academic_year_id uuid NOT NULL REFERENCES academic_years(id),
  status          text NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Closed', 'Awarded')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('scholarships');

CREATE TABLE expenses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL UNIQUE,               -- EXP-2211
  campus_id       uuid NOT NULL REFERENCES campuses(id),
  category        text NOT NULL,                      -- Facilities, Lab, Transport, Events, Library
  description     text NOT NULL,
  amount          numeric(14,2) NOT NULL CHECK (amount > 0),
  vendor_id       uuid REFERENCES vendors(id),
  expense_date    date NOT NULL,
  status          text NOT NULL DEFAULT 'Submitted' CHECK (status IN ('Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected', 'Paid')),
  submitted_by    uuid REFERENCES employees(id),
  approved_by     uuid REFERENCES users(id),
  approved_at     timestamptz,
  rejection_reason text,
  created_by      uuid REFERENCES users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('expenses');
CREATE INDEX ix_expenses_status ON expenses (status, expense_date DESC);

CREATE TABLE reimbursements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL UNIQUE,               -- RMB-0412
  employee_id     uuid NOT NULL REFERENCES employees(id),
  claim_type      text NOT NULL,                      -- Travel, Training, Supplies, Medical
  description     text NOT NULL,
  amount          numeric(14,2) NOT NULL CHECK (amount > 0),
  claim_date      date NOT NULL,
  status          text NOT NULL DEFAULT 'Submitted' CHECK (status IN ('Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected', 'Paid')),
  approved_by     uuid REFERENCES users(id),
  approved_at     timestamptz,
  paid_in_run_id  uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('reimbursements');

CREATE TABLE budgets (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id  uuid NOT NULL REFERENCES academic_years(id),
  campus_id         uuid NOT NULL REFERENCES campuses(id),
  category          text NOT NULL,
  allocated         numeric(14,2) NOT NULL CHECK (allocated >= 0),
  owner             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (academic_year_id, campus_id, category)
);
SELECT attach_updated_at('budgets');

CREATE TABLE bank_statement_lines (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_date  date NOT NULL,
  reference       text NOT NULL,
  amount          numeric(14,2) NOT NULL,
  channel         text NOT NULL,
  matched_payment_id uuid REFERENCES fee_payments(id),
  status          text NOT NULL DEFAULT 'Unmatched' CHECK (status IN ('Matched', 'Unmatched', 'Exception', 'Resolved')),
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
SELECT attach_updated_at('bank_statement_lines');
