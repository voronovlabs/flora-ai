"""Typed, env-driven settings with validation.

Replaces the flat module-level constants in ``backend.config`` with a
single ``Settings`` instance that:

* validates types and ranges at startup (fail-fast),
* exposes feature flags as first-class fields,
* groups AI provider knobs so we can later route between providers,
* is cached so repeated ``get_settings()`` calls are free.

``backend.config`` re-exports the same constants for backward
compatibility with code that imported them directly.
"""

from __future__ import annotations

from functools import lru_cache
from typing import FrozenSet, Tuple

from pydantic import BaseModel, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


# ── nested groups ───────────────────────────────────────────────────


class DatabaseSettings(BaseModel):
    host: str = "host.docker.internal"
    port: int = Field(default=55432, ge=1, le=65535)
    user: str = "flower"
    password: str = "flower"
    name: str = "flower"
    connect_timeout_seconds: int = Field(default=5, ge=1, le=60)


class SmartSettings(BaseModel):
    """Knobs for the /smart query pipeline."""

    max_rows: int = Field(default=200, ge=1, le=5000)
    default_limit: int = Field(default=50, ge=1, le=5000)
    request_timeout_seconds: float = Field(default=15.0, ge=1.0, le=120.0)


class AISettings(BaseModel):
    """LLM provider routing knobs.

    Today we only ship OpenAI Responses, but ``provider`` exists so we
    can swap to Anthropic / Yandex / local without touching call-sites.
    """

    provider: str = Field(default="openai", description="openai | anthropic | yandex | mock")
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"


class FeatureFlags(BaseModel):
    """All booleans live here so we have one place to grep.

    Flags default to safe (off / equivalent-to-legacy) so the legacy
    runtime behavior is unchanged unless explicitly opted in.
    """

    use_repository_layer: bool = True   # routes prefer repo over inline SQL
    expose_debug_endpoints: bool = False  # /debug/* (future)
    enable_request_id_header: bool = True  # surface X-Request-ID in responses


# ── root settings ───────────────────────────────────────────────────


class Settings(BaseSettings):
    """Top-level config. Loaded from environment / .env.

    Field names map to env vars via the ``env`` aliases below so legacy
    variables (DB_HOST, OPENAI_API_KEY, …) continue to work without
    renaming on the server.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        env_nested_delimiter="__",
        case_sensitive=False,
    )

    environment: str = Field(default="dev", description="dev | staging | prod")
    app_name: str = "flora-api"
    app_version: str = "0.3.0"

    db: DatabaseSettings = DatabaseSettings()
    smart: SmartSettings = SmartSettings()
    ai: AISettings = AISettings()
    flags: FeatureFlags = FeatureFlags()

    # SQL whitelist used by the LLM safety net. Kept here so config is
    # the single place to widen the surface area when new datamarts get
    # added to the analytics layer.
    allowed_tables: FrozenSet[str] = frozenset({"dm.comp_daily_prices"})
    known_sources: Tuple[str, ...] = (
        "florist", "florist.ru",
        "flowwow",
        "semicvetic", "semicvetik", "семицветик",
        "azalia", "azalianow", "азалия",
    )

    @field_validator("environment")
    @classmethod
    def _normalize_environment(cls, v: str) -> str:
        v = (v or "").strip().lower()
        if v not in {"dev", "staging", "prod", "test"}:
            return "dev"
        return v


def _build_settings() -> Settings:
    """Read flat env vars into the nested structure.

    We intentionally support BOTH styles so the legacy server-side env
    files keep working:

      DB_HOST=...                    (flat — legacy)
      OPENAI_API_KEY=...             (flat — legacy)
      SMART_MAX_ROWS=...             (flat — legacy)

    pydantic-settings would normally require DB__HOST / AI__OPENAI_API_KEY,
    so we map manually here.
    """
    import os
    base = Settings()
    flat = {
        "db": {
            "host":     os.getenv("DB_HOST", base.db.host),
            "port":     int(os.getenv("DB_PORT", base.db.port)),
            "user":     os.getenv("DB_USER", base.db.user),
            "password": os.getenv("DB_PASSWORD", base.db.password),
            "name":     os.getenv("DB_NAME", base.db.name),
        },
        "smart": {
            "max_rows":                int(os.getenv("SMART_MAX_ROWS", base.smart.max_rows)),
            "default_limit":           int(os.getenv("SMART_DEFAULT_LIMIT", base.smart.default_limit)),
            "request_timeout_seconds": float(os.getenv("SMART_REQUEST_TIMEOUT", base.smart.request_timeout_seconds)),
        },
        "ai": {
            "provider":       os.getenv("AI_PROVIDER", base.ai.provider),
            "openai_api_key": os.getenv("OPENAI_API_KEY", base.ai.openai_api_key).strip(),
            "openai_model":   (os.getenv("OPENAI_MODEL", base.ai.openai_model) or base.ai.openai_model).strip(),
        },
        "flags": {
            "use_repository_layer":      os.getenv("FF_USE_REPOSITORY_LAYER", "1") == "1",
            "expose_debug_endpoints":    os.getenv("FF_EXPOSE_DEBUG_ENDPOINTS", "0") == "1",
            "enable_request_id_header":  os.getenv("FF_ENABLE_REQUEST_ID_HEADER", "1") == "1",
        },
        "environment": os.getenv("APP_ENV", base.environment),
    }
    return Settings(**flat)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return _build_settings()
