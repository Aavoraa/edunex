# Database schema

PostgreSQL. Generated from the live schema by `backend/scripts/schema-doc.ts` — 135 tables.

Conventions: uuid primary keys (identity bigints for high-volume logs), business codes are UNIQUE, `created_at`/`updated_at` on every table (trigger-maintained), `created_by`/`updated_by` on business records, `deleted_at` soft delete on master records, foreign keys everywhere, indexes on every lookup path.

Views: `student_current_locations` (latest GPS point per student).

Migrations run in file-name order and are tracked in `schema_migrations`.

## Tables by migration

### 001_core.sql

| Table | Columns | Relations | Indexes | Sample rows |
|---|---|---|---|---|
| `academic_years` | 8 | — | 3 | 3 |
| `audit_logs` | 14 | users | 5 | 30 |
| `campuses` | 13 | — | 2 | 3 |
| `classes` | 7 | campuses | 2 | 25 |
| `employees` | 26 | users, campuses | 5 | 40 |
| `enrollments` | 9 | students, sections, academic_years | 3 | 68 |
| `non_teaching_staff` | 6 | employees | 1 | 27 |
| `parents` | 18 | users | 3 | 80 |
| `permissions` | 5 | — | 2 | 61 |
| `refresh_tokens` | 12 | users, refresh_tokens | 4 | 0 |
| `role_permissions` | 2 | roles, permissions | 1 | 267 |
| `roles` | 9 | — | 2 | 11 |
| `sections` | 9 | classes, academic_years, employees | 2 | 58 |
| `student_guardians` | 7 | students, parents | 2 | 92 |
| `students` | 30 | campuses, sections, academic_years, employees, users | 6 | 68 |
| `subjects` | 7 | — | 2 | 9 |
| `system_settings` | 7 | users | 1 | 19 |
| `teacher_assignments` | 8 | employees, sections, subjects, academic_years | 3 | 25 |
| `teachers` | 7 | employees | 1 | 13 |
| `users` | 18 | roles, campuses | 4 | 13 |

### 002_student360.sql

| Table | Columns | Relations | Indexes | Sample rows |
|---|---|---|---|---|
| `achievements` | 12 | students, users | 2 | 38 |
| `activities` | 6 | employees | 2 | 9 |
| `assessment_marks` | 10 | assessments, students, users | 3 | 56 |
| `assessments` | 14 | classes, sections, subjects, academic_years, users | 2 | 12 |
| `attendance_records` | 12 | students, sections, users | 4 | 4284 |
| `behaviour_records` | 8 | students, employees | 2 | 47 |
| `documents` | 21 | students, employees, users | 4 | 556 |
| `early_warning_signals` | 16 | students, employees, users | 4 | 20 |
| `student_academic_records` | 14 | students, academic_years, subjects, employees, users | 3 | 1908 |
| `student_activities` | 9 | students, activities | 2 | 98 |
| `student_interests` | 4 | students | 2 | 103 |
| `student_skills` | 9 | students | 2 | 265 |
| `student_timeline_events` | 9 | students, users | 2 | 70 |
| `teacher_observations` | 7 | students, employees | 1 | 4 |
| `wellbeing_checkins` | 9 | students, employees | 1 | 53 |

### 003_tracking_transport_safety.sql

| Table | Columns | Relations | Indexes | Sample rows |
|---|---|---|---|---|
| `boarding_events` | 10 | students, transport_routes, route_stops, employees | 3 | 48 |
| `counselling_sessions` | 9 | students, employees | 1 | 20 |
| `emergency_broadcasts` | 9 | campuses, users | 1 | 2 |
| `gate_events` | 9 | students, campuses | 3 | 523 |
| `geofences` | 9 | campuses | 1 | 3 |
| `incidents` | 15 | campuses, students, employees, users | 2 | 11 |
| `infirmary_visits` | 10 | students, employees | 2 | 69 |
| `pickup_authorisations` | 11 | students, parents | 1 | 8 |
| `route_stops` | 10 | transport_routes | 2 | 29 |
| `student_locations` | 15 | students, gps_devices | 4 | 1963 |
| `student_tracking_profiles` | 9 | students, parents | 1 | 68 |
| `student_transport` | 7 | students, transport_routes, route_stops | 2 | 39 |
| `transport_routes` | 13 | campuses, vehicles, employees | 2 | 7 |
| `vehicle_locations` | 8 | vehicles | 2 | 60 |
| `vehicles` | 11 | campuses | 3 | 7 |
| `visitors` | 13 | campuses, employees, users | 2 | 13 |

### 004_admissions_crm.sql

| Table | Columns | Relations | Indexes | Sample rows |
|---|---|---|---|---|
| `admissions` | 22 | enquiries, campuses, academic_years, students, users | 2 | 24 |
| `alumni` | 12 | students | 1 | 30 |
| `enquiries` | 28 | campuses, academic_years, employees, parents, users | 4 | 54 |
| `enquiry_stage_history` | 7 | enquiries, users | 2 | 299 |
| `follow_ups` | 12 | enquiries, employees, users | 3 | 146 |
| `partners` | 8 | — | 1 | 4 |
| `referrals` | 9 | parents, enquiries | 1 | 12 |
| `vendors` | 12 | — | 1 | 4 |

### 005_finance.sql

| Table | Columns | Relations | Indexes | Sample rows |
|---|---|---|---|---|
| `bank_statement_lines` | 10 | fee_payments | 1 | 22 |
| `budgets` | 8 | academic_years, campuses | 2 | 18 |
| `concessions` | 13 | students, academic_years, users | 1 | 21 |
| `expenses` | 16 | campuses, vendors, employees, users | 3 | 193 |
| `fee_heads` | 6 | — | 2 | 6 |
| `fee_payment_allocations` | 3 | fee_payments, student_fees | 1 | 400 |
| `fee_payments` | 15 | students, parents, users | 4 | 254 |
| `fee_structures` | 11 | academic_years, classes, fee_heads, users | 2 | 159 |
| `reimbursements` | 13 | employees, users, payroll_runs | 2 | 29 |
| `scholarships` | 10 | academic_years | 1 | 4 |
| `student_fees` | 13 | students, academic_years, fee_heads, fee_structures | 3 | 497 |

### 006_workforce.sql

| Table | Columns | Relations | Indexes | Sample rows |
|---|---|---|---|---|
| `allowances` | 9 | employees | 1 | 150 |
| `cpd_records` | 9 | employees | 2 | 121 |
| `leave_balances` | 6 | employees, leave_types, academic_years | 1 | 160 |
| `leave_requests` | 15 | employees, leave_types, users | 4 | 73 |
| `leave_types` | 4 | — | 2 | 4 |
| `overtime_entries` | 11 | employees, users, payroll_runs | 2 | 43 |
| `payroll_runs` | 23 | campuses, users | 3 | 12 |
| `payslips` | 13 | payroll_runs, employees | 3 | 160 |
| `shift_rosters` | 9 | employees, shifts | 3 | 145 |
| `shifts` | 8 | — | 2 | 9 |
| `staff_attendance` | 9 | employees | 3 | 1480 |

### 007_academics_parents_comms.sql

