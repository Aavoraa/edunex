# backend/app/providers/llm.py
"""The one place that knows which AI provider is chosen: Claude, OpenAI or Gemini.

Everything else builds Anthropic-style content blocks and calls ``call_structured``; this
module hands the call to the provider's adapter.
"""

from __future__ import annotations

import time

import anthropic

from ..ai_config import AIConfig
from . import claude_common
from .base import HealthResult, ProviderError
from .http_providers import HttpClient


def make_client(cfg: AIConfig):
    ok, why = cfg.ai_ready()
    if not ok:
        raise ProviderError(why, "not_configured")
    if cfg.provider == "claude":
        return claude_common.make_client(cfg)
    return HttpClient(cfg)


def call_structured(client, cfg: AIConfig, *, model: str, system: str, content: list, schema: dict,
                    max_tokens: int = 16000, stream: bool = False) -> tuple[dict, dict, str]:
    """One schema-constrained call. Returns (parsed_json, usage, model_used)."""
    if cfg.provider == "claude":
        return claude_common.call_structured(client, cfg, model=model, system=system, content=content,
                                             schema=schema, max_tokens=max_tokens, stream=stream)
    return client.call_structured(cfg, model=model, system=system, content=content, schema=schema,
                                  max_tokens=max_tokens)


def check_model(client, cfg: AIConfig, model: str, images: bool = False) -> HealthResult:
    """Checks the key and that ``model`` exists (and, for Claude, accepts images when asked)."""
    if cfg.provider != "claude":
        return client.check_model(model)
    started = time.perf_counter()
    try:
        info = client.models.retrieve(model)
    except anthropic.AuthenticationError:
        return HealthResult(False, "claude", model, "Claude rejected the API key.")
    except anthropic.NotFoundError:
        return HealthResult(False, "claude", model, f"model {model} not found")
    except anthropic.APIError as exc:
        return HealthResult(False, "claude", model, f"Claude API error: {exc.__class__.__name__}")
    if images:
        caps = getattr(info, "capabilities", None)
        vision = getattr(caps, "image_input", None) if caps is not None else None
        if vision is not None and not getattr(vision, "supported", True):
            return HealthResult(False, "claude", info.id, "this model does not accept images")
    return HealthResult(True, "claude", info.id, f"{info.display_name} available",
                        int((time.perf_counter() - started) * 1000))
