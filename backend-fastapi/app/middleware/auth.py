"""Authentication and permission checks (middleware/auth.ts)."""
from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field
from typing import Callable

from ..db import many, one
from ..errors import forbidden, unauthorized
from ..http import Req


@dataclass
class AuthUser:
    id: str
    email: str
    fullName: str  # noqa: N815 — same names as the TS AuthUser
    title: str | None
    roleKey: str  # noqa: N815
    roleName: str  # noqa: N815
    scope: str
    homeRoute: str  # noqa: N815
    campusId: str | None  # noqa: N815
    permissions: set[str] = field(default_factory=set)
    employeeId: str | None = None  # noqa: N815
    parentId: str | None = None  # noqa: N815
    studentId: str | None = None  # noqa: N815
    clientType: str = 'web'  # noqa: N815


# Role permissions change rarely; cache briefly to avoid a join on every request.
_perm_cache: dict[str, tuple[float, set[str]]] = {}
_perm_lock = threading.Lock()
PERM_TTL_S = 30.0


def permissions_for_role(role_id: str) -> set[str]:
    hit = _perm_cache.get(role_id)
    if hit and time.monotonic() - hit[0] < PERM_TTL_S:
        return hit[1]
    rows = many('SELECT p.key FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE rp.role_id = $1', [role_id])
    perms = {r['key'] for r in rows}
    with _perm_lock:
        _perm_cache[role_id] = (time.monotonic(), perms)
    return perms


def clear_permission_cache() -> None:
    with _perm_lock:
        _perm_cache.clear()


def load_auth_user(user_id: str, client_type: str = 'web', issued_at: int | None = None) -> AuthUser | None:
    """`issued_at` (JWT iat, seconds): an access token issued before the last password change is refused."""
    u = one(
        """SELECT u.id, u.email, u.full_name, u.title, u.status, u.campus_id, u.password_changed_at,
                  r.id AS role_id, r.key AS role_key, r.name AS role_name, r.scope, r.home_route,
                  e.id AS employee_id, p.id AS parent_id, s.id AS student_id
             FROM users u
             JOIN roles r ON r.id = u.role_id
             LEFT JOIN employees e ON e.user_id = u.id AND e.deleted_at IS NULL
             LEFT JOIN parents p ON p.user_id = u.id AND p.deleted_at IS NULL
             LEFT JOIN students s ON s.user_id = u.id AND s.deleted_at IS NULL
            WHERE u.id = $1 AND u.deleted_at IS NULL""",
        [user_id],
    )
    if not u or u['status'] != 'active':
        return None
    pca = u['password_changed_at']
    if issued_at is not None and pca is not None and issued_at < int(pca.timestamp()):
        raise unauthorized('Your password was changed; please sign in again', 'TOKEN_REVOKED')
    return AuthUser(
        id=u['id'], email=u['email'], fullName=u['full_name'], title=u['title'],
        roleKey=u['role_key'], roleName=u['role_name'], scope=u['scope'], homeRoute=u['home_route'],
        campusId=u['campus_id'], permissions=permissions_for_role(u['role_id']),
        employeeId=u['employee_id'], parentId=u['parent_id'], studentId=u['student_id'], clientType=client_type,
    )


def authenticate(req: Req) -> None:
    """Requires a valid Bearer access token. Web and mobile clients use the same header."""
    from ..services.token_service import verify_access_token
    header = req.get('authorization') or ''
    parts = header.split(' ')
    kind, token = parts[0], (parts[1] if len(parts) > 1 else '')
    if kind != 'Bearer' or not token:
        raise unauthorized()
    claims = verify_access_token(token)
    user = load_auth_user(claims['sub'], claims.get('ct', 'web'), claims.get('iat'))
    if not user:
        raise unauthorized('Account is not active', 'ACCOUNT_INACTIVE')
    req.user = user


def require_permission(*perms: str) -> Callable[[Req], None]:
    """Allows the request when the user holds ALL listed permissions."""
    def mw(req: Req) -> None:
        u = req.user
        if not u:
            raise unauthorized()
        missing = [p for p in perms if p not in u.permissions]
        if missing:
            raise forbidden('Missing permission: ' + ', '.join(missing))
    return mw


def require_any(*perms: str) -> Callable[[Req], None]:
    """Allows the request when the user holds ANY of the listed permissions."""
    def mw(req: Req) -> None:
        u = req.user
        if not u:
            raise unauthorized()
        if not any(p in u.permissions for p in perms):
            raise forbidden()
    return mw


def has(req: Req, perm: str) -> bool:
    return bool(req.user and perm in req.user.permissions)


# Express-style aliases so ported route files read like the originals.
requirePermission = require_permission  # noqa: N816
requireAny = require_any  # noqa: N816