| Table | Columns | Relations | Indexes | Sample rows |
|---|---|---|---|---|
| `ai_drafts` | 10 | users | 1 | 6 |
| `circular_acknowledgements` | 3 | circulars, parents | 2 | 209 |
| `circulars` | 19 | campuses, users | 2 | 7 |
| `communications` | 19 | parents, enquiries, students, users, message_threads | 5 | 265 |
| `curriculum_stages` | 7 | — | 2 | 5 |
| `device_tokens` | 6 | users | 2 | 0 |
| `events` | 16 | campuses, users | 2 | 14 |
| `homework` | 11 | sections, subjects, employees | 1 | 16 |
| `homework_submissions` | 5 | homework, students | 1 | 74 |
| `knowledge_documents` | 10 | — | 1 | 8 |
| `learning_objectives` | 9 | subjects | 2 | 32 |
| `lesson_plans` | 14 | sections, subjects, learning_objectives, employees, users | 1 | 21 |
| `message_thread_participants` | 3 | message_threads, users | 2 | 6 |
| `message_threads` | 8 | students, users | 1 | 3 |
| `messages` | 5 | message_threads, users | 2 | 9 |
| `notification_deliveries` | 12 | notifications | 2 | 0 |
| `notification_preferences` | 8 | users | 1 | 0 |
| `notifications` | 13 | users | 3 | 98 |
| `periods` | 5 | campuses | 2 | 24 |
| `ptm_bookings` | 8 | ptm_sessions, parents, students | 3 | 43 |
| `ptm_sessions` | 11 | employees, sections | 2 | 6 |
| `question_bank` | 13 | subjects, users | 1 | 290 |
| `report_card_batches` | 10 | sections, academic_years, users | 2 | 5 |
| `report_card_comments` | 9 | report_card_batches, students, users | 2 | 16 |
| `tasks` | 17 | users | 4 | 60 |
| `timetable_entries` | 12 | sections, periods, subjects, employees | 3 | 132 |

### 008_operations_innovation_group.sql

| Table | Columns | Relations | Indexes | Sample rows |
|---|---|---|---|---|
| `assets` | 15 | campuses, facilities, employees | 2 | 26 |
| `campus_survey_metrics` | 6 | campuses | 2 | 9 |
| `certificates` | 12 | students, users | 2 | 8 |
| `competition_entries` | 3 | competitions, innovation_projects | 1 | 11 |
| `competitions` | 8 | — | 1 | 5 |
| `compliance_items` | 12 | campuses, employees | 1 | 44 |
| `facilities` | 9 | campuses | 1 | 12 |
| `group_policies` | 10 | users | 1 | 5 |
| `innovation_ideas` | 10 | students, employees | 1 | 13 |
| `innovation_milestones` | 10 | innovation_projects | 2 | 30 |
| `innovation_project_members` | 3 | innovation_projects, students | 1 | 10 |
| `innovation_projects` | 12 | innovation_ideas, students, employees | 2 | 6 |
| `inventory_items` | 12 | campuses, vendors | 2 | 15 |
| `inventory_movements` | 7 | inventory_items, users | 2 | 88 |
| `maintenance_requests` | 15 | campuses, assets, facilities, employees | 2 | 42 |
| `student_transfers` | 17 | students, campuses, users, sections | 1 | 5 |

### 101_academics.sql

| Table | Columns | Relations | Indexes | Sample rows |
|---|---|---|---|---|
| `learning_objective_snapshots` | 9 | learning_objectives, academic_years | 3 | 140 |

### 105_safety.sql

| Table | Columns | Relations | Indexes | Sample rows |
|---|---|---|---|---|
| `pickup_events` | 14 | students, campuses, pickup_authorisations, incidents, users | 3 | 7 |
| `pickup_otp_challenges` | 10 | pickup_authorisations, users | 2 | 3 |

### 107_operations.sql

| Table | Columns | Relations | Indexes | Sample rows |
|---|---|---|---|---|
| `facility_bookings` | 10 | facilities, users | 2 | 115 |

### 108_innovation.sql

| Table | Columns | Relations | Indexes | Sample rows |
|---|---|---|---|---|
| `innovation_evidence` | 10 | innovation_projects, innovation_milestones, users | 2 | 10 |
| `innovation_feedback` | 7 | innovation_projects, employees, users | 2 | 5 |
| `innovation_project_achievements` | 3 | innovation_projects, achievements | 1 | 2 |

### 109_group.sql

| Table | Columns | Relations | Indexes | Sample rows |
|---|---|---|---|---|
| `group_policy_versions` | 11 | group_policies, users | 2 | 6 |

### 110_gps_devices.sql

| Table | Columns | Relations | Indexes | Sample rows |
|---|---|---|---|---|
| `device_assignments` | 11 | students, gps_devices, users | 5 | 53 |
| `gps_devices` | 18 | campuses, users | 6 | 60 |
| `student_latest_locations` | 15 | students, gps_devices | 1 | 52 |

### other

| Table | Columns | Relations | Indexes | Sample rows |
|---|---|---|---|---|
| `schema_migrations` | 2 | — | 1 | 16 |

## Columns

<details><summary><code>academic_years</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| label | text |  |  |
| starts_on | date |  |  |
| ends_on | date |  |  |
| is_current | boolean |  | false |
| is_locked | boolean |  | false |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>achievements</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| student_id | uuid |  | → students |
| title | text |  |  |
| achievement_type | text |  |  |
| level | text | yes |  |
| achieved_on | date |  |  |
| is_verified | boolean |  | false |
| verified_by | uuid | yes | → users |
| verified_at | timestamp with time zone | yes |  |
| created_by | uuid | yes | → users |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>activities</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| name | text |  |  |
| category | text |  |  |
| coordinator_id | uuid | yes | → employees |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>admissions</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| application_no | text |  |  |
| enquiry_id | uuid | yes | → enquiries |
| campus_id | uuid |  | → campuses |
| academic_year_id | uuid |  | → academic_years |
| student_name | text |  |  |
| date_of_birth | date | yes |  |
| gender | text | yes |  |
| grade_applied | text |  |  |
| previous_school | text | yes |  |
| status | text |  | 'Submitted'::text |
| documents_complete | boolean |  | false |
| assessment_at | timestamp with time zone | yes |  |
| assessment_score | numeric | yes |  |
| offer_expires_on | date | yes |  |
| fee_paid | boolean |  | false |
| student_id | uuid | yes | → students |
| decided_by | uuid | yes | → users |
| decided_at | timestamp with time zone | yes |  |
| created_by | uuid | yes | → users |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>ai_drafts</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| draft_type | text |  |  |
| prompt | jsonb |  | '{}'::jsonb |
| output | jsonb |  | '{}'::jsonb |
| status | text |  | 'Draft'::text |
| requested_by | uuid |  | → users |
| approved_by | uuid | yes | → users |
| approved_at | timestamp with time zone | yes |  |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>allowances</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| employee_id | uuid |  | → employees |
| allowance_type | text |  |  |
| amount | numeric |  |  |
| frequency | text |  | 'Monthly'::text |
| effective_month | date |  |  |
| status | text |  | 'Approved'::text |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>alumni</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| full_name | text |  |  |
| batch_year | integer |  |  |
| university | text | yes |  |
| career | text | yes |  |
| email | USER-DEFINED | yes |  |
| phone | text | yes |  |
| engagement | text |  | 'Low'::text |
| last_engagement | text | yes |  |
| student_id | uuid | yes | → students |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>assessment_marks</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| assessment_id | uuid |  | → assessments |
| student_id | uuid |  | → students |
| marks | numeric | yes |  |
| is_absent | boolean |  | false |
| grade | text | yes |  |
| remarks | text | yes |  |
| entered_by | uuid | yes | → users |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>assessments</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| code | text |  |  |
| name | text |  |  |
| class_id | uuid |  | → classes |
| section_id | uuid | yes | → sections |
| subject_id | uuid |  | → subjects |
| academic_year_id | uuid |  | → academic_years |
| assessment_type | text |  | 'test'::text |
| held_on | date |  |  |
| max_marks | numeric |  |  |
| status | text |  | 'Scheduled'::text |
| created_by | uuid | yes | → users |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>assets</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| code | text |  |  |
| campus_id | uuid |  | → campuses |
| name | text |  |  |
| category | text |  |  |
| location | text | yes |  |
| facility_id | uuid | yes | → facilities |
| assigned_to | uuid | yes | → employees |
| purchased_on | date | yes |  |
| purchase_value | numeric | yes |  |
| next_service_on | date | yes |  |
| status | text |  | 'Active'::text |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |
| deleted_at | timestamp with time zone | yes |  |

