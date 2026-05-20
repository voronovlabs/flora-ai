"""Backward-compatible shim. Real implementation lives in
``backend.ai.safety.sql_guard`` so AI safety is grouped with the rest
of the engine.
"""

from __future__ import annotations

from backend.ai.safety.sql_guard import (  # noqa: F401  (re-exports)
    DISALLOWED_SQL_RE,
    FROM_JOIN_RE,
    LIMIT_RE,
    enforce_limit,
    extract_tables,
    normalize_sql,
    validate_llm_sql,
)
