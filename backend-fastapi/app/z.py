"""A small zod-compatible schema library, so the Express validators port line for line.

    from app.z import z
    login_schema = z.object({
        'identifier': z.string().trim().min(3, 'Enter your email or mobile number').max(254),
        'password': z.string().min(1, 'Enter your password').max(128),
        'clientType': z.enum(['web', 'mobile', 'integration']).optional(),
    })

Same names and semantics as zod v4 for the parts the API uses: checks and transforms run in chain
order, objects strip unknown keys, keys absent from the input are absent from the output,
`.default()` fills only a missing value. `or`/`and` are spelled `or_`/`and_`. Failures raise
ZodError with issues [{path: [...], message}].
"""
from __future__ import annotations

import datetime as _dt
import math
import re
from typing import Any, Callable

from .response import UNDEFINED


class ZodError(Exception):
    def __init__(self, issues: list[dict]):
        super().__init__('; '.join(f"{'.'.join(map(str, i['path']))}: {i['message']}" for i in issues))
        self.issues = issues


class _Abort(Exception):
    """Stops this schema after an issue (non-continuable)."""


class Ctx:
    def __init__(self) -> None:
        self.issues: list[dict] = []

    def add(self, path: list, message: str) -> None:
        self.issues.append({'path': list(path), 'message': message})


class RefineCtx:
    """The ctx passed to superRefine callbacks: ctx.addIssue({'message', 'path'?})."""

    def __init__(self, ctx: Ctx, path: list) -> None:
        self._ctx, self._path = ctx, path

    def addIssue(self, issue: dict) -> None:  # noqa: N802
        self._ctx.add(self._path + list(issue.get('path') or []), issue.get('message') or 'Invalid input')

    add_issue = addIssue


def _type_name(v: Any) -> str:
    if v is UNDEFINED:
        return 'undefined'
    if v is None:
        return 'null'
    if isinstance(v, bool):
        return 'boolean'
    if isinstance(v, (int, float)):
        return 'NaN' if isinstance(v, float) and math.isnan(v) else 'number'
    if isinstance(v, str):
        return 'string'
    if isinstance(v, list):
        return 'array'
    if isinstance(v, dict):
        return 'object'
    return type(v).__name__


def _msg(custom: Any, default: str) -> str:
    if isinstance(custom, dict):
        return custom.get('message') or custom.get('error') or default
    return custom or default


