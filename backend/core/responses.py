"""Response envelope helpers.

IMPORTANT — legacy compatibility:
  The four shipped endpoints (/health, /stats, /ask, /smart) MUST keep
  their existing JSON shape so the frontend doesn't break. Don't wrap
  them. The helpers below are for NEW endpoints (analytics drilldowns,
  insights, etc.) so we can converge on a single envelope going
  forward.

Envelope shape::

    {
      "ok":   true|false,
      "data": <payload> | null,
      "error": null | { "code", "message", "details" },
      "_meta": { "request_id", "model"?, "duration_ms"? }
    }
"""

from __future__ import annotations

from typing import Any, Optional

from backend.core.middleware import current_request_id


def ok(
    data: Any = None,
    *,
    meta: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    return {
        "ok": True,
        "data": data,
        "error": None,
        "_meta": {
            "request_id": current_request_id(),
            **(meta or {}),
        },
    }


def fail(
    code: str,
    message: str,
    *,
    status: int = 500,        # unused here; raise FloraError to surface
    details: Optional[dict[str, Any]] = None,
    meta: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    return {
        "ok": False,
        "data": None,
        "error": {"code": code, "message": message, "details": details or {}},
        "_meta": {
            "request_id": current_request_id(),
            **(meta or {}),
        },
    }
