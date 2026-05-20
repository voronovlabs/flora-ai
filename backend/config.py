"""Backward-compatible shim.

The legacy flat constants (``DB_HOST``, ``OPENAI_API_KEY``, ...) used
to live here. Code that imports from ``backend.config`` keeps working
unchanged, but the values now come from the typed
``backend.core.config.Settings`` instance, which validates at startup.

New code should prefer::

    from backend.core.config import get_settings
    settings = get_settings()
"""

from __future__ import annotations

from backend.core.config import get_settings

_s = get_settings()

# Database
DB_HOST = _s.db.host
DB_PORT = _s.db.port
DB_USER = _s.db.user
DB_PASSWORD = _s.db.password
DB_NAME = _s.db.name

# AI / OpenAI
OPENAI_API_KEY = _s.ai.openai_api_key
OPENAI_MODEL = _s.ai.openai_model

# Smart query safety
SMART_MAX_ROWS = _s.smart.max_rows
SMART_DEFAULT_LIMIT = _s.smart.default_limit
SMART_REQUEST_TIMEOUT = _s.smart.request_timeout_seconds

# SQL whitelist (LLM is allowed to touch these only)
ALLOWED_TABLES = set(_s.allowed_tables)
ALLOWED_COLUMNS = {
    "dm.comp_daily_prices": {
        "source", "d", "product_key", "name", "price",
    },
}

# Sources we accept as user-explicit competitor filters.
KNOWN_SOURCES = _s.known_sources
