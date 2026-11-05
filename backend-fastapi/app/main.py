"""Edunex main API — FastAPI port of backend/src (app.ts, server.ts, vercel.ts).

Local:   uvicorn app.main:app --port 4000 --reload   (npm run dev does this)
Vercel:  the `api` service (vercel.json, framework fastapi) imports `app` from this module.

When the environment is missing or invalid on Vercel, a stand-in app answers every request with 503
and the names of the settings to fix (never their values) instead of the function crashing.
"""
from __future__ import annotations

import logging
import os

logging.basicConfig(level=os.environ.get('LOG_LEVEL', 'info').upper() if os.environ.get('LOG_LEVEL', 'info') != 'silent' else 'CRITICAL',
                    format='%(asctime)s %(levelname)s %(name)s: %(message)s')
log = logging.getLogger('edunex')


def _fallback_app(message: str):
    from starlette.applications import Starlette
    from starlette.responses import JSONResponse
    from starlette.routing import Route

    async def not_configured(_request):
        return JSONResponse({'success': False, 'error': 'SERVER_NOT_CONFIGURED', 'message': message}, status_code=503)

    return Starlette(routes=[Route('/{path:path}', not_configured, methods=['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])])


def _load():
    try:
        from .app_factory import create_app
        return create_app()
    except Exception as err:  # noqa: BLE001
        issues = getattr(err, 'issues', None)
        on_vercel = bool(os.environ.get('VERCEL'))
        if type(err).__name__ == 'ConfigError' and isinstance(issues, list):
            print('Invalid environment configuration:\n' + '\n'.join(f'  - {i}' for i in err.issues) + '\nSee .env.example.')
        if not on_vercel:
            raise
        message = (f"The server is not configured. In Vercel, set or fix these environment variables, then redeploy: {'; '.join(issues)}"
                   if isinstance(issues, list) else 'The server failed to start. See the function logs in Vercel.')
        log.error(message, exc_info=not isinstance(issues, list))
        return _fallback_app(message)


app = _load()
