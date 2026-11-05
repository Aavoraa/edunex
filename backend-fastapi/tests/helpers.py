"""Test helpers (backend/tests/helpers.ts): sign in as a demo account and call the API."""
from __future__ import annotations

import os
from functools import lru_cache

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app, raise_server_exceptions=False, client=('127.0.0.1', 50000))
PASSWORD = os.environ.get('SEED_DEMO_PASSWORD', '')

ACCOUNTS = {
    'principal': 'meera.krishnan.demo@edunex.edu',
    'teacher': 'priya.raghavan.demo@edunex.edu',
    'parent': 'ranjith.kumar.demo@parents.edunex.edu',
    'parent2': 'sudha.raman.demo@parents.edunex.edu',
    'office': 'kavitha.s.demo@edunex.edu',
    'staff': 'murugan.p.demo@edunex.edu',
    'hr': 'lakshmi.n.demo@edunex.edu',
    'finance': 'rajesh.iyer.demo@edunex.edu',
    'superadmin': 'admin.demo@edunex.edu',
    'student': 'aditya.kumar.demo@students.edunex.edu',
}

_cache: dict[str, dict] = {}


def login(who: str) -> dict:
    if who in _cache:
        return _cache[who]
    r = client.post('/api/auth/login', json={'identifier': ACCOUNTS[who], 'password': PASSWORD, 'clientType': 'mobile'})
    if r.status_code != 200:
        raise RuntimeError(f'login {who} failed: {r.status_code} {r.text}')
    d = r.json()['data']
    _cache[who] = {'token': d['accessToken'], 'user': d['user'], 'refreshToken': d['refreshToken']}
    return _cache[who]


class As:
    def __init__(self, token: str):
        self.h = {'Authorization': f'Bearer {token}', 'X-Client-Type': 'mobile'}

    def get(self, path: str, **kw):
        return client.get(path, headers=self.h, **kw)

    def post(self, path: str, body: object | None = None, **kw):
        if 'files' in kw or 'data' in kw:
            return client.post(path, headers=self.h, **kw)
        return client.post(path, headers=self.h, json=body if body is not None else {}, **kw)

    def put(self, path: str, body: object | None = None, **kw):
        return client.put(path, headers=self.h, json=body if body is not None else {}, **kw)

    def patch(self, path: str, body: object | None = None, **kw):
        return client.patch(path, headers=self.h, json=body if body is not None else {}, **kw)

    def delete(self, path: str, **kw):
        return client.delete(path, headers=self.h, **kw)


def as_(who: str) -> As:
    return As(login(who)['token'])
