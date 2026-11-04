"""OpenAI and Gemini adapters (over a fake network) and choosing the provider in AI Configuration."""

import json

import httpx
import pytest

from app import ai_config
from app.providers.base import ProviderError
from app.providers.http_providers import HttpClient, _strict_ok
from app.providers.llm import call_structured

SCHEMA = {"type": "object", "additionalProperties": False, "required": ["answer"],
          "properties": {"answer": {"type": "string"}}}
CONTENT = [{"type": "text", "text": "Page 1 of 1:"},
           {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": "QUJD"}},
           {"type": "text", "text": "Read it."}]


def _cfg(provider, **values):
    return ai_config.AIConfig(values={**ai_config.DEFAULTS, "claude_enabled": True, "ai_provider": provider,
                                      "max_retries": 0, **values},
                              secrets={f"{provider}_api_key": "test-key"})


def _client(cfg, handler, seen):
    def record(request: httpx.Request):
        seen.append(request)
        return handler(request)
    return HttpClient(cfg, transport=httpx.MockTransport(record))


def test_openai_request_and_reply():
    cfg, seen = _cfg("openai"), []
    reply = {"model": "gpt-5-2026", "usage": {"prompt_tokens": 900, "completion_tokens": 40},
             "choices": [{"finish_reason": "stop", "message": {"content": json.dumps({"answer": "60 km/h"})}}]}
    client = _client(cfg, lambda r: httpx.Response(200, json=reply), seen)
    data, usage, model = call_structured(client, cfg, model=cfg.vision_model, system="sys", content=CONTENT, schema=SCHEMA)
    body = json.loads(seen[0].content)
    assert seen[0].url.path == "/v1/chat/completions" and seen[0].headers["authorization"] == "Bearer test-key"
    assert body["model"] == "gpt-5" and body["reasoning_effort"] == "medium"
    assert body["response_format"]["json_schema"]["strict"] is True
    assert body["messages"][1]["content"][1] == {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,QUJD", "detail": "high"}}
    assert data == {"answer": "60 km/h"} and usage["input_tokens"] == 900 and model == "gpt-5-2026"


def test_openai_refusal_and_bad_key():
    cfg = _cfg("openai")
    refused = {"choices": [{"finish_reason": "stop", "message": {"content": None, "refusal": "no"}}]}
    with pytest.raises(ProviderError) as e:
        call_structured(_client(cfg, lambda r: httpx.Response(200, json=refused), []), cfg,
                        model="gpt-5", system="s", content=CONTENT, schema=SCHEMA)
    assert e.value.kind == "refused"
    with pytest.raises(ProviderError) as e:
        call_structured(_client(cfg, lambda r: httpx.Response(401, json={"error": {"message": "bad"}}), []), cfg,
                        model="gpt-5", system="s", content=CONTENT, schema=SCHEMA)
    assert e.value.kind == "auth" and "ChatGPT (OpenAI) rejected the API key" in str(e.value)


def test_gemini_request_reply_and_schema_fallback():
    cfg, seen = _cfg("gemini"), []
    reply = {"modelVersion": "gemini-2.5-pro-001", "usageMetadata": {"promptTokenCount": 800, "candidatesTokenCount": 30, "thoughtsTokenCount": 70},
             "candidates": [{"finishReason": "STOP", "content": {"parts": [{"text": "thinking", "thought": True},
                                                                          {"text": "```json\n{\"answer\": \"leaves\"}\n```"}]}}]}

    def handler(request):  # the first try (with the JSON schema) is refused, the plain JSON retry works
        body = json.loads(request.content)
        if "responseJsonSchema" in body["generationConfig"]:
            return httpx.Response(400, json={"error": {"message": "Invalid JSON payload: unknown field responseJsonSchema"}})
        return httpx.Response(200, json=reply)

    data, usage, model = call_structured(_client(cfg, handler, seen), cfg, model=cfg.vision_model, system="sys",
                                         content=CONTENT, schema=SCHEMA)
    assert seen[0].url.path == "/v1beta/models/gemini-3.8-flash:generateContent" and seen[0].headers["x-goog-api-key"] == "test-key"
    retry = json.loads(seen[1].content)
    assert retry["contents"][0]["parts"][1] == {"inlineData": {"mimeType": "image/jpeg", "data": "QUJD"}}
    assert "JSON Schema" in retry["systemInstruction"]["parts"][0]["text"]
    assert data == {"answer": "leaves"} and usage["output_tokens"] == 100 and model == "gemini-2.5-pro-001"


def test_gemini_safety_block_is_a_refusal():
    cfg = _cfg("gemini")
    blocked = {"candidates": [{"finishReason": "SAFETY", "content": {"parts": []}}]}
    with pytest.raises(ProviderError) as e:
        call_structured(_client(cfg, lambda r: httpx.Response(200, json=blocked), []), cfg,
                        model="gemini-3.8-flash", system="s", content=CONTENT, schema=SCHEMA)
    assert e.value.kind == "refused"


def test_provider_reason_is_passed_on():
    cfg = _cfg("gemini")
    gone = {"error": {"message": "This model models/gemini-2.5-pro is no longer available to new users."}}
    with pytest.raises(ProviderError) as e:
        call_structured(_client(cfg, lambda r: httpx.Response(404, json=gone), []), cfg,
                        model="gemini-2.5-pro", system="s", content=CONTENT, schema=SCHEMA)
    assert e.value.kind == "not_configured" and "no longer available to new users" in str(e.value)


def test_strict_mode_only_for_closed_schemas():
    assert _strict_ok(SCHEMA)
    assert not _strict_ok({"type": "object", "properties": {"a": {"type": "string"}}, "required": []})


def test_each_provider_uses_its_own_key_and_models():
    cfg = ai_config.AIConfig(values={**ai_config.DEFAULTS, "claude_enabled": True, "ai_provider": "gemini"},
                             secrets={"claude_api_key": "sk-ant-x"})
    assert cfg.vision_model == "gemini-3.8-flash"
    assert cfg.ai_ready() == (False, "No Gemini (Google) API key is set in AI Configuration.")


def test_switching_provider_asks_for_the_acknowledgement_again(world, client):
    status = client.get("/api/settings/ai/status", headers=world.admin).json()
    assert status["reading_available"] and status["provider"] == "claude"
    r = client.put("/api/settings/ai", headers=world.admin, json={"changes": {"ai_provider": "openai", "openai_api_key": "sk-test"}})
    assert r.status_code == 200 and r.json()["config"]["external_processing_acknowledged"] is False
    status = client.get("/api/settings/ai/status", headers=world.admin).json()
    assert not status["reading_available"] and "OpenAI" in status["reading_reason"] and status["vision_model"] == "gpt-5"
    client.put("/api/settings/ai", headers=world.admin, json={"changes": {"external_processing_acknowledged": True}})
    cfg = client.get("/api/settings/ai", headers=world.admin).json()["config"]
    assert cfg["external_processing_acknowledged"] and cfg["external_processing_acknowledged_by"]["provider"] == "openai"
    assert "sk-test" not in json.dumps(cfg)
    assert client.put("/api/settings/ai", headers=world.admin, json={"changes": {"ai_provider": "mistral"}}).status_code == 400
    assert client.put("/api/settings/ai", headers=world.admin, json={"changes": {"openai_eval_model": "bad model!"}}).status_code == 400


def test_exam_board_sets_the_marking_conventions(world, client):
    from tests.conftest import FakeEvaluator, FakeReader
    from app.services import prompts

    exam = world.exam["id"]
    assert client.put(f"/api/exams/{exam}", headers=world.admin, json={
        "name": "Unit Test", "academic_year": "2026-27", "class_name": "7", "section": "A", "subject": "Science",
        "board": "nosuchboard"}).status_code == 422
    r = client.put(f"/api/exams/{exam}", headers=world.admin, json={
        "name": "Unit Test", "academic_year": "2026-27", "class_name": "7", "section": "A", "subject": "Science", "board": "cbse"})
    assert r.status_code == 200 and r.json()["board"] == "cbse" and r.json()["board_label"] == "CBSE"
    FakeEvaluator.calls.clear()
    FakeReader.SHEET = {"name": "Arun Kumar", "answers": {"1": "Plants use light energy to make their own food."}}
    world.upload(world.s1)
    assert FakeEvaluator.calls and "Board: CBSE" in FakeEvaluator.calls[0] and "step marking" in FakeEvaluator.calls[0]
    assert prompts.PROMPT_VERSION == "eval-v3"


def test_exam_without_a_board_gets_no_board_conventions():
    from app.services import prompts

    msg = prompts.build_user_message(
        exam={"subject": "Science", "class_name": "7", "board": ""},
        question={"number": "1", "qtype": "short", "max_marks": 2, "mark_increment": 1, "text": "Why?"},
        rubric={"version": 1, "criteria": [{"id": "C1", "max_marks": 2, "name": "reason"}]}, answer_text="because", ocr_status="ok")
    assert "Board marking conventions" not in msg


def test_exam_syllabus_and_paper_reach_the_marking_prompt(world, client):
    from tests.conftest import FakeEvaluator, FakeReader

    exam = world.exam["id"]
    r = client.put(f"/api/exams/{exam}", headers=world.admin, json={
        "name": "Unit Test", "academic_year": "2026-27", "class_name": "7", "section": "A", "subject": "Science", "board": "igcse",
        "syllabus_id": "s1", "syllabus_title": "Cambridge IGCSE Biology (0610)", "component_id": "c1",
        "component_name": "Paper 3 Theory (Core)", "tier": "Core", "syllabus_context": "Units: 1 Characteristics of living organisms; 6 Plant nutrition"})
    assert r.status_code == 200 and r.json()["component_name"] == "Paper 3 Theory (Core)"
    report = client.get(f"/api/exams/{exam}/report", headers=world.admin).json()["exam"]
    assert report["board"] == "igcse" and report["component_id"] == "c1" and report["tier"] == "Core"
    FakeEvaluator.calls.clear()
    FakeReader.SHEET = {"name": "Arun Kumar", "answers": {"1": "Plants use light energy to make their own food."}}
    world.upload(world.s1)
    msg = FakeEvaluator.calls[0]
    assert "Syllabus: Cambridge IGCSE Biology (0610); paper: Paper 3 Theory (Core); tier: Core" in msg and "Plant nutrition" in msg
