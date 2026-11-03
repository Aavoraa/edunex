import request from 'supertest';
import { createApp } from '../src/app.js';

export const app = createApp();
export const PASSWORD = process.env.SEED_DEMO_PASSWORD ?? '';

export const ACCOUNTS = {
  principal: 'meera.krishnan.demo@edunex.edu',
  teacher: 'priya.raghavan.demo@edunex.edu',
  parent: 'ranjith.kumar.demo@parents.edunex.edu',
  parent2: 'sudha.raman.demo@parents.edunex.edu',
  office: 'kavitha.s.demo@edunex.edu',
  staff: 'murugan.p.demo@edunex.edu',
  hr: 'lakshmi.n.demo@edunex.edu',
  finance: 'rajesh.iyer.demo@edunex.edu',
  superadmin: 'admin.demo@edunex.edu',
  student: 'aditya.kumar.demo@students.edunex.edu',
} as const;

export type Who = keyof typeof ACCOUNTS;

const cache = new Map<Who, { token: string; user: any; refreshToken: string }>();

export async function login(who: Who) {
  const hit = cache.get(who);
  if (hit) return hit;
  const r = await request(app).post('/api/auth/login').send({ identifier: ACCOUNTS[who], password: PASSWORD, clientType: 'mobile' });
  if (r.status !== 200) throw new Error(`login ${who} failed: ${r.status} ${JSON.stringify(r.body)}`);
  const v = { token: r.body.data.accessToken, user: r.body.data.user, refreshToken: r.body.data.refreshToken };
  cache.set(who, v);
  return v;
}

export async function as(who: Who) {
  const { token } = await login(who);
  const auth = (req: request.Test) => req.set('Authorization', `Bearer ${token}`).set('X-Client-Type', 'mobile');
  return {
    get: (p: string) => auth(request(app).get(p)),
    post: (p: string, body?: object) => auth(request(app).post(p)).send(body ?? {}),
    put: (p: string, body?: object) => auth(request(app).put(p)).send(body ?? {}),
    patch: (p: string, body?: object) => auth(request(app).patch(p)).send(body ?? {}),
    delete: (p: string) => auth(request(app).delete(p)),
  };
}
