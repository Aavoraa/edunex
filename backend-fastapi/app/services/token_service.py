"""Access JWTs and rotating refresh tokens (services/token.service.ts)."""
from __future__ import annotations

import base64
import datetime as dt
import hashlib
import hmac
import secrets
import time
import uuid

import jwt

from ..config import settings
from ..db import one, query, tx
from ..errors import unauthorized


def sign_access_token(user_id: str, role_key: str, client_type: str) -> str:
    now = int(time.time())
    payload = {'role': role_key, 'typ': 'access', 'ct': client_type, 'iat': now,
               'exp': now + settings.access_ttl_seconds, 'aud': settings.JWT_AUDIENCE,
               'iss': settings.JWT_ISSUER, 'sub': user_id}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm='HS256')


def verify_access_token(token: str) -> dict:
    try:
        claims = jwt.decode(token, settings.JWT_SECRET, algorithms=['HS256'], audience=settings.JWT_AUDIENCE,
                            issuer=settings.JWT_ISSUER, options={'require': ['exp']}, leeway=0)
        if claims.get('typ') != 'access' or not claims.get('sub'):
            raise jwt.InvalidTokenError('wrong token type')
        return claims
    except jwt.ExpiredSignatureError:
        raise unauthorized('Access token expired', 'TOKEN_EXPIRED')
    except jwt.PyJWTError:
        raise unauthorized('Invalid access token', 'TOKEN_INVALID')


def _hash_refresh(token: str) -> str:
    """Refresh tokens are opaque random strings; only an HMAC of the value is stored."""
    return hmac.new(settings.JWT_REFRESH_SECRET.encode(), token.encode(), hashlib.sha256).hexdigest()


def _new_refresh_value() -> dict:
    token = base64.urlsafe_b64encode(secrets.token_bytes(48)).rstrip(b'=').decode()
    expires = dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=settings.JWT_REFRESH_TTL_DAYS)
    return {'token': token, 'expiresAt': expires.replace(microsecond=(expires.microsecond // 1000) * 1000)}


def issue_refresh_token(user_id: str, client_type: str, user_agent: str | None = None, ip: str | None = None) -> dict:
    nv = _new_refresh_value()
    family_id = str(uuid.uuid4())
    query(
        """INSERT INTO refresh_tokens (user_id, family_id, token_hash, expires_at, client_type, user_agent, ip_address)
           VALUES ($1, $2, $3, $4, $5, $6, $7)""",
        [user_id, family_id, _hash_refresh(nv['token']), nv['expiresAt'], client_type, user_agent, ip],
    )
    return {**nv, 'familyId': family_id}


def rotate_refresh_token(token: str, user_agent: str | None = None, ip: str | None = None) -> dict:
    """Rotates a refresh token. Presenting one that was already rotated is treated as theft:
    the whole token family is revoked."""
    error = None
    result: dict = {}
    with tx() as db:
        found = one(
            """SELECT id, user_id, family_id, expires_at, revoked_at, client_type
                 FROM refresh_tokens WHERE token_hash = $1 FOR UPDATE""",
            [_hash_refresh(token)], db,
        )
        if not found:
            error = unauthorized('Invalid refresh token', 'REFRESH_INVALID')
        elif found['revoked_at']:
            query('UPDATE refresh_tokens SET revoked_at = now() WHERE family_id = $1 AND revoked_at IS NULL', [found['family_id']], db)
            error = unauthorized('Session was already refreshed elsewhere; please sign in again', 'REFRESH_REUSED')
        elif found['expires_at'] < dt.datetime.now(dt.timezone.utc):
            error = unauthorized('Session expired; please sign in again', 'REFRESH_EXPIRED')
        else:
            nv = _new_refresh_value()
            inserted = one(
                """INSERT INTO refresh_tokens (user_id, family_id, token_hash, expires_at, client_type, user_agent, ip_address)
                   VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id""",
                [found['user_id'], found['family_id'], _hash_refresh(nv['token']), nv['expiresAt'], found['client_type'], user_agent, ip],
                db,
            )
            query('UPDATE refresh_tokens SET revoked_at = now(), replaced_by = $2, last_used_at = now() WHERE id = $1',
                  [found['id'], inserted['id']], db)
            result = {'userId': found['user_id'], 'clientType': found['client_type'], 'familyId': found['family_id'], **nv}
    # Family revocation must commit, so errors are raised after the transaction.
    if error:
        raise error
    return result


def revoke_refresh_token(token: str) -> dict | None:
    r = one('SELECT family_id, user_id FROM refresh_tokens WHERE token_hash = $1', [_hash_refresh(token)])
    if r:
        query('UPDATE refresh_tokens SET revoked_at = now() WHERE family_id = $1 AND revoked_at IS NULL', [r['family_id']])
    return r


def revoke_all_for_user(user_id: str, except_family: str | None = None) -> None:
    query(
        'UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL AND ($2::uuid IS NULL OR family_id <> $2)',
        [user_id, except_family],
    )


def list_sessions(user_id: str) -> list[dict]:
    return query(
        """SELECT family_id, client_type, user_agent, host(ip_address) AS ip, min(created_at) AS started_at, max(created_at) AS last_active_at
             FROM refresh_tokens
            WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now()
            GROUP BY family_id, client_type, user_agent, ip_address
            ORDER BY last_active_at DESC""",
        [user_id],
    ).rows
