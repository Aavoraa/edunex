"""Auth & sign-in — ported from backend/tests/security.test.ts ('authentication', 'error envelope'),
api-core.test.ts ('authentication') and vercel.test.ts. Tests that need modules not yet ported
(/api/users, /api/students, /api/lookups …) live with those modules."""
import time
import uuid

import pytest

from app.db import one, query
from app.services.auth_service import hash_password
from tests.helpers import ACCOUNTS, PASSWORD, as_, client, login

STRONG = 'CoreTest-Pass1'


@pytest.fixture
def make_user():
    """Creates a throw-away account directly (POST /api/users arrives with the core module)."""
    created: list[str] = []

    def make(role_key: str = 'staff') -> dict:
        email = f'core.{role_key}.{int(time.time() * 1000)}.{uuid.uuid4().hex[:6]}@example.com'
        row = one(
            """INSERT INTO users (email, full_name, role_id, password_hash, status)
               VALUES ($1, $2, (SELECT id FROM roles WHERE key = $3), $4, 'active') RETURNING id""",
            [email, f'Core Test {role_key}', role_key, hash_password(STRONG, 10)],
        )
        created.append(row['id'])
        return {'id': row['id'], 'email': email}

    yield make
    if created:
        query('DELETE FROM refresh_tokens WHERE user_id = ANY($1)', [created])
        query('UPDATE audit_logs SET user_id = NULL WHERE user_id = ANY($1)', [created])
        query('DELETE FROM users WHERE id = ANY($1)', [created])


def sign_in(email: str, password: str = STRONG):
    return client.post('/api/auth/login', json={'identifier': email, 'password': password, 'clientType': 'mobile'})


# ---- security.test.ts › authentication ------------------------------------------------------
def test_rejects_requests_without_a_token():
    r = client.get('/api/students')
    assert r.status_code == 401
    assert r.json()['success'] is False and r.json()['error'] == 'UNAUTHORIZED'


def test_rejects_a_tampered_token():
    token = login('principal')['token']
    r = client.get('/api/auth/me', headers={'Authorization': f'Bearer {token[:-2]}xx'})
    assert r.status_code == 401
    assert r.json()['error'] == 'TOKEN_INVALID'


def test_does_not_reveal_whether_an_account_exists():
    a = client.post('/api/auth/login', json={'identifier': 'nobody@example.com', 'password': 'x'})
    b = client.post('/api/auth/login', json={'identifier': ACCOUNTS['office'], 'password': 'wrong-password'})
    assert a.status_code == 401 and b.status_code == 401
    assert a.json()['message'] == b.json()['message']


def test_web_login_sets_an_httponly_refresh_cookie_and_no_token_in_the_body():
    r = client.post('/api/auth/login', json={'identifier': ACCOUNTS['office'], 'password': PASSWORD, 'clientType': 'web'})
    assert r.status_code == 200
    assert 'refreshToken' not in r.json()['data']
    cookie = r.headers.get('set-cookie', '')
    assert 'hs_refresh=' in cookie
    assert 'httponly' in cookie.lower()
    assert 'samesite=strict' in cookie.lower()
    assert 'Path=/api/auth' in cookie


def test_web_refresh_reads_the_cookie_and_rotates_it():
    client.cookies.clear()
    r = client.post('/api/auth/login', json={'identifier': ACCOUNTS['office'], 'password': PASSWORD, 'clientType': 'web'})
    cookie = r.cookies.get('hs_refresh') or client.cookies.get('hs_refresh', path='/api/auth')
    assert cookie
    client.cookies.clear()
    r1 = client.post('/api/auth/refresh', json={}, cookies={'hs_refresh': cookie})
    assert r1.status_code == 200, r1.text
    assert 'refreshToken' not in r1.json()['data']
    assert 'hs_refresh=' in r1.headers.get('set-cookie', '')
    client.cookies.clear()
    # The old cookie was rotated: presenting it again revokes the family and clears the cookie.
    r2 = client.post('/api/auth/refresh', json={}, cookies={'hs_refresh': cookie})
    assert r2.status_code == 401 and r2.json()['error'] == 'REFRESH_REUSED'
    assert 'Expires=Thu, 01 Jan 1970' in r2.headers.get('set-cookie', '')
    client.cookies.clear()