</details>

<details><summary><code>attendance_records</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| student_id | uuid |  | → students |
| section_id | uuid |  | → sections |
| attendance_date | date |  |  |
| status | text |  |  |
| arrival_time | time without time zone | yes |  |
| remarks | text | yes |  |
| source | text |  | 'teacher'::text |
| marked_by | uuid | yes | → users |
| parent_notified_at | timestamp with time zone | yes |  |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>audit_logs</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | bigint |  |  |
| user_id | uuid | yes | → users |
| user_name | text | yes |  |
| role_key | text | yes |  |
| action | text |  |  |
| module | text |  |  |
| entity_type | text | yes |  |
| entity_id | text | yes |  |
| description | text |  |  |
| ip_address | inet | yes |  |
| user_agent | text | yes |  |
| device | text | yes |  |
| metadata | jsonb |  | '{}'::jsonb |
| created_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>bank_statement_lines</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| statement_date | date |  |  |
| reference | text |  |  |
| amount | numeric |  |  |
| channel | text |  |  |
| matched_payment_id | uuid | yes | → fee_payments |
| status | text |  | 'Unmatched'::text |
| note | text | yes |  |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>behaviour_records</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| student_id | uuid |  | → students |
| recorded_on | date |  |  |
| record_type | text |  |  |
| note | text |  |  |
| recorded_by | uuid | yes | → employees |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>boarding_events</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| student_id | uuid |  | → students |
| route_id | uuid |  | → transport_routes |
| stop_id | uuid | yes | → route_stops |
| event_type | text |  |  |
| occurred_at | timestamp with time zone |  |  |
| confirmed_by | uuid | yes | → employees |
| method | text |  | 'RFID'::text |
| parent_notified_at | timestamp with time zone | yes |  |
| created_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>budgets</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| academic_year_id | uuid |  | → academic_years |
| campus_id | uuid |  | → campuses |
| category | text |  |  |
| allocated | numeric |  |  |
| owner | text | yes |  |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>campus_survey_metrics</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| campus_id | uuid |  | → campuses |
| metric | text |  |  |
| value | numeric |  |  |
| measured_on | date |  |  |
| created_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>campuses</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| code | text |  |  |
| name | text |  |  |
| place | text |  |  |
| short_name | text |  |  |
| curriculum | text | yes |  |
| established | integer | yes |  |
| latitude | numeric | yes |  |
| longitude | numeric | yes |  |
| address | text | yes |  |
| is_active | boolean |  | true |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>certificates</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| certificate_type | text |  |  |
| student_id | uuid |  | → students |
| requested_on | date |  | CURRENT_DATE |
| purpose | text | yes |  |
| status | text |  | 'Submitted'::text |
| verification_code | text | yes |  |
| issued_at | timestamp with time zone | yes |  |
| approved_by | uuid | yes | → users |
| requested_by | uuid | yes | → users |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>circular_acknowledgements</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| circular_id | uuid |  | → circulars |
| parent_id | uuid |  | → parents |
| acknowledged_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>circulars</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| campus_id | uuid | yes | → campuses |
| title | text |  |  |
| body | text |  |  |
| audience | text |  |  |
| audience_filter | jsonb |  | '{}'::jsonb |
| requires_ack | boolean |  | true |
| status | text |  | 'Draft'::text |
| published_at | timestamp with time zone | yes |  |
| target_count | integer |  | 0 |
| created_by | uuid | yes | → users |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |
| submitted_by | uuid | yes | → users |
| submitted_at | timestamp with time zone | yes |  |
| released_by | uuid | yes | → users |
| channels | ARRAY |  | ARRAY['whatsapp'::text, 'push'::text] |
| last_reminded_at | timestamp with time zone | yes |  |
| reminder_count | integer |  | 0 |

</details>

<details><summary><code>classes</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| campus_id | uuid |  | → campuses |
| name | text |  |  |
| grade_level | integer |  |  |
| stage | text | yes |  |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>communications</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| channel | text |  |  |
| direction | text |  | 'outbound'::text |
| parent_id | uuid | yes | → parents |
| enquiry_id | uuid | yes | → enquiries |
| student_id | uuid | yes | → students |
| counterpart | text |  |  |
| subject | text |  |  |
| body | text | yes |  |
| status | text |  | 'Queued'::text |
| recipients | integer |  | 1 |
| needs_reply | boolean |  | false |
| replied_at | timestamp with time zone | yes |  |
| sent_by | uuid | yes | → users |
| occurred_at | timestamp with time zone |  | now() |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |
| thread_id | uuid | yes | → message_threads |
| replied_by | uuid | yes | → users |

</details>

<details><summary><code>competition_entries</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| competition_id | uuid |  | → competitions |
| project_id | uuid |  | → innovation_projects |
| result | text | yes |  |

</details>

<details><summary><code>competitions</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| name | text |  |  |
| level | text |  | 'District'::text |
| held_on | date |  |  |
| teams | integer |  | 0 |
| result | text | yes |  |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>compliance_items</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| campus_id | uuid |  | → campuses |
| item | text |  |  |
| authority | text |  |  |
| due_on | date |  |  |
| owner_name | text |  |  |
| owner_id | uuid | yes | → employees |
| status | text |  | 'Scheduled'::text |
| completed_on | date | yes |  |
| notes | text | yes |  |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>concessions</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| student_id | uuid |  | → students |
| concession_type | text |  |  |
| percent | numeric | yes |  |
| amount | numeric |  | 0 |
| academic_year_id | uuid |  | → academic_years |
| status | text |  | 'Submitted'::text |
| reason | text | yes |  |
| approved_by | uuid | yes | → users |
| approved_at | timestamp with time zone | yes |  |
| created_by | uuid | yes | → users |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>counselling_sessions</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| student_id | uuid |  | → students |
| counsellor_id | uuid |  | → employees |
| session_on | timestamp with time zone |  |  |
| reason | text |  |  |
| status | text |  | 'Scheduled'::text |
| notes | text | yes |  |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>cpd_records</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| employee_id | uuid |  | → employees |
| programme | text |  |  |
| provider | text | yes |  |
| hours | integer |  |  |
| completed_on | date | yes |  |
| status | text |  | 'Completed'::text |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>curriculum_stages</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| name | text |  |  |
| grades | text |  |  |
| sort_order | integer |  |  |
| coverage_pct | integer |  | 0 |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>device_assignments</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| student_id | uuid |  | → students |
| device_id | uuid |  | → gps_devices |
| status | text |  | 'active'::text |
| assigned_at | timestamp with time zone |  | now() |
| assigned_by | uuid | yes | → users |
| unassigned_at | timestamp with time zone | yes |  |
| unassigned_by | uuid | yes | → users |
| unassign_reason | text | yes |  |
| notes | text | yes |  |
| created_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>device_tokens</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| user_id | uuid |  | → users |
| platform | text |  |  |
| token | text |  |  |
| last_seen_at | timestamp with time zone |  | now() |
| created_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>documents</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| owner_type | text |  |  |
| owner_id | uuid | yes |  |
| student_id | uuid | yes | → students |
| employee_id | uuid | yes | → employees |
| name | text |  |  |
| category | text |  | 'General'::text |
| collection | text | yes |  |
| status | text |  | 'Pending'::text |
| storage_key | text | yes |  |
| original_name | text | yes |  |
| mime_type | text | yes |  |
| size_bytes | bigint | yes |  |
| checksum_sha256 | text | yes |  |
| requested_on | date | yes |  |
| verified_by | uuid | yes | → users |
| verified_at | timestamp with time zone | yes |  |
| uploaded_by | uuid | yes | → users |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |
| deleted_at | timestamp with time zone | yes |  |

