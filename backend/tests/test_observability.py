import pytest
import time
from fastapi.testclient import TestClient

from app.core import observability as obs
from app.core.database import Base, engine
from app.main import app
from app.models.models import User

# Bind metadata to test SQLite database
Base.metadata.create_all(bind=engine)
client = TestClient(app)

def test_in_memory_observability_helpers():
    # Force in-memory tracking in test environment
    original_client = obs.redis_client
    obs.redis_client = None
    
    try:
        # Reset in-memory dict state
        obs._in_memory_metrics["total_requests"] = 0
        obs._in_memory_metrics["total_tokens"] = 0
        obs._in_memory_metrics["estimated_cost"] = 0.0
        obs._in_memory_metrics["fallback_count"] = 0
        obs._in_memory_metrics["active_users"] = {}
        obs._in_memory_metrics["error_logs"] = []
        obs._in_memory_metrics["error_count"] = 0
        obs._in_memory_metrics["latencies"] = {}

        # 1. Test LLM caller metrics
        obs.track_llm_call("groq", 0.75, 500, 1500)
        assert obs._in_memory_metrics["total_requests"] == 1
        assert obs._in_memory_metrics["total_tokens"] == 2000
        # pricing check: groq rates are $0.59/M input, $0.79/M output
        # cost = (500 / 1e6 * 0.59) + (1500 / 1e6 * 0.79) = 0.000295 + 0.001185 = 0.00148
        assert abs(obs._in_memory_metrics["estimated_cost"] - 0.00148) < 1e-6
        assert len(obs._in_memory_metrics["latencies"]["groq"]) == 1
        assert obs._in_memory_metrics["latencies"]["groq"][0] == 0.75

        # 2. Test fallback counting
        obs.increment_fallback("groq", "google")
        assert obs._in_memory_metrics["fallback_count"] == 1

        # 3. Test active WebSocket connections tracking (Removed)
        pass

        # 4. Test active user sessions (ZSET simulation)
        obs.track_active_user("user-100")
        obs.track_active_user("user-101")
        assert obs.get_active_users_count() == 2

        # 5. Test error tracking
        obs.track_error("Database connection timeout", "Traceback: Line 45 in db.py")
        logs = obs.get_error_logs()
        assert len(logs) == 1
        assert logs[0]["message"] == "Database connection timeout"
        assert logs[0]["traceback"] == "Traceback: Line 45 in db.py"

        # 6. Test user registration tracking fallback
        obs._in_memory_metrics["total_users"] = 0
        obs.track_user_registration()
        assert obs._in_memory_metrics["total_users"] == 1
        obs.track_user_registration()
        assert obs._in_memory_metrics["total_users"] == 2

        # 7. Test activity tracking fallback
        obs._in_memory_metrics["total_activity_resume"] = 0
        obs.track_activity("resume")
        assert obs._in_memory_metrics["total_activity_resume"] == 1
        obs.track_activity("resume")
        assert obs._in_memory_metrics["total_activity_resume"] == 2

    finally:
        obs.redis_client = original_client


def test_admin_metrics_endpoint_access_control():
    import uuid
    from app.core.database import SessionLocal

    # 1. Register a regular user and get access token
    normal_email = f"regular-user-{uuid.uuid4().hex}@example.com"
    client.post("/auth/register", json={
        "name": "Regular User",
        "email": normal_email,
        "password": "strong-password-123"
    })
    
    login_resp = client.post("/auth/login", json={
        "email": normal_email,
        "password": "strong-password-123"
    })
    assert login_resp.status_code == 200
    normal_token = login_resp.json()["access_token"]

    # 2. Assert that standard user receives 403 Forbidden
    unauthorized_resp = client.get("/admin/metrics", headers={"Authorization": f"Bearer {normal_token}"})
    assert unauthorized_resp.status_code == 403
    assert "Forbidden" in unauthorized_resp.json()["detail"]
    assert client.get("/admin/access", headers={"Authorization": f"Bearer {normal_token}"}).status_code == 403

    # 3. Register the whitelisted administrator and get access token
    admin_email = "admin@example.com"
    
    # Delete admin user if exists in DB to prevent registration bad requests
    db = SessionLocal()
    db.query(User).filter(User.email == admin_email).delete()
    db.commit()
    db.close()

    client.post("/auth/register", json={
        "name": "Administrator",
        "email": admin_email,
        "password": "admin-password-99"
    })
    
    login_resp = client.post("/auth/login", json={
        "email": admin_email,
        "password": "admin-password-99"
    })
    assert login_resp.status_code == 200
    admin_token = login_resp.json()["access_token"]

    # 4. Assert that admin receives 200 OK and valid telemetry schema
    authorized_resp = client.get("/admin/metrics", headers={"Authorization": f"Bearer {admin_token}"})
    assert authorized_resp.status_code == 200
    assert client.get("/admin/access", headers={"Authorization": f"Bearer {admin_token}"}).json() == {"authorized": True}
    data = authorized_resp.json()
    assert "active_users" in data
    assert "active_websockets" in data
    assert "latencies" in data
    assert "error_logs" in data
    assert "historical_chart" in data
