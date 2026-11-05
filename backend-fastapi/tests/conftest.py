"""Tests run against a separate database (TEST_DATABASE_URL), never the dev one — as backend/vitest.config.ts.

Seed it first (from the repo root): npm run db:reset with DATABASE_URL pointing at the test database,
or the same way the Express suite is prepared.
"""
import os
import re
from pathlib import Path

_root = Path(__file__).resolve().parents[2]
_env = {}
if (_root / '.env').exists():
    for line in (_root / '.env').read_text(encoding='utf-8').splitlines():
        m = re.match(r'^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$', line)
        if m and not line.lstrip().startswith('#'):
            _env[m.group(1)] = re.sub(r'^([\'"])(.*)\1$', r'\2', m.group(2))
for k, val in _env.items():
    os.environ.setdefault(k, val)
os.environ['NODE_ENV'] = 'test'
os.environ['DATABASE_URL'] = _env.get('TEST_DATABASE_URL') or re.sub(r'/([^/?]+)(\?|$)', r'/\1_test\2', _env.get('DATABASE_URL', ''), count=1)
os.environ['CRON_SECRET'] = 'test-cron-secret-0123456789'
os.environ.pop('EXPRESS_FALLBACK_URL', None)
