"""Provider availability should not require credentials for every service."""

import pytest

from app.core.config import Settings


@pytest.mark.parametrize("available_key", ["GROQ_API_KEY", "GOOGLE_API_KEY", "NVIDIA_API_KEY", "SILICONFLOW_API_KEY"])
def test_one_provider_key_is_enough(available_key):
    settings = Settings()
    settings.LLM_PROVIDER = "groq"
    for key in ("GROQ_API_KEY", "GOOGLE_API_KEY", "NVIDIA_API_KEY", "SILICONFLOW_API_KEY"):
        setattr(settings, key, "test-key" if key == available_key else "")

    assert settings.is_configured


def test_no_provider_key_is_not_configured():
    settings = Settings()
    settings.LLM_PROVIDER = "groq"
    settings.GROQ_API_KEY = ""
    settings.GOOGLE_API_KEY = ""
    settings.NVIDIA_API_KEY = ""
    settings.SILICONFLOW_API_KEY = ""

    assert not settings.is_configured


def test_siliconflow_mode_requires_its_own_key():
    settings = Settings()
    settings.LLM_PROVIDER = "siliconflow"
    settings.SILICONFLOW_API_KEY = ""
    settings.GROQ_API_KEY = "test-key"
    assert not settings.is_configured

    settings.SILICONFLOW_API_KEY = "test-key"
    assert settings.is_configured
    assert settings.active_model == settings.SILICONFLOW_MODEL
