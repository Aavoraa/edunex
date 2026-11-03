import { z } from 'zod';
import { paginationSchema } from '../utils/pagination.js';

/** Input schemas for the finance module (fees, payments, concessions, expenses …). */

const paise = (v: number) => Math.abs(Math.round(v * 100) - v * 100) < 1e-6;
const money = z.coerce.number().positive().max(100_000_000).refine(paise, { message: 'At most two decimal places' });
const moneyOrZero = z.coerce.number().min(0).max(1_000_000_000).refine(paise, { message: 'At most two decimal places' });
const text = (max: number) => z.string().trim().min(1).max(max);
const optText = (max: number) => z.string().trim().max(max).optional();

export const idParam = z.object({ id: z.uuid() });
/** Student id may be a uuid or an admission number (HS-2026-1041). */
export const studentParam = z.object({ studentId: z.string().trim().min(1).max(64) });
export const paymentIdParam = z.object({ paymentId: z.uuid() });
export const campusQuery = z.object({ campusId: z.uuid().optional() });

export const PAYMENT_METHODS = ['UPI', 'Card', 'Net Banking', 'Cash', 'DD', 'Cheque'] as const;
export const ONLINE_METHODS = ['UPI', 'Card', 'Net Banking'] as const;
export const CONCESSION_TYPES = ['Sibling concession', 'Staff ward concession', 'Merit scholarship', 'Need-based support', 'Sports quota'] as const;
export const SCHOLARSHIP_TYPES = ['Merit scholarship', 'Need-based support', 'Sports quota'] as const;
export const WORKFLOW = ['Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected', 'Paid'] as const;

const dateStr = z.iso.date();
const feeIds = z.array(z.uuid()).min(1).max(50).optional();

// ---- Fee structures ----------------------------------------------------------
export const structureListQuery = paginationSchema.extend({
  campusId: z.uuid().optional(),
  classId: z.uuid().optional(),
  feeHeadId: z.uuid().optional(),
  status: z.enum(['Draft', 'Active', 'Archived']).optional(),
});

export const structureCreate = z.object({
  classIds: z.array(z.uuid()).min(1).max(40),
  feeHeadId: z.uuid(),
  term: z.enum(['Term 1', 'Term 2', 'Term 3', 'Annual']),
  amount: moneyOrZero,
  dueDate: dateStr,
  status: z.enum(['Draft', 'Active']).default('Active'),
  applyNow: z.boolean().default(false),
});

export const structureUpdate = z.object({
  amount: moneyOrZero.optional(),
  dueDate: dateStr.optional(),
  status: z.enum(['Draft', 'Active', 'Archived']).optional(),
}).refine((x) => Object.keys(x).length > 0, { message: 'Nothing to update' });

// ---- Accounts, payments --------------------------------------------------------
export const accountListQuery = paginationSchema.extend({
  campusId: z.uuid().optional(),
  classId: z.uuid().optional(),
  feeStatus: z.enum(['Paid', 'Pending', 'Partial', 'Overdue']).optional(),
});

export const counterPayment = z.object({
  amount: money,
  method: z.enum(PAYMENT_METHODS),
  feeIds,
  reference: optText(80),
});

export const chargeCreate = z.object({
  feeHeadId: z.uuid(),
  description: text(160),
  amount: money,
  dueDate: dateStr,
});

export const familyPayment = z.object({
  amount: money,
  method: z.enum(ONLINE_METHODS),
  feeIds,
});

export const paymentListQuery = paginationSchema.extend({
  campusId: z.uuid().optional(),
  method: z.enum([...PAYMENT_METHODS, 'Cash / DD']).optional(),
  status: z.enum(['Initiated', 'Success', 'Failed', 'Refunded']).optional(),
  delivery: z.enum(['Delivered', 'Pending']).optional(),
  reconciled: z.stringbool().optional(),
  from: dateStr.optional(),
  to: dateStr.optional(),
});

export const reminderSend = z.object({
  audience: z.enum(['overdue30', 'outstanding', 'due7']).optional(),
  studentIds: z.array(z.uuid()).min(1).max(200).optional(),
  channel: z.enum(['whatsapp_app', 'whatsapp', 'sms_app']).default('whatsapp_app'),
  message: text(600),
  campusId: z.uuid().optional(),
}).refine((x) => !!x.audience || !!x.studentIds, { message: 'Choose an audience or students', path: ['audience'] });

// ---- Concessions / scholarships -----------------------------------------------
export const concessionListQuery = paginationSchema.extend({
  campusId: z.uuid().optional(),
  status: z.enum(['Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected']).optional(),
  type: z.enum(CONCESSION_TYPES).optional(),
  group: z.enum(['scholarship']).optional(),
});

