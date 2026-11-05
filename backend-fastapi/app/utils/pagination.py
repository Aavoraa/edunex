"""Pagination helpers (utils/pagination.ts)."""
from __future__ import annotations

import re

from ..z import z

pagination_schema = z.object({
    'page': z.coerce.number().int().min(1).default(1),
    'pageSize': z.coerce.number().int().min(1).max(200).default(25),
    'q': z.string().trim().max(100).optional(),
    'sort': z.string().max(40).optional(),
    'dir': z.enum(['asc', 'desc']).default('asc'),
})
paginationSchema = pagination_schema  # noqa: N816


def order_by(sort: str | None, dir_: str, allowed: dict[str, str], fallback: str) -> str:
    """Resolves a client-supplied sort key against an allow-list of SQL expressions. Unknown keys
    fall back to the default, so user input never reaches ORDER BY directly."""
    col = (allowed.get(sort) if sort and sort in allowed else None) or allowed.get(fallback) or fallback
    return f"{col} {'DESC' if dir_ == 'desc' else 'ASC'} NULLS LAST"


def limit_offset(p: dict) -> dict:
    return {'limit': p['pageSize'], 'offset': (p['page'] - 1) * p['pageSize']}


def like_term(q: str) -> str:
    """Escapes LIKE wildcards in a search term and wraps it for ILIKE."""
    return '%' + re.sub(r'[\\%_]', lambda m: '\\' + m.group(0), q) + '%'


orderBy, limitOffset, likeTerm = order_by, limit_offset, like_term  # noqa: N816
