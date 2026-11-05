"""Express-style routing on top of FastAPI/Starlette.

The Express API is a chain of middleware per route (rate limit → no-store → authenticate →
permission → validate → handler). Porting it as the same chain keeps the order of checks — and so
every status code the tests and the frontend rely on — identical:

    r = Router()
    r.post('/login', auth_limiter, validate(login_schema), c.login)

Middleware and handlers are plain sync functions taking `req: Req`. A middleware returns None to
continue (or raises AppError); a handler returns a Starlette Response. Chains run in a worker thread,
so blocking psycopg calls never stall the event loop. Headers and cookies set on `req.res` reach the
final response, error responses included (as with Express's res.set / res.clearCookie before a throw).
"""
from __future__ import annotations

import json
import logging
import re
import urllib.parse
from dataclasses import dataclass, field
from email.utils import format_datetime
from typing import Any, Callable, Iterable

import psycopg
from starlette.concurrency import run_in_threadpool
from starlette.requests import Request
from starlette.responses import Response

from .config import settings
from .errors import AppError, bad_request
from .response import UNDEFINED, JSONResponse, fail

log = logging.getLogger('edunex.http')

JSON_LIMIT = 1024 * 1024
FORM_LIMIT = 100 * 1024


# ---------------------------------------------------------------------------------------------
# Request / response context
# ---------------------------------------------------------------------------------------------
@dataclass
class UploadedFile:
    """multer's memory-storage file: fieldname, originalname, mimetype, size, buffer."""
    fieldname: str
    originalname: str
    mimetype: str
    buffer: bytes

    @property
    def size(self) -> int:
        return len(self.buffer)


@dataclass
class ResState:
    headers: dict[str, str] = field(default_factory=dict)
    cookies: list[str] = field(default_factory=list)

    def set(self, name: str, value: str) -> None:
        self.headers[name] = value

    def cookie(self, name: str, value: str, *, http_only: bool = False, secure: bool = False, same_site: str | None = None,
               path: str = '/', domain: str | None = None, expires: Any = None) -> None:
        parts = [f'{name}={urllib.parse.quote(value, safe="")}']
        if domain:
            parts.append(f'Domain={domain}')
        parts.append(f'Path={path}')
        if expires is not None:
            parts.append('Expires=' + format_datetime(expires, usegmt=True))
        if http_only:
            parts.append('HttpOnly')
        if secure:
            parts.append('Secure')
        if same_site:
            parts.append('SameSite=' + same_site.capitalize())
        self.cookies.append('; '.join(parts))

    def clear_cookie(self, name: str, **opts: Any) -> None:
        import datetime as dt
        opts = {k: v for k, v in opts.items() if k != 'expires'}
        self.cookie(name, '', expires=dt.datetime(1970, 1, 1, tzinfo=dt.timezone.utc), **opts)

    def apply(self, response: Response) -> Response:
        for k, v in self.headers.items():
            if k.lower() not in response.headers:
                response.headers[k] = v
        for c in self.cookies:
            response.headers.append('set-cookie', c)
        return response


class Req:
    def __init__(self, request: Request, body: Any, files: list[UploadedFile], params: dict[str, str]):
        self.request = request
        self.method = request.method
        self.url = str(request.url)
        self.original_url = request.url.path + (('?' + request.url.query) if request.url.query else '')
        self.path = request.url.path
        self.headers = request.headers
        self.body = body
        self.files = files
        self.file: UploadedFile | None = None
        self.params = params
        self.query = parse_query(request.url.query)
        self.cookies = request.cookies
        self.valid: dict[str, Any] = {}
        self.user: Any = None
        self.res = ResState()
        self.state: dict[str, Any] = {}
        self.request_id: str | None = getattr(request.state, 'request_id', None)

    def get(self, name: str) -> str | None:
        return self.headers.get(name)

    @property
    def ip(self) -> str | None:
        ip = None
        if settings.on_vercel:
            fwd = self.headers.get('x-forwarded-for')
            if fwd:
                ip = fwd.split(',')[0].strip()
        if not ip and self.request.client:
            ip = self.request.client.host
        if ip and ip.startswith('::ffff:'):
            ip = ip[7:]
        if ip:
            import ipaddress
            try:
                ipaddress.ip_address(ip)
            except ValueError:
                return None
        return ip


def v(req: Req, source: str = 'body') -> Any:
    """The validated (and coerced) part of the request — never the raw input."""
    return req.valid.get(source, {})


def parse_query(qs: str) -> dict[str, Any]:
    """Express 5's 'simple' query parser (node querystring): repeated keys become arrays."""
    out: dict[str, Any] = {}
    for k, val in urllib.parse.parse_qsl(qs, keep_blank_values=True):
        if k in out:
            out[k] = (out[k] if isinstance(out[k], list) else [out[k]]) + [val]
        else:
            out[k] = val
    return out


