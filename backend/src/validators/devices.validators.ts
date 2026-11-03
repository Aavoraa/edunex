import { z } from 'zod';
import { paginationSchema } from '../utils/pagination.js';

export const DEVICE_TYPES = ['gps_tracker', 'id_card_tag', 'wearable', 'mobile_app'] as const;
export const DEVICE_STATUSES = ['available', 'assigned', 'inactive', 'maintenance', 'lost'] as const;

/** Printed on the QR label: capitals, digits and hyphens, e.g. GPS000123. */
const deviceCode = z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9-]{2,49}$/, 'Use 3–50 capital letters, digits or hyphens');
const optText = (max: number) => z.string().trim().max(max).optional().transform((s) => (s ? s : undefined));

export const deviceCreateSchema = z.object({
  deviceCode: deviceCode.optional(),               // generated (GPS000001…) when omitted
  imei: z.string().trim().regex(/^\d{14,17}$/, 'IMEI is 14–17 digits').optional().or(z.literal('').transform(() => undefined)),
  serialNumber: optText(100),
  deviceType: z.enum(DEVICE_TYPES).default('gps_tracker'),
  firmwareVersion: optText(50),
  campusId: z.uuid().optional(),
  notes: optText(500),
});

export const deviceUpdateSchema = z.object({
  imei: z.string().trim().regex(/^\d{14,17}$/, 'IMEI is 14–17 digits').nullable().optional().or(z.literal('').transform(() => null)),
  serialNumber: z.string().trim().max(100).nullable().optional(),
  deviceType: z.enum(DEVICE_TYPES).optional(),
  firmwareVersion: z.string().trim().max(50).nullable().optional(),
  campusId: z.uuid().nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  // 'assigned' is set only by an assignment
  status: z.enum(['available', 'inactive', 'maintenance', 'lost']).optional(),
  reason: z.string().trim().max(300).optional(),
}).refine((o) => Object.keys(o).some((k) => k !== 'reason'), { message: 'Nothing to update' });

export const deviceListQuery = paginationSchema.extend({
  status: z.enum(DEVICE_STATUSES).optional(),
  deviceType: z.enum(DEVICE_TYPES).optional(),
  gpsStatus: z.enum(['online', 'stale', 'offline', 'never']).optional(),
  campusId: z.uuid().optional(),
});

export const deviceLookupQuery = z.object({
  // What a QR label or a typed box contains: device code, IMEI or serial number.
  code: z.string().trim().min(3).max(200),
});

export const deviceIdParam = z.object({ id: z.string().trim().min(3).max(64) });
export const assignmentIdParam = z.object({ id: z.uuid() });

export const assignSchema = z.object({
  studentId: z.string().trim().min(3).max(64),      // uuid or admission number
  deviceId: z.string().trim().min(3).max(64),       // uuid or device code
  notes: optText(500),
  // Confirms moving a device that is with another student, or replacing the student's current device.
  reassign: z.boolean().default(false),
});

export const unassignSchema = z.object({
  reason: optText(300),
});

export const assignmentListQuery = paginationSchema.extend({
  status: z.enum(['active', 'inactive']).optional(),
  studentId: z.string().trim().max(64).optional(),
  deviceId: z.string().trim().max(64).optional(),
});

/**
 * Body of POST /api/v1/location, in the field names device firmware uses.
 * There is deliberately no student field: the student comes from the device's
 * active assignment. Unknown fields (student_id, satellites, hdop…) are dropped,
 * so firmware that sends extra telemetry keeps working.
 */
export const deviceLocationSchema = z.object({
  device_id: deviceCode,
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(10_000).optional(),
  altitude: z.number().min(-500).max(20_000).optional(),
  speed: z.number().min(0).max(500).optional(),
  heading: z.number().min(0).max(360).transform((h) => (h === 360 ? 0 : h)).optional(),
  battery_level: z.number().min(0).max(100).optional(),
  recorded_at: z.iso.datetime({ offset: true }).optional(),
});
