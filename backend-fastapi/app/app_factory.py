"""Builds the FastAPI app (port of backend/src/app.ts)."""
from __future__ import annotations

import hmac
import logging
import uuid

import httpx
from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from starlette.requests import Request
from starlette.responses import Response
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from .config import settings
from .db import close_pool, query
from .errors import AppError, unauthorized
from .http import Req, error_response, read_body, run_chain
from .response import JSONResponse, fail, ok

log = logging.getLogger('edunex.app')

# helmet() defaults plus the CSP directives app.ts sets.
CSP = ("default-src 'self';base-uri 'self';font-src 'self' https: data:;form-action 'self';frame-ancestors 'self';"
       "img-src 'self' data:;object-src 'none';script-src 'self';script-src-attr 'none';style-src 'self' 'unsafe-inline';"
       "upgrade-insecure-requests")
SECURITY_HEADERS = [
    (b'content-security-policy', CSP.encode()),
    (b'cross-origin-opener-policy', b'same-origin'),
    (b'cross-origin-resource-policy', b'same-site'),
    (b'origin-agent-cluster', b'?1'),
    # OpenStreetMap's tile servers refuse requests without a Referer; send only the origin elsewhere.
    (b'referrer-policy', b'strict-origin-when-cross-origin'),
    (b'strict-transport-security', b'max-age=31536000; includeSubDomains'),
    (b'x-content-type-options', b'nosniff'),
    (b'x-dns-prefetch-control', b'off'),
    (b'x-download-options', b'noopen'),
    (b'x-frame-options', b'SAMEORIGIN'),
    (b'x-permitted-cross-domain-policies', b'none'),
    (b'x-xss-protection', b'0'),
]


class SecurityHeaders:
    """helmet + request id (x-request-id echoed or generated)."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope['type'] != 'http':
            await self.app(scope, receive, send)
            return
        rid = None
        for k, val in scope.get('headers', []):
            if k == b'x-request-id':
                rid = val.decode('latin-1')
                break
        rid = rid or str(uuid.uuid4())
        scope.setdefault('state', {})['request_id'] = rid

        async def wrapped(message: Message) -> None:
            if message['type'] == 'http.response.start':
                headers = [(k, val) for k, val in message.get('headers', []) if k.lower() not in (b'server', b'x-powered-by')]
                present = {k.lower() for k, _ in headers}
                for k, val in SECURITY_HEADERS:
                    if k not in present:
                        headers.append((k, val))
                headers.append((b'x-request-id', rid.encode('latin-1')))
                message['headers'] = headers
            await send(message)

        await self.app(scope, receive, wrapped)


def _api_routes():
    from .routes.index import api
    return api


def create_app() -> FastAPI:
    from .middleware.auth import authenticate
    from .middleware.security import api_limiter, no_store

    app = FastAPI(title='Edunex API', docs_url=None, redoc_url=None, openapi_url=None)

    # Order: the last added runs first. Security headers wrap everything, CORS answers preflights.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        allow_headers=['Content-Type', 'Authorization', 'X-Client-Type', 'X-Request-Id'],
        expose_headers=['X-Request-Id'],
        max_age=600,
    )
    app.add_middleware(SecurityHeaders)

    @app.get('/api/health', include_in_schema=False)
    def health() -> Response:
        try:
            query('SELECT 1')
        except Exception:  # noqa: BLE001
            return fail(503, 'Database unavailable', 'DB_DOWN')
        import datetime as dt
        return ok({'status': 'ok', 'database': 'up', 'time': dt.datetime.now(dt.timezone.utc)}, 'Healthy')

    # Scheduled work on Vercel (vercel.json "crons"): called with "Authorization: Bearer <CRON_SECRET>".
    @app.get('/api/internal/cron/notifications', include_in_schema=False)
    def cron_notifications(request: Request) -> Response:
        expected = f"Bearer {settings.CRON_SECRET or ''}".encode()
        given = (request.headers.get('authorization') or '').encode()
        if not settings.CRON_SECRET or not hmac.compare_digest(given, expected):
            return fail(401, 'Unauthorized', 'UNAUTHORIZED')
        from .services.notification_service import dispatch_pending
        try:
            return ok({'sent': dispatch_pending()}, 'Notifications dispatched')
        except Exception as err:  # noqa: BLE001
            return error_response(err, request.url.path, request.method)

    try:
        from .routes.docs_routes import mount_docs
        mount_docs(app)
    except ImportError:
        pass

    from .http import mount
    mount(app, _api_routes(), '/api', [api_limiter, no_store])

    # Unknown /api routes. While the port is in progress, EXPRESS_FALLBACK_URL forwards them to the
    # Express API (which then answers, 404 included); otherwise they get Express's 404 — after the
    # rate limit, no-store and authentication steps every /api request passes through there.
    proxy = httpx.AsyncClient(base_url=settings.EXPRESS_FALLBACK_URL, timeout=120) if settings.EXPRESS_FALLBACK_URL else None

    async def not_found(request: Request) -> Response:
        if proxy is not None:
            return await _forward(proxy, request)
        req: Req | None = None
        try:
            body, files = await read_body(request)
            req = Req(request, body, files, {})
            path = request.url.path[len('/api'):] or '/'

            def chain(r: Req) -> Response:
                return fail(404, f'Route {request.method} {path} not found', 'ROUTE_NOT_FOUND')
            from starlette.concurrency import run_in_threadpool
            response = await run_in_threadpool(run_chain, req, [api_limiter, no_store, authenticate, chain])
        except Exception as err:  # noqa: BLE001
            response = error_response(err, request.url.path, request.method)
        if req is not None:
            req.res.apply(response)
        return response

    app.add_route('/api', not_found, methods=['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], include_in_schema=False)
    app.add_route('/api/{rest:path}', not_found, methods=['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], include_in_schema=False)

    @app.exception_handler(AppError)
    async def _app_error(request: Request, err: AppError) -> Response:
        return error_response(err, request.url.path, request.method)

    @app.exception_handler(404)
    async def _nf(request: Request, _err: Exception) -> Response:
        return fail(404, f'Route {request.method} {request.url.path} not found', 'ROUTE_NOT_FOUND')

    @app.exception_handler(405)
    async def _na(request: Request, _err: Exception) -> Response:
        return await not_found(request)

    @app.on_event('shutdown')
    async def _shutdown() -> None:
        if proxy is not None:
            await proxy.aclose()
        close_pool()

    return app


_HOP = {'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailers', 'transfer-encoding',
        'upgrade', 'content-length', 'content-encoding', 'host'}


async def _forward(client: httpx.AsyncClient, request: Request) -> Response:
    headers = {k: val for k, val in request.headers.items() if k.lower() not in _HOP}
    if request.client:
        headers['x-forwarded-for'] = request.client.host
    try:
        upstream = await client.request(request.method, request.url.path + (('?' + request.url.query) if request.url.query else ''),
                                        headers=headers, content=await request.body())
    except httpx.HTTPError as err:
        log.warning('Express fallback unreachable: %s', err)
        return fail(502, 'The Express API (fallback for routes not yet ported) is not reachable', 'FALLBACK_DOWN')
    out = Response(upstream.content, status_code=upstream.status_code)
    for k, val in upstream.headers.multi_items():
        if k.lower() not in _HOP:
            out.headers.append(k, val)
    return out


__all__ = ['create_app', 'unauthorized', 'JSONResponse']
