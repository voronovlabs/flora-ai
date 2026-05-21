"""Typed application errors + a single FastAPI exception handler.

Kept lean on purpose: only the errors we actually raise show up here,
each maps to a stable HTTP status and a stable error code so clients
can switch on it.
"""

from __future__ import annotations

from typing import Any, Optional

from fastapi import Request
from fastapi.responses import JSONResponse


class FloraError(Exception):
    """Base class for application errors."""

    status_code: int = 500
    code: str = "internal_error"

    def __init__(
        self,
        message: str = "Internal error",
        *,
        details: Optional[dict[str, Any]] = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or {}


class BadRequest(FloraError):
    status_code = 400
    code = "bad_request"


class NotFound(FloraError):
    status_code = 404
    code = "not_found"


class UpstreamError(FloraError):
    status_code = 502
    code = "upstream_error"


class SafetyViolation(FloraError):
    """LLM-produced output failed the SQL safety net."""

    status_code = 422
    code = "safety_violation"


async def flora_error_handler(request: Request, exc: FloraError) -> JSONResponse:
    from backend.core.middleware import current_request_id

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "ok": False,
            "error": {
                "code":    exc.code,
                "message": exc.message,
                "details": exc.details,
            },
            "_meta": {"request_id": current_request_id()},
        },
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all 500 handler.

    The default FastAPI behavior is to return ``{"detail": "Internal Server
    Error"}`` with no correlation. That makes incidents painful to debug.
    Here we log the full traceback under the request's id and return a
    stable envelope so the client can show the rid back to support.
    """
    # Imported lazily so middleware can import errors.py without a cycle.
    from backend.core.logging import get_logger
    from backend.core.middleware import current_request_id

    rid = current_request_id()
    get_logger("flora.errors").exception(
        "unhandled exception",
        extra={"rid": rid, "path": getattr(request.url, "path", "-"),
               "err": str(exc)[:200]},
    )
    return JSONResponse(
        status_code=500,
        content={
            "ok": False,
            "error": {
                "code":    "internal_error",
                "message": "Internal server error",
                "details": {},
            },
            "_meta": {"request_id": rid},
        },
    )
