"""Secure upload handling (services/documents.service.ts):
- files are held in memory, checked, and only then written to storage under a random key
- only an allow-list of document/image types is accepted, verified by magic bytes
- size is capped by UPLOAD_MAX_MB
- downloads go through authorised API routes only
"""
from __future__ import annotations

import datetime as dt
import hashlib
import re
import uuid
from typing import Any, Iterator

from ..config import settings
from ..errors import bad_request
from ..utils.upload import Multer
from .storage_service import get_object, put_object

ALLOWED: dict[str, dict[str, Any]] = {
    'application/pdf': {'ext': '.pdf', 'magic': lambda b: b[:5] == b'%PDF-'},
    'image/png': {'ext': '.png', 'magic': lambda b: b[:8] == b'\x89PNG\r\n\x1a\n'},
    'image/jpeg': {'ext': '.jpg', 'magic': lambda b: b[:3] == b'\xff\xd8\xff'},
    'image/webp': {'ext': '.webp', 'magic': lambda b: b[:4] == b'RIFF' and b[8:12] == b'WEBP'},
}


def _file_filter(f: Any) -> None:
    if f.mimetype not in ALLOWED:
        raise bad_request('Only PDF, PNG, JPEG or WebP files are accepted', 'UNSUPPORTED_FILE_TYPE')


upload = Multer(file_size=int(settings.UPLOAD_MAX_MB * 1024 * 1024), files=1, fields=10, file_filter=_file_filter)


def verify_uploaded_file(file: Any) -> dict:
    """Confirms the bytes match the declared type, then stores them."""
    rule = ALLOWED.get(file.mimetype)
    buf: bytes = file.buffer
    if not rule or not rule['magic'](buf):
        raise bad_request('File content does not match its type', 'FILE_TYPE_MISMATCH')
    storage_key = f"{dt.datetime.now(dt.timezone.utc).strftime('%Y-%m')}/{uuid.uuid4()}{rule['ext']}"
    put_object(storage_key, buf, file.mimetype)
    return {'storageKey': storage_key, 'checksum': hashlib.sha256(buf).hexdigest(), 'size': len(buf)}


def open_stored_file(storage_key: str) -> Iterator[bytes] | None:
    """An iterator over the file's bytes, or None when the file is no longer available."""
    return get_object(storage_key)


def safe_filename(name: str) -> str:
    # JS \w is ASCII-only.
    return re.sub(r'[^\w.\- ]+', '_', name, flags=re.ASCII)[:120] or 'document'


verifyUploadedFile, openStoredFile, safeFilename = verify_uploaded_file, open_stored_file, safe_filename  # noqa: N816