def test_rotates_refresh_tokens_and_revokes_the_family_on_reuse():
    r = client.post('/api/auth/login', json={'identifier': ACCOUNTS['hr'], 'password': PASSWORD, 'clientType': 'mobile'})
    first = r.json()['data']['refreshToken']
    r1 = client.post('/api/auth/refresh', json={'refreshToken': first})
    assert r1.status_code == 200
    second = r1.json()['data']['refreshToken']
    assert second != first
    reuse = client.post('/api/auth/refresh', json={'refreshToken': first})
    assert reuse.status_code == 401
    assert reuse.json()['error'] == 'REFRESH_REUSED'
    after_revoke = client.post('/api/auth/refresh', json={'refreshToken': second})
    assert after_revoke.status_code == 401


def test_refresh_without_a_session():
    client.cookies.clear()
    r = client.post('/api/auth/refresh', json={})
    assert r.status_code == 401 and r.json()['error'] == 'REFRESH_MISSING'


def test_me_returns_the_public_user_with_campus_and_year():
    api = as_('principal')
    r = api.get('/api/auth/me')
    assert r.status_code == 200
    d = r.json()['data']
    assert d['email'] == ACCOUNTS['principal']
    assert d['role']['key'] == 'principal'
    assert d['permissions'] == sorted(d['permissions'])
    assert 'academic_year' in d and 'campus_code' in d
    assert 'password' not in r.text.lower()


def test_login_response_shape():
    r = client.post('/api/auth/login', json={'identifier': ACCOUNTS['teacher'], 'password': PASSWORD, 'clientType': 'mobile'})
    d = r.json()['data']
    assert set(d) == {'accessToken', 'tokenType', 'expiresIn', 'user', 'refreshToken', 'refreshExpiresAt'}
    assert d['tokenType'] == 'Bearer'
    assert d['refreshExpiresAt'].endswith('Z') and len(d['refreshExpiresAt']) == 24
    assert set(d['user']) == {'id', 'email', 'fullName', 'title', 'role', 'campusId', 'permissions', 'employeeId', 'parentId', 'studentId'}
    assert d['user']['employeeId']


def test_login_validation_errors():
    r = client.post('/api/auth/login', json={'identifier': ' a ', 'password': ''})
    assert r.status_code == 400
    body = r.json()
    assert body['error'] == 'VALIDATION_ERROR'
    assert {d['field'] for d in body['details']} == {'identifier', 'password'}
    assert any(d['message'] == 'Enter your email or mobile number' for d in body['details'])


def test_sessions_and_sign_out_everywhere(make_user):
    u = make_user('staff')
    a = sign_in(u['email']).json()['data']
    sign_in(u['email'])
    h = {'Authorization': f"Bearer {a['accessToken']}"}
    s = client.get('/api/auth/sessions', headers=h)
    assert s.status_code == 200 and len(s.json()['data']) == 2
    assert {'family_id', 'client_type', 'user_agent', 'ip', 'started_at', 'last_active_at'} <= set(s.json()['data'][0])
    assert client.post('/api/auth/sessions/revoke-all', headers=h).status_code == 200
    assert client.get('/api/auth/sessions', headers=h).json()['data'] == []
    assert client.post('/api/auth/refresh', json={'refreshToken': a['refreshToken']}).status_code == 401


def test_logout_revokes_the_refresh_token(make_user):
    u = make_user('staff')
    a = sign_in(u['email']).json()['data']
    r = client.post('/api/auth/logout', json={'refreshToken': a['refreshToken']})
    assert r.status_code == 200 and r.json() == {'success': True, 'data': None, 'message': 'Signed out'}
    assert client.post('/api/auth/refresh', json={'refreshToken': a['refreshToken']}).status_code == 401


# ---- api-core.test.ts › authentication ------------------------------------------------------
def test_locks_the_account_even_when_failed_attempts_arrive_concurrently(make_user):
    from concurrent.futures import ThreadPoolExecutor
    u = make_user('staff')
    with ThreadPoolExecutor(6) as ex:
        list(ex.map(lambda _: sign_in(u['email'], 'wrong-password'), range(6)))
    r = sign_in(u['email'])
    assert r.status_code == 401
    assert r.json()['error'] == 'ACCOUNT_LOCKED'


