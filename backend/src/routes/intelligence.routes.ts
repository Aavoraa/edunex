import { Router, type Request, type Response } from 'express';
import { requireAny, requirePermission } from '../middleware/auth.js';
import { validate, v } from '../middleware/validate.js';
import { created, ok, paged } from '../utils/response.js';
import { audit } from '../services/audit.service.js';
import * as ew from '../services/intelligence-earlywarning.service.js';
import * as people from '../services/intelligence-students.service.js';
import * as copilot from '../services/intelligence-copilot.service.js';
import * as knowledge from '../services/intelligence-knowledge.service.js';
import * as analytics from '../services/intelligence-analytics.service.js';
import * as reportcentre from '../services/intelligence-reportcenter.service.js';
import { providerInfo } from '../services/intelligence-provider.js';
import { STAGES, sendCsv, toCsv, schoolToday } from '../services/intelligence-common.service.js';
import {
  analyticsQuery, behaviourCreateSchema, campusQuery, checkinCreateSchema, copilotContextQuery, draftCreateSchema,
  draftDiscardSchema, draftListQuery, draftUpdateSchema, ewAdvanceSchema, ewCloseSchema, ewReviewSchema, ewRunCheckSchema,
  ewSignalsQuery, ewStudentsQuery, idParam, knowledgeAskSchema, knowledgeFeedbackSchema, reportExportQuery, reportKeyParam,
  reportPreviewQuery, studentParam, talentDecisionSchema, wellbeingListQuery,
} from '../validators/intelligence.validators.js';

/**
 * Intelligence module: Early Warning, Talent Discovery, Behaviour & Wellbeing, Portfolio,
 * AI Teacher Co-Pilot, School Knowledge AI, Analytics and Reports.
 * Mounted at /api behind authentication; every route declares its permission.
 */
const r = Router();

const EW_READ = requirePermission('earlywarning.read');
const EW_MANAGE = requirePermission('earlywarning.manage');
const STAFF = requireAny('students.read', 'students.read_assigned');
const TALENT = requireAny('students.read', 'students.read_assigned', 'ai.use');
const AI = requirePermission('ai.use');
const REPORTS = requirePermission('reports.read');

// =============================================================================
// Early Warning
// =============================================================================
r.get('/early-warning/summary', EW_READ, validate(campusQuery, 'query'), async (req: Request, res: Response) =>
  ok(res, await ew.summary(req.user!, v(req, 'query').campusId), 'Early Warning summary'));

r.get('/early-warning/students', EW_READ, validate(ewStudentsQuery, 'query'), async (req: Request, res: Response) => {
  const f = v(req, 'query');
  const { rows, total } = await ew.listStudents(req.user!, f);
  return paged(res, rows, total, f.page, f.pageSize, 'Early Warning students retrieved');
});

r.get('/early-warning/export', EW_READ, validate(ewStudentsQuery, 'query'), async (req: Request, res: Response) => {
  const f = { ...v(req, 'query'), page: 1, pageSize: 5000 };
  const { rows } = await ew.listStudents(req.user!, f);
  const csv = toCsv([
    { key: 'admissionNo', label: 'Admission no' }, { key: 'fullName', label: 'Student' }, { key: 'campusName', label: 'Campus' },
    { key: 'grade', label: 'Grade' }, { key: 'section', label: 'Section' }, { key: 'attendance', label: 'Attendance %' },
    { key: 'average', label: 'Latest average' }, { key: 'trend', label: 'Trend' }, { key: 'risk', label: 'Risk' },
    { key: 'intervention', label: 'Intervention' }, { key: 'signalCode', label: 'Signal' }, { key: 'owner', label: 'Owner' },
  ], rows);
  await audit(req, { action: 'export', module: 'earlywarning', description: `Exported Early Warning review list (${rows.length} students)`, metadata: { filters: v(req, 'query') } });
  return sendCsv(res, `early-warning-review-${schoolToday()}.csv`, csv);
});

r.get('/early-warning/signals', EW_READ, validate(ewSignalsQuery, 'query'), async (req: Request, res: Response) => {
  const f = v(req, 'query');
  const { rows, total } = await ew.listSignals(req.user!, f);
  return paged(res, rows.map((x) => ({ ...x, stageLabel: STAGES[x.stage] })), total, f.page, f.pageSize, 'Signals retrieved');
});

r.get('/early-warning/signals/:id', EW_READ, validate(idParam, 'params'), async (req: Request, res: Response) => {
  const data = await ew.getSignal(req.user!, v(req, 'params').id);
  await audit(req, { action: 'view', module: 'earlywarning', entityType: 'early_warning_signal', entityId: data.id, description: `Viewed signal ${data.code}` });
  return ok(res, data, 'Signal retrieved');
});

