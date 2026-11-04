# backend/app/ai_config.py
"""AI Configuration: the chosen AI provider (Claude, OpenAI or Gemini) reads and marks. Provider,
models, effort and the keys are stored in the database (keys encrypted); nothing here depends on a
local model or GPU."""

from __future__ import annotations

from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from .models import Setting
from .security import decrypt_secret, encrypt_secret, mask

# Each provider keeps its own key and models, so switching back and forth loses nothing.
# OpenAI and Gemini also accept any other model id the administrator types in.
PROVIDERS: dict[str, dict] = {
    "claude": {
        "label": "Claude (Anthropic)", "company": "Anthropic", "key_prefix": "sk-ant-",
        "models": (("claude-opus-5-5", "Claude Opus 5.5 — most accurate"),
                   ("claude-sonnet-5-5", "Claude Sonnet 5.5 — about half the cost")),
    },
    "openai": {
        "label": "ChatGPT (OpenAI)", "company": "OpenAI", "key_prefix": "sk-",
        "models": (("gpt-5", "GPT-5 — most accurate"), ("gpt-5-mini", "GPT-5 mini — lower cost")),
    },
    "gemini": {
        "label": "Gemini (Google)", "company": "Google", "key_prefix": "",  # Google has issued more than one key format
        # Gemini 2.5 is closed to new keys; Pro needs a key with billing (free keys get no Pro quota).
        "models": (("gemini-3.8-flash", "Gemini 3.8 Flash — works with free keys"),
                   ("gemini-3.1-pro-preview", "Gemini 3.1 Pro (preview) — most accurate, needs billing")),
    },
}
SECRET_KEYS = tuple(f"{p}_api_key" for p in PROVIDERS)
MODELS = PROVIDERS["claude"]["models"]
EFFORTS = ("low", "medium", "high", "xhigh", "max")

DEFAULTS: dict = {
    "ai_provider": "claude",
    # The master switch for AI reading and marking (the name predates the other providers).
    "claude_enabled": False,
    "claude_vision_model": "claude-opus-5-5",
    "claude_eval_model": "claude-opus-5-5",
    "openai_vision_model": "gpt-5",
    "openai_eval_model": "gpt-5",
    "gemini_vision_model": "gemini-3.8-flash",
    "gemini_eval_model": "gemini-3.8-flash",
    "claude_effort": "medium",
    "claude_timeout": 600,
    "claude_refusal_fallback": True,
    "max_retries": 2,
    # Every sheet is read by the provider, so an administrator must acknowledge that the school's
    # consent and data-processing arrangements cover sending student pages there. The
    # acknowledgement names the provider; choosing another one asks for it again.
    "external_processing_acknowledged": False,
    "external_processing_acknowledged_by": None,
    # Off by default: the AI reads the name on the sheet to check it against the chosen student.
    "redact_top_percent": 0,
}


@dataclass
class AIConfig:
    values: dict = field(default_factory=dict)
    secrets: dict = field(default_factory=dict)

    def __getattr__(self, item):
        values = self.__dict__.get("values", {})
        if item in values:
            return values[item]
        raise AttributeError(item)

    @property
    def provider(self) -> str:
        p = self.values.get("ai_provider")
        return p if p in PROVIDERS else "claude"

    @property
    def provider_label(self) -> str:
        return PROVIDERS[self.provider]["label"]

    @property
    def company(self) -> str:
        return PROVIDERS[self.provider]["company"]

    @property
    def api_key(self) -> str | None:
        return self.secrets.get(f"{self.provider}_api_key")

    @property
    def claude_api_key(self) -> str | None:
        return self.secrets.get("claude_api_key")

    @property
    def vision_model(self) -> str:
        return self.values.get(f"{self.provider}_vision_model") or DEFAULTS[f"{self.provider}_vision_model"]

    @property
    def eval_model(self) -> str:
        return self.values.get(f"{self.provider}_eval_model") or DEFAULTS[f"{self.provider}_eval_model"]

    def ai_ready(self) -> tuple[bool, str]:
        if not self.claude_enabled:
            return False, "AI reading and marking is disabled in AI Configuration."
        if not self.api_key:
            return False, f"No {self.provider_label} API key is set in AI Configuration."
        return True, ""

    def acknowledged(self) -> bool:
        by = self.values.get("external_processing_acknowledged_by") or {}
        # Acknowledgements saved before providers could be chosen were for Anthropic.
        return bool(self.external_processing_acknowledged) and (by.get("provider") or "claude") == self.provider

    def vision_ready(self) -> tuple[bool, str]:
        ok, why = self.ai_ready()
        if not ok:
            return ok, why
        if not self.acknowledged():
            return False, ("An administrator must acknowledge, in AI Configuration, that student pages are "
                           f"sent to {self.company} before sheets can be read.")
        return True, ""


def load(db: Session) -> AIConfig:
    values, secrets = dict(DEFAULTS), {}
    for row in db.query(Setting).all():
        if row.key in SECRET_KEYS:
            if row.secret:
                secrets[row.key] = decrypt_secret(row.secret)
        elif row.key in DEFAULTS:
            values[row.key] = row.value
    return AIConfig(values=values, secrets=secrets)


def public_view(cfg: AIConfig) -> dict:
    """The configuration as the UI may see it: keys masked, never returned."""
    out = dict(cfg.values)
    out["ai_provider"] = cfg.provider
    for key in SECRET_KEYS:
        out[key] = mask(cfg.secrets.get(key))
    out["external_processing_acknowledged"] = cfg.acknowledged()
    return out


def save(db: Session, changes: dict, user_id: str | None) -> list[str]:
    """Apply ``changes``; returns the keys changed. Secret values: "" clears, None keeps."""
    changed = []
    for key, value in changes.items():
        if key in SECRET_KEYS:
            if value is None:
                continue
            row = db.get(Setting, key) or Setting(key=key)
            row.secret = encrypt_secret(value) if value else None
            row.value = None
        elif key in DEFAULTS:
            row = db.get(Setting, key) or Setting(key=key)
            row.value = value
        else:
            continue
        row.updated_by = user_id
        db.add(row)
        changed.append(key)
    return changed
