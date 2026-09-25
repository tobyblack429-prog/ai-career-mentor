import uuid

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.core import rate_limit
from app.core.config import settings
from app.core.database import Base, SessionLocal, engine
from app.main import app
from app.models.models import InterviewSession


Base.metadata.create_all(bind=engine)


@pytest.fixture
def public_anonymous_mode(monkeypatch):
    monkeypatch.setattr(settings, "AUTH_DISABLED", False)
    monkeypatch.setattr(settings, "PUBLIC_ANONYMOUS_ACCESS", True)
    monkeypatch.setattr(settings, "APP_ENV", "production")
    monkeypatch.setattr(rate_limit, "reserve_public_quota", lambda *_args, **_kwargs: None, raising=False)
    return TestClient(app, base_url="https://testserver", headers={"Origin": settings.CORS_ORIGINS[0]})


def _new_interview_for_cookie(client: TestClient) -> str:
    from jose import jwt
    from app.core.security import SECRET_KEY, ALGORITHM

    token = client.cookies.get(settings.ANONYMOUS_SESSION_COOKIE)
    claims = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM], audience="anonymous-session", issuer="ai-career-mentor")
    session_id = str(uuid.uuid4())
    db = SessionLocal()
    try:
        db.add(InterviewSession(id=session_id, user_id=claims["sub"], target_role="Engineer"))
        db.commit()
    finally:
        db.close()
    return session_id


def test_anonymous_visitors_receive_isolated_users(public_anonymous_mode):
    first = public_anonymous_mode
    second = TestClient(app, base_url="https://testserver", headers={"Origin": settings.CORS_ORIGINS[0]})

    start_a = first.post("/auth/anonymous-session")
    start_b = second.post("/auth/anonymous-session")
    assert start_a.status_code == start_b.status_code == 200
    assert first.cookies.get(settings.ANONYMOUS_SESSION_COOKIE) != second.cookies.get(settings.ANONYMOUS_SESSION_COOKIE)
    set_cookie = start_a.headers["set-cookie"].lower()
    assert "httponly" in set_cookie and "secure" in set_cookie and "samesite=lax" in set_cookie

    session_id = _new_interview_for_cookie(first)
    own_history = first.get("/interview/history")
    other_history = second.get("/interview/history")
    assert own_history.status_code == other_history.status_code == 200
    assert [item["id"] for item in own_history.json()["history"]] == [session_id]
    assert other_history.json()["history"] == []
    assert first.get("/admin/access").status_code == 403


def test_anonymous_http_rejects_missing_forged_and_bearer_credentials(public_anonymous_mode):
    client = public_anonymous_mode
    assert client.get("/interview/history").status_code == 401
    assert client.get("/interview/history", headers={"Origin": "https://attacker.example"}).status_code == 403

    client.cookies.set(settings.ANONYMOUS_SESSION_COOKIE, "forged.payload.signature")
    assert client.get("/interview/history").status_code == 401

    client.cookies.clear()
    assert client.get("/interview/history", headers={"Authorization": "Bearer not-a-session"}).status_code == 401
    assert client.post("/auth/anonymous-session", headers={"Origin": "https://attacker.example"}).status_code == 403


def test_public_anonymous_mode_disables_account_auth_routes(public_anonymous_mode):
    response = public_anonymous_mode.post(
        "/auth/register",
        json={"name": "A", "email": "a@example.com", "password": "strong-password"},
    )
    assert response.status_code == 404


def test_public_anonymous_websocket_rejects_token_query_and_untrusted_origin(public_anonymous_mode):
    client = public_anonymous_mode
    assert client.post("/auth/anonymous-session").status_code == 200

    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect(
            f"/interview/ws/{uuid.uuid4()}?token=legacy-token",
            headers={"Origin": settings.CORS_ORIGINS[0]},
        ):
            pass

    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect(
            f"/interview/ws/{uuid.uuid4()}",
            headers={"Origin": "https://attacker.example"},
        ):
            pass
