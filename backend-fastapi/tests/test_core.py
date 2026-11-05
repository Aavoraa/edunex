"""Core module — ported from backend/tests/admin-user-edit.test.ts, api-core.test.ts (administration
guards, invalid upload form), security.test.ts ('never returns password hashes', RBAC cases on core
routes, secure headers on /api/lookups), plus checks of the remaining core routes."""
import time
import uuid

import pytest

from app.db import one, query
from tests.helpers import as_, client, login

STRONG = 'CoreTest-Pass1'


def sign_in(identifier: str, password: str):
    return client.post('/api/auth/login', json={'identifier': identifier, 'password': password, 'clientType': 'mobile'})


@pytest.fixture
def created_users():
    ids: list[str] = []
    yield ids
    if ids:
        query('DELETE FROM refresh_tokens WHERE user_id = ANY($1)', [ids])
        query('UPDATE audit_logs SET user_id = NULL WHERE user_id = ANY($1)', [ids])
        query('DELETE FROM users WHERE id = ANY($1)', [ids])


def make_user(created: list[str], role_key: str) -> dict:
    admin = as_('superadmin')
    email = f'core.{role_key}.{int(time.time() * 1000)}.{uuid.uuid4().hex[:6]}@example.com'
    r = admin.post('/api/users', {'email': email, 'fullName': f'Core Test {role_key}', 'roleKey': role_key, 'password': STRONG})
    assert r.status_code == 201, r.text
    created.append(r.json()['data']['id'])
    return {'id': r.json()['data']['id'], 'email': email}


# ---- admin-user-edit.test.ts ----------------------------------------------------------------
def test_updates_details_and_resets_the_password(created_users):
    admin = as_('superadmin')
    stamp = int(time.time() * 1000)
    email = f'reset.test.{stamp}@edunex.edu'
    phone = f'+91 9{str(stamp)[-9:]}'
    r = admin.post('/api/users', {'email': email, 'fullName': 'Reset Test', 'roleKey': 'teacher', 'password': 'OldPassw0rd1'})
    assert r.status_code == 201
    uid = r.json()['data']['id']
    created_users.append(uid)

    before = sign_in(email, 'OldPassw0rd1')
    assert before.status_code == 200
    old_token = before.json()['data']['accessToken']
    time.sleep(1.1)

    assert admin.patch(f'/api/users/{uid}', {'password': 'short'}).status_code == 400
    r = admin.patch(f'/api/users/{uid}', {'fullName': 'Reset Tested', 'title': 'Class Teacher', 'phone': phone, 'password': 'NewPassw0rd2'})
    assert r.status_code == 200
    assert one('SELECT full_name, title, phone FROM users WHERE id = $1', [uid]) == {'full_name': 'Reset Tested', 'title': 'Class Teacher', 'phone': phone}

    assert sign_in(email, 'OldPassw0rd1').status_code == 401
    assert sign_in(email, 'NewPassw0rd2').status_code == 200
    assert client.get('/api/auth/me', headers={'Authorization': f'Bearer {old_token}'}).status_code == 401

    log = one("""SELECT metadata FROM audit_logs WHERE entity_id = $1 AND module = 'users' AND action = 'update'
                 ORDER BY created_at DESC LIMIT 1""", [uid])
    assert log['metadata']['passwordReset'] is True
    assert 'NewPassw0rd2' not in str(log['metadata'])


def test_refuses_a_reset_of_your_own_account_and_by_non_admins():
    me = login('superadmin')
    r = as_('superadmin').patch(f"/api/users/{me['user']['id']}", {'password': 'AnotherPassw0rd3'})
    assert r.status_code == 400
    assert r.json()['error'] == 'SELF_PASSWORD'
    target = login('teacher')
    assert as_('principal').patch(f"/api/users/{target['user']['id']}", {'password': 'AnotherPassw0rd3'}).status_code == 403


# ---- api-core.test.ts -----------------------------------------------------------------------
def test_only_a_super_admin_may_change_or_suspend_a_super_admin_account(created_users):
    target = make_user(created_users, 'super_admin')
    sa = make_user(created_users, 'school_admin')
    token = sign_in(sa['email'], STRONG).json()['data']['accessToken']
    r = client.patch(f"/api/users/{target['id']}", headers={'Authorization': f'Bearer {token}'}, json={'status': 'suspended'})
    assert r.status_code == 403
    assert one('SELECT status FROM users WHERE id = $1', [target['id']])['status'] == 'active'


def test_an_invalid_document_upload_form_is_a_400_not_a_500():
    api = as_('superadmin')
    r = api.post('/api/documents', files={'file': ('x.pdf', b'%PDF-1.4 test', 'application/pdf')})
    assert r.status_code == 400
    assert r.json()['error'] == 'VALIDATION_ERROR'


