"""PostgreSQL access (port of backend/src/config/db.ts).

SQL is written exactly as in the Express services: `$1, $2 …` placeholders (psycopg RawCursor) and
parameters sent the way node-pg sends them — as untyped text — so PostgreSQL infers each parameter's
type from the query just as before. Never interpolate user input into the SQL text.

Result values follow node-pg's mapping as configured there: DATE → 'YYYY-MM-DD' string,
NUMERIC/INT8 → numbers, UUID/INET/TIME → strings; timestamptz stays a datetime and is serialised
as an ISO string with milliseconds and 'Z' (app/response.py), like a JS Date.
"""
from __future__ import annotations

import datetime as dt
import decimal
import json
import logging
import uuid
from contextlib import contextmanager
from typing import Any, Iterator, Sequence

import psycopg
from psycopg.adapt import Loader
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from .config import settings

log = logging.getLogger('edunex.db')


class _TextLoader(Loader):
    def load(self, data):  # type: ignore[override]
        return bytes(data).decode()


class _NumberLoader(Loader):
    def load(self, data):  # type: ignore[override]
        s = bytes(data).decode()
        if s in ('NaN', 'Infinity', '-Infinity'):
            return float(s)
        f = float(s)
        return int(f) if f.is_integer() and abs(f) < 2**53 else f


def configure_adapters(ctx: psycopg.abc.AdaptContext) -> None:
    for t in ('date', 'uuid', 'inet', 'cidr', 'time', 'timetz', 'macaddr'):
        ctx.adapters.register_loader(t, _TextLoader)
    ctx.adapters.register_loader('numeric', _NumberLoader)


configure_adapters(psycopg.adapters)


def _array_literal(values: Sequence[Any]) -> str:
    parts = []
    for v in values:
        if v is None:
            parts.append('NULL')
        elif isinstance(v, (list, tuple)):
            parts.append(_array_literal(v))
        elif isinstance(v, (bytes, bytearray)):
            parts.append('"\\\\x' + bytes(v).hex() + '"')
        else:
            s = prepare_value(v)
            parts.append('"' + str(s).replace('\\', '\\\\').replace('"', '\\"') + '"')
    return '{' + ','.join(parts) + '}'


def prepare_value(v: Any) -> Any:
    """node-pg's prepareValue: everything goes to the server as text (bytea stays binary)."""
    if v is None or isinstance(v, (bytes, bytearray, memoryview)):
        return v
    if isinstance(v, bool):
        return 'true' if v else 'false'
    if isinstance(v, (int, float, decimal.Decimal, uuid.UUID)):
        return str(v)
    if isinstance(v, dt.datetime):
        if v.tzinfo is None:
            v = v.replace(tzinfo=dt.timezone.utc)
        return v.isoformat()
    if isinstance(v, dt.date):
        return v.isoformat()
    if isinstance(v, (list, tuple)):
        return _array_literal(v)
    if isinstance(v, dict):
        return json.dumps(v, default=_json_default)
    return str(v)


def _json_default(o: Any) -> Any:
    from .response import to_jsonable
    return to_jsonable(o)


def _conninfo_kwargs() -> dict[str, Any]:
    kw: dict[str, Any] = {}
    if settings.DATABASE_SSL != 'off':
        kw['sslmode'] = 'verify-full' if settings.DATABASE_SSL == 'verify' else 'require'
        if settings.DATABASE_CA_CERT:
            import tempfile
            f = tempfile.NamedTemporaryFile('w', suffix='.pem', delete=False)
            f.write(settings.DATABASE_CA_CERT.replace('\\n', '\n'))
            f.close()
            kw['sslrootcert'] = f.name
    return kw


def _configure(conn: psycopg.Connection) -> None:
    # "Today" is the school's day (docs/ASSUMPTIONS.md): current_date etc. follow the session time zone.
    try:
        conn.execute("SET TIME ZONE 'Asia/Kolkata'")
        conn.commit()
    except Exception as err:  # pragma: no cover
        log.warning('Could not set the session time zone: %s', err)


_pool: ConnectionPool | None = None


def get_pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        _pool = ConnectionPool(
            settings.DATABASE_URL,
            min_size=0,
            max_size=settings.DATABASE_POOL_MAX,
            max_idle=30,
            timeout=15,
            kwargs={'cursor_factory': psycopg.RawCursor, 'row_factory': dict_row, 'autocommit': True,
                    'connect_timeout': 15, **_conninfo_kwargs()},
            configure=_configure,
            check=ConnectionPool.check_connection,
            open=True,
        )
    return _pool


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


Queryable = psycopg.Connection


class Result:
    def __init__(self, rows: list[dict], rowcount: int):
        self.rows = rows
        self.row_count = rowcount


def _run(conn: psycopg.Connection, text: str, params: Sequence[Any] | None) -> Result:
    cur = conn.execute(text, [prepare_value(p) for p in (params or [])])  # type: ignore[arg-type]
    rows = cur.fetchall() if cur.description else []
    return Result(rows, cur.rowcount)


def query(text: str, params: Sequence[Any] | None = None, db: Queryable | None = None) -> Result:
    """Parameterised query. Pass `db` to run inside a transaction from tx()."""
    if db is not None:
        return _run(db, text, params)
    with get_pool().connection() as conn:
        return _run(conn, text, params)


def one(text: str, params: Sequence[Any] | None = None, db: Queryable | None = None) -> dict | None:
    rows = query(text, params, db).rows
    return rows[0] if rows else None


def many(text: str, params: Sequence[Any] | None = None, db: Queryable | None = None) -> list[dict]:
    return query(text, params, db).rows


@contextmanager
def tx() -> Iterator[psycopg.Connection]:
    """Runs the block inside a transaction; rolls back on any exception."""
    with get_pool().connection() as conn:
        with conn.transaction():
            yield conn