</details>

<details><summary><code>early_warning_signals</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| code | text |  |  |
| student_id | uuid |  | → students |
| signal | text |  |  |
| signal_type | text |  | 'academic'::text |
| stage | integer |  | 0 |
| owner_id | uuid | yes | → employees |
| raised_on | date |  | CURRENT_DATE |
| action_plan | text | yes |  |
| next_review_on | date | yes |  |
| review_decision | text | yes |  |
| reviewed_by | uuid | yes | → users |
| reviewed_at | timestamp with time zone | yes |  |
| closed_at | timestamp with time zone | yes |  |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>emergency_broadcasts</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| campus_id | uuid | yes | → campuses |
| alert_type | text |  |  |
| message | text |  |  |
| audience | text |  |  |
| recipients | integer |  | 0 |
| sent_by | uuid | yes | → users |
| sent_at | timestamp with time zone |  | now() |
| created_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>employees</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| user_id | uuid | yes | → users |
| employee_code | text |  |  |
| full_name | text |  |  |
| gender | text | yes |  |
| date_of_birth | date | yes |  |
| phone | text | yes |  |
| email | USER-DEFINED | yes |  |
| campus_id | uuid |  | → campuses |
| department | text |  |  |
| designation | text |  |  |
| employee_type | text |  |  |
| category | text |  |  |
| shift_name | text | yes |  |
| join_date | date | yes |  |
| employment_status | text |  | 'active'::text |
| basic_salary | numeric |  | 0 |
| bank_account_masked | text | yes |  |
| workload_periods | integer |  | 0 |
| cpd_hours | integer |  | 0 |
| background_verified | boolean |  | false |
| created_by | uuid | yes | → users |
| updated_by | uuid | yes | → users |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |
| deleted_at | timestamp with time zone | yes |  |

</details>

<details><summary><code>enquiries</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| code | text |  |  |
| campus_id | uuid |  | → campuses |
| academic_year_id | uuid | yes | → academic_years |
| parent_name | text |  |  |
| phone | text |  |  |
| email | USER-DEFINED | yes |  |
| student_name | text |  |  |
| student_dob | date | yes |  |
| grade_applied | text |  |  |
| curriculum | text | yes |  |
| source | text |  |  |
| campaign | text | yes |  |
| stage | text |  | 'New Lead'::text |
| lead_score | integer |  | 50 |
| counsellor_id | uuid | yes | → employees |
| transport_required | boolean |  | false |
| next_action | text | yes |  |
| next_action_at | timestamp with time zone | yes |  |
| lost_reason | text | yes |  |
| referred_by_parent_id | uuid | yes | → parents |
| acquisition_cost | numeric |  | 0 |
| notes | text | yes |  |
| created_by | uuid | yes | → users |
| updated_by | uuid | yes | → users |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |
| deleted_at | timestamp with time zone | yes |  |

</details>

<details><summary><code>enquiry_stage_history</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | bigint |  |  |
| enquiry_id | uuid |  | → enquiries |
| from_stage | text | yes |  |
| to_stage | text |  |  |
| changed_by | uuid | yes | → users |
| note | text | yes |  |
| changed_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>enrollments</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| student_id | uuid |  | → students |
| section_id | uuid |  | → sections |
| academic_year_id | uuid |  | → academic_years |
| roll_no | integer | yes |  |
| status | text |  | 'active'::text |
| enrolled_on | date |  | CURRENT_DATE |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>events</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| campus_id | uuid | yes | → campuses |
| title | text |  |  |
| description | text | yes |  |
| event_type | text |  | 'School'::text |
| starts_on | date |  |  |
| ends_on | date | yes |  |
| venue | text | yes |  |
| audience | text |  | 'All parents'::text |
| status | text |  | 'Published'::text |
| created_by | uuid | yes | → users |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |
| audience_filter | jsonb |  | '{}'::jsonb |
| starts_at | time without time zone | yes |  |
| notified_at | timestamp with time zone | yes |  |

</details>

<details><summary><code>expenses</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| code | text |  |  |
| campus_id | uuid |  | → campuses |
| category | text |  |  |
| description | text |  |  |
| amount | numeric |  |  |
| vendor_id | uuid | yes | → vendors |
| expense_date | date |  |  |
| status | text |  | 'Submitted'::text |
| submitted_by | uuid | yes | → employees |
| approved_by | uuid | yes | → users |
| approved_at | timestamp with time zone | yes |  |
| rejection_reason | text | yes |  |
| created_by | uuid | yes | → users |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>facilities</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| campus_id | uuid |  | → campuses |
| name | text |  |  |
| facility_type | text |  |  |
| capacity | integer | yes |  |
| status | text |  | 'Available'::text |
| utilisation_pct | integer |  | 0 |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>facility_bookings</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| facility_id | uuid |  | → facilities |
| booked_on | date |  |  |
| starts_at | time without time zone |  |  |
| ends_at | time without time zone |  |  |
| purpose | text |  |  |
| status | text |  | 'Booked'::text |
| booked_by | uuid | yes | → users |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>fee_heads</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| code | text |  |  |
| name | text |  |  |
| is_optional | boolean |  | false |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>fee_payment_allocations</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| payment_id | uuid |  | → fee_payments |
| student_fee_id | uuid |  | → student_fees |
| amount | numeric |  |  |

</details>

