import { z } from 'zod';
import { paginationSchema } from '../utils/pagination.js';

const date = z.iso.date();
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Use HH:MM');
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use YYYY-MM');
const text = (max: number) => z.string().trim().min(1).max(max);
const optText = (max: number) => z.string().trim().max(max).optional().nullable();

export const idParam = z.object({ id: z.uuid() });
export const campusQuery = z.object({ campusId: z.uuid().optional() });

export const EMPLOYEE_TYPES = ['teaching', 'non_teaching'] as const;
export const ATTENDANCE_STATUSES = ['Present', 'Absent', 'Late', 'On Leave', 'Half Day'] as const;
export const EMPLOYEE_CATEGORIES = [
  'Leadership', 'Teachers', 'Reception & Admin', 'Security', 'Drivers & Attendants', 'Housekeeping', 'Lab Staff', 'Library Staff',
] as const;

// ---- Employees ---------------------------------------------------------------
export const summaryQuery = z.object({
  campusId: z.uuid().optional(),
  employeeType: z.enum(EMPLOYEE_TYPES).optional(),
});

export const employeeListQuery = paginationSchema.extend({
  campusId: z.uuid().optional(),
  employeeType: z.enum(EMPLOYEE_TYPES).optional(),
  department: z.string().max(60).optional(),
  category: z.string().max(60).optional(),
  today: z.enum([...ATTENDANCE_STATUSES, 'Not marked']).optional(),
  employmentStatus: z.enum(['active', 'on_notice', 'exited']).optional(),
});

const employeeBase = z.object({
  fullName: text(120),
  gender: z.enum(['M', 'F', 'O']).optional().nullable(),
  dateOfBirth: date.optional().nullable(),
  phone: z.string().trim().regex(/^\+?[0-9 ]{8,16}$/, 'Enter a valid phone number').optional().nullable(),
  email: z.email().max(120).optional().nullable(),
  campusId: z.uuid(),
  department: text(60),
  designation: text(80),
  employeeType: z.enum(EMPLOYEE_TYPES),
  category: z.enum(EMPLOYEE_CATEGORIES),
  shiftName: optText(60),
  joinDate: date.optional().nullable(),
  employmentStatus: z.enum(['active', 'on_notice', 'exited']).optional(),
  basicSalary: z.coerce.number().min(0).max(10_000_000),
  bankAccountMasked: z.string().trim().regex(/^[X0-9 ]{4,24}$/, 'Masked account, e.g. XXXXXX4417').optional().nullable(),
  workloadPeriods: z.coerce.number().int().min(0).max(60).optional(),
  backgroundVerified: z.boolean().optional(),
  qualification: optText(120),
  specialisation: optText(120),
  maxPeriodsWeek: z.coerce.number().int().min(1).max(60).optional(),
  licenceNoMasked: optText(40),
  licenceExpiry: date.optional().nullable(),
});
export const employeeCreateSchema = employeeBase;
export const employeeUpdateSchema = employeeBase.partial();

// ---- Attendance ----------------------------------------------------------------
export const attendanceQuery = paginationSchema.extend({
  date: date.optional(),
  campusId: z.uuid().optional(),
  employeeType: z.enum(EMPLOYEE_TYPES).optional(),
  department: z.string().max(60).optional(),
  status: z.enum([...ATTENDANCE_STATUSES, 'Not marked']).optional(),
});
export const attendanceSummaryQuery = z.object({ date: date.optional(), campusId: z.uuid().optional() });

export const attendanceMarkSchema = z.object({
  employeeId: z.uuid(),
  date,
  status: z.enum(ATTENDANCE_STATUSES),
  checkIn: time.optional().nullable(),
  checkOut: time.optional().nullable(),
}).refine((b) => !['Present', 'Late', 'Half Day'].includes(b.status) || !!b.checkIn, { message: 'Check-in time is required for this status', path: ['checkIn'] });

// ---- Shifts & roster ----------------------------------------------------------------
export const shiftSchema = z.object({
  name: text(60),
  startsAt: time,
  endsAt: time,
  splitStartsAt: time.optional().nullable(),
  splitEndsAt: time.optional().nullable(),
}).refine((b) => !b.splitStartsAt === !b.splitEndsAt, { message: 'Give both split times or neither', path: ['splitEndsAt'] });