# ---- security.test.ts -----------------------------------------------------------------------
def test_never_returns_password_hashes():
    r = as_('superadmin').get('/api/users?pageSize=5')
    assert r.status_code == 200
    import re
    assert not re.search(r'password|\$2[aby]\$', r.text, re.I)


@pytest.mark.parametrize('path,who,status', [
    ('/api/audit-logs', 'teacher', 403),
    ('/api/users', 'principal', 403),
])
def test_rbac_on_core_routes(path, who, status):
    assert as_(who).get(path).status_code == status


def test_sets_secure_headers_and_no_store_on_lookups():
    r = as_('principal').get('/api/lookups')
    assert r.headers['x-content-type-options'] == 'nosniff'
    assert r.headers['cache-control'] == 'no-store'
    assert 'x-powered-by' not in r.headers


# ---- remaining core routes --------------------------------------------------------------------
def test_lookups_shape_for_staff_and_parent():
    d = as_('superadmin').get('/api/lookups').json()['data']
    assert {'campuses', 'academicYears', 'classes', 'subjects', 'houses', 'routes', 'staff', 'roles'} <= set(d)
    cls = next(c for c in d['classes'] if c['sections'])
    assert {'id', 'name', 'room'} == set(cls['sections'][0])
    assert isinstance(d['academicYears'][0]['startsOn'], str) and len(d['academicYears'][0]['startsOn']) == 10
    p = as_('parent').get('/api/lookups').json()['data']
    assert p['classes'] == [] and 'staff' not in p


def test_notifications_list_counts_and_read_all():
    api = as_('principal')
    lst = api.get('/api/notifications?pageSize=5')
    assert lst.status_code == 200
    body = lst.json()
    assert set(body['meta']) == {'page', 'pageSize', 'total', 'totalPages'}
    assert all('total' not in n for n in body['data'])
    c = api.get('/api/notifications/counts').json()['data']
    assert {'unread', 'alerts', 'critical', 'attention', 'information', 'completed', 'total', 'openTasks'} == set(c)
    assert api.get('/api/notifications?unread=maybe').status_code == 400
    assert api.patch(f'/api/notifications/{uuid.uuid4()}/read').status_code == 404


def test_tasks_and_search():
    api = as_('principal')
    t = api.get('/api/tasks')
    assert t.status_code == 200
    assert api.get('/api/tasks?status=bogus').status_code == 400
    s = api.get('/api/search?q=a')
    assert s.status_code == 200
    assert {h['group'] for h in s.json()['data']} <= {'Students', 'Parents', 'Employees', 'Admissions', 'Fees', 'Documents'}


def test_search_is_scoped_to_own_children():
    r = as_('parent').get('/api/search?q=a')
    assert r.status_code == 200
    assert all(h['group'] == 'My children' for h in r.json()['data'])


def test_roles_and_audit_trail():
    admin = as_('superadmin')
    roles = admin.get('/api/roles').json()['data']
    sa = next(x for x in roles['roles'] if x['key'] == 'super_admin')
    assert isinstance(sa['permissions'], list) and isinstance(sa['users'], int)
    assert admin.put(f"/api/roles/{sa['id']}/permissions", {'permissions': []}).status_code == 403
    logs = admin.get('/api/audit-logs?pageSize=3&from=2020-01-01')
    assert logs.status_code == 200 and logs.json()['data'][0]['createdAt'].endswith('Z')


def test_settings_round_trip():
    admin = as_('superadmin')
    rows = admin.get('/api/settings').json()['data']
    if not rows:
        pytest.skip('no system settings seeded')
    s = rows[0]
    assert admin.put(f"/api/settings/{s['key']}", {'value': s['value']}).status_code == 200
    assert admin.put('/api/settings/does.not.exist', {'value': 1}).status_code == 404


def test_document_upload_and_download():
    api = as_('superadmin')
    pdf = b'%PDF-1.4\n% fastapi port test\n'
    r = api.post('/api/documents', data={'name': 'FastAPI port test', 'category': 'General'},
                 files={'file': ('port test.pdf', pdf, 'application/pdf')})
    assert r.status_code == 201, r.text
    did = r.json()['data']['id']
    try:
        d = api.get(f'/api/documents/{did}/download')
        assert d.status_code == 200
        assert d.content == pdf
        assert d.headers['content-disposition'] == 'attachment; filename="port test.pdf"'
        bad = api.post('/api/documents', data={'name': 'Bad'}, files={'file': ('x.pdf', b'not a pdf', 'application/pdf')})
        assert bad.json()['error'] == 'FILE_TYPE_MISMATCH'
        wrong = api.post('/api/documents', data={'name': 'Bad'}, files={'file': ('x.txt', b'hello', 'text/plain')})
        assert wrong.json()['error'] == 'UNSUPPORTED_FILE_TYPE'
    finally:
        row = one('DELETE FROM documents WHERE id = $1 RETURNING storage_key', [did])
        if row and row['storage_key']:
            from app.services.storage_service import delete_object
            delete_object(row['storage_key'])
