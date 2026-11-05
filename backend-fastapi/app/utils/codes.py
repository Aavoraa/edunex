"""Human-readable business codes (utils/codes.ts)."""
from __future__ import annotations

import re

from ..db import Queryable, one


def next_code(table: str, column: str, prefix: str, db: Queryable | None = None, pad: int = 4) -> str:
    """next_code('expenses', 'code', 'EXP-') → 'EXP-2212'. Uses the numeric suffix of existing codes;
    the UNIQUE constraint guards against races."""
    if not re.fullmatch(r'[a-z_]+', table) or not re.fullmatch(r'[a-z_]+', column):
        raise ValueError('Invalid identifier')
    row = one(
        f"""SELECT max(substring({column} FROM char_length($1) + 1)::bigint) AS max
              FROM {table}
             WHERE left({column}, char_length($1)) = $1
               AND substring({column} FROM char_length($1) + 1) ~ '^[0-9]+$'""",
        [prefix], db,
    )
    nxt = ((row or {}).get('max') or 0) + 1
    return prefix + str(nxt).zfill(pad)


nextCode = next_code  # noqa: N816