export const concessionCreate = z.object({
  studentId: z.uuid(),
  type: z.enum(CONCESSION_TYPES),
  percent: z.coerce.number().positive().max(100).optional(),
  amount: money.optional(),
  reason: text(500),
}).refine((x) => (x.percent != null) !== (x.amount != null), { message: 'Give either a percentage of tuition or a fixed amount', path: ['amount'] });

export const reasonBody = z.object({ reason: text(500) });

export const scholarshipCreate = z.object({
  name: text(120),
  criteria: optText(500),
  amount: money,
  seats: z.coerce.number().int().min(1).max(1000),
});
export const scholarshipUpdate = z.object({ status: z.enum(['Open', 'Closed', 'Awarded']) });

// ---- Expenses / reimbursements ----------------------------------------------------
export const expenseListQuery = paginationSchema.extend({
  campusId: z.uuid().optional(),
  status: z.enum(WORKFLOW).optional(),
  category: z.string().trim().max(60).optional(),
  from: dateStr.optional(),
  to: dateStr.optional(),
});

export const expenseCreate = z.object({
  campusId: z.uuid(),
  category: text(60),
  description: text(200),
  amount: money,
  expenseDate: dateStr,
  vendorId: z.uuid().optional(),
  submittedBy: z.uuid().optional(),
  submit: z.boolean().default(true),
});

export const reimbursementListQuery = paginationSchema.extend({
  campusId: z.uuid().optional(),
  status: z.enum(WORKFLOW).optional(),
  claimType: z.string().trim().max(40).optional(),
});

export const reimbursementCreate = z.object({
  employeeId: z.uuid(),
  claimType: z.enum(['Travel', 'Training', 'Supplies', 'Medical', 'Transport', 'Other']),
  description: text(200),
  amount: money,
  claimDate: dateStr,
});

export const payBody = z.object({ payrollRunId: z.uuid().optional() });

// ---- Allowances ----------------------------------------------------------------
export const allowanceListQuery = paginationSchema.extend({
  campusId: z.uuid().optional(),
  allowanceType: z.string().trim().max(60).optional(),
  status: z.enum(['Submitted', 'Approved', 'Rejected', 'Stopped']).optional(),
});

export const allowanceCreate = z.object({
  allowanceType: text(60),
  employeeIds: z.array(z.uuid()).min(1).max(500).optional(),
  category: z.string().trim().max(60).optional(),
  employeeType: z.enum(['teaching', 'non_teaching', 'all']).optional(),
  amount: moneyOrZero.optional(),
  percentOfBasic: z.coerce.number().positive().max(100).optional(),
  frequency: z.enum(['Monthly', 'One-time']).default('Monthly'),
  effectiveMonth: dateStr,
  campusId: z.uuid().optional(),
})
  .refine((x) => !!(x.employeeIds || x.category || x.employeeType), { message: 'Choose who the allowance applies to', path: ['category'] })
  .refine((x) => (x.amount != null) !== (x.percentOfBasic != null), { message: 'Give a fixed amount or a percentage of basic', path: ['amount'] });

export const allowanceDecision = z.object({
  allowanceType: text(60),
  decision: z.enum(['Approved', 'Rejected', 'Stopped']),
  campusId: z.uuid().optional(),
});

// ---- Budgets ---------------------------------------------------------------------
export const budgetUpsert = z.object({
  campusId: z.uuid(),
  category: text(60),
  allocated: moneyOrZero,
  owner: optText(80),
});
export const budgetUpdate = z.object({ allocated: moneyOrZero.optional(), owner: optText(80) })
  .refine((x) => Object.keys(x).length > 0, { message: 'Nothing to update' });

// ---- Reconciliation -----------------------------------------------------------------
export const reconListQuery = paginationSchema.extend({
  status: z.enum(['Matched', 'Unmatched', 'Exception', 'Resolved']).optional(),
  from: dateStr.optional(),
  to: dateStr.optional(),
});
export const matchBody = z.object({ paymentId: z.uuid(), note: optText(300) });
export const noteBody = z.object({ note: text(300) });

// ---- Reports ----------------------------------------------------------------------
export const REPORT_KEYS = [
  'fee-collection', 'ageing', 'cash-flow', 'concessions', 'expense-budget',
  'payroll-cost', 'reconciliation', 'campus-comparison', 'audit-pack',
] as const;
export const reportParam = z.object({ key: z.enum(REPORT_KEYS) });