r.post('/early-warning/signals/:id/review', EW_MANAGE, validate(idParam, 'params'), validate(ewReviewSchema), async (req: Request, res: Response) => {
  const out = await ew.review(req, v(req, 'params').id, v(req));
  return ok(res, out, out.decision === 'accepted' ? 'Intervention opened and owner notified' : 'Signal dismissed — reason recorded in the audit trail');
});

r.post('/early-warning/signals/:id/advance', EW_MANAGE, validate(idParam, 'params'), validate(ewAdvanceSchema), async (req: Request, res: Response) => {
  const out = await ew.advance(req, v(req, 'params').id, v(req));
  return ok(res, out, `Moved to ${out.stageLabel}`);
});

r.post('/early-warning/signals/:id/close', EW_MANAGE, validate(idParam, 'params'), validate(ewCloseSchema), async (req: Request, res: Response) =>
  ok(res, await ew.close(req, v(req, 'params').id, v(req)), 'Intervention closed — outcome recorded'));

r.post('/early-warning/run-check', EW_MANAGE, validate(ewRunCheckSchema), async (req: Request, res: Response) => {
  const out = await ew.runCheck(req, v(req).campusId);
  return ok(res, out, `Signal check complete — ${out.created.length} new signal${out.created.length === 1 ? '' : 's'} raised`);
});

// =============================================================================
// Talent Discovery
// =============================================================================
r.get('/talent/overview', TALENT, validate(campusQuery, 'query'), async (req: Request, res: Response) =>
  ok(res, await people.talentOverview(req.user!, v(req, 'query').campusId), 'Talent overview'));

r.get('/talent/students/:id', TALENT, validate(studentParam, 'params'), async (req: Request, res: Response) =>
  ok(res, await people.talentStudent(req, v(req, 'params').id), 'Student strengths'));

r.post('/talent/suggestions/:id/decision', STAFF, validate(idParam, 'params'), validate(talentDecisionSchema), async (req: Request, res: Response) => {
  const out = await people.talentDecision(req, v(req, 'params').id, v(req));
  return ok(res, out, out.decision === 'accepted' ? 'Opportunity recorded on the growth timeline' : 'Suggestion dismissed — reason recorded');
});

// =============================================================================
// Behaviour & Wellbeing
// =============================================================================
r.get('/wellbeing/overview', STAFF, validate(campusQuery, 'query'), async (req: Request, res: Response) =>
  ok(res, await people.wellbeingOverview(req.user!, v(req, 'query').campusId), 'Wellbeing overview'));

r.get('/wellbeing/behaviour', STAFF, validate(wellbeingListQuery, 'query'), async (req: Request, res: Response) => {
  const f = v(req, 'query');
  const { rows, total } = await people.listBehaviour(req.user!, f);
  return paged(res, rows, total, f.page, f.pageSize, 'Behaviour notes retrieved');
});

r.get('/wellbeing/checkins', STAFF, validate(wellbeingListQuery, 'query'), async (req: Request, res: Response) => {
  const f = v(req, 'query');
  const { rows, total } = await people.listCheckins(req, f);
  return paged(res, rows, total, f.page, f.pageSize, 'Wellbeing check-ins retrieved');
});

r.post('/wellbeing/behaviour', STAFF, validate(behaviourCreateSchema), async (req: Request, res: Response) =>
  created(res, await people.createBehaviour(req, v(req)), 'Behaviour note added'));

r.post('/wellbeing/checkins', STAFF, validate(checkinCreateSchema), async (req: Request, res: Response) =>
  created(res, await people.createCheckin(req, v(req)), 'Wellbeing check-in recorded'));

// =============================================================================
// Portfolio
// =============================================================================
r.get('/portfolio/overview', STAFF, validate(campusQuery, 'query'), async (req: Request, res: Response) =>
  ok(res, await people.portfolioOverview(req.user!, v(req, 'query').campusId), 'Portfolio overview'));

r.get('/portfolio/students/:id', STAFF, validate(studentParam, 'params'), async (req: Request, res: Response) =>
  ok(res, await people.portfolioStudent(req, v(req, 'params').id), 'Student portfolio'));

// =============================================================================
// AI Teacher Co-Pilot
// =============================================================================
r.get('/copilot/provider', AI, (_req: Request, res: Response) => ok(res, providerInfo(), 'Provider'));

r.get('/copilot/context', AI, validate(copilotContextQuery, 'query'), async (req: Request, res: Response) =>
  ok(res, await copilot.context(req.user!, v(req, 'query')), 'Co-Pilot context'));

r.get('/copilot/drafts', AI, validate(draftListQuery, 'query'), async (req: Request, res: Response) => {
  const f = v(req, 'query');
  const { rows, total } = await copilot.listDrafts(req.user!, f);
  return paged(res, rows, total, f.page, f.pageSize, 'Drafts retrieved');
});

r.post('/copilot/drafts', AI, validate(draftCreateSchema), async (req: Request, res: Response) =>
  created(res, await copilot.createDraft(req, v(req)), 'Draft generated — review before publishing'));

