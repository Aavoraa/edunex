import { z } from 'zod';

/**
 * Validated runtime configuration. The process refuses to start with a
 * missing or weak secret rather than falling back to an insecure default.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(7),
  JWT_ISSUER: z.string().default('edunex-api'),
  JWT_AUDIENCE: z.string().default('edunex-clients'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  COOKIE_SECURE: z.stringbool().default(false),
  COOKIE_DOMAIN: z.string().optional(),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(3000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  /** Uploaded documents are stored under this folder. */
  UPLOAD_DIR: z.string().default('./uploads'),
  UPLOAD_MAX_MB: z.coerce.number().positive().default(10),
  /** GPS devices: how often a device should send, and when it counts as online / stale / offline. */
  LOCATION_INTERVAL_SECONDS: z.coerce.number().int().min(5).max(3600).default(30),
  ONLINE_THRESHOLD_SECONDS: z.coerce.number().int().positive().default(120),
  OFFLINE_THRESHOLD_SECONDS: z.coerce.number().int().positive().default(600),
  /** Clock drift allowed on a device timestamp, and how old a buffered point may be. */
  LOCATION_MAX_FUTURE_SECONDS: z.coerce.number().int().nonnegative().default(300),
  LOCATION_MAX_AGE_HOURS: z.coerce.number().int().positive().default(72),
  /** Per-device request limit on POST /api/v1/location. */
  DEVICE_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(30),
  MAP_API_KEY: z.string().optional(),
  MAP_TILE_URL: z.string().default('https://tile.openstreetmap.org/{z}/{x}/{y}.png'),
  SEED_DEMO_PASSWORD: z.string().optional(),
  /**
   * WhatsApp sending (services/whatsapp.provider.ts). 'gateway' posts {to, message, …} JSON with a
   * Bearer token to WHATSAPP_API_URL — the shape most Indian WhatsApp gateways (e.g. NeverSkip) accept;
   * 'meta' is the WhatsApp Cloud API (URL = https://graph.facebook.com/v21.0/<phone-number-id>/messages).
   */
  WHATSAPP_PROVIDER: z.enum(['gateway', 'meta']).default('gateway'),
  WHATSAPP_API_URL: z.string().optional(),
  WHATSAPP_API_TOKEN: z.string().optional(),
  /** Meta: approved template (two body parameters: title, details). Unset = plain text (only inside a 24-hour chat window). */
  WHATSAPP_TEMPLATE_NAME: z.string().optional(),
  WHATSAPP_TEMPLATE_LANG: z.string().default('en'),
  /** Added to 10-digit local numbers. */
  WHATSAPP_DEFAULT_COUNTRY_CODE: z.string().regex(/^\d{1,3}$/).default('91'),
  SMS_API_URL: z.string().optional(),
  SMS_API_KEY: z.string().optional(),
  SMTP_URL: z.string().optional(),
  PUSH_FCM_SERVER_KEY: z.string().optional(),
  /**
   * Paper Correction (EXAM Vision): the internal URL of the AI answer-sheet marking service
   * (exam-vision/, e.g. http://127.0.0.1:8006) and the secret both sides use to sign requests
   * (EXAM_GATEWAY_SECRET there). Unset = the module shows as "not connected".
   */
  EXAM_VISION_URL: z.preprocess((v) => (v === '' ? undefined : v), z.url().optional()),
  EXAM_VISION_SECRET: z.string().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
}).superRefine((c, ctx) => {
  if (c.OFFLINE_THRESHOLD_SECONDS <= c.ONLINE_THRESHOLD_SECONDS) {
    ctx.addIssue({ code: 'custom', path: ['OFFLINE_THRESHOLD_SECONDS'], message: 'must be greater than ONLINE_THRESHOLD_SECONDS' });
  }
  if (c.EXAM_VISION_URL && (c.EXAM_VISION_SECRET ?? '').length < 32) {
    ctx.addIssue({ code: 'custom', path: ['EXAM_VISION_SECRET'], message: 'must be at least 32 characters when EXAM_VISION_URL is set' });
  }
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  // eslint-disable-next-line no-console
  console.error(`Invalid environment configuration:\n${issues}\nSee .env.example.`);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  corsOrigins: parsed.data.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
  isProd: parsed.data.NODE_ENV === 'production',
  isTest: parsed.data.NODE_ENV === 'test',
};
export type Env = typeof env;
