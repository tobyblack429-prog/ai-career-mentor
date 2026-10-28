"""A Redis outage must remain diagnosable without allowing unmetered AI calls."""

from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient
from limits.errors import StorageError
from redis.exceptions import ConnectionError

from app.api import roadmap
from app.core import rate_limit
from app.core.config import settings
from app.core.database import get_db
from app.core.limiter import limiter
from app.main import app


@pytest.fixture
def client(monkeypatch):
    # TestClient without a context manager avoids startup migrations and seeding.
    # conftest.py supplies an isolated test database; no real provider is invoked.
    monkeypatch.setattr(settings, "PUBLIC_ANONYMOUS_ACCESS", False)
    return TestClient(app)


@pytest.fixture
def unavailable_storage(monkeypatch):
    def fail(*args, **kwargs):
        raise StorageError(ConnectionError("simulated storage outage"))

    monkeypatch.setattr(limiter._limiter, "hit", fail)


def test_liveness_still_works_when_rate_limit_storage_fails(client, unavailable_storage):
    assert client.get("/ping").json() == {"pong": True}
    assert client.get("/").status_code == 200
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["database"] == "connected"


def test_regular_requests_fail_closed_with_retry_guidance(client, unavailable_storage):
    response = client.get("/user/stats")
    assert response.status_code == 503
    assert response.json() == {"detail": "访问限额服务暂不可用，请稍后再试。"}
    assert response.headers["retry-after"] == "60"
    assert "simulated storage outage" not in response.text


def test_public_readiness_reports_missing_redis(client, unavailable_storage, monkeypatch):
    monkeypatch.setattr(settings, "PUBLIC_ANONYMOUS_ACCESS", True)
    monkeypatch.setattr(rate_limit, "redis_client", None)
    response = client.get("/health")
    assert response.status_code == 503
    assert response.json()["status"] == "degraded"
    assert response.json()["redis"] == "disconnected"
    assert client.get("/ping").status_code == 200


def test_public_readiness_reports_redis_connection_failure(client, monkeypatch):
    monkeypatch.setattr(settings, "PUBLIC_ANONYMOUS_ACCESS", True)
    redis = Mock()
    redis.ping.side_effect = ConnectionError("simulated Redis outage")
    monkeypatch.setattr(rate_limit, "redis_client", redis)
    response = client.get("/health")
    assert response.status_code == 503
    assert response.json()["redis"] == "disconnected"
    assert "simulated Redis outage" not in response.text


def test_vercel_mounted_probes_bypass_request_limiter(unavailable_storage, monkeypatch):
    from main import app as vercel_app

    monkeypatch.setattr(settings, "PUBLIC_ANONYMOUS_ACCESS", False)
    client = TestClient(vercel_app)
    assert client.get("/api/ping").json() == {"pong": True}
    assert client.get("/api/health").status_code == 200


def test_readiness_reports_database_outage(client):
    class UnavailableDatabase:
        def execute(self, *args, **kwargs):
            raise ConnectionError("simulated database outage")

    previous = app.dependency_overrides.copy()
    app.dependency_overrides[get_db] = lambda: UnavailableDatabase()
    try:
        response = client.get("/health")
        assert response.status_code == 503
        assert response.json()["database"] == "disconnected"
        assert "simulated database outage" not in response.text
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)


def test_public_quota_outage_cannot_reach_ai(client, monkeypatch):
    monkeypatch.setattr(settings, "PUBLIC_ANONYMOUS_ACCESS", True)
    monkeypatch.setattr(rate_limit, "redis_client", None)
    generate = Mock(side_effect=AssertionError("AI must not be called"))
    monkeypatch.setattr(roadmap, "run_roadmap_structure", generate)
    response = client.post(
        "/roadmap/generate",
        json={"target_role": "Developer", "skill_gaps": ["Python"]},
    )
    assert response.status_code == 503
    assert response.json()["detail"] == "公开服务限额暂不可用，请稍后再试。"
    generate.assert_not_called()
