"""In-app notifications and the external-channel outbox (services/notification.service.ts)."""
from __future__ import annotations

import logging
from typing import Any

from ..config import settings
from ..db import Queryable, many, query
from .whatsapp_provider import send_whatsapp, whatsapp_number

log = logging.getLogger('edunex.notify')

TONE_FOR = {'Critical': 'critical', 'Attention': 'warning', 'Information': 'info', 'Completed': 'success'}


def notify_users(user_ids: list[str], n: dict[str, Any], db: Queryable | None = None) -> list[str]:
    """n: {category, tone?, icon?, topic, title, body?, route?, entityType?, entityId?, channels?}.
    External deliveries are only queued here; dispatch_pending sends them. Respects per-topic preferences."""
    ids = list(dict.fromkeys(u for u in user_ids if u))
    if not ids:
        return []
    prefs = many('SELECT user_id, in_app, whatsapp, sms, email, push FROM notification_preferences WHERE topic = $1 AND user_id = ANY($2)',
                 [n['topic'], ids], db)
    pref_by = {p['user_id']: p for p in prefs}
    out: list[str] = []
    for uid in ids:
        pref = pref_by.get(uid)
        # Critical safety notifications are always delivered in-app.
        if pref and not pref['in_app'] and n['category'] != 'Critical':
            continue
        r = query(
            """INSERT INTO notifications (user_id, category, tone, icon, topic, title, body, route, entity_type, entity_id)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id""",
            [uid, n['category'], n.get('tone') or TONE_FOR[n['category']], n.get('icon') or 'bell', n['topic'], n['title'],
             n.get('body'), n.get('route'), n.get('entityType'), n.get('entityId')],
            db,
        )
        nid = r.rows[0]['id']
        out.append(nid)
        for ch in n.get('channels') or []:
            if pref and pref.get(ch) is False:
                continue
            query("INSERT INTO notification_deliveries (notification_id, channel, status) VALUES ($1, $2, 'pending')", [nid, ch], db)
    return out


def notify_roles(role_keys: list[str], n: dict[str, Any], db: Queryable | None = None) -> list[str]:
    """Notifies every active user holding a role (e.g. all principals)."""
    users = many("""SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id
                     WHERE r.key = ANY($1) AND u.status = 'active' AND u.deleted_at IS NULL""", [role_keys], db)
    return notify_users([u['id'] for u in users], n, db)


def notify_guardians(student_id: str, n: dict[str, Any], db: Queryable | None = None) -> list[str]:
    """Notifies the guardians (with user accounts) of a student. Location alerts (topic 'tracking')
    go only to guardians allowed to see the child's tracking."""
    users = many(
        """SELECT p.user_id FROM student_guardians sg JOIN parents p ON p.id = sg.parent_id
            WHERE sg.student_id = $1 AND p.user_id IS NOT NULL AND p.deleted_at IS NULL
              AND ($2::boolean = false OR sg.can_view_tracking)""",
        [student_id, n['topic'] == 'tracking'], db,
    )
    return notify_users([u['user_id'] for u in users], {'channels': ['whatsapp', 'push'], **n}, db)


PROVIDER_CONFIGURED = {
    'whatsapp': lambda: bool(settings.WHATSAPP_API_URL and settings.WHATSAPP_API_TOKEN),
    'sms': lambda: bool(settings.SMS_API_URL and settings.SMS_API_KEY),
    'email': lambda: bool(settings.SMTP_URL),
    'push': lambda: bool(settings.PUSH_FCM_SERVER_KEY),
}

# Adapters that actually send. Channels without one stay queued until an adapter is added.
ADAPTERS = {
    'whatsapp': lambda d: send_whatsapp({'to': d['destination'], 'title': d['title'], 'body': d['body'], 'reference': d['id']}),
}

MAX_ATTEMPTS = 5


def dispatch_pending(limit: int = 50) -> int:
    """Outbox dispatcher. No external service is called unless its credentials are configured and an
    adapter exists. Failures retry with backoff, then fail."""
    ready = [c for c in ADAPTERS if PROVIDER_CONFIGURED[c]()]
    if not ready:
        return 0
    query(
        """UPDATE notification_deliveries SET status = 'skipped', last_error = 'Expired: queued more than 24 hours ago', updated_at = now()
            WHERE status = 'pending' AND channel = ANY($1) AND created_at < now() - interval '24 hours'""",
        [ready],
    )
    rows = many(
        """SELECT d.id, d.channel, d.attempts, n.title, n.body,
                  COALESCE(NULLIF(d.destination, ''), p.phone, e.phone, u.phone) AS phone
             FROM notification_deliveries d
             JOIN notifications n ON n.id = d.notification_id
             JOIN users u ON u.id = n.user_id
             LEFT JOIN parents p ON p.user_id = u.id AND p.deleted_at IS NULL
             LEFT JOIN employees e ON e.user_id = u.id AND e.deleted_at IS NULL
            WHERE d.status = 'pending' AND d.next_attempt_at <= now() AND d.channel = ANY($2)
            ORDER BY d.next_attempt_at LIMIT $1""",
        [limit, ready],
    )
    for row in rows:
        to = whatsapp_number(row['phone']) if row['channel'] == 'whatsapp' else row['phone']
        if not to:
            query("UPDATE notification_deliveries SET status = 'skipped', last_error = 'No usable phone number for this user', updated_at = now() WHERE id = $1",
                  [row['id']])
            continue
        try:
            ref = ADAPTERS[row['channel']]({**row, 'destination': to})
            query(
                """UPDATE notification_deliveries SET status = 'sent', destination = $2, provider = $3, provider_ref = $4,
                          attempts = attempts + 1, last_error = NULL, updated_at = now() WHERE id = $1""",
                [row['id'], to, f'whatsapp:{settings.WHATSAPP_PROVIDER}' if row['channel'] == 'whatsapp' else row['channel'], ref],
            )
        except Exception as err:  # noqa: BLE001
            failed = row['attempts'] + 1 >= MAX_ATTEMPTS
            query(
                """UPDATE notification_deliveries SET attempts = attempts + 1, last_error = $2, destination = $3, updated_at = now(),
                          status = CASE WHEN $4 THEN 'failed' ELSE status END,
                          next_attempt_at = now() + (interval '1 minute' * power(2, attempts)) WHERE id = $1""",
                [row['id'], str(err)[:500], to, failed],
            )
            log.warning('delivery %s via %s failed (attempt %s): %s', row['id'], row['channel'], row['attempts'] + 1, err)
    return len(rows)


notifyUsers, notifyRoles, notifyGuardians, dispatchPending = notify_users, notify_roles, notify_guardians, dispatch_pending  # noqa: N816
