/**
 * Running on Vercel: the function entry point and the cron endpoint that replaces server.ts's
 * notification timer.
 */
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from './helpers.js';

const CRON = '/api/internal/cron/notifications';

describe('Vercel', () => {
  it('exports the Express app as the function entry', async () => {
    const entry = (await import('../src/vercel.js')).default;
    expect(typeof entry).toBe('function');
    const r = await request(entry).get('/api/health');
    expect(r.status).toBe(200);
  });

  it('runs the notification dispatcher only for Vercel Cron', async () => {
    expect((await request(app).get(CRON)).status).toBe(401);
    expect((await request(app).get(CRON).set('Authorization', 'Bearer wrong-secret-0123456789')).status).toBe(401);
    const r = await request(app).get(CRON).set('Authorization', `Bearer ${process.env.CRON_SECRET}`);
    expect(r.status).toBe(200);
    expect(typeof r.body.data.sent).toBe('number');
  });
});
