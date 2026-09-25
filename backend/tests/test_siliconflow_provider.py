"""Free-model mode must cover both regular agents and the interview pipeline."""

import asyncio
from types import SimpleNamespace

from starlette.websockets import WebSocketState
from fastapi import WebSocketDisconnect

from app.core.config import settings
from app.core.llm_config import LLMConfigManager
from app.core.interview.llm import _select_fallback_chain
from app.core.interview import llm as interview_llm
from app.core.interview import websocket_manager
from app.core.interview.websocket_manager import _has_interview_provider_key, _latest_unanswered_question
from app.agents import registry


def test_all_agents_use_only_siliconflow_in_free_model_mode(monkeypatch):
    monkeypatch.setattr(settings, "LLM_PROVIDER", "siliconflow")
    monkeypatch.setattr(settings, "SILICONFLOW_MODEL", "XingChenAGI/Xing4.0-29B")

    for agent_name in LLMConfigManager.list_all_agents():
        config = LLMConfigManager.get_agent_config(agent_name)
        assert config["provider"] == "siliconflow"
        assert config["model"] == "XingChenAGI/Xing4.0-29B"
        assert config["fallback_chain"] == ["siliconflow"]


def test_interview_ignores_stale_groq_preference(monkeypatch):
    monkeypatch.setattr(settings, "LLM_PROVIDER", "siliconflow")
    assert _select_fallback_chain("groq", ["groq", "nvidia"]) == ["siliconflow"]


def test_interview_requires_siliconflow_key_in_free_model_mode(monkeypatch):
    monkeypatch.setattr(settings, "LLM_PROVIDER", "siliconflow")
    monkeypatch.setattr(settings, "GROQ_API_KEY", "test-key")
    monkeypatch.setattr(settings, "SILICONFLOW_API_KEY", "")
    assert not _has_interview_provider_key()

    monkeypatch.setattr(settings, "SILICONFLOW_API_KEY", "test-key")
    assert _has_interview_provider_key()


def test_reconnect_replays_only_a_pending_question():
    question = {"role": "interviewer", "type": "question", "content": "请介绍一下自己。", "question_number": 1}
    assert _latest_unanswered_question([question]) == question
    assert _latest_unanswered_question([question, {"role": "candidate", "content": "我的经历"}]) is None
    assert _latest_unanswered_question([]) is None


def test_reconnect_sends_saved_question_to_browser(monkeypatch):
    question = {"role": "interviewer", "type": "question", "content": "请介绍一下自己。", "question_number": 1}

    class FakeDb:
        def close(self):
            pass

    class FakeWebSocket:
        client_state = WebSocketState.CONNECTING

        def __init__(self):
            self.frames = []

        async def accept(self):
            self.client_state = WebSocketState.CONNECTED

        async def send_json(self, payload):
            self.frames.append(payload)

        async def receive_text(self):
            raise WebSocketDisconnect(code=1000)

    from app.core import database
    monkeypatch.setattr(database, "SessionLocal", FakeDb)
    monkeypatch.setattr(websocket_manager, "_get_user_from_token", lambda *_args: SimpleNamespace(id="test-user", name="演示用户"))
    monkeypatch.setattr(websocket_manager, "_has_interview_provider_key", lambda: True)
    monkeypatch.setattr(websocket_manager, "load_initial_interview_data", lambda *_args: ([question], "演示用户", ""))
    monkeypatch.setattr(websocket_manager, "update_session_state", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(websocket_manager, "_build_interview_system_prompt", lambda *_args, **_kwargs: "面试系统提示")
    ws = FakeWebSocket()

    asyncio.run(websocket_manager.handle_websocket_connection(
        ws, "test-reconnect", "软件工程师", "示例公司", "", "other", None, "technical", "siliconflow", language="zh"
    ))

    assert [frame for frame in ws.frames if frame.get("type") == "question"] == [
        {"role": "interviewer", "type": "question", "content": "请介绍一下自己。",
         "question_number": 1, "total_questions": 10, "phase_name": ""}
    ]


def test_siliconflow_request_uses_free_model_and_json_mode(monkeypatch):
    monkeypatch.setattr(settings, "SILICONFLOW_API_KEY", "test-key")
    monkeypatch.setattr(settings, "SILICONFLOW_MODEL", "XingChenAGI/Xing4.0-29B")
    seen = {}

    class FakeResponse:
        status_code = 200

        def json(self):
            return {
                "choices": [{"message": {"content": '{"ok": true}'}}],
                "usage": {"prompt_tokens": 4, "completion_tokens": 5},
            }

    class FakeClient:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def post(self, url, **kwargs):
            seen.update(url=url, **kwargs)
            return FakeResponse()

    monkeypatch.setattr(registry.httpx, "Client", FakeClient)
    result = registry._call_siliconflow("Return JSON", "hello", json_mode=True)

    assert result == ('{"ok": true}', 4, 5)
    assert seen["url"] == "https://api.siliconflow.cn/v1/chat/completions"
    assert seen["json"]["model"] == "XingChenAGI/Xing4.0-29B"
    assert seen["json"]["response_format"] == {"type": "json_object"}
    assert seen["json"]["max_tokens"] == 4096
    assert seen["headers"]["Authorization"] == "Bearer test-key"


def test_interview_disables_reasoning_and_streams_chinese_text(monkeypatch):
    monkeypatch.setattr(settings, "LLM_PROVIDER", "siliconflow")
    monkeypatch.setattr(settings, "SILICONFLOW_MODEL", "XingChenAGI/Xing4.0-29B")
    monkeypatch.setattr(interview_llm, "track_llm_call", lambda *_args: None)
    seen = {}

    class FakeCompletions:
        async def create(self, **kwargs):
            seen.update(kwargs)
            return SimpleNamespace(choices=[SimpleNamespace(
                message=SimpleNamespace(content="请介绍一下你最近参与的项目，以及你在项目中承担的职责？")
            )])

    fake_client = SimpleNamespace(chat=SimpleNamespace(completions=FakeCompletions()))
    monkeypatch.setattr(interview_llm, "_get_openai_client", lambda _provider: fake_client)

    class FakeWebSocket:
        client_state = WebSocketState.CONNECTED

        def __init__(self):
            self.frames = []

        async def send_json(self, payload):
            self.frames.append(payload)

    ws = FakeWebSocket()
    result = asyncio.run(interview_llm._stream_llm_response(
        [{"role": "user", "content": "开始面试"}], ws, "用中文提问", tts_queue=asyncio.Queue()
    ))

    assert seen["extra_body"] == {"enable_thinking": False}
    assert seen["stream"] is False
    assert result == "请介绍一下你最近参与的项目，以及你在项目中承担的职责？"
    assert "".join(frame["content"] for frame in ws.frames) == result