<details><summary><code>fee_payments</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| receipt_no | text |  |  |
| student_id | uuid |  | → students |
| amount | numeric |  |  |
| method | text |  |  |
| gateway_ref | text | yes |  |
| status | text |  | 'Success'::text |
| reconciled | boolean |  | false |
| reconciled_at | timestamp with time zone | yes |  |
| paid_at | timestamp with time zone |  | now() |
| paid_by_parent_id | uuid | yes | → parents |
| collected_by | uuid | yes | → users |
| receipt_sent_at | timestamp with time zone | yes |  |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>fee_structures</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| academic_year_id | uuid |  | → academic_years |
| class_id | uuid |  | → classes |
| fee_head_id | uuid |  | → fee_heads |
| term | text |  |  |
| amount | numeric |  |  |
| due_date | date |  |  |
| status | text |  | 'Active'::text |
| created_by | uuid | yes | → users |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>follow_ups</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| enquiry_id | uuid |  | → enquiries |
| follow_up_type | text |  |  |
| scheduled_at | timestamp with time zone |  |  |
| completed_at | timestamp with time zone | yes |  |
| outcome | text | yes |  |
| notes | text | yes |  |
| status | text |  | 'Scheduled'::text |
| assigned_to | uuid | yes | → employees |
| created_by | uuid | yes | → users |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>gate_events</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| student_id | uuid |  | → students |
| campus_id | uuid |  | → campuses |
| gate | text |  |  |
| direction | text |  |  |
| method | text |  | 'RFID'::text |
| occurred_at | timestamp with time zone |  |  |
| parent_notified_at | timestamp with time zone | yes |  |
| created_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>geofences</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| campus_id | uuid | yes | → campuses |
| name | text |  |  |
| zone_type | text |  |  |
| latitude | numeric |  |  |
| longitude | numeric |  |  |
| radius_m | integer |  |  |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>gps_devices</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| device_code | text |  |  |
| imei | text | yes |  |
| serial_number | text | yes |  |
| device_type | text |  | 'gps_tracker'::text |
| firmware_version | text | yes |  |
| campus_id | uuid | yes | → campuses |
| status | text |  | 'available'::text |
| token_hash | text | yes |  |
| token_issued_at | timestamp with time zone | yes |  |
| last_seen_at | timestamp with time zone | yes |  |
| last_battery_pct | integer | yes |  |
| last_ip | text | yes |  |
| notes | text | yes |  |
| is_sample_data | boolean |  | false |
| created_by | uuid | yes | → users |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>group_policies</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| name | text |  |  |
| scope | text |  | 'All campuses'::text |
| version | text |  |  |
| body | text | yes |  |
| status | text |  | 'Active'::text |
| effective_on | date | yes |  |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |
| updated_by | uuid | yes | → users |

</details>

<details><summary><code>group_policy_versions</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| policy_id | uuid |  | → group_policies |
| version | text |  |  |
| name | text |  |  |
| scope | text |  |  |
| body | text | yes |  |
| status | text |  |  |
| effective_on | date | yes |  |
| change_note | text | yes |  |
| archived_by | uuid | yes | → users |
| archived_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>homework</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| section_id | uuid |  | → sections |
| subject_id | uuid |  | → subjects |
| title | text |  |  |
| instructions | text | yes |  |
| assigned_on | date |  | CURRENT_DATE |
| due_on | date |  |  |
| status | text |  | 'Open'::text |
| assigned_by | uuid | yes | → employees |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>homework_submissions</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| homework_id | uuid |  | → homework |
| student_id | uuid |  | → students |
| submitted_at | timestamp with time zone |  | now() |
| status | text |  | 'Submitted'::text |
| feedback | text | yes |  |

</details>

<details><summary><code>incidents</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| code | text |  |  |
| campus_id | uuid |  | → campuses |
| incident_type | text |  |  |
| summary | text |  |  |
| details | text | yes |  |
| severity | text |  |  |
| status | text |  | 'Open'::text |
| student_id | uuid | yes | → students |
| owner_id | uuid | yes | → employees |
| occurred_on | date |  |  |
| is_confidential | boolean |  | false |
| created_by | uuid | yes | → users |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>infirmary_visits</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| student_id | uuid |  | → students |
| visited_at | timestamp with time zone |  |  |
| reason | text |  |  |
| action_taken | text | yes |  |
| outcome | text |  | 'Under observation'::text |
| attended_by | uuid | yes | → employees |
| parent_informed | boolean |  | false |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>innovation_evidence</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| project_id | uuid |  | → innovation_projects |
| milestone_id | uuid | yes | → innovation_milestones |
| title | text |  |  |
| kind | text |  | 'Document'::text |
| link | text | yes |  |
| note | text | yes |  |
| added_by | uuid | yes | → users |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>innovation_feedback</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| project_id | uuid |  | → innovation_projects |
| author_id | uuid | yes | → employees |
| author_name | text |  |  |
| body | text |  |  |
| created_by | uuid | yes | → users |
| created_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>innovation_ideas</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| title | text |  |  |
| problem | text | yes |  |
| student_id | uuid |  | → students |
| category | text | yes |  |
| status | text |  | 'Submitted'::text |
| reviewed_by | uuid | yes | → employees |
| submitted_on | date |  | CURRENT_DATE |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>innovation_milestones</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| project_id | uuid |  | → innovation_projects |
| sequence | integer |  |  |
| title | text |  |  |
| due_on | date | yes |  |
| completed_on | date | yes |  |
| evidence | text | yes |  |
| feedback | text | yes |  |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>innovation_project_achievements</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| project_id | uuid |  | → innovation_projects |
| achievement_id | uuid |  | → achievements |
| created_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>innovation_project_members</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| project_id | uuid |  | → innovation_projects |
| student_id | uuid |  | → students |
| role | text |  | 'Member'::text |

</details>

<details><summary><code>innovation_projects</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| code | text |  |  |
| title | text |  |  |
| summary | text | yes |  |
| idea_id | uuid | yes | → innovation_ideas |
| lead_student_id | uuid |  | → students |
| mentor_id | uuid | yes | → employees |
| stage | integer |  | 0 |
| status | text |  |  |
| started_on | date | yes |  |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>inventory_items</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| sku | text |  |  |
| campus_id | uuid |  | → campuses |
| name | text |  |  |
| category | text |  |  |
| unit | text |  | 'pcs'::text |
| quantity | integer |  | 0 |
| reorder_level | integer |  | 0 |
| unit_cost | numeric |  | 0 |
| vendor_id | uuid | yes | → vendors |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>inventory_movements</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | bigint |  |  |
| item_id | uuid |  | → inventory_items |
| movement_type | text |  |  |
| quantity | integer |  |  |
| note | text | yes |  |
| moved_by | uuid | yes | → users |
| created_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>knowledge_documents</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| title | text |  |  |
| section | text | yes |  |
| body | text |  |  |
| keywords | ARRAY |  | '{}'::text[] |
| audience | ARRAY |  | '{}'::text[] |
| is_approved | boolean |  | true |
| source_updated_on | date | yes |  |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>learning_objective_snapshots</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| objective_id | uuid |  | → learning_objectives |
| academic_year_id | uuid |  | → academic_years |
| term | text |  |  |
| term_order | integer |  |  |
| coverage_pct | integer |  |  |
| mastery_pct | integer |  |  |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>learning_objectives</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| code | text |  |  |
| description | text |  |  |
| subject_id | uuid |  | → subjects |
| stage_label | text |  |  |
| coverage_pct | integer |  | 0 |
| mastery_pct | integer |  | 0 |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>leave_balances</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| employee_id | uuid |  | → employees |
| leave_type_id | uuid |  | → leave_types |
| academic_year_id | uuid |  | → academic_years |
| entitled | numeric |  |  |
| used | numeric |  | 0 |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>leave_requests</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| code | text |  |  |
| employee_id | uuid |  | → employees |
| leave_type_id | uuid |  | → leave_types |
| from_date | date |  |  |
| to_date | date |  |  |
| days | numeric |  |  |
| reason | text | yes |  |
| cover_arrangement | text | yes |  |
| status | text |  | 'Submitted'::text |
| decided_by | uuid | yes | → users |
| decided_at | timestamp with time zone | yes |  |
| decision_note | text | yes |  |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>leave_types</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| name | text |  |  |
| annual_quota | integer |  | 12 |
| created_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>lesson_plans</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| title | text |  |  |
| section_id | uuid | yes | → sections |
| subject_id | uuid |  | → subjects |
| objective_id | uuid | yes | → learning_objectives |
| planned_for | date | yes |  |
| content | jsonb |  | '{}'::jsonb |
| ai_generated | boolean |  | false |
| status | text |  | 'Draft'::text |
| author_id | uuid |  | → employees |
| approved_by | uuid | yes | → users |
| approved_at | timestamp with time zone | yes |  |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>maintenance_requests</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| code | text |  |  |
| campus_id | uuid |  | → campuses |
| asset_id | uuid | yes | → assets |
| facility_id | uuid | yes | → facilities |
| description | text |  |  |
| priority | text |  | 'Medium'::text |
| status | text |  | 'Submitted'::text |
| raised_by | uuid | yes | → employees |
| assigned_to | uuid | yes | → employees |
| raised_on | date |  | CURRENT_DATE |
| completed_at | timestamp with time zone | yes |  |
| cost | numeric | yes |  |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>message_thread_participants</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| thread_id | uuid |  | → message_threads |
| user_id | uuid |  | → users |
| last_read_at | timestamp with time zone | yes |  |

