/**
 * School CRM beyond admissions — alumni, vendors, partners and the shared
 * communication history.
 */
import type { Request } from 'express';
import { many, one, query } from '../config/db.js';
import { Where } from '../utils/sql.js';
import { likeTerm, limitOffset, orderBy, type Pagination } from '../utils/pagination.js';
import { badRequest, notFound } from '../utils/errors.js';
import { audit } from './audit.service.js';

function updateSet(input: Record<string, unknown>, cols: Record<string, string>) {
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [k, val] of Object.entries(input)) {
    if (!cols[k] || val === undefined) continue;
    params.push(val);
    sets.push(`${cols[k]} = $${params.length}`);
  }
  if (!sets.length) throw badRequest('Nothing to update');
  return { sets, params };
}

// ---------------------------------------------------------------------------
// Alumni
// ---------------------------------------------------------------------------
const ALUMNI_COLS: Record<string, string> = {
  fullName: 'full_name', batchYear: 'batch_year', university: 'university', career: 'career', email: 'email',
  phone: 'phone', engagement: 'engagement', lastEngagement: 'last_engagement',
};

export async function listAlumni(f: Pagination & { engagement?: string; batch?: number }) {
  const w = new Where();
  w.addIf(f.engagement, 'a.engagement = ?');
  w.addIf(f.batch, 'a.batch_year = ?');
  if (f.q) w.add('(a.full_name ILIKE ? OR a.university ILIKE ? OR a.career ILIKE ?)', likeTerm(f.q), likeTerm(f.q), likeTerm(f.q));
  const { limit, offset } = limitOffset(f);
  const rows = await many(
    `SELECT a.id, a.full_name AS "fullName", a.batch_year AS "batchYear", a.university, a.career, a.email, a.phone,
            a.engagement, a.last_engagement AS "lastEngagement", a.updated_at AS "updatedAt", count(*) OVER() AS total
       FROM alumni a ${w.sql}
      ORDER BY ${orderBy(f.sort, f.dir, {
        name: 'a.full_name', fullName: 'a.full_name', batch: 'a.batch_year', batchYear: 'a.batch_year', university: 'a.university',
        engagement: `array_position(ARRAY['High','Medium','Low'], a.engagement)`, updatedAt: 'a.updated_at',
      }, 'engagement')}, a.full_name
      LIMIT ${w.param(limit)} OFFSET ${w.param(offset)}`,
    w.params);
  return { rows: rows.map(({ total: _t, ...r }) => r), total: rows[0]?.total ?? 0 };
}

export async function alumniSummary() {
  const k = await one(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE engagement IN ('High', 'Medium'))::int AS engaged,
            count(*) FILTER (WHERE last_engagement ILIKE '%mentor%')::int AS mentoring,
            max(batch_year) AS "latestBatch"
       FROM alumni`);
  const referrals = await one<{ n: number }>(
    `SELECT count(*)::int AS n FROM enquiries
      WHERE deleted_at IS NULL AND campaign ILIKE '%alumni%'
        AND (academic_year_id = (SELECT id FROM academic_years WHERE is_current) OR academic_year_id IS NULL)`);
  const destinations = await many(
    `SELECT COALESCE(university, 'Not recorded') AS label, count(*)::int AS value
       FROM alumni WHERE batch_year > (SELECT max(batch_year) - 5 FROM alumni)
      GROUP BY 1 ORDER BY value DESC, label LIMIT 8`);
  const byBatch = await many(`SELECT batch_year AS label, count(*)::int AS value FROM alumni GROUP BY batch_year ORDER BY batch_year`);
  const total = k?.total ?? 0;
  return {
    total, engaged: k?.engaged ?? 0, engagedPct: total ? Math.round((k!.engaged / total) * 100) : 0,
    mentoring: k?.mentoring ?? 0, referrals: referrals?.n ?? 0, latestBatch: k?.latestBatch ?? null,
    destinations, byBatch,
  };
}

export async function createAlumnus(req: Request, input: any) {
  const r = await one<{ id: string }>(
    `INSERT INTO alumni (full_name, batch_year, university, career, email, phone, engagement, last_engagement)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [input.fullName, input.batchYear, input.university ?? null, input.career ?? null, input.email ?? null, input.phone ?? null, input.engagement, input.lastEngagement ?? null]);
  await audit(req, { action: 'create', module: 'crm', description: `Added alumnus ${input.fullName} (batch ${input.batchYear})`, entityType: 'alumni', entityId: r!.id });
  return r;
}

