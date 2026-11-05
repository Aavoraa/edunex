"""Auth endpoints (controllers/auth.controller.ts).

Web clients receive the refresh token as an httpOnly cookie (not readable by scripts).
Mobile/integration clients receive it in the body and keep it in secure device storage.
Both get the same short-lived access token.
"""
from __future__ import annotations

from ..config import settings
from ..db import query
from ..errors import unauthorized
from ..http import Req, v
from ..response import ok
from ..services import auth_service as auth
from ..services.audit_service import audit, client_ip, device_from
from ..services.token_service import list_sessions, revoke_all_for_user, revoke_refresh_token

COOKIE = 'hs_refresh'


def _cookie_opts() -> dict:
    return {'http_only': True, 'secure': settings.COOKIE_SECURE, 'same_site': 'strict', 'path': '/api/auth',
            'domain': settings.COOKIE_DOMAIN or None}


def _respond_with_tokens(req: Req, client_type: str, result: dict, message: str):
    body = {
        'accessToken': result['accessToken'],
        'tokenType': 'Bearer',
        'expiresIn': settings.JWT_ACCESS_TTL,
        'user': auth.public_user(result['user']),
    }
    if client_type == 'web':
        req.res.cookie(COOKIE, result['refresh']['token'], expires=result['refresh']['expiresAt'], **_cookie_opts())
    else:
        body['refreshToken'] = result['refresh']['token']
        body['refreshExpiresAt'] = result['refresh']['expiresAt']
    return ok(body, message)


def login(req: Req):
    b = v(req)
    identifier, password = b['identifier'], b['password']
    client_type = b.get('clientType') or device_from(req)
    try:
        result = auth.login(identifier, password, client_type, req.get('user-agent'), client_ip(req))
    except Exception:
        audit(req, {'action': 'login_failed', 'module': 'auth', 'description': 'Failed sign-in attempt',
                    'metadata': {'identifier': str(identifier)[:60]}},
              None, {'id': None, 'name': 'Anonymous', 'role': 'anonymous'})
        raise
    req.user = result['user']
    audit(req, {'action': 'login', 'module': 'auth', 'description': f"{result['user'].fullName} signed in",
                'entityType': 'user', 'entityId': result['user'].id})
    return _respond_with_tokens(req, client_type, result, 'Signed in successfully')


def refresh(req: Req):
    token = v(req).get('refreshToken') or req.cookies.get(COOKIE)
    if not token:
        raise unauthorized('No session to refresh', 'REFRESH_MISSING')
    try:
        result = auth.refresh(token, req.get('user-agent'), client_ip(req))
    except Exception:
        req.res.clear_cookie(COOKIE, **_cookie_opts())
        raise
    return _respond_with_tokens(req, result['refresh']['clientType'], result, 'Session refreshed')


def logout(req: Req):
    # Not validated by a schema (logout always succeeds), so ignore anything that is not a string.
    body = req.body if isinstance(req.body, dict) else {}
    token = next((t for t in (body.get('refreshToken'), req.cookies.get(COOKIE)) if isinstance(t, str) and t), None)
    if token:
        r = revoke_refresh_token(token)
        if r:
            audit(req, {'action': 'logout', 'module': 'auth', 'description': 'Signed out', 'entityType': 'user',
                        'entityId': r['user_id']}, None, {'id': r['user_id'], 'name': 'User', 'role': 'user'})
    req.res.clear_cookie(COOKIE, **_cookie_opts())
    return ok(None, 'Signed out')


def me(req: Req):
    u = req.user
    extra = query(
        """SELECT c.code AS campus_code, c.name AS campus_name,
                  (SELECT label FROM academic_years WHERE is_current) AS academic_year
             FROM users u LEFT JOIN campuses c ON c.id = u.campus_id WHERE u.id = $1""",
        [u.id],
    ).rows
    return ok({**auth.public_user(u), **(extra[0] if extra else {})}, 'Current user')


def change_password(req: Req):
    b = v(req)
    auth.change_password(req.user.id, b['currentPassword'], b['newPassword'])
    audit(req, {'action': 'update', 'module': 'auth', 'description': 'Changed password; other sessions signed out',
                'entityType': 'user', 'entityId': req.user.id})
    req.res.clear_cookie(COOKIE, **_cookie_opts())
    return ok(None, 'Password changed. Please sign in again.')


def sessions(req: Req):
    return ok(list_sessions(req.user.id), 'Active sessions')


def sign_out_everywhere(req: Req):
    revoke_all_for_user(req.user.id)
    audit(req, {'action': 'logout', 'module': 'auth', 'description': 'Signed out of all sessions', 'entityType': 'user',
                'entityId': req.user.id})
    req.res.clear_cookie(COOKIE, **_cookie_opts())
    return ok(None, 'Signed out of all devices')
