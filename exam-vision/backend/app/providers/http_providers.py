# backend/app/providers/http_providers.py
"""OpenAI and Google Gemini over their REST APIs (httpx; no extra SDKs).

Callers build content in the Anthropic block format — {"type": "text"} and base64 JPEG
{"type": "image"} blocks — and each adapter converts it. Both return the same
(parsed_json, usage, model_used) as the Claude call.
"""

from __future__ import annotations

import json
import logging
import time

import httpx

from ..ai_config import AIConfig
from .base import HealthResult, ProviderError

log = logging.getLogger(__name__)

OPENAI_URL = "https://api.openai.com/v1"
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta"
_REFUSED_FINISH = ("SAFETY", "RECITATION", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "IMAGE_SAFETY")


def _strict_ok(schema) -> bool:
    """OpenAI's strict mode needs every object closed with all its properties required."""
    if isinstance(schema, dict):
        if schema.get("type") == "object" or "properties" in schema:
            props = schema.get("properties") or {}
            if schema.get("additionalProperties") is not False or set(schema.get("required") or []) != set(props):
                return False
        return all(_strict_ok(v) for v in schema.values())
    if isinstance(schema, list):
        return all(_strict_ok(v) for v in schema)
    return True


def _parse(text: str, label: str) -> dict:
    text = text.strip()
    if text.startswith("```"):  # JSON mode sometimes still wraps the answer in a code fence
        text = text.split("\n", 1)[-1].rsplit("```", 1)[0]
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ProviderError(f"{label} returned malformed JSON.", "bad_response", retryable=True) from exc
    if not isinstance(data, dict):
        raise ProviderError(f"{label} returned JSON of the wrong shape.", "bad_response", retryable=True)
    return data


def _schema_note(schema: dict) -> str:
    return ("\n\nReply with one JSON object only, no other text, matching this JSON Schema:\n"
            + json.dumps(schema, separators=(",", ":")))