export async function updateAlumnus(req: Request, id: string, input: Record<string, unknown>) {
  const { sets, params } = updateSet(input, ALUMNI_COLS);
  params.push(id);
  const r = await one(`UPDATE alumni SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING full_name`, params);
  if (!r) throw notFound('Alumnus not found', 'ALUMNI_NOT_FOUND');
  await audit(req, { action: 'update', module: 'crm', description: `Updated alumnus ${r.full_name}`, entityType: 'alumni', entityId: id });
}

// ---------------------------------------------------------------------------
// Vendors & partners
// ---------------------------------------------------------------------------
const VENDOR_COLS: Record<string, string> = {
  name: 'name', category: 'category', contactPerson: 'contact_person', phone: 'phone', email: 'email',
  contractStart: 'contract_start', contractEnd: 'contract_end', contractValue: 'contract_value', status: 'status',
};

export async function listVendors(f: Pagination & { status?: string; category?: string }) {
  const w = new Where();
  w.addIf(f.status, 'v.status = ?');
  w.addIf(f.category, 'v.category = ?');
  if (f.q) w.add('(v.name ILIKE ? OR v.category ILIKE ? OR v.contact_person ILIKE ?)', likeTerm(f.q), likeTerm(f.q), likeTerm(f.q));
  const { limit, offset } = limitOffset(f);
  const rows = await many(
    `SELECT v.id, v.name, v.category, v.contact_person AS "contactPerson", v.phone, v.email,
            v.contract_start AS "contractStart", v.contract_end AS "contractEnd", v.contract_value AS "contractValue", v.status,
            (v.contract_end - current_date) AS "daysToExpiry",
            (v.contract_end IS NOT NULL AND v.contract_end <= current_date + 90 AND v.status IN ('Active', 'Renewal due')) AS "renewalSoon",
            count(*) OVER() AS total
       FROM vendors v ${w.sql}
      ORDER BY ${orderBy(f.sort, f.dir, { name: 'v.name', category: 'v.category', contractEnd: 'v.contract_end', contractValue: 'v.contract_value', value: 'v.contract_value', status: 'v.status' }, 'name')}
      LIMIT ${w.param(limit)} OFFSET ${w.param(offset)}`,
    w.params);
  return { rows: rows.map(({ total: _t, ...r }) => r), total: rows[0]?.total ?? 0 };
}

export async function vendorSummary() {
  return one(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE status = 'Active')::int AS active,
            count(*) FILTER (WHERE status = 'Renewal due' OR (contract_end <= current_date + 90 AND status = 'Active'))::int AS "renewalDue",
            COALESCE(sum(contract_value) FILTER (WHERE status IN ('Active', 'Renewal due')), 0)::numeric AS "contractValue",
            (SELECT count(*)::int FROM partners WHERE status = 'Active') AS partners
       FROM vendors`);
}

export async function createVendor(req: Request, input: any) {
  const r = await one<{ id: string }>(
    `INSERT INTO vendors (name, category, contact_person, phone, email, contract_start, contract_end, contract_value, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [input.name, input.category, input.contactPerson ?? null, input.phone ?? null, input.email ?? null, input.contractStart ?? null,
      input.contractEnd ?? null, input.contractValue, input.status]);
  await audit(req, { action: 'create', module: 'crm', description: `Added vendor ${input.name}`, entityType: 'vendor', entityId: r!.id });
  return r;
}

