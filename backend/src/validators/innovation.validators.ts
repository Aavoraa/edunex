import { z } from 'zod';
import { paginationSchema } from '../utils/pagination.js';

const uuid = z.uuid();
const isoDate = z.iso.date();
const text = (max: number, min = 1) => z.string().trim().min(min).max(max);
const optText = (max: number) => z.string().trim().max(max).optional().nullable();
const studentRef = z.string().trim().min(3).max(64);   // uuid or admission number

export const STAGES = ['Idea', 'Review', 'Mentor', 'Project', 'Prototype', 'Competition', 'Achievement'] as const;
export const STAGE_STATUS = ['Idea', 'Under review', 'Mentor assigned', 'Project', 'Prototype', 'Competition', 'Achievement'] as const;
export const IDEA_AREAS = ['Robotics & electronics', 'Software & apps', 'Environment & sustainability', 'Health & wellbeing', 'Community & social', 'Other'] as const;
export const IDEA_STATUSES = ['Submitted', 'Under Review', 'Accepted', 'Declined', 'Converted'] as const;

export const idParam = z.object({ id: uuid });
export const memberParams = z.object({ id: uuid, studentId: uuid });
export const entryParams = z.object({ id: uuid, projectId: uuid });
export const campusQuery = z.object({ campusId: uuid.optional() });

// ---- Ideas -------------------------------------------------------------------
export const ideaListQuery = paginationSchema.extend({
  campusId: uuid.optional(),
  status: z.enum([...IDEA_STATUSES, 'open']).optional(),
  category: z.string().max(60).optional(),
});
export const ideaCreate = z.object({
  title: text(160, 4),
  problem: text(1000, 10),
  studentId: studentRef,
  category: z.enum(IDEA_AREAS),
  wantsMentor: z.enum(['Yes, please assign one', 'I already have one in mind', 'Not yet']).optional(),
});
/**
 * A student submitting from their own portal. There is deliberately no studentId:
 * the route resolves it from the access token, so the body cannot name anyone else.
 */
export const selfIdeaCreate = ideaCreate.omit({ studentId: true });

export const ideaReview = z.object({
  action: z.enum(['start', 'accept', 'decline']),
  note: optText(500),
});
export const ideaConvert = z.object({
  mentorId: uuid,
  title: text(160, 4).optional(),
  summary: optText(1000),
  milestones: z.array(z.object({ title: text(160, 3), dueOn: isoDate.optional().nullable() })).max(12).optional(),
});

// ---- Projects ----------------------------------------------------------------
export const projectListQuery = paginationSchema.extend({
  campusId: uuid.optional(),
  stage: z.coerce.number().int().min(0).max(6).optional(),
  mentorId: uuid.optional(),
  studentId: uuid.optional(),
  active: z.stringbool().optional(),
});
export const projectCreate = z.object({
  title: text(160, 4),
  summary: optText(1000),
  leadStudentId: studentRef,
  mentorId: uuid,
  stage: z.coerce.number().int().min(1).max(5).default(3),
  memberIds: z.array(studentRef).max(10).optional(),
  milestones: z.array(z.object({ title: text(160, 3), dueOn: isoDate.optional().nullable() })).max(12).optional(),
});
export const projectUpdate = z.object({
  title: text(160, 4).optional(),
  summary: optText(1000),
  mentorId: uuid.optional(),
});
export const projectAdvance = z.object({
  achievementTitle: text(160, 4).optional(),
  level: z.enum(['School', 'District', 'State', 'National', 'International']).optional(),
  achievedOn: isoDate.optional(),
  note: optText(300),
});
export const memberAdd = z.object({ studentId: studentRef, role: text(40).default('Member') });

// ---- Milestones ----------------------------------------------------------------
export const milestoneListQuery = paginationSchema.extend({
  campusId: uuid.optional(),
  status: z.enum(['Completed', 'Overdue', 'In Progress', 'Pending', 'due_week', 'open']).optional(),
  projectId: uuid.optional(),
});
export const milestoneCreate = z.object({ title: text(160, 3), dueOn: isoDate.optional().nullable() });
export const milestoneUpdate = z.object({
  title: text(160, 3).optional(),
  dueOn: isoDate.optional().nullable(),
  completed: z.boolean().optional(),
  completedOn: isoDate.optional(),
  evidence: optText(1000),
  feedback: optText(1000),
});

// ---- Evidence & feedback -------------------------------------------------------
export const evidenceCreate = z.object({
  title: text(160, 3),
  kind: z.enum(['Photo', 'Video', 'Document', 'Test log', 'Link', 'Judging sheet']),
  link: z.url({ protocol: /^https?$/ }).max(500).optional().nullable(),
  note: optText(500),
  milestoneId: uuid.optional().nullable(),
});
export const feedbackCreate = z.object({ body: text(2000, 5) });

// ---- Mentors -------------------------------------------------------------------
export const mentorListQuery = z.object({ campusId: uuid.optional(), q: z.string().trim().max(100).optional(), all: z.stringbool().optional() });
export const mentorUpdate = z.object({ isMentor: z.boolean() });

// ---- Competitions --------------------------------------------------------------
export const competitionListQuery = paginationSchema.extend({ when: z.enum(['upcoming', 'past']).optional() });
export const competitionCreate = z.object({
  name: text(160, 3),
  level: z.enum(['School', 'District', 'State', 'National', 'International']),
  heldOn: isoDate,
  result: optText(200),
});
export const competitionUpdate = competitionCreate.partial();
export const entryCreate = z.object({ projectId: uuid, result: optText(200) });
export const entryUpdate = z.object({ result: text(200) });

// ---- Achievements ---------------------------------------------------------------
export const achievementListQuery = paginationSchema.extend({
  campusId: uuid.optional(),
  type: z.string().max(40).optional(),
});
