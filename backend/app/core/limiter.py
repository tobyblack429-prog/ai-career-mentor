# Copyright (c) 2026 Anil Pradhan. All rights reserved.
import os
from slowapi import Limiter
from slowapi.middleware import SlowAPIMiddleware, _should_exempt, sync_check_limits
from slowapi.util import get_remote_address
from starlette.routing import Match
from app.core.config import settings

_limit_rules = ["100000/day"] if settings.DEBUG else ["1000/day", "100/hour"]
_redis_url = os.getenv("REDIS_URL", "memory://")

# Force in-memory rate limiting in local development to avoid slow/unstable external network queries
if settings.DEBUG or os.getenv("APP_ENV") == "development":
    _redis_url = "memory://"

_storage_options = {}
if _redis_url.startswith(("redis://", "rediss://", "redis+unix://")):
    _storage_options = {
        "socket_connect_timeout": 3,
        "socket_timeout": 3,
        "wrap_exceptions": True,
    }

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=_limit_rules,
    storage_uri=_redis_url,
    storage_options=_storage_options,
)


def _matching_handler(routes, scope):
    """Resolve both classic routes and FastAPI's prefixed included-router contexts."""
    for route in routes:
        match_scope = dict(scope)
        for key in ("path_params", "fastapi"):
            if isinstance(match_scope.get(key), dict):
                match_scope[key] = dict(match_scope[key])
        match, child_scope = route.matches(match_scope)
        if match != Match.FULL:
            continue
        handler = child_scope.get("endpoint") or getattr(route, "endpoint", None)
        if handler is not None:
            return handler
        candidates = getattr(route, "effective_candidates", None)
        if callable(candidates):
            # These effective contexts preserve all include_router prefixes.
            return _matching_handler(candidates(), scope)
        # Follow the first matching route, just like Starlette/FastAPI. A later
        # overlapping route must never lend its exemption to the selected one.
        return None
    return None


class CompatibleSlowAPIMiddleware(SlowAPIMiddleware):
    """Keep SlowAPI enforcement working with FastAPI's lazy included routers."""

    async def dispatch(self, request, call_next):
        application = request.app
        request_limiter = application.state.limiter
        if not request_limiter.enabled:
            return await call_next(request)

        handler = _matching_handler(application.routes, request.scope)
        if _should_exempt(request_limiter, handler):
            return await call_next(request)

        error, inject_headers = sync_check_limits(
            request_limiter, request, handler, application
        )
        if error is not None:
            return error
        response = await call_next(request)
        if inject_headers:
            response = request_limiter._inject_headers(
                response, request.state.view_rate_limit
            )
        return response
