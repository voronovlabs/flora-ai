"""Convenience accessor for feature flags.

Centralized in core so call-sites can ``from backend.core.feature_flags
import is_enabled`` without leaking the whole Settings object.
"""

from __future__ import annotations

from backend.core.config import get_settings


def is_enabled(name: str) -> bool:
    flags = get_settings().flags
    return bool(getattr(flags, name, False))
