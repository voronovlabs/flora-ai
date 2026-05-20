"""Centralized configuration loaded from environment variables.

All values keep the same defaults the legacy `flora-api/main.py` used so
behavior remains byte-for-byte compatible.
"""

from __future__ import annotations

import os


# ── Database ─────────────────────────────────────────────────────────
DB_HOST = os.getenv("DB_HOST", "host.docker.internal")
DB_PORT = int(os.getenv("DB_PORT", "55432"))
DB_USER = os.getenv("DB_USER", "flower")
DB_PASSWORD = os.getenv("DB_PASSWORD", "flower")
DB_NAME = os.getenv("DB_NAME", "flower")

# ── OpenAI / LLM ─────────────────────────────────────────────────────
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip() or "gpt-4o-mini"

# ── Smart query safety knobs ─────────────────────────────────────────
SMART_MAX_ROWS = int(os.getenv("SMART_MAX_ROWS", "200"))
SMART_DEFAULT_LIMIT = int(os.getenv("SMART_DEFAULT_LIMIT", "50"))
SMART_REQUEST_TIMEOUT = float(os.getenv("SMART_REQUEST_TIMEOUT", "15"))

# ── SQL whitelist (LLM is allowed to touch these only) ───────────────
ALLOWED_TABLES = {
    "dm.comp_daily_prices",
}

ALLOWED_COLUMNS = {
    "dm.comp_daily_prices": {
        "source",
        "d",
        "product_key",
        "name",
        "price",
    },
}

# Sources we accept as user-explicit competitor filters. Hardcoded for
# parity with legacy /smart behavior.
KNOWN_SOURCES = (
    "florist", "florist.ru",
    "flowwow",
    "semicvetic", "semicvetik", "семицветик",
    "azalia", "azalianow", "азалия",
)
