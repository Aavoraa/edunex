import { z } from 'zod';
import { paginationSchema } from '../utils/pagination.js';

const uuid = z.uuid();
const isoDate = z.iso.date();
const text = (min: number, max: number) => z.string().trim().min(min).max(max);

export const idParam = z.object({ id: uuid });
export const studentParam = z.object({ id: z.string().min(1).max(64) }); // uuid or admission number
export const campusQuery = z.object({ campusId: uuid.optional() });

export const RISK_LEVELS = ['On Track', 'Watch', 'Developing Risk', 'At Risk'] as const;
export const INTERVENTION_FILTERS = ['Review pending', 'Planned', 'Active', 'Monitoring', 'None'] as const;
export const SIGNAL_TYPES = ['attendance', 'academic', 'behaviour', 'wellbeing', 'transport'] as const;

// ---------------------------------------------------------------------------
// Early Warning
// ---------------------------------------------------------------------------
export const ewStudentsQuery = paginationSchema.extend({
  campusId: uuid.optional(),
  grade: z.string().max(20).optional(),
  risk: z.enum(RISK_LEVELS).optional(),
  intervention: z.enum(INTERVENTION_FILTERS).optional(),
  /** true = include On Track students when no risk filter is set */
  includeOnTrack: z.stringbool().optional(),
});

export const ewSignalsQuery = paginationSchema.extend({
  campusId: uuid.optional(),
  status: z.enum(['awaiting', 'open', 'closed', 'dismissed', 'all']).default('awaiting'),
  type: z.enum(SIGNAL_TYPES).optional(),
  stage: z.coerce.number().int().min(0).max(5).optional(),
});

export const ewReviewSchema = z.discriminatedUnion('decision', [
  z.object({
    decision: z.literal('accept'),
    actionPlan: text(5, 1000),
    ownerId: uuid,
    nextReviewOn: isoDate,
    riskLevel: z.enum(RISK_LEVELS).optional(),
    context: z.string().trim().max(2000).optional(),
  }),
  z.object({
    decision: z.literal('dismiss'),
    reason: text(5, 1000),
    context: z.string().trim().max(2000).optional(),
  }),
]);

export const ewAdvanceSchema = z.object({
  note: text(3, 1000),
  nextReviewOn: isoDate.optional(),
});

export const ewCloseSchema = z.object({
  outcome: text(5, 1000),
  riskLevel: z.enum(RISK_LEVELS).optional(),
});

export const ewRunCheckSchema = z.object({
  campusId: uuid.optional(),
});

// ---------------------------------------------------------------------------
// Talent, wellbeing, portfolio
// ---------------------------------------------------------------------------
export const talentDecisionSchema = z.discriminatedUnion('decision', [
  z.object({ decision: z.literal('accept'), opportunity: text(5, 300) }),
  z.object({ decision: z.literal('dismiss'), reason: text(5, 500) }),
]);

export const wellbeingListQuery = paginationSchema.extend({
  campusId: uuid.optional(),
  type: z.enum(['Positive', 'Note', 'Concern', 'Incident']).optional(),
  mood: z.string().max(30).optional(),
});

export const behaviourCreateSchema = z.object({
  studentId: z.string().min(1).max(64),
  recordType: z.enum(['Positive', 'Note', 'Concern', 'Incident']),
  note: text(3, 1000),
  recordedOn: isoDate.optional(),
});

export const MOODS = ['Positive', 'Settled', 'Unsettled', 'Anxious', 'Low'] as const;

export const checkinCreateSchema = z.object({
  studentId: z.string().min(1).max(64),
  mood: z.enum(MOODS),
  notes: z.string().trim().max(1000).optional(),
  isConfidential: z.boolean().default(false),
  checkedOn: isoDate.optional(),
});

// ---------------------------------------------------------------------------
// Co-Pilot
// ---------------------------------------------------------------------------
export const DRAFT_TYPES = ['lesson', 'worksheet', 'quiz', 'comment', 'message', 'brief'] as const;
export type DraftType = (typeof DRAFT_TYPES)[number];

export const copilotContextQuery = z.object({
  grade: z.coerce.number().int().min(1).max(12).optional(),
  subjectId: uuid.optional(),
  topic: z.string().trim().max(80).optional(),
  sectionId: uuid.optional(),
});

export const draftCreateSchema = z.object({
  type: z.enum(DRAFT_TYPES),
  grade: z.coerce.number().int().min(1).max(12),
  subjectId: uuid,
  topic: text(2, 80),
  sectionId: uuid.optional(),
  studentId: z.string().min(1).max(64).optional(),
  lessonMinutes: z.coerce.number().int().refine((n) => [40, 60, 80].includes(n), 'Choose 40, 60 or 80 minutes').default(40),
  messagePurpose: z.enum(['attendance', 'homework', 'progress', 'general']).default('general'),
  plannedFor: isoDate.optional(),
}).superRefine((o, ctx) => {
  if ((o.type === 'comment' || o.type === 'brief') && !o.sectionId) {
    ctx.addIssue({ code: 'custom', path: ['sectionId'], message: 'Choose a class section' });
  }
  if (o.type === 'message' && !o.studentId) {
    ctx.addIssue({ code: 'custom', path: ['studentId'], message: 'Choose a student' });
  }
});

export const draftListQuery = paginationSchema.extend({
  type: z.enum(DRAFT_TYPES).optional(),
  status: z.enum(['Draft', 'Under Review', 'Approved', 'Rejected']).optional(),
  mine: z.stringbool().optional(),
});

export const draftUpdateSchema = z.object({
  output: z.record(z.string(), z.unknown()).refine((o) => JSON.stringify(o).length <= 60_000, 'Draft is too large'),
});

export const draftDiscardSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

// ---------------------------------------------------------------------------
// Knowledge AI
// ---------------------------------------------------------------------------
export const knowledgeAskSchema = z.object({
  question: text(3, 300),
});

export const knowledgeFeedbackSchema = z.object({
  question: text(3, 300),
  helpful: z.boolean(),
  documentIds: z.array(uuid).max(10).default([]),
  routeToPerson: z.boolean().default(false),
});

// ---------------------------------------------------------------------------
// Analytics & reports
// ---------------------------------------------------------------------------
export const ANALYTICS_AREAS = ['students', 'attendance', 'academics', 'admissions', 'finance', 'workforce', 'safety'] as const;

export const analyticsQuery = z.object({
  area: z.enum(ANALYTICS_AREAS).default('students'),
  campusId: uuid.optional(),
});

export const reportKeyParam = z.object({ key: z.string().regex(/^[a-z-]{3,40}$/) });

export const reportExportQuery = z.object({
  campusId: uuid.optional(),
  date: isoDate.optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});

/** Report Centre preview: the export filters plus on-screen paging, sorting and search. */
export const reportPreviewQuery = reportExportQuery.extend({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
  sort: z.string().max(60).optional(),
  dir: z.enum(['asc', 'desc']).default('asc'),
  q: z.string().trim().max(100).optional(),
});
