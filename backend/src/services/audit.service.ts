import type { Request } from 'express';
import { query, type Queryable } from '../config/db.js';
import { logger } from '../utils/logger.js';

export interface AuditEntry {
  action: string;          // create | update | delete | view | login | logout | approve | export …
  module: string;          // students | tracking | auth | finance …
  description: string;     // "Parent viewed child tracking"
  entityType?: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Writes an audit record. Reads of sensitive data (tracking, Student 360)
 * are audited as well as writes. Outside a transaction a failure is logged,
 * never thrown, so an audit hiccup cannot break the request. Inside a
 * transaction the caller passes `db` and the write is atomic with the change.
 */
export async function audit(req: Request | null, entry: AuditEntry, db?: Queryable, actor?: { id: string | null; name: string; role: string }) {
  const u = req?.user;
  const params = [
    actor ? actor.id : u?.id ?? null,
    actor?.name ?? u?.fullName ?? 'System',
    actor?.role ?? u?.roleKey ?? 'system',
    entry.action,
    entry.module,
    entry.entityType ?? null,
    entry.entityId ?? null,
    entry.description,
    req ? clientIp(req) : null,
    req?.get('user-agent')?.slice(0, 300) ?? null,
    u?.clientType ?? (req ? deviceFrom(req) : 'service'),
    JSON.stringify(entry.metadata ?? {}),
  ];
  const sql = `INSERT INTO audit_logs (user_id, user_name, role_key, action, module, entity_type, entity_id,
                 description, ip_address, user_agent, device, metadata)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`;
  if (db) {
    await query(sql, params, db);
    return;
  }
  try {
    await query(sql, params);
  } catch (err) {
    logger.error({ err, entry }, 'audit write failed');
  }
}

export function clientIp(req: Request): string | null {
  const ip = req.ip || req.socket?.remoteAddress || null;
  if (!ip) return null;
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}

export function deviceFrom(req: Request): 'web' | 'mobile' | 'integration' {
  const hdr = (req.get('x-client-type') || '').toLowerCase();
  if (hdr === 'mobile' || hdr === 'integration') return hdr;
  return 'web';
}