export const rosterQuery = z.object({ weekStart: date.optional(), campusId: z.uuid().optional() });
export const rosterEntrySchema = z.object({
  employeeId: z.uuid(),
  shiftId: z.uuid(),
  date,
  post: text(120),
});
export const coverSchema = z.object({ coverEmployeeId: z.uuid() });
export const flagCoverSchema = z.object({ reason: optText(200) });
export const publishSchema = z.object({ weekStart: date, campusId: z.uuid().optional() });

// ---- Leave ---------------------------------------------------------------------------
export const leaveListQuery = paginationSchema.extend({
  campusId: z.uuid().optional(),
  status: z.enum(['Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected', 'Cancelled', 'open']).optional(),
  employeeType: z.enum(EMPLOYEE_TYPES).optional(),
  leaveTypeId: z.uuid().optional(),
});
const leaveBase = z.object({
  leaveTypeId: z.uuid(),
  fromDate: date,
  toDate: date,
  halfDay: z.boolean().optional(),
  reason: text(500),
  coverArrangement: optText(120),
});
const leaveRefine = <T extends z.ZodType<{ fromDate: string; toDate: string; halfDay?: boolean }>>(s: T) =>
  s.refine((b) => b.toDate >= b.fromDate, { message: 'End date must be on or after the start date', path: ['toDate'] })
    .refine((b) => !b.halfDay || b.fromDate === b.toDate, { message: 'A half day must start and end on the same date', path: ['halfDay'] });
export const leaveCreateSchema = leaveRefine(leaveBase.extend({ employeeId: z.uuid() }));
export const selfLeaveSchema = leaveRefine(leaveBase);
export const leaveUpdateSchema = z.object({ coverArrangement: optText(120) });
export const decisionSchema = z.object({ note: optText(500) });
export const rejectSchema = z.object({ note: text(500) });

// ---- Overtime ----------------------------------------------------------------------------
export const overtimeListQuery = paginationSchema.extend({
  campusId: z.uuid().optional(),
  status: z.enum(['Submitted', 'Under Review', 'Approved', 'Rejected', 'Paid', 'open']).optional(),
  month: month.optional(),
  department: z.string().max(60).optional(),
});
const overtimeBase = z.object({
  workDate: date,
  hours: z.coerce.number().positive().max(24).multipleOf(0.5, 'Use half-hour steps'),
  reason: text(300),
});
export const overtimeCreateSchema = overtimeBase.extend({
  employeeId: z.uuid(),
  ratePerHour: z.coerce.number().min(0).max(100_000).optional(),
});
export const selfOvertimeSchema = overtimeBase;

// ---- Workload & CPD -------------------------------------------------------------------------
export const cpdListQuery = paginationSchema.extend({
  campusId: z.uuid().optional(),
  employeeType: z.enum(EMPLOYEE_TYPES).optional(),
  department: z.string().max(60).optional(),
  band: z.enum(['met', 'near', 'below']).optional(),
});
export const cpdRecordsQuery = z.object({ employeeId: z.uuid().optional(), status: z.enum(['Planned', 'In Progress', 'Completed']).optional() });
export const cpdCreateSchema = z.object({
  employeeIds: z.array(z.uuid()).min(1).max(200),
  programme: text(160),
  provider: optText(120),
  hours: z.coerce.number().int().min(1).max(200),
  completedOn: date.optional().nullable(),
  status: z.enum(['Planned', 'In Progress', 'Completed']),
}).refine((b) => b.status !== 'Completed' || !!b.completedOn, { message: 'Completion date is required', path: ['completedOn'] });
export const cpdUpdateSchema = z.object({
  status: z.enum(['Planned', 'In Progress', 'Completed']),
  completedOn: date.optional().nullable(),
});

// ---- Payroll -----------------------------------------------------------------------------------
export const runListQuery = paginationSchema.extend({
  campusId: z.uuid().optional(),
  status: z.enum(['Draft', 'Inputs', 'Calculated', 'Under Review', 'Approved', 'Released', 'Paid']).optional(),
});
export const runCreateSchema = z.object({ campusId: z.uuid(), payMonth: month });
export const returnSchema = z.object({ note: text(500) });

export const payslipListQuery = paginationSchema.extend({
  runId: z.uuid().optional(),
  campusId: z.uuid().optional(),
  employeeType: z.enum(EMPLOYEE_TYPES).optional(),
  status: z.enum(['Draft', 'Released']).optional(),
});

// ---- Self-service ----------------------------------------------------------------------------------
export const selfAttendanceQuery = z.object({ from: date.optional(), to: date.optional() });
export const selfRosterQuery = z.object({ weekStart: date.optional() });