</details>

<details><summary><code>message_threads</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| subject | text |  |  |
| student_id | uuid | yes | → students |
| created_by | uuid |  | → users |
| last_message_at | timestamp with time zone |  | now() |
| status | text |  | 'Open'::text |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>messages</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| thread_id | uuid |  | → message_threads |
| sender_id | uuid |  | → users |
| body | text |  |  |
| created_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>non_teaching_staff</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| employee_id | uuid |  | → employees |
| staff_category | text |  |  |
| licence_no_masked | text | yes |  |
| licence_expiry | date | yes |  |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>notification_deliveries</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| notification_id | uuid |  | → notifications |
| channel | text |  |  |
| destination | text | yes |  |
| status | text |  | 'pending'::text |
| provider | text | yes |  |
| provider_ref | text | yes |  |
| attempts | integer |  | 0 |
| last_error | text | yes |  |
| next_attempt_at | timestamp with time zone |  | now() |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>notification_preferences</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| user_id | uuid |  | → users |
| topic | text |  |  |
| in_app | boolean |  | true |
| whatsapp | boolean |  | true |
| sms | boolean |  | false |
| email | boolean |  | true |
| push | boolean |  | true |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>notifications</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| user_id | uuid |  | → users |
| category | text |  |  |
| tone | text |  | 'info'::text |
| icon | text |  | 'bell'::text |
| topic | text |  | 'system'::text |
| title | text |  |  |
| body | text | yes |  |
| route | text | yes |  |
| entity_type | text | yes |  |
| entity_id | text | yes |  |
| read_at | timestamp with time zone | yes |  |
| created_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>overtime_entries</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| employee_id | uuid |  | → employees |
| work_date | date |  |  |
| hours | numeric |  |  |
| reason | text |  |  |
| rate_per_hour | numeric |  | 0 |
| status | text |  | 'Submitted'::text |
| approved_by | uuid | yes | → users |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |
| payroll_run_id | uuid | yes | → payroll_runs |

</details>

<details><summary><code>parents</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| user_id | uuid | yes | → users |
| parent_code | text |  |  |
| full_name | text |  |  |
| phone | text |  |  |
| alt_phone | text | yes |  |
| email | USER-DEFINED | yes |  |
| occupation | text | yes |  |
| address | text | yes |  |
| preferred_channel | text |  | 'whatsapp'::text |
| engagement_score | integer |  | 0 |
| last_contact_at | timestamp with time zone | yes |  |
| last_contact_channel | text | yes |  |
| created_by | uuid | yes | → users |
| updated_by | uuid | yes | → users |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |
| deleted_at | timestamp with time zone | yes |  |

</details>

<details><summary><code>partners</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| name | text |  |  |
| partner_type | text |  |  |
| since_year | integer | yes |  |
| status | text |  | 'Active'::text |
| note | text | yes |  |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>payroll_runs</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| campus_id | uuid | yes | → campuses |
| pay_month | date |  |  |
| status | text |  | 'Draft'::text |
| employee_count | integer |  | 0 |
| gross_total | numeric |  | 0 |
| deductions_total | numeric |  | 0 |
| overtime_total | numeric |  | 0 |
| allowances_total | numeric |  | 0 |
| net_total | numeric |  | 0 |
| approved_by | uuid | yes | → users |
| approved_at | timestamp with time zone | yes |  |
| released_at | timestamp with time zone | yes |  |
| created_by | uuid | yes | → users |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |
| calculated_by | uuid | yes | → users |
| calculated_at | timestamp with time zone | yes |  |
| submitted_by | uuid | yes | → users |
| submitted_at | timestamp with time zone | yes |  |
| released_by | uuid | yes | → users |
| paid_at | timestamp with time zone | yes |  |
| review_note | text | yes |  |

</details>

<details><summary><code>payslips</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| payroll_run_id | uuid |  | → payroll_runs |
| employee_id | uuid |  | → employees |
| earnings | jsonb |  | '[]'::jsonb |
| deductions | jsonb |  | '[]'::jsonb |
| gross | numeric |  |  |
| total_deductions | numeric |  |  |
| net | numeric |  |  |
| days_worked | numeric | yes |  |
| status | text |  | 'Draft'::text |
| released_at | timestamp with time zone | yes |  |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>periods</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| campus_id | uuid |  | → campuses |
| period_no | integer |  |  |
| starts_at | time without time zone |  |  |
| ends_at | time without time zone |  |  |

</details>

