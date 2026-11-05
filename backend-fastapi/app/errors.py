"""Operational errors with an HTTP status and a stable machine-readable code (utils/errors.ts)."""
from __future__ import annotations

from typing import Any


class AppError(Exception):
    def __init__(self, status: int, code: str, message: str, details: Any = None):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.details = details


def bad_request(message: str, code: str = 'BAD_REQUEST', details: Any = None) -> AppError:
    return AppError(400, code, message, details)


def unauthorized(message: str = 'Authentication required', code: str = 'UNAUTHORIZED') -> AppError:
    return AppError(401, code, message)


def forbidden(message: str = 'You do not have permission to perform this action', code: str = 'FORBIDDEN') -> AppError:
    return AppError(403, code, message)


def not_found(message: str, code: str = 'NOT_FOUND') -> AppError:
    return AppError(404, code, message)


def conflict(message: str, code: str = 'CONFLICT') -> AppError:
    return AppError(409, code, message)
