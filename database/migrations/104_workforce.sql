-- =============================================================================
-- 104 WORKFORCE — maker-checker trail for payroll runs
-- The approver of a run must be a different user from the one who calculated
-- it, so the run records who calculated, submitted, released and paid it.
-- =============================================================================

ALTER TABLE payroll_runs
  ADD COLUMN calculated_by  uuid REFERENCES users(id),
  ADD COLUMN calculated_at  timestamptz,
  ADD COLUMN submitted_by   uuid REFERENCES users(id),
  ADD COLUMN submitted_at   timestamptz,
  ADD COLUMN released_by    uuid REFERENCES users(id),
  ADD COLUMN paid_at        timestamptz,
  ADD COLUMN review_note    text;

-- Approved overtime is reserved by the run that calculated it and marked
-- Paid when that run is paid (reimbursements already have paid_in_run_id).
ALTER TABLE overtime_entries
  ADD COLUMN payroll_run_id uuid REFERENCES payroll_runs(id) ON DELETE SET NULL;

CREATE INDEX ix_payroll_runs_month ON payroll_runs (pay_month DESC);
CREATE INDEX ix_shift_rosters_date ON shift_rosters (roster_date);
CREATE INDEX ix_overtime_entries_employee ON overtime_entries (employee_id, work_date DESC);
CREATE INDEX ix_leave_requests_employee ON leave_requests (employee_id, from_date DESC);
CREATE INDEX ix_cpd_records_employee ON cpd_records (employee_id);
CREATE INDEX ix_documents_employee ON documents (employee_id) WHERE deleted_at IS NULL;