# ---------------------------------------------------------------------------------------------
# Body parsing (express.json / express.urlencoded / sanitizeBody / multer memory storage)
# ---------------------------------------------------------------------------------------------
_CONTROL = re.compile('[\x00-\x08\x0b-\x1f\x7f]')


def clean(value: Any, depth: int = 0) -> Any:
    """Strips C0 control characters (except tab/newline) and trims strings, recursively."""
    if depth > 8:
        return value
    if isinstance(value, str):
        return _CONTROL.sub('', value).strip(' \t\n\r\x0b\x0c ﻿                　')
    if isinstance(value, list):
        return [clean(x, depth + 1) for x in value]
    if isinstance(value, dict):
        return {k: clean(x, depth + 1) for k, x in value.items() if k not in ('__proto__', 'constructor', 'prototype')}
    return value


async def read_body(request: Request) -> tuple[Any, list[UploadedFile]]:
    if request.method in ('GET', 'HEAD', 'OPTIONS', 'DELETE') and not request.headers.get('content-length') \
            and not request.headers.get('transfer-encoding'):
        return UNDEFINED, []
    full_ctype = request.headers.get('content-type') or ''
    ctype = full_ctype.split(';')[0].strip().lower()
    m = re.search(r'charset\s*=\s*"?([^";\s]+)', full_ctype, re.I)
    charset = m.group(1).lower() if m else None
    if ctype == 'application/json' or (ctype.startswith('application/') and ctype.endswith('+json')):
        if charset and not charset.startswith('utf-'):
            raise AppError(415, 'BAD_REQUEST', f'unsupported charset "{charset.upper()}"')
        raw = await request.body()
        if len(raw) > JSON_LIMIT:
            raise AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body too large')
        if not raw.strip():
            return {}, []
        try:
            data = json.loads(raw)
        except (ValueError, UnicodeDecodeError):
            raise AppError(400, 'INVALID_JSON', 'Malformed JSON body')
        if not isinstance(data, (dict, list)):  # body-parser strict mode
            raise AppError(400, 'INVALID_JSON', 'Malformed JSON body')
        return (clean(data) if isinstance(data, dict) else data), []
    if ctype == 'application/x-www-form-urlencoded':
        raw = await request.body()
        if len(raw) > FORM_LIMIT:
            raise AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body too large')
        return clean(parse_query(raw.decode('utf-8', 'replace'))), []
    if ctype == 'multipart/form-data':
        limit = int(settings.UPLOAD_MAX_MB * 1024 * 1024)
        try:
            form = await request.form(max_files=10, max_fields=200)
        except Exception as err:
            raise AppError(400, 'BAD_REQUEST', f'Malformed multipart body: {err}')
        body: dict[str, Any] = {}
        files: list[UploadedFile] = []
        for k, val in form.multi_items():
            if hasattr(val, 'read'):
                data = await val.read()
                if len(data) > limit:
                    raise AppError(400, 'UPLOAD_LIMIT_FILE_SIZE', 'File too large')
                files.append(UploadedFile(k, val.filename or '', val.content_type or 'application/octet-stream', data))
            else:
                if k in body:
                    body[k] = (body[k] if isinstance(body[k], list) else [body[k]]) + [val]
                else:
                    body[k] = val
        return clean(body), files
    return UNDEFINED, []


# ---------------------------------------------------------------------------------------------
# Errors (middleware/error.ts)
# ---------------------------------------------------------------------------------------------
PG_MAP = {
    '23505': (409, 'DUPLICATE', 'A record with the same unique value already exists'),
    '23503': (409, 'REFERENCE_CONFLICT', 'The record is referenced by, or references, a missing record'),
    '23514': (400, 'CONSTRAINT_VIOLATION', 'A value is outside the allowed range'),
    '22P02': (400, 'INVALID_INPUT', 'A value has an invalid format'),
    '22007': (400, 'INVALID_DATE', 'A date value is invalid'),
    '22008': (400, 'INVALID_DATE', 'A date value is out of range'),
}


def error_response(err: BaseException, req_path: str = '', method: str = '') -> Response:
    if isinstance(err, AppError):
        if err.status >= 500:
            log.error('%s %s', req_path, err.message)
        extra = {'details': err.details} if err.details else {}
        return fail(err.status, err.message, err.code, **extra)
    if isinstance(err, psycopg.Error):
        code = getattr(err, 'sqlstate', None)
        if code in PG_MAP:
            status, c, msg = PG_MAP[code]
            log.warning('database constraint %s on %s: %s', code, req_path, getattr(getattr(err, 'diag', None), 'message_detail', ''))
            return fail(status, msg, c)
    log.exception('unhandled error on %s %s', method, req_path, exc_info=err)
    extra = {} if settings.is_prod else {'debug': str(err)}
    return fail(500, 'Something went wrong. Please try again.', 'INTERNAL_ERROR', **extra)


