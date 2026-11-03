import { Router, type Request, type Response } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { requireAny, requirePermission } from '../middleware/auth.js';
import { validate, v } from '../middleware/validate.js';
import { env } from '../config/env.js';
import {
  assignmentIdParam, assignmentListQuery, assignSchema, deviceCreateSchema, deviceIdParam, deviceListQuery, deviceLocationSchema, deviceLookupQuery,
  deviceUpdateSchema, unassignSchema,
} from '../validators/devices.validators.js';
import * as devices from '../services/devices.service.js';
import { audit } from '../services/audit.service.js';
import { created, ok, paged } from '../utils/response.js';

// ---------------------------------------------------------------------------
// POST /api/v1/location — the one endpoint every GPS device posts to.
// Authenticated with the device token, not a user session.
// ---------------------------------------------------------------------------
const deviceLimiter = rateLimit({
  windowMs: 60_000,
  limit: env.DEVICE_RATE_LIMIT_PER_MINUTE,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  // Per device (falling back to IP), so one misbehaving tracker cannot starve the rest.
  keyGenerator: (req) => (typeof req.body?.device_id === 'string' ? `dev:${req.body.device_id.slice(0, 60).toUpperCase()}` : `ip:${ipKeyGenerator(req.ip ?? '')}`),
  handler: (_req, res) => res.status(429).json({ success: false, message: 'Too many location updates. Slow down.', error: 'RATE_LIMITED' }),
  skip: () => env.isTest,
});

export const deviceIngestRoutes = Router();

deviceIngestRoutes.post('/location', deviceLimiter, validate(deviceLocationSchema), async (req: Request, res: Response) => {
  const r = await devices.ingestLocation(req, v(req));
  return res.status(201).json({ success: true, ...r, message: 'Location received' });
});

// The tracker app's own dashboard: assigned student, today's points and distance.
deviceIngestRoutes.get('/device/status', deviceLimiter, async (req: Request, res: Response) => {
  return ok(res, await devices.deviceSelfStatus(req), 'Device status');
});

// ---------------------------------------------------------------------------
// Admin: device registry (/api/devices) and assignments (/api/device-assignments)
// ---------------------------------------------------------------------------
const VIEW = requireAny('tracking.read_all', 'tracking.manage');
const MANAGE = requirePermission('tracking.manage');

export const deviceRoutes = Router();

deviceRoutes.get('/summary', VIEW, async (req: Request, res: Response) => {
  return ok(res, await devices.deviceSummary(req.query.campusId as string | undefined), 'Device summary');
});

deviceRoutes.get('/lookup', VIEW, validate(deviceLookupQuery, 'query'), async (req: Request, res: Response) => {
  return ok(res, await devices.lookupDevice(v(req, 'query').code), 'Device found');
});

deviceRoutes.get('/', VIEW, validate(deviceListQuery, 'query'), async (req: Request, res: Response) => {
  const f = v(req, 'query');
  const { rows, total } = await devices.listDevices(f);
  return paged(res, rows, total, f.page, f.pageSize, 'Devices retrieved successfully');
});

deviceRoutes.post('/', MANAGE, validate(deviceCreateSchema), async (req: Request, res: Response) => {
  const r = await devices.registerDevice(req, v(req));
  return created(res, r, 'Device registered. Copy the token now — it is shown only once.');
});

deviceRoutes.get('/:id', VIEW, validate(deviceIdParam, 'params'), async (req: Request, res: Response) => {
  return ok(res, await devices.getDevice(v(req, 'params').id), 'Device retrieved');
});

deviceRoutes.put('/:id', MANAGE, validate(deviceIdParam, 'params'), validate(deviceUpdateSchema), async (req: Request, res: Response) => {
  return ok(res, await devices.updateDevice(req, v(req, 'params').id, v(req)), 'Device updated');
});

deviceRoutes.post('/:id/token', MANAGE, validate(deviceIdParam, 'params'), async (req: Request, res: Response) => {
  return ok(res, await devices.regenerateToken(req, v(req, 'params').id), 'New token issued. The previous token no longer works.');
});

deviceRoutes.get('/:id/location/latest', requirePermission('tracking.read_all'), validate(deviceIdParam, 'params'), async (req: Request, res: Response) => {
  const d = await devices.getDevice(v(req, 'params').id);
  const data = await devices.latestForDevice(d.id);
  await audit(req, { action: 'view', module: 'tracking', description: `Viewed latest location of device ${d.deviceCode}`, entityType: 'gps_device', entityId: d.id });
  return ok(res, data, 'Latest device location');
});

export const assignmentRoutes = Router();

assignmentRoutes.get('/', VIEW, validate(assignmentListQuery, 'query'), async (req: Request, res: Response) => {
  const f = v(req, 'query');
  const { rows, total } = await devices.listAssignments(f);
  return paged(res, rows, total, f.page, f.pageSize, 'Assignments retrieved successfully');
});

assignmentRoutes.post('/', MANAGE, validate(assignSchema), async (req: Request, res: Response) => {
  const a = await devices.assignDevice(req, v(req));
  return created(res, a, `${a.deviceCode} assigned to ${a.studentName}`);
});

assignmentRoutes.post('/:id/unassign', MANAGE, validate(assignmentIdParam, 'params'), validate(unassignSchema), async (req: Request, res: Response) => {
  const a = await devices.unassignDevice(req, v(req, 'params').id, v(req).reason);
  return ok(res, a, `${a.deviceCode} unassigned from ${a.studentName}`);
});