<details><summary><code>permissions</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| key | text |  |  |
| module | text |  |  |
| description | text | yes |  |
| created_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>pickup_authorisations</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| student_id | uuid |  | → students |
| person_name | text |  |  |
| relation | text |  |  |
| phone | text | yes |  |
| method | text |  |  |
| status | text |  | 'Pending'::text |
| last_pickup_at | timestamp with time zone | yes |  |
| approved_by_parent | uuid | yes | → parents |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>pickup_events</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| student_id | uuid |  | → students |
| campus_id | uuid |  | → campuses |
| authorisation_id | uuid | yes | → pickup_authorisations |
| person_name | text |  |  |
| outcome | text |  |  |
| method | text | yes |  |
| gate | text |  | 'Main Gate'::text |
| incident_id | uuid | yes | → incidents |
| notes | text | yes |  |
| recorded_by | uuid | yes | → users |
| occurred_at | timestamp with time zone |  | now() |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>pickup_otp_challenges</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| authorisation_id | uuid |  | → pickup_authorisations |
| code_hash | text |  |  |
| expires_at | timestamp with time zone |  |  |
| attempts | integer |  | 0 |
| consumed_at | timestamp with time zone | yes |  |
| verified | boolean |  | false |
| created_by | uuid | yes | → users |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>ptm_bookings</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| ptm_session_id | uuid |  | → ptm_sessions |
| slot_no | integer |  |  |
| parent_id | uuid |  | → parents |
| student_id | uuid |  | → students |
| status | text |  | 'Booked'::text |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>ptm_sessions</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| employee_id | uuid |  | → employees |
| section_id | uuid | yes | → sections |
| subject_label | text |  |  |
| session_date | date |  |  |
| starts_at | time without time zone |  | '09:00:00'::time without time zone |
| slot_minutes | integer |  | 10 |
| total_slots | integer |  |  |
| venue | text | yes |  |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>question_bank</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| subject_id | uuid |  | → subjects |
| topic | text |  |  |
| stage_label | text |  |  |
| question | text |  |  |
| question_type | text |  | 'short'::text |
| difficulty | text |  | 'Core'::text |
| marks | integer |  | 1 |
| times_used | integer |  | 0 |
| status | text |  | 'Approved'::text |
| created_by | uuid | yes | → users |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>referrals</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| referrer_parent_id | uuid |  | → parents |
| enquiry_id | uuid | yes | → enquiries |
| referred_name | text |  |  |
| status | text |  | 'Submitted'::text |
| reward_status | text |  | 'Not eligible'::text |
| reward_amount | numeric |  | 0 |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>refresh_tokens</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| user_id | uuid |  | → users |
| family_id | uuid |  |  |
| token_hash | text |  |  |
| expires_at | timestamp with time zone |  |  |
| revoked_at | timestamp with time zone | yes |  |
| replaced_by | uuid | yes | → refresh_tokens |
| client_type | text |  | 'web'::text |
| user_agent | text | yes |  |
| ip_address | inet | yes |  |
| last_used_at | timestamp with time zone | yes |  |
| created_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>reimbursements</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| code | text |  |  |
| employee_id | uuid |  | → employees |
| claim_type | text |  |  |
| description | text |  |  |
| amount | numeric |  |  |
| claim_date | date |  |  |
| status | text |  | 'Submitted'::text |
| approved_by | uuid | yes | → users |
| approved_at | timestamp with time zone | yes |  |
| paid_in_run_id | uuid | yes | → payroll_runs |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>report_card_batches</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| section_id | uuid |  | → sections |
| academic_year_id | uuid |  | → academic_years |
| term | text |  |  |
| stage | integer |  | 0 |
| due_on | date |  |  |
| released_at | timestamp with time zone | yes |  |
| approved_by | uuid | yes | → users |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>report_card_comments</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| batch_id | uuid |  | → report_card_batches |
| student_id | uuid |  | → students |
| comment | text |  |  |
| ai_drafted | boolean |  | false |
| status | text |  | 'Draft'::text |
| reviewed_by | uuid | yes | → users |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>role_permissions</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| role_id | uuid |  | → roles |
| permission_id | uuid |  | → permissions |

</details>

<details><summary><code>roles</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| key | text |  |  |
| name | text |  |  |
| description | text | yes |  |
| home_route | text |  | '/dashboard'::text |
| scope | text |  | 'school'::text |
| is_system | boolean |  | true |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>route_stops</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| route_id | uuid |  | → transport_routes |
| sequence | integer |  |  |
| name | text |  |  |
| latitude | numeric |  |  |
| longitude | numeric |  |  |
| pickup_time | time without time zone |  |  |
| drop_time | time without time zone | yes |  |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>schema_migrations</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| name | text |  |  |
| applied_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>scholarships</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| name | text |  |  |
| criteria | text | yes |  |
| amount | numeric |  | 0 |
| seats | integer |  | 0 |
| awarded | integer |  | 0 |
| academic_year_id | uuid |  | → academic_years |
| status | text |  | 'Open'::text |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>sections</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| class_id | uuid |  | → classes |
| academic_year_id | uuid |  | → academic_years |
| name | text |  |  |
| class_teacher_id | uuid | yes | → employees |
| room | text | yes |  |
| capacity | integer |  | 35 |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>shift_rosters</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| employee_id | uuid |  | → employees |
| shift_id | uuid |  | → shifts |
| roster_date | date |  |  |
| post | text | yes |  |
| status | text |  | 'Scheduled'::text |
| covered_by | uuid | yes | → employees |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>shifts</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| name | text |  |  |
| starts_at | time without time zone |  |  |
| ends_at | time without time zone |  |  |
| split_starts_at | time without time zone | yes |  |
| split_ends_at | time without time zone | yes |  |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>staff_attendance</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| employee_id | uuid |  | → employees |
| attendance_date | date |  |  |
| status | text |  |  |
| check_in | time without time zone | yes |  |
| check_out | time without time zone | yes |  |
| source | text |  | 'biometric'::text |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>student_academic_records</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| student_id | uuid |  | → students |
| academic_year_id | uuid |  | → academic_years |
| subject_id | uuid |  | → subjects |
| term | text |  |  |
| term_order | integer |  |  |
| score | numeric |  |  |
| grade | text | yes |  |
| target_score | numeric | yes |  |
| teacher_id | uuid | yes | → employees |
| remarks | text | yes |  |
| created_by | uuid | yes | → users |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>student_activities</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| student_id | uuid |  | → students |
| activity_id | uuid |  | → activities |
| role | text |  | 'Member'::text |
| since | date |  |  |
| hours | integer |  | 0 |
| status | text |  | 'active'::text |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>student_fees</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| student_id | uuid |  | → students |
| academic_year_id | uuid |  | → academic_years |
| fee_head_id | uuid |  | → fee_heads |
| fee_structure_id | uuid | yes | → fee_structures |
| description | text |  |  |
| amount_due | numeric |  |  |
| concession_amount | numeric |  | 0 |
| amount_paid | numeric |  | 0 |
| due_date | date |  |  |
| status | text |  | 'Pending'::text |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>student_guardians</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| student_id | uuid |  | → students |
| parent_id | uuid |  | → parents |
| relationship | text |  |  |
| is_primary | boolean |  | false |
| can_pickup | boolean |  | true |
| can_view_tracking | boolean |  | true |
| created_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>student_interests</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| student_id | uuid |  | → students |
| interest | text |  |  |
| created_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>student_latest_locations</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| student_id | uuid |  | → students |
| location_id | bigint |  |  |
| device_id | uuid | yes | → gps_devices |
| latitude | numeric |  |  |
| longitude | numeric |  |  |
| accuracy | numeric | yes |  |
| altitude | numeric | yes |  |
| speed | numeric | yes |  |
| heading | numeric | yes |  |
| location_status | text |  |  |
| place_label | text | yes |  |
| source | text |  |  |
| battery_pct | integer | yes |  |
| recorded_at | timestamp with time zone |  |  |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>student_locations</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | bigint |  |  |
| student_id | uuid |  | → students |
| latitude | numeric |  |  |
| longitude | numeric |  |  |
| accuracy | numeric | yes |  |
| location_status | text |  | 'unknown'::text |
| place_label | text | yes |  |
| source | text |  | 'device'::text |
| battery_pct | integer | yes |  |
| recorded_at | timestamp with time zone |  |  |
| created_at | timestamp with time zone |  | now() |
| device_id | uuid | yes | → gps_devices |
| altitude | numeric | yes |  |
| speed | numeric | yes |  |
| heading | numeric | yes |  |

</details>

