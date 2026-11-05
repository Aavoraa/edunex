"""CSV import/export helpers (utils/csv.ts)."""
from __future__ import annotations

import re
from typing import Any

from starlette.responses import Response

from ..errors import bad_request
from .upload import Multer


def parse_csv(text: str) -> list[list[str]]:
    """RFC 4180 CSV → rows of strings (quoted fields, escaped quotes, CRLF/LF). Blank rows are dropped."""
    rows: list[list[str]] = []
    row: list[str] = []
    cell = ''
    quoted = False
    src = text[1:] if text.startswith('﻿') else text
    i, n = 0, len(src)
    while i < n:
        ch = src[i]
        if quoted:
            if ch == '"' and i + 1 < n and src[i + 1] == '"':
                cell += '"'
                i += 1
            elif ch == '"':
                quoted = False
            else:
                cell += ch
        elif ch == '"':
            quoted = True
        elif ch == ',':
            row.append(cell)
            cell = ''
        elif ch in '\n\r':
            if ch == '\r' and i + 1 < n and src[i + 1] == '\n':
                i += 1
            row.append(cell)
            rows.append(row)
            row, cell = [], ''
        else:
            cell += ch
        i += 1
    if cell != '' or row:
        row.append(cell)
        rows.append(row)
    return [r for r in rows if any(c.strip() != '' for c in r)]


def csv_cell(s: str) -> str:
    return '"' + s.replace('"', '""') + '"' if re.search(r'[",\n\r]', s) else s


def csv_document(columns: list[str] | tuple[str, ...], rows: list[dict[str, Any]]) -> str:
    """A CSV document from a header row and example rows."""
    lines = [','.join(columns)] + [','.join(csv_cell(r.get(c) or '') for c in columns) for r in rows]
    return '\r\n'.join(lines) + '\r\n'


def send_csv(filename: str, body: str) -> Response:
    """A CSV download (with a BOM so Excel reads it as UTF-8)."""
    return Response(('﻿' + body).encode('utf-8'), media_type='text/csv; charset=utf-8',
                    headers={'Content-Disposition': f'attachment; filename="{filename}"'})


def csv_upload(what: str) -> Multer:
    """One CSV file held in memory (2 MB). `what` names the file in the error message."""
    def file_filter(f: Any) -> None:
        ok_type = bool(re.search(r'\.csv$', f.originalname, re.I)) and f.mimetype in (
            'text/csv', 'application/vnd.ms-excel', 'text/plain', 'application/octet-stream')
        if not ok_type:
            raise bad_request(f'Upload the {what} as a .csv file (save the spreadsheet as CSV)', 'UNSUPPORTED_FILE_TYPE')
    return Multer(file_size=2 * 1024 * 1024, files=1, fields=5, file_filter=file_filter)


def read_csv_records(file: Any, columns: list[str] | tuple[str, ...], required: list[str] | tuple[str, ...], max_rows: int, what: str) -> list[dict]:
    """Reads an uploaded CSV into header-keyed records: [{'row': n, 'rec': {...}}]."""
    if not file:
        raise bad_request('Attach the CSV in the "file" field', 'FILE_REQUIRED', [{'field': 'file', 'message': 'Choose a CSV file'}])
    rows = parse_csv(file.buffer.decode('utf-8', 'replace'))
    if len(rows) < 2:
        raise bad_request(f'The file has no data rows — download the template and add one row per {what}', 'EMPTY_IMPORT')
    header = [h.strip() for h in rows[0]]
    unknown = [h for h in header if h and h not in columns]
    if unknown:
        raise bad_request(f"Unknown column{'' if len(unknown) == 1 else 's'}: {', '.join(unknown)}", 'IMPORT_COLUMNS')
    for col in required:
        if col not in header:
            raise bad_request(f'Missing required column "{col}"', 'IMPORT_COLUMNS')
    data = rows[1:]
    if len(data) > max_rows:
        raise bad_request(f'Import up to {max_rows} rows at a time', 'IMPORT_TOO_LARGE')
    out = []
    for i, cells in enumerate(data):
        rec = {h: (cells[k] if k < len(cells) else '').strip() for k, h in enumerate(header) if h}
        out.append({'row': i + 2, 'rec': rec})  # spreadsheet row number (header is row 1)
    return out


parseCsv, csvCell, csvDocument, sendCsv, csvUpload, readCsvRecords = (  # noqa: N816
    parse_csv, csv_cell, csv_document, send_csv, csv_upload, read_csv_records)
