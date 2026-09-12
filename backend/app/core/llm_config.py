"""
LLM Model Configuration Manager — Per-Agent Model Selection.

Each agent in the system gets a dedicated LLM provider + model based on:
1. Its primary capability (structured JSON, reasoning, creative, fast streaming, cheap)
2. .env overrides via AGENT_<NAME>_PROVIDER and AGENT_<NAME>_MODEL
3. Smart fallback chains per capability

This replaces the old "one provider for all" approach.
"""
import os
from typing import Optional

from loguru import logger


# ─────────────────────────────────────────────────────────────────────────────
# Agent Profiles — Maps each agent to its ideal provider/model
# ─────────────────────────────────────────────────────────────────────────────
# Capability legend:
#   structured_json → Needs reliable JSON output (Gemini excels here)
#   reasoning       → Complex analysis, multi-step (Groq is fast + free)
#   creative        → Content generation, strategy (OpenRouter for quality)
#   fast_streaming  → Real-time chat, low latency (Groq is fastest)
#   cheap           → Simple tasks, cost-effective (Groq free tier)
# ─────────────────────────────────────────────────────────────────────────────

AGENT_PROFILES = {
    "resume": {
        "env_prefix": "AGENT_RESUME",
        "capability": "structured_json",
        "default_provider": "groq",
        "default_model": "openai/gpt-oss-120b",
        "default_temperature": 0.3,
        "fallback_chain": ["groq", "gemini", "nvidia"],
    },
    "market": {
        "env_prefix": "AGENT_MARKET",
        "capability": "reasoning",
        "default_provider": "gemini",
        "default_model": "gemini-3.5-flash",
        "default_temperature": 0.2,
        "fallback_chain": ["gemini", "groq", "nvidia"],
    },
    "market_intelligence": {
        "env_prefix": "AGENT_MARKET_INTELLIGENCE",
        "capability": "reasoning",
        "default_provider": "gemini",
        "default_model": "gemini-3.5-flash",
        "default_temperature": 0.2,
        "fallback_chain": ["gemini", "groq", "nvidia"],
    },
    "linkedin": {
        "env_prefix": "AGENT_LINKEDIN",
        "capability": "creative",
        "default_provider": "gemini",
        "default_model": "gemini-3.5-flash",
        "default_temperature": 0.7,
        "fallback_chain": ["gemini", "groq", "nvidia"],
    },
    "roadmap_structure": {
        "env_prefix": "AGENT_ROADMAP_STRUCTURE",
        "capability": "reasoning",
        "default_provider": "groq",
        "default_model": "openai/gpt-oss-120b",
        "default_temperature": 0.4,
        "fallback_chain": ["groq", "gemini", "nvidia"],
    },
    "roadmap_details": {
        "env_prefix": "AGENT_ROADMAP_DETAILS",
        "capability": "cheap",
        "default_provider": "groq",
        "default_model": "openai/gpt-oss-120b",
        "default_temperature": 0.5,
        "fallback_chain": ["groq", "gemini", "nvidia"],
    },

    "interview": {
        "env_prefix": "AGENT_INTERVIEW",
        "capability": "fast_streaming",
        "default_provider": "groq",
        "default_model": "openai/gpt-oss-20b",
        "default_temperature": 0.65,
        "fallback_chain": ["groq", "nvidia"],
    },
    "interview_feedback": {
        "env_prefix": "AGENT_INTERVIEW_FEEDBACK",
        "capability": "reasoning",
        "default_provider": "groq",
        "default_model": "openai/gpt-oss-120b",
        "default_temperature": 0.6,
        "fallback_chain": ["groq", "nvidia"],
    },
    "interview_evaluator": {
        "env_prefix": "AGENT_INTERVIEW_EVALUATOR",
        "capability": "structured_json",
        "default_provider": "groq",
        "default_model": "openai/gpt-oss-120b",
        "default_temperature": 0.2,
        "fallback_chain": ["groq", "nvidia"],
    },
}


class LLMConfigManager:
    """
    Central model selection manager.
    
    Usage:
        config = LLMConfigManager.get_agent_config("resume")
        # Returns: {"provider": "groq", "model": "openai/gpt-oss-120b", "temperature": 0.3, "fallback_chain": [...]}
    """

    @classmethod
    def get_agent_config(cls, agent_name: str) -> dict:
        """
        Get the LLM configuration for a specific agent.
        
        Priority:
        1. .env override: AGENT_<NAME>_PROVIDER, AGENT_<NAME>_MODEL, AGENT_<NAME>_TEMPERATURE
        2. Default profile values
        3. Global fallback (groq)
        """
        profile = AGENT_PROFILES.get(agent_name)
        if not profile:
            logger.warning(f"No LLM profile found for agent '{agent_name}' — using global defaults")
            return cls._global_fallback()

        env_prefix = profile["env_prefix"]

        provider = os.getenv(f"{env_prefix}_PROVIDER", profile["default_provider"])
        model = os.getenv(f"{env_prefix}_MODEL", profile["default_model"])
        temperature = float(os.getenv(f"{env_prefix}_TEMPERATURE", str(profile["default_temperature"])))

        config = {
            "provider": provider,
            "model": model,
            "temperature": temperature,
            "fallback_chain": profile["fallback_chain"],
            "capability": profile["capability"],
        }

        logger.debug(
            f"Agent '{agent_name}' → provider={provider}, model={model}, "
            f"temp={temperature}, capability={profile['capability']}"
        )
        return config

    @classmethod
    def get_provider_for_agent(cls, agent_name: str) -> str:
        """Quick access to just the provider name."""
        return cls.get_agent_config(agent_name)["provider"]

    @classmethod
    def get_model_for_agent(cls, agent_name: str) -> str:
        """Quick access to just the model name."""
        return cls.get_agent_config(agent_name)["model"]

    @classmethod
    def get_temperature_for_agent(cls, agent_name: str) -> float:
        """Quick access to just the temperature."""
        return cls.get_agent_config(agent_name)["temperature"]

    @classmethod
    def get_fallback_chain_for_agent(cls, agent_name: str) -> list:
        """Quick access to just the fallback chain."""
        return cls.get_agent_config(agent_name)["fallback_chain"]

    @classmethod
    def _global_fallback(cls) -> dict:
        """Fallback when no profile exists."""
        return {
            "provider": os.getenv("LLM_PROVIDER", "groq"),
            "model": os.getenv("GROQ_MODEL", "openai/gpt-oss-120b"),
            "temperature": 0.7,
            "fallback_chain": ["groq", "gemini", "nvidia"],
            "capability": "unknown",
        }

    @classmethod
    def list_all_agents(cls) -> list[str]:
        """Returns list of all configured agent names."""
        return list(AGENT_PROFILES.keys())

    @classmethod
    def get_capability_summary(cls) -> dict[str, str]:
        """Returns a summary of which agent uses which provider/model."""
        summary = {}
        for agent_name in AGENT_PROFILES:
            config = cls.get_agent_config(agent_name)
            summary[agent_name] = f"{config['provider']}/{config['model']} (cap: {config['capability']})"
        return summary