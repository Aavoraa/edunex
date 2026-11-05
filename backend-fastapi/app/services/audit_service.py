"""Audit trail (services/audit.service.ts).

Reads of sensitive data are audited as well as writes. Outside a transaction a failure is logged,
never raised, so an audit hiccup cannot break the request. Inside a transaction the caller passes
`db` and the write is atomic with the change.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from ..db import Queryable, query
from ..http import Req

log = logging.getLogger('edunex.audit')

_SQL = """INSERT INTO audit_logs (user_id, user_name, role_key, action, module, entity_type, entity_id,
            description, ip_address, user_agent, device, metadata)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)"""


def audit(req: Req | None, entry: dict[str, Any], db: Queryable | None = None, actor: dict[str, Any] | None = None) -> None:
    """entry: {action, module, description, entityType?, entityId?, metadata?}."""
    u = req.user if req else None
    ua = req.get('user-agent') if req else None
    params = [
        actor['id'] if actor else (u.id if u else None),
        (actor or {}).get('name') or (u.fullName if u else 'System'),
        (actor or {}).get('role') or (u.roleKey if u else 'system'),
        entry['action'],
        entry['module'],
        entry.get('entityType'),
        entry.get('entityId'),
        entry['description'],
        client_ip(req) if req else None,
        ua[:300] if ua else None,
        u.clientType if u else (device_from(req) if req else 'service'),
        json.dumps(entry.get('metadata') or {}, default=str),
    ]
    if db is not None:
        query(_SQL, params, db)
        return
    try:
        query(_SQL, params)
    except Exception:  # noqa: BLE001
        log.exception('audit write failed: %s', entry.get('description'))


def client_ip(req: Req) -> str | None:
    return req.ip


def device_from(req: Req) -> str:
    hdr = (req.get('x-client-type') or '').lower()
    return hdr if hdr in ('mobile', 'integration') else 'web'


clientIp, deviceFrom = client_ip, device_from  # noqa: N816
