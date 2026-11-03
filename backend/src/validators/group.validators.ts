import { z } from 'zod';
import { paginationSchema } from '../utils/pagination.js';

const uuid = z.uuid();
const isoDate = z.iso.date();
const text = (max: number, min = 1) => z.string().trim().min(min).max(max);
const optText = (max: number) => z.string().trim().max(max).optional().nullable();

export const idParam = z.object({ id: uuid });
export const campusQuery = z.object({ campusId: uuid.optional() });

export const campusUpdate = z.object({
  name: text(120, 3).optional(),
  shortName: text(40, 2).optional(),
  place: text(80, 2).optional(),
  curriculum: optText(160),
  address: optText(300),
  established: z.coerce.number().int().min(1900).max(2100).optional(),
  staffingTarget: z.coerce.number().int().min(1).max(5000).optional(),
});

export const TRANSFER_STATUSES = ['Submitted', 'Under Review', 'Approved', 'Rejected', 'Completed'] as const;
export const transferListQuery = paginationSchema.extend({
  campusId: uuid.optional(),
  status: z.enum([...TRANSFER_STATUSES, 'open']).optional(),
});
export const transferCreate = z.object({
  studentId: z.string().trim().min(3).max(64),
  toCampusId: uuid,
  reason: text(300, 5),
});
export const transferDecision = z.object({
  action: z.enum(['review', 'approve', 'reject']),
  note: optText(500),
});
export const transferComplete = z.object({ sectionId: uuid, note: optText(300) });

export const POLICY_STATUSES = ['Draft', 'Under review', 'Active', 'Retired'] as const;
const version = z.string().trim().regex(/^v\d+(\.\d+){0,2}$/, 'Use a version like v1.0');
export const policyListQuery = paginationSchema.extend({ status: z.enum(POLICY_STATUSES).optional() });
export const policyCreate = z.object({
  name: text(160, 3),
  scope: text(80, 3).default('All campuses'),
  version,
  body: optText(20000),
  status: z.enum(POLICY_STATUSES).default('Draft'),
  effectiveOn: isoDate.optional().nullable(),
});
export const policyUpdate = z.object({
  name: text(160, 3).optional(),
  scope: text(80, 3).optional(),
  version: version.optional(),
  body: optText(20000),
  status: z.enum(POLICY_STATUSES).optional(),
  effectiveOn: isoDate.optional().nullable(),
  changeNote: optText(300),
});
