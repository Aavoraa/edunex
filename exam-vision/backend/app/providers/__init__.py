# backend/app/providers/__init__.py
"""Factories for the AI sheet reader and answer evaluator. Tests replace them with fakes."""

from __future__ import annotations

from collections.abc import Callable

from ..ai_config import AIConfig

FACTORIES: dict[str, Callable] = {}


def _defaults() -> None:
    from .claude_vision import SheetReader
    from .evaluators import AnswerEvaluator

    FACTORIES.setdefault("reader", SheetReader)
    FACTORIES.setdefault("evaluator", AnswerEvaluator)


def reader(cfg: AIConfig):
    _defaults()
    return FACTORIES["reader"](cfg)


def evaluator(cfg: AIConfig):
    _defaults()
    return FACTORIES["evaluator"](cfg)