class Schema:
    def __init__(self) -> None:
        self._steps: list[Callable[[Any, Ctx, list], Any]] = []

    # --- core ---------------------------------------------------------------------------------
    def _base(self, value: Any, ctx: Ctx, path: list) -> Any:  # pragma: no cover - overridden
        return value

    def _run(self, value: Any, ctx: Ctx, path: list) -> Any:
        before = len(ctx.issues)
        value = self._base(value, ctx, path)
        if len(ctx.issues) > before:
            raise _Abort()
        for step in self._steps:
            value = step(value, ctx, path)
        return value

    def safeParse(self, value: Any) -> tuple[bool, Any]:  # noqa: N802
        ctx = Ctx()
        try:
            out = self._run(value, ctx, [])
        except _Abort:
            out = None
        if ctx.issues:
            return False, ZodError(ctx.issues)
        return True, out

    safe_parse = safeParse

    def parse(self, value: Any = UNDEFINED) -> Any:
        ok, out = self.safeParse(value)
        if not ok:
            raise out
        return out

    def _clone(self) -> 'Schema':
        import copy
        c = copy.copy(self)
        c._steps = list(self._steps)
        return c

    def _check(self, fn: Callable[[Any], bool], message: str, abort: bool = False) -> 'Schema':
        c = self._clone()

        def step(v: Any, ctx: Ctx, path: list) -> Any:
            if not fn(v):
                ctx.add(path, message)
                if abort:
                    raise _Abort()
            return v
        c._steps.append(step)
        return c

    def _map(self, fn: Callable[[Any], Any]) -> 'Schema':
        c = self._clone()
        c._steps.append(lambda v, ctx, path: fn(v))
        return c

    # --- wrappers -----------------------------------------------------------------------------
    def optional(self) -> 'Schema':
        return _Optional(self)

    def nullable(self) -> 'Schema':
        return _Nullable(self)

    def nullish(self) -> 'Schema':
        return _Optional(_Nullable(self))

    def default(self, value: Any) -> 'Schema':
        return _Default(self, value)

    def catch(self, value: Any) -> 'Schema':
        return _Catch(self, value)

    def or_(self, other: 'Schema') -> 'Schema':
        return _Union([self, other])

    def and_(self, other: 'Schema') -> 'Schema':
        return _Intersection(self, other)

    def pipe(self, other: 'Schema') -> 'Schema':
        return _Pipe(self, other)

    def transform(self, fn: Callable[..., Any]) -> 'Schema':
        c = self._clone()
        c._steps.append(lambda v, ctx, path: _call_transform(fn, v, ctx, path))
        return c

    def refine(self, fn: Callable[[Any], Any], message: Any = None) -> 'Schema':
        c = self._clone()
        msg = _msg(message, 'Invalid input')
        extra = list(message.get('path') or []) if isinstance(message, dict) else []

        def step(v: Any, ctx: Ctx, path: list) -> Any:
            if not fn(v):
                ctx.add(path + extra, msg)
            return v
        c._steps.append(step)
        return c

    def superRefine(self, fn: Callable[[Any, RefineCtx], Any]) -> 'Schema':  # noqa: N802
        c = self._clone()

        def step(v: Any, ctx: Ctx, path: list) -> Any:
            fn(v, RefineCtx(ctx, path))
            return v
        c._steps.append(step)
        return c

    super_refine = superRefine

    def describe(self, _text: str) -> 'Schema':
        return self


def _call_transform(fn: Callable, v: Any, ctx: Ctx, path: list) -> Any:
    import inspect
    try:
        n = len(inspect.signature(fn).parameters)
    except (TypeError, ValueError):
        n = 1
    return fn(v, RefineCtx(ctx, path)) if n >= 2 else fn(v)


class _Optional(Schema):
    def __init__(self, inner: Schema) -> None:
        super().__init__()
        self.inner = inner

    def _base(self, value: Any, ctx: Ctx, path: list) -> Any:
        if value is UNDEFINED:
            return UNDEFINED
        return self.inner._run(value, ctx, path)

    def unwrap(self) -> Schema:
        return self.inner


class _Nullable(Schema):
    def __init__(self, inner: Schema) -> None:
        super().__init__()
        self.inner = inner

    def _base(self, value: Any, ctx: Ctx, path: list) -> Any:
        if value is None:
            return None
        return self.inner._run(value, ctx, path)


class _Default(Schema):
    def __init__(self, inner: Schema, value: Any) -> None:
        super().__init__()
        self.inner, self.value = inner, value

    def _base(self, value: Any, ctx: Ctx, path: list) -> Any:
        if value is UNDEFINED:
            d = self.value() if callable(self.value) else self.value
            return list(d) if isinstance(d, list) else (dict(d) if isinstance(d, dict) else d)
        return self.inner._run(value, ctx, path)


class _Catch(Schema):
    def __init__(self, inner: Schema, value: Any) -> None:
        super().__init__()
        self.inner, self.value = inner, value

    def _base(self, value: Any, ctx: Ctx, path: list) -> Any:
        sub = Ctx()
        try:
            out = self.inner._run(value, sub, path)
        except _Abort:
            out = None
        if sub.issues:
            return self.value() if callable(self.value) else self.value
        return out


class _Pipe(Schema):
    def __init__(self, a: Schema, b: Schema) -> None:
        super().__init__()
        self.a, self.b = a, b

    def _base(self, value: Any, ctx: Ctx, path: list) -> Any:
        before = len(ctx.issues)
        out = self.a._run(value, ctx, path)
        if len(ctx.issues) > before:
            raise _Abort()
        return self.b._run(out, ctx, path)


