"""
Per-user daily AI feature rate limiter.

Uses Redis (Upstash) to track usage across multiple workers and restarts.
Falls back to in-memory tracking if REDIS_URL is not configured.

Bypassed if settings.DEBUG is True (Local machine testing).
"""

import os
import hashlib
import hmac
from datetime import timezone, datetime, timedelta
from typing import Optional
from fastapi import HTTPException, status
from loguru import logger
import redis
from app.core.config import settings

# ── Limits config ─────────────────────────────────────────────────────────────
DAILY_LIMITS: dict[str, int] = {
    "interview":     1,
    "resume":        1,
    "roadmap":       1,
    "full_analysis": 1,
    "linkedin":      1,
    "market":        1,
}

# Anonymous public demos need a second quota that survives cookie deletion.
# These are intentionally small because each request can consume a paid model call.
PUBLIC_IP_DAILY_LIMITS: dict[str, int] = {
    "session": 5,
    "interview": 2,
    "resume": 3,
    "resume_upload": 5,
    "roadmap": 3,
    "full_analysis": 2,
    "linkedin": 3,
    "market": 3,
}
PUBLIC_GLOBAL_DAILY_LIMIT = 60

GAP_BLOCK_DAYS: dict[str, int] = {
    "full_analysis": 7,
    "interview": 7,
    "roadmap": 5,
    "resume": 2,
}

# ── Redis Connection ──────────────────────────────────────────────────────────
REDIS_URL = os.getenv("REDIS_URL", "")
redis_client = None

if REDIS_URL and not settings.DEBUG:
    try:
        # Add 3s timeout to prevent startup hang on slow networks
        redis_client = redis.from_url(
            REDIS_URL, 
            decode_responses=True,
            socket_connect_timeout=3,
            socket_timeout=3
        )
        redis_client.ping()
        logger.info("Upstash Redis connection established for rate limiting.")
    except Exception as e:
        logger.error(f"Failed to connect to Redis: {e}. Falling back to in-memory.")
        redis_client = None

# ── In-memory Fallback ────────────────────────────────────────────────────────
_usage_fallback: dict[str, dict[str, dict]] = {}
_usage_block_fallback: dict[str, dict[str, dict]] = {}


