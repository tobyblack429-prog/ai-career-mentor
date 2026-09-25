"""
Main integration tests.

FIX:
  - Rate limit test now reads DAILY_LIMITS["roadmap"] dynamically instead of
    hard-coding 5 (which exceeds the actual limit of 3, breaking the test logic).
"""
import uuid
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.core import rate_limit
from app.core.database import Base, engine, SessionLocal
from app.main import app
from app.models.models import MarketAnalysis

Base.metadata.create_all(bind=engine)
client = TestClient(app)


def _register_user():
    email = f"test-{uuid.uuid4().hex}@example.com"
    payload = {"name": "Test User", "email": email, "password": "strong-password"}
    response = client.post("/auth/register", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["access_token"]
    assert data["refresh_token"]
    return email, payload["password"], data


def _auth_headers(token: str):
    return {"Authorization": f"Bearer {token}"}


def test_read_root():
    response = client.get("/")
    assert response.status_code == 200
    assert "message" in response.json()


def test_read_health():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "service" in data
    assert "provider" in data


def test_auth_register_login_and_refresh():
    email, password, registered = _register_user()

    login_response = client.post("/auth/login", json={"email": email, "password": password})
    assert login_response.status_code == 200
    logged_in = login_response.json()
    assert logged_in["access_token"]
    assert logged_in["refresh_token"]

    invalid_login = client.post("/auth/login", json={"email": email, "password": "wrong-password"})
    assert invalid_login.status_code == 401

    refresh_response = client.post(
        "/auth/refresh",
        json={"refresh_token": registered["refresh_token"]},
    )
    assert refresh_response.status_code == 200
    assert refresh_response.json()["access_token"]


def test_protected_routes_without_token():
    response = client.post(
        "/roadmap/generate",
        json={"target_role": "Developer", "skill_gaps": ["React"]},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated"

    response = client.get("/market/trends?role=Developer&location=Remote")
    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated"


def test_refresh_token_cannot_access_protected_routes():
    _, _, registered = _register_user()
    response = client.get("/user/stats", headers=_auth_headers(registered["refresh_token"]))
    assert response.status_code == 401


def test_market_history_returns_saved_user_records():
    _, _, registered = _register_user()
    headers = _auth_headers(registered["access_token"])
    access_token = registered["access_token"]

    # Decode through the authenticated API path by creating the record for the registered user.
    from app.core.security import SECRET_KEY, ALGORITHM
    from jose import jwt

    payload = jwt.decode(access_token, SECRET_KEY, algorithms=[ALGORITHM])
    db = SessionLocal()
    db.add(MarketAnalysis(
        user_id=payload["sub"],
        target_role="Backend Engineer",
        location="Bangalore, India",
        analysis={
            "role": "Backend Engineer",
            "location": "Bangalore, India",
            "market_trend": "Strong demand",
            "salary_range": {"formatted": "₹15L - ₹30L"},
        },
    ))
    db.commit()
    db.close()

    response = client.get("/market/history", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data
    assert data[0]["target_role"] == "Backend Engineer"
    assert data[0]["location"] == "Bangalore, India"
    assert data[0]["analysis"]["market_trend"] == "Strong demand"


def test_roadmap_input_validation_before_agent_call():
    _, _, registered = _register_user()
    response = client.post(
        "/roadmap/generate",
        json={"target_role": "Developer", "skill_gaps": []},
        headers=_auth_headers(registered["access_token"]),
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "skill_gaps list must not be empty."


def test_resume_upload_rejects_non_pdf_content():
    _, _, registered = _register_user()
    response = client.post(
        "/resume/upload",
        files={"file": ("resume.pdf", b"not a real pdf", "application/pdf")},
        headers=_auth_headers(registered["access_token"]),
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid PDF file content."


def test_daily_rate_limit_blocks_after_limit():
    """Rate limit test: increments exactly at the DAILY_LIMITS value, then checks for 429."""
    rate_limit.redis_client = None
    rate_limit._usage_fallback.clear()
    user_id = f"rate-test-{uuid.uuid4().hex}"
    feature = "roadmap"

    original_debug = rate_limit.settings.DEBUG
    rate_limit.settings.DEBUG = False
    try:
        # FIX: read actual limit instead of hard-coding 5 (limit is 3)
        limit = rate_limit.DAILY_LIMITS[feature]
        for _ in range(limit):
            rate_limit.increment_usage(user_id, feature)

        with pytest.raises(HTTPException) as exc:
            rate_limit.check_daily_limit(user_id, feature)

        assert exc.value.status_code == 429
    finally:
        rate_limit.settings.DEBUG = original_debug
