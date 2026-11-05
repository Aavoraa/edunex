"""Validated runtime configuration (port of backend/src/config/env.ts).

The process refuses to start with a missing or weak secret rather than falling back to an
insecure default. On Vercel a ConfigError is raised instead, so the function can answer with
what is missing (app/vercel.py).
"""
from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def _load_env_file(path: Path) -> None:
    """Like node's --env-file-if-exists: values already in the environment win."""
    if not path.exists():
        return
    for line in path.read_text(encoding='utf-8').splitlines():
        m = re.match(r'^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$', line)
        if not m or line.lstrip().startswith('#'):
            continue
        k, v = m.group(1), m.group(2)
        v = re.sub(r'^([\'"])(.*)\1$', r'\2', v)
        os.environ.setdefault(k, v)


class ConfigError(Exception):
    def __init__(self, issues: list[str]):
        super().__init__('Invalid environment configuration: ' + '; '.join(issues))
        self.issues = issues


def _parse_ttl_seconds(v: str) -> int:
    """jsonwebtoken / ms style durations: '15m', '1h', '7d', '900' (seconds)."""
    m = re.fullmatch(r'\s*(\d+(?:\.\d+)?)\s*(ms|s|m|h|d|w|y)?\s*', v or '')
    if not m:
        raise ValueError('invalid duration')
    n = float(m.group(1))
    unit = m.group(2) or 's'
    mult = {'ms': 0.001, 's': 1, 'm': 60, 'h': 3600, 'd': 86400, 'w': 604800, 'y': 31557600}[unit]
    return int(n * mult)


@dataclass
class Settings:
    NODE_ENV: str = 'development'
    PORT: int = 4000
    DATABASE_URL: str = ''
    DATABASE_POOL_MAX: int = 10
    DATABASE_SSL: str = 'off'
    DATABASE_CA_CERT: str | None = None
    JWT_SECRET: str = ''
    JWT_REFRESH_SECRET: str = ''
    JWT_ACCESS_TTL: str = '15m'
    JWT_REFRESH_TTL_DAYS: int = 7
    JWT_ISSUER: str = 'edunex-api'
    JWT_AUDIENCE: str = 'edunex-clients'
    CORS_ORIGINS: str = 'http://localhost:5173'
    COOKIE_SECURE: bool = False
    COOKIE_DOMAIN: str | None = None
    RATE_LIMIT_WINDOW_MS: int = 15 * 60 * 1000
    RATE_LIMIT_MAX: int = 3000
    AUTH_RATE_LIMIT_MAX: int = 20
    STORAGE_DRIVER: str = 'local'
    UPLOAD_DIR: str = './uploads'
    S3_BUCKET: str | None = None
    S3_REGION: str = 'auto'
    S3_ENDPOINT: str | None = None
    S3_ACCESS_KEY_ID: str | None = None
    S3_SECRET_ACCESS_KEY: str | None = None
    S3_FORCE_PATH_STYLE: bool = False
    CRON_SECRET: str | None = None
    UPLOAD_MAX_MB: float = 10
    LOCATION_INTERVAL_SECONDS: int = 30
    ONLINE_THRESHOLD_SECONDS: int = 120
    OFFLINE_THRESHOLD_SECONDS: int = 600
    LOCATION_MAX_FUTURE_SECONDS: int = 300
    LOCATION_MAX_AGE_HOURS: int = 72
    DEVICE_RATE_LIMIT_PER_MINUTE: int = 30
    MAP_API_KEY: str | None = None
    MAP_TILE_URL: str = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
    SEED_DEMO_PASSWORD: str | None = None
    WHATSAPP_PROVIDER: str = 'gateway'
    WHATSAPP_API_URL: str | None = None
    WHATSAPP_API_TOKEN: str | None = None
    WHATSAPP_TEMPLATE_NAME: str | None = None
    WHATSAPP_TEMPLATE_LANG: str = 'en'
    WHATSAPP_DEFAULT_COUNTRY_CODE: str = '91'
    SMS_API_URL: str | None = None
    SMS_API_KEY: str | None = None
    SMTP_URL: str | None = None
    PUSH_FCM_SERVER_KEY: str | None = None
    EXAM_VISION_URL: str | None = None
    EXAM_VISION_SECRET: str | None = None
    LOG_LEVEL: str = 'info'
    # Strangler fallback while the port is in progress: unported /api routes are forwarded here.
    EXPRESS_FALLBACK_URL: str | None = None

    on_vercel: bool = False
    cors_origins: list[str] = field(default_factory=list)
    access_ttl_seconds: int = 900

    @property
    def is_prod(self) -> bool:
        return self.NODE_ENV == 'production'

    @property
    def is_test(self) -> bool:
        return self.NODE_ENV == 'test'


