import { z } from 'zod';
import { paginationSchema } from '../utils/pagination.js';

const LOCATION_STATUS = ['at_home', 'in_transit', 'at_school', 'on_trip', 'unknown'] as const;

export const locationInputSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(10_000).optional(),
  altitude: z.number().min(-500).max(20_000).optional(),
  speed: z.number().min(0).max(500).optional(),
  heading: z.number().min(0).lt(360).optional(),
  locationStatus: z.enum(LOCATION_STATUS).optional(),
  placeLabel: z.string().max(120).optional(),
  source: z.enum(['device', 'bus', 'gate', 'manual', 'sample']).optional(),
  batteryPct: z.number().int().min(0).max(100).optional(),
  recordedAt: z.iso.datetime({ offset: true }).optional(),
});

export const historyQuerySchema = z.object({
  date: z.iso.date().optional(),
  from: z.union([z.iso.datetime({ offset: true }), z.string().regex(/^\d{2}:\d{2}$/)]).optional(),
  to: z.union([z.iso.datetime({ offset: true }), z.string().regex(/^\d{2}:\d{2}$/)]).optional(),
  limit: z.coerce.number().int().min(1).max(2000).optional(),
});

export const trackingListQuery = paginationSchema.extend({
  campusId: z.uuid().optional(),
  classId: z.uuid().optional(),
  sectionId: z.uuid().optional(),
  status: z.enum(['active', 'paused', 'offline', 'disabled']).optional(),
  locationStatus: z.enum(LOCATION_STATUS).optional(),
});

export const trackingProfileSchema = z.object({
  trackingEnabled: z.boolean().optional(),
  trackingStatus: z.enum(['active', 'paused', 'offline', 'disabled']).optional(),
}).refine((o) => Object.keys(o).length > 0, { message: 'Nothing to update' });