class _Union(Schema):
    def __init__(self, options: list[Schema]) -> None:
        super().__init__()
        self.options = options

    def _base(self, value: Any, ctx: Ctx, path: list) -> Any:
        first: Ctx | None = None
        for opt in self.options:
            sub = Ctx()
            try:
                out = opt._run(value, sub, path)
            except _Abort:
                out = None
            if not sub.issues:
                return out
            first = first or sub
        ctx.add(path, 'Invalid input')
        return value


class _Intersection(Schema):
    def __init__(self, a: Schema, b: Schema) -> None:
        super().__init__()
        self.a, self.b = a, b

    def _base(self, value: Any, ctx: Ctx, path: list) -> Any:
        x = self.a._run(value, ctx, path)
        y = self.b._run(value, ctx, path)
        if isinstance(x, dict) and isinstance(y, dict):
            return {**x, **y}
        return y


# --- primitives -------------------------------------------------------------------------------
_UUID_RE = re.compile(r'^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}'
                      r'|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$')
_EMAIL_RE = re.compile(r"^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$")
_DATE_RE = re.compile(r'^\d{4}-\d{2}-\d{2}$')
_DATETIME_RE = re.compile(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|([+-]\d{2}:?\d{2}))$')
_DATETIME_Z_RE = re.compile(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?Z$')
_TIME_RE = re.compile(r'^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d+)?)?$')


def _valid_date(s: str) -> bool:
    if not _DATE_RE.match(s):
        return False
    try:
        _dt.date.fromisoformat(s)
        return True
    except ValueError:
        return False


def _valid_datetime(s: str, offset: bool) -> bool:
    if not (_DATETIME_RE if offset else _DATETIME_Z_RE).match(s):
        return False
    try:
        _dt.date.fromisoformat(s[:10])
        h, m = int(s[11:13]), int(s[14:16])
        return h < 24 and m < 60
    except ValueError:
        return False


def _valid_url(s: str, protocol: Any = None) -> bool:
    from urllib.parse import urlparse
    try:
        u = urlparse(s)
    except ValueError:
        return False
    if not u.scheme or not (u.netloc or u.scheme in ('mailto', 'data', 'file')):
        return False
    if protocol is not None and not re.match(protocol if isinstance(protocol, str) else protocol.pattern, u.scheme):
        return False
    return True


class ZString(Schema):
    def __init__(self, coerce: bool = False) -> None:
        super().__init__()
        self._coerce = coerce

    def _base(self, value: Any, ctx: Ctx, path: list) -> Any:
        if self._coerce and value is not UNDEFINED:
            if value is None:
                return 'null'
            if isinstance(value, bool):
                return 'true' if value else 'false'
            if isinstance(value, float) and value.is_integer():
                return str(int(value))
            return value if isinstance(value, str) else str(value)
        if not isinstance(value, str):
            ctx.add(path, f'Invalid input: expected string, received {_type_name(value)}')
        return value

    def min(self, n: int, message: Any = None) -> 'ZString':
        return self._check(lambda v: len(v) >= n, _msg(message, f'Too small: expected string to have >={n} characters'))  # type: ignore[return-value]

    def max(self, n: int, message: Any = None) -> 'ZString':
        return self._check(lambda v: len(v) <= n, _msg(message, f'Too big: expected string to have <={n} characters'))  # type: ignore[return-value]

    def length(self, n: int, message: Any = None) -> 'ZString':
        return self._check(lambda v: len(v) == n, _msg(message, f'Invalid length: expected string to have {n} characters'))  # type: ignore[return-value]

    def nonempty(self, message: Any = None) -> 'ZString':
        return self.min(1, message)

    def regex(self, pattern: Any, message: Any = None) -> 'ZString':
        rx = re.compile(pattern) if isinstance(pattern, str) else pattern
        return self._check(lambda v: rx.search(v) is not None, _msg(message, f'Invalid string: must match pattern /{rx.pattern}/'))  # type: ignore[return-value]

    def startsWith(self, prefix: str, message: Any = None) -> 'ZString':  # noqa: N802
        return self._check(lambda v: v.startswith(prefix), _msg(message, f'Invalid string: must start with "{prefix}"'))  # type: ignore[return-value]

    def endsWith(self, suffix: str, message: Any = None) -> 'ZString':  # noqa: N802
        return self._check(lambda v: v.endswith(suffix), _msg(message, f'Invalid string: must end with "{suffix}"'))  # type: ignore[return-value]

    def includes(self, part: str, message: Any = None) -> 'ZString':
        return self._check(lambda v: part in v, _msg(message, f'Invalid string: must include "{part}"'))  # type: ignore[return-value]

    def email(self, message: Any = None) -> 'ZString':
        return self._check(lambda v: bool(_EMAIL_RE.match(v)), _msg(message, 'Invalid email address'))  # type: ignore[return-value]

    def uuid(self, message: Any = None) -> 'ZString':
        return self._check(lambda v: bool(_UUID_RE.match(v)), _msg(message, 'Invalid UUID'))  # type: ignore[return-value]

    def url(self, message: Any = None, protocol: Any = None) -> 'ZString':
        if isinstance(message, dict):
            protocol = message.get('protocol', protocol)
        return self._check(lambda v: _valid_url(v, protocol), _msg(message, 'Invalid URL'))  # type: ignore[return-value]

    def date(self, message: Any = None) -> 'ZString':
        return self._check(_valid_date, _msg(message, 'Invalid ISO date'))  # type: ignore[return-value]

    def datetime(self, opts: Any = None) -> 'ZString':
        offset = bool(isinstance(opts, dict) and opts.get('offset'))
        return self._check(lambda v: _valid_datetime(v, offset), _msg(opts, 'Invalid ISO datetime'))  # type: ignore[return-value]

    def time(self, message: Any = None) -> 'ZString':
        return self._check(lambda v: bool(_TIME_RE.match(v)), _msg(message, 'Invalid ISO time'))  # type: ignore[return-value]

    def trim(self) -> 'ZString':
        return self._map(lambda v: v.strip(' \t\n\r\x0b\x0c ﻿  '))  # type: ignore[return-value]

    def toLowerCase(self) -> 'ZString':  # noqa: N802
        return self._map(str.lower)  # type: ignore[return-value]

    def toUpperCase(self) -> 'ZString':  # noqa: N802
        return self._map(str.upper)  # type: ignore[return-value]


class ZNumber(Schema):
    def __init__(self, coerce: bool = False) -> None:
        super().__init__()
        self._coerce = coerce

    def _base(self, value: Any, ctx: Ctx, path: list) -> Any:
        if self._coerce:
            value = _js_number(value)
        if isinstance(value, bool) or not isinstance(value, (int, float)) or (isinstance(value, float) and (math.isnan(value) or math.isinf(value))):
            ctx.add(path, f'Invalid input: expected number, received {_type_name(value)}')
            return value
        if isinstance(value, float) and value.is_integer() and self._coerce:
            return int(value)
        return value

    def int(self, message: Any = None) -> 'ZNumber':
        return self._check(lambda v: float(v).is_integer() and abs(v) <= 2**53 - 1, _msg(message, 'Invalid input: expected int, received number'), abort=True)  # type: ignore[return-value]

    def min(self, n: float, message: Any = None) -> 'ZNumber':
        return self._check(lambda v: v >= n, _msg(message, f'Too small: expected number to be >={n}'))  # type: ignore[return-value]

    gte = min

    def max(self, n: float, message: Any = None) -> 'ZNumber':
        return self._check(lambda v: v <= n, _msg(message, f'Too big: expected number to be <={n}'))  # type: ignore[return-value]

    lte = max

    def gt(self, n: float, message: Any = None) -> 'ZNumber':
        return self._check(lambda v: v > n, _msg(message, f'Too small: expected number to be >{n}'))  # type: ignore[return-value]

    def lt(self, n: float, message: Any = None) -> 'ZNumber':
        return self._check(lambda v: v < n, _msg(message, f'Too big: expected number to be <{n}'))  # type: ignore[return-value]

    def positive(self, message: Any = None) -> 'ZNumber':
        return self.gt(0, message)

    def nonnegative(self, message: Any = None) -> 'ZNumber':
        return self.min(0, message)

    def negative(self, message: Any = None) -> 'ZNumber':
        return self.lt(0, message)

    def finite(self, message: Any = None) -> 'ZNumber':
        return self

    def multipleOf(self, step: float, message: Any = None) -> 'ZNumber':  # noqa: N802
        return self._check(lambda v: abs(v / step - round(v / step)) < 1e-9, _msg(message, f'Invalid number: must be a multiple of {step}'))  # type: ignore[return-value]


def _js_number(v: Any) -> Any:
    """JavaScript Number(v)."""
    if v is UNDEFINED:
        return float('nan')
    if v is None:
        return 0
    if isinstance(v, bool):
        return 1 if v else 0
    if isinstance(v, (int, float)):
        return v
    if isinstance(v, str):
        s = v.strip()
        if s == '':
            return 0
        try:
            if re.fullmatch(r'[+-]?0[xX][0-9a-fA-F]+', s):
                return int(s, 16)
            if s in ('Infinity', '+Infinity'):
                return float('inf')
            if s == '-Infinity':
                return float('-inf')
            if not re.fullmatch(r'[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?', s):
                return float('nan')
            f = float(s)
            return int(f) if f.is_integer() and abs(f) < 2**53 else f
        except ValueError:
            return float('nan')
    if isinstance(v, list):
        return _js_number(v[0]) if len(v) == 1 else (0 if not v else float('nan'))
    return float('nan')


class ZBoolean(Schema):
    def __init__(self, coerce: bool = False) -> None:
        super().__init__()
        self._coerce = coerce

    def _base(self, value: Any, ctx: Ctx, path: list) -> Any:
        if self._coerce:
            return bool(value) and value is not UNDEFINED and value != '' and value != 0
        if not isinstance(value, bool):
            ctx.add(path, f'Invalid input: expected boolean, received {_type_name(value)}')
        return value


_TRUTHY = {'true', '1', 'yes', 'on', 'y', 'enabled'}
_FALSY = {'false', '0', 'no', 'off', 'n', 'disabled'}


class ZStringBool(Schema):
    def _base(self, value: Any, ctx: Ctx, path: list) -> Any:
        if isinstance(value, bool):
            return value
        if not isinstance(value, str):
            ctx.add(path, f'Invalid input: expected string, received {_type_name(value)}')
            return value
        low = value.strip().lower()
        if low in _TRUTHY:
            return True
        if low in _FALSY:
            return False
        ctx.add(path, 'Invalid input: expected "true" or "false"')
        return value


class ZEnum(Schema):
    def __init__(self, values: list[Any]) -> None:
        super().__init__()
        self.options = list(values.values()) if isinstance(values, dict) else list(values)

    def _base(self, value: Any, ctx: Ctx, path: list) -> Any:
        if not any(value == o and type(value) is type(o) for o in self.options):
            ctx.add(path, 'Invalid option: expected one of ' + '|'.join(f'"{o}"' for o in self.options))
        return value

    def exclude(self, values: list[Any]) -> 'ZEnum':
        return ZEnum([o for o in self.options if o not in values])

    def extract(self, values: list[Any]) -> 'ZEnum':
        return ZEnum([o for o in self.options if o in values])


class ZLiteral(Schema):
    def __init__(self, value: Any) -> None:
        super().__init__()
        self.values = list(value) if isinstance(value, (list, tuple)) else [value]

    def _base(self, value: Any, ctx: Ctx, path: list) -> Any:
        if not any(value == v and type(value) is type(v) or (value == v and isinstance(v, (int, float)) and not isinstance(value, bool)) for v in self.values):
            ctx.add(path, 'Invalid input: expected ' + '|'.join(repr(v) for v in self.values))
        return value


class ZAny(Schema):
    def _base(self, value: Any, ctx: Ctx, path: list) -> Any:
        return value


class ZJson(Schema):
    def _base(self, value: Any, ctx: Ctx, path: list) -> Any:
        if value is UNDEFINED:
            ctx.add(path, 'Invalid input: expected JSON, received undefined')
        return value


class ZArray(Schema):
    def __init__(self, item: Schema) -> None:
        super().__init__()
        self.item = item

    def _base(self, value: Any, ctx: Ctx, path: list) -> Any:
        if not isinstance(value, list):
            ctx.add(path, f'Invalid input: expected array, received {_type_name(value)}')
            return value
        out = []
        for i, v in enumerate(value):
            try:
                out.append(self.item._run(v, ctx, path + [i]))
            except _Abort:
                out.append(v)
        return out

    def min(self, n: int, message: Any = None) -> 'ZArray':
        return self._check(lambda v: len(v) >= n, _msg(message, f'Too small: expected array to have >={n} items'))  # type: ignore[return-value]

    def max(self, n: int, message: Any = None) -> 'ZArray':
        return self._check(lambda v: len(v) <= n, _msg(message, f'Too big: expected array to have <={n} items'))  # type: ignore[return-value]

    def length(self, n: int, message: Any = None) -> 'ZArray':
        return self._check(lambda v: len(v) == n, _msg(message, f'Invalid length: expected array to have {n} items'))  # type: ignore[return-value]

    def nonempty(self, message: Any = None) -> 'ZArray':
        return self.min(1, message)


class ZRecord(Schema):
    def __init__(self, key: Schema, value: Schema | None = None) -> None:
        super().__init__()
        if value is None:
            key, value = ZString(), key
        self.key, self.value = key, value

    def _base(self, value: Any, ctx: Ctx, path: list) -> Any:
        if not isinstance(value, dict):
            ctx.add(path, f'Invalid input: expected record, received {_type_name(value)}')
            return value
        out = {}
        for k, v in value.items():
            try:
                kk = self.key._run(k, ctx, path + [k])
                out[kk] = self.value._run(v, ctx, path + [k])
            except _Abort:
                pass
        return out


class ZObject(Schema):
    def __init__(self, shape: dict[str, Schema], mode: str = 'strip') -> None:
        super().__init__()
        self.shape = dict(shape)
        self.mode = mode

    def _base(self, value: Any, ctx: Ctx, path: list) -> Any:
        if not isinstance(value, dict):
            ctx.add(path, f'Invalid input: expected object, received {_type_name(value)}')
            return value
        out: dict[str, Any] = {}
        for k, s in self.shape.items():
            raw = value.get(k, UNDEFINED)
            try:
                v = s._run(raw, ctx, path + [k])
            except _Abort:
                continue
            if v is not UNDEFINED:
                out[k] = v
        if self.mode == 'passthrough':
            for k, v in value.items():
                if k not in self.shape:
                    out[k] = v
        elif self.mode == 'strict':
            extra = [k for k in value if k not in self.shape]
            if extra:
                ctx.add(path, 'Unrecognized key' + ('s' if len(extra) > 1 else '') + ': ' + ', '.join(f'"{k}"' for k in extra))
        return out

    def _new(self, shape: dict[str, Schema]) -> 'ZObject':
        return ZObject(shape, self.mode)

    def extend(self, shape: dict[str, Schema]) -> 'ZObject':
        return self._new({**self.shape, **shape})

    def merge(self, other: 'ZObject') -> 'ZObject':
        return self._new({**self.shape, **other.shape})

    def partial(self, keys: dict | None = None) -> 'ZObject':
        return self._new({k: (s if (keys and k not in keys) or isinstance(s, _Optional) else _Optional(s)) for k, s in self.shape.items()})

    def required(self) -> 'ZObject':
        return self._new({k: (s.inner if isinstance(s, _Optional) else s) for k, s in self.shape.items()})

    def omit(self, keys: dict | list) -> 'ZObject':
        return self._new({k: s for k, s in self.shape.items() if k not in keys})

    def pick(self, keys: dict | list) -> 'ZObject':
        return self._new({k: s for k, s in self.shape.items() if k in keys})

    def strict(self) -> 'ZObject':
        return ZObject(self.shape, 'strict')

    def passthrough(self) -> 'ZObject':
        return ZObject(self.shape, 'passthrough')

    def keyof(self) -> ZEnum:
        return ZEnum(list(self.shape))


class ZDiscriminatedUnion(Schema):
    def __init__(self, key: str, options: list[ZObject]) -> None:
        super().__init__()
        self.key, self.options = key, options

    def _base(self, value: Any, ctx: Ctx, path: list) -> Any:
        if not isinstance(value, dict):
            ctx.add(path, f'Invalid input: expected object, received {_type_name(value)}')
            return value
        for opt in self.options:
            sub = Ctx()
            try:
                opt.shape[self.key]._run(value.get(self.key, UNDEFINED), sub, [])
            except _Abort:
                continue
            if not sub.issues:
                return opt._run(value, ctx, path)
        ctx.add(path + [self.key], 'Invalid input')
        return value


class ZPreprocess(Schema):
    def __init__(self, fn: Callable[[Any], Any], inner: Schema) -> None:
        super().__init__()
        self.fn, self.inner = fn, inner

    def _base(self, value: Any, ctx: Ctx, path: list) -> Any:
        return self.inner._run(self.fn(value), ctx, path)


class _Iso:
    def date(self, message: Any = None) -> ZString:
        return ZString().date(message)

    def datetime(self, opts: Any = None) -> ZString:
        return ZString().datetime(opts)

    def time(self, message: Any = None) -> ZString:
        return ZString().time(message)


class _Coerce:
    def number(self) -> ZNumber:
        return ZNumber(coerce=True)

    def string(self) -> ZString:
        return ZString(coerce=True)

    def boolean(self) -> ZBoolean:
        return ZBoolean(coerce=True)


class _Z:
    iso = _Iso()
    coerce = _Coerce()

    def string(self, message: Any = None) -> ZString:
        return ZString()

    def number(self, message: Any = None) -> ZNumber:
        return ZNumber()

    def boolean(self, message: Any = None) -> ZBoolean:
        return ZBoolean()

    def stringbool(self) -> ZStringBool:
        return ZStringBool()

    def enum(self, values: Any, message: Any = None) -> ZEnum:
        return ZEnum(values)

    def literal(self, value: Any) -> ZLiteral:
        return ZLiteral(value)

    def object(self, shape: dict[str, Schema]) -> ZObject:
        return ZObject(shape)

    def strictObject(self, shape: dict[str, Schema]) -> ZObject:  # noqa: N802
        return ZObject(shape, 'strict')

    def looseObject(self, shape: dict[str, Schema]) -> ZObject:  # noqa: N802
        return ZObject(shape, 'passthrough')

    def array(self, item: Schema) -> ZArray:
        return ZArray(item)

    def record(self, key: Schema, value: Schema | None = None) -> ZRecord:
        return ZRecord(key, value)

    def union(self, options: list[Schema]) -> Schema:
        return _Union(options)

    def discriminatedUnion(self, key: str, options: list[ZObject]) -> Schema:  # noqa: N802
        return ZDiscriminatedUnion(key, options)

    def any(self) -> ZAny:
        return ZAny()

    def unknown(self) -> ZAny:
        return ZAny()

    def json(self) -> ZJson:
        return ZJson()

    def uuid(self, message: Any = None) -> ZString:
        return ZString().uuid(message)

    def email(self, message: Any = None) -> ZString:
        return ZString().email(message)

    def url(self, opts: Any = None) -> ZString:
        return ZString().url(opts)

    def preprocess(self, fn: Callable[[Any], Any], inner: Schema) -> Schema:
        return ZPreprocess(fn, inner)


z = _Z()