<details><summary><code>student_skills</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| student_id | uuid |  | → students |
| skill | text |  |  |
| score | integer |  |  |
| confidence | text | yes |  |
| evidence | jsonb |  | '[]'::jsonb |
| assessed_on | date |  | CURRENT_DATE |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>student_timeline_events</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| student_id | uuid |  | → students |
| occurred_on | date |  |  |
| title | text |  |  |
| body | text | yes |  |
| category | text |  | 'milestone'::text |
| tone | text |  | 'neutral'::text |
| created_by | uuid | yes | → users |
| created_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>student_tracking_profiles</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| student_id | uuid |  | → students |
| tracking_enabled | boolean |  | true |
| tracking_status | text |  | 'active'::text |
| device_type | text |  | 'id_card_tag'::text |
| consent_given_by | uuid | yes | → parents |
| consent_given_at | timestamp with time zone | yes |  |
| is_sample_data | boolean |  | false |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>student_transfers</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| student_id | uuid |  | → students |
| from_campus_id | uuid |  | → campuses |
| to_campus_id | uuid |  | → campuses |
| reason | text |  |  |
| status | text |  | 'Submitted'::text |
| requested_on | date |  | CURRENT_DATE |
| decided_by | uuid | yes | → users |
| decided_at | timestamp with time zone | yes |  |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |
| requested_by | uuid | yes | → users |
| decision_note | text | yes |  |
| to_section_id | uuid | yes | → sections |
| from_section_id | uuid | yes | → sections |
| completed_by | uuid | yes | → users |
| completed_at | timestamp with time zone | yes |  |

</details>

<details><summary><code>student_transport</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| student_id | uuid |  | → students |
| route_id | uuid |  | → transport_routes |
| stop_id | uuid | yes | → route_stops |
| mode | text |  | 'both'::text |
| valid_from | date |  | CURRENT_DATE |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>students</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| admission_no | text |  |  |
| first_name | text |  |  |
| last_name | text |  |  |
| full_name | text | yes |  |
| photo_url | text | yes |  |
| date_of_birth | date |  |  |
| gender | text |  |  |
| blood_group | text | yes |  |
| campus_id | uuid |  | → campuses |
| section_id | uuid | yes | → sections |
| academic_year_id | uuid | yes | → academic_years |
| house | text | yes |  |
| address | text | yes |  |
| city | text | yes |  |
| pincode | text | yes |  |
| email | USER-DEFINED | yes |  |
| phone | text | yes |  |
| admitted_on | date | yes |  |
| status | text |  | 'active'::text |
| risk_level | text |  | 'On Track'::text |
| class_teacher_note | text | yes |  |
| counsellor_id | uuid | yes | → employees |
| medical_notes | text | yes |  |
| user_id | uuid | yes | → users |
| created_by | uuid | yes | → users |
| updated_by | uuid | yes | → users |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |
| deleted_at | timestamp with time zone | yes |  |

</details>

<details><summary><code>subjects</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| code | text |  |  |
| name | text |  |  |
| stage | text | yes |  |
| is_core | boolean |  | true |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>system_settings</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| key | text |  |  |
| value | jsonb |  |  |
| description | text | yes |  |
| is_public | boolean |  | false |
| updated_by | uuid | yes | → users |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>tasks</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| code | text |  |  |
| title | text |  |  |
| module | text |  |  |
| assignee_user_id | uuid | yes | → users |
| assignee_role_key | text | yes |  |
| due_on | date | yes |  |
| priority | text |  | 'Medium'::text |
| status | text |  | 'Pending'::text |
| route | text | yes |  |
| entity_type | text | yes |  |
| entity_id | text | yes |  |
| completed_at | timestamp with time zone | yes |  |
| completed_by | uuid | yes | → users |
| created_by | uuid | yes | → users |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>teacher_assignments</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| employee_id | uuid |  | → employees |
| section_id | uuid |  | → sections |
| subject_id | uuid |  | → subjects |
| academic_year_id | uuid |  | → academic_years |
| periods_per_week | integer |  | 5 |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>teacher_observations</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| student_id | uuid |  | → students |
| employee_id | uuid |  | → employees |
| observed_on | date |  |  |
| observation | text |  |  |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>teachers</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| employee_id | uuid |  | → employees |
| qualification | text | yes |  |
| specialisation | text | yes |  |
| is_mentor | boolean |  | false |
| max_periods_week | integer |  | 30 |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>timetable_entries</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| section_id | uuid |  | → sections |
| day_of_week | integer |  |  |
| period_id | uuid |  | → periods |
| subject_id | uuid | yes | → subjects |
| activity | text | yes |  |
| employee_id | uuid | yes | → employees |
| substitute_id | uuid | yes | → employees |
| room | text | yes |  |
| needs_substitute | boolean |  | false |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>transport_routes</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| campus_id | uuid |  | → campuses |
| code | text |  |  |
| name | text |  |  |
| area | text |  |  |
| vehicle_id | uuid | yes | → vehicles |
| driver_id | uuid | yes | → employees |
| attendant_id | uuid | yes | → employees |
| run_status | text |  | 'Scheduled'::text |
| delay_minutes | integer |  | 0 |
| eta_text | text | yes |  |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>users</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| email | USER-DEFINED |  |  |
| phone | text | yes |  |
| password_hash | text |  |  |
| full_name | text |  |  |
| title | text | yes |  |
| role_id | uuid |  | → roles |
| campus_id | uuid | yes | → campuses |
| avatar_url | text | yes |  |
| preferred_language | text |  | 'en'::text |
| status | text |  | 'active'::text |
| failed_login_count | integer |  | 0 |
| locked_until | timestamp with time zone | yes |  |
| last_login_at | timestamp with time zone | yes |  |
| password_changed_at | timestamp with time zone |  | now() |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |
| deleted_at | timestamp with time zone | yes |  |

</details>

<details><summary><code>vehicle_locations</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | bigint |  |  |
| vehicle_id | uuid |  | → vehicles |
| latitude | numeric |  |  |
| longitude | numeric |  |  |
| speed_kmph | numeric | yes |  |
| heading | integer | yes |  |
| recorded_at | timestamp with time zone |  |  |
| created_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>vehicles</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| campus_id | uuid |  | → campuses |
| bus_no | text |  |  |
| registration_no | text |  |  |
| capacity | integer |  | 40 |
| gps_device_id | text | yes |  |
| fitness_expiry | date | yes |  |
| insurance_expiry | date | yes |  |
| status | text |  | 'active'::text |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>vendors</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| name | text |  |  |
| category | text |  |  |
| contact_person | text | yes |  |
| phone | text | yes |  |
| email | USER-DEFINED | yes |  |
| contract_start | date | yes |  |
| contract_end | date | yes |  |
| contract_value | numeric |  | 0 |
| status | text |  | 'Active'::text |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>visitors</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| campus_id | uuid |  | → campuses |
| badge_no | text |  |  |
| full_name | text |  |  |
| phone | text | yes |  |
| purpose | text |  |  |
| host_employee_id | uuid | yes | → employees |
| checked_in_at | timestamp with time zone |  |  |
| checked_out_at | timestamp with time zone | yes |  |
| status | text |  | 'Inside'::text |
| created_by | uuid | yes | → users |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

<details><summary><code>wellbeing_checkins</code></summary>

| Column | Type | Null | Default / FK |
|---|---|---|---|
| id | uuid |  | gen_random_uuid() |
| student_id | uuid |  | → students |
| checked_on | date |  |  |
| mood | text |  |  |
| notes | text | yes |  |
| is_confidential | boolean |  | false |
| recorded_by | uuid | yes | → employees |
| created_at | timestamp with time zone |  | now() |
| updated_at | timestamp with time zone |  | now() |

</details>

