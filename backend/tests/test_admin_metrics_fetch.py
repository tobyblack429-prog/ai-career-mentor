import os
import sys
from dotenv import load_dotenv
from sqlalchemy.orm import Session

# Add backend directory to sys.path so we can import app modules
sys.path.append(r"c:\Users\ANIL\Desktop\ai-career-mentor\backend")

# Load environment
dotenv_path = r"c:\Users\ANIL\Desktop\ai-career-mentor\backend\.env"
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path)
    print("Loaded .env successfully.")

from app.core.database import SessionLocal
from app.models.models import User, DailyAnalytics
from app.agents.registry import call_llm
from app.core import observability as obs
from app.core.config import settings

def test_pipeline():
    db = SessionLocal()
    admin_email = "admin@example.com"
    
    # 1. Check if admin user exists, if not create one for testing
    user = db.query(User).filter(User.email == admin_email).first()
    if not user:
        print(f"Admin user {admin_email} not found. Creating a test one...")
        user = User(
            name="Anil Pradhan",
            email=admin_email,
            hashed_pw="test_hashed_password"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        print("Created admin user.")
    else:
        print(f"Admin user exists: {user}")

    print("\n--- Current Redis Client State ---")
    print("redis_client:", obs.redis_client)
    
    # If redis_client is None because settings.DEBUG is True, we can temporarily force it for the test
    # to make sure the Redis pipeline works as expected.
    import redis
    import ssl
    original_redis = obs.redis_client
    redis_url = os.getenv("REDIS_URL", "")
    if not obs.redis_client and redis_url:
        print("Forcing Redis client connection for test...")
        try:
            obs.redis_client = redis.from_url(
                redis_url,
                decode_responses=True,
                socket_connect_timeout=3,
                socket_timeout=3,
                ssl_cert_reqs=ssl.CERT_NONE,
            )
            obs.redis_client.ping()
            print("Forced Redis client ping successful")
        except Exception as e:
            print(f"Redis connection failed ({e}), falling back to in-memory metrics for testing.")
            obs.redis_client = None

    try:
        # Clear/initialize some test metrics in Redis for today to have clean logs
        from datetime import datetime, timezone
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        
        # 2. Track a simulated LLM call
        print("\n--- Simulating LLM Calls ---")
        print("Tracking LLM call on groq...")
        obs.track_llm_call(provider="groq", latency=0.45, input_tokens=800, output_tokens=1200)
        
        print("Tracking LLM call on nvidia...")
        obs.track_llm_call(provider="nvidia", latency=1.20, input_tokens=500, output_tokens=900)

        print("Tracking LLM call on google...")
        obs.track_llm_call(provider="google", latency=0.85, input_tokens=1000, output_tokens=1500)

        # 3. Track active websockets and user
        print("\n--- Simulating active websockets and users ---")
        obs.track_active_user(user.id)

        # 4. Track errors
        print("\n--- Simulating error tracking ---")
        obs.track_error("Simulated Test Error", "Traceback for testing pipeline")

        # 5. Sync to Postgres
        print("\n--- Testing Redis -> Postgres Sync ---")
        # Reset last sync time to bypass 60-second guard
        obs._last_sync_time = 0.0
        obs.sync_redis_to_postgres(db)

        # 6. Retrieve metrics from DB
        analytics = db.query(DailyAnalytics).filter(DailyAnalytics.date == datetime.now(timezone.utc).date()).first()
        print("\n--- Verification from Database ---")
        if analytics:
            print("Postgres DailyAnalytics record found!")
            print(f"Date: {analytics.date}")
            print(f"Total Requests: {analytics.total_requests}")
            print(f"Total Tokens: {analytics.total_tokens}")
            print(f"Estimated Cost: ${analytics.estimated_cost:.6f}")
            print(f"Fallback Count: {analytics.fallback_count}")
            print(f"Error Count: {analytics.error_count}")
        else:
            print("ERROR: Postgres DailyAnalytics record not created!")

        # 7. Check admin API metrics payload
        # This mirrors app.api.admin.get_admin_metrics logic
        print("\n--- Reconstructing Admin API payload ---")
        active_users = obs.get_active_users_count()
        active_ws = 0

        latencies = {}
        for p in ["nvidia", "groq", "google"]:
            if obs.redis_client:
                lats = obs.redis_client.lrange(f"metrics:latency:{p}", 0, 49)
                latencies[p] = [float(l) for l in lats]
            else:
                latencies[p] = obs._in_memory_metrics["latencies"].get(p, [])

        error_logs = obs.get_error_logs()
        
        history = db.query(DailyAnalytics).order_by(DailyAnalytics.date.desc()).limit(7).all()
        historical_chart = [
            {
                "date": str(h.date),
                "requests": h.total_requests,
                "tokens": h.total_tokens,
                "cost": round(h.estimated_cost, 4),
                "fallbacks": h.fallback_count,
                "errors": h.error_count,
            }
            for h in reversed(history)
        ]

        payload = {
            "active_users": active_users,
            "active_websockets": active_ws,
            "latencies": latencies,
            "error_logs": error_logs,
            "historical_chart": historical_chart,
            "settings": {
                "llm_provider": "hybrid",
                "active_model": settings.active_model,
            }
        }
        print("API payload successfully generated:")
        import json
        print(json.dumps(payload, indent=2))

    finally:
        # Restore original client state
        obs.redis_client = original_redis
        db.close()

def test_metrics_persistence_on_db_wipe():
    """
    Test that when database is cleared/wiped, metrics continue to be fetched
    from Redis and do not drop to 0.
    """
    import redis
    import os
    from datetime import datetime, timezone
    from app.core.database import SessionLocal
    from app.models.models import User, DailyAnalytics, ActivityLog
    from app.api import admin
    from app.api.admin import get_admin_metrics
    from fastapi import Request
    from unittest.mock import Mock

    db = SessionLocal()
    original_redis = obs.redis_client
    original_admin_redis = admin.redis_client
    redis_url = os.getenv("REDIS_URL", "")
    
    # Force Redis for testing
    if redis_url:
        try:
            obs.redis_client = redis.from_url(
                redis_url,
                decode_responses=True,
                socket_connect_timeout=3,
                socket_timeout=3,
                ssl_cert_reqs=ssl.CERT_NONE,
            )
            obs.redis_client.ping()
        except Exception as e:
            print(f"Redis connection failed ({e}), falling back to in-memory metrics for testing.")
            obs.redis_client = None
    else:
        obs.redis_client = None

    admin.redis_client = obs.redis_client

    try:
        # Clear existing keys in Redis/In-memory
        if obs.redis_client:
            obs.redis_client.delete("metrics:total_users")
            obs.redis_client.delete("metrics:total_cost:groq")
        else:
            obs._in_memory_metrics["total_users"] = 0
            obs._in_memory_metrics["total_cost_groq"] = 0.0

        # 1. Simulate user registration, activity log, and LLM call
        obs.track_user_registration()
        obs.track_activity("resume")
        obs.track_llm_call("groq", 0.5, 500, 1500) # cost = 500/1M * 0.59 + 1500/1M * 0.79 = 0.00148
        
        # Also put items in DB
        user_test = User(name="Wipe User", email="wipe@test.com", hashed_pw="pw")
        db.add(user_test)
        db.commit()
        db.refresh(user_test)

        log_test = ActivityLog(user_id=user_test.id, action="Generated Resume", feature="resume")
        db.add(log_test)
        
        obs._last_sync_time = 0.0
        obs.sync_redis_to_postgres(db)
        db.commit()

        # 2. Get metrics before wipe
        mock_request = Mock(spec=Request)
        mock_admin = Mock(spec=User)
        mock_admin.email = settings.ADMIN_EMAIL

        import asyncio
        async def run_metrics():
            return await get_admin_metrics(request=mock_request, db=db, admin=mock_admin)

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        metrics_before = loop.run_until_complete(run_metrics())

        assert metrics_before["total_users"] >= 1
        assert metrics_before["totals"]["groq_cost"] > 0

        # 3. Wipe the database (simulate reset)
        db.query(ActivityLog).delete()
        db.query(DailyAnalytics).delete()
        db.query(User).delete()
        db.commit()

        # 4. Get metrics after wipe - they MUST NOT be 0!
        metrics_after = loop.run_until_complete(run_metrics())
        loop.close()

        assert metrics_after["total_users"] >= 1
        assert metrics_after["totals"]["groq_cost"] > 0
        print("Metrics persistence on DB wipe verified successfully!")

    finally:
        obs.redis_client = original_redis
        admin.redis_client = original_admin_redis
        db.close()

if __name__ == "__main__":
    test_pipeline()
    test_metrics_persistence_on_db_wipe()
