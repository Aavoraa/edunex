"""multer (memory storage) equivalent. The multipart body is parsed before the chain runs
(app/http.py); this step applies multer's limits and file filter at the same point in the chain
and sets req.file / req.files.

    upload = Multer(file_size=10 * 1024 * 1024, files=1, fields=10, file_filter=check)
    r.post('/documents', require_any(...), upload.single('file'), validate(schema), handler)
"""
from __future__ import annotations

from typing import Any, Callable

from ..errors import AppError


def _multer_error(code: str, message: str) -> AppError:
    # error.ts: MulterError → 400 { error: `UPLOAD_${code}` }
    return AppError(400, f'UPLOAD_{code}', message)


class Multer:
    def __init__(self, file_size: int | None = None, files: int | None = None, fields: int | None = None,
                 file_filter: Callable[[Any], None] | None = None) -> None:
        self.file_size, self.max_files, self.max_fields, self.file_filter = file_size, files, fields, file_filter

    def _check(self, req: Any, allowed: Callable[[str], bool]) -> list:
        files = list(getattr(req, 'files', []) or [])
        body = req.body if isinstance(req.body, dict) else {}
        if self.max_fields is not None and len(body) > self.max_fields:
            raise _multer_error('LIMIT_FIELD_COUNT', 'Too many fields')
        if self.max_files is not None and len(files) > self.max_files:
            raise _multer_error('LIMIT_FILE_COUNT', 'Too many files')
        for f in files:
            if not allowed(f.fieldname):
                raise _multer_error('LIMIT_UNEXPECTED_FILE', 'Unexpected field')
            if self.file_filter:
                self.file_filter(f)
            if self.file_size is not None and f.size > self.file_size:
                raise _multer_error('LIMIT_FILE_SIZE', 'File too large')
        return files

    def single(self, field: str) -> Callable[[Any], None]:
        def step(req: Any) -> None:
            files = self._check(req, lambda name: name == field)
            if len(files) > 1:
                raise _multer_error('LIMIT_UNEXPECTED_FILE', 'Unexpected field')
            req.file = files[0] if files else None
        return step

    def array(self, field: str, max_count: int | None = None) -> Callable[[Any], None]:
        def step(req: Any) -> None:
            files = self._check(req, lambda name: name == field)
            if max_count is not None and len(files) > max_count:
                raise _multer_error('LIMIT_UNEXPECTED_FILE', 'Unexpected field')
            req.files = files
        return step

    def none(self) -> Callable[[Any], None]:
        return self.array('\0', 0)
