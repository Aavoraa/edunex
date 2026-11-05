"""Rate limits and no-store (middleware/security.ts). Body sanitising lives in app/http.py (clean)."""
from __future__ import annotations

import math
import threading
import time
from typing import Callable

from ..config import settings
from ..errors import AppError
from ..http import Req


class RateLimiter:
    """Fixed-window limiter like express-rate-limit's memory store, with draft-8 RateLimit headers."""

    def __init__(self, window_ms: int, limit: int, skip: Callable[[Req], bool] | None = None,
                 key: Callable[[Req], str] | None = None, name: str = 'default') -> None:
        self.window_s = window_ms / 1000
        self.limit = limit
        self.skip = skip or (lambda req: False)
        self.key = key or (lambda req: req.ip or '')
        self.name = name
        self._hits: dict[str, tuple[float, int]] = {}
        self._lock = threading.Lock()

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()

    def __call__(self, req: Req) -> None:
        if self.skip(req):
            return None
        now = time.monotonic()
        k = self.key(req)
        with self._lock:
            start, count = self._hits.get(k, (now, 0))
            if now - start >= self.window_s:
                start, count = now, 0
            count += 1
            self._hits[k] = (start, count)
        reset_in = max(0, math.ceil(start + self.window_s - now))
        req.res.set('RateLimit-Policy', f'"{self.name}"; q={self.limit}; w={int(self.window_s)}')
        req.res.set('RateLimit', f'"{self.name}"; r={max(0, self.limit - count)}; t={reset_in}')
        if count > self.limit:
            raise AppError(429, 'RATE_LIMITED', 'Too many requests. Please slow down and try again shortly.')
        return None


api_limiter = RateLimiter(
    settings.RATE_LIMIT_WINDOW_MS, settings.RATE_LIMIT_MAX,
    # GPS devices (/api/v1/*) have their own per-device limiter.
    skip=lambda req: settings.is_test or req.path.startswith('/api/v1/'),
)

# Stricter limit for credential endpoints to slow brute-force attempts.
auth_limiter = RateLimiter(settings.RATE_LIMIT_WINDOW_MS, settings.AUTH_RATE_LIMIT_MAX,
                           skip=lambda req: settings.is_test, name='auth')

# Session refresh runs on every page load, so it must not use up the sign-in allowance; still capped.
refresh_limiter = RateLimiter(settings.RATE_LIMIT_WINDOW_MS, max(settings.AUTH_RATE_LIMIT_MAX * 15, 300),
                              skip=lambda req: settings.is_test, name='refresh')


def no_store(req: Req) -> None:
    """API responses carry personal data; never let browsers or proxies cache them."""
    req.res.set('Cache-Control', 'no-store')


apiLimiter, authLimiter, refreshLimiter, noStore = api_limiter, auth_limiter, refresh_limiter, no_store  # noqa: N816