export async function updateVendor(req: Request, id: string, input: Record<string, unknown>) {
  const cur = await one('SELECT name, contract_start, contract_end FROM vendors WHERE id = $1', [id]);
  if (!cur) throw notFound('Vendor not found', 'VENDOR_NOT_FOUND');
  const start = (input.contractStart as string | undefined) ?? cur.contract_start;
  const end = (input.contractEnd as string | undefined) ?? cur.contract_end;
  if (start && end && end < start) throw badRequest('Contract end must be after the start', 'VALIDATION_ERROR', [{ field: 'contractEnd', message: 'Contract end must be after the start' }]);
  const { sets, params } = updateSet(input, VENDOR_COLS);
  params.push(id);
  await query(`UPDATE vendors SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
  await audit(req, { action: 'update', module: 'crm', description: `Updated vendor ${cur.name} (${Object.keys(input).join(', ')})`, entityType: 'vendor', entityId: id });
}

const PARTNER_COLS: Record<string, string> = { name: 'name', partnerType: 'partner_type', sinceYear: 'since_year', status: 'status', note: 'note' };

export async function listPartners(f: Pagination & { status?: string }) {
  const w = new Where();
  w.addIf(f.status, 'p.status = ?');
  if (f.q) w.add('(p.name ILIKE ? OR p.partner_type ILIKE ? OR p.note ILIKE ?)', likeTerm(f.q), likeTerm(f.q), likeTerm(f.q));
  const { limit, offset } = limitOffset(f);
  const rows = await many(
    `SELECT p.id, p.name, p.partner_type AS "partnerType", p.since_year AS "sinceYear", p.status, p.note, count(*) OVER() AS total
       FROM partners p ${w.sql}
      ORDER BY ${orderBy(f.sort, f.dir, { name: 'p.name', since: 'p.since_year', sinceYear: 'p.since_year', partnerType: 'p.partner_type' }, 'sinceYear')}, p.name
      LIMIT ${w.param(limit)} OFFSET ${w.param(offset)}`,
    w.params);
  return { rows: rows.map(({ total: _t, ...r }) => r), total: rows[0]?.total ?? 0 };
}

export async function createPartner(req: Request, input: any) {
  const r = await one<{ id: string }>(
    `INSERT INTO partners (name, partner_type, since_year, status, note) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [input.name, input.partnerType, input.sinceYear ?? null, input.status, input.note ?? null]);
  await audit(req, { action: 'create', module: 'crm', description: `Added partner ${input.name}`, entityType: 'partner', entityId: r!.id });
  return r;
}

export async function updatePartner(req: Request, id: string, input: Record<string, unknown>) {
  const { sets, params } = updateSet(input, PARTNER_COLS);
  params.push(id);
  const r = await one(`UPDATE partners SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING name`, params);
  if (!r) throw notFound('Partner not found', 'PARTNER_NOT_FOUND');
  await audit(req, { action: 'update', module: 'crm', description: `Updated partner ${r.name}`, entityType: 'partner', entityId: id });
}

// ---------------------------------------------------------------------------
// Communication history (all counterparts)
// ---------------------------------------------------------------------------
export async function listCommunications(f: Pagination & { channel?: string }) {
  const w = new Where();
  w.addIf(f.channel, 'c.channel = ?');
  if (f.q) w.add('(c.counterpart ILIKE ? OR c.subject ILIKE ?)', likeTerm(f.q), likeTerm(f.q));
  const { limit, offset } = limitOffset(f);
  const rows = await many(
    `SELECT c.id, c.channel, c.direction, c.counterpart AS who, c.subject, c.status, c.recipients, c.occurred_at AS "occurredAt",
            e.code AS "leadCode", u.full_name AS "sentBy", count(*) OVER() AS total
       FROM communications c
       LEFT JOIN enquiries e ON e.id = c.enquiry_id
       LEFT JOIN users u ON u.id = c.sent_by
      ${w.sql}
      ORDER BY ${orderBy(f.sort, f.dir, { when: 'c.occurred_at', occurredAt: 'c.occurred_at', channel: 'c.channel', who: 'c.counterpart' }, 'when')}
      LIMIT ${w.param(limit)} OFFSET ${w.param(offset)}`,
    w.params);
  return { rows: rows.map(({ total: _t, ...r }) => r), total: rows[0]?.total ?? 0 };
}