# ---------------------------------------------------------------------------------------------
# Validation middleware (middleware/validate.ts)
# ---------------------------------------------------------------------------------------------
def validate(schema: Any, source: str = 'body') -> Callable[[Req], None]:
    def mw(req: Req) -> None:
        raw = getattr(req, source)
        ok, result = schema.safeParse(raw)
        if not ok:
            details = [{'field': '.'.join(str(p) for p in i['path']), 'message': i['message']} for i in result.issues]
            raise bad_request('Validation failed', 'VALIDATION_ERROR', details)
        req.valid[source] = result
    mw.__name__ = f'validate_{source}'
    return mw


# ---------------------------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------------------------
Step = Callable[[Req], Any]


@dataclass
class Route:
    method: str
    path: str
    chain: list[Step]


class Router:
    def __init__(self) -> None:
        self.entries: list[tuple[str, Any]] = []  # ('route', Route) | ('use', (prefix, [steps], Router|None))

    def _add(self, method: str, path: str, *chain: Step) -> None:
        self.entries.append(('route', Route(method, path, list(chain))))

    def get(self, path: str, *chain: Step) -> None:
        self._add('GET', path, *chain)

    def post(self, path: str, *chain: Step) -> None:
        self._add('POST', path, *chain)

    def put(self, path: str, *chain: Step) -> None:
        self._add('PUT', path, *chain)

    def patch(self, path: str, *chain: Step) -> None:
        self._add('PATCH', path, *chain)

    def delete(self, path: str, *chain: Step) -> None:
        self._add('DELETE', path, *chain)

    def use(self, *args: Any) -> None:
        """use(mw) / use('/prefix', router) / use('/prefix', mw, router) — like Express."""
        prefix = '/'
        if args and isinstance(args[0], str):
            prefix, args = args[0], args[1:]
        steps = [a for a in args if not isinstance(a, Router)]
        routers = [a for a in args if isinstance(a, Router)]
        self.entries.append(('use', (prefix, steps, routers[0] if routers else None)))

    def flatten(self, base: str = '', pre: list[Step] | None = None) -> list[Route]:
        """All routes with full paths and their complete middleware chains, in Express order.

        A path-less use(mw) applies to every route registered after it, at any prefix (as in Express,
        where `api.use(authenticate)` runs for every request reaching that point)."""
        pre = list(pre or [])
        out: list[Route] = []
        for kind, item in self.entries:
            if kind == 'route':
                out.append(Route(item.method, _join(base, item.path), pre + item.chain))
            else:
                prefix, steps, router = item
                if router is None:
                    if prefix == '/':
                        pre = pre + steps
                    else:
                        # Prefix-scoped middleware: applies to later routes under that prefix.
                        pre = pre + [_scoped(_join(base, prefix), s) for s in steps]
                else:
                    out.extend(router.flatten(_join(base, prefix), pre + steps))
        return out


def _scoped(prefix: str, step: Step) -> Step:
    def mw(req: Req) -> Any:
        if req.path == prefix or req.path.startswith(prefix.rstrip('/') + '/'):
            return step(req)
        return None
    return mw


def _join(a: str, b: str) -> str:
    p = (a.rstrip('/') + '/' + b.lstrip('/')) if b not in ('', '/') else (a or '/')
    return p if p == '/' else p.rstrip('/') or '/'


_PARAM = re.compile(r':([A-Za-z_][A-Za-z0-9_]*)')


def to_starlette_path(path: str) -> str:
    return _PARAM.sub(lambda m: '{' + m.group(1) + '}', path)


def run_chain(req: Req, chain: Iterable[Step]) -> Response:
    for step in chain:
        out = step(req)
        if isinstance(out, Response):
            return out
    raise AppError(500, 'INTERNAL_ERROR', 'Route ended without a response')


def make_endpoint(chain: list[Step]) -> Callable[[Request], Any]:
    async def endpoint(request: Request) -> Response:
        req: Req | None = None
        try:
            body, files = await read_body(request)
            req = Req(request, body, files, dict(request.path_params))
            response = await run_in_threadpool(run_chain, req, chain)
        except Exception as err:  # noqa: BLE001
            response = error_response(err, request.url.path, request.method)
        if req is not None:
            req.res.apply(response)
        return response
    return endpoint


def mount(app: Any, router: Router, base: str = '', pre: list[Step] | None = None) -> list[Route]:
    routes = router.flatten(base, pre)
    for r in routes:
        app.add_route(to_starlette_path(r.path), make_endpoint(r.chain), methods=[r.method], include_in_schema=False)
    return routes


__all__ = ['Req', 'Router', 'validate', 'v', 'UploadedFile', 'mount', 'error_response', 'JSONResponse', 'read_body',
           'run_chain', 'Route']
