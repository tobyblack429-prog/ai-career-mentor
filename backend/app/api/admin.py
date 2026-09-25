from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, date, timedelta, timezone
import json

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.models import User, DailyAnalytics, ActivityLog
from app.core.config import settings
from app.core.limiter import limiter
from app.core.observability import (
    get_active_users_count,
    get_error_logs,
    _in_memory_metrics,
    sync_redis_to_postgres,
    redis_client,
)

router = APIRouter()

def verify_admin_user(current_user: User = Depends(get_current_user)):
    if current_user.email.strip().lower() != settings.ADMIN_EMAIL.strip().lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Admin access required",
        )
    return current_user


@router.get("/access", summary="Check whether the current user is an administrator")
async def get_admin_access(admin: User = Depends(verify_admin_user)):
    return {"authorized": True}

@router.get("/metrics", summary="Retrieve all real-time observability metrics")
@limiter.exempt
async def get_admin_metrics(
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(verify_admin_user),
):
    # Trigger a sync rollup for today's metrics
    sync_redis_to_postgres(db)

    # 0. Fetch total registered users
    db_users_count = db.query(User).count()
    if redis_client:
        try:
            val = redis_client.get("metrics:total_users")
            redis_users_count = int(val) if val else 0
            if db_users_count > 0:
                redis_client.set("metrics:total_users", db_users_count)
                total_users = db_users_count
            else:
                total_users = max(redis_users_count, db_users_count)
        except Exception:
            total_users = db_users_count
    else:
        if db_users_count > 0:
            _in_memory_metrics["total_users"] = db_users_count
            total_users = db_users_count
        else:
            total_users = max(_in_memory_metrics.get("total_users", 0), db_users_count)

    # 1. Fetch live active connections
    active_users = get_active_users_count()

    # 2. Get sliding window latencies (last 50 requests)
    latencies = {}
    providers = ["nvidia", "openrouter", "groq", "google"]
    for p in providers:
        if redis_client:
            try:
                lats = redis_client.lrange(f"metrics:latency:{p}", 0, 49)
                latencies[p] = [float(l) for l in lats]
            except Exception:
                latencies[p] = []
        else:
            latencies[p] = _in_memory_metrics["latencies"].get(p, [])

    # 3. Get rolling error logs (last 10 exceptions)
    error_logs = get_error_logs()

    # 4. Get historical daily analytics rows from DB (last 7 days)
    history = db.query(DailyAnalytics).order_by(DailyAnalytics.date.desc()).limit(7).all()

    # 5. Totals across all users (all-time counts from activity log)
    total_resumes = db.query(ActivityLog).filter(ActivityLog.feature == "resume").count()
    total_interviews = db.query(ActivityLog).filter(ActivityLog.feature == "interview").count()
    total_career_analyses = db.query(ActivityLog).filter(ActivityLog.feature == "full_analysis").count()
    total_roadmaps = db.query(ActivityLog).filter(ActivityLog.feature == "roadmap").count()

    # 6. response_totals placeholder
    response_totals = {}

    # 7. Fetch all-time total LLM costs
    total_costs = db.query(
        func.sum(DailyAnalytics.groq_cost),
        func.sum(DailyAnalytics.nvidia_cost),
        func.sum(DailyAnalytics.google_cost),
        func.sum(DailyAnalytics.openrouter_cost)
    ).first()
    
    db_groq_cost = float(total_costs[0] or 0.0) if total_costs else 0.0
    db_nvidia_cost = float(total_costs[1] or 0.0) if total_costs else 0.0
    db_google_cost = float(total_costs[2] or 0.0) if total_costs else 0.0
    db_openrouter_cost = float(total_costs[3] or 0.0) if total_costs else 0.0

    if redis_client:
        try:
            val_groq = redis_client.get("metrics:total_cost:groq")
            val_nvidia = redis_client.get("metrics:total_cost:nvidia")
            val_openrouter = redis_client.get("metrics:total_cost:openrouter")
            val_google = redis_client.get("metrics:total_cost:google")

            redis_groq = float(val_groq) if val_groq else 0.0
            redis_nvidia = float(val_nvidia) if val_nvidia else 0.0
            redis_openrouter = float(val_openrouter) if val_openrouter else 0.0
            redis_google = float(val_google) if val_google else 0.0

            if db_groq_cost > redis_groq:
                redis_client.set("metrics:total_cost:groq", db_groq_cost)
                redis_groq = db_groq_cost
            if db_nvidia_cost > redis_nvidia:
                redis_client.set("metrics:total_cost:nvidia", db_nvidia_cost)
                redis_nvidia = db_nvidia_cost
            if db_openrouter_cost > redis_openrouter:
                redis_client.set("metrics:total_cost:openrouter", db_openrouter_cost)
                redis_openrouter = db_openrouter_cost
            if db_google_cost > redis_google:
                redis_client.set("metrics:total_cost:google", db_google_cost)
                redis_google = db_google_cost

            total_groq_cost = max(redis_groq, db_groq_cost)
            total_nvidia_cost = max(redis_nvidia, db_nvidia_cost)
            total_openrouter_cost = max(redis_openrouter, db_openrouter_cost)
            total_google_cost = max(redis_google, db_google_cost)
        except Exception:
            total_groq_cost = db_groq_cost
            total_nvidia_cost = db_nvidia_cost
            total_openrouter_cost = db_openrouter_cost
            total_google_cost = db_google_cost
    else:
        total_groq_cost = max(_in_memory_metrics.get("total_cost_groq", 0.0), db_groq_cost)
        total_nvidia_cost = max(_in_memory_metrics.get("total_cost_nvidia", 0.0), db_nvidia_cost)
        total_openrouter_cost = max(_in_memory_metrics.get("total_cost_openrouter", 0.0), db_openrouter_cost)
        total_google_cost = max(_in_memory_metrics.get("total_cost_google", 0.0), db_google_cost)

    # 7. Fetch daily breakdown of activities for the last 7 days
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=7)
    daily_logs = db.query(ActivityLog).filter(ActivityLog.created_at >= cutoff_date).all()
    
    daily_activity = {}  # (date_str, feature) -> count
    for log in daily_logs:
        log_date = log.created_at.strftime("%Y-%m-%d")
        daily_activity[(log_date, log.feature)] = daily_activity.get((log_date, log.feature), 0) + 1

    # 8. Format historical chart items with counts and provider costs
    historical_chart = [
        {
            "date": h.date.strftime("%Y-%m-%d") if isinstance(h.date, (datetime, date)) else str(h.date),
            "requests": int(h.total_requests),
            "tokens": int(h.total_tokens),
            "cost": round(h.estimated_cost, 4),
            "fallbacks": int(h.fallback_count),
            "errors": int(h.error_count),
            
            # Daily breakdown of execution counts
            "resumes": daily_activity.get((h.date.strftime("%Y-%m-%d") if isinstance(h.date, (datetime, date)) else str(h.date), "resume"), 0),
            "interviews": daily_activity.get((h.date.strftime("%Y-%m-%d") if isinstance(h.date, (datetime, date)) else str(h.date), "interview"), 0),
            "roadmaps": daily_activity.get((h.date.strftime("%Y-%m-%d") if isinstance(h.date, (datetime, date)) else str(h.date), "roadmap"), 0),
            "full_analyses": daily_activity.get((h.date.strftime("%Y-%m-%d") if isinstance(h.date, (datetime, date)) else str(h.date), "full_analysis"), 0),
            
            # Daily breakdown of costs by model
            "groq_cost": round(h.groq_cost or 0.0, 4),
            "nvidia_cost": round(h.nvidia_cost or 0.0, 4),
            "openrouter_cost": round(h.openrouter_cost or 0.0, 4),
            "google_cost": round(h.google_cost or 0.0, 4),
        }
        for h in reversed(history)
    ]

    response_totals["groq_cost"] = round(total_groq_cost, 4)
    response_totals["nvidia_cost"] = round(total_nvidia_cost, 4)
    response_totals["openrouter_cost"] = round(total_openrouter_cost, 4)
    response_totals["google_cost"] = round(total_google_cost, 4)
    response_totals["all_time_cost"] = round(total_groq_cost + total_nvidia_cost + total_openrouter_cost + total_google_cost, 4)

    return {
        "active_users": active_users,
        "total_users": total_users,
        "active_websockets": 0,
        "latencies": latencies,
        "error_logs": error_logs,
        "historical_chart": historical_chart,
        "totals": response_totals,
        "system_totals": {
            "total_resumes": total_resumes,
            "total_interviews": total_interviews,
            "total_career_analyses": total_career_analyses,
            "total_roadmaps": total_roadmaps,
        },
        "settings": {
            "llm_provider": "hybrid",
            "active_model": settings.active_model,
        }
    }
