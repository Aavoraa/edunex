"""Blob storage for uploaded documents (services/storage.service.ts): files under UPLOAD_DIR
(STORAGE_DRIVER=local) or objects in a private S3-compatible bucket (STORAGE_DRIVER=s3).
Either way the API streams files to signed-in users; nothing is publicly readable.

Keys look like "2026-09/<uuid>.pdf" and are generated server-side; the guards are defence in depth.
"""
from __future__ import annotations

import logging
import os
import re
from pathlib import Path
from typing import Iterator

from ..config import ROOT, settings

log = logging.getLogger('edunex.storage')

# Same folder the Express API uses (UPLOAD_DIR is relative to backend/, where it runs), so files
# uploaded by either API are found by both while they run side by side.
_upload = Path(settings.UPLOAD_DIR)
UPLOAD_ROOT = (_upload if _upload.is_absolute() else (ROOT / 'backend' / _upload)).resolve()

_s3 = None
if settings.STORAGE_DRIVER == 's3':
    import boto3
    from botocore.config import Config
    _s3 = boto3.client(
        's3', region_name=settings.S3_REGION, endpoint_url=settings.S3_ENDPOINT,
        aws_access_key_id=settings.S3_ACCESS_KEY_ID, aws_secret_access_key=settings.S3_SECRET_ACCESS_KEY,
        config=Config(s3={'addressing_style': 'path' if settings.S3_FORCE_PATH_STYLE else 'auto'}),
    )
else:
    try:
        UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
    except OSError as err:  # pragma: no cover
        log.warning('Could not create %s: %s', UPLOAD_ROOT, err)
    if settings.on_vercel:
        log.warning('STORAGE_DRIVER=local on Vercel: uploaded files are lost when the function instance ends. Use STORAGE_DRIVER=s3.')


def _assert_safe_key(key: str) -> None:
    if not re.fullmatch(r'[\w.-]+(/[\w.-]+)*', key, re.ASCII) or any(s in ('.', '..') for s in key.split('/')):
        raise ValueError(f'Unsafe storage key: {key}')


def _local_path(key: str) -> Path:
    full = (UPLOAD_ROOT / key).resolve()
    if full != UPLOAD_ROOT and not str(full).startswith(str(UPLOAD_ROOT) + os.sep):
        raise ValueError(f'Unsafe storage key: {key}')
    return full


def put_object(key: str, body: bytes, content_type: str) -> None:
    _assert_safe_key(key)
    if _s3 is not None:
        _s3.put_object(Bucket=settings.S3_BUCKET, Key=key, Body=body, ContentType=content_type)
        return
    full = _local_path(key)
    full.parent.mkdir(parents=True, exist_ok=True)
    full.write_bytes(body)


def get_object(key: str) -> Iterator[bytes] | None:
    """An iterator over the object's bytes, or None when it no longer exists."""
    try:
        _assert_safe_key(key)
    except ValueError:
        return None
    if _s3 is not None:
        try:
            res = _s3.get_object(Bucket=settings.S3_BUCKET, Key=key)
        except Exception as err:  # noqa: BLE001
            code = getattr(err, 'response', {}).get('Error', {}).get('Code') if hasattr(err, 'response') else None
            status = getattr(err, 'response', {}).get('ResponseMetadata', {}).get('HTTPStatusCode') if hasattr(err, 'response') else None
            if code in ('NoSuchKey', '404') or status == 404:
                return None
            raise
        return res['Body'].iter_chunks(64 * 1024)
    full = _local_path(key)
    if not full.exists():
        return None

    def chunks() -> Iterator[bytes]:
        with open(full, 'rb') as f:
            while True:
                b = f.read(64 * 1024)
                if not b:
                    break
                yield b
    return chunks()


def read_object(key: str) -> bytes | None:
    it = get_object(key)
    return None if it is None else b''.join(it)


def delete_object(key: str) -> None:
    _assert_safe_key(key)
    if _s3 is not None:
        try:
            _s3.delete_object(Bucket=settings.S3_BUCKET, Key=key)
        except Exception:  # noqa: BLE001
            pass
        return
    try:
        _local_path(key).unlink()
    except OSError:
        pass


putObject, getObject, deleteObject = put_object, get_object, delete_object  # noqa: N816
