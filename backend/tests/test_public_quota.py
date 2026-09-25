import pytest
from fastapi import HTTPException

from app.core import rate_limit


class FakePipeline:
    def __init__(self, values):
        self.values = values
        self.commands = []

    def incr(self, key):
        self.commands.append(("incr", key))
        return self

    def expire(self, key, seconds):
        self.commands.append(("expire", key, seconds))
        return self

    def execute(self):
        results = []
        for command in self.commands:
            if command[0] == "incr":
                key = command[1]
                self.values[key] = self.values.get(key, 0) + 1
                results.append(self.values[key])
            else:
                results.append(True)
        return results


class FakeRedis:
    def __init__(self):
        self.values = {}

    def pipeline(self, transaction=True):
        return FakePipeline(self.values)


def test_public_session_quota_is_shared_across_cookie_resets(monkeypatch):
    monkeypatch.setattr(rate_limit.settings, "PUBLIC_ANONYMOUS_ACCESS", True, raising=False)
    fake = FakeRedis()
    monkeypatch.setattr(rate_limit, "redis_client", fake)
    for _ in range(5):
        rate_limit.reserve_public_quota("203.0.113.12", "session")
    with pytest.raises(HTTPException) as error:
        rate_limit.reserve_public_quota("203.0.113.12", "session")
    assert error.value.status_code == 429
    assert all("203.0.113.12" not in key for key in fake.values)


def test_public_quota_fails_closed_without_redis(monkeypatch):
    monkeypatch.setattr(rate_limit.settings, "PUBLIC_ANONYMOUS_ACCESS", True, raising=False)
    monkeypatch.setattr(rate_limit, "redis_client", None)
    with pytest.raises(HTTPException) as error:
        rate_limit.reserve_public_quota("203.0.113.12", "resume")
    assert error.value.status_code == 503
