"""Sign-in, refresh and password change (services/auth.service.ts)."""
from __future__ import annotations

import datetime as dt

import bcrypt

from ..db import one, query
from ..errors import bad_request, unauthorized
from ..middleware.auth import AuthUser, load_auth_user
from .token_service import issue_refresh_token, revoke_all_for_user, rotate_refresh_token, sign_access_token

MAX_FAILED = 5
LOCK_MINUTES = 15


def _pw(password: str) -> bytes:
    # bcryptjs silently uses the first 72 bytes; the bcrypt package refuses longer input.
    return password.encode('utf-8')[:72]


def check_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(_pw(password), hashed.encode())
    except ValueError:
        return False


def hash_password(password: str, rounds: int = 12) -> str:
    # $2a$ like bcryptjs; both prefixes verify the same.
    return bcrypt.hashpw(_pw(password), bcrypt.gensalt(rounds, prefix=b'2a')).decode()


# Compared against when the account does not exist, so response time does not reveal it.
DUMMY_HASH = hash_password('not-a-real-password-placeholder', 10)


def public_user(u: AuthUser) -> dict:
    return {
        'id': u.id,
        'email': u.email,
        'fullName': u.fullName,
        'title': u.title,
        'role': {'key': u.roleKey, 'name': u.roleName, 'scope': u.scope, 'homeRoute': u.homeRoute},
        'campusId': u.campusId,
        'permissions': sorted(u.permissions),
        'employeeId': u.employeeId,
        'parentId': u.parentId,
        'studentId': u.studentId,
    }


def login(identifier: str, password: str, client_type: str, user_agent: str | None = None, ip: str | None = None) -> dict:
    row = one(
        """SELECT id, password_hash, status, failed_login_count, locked_until
             FROM users WHERE (email = $1 OR phone = $1) AND deleted_at IS NULL""",
        [identifier.lower() if '@' in identifier.lower() else identifier],
    )
    if not row:
        check_password(password, DUMMY_HASH)
        raise unauthorized('Incorrect email/mobile or password', 'INVALID_CREDENTIALS')
    if row['locked_until'] and row['locked_until'] > dt.datetime.now(dt.timezone.utc):
        raise unauthorized('Too many failed attempts. Try again in a few minutes.', 'ACCOUNT_LOCKED')
    if not check_password(password, row['password_hash']):
        # Counted in SQL, not from the value read above: concurrent guesses must not
        # overwrite each other's count, nor clear a lock another attempt just set.
        query(
            """UPDATE users SET failed_login_count = CASE WHEN locked_until > now() THEN failed_login_count
                                                         WHEN failed_login_count + 1 >= $2 THEN 0 ELSE failed_login_count + 1 END,
                      locked_until = CASE WHEN locked_until > now() THEN locked_until
                                          WHEN failed_login_count + 1 >= $2 THEN now() + make_interval(mins => $3) ELSE NULL END
                WHERE id = $1""",
            [row['id'], MAX_FAILED, LOCK_MINUTES],
        )
        raise unauthorized('Incorrect email/mobile or password', 'INVALID_CREDENTIALS')
    if row['status'] != 'active':
        raise unauthorized('This account is not active. Contact the school office.', 'ACCOUNT_INACTIVE')

    query('UPDATE users SET failed_login_count = 0, locked_until = NULL, last_login_at = now() WHERE id = $1', [row['id']])
    user = load_auth_user(row['id'], client_type)
    if not user:
        raise unauthorized('Account is not active', 'ACCOUNT_INACTIVE')
    access = sign_access_token(user.id, user.roleKey, client_type)
    refresh = issue_refresh_token(user.id, client_type, user_agent, ip)
    return {'user': user, 'accessToken': access, 'refresh': refresh}


def refresh(token: str, user_agent: str | None = None, ip: str | None = None) -> dict:
    rotated = rotate_refresh_token(token, user_agent, ip)
    user = load_auth_user(rotated['userId'], rotated['clientType'])
    if not user:
        raise unauthorized('Account is not active', 'ACCOUNT_INACTIVE')
    access = sign_access_token(user.id, user.roleKey, rotated['clientType'])
    return {'user': user, 'accessToken': access, 'refresh': rotated}


def change_password(user_id: str, current: str, new: str) -> None:
    row = one('SELECT password_hash FROM users WHERE id = $1', [user_id])
    if not row or not check_password(current, row['password_hash']):
        raise bad_request('Current password is incorrect', 'INVALID_CURRENT_PASSWORD')
    if check_password(new, row['password_hash']):
        raise bad_request('Choose a password you have not used here before', 'PASSWORD_REUSED')
    query('UPDATE users SET password_hash = $2, password_changed_at = now() WHERE id = $1', [user_id, hash_password(new)])
    # Sign out every other session after a password change.
    revoke_all_for_user(user_id)