def _get_today_str() -> str:
    """Current UTC date string (YYYY-MM-DD)."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def reserve_public_quota(client_ip: str, feature: str) -> None:
    """Atomically reserve an IP and site-wide slot before a public AI call."""
    if not getattr(settings, "PUBLIC_ANONYMOUS_ACCESS", False):
        return
    if feature not in PUBLIC_IP_DAILY_LIMITS:
        raise ValueError("Unknown public quota feature")
    if redis_client is None:
        raise HTTPException(status_code=503, detail="公开服务限额暂不可用，请稍后再试。")

    safe_ip = (client_ip or "unknown").split(",", 1)[0].strip()
    ip_digest = hmac.new(
        settings.SECRET_KEY.encode("utf-8"), safe_ip.encode("utf-8"), hashlib.sha256
    ).hexdigest()[:32]
    today = _get_today_str()
    ip_key = f"public:ip:{ip_digest}:{feature}:{today}"
    global_key = f"public:global:{today}"
    try:
        transaction = redis_client.pipeline(transaction=True)
        transaction.incr(ip_key)
        transaction.expire(ip_key, 172800)
        if feature != "session":
            transaction.incr(global_key)
            transaction.expire(global_key, 172800)
        counts = transaction.execute()
    except Exception:
        logger.error("Public quota storage unavailable")
        raise HTTPException(status_code=503, detail="公开服务限额暂不可用，请稍后再试。")

    if int(counts[0]) > PUBLIC_IP_DAILY_LIMITS[feature]:
        raise HTTPException(status_code=429, detail="当前网络的今日使用次数已达上限。")
    if feature != "session" and int(counts[2]) > PUBLIC_GLOBAL_DAILY_LIMIT:
        raise HTTPException(status_code=429, detail="网站今日 AI 体验额度已用完，请明天再试。")


def get_usage(user_id: str | int, feature: str) -> int:
    """Return how many times this user has used this feature today."""
    uid = str(user_id)
    today = _get_today_str()
    key = f"usage:{uid}:{feature}:{today}"

    if redis_client:
        try:
            val = redis_client.get(key)
            return int(val) if val else 0
        except Exception as e:
            logger.error(f"Redis get error: {e}")

    bucket = _usage_fallback.get(uid, {}).get(feature)
    if not bucket or bucket["date"] != today:
        return 0
    return bucket["count"]


def increment_usage(user_id: str | int, feature: str) -> int:
    """Increment counter for this user/feature. Returns new count."""
    uid = str(user_id)
    today = _get_today_str()
    key = f"usage:{uid}:{feature}:{today}"

    if redis_client:
        try:
            new_count = redis_client.incr(key)
            if new_count == 1:
                redis_client.expire(key, timedelta(days=1))
            
            logger.info(f"[rate_limit] Redis increment: user={uid} feature={feature} count={new_count}")

            # Enforce multi-day gap block ONLY if limit is reached
            if feature in GAP_BLOCK_DAYS and new_count >= DAILY_LIMITS.get(feature, 1):
                days = GAP_BLOCK_DAYS[feature]
                seconds = days * 24 * 3600
                try:
                    redis_client.set(f"usage_block:{uid}:{feature}", "blocked", ex=seconds)
                    logger.info(f"[rate_limit] Set {days}-day gap block for user={uid} feature={feature} (limit reached)")
                except Exception as e:
                    logger.error(f"Redis setex block error: {e}")

            return int(new_count)
        except Exception as e:
            logger.error(f"Redis incr error: {e}")

    if uid not in _usage_fallback:
        _usage_fallback[uid] = {}

    bucket = _usage_fallback[uid].get(feature)
    if not bucket or bucket["date"] != today:
        _usage_fallback[uid][feature] = {"date": today, "count": 0}

    _usage_fallback[uid][feature]["count"] += 1
    new_count = _usage_fallback[uid][feature]["count"]

    logger.info(f"[rate_limit] In-memory increment: user={uid} feature={feature} count={new_count}")

    # Enforce multi-day gap block ONLY if limit is reached
    if feature in GAP_BLOCK_DAYS and new_count >= DAILY_LIMITS.get(feature, 1):
        days = GAP_BLOCK_DAYS[feature]
        if uid not in _usage_block_fallback:
            _usage_block_fallback[uid] = {}
        _usage_block_fallback[uid][feature] = {
            "expires_at": datetime.now(timezone.utc) + timedelta(days=days)
        }
        logger.info(f"[rate_limit] Set in-memory {days}-day gap block for user={uid} feature={feature} (limit reached)")

    return new_count


def check_daily_limit(user_id: str | int, feature: str) -> None:
    """
    Check if user has exceeded their daily limit for this feature.
    Raises HTTP 429 if limit is reached.
    """
    # Bypass for local development/testing
    if settings.DEBUG:
        return

    uid = str(user_id)

    # Check multi-day gap block
    if feature in GAP_BLOCK_DAYS:
        days = GAP_BLOCK_DAYS[feature]
        if redis_client:
            try:
                block_exists = redis_client.exists(f"usage_block:{uid}:{feature}")
                if block_exists:
                    logger.warning(f"[rate_limit] {days}-DAY GAP ACTIVE user={user_id} feature={feature}")
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail=f"This feature can only be accessed once every {days} days. Please try again later.",
                    )
            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"Redis block check error: {e}")
        else:
            block = _usage_block_fallback.get(uid, {}).get(feature)
            if block:
                now = datetime.now(timezone.utc)
                if now < block["expires_at"]:
                    logger.warning(f"[rate_limit] In-memory {days}-day gap active user={user_id} feature={feature}")
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail=f"This feature can only be accessed once every {days} days. Please try again later.",
                    )

    if feature not in DAILY_LIMITS:
        return

    limit = DAILY_LIMITS[feature]
    current = get_usage(user_id, feature)

    if current >= limit:
        feature_display = feature.replace("_", " ").title()
        logger.warning(f"[rate_limit] LIMIT REACHED user={user_id} feature={feature} limit={limit}")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"Your daily limit for {feature_display} has been reached "
                f"({limit} uses/day). Please try again tomorrow."
            ),
        )


def is_gap_blocked(user_id: str | int, feature: str) -> bool:
    """Return True if the user is currently under a gap block for this feature."""
    if settings.DEBUG:
        return False
    if feature not in GAP_BLOCK_DAYS:
        return False
        
    uid = str(user_id)
    if redis_client:
        try:
            return bool(redis_client.exists(f"usage_block:{uid}:{feature}"))
        except Exception as e:
            logger.error(f"Redis gap block check error: {e}")
            
    # Check in-memory fallback
    block = _usage_block_fallback.get(uid, {}).get(feature)
    if block:
        if datetime.now(timezone.utc) < block["expires_at"]:
            return True
            
    return False


def get_gap_block_remaining_seconds(user_id: str | int, feature: str) -> Optional[int]:
    """Return seconds remaining on a gap block for this feature, or None if not blocked."""
    if settings.DEBUG or feature not in GAP_BLOCK_DAYS:
        return None

    uid = str(user_id)
    if redis_client:
        try:
            ttl = redis_client.ttl(f"usage_block:{uid}:{feature}")
            return int(ttl) if ttl and ttl > 0 else None
        except Exception as e:
            logger.error(f"Redis block ttl error: {e}")

    block = _usage_block_fallback.get(uid, {}).get(feature)
    if block:
        remaining = (block["expires_at"] - datetime.now(timezone.utc)).total_seconds()
        return int(remaining) if remaining > 0 else None

    return None
