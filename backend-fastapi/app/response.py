"""Response envelope { success, data, message, meta? } (utils/response.ts) and JS-compatible JSON."""
from __future__ import annotations

import base64
import datetime as dt
import decimal
import json
import math
import uuid
from typing import Any

from starlette.responses import Response


def iso_js(d: dt.datetime) -> str:
    """Like JS Date.prototype.toISOString(): UTC, milliseconds, 'Z'."""
    if d.tzinfo is None:
        d = d.replace(tzinfo=dt.timezone.utc)
    d = d.astimezone(dt.timezone.utc)
    return d.strftime('%Y-%m-%dT%H:%M:%S.') + f'{d.microsecond // 1000:03d}Z'


def _interval(td: dt.timedelta) -> dict:
    # node-pg's postgres-interval JSON shape.
    out: dict[str, int] = {}
    secs = int(td.total_seconds())
    sign = -1 if secs < 0 else 1
    secs = abs(secs)
    d, rem = divmod(secs, 86400)
    h, rem = divmod(rem, 3600)
    m, s = divmod(rem, 60)
    for k, v in (('days', d), ('hours', h), ('minutes', m), ('seconds', s)):
        if v:
            out[k] = sign * v
    return out


def to_jsonable(o: Any) -> Any:
    if o is None or isinstance(o, (str, bool)):
        return o
    if isinstance(o, int):
        return o
    if isinstance(o, float):
        if math.isnan(o) or math.isinf(o):
            return None  # JSON.stringify(NaN) → null
        return int(o) if o.is_integer() and abs(o) < 2**53 else o
    if isinstance(o, dict):
        return {str(k): to_jsonable(v) for k, v in o.items() if v is not _UNDEFINED}
    if isinstance(o, (list, tuple, set, frozenset)):
        return [to_jsonable(v) for v in o]
    if isinstance(o, dt.datetime):
        return iso_js(o)
    if isinstance(o, dt.date):
        return o.isoformat()
    if isinstance(o, dt.time):
        return o.isoformat()
    if isinstance(o, dt.timedelta):
        return _interval(o)
    if isinstance(o, decimal.Decimal):
        return to_jsonable(float(o))
    if isinstance(o, uuid.UUID):
        return str(o)
    if isinstance(o, (bytes, bytearray, memoryview)):
        # JSON.stringify(Buffer) → { type: 'Buffer', data: [...] }
        return {'type': 'Buffer', 'data': list(bytes(o))}
    if hasattr(o, 'model_dump'):
        return to_jsonable(o.model_dump())
    return str(o)


class _Undefined:
    """Marker for 'leave this key out', like a JS property that is undefined."""

    def __repr__(self) -> str:
        return 'UNDEFINED'


_UNDEFINED = UNDEFINED = _Undefined()


def dumps(o: Any) -> bytes:
    return json.dumps(to_jsonable(o), ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode('utf-8')


class JSONResponse(Response):
    media_type = 'application/json; charset=utf-8'

    def render(self, content: Any) -> bytes:
        return dumps(content)


def ok(data: Any, message: str = 'OK', meta: dict | None = None, status: int = 200) -> JSONResponse:
    body: dict[str, Any] = {'success': True, 'data': data, 'message': message}
    if meta:
        body['meta'] = meta
    return JSONResponse(body, status_code=status)


def created(data: Any, message: str = 'Created') -> JSONResponse:
    return JSONResponse({'success': True, 'data': data, 'message': message}, status_code=201)


def paged(rows: list, total: int, page: int, page_size: int, message: str = 'OK') -> JSONResponse:
    return ok(rows, message, {'page': page, 'pageSize': page_size, 'total': total,
                              'totalPages': max(1, math.ceil(total / page_size))})


def fail(status: int, message: str, error: str, **extra: Any) -> JSONResponse:
    return JSONResponse({'success': False, 'message': message, 'error': error, **extra}, status_code=status)


def b64(data: bytes) -> str:
    return base64.b64encode(data).decode()