r.get('/copilot/drafts/:id', AI, validate(idParam, 'params'), async (req: Request, res: Response) =>
  ok(res, await copilot.getDraft(req.user!, v(req, 'params').id), 'Draft retrieved'));

r.put('/copilot/drafts/:id', AI, validate(idParam, 'params'), validate(draftUpdateSchema), async (req: Request, res: Response) =>
  ok(res, await copilot.updateDraft(req, v(req, 'params').id, v(req).output), 'Draft saved'));

r.post('/copilot/drafts/:id/approve', AI, validate(idParam, 'params'), async (req: Request, res: Response) => {
  const out = await copilot.approveDraft(req, v(req, 'params').id);
  return ok(res, out, `Approved by ${req.user!.fullName}${out.lessonPlanId ? ' — lesson plan published' : ''}`);
});

r.post('/copilot/drafts/:id/discard', AI, validate(idParam, 'params'), validate(draftDiscardSchema), async (req: Request, res: Response) =>
  ok(res, await copilot.discardDraft(req, v(req, 'params').id, v(req).reason), 'Draft discarded'));

// =============================================================================
// School Knowledge AI
// =============================================================================
r.post('/knowledge/ask', AI, validate(knowledgeAskSchema), validate(campusQuery, 'query'), async (req: Request, res: Response) =>
  ok(res, await knowledge.ask(req, v(req).question, v(req, 'query').campusId), 'Answer'));

r.get('/knowledge/sources', AI, async (req: Request, res: Response) => ok(res, await knowledge.sources(req.user!), 'Knowledge sources'));

r.get('/knowledge/top-questions', AI, async (_req: Request, res: Response) => ok(res, await knowledge.topQuestions(), 'Most asked this month'));

r.post('/knowledge/feedback', AI, validate(knowledgeFeedbackSchema), async (req: Request, res: Response) => {
  const out = await knowledge.feedback(req, v(req));
  return ok(res, out, out.routed ? 'Question routed to the front office' : 'Feedback recorded');
});

// =============================================================================
// Analytics & reports
// =============================================================================
r.get('/analytics/overview', REPORTS, validate(analyticsQuery, 'query'), async (req: Request, res: Response) => {
  const { area, campusId } = v(req, 'query');
  return ok(res, await analytics.analytics(req.user!, area, campusId), 'Analytics');
});

r.get('/analytics/export', REPORTS, validate(analyticsQuery, 'query'), async (req: Request, res: Response) => {
  const { area, campusId } = v(req, 'query');
  const out = await analytics.analytics(req.user!, area, campusId);
  // Flatten every dataset in the area into dataset / label / measure / value rows.
  const rows: Record<string, unknown>[] = [];
  for (const [dataset, value] of Object.entries(out.data as Record<string, unknown>)) {
    const list = Array.isArray(value) ? value : value && typeof value === 'object' ? [value] : [{ value }];
    for (const item of list as Record<string, unknown>[]) {
      const label = item.label ?? '';
      for (const [k, x] of Object.entries(item)) if (k !== 'label' && (typeof x === 'number' || typeof x === 'string' || x === null)) rows.push({ dataset, label, measure: k, value: x });
    }
  }
  await audit(req, { action: 'export', module: 'reports', description: `Exported ${area} analytics (${rows.length} rows)`, metadata: { area, campusId } });
  return sendCsv(res, `analytics-${area}-${schoolToday()}.csv`,
    toCsv([{ key: 'dataset', label: 'Dataset' }, { key: 'label', label: 'Label' }, { key: 'measure', label: 'Measure' }, { key: 'value', label: 'Value' }], rows));
});

r.get('/reports/catalog', REPORTS, (req: Request, res: Response) => ok(res, analytics.reportCatalog(req.user!), 'Report catalogue'));

r.get('/reports/:key/preview', REPORTS, validate(reportKeyParam, 'params'), validate(reportPreviewQuery, 'query'), async (req: Request, res: Response) => {
  const { key } = v(req, 'params');
  const { page, pageSize, ...rest } = v(req, 'query');
  const out = await reportcentre.previewReport(req.user!, key, { page, pageSize, ...rest });
  return ok(res, out, out.title, { page, pageSize, total: out.matchedRows, totalPages: Math.max(1, Math.ceil(out.matchedRows / pageSize)) });
});

r.get('/reports/:key/export', REPORTS, validate(reportKeyParam, 'params'), validate(reportExportQuery, 'query'), async (req: Request, res: Response) => {
  const { key } = v(req, 'params');
  const params = v(req, 'query');
  const out = await analytics.buildReport(req.user!, key, params);
  await audit(req, { action: 'export', module: 'reports', entityType: 'report', entityId: key, description: `Exported report "${out.title}" (${out.rows.length} rows)`, metadata: params });
  return sendCsv(res, out.filename, toCsv(out.columns, out.rows));
});

export default r;
