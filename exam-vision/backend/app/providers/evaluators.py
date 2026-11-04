# backend/app/providers/evaluators.py
"""Answer marking with the chosen AI. Returns the raw marking JSON; services/scoring validates it."""

from __future__ import annotations

from ..ai_config import AIConfig
from ..services.prompts import SYSTEM
from .base import HealthResult
from .llm import call_structured, check_model, make_client


class AnswerEvaluator:
    def __init__(self, cfg: AIConfig, client=None):
        self.cfg = cfg
        self.name = cfg.provider
        self.client = client or make_client(cfg)
        self.model: str | None = cfg.eval_model

    def evaluate(self, user_message: str, schema: dict) -> tuple[dict, dict]:
        data, usage, model = call_structured(
            self.client, self.cfg, model=self.cfg.eval_model, system=SYSTEM, schema=schema,
            content=[{"type": "text", "text": user_message}], max_tokens=16000,
        )
        self.model = model
        return data, usage

    def health_check(self) -> HealthResult:
        return check_model(self.client, self.cfg, self.cfg.eval_model)