_INT = {'PORT', 'DATABASE_POOL_MAX', 'JWT_REFRESH_TTL_DAYS', 'RATE_LIMIT_WINDOW_MS', 'RATE_LIMIT_MAX',
        'AUTH_RATE_LIMIT_MAX', 'LOCATION_INTERVAL_SECONDS', 'ONLINE_THRESHOLD_SECONDS', 'OFFLINE_THRESHOLD_SECONDS',
        'LOCATION_MAX_FUTURE_SECONDS', 'LOCATION_MAX_AGE_HOURS', 'DEVICE_RATE_LIMIT_PER_MINUTE'}
_BOOL = {'COOKIE_SECURE', 'S3_FORCE_PATH_STYLE'}
_ENUMS = {
    'NODE_ENV': ('development', 'test', 'production'),
    'DATABASE_SSL': ('off', 'require', 'verify'),
    'STORAGE_DRIVER': ('local', 's3'),
    'WHATSAPP_PROVIDER': ('gateway', 'meta'),
    'LOG_LEVEL': ('fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'),
}
_TRUE = {'true', '1', 'yes', 'on', 'y', 'enabled'}
_FALSE = {'false', '0', 'no', 'off', 'n', 'disabled'}


def load_settings(environ: dict[str, str] | None = None) -> Settings:
    if environ is None:
        _load_env_file(ROOT / '.env')
        environ = dict(os.environ)
    on_vercel = bool(environ.get('VERCEL'))
    s = Settings(on_vercel=on_vercel)
    if on_vercel:
        s.DATABASE_POOL_MAX = 3
        s.DATABASE_SSL = 'require'
        s.UPLOAD_DIR = '/tmp/uploads'
    issues: list[str] = []

    for name in Settings.__dataclass_fields__:
        if not name.isupper():
            continue
        raw = environ.get(name)
        if name in ('S3_ENDPOINT', 'EXAM_VISION_URL') and raw == '':
            raw = None
        if raw is None or (raw == '' and name not in ('COOKIE_DOMAIN',)):
            continue
        try:
            if name in _INT:
                val: object = int(float(raw))
                if float(raw) != int(float(raw)):
                    raise ValueError
                if val <= 0 and name not in ('LOCATION_MAX_FUTURE_SECONDS',):
                    raise ValueError
            elif name == 'UPLOAD_MAX_MB':
                val = float(raw)
                if val <= 0:
                    raise ValueError
            elif name in _BOOL:
                low = raw.strip().lower()
                if low not in _TRUE | _FALSE:
                    raise ValueError
                val = low in _TRUE
            else:
                val = raw
            if name in _ENUMS and val not in _ENUMS[name]:
                issues.append(f"{name}: Invalid option: expected one of {'|'.join(_ENUMS[name])}")
                continue
            setattr(s, name, val)
        except ValueError:
            issues.append(f'{name}: Invalid value')

    if not s.DATABASE_URL:
        s.DATABASE_URL = environ.get('POSTGRES_URL') or ''
    if not s.DATABASE_URL:
        issues.append('DATABASE_URL: DATABASE_URL is required')
    if len(s.JWT_SECRET) < 32:
        issues.append('JWT_SECRET: JWT_SECRET must be at least 32 characters')
    if len(s.JWT_REFRESH_SECRET) < 32:
        issues.append('JWT_REFRESH_SECRET: JWT_REFRESH_SECRET must be at least 32 characters')
    if s.CRON_SECRET is not None and len(s.CRON_SECRET) < 16:
        issues.append('CRON_SECRET: CRON_SECRET must be at least 16 characters')
    if not re.fullmatch(r'\d{1,3}', s.WHATSAPP_DEFAULT_COUNTRY_CODE):
        issues.append('WHATSAPP_DEFAULT_COUNTRY_CODE: Invalid string')
    if s.OFFLINE_THRESHOLD_SECONDS <= s.ONLINE_THRESHOLD_SECONDS:
        issues.append('OFFLINE_THRESHOLD_SECONDS: must be greater than ONLINE_THRESHOLD_SECONDS')
    if not (5 <= s.LOCATION_INTERVAL_SECONDS <= 3600):
        issues.append('LOCATION_INTERVAL_SECONDS: must be between 5 and 3600')
    if s.STORAGE_DRIVER == 's3':
        for k in ('S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'):
            if not getattr(s, k):
                issues.append(f'{k}: is required when STORAGE_DRIVER=s3')
    if s.EXAM_VISION_URL and not on_vercel and len(s.EXAM_VISION_SECRET or '') < 32:
        issues.append('EXAM_VISION_SECRET: must be at least 32 characters when EXAM_VISION_URL is set')
    try:
        s.access_ttl_seconds = _parse_ttl_seconds(s.JWT_ACCESS_TTL)
    except ValueError:
        issues.append('JWT_ACCESS_TTL: Invalid duration')

    if issues:
        raise ConfigError(issues)

    s.cors_origins = [o.strip() for o in s.CORS_ORIGINS.split(',') if o.strip()] + [
        f'https://{h}' for h in (environ.get('VERCEL_PROJECT_PRODUCTION_URL'), environ.get('VERCEL_URL'),
                                 environ.get('VERCEL_BRANCH_URL')) if h
    ]
    return s


settings = load_settings()