class HttpClient:
    """One provider's REST client: the key, timeout and retries from AI Configuration."""

    def __init__(self, cfg: AIConfig, transport: httpx.BaseTransport | None = None):
        self.provider = cfg.provider
        self.label = cfg.provider_label
        self.key = cfg.api_key or ""
        self.retries = max(0, int(cfg.max_retries or 0))
        self.http = httpx.Client(timeout=float(cfg.claude_timeout or 600), transport=transport)

    def _headers(self) -> dict:
        if self.provider == "openai":
            return {"Authorization": f"Bearer {self.key}"}
        return {"x-goog-api-key": self.key}

    def request(self, method: str, url: str, **kw) -> httpx.Response:
        """Sends with retries for rate limits, server errors and network trouble; raises ProviderError."""
        for attempt in range(self.retries + 1):
            last = attempt == self.retries
            try:
                r = self.http.request(method, url, headers=self._headers(), **kw)
            except httpx.TimeoutException as exc:
                if last:
                    raise ProviderError(f"{self.label} timed out.", "timeout", retryable=True) from exc
            except httpx.HTTPError as exc:
                if last:
                    raise ProviderError(f"Could not reach the {self.label} API (network).", "unavailable",
                                        retryable=True) from exc
            else:
                if r.status_code < 400:
                    return r
                if last or not (r.status_code == 429 or r.status_code >= 500):
                    raise self.error(r)
            time.sleep(min(2 ** attempt, 20))
        raise ProviderError(f"{self.label} did not answer.", "unavailable", retryable=True)  # not reached

    def error(self, r: httpx.Response) -> ProviderError:
        try:
            body = r.json()
            err = body[0] if isinstance(body, list) else body
            message = str((err.get("error") or {}).get("message") or "").splitlines()[0][:300] if err.get("error") else ""
        except (ValueError, AttributeError, IndexError):
            message = ""
        if r.status_code in (401, 403) or "API key not valid" in message or "API_KEY_INVALID" in r.text:
            return ProviderError(f"{self.label} rejected the API key. Check it in AI Configuration.", "auth")
        # The provider's own words say why (a retired model, no quota on this plan, busy servers).
        reason = f" {self.label} says: {message}" if message else ""
        if r.status_code == 404:
            return ProviderError(f"{self.label} could not use that model. Choose another in AI Configuration.{reason}",
                                 "not_configured")
        if r.status_code == 429:
            return ProviderError(f"{self.label} rate limit or quota reached.{reason or ' Retry shortly.'}", "rate_limited",
                                 retryable=True)
        if r.status_code >= 500:
            return ProviderError(f"{self.label} API error {r.status_code}.{reason}", "unavailable", retryable=True)
        return ProviderError(f"{self.label} rejected the request: {message or r.status_code}", "bad_response")

    # -- structured calls ------------------------------------------------------------------------

    def call_structured(self, cfg: AIConfig, *, model: str, system: str, content: list, schema: dict,
                        max_tokens: int) -> tuple[dict, dict, str]:
        if self.provider == "openai":
            return self._openai(cfg, model, system, content, schema, max_tokens)
        return self._gemini(model, system, content, schema, max_tokens)

    def _openai(self, cfg, model, system, content, schema, max_tokens):
        parts = []
        for block in content:
            if block.get("type") == "image":
                src = block["source"]
                parts.append({"type": "image_url", "image_url": {
                    "url": f"data:{src['media_type']};base64,{src['data']}", "detail": "high"}})
            else:
                parts.append({"type": "text", "text": block.get("text", "")})
        body = {"model": model, "max_completion_tokens": max_tokens,
                "messages": [{"role": "system", "content": system}, {"role": "user", "content": parts}]}
        if model.startswith(("gpt-5", "o1", "o3", "o4")):  # reasoning models take an effort level
            body["reasoning_effort"] = {"low": "low", "medium": "medium"}.get(cfg.claude_effort, "high")
        if _strict_ok(schema):
            body["response_format"] = {"type": "json_schema",
                                       "json_schema": {"name": "result", "strict": True, "schema": schema}}
        else:
            body["response_format"] = {"type": "json_object"}
            body["messages"][0]["content"] = system + _schema_note(schema)
        data = self.request("POST", f"{OPENAI_URL}/chat/completions", json=body).json()
        choice = (data.get("choices") or [{}])[0]
        message = choice.get("message") or {}
        if message.get("refusal") or choice.get("finish_reason") == "content_filter":
            raise ProviderError(f"{self.label} declined this request.", "refused")
        if choice.get("finish_reason") == "length":
            raise ProviderError(f"{self.label}'s answer was cut off (token limit).", "bad_response", retryable=True)
        if not message.get("content"):
            raise ProviderError(f"{self.label} returned no content.", "bad_response", retryable=True)
        usage = data.get("usage") or {}
        return (_parse(message["content"], self.label),
                {"input_tokens": usage.get("prompt_tokens", 0) or 0,
                 "output_tokens": usage.get("completion_tokens", 0) or 0, "cache_read_input_tokens": 0},
                data.get("model") or model)

    def _gemini(self, model, system, content, schema, max_tokens):
        parts = []
        for block in content:
            if block.get("type") == "image":
                src = block["source"]
                parts.append({"inlineData": {"mimeType": src["media_type"], "data": src["data"]}})
            else:
                parts.append({"text": block.get("text", "")})
        url = f"{GEMINI_URL}/models/{model.removeprefix('models/')}:generateContent"
        # Thinking tokens count against the output limit, so allow room for them.
        config = {"responseMimeType": "application/json", "maxOutputTokens": min(max_tokens * 2, 65536)}

        def send(with_schema: bool):
            gen = {**config, "responseJsonSchema": schema} if with_schema else config
            text = system if with_schema else system + _schema_note(schema)
            return self.request("POST", url, json={"systemInstruction": {"parts": [{"text": text}]},
                                                   "contents": [{"role": "user", "parts": parts}],
                                                   "generationConfig": gen}).json()

        try:
            data = send(True)
        except ProviderError as exc:
            if exc.kind != "bad_response" or "schema" not in str(exc).lower():
                raise
            log.warning("Gemini did not accept the JSON schema for %s; retrying in plain JSON mode", model)
            data = send(False)
        if (data.get("promptFeedback") or {}).get("blockReason"):
            raise ProviderError(f"{self.label} declined this request.", "refused")
        candidate = (data.get("candidates") or [{}])[0]
        finish = candidate.get("finishReason")
        if finish in _REFUSED_FINISH:
            raise ProviderError(f"{self.label} declined this request ({finish.lower()}).", "refused")
        if finish == "MAX_TOKENS":
            raise ProviderError(f"{self.label}'s answer was cut off (token limit).", "bad_response", retryable=True)
        text = "".join(p.get("text", "") for p in (candidate.get("content") or {}).get("parts") or []
                       if not p.get("thought"))
        if not text:
            raise ProviderError(f"{self.label} returned no content.", "bad_response", retryable=True)
        usage = data.get("usageMetadata") or {}
        return (_parse(text, self.label),
                {"input_tokens": usage.get("promptTokenCount", 0) or 0,
                 "output_tokens": (usage.get("candidatesTokenCount", 0) or 0) + (usage.get("thoughtsTokenCount", 0) or 0),
                 "cache_read_input_tokens": usage.get("cachedContentTokenCount", 0) or 0},
                data.get("modelVersion") or model)

    # -- health ----------------------------------------------------------------------------------

    def check_model(self, model: str) -> HealthResult:
        started = time.perf_counter()
        url = (f"{OPENAI_URL}/models/{model}" if self.provider == "openai"
               else f"{GEMINI_URL}/models/{model.removeprefix('models/')}")
        try:
            info = self.request("GET", url).json()
        except ProviderError as exc:
            return HealthResult(False, self.provider, model, str(exc))
        name = info.get("displayName") or info.get("id") or model
        return HealthResult(True, self.provider, model, f"{name} available",
                            int((time.perf_counter() - started) * 1000))