def test_an_access_token_issued_before_a_password_change_stops_working(make_user):
    u = make_user('staff')
    token = sign_in(u['email']).json()['data']['accessToken']
    time.sleep(1.1)  # iat has one-second resolution
    ch = client.post('/api/auth/change-password', headers={'Authorization': f'Bearer {token}'},
                     json={'currentPassword': STRONG, 'newPassword': 'CoreTest-Pass2'})
    assert ch.status_code == 200
    me = client.get('/api/auth/me', headers={'Authorization': f'Bearer {token}'})
    assert me.status_code == 401
    assert me.json()['error'] == 'TOKEN_REVOKED'
    again = sign_in(u['email'], 'CoreTest-Pass2')
    assert again.status_code == 200
    assert client.get('/api/auth/me', headers={'Authorization': f"Bearer {again.json()['data']['accessToken']}"}).status_code == 200


def test_change_password_rules(make_user):
    u = make_user('staff')
    h = {'Authorization': f"Bearer {sign_in(u['email']).json()['data']['accessToken']}"}
    weak = client.post('/api/auth/change-password', headers=h, json={'currentPassword': STRONG, 'newPassword': 'short'})
    assert weak.status_code == 400 and weak.json()['error'] == 'VALIDATION_ERROR'
    wrong = client.post('/api/auth/change-password', headers=h, json={'currentPassword': 'nope', 'newPassword': 'CoreTest-Pass9'})
    assert wrong.json()['error'] == 'INVALID_CURRENT_PASSWORD'
    same = client.post('/api/auth/change-password', headers=h, json={'currentPassword': STRONG, 'newPassword': STRONG})
    assert same.json()['error'] == 'PASSWORD_REUSED'


def test_logout_with_a_non_string_refresh_token_is_not_a_server_error():
    r = client.post('/api/auth/logout', json={'refreshToken': 12345})
    assert r.status_code == 200


def test_an_unsupported_body_charset_is_a_4xx_not_a_500():
    r = client.post('/api/auth/login', content=b'{"identifier":"abc"}', headers={'Content-Type': 'application/json; charset=x-bogus'})
    assert r.status_code == 415


# ---- security.test.ts › error envelope ------------------------------------------------------
def test_404_for_unknown_routes():
    api = as_('principal')
    r = api.get('/api/does-not-exist')
    assert r.status_code == 404
    assert r.json()['success'] is False and r.json()['error'] == 'ROUTE_NOT_FOUND'


def test_unknown_route_without_a_token_is_401_like_express():
    assert client.get('/api/does-not-exist').status_code == 401


def test_rejects_malformed_json():
    r = client.post('/api/auth/login', content=b'{"identifier":', headers={'Content-Type': 'application/json'})
    assert r.status_code == 400
    assert r.json()['error'] == 'INVALID_JSON'


def test_sets_secure_headers_and_no_store_on_api_responses():
    api = as_('principal')
    r = api.get('/api/auth/me')
    assert r.headers['x-content-type-options'] == 'nosniff'
    assert r.headers['cache-control'] == 'no-store'
    assert 'x-powered-by' not in r.headers


def test_login_is_audited():
    u = login('finance')['user']
    row = one("SELECT action, device FROM audit_logs WHERE user_id = $1 AND module = 'auth' ORDER BY id DESC LIMIT 1", [u['id']])
    assert row and row['action'] == 'login' and row['device'] == 'mobile'


# ---- vercel.test.ts -------------------------------------------------------------------------
CRON = '/api/internal/cron/notifications'


def test_exports_the_app_as_the_function_entry():
    from app.main import app
    assert callable(app)
    assert client.get('/api/health').status_code == 200


def test_runs_the_notification_dispatcher_only_for_vercel_cron():
    import os
    assert client.get(CRON).status_code == 401
    assert client.get(CRON, headers={'Authorization': 'Bearer wrong-secret-0123456789'}).status_code == 401
    r = client.get(CRON, headers={'Authorization': f"Bearer {os.environ['CRON_SECRET']}"})
    assert r.status_code == 200
    assert isinstance(r.json()['data']['sent'], int)
