"""WhatsApp delivery adapter used by the notification dispatcher (services/whatsapp.provider.ts).

- gateway: POST WHATSAPP_API_URL with `Authorization: Bearer <token>` and JSON
  { to, message, title, body, reference }.
- meta: WhatsApp Cloud API. Uses WHATSAPP_TEMPLATE_NAME when set, plain text otherwise.
"""
from __future__ import annotations

import json
import re
from typing import Any, Callable

import httpx

from ..config import settings


def whatsapp_number(raw: str | None, country_code: str | None = None) -> str | None:
    """Digits only, with the default country code added to 10-digit local numbers. None when unusable."""
    if not raw:
        return None
    cc = country_code or settings.WHATSAPP_DEFAULT_COUNTRY_CODE
    d = re.sub(r'\D', '', raw)
    if d.startswith('00'):
        d = d[2:]
    if len(d) == 11 and d.startswith('0'):
        d = d[1:]
    if len(d) == 10:
        d = f'{cc}{d}'
    return d if 11 <= len(d) <= 15 else None


def whatsapp_text(m: dict) -> str:
    return f"*{m['title']}*\n{m['body']}" if m.get('body') else m['title']


def send_whatsapp(m: dict, post: Callable[..., Any] | None = None) -> str | None:
    """Sends one message ({to, title, body, reference}); returns the provider's id. Raises on failure."""
    if not settings.WHATSAPP_API_URL or not settings.WHATSAPP_API_TOKEN:
        raise RuntimeError('WhatsApp is not configured')
    if settings.WHATSAPP_PROVIDER == 'meta':
        if settings.WHATSAPP_TEMPLATE_NAME:
            payload: dict = {
                'messaging_product': 'whatsapp', 'to': m['to'], 'type': 'template',
                'template': {
                    'name': settings.WHATSAPP_TEMPLATE_NAME, 'language': {'code': settings.WHATSAPP_TEMPLATE_LANG},
                    'components': [{'type': 'body', 'parameters': [{'type': 'text', 'text': m['title']},
                                                                    {'type': 'text', 'text': m.get('body') or '-'}]}],
                },
            }
        else:
            payload = {'messaging_product': 'whatsapp', 'to': m['to'], 'type': 'text', 'text': {'body': whatsapp_text(m)}}
    else:
        payload = {'to': m['to'], 'message': whatsapp_text(m), 'title': m['title'], 'body': m.get('body'),
                   'reference': m.get('reference')}
    post = post or httpx.post
    res = post(settings.WHATSAPP_API_URL, headers={'Content-Type': 'application/json',
                                                   'Authorization': f'Bearer {settings.WHATSAPP_API_TOKEN}'},
               content=json.dumps(payload), timeout=15)
    text = res.text
    if not (200 <= res.status_code < 300):
        raise RuntimeError(f'WhatsApp provider replied {res.status_code}: {text[:200]}')
    try:
        j = json.loads(text)
    except ValueError:
        return None
    if not isinstance(j, dict):
        return None
    msgs = j.get('messages')
    data = j.get('data')
    candidates = [
        msgs[0].get('id') if isinstance(msgs, list) and msgs and isinstance(msgs[0], dict) else None,
        j.get('id'), j.get('messageId'), j.get('message_id'),
        data.get('id') if isinstance(data, dict) else None,
    ]
    # JS `??` chain: the first value that is not null/undefined.
    return next((c for c in candidates if c is not None), None)
