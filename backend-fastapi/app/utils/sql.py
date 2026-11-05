"""Tiny WHERE-clause builder that keeps every value parameterised (utils/sql.ts).

    w = Where()
    w.add('s.campus_id = ?', campus_id)
    query(f'SELECT … {w.sql} …', w.params)

`?` placeholders are rewritten to $n in order.
"""
from __future__ import annotations

import re
from typing import Any

from ..response import UNDEFINED


class Where:
    def __init__(self) -> None:
        self.parts: list[str] = []
        self.params: list[Any] = []

    def add(self, fragment: str, *values: Any) -> 'Where':
        it = iter(values)

        def repl(_m: re.Match) -> str:
            self.params.append(next(it, None))
            return f'${len(self.params)}'
        text = re.sub(r'\?', repl, fragment)
        self.parts.append(f'({text})')
        return self

    def add_if(self, value: Any, fragment: str, *values: Any) -> 'Where':
        """Adds the fragment only when `value` is not undefined / None / ''."""
        if value is None or value is UNDEFINED or value == '':
            return self
        return self.add(fragment, *(values if values else (value,)))

    addIf = add_if  # noqa: N815

    def param(self, value: Any) -> str:
        """Pushes a value and returns its $n placeholder (for LIMIT/OFFSET etc.)."""
        self.params.append(value)
        return f'${len(self.params)}'

    @property
    def sql(self) -> str:
        return f"WHERE {' AND '.join(self.parts)}" if self.parts else ''

    @property
    def and_(self) -> str:
        return f"AND {' AND '.join(self.parts)}" if self.parts else ''
