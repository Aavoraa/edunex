import { Router, type Request, type Response } from 'express';
import { requireAny, requirePermission } from '../middleware/auth.js';
import { validate, v } from '../middleware/validate.js';
import { trackingListQuery, trackingProfileSchema } from '../validators/tracking.validators.js';
import { idParam } from '../validators/students.validators.js';
import * as tracking from '../services/tracking.service.js';
import { resolveStudentId } from '../services/access.service.js';
import { audit } from '../services/audit.service.js';
import { ok, paged } from '../utils/response.js';

/** CRM / admin student tracking. Parents use /parents/:id/children/... instead. */
const r = Router();
const STAFF_TRACK = requireAny('tracking.read_all', 'tracking.read_assigned');

r.get('/students', STAFF_TRACK, validate(trackingListQuery, 'query'), async (req: Request, res: Response) => {
  const f = v(req, 'query');
  const { rows, total } = await tracking.listTrackedStudents(req.user!, f);
  await audit(req, { action: 'view', module: 'tracking', description: 'Viewed student tracking list', metadata: { filters: f } });
  return paged(res, rows, total, f.page, f.pageSize, 'Tracked students retrieved successfully');
});

r.get('/map', STAFF_TRACK, validate(trackingListQuery.partial(), 'query'), async (req: Request, res: Response) => {
  const data = await tracking.mapData(req.user!, v(req, 'query'));
  await audit(req, { action: 'view', module: 'tracking', description: `Viewed tracking map (${data.markers.length} students)` });
  return ok(res, data, 'Tracking map retrieved successfully');
});

r.get('/summary', STAFF_TRACK, async (req: Request, res: Response) => {
  return ok(res, await tracking.trackingSummary(req.user!, req.query.campusId as string | undefined), 'Tracking summary');
});

r.patch('/students/:id/profile', requirePermission('tracking.manage'), validate(idParam, 'params'), validate(trackingProfileSchema),
  async (req: Request, res: Response) => {
    const id = await resolveStudentId(v(req, 'params').id);
    return ok(res, await tracking.updateTrackingProfile(req, id, v(req)), 'Tracking settings updated');
  });

export default r;
