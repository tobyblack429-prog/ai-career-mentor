import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    # ─────────────────────────────────────────────────────────────────────────
    # LLM_PROVIDER options:
    #   "groq"   → 100% FREE, no credit card, use for DEV (RECOMMENDED!)
    #   "google" → Google Gemini 1.5 (Pro or Flash) via Vertex AI / AI Studio
    # ─────────────────────────────────────────────────────────────────────────


    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "groq")
    LLM_PROVIDERS_ORDER: list[str] = ["groq", "gemini", "nvidia"]

    # SiliconFlow: select a model marked free in the provider's live pricing page.
    SILICONFLOW_API_KEY: str = os.getenv("SILICONFLOW_API_KEY", "")
    SILICONFLOW_MODEL: str = os.getenv("SILICONFLOW_MODEL", "XingChenAGI/Xing4.0-29B")
    SILICONFLOW_API_BASE: str = "https://api.siliconflow.cn/v1"

    # ── GROQ (FREE — No Credit Card!) ─────────────────────────────────────────
    # Get key from: https://console.groq.com → API Keys → Create
    # Sign in with Google — that's it!
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")

    # ── Google Gemini (OpenAI-compatible API) ────────────────────────────────
    # Get key from: https://aistudio.google.com/
    GOOGLE_API_KEY: str = os.getenv("GOOGLE_API_KEY", "")
    GOOGLE_MODEL: str = os.getenv("GOOGLE_MODEL", "gemini-3.5-flash")
    GOOGLE_API_BASE: str = os.getenv("GOOGLE_API_BASE", "https://generativelanguage.googleapis.com/v1beta/openai")

    # ── NVIDIA NIM (FREE API Endpoints) ──────────────────────────────────────
    NVIDIA_API_KEY: str = os.getenv("NVIDIA_API_KEY", "")
    NVIDIA_MODEL: str = os.getenv("NVIDIA_MODEL", "nvidia/nemotron-3-super-120b-a12b")

    # ── Database ──────────────────────────────────────────────────────────────
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./dev.db")

    # ── Auth ──────────────────────────────────────────────────────────────────
    SECRET_KEY: str = os.getenv("SECRET_KEY") or os.getenv("JWT_SECRET", "dev-secret-change-in-prod")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "30"))
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")

    # ── Search Engines (Professional APIs) ──────────────────────────────────
    SERPER_API_KEY: str = os.getenv("SERPER_API_KEY", "")
    TAVILY_API_KEY: str = os.getenv("TAVILY_API_KEY", "")
    BING_SEARCH_API_KEY: str = os.getenv("BING_SEARCH_API_KEY", "")

    # ── App ───────────────────────────────────────────────────────────────────
    APP_ENV: str = os.getenv("APP_ENV", "development")
    DEBUG: bool = APP_ENV == "development"
    AUTH_DISABLED: bool = (
        os.getenv("AUTH_DISABLED", "false").lower() == "true"
        and os.getenv("TESTING", "false").lower() != "true"
        and os.getenv("CI", "false").lower() != "true"
    )

    # ── Observability & RBAC ──────────────────────────────────────────────────
    ADMIN_EMAIL: str = os.getenv("ADMIN_EMAIL", "anilpradhan9644@gmail.com")
    SENTRY_DSN: str = os.getenv("SENTRY_DSN", "")
    ENABLE_OBSERVABILITY: bool = os.getenv("ENABLE_OBSERVABILITY", "true").lower() == "true"
    CORS_ORIGINS: list[str] = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:3000,https://ai-career-mentor.vercel.app,https://ai-career-mentor-anil.vercel.app",
        ).split(",")
        if origin.strip() and origin.strip() != "*"
    ]

    def __init__(self):
        # Resolve relative SQLite URL to absolute project root directory
        if self.DATABASE_URL.startswith("sqlite:///"):
            from pathlib import Path
            db_file = self.DATABASE_URL.split("sqlite:///")[1]
            if db_file.startswith("./") or db_file.startswith(".\\"):
                db_file = db_file[2:]
            
            # Resolve relative path relative to project ROOT folder
            if not os.path.isabs(db_file):
                config_path = Path(os.path.abspath(__file__))
                root_dir = config_path.parent.parent.parent.parent
                abs_db_path = str(root_dir / db_file)
                self.DATABASE_URL = f"sqlite:///{abs_db_path}"

        if self.APP_ENV == "production":
            if self.DATABASE_URL.startswith("sqlite"):
                raise ValueError("CRITICAL: SQLite cannot be used in production! Please set a valid PostgreSQL DATABASE_URL.")
            if self.SECRET_KEY == "dev-secret-change-in-prod":
                raise ValueError("CRITICAL: SECRET_KEY is still the default placeholder! Generate a strong secret for production.")

    def get_llm_config(self, provider: str = None) -> dict:
        """
        Returns technical parameters for supported LLM providers.
        If provider is None, uses the default from LLM_PROVIDER env.
        """
        active_provider = provider or self.LLM_PROVIDER
        
        if active_provider == "siliconflow":
            return {
                "config_list": [{
                    "model": self.SILICONFLOW_MODEL,
                    "api_key": self.SILICONFLOW_API_KEY,
                    "base_url": self.SILICONFLOW_API_BASE,
                    "api_type": "openai",
                    "price": [0.0, 0.0],
                }],
                "temperature": 0.7,
                "timeout": 120,
                "max_tokens": 4096,
                "cache_seed": None,
            }

        if active_provider in ("gemini", "google"):
            # ── Google Gemini (FREE tier via OpenAI-compatible API) ─────────────
            return {
                "config_list": [{
                    "model": self.GOOGLE_MODEL,
                    "api_key": self.GOOGLE_API_KEY,
                    "base_url": self.GOOGLE_API_BASE,
                    "api_type": "openai",
                    "price": [0.0, 0.0],
                }],
                "temperature": 0.7,
                "timeout": 120,
                "max_tokens": 4096,
                "cache_seed": None,
            }

        elif active_provider == "groq":
            # ── Groq (FREE, OpenAI-compatible API) ───────────────────────────
            return {
                "config_list": [{
                    "model": self.GROQ_MODEL,
                    "api_key": self.GROQ_API_KEY,
                    "base_url": "https://api.groq.com/openai/v1",
                    "api_type": "openai",
                    "price": [0.00059, 0.00079],
                }],
                "temperature": 0.8,
                "timeout": 120,
                "max_tokens": 4096,
                "cache_seed": None,
            }

        elif active_provider == "nvidia":
            # ── NVIDIA NIM (OpenAI-compatible API) ───────────────────────────
            return {
                "config_list": [{
                    "model": self.NVIDIA_MODEL,
                    "api_key": self.NVIDIA_API_KEY,
                    "base_url": "https://integrate.api.nvidia.com/v1",
                    "api_type": "openai",
                    "price": [0.0, 0.0],
                }],
                "temperature": 0.7,
                "timeout": 120,
                "max_tokens": 4096,
                "cache_seed": None,
            }

        else:
            # ── Google Gemini (Default Fallback) ─────────────────────────────
            return {
                "config_list": [{
                    "model": self.GOOGLE_MODEL,
                    "api_key": self.GOOGLE_API_KEY,
                    "base_url": self.GOOGLE_API_BASE,
                    "api_type": "openai",
                    "price": [0.0, 0.0],
                }],
                "temperature": 0.8,
                "timeout": 120,
                "max_tokens": 4096,
                "cache_seed": None,
            }

    @property
    def llm_config(self) -> dict:
        """Default AutoGen-compatible LLM config."""
        return self.get_llm_config()

    @property
    def is_configured(self) -> bool:
        """Return True when at least one supported LLM provider is available."""
        if self.LLM_PROVIDER == "siliconflow":
            return bool(self.SILICONFLOW_API_KEY)
        return bool(
            self.SILICONFLOW_API_KEY or
            self.GROQ_API_KEY or
            self.NVIDIA_API_KEY or
            self.GOOGLE_API_KEY
        )

    @property
    def active_model(self) -> str:
        """Returns the currently active model name for logging."""
        if self.LLM_PROVIDER == "siliconflow":
            return self.SILICONFLOW_MODEL
        if self.LLM_PROVIDER == "nvidia":
            return self.NVIDIA_MODEL
        elif self.LLM_PROVIDER in ("gemini", "google"):
            return self.GOOGLE_MODEL
        return self.GROQ_MODEL


# Single global instance
settings = Settings()
